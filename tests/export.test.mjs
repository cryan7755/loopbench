import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp } from './harness.mjs';

const app = loadApp();

test('MIDI export is a valid multitrack file with section markers', async () => {
  app.state.song = app.makeSong('trance'); app.state.bpm = app.state.song.bpm;
  const bytes = new Uint8Array(await app.buildMidi().arrayBuffer());
  const text = (o, n) => String.fromCharCode(...bytes.slice(o, o + n));
  const u32 = o => (bytes[o] << 24 | bytes[o + 1] << 16 | bytes[o + 2] << 8 | bytes[o + 3]) >>> 0;
  assert.equal(text(0, 4), 'MThd');
  const format = bytes[9], tracks = bytes[10] << 8 | bytes[11];
  assert.equal(format, 1);
  let o = 14, notes = 0, names = [];
  for (let t = 0; t < tracks; t++) {
    assert.equal(text(o, 4), 'MTrk', `track ${t} header`);
    const len = u32(o + 4), body = bytes.slice(o + 8, o + 8 + len);
    for (let i = 0; i < body.length - 2; i++) if ((body[i] & 0xF0) === 0x90 && body[i + 2] > 0) notes++;
    const nameAt = body.findIndex((b, i) => b === 0xFF && body[i + 1] === 0x03);
    if (nameAt >= 0) names.push(String.fromCharCode(...body.slice(nameAt + 3, nameAt + 3 + body[nameAt + 2])));
    o += 8 + len;
  }
  assert.equal(o, bytes.length, 'file length matches its tracks');
  for (const n of ['Drums', 'Bass', 'Lead', 'Vocal melody']) assert.ok(names.includes(n), `missing ${n} track`);
  assert.ok(notes > 1000, `only ${notes} notes`);
  const markers = Buffer.from(bytes).toString('latin1');
  for (const label of app.arr().map(s => s.label)) assert.ok(markers.includes(label), `missing marker ${label}`);
});

test('WAV encoder writes a correct 16-bit stereo header', async () => {
  const n = 1000, L = new Float32Array(n).fill(0.5), R = new Float32Array(n).fill(-0.5);
  const wav = new Uint8Array(await app.encodeWav({ sampleRate: 44100, getChannelData: c => (c ? R : L) }).arrayBuffer());
  const v = new DataView(wav.buffer);
  assert.equal(String.fromCharCode(...wav.slice(0, 4)), 'RIFF');
  assert.equal(v.getUint16(22, true), 2, 'channels');
  assert.equal(v.getUint32(24, true), 44100, 'sample rate');
  assert.equal(v.getUint16(34, true), 16, 'bits');
  assert.equal(v.getUint32(40, true), n * 4, 'data size');
  assert.equal(wav.length, 44 + n * 4);
});
