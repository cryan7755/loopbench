/* SFZ multisample instrument loader: basic key, pitch and velocity mappings. */
function sfzRegions(source){
 const tokens=[...source.replace(/\/\*[\s\S]*?\*\//g,'').replace(/(^|\s)\/\/[^\n]*/g,'$1').matchAll(/<(global|group|region)>|([a-z][a-z0-9_]*)=([^\s<>]+)/gi)];
 let global={},group={},region=null,section='',result=[];
 for(const t of tokens){
  if(t[1]){section=t[1].toLowerCase();if(section==='global'){global={};group={};region=null;}else if(section==='group'){group={...global};region=null;}else{region={...group};result.push(region);}}
  else {let k=t[2].toLowerCase(),val=t[3];if(section==='global')global[k]=val;else if(section==='group')group[k]=val;else if(region)region[k]=val;}
 }
 return result.filter(r=>r.sample);
}
function sfzMidi(v,otherwise){
 if(v==null)return otherwise;
 if(/^\d+$/.test(v))return +v;
 const m=String(v).match(/^([A-Ga-g])([#b]?)(-?\d+)$/);if(!m)return NaN;
 return 12*(+m[3]+1)+({c:0,d:2,e:4,f:5,g:7,a:9,b:11}[m[1].toLowerCase()])+(m[2]==='#'?1:m[2]==='b'?-1:0);
}
async function importSfz(files,bank){
 const map=files.find(f=>f.name.toLowerCase().endsWith('.sfz'));
 if(!map)throw new Error('Select one SFZ mapping and its audio files.');
 const regions=sfzRegions(await map.text());
 if(!regions.length||regions.length>512)throw new Error('Expected 1–512 sample regions.');
 const assets=new Map();
 for(const f of files){
  if(!/\.(wav|mp3|ogg|flac)$/i.test(f.name))continue;
  const path=(f.webkitRelativePath||f.name).replace(/\\/g,'/').toLowerCase();
  assets.set(path,f);assets.set(f.name.toLowerCase(),f);
  const bits=path.split('/');if(bits.length>1)assets.set(bits.slice(1).join('/'),f);
 }
 const mapped=regions.map(r=>{
  const name=r.sample.replace(/\\/g,'/').replace(/^\.\//,'').toLowerCase();
  const file=assets.get(name)||assets.get(name.split('/').pop());
  if(!file)throw new Error('Missing recording '+r.sample);
  const m=sfzMidi(r.pitch_keycenter,sfzMidi(r.key,60));
  const lokey=sfzMidi(r.lokey,sfzMidi(r.key,0)),hikey=sfzMidi(r.hikey,sfzMidi(r.key,127));
  const lovel=+(r.lovel??0),hivel=+(r.hivel??127);
  if(![m,lokey,hikey,lovel,hivel].every(Number.isFinite)||m<0||m>127||lokey<0||hikey>127||lokey>hikey||lovel<0||hivel>127||lovel>hivel)throw new Error('Invalid region '+r.sample);
  return {file,m,lokey,hikey,lovel,hivel};
 });
 ensureAudio();const cache=new Map(),zones=[];
 for(const r of mapped){
  let buf=cache.get(r.file);
  if(!buf){buf=await ctx.decodeAudioData(await r.file.arrayBuffer());cache.set(r.file,buf);}
  zones.push({m:r.m,buf,lokey:r.lokey,hikey:r.hikey,lovel:r.lovel,hivel:r.hivel});
 }
 sampleBufs[bank]=zones;
 return {regions:zones.length,recordings:cache.size};
}
const sfzBank=document.getElementById('sfzBank'),sfzFiles=document.getElementById('sfzFiles'),sfzStatus=document.getElementById('sfzStatus');
for(const name of Object.keys(PATCHES).filter(n=>PATCHES[n].sample)){
 const opt=document.createElement('option');opt.value=PATCHES[name].sample;opt.textContent=name;sfzBank.appendChild(opt);
}
document.getElementById('sfzLoad').onclick=()=>sfzFiles.click();
sfzFiles.onchange=async()=>{
 const files=[...sfzFiles.files];sfzFiles.value='';if(!files.length)return;
 sfzStatus.textContent='Decoding samples…';
 try{const r=await importSfz(files,sfzBank.value);sfzStatus.textContent='Loaded '+r.regions+' zones from '+r.recordings+' recordings. Try playback now.';}
 catch(e){sfzStatus.textContent='Import failed: '+e.message;console.error(e);}
};
