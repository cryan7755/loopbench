/* ---------- Percussion: each genre's own hand percussion and shakers ----------
   Three drum channels carry the percussion layer, and each genre decides what they sound like:
     shaker  shaker, tambourine or cabasa
     rim     a click: rim, claves, woodblock, ride or cowbell
     bell    hand percussion: bongos, congas, tambourine, agogo, ride or cowbell
   Each has a pool of genre-appropriate patterns. A bar keeps its pattern through a phrase and varies
   at phrase ends (an extra hit or a short roll), so the groove moves without losing its shape.
   Drum & bass keeps its original percussion, which already works this way. */

// Sounds: recorded percussion (General MIDI note numbers) and kit pieces used as percussion
const PERC_SOUNDS = {
  bongo_hi:{bank:'perc', m:60}, bongo_lo:{bank:'perc', m:61}, conga_mute:{bank:'perc', m:62}, conga_hi:{bank:'perc', m:63},
  conga_open:{bank:'perc', m:64}, conga_lo:{bank:'perc', m:65}, tamb:{bank:'perc', m:54}, claves:{bank:'perc', m:75},
  woodblock:{bank:'perc', m:76}, agogo_hi:{bank:'perc', m:67}, agogo_lo:{bank:'perc', m:68}, cabasa:{bank:'perc', m:69},
  ride:{bank:'rockkit', m:51}, cowbell:{bank:'kit', m:56}, shaker:{bank:'kit', m:70},
};
// Patterns as [step, sound] lists; a pool per style of playing
const PERC_PATTERNS = {
  bongo:     [[[2,'bongo_hi'],[3,'bongo_lo'],[6,'bongo_hi'],[10,'bongo_hi'],[11,'bongo_lo'],[14,'bongo_lo']],
              [[1,'bongo_hi'],[3,'bongo_hi'],[6,'bongo_lo'],[9,'bongo_hi'],[11,'bongo_hi'],[14,'bongo_lo']],
              [[2,'bongo_hi'],[5,'bongo_lo'],[7,'bongo_hi'],[10,'bongo_hi'],[13,'bongo_lo'],[15,'bongo_hi']]],
  conga:     [[[2,'conga_mute'],[3,'conga_mute'],[6,'conga_open'],[7,'conga_open'],[10,'conga_mute'],[14,'conga_open'],[15,'conga_lo']],
              [[0,'conga_mute'],[4,'conga_hi'],[6,'conga_open'],[7,'conga_open'],[12,'conga_hi'],[14,'conga_open'],[15,'conga_open']],
              [[3,'conga_hi'],[6,'conga_open'],[7,'conga_open'],[11,'conga_hi'],[14,'conga_lo'],[15,'conga_lo']]],
  tambOff:   [[[2,'tamb'],[6,'tamb'],[10,'tamb'],[14,'tamb']], [[2,'tamb'],[6,'tamb'],[10,'tamb'],[13,'tamb'],[14,'tamb']]],
  tambBack:  [[[4,'tamb'],[12,'tamb']], [[4,'tamb'],[12,'tamb'],[15,'tamb']]],
  tamb8:     [[[0,'tamb'],[2,'tamb'],[4,'tamb'],[6,'tamb'],[8,'tamb'],[10,'tamb'],[12,'tamb'],[14,'tamb']]],
  rideOff:   [[[2,'ride'],[6,'ride'],[10,'ride'],[14,'ride']], [[0,'ride'],[2,'ride'],[6,'ride'],[10,'ride'],[14,'ride']]],
  ride8:     [[[0,'ride'],[2,'ride'],[4,'ride'],[6,'ride'],[8,'ride'],[10,'ride'],[12,'ride'],[14,'ride']]],
  clave:     [[[0,'claves'],[3,'claves'],[6,'claves'],[10,'claves'],[12,'claves']], [[2,'claves'],[4,'claves'],[8,'claves'],[11,'claves'],[14,'claves']]],
  clickSparse:[[[3,'claves'],[11,'claves']], [[7,'claves'],[15,'claves']], [[3,'claves'],[10,'claves'],[14,'claves']]],
  wood:      [[[3,'woodblock'],[11,'woodblock']], [[7,'woodblock'],[14,'woodblock']], [[3,'woodblock'],[6,'woodblock'],[14,'woodblock']]],
  rimTechno: [[[3,'rim'],[7,'rim'],[11,'rim'],[15,'rim']], [[3,'rim'],[11,'rim'],[14,'rim']], [[6,'rim'],[14,'rim']]],
  rimSync:   [[[3,'rim'],[10,'rim']], [[3,'rim'],[6,'rim'],[11,'rim'],[14,'rim']], [[7,'rim'],[15,'rim']]],
  agogo:     [[[0,'agogo_hi'],[3,'agogo_lo'],[6,'agogo_hi'],[8,'agogo_hi'],[11,'agogo_lo'],[14,'agogo_hi']]],
  cowbellOff:[[[2,'cowbell'],[6,'cowbell'],[10,'cowbell'],[14,'cowbell']], [[6,'cowbell'],[14,'cowbell']]],
};
// Shaker feels: step lists
const SHAKE = {sixteen:[...Array(16).keys()], eighths:[0,2,4,6,8,10,12,14], offbeat:[2,6,10,14], swing:[0,2,3,4,6,7,8,10,11,12,14,15], backbeat:[4,12]};

/* Genre characters. hand/click: pattern pool names by section; shaker: {sound, feel}.
   'from' is the first bar of a section the layer joins at (0 = from the start). */
const PERC_CHARACTER = {
  techhouse:  {shaker:{sound:'shaker', feel:'sixteen'}, hand:'bongo', click:'clickSparse'},
  deephouse:  {shaker:{sound:'shaker', feel:'swing'}, hand:'conga', click:'clave'},
  progressive:{shaker:{sound:'shaker', feel:'eighths'}, hand:'tambOff', click:'rimSync'},
  bigroom:    {shaker:null, hand:'tambBack', click:'rimSync'},
  trance:     {shaker:{sound:'shaker', feel:'offbeat'}, hand:'rideOff', click:null},
  eurodance:  {shaker:{sound:'shaker', feel:'eighths'}, hand:'tambOff', click:'cowbellOff'},
  techno:     {shaker:{sound:'shaker', feel:'sixteen'}, hand:'rideOff', click:'rimTechno'},
  psytrance:  {shaker:{sound:'shaker', feel:'sixteen'}, hand:null, click:'rimTechno'},
  hardstyle:  {shaker:null, hand:'rideOff', click:null},
  future:     {shaker:{sound:'shaker', feel:'eighths'}, hand:null, click:'wood'},
  dubstep:    {shaker:{sound:'cabasa', feel:'eighths'}, hand:null, click:'wood'},
  trap:       {shaker:null, hand:null, click:'wood'},
  ukg:        {shaker:{sound:'shaker', feel:'swing'}, hand:'tambOff', click:'rimSync'},
  synthwave:  {shaker:{sound:'tamb', feel:'backbeat'}, hand:null, click:'clickSparse'},
  pop:        {shaker:{sound:'shaker', feel:'eighths'}, hand:'tambOff', click:null},
  dancepop:   {shaker:{sound:'tamb', feel:'offbeat'}, hand:'conga', click:'clave'},
  rock:       {shaker:null, hand:'tamb8', click:null, chorusOnly:true},
  altrock:    {shaker:null, hand:'tambBack', click:null, chorusOnly:true},
  metal:      {shaker:null, hand:null, click:null},
  // dnb: not listed, keeps its original percussion
};

// The percussion for one bar: drum rows plus the sound of each hit
function percussionFor(song, phase, i, bars){
  const C = PERC_CHARACTER[song.style]; if(!C) return null;
  const out = {shaker: [], rim: [], bell: [], voices: {shaker: {}, rim: {}, bell: {}}};
  const quiet = phase === 'breakdown' || phase === 'build' || phase === 'fake' || (phase === 'intro' && i < (bars || 16)/2);
  const main = phase === 'drop' || phase === 'bridge';
  const phraseEnd = (i % 4) === 3, bigEnd = (i % 8) === 7 || i === (bars || 16) - 1;
  // one pattern per four-bar phrase, chosen from the pool, so the groove holds and then moves on
  const choose = (pool, salt) => { const list = PERC_PATTERNS[pool]; return list[(Math.floor(i/4) + salt) % list.length]; };
  const place = (ch, hits) => hits.forEach(([s, snd]) => { out[ch].push(s); out.voices[ch][s] = snd; });
  const outroTail = phase === 'outro' && i >= (bars || 16)/2;
  if(C.shaker && !quiet && !outroTail && (main || phase === 'verse' || phase === 'outro' || phase === 'intro')){
    const steps = SHAKE[C.shaker.feel];
    place('shaker', steps.map(s => [s, C.shaker.sound]));
  }
  if(C.hand && !quiet && !outroTail && (main || (!C.chorusOnly && (phase === 'verse' ? i >= (bars || 16)/2 : true)))){
    let hits = choose(C.hand, song.seed.charCodeAt(0) % 3).slice();
    if(phraseEnd && !bigEnd) hits = hits.concat([[15, hits[hits.length - 1][1]]]);                  // a pickup into the next bar
    if(bigEnd && hits.length) hits = hits.filter(([s]) => s < 12).concat([[12, hits[0][1]], [13, hits[0][1]], [14, hits[hits.length-1][1]], [15, hits[hits.length-1][1]]]);   // a short roll at the phrase end
    place('bell', hits);
  }
  if(C.click && !quiet && (main || phase === 'verse')){
    place('rim', choose(C.click, song.seed.charCodeAt(1) % 3));
  }
  for(const ch of ['shaker', 'rim', 'bell']) out[ch] = [...new Set(out[ch])].sort((a, b) => a - b);
  return out;
}
// Which recorded sound plays a percussion hit, if the genre has a character for it
function percSound(p, id, s){
  const v = p && p.percVoice && p.percVoice[id] && p.percVoice[id][s];
  const snd = v && PERC_SOUNDS[v]; if(!snd || !sampleBufs[snd.bank]) return null;
  const z = sampleBufs[snd.bank].find(z => z.m === snd.m);
  return z ? z.buf : null;
}
function percNote(p, id, s){ const v = p && p.percVoice && p.percVoice[id] && p.percVoice[id][s]; return v && PERC_SOUNDS[v] ? PERC_SOUNDS[v].m : null; }
// The genre's usual sound for a channel, for hits added later (by the energy shaper or the editor)
function percDefault(id){
  const C = state.song && PERC_CHARACTER[state.song.style]; if(!C) return null;
  const name = id === 'shaker' ? C.shaker && C.shaker.sound : id === 'rim' ? C.click && PERC_PATTERNS[C.click][0][0][1] : id === 'bell' ? C.hand && PERC_PATTERNS[C.hand][0][0][1] : null;
  const snd = name && PERC_SOUNDS[name]; if(!snd || !sampleBufs[snd.bank]) return null;
  const z = sampleBufs[snd.bank].find(z => z.m === snd.m); return z ? z.buf : null;
}
