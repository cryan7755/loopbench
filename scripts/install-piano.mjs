// Download the CC0 FreePats Kawai upright piano and encode the recordings
// for Loopbench's self-contained HTML build. The repository's basic piano stays
// available for offline builds; CI opts into the upgraded recordings.
import {mkdir,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {ROOT} from './bundle.mjs';
const run=promisify(execFile);
const base='https://raw.githubusercontent.com/freepats/upright-piano-KW/master/';
const sfz=await (await fetch(base+'UprightPianoKW-20220221.sfz')).text();
if(!sfz.includes('sample=samples/'))throw Error('Upstream piano SFZ unavailable');
let group={},region=null,zones=[];
for(const raw of sfz.split(/\r?\n/)){
 const line=raw.replace(/\/\/.*$/,'').trim();
 if(!line)continue;
 if(line==='<group>'){group={};region=null;continue;}
 if(line==='<region>'){region={...group};zones.push(region);continue;}
 const m=line.match(/^([a-z_]+)\s*=\s*(\S+)/i);
 if(!m)continue;
 if(region)region[m[1]]=m[2];else group[m[1]]=m[2];
}
zones=zones.filter(z=>z.sample&&z.pitch_keycenter);
if(zones.length<40)throw Error('Unexpectedly small piano mapping: '+zones.length);
const dir=join(ROOT,'assets','samples','piano-hq');
await rm(dir,{recursive:true,force:true});await mkdir(dir,{recursive:true});
const unique=new Map();
for(const z of zones){
 const midi=Number(z.pitch_keycenter),low=Number(z.lovel??0),high=Number(z.hivel??127);
 if(!Number.isFinite(midi)||!Number.isFinite(low)||!Number.isFinite(high))throw Error('Bad SFZ region');
 const dest=join(dir,midi+'-'+low+'-'+high+'.mp3');
 unique.set(dest,z.sample);
}
for(const [dest,path] of unique){
 const url=base+path.split('/').map(encodeURIComponent).join('/');
 const response=await fetch(url);
 if(!response.ok)throw Error('Missing recording '+url+' ('+response.status+')');
 const temp=dest+'.flac';
 await writeFile(temp,Buffer.from(await response.arrayBuffer()));
 try{await run('ffmpeg',['-nostdin','-hide_banner','-loglevel','error','-y','-i',temp,'-codec:a','libmp3lame','-q:a','3',dest]);}
 finally{await rm(temp,{force:true});}
}
console.log('Installed',unique.size,'CC0 piano recordings into',dir);
