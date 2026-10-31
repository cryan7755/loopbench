import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const studio=readFileSync(new URL('../src/studio.template.html',import.meta.url),'utf8');
const build=readFileSync(new URL('../scripts/build.mjs',import.meta.url),'utf8');
test('studio uses deterministic synthesized drum samples, not unverified legacy recordings',()=>{
 assert.ok(!studio.includes('async function loadRecordedKit()'));
 assert.ok(studio.includes('src.buffer=drumKit[kind]'));
 assert.ok(!studio.includes('src.buffer=recordedKit?.[kind]'));
 assert.ok(studio.includes('if(token!==playToken)return'));
 assert.ok(studio.includes('g.feedback.disconnect()'));
 assert.ok(studio.includes('function percussion('));
});
test('Reese voice passes through its own filter and envelope',()=>{
 assert.ok(studio.includes('detFilter.connect(dg)'));
});
test('eight-bar DnB phrasing and section-aware drum patterns',()=>{
 assert.ok(studio.includes('phrase=local%8'));
 assert.ok(studio.includes('phrase===7'));
 assert.ok(studio.includes('for(const ghost of'));
 assert.ok(studio.includes('function schedule('));
});
test('async playback schedules incremental bars',()=>{
 assert.ok(studio.includes('async function play()'));
 assert.ok(studio.includes('current+3'));
 assert.ok(studio.includes('schedule(plan,startTime,g,scheduled,target)'));
});
test('studio is default, legacy retained without bloating studio with legacy samples',()=>{
 for(const item of ['studio.template.html','legacy.html','GROOVE-02'])assert.ok(build.includes(item));
 assert.ok(!build.includes('sampleSource()'));
});
