/* Lead-in: pads and vocals fade up through an opening filter, percussion creeps in, then a swell into the beat */
function introBar(i, song){
  const {T, ints, ext, voiced} = chordAtPos(song, i);
  const eighths = [0,2,4,6,8,10,12,14];
  const d = {};
  if(i >= 4) d.shaker = [2,6,10,14];
  if(i >= 6) d.chat = [2,6,10,14];
  if(i === 5 || i === 6) d.rim = [14];
  if(i === 7){ d.snare = [8,10,12,13,14,15]; d.tom = [14,15]; }
  const p = buildPattern(d, []);
  const tones = [0, ints[1], ints[2], 12];
  return Object.assign(p, {
    phase:'intro', barIn:i, sub:false,
    busFilter: {lp:[450*Math.pow(1.4,i), 450*Math.pow(1.4,i+1)], hp:[20,20]},
    wall: {T, ints, ext, voiced, len:16, bright: 0.35 + i*0.08},
    counter: i >= 2 ? counterLine(song, ints, [], i >= 4 ? 3 : 2) : null, counterT:T,
    arp: i >= 4 ? eighths.map((s,k) => [tones[k % 4], s]) : null, arpT:T, arpWave:'pluck',
    vocal: i >= 2 && i < 6 ? vocalBar(song, i, T, ints) : i === 6 ? [{s:0, len:24, m: 60 + T + ints[2] + (T < 0 ? 12 : 0), vw:['u','o','a'], from:null}] : null,
    riser: i >= 6 ? {bar: i - 1, cut:16} : null,
    gain: {snare: 0.6}, swell: i === 7 ? {s:8, steps:8} : null,
  });
}
function cycleBar(song, n){
  const st = STYLES[song.style], sc = SCALES[song.scale];
  const cyc = n % 32, c = Math.floor(n/32);
  const phase = cyc < 8 ? 'groove' : cyc < 16 ? 'build' : 'drop';
  const i = phase === 'groove' ? cyc : phase === 'build' ? cyc-8 : cyc-16;
  const K = norm(song.key), row = g => g >= 7 ? 12 : sc[g];
  const {T, ints, ext, voiced} = phase === 'build' && i >= 6 ? chordAtPos(song, i, song.prog, 3) : chordAtPos(song, i);
  const sym = {r:0, o:12, '3':ints[1], '5':ints[2]};
  const riff = r => r.map(([k,s]) => [sym[k], s]);
  const all16 = [...Array(16).keys()], eighths = [0,2,4,6,8,10,12,14];
  const d = {kick:[], snare:[], clap:[], chat:[], ohat:[], tom:[], crash:[], shaker:[], rim:[], bell:[]};
  const x = {phase, barIn:i, sub:true};
  const arp = (steps, shape) => { const tones = [0, ints[1], ints[2], 12]; return steps.map((s,k) => [tones[shape[k % shape.length]], s]); };
  let notes;

  if(phase === 'groove'){
    // A solid, steady beat: little randomness so it locks in
    Object.assign(d, {kick: i % 4 === 3 ? pick(st.kicks).slice() : st.kicks[0].slice(), snare: st.snare.slice(),
      clap: st.clap.slice(), chat: (song.dna ? HATS[song.dna.hats] : st.hats).slice(), ohat: (st.ohat || []).slice()});
    if(i === 0) d.crash = [0];
    if(n === 0) x.impact = true;
    if(i >= 4) d.shaker = [2,6,10,14];
    if(i % 2 === 1 && chance(0.5)) d.snare.push(pick([7,15]));
    if(i === 7){ d.snare.push(12,13,14,15); d.tom = [14,15]; }
    notes = riff(song.riffs[0]);
    x.synth = {wave: st.grooveBass, bright: 0.8 + i*0.06, octave:2, transpose:T, len:1.5};
    x.busFilter = {lp:[1000*Math.pow(1.12,i), 1000*Math.pow(1.12,i+1)], hp:[20,20]};
    if(i >= 4) x.chords = {steps: song.stab || [2,6,10,14], len:1, T, ints, ext, voiced, patch:'stab'};
    if(c > 0){ x.arp = arp(eighths, [0,1,2,3]); x.arpT = T; x.arpWave = (song.dna && song.dna.arp) || 'pluck'; }
    x.wall = {T, ints, ext, voiced, len:16, bright:0.7};
    if(i >= 4) x.vocal = vocalBar(song, i, T, ints);
    if(i >= 4){ x.counter = counterLine(song, ints, [], 2); x.counterT = T; }
  } else if(phase === 'build'){
    // Bars 1-2 quarters, 3-4 eighths, 5-6 sixteenths, 7 sixteenths, 8 thirty-seconds.
    // Snare pitch and volume climb the whole way, the drop's hook teases on a pluck,
    // then the last two bars hand over to a pitch riser and a held chord before a beat of silence.
    const D = song.dna || {}, gapAt = D.gap === 'half' ? 8 : 12;
    const cut = i === 7 ? gapAt : 16, upTo = arr => arr.filter(s => s < cut);
    d.snare = upTo(i < 2 ? [0,4,8,12] : i < 4 ? eighths : all16);
    x.gain = {snare: 0.35 + 0.09*i, clap: 0.5};
    x.pitch = {snare: Math.pow(2, i/9)};
    if(i === 7) x.half = {snare: d.snare.slice()};
    d.kick = i < 6 ? [0,4,8,12] : i === 6 ? [0,4,8,10,12,14] : upTo(eighths);
    d.clap = i < 4 ? [4,12] : [];
    d.chat = upTo(i < 4 ? [2,6,10,14] : eighths);
    if(i === 0) d.crash = [0];
    notes = i < 4 ? eighths.map(s => [0, s]) : [];
    x.sub = i < 4;
    x.synth = {wave:'bass', bright: 0.6 + i*0.2, octave:2, transpose:T};
    const lpAt = k => Math.min(20000, 2200*Math.pow(2.1,k)), hpAt = k => k <= 4 ? 20 : 20*Math.pow(2.6,k-4);
    x.busFilter = {lp:[lpAt(i), lpAt(i+1)], hp:[hpAt(i), hpAt(i+1)]};
    x.riser = {bar:i, cut};
    x.chords = {steps:[0], len: i === 7 ? 12 : 16, T, ints, ext, voiced, patch:'pad'};
    if(i < 6){
      x.lead = hookBar(song, i);
      x.leadSynth = {wave:'pluck', bright: 0.5 + i*0.15, octave:4, transpose:T, len:0.6};
    }
    if(i === 6) x.pitchRiser = {midi: 60 + T, steps: 16 + gapAt};
    x.wall = {T, ints, ext, voiced, len: i === 7 ? 12 : 16, bright: 0.6 + i*0.2};
    if(i < 6) x.vocal = vocalBar(song, i, T, ints);
    if(i === 6) x.vocal = [{s:0, len:16 + gapAt, m: 60 + T + ints[2] + (T < 0 ? 12 : 0), vw:['o','a','a'], from: null}];
    if(i === 7 && D.shout) x.vocal = [{s: gapAt, len: 16 - gapAt - 0.5, m: 72 + T + ints[1] - (T > 2 ? 12 : 0), vw:['a','a'], from: 60 + T + ints[2]}];
    // alternative build recipes
    if(D.build === 'filter'){ d.snare = i >= 6 ? upTo(eighths) : []; d.kick = upTo([0,4,8,12]); x.half = null; x.gain = {snare:0.6}; }
    else if(D.build === 'kickroll'){ d.snare = i >= 4 ? upTo([4,12]) : []; d.kick = upTo(i < 2 ? [0,4,8,12] : i < 4 ? eighths : all16); x.half = i === 7 ? {kick: d.kick.slice()} : null; }
    else if(D.build === 'vocal'){ d.kick = i < 4 ? [0,4,8,12] : []; d.chat = i < 4 ? d.chat : []; d.snare = i >= 6 ? upTo(all16) : []; if(i >= 4 && i < 6) x.lead = null; }
  } else {
    // The drop: heavy kick, supersaw bass, sidechain pumping, full hook
    const fillBar = i === 7 || i === 15;
    Object.assign(d, {kick: i % 4 === 0 ? st.kicks[0].slice() : pick(st.kicks).slice(), snare: st.snare.slice(),
      clap: (st.clap.length ? st.clap : st.snare).slice(), chat: song.dna ? HATS[song.dna.hats].slice() : [1,3,5,7,9,11,13,15],
      ohat: (st.ohat || [2,6,10,14]).slice(), shaker: eighths.slice()});
    if(i === 0 || i === 8) d.crash = [0];
    if(chance(0.4)) d.rim = pick([[3,11],[7,15],[3,6,11,14]]);
    if(chance(0.2)) d.bell = pick([[6,14],[3,10]]);
    if(i % 4 === 3 && !fillBar && chance(0.5)) d.kick.push(14,15);
    if(fillBar){ d.snare = d.snare.concat(i === 15 ? [8,10,12,13,14,15] : [12,13,14,15]); d.tom = i === 15 ? [11,13,15] : [14,15]; }
    const hb = hookBar(song, i), K = keyOff(song);
    // the bass locks to the hook's rhythm, jumping up an octave under its high notes
    notes = st.dropRhythm ? st.dropRhythm.map((s,k) => [k % 4 === 3 ? 12 : 0, s]) : hb.map(([r, s]) => [r >= 7 ? 12 : 0, s]);
    const dropBass = (song.dna && song.dna.dropBass) || st.dropBass, wob = dropBass === 'wobble';
    x.synth = {wave: dropBass, bright: 1 + (i % 8)*0.07, octave:2, transpose:T, len: wob ? 1.9 : 1.2, lfo: wob ? pick([1,2,2,4]) : 0};
    Object.assign(x, {duck:true, impact: i === 0, bigKick:true});
    x.chords = {steps: song.stab || [2,6,10,14], len: st.dropChords ? 1.5 : 1, T, ints, ext, voiced, patch: st.dropChords ? 'saws' : 'stab'};
    x.arp = arp(all16, song.arpShape || [0,1,2,3]); x.arpT = T; x.arpWave = (song.dna && song.dna.arp) || 'pluck';
    x.lead = hb;
    const leadP = (song.dna && song.dna.lead) || st.dropLead;
    x.leadSynth = {wave: leadP, bright:1.1, octave:4, transpose:K, len: leadP === 'pluck' || leadP === 'piano' ? 0.7 : 1.4};
    if(song.dna && song.dna.stutter && fillBar){
      // stutter: the last beat repeats the hook's first note in sixteenths
      x.lead = x.lead.filter(([,st2]) => st2 < 12).concat([12,13,14,15].map(st2 => [hb.length ? hb[0][0] : 0, st2, 1]));
      d.kick = d.kick.filter(st2 => st2 < 12).concat([12,13,14,15]);
    }
    if(song.dna && song.dna.gate && !fillBar) x.gate = {T, ints, ext, voiced, pattern: song.dna.gate};
    if(i >= 8){ x.lead2 = x.lead; x.lead2Synth = {wave:'pluck', bright:1.2, octave:5, transpose:K, len:0.6}; }
    x.wall = {T, ints, ext, voiced, len:16, bright: i >= 8 ? 1.3 : 1};
    if(i < 8 && !fillBar) x.vocal = hb.filter((_, k) => k % 2 === 0).map(([r, s], k) => ({s, len:0.9, m: 60 + K + r, vw:[k % 2 ? 'e' : 'a'], chop:true}));
    if(i >= 8) x.vocal = vocalBar(song, i, T, ints);
    if(!fillBar && (i >= 4)){ x.counter = counterLine(song, ints, hb.map(n => n[1]), i >= 8 ? 4 : 2); x.counterT = T; }
  }
  return Object.assign(buildPattern(d, notes), x);
}
