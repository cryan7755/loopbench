// Score generated songs with the critic.  npm run critic -- [songs per genre, default 8] [genre ...]
import { loadApp } from '../tests/harness.mjs';
const app = loadApp();
const args = process.argv.slice(2), per = +args.find(a => /^\d+$/.test(a)) || 8;
const genres = args.filter(a => app.STYLES[a]); const list = genres.length ? genres : Object.keys(app.STYLES);
const keys = ['overall', 'melody', 'harmony', 'ensemble', 'counterpoint', 'energy', 'structure'];
const totals = Object.fromEntries(keys.map(k => [k, 0])); let count = 0;
console.log('genre'.padEnd(14) + keys.map(k => k.slice(0, 11).padStart(13)).join(''));
for (const g of list) {
  const acc = Object.fromEntries(keys.map(k => [k, 0]));
  for (let i = 0; i < per; i++) {
    const r = app.songReport(app.makeSong(g));
    acc.overall += r.overall; for (const k of keys.slice(1)) acc[k] += r.scores[k];
  }
  for (const k of keys) { totals[k] += acc[k]; acc[k] /= per; }
  count += per;
  console.log(app.STYLES[g].label.padEnd(14) + keys.map(k => acc[k].toFixed(0).padStart(13)).join(''));
}
console.log('ALL'.padEnd(14) + keys.map(k => (totals[k] / count).toFixed(1).padStart(13)).join(''));
