// The song's energy arc: builds rise, the final drop is the peak, breakdowns and verses sit lower, the outro fades.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp } from './harness.mjs';

const app = loadApp(), styles = Object.keys(app.STYLES);
const mean = a => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
function survey(on, N = 100) {
  app.setEnergy(on);
  const r = { finalPeak: 0, songs: 0, builds: 0, buildRises: 0, bdBelow: 0, verseBelow: 0, outroFalls: 0, err: 0, errN: 0 };
  for (let k = 0; k < N; k++) {
    const s = app.makeSong(styles[k % styles.length]); app.state.song = s; r.songs++;
    const ref = app.energyRef(s);
    const secs = app.arr().map(sec => { const bars = [...Array(sec.bars).keys()].map(i => app.generateBar(sec.start + i)); return { sec, bars, e: bars.map(app.energyOf) }; });
    secs.forEach(x => x.bars.forEach((p, i) => { r.err += Math.abs(x.e[i] / ref - app.targetEnergy(p)); r.errN++; }));
    const drops = secs.filter(x => x.sec.name === 'drop'), low = secs.filter(x => ['breakdown', 'bridge'].includes(x.sec.name)), verses = secs.filter(x => x.sec.name === 'verse');
    if (drops.length >= 2 && mean(drops.at(-1).e) > mean(drops[0].e) * 1.03) r.finalPeak++;
    for (const b of secs.filter(x => x.sec.name === 'build' && (app.STYLES[s.style].band || s.dna.build !== 'vocal'))) {
      r.builds++; const h = Math.floor(b.e.length / 2); if (mean(b.e.slice(h, -1)) > mean(b.e.slice(0, h)) * 1.03) r.buildRises++;
    }
    if (low.length && drops.length && Math.max(...low.map(b => mean(b.e))) < Math.min(...drops.map(d => mean(d.e)))) r.bdBelow++;
    if (verses.length && drops.length && Math.max(...verses.map(v => mean(v.e))) < Math.min(...drops.map(d => mean(d.e))) * 0.95) r.verseBelow++;
    const o = secs.find(x => x.sec.name === 'outro'); if (o && mean(o.e.slice(-4)) < mean(o.e.slice(0, 4)) * 0.8) r.outroFalls++;
  }
  app.setEnergy(true);
  return r;
}
const before = survey(false), after = survey(true);

test('the final drop or chorus is the peak of the song', () => {
  assert.ok(after.finalPeak / after.songs > 0.9, `only ${(100 * after.finalPeak / after.songs).toFixed(0)}% of songs peak at the end`);
});
test('builds and pre-choruses rise', () => {
  assert.ok(after.buildRises / after.builds > 0.7, `only ${(100 * after.buildRises / after.builds).toFixed(0)}% of builds rise`);
});
test('breakdowns and verses sit below the drops, and the outro fades', () => {
  assert.ok(after.bdBelow / after.songs > 0.95 && after.verseBelow / after.songs > 0.95, 'sections are out of order');
  assert.ok(after.outroFalls / after.songs > 0.8, `only ${(100 * after.outroFalls / after.songs).toFixed(0)}% of outros fade`);
});
test('songs follow the target arc more closely than without shaping', () => {
  assert.ok(after.err / after.errN < before.err / before.errN * 0.85, `distance from target ${(after.err / after.errN).toFixed(3)} vs ${(before.err / before.errN).toFixed(3)}`);
});
test('shaping changes texture only: melody, vocals, bass and chords are untouched', () => {
  for (let k = 0; k < 30; k++) {
    const s = app.makeSong(styles[k % styles.length]); app.state.song = s;
    for (let n = 0; n < app.totalBars(); n += 3) {
      app.setEnergy(false); const a = app.generateBar(n); app.setEnergy(true); const b = app.generateBar(n);
      assert.deepEqual(b.lead, a.lead, 'lead changed'); assert.deepEqual(b.vocal, a.vocal, 'vocal changed');
      assert.deepEqual(b.notes, a.notes, 'bass changed'); assert.deepEqual(b.chords, a.chords, 'chords changed');
      assert.deepEqual(b.drums[0], a.drums[0], 'kick pattern changed');
    }
  }
});
