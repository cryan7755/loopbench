// The parts must work as an ensemble: one foreground melody, separate registers, no semitone rubs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp } from './harness.mjs';

const app = loadApp();
const styles = Object.keys(app.STYLES);
function survey(on) {
  app.setEnsemble(on);
  const t = { active: 0, overlap: 0, crowded: 0, rubs: 0, bars: 0, counter: 0, dropBars: 0, dropLead: 0 };
  for (let k = 0; k < 60; k++) {
    app.state.song = app.makeSong(styles[k % styles.length]);
    for (let n = 0; n < app.totalBars(); n++) {
      const p = app.generateBar(n), a = app.auditBar(p), P = app.ensembleParts(p);
      for (const f of ['active', 'overlap', 'crowded', 'rubs']) t[f] += a[f];
      t.bars++; t.counter += P.counter.length;
      if (p.phase === 'drop' && !app.STYLES[app.state.song.style].band) { t.dropBars++; if (P.lead.length) t.dropLead++; }
    }
  }
  app.setEnsemble(true);
  return t;
}
const before = survey(false), after = survey(true);

test('melodies no longer start notes on top of each other or crowd one register', () => {
  assert.ok(after.overlap / after.active < 0.02, `${(100 * after.overlap / after.active).toFixed(1)}% of steps have two melodies starting together`);
  assert.ok(after.crowded / after.active < 0.02, `${(100 * after.crowded / after.active).toFixed(1)}% of steps are crowded`);
  assert.ok(before.overlap > after.overlap * 5, 'the arranger should make a large difference');
});

test('no semitone rubs between melodic lines', () => {
  assert.ok(after.rubs / after.bars < 0.05, `${(after.rubs / after.bars).toFixed(3)} rubs per bar`);
});

test('the arrangement keeps its material: counter melodies survive and drops keep their hook', () => {
  assert.ok(after.counter >= before.counter * 0.5, `counter melody cut from ${before.counter} to ${after.counter} notes`);
  assert.ok(after.dropLead / after.dropBars > 0.9, `only ${(100 * after.dropLead / after.dropBars).toFixed(0)}% of drop bars have a hook`);
});
