/* ---------- Harmony: functional chord progressions and voice-led voicings ----------
   Chords are chosen by role rather than from a fixed list:
     T  (home)       i/I, III/iii, VI/vi
     PD (departure)  ii, iv/IV
     D  (tension)    v/V, VII/vii
   A Markov table proposes progressions, a score rewards strong root motion, a clear
   return home and shared notes between neighbours, and the best of many is kept.
   Voicings are then chosen so each chord moves as little as possible from the last. */

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

/* Chords are either a scale degree (a plain diatonic triad) or an object for colour:
     {d, r, q, f, b}  d anchor degree, r root in semitones above the tonic, q quality (M, m, dim, sus4),
                      f function (T, PD, D, SD = secondary dominant), b bass note in semitones above the root */
const QUALITIES = {M:[0,4,7], m:[0,3,7], dim:[0,3,6], sus4:[0,5,7]};
function itemDeg(it){ return typeof it === 'number' ? it : it.d; }
function itemKey(it){ return typeof it === 'number' ? 'd' + it : `${it.d}:${it.r ?? ''}${it.q ?? ''}/${it.b || 0}`; }
function itemRoot(song, it){ return typeof it === 'number' || it.r === undefined ? SCALES[song.scale][wrap7(itemDeg(it))] : it.r; }
function fnOf(it){ return typeof it === 'object' && it.f ? it.f : HARM_FUNC[wrap7(itemDeg(it))]; }
const pcsCache = new Map();
// The chord's notes as pitch classes relative to the tonic
function chordPcsOf(song, it){
  const key = `${song.scale}|${song.harmony}|${song.sus}|${itemKey(it)}`;
  if(!pcsCache.has(key)){ const c = chordAt(song, it), r = itemRoot(song, it); pcsCache.set(key, c.ext.map(x => (r + x) % 12)); }
  return pcsCache.get(key);
}

// How much harmonic colour each genre uses
const HARM_STYLE_DEFAULT = {mixture:0.25, secondary:0.15, dominant:0.4, inversions:0.25};
const HARM_STYLES = {
  trance:{mixture:0.3, secondary:0.1, dominant:0.45, inversions:0.25}, progressive:{mixture:0.25, secondary:0.1, dominant:0.35, inversions:0.3},
  bigroom:{mixture:0.2, secondary:0.05, dominant:0.3, inversions:0.1}, future:{mixture:0.35, secondary:0.2, dominant:0.3, inversions:0.35},
  dubstep:{mixture:0.3, secondary:0.1, dominant:0.35, inversions:0.2}, dnb:{mixture:0.3, secondary:0.15, dominant:0.35, inversions:0.25},
  techno:{mixture:0.15, secondary:0, dominant:0.15, inversions:0}, techhouse:{mixture:0.15, secondary:0.05, dominant:0.15, inversions:0.1},
  deephouse:{mixture:0.3, secondary:0.35, dominant:0.4, inversions:0.3}, psytrance:{mixture:0.2, secondary:0, dominant:0.3, inversions:0},
  hardstyle:{mixture:0.3, secondary:0.05, dominant:0.5, inversions:0.1}, synthwave:{mixture:0.35, secondary:0.1, dominant:0.25, inversions:0.25},
  ukg:{mixture:0.3, secondary:0.35, dominant:0.4, inversions:0.3}, trap:{mixture:0.2, secondary:0.05, dominant:0.4, inversions:0.1},
  eurodance:{mixture:0.25, secondary:0.1, dominant:0.5, inversions:0.25}, rock:{mixture:0.5, secondary:0.15, dominant:0.35, inversions:0.25},
  pop:{mixture:0.3, secondary:0.3, dominant:0.7, inversions:0.45}, dancepop:{mixture:0.3, secondary:0.2, dominant:0.5, inversions:0.3},
  altrock:{mixture:0.45, secondary:0.1, dominant:0.25, inversions:0.25}, metal:{mixture:0.4, secondary:0.05, dominant:0.6, inversions:0.1},
};
const harmStyle = song => HARM_STYLES[song.style] || HARM_STYLE_DEFAULT;

// Score a looping 4-chord progression for its job in the song (higher is better)
const ROLE_STARTS = {verse:[0,0,0,5], pre:[3,3,1,5,3], chorus:[0,0,5,3,0], bridge:[5,3,1,5]};
function progressionScore(prog, sc, role = 'chorus', next){
  let s = 0;
  const f = k => HARM_FUNC[wrap7(prog[k])], last = prog.length - 1;
  if(role === 'pre'){ if(f(0) === 'PD') s += 2; if(f(last) === 'D') s += 4; if(prog[last] === 0) s -= 5; }
  else if(role === 'bridge'){ if(prog[0] !== 0) s += 2; if(f(last) === 'D' || f(last) === 'PD') s += 2; }
  else { if(f(0) === 'T') s += 2; if(prog[0] === 0) s += 1; if(f(last) === 'D' || f(last) === 'PD') s += 2; }
  if(next !== undefined && f(last) === 'D' && wrap7(itemDeg(next)) === 0) s += 2;     // tension that resolves into what follows
  if(new Set(prog).size >= 3) s += 1.5; else s -= 10;
  for(let i=0;i<prog.length;i++){
    const a = prog[i], b = prog[(i+1) % prog.length];
    if(a === b){ s -= 10; continue; }
    const mv = wrap7(b - a);
    s += mv === 3 || mv === 4 ? 1.5 : mv === 1 || mv === 6 ? 1 : 0.6;
    const tones = d => [d, d+2, d+4].map(wrap7);
    s += 0.3*tones(a).filter(x => tones(b).includes(x)).length;
    if(scaleNote(sc, a+4) - scaleNote(sc, a) === 6) s -= 2;
  }
  return s;
}
// Add colour to a diatonic progression: the strong dominant, a borrowed chord, a secondary dominant
function colourProgression(song, prog, role, next){
  const H = harmStyle(song), sc = SCALES[song.scale], major = song.scale === 'major', out = prog.slice();
  // a colour change is kept only if the loop still has three different roots and no root repeats back to back
  const varied = p => { const r = p.map(it => itemRoot(song, it)); return new Set(r).size >= 3 && r.every((x, i) => x !== r[(i + 1) % r.length]); };
  const tryChange = (i, it) => { const was = out[i]; out[i] = it; if(!varied(out)){ out[i] = was; return false; } return true; };
  const nextOf = i => i < out.length - 1 ? out[i+1] : (next !== undefined ? next : out[0]);
  if(!major) out.forEach((it, i) => {                                      // harmonic-minor V where it resolves home
    if(it === 4 && wrap7(itemDeg(nextOf(i))) === 0 && chance(H.dominant)) out[i] = {d:4, r:7, q:'M', f:'D'};
  });
  if(chance(H.mixture)){                                                   // one borrowed chord from the parallel mode
    const opts = major ? [[3, {d:3, r:5, q:'m', f:'PD'}], [5, {d:5, r:8, q:'M', f:'PD'}], [4, {d:6, r:10, q:'M', f:'D'}], [6, {d:6, r:10, q:'M', f:'D'}]]
      : song.scale === 'phrygian' ? [[3, {d:1, r:1, q:'M', f:'PD'}], [1, {d:1, r:1, q:'M', f:'PD'}]]
      : [[3, {d:3, r:5, q:'M', f:'PD'}]];
    const cand = opts.filter(([deg]) => out.some((x, i) => x === deg && !(i === 0 && role === 'chorus')));
    if(cand.length){ const [deg, it] = pick(cand); const idx = out.findIndex((x, i) => x === deg && !(i === 0 && role === 'chorus')); tryChange(idx, Object.assign({}, it)); }
  }
  if(chance(H.secondary)){                                                 // the chord before a target becomes its own V
    for(let i=1;i<out.length;i++){
      const t = out[i];
      if(typeof t !== 'number' || t === 0 || scaleNote(sc, t+4) - scaleNote(sc, t) === 6) continue;
      if(i - 1 === 0 && (role === 'chorus' || role === 'verse')) continue;
      if(tryChange(i - 1, {d: wrap7(t + 4), r: (sc[t] + 7) % 12, q:'M', f:'SD', to: t})) break;
    }
  }
  return out;
}
// Inversions: put the chord's third in the bass where it makes the bassline step instead of leap
function invertProgression(song, prog, role){
  const H = harmStyle(song);
  if(!H.inversions) return prog;
  const out = prog.slice(); let prevBass = itemRoot(song, out[0]);
  for(let i=1;i<out.length;i++){
    const it = out[i], root = itemRoot(song, it), c = chordAt(song, it), third = (root + c.ints[1]) % 12;
    const cadence = fnOf(it) === 'D' && (i === out.length - 1 || wrap7(itemDeg(out[i+1] ?? 0)) === 0);
    const dist = pc => { const d = Math.abs(pc - prevBass) % 12; return Math.min(d, 12 - d); };
    if(!cadence && chance(H.inversions) && dist(third) < dist(root) && dist(third) <= 2){
      out[i] = Object.assign(typeof it === 'number' ? {d: it} : Object.assign({}, it), {b: c.ints[1]});
      prevBass = third;
    } else prevBass = root;
  }
  return out;
}
function makeProgression(song, role = 'chorus', opts = {}){
  const sc = SCALES[song.scale] || SCALES.minor, moves = CHORD_MOVES[song.scale === 'major' ? 'major' : 'minor'];
  let best = null, bestScore = -Infinity;
  for(let k=0;k<60;k++){
    const p = [pick(opts.start || ROLE_STARTS[role])];
    while(p.length < 4) p.push(weightedKey(moves[p[p.length-1]]));
    let score = progressionScore(p, sc, role, opts.next) + rnd()*1.5;
    if(opts.avoid && opts.avoid.map(itemDeg).join() === p.join()) score -= 10;
    if(score > bestScore){ bestScore = score; best = p; }
  }
  return invertProgression(song, colourProgression(song, best, role, opts.next), role);
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
  const key = [song.key, song.keyShift || 0, song.scale, song.harmony, song.sus, JSON.stringify(prog)].join('|');
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
  return Object.assign(c, {deg: itemDeg(prog[pos]), item: prog[pos], voiced: voicingsFor(song, prog)[pos]});
}
