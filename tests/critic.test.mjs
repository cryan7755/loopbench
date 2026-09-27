// The song-level critic: generated songs score well, and the critic notices when quality drops.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp } from './harness.mjs';

const app = loadApp(), styles = Object.keys(app.STYLES);
const songs = styles.flatMap(g => [app.makeSong(g), app.makeSong(g)]);
const reports = songs.map(s => app.songReport(s));
const avg = f => reports.reduce((a, r) => a + f(r), 0) / reports.length;

test('generated songs score well overall and in every area', () => {
  const floors = { melody: 80, harmony: 95, ensemble: 88, counterpoint: 65, energy: 75, structure: 95 };
  assert.ok(avg(r => r.overall) >= 85, `overall ${avg(r => r.overall).toFixed(1)}`);
  for (const [k, min] of Object.entries(floors)) assert.ok(avg(r => r.scores[k]) >= min, `${k} averages ${avg(r => r.scores[k]).toFixed(1)}, below ${min}`);
});

test('no genre falls far behind', () => {
  for (const g of styles) {
    const mine = reports.filter((_, i) => songs[i].style === g), o = mine.reduce((a, r) => a + r.overall, 0) / mine.length;
    assert.ok(o >= 78, `${g} averages ${o.toFixed(0)}`);
  }
});

test('the critic notices when the arranger, energy shaper or bass shaping is switched off', () => {
  const sample = ['trance', 'pop', 'future', 'rock', 'deephouse', 'dnb'].map(g => app.makeSong(g));
  const score = (key, off) => { off(false); const v = sample.reduce((a, s) => a + app.songReport(s).scores[key], 0) / sample.length; off(true); return v; };
  const on = k => sample.reduce((a, s) => a + app.songReport(s).scores[k], 0) / sample.length;
  assert.ok(on('ensemble') > score('ensemble', app.setEnsemble) + 5, 'switching off the arranger should lower the ensemble score');
  assert.ok(on('energy') > score('energy', app.setEnergy) + 3, 'switching off the energy shaper should lower the energy score');
  assert.ok(on('counterpoint') > score('counterpoint', app.setBass) + 3, 'switching off bass shaping should lower the counterpoint score');
});
