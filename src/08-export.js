/* ---------- Export: WAV (full mix) and MIDI (every part on its own track) ---------- */
async function renderSongAudio(onProgress){
  ensureAudio();
  const sd = stepDur(), barLen = sd*16, sr = ctx.sampleRate;
  const total = Math.ceil((totalBars()*barLen + TAIL)*sr);
  const L = new Float32Array(total), R = new Float32Array(total);
  let next = 0, done = 0;
  const worker = async () => {
    while(next < totalBars()){
      const n = next++, p = generateBar(n), buf = await renderBar(p);
      const off = Math.round(n*barLen*sr), l = buf.getChannelData(0), r = buf.getChannelData(1);
      const m = Math.min(l.length, total - off);
      for(let i=0;i<m;i++){ L[off+i] += l[i]; R[off+i] += r[i]; }
      onProgress(++done / totalBars() * 0.9);
    }
  };
  await Promise.all(Array.from({length:4}, worker));
  // same output stage as live playback: trim, glue compressor, limiter
  const off = new OAC(2, total, sr), src = off.createBufferSource(), buf = off.createBuffer(2, total, sr);
  buf.copyToChannel(L, 0); buf.copyToChannel(R, 1); src.buffer = buf;
  const trim = off.createGain(); trim.gain.value = 0.4*state.master;
  const glue = off.createDynamicsCompressor(); glue.threshold.value = -14; glue.ratio.value = 3; glue.attack.value = 0.01; glue.release.value = 0.15;
  const limit = off.createDynamicsCompressor(); limit.threshold.value = -3; limit.ratio.value = 20; limit.attack.value = 0.002; limit.release.value = 0.08;
  src.connect(trim); trim.connect(glue); glue.connect(limit); limit.connect(off.destination); src.start(0);
  const out = await off.startRendering();
  // normalize so the file peaks just under full scale
  let pk = 0; for(let c=0;c<2;c++){ const d = out.getChannelData(c); for(let i=0;i<d.length;i++){ const a = Math.abs(d[i]); if(a > pk) pk = a; } }
  if(pk > 0){ const g = 0.89/pk; for(let c=0;c<2;c++){ const d = out.getChannelData(c); for(let i=0;i<d.length;i++) d[i] *= g; } }
  onProgress(1);
  return out;
}
function encodeWav(buf){
  const ch = [buf.getChannelData(0), buf.getChannelData(1)], len = ch[0].length, sr = buf.sampleRate;
  const ab = new ArrayBuffer(44 + len*4), v = new DataView(ab);
  const str = (o, t) => { for(let i=0;i<t.length;i++) v.setUint8(o+i, t.charCodeAt(i)); };
  str(0,'RIFF'); v.setUint32(4, 36 + len*4, true); str(8,'WAVE'); str(12,'fmt ');
  v.setUint32(16,16,true); v.setUint16(20,1,true); v.setUint16(22,2,true); v.setUint32(24,sr,true);
  v.setUint32(28,sr*4,true); v.setUint16(32,4,true); v.setUint16(34,16,true); str(36,'data'); v.setUint32(40,len*4,true);
  let o = 44;
  for(let i=0;i<len;i++) for(let c=0;c<2;c++){ const x = Math.max(-1, Math.min(1, ch[c][i])); v.setInt16(o, x < 0 ? x*0x8000 : x*0x7FFF, true); o += 2; }
  return new Blob([ab], {type:'audio/wav'});
}
const GM_DRUMS = {kick:36, snare:38, clap:39, chat:42, ohat:46, tom:45, crash:49, shaker:70, rim:37, bell:56};
function buildMidi(){
  const PPQ = 96, STEP = 24;
  const mk = (name, ch, program) => ({name, ch, program, ev:[]});
  const T = {drums: mk('Drums', 9), bass: mk('Bass', 0, 38), chords: mk('Chord stabs', 1, 50), pad: mk('Pad and chord wall', 2, 88),
             lead: mk('Lead', 3, 81), arp: mk('Arp', 4, 80), counter: mk('Counter melody', 5, 11), vocal: mk('Vocal melody', 6, 53)};
  const markers = [];
  const add = (tr, tick, note, len, vel = 100) => {
    note = Math.round(note); if(note < 0 || note > 127) return;
    vel = Math.max(1, Math.min(127, Math.round(vel)));
    tr.ev.push([tick, 1, 0x90 | tr.ch, note, vel], [tick + Math.max(1, Math.round(len)), 0, 0x80 | tr.ch, note, 0]);
  };
  const midiOf = (row, S) => 12*((S.octave || 2)+1) + row + (S.transpose || 0);
  const sw = s => s % 2 ? Math.round(STEP*state.swing/100*0.5) : 0;
  for(let n=0;n<totalBars();n++){
    const p = generateBar(n), base = n*16*STEP;
    if(p.barIn === 0) markers.push([base, p.label]);
    const g = id => (p.gain && p.gain[id]) || 1;
    for(let s=0;s<16;s++){
      const at = base + s*STEP + sw(s);
      DRUMS.forEach((d,i) => {
        if(!p.drums[i][s]) return;
        const vel = 100*g(d.id)*(s % 4 === 0 ? 1.1 : 0.9);
        add(T.drums, at, GM_DRUMS[d.id], 12, vel);
        if(p.half && p.half[d.id] && p.half[d.id].includes(s)) add(T.drums, at + 12, GM_DRUMS[d.id], 12, vel*0.9);
      });
      const S = p.synth || state.synth, bl = ((S.len || 0.9))*STEP;
      for(let r=0;r<ROWS;r++) if(p.notes[r][s]) add(T.bass, at, midiOf(r, S), bl);
      [[p.lead, p.leadSynth], [p.lead2, p.lead2Synth]].forEach(([line, LS]) => { if(line && LS) line.forEach(([r,st,d]) => { if(st === s) add(T.lead, at, midiOf(r, LS), (d || LS.len || 0.9)*STEP); }); });
      if(p.arp) p.arp.forEach(([r,st]) => { if(st === s) add(T.arp, at, 72 + p.arpT + r, STEP*0.5, 80); });
      if(p.counter) p.counter.forEach(([r,st]) => { if(st === s) add(T.counter, at, 72 + p.counterT + r, STEP*2, 85); });
      if(p.vocal) p.vocal.forEach(v => { if(v.s === s) add(T.vocal, at, v.m, v.len*STEP, v.chop ? 95 : 90); });
      if(p.chords && p.chords.steps.includes(s)) (p.chords.voiced || [...(p.chords.ext || p.chords.ints), 12].map(r => 60 + p.chords.T + r)).forEach(m => add(p.chords.len > 2 ? T.pad : T.chords, at, m, p.chords.len*STEP, 80));
      if(p.wall && s === 0) (p.wall.voiced ? [48 + p.wall.T, ...p.wall.voiced] : [48 + p.wall.T, 60 + p.wall.T + p.wall.ints[1], 60 + p.wall.T + p.wall.ints[2], 72 + p.wall.T]).forEach(m => add(T.pad, at, m, p.wall.len*STEP, 70));
    }
  }
  const bytes = [];
  const u32 = x => [x>>>24 & 255, x>>>16 & 255, x>>>8 & 255, x & 255], u16 = x => [x>>>8 & 255, x & 255];
  const vlq = x => { const out = [x & 127]; while((x >>>= 7)) out.unshift((x & 127) | 128); return out; };
  const text = str => Array.from(new TextEncoder().encode(str));
  const chunk = (events) => {
    events.sort((a,b) => a[0] - b[0] || a[1] - b[1]);
    const data = []; let last = 0;
    events.forEach(e => { data.push(...vlq(e[0] - last)); last = e[0]; data.push(...e.slice(2)); });
    data.push(0, 0xFF, 0x2F, 0);
    return [...text('MTrk'), ...u32(data.length), ...data];
  };
  const meta = (tick, type, payload) => [tick, 0, 0xFF, type, ...vlq(payload.length), ...payload];
  const song = state.song, tempo = Math.round(60000000 / state.bpm);
  const tracks = [chunk([meta(0, 0x03, text(song.title)), meta(0, 0x51, [tempo>>16 & 255, tempo>>8 & 255, tempo & 255]),
    meta(0, 0x58, [4, 2, 24, 8]), ...markers.map(([t, l]) => meta(t, 0x06, text(l)))])];
  Object.values(T).filter(tr => tr.ev.length).forEach(tr => {
    const head = [meta(0, 0x03, text(tr.name))];
    if(tr.program !== undefined) head.push([0, 0, 0xC0 | tr.ch, tr.program]);
    tracks.push(chunk(head.concat(tr.ev)));
  });
  bytes.push(...text('MThd'), ...u32(6), ...u16(1), ...u16(tracks.length), ...u16(PPQ));
  return new Blob([new Uint8Array(bytes), ...tracks.map(t => new Uint8Array(t))], {type:'audio/midi'});
}
// Store-only zip so the in-Claude viewer can deliver .wav/.mid, which its download allowlist doesn't include directly
const CRC_T = (() => { const t = new Uint32Array(256); for(let n=0;n<256;n++){ let c = n; for(let k=0;k<8;k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(u8){ let c = 0xFFFFFFFF; for(let i=0;i<u8.length;i++) c = CRC_T[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
async function zipOne(name, blob){
  const data = new Uint8Array(await blob.arrayBuffer()), nm = new TextEncoder().encode(name), crc = crc32(data);
  const le = (n, b) => Array.from({length:b}, (_,i) => (n >>> (8*i)) & 255);
  const local = [...le(0x04034b50,4), ...le(20,2), ...le(0,2), ...le(0,2), ...le(0,2), ...le(0,2), ...le(crc,4), ...le(data.length,4), ...le(data.length,4), ...le(nm.length,2), ...le(0,2), ...nm];
  const central = [...le(0x02014b50,4), ...le(20,2), ...le(20,2), ...le(0,2), ...le(0,2), ...le(0,2), ...le(0,2), ...le(crc,4), ...le(data.length,4), ...le(data.length,4), ...le(nm.length,2), ...le(0,2), ...le(0,2), ...le(0,2), ...le(0,2), ...le(0,4), ...le(0,4), ...nm];
  const end = [...le(0x06054b50,4), ...le(0,2), ...le(0,2), ...le(1,2), ...le(1,2), ...le(central.length,4), ...le(local.length + data.length,4), ...le(0,2)];
  return new Blob([new Uint8Array(local), data, new Uint8Array(central), new Uint8Array(end)], {type:'application/zip'});
}
let dlNS; if(window.claude && window.claude.use) window.claude.use('downloads').then(x => { dlNS = x; }, () => { dlNS = null; });
async function saveFile(name, blob){
  if(window.claude && window.claude.use){
    const dl = dlNS !== undefined ? dlNS : await window.claude.use('downloads').catch(() => null);
    if(dl){ await dl.save({filename: name.replace(/\.[^.]+$/, '') + '.zip', data: await zipOne(name, blob)}); return; }
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 60000);
}
function fmtTime(sec){ sec = Math.max(0, Math.round(sec)); return Math.floor(sec/60) + ':' + String(sec % 60).padStart(2,'0'); }
const INTRO_BARS = 8;
const PHASES = {intro:{label:'Intro', bars:INTRO_BARS}, groove:{label:'Beat', bars:8}, build:{label:'Build', bars:8}, drop:{label:'Drop', bars:16}};
