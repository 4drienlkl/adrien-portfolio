/* Cold starts for the turntable cars: short real recordings (credited in the README), played with a little garage echo.
   catch: seconds into the clip where the engine fires, so the lights come up with it. */
export var ENGINES = {
  nsx: { src: 'assets/sounds/nsx.m4a?v=2', catch: 0.15 },   // Honda NSX (2016, already idling), Motor1, CC BY 3.0
  sls: { src: 'assets/sounds/sls.m4a', catch: 0.68 },       // Mercedes SLS AMG, whillsway on Freesound, CC BY-NC 4.0
  c8: { src: 'assets/sounds/c8.m4a', catch: 0.15 },         // Corvette Stingray (C8, already idling), Quold on Freesound, CC0
  '488': { src: 'assets/sounds/488.m4a?v=2', catch: 0.45 } // Ferrari 488 GTB with Novitec exhaust, Hungarian Supercar Spotters, CC BY 3.0
};

var ctx = null, bus = null, playing = null, files = {}, buffers = {}, ticket = 0;
var enabled = true;
try { enabled = localStorage.getItem('garage-sound') !== 'off'; } catch (e) {}
export function soundOn() { return enabled; }
export function setSound(on) {
  enabled = on;
  try { localStorage.setItem('garage-sound', on ? 'on' : 'off'); } catch (e) {}
  if (!on) stopEngine();
}

// Fetch the clips ahead of time (about 45 KB each) so a start plays the moment the car changes
export function preloadEngines() {
  Object.keys(ENGINES).forEach(fetchClip);
}
function fetchClip(key) {
  if (!files[key]) files[key] = fetch(ENGINES[key].src).then(function (r) { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); });
  return files[key];
}
function bufferFor(key) {
  if (!buffers[key]) {
    buffers[key] = fetchClip(key).then(function (data) {
      // Safari only has the callback form of decodeAudioData
      return new Promise(function (res, rej) { ctx.decodeAudioData(data.slice(0), res, rej); });
    });
    buffers[key].catch(function () { delete buffers[key]; delete files[key]; });
  }
  return buffers[key];
}

// A garage-sized room: a short burst of decaying noise as a reverb impulse
function room() {
  var len = Math.floor(ctx.sampleRate * 1.1), ir = ctx.createBuffer(2, len, ctx.sampleRate), seed = 42;
  for (var ch = 0; ch < 2; ch++) {
    var x = ir.getChannelData(ch);
    for (var i = 0; i < len; i++) { seed = (seed * 1664525 + 1013904223) >>> 0; x[i] = (seed / 2147483648 - 1) * Math.pow(1 - i / len, 3.2); }
  }
  return ir;
}
function setup() {
  var AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  ctx = new AC();
  bus = ctx.createGain(); bus.gain.value = 0.8;
  var wet = ctx.createConvolver(), wetGain = ctx.createGain();
  wet.buffer = room(); wetGain.gain.value = 0.16;
  bus.connect(ctx.destination);
  bus.connect(wet); wet.connect(wetGain); wetGain.connect(ctx.destination);
  return true;
}

// Play a car's cold start. Call it from a click or key press: browsers only allow sound after the visitor interacts.
// Resolves once the clip is actually playing (false if it won't play), so the lights can start with it.
export function coldStart(key) {
  var spec = ENGINES[key];
  if (!enabled || !spec) return Promise.resolve(false);
  if (!ctx && !setup()) return Promise.resolve(false);
  if (ctx.state === 'suspended') ctx.resume();
  stopEngine();
  var id = ++ticket;
  return bufferFor(key).then(function (buf) {
    if (id !== ticket || !enabled) return false; // another car was picked while this one loaded
    var src = ctx.createBufferSource(), g = ctx.createGain();
    src.buffer = buf;
    src.connect(g); g.connect(bus);
    src.start();
    playing = { src: src, gain: g };
    src.onended = function () { if (playing && playing.src === src) playing = null; };
    return true;
  }, function () { return false; });
}
export function stopEngine() {
  ticket++;
  if (!playing) return;
  var p = playing; playing = null;
  p.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.06);
  p.src.stop(ctx.currentTime + 0.3);
}
