/* ---------- Energy: the song's arc ----------
   energyOf() scores how intense a bar is from what actually plays in it: drum activity, bass and
   melody density, supporting layers, pumping, and how open or filtered the sound is.
   targetEnergy() is the arc each section should follow (intro rising, verse moderate, pre-chorus
   climbing, drops at the top with the final drop highest, breakdowns dipping, outro falling away).
   shapeEnergy() moves each generated bar toward its target by adding or removing texture:
   hi-hat density, shaker and open hats, counter melody, arpeggio, filter brightness. It never
   touches the melody, harmony or the backbeat, so the song's identity stays intact. */

function drumHits(p, id){ const r = DRUMS.findIndex(d => d.id === id); return r >= 0 && p.drums[r] ? p.drums[r].filter(Boolean).length : 0; }
function energyOf(p){
  if(!p || !p.drums) return 0;
  const cap = x => Math.min(1, x);
  let e = 0;
  e += 0.16*cap(drumHits(p, 'kick')/4);
  e += 0.08*cap((drumHits(p, 'snare') + drumHits(p, 'clap'))/2);
  e += 0.10*cap((drumHits(p, 'chat') + drumHits(p, 'shaker'))/16);
  e += 0.05*cap(drumHits(p, 'ohat')/4) + 0.03*cap(drumHits(p, 'crash')) + 0.02*cap(drumHits(p, 'rim') + drumHits(p, 'bell'));
  const bassN = p.bassAbs ? p.bassAbs.length : (p.notes ? p.notes.reduce((a, r) => a + r.filter(Boolean).length, 0) : 0);
  e += 0.10*cap(bassN/8);
  const P = ensembleParts(p);
  e += 0.10*cap((P.lead.length + P.vocal.length)/6) + 0.05*cap(P.counter.length/3) + 0.07*cap(P.arp.length/12);
  e += 0.08*cap((p.wall ? 0.5 : 0) + (p.chords ? 0.5 : 0) + (p.gate ? 0.3 : 0));
  e += 0.05*(p.gtr ? cap(p.gtr.length/8) : 0)*(p.gtrGain || 1);
  // tension devices count: a snare or tom roll and a riser build intensity even as the bass drops out
  e += 0.10*cap(Math.max(0, drumHits(p, 'snare') + drumHits(p, 'clap') + drumHits(p, 'tom') + Math.max(0, drumHits(p, 'kick') - 4) - 2)/14) + 0.05*(p.riser ? cap((p.riser.bar + 1)/8) : 0) + 0.03*(p.pitchRiser ? 1 : 0);
  e += 0.03*(p.lead2 ? 1 : 0);
  e += 0.04*(p.duck ? 1 : 0) + 0.03*(p.bigKick ? 1 : 0) + 0.02*(p.sub ? 1 : 0);
  const lp = p.busFilter ? Math.min(p.busFilter.lp[0], p.busFilter.lp[1]) : 20000, hp = p.busFilter ? Math.max(p.busFilter.hp[0], p.busFilter.hp[1]) : 20;
  const open = Math.min(1, Math.log2(lp/200)/Math.log2(20000/200)) * (hp > 200 ? 0.85 : 1);
  return e*(0.6 + 0.4*open);
}

// The arc, as a fraction of the song's own first-drop (or first-chorus) level
function targetEnergy(p){
  const i = p.barIn || 0, n = Math.max(1, p.bars || 1), x = n > 1 ? i/(n - 1) : 1, lerp = (a, b) => a + (b - a)*x;
  switch(p.phase){
    case 'intro':     return lerp(0.35, 0.65);
    case 'verse':     return p.label && /2/.test(p.label) ? lerp(0.66, 0.76) : lerp(0.6, 0.7);
    case 'build':     return lerp(0.66, 0.96);
    case 'fake':      return 0.9;
    case 'drop':      return /Final/.test(p.label || '') ? 1.12 : 1.0;
    case 'breakdown': return p.label === 'Opening' ? lerp(0.35, 0.5) : lerp(0.34, 0.52);
    case 'bridge':    return lerp(0.48, 0.58);
    case 'outro':     return lerp(0.7, 0.2);
  }
  return 0.7;
}
// The song's reference level: its first drop or chorus, as generated before any shaping
function energyRef(song){
  const cache = energyRef.cache || (energyRef.cache = new WeakMap());
  if(cache.has(song)) return cache.get(song);
  const saved = rnd, drop = arr().find(x => x.name === 'drop');
  let ref = 0.8;
  if(drop){
    let sum = 0, k = 0;
    for(let i = 0; i < Math.min(4, drop.bars); i++){
      const n = drop.start + i;
      seedWith(song.seed + '|bar|' + ((song.parts && song.parts.drums) || 0) + '|' + n);
      sum += energyOf(arrangeEnsemble(barFor(song, locate(n), n), song)); k++;
    }
    ref = sum/k || ref;
  }
  rnd = saved;
  cache.set(song, ref);
  return ref;
}
// Texture moves, gentlest first. Each changes only drums, supporting layers or the filter.
function setRow(p, id, steps){ const r = DRUMS.findIndex(d => d.id === id); p.drums[r] = Array(STEPS).fill(false); steps.forEach(s => p.drums[r][s] = true); }
function rowOf(p, id){ const r = DRUMS.findIndex(d => d.id === id); return p.drums[r].map((on, s) => on ? s : -1).filter(s => s >= 0); }
function energyUp(p, song, band){
  const hats = rowOf(p, 'chat');
  const moves = [
    () => hats.length && hats.length < 16 && p.phase !== 'breakdown' ? (setRow(p, 'chat', hats.length >= 8 ? [...Array(16).keys()] : [0,2,4,6,8,10,12,14]), true) : false,
    () => !rowOf(p, 'shaker').length && p.phase !== 'breakdown' ? (setRow(p, 'shaker', [2,6,10,14]), true) : false,
    () => !rowOf(p, 'ohat').length && (p.phase === 'drop' || p.phase === 'build') ? (setRow(p, 'ohat', [2,6,10,14]), true) : false,
    () => (p.barIn || 0) % 4 === 0 && !rowOf(p, 'crash').length && p.phase === 'drop' ? (setRow(p, 'crash', [0]), true) : false,
    () => p.busFilter && !['intro', 'breakdown', 'build'].includes(p.phase) ? (p.busFilter = null, true) : false,   // never undo a build's filter sweep
    () => p.phase === 'build' && (p.barIn || 0) >= (p.bars || 8)/2 && rowOf(p, 'snare').length >= 8 && rowOf(p, 'clap').length < rowOf(p, 'snare').length
          ? (setRow(p, 'clap', rowOf(p, 'snare').filter(s => s % 2 === 0)), true) : false,   // layer a clap into the snare roll
    () => band && p.gtr && (p.gtrGain || 1) < 1.25 ? (p.gtrGain = (p.gtrGain || 1) + 0.12, true) : false,
    () => !band && p.phase === 'drop' && p.lead && p.lead.length && !p.lead2 && !(p.vocal || []).some(v => !v.chop)
          ? (p.lead2 = p.lead, p.lead2Synth = Object.assign({}, p.leadSynth, {wave:'pluck', octave: (p.leadSynth.octave || 4) + 1, bright:1.2, len:0.6}), true) : false,
    () => !p.counter && p.wall && p.phase !== 'build' ? (p.counter = counterLine(song, p.wall.ints, (p.lead || []).map(n => n[1]), 2), p.counterT = p.wall.T, true) : false,
  ];
  for(const m of moves) if(m()) return true;
  return false;
}
function energyDown(p, song, band){
  const hats = rowOf(p, 'chat');
  const moves = [
    () => rowOf(p, 'shaker').length ? (setRow(p, 'shaker', []), true) : false,
    () => rowOf(p, 'ohat').length && p.phase !== 'drop' ? (setRow(p, 'ohat', []), true) : false,
    () => hats.length > 8 ? (setRow(p, 'chat', [0,2,4,6,8,10,12,14]), true) : hats.length > 4 && p.phase !== 'drop' ? (setRow(p, 'chat', [2,6,10,14]), true) : false,
    () => p.arp && p.phase !== 'drop' ? (p.arp = null, true) : false,
    () => p.counter && p.phase !== 'drop' ? (p.counter = null, true) : false,
    () => band && p.gtr && (p.gtrGain || 1) > 0.8 ? (p.gtrGain = (p.gtrGain || 1) - 0.1, true) : false,
    () => !p.busFilter && (p.phase === 'breakdown' || p.phase === 'outro') ? (p.busFilter = {lp:[4500, 4500], hp:[20, 20]}, true) : false,
  ];
  for(const m of moves) if(m()) return true;
  return false;
}
function shapeEnergy(p, song){
  if(!p || !p.drums || !p.phase) return p;
  if(p.phase === 'build' && p.barIn === (p.bars || 1) - 1) return p;   // the last bar of a build (its fill and gap) is left as written
  const band = STYLES[song.style] && STYLES[song.style].band, ref = energyRef(song), target = targetEnergy(p)*ref, tol = 0.035*ref;
  for(let k=0; k<8; k++){
    const e = energyOf(p);
    if(e < target - tol){ if(!energyUp(p, song, band)) break; }
    else if(e > target + tol){ if(!energyDown(p, song, band)) break; }
    else break;
  }
  if(p.phase === 'drop' && /Final/.test(p.label || '')) p.gain = Object.assign({}, p.gain || {}, {kick: 1.08, clap: 1.08, snare: 1.05});   // the last drop hits a little harder
  return p;
}
