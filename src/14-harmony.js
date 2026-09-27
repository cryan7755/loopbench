/* ---------- Harmony: functional chord progressions and voice-led voicings ----------
   Chords are chosen by role rather than from a fixed list:
     T  (home)       i/I, III/iii, VI/vi
     PD (departure)  ii, iv/IV
     D  (tension)    v/V, VII/vii
   A Markov table proposes progressions, a score rewards strong root motion, a clear
   return home and shared notes between neighbours, and the best of many is kept.
   Voicings are then chosen so each chord moves as little as possible from the last. */

const COMPOSER_VERSION = 4;
const HARM_FUNC = {0:'T', 2:'T', 5:'T', 1:'PD', 3:'PD', 4:'D', 6:'D'};
// Which chord tends to follow which (scale degrees 0-6), weighted
const CHORD_MOVES = {
  minor: {0:{5:3, 3:3, 6:2, 4:2, 2:1}, 1:{4:3, 6:2, 3:1}, 2:{5:2, 6:2, 3:2}, 3:{4:3, 0:2, 6:2, 5:1, 1:1},
          4:{0:4, 5:2, 3:1}, 5:{6:3, 3:2, 2:2, 4:2, 0:1}, 6:{0:3, 2:2, 5:2, 3:1}},
  major: {0:{4:3, 5:3, 3:3, 1:1}, 1:{4:3, 6:1, 3:1}, 2:{5:3, 3:2}, 3:{4:3, 0:2, 1:1, 5:1},
          4:{0:3, 5:3, 3:1}, 5:{3:3, 4:2, 1:2}, 6:{0:3, 5:1}},
};
const wrap7 = d => ((d % 7) + 7) % 7;
function scaleNote(sc, deg){ return sc[wrap7(deg)] + 12*Math.floor(deg/7); }
function weightedKey(table){
  const e = Object.entries(table), total = e.reduce((a, [, w]) => a + w, 0);
  let r = rnd()*total; for(const [k, w] of e){ r -= w; if(r <= 0) return +k; } return +e[e.length-1][0];
}
// Score a looping 4-chord progression (higher is better)
function progressionScore(prog, sc){
  let s = 0;
  if(HARM_FUNC[prog[0]] === 'T') s += 2;
  if(prog[0] === 0) s += 1;
  const last = prog[prog.length-1];
  if(HARM_FUNC[last] === 'D' || HARM_FUNC[last] === 'PD') s += 2;   // pulls back home when it loops
  if(new Set(prog).size >= 3) s += 1.5; else s -= 10;                      // at least three different chords
  for(let i=0;i<prog.length;i++){
    const a = prog[i], b = prog[(i+1) % prog.length];
    if(a === b){ s -= 10; continue; }
    const mv = wrap7(b - a);
    s += mv === 3 || mv === 4 ? 1.5 : mv === 1 || mv === 6 ? 1 : 0.6;         // 4ths/5ths strongest, then steps, then 3rds
    const tones = d => [d, d+2, d+4].map(wrap7);
    s += 0.3*tones(a).filter(x => tones(b).includes(x)).length;               // shared notes = smooth
    if(scaleNote(sc, a+4) - scaleNote(sc, a) === 6) s -= 2;                   // diminished chords are fragile
  }
  return s;
}
function makeProgression(scaleName, opts = {}){
  const moves = CHORD_MOVES[scaleName === 'major' ? 'major' : 'minor'], sc = SCALES[scaleName] || SCALES.minor;
  let best = null, bestScore = -Infinity;
  for(let k=0;k<48;k++){
    const p = [pick(opts.start || [0,0,0,5,3])];
    while(p.length < 4) p.push(weightedKey(moves[p[p.length-1]]));
    let score = progressionScore(p, sc) + rnd()*1.5;                          // a little freedom among the good ones
    if(opts.avoid && opts.avoid.join() === p.join()) score -= 10;
    if(score > bestScore){ bestScore = score; best = p; }
  }
  return best;
}

// Tonal centre in semitones, unwrapped across the final key change so nothing jumps an octave
const keyOff = song => norm(song.key - (song.keyShift || 0)) + (song.keyShift || 0);

// Voice leading: pick the inversion of each chord that moves least from the previous one
function bestVoicing(pcs, prev){
  const cands = [];
  for(let r=0;r<pcs.length;r++) for(const base of [52, 55, 58, 61, 64]){
    const order = pcs.slice(r).concat(pcs.slice(0, r)), v = [];
    for(const pc of order){ let n = base + ((pc - base) % 12 + 12) % 12; if(v.length) while(n <= v[v.length-1]) n += 12; v.push(n); }
    if(v[0] >= 53 && v[v.length-1] <= 79) cands.push(v);
  }
  if(!prev) return cands.reduce((a, b) => Math.abs(a.reduce((x, y) => x + y, 0)/a.length - 64) <= Math.abs(b.reduce((x, y) => x + y, 0)/b.length - 64) ? a : b);
  const cost = v => { let c = 0; const n = Math.min(v.length, prev.length); for(let i=0;i<n;i++) c += Math.abs(v[i] - prev[i]); return c + 0.5*Math.abs(v[v.length-1] - prev[prev.length-1]) + 3*Math.abs(v.length - prev.length); };
  return cands.reduce((a, b) => cost(a) <= cost(b) ? a : b);
}
const voicingCache = new Map();
function voicingsFor(song, prog){
  const key = [song.key, song.keyShift || 0, song.scale, song.harmony, song.sus, prog.join()].join('|');
  if(voicingCache.has(key)) return voicingCache.get(key);
  const out = []; let prev = null;
  for(let pass=0; pass<2; pass++) for(let u=0; u<prog.length; u++){         // two passes so the loop joins smoothly
    const c = chordAt(song, prog[u]), pcs = [...new Set(c.ext.map(x => ((c.T + x) % 12 + 12) % 12))];
    prev = bestVoicing(pcs, prev); if(pass === 1) out[u] = prev;
  }
  voicingCache.set(key, out);
  return out;
}
// The chord for bar i of a progression, with its voice-led notes
function chordAtPos(song, i, prog, pos){
  prog = prog || song.prog;
  if(pos === undefined) pos = Math.floor(i / (song.chordBars || 1)) % prog.length;
  const c = chordAt(song, prog[pos]);
  return Object.assign(c, {deg: prog[pos], voiced: voicingsFor(song, prog)[pos]});
}
