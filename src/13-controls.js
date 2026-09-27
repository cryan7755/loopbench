/* ---------- Transport controls ---------- */
const bpmIn = $('bpm');
const setBpm = v => { state.bpm = Math.min(200, Math.max(60, Math.round(v)||120)); bpmIn.value = state.bpm; save(); };
bpmIn.value = state.bpm;
bpmIn.onchange = () => setBpm(+bpmIn.value);
$('bpmDown').onclick = () => setBpm(state.bpm-1);
$('bpmUp').onclick = () => setBpm(state.bpm+1);
$('swing').value = state.swing; $('swing').oninput = e => { state.swing = +e.target.value; save(); };
$('master').value = Math.round(state.master*100);
$('master').oninput = e => { state.master = e.target.value/100; if(liveOut) liveOut.gain.value = state.master; save(); };
const NOTE_OPTS = []; for(let m=24;m<=84;m++) NOTE_OPTS.push([m, NOTE_NAMES[m%12] + (Math.floor(m/12)-1)]);
function paintSlots(){
  USER_SLOTS.forEach(sl => {
    const el = document.getElementById('slot-' + sl.id); if(!el) return;
    const r = userRaw[sl.id];
    el.querySelector('.file').textContent = r ? r.name + (hasUser(sl.id) ? '' : ' (loads when you press Play)') : 'No sample: using the built-in sound';
    el.querySelector('.clear').hidden = !r;
    const sel = el.querySelector('select'); if(sel) sel.value = String((r && r.root) || sl.root);
  });
}
async function setSlot(sl, file){
  const bytes = await file.arrayBuffer();
  const prev = userRaw[sl.id];
  userRaw[sl.id] = {name: file.name, bytes, root: (prev && prev.root) || sl.root || 60};
  try{
    if(ctx) await decodeUser(sl.id);
    idbPut(sl.id, userRaw[sl.id]); msg('Loaded ' + file.name + ' into ' + sl.label + '.');
  }catch(e){ delete userRaw[sl.id]; delete sampleBufs['user_' + sl.id]; msg('That file couldn’t be read as audio. Try a WAV or MP3.'); }
  paintSlots();
}
USER_SLOTS.forEach(sl => {
  const el = document.createElement('div'); el.className = 'slot'; el.id = 'slot-' + sl.id;
  el.innerHTML = '<div class="top"><b></b><button class="chip clear" hidden>Remove</button></div><div class="file"></div><div class="acts"><button class="chip pickf">Choose file</button></div><input type="file" accept="audio/*" hidden>';
  el.querySelector('b').textContent = sl.label;
  const input = el.querySelector('input');
  el.querySelector('.pickf').onclick = () => input.click();
  input.onchange = () => { if(input.files[0]) setSlot(sl, input.files[0]); input.value = ''; };
  if(sl.root){
    const sel = document.createElement('select'); sel.setAttribute('aria-label', sl.label + ' root note');
    NOTE_OPTS.forEach(([m, n]) => sel.appendChild(new Option('Plays ' + n, m)));
    sel.onchange = () => { const r = userRaw[sl.id]; if(r){ r.root = +sel.value; idbPut(sl.id, r); if(sampleBufs['user_' + sl.id]) sampleBufs['user_' + sl.id][0].m = r.root; } };
    el.querySelector('.acts').appendChild(sel);
  }
  el.querySelector('.clear').onclick = () => { delete userRaw[sl.id]; delete sampleBufs['user_' + sl.id]; idbDel(sl.id); paintSlots(); };
  el.ondragover = e => { e.preventDefault(); el.classList.add('drag'); };
  el.ondragleave = () => el.classList.remove('drag');
  el.ondrop = e => { e.preventDefault(); el.classList.remove('drag'); const f = e.dataTransfer.files[0]; if(f) setSlot(sl, f); };
  $('slots').appendChild(el);
});
// Load a whole set at once: each file is matched to a slot by its name ("kick ...", "lead C4 ...")
const SLOT_RULES = [['chat',/closed.?hat|hat.?closed|\bch\b/],['ohat',/open.?hat|hat.?open|\boh\b/],['kick',/kick|bass.?drum|\bbd\b/],
  ['snare',/snare|\bsd\b/],['clap',/clap/],['crash',/crash/],['vocal',/vocal|vox|voice|chop/],['bass',/bass|808|reese|\bsub\b/],
  ['pad',/pad|organ|string|choir/],['lead',/lead|pluck|piano|synth|sax|bell|harp|vib|glock|key/]];
function guessSlot(name){ const n = name.toLowerCase(); const r = SLOT_RULES.find(([,re]) => re.test(n)); return r ? r[0] : null; }
function guessRoot(name){
  const m = name.match(/(?:^|[^A-Za-z])([A-Ga-g])(#|b)?(\d)(?!\d)/); if(!m) return null;
  const base = {c:0,d:2,e:4,f:5,g:7,a:9,b:11}[m[1].toLowerCase()] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  return 12*(+m[3] + 1) + base;
}
async function loadMany(files){
  const done = new Set(), used = [];
  for(const f of files){
    const id = guessSlot(f.name); if(!id || done.has(id)) continue;
    const sl = USER_SLOTS.find(x => x.id === id); done.add(id);
    const root = guessRoot(f.name);
    if(sl.root && root) userRaw[id] = Object.assign(userRaw[id] || {}, {root});
    await setSlot(sl, f);
    if(sl.root && root && userRaw[id]){ userRaw[id].root = root; if(sampleBufs['user_' + id]) sampleBufs['user_' + id][0].m = root; idbPut(id, userRaw[id]); }
    used.push(sl.label);
  }
  paintSlots();
  msg(used.length ? 'Loaded ' + used.length + ' samples: ' + used.join(', ') + '.' : 'None of those file names matched a slot. Name files like “kick …”, “snare …” or “lead C4 …”.');
}
$('bulkPick').onclick = () => $('bulkInput').click();
$('bulkInput').onchange = e => { loadMany([...e.target.files]); e.target.value = ''; };
$('clearAll').onclick = () => { USER_SLOTS.forEach(sl => { delete userRaw[sl.id]; delete sampleBufs['user_' + sl.id]; idbDel(sl.id); }); paintSlots(); msg('All your samples were removed; the built-in sounds are back.'); };
$('slots').addEventListener('drop', e => { if(e.dataTransfer.files.length > 1){ e.preventDefault(); e.stopPropagation(); loadMany([...e.dataTransfer.files]); } }, true);
idbAll().then(all => { Object.assign(userRaw, all); if(ctx) decodeAllUser().then(paintSlots); paintSlots(); });
$('vocalStyle').value = state.vocalStyle || 'oohs';
$('vocalStyle').onchange = e => { state.vocalStyle = e.target.value; save(); };
$('palette').value = state.palette || 'hybrid';
$('palette').onchange = e => { state.palette = e.target.value; save(); };
$('quality').value = state.quality || (IS_MOBILE ? 'light' : 'balanced');
$('quality').onchange = e => { state.quality = e.target.value; if(liveGraph) liveGraph.conv.buffer = getIR(); save(); };
const msg = t => { $('songMsg').textContent = t; };
function useSong(song, keepPosition){
  state.song = song; state.bpm = song.bpm; bpmIn.value = state.bpm; state.endless = true;
  state.swing = STYLES[song.style].swing || 0; $('swing').value = state.swing;
  if(playing && keepPosition){ if(rMode){ bar = currentBar() + 1; rReset(); } }
  else if(playing){ if(rMode){ bar = 0; rReset(); } else bar = -1; }
  else start();
  paint(); save();
}
$('copyCode').onclick = async () => {
  const el = $('code'); el.select();
  try{ await navigator.clipboard.writeText(el.value); msg('Copied ' + el.value); }catch(e){ msg('Code selected. Press Ctrl+C to copy it.'); }
};
$('loadCode').onclick = () => {
  const song = parseCode($('code').value);
  if(!song){ msg('That code wasn’t recognized. Codes look like trance-4K9QZ2.'); return; }
  useSong(song, false);
  msg(song.fromVersion < COMPOSER_VERSION ? 'Loaded “' + song.title + '”. This code is from an earlier version of Loopbench, so its melodies and chords are now written differently.' : 'Loaded “' + song.title + '”.');
};
$('code').onkeydown = e => { if(e.key === 'Enter') $('loadCode').click(); };
$('fav').onclick = () => {
  const sg = state.song; if(!sg || !sg.seed){ msg('Press New song first.'); return; }
  const code = songCode(sg); state.favorites = state.favorites || [];
  const edits = hasEdits(sg) ? JSON.parse(JSON.stringify(sg.edits)) : undefined;
  const old = state.favorites.find(f => f.code === code);
  if(old) old.edits = edits; else state.favorites.push({code, title: sg.title, edits});
  paint(); save(); msg('Saved “' + sg.title + '” to favorites' + (edits ? ', with your edits.' : '.'));
};
$('favs').onchange = e => {
  const fav = (state.favorites || []).find(f => f.code === e.target.value), song = parseCode(e.target.value); e.target.value = '';
  if(!song) return;
  if(fav && fav.edits) song.edits = JSON.parse(JSON.stringify(fav.edits));
  useSong(song, false); msg('Loaded “' + song.title + '”' + (song.edits ? ', with your edits.' : '.'));
};
document.querySelectorAll('[data-reroll]').forEach(b => b.onclick = () => {
  const sg = state.song; if(!sg){ msg('Press New song first.'); return; }
  const part = b.dataset.reroll, parts = Object.assign({}, sg.parts); parts[part] = (parts[part] || 0) + 1;
  const hadEdits = hasEdits(sg);
  useSong(makeSong(sg.style, sg.seed, parts), true);
  msg('New ' + b.textContent.replace(/^New /, '') + ' for “' + sg.title + '”. Everything else stays the same.' + (hadEdits ? ' Your note edits were cleared, since they belonged to the previous version.' : ''));
});
const fileBase = () => (state.song ? state.song.title.replace(/[^A-Za-z0-9 ]/g, '').trim().replace(/ +/g, '-') : 'loopbench') + '-' + (state.song ? songCode(state.song) : '');
$('exportMidi').onclick = async () => {
  if(!state.song){ msg('Press New song first.'); return; }
  try{ await saveFile(fileBase() + '.mid', buildMidi()); msg('MIDI exported: one track per part, with section markers.'); }
  catch(e){ msg(e && e.code === 'declined' ? 'Export cancelled.' : 'The export couldn’t be saved here.'); }
};
$('exportWav').onclick = async () => {
  if(!state.song){ msg('Press New song first.'); return; }
  if(!OAC){ msg('This browser can’t render audio files.'); return; }
  const btn = $('exportWav'); btn.disabled = true;
  try{
    await loadSamples();
    const buf = await renderSongAudio(f => { btn.textContent = 'Rendering ' + Math.round(f*100) + '%'; });
    btn.textContent = 'Saving…';
    await saveFile(fileBase() + '.wav', encodeWav(buf));
    msg('WAV exported (' + fmtTime(buf.duration) + ').');
  }catch(e){ msg(e && e.code === 'declined' ? 'Export cancelled.' : 'The export didn’t finish. Try again with fewer apps open.'); console.error(e); }
  finally{ btn.disabled = false; btn.textContent = 'Export WAV'; }
};
$('genre').value = state.genre || 'any';
$('genre').onchange = e => { state.genre = e.target.value; save(); };
$('newsong').onclick = () => {
  state.song = makeSong(state.genre && state.genre !== 'any' ? state.genre : undefined); state.bpm = state.song.bpm; state.swing = STYLES[state.song.style].swing || 0; $('swing').value = state.swing; state.endless = true;
  bpmIn.value = state.bpm; $('swing').value = 0;
  if(playing){ if(rMode){ bar = 0; rReset(); } else bar = -1; } else start();
  paint(); save();
};
function goToBar(target){
  if(!state.song){ state.song = makeSong(state.genre && state.genre !== 'any' ? state.genre : undefined); state.bpm = state.song.bpm; bpmIn.value = state.bpm; }
  state.endless = true;
  if(playing && rMode){ bar = target; rReset(); }
  else if(playing){ bar = target - 1; songOver = false; endAt = null; }
  else { genBar = null; start(target); }
  paint(); save();
}
const currentBar = () => genView && genView.n !== undefined ? genView.n : 0;
$('jump').onclick = () => {
  const cur = currentBar(), next = arr().find(x => x.name === 'build' && x.start > cur) || arr().find(x => x.name === 'build');
  goToBar(next.start);
};
$('nextsec').onclick = () => {
  const cur = currentBar(), next = arr().find(x => x.start > cur);
  if(next) goToBar(next.start);
};
$('endless').onclick = () => { state.endless = !state.endless; if(!state.endless){ genView = null; playPattern = state.current; } else genBar = null; if(playing){ stop(); start(); } paint(); save(); };
$('render').onclick = () => { state.renderAhead = state.renderAhead === false; if(playing && state.endless){ stop(); start(); } paint(); save(); };
$('chain').onclick = () => { state.chain = !state.chain; paint(); save(); };
$('clear').onclick = () => { state.patterns[state.current] = emptyPattern(); paint(); save(); };
$('copy').onclick = () => {
  const next = (state.current+1)%4;
  state.patterns[next] = JSON.parse(JSON.stringify(pat()));
  state.current = next; if(playing) playPattern = next;
  paint(); save();
};
$('wave').value = patchOf(syn()); $('wave').onchange = e => { syn().wave = e.target.value; save(); };
$('cutoff').value = syn().cutoff; $('cutoff').oninput = e => { syn().cutoff = +e.target.value; save(); };
$('octave').value = syn().octave; $('octave').onchange = e => { syn().octave = +e.target.value; paint(); save(); };
function buildPattern(drums, notes){
  const p = emptyPattern();
  DRUMS.forEach((d,i) => (drums[d.id]||[]).forEach(s => p.drums[i][s] = true));
  notes.forEach(([r,s]) => p.notes[r][s] = true);
  return p;
}
const PRESETS = {
  endless(){
    state.song = makeSong(pick(['bigroom','future','dubstep']));
    Object.assign(state, {bpm:state.song.bpm, swing:0, endless:true});
    genBar = null;
    Object.assign(state.mix.kick, {vol:1}); Object.assign(state.mix.snare, {vol:0.75});
    Object.assign(state.mix.clap, {vol:0.7}); Object.assign(state.mix.chat, {vol:0.45});
    Object.assign(state.mix.ohat, {vol:0.4}); Object.assign(state.mix.tom, {vol:0.7});
    Object.assign(state.mix.synth, {vol:0.7});
    Object.assign(state.mix.crash, {vol:0.6}); Object.assign(state.mix.shaker, {vol:0.5});
    Object.assign(state.mix.rim, {vol:0.55}); Object.assign(state.mix.bell, {vol:0.45});
    Object.assign(state.mix.lead, {vol:0.5}); Object.assign(state.mix.chords, {vol:0.7});
    Object.assign(state.mix.arp, {vol:0.6}); Object.assign(state.mix.sub, {vol:0.8}); Object.assign(state.mix.fx, {vol:0.8}); Object.assign(state.mix.wall, {vol:0.7}); Object.assign(state.mix.vocal, {vol:0.8}); Object.assign(state.mix.counter, {vol:0.6});
  },
  drop(){
    const off16 = [1,3,5,7,9,11,13,15];
    // Bar 1, intro: half-time kick, muffled lead teasing the riff
    const intro = buildPattern({kick:[0,8], clap:[4,12], chat:[2,6,10,14]},
      [[12,0],[10,3],[7,6],[3,8],[7,11],[10,14]]);
    intro.synth = {wave:'sawtooth', cutoff:700, octave:4};
    // Bar 2, build: no kick, accelerating snare roll, rising lead, silence on the last step
    const build = buildPattern({snare:[0,4,8,10,12,13,14], tom:[12,13,14], chat:[0,2,4,6,8,9,10,11,12,13,14]},
      [[0,0],[3,2],[5,4],[7,6],[7,8],[8,9],[10,10],[10,11],[12,12],[12,13],[12,14]]);
    build.synth = {wave:'sawtooth', cutoff:3500, octave:4};
    // Bars 3 and 4, the drop: full kick, driving octave bass
    const bassA = [[0,0],[0,2],[12,3],[0,5],[0,6],[12,7],[0,8],[3,10],[12,11],[7,13],[10,14]];
    const bassB = [[0,0],[0,2],[12,3],[0,5],[0,6],[12,7],[3,8],[5,10],[7,11],[10,12],[12,13]];
    const drop1 = buildPattern({kick:[0,4,8,12], clap:[0,4,12], snare:[4,12], chat:off16, ohat:[0,2,6,10,14]}, bassA);
    const drop2 = buildPattern({kick:[0,4,8,12], clap:[4,12], snare:[4,12,14,15], chat:off16.filter(s=>s<13), ohat:[2,6,10], tom:[13,14,15]}, bassB);
    drop1.synth = {wave:'sawtooth', cutoff:1500, octave:2};
    drop2.synth = {wave:'sawtooth', cutoff:1800, octave:2};
    state.patterns = [intro, build, drop1, drop2];
    Object.assign(state, {bpm:128, swing:0, current:0, chain:true});
    Object.assign(state.mix.kick, {vol:1}); Object.assign(state.mix.snare, {vol:0.7});
    Object.assign(state.mix.clap, {vol:0.7}); Object.assign(state.mix.chat, {vol:0.5});
    Object.assign(state.mix.ohat, {vol:0.45}); Object.assign(state.mix.tom, {vol:0.75});
    Object.assign(state.mix.synth, {vol:0.75});
  },
  bright(){
    const hats = [1,3,5,7,9,11,13,15];
    const call   = [[7,0],[9,2],[12,3],[9,6],[7,8],[4,10],[7,11],[2,14]];
    const answer = [[7,0],[9,2],[12,3],[9,6],[7,8],[4,10],[2,11],[0,14]];
    const a = buildPattern({kick:[0,4,8,12], clap:[4,12], snare:[12], chat:hats, ohat:[2,6,10,14]}, call);
    const b = buildPattern({kick:[0,4,8,12], clap:[4,12], snare:[14,15], chat:hats, ohat:[2,6,10], tom:[13]}, answer);
    state.patterns = [a, b, emptyPattern(), emptyPattern()];
    Object.assign(state, {bpm:126, swing:10, current:0, chain:true});
    state.synth = {wave:'sawtooth', cutoff:4000, octave:4};
    Object.assign(state.mix.kick, {vol:0.9}); Object.assign(state.mix.snare, {vol:0.6});
    Object.assign(state.mix.clap, {vol:0.7}); Object.assign(state.mix.chat, {vol:0.65});
    Object.assign(state.mix.ohat, {vol:0.55}); Object.assign(state.mix.tom, {vol:0.6});
    Object.assign(state.mix.synth, {vol:0.45});
  },
  tight(){
    const hats = [1,2,3,5,6,7,9,10,11,13,15];
    const bass = [[0,0],[0,3],[12,6],[0,8],[3,10],[5,11],[7,14]];
    const a = buildPattern({kick:[0,4,8,12], snare:[4,12], clap:[4,12], chat:hats, ohat:[14]}, bass);
    const b = buildPattern({kick:[0,4,8,10], snare:[4,12,13,15], clap:[4,12], chat:hats.filter(s=>s<12), ohat:[6], tom:[11,14,15]},
                           [[0,0],[0,3],[12,6],[0,8],[3,10],[10,12],[7,13]]);
    state.patterns = [a, b, emptyPattern(), emptyPattern()];
    Object.assign(state, {bpm:124, swing:12, current:0, chain:true});
    state.synth = {wave:'square', cutoff:1100, octave:2};
    Object.assign(state.mix.kick, {vol:0.95}); Object.assign(state.mix.snare, {vol:0.7});
    Object.assign(state.mix.clap, {vol:0.6}); Object.assign(state.mix.chat, {vol:0.55});
    Object.assign(state.mix.ohat, {vol:0.5}); Object.assign(state.mix.tom, {vol:0.7});
    Object.assign(state.mix.synth, {vol:0.7});
  }
};
$('preset').onchange = e => {
  const fn = PRESETS[e.target.value]; if(!fn) return;
  fn(); e.target.value = '';
  if(playing) playPattern = 0;
  bpmIn.value = state.bpm; $('swing').value = state.swing;
  $('wave').value = patchOf(syn()); $('cutoff').value = syn().cutoff; $('octave').value = syn().octave;
  paint(); save();
};
playBtn.onclick = togglePlay;
document.addEventListener('keydown', e => {
  if(e.code !== 'Space' || ['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName)) return;
  e.preventDefault(); togglePlay();
});
paint();
