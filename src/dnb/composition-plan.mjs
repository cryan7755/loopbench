// Deterministic, genre-constrained arrangement blueprint for original DnB songs.
// Pure module: usable in browser and Node without touching legacy generator globals.
export const DNB_STYLES = Object.freeze({
  liquid: { bpm: [170, 174], energy: [0.28, 0.88], swing: [0.02, 0.09], harmonicRhythm: 4 },
  dancefloor: { bpm: [172, 176], energy: [0.40, 1], swing: [0, 0.05], harmonicRhythm: 4 },
  deep: { bpm: [170, 176], energy: [0.30, 0.92], swing: [0.015, 0.08], harmonicRhythm: 8 },
});
const FORMS = [
  [['intro',16],['build',16],['drop',32],['breakdown',16],['build',16],['final-drop',32],['outro',16]],
  [['intro',16],['drop',32],['breakdown',32],['build',16],['final-drop',32],['outro',16]],
];
const ROOTS = ['C','C#','D','Eb','E','F','F#','G','Ab','A','Bb','B'];
function hashSeed(value) {
  let h = 2166136261;
  for (const c of String(value)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function rng(seed) {
  let x = hashSeed(seed) || 1;
  return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return (x >>> 0) / 4294967296; };
}
const pick = (items, random) => items[Math.floor(random() * items.length)];
export function createDnbPlan({ seed = 'loopbench', style = 'liquid' } = {}) {
  if (!Object.hasOwn(DNB_STYLES, style)) throw new RangeError('Unsupported DnB style: ' + style);
  const random = rng(seed + ':' + style);
  const spec = DNB_STYLES[style];
  const bpm = Math.round(spec.bpm[0] + random() * (spec.bpm[1] - spec.bpm[0]));
  const key = pick(ROOTS, random) + ' minor';
  const motif = Array.from({ length: 8 }, () => pick([0,2,3,5,7,10,12], random));
  const form = pick(FORMS, random);
  let cursor = 0;
  const sections = form.map(([role, bars], index) => {
    const startBar = cursor;
    cursor += bars;
    const energy = role === 'intro' ? .3 : role === 'breakdown' ? .25 :
      role === 'build' ? .65 : role === 'drop' ? .85 :
      role === 'final-drop' ? 1 : .2;
    return { id: index, role, startBar, bars, endBar: cursor, energy,
      motifTransform: role === 'breakdown' ? 'fragment' : role === 'final-drop' ? 'variation' : 'original' };
  });
  return {
    schemaVersion: 1, seed: String(seed), style, bpm, key, meter: [4,4],
    swing: +(spec.swing[0] + random() * (spec.swing[1] - spec.swing[0])).toFixed(3),
    harmonicRhythmBars: spec.harmonicRhythm, motif,
    groove: { kick: [0,10], snare: [4,12], ghostSnare: [11], hats: [0,2,4,6,8,10,12,14],
      stepsPerBar: 16, bassKickAvoidance: true, phraseVariationBars: 8 },
    sections, totalBars: cursor,
    constraints: { sharedMotif: true, subBassMono: true, kickBassMaskingCheck: true,
      noUnresolvedLeadClashes: true, transitionsAtPhraseBoundaries: true },
  };
}
export function validateDnbPlan(plan) {
  const errors = [];
  if (!plan || !Array.isArray(plan.sections)) return ['Missing sections'];
  if (plan.bpm < 170 || plan.bpm > 176) errors.push('BPM outside DnB range');
  let bar = 0;
  for (const section of plan.sections) {
    if (section.startBar !== bar) errors.push('Section gap or overlap');
    if (section.bars <= 0 || section.bars % 8 !== 0) errors.push('Section not aligned to 8-bar phrase');
    if (section.energy < 0 || section.energy > 1) errors.push('Invalid energy');
    bar = section.endBar;
  }
  if (bar !== plan.totalBars) errors.push('Total bars mismatch');
  if (!plan.sections.some(s => s.role === 'drop') || !plan.sections.some(s => s.role === 'final-drop')) errors.push('Missing drops');
  if (plan.motif?.length !== 8) errors.push('Missing shared motif');
  return errors;
}
