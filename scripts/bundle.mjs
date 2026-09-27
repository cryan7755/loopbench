// Assembles the single-file app from src/ and assets/. No dependencies.
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');

/** App source files, in load order (the numeric prefix sets the order). */
export function sourceFiles() {
  return readdirSync(SRC).filter(f => /^\d\d-.*\.js$/.test(f)).sort();
}

/** The app's JavaScript as one string. Files share one global scope, exactly as in the browser. */
export function appSource() {
  return sourceFiles()
    .map(f => `// ---- src/${f} ----\n` + readFileSync(join(SRC, f), 'utf8'))
    .join('');
}

const b64 = p => readFileSync(p).toString('base64');
const byNote = (a, b) => parseFloat(a) - parseFloat(b);

/** Embedded audio: instrument samples (MP3) and vocal samples (WAV with loop points). */
export function sampleSource() {
  const samples = {}, vocals = {};
  const sdir = join(ROOT, 'assets', 'samples'), vdir = join(ROOT, 'assets', 'vocals');
  for (const bank of readdirSync(sdir).sort()) {
    samples[bank] = {};
    for (const f of readdirSync(join(sdir, bank)).filter(f => f.endsWith('.mp3')).sort(byNote))
      samples[bank][f.replace(/\.mp3$/, '')] = b64(join(sdir, bank, f));
  }
  for (const bank of readdirSync(vdir).filter(d => !d.endsWith('.json')).sort()) {
    vocals[bank] = {};
    for (const f of readdirSync(join(vdir, bank)).filter(f => f.endsWith('.wav')).sort(byNote))
      vocals[bank][f.replace(/\.wav$/, '')] = b64(join(vdir, bank, f));
  }
  const loops = JSON.parse(readFileSync(join(vdir, 'loops.json'), 'utf8'));
  return [
    '/* Recorded instruments: string sections, solo violin, contrabass, harp and orchestral percussion from the',
    '   Versilian Studios Chamber Orchestra 2 CE; grand piano, hand claps, hi-hats, snare and shaker from the',
    '   Versilian Community Sample Library; electric guitar from Karoryfer Black and Green Guitars; acoustic',
    '   drum kit from Virtuosity Drums. All public domain (CC0). See LICENSES/. */',
    'const SAMPLE_DATA = ' + JSON.stringify(samples) + ';',
    '/* Sung vowels: Concert Choir and Voice Oohs from GeneralUser GS v1.471 by S. Christian Collins. See LICENSES/. */',
    'const VOX_DATA = ' + JSON.stringify(vocals) + ';',
    'const VOX_LOOPS = ' + JSON.stringify(loops) + ';',
  ].join('\n');
}

/** The complete, self-contained HTML page. */
export function html() {
  const shell = readFileSync(join(SRC, 'index.template.html'), 'utf8');
  return shell
    .replace('<!-- @SAMPLES -->', () => '<script>\n' + sampleSource() + '\n</script>')
    .replace('<!-- @APP -->', () => '<script>\n' + appSource() + '</script>');
}
