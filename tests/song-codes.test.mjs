import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp } from './harness.mjs';

const app = loadApp();
const snapshot = () => JSON.stringify(Array.from({ length: app.totalBars() }, (_, n) => app.generateBar(n)));

test('a song code rebuilds exactly the same song, bar for bar', () => {
  for (const style of ['trance', 'dubstep', 'ukg']) {
    app.state.song = app.makeSong(style);
    const code = app.songCode(app.state.song), before = snapshot();
    app.state.song = app.parseCode(code);
    assert.equal(snapshot(), before, `${code} did not reproduce`);
  }
});

test('each reroll changes only its own part', () => {
  const base = app.makeSong('trance');
  const same = (a, b, keys) => keys.every(k => JSON.stringify(a[k]) === JSON.stringify(b[k]));
  const owns = { chords: ['prog', 'bdProg', 'stab', 'harmony', 'sus', 'chordBars'], hook: ['dropHook', 'melody'], bass: ['riffs'], vocal: ['vocal', 'verseVocal'], sound: ['dna'], form: ['form'] };
  for (const [part, fields] of Object.entries(owns)) {
    const other = app.makeSong(base.style, base.seed, { ...base.parts, [part]: 1 });
    // melodies are written to fit the chords, so new chords may also reshape the hook and vocal
    const skip = part === 'chords' ? ['chords', 'hook', 'vocal'] : [part];
    const rest = Object.entries(owns).filter(([p]) => !skip.includes(p)).flatMap(([, f]) => f);
    assert.ok(same(base, other, ['title', 'key', 'bpm', 'scale', ...rest]), `rerolling ${part} changed other parts`);
    assert.ok(!same(base, other, fields) || part === 'form', `rerolling ${part} changed nothing`);
    assert.ok(app.parseCode(app.songCode(other)), `code after rerolling ${part} does not parse`);
  }
});

test('invalid codes are rejected', () => {
  for (const bad of ['', 'hello', 'nope-ABC123', 'trance-!!!!']) assert.equal(app.parseCode(bad), null, bad);
});
