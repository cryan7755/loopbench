/* ---------- Your samples: drop in audio files, kept in this browser ---------- */
const USER_SLOTS = [
  {id:'kick', label:'Kick'}, {id:'snare', label:'Snare'}, {id:'clap', label:'Clap'}, {id:'chat', label:'Closed hat'},
  {id:'ohat', label:'Open hat'}, {id:'crash', label:'Crash'},
  {id:'lead', label:'Lead (one note)', root:60}, {id:'bass', label:'Bass (one note)', root:36},
  {id:'pad', label:'Pad (one note)', root:60}, {id:'vocal', label:'Vocal chop (one note)', root:69},
];
const userRaw = {};   // slot -> {name, bytes, root}
function idb(){ return new Promise((res, rej) => { const r = indexedDB.open('loopbench', 1); r.onupgradeneeded = () => r.result.createObjectStore('samples'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
async function idbAll(){ try{ const db = await idb(); return await new Promise((res) => { const out = {}; const tx = db.transaction('samples'); const cur = tx.objectStore('samples').openCursor(); cur.onsuccess = () => { const c = cur.result; if(c){ out[c.key] = c.value; c.continue(); } else res(out); }; cur.onerror = () => res(out); }); }catch(e){ return {}; } }
async function idbPut(key, val){ try{ const db = await idb(); db.transaction('samples', 'readwrite').objectStore('samples').put(val, key); }catch(e){} }
async function idbDel(key){ try{ const db = await idb(); db.transaction('samples', 'readwrite').objectStore('samples').delete(key); }catch(e){} }
async function decodeUser(slot){
  const r = userRaw[slot]; if(!r || !ctx) return;
  const buf = await ctx.decodeAudioData(r.bytes.slice(0));
  let pk = 0; for(let c=0;c<buf.numberOfChannels;c++){ const d = buf.getChannelData(c); for(let i=0;i<d.length;i++) pk = Math.max(pk, Math.abs(d[i])); }
  if(pk > 0) for(let c=0;c<buf.numberOfChannels;c++){ const d = buf.getChannelData(c); for(let i=0;i<d.length;i++) d[i] *= 0.9/pk; }
  sampleBufs['user_' + slot] = [{m: r.root || 60, buf}];
}
async function decodeAllUser(){ for(const k of Object.keys(userRaw)){ try{ await decodeUser(k); }catch(e){ console.warn('Could not decode', k, e); } } }
function sampler(midi, t, dur, P, v){
  // strings below the violins' range are played by the cello section
  const zones = P.sample === 'strings' && midi < 55 && sampleBufs.cello ? sampleBufs.cello : sampleBufs[P.sample];
  let z = zones[0]; for(const c of zones) if(Math.abs(c.m - midi) < Math.abs(z.m - midi)) z = c;
  const src = ctx.createBufferSource(); src.buffer = z.buf;
  const rate = Math.pow(2, (midi - z.m)/12); src.playbackRate.value = rate;
  const natural = z.buf.duration / rate;
  if(P.loop && dur > natural - 0.5){ src.loop = true; src.loopStart = z.le ? z.ls : 1.0; src.loopEnd = z.le ? z.le : z.buf.duration - 0.35; }
  const amp = ctx.createGain(), pk = v*(P.gain || 0.8), a = P.a || 0.003, hold = t + Math.max(dur, a + 0.01), r = P.r || 0.3;
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.linearRampToValueAtTime(pk, t + a);
  amp.gain.setValueAtTime(pk, hold);
  amp.gain.exponentialRampToValueAtTime(0.0001, hold + r);
  src.connect(amp); amp.connect(bus); sends(amp, P.rev, P.del);
  src.start(t); src.stop(hold + r + 0.05);
}
// Which instrument plays each role, by sound palette and song section
const HOUSE = new Set(['bigroom','progressive','deephouse','techhouse','eurodance','ukg']);
const hasUser = slot => !!(sampleBufs['user_' + slot] && sampleBufs['user_' + slot].length);
function remapPatch(name, role, p){
  if(!p || !p.phase) return name;
  // your own samples take over their role in every palette
  if((role === 'lead' || role === 'lead2') && hasUser('lead')) return 'user_lead';
  if(role === 'bass' && hasUser('bass')) return 'user_bass';
  if((role === 'wall' || role === 'chords' && name === 'pad') && hasUser('pad')) return 'user_pad';
  const pal = state.palette || 'hybrid';
  if(pal === 'electronic' || !samplesReady) return name;
  const ph = p.phase, calm = ph === 'intro' || ph === 'breakdown', soft = calm || ph === 'verse' || ph === 'outro' || ph === 'bridge';
  if(pal === 'orchestral'){
    // no synthesizers: strings, piano, harp, violin, bass guitar
    if(role === 'bass') return 'ebass';
    if(role === 'lead') return calm ? 'piano' : 'violin';
    if(role === 'lead2') return 'piano';
    if(role === 'arp') return calm ? 'harp' : ph === 'drop' || ph === 'build' ? 'spic' : 'pizz';
    if(role === 'counter') return 'harp';
    if(role === 'gate') return 'spic';
    if(role === 'wall') return 'strings';
    if(role === 'chords') return name === 'pad' ? 'strings' : 'piano';
    return name;
  }
  switch(name){
    case 'pad':   return 'strings';
    case 'wall':  return calm || ph === 'outro' ? 'strings' : 'wall';
    case 'bell':  return soft ? 'harp' : 'bell';
    case 'stab':  return ph === 'verse' && HOUSE.has(state.song && state.song.style) ? 'piano' : 'stab';
    case 'pluck': return role === 'lead' && calm ? 'piano' : role === 'arp' && calm ? 'pizz' : 'pluck';
  }
  return name;
}
// drum hits: your samples, or the acoustic kit in the orchestral palette
const KIT_NOTES = {kick:36, rim:37, snare:38, clap:39, chat:42, tom:45, ohat:46, crash:49, bell:56, shaker:70};
function drumSample(id){
  if(hasUser(id)) return sampleBufs['user_' + id][0].buf;
  if(state.palette === 'orchestral' && samplesReady && sampleBufs.kit){ const z = sampleBufs.kit.find(z => z.m === KIT_NOTES[id]); if(z) return z.buf; }
  return null;
}
function playHit(buf, t, v, pitch){
  const src = ctx.createBufferSource(); src.buffer = buf; src.playbackRate.value = typeof pitch === 'number' ? pitch : 1;
  const g = ctx.createGain(); g.gain.value = v*1.1; src.connect(g); g.connect(drumBus || master); sends(g, 0.12); src.start(t);
}
const LEGACY = {sawtooth:'lead', square:'pluck', triangle:'pluck', sine:'sub', supersaw:'bigbass'};
const patchOf = S => PATCHES[S.wave] ? S.wave : (LEGACY[S.wave] || 'lead');
const mtof = m => 440*Math.pow(2,(m-69)/12);
// Unison voices each start at a different point in the waveform (like free-running analog oscillators),
// so stacks sound wide and alive instead of phasey and flat
const waveCache = new WeakMap();
function phasedWave(type, k){
  let m = waveCache.get(ctx); if(!m){ m = new Map(); waveCache.set(ctx, m); }
  const key = type + k; if(m.has(key)) return m.get(key);
  const N = 96, real = new Float32Array(N), imag = new Float32Array(N), th = (k*0.618034 % 1)*2*Math.PI;
  for(let h=1; h<N; h++){ if(type === 'square' && h % 2 === 0) continue; real[h] = Math.sin(h*th)/h; imag[h] = Math.cos(h*th)/h; }
  const w = ctx.createPeriodicWave(real, imag); m.set(key, w); return w;
}
function synth(midi, t, dur, name, v, opt = {}){
  if(PATCHES[name] && PATCHES[name].sample){
    if(sampleBufs[PATCHES[name].sample]) return sampler(midi, t, dur, PATCHES[name], v);
    name = PATCHES[name].fallback;
  }
  let P = PATCHES[name] || PATCHES.lead;
  const D = state.song && state.song.dna;
  if(D) P = Object.assign({}, P, {spread:(P.spread || 0)*D.spread, cutoff:P.cutoff*D.bright, fdecay:(P.fdecay || 0.2)*D.snap, d:(P.d || 0.15)*D.snap, rev:(P.rev || 0)*D.rev, del:(P.del || 0)*D.rev});
  const n = Math.max(1, Math.round((P.voices || 1)*Q().voices)), bright = opt.bright || 1;
  const pre = ctx.createGain(); pre.gain.value = 1/Math.sqrt(n); let head = pre;
  if(P.drive){ const ws = ctx.createWaveShaper(); ws.curve = curve(P.drive); ws.oversample = '2x'; pre.connect(ws); head = ws; }
  // key tracking: higher notes open the filter further, as on a real synth
  const track = P.osc === 'sine' ? 1 : Math.pow(2, (midi - 60)/24);
  const cut = Math.min(16000, P.cutoff*bright*track);
  const hold = t + Math.max(dur, (P.a||0.005) + 0.01), stopAt = hold + (P.r||0.1)*3 + 0.05;
  const filters = [ctx.createBiquadFilter()]; if(P.slope === 24) filters.push(ctx.createBiquadFilter());
  filters.forEach((f, i) => {
    f.type = 'lowpass'; f.Q.value = i === 0 ? (P.q || 0.7) : 0.6;
    if(P.lfo){
      f.frequency.value = cut;
      const l = ctx.createOscillator(), lg = ctx.createGain();
      l.frequency.value = opt.lfoHz || 4; lg.gain.value = Math.max(0, Math.min(P.lfo*bright, cut - 60));
      l.connect(lg); lg.connect(f.frequency); l.start(t); l.stop(stopAt);
    } else if(P.env){
      f.frequency.setValueAtTime(Math.min(18000, cut + P.env*bright*track), t);
      f.frequency.exponentialRampToValueAtTime(Math.max(60, cut), t + P.fdecay);
    } else f.frequency.value = cut;
    if(P.flfo && !P.lfo && i === 0 && dur > 0.5){
      // slow filter movement so held sounds breathe
      const l = ctx.createOscillator(), lg = ctx.createGain();
      l.frequency.value = P.flfo[0]*(0.85 + Math.random()*0.3); lg.gain.value = cut*P.flfo[1];
      l.connect(lg); lg.connect(f.frequency); l.start(t); l.stop(stopAt);
    }
  });
  head.connect(filters[0]); if(filters[1]) filters[0].connect(filters[1]);
  let tail = filters[filters.length - 1];
  if(P.hp){ const h = ctx.createBiquadFilter(); h.type = 'highpass'; h.frequency.value = P.hp; h.Q.value = 0.6; tail.connect(h); tail = h; }
  const amp = ctx.createGain(); tail.connect(amp);
  const pk = v*(P.gain || 0.3), a = P.a || 0.005, s = Math.min(P.s ?? 0.8, 0.97);
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.linearRampToValueAtTime(pk, t+a);
  // explicit ramps: attack, decay to sustain, hold, release (no open-ended target curves)
  const sus = Math.max(pk*s, 0.0001), dEnd = Math.min(t + a + (P.d || 0.15), Math.max(hold, t + a + 0.002));
  amp.gain.exponentialRampToValueAtTime(sus, dEnd);
  amp.gain.setValueAtTime(sus, Math.max(hold, dEnd));
  amp.gain.exponentialRampToValueAtTime(0.0001, Math.max(hold, dEnd) + (P.r || 0.1));
  const wide = n > 1 && P.width, pl = wide ? pan(-P.width*0.8) : null, pr = wide ? pan(P.width*0.8) : null;
  if(wide){ pl.connect(pre); pr.connect(pre); }
  // slow analog-style pitch drift shared by the stack, each voice moving by a different amount
  let drift = null;
  if(n > 1 && !P.fm && dur > 0.25){ drift = ctx.createOscillator(); drift.frequency.value = 0.25 + Math.random()*0.5; drift.start(t); drift.stop(stopAt); }
  const layers = P.sub ? [[0, n], [-12, 1]] : [[0, n]];
  layers.forEach(([oct, count], li) => {
    for(let k=0;k<count;k++){
      const pos = count > 1 ? k/(count-1)*2-1 : 0;
      const o = ctx.createOscillator(), fr = mtof(midi + oct);
      if(P.fm) o.type = 'sine';
      else if(li === 0 && count > 1 && (P.osc === 'sawtooth' || P.osc === 'square')) o.setPeriodicWave(phasedWave(P.osc, k));
      else o.type = li ? (P.subOsc || 'square') : P.osc;
      o.frequency.value = fr;
      const det = li ? 0 : pos*(P.spread || 0) + (Math.random()-0.5)*3;
      if(P.pitchEnv){ o.detune.setValueAtTime(det + P.pitchEnv, t); o.detune.linearRampToValueAtTime(det, t + 0.035); } else o.detune.value = det;
      if(drift && li === 0){ const dg = ctx.createGain(); dg.gain.value = 2 + 4*Math.abs(pos) * (k % 2 ? 1 : -1); drift.connect(dg); dg.connect(o.detune); }
      if(P.fm){
        const m = ctx.createOscillator(), mg = ctx.createGain();
        m.frequency.value = fr*P.ratio;
        mg.gain.setValueAtTime(fr*P.index, t); mg.gain.exponentialRampToValueAtTime(fr*P.index*0.05 + 0.01, t + P.idecay);
        m.connect(mg); mg.connect(o.frequency); m.start(t); m.stop(stopAt);
      }
      if(li){ const sg = ctx.createGain(); sg.gain.value = (P.sub || 0.4)*Math.sqrt(n); o.connect(sg); sg.connect(pre); }
      else o.connect(wide ? (k % 2 ? pr : pl) : pre);
      o.start(t); o.stop(stopAt);
    }
  });
  amp.connect(bus);
  sends(amp, P.rev, P.del, P.cho);
}
const MINOR = [0,3,7];
function playChord(T, t, len, v, ints = MINOR, patch, voiced){
  patch = patch || (len > 2 ? 'pad' : 'stab');
  const full = state.quality !== 'light';
  let notes;
  if(voiced) notes = patch === 'saws' && full ? [...voiced, voiced[voiced.length-1] + 12 - 12*(voiced[voiced.length-1] > 72)] : voiced;
  else notes = (patch === 'saws' && full ? [...ints, 12, ints[1]+12] : full ? [...ints, 12] : ints).map(r => 60 + T + r);
  notes.forEach(m => synth(m, t, len*stepDur(), patch, v*0.55));
  if(patch === 'pad' || patch === 'strings') synth(48+T, t, len*stepDur(), patch, v*0.5);
}
const playArp = (r, T, t, v, patch) => synth(72+T+r, t, stepDur()*0.5, PATCHES[patch] ? patch : 'pluck', v*0.7);
const playSub = (r, T, t, v, len = 0.9) => synth(36+T+r, t, stepDur()*len, 'sub', v);
function playNote(row, t, v, S = state.synth){
  const midi = 12*(S.octave+1) + row + (S.transpose||0);
  const bright = S.bright || (S.cutoff ? S.cutoff/2000 : 1);
  synth(midi, t, stepDur()*(S.len || 0.9), patchOf(S), v, {bright, lfoHz: S.lfo ? state.bpm/60*S.lfo : 4});
}
function duck(t){
  const d = Math.min(0.25, stepDur()*2.5);
  bus.gain.cancelScheduledValues(t);
  bus.gain.setValueAtTime(0.25, t);
  bus.gain.linearRampToValueAtTime(1, t+d);
}
function riser(t, dur, i, v){
  const f0 = 250*Math.pow(2, i*0.7), f1 = 250*Math.pow(2, (i+1)*0.7);
  const g0 = v*(0.05 + 0.6*Math.pow(i/8,2)), g1 = v*(0.05 + 0.6*Math.pow((i+1)/8,2));
  const n = noise(t, dur);
  const f = filter('bandpass', f0, 3);
  f.frequency.setValueAtTime(f0,t); f.frequency.exponentialRampToValueAtTime(f1, t+dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(g0,t); g.gain.linearRampToValueAtTime(g1, t+dur);
  g.gain.setValueAtTime(g1, t+dur); g.gain.linearRampToValueAtTime(0.0001, t+dur+0.02);
  n.connect(f); f.connect(g); g.connect(master); sends(g, 0.35);
}
function pitchRiser(midi, t, dur, semis, v){
  const f = filter('lowpass', 700, 1.2);
  f.frequency.setValueAtTime(700, t); f.frequency.exponentialRampToValueAtTime(9000, t+dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v*0.13, t+dur*0.95); g.gain.linearRampToValueAtTime(0.0001, t+dur+0.02);
  [-22,-8,8,22].forEach((dt,k) => {
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.detune.value = dt;
    o.frequency.setValueAtTime(mtof(midi), t); o.frequency.exponentialRampToValueAtTime(mtof(midi+semis), t+dur);
    const pn = pan(k < 2 ? -0.7 : 0.7); o.connect(pn); pn.connect(f); o.start(t); o.stop(t+dur+0.05);
  });
  f.connect(g); g.connect(bus); sends(g, 0.3, 0.1);
}
