/* ---------- Band genres: guitars, bass and an acoustic kit (rock, pop, dance pop, alt rock, metal) ----------
   Guitars are recorded notes (a Hofner hollow-body electric) played through a simulated amp:
   drive into a tone stack and a speaker-cabinet filter. Chords share one amp, so power chords
   distort together the way a real amp does. Heavy parts are double-tracked and panned left and right. */

const GTR_TONE = {
  clean:      {drive:0,  mid:[1000, 0],  lp:9000, lvl:0.95},
  cleanmute:  {drive:0,  mid:[1200, 2],  lp:7000, lvl:1.0,  mute:true},
  crunch:     {drive:3.5,mid:[1600, 3],  lp:6000, lvl:0.55, double:true},
  crunchmute: {drive:4,  mid:[1600, 3],  lp:5500, lvl:0.6,  mute:true, double:true},
  dist:       {drive:12, mid:[750, -4],  lp:5200, lvl:0.4,  double:true},
  mutedist:   {drive:12, mid:[750, -4],  lp:5000, lvl:0.45, mute:true, double:true},
  lead:       {drive:9,  mid:[1400, 3],  lp:6200, lvl:0.36},
};
function guitarTake(notes, t, dur, G, v, down, panTo, detune){
  const bank = G.mute && sampleBufs.gtrmute ? 'gtrmute' : 'gtr', zs = sampleBufs[bank];
  const inp = ctx.createGain(); let node = inp;
  if(G.drive){
    const hp = filter('highpass', 110, 0.7), pre = ctx.createGain(), ws = ctx.createWaveShaper();
    pre.gain.value = 2.2; ws.curve = curve(G.drive); ws.oversample = '4x';
    node.connect(hp); hp.connect(pre); pre.connect(ws); node = ws;
  }
  const mid = ctx.createBiquadFilter(); mid.type = 'peaking'; mid.frequency.value = G.mid[0]; mid.gain.value = G.mid[1]; mid.Q.value = 0.9;
  const cab = filter('lowpass', G.lp, 0.8), cabLow = filter('highpass', 75, 0.7), out = ctx.createGain();
  node.connect(mid); mid.connect(cab); cab.connect(cabLow); cabLow.connect(out);
  const end = t + dur, rel = G.mute ? 0.05 : 0.14;
  out.gain.setValueAtTime(v*G.lvl, t); out.gain.setValueAtTime(v*G.lvl, end); out.gain.exponentialRampToValueAtTime(0.0001, end + rel);
  const pn = pan(panTo); out.connect(pn); pn.connect(bus);
  sends(out, G === GTR_TONE.lead ? 0.28 : 0.12, G === GTR_TONE.lead ? 0.22 : 0);
  notes.forEach((m, k) => {
    let z = zs[0]; for(const c of zs) if(Math.abs(c.m - m) < Math.abs(z.m - m)) z = c;
    const src = ctx.createBufferSource(); src.buffer = z.buf;
    src.playbackRate.value = Math.pow(2, (m - z.m + detune/100)/12);
    const g = ctx.createGain(); g.gain.value = 1/Math.sqrt(notes.length);
    src.connect(g); g.connect(inp);
    src.start(t + (down ? k : notes.length - 1 - k)*0.007);                    // strum: strings hit one after another
    src.stop(end + rel + 0.05);
  });
}
function guitarHit(notes, t, dur, style, v, down = true){
  if(!sampleBufs.gtr) return;
  const G = GTR_TONE[style] || GTR_TONE.clean;
  if(G.double){ guitarTake(notes, t, dur, G, v*0.8, down, -0.85, -4); guitarTake(notes, t + 0.011, dur, G, v*0.8, down, 0.85, 5); }
  else guitarTake(notes, t, dur, G, v, down, style === 'lead' ? 0 : 0.3, 0);
}

// Guitar parts. c = {root, third, fifth, tone, gallop}
const GTR_PATTERNS = {
  chug:        c => (c.gallop ? [0,2,3,4,6,7,8,10,11,12,14,15] : [...Array(16).keys()]).map(s => ({s, len:0.9, notes:[c.root, c.root + 7], style:'mutedist'})),
  mute8:       c => [0,2,4,6,8,10,12,14].map(s => ({s, len:1.4, notes:[c.root, c.root + 7], style:c.tone === 'dist' ? 'mutedist' : 'crunchmute'})),
  power8:      c => [0,2,4,6,8,10,12,14].map((s, k) => ({s, len:1.9, notes:[c.root, c.root + 7, c.root + 12], style:c.tone, down: k % 2 === 0})),
  sustain:     c => [0, 8].map(s => ({s, len:7.8, notes:[c.root, c.root + 7, c.root + 12], style:c.tone})),
  arp:         c => [0,2,4,6,8,10,12,14].map((s, k) => ({s, len:3.5, notes:[[c.root + 12, c.root + 19, c.root + 12 + c.third, c.root + 24][k % 4]], style:'clean'})),
  strum:       c => [0,3,6,8,10,12,14].map(s => ({s, len:2.8, notes:[c.root, c.root + 7, c.root + 12, c.root + 12 + c.third, c.root + 19], style:'clean', down: s % 4 === 0})),
  strumSparse: c => [0,6,8,14].map(s => ({s, len:5.5, notes:[c.root, c.root + 7, c.root + 12, c.root + 12 + c.third, c.root + 19], style:'clean', down: s % 4 === 0})),
  funk:        c => [2,3,6,10,11,14].map(s => ({s, len:0.6, notes:[c.root + 12 + c.third, c.root + 19, c.root + 24], style:'cleanmute', down: s % 2 === 0})),
};
const BASS_PATTERNS = {
  eighths:   c => [0,2,4,6,8,10,12,14].map(s => [0, s]),
  driving16: c => [...Array(16).keys()].map(s => [0, s]),
  whole:     c => [[0, 0], [0, 8]],
  pop:       c => [[0,0],[0,3],[c.fifth,6],[0,8],[0,11],[12,14]],
  disco:     c => [0,2,4,6,8,10,12,14].map((s, k) => [k % 2 ? 12 : 0, s]),
};
const BAND_LABELS = {'Build':'Pre-chorus', 'Build 2':'Pre-chorus 2', 'Real build':'Pre-chorus', 'Drop':'Chorus', 'Main drop':'Chorus',
                     'Final drop':'Final chorus', 'Fake drop':'Fake chorus', 'Breakdown 2':'Bridge'};

// Turn a generated bar into a band arrangement: guitars, bass and live drums, without the EDM production
function bandBar(song, p, sec, i){
  const st = STYLES[song.style], ph = sec.name, last = i === sec.bars - 1;
  const bd = ph === 'breakdown' || ph === 'bridge';
  const secProg = bd ? song.bdProg : ph === 'build' ? song.preProg : ph === 'drop' ? song.prog : song.verseProg || song.prog;
  const src = p.wall || p.chords || p.gate || chordAtPos(song, i, secProg), bo = src.bass || 0;
  const T = src.T, third = src.ints[1], fifth = src.ints[2];
  const low = st.lowTuning ? 38 : 40, root = low + (((T % 12) + 12) % 12 - low % 12 + 12) % 12;
  // strip the dance-music production
  Object.assign(p, {arp:null, gate:null, duck:false, impact:false, riser:null, pitchRiser:null, bigKick:false, lead2:null, down:false});
  if(ph !== 'intro' || i >= sec.bars/2) p.busFilter = null;
  if(!st.keepSynths){ p.counter = null; if(!bd) p.wall = null; if(!bd) p.chords = null; }
  // guitars and bass
  const plan = st.gtr[ph] || st.gtr.verse, quietIntro = ph === 'intro' && i < sec.bars/2;
  const c = {root, third, fifth, tone: plan[1], gallop: st.gallop};
  p.gtr = quietIntro && st.gtr.introQuiet !== false ? GTR_PATTERNS.arp(c) : GTR_PATTERNS[plan[0]](c);
  if(ph === 'outro' && i >= sec.bars - 2) p.gtr = [{s:0, len:14, notes:[root, root + 7, root + 12], style: plan[1] === 'clean' ? 'clean' : 'dist'}];
  const bp = (st.bass && (st.bass[ph] || st.bass.verse)) || 'eighths';
  if(!(ph === 'intro' && quietIntro)){
    p.notes = Array.from({length:ROWS}, () => Array(STEPS).fill(false));
    BASS_PATTERNS[bp](c).forEach(([r, s]) => { r = r === 0 ? bo : r === 12 && bo ? bo : r; if(r >= 0 && r < ROWS) p.notes[r][s] = true; });
    p.synth = {wave:'rockbass', bright:1, octave:2, transpose:T, len: bp === 'whole' ? 7.5 : bp === 'driving16' ? 0.9 : 1.6};
  }
  p.sub = false;
  // drums: steady backbeat, fills at section ends, ride and double kick in choruses
  if(ph !== 'intro' || !quietIntro){
    const groove = {kick: ph === 'drop' && st.doubleKick ? [...Array(16).keys()] : pick(st.kicks).slice(), snare: st.snare.slice(), clap: st.clap.slice(),
                    chat:[0,2,4,6,8,10,12,14], ohat:[], tom:[], crash: i % 8 === 0 && (ph === 'drop' || ph === 'build' && i === 0) ? [0] : [], shaker:[], rim:[], bell:[]};
    if(ph === 'drop' && i === 0) groove.crash = [0];
    if(bd && !st.keepDrumsInBreakdown){ groove.kick = [0]; groove.snare = []; groove.clap = []; groove.chat = i >= sec.bars - 4 ? [0,4,8,12] : []; }
    if(last && ph !== 'outro'){ groove.snare = [4, 8, 10, 12, 13, 14, 15]; groove.tom = [11, 14]; groove.chat = [0,2,4,6]; }
    DRUMS.forEach((d, r) => { p.drums[r] = Array(STEPS).fill(false); (groove[d.id] || []).forEach(s => p.drums[r][s] = true); });
    p.half = null; p.gain = null; p.ride = ph === 'drop' && st.ride;
  }
  // voice and lead: the chorus is sung; guitar bands answer with a lead guitar in the intro and the last chorus
  if(ph === 'drop') p.vocal = vocalBar(song, i, T, src.ints);
  if(st.guitarLead){
    const solo = (sec.label === 'Final drop' || sec.label === 'Final chorus') && i >= sec.bars/2;
    if((ph === 'intro' && !quietIntro) || solo){ p.lead = hookBar(song, i); p.leadSynth = {wave:'gtrlead', octave:4, transpose:keyOff(song)}; }
    else if(ph !== 'intro') p.lead = null;
  } else if(ph === 'drop' && !st.keepSynths) p.lead = null;
  return p;
}
