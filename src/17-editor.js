/* ---------- Song editor: a piano roll over the generated song ----------
   Edits are stored per part and per bar in song.edits, as absolute notes [midi, step, length]
   (drums as a 10 x 16 grid). generateBar() applies them on top of what was generated, so playback,
   WAV and MIDI export all include them. Untouched bars stay generated. */

const ED_PARTS = {
  lead:  {label:'Lead',  lo:52, hi:88},
  vocal: {label:'Vocal', lo:50, hi:82},
  bass:  {label:'Bass',  lo:26, hi:58},
  drums: {label:'Drums'},
};
const ED_VOWELS = [['o','a'], ['a'], ['e'], ['a','o'], ['u','a']];

// Put a bar's edits on top of the generated bar
function applyEdits(p, n){
  const E = state.song && state.song.edits;
  if(!E || !p) return p;
  if(E.drums && E.drums[n]) p.drums = E.drums[n].map(r => r.slice());
  if(E.lead && E.lead[n]){
    const LS = p.leadSynth || {wave: (state.song.dna && state.song.dna.lead) || 'lead', octave:4, transpose:0};
    const base = 12*(LS.octave + 1) + (LS.transpose || 0);
    p.leadSynth = LS; p.lead = E.lead[n].map(([m, s, d]) => [m - base, s, d]);
  }
  if(E.vocal && E.vocal[n]){
    let prev = null;
    p.vocal = E.vocal[n].map(([m, s, d], k) => { const v = {s, len: d, m, vw: ED_VOWELS[k % ED_VOWELS.length], from: prev}; prev = m; return v; });
  }
  if(E.bass && E.bass[n]){ p.bassAbs = E.bass[n].map(x => x.slice()); p.notes = Array.from({length:ROWS}, () => Array(STEPS).fill(false)); p.sub = false; }
  return p;
}
const hasEdits = song => !!(song && song.edits && Object.values(song.edits).some(part => part && Object.keys(part).length));

// What a bar currently contains for one part, as absolute notes (or the drum grid)
function barContent(part, n){
  const p = generateBar(n); if(!p) return part === 'drums' ? DRUMS.map(() => Array(STEPS).fill(false)) : [];
  if(part === 'drums') return p.drums.map(r => r.slice());
  if(part === 'lead'){
    if(!p.lead || !p.leadSynth) return [];
    const base = 12*(p.leadSynth.octave + 1) + (p.leadSynth.transpose || 0);
    return p.lead.map(([r, s, d]) => [base + r, s, d || Math.max(1, Math.round(p.leadSynth.len || 1))]);
  }
  if(part === 'vocal') return (p.vocal || []).map(v => [v.m, v.s, Math.max(1, Math.round(v.len))]);
  if(part === 'bass'){
    if(p.bassAbs) return p.bassAbs.map(x => x.slice());
    const S = p.synth || state.synth, out = [], len = Math.max(1, Math.round(S.len || 1));
    for(let r=0;r<ROWS;r++) for(let s=0;s<STEPS;s++) if(p.notes[r][s]) out.push([12*(S.octave + 1) + r + (S.transpose || 0), s, len]);
    return out;
  }
  return [];
}
function editBar(part, n, fn){
  const song = state.song; song.edits = song.edits || {}; song.edits[part] = song.edits[part] || {};
  const before = song.edits[part][n];
  edState.undo.push({part, n, before: before === undefined ? undefined : JSON.parse(JSON.stringify(before))});
  if(edState.undo.length > 50) edState.undo.shift();
  const cur = before !== undefined ? before : barContent(part, n);
  song.edits[part][n] = fn(cur);
  edChanged();
}
function edChanged(){
  save(); edDraw();
  if(playing && rMode){ bar = currentBar() + 1; rReset(); }   // re-render upcoming bars with the edit
}
function edSections(){ return state.song ? arr() : []; }
function edRange(){
  const sec = edSections()[edState.sec]; if(!sec) return null;
  const first = sec.start + edState.page*4;
  return {sec, first, count: Math.min(4, sec.start + sec.bars - first)};
}

function edPreview(part, m, row){
  ensureAudio(); const t = ctx.currentTime + 0.02;
  if(part === 'drums'){ const id = DRUMS[row].id, hit = drumSample(id); hit ? playHit(hit, t, 0.8, 1) : VOICES[id](t, 0.8, false); return; }
  if(part === 'vocal') return sampleBufs.voice_oohs ? singSampled(m, t, 0.4, state.mix.vocal.vol, {}) : sing(m, t, 0.4, ['a'], state.mix.vocal.vol);
  if(part === 'bass') return playNote(m, t, state.mix.synth.vol, {wave:'rockbass', octave:-1, transpose:0, len:2});
  return playNote(m, t, state.mix.lead.vol, {wave:'lead', octave:-1, transpose:0, len:2});
}

// Drawing
function edGeometry(){
  const cv = $('edCanvas'), part = edState.part, rows = part === 'drums' ? DRUMS.length : ED_PARTS[part].hi - ED_PARTS[part].lo + 1;
  const pw = cv.parentElement && cv.parentElement.clientWidth, w = Math.max(640, typeof pw === 'number' && pw > 0 ? pw : 900) - 4, label = 58;
  const rowH = part === 'drums' ? 22 : 12, colW = (w - label)/64;
  return {cv, rows, w, h: rows*rowH + 18, label, rowH, colW};
}
function edDraw(step){
  if(!edState || !state.song) return;
  const g = edGeometry(), c = g.cv.getContext && g.cv.getContext('2d'); if(!c || !c.fillRect) return;
  const R = edRange(); if(!R) return;
  const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
  if(g.cv.width !== Math.round(g.w*dpr)){ g.cv.width = Math.round(g.w*dpr); g.cv.height = Math.round(g.h*dpr); g.cv.style.width = g.w + 'px'; g.cv.style.height = g.h + 'px'; }
  else if(g.cv.height !== Math.round(g.h*dpr)){ g.cv.height = Math.round(g.h*dpr); g.cv.style.height = g.h + 'px'; }
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  const css = n => (typeof getComputedStyle === 'function' && getComputedStyle(document.documentElement).getPropertyValue(n).trim()) || '#888';
  const bg = css('--cell'), alt = css('--cell-alt'), out = css('--black-row'), line = css('--line'), ink = css('--ink'), muted = css('--muted');
  c.clearRect(0, 0, g.w, g.h);
  const part = edState.part, sc = SCALES[state.song.scale], K = keyOff(state.song);
  const pitchOf = row => ED_PARTS[part].hi - row;
  for(let row=0; row<g.rows; row++){
    const y = 18 + row*g.rowH;
    let inKey = true, name = '';
    if(part === 'drums') name = DRUMS[row].name;
    else { const m = pitchOf(row), pc = ((m - 60 - K) % 12 + 12) % 12; inKey = sc.includes(pc); name = NOTE_NAMES[m % 12] + (Math.floor(m/12) - 1); }
    for(let col=0; col<64; col++){
      c.fillStyle = !inKey ? out : Math.floor(col/4) % 2 ? alt : bg;
      c.fillRect(g.label + col*g.colW + 0.5, y + 0.5, g.colW - 1, g.rowH - 1);
    }
    if(part === 'drums' || /^C\d/.test(name) || row % 2 === 0){ c.fillStyle = inKey ? ink : muted; c.font = '10px ' + css('--body'); c.fillText(name, 4, y + g.rowH - 3); }
  }
  // bar numbers and bar lines
  c.fillStyle = muted; c.font = '11px ' + css('--display');
  for(let b=0; b<R.count; b++){ c.fillText('Bar ' + (R.first - R.sec.start + b + 1), g.label + b*16*g.colW + 3, 12); }
  c.fillStyle = line; for(let b=1; b<4; b++) c.fillRect(g.label + b*16*g.colW - 1, 16, 2, g.h - 16);
  // notes
  for(let b=0; b<R.count; b++){
    const n = R.first + b, edited = state.song.edits && state.song.edits[part] && state.song.edits[part][n] !== undefined;
    c.fillStyle = edited ? '#E0703C' : (part === 'drums' ? '#5AB0F0' : part === 'vocal' ? '#FF8FB1' : part === 'bass' ? '#8A93F0' : '#9CCB4E');
    const content = barContent(part, n);
    if(part === 'drums') content.forEach((r, row) => r.forEach((on, s) => { if(on) c.fillRect(g.label + (b*16 + s)*g.colW + 2, 18 + row*g.rowH + 3, g.colW - 4, g.rowH - 6); }));
    else content.forEach(([m, s, d]) => {
      const row = ED_PARTS[part].hi - m; if(row < 0 || row >= g.rows) return;
      c.fillRect(g.label + (b*16 + s)*g.colW + 1, 18 + row*g.rowH + 1, Math.max(3, Math.min(d, 16 - s)*g.colW - 2), g.rowH - 2);
    });
  }
  if(step !== undefined && step >= 0){ c.fillStyle = ink; c.fillRect(g.label + step*g.colW, 16, 2, g.h - 16); }
}
function edPlayhead(s){
  if(!edState || !genView || genView.n === undefined) return;
  const R = edRange(); if(!R) return;
  const b = genView.n - R.first;
  if(b >= 0 && b < R.count) edDraw(b*16 + s); else if(edState.lastHead !== undefined) edDraw();
  edState.lastHead = b >= 0 && b < R.count ? s : undefined;
}

function edClick(ev){
  if(!state.song) return;
  const g = edGeometry(), rect = g.cv.getBoundingClientRect(), x = ev.clientX - rect.left, y = ev.clientY - rect.top;
  const col = Math.floor((x - g.label)/g.colW), row = Math.floor((y - 18)/g.rowH), R = edRange();
  if(!R || col < 0 || col >= 64 || row < 0 || row >= g.rows) return;
  const b = Math.floor(col/16), s = col % 16; if(b >= R.count) return;
  const n = R.first + b, part = edState.part;
  if(part === 'drums'){
    editBar('drums', n, grid => { const out = grid.map(r => r.slice()); out[row][s] = !out[row][s]; if(out[row][s]) edPreview('drums', 0, row); return out; });
    return;
  }
  const m = ED_PARTS[part].hi - row;
  editBar(part, n, notes => {
    const hit = notes.findIndex(([nm, ns, nd]) => nm === m && s >= ns && s < ns + nd);
    if(hit >= 0) return notes.filter((_, k) => k !== hit);
    edPreview(part, m);
    const len = Math.min(edState.len, 16 - s);
    return notes.filter(([nm, ns, nd]) => !(nm === m && ns < s + len && ns + nd > s)).concat([[m, s, len]]).sort((a, b) => a[1] - b[1]);
  });
}
function edUndo(){
  const u = edState.undo.pop(); if(!u || !state.song.edits) return;
  if(u.before === undefined) delete state.song.edits[u.part][u.n]; else state.song.edits[u.part][u.n] = u.before;
  edChanged();
}
function edResetPage(){
  const R = edRange(), E = state.song && state.song.edits && state.song.edits[edState.part]; if(!R || !E) return;
  for(let b=0; b<R.count; b++){ const n = R.first + b; if(E[n] !== undefined){ edState.undo.push({part: edState.part, n, before: E[n]}); delete E[n]; } }
  edChanged();
}
// Keep the section list in step with the current song
function edRefresh(){
  if(!edState) return;
  const secs = edSections(), sel = $('edSec'), key = state.song ? songCode(state.song) + secs.length : '';
  if(edState.key !== key){
    edState.key = key; edState.undo = [];
    sel.replaceChildren(...secs.map((x, k) => new Option(`${x.label} (${x.bars} bars)`, k)));
    edState.sec = Math.min(edState.sec, Math.max(0, secs.length - 1)); edState.page = 0; sel.value = edState.sec;
  }
  const R = edRange();
  $('edPage').textContent = R ? `Bars ${R.first - R.sec.start + 1}–${R.first - R.sec.start + R.count} of ${R.sec.bars}` : 'Press New song to start';
  document.querySelectorAll('[data-edpart]').forEach(b => b.setAttribute('aria-pressed', b.dataset.edpart === edState.part));
  edDraw();
}

// Controls
edState = {part:'lead', sec:0, page:0, len:2, undo:[], key:null};
Object.entries(ED_PARTS).forEach(([id, P]) => {
  const b = document.createElement('button'); b.className = 'chip'; b.textContent = P.label; b.dataset.edpart = id;
  b.onclick = () => { edState.part = id; edRefresh(); };
  $('edParts').appendChild(b);
});
$('edSec').onchange = e => { edState.sec = +e.target.value; edState.page = 0; edRefresh(); };
$('edPrev').onclick = () => { if(edState.page > 0){ edState.page--; edRefresh(); } };
$('edNext').onclick = () => { const R = edRange(); if(R && R.first + 4 < R.sec.start + R.sec.bars){ edState.page++; edRefresh(); } };
$('edLen').onchange = e => { edState.len = +e.target.value; };
$('edUndo').onclick = edUndo;
$('edReset').onclick = edResetPage;
$('edPlay').onclick = () => { const R = edRange(); if(R) goToBar(R.first); };
$('edCanvas').addEventListener('pointerdown', edClick);
document.addEventListener('keydown', e => { if((e.ctrlKey || e.metaKey) && e.key === 'z' && !['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName)){ e.preventDefault(); edUndo(); } });
window.addEventListener && window.addEventListener('resize', () => edDraw());
edRefresh();
