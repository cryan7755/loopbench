import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
const root = new URL('../', import.meta.url);
const studio = readFileSync(new URL('../src/studio.template.html', import.meta.url),'utf8');
const build = readFileSync(new URL('../scripts/build.mjs', import.meta.url),'utf8');
test('rebuilt studio provides independent audio instrument paths',()=>{
  for(const part of ["kind==='kick'","kind==='snare'","kind==='sub'","kind==='reese'"]) assert.ok(studio.includes(part),part);
  assert.match(studio,/function schedule\(/);
  assert.match(studio,/async function play\(/);
});
test('minor-key harmony and independent Reese envelope',()=>{
  assert.match(studio,/function chordNotes\(/);
  assert.match(studio,/MINOR\[degree\]/);
  assert.match(studio,/detFilter\.connect\(dg\\)/);
  assert.match(studio,/phrase===7/);
});
test('studio schedules audio incrementally rather than rendering entire song',()=>{
  assert.match(studio,/current\+3/);
  assert.match(studio,/schedule\(plan,startTime,g,scheduled,target\)/);
});
test('build defaults to studio and retains legacy app',()=>{
  assert.match(build,/studio\.template\.html/);
  assert.match(build,/legacy\.html/);
});
