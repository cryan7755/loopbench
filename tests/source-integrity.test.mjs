import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceFiles, appSource} from '../scripts/bundle.mjs';
test('bundled source includes percussion engine',()=>{
 assert.ok(sourceFiles().includes('22-percussion.js'));
 assert.match(appSource(), /function percussionFor\s*\(/);
});
