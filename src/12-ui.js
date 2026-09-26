/* ---------- UI ---------- */
const $ = id => document.getElementById(id);
const el = (tag, cls) => { const e = document.createElement(tag); if(cls) e.className = cls; return e; };
const playBtn = $('play');
const cols = Array.from({length:STEPS}, () => []);
const drumCells = [], noteCells = [], heads = {}, keyLabels = [];

function channelHead(id, label, color, preview){
  const h = el('div','head');
  const m = el('button','ms m'); m.textContent='M'; m.setAttribute('aria-label',`Mute ${label}`);
  const s = el('button','ms s'); s.textContent='S'; s.setAttribute('aria-label',`Solo ${label}`);
  m.onclick = () => { state.mix[id].mute = !state.mix[id].mute; paint(); save(); };
  s.onclick = () => { state.mix[id].solo = !state.mix[id].solo; paint(); save(); };
  const n = el('button','name'); n.textContent = label; n.style.setProperty('--ch', color);
  n.onclick = () => { ensureAudio(); preview(ctx.currentTime); };
  const v = el('input'); v.type='range'; v.min=0; v.max=100; v.value=Math.round(state.mix[id].vol*100);
  v.setAttribute('aria-label',`${label} volume`);
  v.oninput = () => { state.mix[id].vol = v.value/100; save(); };
  h.append(m, s, n, v);
  heads[id] = {m, s, v};
  return h;
}
function makeStep(label, s){
  const b = el('button', 'step' + (Math.floor(s/4)%2 ? ' alt' : '') + (s && s%4===0 ? ' gap' : ''));
  b.type = 'button'; b.setAttribute('aria-label', label);
  cols[s].push(b);
  return b;
}

DRUMS.forEach((d,i) => {
  const row = el('div','row'); row.style.setProperty('--ch', d.color);
  row.appendChild(channelHead(d.id, d.name, d.color, t => VOICES[d.id](t, state.mix[d.id].vol)));
  drumCells[i] = [];
  for(let s=0;s<STEPS;s++){
    const b = makeStep(`${d.name} step ${s+1}`, s);
    b.onclick = () => {
      const on = pat().drums[i][s] = !pat().drums[i][s];
      if(on && !playing){ ensureAudio(); VOICES[d.id](ctx.currentTime, state.mix[d.id].vol); }
      paint(); save();
    };
    row.appendChild(b); drumCells[i][s] = b;
  }
  $('drums').appendChild(row);
});

const synthHead = channelHead('synth', 'Synth', SYNTH_COLOR, t => playNote(0, t, state.mix.synth.vol, syn()));
synthHead.querySelector('.name').remove();
$('synthControls').prepend(synthHead);

for(let r=ROWS-1;r>=0;r--){
  const pc = r % 12;
  const row = el('div', 'row' + (BLACK.has(pc) ? ' black' : '') + (pc===0 ? ' c' : ''));
  row.style.setProperty('--ch', SYNTH_COLOR);
  const k = el('div','key'); keyLabels[r] = k; row.appendChild(k);
  noteCells[r] = [];
  for(let s=0;s<STEPS;s++){
    const b = makeStep(`Note row ${r+1}, step ${s+1}`, s);
    b.onclick = () => {
      const on = pat().notes[r][s] = !pat().notes[r][s];
      if(on && !playing){ ensureAudio(); playNote(r, ctx.currentTime, state.mix.synth.vol, syn()); }
      paint(); save();
    };
    row.appendChild(b); noteCells[r][s] = b;
  }
  $('roll').appendChild(row);
}

const LAYER_PREVIEW = {
  lead:   t => playNote(7, t, state.mix.lead.vol, {wave:'lead', octave:4, len:3}),
  chords: t => playChord(0, t, 3, state.mix.chords.vol, MINOR, 'saws'),
  arp:    t => [0,3,7,12].forEach((r,i) => playArp(r, 0, t + i*stepDur(), state.mix.arp.vol)),
  sub:    t => playSub(0, 0, t, state.mix.sub.vol),
  vocal:  t => { const vs = state.vocalStyle || 'oohs', go = (m, at, d, from) => vs === 'synth' || !sampleBufs.voice_oohs ? sing(m, at, d, ['o','a'], state.mix.vocal.vol, {from}) : singSampled(m, at, d, state.mix.vocal.vol, {from, style:vs}); go(69, t, 0.9); go(72, t+0.9, 0.5, 69); go(76, t+1.4, 1.2, 72); },
  wall:   t => [48,63,67,72].forEach(m => synth(m, t, 1.2, 'wall', state.mix.wall.vol)),
  counter:t => [72,79,75].forEach((m,k) => synth(m, t + k*0.18, 0.4, 'bell', state.mix.counter.vol)),
  fx:     t => { riser(t, 0.8, 5, state.mix.fx.vol); impact(t+0.8, state.mix.fx.vol); },
};
LAYERS.forEach(l => $('layers').appendChild(channelHead(l.id, l.name, l.color, LAYER_PREVIEW[l.id])));
const patBtns = ['A','B','C','D'].map((name,i) => {
  const b = el('button','chip'); b.textContent = name; b.setAttribute('aria-label',`Pattern ${name}`);
  b.onclick = () => {
    state.current = i;
    if(playing){ playPattern = i; queue.forEach(q => q.pat = i); }
    paint(); save();
  };
  $('pats').appendChild(b); return b;
});

let shown = -1;
function showPlayhead(s){
  if(shown >= 0) cols[shown].forEach(c => c.classList.remove('now'));
  shown = s;
  if(s >= 0) cols[s].forEach(c => c.classList.add('now'));
}

function paint(){
  const p = pat();
  const setCell = (b, on) => { if(b._on !== on){ b._on = on; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); } };
  DRUMS.forEach((d,i) => drumCells[i].forEach((b,s) => setCell(b, !!p.drums[i][s])));
  const baseOct = syn().octave, relabel = paint._oct !== baseOct; paint._oct = baseOct;
  for(let r=0;r<ROWS;r++){
    noteCells[r].forEach((b,s) => setCell(b, !!p.notes[r][s]));
    if(relabel){
      const oct = baseOct + Math.floor(r/12);
      keyLabels[r].textContent = NOTE_NAMES[r%12] + oct;
      noteCells[r].forEach((b,s) => b.setAttribute('aria-label', `${NOTE_NAMES[r%12]}${oct}, step ${s+1}`));
    }
  }
  patBtns.forEach((b,i) => { b.setAttribute('aria-pressed', i===state.current); b.classList.toggle('has', !isEmpty(i)); });
  Object.entries(heads).forEach(([id,h]) => { h.m.setAttribute('aria-pressed', state.mix[id].mute); h.s.setAttribute('aria-pressed', state.mix[id].solo); if(document.activeElement !== h.v) h.v.value = Math.round(state.mix[id].vol*100); });
  $('chain').setAttribute('aria-pressed', state.chain);
  $('endless').setAttribute('aria-pressed', !!state.endless);
  $('render').setAttribute('aria-pressed', state.renderAhead !== false);
  const np = $('nowPlaying'), sg = state.song;
  np.hidden = !(state.endless && sg && STYLES[sg.style]);
  if(sg && STYLES[sg.style]){
    np.textContent = `Now playing “${sg.title}”, ${STYLES[sg.style].label} in ${KEYS[sg.key]} ${sg.scale} at ${sg.bpm} BPM` + (sg.form ? `, ${formOf(sg).label} with a ${LEAD_NAMES[sg.dna.lead] || 'lead'}` : '');
    if(genView && genView.phase){
      const tag = document.createElement('span'), bd = stepDur()*16;
      tag.className = 'phase ' + genView.phase;
      tag.textContent = `${genView.label}, bar ${genView.barIn+1} of ${genView.bars}`;
      if(genView.n !== undefined) tag.textContent += `  (${fmtTime(genView.n*bd)} of ${fmtTime(totalBars()*bd)})`;
      np.appendChild(tag);
    }
  }
  $('wave').value = patchOf(syn()); $('cutoff').value = syn().cutoff; $('octave').value = syn().octave;
  if(sg && STYLES[sg.style] && document.activeElement !== $('code')) $('code').value = sg.seed ? songCode(sg) : '';
  const favs = state.favorites || [], sel = $('favs');
  if(sel.options.length !== favs.length + 1){
    sel.replaceChildren(new Option('Favorites…', ''), ...favs.map(f => new Option(f.title + ' (' + f.code + ')', f.code)));
  }
}
