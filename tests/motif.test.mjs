// Motifs: one melodic idea runs through the song.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp } from './harness.mjs';

const app = loadApp();
const styles = Object.keys(app.STYLES);
const songs = Array.from({ length: 240 }, (_, k) => app.makeSong(styles[k % styles.length]));
const opening = (line, n) => { const f = line.notes.filter(x => x.bar === 0), iv = []; for (let k = 1; k < f.length && iv.length < n; k++) iv.push(Math.sign(f[k].deg - f[k - 1].deg)); return iv; };
const agree = (a, b) => { const n = Math.min(a.length, b.length); if (!n) return 0; let m = 0; for (let k = 0; k < n; k++) if (a[k] === b[k]) m++; return m / n; };

test("the chorus vocal sings the hook's motif (and a different song's motif does not match as well)", () => {
  let own = 0, other = 0;
  songs.forEach((s, k) => {
    const motif = app.songMotif(s).map(Math.sign), line = opening(s.vocal, motif.length);
    own += agree(motif, line);
    other += agree(app.songMotif(songs[(k + 7) % songs.length]).map(Math.sign), line);
  });
  own /= songs.length; other /= songs.length;
  assert.ok(own > 0.6, `chorus vocals follow their motif only ${(100 * own).toFixed(0)}% of the time`);
  assert.ok(own > other + 0.15, `own motif ${(100 * own).toFixed(0)}% vs another song's ${(100 * other).toFixed(0)}%`);
});

test('the pre-chorus climbs toward the chorus', () => {
  let climbs = 0;
  for (const s of songs) {
    const half = s.preVocal.bars / 2, mean = a => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
    const early = mean(s.preVocal.notes.filter(n => n.bar < half).map(n => n.deg)), late = mean(s.preVocal.notes.filter(n => n.bar >= half).map(n => n.deg));
    if (late > early) climbs++;
  }
  assert.ok(climbs / songs.length > 0.7, `only ${(100 * climbs / songs.length).toFixed(0)}% of pre-choruses climb`);
});

test("the chorus holds the song's highest sung note", () => {
  let ok = 0;
  for (const s of songs) { const top = l => Math.max(...l.notes.map(n => n.deg)); if (top(s.vocal) >= Math.max(top(s.verseVocal), top(s.preVocal))) ok++; }
  assert.ok(ok / songs.length > 0.97, `the chorus peaks highest in only ${(100 * ok / songs.length).toFixed(0)}% of songs`);
});

test('verses end open and choruses land home', () => {
  let open = 0, home = 0;
  for (const s of songs) { if (((s.verseVocal.notes.at(-1).deg % 7) + 7) % 7 !== 0) open++; if ([0, 2, 4].includes(((s.vocal.notes.at(-1).deg % 7) + 7) % 7)) home++; }
  assert.ok(open / songs.length > 0.8, `only ${(100 * open / songs.length).toFixed(0)}% of verses end open`);
  assert.ok(home / songs.length > 0.8, `only ${(100 * home / songs.length).toFixed(0)}% of choruses land on a home-chord note`);
});

test('appoggiaturas appear and always resolve by step', () => {
  let songsWith = 0;
  for (const s of songs) {
    let any = false;
    for (const line of [s.vocal, s.verseVocal, s.preVocal]) {
      const prog = s[line.progName || 'prog'];
      line.notes.forEach((n, i) => {
        if (n.s % 4 !== 0) return;
        if (app.isChordTone(s, n.deg, app.rootAtBar(s, prog, n.bar))) return;
        const nx = line.notes[i + 1];
        assert.ok(nx && Math.abs(nx.deg - n.deg) === 1 && app.isChordTone(s, nx.deg, app.rootAtBar(s, prog, nx.bar)), `${app.songCode(s)}: unresolved strong-beat dissonance`);
        any = true;
      });
    }
    if (any) songsWith++;
  }
  assert.ok(songsWith / songs.length > 0.15, `appoggiaturas in only ${(100 * songsWith / songs.length).toFixed(0)}% of songs`);
});
