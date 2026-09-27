// Harmony: each section has a harmonic job, colour chords behave properly, and melodies fit them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp } from './harness.mjs';

const app = loadApp();
const styles = Object.keys(app.STYLES);
const songs = Array.from({ length: 400 }, (_, k) => app.makeSong(styles[k % styles.length]));
const all = s => [s.verseProg, s.preProg, s.prog, s.bdProg];

test('the pre-chorus ends on tension and the chorus opens by resolving it', () => {
  let tense = 0, resolves = 0;
  for (const s of songs) {
    if (app.fnOf(s.preProg[3]) === 'D') tense++;
    if (app.fnOf(s.preProg[3]) === 'D' && app.itemDeg(s.prog[0]) % 7 === 0) resolves++;
  }
  assert.ok(tense / songs.length > 0.7, `only ${(100 * tense / songs.length).toFixed(0)}% of pre-choruses end on a dominant`);
  assert.ok(resolves / songs.length > 0.4, `only ${(100 * resolves / songs.length).toFixed(0)}% resolve dominant-to-home into the chorus`);
});

test('secondary dominants always lead to their target chord', () => {
  let seen = 0;
  for (const s of songs) for (const p of all(s)) p.forEach((it, i) => {
    if (typeof it === 'object' && it.f === 'SD') {
      seen++;
      const next = p[(i + 1) % 4];
      assert.equal((app.itemRoot(s, next) - app.itemRoot(s, it) + 12) % 12, 5, `V/x does not resolve down a fifth in ${p.map(app.itemKey)}`);
    }
  });
  assert.ok(seen > 10, `secondary dominants are too rare (${seen})`);
});

test('colour chords appear in genres that use them, and never in the chorus downbeat', () => {
  const colour = {}, minorV = { minor: 0, withV: 0 };
  for (const s of songs) {
    const n = all(s).flat().filter(it => typeof it === 'object' && it.r !== undefined && it.f !== 'SD').length;
    colour[s.style] = (colour[s.style] || 0) + n;
    assert.ok(typeof s.prog[0] === 'number' || s.prog[0].r === undefined, `${app.songCode(s)}: the chorus opens on a colour chord`);
    if (s.scale !== 'major') { minorV.minor++; if (all(s).flat().some(it => typeof it === 'object' && it.r === 7 && it.q === 'M')) minorV.withV++; }
  }
  assert.ok(colour.rock > colour.techno, 'rock should use more borrowed chords than techno');
  assert.ok(minorV.withV / minorV.minor > 0.15, 'minor-key songs should sometimes use the strong major V');
});

test('inversions make the bassline step, and cadences stay in root position', () => {
  let inv = 0;
  for (const s of songs) for (const p of all(s)) p.forEach((it, i) => {
    if (typeof it === 'object' && it.b) {
      inv++;
      const prevBass = (app.itemRoot(s, p[i - 1]) + (typeof p[i - 1] === 'object' && p[i - 1].b || 0)) % 12;
      const bass = (app.itemRoot(s, it) + it.b) % 12, d = Math.abs(bass - prevBass) % 12;
      assert.ok(Math.min(d, 12 - d) <= 2, `inversion leaps in ${p.map(app.itemKey)}`);
    }
  });
  assert.ok(inv > 20, `inversions are too rare (${inv})`);
});

test('melody notes on strong beats belong to the chord, including colour chords', () => {
  let checked = 0, fit = 0;
  for (const s of songs.slice(0, 150)) {
    app.state.song = s;
    const chorus = app.arr().find(x => x.name === 'drop');
    for (let b = 0; b < 8; b++) {
      const bar = chorus.start + b, p = app.generateBar(bar), chord = p.wall || p.chords || p.gate;
      if (!chord || !p.lead || !p.leadSynth) continue;
      const pcs = (chord.ext || chord.ints).map(x => ((chord.T + x) % 12 + 12) % 12);
      const base = 12 * (p.leadSynth.octave + 1) + (p.leadSynth.transpose || 0);
      for (const [r, st] of p.lead) if (st % 4 === 0) { checked++; if (pcs.includes(((base + r) % 12 + 12) % 12)) fit++; }
    }
  }
  assert.ok(fit / checked > 0.95, `only ${(100 * fit / checked).toFixed(1)}% of strong-beat hook notes fit the chord`);
});
