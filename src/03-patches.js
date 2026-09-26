/* EDM synth patches: stacked detuned oscillators, filter envelopes, drive, stereo spread, reverb and delay sends */
const PATCHES = {
  lead:    {osc:'sawtooth', voices:9, spread:32, width:1,   cutoff:3200, env:6000, fdecay:0.3,  q:1.2, a:0.003, d:0.3,  s:0.78, r:0.3,  rev:0.32, del:0.24, cho:0.25, hp:180, drive:1.4, sub:0.25, subOsc:'sawtooth', slope:24, gain:0.42},
  sqlead:  {osc:'square',   voices:3, spread:14, width:0.7, cutoff:2600, env:4000, fdecay:0.25, q:2.5, a:0.003, d:0.2, s:0.7, r:0.2, rev:0.28, del:0.3, cho:0.2, hp:150, drive:1.6, slope:24, gain:0.36},
  pluck:   {osc:'sawtooth', voices:4, spread:14, width:0.8, cutoff:450,  env:8000, fdecay:0.14, q:4,   a:0.001, d:0.2,  s:0,    r:0.22, rev:0.32, del:0.36, cho:0.15, hp:160, pitchEnv:40, slope:24, gain:0.46},
  stab:    {osc:'sawtooth', voices:6, spread:24, width:1,   cutoff:900,  env:6500, fdecay:0.13, q:1.8, a:0.002, d:0.16, s:0.25, r:0.22, rev:0.32, del:0.12, cho:0.2, hp:170, pitchEnv:20, slope:24, gain:0.27},
  saws:    {osc:'sawtooth', voices:9, spread:36, width:1,   cutoff:3200, env:5000, fdecay:0.25, q:1,   a:0.003, d:0.22, s:0.7,  r:0.3,  rev:0.32, del:0.1,  cho:0.3, hp:200, drive:1.3, slope:24, gain:0.27},
  pad:     {osc:'sawtooth', voices:7, spread:28, width:1,   cutoff:1600, env:900, fdecay:1.2,    q:0.9, a:0.35,  d:0.8,  s:0.9,  r:1.0,  rev:0.6,  cho:0.45, hp:140, slope:24, gain:0.2},
  bass:    {osc:'sawtooth', voices:2, spread:9,  width:0,   cutoff:200,  env:2200, fdecay:0.14, q:5,   a:0.002, d:0.22, s:0.6,  r:0.09, drive:2.4, sub:0.3, subOsc:'sine', slope:24, gain:0.52},
  bigbass: {osc:'sawtooth', voices:6, spread:20, width:0.5, cutoff:380,  env:4500, fdecay:0.13, q:2.5, a:0.002, d:0.2,  s:0.6,  r:0.12, drive:3.2, sub:0.25, subOsc:'sine', slope:24, gain:0.47},
  reese:   {osc:'sawtooth', voices:3, spread:26, width:0.5, cutoff:750,  env:700,  fdecay:0.4,  q:2,   a:0.004, d:0.3,  s:1,    r:0.1,  drive:3.2, sub:0.3, subOsc:'sine', slope:24, gain:0.44},
  wobble:  {osc:'sawtooth', voices:3, spread:14, width:0.3, cutoff:900,  lfo:800,               q:9,   a:0.005, d:0.2,  s:1,    r:0.08, drive:4,            gain:0.42},
  wall:    {osc:'sawtooth', voices:9, spread:38, width:1,   cutoff:1800, env:1200, fdecay:0.6,   q:0.9, a:0.05,  d:0.6,  s:0.85, r:0.8,  rev:0.48, del:0.05, cho:0.4, hp:160, slope:24, gain:0.18},
  bell:    {fm:true, ratio:3.5, index:6, idecay:0.35, voices:2, spread:7, width:0.6, cutoff:12000,  q:0.7, a:0.002, d:0.9,  s:0,    r:0.6,  rev:0.45, del:0.3,  gain:0.3},
  '808':   {osc:'sine',     voices:1, cutoff:1400, q:0.7, a:0.003, d:0.4, s:0.85, r:0.3, drive:3.5, gain:0.6},
  sub:     {osc:'sine',     voices:1,                        cutoff:500,                         q:0.7, a:0.004, d:0.2,  s:1,    r:0.06, drive:1.3,          gain:0.42},
};
Object.assign(PATCHES, {
  piano:   {sample:'piano',   a:0.002, r:0.45, gain:1.0,  rev:0.35, del:0.15, fallback:'pluck'},
  strings: {sample:'strings', a:0.22,  r:0.8,  gain:0.75, rev:0.45, del:0.05, loop:true, fallback:'pad'},
  choir:   {sample:'choir',   a:0.3,   r:0.9,  gain:0.6,  rev:0.5,  del:0.05, loop:true, fallback:'pad'},
  harp:    {sample:'harp',    a:0.002, r:0.6,  gain:1.0,  rev:0.4,  del:0.25, fallback:'bell'},
  violin:  {sample:'violin',  a:0.04,  r:0.35, gain:0.85, rev:0.4,  del:0.15, loop:true, fallback:'lead'},
  ebass:   {sample:'ebass',   a:0.003, r:0.12, gain:1.3,  rev:0,    del:0,    fallback:'bass'},
  user_lead:  {sample:'user_lead',  a:0.003, r:0.3,  gain:0.9, rev:0.3,  del:0.2,  fallback:'lead'},
  user_bass:  {sample:'user_bass',  a:0.003, r:0.1,  gain:1.0, rev:0,    del:0,    fallback:'bass'},
  user_pad:   {sample:'user_pad',   a:0.08,  r:0.6,  gain:0.7, rev:0.45, del:0.05, loop:true, fallback:'wall'},
  user_vocal: {sample:'user_vocal', a:0.01,  r:0.25, gain:0.9, rev:0.45, del:0.3,  fallback:'pluck'},
  pizz:    {sample:'pizz',    a:0.002, r:0.25, gain:1.0,  rev:0.35, del:0.2,  fallback:'pluck'},
});
const sampleBufs = {}; let samplesReady = false, samplesPromise = null;
function loadSamples(){
  if(samplesPromise) return samplesPromise;
  samplesPromise = Promise.all([...Object.entries(SAMPLE_DATA), ...Object.entries(typeof VOX_DATA === 'object' ? VOX_DATA : {})].map(async ([bank, notes]) => {
    const zones = await Promise.all(Object.entries(notes).map(async ([m, b64]) => {
      const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
      const lp = typeof VOX_LOOPS === 'object' && VOX_LOOPS[bank] && VOX_LOOPS[bank][m];
      return {m: +m, buf: await ctx.decodeAudioData(bin.buffer), ls: lp ? lp[0] : null, le: lp ? lp[1] : null};
    }));
    sampleBufs[bank] = zones.sort((a,b) => a.m - b.m);
  })).then(() => { samplesReady = true; }, e => { console.warn('Samples unavailable, using synths', e); });
  return samplesPromise;
}
