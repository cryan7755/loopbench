// Each genre's percussion character: the right sounds, phrase-by-phrase variation, drum & bass unchanged.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { loadApp } from './harness.mjs';

const app = loadApp();
const chorusBars = (style) => { const s = app.makeSong(style); app.state.song = s; const d = app.arr().find(x => x.name === 'drop'); return [...Array(d.bars).keys()].map(i => app.generateBar(d.start + i)); };
const soundsIn = (bars, ch) => new Set(bars.flatMap(p => Object.values((p.percVoice || {})[ch] || {})));

test('each genre uses its own percussion sounds', () => {
  assert.ok(soundsIn(chorusBars('techhouse'), 'bell').has('bongo_hi'), 'tech house should use bongos');
  assert.ok([...soundsIn(chorusBars('deephouse'), 'bell')].some(v => v.startsWith('conga')), 'deep house should use congas');
  assert.ok(soundsIn(chorusBars('trance'), 'bell').has('ride'), 'trance should ride on the offbeats');
  assert.ok(soundsIn(chorusBars('pop'), 'bell').has('tamb'), 'pop should use tambourine');
  assert.ok(soundsIn(chorusBars('rock'), 'bell').has('tamb'), 'a rock chorus should add tambourine');
  assert.ok(soundsIn(chorusBars('dubstep'), 'rim').has('woodblock'), 'dubstep should click on woodblock');
});

test('percussion varies between phrases but holds within one', () => {
  for (const style of ['techhouse', 'deephouse', 'pop', 'ukg']) {
    const bars = chorusBars(style), bell = bars.map(p => p.drums[app.DRUMS.findIndex(d => d.id === 'bell')].map(Number).join(''));
    assert.ok(new Set(bell).size >= 2, `${style}: hand percussion never changes`);
    assert.equal(bell[0], bell[1], `${style}: the pattern should hold within a phrase`);
  }
});

test('breakdowns and builds keep percussion out of the way; drum & bass keeps its own percussion', () => {
  const s = app.makeSong('techhouse'); app.state.song = s;
  for (const sec of app.arr().filter(x => x.name === 'breakdown' || x.name === 'build')) {
    const p = app.generateBar(sec.start + 1);
    assert.equal(p.drums[app.DRUMS.findIndex(d => d.id === 'bell')].filter(Boolean).length, 0, `hand percussion in the ${sec.label}`);
  }
  assert.equal(app.percussionFor(app.makeSong('dnb'), 'drop', 0, 32), null);
  assert.equal(chorusBars('dnb')[0].percVoice, undefined);
});

test('every percussion sound refers to a recorded sample that exists', () => {
  for (const [name, snd] of Object.entries(app.PERC_SOUNDS)) {
    assert.ok(existsSync(new URL(`../assets/samples/${snd.bank}/${snd.m}.mp3`, import.meta.url)), `${name} has no sample file`);
  }
});
