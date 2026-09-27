/* ---------- Scheduler ---------- */
const stepDur = () => 60/state.bpm/4;
let playing = false, timer = null, nextTime = 0, step = 0, playPattern = 0, queue = [];
let bar = 0, genBar = null, genView = null;
function scheduleStep(s, t){
  let p;
  if(state.endless){ if(!genBar) genBar = generateBar(Math.max(bar,0)); p = genBar; if(!p){ songOver = true; return; } }
  else { if(!state.chain) playPattern = state.current; p = state.patterns[playPattern]; }
  const tt = t + (s%2 ? stepDur()*state.swing/100*0.5 : 0);
  playStep(p, s, tt);
  queue.push({s, t:tt, pat:playPattern, p});
}
// Groove: accents and ghost notes like a drummer, with hats sitting slightly behind the beat
const HAT_ACCENT = [0.8, 0.55, 1, 0.62];
function drumVel(id, s, p){
  const r = 0.94 + Math.random()*0.12;
  if(id === 'chat' || id === 'shaker' || id === 'ohat') return HAT_ACCENT[s % 4]*r;
  if(id === 'snare' && p.phase !== 'build' && !p.half) return (s % 8 === 4 ? 1 : 0.5)*r;
  if(id === 'kick') return s % 4 === 0 ? 1 : 0.86;
  return r;
}
function drumNudge(id, s){
  if(id === 'chat' || id === 'shaker') return (s % 2 ? 0.004 : 0.001) + Math.random()*0.002;
  return 0;
}
function playStep(p, s, tt){
  const gain = id => (p.gain && p.gain[id]) || 1;
  if(s === 0 && busLP){
    const bd = stepDur()*16, bf = p.busFilter || {lp:[20000,20000], hp:[20,20]};
    [[busLP, bf.lp], [busHP, bf.hp]].forEach(([node, [a, b]]) => {
      node.frequency.cancelScheduledValues(tt);
      node.frequency.setValueAtTime(a, tt);
      if(a !== b) node.frequency.exponentialRampToValueAtTime(b, tt + bd);
    });
  }
  if(s === 0 && delL){
    const D = state.song && state.song.dna, div = (D && D.delayDiv) || 3;
    delL.delayTime.setValueAtTime(stepDur()*div, tt); delR.delayTime.setValueAtTime(stepDur()*div, tt);
    if(delFb) delFb.gain.setValueAtTime((D && D.delFb) || 0.38, tt);
  }
  if(p.duck && p.drums[0][s]) duck(tt);
  if(p.impact && s === 0 && audible('fx')) impact(tt, state.mix.fx.vol);
  if(p.down && s === 0 && audible('fx')) downlifter(tt, 24*stepDur(), state.mix.fx.vol);
  if(p.swell && s === p.swell.s && audible('fx')) swell(tt, p.swell.steps*stepDur(), state.mix.fx.vol);
  if(p.riser && s === 0 && audible('fx')) riser(tt, p.riser.cut*stepDur(), p.riser.bar, state.mix.fx.vol);
  const extra = id => id === 'kick' ? p.bigKick : (p.pitch && p.pitch[id]) || 1;
  DRUMS.forEach((d,i) => {
    if(!p.drums[i][s] || !audible(d.id)) return;
    const hit = drumSample(d.id), pitchArg = d.id === 'kick' ? 1 : extra(d.id);
    const v = state.mix[d.id].vol*gain(d.id)*drumVel(d.id, s, p), at0 = tt + drumNudge(d.id, s);
    const play = at => hit ? playHit(hit, at, v, pitchArg) : VOICES[d.id](at, v, extra(d.id));
    play(at0);
    if(p.half && p.half[d.id] && p.half[d.id].includes(s)) play(tt + stepDur()/2);
  });
  if(p.pitchRiser && s === 0 && audible('fx')) pitchRiser(p.pitchRiser.midi, tt, p.pitchRiser.steps*stepDur(), 12, state.mix.fx.vol);
  if(audible('synth')){
    const BS = p.phase && p.synth ? Object.assign({}, p.synth, {wave: remapPatch(patchOf(p.synth), 'bass', p)}) : (p.synth || state.synth);
    for(let r=0;r<ROWS;r++) if(p.notes[r][s]) playNote(r, tt, state.mix.synth.vol, BS);
  }
  const T = (p.synth && p.synth.transpose) || 0;
  const feel = (s % 4 === 0 ? 1.08 : s % 2 === 0 ? 1 : 0.9) * (0.95 + Math.random()*0.1);
  const LS = p.leadSynth && Object.assign({}, p.leadSynth, {wave: remapPatch(patchOf(p.leadSynth), 'lead', p)});
  if(p.lead && audible('lead')) p.lead.forEach(([r,st,d]) => { if(st === s) playNote(r, tt, state.mix.lead.vol*feel, d ? Object.assign({}, LS, {len: d*0.95}) : LS); });
  if(p.wall && s === 0 && audible('wall')){
    const w = p.wall, wp = remapPatch('wall', 'wall', p);
    const top = w.ext && w.ext[3] !== undefined ? [60+w.T+w.ext[3]] : [];
    (w.voiced ? [48+w.T, ...w.voiced] : [48+w.T, 60+w.T+w.ints[1], 60+w.T+w.ints[2], 72+w.T, ...top]).forEach(m => synth(m, tt, w.len*stepDur(), wp, state.mix.wall.vol*(wp === 'wall' ? 1 : 0.8), {bright: w.bright}));
    if(samplesReady && (state.palette || 'hybrid') !== 'electronic' && (p.phase === 'breakdown' || p.label === 'Final drop' || (state.palette === 'orchestral' && p.phase === 'drop')))
      (w.voiced || [60+w.T, 60+w.T+w.ints[1], 60+w.T+w.ints[2]]).forEach(m => synth(m, tt, w.len*stepDur(), 'choir', state.mix.wall.vol));
    // real strings under the supersaws in builds and drops, the classic epic-trance layer
    if(samplesReady && (state.palette || 'hybrid') !== 'electronic' && wp === 'wall' && (p.phase === 'drop' || p.phase === 'build'))
      (w.voiced ? [48+w.T, ...w.voiced] : [48+w.T, 60+w.T+w.ints[1], 60+w.T+w.ints[2], 72+w.T]).forEach(m => synth(m, tt, w.len*stepDur(), 'strings', state.mix.wall.vol*0.6));
  }
  if(p.counter && audible('counter')) p.counter.forEach(([r,st]) => { if(st === s) synth(72 + p.counterT + r, tt, stepDur()*2, remapPatch((state.song && state.song.dna && state.song.dna.counter) || 'bell', 'counter', p), state.mix.counter.vol); });
  if(p.gate && p.gate.pattern[s] && audible('wall')) (p.gate.voiced || (p.gate.ext || p.gate.ints).map(r => 60 + p.gate.T + r)).forEach(m => synth(m, tt, stepDur()*0.8, remapPatch('saws', 'gate', p), state.mix.wall.vol*0.45));
  if(p.vocal && audible('vocal')) p.vocal.forEach(n => { if(n.s !== s) return;
    const vs = state.vocalStyle || 'oohs';
    if(hasUser('vocal')) synth(n.m, tt, n.len*stepDur(), 'user_vocal', state.mix.vocal.vol);
    else if(vs === 'off') return;
    else if(vs === 'synth' || !samplesReady || !sampleBufs.voice_oohs) sing(n.m, tt, n.len*stepDur(), n.vw, state.mix.vocal.vol, {from:n.from, chop:n.chop});
    else singSampled(n.m, tt, n.len*stepDur(), state.mix.vocal.vol, {from:n.from, chop:n.chop, style:vs}); });
  const L2 = p.lead2Synth && Object.assign({}, p.lead2Synth, {wave: remapPatch(patchOf(p.lead2Synth), 'lead2', p)});
  if(p.lead2 && audible('lead')) p.lead2.forEach(([r,st,d]) => { if(st === s) playNote(r, tt, state.mix.lead.vol*0.5, d ? Object.assign({}, L2, {len: Math.min(d, 2)}) : L2); });
  if(p.sub && audible('sub')) for(let r=0;r<ROWS;r++) if(p.notes[r][s]) playSub(r, T, tt, state.mix.sub.vol, (p.synth && p.synth.len) || 0.9);
  if(p.chords && audible('chords') && p.chords.steps.includes(s)) playChord(p.chords.T, tt, p.chords.len, state.mix.chords.vol, p.chords.ext || p.chords.ints, remapPatch(p.chords.patch || (p.chords.wide ? 'saws' : (p.chords.len > 2 ? 'pad' : 'stab')), 'chords', p), p.chords.voiced);
  if(p.arp && audible('arp')) p.arp.forEach(([r,st]) => { if(st === s) playArp(r, p.arpT, tt, state.mix.arp.vol*feel, remapPatch(PATCHES[p.arpWave] ? p.arpWave : 'pluck', 'arp', p)); });
}
