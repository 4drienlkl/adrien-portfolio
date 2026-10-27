import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

var EMAIL = 'awp6745@stern.nyu.edu';
var LINKEDIN = 'https://www.linkedin.com/in/adrien-pinilla-24b01630a/';
var RESUME = 'assets/Adrien-Pinilla-Resume.pdf';

/* ---------- Content ----------
   One car per section. hood: which panel lifts and how.
   - region: pull every separate panel of the matching meshes that sits fully inside this box (car is 4.5 units long, nose at +z)
   - nodes: or lift whole meshes whose names match
   - hinge: 'rear' lifts the front edge (a normal hood), 'front' lifts the back edge (the C8's engine hatch)
   - tray: fill the empty front trunk under the hood with a dark tray */
var CARS = [
  {
    id: 'experience', title: 'Experience', kicker: 'Chapter I', roman: 'I',
    year: 2022, make: 'Acura', model: 'NSX Type S', spec: '600 hp · 3.5L twin-turbo V6 hybrid · AWD', file: 'nsx',
    paint: /^Acura.*Paint_Material$/, color: '#e0520f', metal: 0.5, // Thermal Orange Pearl
    hood: { meshes: /paint|carbon/i, region: { x: 0.9, y: 0.5, z: [0.8, 2.2] }, hinge: 'rear', angle: 0.95 },
    plate: 'EY · Fulton · Arête',
    stats: [['80 of 700+', 'EY selection'], ['3', 'Roles'], ['Adopted', 'Arête redesign'], ['On sale', 'Fulton slipper']],
    body:
      '<article class="blk"><div class="blk-head"><h3>EY</h3><span class="when">May – Aug 2026</span></div><p class="role">Future Bridge Program Participant · <em>80 of 700+ selected</em></p><dl class="par">' +
      '<div><dt>Challenge</dt><dd>Solve a strategy case for a coffee company in EY’s 12-week program on consulting and business strategy.</dd></div>' +
      '<div><dt>What I did</dt><dd>Structured the problem with my team and built our recommendation. Took part in workshops, case exercises and networking sessions with EY professionals.</dd></div>' +
      '<div class="res"><dt>Result</dt><dd>Presented our recommendations to EY professionals as one of ~80 participants chosen from 700+ applicants.</dd></div></dl></article>' +
      '<article class="blk"><div class="blk-head"><h3>Fulton</h3><span class="when">Jan – May 2026</span></div><p class="role">Brand Strategy Consultant · <em>NYU Stern client project</em></p><dl class="par">' +
      '<div><dt>Challenge</dt><dd>Fulton, an insole brand expanding into slippers, needed a clearer picture of its core customer and how to stand apart.</dd></div>' +
      '<div><dt>What I did</dt><dd>On a team of 4, ran a few dozen consumer interviews on brand perception and needs, then built an ideal-customer persona and positioning around it.</dd></div>' +
      '<div class="res"><dt>Result</dt><dd>Recommended targeting that persona and launching an outdoor slipper to compete with Birkenstock. Fulton’s outdoor slipper is now on sale.</dd></div></dl></article>' +
      '<article class="blk"><div class="blk-head"><h3>Arête</h3><span class="when">Sept – Nov 2024</span></div><p class="role">User Interface Intern · <em>Design adopted</em></p><dl class="par">' +
      '<div><dt>Challenge</dt><dd>Arête, a marketplace for emerging fashion designers, needed shoppers to find and browse products more easily.</dd></div>' +
      '<div><dt>What I did</dt><dd>On a small team, mapped usability gaps in navigation and product discovery, then designed a new homepage and interface as interactive Figma prototypes.</dd></div>' +
      '<div class="res"><dt>Result</dt><dd>Arête adopted our homepage and UI redesign.</dd></div></dl></article>'
  },
  {
    id: 'education', title: 'Education', kicker: 'Chapter II', roman: 'II',
    year: 2013, make: 'Mercedes-Benz', model: 'SLS AMG GT', spec: '583 hp · 6.2L naturally aspirated V8 · RWD', file: 'sls',
    paint: /^SLSCarPaint$/, color: '#a7abb0', metal: 0.85,
    hood: { nodes: /SK_Hood/, hinge: 'rear', angle: 0.9 },
    plate: 'NYU Stern · Wagner',
    stats: [['3.68', 'GPA / 4.00'], ['#1 of 120+', 'Beta Alpha Psi rush'], ['2', 'Majors'], ['Dec 2027', 'Graduation']],
    body:
      '<article class="blk"><div class="blk-head"><h3>New York University</h3><span class="when">Expected Dec 2027</span></div>' +
      '<ul class="bul"><li><b>B.S. in Business, Technology &amp; Entrepreneurship</b>, Stern School of Business</li><li><b>B.A. in Public Policy</b> (double major), Wagner School of Public Service</li><li>Cumulative GPA <b>3.68 / 4.00</b></li></ul>' +
      '<ul class="chips"><li>Strategic Management</li><li>Finance</li><li>Financial Accounting</li><li>Personal Finance</li><li>Decision Models &amp; Analytics</li><li>Statistics</li><li>Economics</li><li>Management &amp; Organizations</li><li>Computer Programming</li><li>Public Policy</li></ul></article>' +
      '<article class="blk"><div class="blk-head"><h3>Beta Alpha Psi</h3><span class="when">Dec 2025 – Present</span></div><p class="role">Business Honor Society, Mu Chapter · Platinum Member · Community Service Chair</p>' +
      '<ul class="bul"><li><b>Ranked #1 of 120+ candidates</b> in a competitive rush and named Candidate of the Semester</li><li>Organize community service events and partner with outside organizations, opening volunteer opportunities to <b>~115 members</b> this semester</li><li>Weekly professional development: technical training, case prep and industry speakers</li></ul></article>' +
      '<article class="blk"><div class="blk-head"><h3>Chaminade High School</h3><span class="when">Mineola, NY · 2024</span></div><ul class="bul"><li><b>4.0 unweighted GPA</b>, four-year Honor Roll</li><li>Excellence of Character Award</li></ul></article>'
  },
  {
    id: 'projects', title: 'Projects', kicker: 'Chapter III', roman: 'III',
    year: 2020, make: 'Chevrolet', model: 'Corvette C8 Stingray', spec: '495 hp · 6.2L V8 · mid-engine RWD', file: 'c8',
    paint: /PaintTNR_Material$/, color: '#0b57c2', metal: 0.6,
    hood: { meshes: /paint|window|carbon/i, region: { x: 0.85, y: 0.8, z: [-2.25, -0.5] }, hinge: 'front', angle: 0.85 },
    plate: 'Collectibles · Astoria',
    stats: [['$30K+', 'Revenue since 2020'], ['450+', 'Customers'], ['4.8★+', 'Seller rating'], ['2.5–5%', 'Astoria cap rates']],
    body:
      '<article class="blk"><div class="blk-head"><h3>Online Collectibles Business</h3><span class="when">2020 – Present</span></div><p class="role">Founder &amp; Operator</p>' +
      '<ul class="bul"><li>Built an online resale business for Pokémon trading cards and Funko figures, selling on <b>eBay, TCGplayer and Mercari</b></li><li>Handle pricing, inventory, fulfillment and customer service end to end, using demand and pricing trends to decide what to buy</li></ul>' +
      '<div class="figs"><div><b>$30K+</b><span>Revenue</span></div><div><b>450+</b><span>Customers</span></div><div><b>4.8★+</b><span>Rating</span></div></div></article>' +
      '<article class="blk"><div class="blk-head"><h3>Astoria Real Estate Analysis</h3><span class="when">May – Jul 2026</span></div><p class="role">Independent multifamily acquisition &amp; valuation study</p>' +
      '<ul class="bul"><li>Screened a few dozen multifamily and mixed-use properties (under 6 units) in Astoria, Queens</li><li>Modeled NOI, cap rates, leverage, debt service and cash-on-cash returns under different income, expense and financing assumptions</li><li>Finding: a market split between rent-stabilized and free-market units, with tight cap rates</li></ul>' +
      '<div class="figs"><div><b>$1.8M–$4M</b><span>Price range</span></div><div><b>2.5–5%</b><span>Cap rates</span></div></div></article>' +
      '<div class="blk"><h3>Next up</h3><p>Studying short-term rental markets, with plans to launch an Airbnb arbitrage venture.</p></div>'
  },
  {
    id: 'skills', title: 'Skills', kicker: 'Chapter IV', roman: 'IV',
    year: 2016, make: 'Ferrari', model: '488 GTB', spec: '661 hp · 3.9L twin-turbo V8 · RWD', file: '488',
    paint: /^Main_Paint$/, color: '#b0101a', metal: 0.35,
    hood: { meshes: /paint|carbon/i, region: { x: 0.85, y: 0.6, z: [0.6, 2.2] }, hinge: 'rear', angle: 0.95 },
    plate: 'Finance · Strategy · Design',
    stats: [['Excel', 'Bloomberg · Minitab'], ['Figma', 'UI prototyping'], ['Interviews', 'Personas · positioning'], ['Python · SQL', 'Basics']],
    body:
      '<div class="blk"><h3>Finance &amp; Analysis</h3><p>Valuing assets and stress-testing assumptions.</p><ul class="chips"><li>Excel</li><li>Bloomberg Terminal</li><li>Minitab</li><li>NOI &amp; cap rates</li><li>Cash-on-cash returns</li><li>Debt service</li><li>Scenario analysis</li></ul></div>' +
      '<div class="blk"><h3>Strategy &amp; Research</h3><p>Turning customer insight into a recommendation.</p><ul class="chips"><li>Consumer interviews</li><li>Customer personas</li><li>Brand positioning</li><li>Case structuring</li><li>Stakeholder presentations</li></ul></div>' +
      '<div class="blk"><h3>Design &amp; Operations</h3><p>Building products and running a business.</p><ul class="chips"><li>Figma</li><li>UI prototyping</li><li>Pricing</li><li>Inventory</li><li>Fulfillment</li><li>Customer relationships</li></ul></div>' +
      '<div class="blk"><p><b style="color:var(--ivory);font-weight:500">Also:</b> Microsoft Office &amp; PowerPoint · Python &amp; SQL (basic) · PC building and GPU maintenance · Spanish (elementary)</p></div>'
  }
];
var ABOUT = {
  id: 'about', title: 'About', kicker: 'Driver profile', sub: 'NYU Stern ’27 · New York', c: '#e0a85e',
  stats: [['2020', 'Started my first business'], ['4', 'Fields I’m targeting']],
  body: '<div class="blk"><div class="about-top"><img src="assets/headshot.jpg" alt="Portrait of Adrien Pinilla"><p style="margin:0">NYU Stern junior studying Business, Technology &amp; Entrepreneurship, with a second major in Public Policy at NYU Wagner.</p></div>' +
    '<p>In 2020 I started an online collectibles business, and I’ve run it ever since. It taught me early how pricing, inventory and customer trust actually work.</p>' +
    '<p>I’ve taken that approach into consulting and strategy work with EY, Fulton and Arête: talk to the customer, test the numbers, and land on a clear recommendation. Outside class, I manage my own investment portfolio and study short-term rental markets.</p>' +
    '<blockquote class="quote">“The details are not the details. They make the design.”<cite>Charles Eames</cite></blockquote></div>' +
    '<div class="blk"><h3>What I’m looking for</h3><p>Internships and opportunities in wealth management, consulting, finance and hospitality.</p><div class="cta"><a class="btn primary" href="mailto:' + EMAIL + '">Email me</a><a class="btn" href="' + RESUME + '" target="_blank" rel="noopener">Résumé (PDF)</a><a class="btn" href="' + LINKEDIN + '" target="_blank" rel="noopener">LinkedIn ↗</a></div></div>'
};
var CONTACT = {
  id: 'contact', title: 'Contact', kicker: 'Pit lane', sub: 'Say hello', c: '#e0a85e', stats: [],
  body: '<div class="blk"><p>I’m open to internships and opportunities in wealth management, consulting, finance and hospitality, and always happy to connect with people in those fields.</p>' +
    '<div class="cta"><a class="btn primary" href="mailto:' + EMAIL + '">' + EMAIL + '</a><a class="btn" href="' + RESUME + '" target="_blank" rel="noopener">Résumé (PDF)</a><a class="btn" href="' + LINKEDIN + '" target="_blank" rel="noopener">LinkedIn ↗</a></div></div>'
};

var TAPES = [
  { title: 'On Rotation', tape: '#c8102e', tracks: [
    ['My Beautiful Dark Twisted Fantasy', 'Kanye West · 2010', '', 1443160699],
    ['Graduation', 'Kanye West · 2007', '', 1442846712],
    ['Charm', 'Clairo · 2024', '', 1742301428],
    ['Bewitched', 'Laufey · 2023', '', 1690609217],
    ['Happier Than Ever', 'Billie Eilish · 2021', '', 1564530710]
  ]},
  { title: 'Collections', tape: '#e0a85e', tracks: [
    ['LEGO', '', 'Favorite set: the Star Wars Republic Dropship with AT-OT Walker.'],
    ['Coins', '', 'A numismatics habit: history you can hold in your hand.'],
    ['Vinyl & cassettes', '', 'You’re standing in the room.'],
    ['Pokémon', '', 'Where the collectibles business started in 2020.']
  ]},
  { title: 'Outside', tape: '#2f7bff', tracks: [
    ['Sports cars', '', 'Favorite: the Acura NSX, first in the garage downstairs.'],
    ['Hiking', '', 'Getting out of the city whenever I can.'],
    ['Fashion & hospitality', '', 'Two industries I follow closely, and part of why Arête and hospitality are on my list.']
  ]}
];
// [album, artist, sleeve colour, label text, Apple Music ID of the track that plays]
var ALBUMS = [
  ['My Beautiful Dark Twisted Fantasy', 'Kanye West', '#c4161c', 'MBDTF', 1443160699],
  ['Graduation', 'Kanye West', '#b34fc0', 'Graduation', 1442846712],
  ['Charm', 'Clairo', '#8f9057', 'Charm', 1742301428],
  ['Bewitched', 'Laufey', '#7d93bd', 'Bewitched', 1690609217],
  ['Happier Than Ever', 'Billie Eilish', '#c9b48a', 'Happier Than Ever', 1564530710]
];

/* ---------- Renderer, studio and turntable ---------- */
var $ = function (id) { return document.getElementById(id); };
var body = document.body, panel = $('panel'), canvas = $('gl');
var phone = matchMedia('(max-width: 760px)');
var still = matchMedia('(prefers-reduced-motion: reduce)').matches;

var renderer;
try { renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: 'high-performance' }); }
catch (e) { location.replace('classic.html'); throw e; }
renderer.setPixelRatio(Math.min(devicePixelRatio, phone.matches ? 1.5 : 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.3;

var scene = new THREE.Scene();
scene.background = new THREE.Color(0x050506);
scene.fog = new THREE.Fog(0x050506, 13, 30);
var camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
var DISC = 0.08; // turntable surface height

// Reflections come from an invisible light studio: long ceiling strips, two side softboxes and a warm kicker behind
function studio() {
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
scene.environment = studio();
// A soft key from above and a cool/warm fill give the bodywork shape beyond its reflections
var key = new THREE.DirectionalLight(0xfff4e8, 1.4);
key.position.set(3, 9, 5);
scene.add(key, new THREE.HemisphereLight(0xdfe6ff, 0x20160e, 0.55));

function radial(inner, outer) {
  var c = document.createElement('canvas'); c.width = c.height = 256;
  var g = c.getContext('2d'), grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, inner); grd.addColorStop(1, outer);
  g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
  var t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Floor ring around an open turntable, so the car's reflection can show through the glossy disc
var floor = new THREE.Mesh(new THREE.RingGeometry(3.62, 40, 128), new THREE.MeshStandardMaterial({ color: 0x0d0d0f, roughness: 0.62, metalness: 0.2 }));
floor.rotation.x = -Math.PI / 2;
scene.add(floor);
var pool = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), new THREE.MeshBasicMaterial({ map: radial('rgba(255,236,210,0.3)', 'rgba(255,236,210,0)'), transparent: true, depthWrite: false }));
pool.rotation.x = -Math.PI / 2; pool.position.y = 0.002;
scene.add(pool);
var rim = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.62, DISC, 128, 1, true), new THREE.MeshStandardMaterial({ color: 0x1a1a1d, roughness: 0.3, metalness: 0.8 }));
rim.position.y = DISC / 2;
scene.add(rim);
var top = new THREE.Mesh(new THREE.CircleGeometry(3.6, 128), new THREE.MeshPhysicalMaterial({ color: 0x0b0b0d, roughness: 0.22, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.1, transparent: true, opacity: 0.88 }));
top.rotation.x = -Math.PI / 2; top.position.y = DISC; top.renderOrder = 2;
scene.add(top);
var halo = new THREE.Mesh(new THREE.TorusGeometry(3.6, 0.012, 8, 160), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 1.7, 0.9) }));
halo.rotation.x = Math.PI / 2; halo.position.y = DISC;
scene.add(halo);

// Back wall: vertical light slats fading into fog, and the ceiling strips you see reflected in the paint
var slatMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.55, 0.5, 0.45) });
for (var a = -1.1; a <= 1.11; a += 0.2) {
  var s = new THREE.Mesh(new THREE.BoxGeometry(0.05, 3.2, 0.05), slatMat);
  s.position.set(Math.sin(a) * 13, 1.9, -Math.cos(a) * 13);
  scene.add(s);
}
var wall = new THREE.Mesh(new THREE.CylinderGeometry(13.4, 13.4, 9, 64, 1, true, Math.PI * 0.62, Math.PI * 0.76), new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.9, side: THREE.BackSide }));
wall.position.y = 4.5;
scene.add(wall);

var turntable = new THREE.Group();
scene.add(turntable);
var shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: radial('rgba(0,0,0,0.92)', 'rgba(0,0,0,0)'), transparent: true, depthWrite: false }));
shadow.rotation.x = -Math.PI / 2; shadow.position.y = DISC + 0.003; shadow.renderOrder = 3;
shadow.scale.set(2.8, 5.6, 1);
turntable.add(shadow);

var composer = null;
if (!phone.matches) {
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(512, 512), 0.32, 0.55, 0.9));
  composer.addPass(new OutputPass());
}

/* ---------- The driver: a collectible figure on a plinth, linked to the driver profile ---------- */
function makeDriver() {
  var fig = new THREE.Group(), body3 = new THREE.Group();
  var suit = new THREE.MeshPhysicalMaterial({ color: 0x151517, roughness: 0.62, sheen: 1, sheenColor: 0x45454c, sheenRoughness: 0.45 });
  var panel = new THREE.MeshPhysicalMaterial({ color: 0x5a5d63, roughness: 0.55, sheen: 0.8, sheenColor: 0x9a9aa0, sheenRoughness: 0.5 });
  var gold = new THREE.MeshStandardMaterial({ color: 0xd8ae55, metalness: 1, roughness: 0.26 });
  var shell = new THREE.MeshPhysicalMaterial({ color: 0x0d0d0f, roughness: 0.22, metalness: 0.15, clearcoat: 1, clearcoatRoughness: 0.04 });
  var visor = new THREE.MeshPhysicalMaterial({ color: 0xe0b050, metalness: 1, roughness: 0.08, iridescence: 0.5, iridescenceIOR: 1.6, emissive: 0x4a3008, emissiveIntensity: 0.6 });
  var rubber = new THREE.MeshStandardMaterial({ color: 0x0a0a0b, roughness: 0.8 });
  function part(geo, mat, p, r, sc, parent) {
    var m = new THREE.Mesh(geo, mat);
    m.position.set(p[0], p[1], p[2]);
    if (r) m.rotation.set(r[0], r[1], r[2]);
    if (sc) m.scale.set(sc[0], sc[1], sc[2]);
    (parent || body3).add(m);
    return m;
  }
  [-1, 1].forEach(function (sd) {
    // Boots, legs with a gray side panel and a gold stripe
    part(new THREE.CapsuleGeometry(0.07, 0.12, 6, 16), rubber, [sd * 0.105, 0.075, 0.035], [Math.PI / 2, 0, 0]);
    part(new THREE.CapsuleGeometry(0.082, 0.34, 6, 18), suit, [sd * 0.105, 0.36, 0]);
    part(new THREE.CapsuleGeometry(0.03, 0.34, 4, 10), panel, [sd * 0.168, 0.37, 0], null, [0.6, 1, 1.1]);
    part(new THREE.BoxGeometry(0.012, 0.4, 0.03), gold, [sd * 0.188, 0.37, 0]);
    // Gray side panels down the torso
    part(new THREE.CapsuleGeometry(0.035, 0.3, 4, 10), panel, [sd * 0.178, 0.78, 0], [0, 0, sd * -0.04], [0.7, 1, 1.4]);
    // Shoulders, arms with gold cuffs, gray gloves
    part(new THREE.SphereGeometry(0.078, 18, 14), panel, [sd * 0.215, 0.955, 0]);
    part(new THREE.CapsuleGeometry(0.06, 0.2, 6, 16), suit, [sd * 0.262, 0.83, 0], [0, 0, sd * 0.28]);
    part(new THREE.CapsuleGeometry(0.054, 0.18, 6, 16), suit, [sd * 0.31, 0.63, 0.04], [-0.3, 0, sd * 0.12]);
    part(new THREE.TorusGeometry(0.055, 0.012, 8, 24), gold, [sd * 0.322, 0.535, 0.075], [Math.PI / 2 - 0.3, 0, 0]);
    part(new THREE.SphereGeometry(0.06, 16, 12), panel, [sd * 0.326, 0.49, 0.09], null, [0.9, 1.1, 0.9]);
    part(new THREE.BoxGeometry(0.014, 0.36, 0.05), gold, [sd * 0.205, 0.79, 0], [0, 0, 0]);
  });
  // Torso: a lathe turned profile, flattened front to back
  var prof = [[0, 0.56], [0.17, 0.57], [0.19, 0.64], [0.18, 0.76], [0.2, 0.9], [0.205, 0.97], [0.15, 1.02], [0.06, 1.05], [0, 1.05]]
    .map(function (p) { return new THREE.Vector2(p[0], p[1]); });
  part(new THREE.LatheGeometry(prof, 40), suit, [0, 0, 0], null, [1, 1, 0.72]);
  part(new THREE.TorusGeometry(0.183, 0.022, 10, 48), panel, [0, 0.6, 0], [Math.PI / 2, 0, 0], [1, 0.72, 1]);
  part(new THREE.BoxGeometry(0.07, 0.045, 0.02), gold, [0, 0.6, 0.135]);
  part(new THREE.TorusGeometry(0.075, 0.018, 10, 32), gold, [0, 1.04, 0], [Math.PI / 2, 0, 0]);
  // Gray chest yoke and a gold zip line
  part(new THREE.SphereGeometry(0.19, 32, 16, 0, Math.PI * 2, 0, 0.9), panel, [0, 0.83, 0], null, [1.04, 1, 0.74]);
  part(new THREE.BoxGeometry(0.012, 0.36, 0.012), gold, [0, 0.8, 0.146]);
  // Race number on the chest: AP 27
  var cv = document.createElement('canvas'); cv.width = 256; cv.height = 128;
  var g2 = cv.getContext('2d');
  g2.fillStyle = '#d8ae55'; g2.font = '700 96px "Barlow Condensed", "Arial Narrow", sans-serif'; g2.textAlign = 'center';
  g2.fillText('27', 128, 100);
  var num = new THREE.CanvasTexture(cv); num.colorSpace = THREE.SRGBColorSpace;
  part(new THREE.PlaneGeometry(0.11, 0.055), new THREE.MeshStandardMaterial({ map: num, transparent: true, metalness: 0.6, roughness: 0.3 }), [0.085, 0.86, 0.142], [0, 0.25, 0]);
  // Helmet: gloss black shell, smoked gold visor, twin gold stripes over the top
  var head = new THREE.Group();
  head.position.set(0, 1.2, 0);
  body3.add(head);
  part(new THREE.CylinderGeometry(0.06, 0.07, 0.08, 20), panel, [0, -0.13, 0], null, null, head);
  part(new THREE.SphereGeometry(0.17, 40, 28), shell, [0, 0, 0], null, [1, 1.02, 1.1], head);
  part(new THREE.SphereGeometry(0.173, 40, 20, Math.PI / 2 - 0.85, 1.7, 1.25, 0.55), visor, [0, 0, 0], null, [1, 1.02, 1.1], head);
  [-0.035, 0.035].forEach(function (x) {
    part(new THREE.TorusGeometry(0.172, 0.009, 8, 40, Math.PI), gold, [x, 0, 0], [0, Math.PI / 2, 0], [1, 1.02, 1.1], head);
  });
  // Plinth with a gold ring
  var base = new THREE.Group();
  part(new THREE.CylinderGeometry(0.36, 0.4, 0.14, 48), new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.35, metalness: 0.6 }), [0, 0.07, 0], null, null, base);
  part(new THREE.TorusGeometry(0.36, 0.008, 8, 64), gold, [0, 0.14, 0], [Math.PI / 2, 0, 0], null, base);
  var blob = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), new THREE.MeshBasicMaterial({ map: radial('rgba(0,0,0,0.85)', 'rgba(0,0,0,0)'), transparent: true, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2; blob.position.y = 0.004;
  base.add(blob);
  body3.position.y = 0.14;
  fig.add(base, body3);
  // A small spotlight on the figure so it reads against the dark floor
  var spot = new THREE.SpotLight(0xffe2b8, 9, 6, 0.5, 0.6, 1.5);
  spot.position.set(0.6, 3.2, 1.2);
  spot.target = body3;
  fig.add(spot);
  fig.scale.setScalar(1.15);
  fig.userData = { head: head, body: body3 };
  return fig;
}
var driver = makeDriver();
scene.add(driver);
// Stand the figure behind the turntable, off to the right of the car, facing the viewer
function placeDriver() {
  var v = homeView(), az = Math.atan2(v.pos.x, v.pos.z) + (phone.matches ? 2.85 : 2.62), r = 4.5;
  driver.position.set(Math.sin(az) * r, 0, Math.cos(az) * r);
  driver.rotation.y = Math.atan2(v.pos.x - driver.position.x, v.pos.z - driver.position.z) + 0.25;
}

/* ---------- Cars ---------- */
var loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
var cache = {};

// Split a mesh into its separate panels (islands of connected triangles), in car space
function islands(mesh) {
  var g = mesh.geometry, pos = g.attributes.position, n = pos.count;
  var idx = g.index ? g.index.array : Array.from({ length: n }, function (_, i) { return i; });
  var v = new THREE.Vector3(), W = new Array(n), rep = new Int32Array(n), seen = new Map();
  for (var i = 0; i < n; i++) {
    W[i] = v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld).clone();
    var k = Math.round(W[i].x * 1e4) + ',' + Math.round(W[i].y * 1e4) + ',' + Math.round(W[i].z * 1e4);
    if (!seen.has(k)) seen.set(k, i);
    rep[i] = seen.get(k);
  }
  var par = new Int32Array(n).map(function (_, i) { return i; });
  function find(x) { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; }
  for (var t = 0; t < idx.length; t += 3) {
    var a = find(rep[idx[t]]);
    par[find(rep[idx[t + 1]])] = a;
    par[find(rep[idx[t + 2]])] = a;
  }
  var out = new Map();
  for (t = 0; t < idx.length; t += 3) {
    var r = find(rep[idx[t]]);
    if (!out.has(r)) out.set(r, { tris: [], box: new THREE.Box3() });
    var o = out.get(r);
    o.tris.push(t);
    o.box.expandByPoint(W[idx[t]]).expandByPoint(W[idx[t + 1]]).expandByPoint(W[idx[t + 2]]);
  }
  return { idx: idx, list: Array.from(out.values()) };
}

// Move the hood's triangles into their own meshes (sharing the original vertex data) so they can swing open
function liftHood(c, model) {
  var h = c.hood, parts = [], box = new THREE.Box3();
  model.updateMatrixWorld(true);
  if (h.nodes) {
    model.traverse(function (o) { if (o.isMesh && h.nodes.test(o.name)) { parts.push(o); box.expandByObject(o); } });
  } else {
    var R = h.region, src = [];
    model.traverse(function (o) { if (o.isMesh && h.meshes.test(o.name + ' ' + o.material.name)) src.push(o); });
    src.forEach(function (m) {
      var isl = islands(m), take = new Set();
      isl.list.forEach(function (p) {
        var b = p.box;
        if (b.min.z >= R.z[0] && b.max.z <= R.z[1] && b.min.x >= -R.x && b.max.x <= R.x && b.min.y >= R.y) {
          p.tris.forEach(function (t) { take.add(t); });
          box.union(b); // the split mesh still holds every vertex, so measure the panel itself
        }
      });
      if (!take.size) return;
      var keep = [], move = [];
      for (var t = 0; t < isl.idx.length; t += 3) (take.has(t) ? move : keep).push(isl.idx[t], isl.idx[t + 1], isl.idx[t + 2]);
      var g2 = new THREE.BufferGeometry();
      for (var k in m.geometry.attributes) g2.setAttribute(k, m.geometry.attributes[k]);
      g2.setIndex(move);
      m.geometry.setIndex(keep);
      m.geometry.computeBoundingSphere();
      g2.computeBoundingSphere();
      var hm = new THREE.Mesh(g2, m.material);
      hm.position.copy(m.position); hm.quaternion.copy(m.quaternion); hm.scale.copy(m.scale);
      m.parent.add(hm);
      parts.push(hm);
    });
  }
  model.updateMatrixWorld(true);
  var pivot = new THREE.Group();
  pivot.name = 'hood';
  pivot.position.set(0, box.max.y - 0.02, h.hinge === 'rear' ? box.min.z : box.max.z);
  model.add(pivot);
  model.updateMatrixWorld(true);
  parts.forEach(function (p) {
    // The underside of a panel is normally never seen, so draw both faces once it can open
    if (!p.material.userData.both) { p.material = p.material.clone(); p.material.side = THREE.DoubleSide; p.material.userData.both = true; }
    pivot.attach(p);
  });
  return { box: box, pivot: pivot, open: (h.hinge === 'rear' ? -1 : 1) * h.angle };
}

function plateTexture(c) {
  var cv = document.createElement('canvas'); cv.width = 1024; cv.height = 512;
  var g = cv.getContext('2d');
  var grd = g.createLinearGradient(0, 0, 1024, 512);
  grd.addColorStop(0, '#2b2b2f'); grd.addColorStop(0.5, '#3c3c41'); grd.addColorStop(1, '#232326');
  g.fillStyle = grd; g.fillRect(0, 0, 1024, 512);
  for (var y = 0; y < 512; y += 3) { g.fillStyle = 'rgba(255,255,255,' + (Math.random() * 0.035) + ')'; g.fillRect(0, y, 1024, 1); }
  g.strokeStyle = '#e0a85e'; g.lineWidth = 10; g.strokeRect(24, 24, 976, 464);
  [[60, 60], [964, 60], [60, 452], [964, 452]].forEach(function (p) { g.fillStyle = '#8d8d93'; g.beginPath(); g.arc(p[0], p[1], 12, 0, 7); g.fill(); });
  g.fillStyle = '#e0a85e'; g.font = '600 40px "Barlow Condensed", "Arial Narrow", sans-serif';
  g.textAlign = 'center'; g.fillText((c.kicker + ' · ' + c.year + ' ' + c.make).toUpperCase(), 512, 130);
  g.fillStyle = '#f4efe6'; g.font = '700 150px "Barlow Condensed", "Arial Narrow", sans-serif';
  g.fillText(c.title.toUpperCase(), 512, 300);
  g.fillStyle = '#b9b0a2'; g.font = '500 44px "Barlow Condensed", "Arial Narrow", sans-serif';
  g.fillText(c.plate.toUpperCase(), 512, 400);
  var t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

function prepare(c, gltf) {
  var model = new THREE.Group(), fit = gltf.scene;
  model.add(fit);
  model.updateMatrixWorld(true);
  var b = new THREE.Box3().setFromObject(fit), size = b.getSize(new THREE.Vector3());
  fit.scale.multiplyScalar(4.5 / size.z);
  model.updateMatrixWorld(true);
  b.setFromObject(fit);
  var ctr = b.getCenter(new THREE.Vector3());
  fit.position.set(-ctr.x, -b.min.y, -ctr.z).add(fit.position);

  var paint = new THREE.MeshPhysicalMaterial({ color: c.color, metalness: c.metal, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.03 });
  paint.name = 'paint';
  fit.traverse(function (o) {
    if (!o.isMesh) return;
    var m = o.material;
    if (c.paint.test(m.name)) { o.material = paint; return; }
    // Glass: drop the expensive refraction pass and keep a tinted see-through look
    if (m.transmission) { m.transmission = 0; m.transparent = true; m.opacity = Math.max(m.opacity, 0.32); m.depthWrite = false; }
    if (/tyre|tire|styre|interior|carp|seat/i.test(m.name)) m.metalness = Math.min(m.metalness, 0.1);
  });

  var hood = liftHood(c, model);
  var hb = hood.box, hc = hb.getCenter(new THREE.Vector3());
  var bay = new THREE.Vector3(hc.x, hb.min.y + 0.06, hc.z);
  if (c.hood.tray) {
    var w = (hb.max.x - hb.min.x) * 0.84, d = (hb.max.z - hb.min.z) * 0.8, depth = 0.26;
    var shell = new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.55, metalness: 0.5, side: THREE.DoubleSide });
    var tray = new THREE.Mesh(new THREE.BoxGeometry(w, depth, d), [shell, shell, new THREE.MeshBasicMaterial({ visible: false }), shell, shell, shell]);
    tray.position.set(hc.x, hb.min.y - 0.02 - depth / 2, hc.z - (hb.max.z - hb.min.z) * 0.04);
    model.add(tray);
    bay.y = hb.min.y - depth + 0.04;
  } else {
    bay.y = hb.min.y + 0.24;
  }
  // A work light in the bay, switched on with the hood
  var lamp = new THREE.PointLight(0xffd2a0, 0, 2.6, 1.6);
  lamp.position.set(hc.x, hb.max.y + 0.25, hc.z);
  model.add(lamp);
  // The section's nameplate floats in the open bay
  var plateMap = plateTexture(c);
  var plate = new THREE.Mesh(new THREE.PlaneGeometry(1.04, 0.52), new THREE.MeshStandardMaterial({ map: plateMap, emissive: 0xffffff, emissiveMap: plateMap, emissiveIntensity: 0.35, roughness: 0.38, metalness: 0.4, depthTest: false, transparent: true }));
  plate.position.copy(bay);
  plate.renderOrder = 10; // drawn over the engine parts it floats among
  plate.visible = false;
  model.add(plate);

  // Mirror image for the glossy turntable
  var mirror = model.clone();
  mirror.scale.y = -1;
  mirror.position.y = DISC * 2;
  // The reflection skips the bay light and the floating nameplate
  var extras = [];
  mirror.traverse(function (o) { if (o.isMesh) o.renderOrder = 1; if (o.isLight || o.renderOrder === 10) extras.push(o); });
  mirror.children.forEach(function (o) { if (o.isMesh && o.material.depthTest === false) extras.push(o); });
  extras.forEach(function (o) { o.removeFromParent(); });
  var group = new THREE.Group();
  model.position.y = DISC;
  group.add(model, mirror);
  return { c: c, group: group, model: model, hood: hood, lamp: lamp, mirrorHood: mirror.getObjectByName('hood'), plate: plate, bay: bay, rear: c.hood.hinge === 'front' };
}

function fetchCar(i, onProgress) {
  var c = CARS[i];
  if (!cache[c.file]) {
    cache[c.file] = loader.loadAsync('assets/cars/' + c.file + '.glb', onProgress).then(function (g) { return prepare(c, g); });
  }
  return cache[c.file];
}

/* ---------- Camera, tweens and the main loop ---------- */
var controls = new OrbitControls(camera, canvas);
controls.enablePan = false;
controls.enableDamping = true;
controls.minPolarAngle = 0.95; controls.maxPolarAngle = 1.47;
controls.minDistance = 6; controls.maxDistance = 13;
controls.target.set(0, 0.6, 0);
controls.addEventListener('start', function () { idleSpin = false; });

var tweens = [];
function tween(ms, step, done) {
  if (still) ms = 1;
  return new Promise(function (res) {
    tweens.push({ t0: performance.now(), ms: ms, step: step, done: function () { if (done) done(); res(); } });
  });
}
function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

var idleSpin = !still, current = null, carIdx = 0, hoodOpen = false, busy = false, shift = { x: 0, y: 0 };

function homeView() {
  var r = innerWidth / innerHeight, d = r < 0.75 ? 15.5 : r < 1.4 ? 10.5 : 9;
  return { pos: new THREE.Vector3(d * 0.62, 2.3, d * 0.78), target: new THREE.Vector3(0, 0.6, 0) };
}

// On wide screens the car card sits on the left, so the car is framed a little right of centre
// On phones the car card and picker fill the bottom, so the car is framed higher up
function restShift() { return phone.matches ? { x: 0, y: innerHeight * 0.1 } : { x: -Math.min(180, innerWidth * 0.11), y: 0 }; }
// With the hood open the panel covers the right half (desktop) or the bottom of the screen (phone)
function hoodShift() { return phone.matches ? { x: 0, y: innerHeight * 0.3 } : { x: Math.min(560, innerWidth * 0.5) / 2, y: 0 }; }
function shiftTo(s1, ms) {
  var s0 = { x: shift.x, y: shift.y };
  return tween(ms, function (k) { shift = { x: s0.x + (s1.x - s0.x) * k, y: s0.y + (s1.y - s0.y) * k }; frame(); });
}

function resize() {
  var w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  if (composer) composer.setSize(w, h);
  camera.aspect = w / h;
  camera.fov = w / h < 1 ? 40 : 30;
  shift = hoodOpen ? hoodShift() : restShift();
  frame();
  placeDriver();
}
// Shift the picture left when the panel covers the right side, so the open bay stays in view
function frame() {
  if (shift.x || shift.y) camera.setViewOffset(innerWidth, innerHeight, shift.x, shift.y, innerWidth, innerHeight);
  else camera.clearViewOffset();
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);

function moveCamera(to, ms) {
  var p0 = camera.position.clone(), t0 = controls.target.clone();
  return tween(ms, function (k) {
    camera.position.lerpVectors(p0, to.pos, k);
    controls.target.lerpVectors(t0, to.target, k);
  });
}
function spinTo(angle, ms) {
  var a0 = turntable.rotation.y % (Math.PI * 2);
  var d = ((angle - a0) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
  turntable.rotation.y = a0;
  return tween(ms, function (k) { turntable.rotation.y = a0 + d * k; });
}
function swingHood(to, ms) {
  var car = current, h = car.hood, a0 = h.pivot.rotation.x;
  return tween(ms, function (k) {
    h.pivot.rotation.x = car.mirrorHood.rotation.x = a0 + (to - a0) * k;
    var p = h.pivot.rotation.x / h.open, show = Math.min(1, Math.max(0, (p - 0.55) / 0.4));
    car.lamp.intensity = 3.5 * p;
    car.plate.visible = show > 0;
    car.plate.material.opacity = show * show * (3 - 2 * show);
    car.plate.position.y = car.bay.y - 0.14 * (1 - show);
  });
}

var clock = new THREE.Clock();
function loop() {
  requestAnimationFrame(loop);
  var dt = clock.getDelta();
  if (document.hidden || body.classList.contains('room-open')) return;
  var now = performance.now();
  tweens = tweens.filter(function (tw) {
    var k = Math.min(1, (now - tw.t0) / tw.ms);
    tw.step(ease(k));
    if (k >= 1) { tw.done(); return false; }
    return true;
  });
  if (idleSpin && !hoodOpen && !busy) turntable.rotation.y += dt * 0.12;
  // The driver breathes and turns their helmet a little toward the pointer
  var t = now / 1000, d = driver.userData;
  d.body.scale.y = 1 + Math.sin(t * 1.6) * 0.006;
  d.head.rotation.y += ((still ? 0 : look * 0.5) - d.head.rotation.y) * 0.06;
  d.head.rotation.x = Math.sin(t * 0.7) * 0.03;
  tagDriver();
  // The orbit limits only apply while the visitor is driving the camera; scripted moves aim directly
  if (controls.enabled) controls.update(); else camera.lookAt(controls.target);
  if (composer) composer.render(); else renderer.render(scene, camera);
}

/* ---------- Showing cars and opening the hood ---------- */
function fillHud(c) {
  $('c-badge').textContent = c.roman;
  $('c-year').textContent = c.year + ' · ' + c.make;
  $('c-model').textContent = c.model;
  $('c-spec').textContent = c.spec;
  $('c-kicker').textContent = c.kicker;
  $('c-section').textContent = c.title;
  $('c-stats').innerHTML = c.stats.map(function (t) { return '<div><b>' + t[0] + '</b><span>' + t[1] + '</span></div>'; }).join('');
  document.querySelectorAll('#picker .card').forEach(function (b) { b.classList.toggle('on', b.dataset.id === c.id); b.setAttribute('aria-current', b.dataset.id === c.id ? 'true' : 'false'); });
}

var loaderEl = $('loader'), bar = $('bar'), shutter = $('shutter');
function progress(e) {
  if (!e.total) return;
  var pct = Math.round(e.loaded / e.total * 100);
  bar.style.width = pct + '%';
  $('door-led').style.width = pct + '%';
}

// The garage door: closed while the first car loads, then it jolts and rolls up
function openShutter() {
  var again = false;
  try { again = sessionStorage.getItem('garage-door') === '1'; sessionStorage.setItem('garage-door', '1'); } catch (e) {}
  $('door-status').textContent = 'Open';
  $('door-led').style.width = '100%';
  shutter.classList.add('open');
  if (again) shutter.classList.add('quick');
  var ms = still ? 700 : again ? 1100 : 2300;
  setTimeout(function () { shutter.hidden = true; }, ms);
  return ms;
}

async function show(i, opts) {
  opts = opts || {};
  if (busy && !opts.force) return;
  busy = true;
  if (hoodOpen) await closeHood(true);
  var first = !current;
  if (!first) { body.classList.add('blink'); await new Promise(function (r) { setTimeout(r, still ? 0 : 280); }); }
  if (!cache[CARS[i].file] && !first) { loaderEl.classList.add('show'); bar.style.width = '4%'; }
  var car;
  try { car = await fetchCar(i, progress); }
  catch (e) {
    if (first) $('door-status').innerHTML = 'Door’s stuck · <a href="classic.html">open the quick view</a>';
    else loaderEl.querySelector('b').textContent = 'Couldn’t open the garage';
    busy = false;
    return;
  }
  loaderEl.classList.remove('show');
  if (current) turntable.remove(current.group);
  current = car; carIdx = i;
  turntable.add(car.group);
  turntable.rotation.y = 0.62;
  fillHud(car.c);
  if (!opts.keepHash) history.replaceState(null, '', first && !location.hash ? location.pathname : '#' + car.c.id);
  body.classList.remove('blink', 'boot');
  busy = false;
  // Warm the cache for the next car so switching feels instant
  setTimeout(function () { fetchCar((i + 1) % CARS.length).catch(function () {}); }, 600);
}

async function openHood() {
  if (busy || hoodOpen || !current) return;
  busy = true; hoodOpen = true; idleSpin = false;
  body.classList.add('hood');
  controls.enabled = false;
  var car = current, rear = car.rear;
  // Turn the open end toward the camera, then lean in over the bay
  var angle = (rear ? Math.PI : 0) + 0.38;
  var bayW = car.bay.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
  bayW.y += DISC;
  var view = phone.matches
    ? { pos: bayW.clone().add(new THREE.Vector3(1.6, 4.4, 5.6)), target: bayW.clone().add(new THREE.Vector3(0, -0.2, -0.5)) }
    : { pos: bayW.clone().add(new THREE.Vector3(2.3, 2.6, 4.4)), target: bayW.clone().add(new THREE.Vector3(0, -0.15, -0.35)) };
  // Where the camera will sit, in the car's own frame (the turntable is still turning), so the plate faces it
  var camLocal = view.pos.clone().sub(new THREE.Vector3(0, DISC, 0)).applyAxisAngle(new THREE.Vector3(0, 1, 0), -angle);
  car.plate.quaternion.setFromRotationMatrix(new THREE.Matrix4().lookAt(camLocal, car.plate.position, new THREE.Vector3(0, 1, 0)));
  await Promise.all([
    spinTo(angle, 1100),
    moveCamera(view, 1400),
    shiftTo(hoodShift(), 1400),
    new Promise(function (r) { setTimeout(r, still ? 0 : 500); }).then(function () { return swingHood(car.hood.open, 1000); })
  ]);
  fillPanel(car.c);
  openPanel();
  busy = false;
  history.replaceState(null, '', '#' + car.c.id);
}

async function closeHood(quick) {
  if (!hoodOpen) return;
  var ms = quick ? 450 : 1000;
  closePanel();
  body.classList.remove('hood');
  await Promise.all([
    swingHood(0, ms * 0.7),
    moveCamera(homeView(), ms * 1.2),
    shiftTo(restShift(), ms)
  ]);
  hoodOpen = false;
  controls.enabled = true;
  idleSpin = !still;
}

/* ---------- Panel ---------- */
function fillPanel(s) {
  panel.style.setProperty('--accent', s.color ? '#e0a85e' : s.c);
  $('p-kicker').textContent = s.kicker;
  $('p-title').textContent = s.title;
  $('p-car').textContent = s.make ? 'Under the hood of the ' + s.year + ' ' + s.make + ' ' + s.model : s.sub;
  $('p-stats').innerHTML = s.stats.map(function (t) { return '<div><b>' + t[0] + '</b><span>' + t[1] + '</span></div>'; }).join('');
  $('p-stats').style.display = s.stats.length ? '' : 'none';
  $('p-body').innerHTML = s.body;
  $('p-scroll').scrollTop = 0;
  var car = CARS.indexOf(s) >= 0;
  $('p-prev').style.visibility = $('p-next').style.visibility = car ? 'visible' : 'hidden';
  $('p-back').lastChild.textContent = car ? 'Close hood' : 'Garage';
  if (car) {
    var i = CARS.indexOf(s);
    $('p-prev').textContent = '← ' + CARS[(i + CARS.length - 1) % CARS.length].title;
    $('p-next').textContent = CARS[(i + 1) % CARS.length].title + ' →';
  }
}
var sheet = null; // 'about' | 'contact' when the panel shows something other than a car
function openPanel() {
  body.classList.add('panel-open');
  sync();
  setTimeout(function () { $('p-back').focus({ preventScroll: true }); }, 350);
}
function closePanel() {
  body.classList.remove('panel-open', 'dim');
  sync();
}
function openSheet(s) {
  if (busy) return;
  if (hoodOpen) closeHood(true);
  sheet = s.id;
  fillPanel(s);
  body.classList.add('dim');
  openPanel();
  history.replaceState(null, '', '#' + s.id);
}
function back() {
  if (body.classList.contains('room-open')) return leaveRoom();
  if (sheet) {
    var was = sheet; sheet = null;
    closePanel();
    history.replaceState(null, '', '#' + current.c.id);
    var btn = was === 'contact' ? $('contact-btn') : document.querySelector('#picker [data-id="' + was + '"]');
    if (btn) btn.focus({ preventScroll: true });
    return;
  }
  if (hoodOpen) closeHood().then(function () { $('hood-btn').focus({ preventScroll: true }); });
}
async function step(d) {
  if (busy) return;
  var i = (carIdx + d + CARS.length) % CARS.length;
  await show(i);
  openHood();
}

$('p-back').addEventListener('click', back);
$('p-prev').addEventListener('click', function () { step(-1); });
$('p-next').addEventListener('click', function () { step(1); });
$('contact-btn').addEventListener('click', function () { openSheet(CONTACT); });
$('hood-btn').addEventListener('click', openHood);
$('prev-car').addEventListener('click', function () { show((carIdx + CARS.length - 1) % CARS.length); });
$('next-car').addEventListener('click', function () { show((carIdx + 1) % CARS.length); });

// Picker along the bottom: the four cars, then the driver profile and the listening room
var picker = $('picker-cards');
CARS.forEach(function (c, i) {
  var b = document.createElement('button');
  b.className = 'card'; b.dataset.id = c.id;
  b.innerHTML = '<small>' + c.roman + ' · ' + c.title + '</small><b>' + c.make + '</b><span>' + c.model + '</span>';
  b.addEventListener('click', function () { if (i === carIdx && current && !hoodOpen) openHood(); else show(i); });
  picker.appendChild(b);
});
[[ABOUT, 'Driver', 'Profile'], [{ id: 'room', title: 'Listening Room' }, 'Upstairs', 'Listening room']].forEach(function (x) {
  var b = document.createElement('button');
  b.className = 'card extra'; b.dataset.id = x[0].id;
  b.innerHTML = '<small>Bonus</small><b>' + x[1] + '</b><span>' + x[2] + '</span>';
  b.addEventListener('click', function () { if (x[0].id === 'room') openRoom(); else openSheet(x[0]); });
  picker.appendChild(b);
});

// The driver's name tag follows the figure on screen
var tag = $('driver-tag'), look = 0, tagPos = new THREE.Vector3();
function tagDriver() {
  driver.userData.head.getWorldPosition(tagPos);
  tagPos.y += 0.32;
  tagPos.project(camera);
  var off = tagPos.z > 1 || Math.abs(tagPos.x) > 0.96 || Math.abs(tagPos.y) > 0.96;
  tag.classList.toggle('off', off);
  tag.style.transform = 'translate(' + ((tagPos.x + 1) / 2 * innerWidth) + 'px,' + ((1 - tagPos.y) / 2 * innerHeight) + 'px) translate(-50%, -100%)';
}
tag.addEventListener('click', function () { openSheet(ABOUT); });
tag.addEventListener('mouseenter', function () { tag.classList.add('hot'); });
tag.addEventListener('mouseleave', function () { tag.classList.remove('hot'); });

// Click or tap the car itself to pop the hood (a drag to look around doesn't count)
var ray = new THREE.Raycaster(), down = null;
canvas.addEventListener('pointerdown', function (e) { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
canvas.addEventListener('pointerup', function (e) {
  if (!down || !current || busy) return;
  var moved = Math.hypot(e.clientX - down.x, e.clientY - down.y), quick = performance.now() - down.t < 400;
  down = null;
  if (moved > 6 || !quick) return;
  ray.setFromCamera(new THREE.Vector2(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1), camera);
  var onCar = ray.intersectObject(current.model, true)[0], onDriver = ray.intersectObject(driver, true)[0];
  // Whichever is nearer the camera gets the click
  if (onDriver && !hoodOpen && (!onCar || onDriver.distance < onCar.distance)) { openSheet(ABOUT); return; }
  var hit = !!onCar;
  if (hit && !hoodOpen) openHood();
  else if (!hit && hoodOpen && !phone.matches) back();
});
canvas.addEventListener('pointermove', function (e) {
  look = e.clientX / innerWidth * 2 - 1;
  if (e.buttons || !current || hoodOpen) return;
  ray.setFromCamera(new THREE.Vector2(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1), camera);
  var onCar = ray.intersectObject(current.model, true)[0], onD = ray.intersectObject(driver, true)[0];
  var onDriver = !!onD && (!onCar || onD.distance < onCar.distance);
  tag.classList.toggle('hot', onDriver);
  canvas.style.cursor = onDriver || onCar ? 'pointer' : 'grab';
});

/* ---------- Layers: only the visible one is interactive ---------- */
function layer(el, on) { el.inert = !on; el.setAttribute('aria-hidden', on ? 'false' : 'true'); }
function sync() {
  var c = body.classList, room = c.contains('room-open'), deckOpen = deck.classList.contains('open'), open = c.contains('panel-open');
  layer($('showroom'), !open && !room);
  layer(document.querySelector('.hud.top'), !room && !(open && phone.matches));
  layer(panel, open && !room);
  layer($('room'), room && !deckOpen);
  layer(deck, deckOpen);
}

/* ---------- Music: Apple Music's 30-second previews ---------- */
var SONGS = {}, songsReady = null, onSongEnd = null;
var audio = new Audio();
audio.volume = 0.85;
audio.addEventListener('ended', function () { if (onSongEnd) onSongEnd(); });
function loadSongs() {
  if (!songsReady) {
    songsReady = fetch('https://itunes.apple.com/lookup?id=' + ALBUMS.map(function (a) { return a[4]; }).join(','))
      .then(function (r) { return r.json(); })
      .then(function (d) {
        d.results.forEach(function (r) {
          if (r.previewUrl) SONGS[r.trackId] = { src: r.previewUrl, url: r.trackViewUrl, name: r.trackName.replace(/ \(feat\..*\)$/, '') };
        });
      })
      .catch(function (e) { songsReady = null; throw e; });
  }
  return songsReady;
}
function playSong(id, done) {
  onSongEnd = done || null;
  function go() {
    var s = SONGS[id];
    if (!s) throw new Error('No preview for ' + id);
    if (audio.src !== s.src) audio.src = s.src;
    return audio.play().then(function () { return s; });
  }
  return SONGS[id] ? go() : loadSongs().then(go);
}
function stopSong() { onSongEnd = null; audio.pause(); }
function appleLink(s) { return '<a href="' + s.url + '" target="_blank" rel="noopener">Full song on Apple Music ↗</a>'; }

/* ---------- Listening room ---------- */
var tt = $('tt'), deck = $('deck'), label = $('label'), spinning = -1;
function openRoom() {
  if (hoodOpen) closeHood(true);
  loadSongs().catch(function () {});
  body.classList.add('room-open');
  sync();
  history.replaceState(null, '', '#room');
  $('room-close').focus({ preventScroll: true });
}
function leaveRoom() {
  stopRecord();
  if (deck.classList.contains('open')) eject();
  body.classList.remove('room-open');
  sync();
  history.replaceState(null, '', '#' + current.c.id);
  var b = document.querySelector('#picker [data-id="room"]');
  if (b) b.focus({ preventScroll: true });
}
$('room-close').addEventListener('click', leaveRoom);

function toggleLid(force) {
  var open = tt.classList.toggle('open', force);
  tt.setAttribute('aria-label', open ? 'Close the record player' : 'Open the record player');
  if (!open) stopRecord();
}
function stopRecord(note) {
  if (spinning < 0) return;
  spinning = -1;
  stopSong();
  tt.classList.remove('playing');
  $('crate').querySelectorAll('.on').forEach(function (o) { o.classList.remove('on'); });
  $('now').textContent = note || 'Pick a record from the crate.';
}
tt.addEventListener('click', function () { toggleLid(); });
tt.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleLid(); } });

ALBUMS.forEach(function (a) {
  var b = document.createElement('button');
  b.className = 'sleeve-mini';
  b.style.setProperty('--s', 'linear-gradient(145deg,' + a[2] + ', #1a1a1a)');
  b.setAttribute('aria-label', 'Put on ' + a[0] + ' by ' + a[1]);
  b.addEventListener('click', function () {
    var i = ALBUMS.indexOf(a);
    // Same record again: lift the needle, or drop it back
    if (spinning === i) {
      if (audio.paused) { audio.play(); tt.classList.add('playing'); } else { audio.pause(); tt.classList.remove('playing'); }
      return;
    }
    stopRecord();
    $('crate').querySelectorAll('.on').forEach(function (o) { o.classList.remove('on'); });
    b.classList.add('on');
    label.style.setProperty('--lbl', a[2]);
    $('label-text').textContent = a[3];
    toggleLid(true);
    spinning = i;
    $('now').innerHTML = 'Dropping the needle on <b>' + a[0] + '</b>…';
    playSong(a[4], function () { stopRecord('That’s the preview. Pick another record.'); })
      .then(function (s) {
        if (spinning !== i) return;
        tt.classList.add('playing');
        $('now').innerHTML = '♪ <b>' + s.name + '</b> · ' + a[1] + ' · 30-sec preview<br>' + appleLink(s);
      })
      .catch(function () {
        if (spinning !== i) return;
        spinning = -1;
        b.classList.remove('on');
        $('now').textContent = 'Couldn’t reach Apple Music. Try again in a moment.';
      });
  });
  $('crate').appendChild(b);
});

var tape = null, track = 0, playing = false, secs = 0, timer, lastSpine = null;
TAPES.forEach(function (t, i) {
  var b = document.createElement('button');
  b.className = 'spine';
  b.style.setProperty('--tape', t.tape);
  b.innerHTML = '<span class="strip"></span><span class="lab"><b>' + t.title + '</b><span>Side B · ' + t.tracks.length + ' tracks</span></span>';
  b.addEventListener('click', function () { lastSpine = b; insert(i); });
  $('tapes').appendChild(b);
});
function insert(i) {
  tape = TAPES[i]; track = 0; secs = 0;
  deck.style.setProperty('--tape', tape.tape);
  $('c-title').textContent = tape.title;
  $('jcard').innerHTML = '<small>Side B · Adrien Pinilla</small><h3>' + tape.title + '</h3><ol class="tracks">' +
    tape.tracks.map(function (tr, n) {
      return '<li><span class="n">B' + (n + 1) + '</span><b>' + tr[0] + (tr[1] ? '<em>' + tr[1] + '</em>' : '') + '</b>' + (tr[2] ? '<p>' + tr[2] + '</p>' : '') + '</li>';
    }).join('') + '</ol>';
  stopRecord();
  audio.removeAttribute('src'); // so the deck can't resume whatever played last
  deck.classList.add('open'); sync();
  setPlaying(true); cue();
  $('t-eject').focus({ preventScroll: true });
}
function mark() { $('jcard').querySelectorAll('.tracks li').forEach(function (li, n) { li.classList.toggle('now-playing', n === track); }); }
// Play the current track if it's a song; the tape rolls on to the next one when the preview ends
function cue() {
  mark();
  var id = tape.tracks[track][3], li = $('jcard').querySelectorAll('.tracks li')[track];
  if (!id) return;
  playSong(id, function () {
    if (track < tape.tracks.length - 1) { track++; cue(); } else setPlaying(false);
  }).then(function (s) {
    if (!playing) audio.pause();
    if (li && !li.querySelector('.via')) li.insertAdjacentHTML('beforeend', '<p class="via">30-sec preview · ' + appleLink(s) + '</p>');
  }).catch(function () {});
}
function setPlaying(p) {
  playing = p;
  $('cassette').classList.toggle('playing', p);
  $('t-play').textContent = p ? '⏸' : '▶';
  clearInterval(timer);
  if (p) timer = setInterval(function () { secs++; $('counter').textContent = String(secs).padStart(3, '0'); }, 1000);
  if (tape && tape.tracks[track][3]) { if (p) audio.play().catch(function () {}); else audio.pause(); }
}
function eject() { deck.classList.remove('open'); sync(); setPlaying(false); stopSong(); if (lastSpine) lastSpine.focus({ preventScroll: true }); }
$('t-eject').addEventListener('click', eject);
$('t-play').addEventListener('click', function () { setPlaying(!playing); });
$('t-next').addEventListener('click', function () { if (track < tape.tracks.length - 1) { track++; stopSong(); cue(); } });
$('t-prev').addEventListener('click', function () { if (track > 0) { track--; stopSong(); cue(); } });
deck.addEventListener('click', function (e) { if (e.target === deck) eject(); });

/* ---------- Keyboard ---------- */
document.addEventListener('keydown', function (e) {
  var k = e.key;
  if (deck.classList.contains('open')) { if (k === 'Escape') eject(); return; }
  if (body.classList.contains('room-open')) { if (k === 'Escape') leaveRoom(); return; }
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (body.classList.contains('panel-open') || hoodOpen) {
    if (k === 'Escape' || k.toLowerCase() === 'b') back();
    else if (hoodOpen && k === 'ArrowRight') step(1);
    else if (hoodOpen && k === 'ArrowLeft') step(-1);
    return;
  }
  var onControl = e.target.closest && e.target.closest('button, a');
  if (k === 'ArrowRight') { e.preventDefault(); show((carIdx + 1) % CARS.length); }
  else if (k === 'ArrowLeft') { e.preventDefault(); show((carIdx + CARS.length - 1) % CARS.length); }
  else if (k === 'Enter' && !onControl) { e.preventDefault(); openHood(); }
});

/* ---------- Start ---------- */
resize();
var start = homeView();
camera.position.copy(start.pos).multiplyScalar(1.35);
controls.target.copy(start.target);
loop();
var deep = location.hash.slice(1), at = CARS.findIndex(function (c) { return c.id === deep; });
show(at >= 0 ? at : 0, { keepHash: true }).then(function () {
  if (!current) return;
  var door = openShutter();
  // The camera rolls in as the door goes up
  moveCamera(homeView(), Math.max(1800, door)).then(function () {
    if (at >= 0) openHood();
    else if (deep === 'about') openSheet(ABOUT);
    else if (deep === 'contact') openSheet(CONTACT);
    else if (deep === 'room') openRoom();
  });
  var toast = $('toast');
  toast.textContent = phone.matches ? 'Tap the car to pop the hood · swipe to look around' : 'Click the car to pop the hood · drag to look around';
  setTimeout(function () { toast.classList.add('show'); }, door + 300);
  setTimeout(function () { toast.classList.remove('show'); }, door + 5600);
});
window.__garage = { driver: driver, home: homeView, audio: audio, scene: scene, camera: camera, renderer: renderer, get current() { return current; }, show: show, openHood: openHood, closeHood: closeHood, turntable: turntable, controls: controls };
