/* ---------- Render-ahead playback: each bar is rendered on its own background audio thread, then played as a finished buffer ---------- */
const TAIL = 2.4, OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
let songOver = false, endAt = null;
let rMode = false, rGen = 0, rItems = [], rT0 = null, rRel = 0, rTimer = null, rSources = [], rAhead = 3;
function renderBar(p){
  const sd = stepDur(), sr = ctx.sampleRate;
  const off = new OAC(2, Math.ceil((sd*16 + TAIL)*sr), sr);
  const g = makeGraph(off, true);
  useGraph(g);
  try{ for(let s=0;s<16;s++) playStep(p, s, s*sd + (s%2 ? sd*state.swing/100*0.5 : 0)); }
  finally{ useGraph(liveGraph); }
  return off.startRendering();
}
let sampleWait = 0;
function rPlan(){
  if(!playing || !rMode) return;
  if(!samplesReady && Date.now() < sampleWait) return;
  const now = ctx.currentTime;
  while(rT0 === null ? rItems.length < rAhead : rT0 + rRel < now + rAhead*stepDur()*16){
    const p = generateBar(Math.max(bar,0));
    if(!p){ if(endAt === null && rT0 !== null) endAt = rT0 + rRel + TAIL; songOver = true; break; }
    bar++;
    const item = {rel: rRel, p, sd: stepDur(), buf: null, started: false, gen: rGen};
    rRel += item.sd*16; rItems.push(item);
    renderBar(p).then(buf => { if(item.gen !== rGen || !playing) return; item.buf = buf; rStart(); })
                .catch(e => console.error('Render failed', e));
  }
}
function rStart(){
  const now = ctx.currentTime;
  if(rT0 === null){ if(!rItems.length || !rItems[0].buf) return; rT0 = now + 0.1; }
  rItems.forEach(it => {
    if(it.started || !it.buf) return;
    it.started = true;
    const start = rT0 + it.rel, src = ctx.createBufferSource(); src.buffer = it.buf; src.connect(liveGraph.master);
    if(start >= now) src.start(start);
    else if(now - start < it.sd*16){ src.start(now, now - start); rAhead = Math.min(8, rAhead + 1); }
    else return;
    const rec = {src, start, end: start + it.sd*16};
    rSources.push(rec); src.onended = () => { rSources = rSources.filter(r => r !== rec); };
    for(let st=0; st<16; st++) queue.push({s: st, t: start + st*it.sd + (st%2 ? it.sd*state.swing/100*0.5 : 0), pat: 0, p: it.p});
  });
  queue.sort((a,b) => a.t - b.t);
  rItems = rItems.filter(it => !it.started);
  rPlan();
}
// Throw away bars rendered for the old plan; keep the bar that's sounding now and continue right after it
function rReset(){
  rGen++;
  const now = ctx.currentTime; let end = now + 0.05;
  rSources = rSources.filter(r => {
    if(r.start > now + 0.02){ try{ r.src.stop(); }catch(e){} return false; }
    end = Math.max(end, r.end); return true;
  });
  rItems = []; songOver = false; endAt = null;
  queue = queue.filter(q => q.t < end - 0.001);
  rRel = rT0 === null ? 0 : end - rT0;
  rPlan();
}
function scheduler(){
  while(nextTime < ctx.currentTime + 0.3){
    if(state.endless && songOver){ if(endAt === null) endAt = nextTime + 3; break; }
    scheduleStep(step, nextTime);
    nextTime += stepDur();
    step++;
    if(step === STEPS){
      step = 0;
      if(state.endless){ bar++; genBar = generateBar(bar); if(!genBar) songOver = true; }
      else if(state.chain){
        for(let k=1;k<=4;k++){ const i=(playPattern+k)%4; if(!isEmpty(i)){ playPattern=i; break; } }
      }
    }
  }
}
function draw(){
  while(queue.length && queue[0].t <= ctx.currentTime){
    const q = queue.shift();
    if(state.endless){ if(q.p !== genView){ genView = q.p; if(!document.hidden) paint(); } }
    else if(state.chain && q.pat !== state.current){ state.current = q.pat; paint(); }
    showPlayhead(q.s);
  }
  if(playing && songOver && endAt !== null && ctx.currentTime > endAt){ stop(); return; }
  if(playing) requestAnimationFrame(draw);
}
function start(from = 0){
  ensureAudio();
  playing = true; step = 0; bar = from; genBar = null; playPattern = state.current; queue = []; songOver = false; endAt = null;
  rMode = !!(state.endless && state.renderAhead !== false && OAC);
  if(rMode){
    rGen++; rItems = []; rT0 = null; rRel = 0; rSources = []; rAhead = 3; sampleWait = Date.now() + 4000;
    rPlan(); rTimer = setInterval(rPlan, 200);
  } else {
    nextTime = ctx.currentTime + 0.06;
    scheduler(); timer = setInterval(scheduler, 40);
  }
  requestAnimationFrame(draw);
  playBtn.textContent = 'Stop'; playBtn.setAttribute('aria-pressed','true');
}
function stop(){
  playing = false; clearInterval(timer); clearInterval(rTimer); queue = []; showPlayhead(-1);
  if(rMode){ rGen++; rSources.forEach(r => { try{ r.src.stop(); }catch(e){} }); rSources = []; rItems = []; }
  genView = null; paint();
  playBtn.textContent = 'Play'; playBtn.setAttribute('aria-pressed','false');
}
const togglePlay = () => playing ? stop() : start();
