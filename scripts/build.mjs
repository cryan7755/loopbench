// Usage: npm run build            -> dist/loopbench.html (+ dist/index.html for hosting)
//        npm run build -- --watch -> rebuild whenever src/ or assets/ change
import { mkdirSync, writeFileSync, readFileSync, watch } from 'node:fs';
import { join } from 'node:path';
import { ROOT, html } from './bundle.mjs';

function build() {
  const t0 = Date.now(), legacy = html(), source = readFileSync(join(ROOT, 'src', 'studio.template.html'), 'utf8'), buildId = 'AUDIO-85945d34', page = source.replace('</title>', `</title><meta name="loopbench-build" content="${buildId}">`).replace('STUDIO / 01', `STUDIO / ${buildId}`), dist = join(ROOT, 'dist');
  mkdirSync(dist, { recursive: true });
  writeFileSync(join(dist, 'loopbench.html'), page);
  writeFileSync(join(dist, 'index.html'), page);
  writeFileSync(join(dist, 'legacy.html'), legacy);
  console.log(`Loopbench build ID: ${buildId}`);
  console.log(`built dist/loopbench.html (${(page.length / 1e6).toFixed(2)} MB) in ${Date.now() - t0} ms`);
}

build();
if (process.argv.includes('--watch')) {
  let timer;
  const again = () => { clearTimeout(timer); timer = setTimeout(() => { try { build(); } catch (e) { console.error(e.message); } }, 150); };
  for (const dir of ['src', 'assets']) watch(join(ROOT, dir), { recursive: true }, again);
  console.log('watching src/ and assets/ ...');
}
