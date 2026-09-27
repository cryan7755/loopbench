/* ---------- Endless mode: every song is generated, every bar varies ---------- */
let rnd = Math.random;
function mulberry32(a){ return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hashStr(str){ let h = 2166136261; for(let i=0;i<str.length;i++){ h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
const seedWith = str => { rnd = mulberry32(hashStr(str)); };
const pick = a => a[Math.floor(rnd()*a.length)];
const chance = x => rnd() < x;
const SEED_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const randomSeed = () => Array.from({length:6}, () => SEED_CHARS[Math.floor(Math.random()*SEED_CHARS.length)]).join('');
const PART_KEYS = ['chords','hook','bass','vocal','drums','sound','form'];
const STYLES = {
  bigroom:     {label:'big room house', bpm:[126,128], kicks:[[0,4,8,12]], snare:[], clap:[4,12], hats:[1,3,5,7,9,11,13,15], ohat:[2,6,10,14], rolls:0.2, grooveBass:'bass', dropBass:'bigbass', dropLead:'lead', dropRhythm:[0,3,6,8,11,14]},
  progressive: {label:'progressive house', bpm:[124,128], kicks:[[0,4,8,12]], snare:[], clap:[4,12], hats:[1,3,5,7,9,11,13,15], ohat:[2,6,10,14], rolls:0.25, grooveBass:'bass', dropBass:'bass', dropLead:'pluck', dropRhythm:[2,3,6,7,10,11,14,15]},
  trance:      {label:'trance', bpm:[136,140], kicks:[[0,4,8,12]], snare:[], clap:[4,12], hats:[1,3,5,7,9,11,13,15], ohat:[2,6,10,14], rolls:0.2, grooveBass:'bass', dropBass:'bass', dropLead:'lead', dropRhythm:[1,2,3,5,6,7,9,10,11,13,14,15]},
  future:      {label:'future bass', bpm:[140,160], kicks:[[0,10],[0,7,10],[0,3,10]], snare:[8], clap:[8], hats:[0,2,4,6,8,10,12,14], rolls:0.5, grooveBass:'reese', dropBass:'reese', dropLead:'pluck', dropChords:true},
  dubstep:     {label:'melodic dubstep', bpm:[140,150], kicks:[[0,10],[0,3,10],[0,11]], snare:[8], clap:[8], hats:[0,2,4,6,8,10,12,14], rolls:0.4, grooveBass:'reese', dropBass:'wobble', dropLead:'lead'},
  dnb:         {label:'drum & bass', bpm:[172,176], kicks:[[0,10],[0,6,10],[0,10,11],[0,3,10],[0,7,10]], snare:[4,12], clap:[], hats:[0,2,4,6,8,10,12,14], rolls:0.35, grooveBass:'reese', dropBass:'reese', dropLead:'lead'},
  techno:      {label:'techno', bpm:[128,134], kicks:[[0,4,8,12]], snare:[], clap:[4,12], hats:[...Array(16).keys()], ohat:[2,6,10,14], rolls:0.3,
                grooveBass:'reese', dropBass:'reese', dropLead:'sqlead', dropRhythm:[2,3,6,7,10,11,14,15], scales:['minor','phrygian','minor'],
                bassPool:['reese','reese','bass'], leadPool:['sqlead','pluck','bell','sqlead'], hatsPool:['sixteenths','offbeat'], kit:{decay:1.3, drive:2.6}},
  techhouse:   {label:'tech house', bpm:[124,128], kicks:[[0,4,8,12]], snare:[], clap:[4,12], hats:[2,6,10,14], ohat:[2,6,10,14], rolls:0.4, swing:18,
                grooveBass:'bass', dropBass:'bass', dropLead:'pluck', dropRhythm:[0,3,6,7,10,14], scales:['minor','dorian'],
                bassPool:['bass','reese'], leadPool:['pluck','sqlead','piano'], hatsPool:['shuffle','offbeat'], kit:{decay:1.1}},
  deephouse:   {label:'deep house', bpm:[118,123], kicks:[[0,4,8,12]], snare:[], clap:[4,12], hats:[2,6,10,14], ohat:[2,6,10,14], rolls:0.2, swing:22,
                grooveBass:'bass', dropBass:'bass', dropLead:'piano', scales:['minor','dorian'], harmony:'seventh',
                bassPool:['bass'], leadPool:['piano','pluck','bell'], hatsPool:['shuffle','offbeat'], kit:{kick:0.95, decay:1.1}},
  psytrance:   {label:'psytrance', bpm:[140,146], kicks:[[0,4,8,12]], snare:[], clap:[4,12], hats:[...Array(16).keys()], ohat:[2,6,10,14], rolls:0.3,
                grooveBass:'bass', dropBass:'bass', dropLead:'sqlead', dropRhythm:[1,2,3,5,6,7,9,10,11,13,14,15], scales:['phrygian','minor'],
                bassPool:['bass'], leadPool:['sqlead','pluck','lead'], hatsPool:['sixteenths'], kit:{kick:1.05, decay:0.8}},
  hardstyle:   {label:'hardstyle', bpm:[150,155], kicks:[[0,4,8,12]], snare:[], clap:[4,12], hats:[2,6,10,14], ohat:[2,6,10,14], rolls:0.3,
                grooveBass:'bigbass', dropBass:'bigbass', dropLead:'lead', dropRhythm:[2,6,10,14], scales:['minor'],
                bassPool:['bigbass'], leadPool:['lead','saws'], hatsPool:['offbeat','eighths'], kit:{kick:1.1, decay:1.8, drive:9}},
  synthwave:   {label:'synthwave', bpm:[100,118], kicks:[[0,8],[0,8,10],[0,6,8]], snare:[4,12], clap:[4,12], hats:[0,2,4,6,8,10,12,14], rolls:0.2,
                grooveBass:'bass', dropBass:'bass', dropLead:'sqlead', dropRhythm:[0,2,4,6,8,10,12,14], scales:['minor','major','dorian'],
                bassPool:['bass'], leadPool:['sqlead','lead','bell'], hatsPool:['eighths','sixteenths'], kit:{kick:0.9, decay:1.2}},
  ukg:         {label:'UK garage', bpm:[130,134], kicks:[[0,10],[0,7,10],[0,10,11]], snare:[4,12], clap:[4,12], hats:[0,2,3,6,8,10,11,14], rolls:0.5, swing:55,
                grooveBass:'reese', dropBass:'reese', dropLead:'pluck', scales:['minor','dorian'], harmony:'seventh',
                bassPool:['reese','bass'], leadPool:['pluck','piano','bell'], hatsPool:['shuffle','eighths'], kit:{decay:0.9}},
  trap:        {label:'festival trap', bpm:[140,150], kicks:[[0,10],[0,7,11],[0,3,10]], snare:[8], clap:[8], hats:[0,2,4,6,8,10,12,14], rolls:0.8,
                grooveBass:'808', dropBass:'808', dropLead:'lead', scales:['minor','phrygian'],
                bassPool:['808','808','bigbass'], leadPool:['lead','sqlead','bell'], hatsPool:['eighths','sixteenths'], kit:{kick:0.9, decay:1.2}},
  eurodance:   {label:'eurodance', bpm:[138,145], kicks:[[0,4,8,12]], snare:[], clap:[4,12], hats:[1,3,5,7,9,11,13,15], ohat:[2,6,10,14], rolls:0.2,
                grooveBass:'bass', dropBass:'bass', dropLead:'sqlead', dropRhythm:[2,6,10,14], scales:['major','minor'],
                bassPool:['bass','bigbass'], leadPool:['sqlead','lead','piano'], hatsPool:['offbeat','eighths'], kit:{kick:1.05}},
  // Band genres: live-style drums, guitars through an amp, bass guitar; sections become verse, pre-chorus and chorus
  rock:        {label:'rock', band:true, acoustic:true, ride:true, guitarLead:true, bpm:[110,140], kicks:[[0,8],[0,6,8],[0,8,10],[0,3,8,10]], snare:[4,12], clap:[],
                hats:[0,2,4,6,8,10,12,14], rolls:0.1, grooveBass:'rockbass', dropBass:'rockbass', dropLead:'lead', scales:['major','minor','dorian'],
                bassPool:['rockbass'], leadPool:['lead'], hatsPool:['eighths'], forms:['classic','radio','cold'],
                gtr:{intro:['power8','crunch'], verse:['mute8','crunch'], build:['power8','crunch'], drop:['power8','dist'], breakdown:['arp','clean'], bridge:['sustain','dist'], outro:['sustain','dist']},
                bass:{verse:'eighths', build:'eighths', drop:'eighths', breakdown:'whole', bridge:'whole', outro:'whole'}},
  pop:         {label:'pop', band:true, acoustic:true, softSnare:true, keepSynths:true, bpm:[96,122], kicks:[[0,8],[0,8,10],[0,4,8,12]], snare:[4,12], clap:[4,12],
                hats:[0,2,4,6,8,10,12,14], rolls:0.15, grooveBass:'rockbass', dropBass:'rockbass', dropLead:'pluck', scales:['major','major','minor'],
                bassPool:['rockbass'], leadPool:['pluck','piano','bell'], hatsPool:['eighths'], forms:['radio','classic'],
                gtr:{intro:['strumSparse','clean'], verse:['strumSparse','clean'], build:['strum','clean'], drop:['strum','clean'], breakdown:['arp','clean'], bridge:['strum','clean'], outro:['strumSparse','clean'], introQuiet:false},
                bass:{verse:'pop', build:'pop', drop:'pop', breakdown:'whole', bridge:'pop', outro:'whole'}},
  dancepop:    {label:'dance pop', band:true, keepSynths:true, keepDrumsInBreakdown:false, bpm:[116,126], kicks:[[0,4,8,12]], snare:[], clap:[4,12],
                hats:[2,6,10,14], ohat:[2,6,10,14], rolls:0.2, grooveBass:'rockbass', dropBass:'rockbass', dropLead:'pluck', scales:['minor','major','dorian'],
                bassPool:['rockbass'], leadPool:['pluck','sqlead','piano'], hatsPool:['offbeat','sixteenths'], forms:['radio','classic','extended'],
                gtr:{intro:['funk','cleanmute'], verse:['funk','cleanmute'], build:['funk','cleanmute'], drop:['funk','cleanmute'], breakdown:['strumSparse','clean'], bridge:['funk','cleanmute'], outro:['funk','cleanmute'], introQuiet:false},
                bass:{verse:'disco', build:'disco', drop:'disco', breakdown:'whole', bridge:'disco', outro:'disco'}},
  altrock:     {label:'alt rock', band:true, acoustic:true, ride:true, guitarLead:true, bpm:[100,130], kicks:[[0,8,10],[0,6,8],[0,8]], snare:[4,12], clap:[],
                hats:[0,2,4,6,8,10,12,14], rolls:0.1, grooveBass:'rockbass', dropBass:'rockbass', dropLead:'lead', scales:['minor','dorian','major'],
                bassPool:['rockbass'], leadPool:['lead'], hatsPool:['eighths'], forms:['classic','radio','cold'],
                gtr:{intro:['arp','clean'], verse:['arp','clean'], build:['mute8','crunch'], drop:['sustain','dist'], breakdown:['arp','clean'], bridge:['power8','crunch'], outro:['sustain','dist']},
                bass:{verse:'whole', build:'eighths', drop:'eighths', breakdown:'whole', bridge:'eighths', outro:'whole'}},
  metal:       {label:'metal', band:true, acoustic:true, ride:true, guitarLead:true, doubleKick:true, gallop:true, lowTuning:true, bpm:[140,180],
                kicks:[[0,8],[0,3,8,11],[0,2,8,10]], snare:[4,12], clap:[], hats:[0,2,4,6,8,10,12,14], rolls:0.1, grooveBass:'rockbass', dropBass:'rockbass', dropLead:'lead',
                scales:['phrygian','minor'], bassPool:['rockbass'], leadPool:['lead'], hatsPool:['eighths'], forms:['classic','cold','radio'],
                gtr:{intro:['sustain','dist'], verse:['chug','dist'], build:['chug','dist'], drop:['power8','dist'], breakdown:['arp','clean'], bridge:['chug','dist'], outro:['sustain','dist'], introQuiet:false},
                bass:{verse:'driving16', build:'driving16', drop:'eighths', breakdown:'whole', bridge:'driving16', outro:'whole'}},
};
const SCALES = {minor:[0,2,3,5,7,8,10], dorian:[0,2,3,5,7,9,10], phrygian:[0,1,3,5,7,8,10], major:[0,2,4,5,7,9,11]};
const PROGS = [[0,5,3,4],[0,3,4,0],[0,5,2,6],[0,6,5,6],[0,3,0,4],[5,3,0,4],[0,4,5,3],[0,5,6,4],[0,2,5,6],[3,4,0,5],[0,6,3,4],[5,6,0,0],[0,3,5,6]];
const progAt = (song, i, prog) => (prog || song.prog)[Math.floor(i / (song.chordBars || 1)) % 4];
const KEYS = ['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];
const WORDS1 = ['Neon','Velvet','Chrome','Hyper','Glass','Solar','Lucky','Electric','Midnight','Rapid','Pixel','Loud','Tiny','Paper','Turbo'];
const WORDS2 = ['Rush','Circuits','Sprint','Comet','Pulse','Kaleidoscope','Fireworks','Ricochet','Sparks','Detour','Orbit','Zoomies','Confetti','Sidequest','Tangent'];
const BASS_RHYTHMS = [[0,3,6,8,10,12,14],[0,2,4,6,8,10,11,14],[0,1,4,6,8,10,12,14],[0,3,6,10,11,14],[0,6,8,11,14],[0,2,3,6,8,10,13,14]];
const HOOK_RHYTHMS = [[0,2,3,6,8,10,11,14],[0,3,6,8,11,14],[0,2,4,6,8,11,12,14],[0,1,3,6,8,9,11,14],[0,3,4,7,8,11,12,14]];
const ARP_SHAPES = [[0,1,2,3],[0,1,2,3,2,1],[0,2,1,3],[3,2,1,0],[0,3,2,1]];
const norm = x => { x = ((x%12)+12)%12; return x > 6 ? x-12 : x; };
const clampDeg = g => Math.max(0, Math.min(7, g));
function chordAt(song, deg){
  const sc = SCALES[song.scale], root = sc[deg];
  const up = k => sc[(deg+k)%7] + (deg+k >= 7 ? 12 : 0) - root;
  const ints = [0, up(2), up(4)];
  if(song.sus && (deg === 4 || deg === 6)) ints[1] = up(3);            // suspended chords where tension wants it
  const h = song.harmony;
  const ext = h === 'seventh' ? [...ints, up(6)] : h === 'add9' ? [...ints, up(1) + 12]
            : h === 'mixed' ? (deg % 2 ? [...ints, up(6)] : [...ints, up(1) + 12]) : ints.slice();
  return {T: norm(song.key + root), ints, ext};
}
function makeRiff(){ return pick(BASS_RHYTHMS).map((st,i) => [i === 0 ? 'r' : pick(['r','r','o','o','5','3']), st]); }
function makeHook(){
  const rh = pick(HOOK_RHYTHMS);
  let g = pick([2,4,7]);
  const call = rh.map((st,i) => { if(i) g = clampDeg(g + pick([-2,-1,-1,1,1,2,0])); return [g, st]; });
  const first = call.filter(([,st]) => st < 8), rest = rh.filter(st => st >= 8);
  let g2 = first.length ? first[first.length-1][0] : 4;
  const answer = first.concat(rest.map((st,i) => { g2 = i === rest.length-1 ? 0 : clampDeg(g2 + pick([-2,-1,-1,1])); return [g2, st]; }));
  return [call, answer];
}
const DROP_RHYTHMS = [[0,3,6,8,10,12,14],[0,2,3,6,8,10,11,14],[0,3,6,10,12,14],[0,1,3,4,6,8,11,14],[0,3,6,8,11,14]];
const MELODY_STYLES = ['walk','riff','anthem','cascade','offbeat','floaty'];
const MELODY_RHYTHMS = {
  riff:    [[0,2,3,4,6,8,10,11,12,14],[0,1,3,4,6,8,9,11,12,14]],
  anthem:  [[0,3,6,8,10,12,14],[0,4,6,8,12,14]],
  cascade: [[0,2,4,6,8,10,12,14],[0,3,6,8,11,14]],
  offbeat: [[1,3,4,6,9,11,12,14],[2,3,6,7,10,11,14]],
  floaty:  [[0,6,8,14],[0,4,8,12],[0,8,12]],
};
function makeDropHook(style = 'walk'){
  const rh = pick(MELODY_RHYTHMS[style] || DROP_RHYTHMS), first = rh.filter(s => s < 8).length, restN = rh.length - first;
  let motif = [];
  if(style === 'riff'){ const b = pick([3,4]); motif = Array.from({length:first}, (_,k) => k % 3 === 2 ? b + pick([1,-1,2]) : b); }
  else if(style === 'anthem') motif = Array.from({length:first}, (_,k) => k === 0 ? pick([1,2]) : 3 + Math.round(2*Math.sin(Math.PI*k/first)));
  else if(style === 'cascade'){ const top = pick([5,4]); motif = Array.from({length:first}, (_,k) => top - k); }
  else { let g = pick([3,4]); for(let k=0;k<first;k++){ if(k) g = g + pick([-1,-1,0,1,1,2,-2]); motif.push(g); } }
  motif = motif.map(g => Math.max(0, Math.min(5, g)));
  const tail = Array.from({length:restN}, (_,k) => motif[k % first]);
  const a = motif.concat(tail), b = motif.concat(tail);
  a[a.length-1] = Math.min(5, a[a.length-1] + 1);
  b[b.length-1] = pick([0,1,3]);
  return {rh, a, b, style, len: style === 'floaty' ? 3.5 : null};
}
const COUNTER_SHAPES = [[3,2,1,2],[2,3,4,3],[4,3,2,1],[1,2,3,4],[3,4,3,2]];
function counterLine(song, ints, busy, n){
  const ladder = [0, ints[1], ints[2], 12, 12+ints[1]];
  const shape = song.counterShape || COUNTER_SHAPES[0];
  const spots = [2,6,10,14,4,12,0,8].filter(s => !busy.includes(s) && !busy.includes(s-1)).slice(0, n).sort((a,b) => a-b);
  return spots.map((s,k) => [ladder[shape[k % shape.length]], s]);
}
const VOCAL_RHYTHMS = [
  [[0,6],[6,2],[8,6],[14,2],[16,8],[24,8]],
  [[0,4],[4,4],[8,8],[16,4],[20,2],[22,2],[24,8]],
  [[2,2],[4,6],[10,2],[12,4],[16,6],[22,2],[24,4],[28,4]],
  [[0,8],[8,4],[12,4],[16,3],[19,3],[22,2],[24,8]],
];
const VOWEL_WORDS = [['o','a'],['a'],['e','i'],['a','o'],['u','a'],['i'],['o'],['a','e']];
function makeVocal(max = 4){
  const rh = pick(VOCAL_RHYTHMS);
  const walk = end => { let g = Math.min(max, pick([2,3])); const out = rh.map((_,k) => { if(k) g = Math.max(0, Math.min(max, g + pick([-1,-1,1,1,0,2,-2]))); return g; }); out[out.length-1] = end; return out; };
  const vowels = rh.map(([,len]) => len >= 6 ? pick(VOWEL_WORDS.filter(w => w.length > 1)) : pick(VOWEL_WORDS));
  return {rh, a: walk(Math.min(2, max)), b: walk(0), vowels};
}
function vocalBar(song, i, T, ints, octaveUp = 0, V = null, prog = null){
  V = V || song.vocal;
  const sc = SCALES[song.scale], bar = i % V.bars, root = prog ? rootAtBar(song, prog, i) : null, K = keyOff(song);
  const out = []; let prev = null;
  V.notes.forEach((n, k) => {
    if(n.bar !== bar) return;
    let deg = n.deg;
    if(root !== null && (n.s % 4 === 0 || n.dur >= 3) && !isChordTone(song, deg, root)) deg = nearestChordTone(song, deg, root);
    const m = 60 + K + scaleNote(sc, deg) + octaveUp;
    out.push({s: n.s, len: n.dur, m, vw: V.vowels[k], from: prev}); prev = m;
  });
  return out;
}
// A song is fully determined by its style, seed and reroll counters, so it can be saved, shared and rebuilt exactly
const GATES = [[1,0,1,1,0,1,1,0,1,0,1,1,0,1,1,0],[1,1,0,1,1,0,1,0,1,1,0,1,1,0,1,0],[1,0,1,0,1,1,0,1,1,0,1,0,1,1,0,1],[1,1,1,0,1,1,1,0,1,1,1,0,1,1,1,0]];
const HATS = {offbeat:[2,6,10,14], sixteenths:[...Array(16).keys()], shuffle:[0,2,3,4,6,7,8,10,11,12,14,15], eighths:[0,2,4,6,8,10,12,14]};
const LEAD_NAMES = {lead:'supersaw lead', sqlead:'square lead', pluck:'pluck lead', piano:'piano lead', bell:'bell lead', saws:'chord lead'};
// Each song gets its own sound design and production choices
function makeDNA(style){
  const st = STYLES[style];
  const bassPool = st.bassPool || {bigroom:['bigbass','bigbass','reese'], progressive:['bass','bigbass'], trance:['bass','bass','bigbass'],
                    future:['reese','bigbass','wobble'], dubstep:['wobble','wobble','reese'], dnb:['reese','reese','wobble']}[style] || ['bass'];
  const dna = {
    lead: pick(st.leadPool || ['lead','lead','sqlead','pluck','piano','bell','saws']), dropBass: pick(bassPool),
    arp: pick(['pluck','pluck','pizz','harp','bell']), counter: pick(['bell','harp','piano','pluck']),
    spread: 0.6 + rnd()*0.9, bright: 0.7 + rnd()*0.7, snap: 0.6 + rnd()*0.9, rev: 0.6 + rnd()*0.8,
    delayDiv: pick([3,3,4,2,6]), delFb: 0.25 + rnd()*0.25,
    kit: {kick: 0.8 + rnd()*0.4, decay: 0.8 + rnd()*0.5, clap: 1100 + rnd()*900, hat: 6000 + rnd()*3500, snare: 0.85 + rnd()*0.35},
    hats: pick(st.hatsPool || Object.keys(HATS)), gate: chance(0.5) ? pick(GATES) : null,
    build: pick(['roll','roll','filter','kickroll','vocal']), gap: pick(['beat','beat','half']),
    shout: chance(0.4), stutter: chance(0.5),
  };
  if(st.kit){ const k = dna.kit; k.kick *= st.kit.kick || 1; k.decay *= st.kit.decay || 1; if(st.kit.drive) k.drive = st.kit.drive; }
  return dna;
}
const FORMS = {
  classic:  {label:'classic form', secs:[['intro','Intro',16],['verse','Verse',16],['breakdown','Breakdown',32],['build','Build',8],['drop','Drop',32],
             ['verse','Verse 2',16,{second:true}],['breakdown','Breakdown 2',16,{second:true}],['build','Build 2',8,{second:true,keyUp:true}],['drop','Final drop',32,{second:true,keyUp:true}],['outro','Outro',16,{keyUp:true}]]},
  cold:     {label:'cold-open form', secs:[['breakdown','Opening',16],['build','Build',8],['drop','Drop',32],['verse','Verse',16],
             ['breakdown','Breakdown',32,{second:true}],['build','Build 2',8,{second:true,keyUp:true}],['drop','Final drop',32,{second:true,keyUp:true}],['outro','Outro',16,{keyUp:true}]]},
  extended: {label:'extended mix', secs:[['intro','Intro',16],['verse','Verse',16],['breakdown','Breakdown',32],['build','Build',8],['drop','Main drop',64],
             ['breakdown','Breakdown 2',16,{second:true}],['build','Build 2',8,{second:true,keyUp:true}],['drop','Final drop',32,{second:true,keyUp:true}],['outro','Outro',16,{keyUp:true}]]},
  fakeout:  {label:'fake-out form', secs:[['intro','Intro',16],['verse','Verse',16],['breakdown','Breakdown',32],['build','Build',8],['fake','Fake drop',2],['build','Real build',8],
             ['drop','Drop',32],['bridge','Bridge',16],['build','Build 2',8,{second:true,keyUp:true}],['drop','Final drop',32,{second:true,keyUp:true}],['outro','Outro',16,{keyUp:true}]]},
  radio:    {label:'radio edit', secs:[['intro','Intro',8],['verse','Verse',16],['build','Build',8],['drop','Drop',16],['verse','Verse 2',16,{second:true}],
             ['breakdown','Breakdown',16,{second:true}],['build','Build 2',8,{second:true,keyUp:true}],['drop','Final drop',16,{second:true,keyUp:true}],['outro','Outro',8,{keyUp:true}]]},
};
Object.values(FORMS).forEach(f => { let acc = 0; f.list = f.secs.map(([name,label,bars,opt]) => { const x = Object.assign({name, label, bars, start: acc}, opt || {}); acc += bars; return x; }); f.total = acc; });
const formOf = song => FORMS[song && song.form] || FORMS.classic;
// Each song gets its own section lengths, always in whole 8, 16, 32 or 64-bar blocks (dance music's grid).
// The block is chosen to land nearest a target duration for the song's tempo, with a little freedom.
const SEC_SECONDS = {intro:[22,45], verse:[18,40], breakdown:[28,60], build:[10,22], drop:[30,60], bridge:[18,35], outro:[15,30]};
const SEC_BLOCKS  = {intro:[8,16,32], verse:[8,16,32], breakdown:[16,32], build:[8,16], drop:[16,32,64], bridge:[8,16], outro:[8,16]};
function makeArrangement(song, formKey){
  const f = FORMS[formKey] || FORMS.classic, barsPerSec = song.bpm/240, short = formKey === 'radio';
  return f.secs.map(([name, label, , opt]) => {
    let bars = 2;
    if(name !== 'fake'){
      let [lo, hi] = SEC_SECONDS[name], blocks = SEC_BLOCKS[name];
      if(short){ lo *= 0.6; hi *= 0.6; blocks = blocks.filter(b => b <= 32); }
      if(STYLES[song.style] && STYLES[song.style].band){ lo *= 0.75; hi *= 0.75; }   // band songs run shorter than club tracks
      if(label === 'Final drop' || label === 'Main drop'){ lo *= 1.2; hi *= 1.4; }
      if(label === 'Opening'){ lo = 18; hi = 36; blocks = [8, 16]; }
      const target = (lo + rnd()*(hi - lo))*barsPerSec;
      const ranked = blocks.slice().sort((x, y) => Math.abs(Math.log2(x/target)) - Math.abs(Math.log2(y/target)));
      bars = ranked.length > 1 && chance(0.2) ? ranked[1] : ranked[0];
    }
    if(STYLES[song.style] && STYLES[song.style].band) label = BAND_LABELS[label] || label;
    return Object.assign({name, label, bars}, opt || {});
  });
}
const arrCache = new WeakMap();
function arr(){
  const s = state.song;
  if(!s || !s.arrangement) return formOf(s).list;
  let a = arrCache.get(s.arrangement);
  if(!a){ let at = 0; a = s.arrangement.map(x => { const y = Object.assign({}, x, {start: at}); at += x.bars; return y; }); a.total = at; arrCache.set(s.arrangement, a); }
  return a;
}
const totalBars = () => { const a = arr(); return a.total || formOf(state.song).total; };
function makeSong(style, seed, parts){
  seed = seed || randomSeed(); parts = Object.assign({chords:0, hook:0, bass:0, vocal:0, drums:0, sound:0, form:0}, parts || {});
  const R = tag => seedWith(seed + '|' + tag + '|' + (parts[tag] || 0));
  try{
    R('core');
    style = style && STYLES[style] ? style : pick(Object.keys(STYLES));
    const b = STYLES[style].bpm;
    const song = {style, seed, parts, bpm: b[0] + Math.floor(rnd()*(b[1]-b[0]+1)), key: Math.floor(rnd()*12),
      scale: pick(STYLES[style].scales || ['minor','minor','dorian','major']), title: pick(WORDS1) + ' ' + pick(WORDS2)};
    R('chords'); song.v = COMPOSER_VERSION; song.prog = makeProgression(song.scale);
    Object.assign(song, {bdProg: makeProgression(song.scale, {start: [5, 3, 5, 0], avoid: song.prog}), stab: pick([[2,6,10,14],[0,3,6,10,12],[3,11],[0,6,12],[2,5,10,13]]),
      harmony: pick(['triad','triad','seventh','add9','mixed']), sus: chance(0.35), chordBars: pick([1,1,2])});
    if(STYLES[style].harmony && chance(0.75)) song.harmony = STYLES[style].harmony;
    R('hook');   song.melody = pick(MELODY_STYLES);
    Object.assign(song, {dropHook: composeHook(song), arpShape: pick(ARP_SHAPES), counterShape: pick(COUNTER_SHAPES)});
    R('bass');   Object.assign(song, {riffs: [makeRiff(), makeRiff(), makeRiff()], bassWave: pick(['sawtooth','square']), leadWave: pick(['square','sawtooth']), arpWave: 'pluck'});
    R('vocal');  Object.assign(song, {vocal: composeVocal(song, 'chorus'), verseVocal: composeVocal(song, 'verse')});
    R('sound');  song.dna = makeDNA(style);
    R('form');   song.form = pick(STYLES[style].forms || Object.keys(FORMS)); song.arrangement = makeArrangement(song, song.form);
    return song;
  } finally { rnd = Math.random; }
}
function songCode(song){
  const extra = PART_KEYS.some(k => song.parts && song.parts[k]) ? '.' + PART_KEYS.map(k => ((song.parts[k] || 0) % 36).toString(36)).join('') : '';
  return `${song.style}-${song.seed}${extra}-v${COMPOSER_VERSION}`;
}
function parseCode(code){
  const m = String(code).trim().match(/^([a-z]+)-([A-Z0-9]{4,12})(?:\.([a-z0-9]{5,7}))?(?:-v(\d+))?$/i);
  if(!m || !STYLES[m[1].toLowerCase()]) return null;
  const parts = {}; if(m[3]) PART_KEYS.forEach((k,i) => { if(m[3][i]) parts[k] = parseInt(m[3][i], 36); });
  const song = makeSong(m[1].toLowerCase(), m[2].toUpperCase(), parts);
  song.fromVersion = m[4] ? +m[4] : 1;
  return song;
}
