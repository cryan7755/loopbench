/* ---------- Song arrangement: a full vocal-trance form that starts, develops and ends ---------- */
function locate(n){ const sec = arr().find(x => n >= x.start && n < x.start + x.bars); return sec ? {sec, i: n - sec.start} : null; }
const setDrum = (p, id, steps) => { const r = DRUMS.findIndex(d => d.id === id); p.drums[r] = Array(STEPS).fill(false); steps.forEach(s => p.drums[r][s] = true); };
const clearNotes = p => { p.notes = Array.from({length:ROWS}, () => Array(STEPS).fill(false)); };
function hookTease(song, i, every = 2, prog){
  return hookBar(song, i, prog).filter((_, k) => k % every === 0);
}
// groove sections are 16 bars; reuse the 8-bar groove with a fill only on the last bar
const grooveIdx = (i, n = 16) => i === n - 1 ? 7 : i < 7 ? i : 4 + ((i - 7) % 3);
// stretch or squeeze an 8-step recipe (0-7) across n bars, always ending on its final step
const scale8 = (i, n) => i === n - 1 ? 7 : Math.min(6, Math.floor(i*7/Math.max(1, n - 1)));
function breakdownBar(song, i, bars, second){
  const {T, ints, ext, voiced} = chordAtPos(song, i, song.bdProg);
  const stage = second ? 2 + Math.min(1, Math.floor(i*2/bars)) : Math.min(3, Math.floor(i*4/bars));
  const p = buildPattern(i === 0 ? {crash:[0]} : {}, []);
  const x = {sub:false, wall:{T, ints, ext, voiced, len:16, bright: 0.7 + stage*0.15}, busFilter:{lp:[20000,20000], hp:[70,70]},
    chords:{steps:[0], len:16, T, ints, ext, voiced, patch:'pad'}, counter: counterLine(song, ints, [], stage >= 2 ? 3 : 2), counterT:T};
  if(i === 0){ x.impact = true; x.down = true; }
  x.lead = hookTease(song, i, stage >= 2 ? 1 : 2, song.bdProg);
  x.leadSynth = {wave:'pluck', bright: 0.6 + stage*0.15, octave:4, transpose:keyOff(song), len:0.7};
  if(stage >= 1) x.vocal = vocalBar(song, i, T, ints, 0, null, song.bdProg);
  if(stage >= 3){ x.arp = [0,2,4,6,8,10,12,14].map((s,k) => [[0, ints[1], ints[2], 12][k % 4], s]); x.arpT = T; x.arpWave = (song.dna && song.dna.arp) || 'pluck'; }
  if(i >= bars - 2){ p.drums[DRUMS.findIndex(d => d.id === 'chat')] = Array(STEPS).fill(false).map((_,s) => s % 4 === 2); }
  return Object.assign(p, x);
}
function keyedSong(song){ return Object.assign({}, song, {key: song.key + 2, keyShift: 2}); }
function generateBar(n){
  if(!state.song || !STYLES[state.song.style]) state.song = makeSong();
  if((state.song.v || 1) < COMPOSER_VERSION) state.song = state.song.seed ? makeSong(state.song.style, state.song.seed, state.song.parts) : makeSong(state.song.style);
  const base = state.song;
  if(!base.seed){ base.seed = randomSeed(); base.parts = {chords:0, hook:0, bass:0, vocal:0, drums:0}; }
  const loc = locate(n); if(!loc) return null;
  seedWith(base.seed + '|bar|' + ((base.parts && base.parts.drums) || 0) + '|' + n);
  try{ return barFor(base, loc, n); } finally { rnd = Math.random; }
}
function barFor(base, loc, n){
  let {sec, i} = loc; const song = sec.keyUp ? keyedSong(base) : base, st = STYLES[song.style];
  let p;
  if(sec.name === 'intro'){
    const half = Math.max(4, Math.floor(sec.bars/2));
    if(i < half) p = introBar(scale8(i, half), song, i);
    else {
      // the beat arrives: drums and bass, synths still muffled, a first taste of the hook
      const j = i - half, n2 = sec.bars - half, g = scale8(j, n2);
      p = cycleBar(song, g, {bar: i, bars: sec.bars});
      Object.assign(p, {vocal:null, counter:null, chords:null, arp:null});
      p.busFilter = {lp:[700*Math.pow(1.2, g), 700*Math.pow(1.2, g + 1)], hp:[20,20]};
      if(j >= n2/2){ p.lead = hookTease(song, i, 2); p.leadSynth = {wave:'pluck', bright:0.6, octave:4, transpose:keyOff(song), len:0.6}; }
    }
  } else if(sec.name === 'verse'){
    p = cycleBar(song, 32 + grooveIdx(i, sec.bars), {bar: i, bars: sec.bars});
    p.impact = false; if(i === 0) setDrum(p, 'crash', [0]);
    if(i === 0 && sec.second) p.down = true;
    p.busFilter = {lp:[3500 + i*300, 3800 + i*300], hp:[20,20]};
    // verses sit a notch below the drops so the drops feel bigger
    p.gain = {kick:0.75, clap:0.7, snare:0.7, chat:0.75, ohat:0.7, crash:0.8};
    p.vocal = i >= 2 ? vocalBar(song, i, p.wall.T, p.wall.ints, 0, song.verseVocal) : null;
    if(i < 8) p.counter = null;
  } else if(sec.name === 'breakdown'){
    p = breakdownBar(song, i, sec.bars, sec.second);
  } else if(sec.name === 'bridge'){
    // half-time bridge: space and a new feel before the last build
    const {T, ints, ext, voiced} = chordAtPos(song, i, song.bdProg);
    const d = {kick:[0,10], snare:[8], chat:[0,4,8,12], shaker: i >= 8 ? [2,6,10,14] : []};
    if(i === 0) d.crash = [0];
    if(i === sec.bars - 1){ d.snare = [8,12,13,14,15]; d.tom = [14,15]; }
    p = Object.assign(buildPattern(d, [[0,0],[0,10]]), {synth:{wave:'reese', bright:0.7, octave:2, transpose:T, len:6}, sub:true,
      wall:{T, ints, ext, voiced, len:16, bright:0.8}, vocal: vocalBar(song, i, T, ints, 0, song.verseVocal, song.bdProg), counter: counterLine(song, ints, [], 2), counterT:T,
      busFilter:{lp:[5000,5000], hp:[20,20]}, gain:{kick:0.8, snare:0.85}, down: i === 0});
  } else if(sec.name === 'fake'){
    // fake-out: the drop starts... and cuts after two beats, then a quick re-build
    if(i === 0){
      p = cycleBar(song, 16);
      const cutAt = 8;
      DRUMS.forEach((_, r) => { p.drums[r] = p.drums[r].map((on, st2) => on && st2 < cutAt); });
      p.notes = p.notes.map(row => row.map((on, st2) => on && st2 < cutAt));
      ['lead','arp','counter','vocal','lead2'].forEach(k => { if(p[k]) p[k] = p[k].filter(e => (Array.isArray(e) ? e[1] : e.s) < cutAt); });
      if(p.chords) p.chords.steps = p.chords.steps.filter(st2 => st2 < cutAt);
      p.wall = null; p.gate = null; p.duck = false;
    } else { p = cycleBar(song, 8 + 5); p.kick = null; setDrum(p, 'kick', []); }
  } else if(sec.name === 'build'){
    p = cycleBar(song, (sec.second ? 32 : 0) + 8 + scale8(i, sec.bars), {bar: i, bars: sec.bars});
  } else if(sec.name === 'drop'){
    const di = i === sec.bars - 1 ? 15 : i % 16;   // the last bar is always a fill into what comes next
    p = cycleBar(song, (Math.floor(i/16) % 2 ? 32 : 0) + 16 + di, {bar: i, bars: sec.bars});
    if(i > 0 && i % 16 === 0){ setDrum(p, 'crash', [0]); p.impact = false; }
    if(sec.second){
      // the final drop: everything doubled, wider chords, the vocal carries through
      p.lead2 = p.lead; p.lead2Synth = {wave:'pluck', bright:1.3, octave:5, transpose:keyOff(song), len:0.6};
      if(p.chords) p.chords.patch = 'saws';
      p.wall.bright = 1.4;
      if(di >= 8 || i >= 16) p.vocal = vocalBar(song, i, p.wall.T, p.wall.ints);
    }
  } else {
    // outro: synths fade and filter away, drums thin out, one last chord rings
    const last = i === sec.bars - 1; i = Math.floor(i*16/sec.bars);
    p = cycleBar(song, 32 + grooveIdx(i), {bar: loc.i, bars: sec.bars});
    Object.assign(p, {vocal: i < 4 ? p.vocal : null, counter:null, lead:null, arp: i < 4 ? p.arp : null, impact:false});
    if(i === 0){ setDrum(p, 'crash', [0]); p.down = true; }
    p.busFilter = {lp:[Math.max(700, 6000*Math.pow(0.8,i)), Math.max(700, 6000*Math.pow(0.8,i+1))], hp:[20,20]};
    if(i >= 8){ clearNotes(p); p.sub = false; p.chords = null; p.wall = null; }
    if(i >= 12){ setDrum(p, 'chat', []); setDrum(p, 'shaker', []); setDrum(p, 'rim', []); setDrum(p, 'bell', []); }
    if(i >= 14){ setDrum(p, 'clap', []); setDrum(p, 'snare', []); setDrum(p, 'ohat', []); }
    if(last){
      DRUMS.forEach((d,r) => { p.drums[r] = Array(STEPS).fill(false); });
      setDrum(p, 'kick', [0]); setDrum(p, 'crash', [0]);
      const {T, ints, ext, voiced} = chordAtPos(song, 0);
      p.wall = {T, ints, ext, voiced, len:24, bright:0.8};
    }
  }
  return Object.assign(p, {phase: sec.name, label: sec.label, barIn: loc.i, bars: sec.bars, n});
}
