/* ---------- Audio ---------- */
const QUALITY = {high:{voices:1, ir:2.8, formants:4, doubles:2}, balanced:{voices:0.8, ir:2.2, formants:4, doubles:2}, light:{voices:0.35, ir:1.3, formants:3, doubles:1}};
const IS_MOBILE = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));
const Q = () => QUALITY[state.quality || (IS_MOBILE ? 'light' : 'balanced')] || QUALITY.balanced;
let drumBus, liveOut, choIn, delFb, conv, ctx, master, bus, busLP, busHP, noiseBuf, revIn, delIn, delL, delR;
const curves = {};
function curve(k){
  if(curves[k]) return curves[k];
  const n = 2048, c = new Float32Array(n);
  for(let i=0;i<n;i++){ const x = i/(n-1)*2-1; c[i] = Math.tanh(k*x)/Math.tanh(k); }
  return curves[k] = c;
}
const pan = v => { if(!ctx.createStereoPanner) return ctx.createGain(); const p = ctx.createStereoPanner(); p.pan.value = v; return p; };
let liveGraph = null; const irCache = {};
function getIR(){ const k = Q().ir; return irCache[k] || (irCache[k] = makeIR(k)); }
function makeGraph(c, offline){
  const prev = ctx; ctx = c;
  const g = {ctx:c};
  const eq = (type, f, gain, q) => { const b = c.createBiquadFilter(); b.type = type; b.frequency.value = f; b.gain.value = gain; if(q) b.Q.value = q; return b; };
  // Mix bus: a little low-end weight, less boxiness, a touch of air
  g.master = c.createGain(); g.out = c.createGain();
  const lowShelf = eq('lowshelf', 90, 1.5), mud = eq('peaking', 320, -1.5, 0.9), highShelf = eq('highshelf', 11000, 1.5);
  g.master.connect(lowShelf); lowShelf.connect(mud); mud.connect(highShelf); highShelf.connect(g.out);
  // Drum bus: parallel compression for punch, then gentle tape-style saturation
  g.drumBus = c.createGain();
  const dsum = c.createGain(), dcomp = c.createDynamicsCompressor(), wet = c.createGain(), dsat = c.createWaveShaper(), makeup = c.createGain();
  dcomp.threshold.value = -28; dcomp.ratio.value = 6; dcomp.attack.value = 0.003; dcomp.release.value = 0.12;
  wet.gain.value = 0.55; dsum.gain.value = 0.75; dsat.curve = curve(1.4); dsat.oversample = '2x'; makeup.gain.value = 1.25;
  g.drumBus.connect(dsum); g.drumBus.connect(dcomp); dcomp.connect(wet); wet.connect(dsum);
  dsum.connect(dsat); dsat.connect(makeup); makeup.connect(g.master);
  // Synth bus: filters for section sweeps, air, then stereo widening (side boosted, mid kept)
  g.bus = c.createGain(); g.busHP = filter('highpass', 20, 0.7); g.busLP = filter('lowpass', 20000, 0.9);
  const air = eq('highshelf', 9000, 2.5);
  g.bus.connect(g.busHP); g.busHP.connect(g.busLP); g.busLP.connect(air);
  const w = 0.3, split = c.createChannelSplitter(2), merge = c.createChannelMerger(2);
  const lin = (gv) => { const x = c.createGain(); x.gain.value = gv; return x; };
  const ll = lin(1 + w/2), lr = lin(-w/2), rr = lin(1 + w/2), rl = lin(-w/2);
  air.connect(split);
  split.connect(ll, 0); split.connect(lr, 1); split.connect(rr, 1); split.connect(rl, 0);
  ll.connect(merge, 0, 0); lr.connect(merge, 0, 0); rr.connect(merge, 0, 1); rl.connect(merge, 0, 1);
  merge.connect(g.master);
  // stereo chorus: two slowly modulated short delays, one per side
  g.choIn = c.createGain();
  [[0.013, 0.23, -1], [0.019, 0.31, 1]].forEach(([dt, rate, side]) => {
    const d = c.createDelay(0.05), l = c.createOscillator(), lg = c.createGain(), pn = c.createStereoPanner ? c.createStereoPanner() : c.createGain(), og = c.createGain();
    d.delayTime.value = dt; l.frequency.value = rate; lg.gain.value = 0.0025; l.connect(lg); lg.connect(d.delayTime); l.start(0);
    if(pn.pan) pn.pan.value = side; og.gain.value = 0.7;
    g.choIn.connect(d); d.connect(pn); pn.connect(og); og.connect(g.bus);
  });
  g.conv = c.createConvolver(); g.conv.buffer = getIR();
  g.revIn = c.createGain(); const revHp = filter('highpass', 250), revOut = c.createGain(); revOut.gain.value = 0.55;
  g.revIn.connect(revHp); revHp.connect(g.conv); g.conv.connect(revOut); revOut.connect(g.bus);
  g.delIn = c.createGain(); g.delL = c.createDelay(2); g.delR = c.createDelay(2);
  const fb = c.createGain(); fb.gain.value = 0.38; const lp = filter('lowpass', 3500), out = c.createGain(); out.gain.value = 0.5;
  g.delIn.connect(g.delL); g.delL.connect(g.delR); g.delR.connect(lp); lp.connect(fb); fb.connect(g.delL); g.fb = fb;
  const pl = pan(-0.8), pr = pan(0.8);
  g.delL.connect(pl); g.delR.connect(pr); pl.connect(out); pr.connect(out); out.connect(g.bus);
  g.delL.delayTime.value = g.delR.delayTime.value = stepDur()*3;
  if(offline) g.out.connect(c.destination);
  ctx = prev;
  return g;
}
function useGraph(g){ ({ctx, master, bus, busLP, busHP, conv, revIn, delIn, delL, delR, fb: delFb, choIn, drumBus} = g); }
function ensureAudio(){
  if(!ctx){
    try{ if(navigator.audioSession) navigator.audioSession.type = 'playback'; }catch(e){}
    const AC = window.AudioContext || window.webkitAudioContext;
    let c; try{ c = new AC({latencyHint:'playback'}); }catch(e){ c = new AC(); }
    ctx = c;
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for(let i=0;i<d.length;i++) d[i] = Math.random()*2-1;
    liveGraph = makeGraph(ctx, false);
    const glue = ctx.createDynamicsCompressor();
    glue.threshold.value = -14; glue.ratio.value = 3; glue.attack.value = 0.01; glue.release.value = 0.15;
    const limit = ctx.createDynamicsCompressor();
    limit.threshold.value = -3; limit.ratio.value = 20; limit.attack.value = 0.002; limit.release.value = 0.08;
    // Output stage: volume, headroom, a soft clipper for density, glue compression, limiter
    liveOut = ctx.createGain(); liveOut.gain.value = state.master;
    const trim = ctx.createGain(); trim.gain.value = 0.45;
    const clip = ctx.createWaveShaper(); clip.curve = curve(1.15); clip.oversample = '4x';
    liveGraph.out.connect(liveOut); liveOut.connect(trim); trim.connect(clip); clip.connect(glue); glue.connect(limit); limit.connect(ctx.destination);
    useGraph(liveGraph);
    loadSamples(); decodeAllUser().then(() => typeof paintSlots === 'function' && paintSlots());
  }
  if(ctx.state === 'suspended') ctx.resume();
}
function makeIR(sec){
  const len = Math.floor(ctx.sampleRate*sec), ir = ctx.createBuffer(2, len, ctx.sampleRate);
  // highs die away faster than lows, with a short pre-delay and early reflections, like a real hall
  const pre = Math.floor(ctx.sampleRate*0.015);
  for(let ch=0; ch<2; ch++){
    const b = ir.getChannelData(ch); let y = 0;
    for(let i=pre;i<len;i++){
      const x = i/len, a = 0.85 - 0.75*x;
      y += a*((Math.random()*2-1) - y);
      b[i] = y*Math.pow(1 - x, 2.6)*(1 + 0.6*Math.exp(-x*25));
    }
    for(let e=0;e<6;e++){ const at = pre + Math.floor(ctx.sampleRate*(0.008 + 0.011*e + 0.003*ch)); if(at < len) b[at] += (0.5 - e*0.06)*(e % 2 ? -1 : 1); }
  }
  return ir;
}
function sends(node, rev, del, cho){
  if(cho && choIn){ const g = ctx.createGain(); g.gain.value = cho; node.connect(g); g.connect(choIn); }
  if(rev){ const g = ctx.createGain(); g.gain.value = rev; node.connect(g); g.connect(revIn); }
  if(del){ const g = ctx.createGain(); g.gain.value = del; node.connect(g); g.connect(delIn); }
}
function keyKickTune(){
  if(!state.song || !state.song.scale) return 1;
  const f = 440*Math.pow(2, (24 + ((keyOff(state.song) % 12) + 12) % 12 - 69)/12);
  return (Math.abs(f*2 - 50) < Math.abs(f - 50) ? f*2 : f)/46;
}
function envGain(t, peak, dur){
  const g = ctx.createGain();
  g.gain.setValueAtTime(Math.max(peak,0.0002), t);
  g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
  g.connect(drumBus || master);
  return g;
}
function noise(t, dur){
  const n = ctx.createBufferSource(); n.buffer = noiseBuf; n.loop = true;
  n.start(t); n.stop(t+dur+0.05); return n;
}
function filter(type, freq, q){ const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; if(q) f.Q.value = q; return f; }
const kitOf = () => (state.song && state.song.dna && state.song.dna.kit) || {kick:1, decay:1, clap:1500, hat:7500, snare:1};
function metal(t, dur, v, hp, base = 40){
  const bp = filter('bandpass', 10000, 0.7), h = filter('highpass', hp);
  [2,3,4.16,5.43,6.79,8.21].forEach(r => { const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = base*r; o.connect(bp); o.start(t); o.stop(t+dur+0.05); });
  bp.connect(h); const g = envGain(t, v, dur); h.connect(g); return g;
}
const VOICES = {
  kick(t,v,big){
    // the kick's body is tuned to the song's key, so it sits with the bass instead of against it
    const K = kitOf(), kd = K.decay, kt = keyKickTune()*Math.sqrt(K.kick);
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime((big ? 320 : 260)*kt, t);
    o.frequency.exponentialRampToValueAtTime((big ? 52 : 56)*kt, t+0.055);
    o.frequency.exponentialRampToValueAtTime((big ? 40 : 46)*kt, t+0.4*kd);
    const ws = ctx.createWaveShaper(); ws.curve = curve(K.drive || (big ? 3 : 1.8));
    const g = ctx.createGain();
    g.gain.setValueAtTime(v*0.95, t); g.gain.setValueAtTime(v*0.95, t + (big ? 0.1 : 0.07)*kd); g.gain.exponentialRampToValueAtTime(0.0001, t + (big ? 0.75 : 0.5)*kd);
    o.connect(ws); ws.connect(g); g.connect(drumBus || master); o.start(t); o.stop(t + 0.9*kd + 0.1);
    const c = ctx.createOscillator(); c.type = 'triangle';
    c.frequency.setValueAtTime(2400,t); c.frequency.exponentialRampToValueAtTime(400,t+0.012);
    c.connect(envGain(t, v*0.3, 0.015)); c.start(t); c.stop(t+0.03);
  },
  snare(t,v,pitch = 1){
    if(typeof pitch !== 'number') pitch = 1;
    pitch *= kitOf().snare;
    const hp = filter('highpass',1500*pitch), bp = filter('bandpass',3500*pitch,0.6);
    noise(t,0.3).connect(hp); hp.connect(bp);
    const g = envGain(t, v*0.8, 0.22); bp.connect(g); sends(g, 0.3);
    const o = ctx.createOscillator(); o.type = 'triangle';
    o.frequency.setValueAtTime(260*pitch,t); o.frequency.exponentialRampToValueAtTime(180*pitch,t+0.05);
    const g2 = envGain(t, v*0.55, 0.12); o.connect(g2); sends(g2, 0.15); o.start(t); o.stop(t+0.15);
  },
  clap(t,v){
    const hp = filter('highpass',900), bp = filter('bandpass',kitOf().clap,0.9);
    noise(t,0.4).connect(hp); hp.connect(bp);
    const g = ctx.createGain(); g.connect(drumBus || master); bp.connect(g); sends(g, 0.4);
    for(let k=0;k<3;k++){ const s = t+k*0.011; g.gain.setValueAtTime(v*0.9,s); g.gain.exponentialRampToValueAtTime(v*0.12,s+0.009); }
    g.gain.setValueAtTime(v*0.9,t+0.033); g.gain.exponentialRampToValueAtTime(0.0001,t+0.3);
  },
  chat(t,v){ metal(t, 0.045, v*0.3, kitOf().hat); },
  ohat(t,v){ const g = metal(t, 0.32, v*0.26, kitOf().hat - 500); sends(g, 0.12); },
  tom(t,v){
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(190,t); o.frequency.exponentialRampToValueAtTime(95,t+0.25);
    const g = envGain(t, v*0.8, 0.4); o.connect(g); sends(g, 0.25); o.start(t); o.stop(t+0.45);
  },
  crash(t,v){
    const g = metal(t, 1.8, v*0.22, 4500, 63); sends(g, 0.3);
    const f = filter('highpass',5000); noise(t,1.6).connect(f); const g2 = envGain(t, v*0.25, 1.5); f.connect(g2); sends(g2, 0.3);
  },
  shaker(t,v){
    const f = filter('bandpass',7000,1.2); noise(t,0.07).connect(f);
    const g = ctx.createGain(); g.connect(drumBus || master); f.connect(g);
    g.gain.setValueAtTime(0.0001,t); g.gain.linearRampToValueAtTime(v*0.35,t+0.012); g.gain.exponentialRampToValueAtTime(0.0001,t+0.065);
  },
  rim(t,v){
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = 1750;
    const g = envGain(t, v*0.45, 0.04); o.connect(g); sends(g, 0.25); o.start(t); o.stop(t+0.06);
  },
  bell(t,v){
    const f = filter('bandpass',800,1.5);
    [540,800].forEach(fr => { const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = fr; o.connect(f); o.start(t); o.stop(t+0.3); });
    const g = envGain(t, v*0.25, 0.25); f.connect(g); sends(g, 0.2, 0.2);
  },
};
