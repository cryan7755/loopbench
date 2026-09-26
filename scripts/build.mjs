// Usage: npm run build            -> dist/loopbench.html (+ dist/index.html for hosting)
//        npm run build -- --watch -> rebuild whenever src/ or assets/ change
import { mkdirSync, writeFileSync, watch } from 'node:fs';
import { join } from 'node:path';
import { ROOT, html } from './bundle.mjs';

function build() {
  const t0 = Date.now(), page = html(), dist = join(ROOT, 'dist');
  mkdirSync(dist, { recursive: true });
  writeFileSync(join(dist, 'loopbench.html'), page);
  writeFileSync(join(dist, 'index.html'), page);
  console.log(`built dist/loopbench.html (${(page.length / 1e6).toFixed(2)} MB) in ${Date.now() - t0} ms`);
}

build();
if (process.argv.includes('--watch')) {
  let timer;
  const again = () => { clearTimeout(timer); timer = setTimeout(() => { try { build(); } catch (e) { console.error(e.message); } }, 150); };
  for (const dir of ['src', 'assets']) watch(join(ROOT, dir), { recursive: true }, again);
  console.log('watching src/ and assets/ ...');
}
