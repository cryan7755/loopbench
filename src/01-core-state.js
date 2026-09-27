// Version of the song-writing rules; part of every song code. Defined first because the
// interface uses it while loading, before the later source files have run.
const COMPOSER_VERSION = 4;
const STEPS = 16, ROWS = 13, KEY = 'loopbench-v1';
const DRUMS = [
  {id:'kick',  name:'Kick',       color:'#F2A93B'},
  {id:'snare', name:'Snare',      color:'#EF6F6C'},
  {id:'clap',  name:'Clap',       color:'#E86BB0'},
  {id:'chat',  name:'Closed hat', color:'#3CC2B0'},
  {id:'ohat',  name:'Open hat',   color:'#5AB0F0'},
  {id:'tom',   name:'Tom',        color:'#A48BF5'},
  {id:'crash', name:'Crash',      color:'#F5D76E'},
  {id:'shaker',name:'Shaker',     color:'#7FD8C8'},
  {id:'rim',   name:'Rim',        color:'#F09A6B'},
  {id:'bell',  name:'Cowbell',    color:'#D4B483'},
];
const LAYERS = [
  {id:'lead',   name:'Lead',   color:'#9CCB4E'},
  {id:'chords', name:'Chords', color:'#E9A6D8'},
  {id:'arp',    name:'Arp',    color:'#6FC3FF'},
  {id:'sub',    name:'Sub',    color:'#8A93F0'},
  {id:'vocal',  name:'Vocals', color:'#FF8FB1'},
  {id:'wall',   name:'Chord wall', color:'#F7B267'},
  {id:'counter',name:'Counter melody', color:'#B8E1FF'},
  {id:'gtr',    name:'Guitars', color:'#E0703C'},
  {id:'fx',     name:'Riser and impact', color:'#C8CED6'},
];
const SYNTH_COLOR = '#9CCB4E';
const NOTE_NAMES = ['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];
const BLACK = new Set([1,3,6,8,10]);

function emptyPattern(){
  return { drums: DRUMS.map(()=>Array(STEPS).fill(false)),
           notes: Array.from({length:ROWS},()=>Array(STEPS).fill(false)) };
}
function demoPattern(){
  const p = emptyPattern();
  const set = (arr, steps) => steps.forEach(s => arr[s] = true);
  set(p.drums[0],[0,4,8,12]); set(p.drums[1],[4,12]); set(p.drums[2],[12]);
  set(p.drums[3],[2,6,10,14]); set(p.drums[4],[14]);
  [[0,0],[0,3],[3,6],[7,8],[5,11],[3,14]].forEach(([r,s]) => p.notes[r][s] = true);
  return p;
}
function defaults(){
  const mix = {};
  DRUMS.forEach(d => mix[d.id] = {vol:0.8, mute:false, solo:false});
  mix.synth = {vol:0.6, mute:false, solo:false};
  LAYERS.forEach(l => mix[l.id] = {vol:0.7, mute:false, solo:false});
  return { bpm:120, swing:0, master:0.8, current:0, chain:false,
           patterns:[demoPattern(), emptyPattern(), emptyPattern(), emptyPattern()],
           mix, synth:{wave:'sawtooth', cutoff:1800, octave:2} };
}
function load(){
  try{
    const raw = localStorage.getItem(KEY);
    if(!raw) return null;
    const s = JSON.parse(raw);
    if(!s || !Array.isArray(s.patterns) || s.patterns.length !== 4) return null;
    return s;
  }catch(e){ return null; }
}
const base = defaults(), loaded = load();
const state = loaded ? {...base, ...loaded,
  mix: Object.fromEntries(Object.keys(base.mix).map(k => [k, {...base.mix[k], ...(loaded.mix||{})[k]}])),
  synth: {...base.synth, ...(loaded.synth||{})}} : base;
state.patterns.forEach(p => { while(p.drums.length < DRUMS.length) p.drums.push(Array(STEPS).fill(false)); });

let saveTimer;
function save(){
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { try{ localStorage.setItem(KEY, JSON.stringify(state)); }catch(e){} }, 300);
}
const pat = () => (state.endless && genView) ? genView : state.patterns[state.current];
const syn = () => pat().synth || state.synth;
const isEmpty = i => { const p = state.patterns[i]; return !p.drums.some(r=>r.some(Boolean)) && !p.notes.some(r=>r.some(Boolean)); };
