// The topline: a featured instrument plays the vocal melody, chosen per song from the genre's pool.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp } from './harness.mjs';

let OfflineAudioContext;
try { ({ OfflineAudioContext } = await import('node-web-audio-api')); } catch { /* optional */ }
const app = loadApp();

test('every genre has toplines, and every topline is a known instrument', () => {
  for (const style of Object.keys(app.STYLES)) {
    const pool = app.TOPLINE_POOLS[style];
    assert.ok(pool && pool.length, `${style} has no toplines`);
    for (const id of pool) assert.ok(app.TOPLINES[id], `${style}: unknown topline ${id}`);
  }
});

test('the topline is part of the song code and varies between songs of one genre', () => {
  for (const style of ['trance', 'pop', 'deephouse', 'synthwave']) {
    const picks = new Set();
    for (let i = 0; i < 24; i++) {
      const s = app.makeSong(style);
      assert.equal(app.parseCode(app.songCode(s)).dna.topline, s.dna.topline, 'a song code brings its topline back');
      picks.add(s.dna.topline);
    }
    assert.ok(picks.size >= 2, `${style} always gets ${[...picks]}`);
  }
});

test('the menu choice overrides the song, and each palette keeps to its own instruments', () => {
  const s = app.makeSong('synthwave');
  Object.assign(app.state, { vocalStyle: 'flute', palette: 'hybrid' });
  assert.equal(app.toplineId(s), 'flute');
  app.state.vocalStyle = 'auto';
  assert.equal(app.toplineId(s), s.dna.toplineSynth, 'without recorded samples the topline falls back to a synth');
});

test('every topline instrument plays the melody at a sane level', { skip: !OfflineAudioContext && 'node-web-audio-api not installed', timeout: 240000 }, async () => {
  const a = loadApp({ offlineAudio: OfflineAudioContext });
  await a.useOfflineAudio(OfflineAudioContext);
  for (const b of ['sax', 'flute', 'vibes', 'marimba']) assert.ok(a.sampleBufs[b]?.length, `${b} samples decoded`);
  a.state.song = a.makeSong('pop'); a.state.bpm = a.state.song.bpm; a.state.palette = 'hybrid';
  const sec = a.arr().find(x => x.name === 'drop'), p = a.generateBar(sec.start + 1);
  assert.ok(p.vocal && p.vocal.length, 'the chorus has a melody');
  p.vocal = p.vocal.map(n => ({ ...n, chop: false }));
  p.vocal.push({ s: 0, len: 40, m: 69, from: null });   // a long held note: past every recording's end
  Object.values(a.state.mix).forEach(m => { m.solo = false; });
  a.state.mix.vocal.solo = true;
  a.state.vocalStyle = 'auto'; a.state.palette = 'orchestral';
  assert.ok(['violin', 'flute', 'piano'].includes(a.toplineId(a.state.song)), 'orchestral palette uses acoustic toplines');
  a.state.palette = 'hybrid';
  for (const id of Object.keys(a.TOPLINES)) {
    a.state.vocalStyle = id;
    const buf = await a.renderBar(p), ch = buf.getChannelData(0);
    let peak = 0, sum = 0; for (const x of ch) { peak = Math.max(peak, Math.abs(x)); sum += x * x; }
    const rms = Math.sqrt(sum / ch.length);
    if (process.env.LEVELS) console.log(id, rms.toFixed(4), peak.toFixed(3));
    assert.ok(Number.isFinite(peak) && peak < 3, `${id} peak ${peak.toFixed(2)}`);
    assert.ok(rms > 0.003, `${id} is nearly silent (rms ${rms.toFixed(4)})`);
  }
  a.state.mix.vocal.solo = false; a.state.vocalStyle = 'auto';
});
