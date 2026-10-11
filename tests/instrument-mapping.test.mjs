import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../src/25-instrument-packs.js',import.meta.url),'utf8');
// Load only the pure SFZ mapping helpers, without browser controls or audio context.
const helpers=source.slice(0,source.indexOf('async function importSfz('));
const {sfzRegions,sfzMidi}=new Function(helpers+';return {sfzRegions,sfzMidi};')();
test('SFZ global opcodes apply when regions appear before any group',()=>{
 const zones=sfzRegions('<global> lokey=40 hikey=70 lovel=20 <region> sample=a.wav pitch_keycenter=60');
 assert.deepEqual(zones,[{lokey:'40',hikey:'70',lovel:'20',sample:'a.wav',pitch_keycenter:'60'}]);
});
test('SFZ groups override globals without leaking into later groups',()=>{
 const zones=sfzRegions('<global> lovel=10 <group> lovel=90 <region> sample=a.wav <group> hikey=60 <region> sample=b.wav');
 assert.equal(zones[0].lovel,'90');
 assert.equal(zones[1].lovel,'10');
 assert.equal(zones[1].hikey,'60');
});
test('SFZ comments are ignored and note names map to MIDI',()=>{
 const zones=sfzRegions('// comment\n<region> sample=piano.wav key=C4 // trailing');
 assert.equal(zones.length,1);
 assert.equal(zones[0].key,'C4');
 assert.equal(sfzMidi('C4',-1),60);
 assert.equal(sfzMidi('Bb3',-1),58);
 assert.equal(sfzMidi('unrecognized',-1),Number.NaN);
});
