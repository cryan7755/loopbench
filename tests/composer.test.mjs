// The "music critic": checks that generated harmony and melodies follow the composition rules.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp } from './harness.mjs';

const app = loadApp();
const songs = Array.from({ length: 120 }, (_, k) => app.makeSong(Object.keys(app.STYLES)[k % Object.keys(app.STYLES).length]));

test('progressions move with purpose and loop back home', () => {
  let endsWithPull = 0;
  for (const s of songs) for (const prog of [s.prog, s.bdProg]) {
    assert.equal(prog.length, 4);
    for (let i = 0; i < 4; i++) assert.notEqual(prog[i], prog[(i + 1) % 4], `repeated chord in ${prog}`);
    assert.ok(new Set(prog).size >= 3, `too little variety in ${prog}`);
    if (['D', 'PD'].includes(app.HARM_FUNC[prog[3]])) endsWithPull++;
  }
  assert.ok(endsWithPull / (songs.length * 2) > 0.8, `only ${endsWithPull} of ${songs.length * 2} progressions lead back home`);
  assert.ok(songs.every(s => s.bdProg.join() !== s.prog.join()), 'breakdown uses the same progression as the drop');
});

test('chord voicings move smoothly', () => {
  let total = 0, moves = 0;
  for (const s of songs) {
    const v = app.voicingsFor(s, s.prog);
    for (let i = 0; i < 4; i++) {
      const a = v[i], b = v[(i + 1) % 4], n = Math.min(a.length, b.length);
      for (let k = 0; k < n; k++) { total += Math.abs(a[k] - b[k]); moves++; }
      assert.ok(a.every(m => m >= 53 && m <= 79), `voicing ${a} out of range`);
    }
  }
  assert.ok(total / moves <= 3, `voices move ${(total / moves).toFixed(2)} semitones on average`);
});

test('hooks put chord tones on strong beats and end on a long, stable note', () => {
  for (const s of songs) {
    const H = s.dropHook, sc = app.SCALES[s.scale];
    for (const n of H.notes) if (n.s % 4 === 0) assert.ok(app.isChordTone(s, n.deg, app.rootAtBar(s, s.prog, n.bar)), `${app.songCode(s)}: non-chord tone on a strong beat`);
    const last = H.notes[H.notes.length - 1];
    assert.ok(app.isChordTone(s, last.deg, app.rootAtBar(s, s.prog, last.bar)), `${app.songCode(s)}: hook ends off the chord`);
    assert.ok(last.dur >= 3, `${app.songCode(s)}: hook ends on a short note`);
    const pitches = H.notes.map(n => app.scaleNote(sc, n.deg));
    assert.ok(Math.max(...pitches) - Math.min(...pitches) <= 17, `${app.songCode(s)}: hook range too wide`);
  }
});

test('leaps are mostly resolved and melodies are neither static nor random', () => {
  const avg = k => songs.reduce((a, s) => a + s.dropHook.rating[k], 0) / songs.length;
  assert.ok(avg('leapsResolved') >= 0.7, `leaps resolved ${avg('leapsResolved').toFixed(2)}`);
  assert.ok(avg('chordTones') >= 0.95, `strong-beat chord tones ${avg('chordTones').toFixed(2)}`);
  const p = avg('predictability');
  assert.ok(p > 0.2 && p < 0.8, `average predictability ${p.toFixed(2)} is outside the sweet spot`);
});

test('ranking picks clearly better melodies than a single random attempt', () => {
  let gain = 0;
  for (const s of songs.slice(0, 40)) {
    const o = app.hookOptions(s);
    app.seedWith('critic|' + s.seed);
    let sum = 0; for (let k = 0; k < 20; k++) sum += app.scoreLine(s, app.writeLine(s, o), o).score;
    gain += s.dropHook.rating.score - sum / 20;
  }
  assert.ok(gain / 40 > 2, `ranking only improves the score by ${(gain / 40).toFixed(2)}`);
});

test('vocal lines stay in a singable range and the verse sits lower than the chorus', () => {
  for (const s of songs.slice(0, 60)) {
    app.state.song = s;
    const all = { chorus: [], verse: [] };
    for (let i = 0; i < 8; i++) {
      all.chorus.push(...app.vocalBar(s, i, 0, [], 0, s.vocal).map(n => n.m));
      all.verse.push(...app.vocalBar(s, i, 0, [], 0, s.verseVocal).map(n => n.m));
    }
    for (const m of [...all.chorus, ...all.verse]) assert.ok(m >= 48 && m <= 82, `${app.songCode(s)}: vocal note ${m} out of range`);
    const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
    assert.ok(mean(all.verse) <= mean(all.chorus) + 1, `${app.songCode(s)}: verse sits above the chorus`);
  }
});

test('song codes carry the composer version; older codes are recognised', () => {
  const s = app.makeSong('trance'), code = app.songCode(s);
  assert.match(code, new RegExp(`-v${app.COMPOSER_VERSION}$`));
  assert.equal(app.parseCode(code).fromVersion, app.COMPOSER_VERSION);
  assert.equal(app.parseCode(code.replace(/-v\d+$/, '')).fromVersion, 1);
});

test('most hooks resolve to a note of the home chord', () => {
  const home = songs.filter(s => s.dropHook.rating.endsHome).length / songs.length;
  assert.ok(home >= 0.75, `only ${(home * 100).toFixed(0)}% of hooks end on a home-chord note`);
});

test('hooks keep one rhythm through the phrase, changing only at the ending', () => {
  for (const s of songs) {
    const bars = {}; s.dropHook.notes.forEach(n => (bars[n.bar] = bars[n.bar] || []).push(n.s));
    const rhythms = new Set(Object.values(bars).map(a => a.join(',')));
    assert.ok(rhythms.size <= 3, `${app.songCode(s)}: ${rhythms.size} different rhythms in one hook`);
    const counts = {}; Object.values(bars).forEach(a => counts[a.join(',')] = (counts[a.join(',')] || 0) + 1);
    assert.ok(Math.max(...Object.values(counts)) >= Object.keys(bars).length / 2, `${app.songCode(s)}: no rhythm dominates the hook`);
  }
});
