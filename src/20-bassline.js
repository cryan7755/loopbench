/* ---------- Bass lines and counterpoint ----------
   The bass and the main melody are the outer voices; how they move against each other shapes how
   "composed" music sounds. At each chord change:
     - approach notes: the bass leads into the next chord by step, from a scale note (or, in some
       genres, a chromatic note) next to the new bass note, instead of simply jumping to it
     - contrary motion: the bass picks the octave of its new note that moves against the melody,
       which also avoids parallel octaves and fifths between the outer voices
   Only the bass's pitches change; its rhythm, and everything else, stays as generated. */

const BASS_MOTION = {pop:'chromatic', rock:'diatonic', altrock:'diatonic', dancepop:'chromatic', deephouse:'chromatic', ukg:'chromatic',
  synthwave:'diatonic', trance:'diatonic', progressive:'diatonic', future:'diatonic', eurodance:'diatonic', dnb:'diatonic', dubstep:'diatonic',
  bigroom:'diatonic', trap:'diatonic', metal:'none', techno:'none', psytrance:'none', hardstyle:'none', techhouse:'none'};

// The chord (its root offset T and bass offset) sounding in bar n, following each section's progression
function chordForBar(song, n){
  const loc = locate(n); if(!loc) return null;
  const {sec, i} = loc, s = sec.keyUp ? keyedSong(song) : song;
  const prog = sec.name === 'drop' || sec.name === 'fake' ? s.prog : sec.name === 'build' ? s.preProg || s.prog
    : sec.name === 'breakdown' || sec.name === 'bridge' ? s.bdProg : s.verseProg || s.prog;
  if(sec.name === 'outro' && i === sec.bars - 1) return chordAtPos(s, 0, [0], 0);
  if(sec.name === 'build' && i >= sec.bars - 2) return chordAtPos(s, i, prog, prog.length - 1);
  return chordAtPos(s, i, prog);
}
// Bass notes of a bar as [absolute pitch, step]
function bassEvents(p){
  const S = p.synth; if(!S || !p.notes) return [];
  const out = []; for(let s=0; s<STEPS; s++) for(let r=0; r<ROWS; r++) if(p.notes[r][s]) out.push([12*(S.octave + 1) + r + (S.transpose || 0), s, r]);
  return out;
}
function mainMelody(p){ const P = ensembleParts(p); return P.vocal.length ? P.vocal : P.lead; }
const melodyAt = (mel, s) => { const x = mel.filter(([, st, d]) => st <= s && s < st + d); return x.length ? x[x.length - 1][0] : null; };

function shapeBass(p, song, n){
  if(!p || !p.synth || !p.notes || p.bassAbs || !state.song) return p;
  const mode = BASS_MOTION[song.style] || 'diatonic';
  if(mode === 'none') return p;
  const ev = bassEvents(p); if(!ev.length) return p;
  const loc = locate(n), ks = loc && loc.sec.keyUp ? keyedSong(song) : song;
  const T = p.synth.transpose || 0, sc = SCALES[song.scale], K = keyOff(ks);
  // 1. approach note: the last bass note of the bar steps into the next chord's bass note
  const next = chordForBar(song, n + 1), last = ev[ev.length - 1];
  if(next && last[1] >= 10 && ((next.T - T) % 12 + 12) % 12 !== 0){
    const target = (((next.T + (next.bass || 0)) - T) % 12 + 12) % 12;          // next bass note, in this bar's rows
    const inKey = r => sc.includes((((T + r) - K) % 12 + 12) % 12);
    const melNow = melodyAt(mainMelody(p), last[1]), base = 12*(p.synth.octave + 1) + T;
    const clashes = r => melNow !== null && [1, 11].includes(Math.abs(melNow - (base + r)) % 12);   // no semitone rub with the melody
    const opts = [target - 2, target - 1, target + 1, target + 2].map(r => (r + 12) % 12).filter(r => r !== 0 && !clashes(r));
    const pickRow = opts.find(r => inKey(r) && Math.abs(((r - target + 18) % 12) - 6) <= 2) ??
                    (mode === 'chromatic' && !clashes((target + 11) % 12) ? (target + 11) % 12 : null);
    if(pickRow !== null && pickRow !== undefined){ p.notes[last[2]][last[1]] = false; p.notes[pickRow][last[1]] = true; }
  }
  // 2. contrary motion: on the downbeat, the bass root takes whichever octave moves against the melody
  const first = ev[0];
  if(first[1] === 0 && (first[2] === 0 || first[2] === 12)){
    const mel = mainMelody(p), now = melodyAt(mel, 0), prevBar = n > 0 ? generateBarShallow(n - 1) : null;
    if(now !== null && prevBar){
      const pm = melodyAt(mainMelody(prevBar), 15), pb = bassEvents(prevBar).slice(-1)[0];
      if(pm !== null && pb){
        const mDir = Math.sign(now - pm), base = 12*(p.synth.octave + 1) + T;
        const score = r => { const b = base + r, bDir = Math.sign(b - pb[0]), iv = ((now - b) % 12 + 12) % 12;
          return (mDir && bDir === -mDir ? 2 : 0) - ((iv === 0 || iv === 7) && bDir === mDir && mDir ? 3 : 0) - Math.abs(b - pb[0])/12; };
        const best = [0, 12].sort((a, b) => score(b) - score(a))[0];
        if(best !== first[2]){ p.notes[first[2]][0] = false; p.notes[best][0] = true; }
      }
    }
  }
  return p;
}
// The previous bar as generated (without its own bass shaping), used to judge motion across the bar line
function generateBarShallow(n){
  const song = state.song, loc = locate(n); if(!loc) return null;
  const saved = rnd;
  seedWith(song.seed + '|bar|' + ((song.parts && song.parts.drums) || 0) + '|' + n);
  let p = barFor(song, loc, n);
  if(ENSEMBLE_ON) p = arrangeEnsemble(p, song);
  rnd = saved;
  return p;
}

// Counterpoint audit between bass and main melody at chord changes (used by the critic and the tests)
function auditCounterpoint(prev, p){
  const out = {changes: 0, contrary: 0, similar: 0, parallels: 0, approached: 0};
  if(!prev || !p) return out;
  const pb = bassEvents(prev), b = bassEvents(p), pm = melodyAt(mainMelody(prev), 15), m = melodyAt(mainMelody(p), 0);
  if(!pb.length || !b.length || b[0][1] !== 0) return out;
  const lastB = pb[pb.length - 1][0], firstB = b[0][0];
  if(lastB % 12 === firstB % 12) return out;
  out.changes = 1;
  if(Math.abs(firstB - lastB) <= 2) out.approached = 1;
  if(pm !== null && m !== null && pm !== m && lastB !== firstB){
    const md = Math.sign(m - pm), bd = Math.sign(firstB - lastB), iv = ((m - firstB) % 12 + 12) % 12, piv = ((pm - lastB) % 12 + 12) % 12;
    if(md === -bd) out.contrary = 1; else out.similar = 1;
    if(md === bd && (iv === 0 || iv === 7) && iv === piv) out.parallels = 1;
  }
  return out;
}
