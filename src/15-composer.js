/* ---------- Composer: melodies written as phrases, generated many times and ranked ----------
   A melody covers one full pass of the chord progression and takes one of two classic shapes:
     sentence  idea, idea again (moved to fit the next chord), a longer continuation, cadence
     period    question (ends open), answer (starts the same, ends at home)
   Notes are chosen by scale degree, with chord tones on strong beats and passing notes between.
   Each melody is written many times and scored on rules from music-cognition research
   (leaps resolve, a single well-placed peak, singable range, stepwise motion, a firm ending,
   and a middle amount of predictability). The best-scoring version is kept. */

// Degree offsets (from the chord root) that belong to the chord, matching chordAt()
function chordDegrees(song, root){
  const third = song.sus && (root === 4 || root === 6) ? 3 : 2, out = [0, third, 4], h = song.harmony;
  if(h === 'seventh' || (h === 'mixed' && root % 2)) out.push(6);
  if(h === 'add9' || (h === 'mixed' && !(root % 2))) out.push(1);
  return out;
}
const isChordTone = (song, deg, root) => chordDegrees(song, root).includes(wrap7(deg - root));
function nearestChordTone(song, deg, root, lo = -99, hi = 99){
  for(let d=0; d<7; d++) for(const c of [deg - d, deg + d]) if(c >= lo && c <= hi && isChordTone(song, c, root)) return c;
  return deg;
}
const rootAtBar = (song, prog, bar) => prog[Math.floor(bar / (song.chordBars || 1)) % prog.length];

const cellFrom = (onsets, maxLen = 4) => onsets.map((s, k) => [s, Math.max(1, Math.min(maxLen, (k + 1 < onsets.length ? onsets[k+1] : 16) - s))]);
const HOOK_CADENCES = [[[0,2],[3,3],[6,2],[8,8]], [[0,3],[3,3],[6,10]], [[0,2],[2,2],[4,4],[8,8]], [[0,3],[3,3],[6,2],[8,4],[12,4]]];
const VOCAL_CELLS = [[[0,6],[6,2],[8,6]], [[0,4],[4,4],[8,6],[14,2]], [[0,8],[8,4],[12,4]], [[2,2],[4,6],[10,2],[12,4]],
                     [[0,3],[3,3],[6,2],[8,8]], [[0,6],[8,6]], [[4,4],[8,4],[12,4]]];
const VOCAL_CADENCES = [[[0,4],[4,12]], [[0,2],[2,2],[4,12]], [[0,16]], [[0,6],[8,8]]];

function writeLine(song, o){
  const prog = o.prog, U = prog.length, bpu = song.chordBars || 1, form = pick(['sentence', 'period']);
  // Hooks repeat one rhythm every bar so they lock to the groove; pitch carries the variation.
  // The question ending (period) and the final cadence reuse the motif, then hold a long note.
  const A = pick(o.cells), hold = (cell, at) => cell.filter(([s]) => s < at).concat([[at, 16 - at]]);
  const E = o.motifCadence ? hold(A, 8) : pick(o.cadences), B = o.motifCadence ? hold(A, 12) : pick(o.cells), tail = A;
  const plan = form === 'sentence' ? [A, A, A, E] : [A, B, A, E];
  const notes = [], unitStart = [];
  const sc = SCALES[song.scale];
  let prev = pick(o.start), prevInt = 0, run = 0, top = -99, bottom = 99;
  const fits = d => { const p = scaleNote(sc, d); return Math.max(top, p) - Math.min(bottom, p) <= o.maxSpan; };   // keep the whole line within range
  const toneNear = (target, root) => { for(let d=0; d<8; d++) for(const c of [target - d, target + d]) if(c >= o.lo && c <= o.hi && isChordTone(song, c, root) && fits(c)) return c; return nearestChordTone(song, target, root, o.lo, o.hi); };
  const place = (bar, s, dur, deg) => { notes.push({bar, s, dur, deg}); const p = scaleNote(sc, deg); top = Math.max(top, p); bottom = Math.min(bottom, p); prevInt = deg - prev; run = deg === prev ? run + 1 : 0; prev = deg; };
  for(let u=0; u<U; u++){
    const root = prog[u];
    for(let b=0; b<bpu; b++){
      const bar = u*bpu + b, lastBar = u === U-1 && b === bpu-1;
      const copyFrom = b === 0 && ((form === 'sentence' && u === 1) || (form === 'period' && u === 2)) ? 0 : -1;
      if(b === 0) unitStart[u] = notes.length;
      if(copyFrom >= 0){
        // repeat the opening idea: moved by the chord change in a sentence, exact in a period
        let shift = form === 'sentence' ? wrap7(root - prog[0]) : 0; if(shift > 3) shift -= 7;
        const src = notes.slice(unitStart[0], unitStart[1]).filter(n => n.bar === 0);
        for(const n of src){
          let deg = Math.max(o.lo, Math.min(o.hi, n.deg + shift));
          if((n.s % 4 === 0 && !isChordTone(song, deg, root)) || !fits(deg)) deg = n.s % 4 === 0 ? toneNear(deg, root) : (fits(deg) ? deg : toneNear(n.deg, root));
          place(bar, n.s, n.dur, deg);
        }
        continue;
      }
      const cell = b === 0 ? plan[Math.min(u, 3)] : tail;
      cell.forEach(([s, dur], k) => {
        const strong = s % 4 === 0 || dur >= 3, final = lastBar && k === cell.length - 1;
        if(final){
          // cadence: a long, stable note that belongs to the chord underneath, preferring the home chord's notes
          const homes = []; for(let d=o.lo; d<=o.hi; d++) if(isChordTone(song, d, root) && fits(d)) homes.push({d, home: [0, 2, 4].includes(wrap7(d)) ? 0 : 3, tonic: wrap7(d) === 0 ? 0 : 1});
          homes.sort((a, b) => (a.home + a.tonic + Math.abs(a.d - prev)*0.6) - (b.home + b.tonic + Math.abs(b.d - prev)*0.6));
          place(bar, s, Math.max(dur, 4), homes.length ? homes[0].d : toneNear(prev, root));
          return;
        }
        const cands = [], weights = [];
        for(let d=o.lo; d<=o.hi; d++){
          const iv = d - prev, a = Math.abs(iv);
          if(a > o.maxLeap || !fits(d)) continue;
          let w = a === 0 ? (run >= 2 ? 0.1 : o.repeat) : a === 1 ? 4 : a === 2 ? 2.2 : a === 3 ? 1 : a === 4 ? 0.7 : 0.25;
          if(Math.abs(prevInt) >= 3){ if(Math.sign(iv) === Math.sign(prevInt)) w *= 0.1; else if(a <= 2) w *= 3; }   // gap-fill after a leap
          const tone = isChordTone(song, d, root);
          if(strong && !tone) w = 0; else if(!strong && tone) w *= 0.9;
          if(w > 0){ cands.push(d); weights.push(w); }
        }
        if(!cands.length){ place(bar, s, dur, strong ? toneNear(prev, root) : prev); return; }
        let r = rnd()*weights.reduce((x, y) => x + y, 0), pickD = cands[0];
        for(let i=0;i<cands.length;i++){ r -= weights[i]; if(r <= 0){ pickD = cands[i]; break; } }
        place(bar, s, dur, pickD);
      });
    }
  }
  return {form, notes, bars: U*bpu};
}

// The critic: how well-formed is this melody? Also used by the test suite.
function scoreLine(song, line, o){
  const sc = SCALES[song.scale], notes = line.notes, P = n => scaleNote(sc, n.deg), prog = o.prog;
  if(notes.length < 4) return -99;
  const detail = {};
  const strong = notes.filter(n => n.s % 4 === 0 || n.dur >= 3);
  detail.chordTones = strong.filter(n => isChordTone(song, n.deg, rootAtBar(song, prog, n.bar))).length / Math.max(1, strong.length);
  let leaps = 0, resolved = 0, bad = 0;
  for(let i=0;i<notes.length-1;i++){
    const iv = P(notes[i+1]) - P(notes[i]);
    if(Math.abs(iv) > 9) bad += 1; if(Math.abs(iv) === 6) bad += 1;
    if(Math.abs(iv) >= 5){ leaps++; const nx = i + 2 < notes.length ? P(notes[i+2]) - P(notes[i+1]) : 0; if(Math.sign(nx) === -Math.sign(iv) && Math.abs(nx) <= 3) resolved++; }
  }
  detail.leapsResolved = leaps ? resolved / leaps : 1;
  const ps = notes.map(P), top = Math.max(...ps), low = Math.min(...ps), total = line.bars*16;
  const peakAt = notes[ps.indexOf(top)], peakPos = (peakAt.bar*16 + peakAt.s) / total;
  detail.singlePeak = ps.filter(p => p === top).length === 1;
  detail.peakPlacement = peakPos >= 0.4 && peakPos <= 0.85;
  detail.span = top - low;
  const last = notes[notes.length-1];
  detail.endsHome = [0, 2, 4].includes(wrap7(last.deg)) && isChordTone(song, last.deg, rootAtBar(song, prog, last.bar));
  let steps = 0; const ivs = {};
  for(let i=1;i<notes.length;i++){ const d = notes[i].deg - notes[i-1].deg; if(Math.abs(d) === 1) steps++; ivs[d] = (ivs[d] || 0) + 1; }
  detail.stepwise = steps / (notes.length - 1);
  const counts = Object.values(ivs), n = notes.length - 1;
  detail.predictability = 1 - counts.reduce((h, c) => h - (c/n)*Math.log2(c/n), 0) / Math.log2(Math.max(2, Math.min(n, 9)));
  let score = 4*detail.chordTones + 3*detail.leapsResolved - 2.5*bad;
  score += (detail.singlePeak ? 1.5 : 0) + (detail.peakPlacement ? 1.5 : 0);
  score -= Math.max(0, detail.span - o.maxSpan)*0.6 + (detail.span < 5 ? 1.5 : 0);
  score += (detail.endsHome ? 2 : 0) + (last.dur >= 3 ? 0.5 : 0);
  score += 2 - Math.abs(detail.stepwise - o.stepTarget)*5;
  score += 2 - Math.abs(detail.predictability - o.predictTarget)*5;           // the "not too boring, not too random" sweet spot
  if(o.centre !== undefined) score -= Math.abs(notes.reduce((a, n) => a + n.deg, 0)/notes.length - o.centre)*1.5;
  return Object.assign(detail, {score});
}
function composeBest(song, o, tries = 60){
  let best = null;
  for(let k=0;k<tries;k++){
    const line = writeLine(song, o), rating = scoreLine(song, line, o);
    if(!best || rating.score > best.rating.score) best = {line, rating};
  }
  return Object.assign(best.line, {rating: best.rating});
}

const HOOK_SETTINGS = {
  walk:    {stepTarget:0.65, predictTarget:0.45, repeat:1.2},
  riff:    {stepTarget:0.35, predictTarget:0.65, repeat:3},
  anthem:  {stepTarget:0.5,  predictTarget:0.4,  repeat:0.8},
  cascade: {stepTarget:0.75, predictTarget:0.55, repeat:0.8},
  offbeat: {stepTarget:0.6,  predictTarget:0.45, repeat:1.2},
  floaty:  {stepTarget:0.7,  predictTarget:0.4,  repeat:0.8},
};
function hookOptions(song){
  const style = song.melody || 'walk', rhythms = MELODY_RHYTHMS[style] || DROP_RHYTHMS;
  return Object.assign({prog: song.prog, cells: rhythms.map(r => cellFrom(r, style === 'floaty' ? 6 : 4)), cadences: HOOK_CADENCES,
    lo: -2, hi: 9, start: [2, 4, 7], maxLeap: style === 'anthem' ? 5 : 4, maxSpan: style === 'anthem' ? 15 : 13, motifCadence: true}, HOOK_SETTINGS[style]);
}
function vocalOptions(song, part){
  const cell = pick(VOCAL_CELLS);   // one rhythm per vocal line, like a sung melody's repeating phrase
  return {prog: song.prog, cells: [cell], cadences: VOCAL_CADENCES, lo: part === 'verse' ? -3 : 1, hi: part === 'verse' ? 3 : 8,
    start: part === 'verse' ? [0, 2] : [2, 4], centre: part === 'verse' ? 0 : 4.5, maxLeap: 4, maxSpan: part === 'verse' ? 9 : 12, stepTarget: 0.7, predictTarget: 0.45, repeat: 1.5};
}
function composeHook(song){ return Object.assign(composeBest(song, hookOptions(song)), {v: COMPOSER_VERSION, style: song.melody}); }
function composeVocal(song, part){
  const line = composeBest(song, vocalOptions(song, part));
  line.vowels = line.notes.map(n => n.dur >= 6 ? pick(VOWEL_WORDS.filter(w => w.length > 1)) : pick(VOWEL_WORDS));
  return Object.assign(line, {v: COMPOSER_VERSION, part});
}

// The hook's notes for one bar: [row relative to the key, step, length in steps].
// Played over a different progression (breakdowns, bridges), strong notes are moved onto that chord.
function hookBar(song, i, prog){
  const H = song.dropHook, sc = SCALES[song.scale], bar = i % H.bars;
  const root = prog ? rootAtBar(song, prog, i) : null;
  return H.notes.filter(n => n.bar === bar).map(n => {
    let deg = n.deg;
    if(root !== null && (n.s % 4 === 0 || n.dur >= 3) && !isChordTone(song, deg, root)) deg = nearestChordTone(song, deg, root);
    return [scaleNote(sc, deg), n.s, n.dur];
  });
}
