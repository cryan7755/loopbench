/* ---------- Ensemble: making the parts work together ----------
   The composer writes each part well on its own; this checks and arranges them as a group.
   Rules, as an arranger would apply them:
     1. One foreground melody at a time. When the voice sings, the lead answers in its gaps.
        In an EDM drop the hook leads and the voice doubles it in chops instead.
     2. Supporting lines (counter melody, arpeggio) stay out of the foreground's register
        and fill its gaps rather than talking over it.
     3. No semitone rubs between melodic lines, or between a melody and the bass on a strong beat. */

// Every melodic note in a bar as [midi, start step, length in steps], by part
function ensembleParts(p){
  const out = {vocal: [], lead: [], counter: [], arp: [], bass: []};
  if(p.vocal) p.vocal.forEach(v => out[v.chop ? 'lead' : 'vocal'].push([v.m, v.s, Math.max(0.5, v.len)]));
  if(p.lead && p.leadSynth){
    const base = 12*(p.leadSynth.octave + 1) + (p.leadSynth.transpose || 0);
    p.lead.forEach(([r, s, d]) => out.lead.push([base + r, s, d || p.leadSynth.len || 1]));
  }
  if(p.counter) p.counter.forEach(([r, s]) => out.counter.push([72 + (p.counterT || 0) + r, s, 2]));
  if(p.arp) p.arp.forEach(([r, s]) => out.arp.push([72 + (p.arpT || 0) + r, s, 0.5]));
  const S = p.synth;
  if(p.bassAbs) p.bassAbs.forEach(n => out.bass.push(n.slice()));
  else if(S && p.notes) for(let r=0;r<ROWS;r++) for(let s=0;s<STEPS;s++) if(p.notes[r][s]) out.bass.push([12*(S.octave + 1) + r + (S.transpose || 0), s, S.len || 1]);
  return out;
}
function soundingAt(notes, s){ return notes.filter(([, st, d]) => st <= s && s < st + d); }
function ic(a, b){ return Math.abs(a - b) % 12; }   // interval class; declared as functions so they work during page load

// Measure a bar: how often independent melodies overlap, crowd each other, or rub
function auditBar(p){
  const P = ensembleParts(p), lines = ['vocal', 'lead', 'counter'];
  let overlap = 0, crowded = 0, rubs = 0, bassRubs = 0, active = 0;
  for(let s=0; s<16; s++){
    const now = lines.map(k => soundingAt(P[k], s)).filter(x => x.length);
    if(now.length) active++;
    const starting = lines.filter(k => P[k].some(n => Math.floor(n[1]) === s)).length;
    if(starting >= 2) overlap++;
    if(now.length >= 2){
      const tops = now.map(x => Math.max(...x.map(n => n[0])));
      if(tops.some((a, i) => tops.some((b, j) => i < j && Math.abs(a - b) <= 4))) crowded++;
      const all = now.flat().map(n => n[0]);
      for(let i=0;i<all.length;i++) for(let j=i+1;j<all.length;j++) if(ic(all[i], all[j]) === 1 || ic(all[i], all[j]) === 11) rubs++;
    }
    if(s % 4 === 0){
      const b = soundingAt(P.bass, s), m = soundingAt(P.vocal.length ? P.vocal : P.lead, s);
      b.forEach(([bm]) => m.forEach(([mm]) => { if(ic(bm, mm) === 1) bassRubs++; }));
    }
  }
  return {active, overlap, crowded, rubs, bassRubs};
}

// Arrange a generated bar so its parts support each other (user edits are applied afterwards and left alone)
function arrangeEnsemble(p, song){
  if(!p) return p;
  const band = STYLES[song.style] && STYLES[song.style].band, drop = p.phase === 'drop';
  const sung = p.vocal && p.vocal.some(v => !v.chop);
  // Rule 1a: in an EDM drop the hook leads; a sung line becomes chops that double the hook
  if(drop && !band && sung && p.lead && p.lead.length && p.leadSynth){
    const base = 12*(p.leadSynth.octave + 1) + (p.leadSynth.transpose || 0);
    p.vocal = p.lead.filter((_, k) => k % 2 === 0).map(([r, s], k) => ({s, len: 0.9, m: base + r, vw: [k % 2 ? 'e' : 'a'], chop: true}));
  }
  const P = ensembleParts(p), fore = P.vocal.length ? P.vocal : P.lead;
  const covered = new Set(), onsets = new Set();
  fore.forEach(([, s, d]) => { onsets.add(Math.floor(s)); for(let k = Math.floor(s); k < Math.min(16, s + d); k++) covered.add(k); });
  // a supporting line may move while the foreground holds a note, but not as it starts one
  const nearOnset = s => onsets.has(s) || onsets.has(s - 1) || onsets.has(s + 1);
  const overlaps = (s, d) => { for(let k = Math.floor(s); k < Math.min(16, s + Math.max(1, d)); k++) if(covered.has(k)) return true; return false; };
  // Rule 1b: while the voice sings, the lead only answers in its gaps
  if(P.vocal.length && p.lead && p.leadSynth){
    p.lead = p.lead.filter(([r, s, d]) => !overlaps(s, d || p.leadSynth.len || 1));
    p.lead2 = null;
  }
  // Rule 2: supporting lines move above the foreground and into its gaps
  const top = fore.length ? Math.max(...fore.map(n => n[0])) : null;
  if(p.counter && p.counter.length){
    const lift = top === null ? 0 : Math.max(0, Math.ceil((top + 5 - (72 + (p.counterT || 0) + Math.min(...p.counter.map(c => c[0]))))/12))*12;
    p.counter = p.counter.filter(([r, s]) => !nearOnset(s) && 72 + (p.counterT || 0) + r + lift <= 91).map(([r, s]) => [r + lift, s]);
    if(!p.counter.length) p.counter = null;
  }
  if(p.arp && p.arp.length && top !== null){
    const lo = 72 + (p.arpT || 0) + Math.min(...p.arp.map(a => a[0]));
    if(lo <= top + 3){ if(lo + 12 + 12 <= 100) p.arpT = (p.arpT || 0) + 12; else p.arp = p.arp.filter(([, s]) => s % 2 === 0); }
  }
  // Rule 3: remove semitone rubs, adjusting the least important line first
  const chordPcs = (() => { const c = p.wall || p.chords || p.gate; return c ? (c.ext || c.ints).map(x => ((c.T + x) % 12 + 12) % 12) : null; })();
  const fixLine = (key, notes, others) => notes.map(n => {
    const [m, s, d] = n;
    const rub = others.some(([om, os, od]) => os < s + d && s < os + od && (ic(m, om) === 1 || ic(m, om) === 11));
    if(!rub) return n;
    if(chordPcs) for(let k=1; k<=4; k++) for(const cand of [m - k, m + k]) if(chordPcs.includes(((cand % 12) + 12) % 12) && !others.some(([om, os, od]) => os < s + d && s < os + od && [1, 11].includes(ic(cand, om)))) return [cand, s, d];
    return null;
  }).filter(Boolean);
  const Q = ensembleParts(p);
  if(p.counter && p.counter.length){
    const fixed = fixLine('counter', Q.counter, Q.vocal.concat(Q.lead));
    p.counter = fixed.length ? fixed.map(([m, s]) => [m - 72 - (p.counterT || 0), s]) : null;
  }
  if(Q.vocal.length && p.lead && p.lead.length && p.leadSynth){
    const base = 12*(p.leadSynth.octave + 1) + (p.leadSynth.transpose || 0);
    p.lead = fixLine('lead', Q.lead.filter(n => !(p.vocal || []).some(v => v.chop && v.m === n[0] && v.s === n[1])), Q.vocal).map(([m, s, d]) => [m - base, s, d]);
  }
  return p;
}
