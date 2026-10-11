import { sourceFiles, appSource } from './bundle.mjs';
import assert from 'node:assert/strict';
const sources = sourceFiles();
assert.ok(sources.includes('22-percussion.js'), 'Missing src/22-percussion.js');
const source = appSource();
assert.match(source, /function percussionFor\s*\(/, 'Percussion function not included in bundle');
assert.match(source, /PERC_CHARACTER/, 'Percussion constants missing');
console.log('Source integration verified:', sources.length, 'modules');
