// Loads the app's source into Node for testing, with the browser pieces stubbed out.
// The app runs unchanged; tests reach its functions through the object returned by loadApp().
import { appSource, sampleSource } from '../scripts/bundle.mjs';

// A do-nothing stand-in for DOM elements and (in mock mode) Web Audio nodes.
const P = new Proxy(function () {}, {
  get: (t, k) => (k === 'value' ? 0 : k === 'style' ? { setProperty() {} } : P),
  apply: () => P, construct: () => P, set: () => true,
});

export function loadApp({ offlineAudio, saved } = {}) {
  Object.assign(globalThis, {
    window: offlineAudio ? { OfflineAudioContext: offlineAudio } : {},
    document: { getElementById: () => P, createElement: () => P, querySelectorAll: () => [], addEventListener() {}, createTextNode: () => P },
    localStorage: { getItem: () => (saved ? JSON.stringify(saved) : null), setItem() {} },
    requestAnimationFrame: () => {},
    Option: function () {},
  });
  if (!globalThis.navigator) globalThis.navigator = { userAgent: 'node', maxTouchPoints: 0 };
  const exportsExpr = `
;({
  state, STYLES, FORMS, PART_KEYS, DRUMS, generateBar, makeSong, parseCode, songCode, arr, totalBars,
  playStep, renderBar, buildMidi, encodeWav, remapPatch, patchOf, stepDur, sampleBufs,
  SCALES, HARM_FUNC, HARM_STYLES, COMPOSER_VERSION, fnOf, itemKey, itemRoot, itemDeg, chordPcsOf, alterToChord, makeProgression, progressionScore, voicingsFor, chordAtPos, keyOff,
  hookBar, vocalBar, makeArrangement, guitarHit, applyEdits, barContent, editBar, edUndo, hasEdits,
  auditBar, arrangeEnsemble, ensembleParts, barFor, locate, setEnsemble(v) { ENSEMBLE_ON = v; }, writeLine, scoreLine, composeBest, hookOptions, vocalOptions, isChordTone, scaleNote, rootAtBar, seedWith,
  useMock(m) { ctx = master = bus = revIn = delIn = delL = delR = busLP = busHP = choIn = delFb = drumBus = liveOut = m; },
  async useOfflineAudio(C) {
    const c = new C(2, 44100, 44100); ctx = c;
    noiseBuf = c.createBuffer(1, 44100, 44100);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    liveGraph = makeGraph(c, false); useGraph(liveGraph);
    await loadSamples();
  },
})`;
  // Instrument data is only needed when real audio is rendered; skip it otherwise to keep tests fast.
  const samples = offlineAudio ? sampleSource() : 'const SAMPLE_DATA = {}; const VOX_DATA = {}; const VOX_LOOPS = {};';
  const app = (0, eval)(samples + '\n' + appSource() + exportsExpr);
  if (!offlineAudio) app.useMock(new Proxy(P, { get: (t, k) => (k === 'currentTime' ? 0 : P) }));
  return app;
}
