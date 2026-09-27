import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp } from './harness.mjs';

const app = loadApp();
const setup = () => { app.state.song = app.makeSong('trance'); app.state.bpm = app.state.song.bpm; return app.arr().find(x => x.name === 'drop').start + 1; };

test('an edited lead bar plays exactly the notes entered', () => {
  const n = setup();
  app.state.song.edits = { lead: { [n]: [[72, 0, 4], [76, 8, 2]] } };
  assert.deepEqual(app.barContent('lead', n), [[72, 0, 4], [76, 8, 2]]);
  assert.notDeepEqual(app.barContent('lead', n + 1), [[72, 0, 4], [76, 8, 2]], 'neighbouring bars stay generated');
});

test('editing a bar starts from what was generated, and undo restores it', () => {
  const n = setup(), before = app.barContent('vocal', n);
  app.editBar('vocal', n, notes => notes.concat([[70, 15, 1]]));
  assert.equal(app.barContent('vocal', n).length, before.length + 1);
  app.edUndo();
  assert.deepEqual(app.barContent('vocal', n), before);
  assert.equal(app.hasEdits(app.state.song), false);
});

test('bass and drum edits play, and appear in the MIDI export', async () => {
  const n = setup();
  const grid = app.DRUMS.map(() => Array(16).fill(false)); grid[0][0] = grid[0][8] = true;
  app.state.song.edits = { bass: { [n]: [[33, 0, 8], [40, 8, 8]] }, drums: { [n]: grid } };
  const p = app.generateBar(n);
  assert.deepEqual(p.bassAbs, [[33, 0, 8], [40, 8, 8]]);
  assert.equal(p.drums[0].filter(Boolean).length, 2);
  for (let s = 0; s < 16; s++) app.playStep(p, s, 1);
  const bytes = Buffer.from(await app.buildMidi().arrayBuffer());
  assert.ok(bytes.includes(Buffer.from([0x90 | 0, 33])), 'edited bass note 33 is in the MIDI file');
});

test('edits are saved with the song and survive a reload', () => {
  const n = setup();
  app.state.song.edits = { lead: { [n]: [[74, 4, 2]] } };
  const again = loadApp({ saved: JSON.parse(JSON.stringify({ ...app.state, endless: true })) });
  assert.deepEqual(again.barContent('lead', n), [[74, 4, 2]]);
});
