// The app must start cleanly both fresh and with a song saved from an earlier visit.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp } from './harness.mjs';

test('starts with nothing saved', () => { assert.doesNotThrow(() => loadApp()); });

test('starts with a saved song and settings from an earlier visit', () => {
  const first = loadApp();
  first.state.song = first.makeSong('trance');
  Object.assign(first.state, { endless: true, palette: 'orchestral', vocalStyle: 'choir', genre: 'trance', favorites: [{ code: first.songCode(first.state.song), title: first.state.song.title }] });
  const saved = JSON.parse(JSON.stringify(first.state));
  let app;
  assert.doesNotThrow(() => { app = loadApp({ saved }); }, 'loading with a saved song threw');
  assert.equal(app.songCode(app.state.song), first.songCode(first.state.song));
  assert.ok(app.generateBar(0), 'the saved song can be played');
});

test('starts with a song saved by an older version', () => {
  const first = loadApp();
  const old = first.makeSong('dubstep'); old.v = 1; delete old.arrangement;
  const saved = JSON.parse(JSON.stringify({ ...first.state, song: old, endless: true }));
  let app;
  assert.doesNotThrow(() => { app = loadApp({ saved }); });
  assert.ok(app.generateBar(0), 'the older song is rebuilt and plays');
});
