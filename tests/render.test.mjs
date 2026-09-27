// Renders real audio offline and checks levels. Catches silent parts and runaway gain bugs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp } from './harness.mjs';

let OfflineAudioContext;
try { ({ OfflineAudioContext } = await import('node-web-audio-api')); } catch { /* optional */ }

const measure = buf => {
  const ch = buf.getChannelData(0); let peak = 0, sum = 0;
  for (const x of ch) { const a = Math.abs(x); if (!Number.isFinite(x)) return { peak: Infinity, rms: Infinity }; if (a > peak) peak = a; sum += x * x; }
  return { peak, rms: Math.sqrt(sum / ch.length) };
};

test('sections render at sane levels in every sound palette', { skip: !OfflineAudioContext && 'node-web-audio-api not installed', timeout: 240000 }, async () => {
  const app = loadApp({ offlineAudio: OfflineAudioContext });
  await app.useOfflineAudio(OfflineAudioContext);
  assert.ok(app.sampleBufs.piano?.length && app.sampleBufs.voice_oohs?.length, 'samples decoded');
  for (const [style, palette, vocals] of [['trance', 'hybrid', 'oohs'], ['dubstep', 'electronic', 'synth'], ['deephouse', 'orchestral', 'choir'], ['hardstyle', 'hybrid', 'oohs']]) {
    Object.assign(app.state, { palette, vocalStyle: vocals });
    app.state.song = app.makeSong(style); app.state.bpm = app.state.song.bpm;
    for (const sec of app.arr()) {
      const { peak, rms } = measure(await app.renderBar(app.generateBar(sec.start + Math.floor(sec.bars / 2))));
      const where = `${style}/${palette}: ${sec.label}`;
      assert.ok(peak < 6, `${where} peak ${peak.toFixed(2)} is too hot`);
      assert.ok(rms > 0.005, `${where} is nearly silent (rms ${rms.toFixed(4)})`);
    }
  }
});

test('band genres render with guitars and a live kit', { skip: !OfflineAudioContext && 'node-web-audio-api not installed', timeout: 240000 }, async () => {
  const app = loadApp({ offlineAudio: OfflineAudioContext });
  await app.useOfflineAudio(OfflineAudioContext);
  assert.ok(app.sampleBufs.gtr?.length && app.sampleBufs.rockkit?.length, 'guitar and kit samples decoded');
  for (const style of ['rock', 'metal', 'pop', 'altrock', 'dancepop']) {
    Object.assign(app.state, { palette: 'hybrid', vocalStyle: 'oohs' });
    app.state.song = app.makeSong(style); app.state.bpm = app.state.song.bpm;
    for (const sec of app.arr()) {
      const { peak, rms } = measure(await app.renderBar(app.generateBar(sec.start + Math.floor(sec.bars / 2))));
      assert.ok(peak < 6 && rms > 0.005, `${style}: ${sec.label} peak ${peak.toFixed(2)} rms ${rms.toFixed(4)}`);
    }
  }
});
