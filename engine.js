/* Cold starts for the turntable cars, synthesised in the browser (no audio files).
   Every cylinder firing is a short decaying pulse of exhaust; the crank speed follows a starter → catch → rev flare →
   cold idle curve, and the garage adds a little echo. Each engine's character comes from its spec below. */

/* cyl: cylinders · crank: seconds on the starter before it catches · flare / coldIdle / idle: rpm
   res: exhaust note (Hz) · decay: how long each pulse rings (s) · uneven: pulse strength by firing order (a cross-plane V8 burbles)
   rasp: breathy noise in each pulse · turbo: whistle level · hybrid: electric motors spin it up instead of a starter */
export var ENGINES = {
  nsx: { cyl: 6, hybrid: true, crank: 0.38, flare: 1900, coldIdle: 1250, idle: 1000, res: 125, decay: 0.011, uneven: [1, 0.9, 1.06, 0.94, 1.03, 0.9], rasp: 0.35, turbo: 0.05 },
  sls: { cyl: 8, crank: 0.78, flare: 2700, coldIdle: 1300, idle: 1050, res: 82, decay: 0.017, uneven: [1, 0.6, 1.2, 0.76, 0.9, 1.26, 0.68, 1.1], rasp: 0.18, turbo: 0 },
  c8: { cyl: 8, crank: 0.62, flare: 2200, coldIdle: 1350, idle: 1100, res: 92, decay: 0.015, uneven: [1, 0.66, 1.14, 0.8, 0.92, 1.2, 0.72, 1.06], rasp: 0.24, turbo: 0 },
  '488': { cyl: 8, crank: 0.5, flare: 3300, coldIdle: 1400, idle: 1150, res: 150, decay: 0.008, uneven: [1, 0.96, 1.04, 0.97, 1, 0.95, 1.05, 0.98], rasp: 0.6, turbo: 0.07 }
};
var LENGTH = 4.8; // seconds, including the fade at the end

var ctx = null, bus = null, playing = null, buffers = {};
var enabled = true;
try { enabled = localStorage.getItem('garage-sound') !== 'off'; } catch (e) {}
export function soundOn() { return enabled; }
export function setSound(on) {
  enabled = on;
  try { localStorage.setItem('garage-sound', on ? 'on' : 'off'); } catch (e) {}
  if (!on) stopEngine();
}

// A small deterministic random source, so each car sounds the same every time
function rng(seed) { return function () { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }

function render(spec, sr) {
  var n = Math.floor(LENGTH * sr), d = new Float32Array(n), rnd = rng(spec.cyl * 7919 + spec.res);
  var step = 4 * Math.PI / spec.cyl; // a four-stroke fires every cylinder once in two turns of the crank
  var ang = 0, next = 0, fired = 0, pulses = [], whistle = 0, starterRpm = spec.hybrid ? 0 : 210;
  for (var i = 0; i < n; i++) {
    var t = i / sr, rpm, flare = 0, lit = t >= spec.crank;
    if (!lit) {
      // Starter: a slow, lumpy crank as each cylinder hits compression (hybrids spin up smoothly on the motor)
      rpm = spec.hybrid ? 900 * Math.min(1, t / spec.crank) : 210 * (1 + 0.22 * Math.sin(ang * spec.cyl / 2));
      starterRpm = rpm;
    } else {
      var u = t - spec.crank;
      var base = spec.coldIdle + (spec.idle - spec.coldIdle) * (1 - Math.exp(-u / 2.2));
      flare = Math.exp(-Math.max(0, u - 0.16) / 0.42);
      var target = base + (spec.flare - base) * flare;
      rpm = starterRpm + (target - starterRpm) * (1 - Math.exp(-u / 0.07));
    }
    ang += 2 * Math.PI * rpm / 60 / sr;
    while (ang >= next) {
      var k = fired % spec.cyl;
      if (lit) pulses.push({ s: i, a: spec.uneven[k] * (0.85 + 0.3 * rnd()) * (0.55 + 0.6 * flare), f: spec.res * (0.92 + 0.16 * rnd()) * (1 + rpm / 9000), tau: spec.decay, noise: spec.rasp });
      else if (!spec.hybrid) pulses.push({ s: i, a: 0.22, f: 48, tau: 0.03, noise: 0.15 }); // compression thump
      next += step; fired++;
    }
    var s = 0, keep = 0;
    for (var p = 0; p < pulses.length; p++) {
      var q = pulses[p], dt = (i - q.s) / sr;
      if (dt > q.tau * 7) continue;
      pulses[keep++] = q;
      s += q.a * Math.exp(-dt / q.tau) * (Math.sin(2 * Math.PI * q.f * dt) + q.noise * (rnd() * 2 - 1));
    }
    pulses.length = keep;
    if (!lit || t < spec.crank + 0.05) {
      // Starter motor whine, or the hybrid's electric motors winding up
      s += spec.hybrid ? 0.07 * Math.sin(2 * Math.PI * (380 + 1400 * t / spec.crank) * t) : 0.05 * Math.sign(Math.sin(2 * Math.PI * 165 * t)) * (0.6 + 0.4 * Math.sin(ang * spec.cyl / 2));
    }
    if (spec.turbo && lit) { whistle += 2 * Math.PI * (2200 + rpm * 0.7) / sr; s += spec.turbo * flare * Math.sin(whistle); }
    d[i] = s;
  }
  // Soften, saturate a little, fade out, and normalise
  var lp = 0, a = 1 - Math.exp(-2 * Math.PI * 2800 / sr), peak = 0, fade = 1.4 * sr;
  for (i = 0; i < n; i++) {
    lp += a * (d[i] - lp);
    var v = Math.tanh(lp * 1.8);
    if (i > n - fade) v *= (n - i) / fade;
    if (i < 200) v *= i / 200;
    d[i] = v; peak = Math.max(peak, Math.abs(v));
  }
  for (i = 0; i < n; i++) d[i] *= 0.9 / (peak || 1);
  return d;
}

// A garage-sized room: a short burst of decaying noise as a reverb impulse
function room() {
  var len = Math.floor(ctx.sampleRate * 1.1), ir = ctx.createBuffer(2, len, ctx.sampleRate), r = rng(42);
  for (var ch = 0; ch < 2; ch++) { var x = ir.getChannelData(ch); for (var i = 0; i < len; i++) x[i] = (r() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
  return ir;
}
function setup() {
  var AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  ctx = new AC();
  bus = ctx.createGain(); bus.gain.value = 0.5;
  var wet = ctx.createConvolver(), wetGain = ctx.createGain();
  wet.buffer = room(); wetGain.gain.value = 0.28;
  bus.connect(ctx.destination);
  bus.connect(wet); wet.connect(wetGain); wetGain.connect(ctx.destination);
  return true;
}

// Play a car's cold start. Call it from a click or key press: browsers only allow sound after the visitor interacts.
export function coldStart(key) {
  var spec = ENGINES[key];
  if (!enabled || !spec) return;
  if (!ctx && !setup()) return;
  if (ctx.state === 'suspended') ctx.resume();
  stopEngine();
  if (!buffers[key]) {
    var b = ctx.createBuffer(1, Math.floor(LENGTH * ctx.sampleRate), ctx.sampleRate);
    b.getChannelData(0).set(render(spec, ctx.sampleRate));
    buffers[key] = b;
  }
  var src = ctx.createBufferSource(), g = ctx.createGain();
  src.buffer = buffers[key];
  src.connect(g); g.connect(bus);
  src.start();
  playing = { src: src, gain: g };
  src.onended = function () { if (playing && playing.src === src) playing = null; };
}
export function stopEngine() {
  if (!playing) return;
  var p = playing; playing = null;
  p.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.06);
  p.src.stop(ctx.currentTime + 0.3);
}
