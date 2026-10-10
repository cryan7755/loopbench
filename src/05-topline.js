/* ---------- Topline: a featured instrument plays the song's vocal melody ----------
   The composer writes the vocal line from the song's motif; instead of a voice, each song hands it to an
   instrument chosen for the genre: violin over a trance breakdown, sax in synthwave, electric piano in deep
   house, flute as a pop whistle hook, a lead guitar in rock. "New sounds" picks another one. */
const TOPLINES = {
  //        label            sample bank / patch   octave  kind: sus = held and bowed or blown, hit = struck or plucked
  violin:  {label:'Violin',          bank:'violin',  shift:0,   kind:'sus', a:0.05, r:0.35, gain:0.85, rev:0.4,  del:0.18, glide:true,  gm:40, chop:'pizz'},
  sax:     {label:'Saxophone',       bank:'sax',     shift:0,   kind:'sus', a:0.03, r:0.25, gain:0.8,  rev:0.32, del:0.2,  glide:true,  gm:66},
  flute:   {label:'Flute',           bank:'flute',   shift:12,  kind:'sus', a:0.05, r:0.3,  gain:0.75, rev:0.42, del:0.25, glide:true,  gm:73},
  gtrlead: {label:'Lead guitar',     bank:'gtr',     shift:-12, kind:'gtr', gm:29},
  vibes:   {label:'Vibraphone',      bank:'vibes',   shift:0,   kind:'hit', a:0.002, r:0.8, gain:1.25,  rev:0.4,  del:0.22, gm:11},
  marimba: {label:'Marimba',         bank:'marimba', shift:0,   kind:'hit', a:0.002, r:0.3, gain:0.7,  rev:0.3,  del:0.25, roll:true, gm:12},
  piano:   {label:'Piano',           bank:'piano',   shift:0,   kind:'hit', a:0.002, r:0.45, gain:1.0, rev:0.35, del:0.18, gm:0},
  epiano:  {label:'Electric piano',  patch:'epiano', shift:0,   kind:'syn', level:1.3, gm:4},
  sqlead:  {label:'Square lead',     patch:'sqlead', shift:0,   kind:'syn', gm:80},
  bell:    {label:'Bell',            patch:'bell',   shift:12,  kind:'syn', level:1.8, gm:14},
};
// which toplines suit each genre (picked per song); the orchestral and all-synth palettes have their own
const TOPLINE_POOLS = {
  trance:['violin','violin','flute','piano'], progressive:['piano','violin','vibes','flute'], bigroom:['violin','flute','sqlead'],
  future:['vibes','marimba','flute','violin'], dubstep:['violin','piano','flute'], dnb:['piano','sax','violin','vibes'],
  techno:['epiano','vibes','sqlead'], techhouse:['epiano','sax','vibes','marimba'], deephouse:['epiano','epiano','sax','vibes'],
  psytrance:['flute','flute','violin'], hardstyle:['violin','violin','piano'], synthwave:['sax','sax','epiano','gtrlead'],
  ukg:['epiano','vibes','marimba','sax'], trap:['flute','flute','violin','marimba'], eurodance:['flute','piano','violin','sqlead'],
  rock:['gtrlead','gtrlead','piano'], altrock:['gtrlead','violin','piano'], metal:['gtrlead','gtrlead','violin'],
  pop:['flute','marimba','piano','sax','vibes','violin'], dancepop:['sax','marimba','flute','violin','epiano'],
};
const TOPLINE_ORCH = ['violin','violin','flute','piano'], TOPLINE_SYNTH = ['sqlead','epiano','bell'];
const OLD_VOICES = new Set(['oohs','choir','synth']);

// Picked when the song's sound is designed (appended last so older song codes keep every other choice)
function pickTopline(style){
  return {topline: pick(TOPLINE_POOLS[style] || TOPLINE_POOLS.pop), toplineOrch: pick(TOPLINE_ORCH), toplineSynth: pick(TOPLINE_SYNTH)};
}
// The instrument playing the melody right now: the menu choice, or the song's own pick for this palette
function toplineId(song = state.song){
  const vs = state.vocalStyle || 'auto';
  if(vs !== 'auto') return vs;
  const d = song && song.dna, pal = state.palette || 'hybrid';
  if(!d || !d.topline) return 'violin';
  if(pal === 'electronic' || !samplesReady) return d.toplineSynth;
  if(pal === 'orchestral') return d.toplineOrch;
  return d.topline;
}
function toplineLabel(song = state.song){
  const id = toplineId(song);
  return TOPLINES[id] ? TOPLINES[id].label : id === 'off' ? 'off' : 'voice';
}

// One recorded note, held as long as needed: past the recording's end it crossfades into a later
// stretch of the same note, so long held notes keep breathing instead of clicking on a loop point
function toplineSample(bank, midi, t, dur, v, I, opt = {}){
  const zones = sampleBufs[bank]; if(!zones || !zones.length) return false;
  let z = zones[0]; for(const c of zones) if(Math.abs(c.m - midi) < Math.abs(z.m - midi)) z = c;
  const rate = Math.pow(2, (midi - z.m)/12), natural = z.buf.duration/rate;
  const a = opt.short ? Math.min(I.a, 0.01) : I.a, r = opt.short ? Math.min(I.r, 0.12) : I.r;
  const hold = t + Math.max(dur, a + 0.01), end = hold + r;
  const amp = ctx.createGain(), pk = v*I.gain*(opt.vel || 1);
  amp.gain.setValueAtTime(0.0001, t); amp.gain.linearRampToValueAtTime(pk, t + a);
  amp.gain.setValueAtTime(pk, hold); amp.gain.exponentialRampToValueAtTime(0.0001, end);
  const voice = (at, offset, until, fadeIn) => {
    const src = ctx.createBufferSource(), g = ctx.createGain(); src.buffer = z.buf; src.playbackRate.value = rate;
    if(opt.from !== undefined && opt.from !== null && at === t){
      src.detune.setValueAtTime((opt.from - midi)*100, t); src.detune.linearRampToValueAtTime(0, t + 0.07);
    }
    if(fadeIn){ g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(1, at + fadeIn); } else g.gain.value = 1;
    src.connect(g); g.connect(amp); src.start(at, offset); src.stop(until + 0.02);
    return g;
  };
  if(I.kind !== 'sus' || end <= t + natural - 0.05){ voice(t, 0, Math.min(end, t + natural), 0); }
  else {
    // sustained note longer than the recording: chain overlapping stretches with 0.25 s crossfades
    const X = 0.25, from = Math.min(1.0, z.buf.duration*0.3), seg = (z.buf.duration - 0.45 - from)/rate;
    let at = t, g = voice(t, 0, t + natural - 0.4, 0), segEnd = t + natural - 0.4;
    while(segEnd < end && seg > X*2){
      g.gain.setValueAtTime(1, segEnd - X); g.gain.linearRampToValueAtTime(0, segEnd);
      at = segEnd - X; g = voice(at, from, at + seg, X); segEnd = at + seg;
    }
  }
  amp.connect(bus); sends(amp, I.rev, I.del);
  return true;
}
// Marimba can't hold a note, so long notes are rolled, as a player would
function toplineRoll(bank, midi, t, dur, v, I){
  const step = stepDur(); let k = 0;
  for(let at = t; at < t + dur - step*0.5; at += step, k++) toplineSample(bank, midi, at, step, v*(k ? 0.38 + 0.08*(k % 2) : 0.9), I);
}

// Play one melody note n = {m, len, from, chop} at time tt
function playTopline(n, tt, v, p, song = state.song){
  const id = toplineId(song), I = TOPLINES[id];
  const dur = n.len*stepDur();
  if(hasUser('vocal')) return synth(n.m, tt, dur, 'user_vocal', v);
  if(id === 'off') return;
  if(OLD_VOICES.has(id) || !I){
    if(id === 'synth' || !samplesReady || !sampleBufs.voice_oohs) return sing(n.m, tt, dur, n.vw || ['a'], v, {from:n.from, chop:n.chop});
    return singSampled(n.m, tt, dur, v, {from:n.from, chop:n.chop, style:id});
  }
  const m = n.m + I.shift, from = n.from !== undefined && n.from !== null && Math.abs(n.from - n.m) <= 5 && I.glide ? n.from + I.shift : null;
  // vocal chops in the drops become short, punchy notes on the same instrument (bowed strings go pizzicato)
  if(n.chop){
    if(I.chop && sampleBufs[I.chop]) return synth(m, tt, Math.min(dur, 0.25), I.chop, v*0.9);
    if(I.kind === 'syn') return synth(m, tt, Math.min(dur, 0.25), I.patch, v*0.75*(I.level || 1));
    if(I.kind === 'gtr') return guitarHit([m], tt, Math.min(dur, 0.25), 'lead', v*0.8);
    return toplineSample(I.bank, m, tt, Math.min(dur, 0.3), v*0.85, I, {short:true});
  }
  if(I.kind === 'syn') return synth(m, tt, dur, I.patch, v*0.85*(I.level || 1));
  if(I.kind === 'gtr') return sampleBufs.gtr ? guitarHit([m], tt, dur*0.95, 'lead', v*0.85) : synth(m, tt, dur, 'sqlead', v*0.8);
  if(!sampleBufs[I.bank]) return synth(m, tt, dur, 'pluck', v*0.8);
  if(I.roll && dur > stepDur()*3) return toplineRoll(I.bank, m, tt, dur, v, I);
  // a little phrasing: the first note of a phrase leans in, glided notes connect softly
  toplineSample(I.bank, m, tt, dur*(I.kind === 'sus' ? 0.97 : 1), v, I, {from, vel: from !== null ? 0.92 : 1.05});
}
function toplineGM(song = state.song){ const I = TOPLINES[toplineId(song)]; return I ? I.gm : 53; }
