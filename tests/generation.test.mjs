import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp } from './harness.mjs';

const app = loadApp();

test('every genre and song form generates, plays and ends cleanly', () => {
  for (const style of Object.keys(app.STYLES)) {
    for (const form of Object.keys(app.FORMS)) {
      app.state.song = makeFor(style, form);
      const n = app.totalBars();
      for (let bar = 0; bar < n; bar++) {
        const p = app.generateBar(bar);
        assert.ok(p, `${style}/${form}: bar ${bar} is missing`);
        for (let s = 0; s < 16; s++) app.playStep(p, s, 1);
      }
      assert.equal(app.generateBar(n), null, `${style}/${form}: song should end after ${n} bars`);
    }
  }
});

test('the last bar of every build leaves a gap before the drop', () => {
  for (const style of Object.keys(app.STYLES)) {
    app.state.song = app.makeSong(style);
    for (const sec of app.arr().filter(s => s.name === 'build')) {
      const p = app.generateBar(sec.start + sec.bars - 1);
      const lastBeat = p.drums.some(row => row.slice(12).some(Boolean));
      assert.equal(lastBeat, false, `${style}: drums play in the final beat of ${sec.label}`);
    }
  }
});

test('genre settings are respected', () => {
  for (const [style, st] of Object.entries(app.STYLES)) {
    for (let i = 0; i < 5; i++) {
      const s = app.makeSong(style);
      assert.ok(s.bpm >= st.bpm[0] && s.bpm <= st.bpm[1], `${style}: bpm ${s.bpm} out of range`);
      if (st.scales) assert.ok(st.scales.includes(s.scale), `${style}: unexpected scale ${s.scale}`);
    }
  }
});

function makeFor(style, form) { const s = app.makeSong(style); s.form = form; s.arrangement = app.makeArrangement(s, form); return s; }

test('song structure varies from song to song and stays in sensible bounds', () => {
  const shapes = new Set(), lengths = [];
  for (let k = 0; k < 150; k++) {
    const s = app.makeSong(Object.keys(app.STYLES)[k % Object.keys(app.STYLES).length]);
    app.state.song = s;
    const secs = app.arr(), bars = app.totalBars(), minutes = bars * 240 / s.bpm / 60;
    shapes.add(secs.map(x => x.bars).join('-'));
    lengths.push(minutes);
    for (const x of secs) {
      if (x.name !== 'fake') assert.equal(x.bars % 8, 0, `${x.label} is ${x.bars} bars, off the 8-bar grid`);
      if (x.name === 'build') assert.ok(x.bars >= 8 && x.bars <= 16, `build of ${x.bars} bars`);
      if (x.name === 'drop') assert.ok(x.bars >= 16, `drop of only ${x.bars} bars`);
    }
    const limit = s.form === 'radio' ? [1.5, 5] : [3, 9];
    assert.ok(minutes >= limit[0] && minutes <= limit[1], `${app.songCode(s)} lasts ${minutes.toFixed(1)} minutes`);
  }
  assert.ok(shapes.size > 40, `only ${shapes.size} different structures in 150 songs`);
});
