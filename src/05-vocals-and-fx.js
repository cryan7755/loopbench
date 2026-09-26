/* Sung vowels: a breathy, vibrato source through soprano formant filters */
const FORMANTS = {
  a: [[800,1,80],[1150,0.5,90],[2900,0.03,120],[3900,0.1,130]],
  e: [[350,1,60],[2000,0.12,100],[2800,0.18,120],[3600,0.02,150]],
  i: [[270,1,60],[2140,0.25,90],[2950,0.06,100],[3900,0.05,120]],
  o: [[450,1,70],[800,0.28,80],[2830,0.08,100],[3800,0.08,130]],
  u: [[325,1,50],[700,0.16,60],[2700,0.02,170],[3800,0.01,180]],
};
function sing(midi, t, dur, vowels, v, opt = {}){
  const f0 = mtof(midi), chop = !!opt.chop, end = t + dur, rel = chop ? 0.12 : 0.3;
  const sum = ctx.createGain(), hp = filter('highpass', 180), amp = ctx.createGain();
  // two slightly detuned sources = a doubled vocal
  [-6, 6].slice(0, Q().doubles).forEach((dt, k) => {
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.detune.value = dt;
    if(opt.from){ o.frequency.setValueAtTime(mtof(opt.from), t); o.frequency.exponentialRampToValueAtTime(f0, t+0.09); }
    else o.frequency.setValueAtTime(f0, t);
    if(dur > 0.35){
      const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = 5.2 + k*0.3;
      lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(28, t + Math.min(dur, 0.7));
      l.connect(lg); lg.connect(o.detune); l.start(t); l.stop(end+rel+0.1);
    }
    const pn = pan(k ? 0.25 : -0.25); o.connect(pn); pn.connect(sum); o.start(t); o.stop(end+rel+0.1);
  });
  const breath = filter('highpass', 4500); noise(t, dur+rel).connect(breath);
  const bg = ctx.createGain(); bg.gain.value = 0.05; breath.connect(bg); bg.connect(amp);
  const vs = vowels.map(x => FORMANTS[x] || FORMANTS.a);
  for(let k=0;k<Q().formants;k++){
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
    const fg = ctx.createGain();
    vs.forEach((vw, j) => {
      const at = t + (vs.length > 1 ? j/(vs.length-1) * Math.min(dur*0.6, 0.5) : 0);
      const [F, A, B] = vw[k];
      if(j === 0){ bp.frequency.setValueAtTime(F, at); bp.Q.setValueAtTime(F/B, at); fg.gain.setValueAtTime(A, at); }
      else { bp.frequency.linearRampToValueAtTime(F, at); bp.Q.linearRampToValueAtTime(F/B, at); fg.gain.linearRampToValueAtTime(A, at); }
    });
    sum.connect(bp); bp.connect(fg); fg.connect(hp);
  }
  hp.connect(amp);
  const pk = v*1.4, a = chop ? 0.008 : 0.06;
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.linearRampToValueAtTime(pk, t+a);
  const dEnd = Math.min(t + a + 0.3, Math.max(end, t + a + 0.002));
  amp.gain.exponentialRampToValueAtTime(pk*0.85, dEnd);
  amp.gain.setValueAtTime(pk*0.85, Math.max(end, dEnd));
  amp.gain.exponentialRampToValueAtTime(0.0001, Math.max(end, dEnd) + rel);
  amp.connect(master);
  sends(amp, chop ? 0.35 : 0.5, chop ? 0.45 : 0.3);
}
function swell(t, dur, v){
  const f = filter('highpass', 5000); noise(t, dur).connect(f);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v*0.45, t+dur); g.gain.linearRampToValueAtTime(0.0001, t+dur+0.015);
  f.connect(g); g.connect(master); sends(g, 0.4);
}
function downlifter(t, dur, v){
  const f = filter('bandpass', 9000, 2.5); noise(t, dur).connect(f);
  f.frequency.setValueAtTime(9000, t); f.frequency.exponentialRampToValueAtTime(250, t+dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(v*0.5, t); g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
  f.connect(g); g.connect(master); sends(g, 0.4);
}
/* Sampled vocal: looped sung vowels with glide, delayed vibrato and a double-tracked layer */
function vzone(bank, midi){ const zs = sampleBufs[bank]; let z = zs[0]; for(const c of zs) if(Math.abs(c.m - midi) < Math.abs(z.m - midi)) z = c; return z; }
function vvoice(bank, midi, t, dur, level, panv, detune, opt){
  const z = vzone(bank, midi), src = ctx.createBufferSource(); src.buffer = z.buf;
  src.playbackRate.value = Math.pow(2, (midi - z.m)/12);
  if(z.le){ src.loop = true; src.loopStart = z.ls; src.loopEnd = z.le; }
  if(opt.from){ src.detune.setValueAtTime((opt.from - midi)*100 + detune, t); src.detune.linearRampToValueAtTime(detune, t + 0.09); }
  else src.detune.value = detune;
  if(dur > 0.35){
    const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = 5.1 + Math.random()*0.5;
    lg.gain.setValueAtTime(0, t); lg.gain.setValueAtTime(0, t + 0.25); lg.gain.linearRampToValueAtTime(20, t + Math.min(dur, 0.8));
    l.connect(lg); lg.connect(src.detune); l.start(t); l.stop(t + dur + 0.6);
  }
  const g = ctx.createGain(); g.gain.value = level; const pn = pan(panv);
  src.connect(g); g.connect(pn); src.start(t); src.stop(t + dur + 0.6);
  return pn;
}
function singSampled(midi, t, dur, v, opt = {}){
  const chop = !!opt.chop, main = opt.style === 'choir' || midi < 60 ? 'choir_aahs' : 'voice_oohs';
  const dbl = main === 'voice_oohs' ? 'choir_aahs' : 'voice_oohs';
  const sum = ctx.createGain();
  vvoice(main, midi, t, dur, 1, -0.2, -6, opt).connect(sum);
  vvoice(main, midi, t + 0.014, dur, 0.7, 0.25, 7, opt).connect(sum);
  if(!chop) vvoice(dbl, midi, t, dur, 0.3, 0, 0, opt).connect(sum);
  const hp = filter('highpass', 170), pres = ctx.createBiquadFilter(), lp = filter('lowpass', 11000);
  pres.type = 'peaking'; pres.frequency.value = 3200; pres.gain.value = 3; pres.Q.value = 0.8;
  const amp = ctx.createGain(), a = chop ? 0.008 : 0.08, rel = chop ? 0.12 : 0.35, hold = Math.max(t + dur, t + a + 0.01), pk = v*0.95;
  amp.gain.setValueAtTime(0.0001, t); amp.gain.linearRampToValueAtTime(pk, t + a);
  amp.gain.setValueAtTime(pk, hold); amp.gain.exponentialRampToValueAtTime(0.0001, hold + rel);
  sum.connect(hp); hp.connect(pres); pres.connect(lp); lp.connect(amp); amp.connect(master);
  sends(amp, chop ? 0.35 : 0.5, chop ? 0.45 : 0.3);
}
function impact(t, v){
  const o = ctx.createOscillator();
  o.frequency.setValueAtTime(110,t); o.frequency.exponentialRampToValueAtTime(30,t+0.9);
  const g = envGain(t, v, 1.6); o.connect(g); o.start(t); o.stop(t+1.7);
  const f = filter('lowpass',3000); noise(t,1.2).connect(f); const g2 = envGain(t, v*0.45, 1.0); f.connect(g2); sends(g2, 0.7);
}
function audible(id){
  const m = state.mix[id];
  if(m.mute) return false;
  const anySolo = Object.values(state.mix).some(x => x.solo);
  return !anySolo || m.solo;
}
