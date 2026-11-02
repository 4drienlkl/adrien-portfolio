/* Shared 3D car rendering for the garage (garage.js) and Garage Tycoon (tycoon.html).
   One light studio, one model loader and one paint setup, so a car looks the same everywhere it appears.
   - Vehicle3DPreview.snapshot(): a still render of a car for cards and thumbnails (one shared offscreen renderer, cached)
   - Vehicle3DPreview.mount(): an interactive viewer you can rotate and zoom (one shared renderer, moved between hosts) */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/* The car models in assets/cars/ and how to find each one's body paint.
   Add a model here (plus its .glb) and it becomes available to the garage and the game. */
export var VEHICLES = {
  nsx: { file: 'nsx', paint: /^Acura.*Paint_Material$/, metal: 0.5 },
  sls: { file: 'sls', paint: /^SLSCarPaint$/, metal: 0.85 },
  c8: { file: 'c8', paint: /PaintTNR_Material$/, metal: 0.6 },
  '488': { file: '488', paint: /^Main_Paint$/, metal: 0.35 },
  c911: { file: 'c911', paint: /^car_vpnt_/, metal: 0.6 },
  gt3: { file: 'gt3', paint: /2022Paint_Material$/, metal: 0.5 },
  gtr: { file: 'gtr', paint: /^CarPaint$/, metal: 0.7 },
  huracan: { file: 'huracan', paint: /2014Paint_Material$/, metal: 0.5 },
  m570s: { file: 'm570s', paint: /^fullM_CarPaint_Max/, metal: 0.5 },
  r8: { file: 'r8', paint: /2023Paint_Material1$/, metal: 0.6 },
  i8: { file: 'i8', paint: /2017Paint_Material1$/, metal: 0.5 },
  amggt: { file: 'amggt', paint: /2015Paint_Material1$/, metal: 0.6 },
  viper: { file: 'viper', paint: /^CarPaint_AO_1$/, metal: 0.5 },
  emira: { file: 'emira', paint: /Lotus_Emira_2022_Base1$/, metal: 0.5 },
  // Later arrivals in Garage Tycoon
  nz: { file: 'nz', paint: /PaintTNR_Material1$/, metal: 0.55 },
  mustang: { file: 'mustang', paint: /^Ford_MustangGT_2024PaintA_Material$/, metal: 0.5 },
  m4: { file: 'm4', paint: /^m4car_(body|bodykit|hood)1$/, metal: 0.55 },
  gt4rs: { file: 'gt4rs', paint: /^Porsche_718CaymanGT4RS_2022Paint_Material$/, metal: 0.45 },
  vantage: { file: 'vantage', paint: /^AstonAstonMartin_Vantage_2024Paint_Material1$/, metal: 0.55 },
  z06: { file: 'z06', paint: /^Chevrolet_Corvette.*2023Paint_Material$/, metal: 0.55 },
  roma: { file: 'roma', paint: /^Ferrari_Roma.*2020Paint_Material$/, metal: 0.6 },
  artura: { file: 'artura', paint: /^McLaren_Artura.*2022Paint_Material$/, metal: 0.5 },
  turbos: { file: 'turbos', paint: /^PorschePorsche_911TurboS992_2021RegionA1$/, metal: 0.6 },
  f296: { file: 'f296', paint: /^Ferrari_296GTB_2022Paint_Material$/, metal: 0.4 },
  fordgt: { file: 'fordgt', paint: /^Ford_GT.*2017Paint_Material$/, metal: 0.5, precise: true },
  revuelto: { file: 'revuelto', paint: /^Lamborghini_Revuelto.*2024Paint_Material$/, metal: 0.45 },
  sf90: { file: 'sf90', paint: /^Ferrari_SF90Stradale_2020Paint_Material$/, metal: 0.4 },
  lfa: { file: 'lfa', paint: /^Lexus_LFA.*2011Paint_Material$/, metal: 0.55 },
  // Race car in its original "Rexy" livery: the paint is a printed texture, so it is never recoloured
  // Its body, chassis and cabin are flagged see-through in the file, which breaks depth sorting; draw them solid
  rexy: { file: 'rexy', paint: null, metal: 0.5, opaque: /^(Body|Chassis|Interior)$/ }
};
export var CAR_LENGTH = 4.5; // every model is scaled to this length, nose toward +z

// Reflections come from an invisible light studio: long ceiling strips, two side softboxes and a warm kicker behind
export function studioEnvironment(renderer) {
  var env = new THREE.Scene();
  var room = new THREE.Mesh(new THREE.BoxGeometry(30, 14, 30), new THREE.MeshBasicMaterial({ color: 0x08080a, side: THREE.BackSide }));
  room.position.y = 6;
  env.add(room);
  function panelLight(w, h, k, tint, pos, rot) {
    var m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(tint[0] * k, tint[1] * k, tint[2] * k), side: THREE.DoubleSide }));
    m.position.set(pos[0], pos[1], pos[2]);
    m.rotation.set(rot[0], rot[1], rot[2]);
    env.add(m);
  }
  [-2.6, 0, 2.6].forEach(function (x) { panelLight(0.45, 15, 7, [1, 1, 1], [x, 7, 0], [Math.PI / 2, 0, 0]); });
  panelLight(12, 0.3, 4, [1, 1, 1], [0, 7, 5.5], [Math.PI / 2, 0, 0]);
  panelLight(12, 0.3, 4, [1, 1, 1], [0, 7, -5.5], [Math.PI / 2, 0, 0]);
  panelLight(14, 3.2, 3.2, [1, 0.97, 0.92], [-12, 2.6, 0], [0, Math.PI / 2, 0]);
  panelLight(14, 3.2, 3.2, [1, 0.97, 0.92], [12, 2.6, 0], [0, -Math.PI / 2, 0]);
  panelLight(16, 16, 0.35, [1, 1, 1], [0, 6.9, 0], [Math.PI / 2, 0, 0]);
  panelLight(9, 1.2, 2.2, [1, 0.62, 0.3], [0, 1.4, -13], [0, 0, 0]);
  panelLight(9, 1.2, 0.7, [0.6, 0.75, 1], [0, 1.4, 13], [0, Math.PI, 0]);
  var pm = new THREE.PMREMGenerator(renderer);
  var tex = pm.fromScene(env, 0.02).texture;
  pm.dispose();
  return tex;
}

// A soft key from above and a cool/warm fill give the bodywork shape beyond its reflections
export function studioLights(scene) {
  var key = new THREE.DirectionalLight(0xfff4e8, 1.4);
  key.position.set(3, 9, 5);
  scene.add(key, new THREE.HemisphereLight(0xdfe6ff, 0x20160e, 0.55));
  return key;
}

// Scale the model to CAR_LENGTH, centre it, and stand it on y = 0. fit is the glTF scene inside the group model.
// precise measures the vertices themselves, for models whose rotated parts give loose bounding boxes
export function fitCar(fit, model, precise) {
  model.updateMatrixWorld(true);
  var b = new THREE.Box3().setFromObject(fit, !!precise), size = b.getSize(new THREE.Vector3());
  fit.scale.multiplyScalar(CAR_LENGTH / size.z);
  model.updateMatrixWorld(true);
  b.setFromObject(fit, !!precise);
  var ctr = b.getCenter(new THREE.Vector3());
  fit.position.set(-ctr.x, -b.min.y, -ctr.z).add(fit.position);
}

// color is a hex, optionally with a finish: '#8b8e90|matte', '#f3efe6|pearl' or '#d9dde2|chrome'
export function paintMaterial(color, metal) {
  var p = String(color).split('|'), finish = p[1];
  var paint = new THREE.MeshPhysicalMaterial({ color: p[0], metalness: metal, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.03 });
  if (finish === 'matte') { paint.metalness = Math.min(metal, 0.25); paint.roughness = 0.62; paint.clearcoat = 0; paint.envMapIntensity = 0.45; }
  else if (finish === 'pearl') { paint.iridescence = 1; paint.iridescenceIOR = 1.5; paint.iridescenceThicknessRange = [180, 520]; paint.metalness = 0.35; }
  else if (finish === 'chrome') { paint.metalness = 1; paint.roughness = 0.06; paint.clearcoatRoughness = 0; }
  paint.name = 'paint';
  return paint;
}

// Swap the body paint for a clear-coated colour and tame the glass, tyres and cabin
export function paintCar(fit, spec, color) {
  var paint = paintMaterial(color, spec.metal);
  fit.traverse(function (o) {
    if (!o.isMesh) return;
    var m = o.material;
    if (m.name === 'paint' || (spec.paint && spec.paint.test(m.name))) { o.material = paint; return; }
    if (spec.opaque && spec.opaque.test(m.name)) { m.transparent = false; m.depthWrite = true; m.opacity = 1; }
    // Glass: drop the expensive refraction pass and keep a tinted see-through look
    if (m.transmission) { m.transmission = 0; m.transparent = true; m.opacity = Math.max(m.opacity, 0.32); m.depthWrite = false; }
    if (/tyre|tire|styre|interior|carp|seat/i.test(m.name)) m.metalness = Math.min(m.metalness, 0.1);
  });
  return paint;
}

var loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
var files = {};
// Each .glb is downloaded and parsed once per page
export function loadCar(file, onProgress) {
  if (!files[file]) files[file] = loader.loadAsync('assets/cars/' + file + '.glb', onProgress);
  return files[file];
}

function radial(inner, outer) {
  var c = document.createElement('canvas'); c.width = c.height = 256;
  var g = c.getContext('2d'), grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, inner); grd.addColorStop(1, outer);
  g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
  var t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* ---------- Vehicle3DPreview: the game's cars, built from the same models ---------- */
var prepared = {};
// A fitted, cleaned-up copy of each model; every preview clones it and only swaps the paint
function baseCar(key) {
  var spec = VEHICLES[key];
  if (!spec) return Promise.reject(new Error('No 3D model for ' + key));
  if (!prepared[key]) {
    prepared[key] = loadCar(spec.file).then(function (g) {
      var model = new THREE.Group(), fit = g.scene.clone(true);
      model.add(fit);
      fitCar(fit, model, spec.precise);
      paintCar(fit, spec, '#888888');
      return model;
    });
  }
  return prepared[key];
}
function buildCar(key, color) {
  return baseCar(key).then(function (base) {
    var car = base.clone(true), paint = paintMaterial(color, VEHICLES[key].metal);
    car.traverse(function (o) { if (o.isMesh && o.material.name === 'paint') o.material = paint; });
    return car;
  });
}

function studioRig(renderer) {
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;
  var scene = new THREE.Scene();
  scene.environment = studioEnvironment(renderer);
  studioLights(scene);
  var shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: radial('rgba(0,0,0,0.9)', 'rgba(0,0,0,0)'), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.004; shadow.scale.set(2.9, 5.8, 1);
  scene.add(shadow);
  return scene;
}

// Front three-quarter view, framed so the whole car fits whatever the aspect ratio
var VIEW = { azimuth: 0.72, elevation: 0.2, target: new THREE.Vector3(0, 0.56, 0) };
function frame(camera, aspect, view) {
  view = view || {};
  var az = view.azimuth != null ? view.azimuth : VIEW.azimuth, el = view.elevation != null ? view.elevation : VIEW.elevation;
  var vfov = THREE.MathUtils.degToRad(camera.fov), hfov = 2 * Math.atan(Math.tan(vfov / 2) * aspect);
  var dist = Math.max(2.45 / Math.tan(hfov / 2), 1.3 / Math.tan(vfov / 2)) * (view.zoom || 1);
  camera.aspect = aspect;
  camera.position.set(Math.sin(az) * Math.cos(el) * dist, VIEW.target.y + Math.sin(el) * dist, Math.cos(az) * Math.cos(el) * dist);
  camera.lookAt(VIEW.target);
  camera.updateProjectionMatrix();
  return dist;
}

var shot = null, shotQueue = Promise.resolve(), shots = {};
function shotRig() {
  if (shot) return shot;
  var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setClearColor(0x000000, 0);
  shot = { renderer: renderer, scene: studioRig(renderer), camera: new THREE.PerspectiveCamera(26, 2, 0.1, 100) };
  return shot;
}

/* Vehicle3DPreview
   snapshot(key, color, { width, height, azimuth, elevation }) → Promise<image URL>, cached per car, colour and size
   mount(element, key, color) → { dispose() }: an interactive, rotatable viewer filling the element */
export var Vehicle3DPreview = {
  has: function (key) { return !!VEHICLES[key]; },
  snapshot: function (key, color, opts) {
    opts = opts || {};
    var w = Math.round(opts.width || 760), h = Math.round(opts.height || 340);
    var id = [key, color, w, h, opts.azimuth, opts.elevation].join('|');
    if (!shots[id]) {
      shots[id] = shotQueue = shotQueue.catch(function () {}).then(function () {
        return buildCar(key, color).then(function (car) {
          var s = shotRig();
          s.renderer.setSize(w, h, false);
          frame(s.camera, w / h, opts);
          s.scene.add(car);
          s.renderer.render(s.scene, s.camera);
          s.scene.remove(car);
          var url = s.renderer.domElement.toDataURL('image/webp', 0.9);
          return url.indexOf('data:image/webp') === 0 ? url : s.renderer.domElement.toDataURL('image/png');
        });
      });
    }
    return shots[id];
  },
  mount: function (el, key, color) {
    var v = viewer();
    v.token++;
    var token = v.token;
    el.appendChild(v.renderer.domElement);
    v.host = el;
    v.resize();
    v.controls.reset();
    frame(v.camera, el.clientWidth / Math.max(1, el.clientHeight), { zoom: 1.02 });
    v.controls.target.copy(VIEW.target);
    v.controls.minDistance = v.camera.position.distanceTo(VIEW.target) * 0.62;
    v.controls.maxDistance = v.camera.position.distanceTo(VIEW.target) * 1.25;
    v.controls.update();
    v.controls.saveState();
    v.controls.autoRotate = !matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (v.car) { v.scene.remove(v.car); v.car = null; }
    el.classList.add('v3d-loading');
    buildCar(key, color).then(function (car) {
      if (token !== v.token) return;
      v.car = car; v.scene.add(car);
      el.classList.remove('v3d-loading');
    }).catch(function () { el.classList.remove('v3d-loading'); el.classList.add('v3d-failed'); });
    v.start();
    return { dispose: function () { if (token === v.token) v.stop(); } };
  }
};

var view = null;
function viewer() {
  if (view) return view;
  var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.className = 'v3d-canvas';
  var camera = new THREE.PerspectiveCamera(26, 2, 0.1, 100);
  var controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.minPolarAngle = 0.35; controls.maxPolarAngle = 1.5;
  controls.autoRotateSpeed = 0.8;
  controls.addEventListener('start', function () { controls.autoRotate = false; });
  var raf = 0, ro = null;
  view = {
    renderer: renderer, camera: camera, controls: controls, scene: studioRig(renderer), car: null, host: null, token: 0,
    resize: function () {
      if (!view.host) return;
      var w = view.host.clientWidth, h = view.host.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
    },
    start: function () {
      if (ro) ro.disconnect();
      ro = new ResizeObserver(view.resize); ro.observe(view.host);
      cancelAnimationFrame(raf);
      (function loop() { raf = requestAnimationFrame(loop); if (!view.host || !view.host.isConnected) return view.stop(); controls.update(); renderer.render(view.scene, camera); })();
    },
    stop: function () { cancelAnimationFrame(raf); if (ro) ro.disconnect(); ro = null; if (renderer.domElement.parentNode) renderer.domElement.remove(); view.host = null; }
  };
  return view;
}
