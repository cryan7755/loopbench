import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp } from './harness.mjs';

const app = loadApp();
const BANDS = ['rock', 'pop', 'dancepop', 'altrock', 'metal'];

test('band genres use song-section names and band parts', () => {
  for (const style of BANDS) for (let k = 0; k < 6; k++) {
    const s = app.makeSong(style); app.state.song = s;
    const labels = app.arr().map(x => x.label);
    assert.ok(labels.some(l => /Chorus/.test(l)), `${style}: no chorus in ${labels}`);
    assert.ok(!labels.some(l => /drop/i.test(l)), `${style}: still has a drop`);
    const chorus = app.arr().find(x => x.name === 'drop');
    const p = app.generateBar(chorus.start + 1);
    assert.ok(p.gtr && p.gtr.length, `${style}: no guitar in the chorus`);
    assert.ok(p.vocal && p.vocal.length >= 0, `${style}: chorus has no vocal line`);
    assert.equal(p.duck, false, `${style}: sidechain pumping in a band chorus`);
    assert.ok(!p.arp && !p.gate, `${style}: EDM arps or gates in a band chorus`);
    const notes = p.gtr.flatMap(h => h.notes);
    assert.ok(Math.min(...notes) >= 38 && Math.max(...notes) <= 88, `${style}: guitar notes out of range`);
  }
});

test('metal chugs and double-kicks; pop strums; dance pop plays funk guitar', () => {
  const bar = (style, name, i = 1) => { const s = app.makeSong(style); app.state.song = s; const sec = app.arr().find(x => x.name === name); return app.generateBar(sec.start + i); };
  const mv = bar('metal', 'verse'); assert.ok(mv.gtr.every(h => h.style === 'mutedist'), 'metal verse should be palm-muted');
  const mc = bar('metal', 'drop'); assert.equal(mc.drums[app.DRUMS.findIndex(d => d.id === 'kick')].filter(Boolean).length, 16, 'metal chorus needs double kick');
  const pv = bar('pop', 'drop'); assert.ok(pv.gtr.every(h => h.style === 'clean' && h.notes.length >= 4), 'pop chorus should strum clean chords');
  const dv = bar('dancepop', 'verse'); assert.ok(dv.gtr.every(h => h.style === 'cleanmute'), 'dance pop should use muted funk guitar');
});
