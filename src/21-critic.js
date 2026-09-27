/* ---------- The critic: scoring a whole song ----------
   songReport() generates every bar of a song and scores six areas out of 100, then combines them.
   It brings together the checks the composer, arranger and shapers use, so a change anywhere
   in the generator can be measured on complete songs. Used by the tests, by `npm run critic`,
   and by the Song report button. */

const CRITIC_WEIGHTS = {melody: 25, harmony: 20, ensemble: 15, counterpoint: 15, energy: 15, structure: 10};
const clamp01 = x => Math.max(0, Math.min(1, x));
function contourAgree(a, b){ const n = Math.min(a.length, b.length); if(!n) return 0; let m = 0; for(let k=0;k<n;k++) if(Math.sign(a[k]) === Math.sign(b[k])) m++; return m/n; }
function openingSteps(line, n){ const f = line.notes.filter(x => x.bar === 0), iv = []; for(let k=1; k<f.length && iv.length<n; k++) iv.push(f[k].deg - f[k-1].deg); return iv; }

function songReport(song){
  const saved = state.song; state.song = song;
  try{
    const secs = arr(), bars = [];
    for(const sec of secs) for(let i=0; i<sec.bars; i++) bars.push(generateBar(sec.start + i));
    const mean = a => a.reduce((x, y) => x + y, 0)/Math.max(1, a.length);
    const detail = {};

    // Melody: the hook and vocal ratings, the motif running through, the chorus as the peak
    const lines = [song.dropHook, song.vocal, song.verseVocal, song.preVocal].filter(l => l && l.rating);
    const r = k => mean(lines.map(l => +l.rating[k] || 0));
    const motif = songMotif(song), top = l => Math.max(...l.notes.map(n => n.deg));
    detail.melody = {chordTones: r('chordTones'), leapsResolved: r('leapsResolved'), singlePeak: r('singlePeak'), peakPlacement: r('peakPlacement'),
      motif: song.vocal ? contourAgree(motif, openingSteps(song.vocal, motif.length)) : 0,
      chorusPeak: song.vocal && song.verseVocal ? +(top(song.vocal) >= Math.max(top(song.verseVocal), song.preVocal ? top(song.preVocal) : -99)) : 0};
    const m = detail.melody;
    const melody = 100*(0.3*m.chordTones + 0.2*m.leapsResolved + 0.1*m.singlePeak + 0.1*m.peakPlacement + 0.15*m.motif + 0.15*m.chorusPeak);

    // Harmony: each section's progression does its job, loops stay varied, secondary dominants resolve
    const progs = {verse: song.verseProg, pre: song.preProg, chorus: song.prog, bridge: song.bdProg};
    let checks = 0, passed = 0;
    const check = ok => { checks++; if(ok) passed++; };
    for(const [role, p] of Object.entries(progs)){
      if(!p) continue;
      const roots = p.map(it => itemRoot(song, it));
      check(new Set(roots).size >= 3);
      check(roots.every((x, i) => x !== roots[(i + 1) % roots.length]));
      if(role === 'pre') check(fnOf(p[p.length - 1]) === 'D');
      if(role === 'chorus') check(fnOf(p[0]) === 'T');
      p.forEach((it, i) => { if(typeof it === 'object' && it.f === 'SD') check((itemRoot(song, p[(i + 1) % p.length]) - itemRoot(song, it) + 12) % 12 === 5); });
    }
    if(song.preProg) check(fnOf(song.preProg[song.preProg.length - 1]) === 'D' && wrap7(itemDeg(song.prog[0])) === 0);
    detail.harmony = {checks, passed};
    const harmony = 100*passed/Math.max(1, checks);

    // Ensemble: melodies starting together, crowding, semitone rubs
    const au = bars.map(auditBar), sum = k => au.reduce((a, x) => a + x[k], 0), active = Math.max(1, sum('active'));
    detail.ensemble = {overlap: sum('overlap')/active, crowded: sum('crowded')/active, rubsPerBar: sum('rubs')/bars.length, bassRubsPerBar: sum('bassRubs')/bars.length};
    const e = detail.ensemble;
    const ensemble = 100*clamp01(1 - 4*e.overlap - 4*e.crowded - 2*e.rubsPerBar - 5*e.bassRubsPerBar);

    // Counterpoint: how the bass and melody move against each other at chord changes
    const cp = {changes: 0, contrary: 0, similar: 0, parallels: 0, approached: 0};
    for(let n=1; n<bars.length; n++){ const a = auditCounterpoint(bars[n - 1], bars[n]); for(const k in cp) cp[k] += a[k]; }
    const moving = Math.max(1, cp.contrary + cp.similar);
    detail.counterpoint = {contrary: cp.contrary/moving, parallels: cp.parallels/moving, approached: cp.approached/Math.max(1, cp.changes)};
    const c = detail.counterpoint;
    // pedal-bass genres (techno, metal, psytrance...) hold the bass on purpose, so only the outer-voice motion counts
    const pedal = (BASS_MOTION[song.style] || 'diatonic') === 'none';
    const counterpoint = 100*clamp01(pedal ? 0.7 + 0.3*c.contrary - c.parallels : 0.45 + 0.5*c.contrary + 0.3*c.approached - 1.5*c.parallels);

    // Energy: how closely the arc follows its target, and whether its landmarks are in the right order
    const ref = energyRef(song), en = bars.map(energyOf), dist = mean(bars.map((p, k) => Math.abs(en[k]/ref - targetEnergy(p))));
    const secE = []; let at = 0; for(const sec of secs){ secE.push({sec, e: en.slice(at, at + sec.bars)}); at += sec.bars; }
    const drops = secE.filter(x => x.sec.name === 'drop'), lows = secE.filter(x => ['breakdown', 'bridge'].includes(x.sec.name));
    const rules = [drops.length < 2 || mean(drops[drops.length - 1].e) > mean(drops[0].e),
      !lows.length || !drops.length || Math.max(...lows.map(x => mean(x.e))) < Math.min(...drops.map(x => mean(x.e)))];
    detail.energy = {distance: dist, rules: rules.filter(Boolean).length/rules.length};
    const energy = 100*(0.6*clamp01(1 - dist/0.3) + 0.4*detail.energy.rules);

    // Structure: the 8-bar grid and a sensible length
    const minutes = totalBars()*240/song.bpm/60, band = STYLES[song.style] && STYLES[song.style].band;
    const cap = song.form === 'radio' ? 5 : band ? 6 : 8;
    detail.structure = {onGrid: secs.filter(x => x.name === 'fake' || x.bars % 8 === 0).length/secs.length, minutes};
    const structure = 100*(0.7*detail.structure.onGrid + 0.3*(minutes <= cap + 0.01 && minutes >= 1.5 ? 1 : 0));

    const scores = {melody, harmony, ensemble, counterpoint, energy, structure};
    const overall = Object.entries(CRITIC_WEIGHTS).reduce((a, [k, w]) => a + w*scores[k], 0)/Object.values(CRITIC_WEIGHTS).reduce((a, b) => a + b, 0);
    for(const k in scores) scores[k] = Math.round(scores[k]);
    return {overall: Math.round(overall), scores, detail};
  } finally { state.song = saved; }
}
