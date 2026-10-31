/* =====================================================================
   GARAGE TYCOON
   Discover cars → evaluate deals → buy or finance → set rental prices →
   earn → manage costs → expand the garage → grow net worth to $5M.

   One source of truth: every number the player sees (marketplace, adviser,
   garage, rentals, finances) comes from dayProb() and project() below, and
   the weekly simulation books rentals with the same dayProb().
   ===================================================================== */

/* ---------------- Tunable economics ---------------- */
var GOAL = 5000000;
var START_CASH = 100000;
var PLATFORM_FEE = 0.15;       // booking platform's cut of every rental (premium host plan)
var SELL_SPREAD = 0.94;        // instant-sale price as a share of market value
var INSPECTION = 400;
var WRAP_COST = 3000;
var MIN_DOWN = 0.2;
var DAMAGE_P = 0.003;          // chance a rental day ends with renter damage
var TURNAROUND = 0.12;         // chance a car is blocked the day after a rental (cleaning, detailing, late return)
var NOISE_SD = 0.3;            // week-to-week randomness in each car's bookings
var NOISE_MEAN = Math.exp(NOISE_SD * NOISE_SD / 2);
var RENTAL_MILES = 80;         // miles added per rental day
var RENTAL_WEAR = 0.08;        // condition points lost per rental day (routine maintenance covers the rest)
var FAIL_BASE = 0.012;         // weekly chance of an unscheduled repair for a typical car
var WEEKS_PER_MONTH = 52 / 12;
var COLLECTION_INS = 0.35;     // agreed-value storage insurance for cars on display, vs. a rental policy
var COLLECTION_MAINT = 0.3;    // a car that isn't driven needs a fraction of the upkeep
var COLLECTION_SPOTS = [1, 2, 3, 4, 6]; // display spots in your private collection at each garage tier

// Monthly demand multipliers by category (each averages 1.0 over the year)
var SEASONS = {
  sports:      [0.55, 0.6, 0.8, 1.0, 1.15, 1.35, 1.45, 1.4, 1.15, 0.95, 0.75, 0.85],
  exotic:      [0.65, 0.7, 0.85, 1.0, 1.1, 1.3, 1.35, 1.3, 1.05, 0.95, 0.8, 0.95],
  collectible: [0.75, 0.8, 0.9, 1.0, 1.1, 1.2, 1.25, 1.2, 1.05, 1.0, 0.85, 0.9]
};
var TIERS = [
  { bays: 2, name: 'Two-Car Garage', cost: 0, fee: 60 },
  { bays: 4, name: 'Workshop', cost: 20000, fee: 220 },
  { bays: 8, name: 'Showroom', cost: 75000, fee: 550 },
  { bays: 12, name: 'Private Gallery', cost: 200000, fee: 1000 },
  { bays: 20, name: 'Collector’s Museum', cost: 450000, fee: 1800 }
];
var CLASS_LABEL = { sports: 'Sports', exotic: 'Exotic', collectible: 'Collectible' };

/* Cars on the market. Every one has a real 3D model (v3d → vehicle3d.js).
   value: market value of a typical example (refYear, normal mileage, good condition) when the game starts · perYear: normal miles per year
   rate: reference daily rate · demand: chance a weekday books at that rate in an average month · lift: weekend boost
   elastic: how sharply bookings fall as you raise the price · ins / maint: monthly · repair: expected unscheduled repairs per year as a share of value
   dep: yearly depreciation (negative = appreciation) · trims: [name, value premium, rate premium, first year] */
var MODELS = {
  c8:   { make: 'Chevrolet', name: 'Corvette C8 Stingray', v3d: 'c8', cls: 'sports', value: 66000, refYear: 2022, years: [2020, 2025], perYear: 5000, rate: 420, demand: 0.36, lift: 1.5, elastic: 1.6, ins: 330, maint: 140, repair: 0.015, dep: 0.06, clean: 30, deductible: 2500, rarity: 'Common', weight: 3, color: '#1f6fe0', trims: [['1LT', 0, 0], ['2LT', 0.07, 0.03], ['3LT', 0.13, 0.06]] },
  nsx:  { make: 'Acura', name: 'NSX', v3d: 'nsx', cls: 'exotic', exotic: true, value: 128000, refYear: 2019, years: [2017, 2021], perYear: 3500, rate: 700, demand: 0.24, lift: 1.7, elastic: 1.3, ins: 520, maint: 240, repair: 0.018, dep: 0.05, clean: 45, deductible: 5000, rarity: 'Uncommon', weight: 1.5, color: '#c9cdd2', trims: [['Coupe', 0, 0]] },
  nsxs: { make: 'Acura', name: 'NSX Type S', v3d: 'nsx', cls: 'collectible', exotic: true, value: 185000, refYear: 2022, years: [2022, 2022], perYear: 2500, rate: 850, demand: 0.22, lift: 1.7, elastic: 1.3, ins: 620, maint: 280, repair: 0.015, dep: -0.03, clean: 45, deductible: 5000, rarity: 'Collectible', weight: 1, color: '#e0520f', trims: [['Type S', 0, 0]] },
  f488: { make: 'Ferrari', name: '488 GTB', v3d: '488', cls: 'exotic', exotic: true, value: 205000, refYear: 2018, years: [2016, 2019], perYear: 2500, rate: 1200, demand: 0.24, lift: 1.7, elastic: 1.3, ins: 800, maint: 450, repair: 0.022, dep: 0.03, clean: 45, deductible: 5000, rarity: 'Rare', weight: 1.3, color: '#d40000', trims: [['GTB', 0, 0]] },
  sls:  { make: 'Mercedes-Benz', name: 'SLS AMG', v3d: 'sls', cls: 'collectible', exotic: true, value: 235000, refYear: 2012, years: [2011, 2014], perYear: 2000, rate: 1000, demand: 0.19, lift: 1.7, elastic: 1.3, ins: 600, maint: 420, repair: 0.018, dep: -0.04, clean: 45, deductible: 5000, rarity: 'Collectible', weight: 1, color: '#c9cdd2', trims: [['Coupe', 0, 0], ['GT', 0.1, 0.04, 2013]] },
  c911: { make: 'Porsche', name: '911 Carrera', v3d: 'c911', cls: 'sports', value: 105000, refYear: 2021, years: [2019, 2025], perYear: 4500, rate: 520, demand: 0.31, lift: 1.5, elastic: 1.5, ins: 380, maint: 210, repair: 0.014, dep: 0.05, clean: 30, deductible: 2500, rarity: 'Common', weight: 2.4, color: '#c9cdd2', trims: [['Carrera', 0, 0], ['Carrera S', 0.12, 0.05], ['Carrera 4S', 0.18, 0.07]] },
  gtr:  { make: 'Nissan', name: 'GT-R', v3d: 'gtr', cls: 'sports', value: 88000, refYear: 2017, years: [2013, 2021], perYear: 5000, rate: 500, demand: 0.31, lift: 1.5, elastic: 1.5, ins: 420, maint: 290, repair: 0.02, dep: 0.03, clean: 30, deductible: 2500, rarity: 'Uncommon', weight: 2, color: '#1c1c1e', trims: [['Premium', 0, 0], ['Black Edition', 0.08, 0.03]] },
  amggt: { make: 'Mercedes-AMG', name: 'GT', v3d: 'amggt', cls: 'sports', value: 84000, refYear: 2018, years: [2016, 2021], perYear: 4000, rate: 480, demand: 0.29, lift: 1.5, elastic: 1.5, ins: 380, maint: 290, repair: 0.019, dep: 0.08, clean: 30, deductible: 2500, rarity: 'Common', weight: 2, color: '#f2c230', trims: [['GT', 0, 0], ['GT S', 0.12, 0.04]] },
  i8:   { make: 'BMW', name: 'i8', v3d: 'i8', cls: 'sports', value: 62000, refYear: 2018, years: [2015, 2020], perYear: 4000, rate: 400, demand: 0.27, lift: 1.5, elastic: 1.6, ins: 320, maint: 230, repair: 0.022, dep: 0.09, clean: 30, deductible: 2500, rarity: 'Uncommon', weight: 1.8, color: '#eef0f2', trims: [['Coupe', 0, 0]] },
  emira: { make: 'Lotus', name: 'Emira', v3d: 'emira', cls: 'sports', value: 96000, refYear: 2024, years: [2023, 2025], perYear: 4000, rate: 450, demand: 0.27, lift: 1.5, elastic: 1.5, ins: 360, maint: 240, repair: 0.016, dep: 0.07, clean: 30, deductible: 2500, rarity: 'Uncommon', weight: 1.6, color: '#2f7d4f', trims: [['V6 First Edition', 0, 0]] },
  r8:   { make: 'Audi', name: 'R8', v3d: 'r8', cls: 'exotic', exotic: true, value: 155000, refYear: 2020, years: [2017, 2023], perYear: 3000, rate: 950, demand: 0.25, lift: 1.7, elastic: 1.3, ins: 650, maint: 400, repair: 0.02, dep: 0.04, clean: 45, deductible: 5000, rarity: 'Uncommon', weight: 1.6, color: '#5a6068', trims: [['V10', 0, 0], ['V10 Performance', 0.12, 0.05, 2020], ['GT RWD', 0.3, 0.08, 2023]] },
  huracan: { make: 'Lamborghini', name: 'Huracán', v3d: 'huracan', cls: 'exotic', exotic: true, value: 215000, refYear: 2017, years: [2015, 2019], perYear: 2500, rate: 1400, demand: 0.24, lift: 1.7, elastic: 1.3, ins: 900, maint: 600, repair: 0.023, dep: 0.03, clean: 45, deductible: 5000, rarity: 'Rare', weight: 1.4, color: '#f2c230', trims: [['LP610-4', 0, 0]] },
  m570s: { make: 'McLaren', name: '570S', v3d: 'm570s', cls: 'exotic', exotic: true, value: 135000, refYear: 2018, years: [2016, 2021], perYear: 2500, rate: 950, demand: 0.22, lift: 1.7, elastic: 1.3, ins: 720, maint: 580, repair: 0.03, dep: 0.08, clean: 45, deductible: 5000, rarity: 'Uncommon', weight: 1.2, color: '#ff7a1a', trims: [['Coupe', 0, 0]] },
  gt3:  { make: 'Porsche', name: '911 GT3', v3d: 'gt3', cls: 'collectible', exotic: true, value: 220000, refYear: 2023, years: [2022, 2024], perYear: 2500, rate: 1000, demand: 0.21, lift: 1.7, elastic: 1.3, ins: 700, maint: 380, repair: 0.014, dep: -0.02, clean: 45, deductible: 5000, rarity: 'Rare', weight: 1, color: '#c9cdd2', trims: [['GT3', 0, 0], ['Touring', 0.02, 0]] },
  viper: { make: 'Dodge', name: 'Viper ACR', v3d: 'viper', cls: 'collectible', value: 160000, refYear: 2016, years: [2016, 2017], perYear: 1500, rate: 750, demand: 0.2, lift: 1.6, elastic: 1.4, ins: 520, maint: 330, repair: 0.02, dep: -0.05, clean: 35, deductible: 2500, rarity: 'Collectible', weight: 0.8, color: '#c8102e', trims: [['ACR', 0, 0]] },
  // One of a kind: AO Racing's "Rexy" race car. It isn't street legal, so it can't be rented; it lives in your private collection.
  rexy: { make: 'Porsche', name: '911 GT3 R “Rexy”', v3d: 'rexy', cls: 'collectible', exotic: true, track: true, livery: true, value: 750000, refYear: 2023, years: [2023, 2023], perYear: 400, rate: 0, demand: 0, lift: 1, elastic: 1, ins: 900, maint: 2500, repair: 0.01, dep: -0.07, clean: 0, deductible: 10000, rarity: 'One of a kind', weight: 0.12, color: '#2fae5a', trims: [['AO Racing #80', 0, 0]] }
};
function M_(k) { return MODELS[k]; }
var MARKET_MODELS = Object.keys(MODELS);
var PAINTS = [
  ['Rosso Corsa', '#d40000'], ['Valencia Red', '#b3101e'], ['Thermal Orange', '#e0520f'], ['Rapid Blue', '#1f6fe0'], ['Iridium Silver', '#c9cdd2'],
  ['Nero', '#1c1c1e'], ['Bianco', '#eef0f2'], ['Giallo', '#f2c230'], ['British Green', '#2f7d4f'], ['Gunmetal', '#5a6068']
];

/* ---------------- Helpers ---------------- */
function $(s, r) { return (r || document).querySelector(s); }
function rand(a, b) { return a + Math.random() * (b - a); }
function randi(a, b) { return Math.floor(rand(a, b + 1)); }
function gauss() { var u = 1 - Math.random(), v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
function pickW(items, w) { var t = 0, i; for (i = 0; i < items.length; i++) t += w(items[i]); var r = Math.random() * t; for (i = 0; i < items.length; i++) { r -= w(items[i]); if (r <= 0) return items[i]; } return items[items.length - 1]; }
function money(n) { return (n < 0 ? '−' : '') + '$' + Math.round(Math.abs(n)).toLocaleString('en-US'); }
function moneyS(n) { var a = Math.abs(n), s = n < 0 ? '−' : ''; if (a >= 1e6) return s + '$' + (a / 1e6).toFixed(a >= 1e7 ? 1 : 2) + 'M'; if (a >= 1e4) return s + '$' + Math.round(a / 1000) + 'K'; return money(n); }
function signed(n) { return (n >= 0 ? '+' : '') + money(n); }
function pct(x, d) { return (x * 100).toFixed(d || 0) + '%'; }
function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
var START_DATE = new Date(2027, 0, 4);
function dateOf(w) { return new Date(START_DATE.getTime() + w * 7 * 864e5); }
function monthKey(w) { var d = dateOf(w); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
function monthLabel(key, long) { var p = key.split('-'); return new Date(+p[0], +p[1] - 1, 1).toLocaleString('en-US', long ? { month: 'long', year: 'numeric' } : { month: 'short' }); }
function gameYear(w) { return 2027 + w / 52; }
function trimOf(x) { var M = M_(x.model); return M.trims[x.trim || 0] || M.trims[0]; }
function carName(x, withYear) { var M = M_(x.model), t = trimOf(x)[0]; return (withYear ? x.year + ' ' : '') + M.make + ' ' + M.name + (t && M.trims.length > 1 ? ' ' + t : ''); }
function stars(r) { var n = Math.round(r), s = ''; for (var i = 1; i <= 5; i++) s += i <= n ? '★' : '<i>★</i>'; return '<span class="stars" title="' + r.toFixed(1) + ' of 5">' + s + '</span> <span style="font-size:.8rem">' + r.toFixed(1) + '</span>'; }
function seasonName(w) { return ['Winter', 'Winter', 'Spring', 'Spring', 'Spring', 'Summer', 'Summer', 'Summer', 'Fall', 'Fall', 'Fall', 'Winter'][dateOf(w).getMonth()]; }

/* ---------------- State & saves ---------------- */
var SAVE_KEY = 'garageTycoon.v1';
var S;
function newGame() {
  S = {
    v: 3, week: 0, cash: START_CASH, rep: 3, tier: 0, nextId: 1,
    cars: [], loans: [], market: [], ledger: [], news: [],
    history: [{ w: 0, nw: START_CASH, cash: START_CASH }],
    months: {}, totals: { gross: 0, noi: 0, bookings: 0 },
    trend: { sports: 1, exotic: 1, collectible: 1 },   // market values
    demand: { sports: 1, exotic: 1, collectible: 1 },  // rental market conditions
    mods: { ins: 1, heat: 0, show: 0 },
    awards: {}, tutorial: 0, negWeeks: 0, over: null, won: false, compare: []
  };
  seedMarket();
  log('Opened the garage with ' + money(START_CASH), START_CASH, 'Capital');
}
function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) {} }
function load() {
  try {
    var raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    var s = JSON.parse(raw);
    if (!s || !s.v) return false;
    S = s;
    if (S.v === 1) migrateV1();
    if (S.v === 2) { S.cars.forEach(function (c) { c.display = !!c.display; }); S.v = 3; save(); } // v3 adds the private collection
    return true;
  } catch (e) { return false; }
}
// v1 saves: weekly loan payments, old 14-car market, no rental market conditions. Keep the player's cars, cash and progress.
function migrateV1() {
  S.trend = { sports: (S.trend && S.trend.sports) || 1, exotic: (S.trend && S.trend.exotic) || 1, collectible: (S.trend && S.trend.collectible) || 1 };
  S.demand = { sports: 1, exotic: 1, collectible: 1 };
  S.totals = { gross: (S.totals && S.totals.revenue) || 0, noi: 0, bookings: (S.totals && S.totals.bookings) || 0 };
  S.cars.forEach(function (c) {
    if (c.model === 'nsx') c.model = 'nsxs'; // v1's NSX was the 2022 Type S
    c.trim = c.trim || 0; c.down = c.out ? c.out * 7 : 0; delete c.out;
    c.gross = c.revenue || 0; c.opex = c.costs || 0;
  });
  S.loans.forEach(function (l) {
    var left = Math.max(1, Math.round(l.months - (S.week - l.start) * 12 / 52));
    l.monthsLeft = left; l.mpay = amortize(l.balance, l.apr, left); delete l.pay;
  });
  // Listings were priced with the old model; restock the market from the 3D lineup
  seedMarket();
  S.compare = [];
  Object.keys(S.months).forEach(function (k) { var m = S.months[k]; if (m.rev != null && m.gross == null) { S.months[k] = { gross: m.rev, opex: m.exp, noi: m.rev - m.exp, debt: 0, legacy: true }; } });
  S.v = 2;
  save();
}
function log(text, amount, cat) { S.ledger.unshift({ w: S.week, text: text, amt: amount, cat: cat || '' }); if (S.ledger.length > 100) S.ledger.length = 100; }
function month(w) {
  var k = monthKey(w == null ? S.week : w);
  return S.months[k] || (S.months[k] = { gross: 0, fees: 0, cleaning: 0, ins: 0, maint: 0, repairs: 0, garage: 0, opex: 0, noi: 0, interest: 0, principal: 0, debt: 0, capex: 0, sales: 0, valchg: 0, days: 0, avail: 0 });
}

/* ---------------- Valuation ---------------- */
function expectedMiles(M, year, week) { return Math.max(500, (gameYear(week) - year + 0.5) * M.perYear); }
function valueOf(x, week) {
  var M = M_(x.model);
  var age = (M.refYear - x.year) + week / 52;
  var ageF = Math.pow(1 - M.dep, age);
  var mileF = clamp(1 - (x.miles - expectedMiles(M, x.year, week)) / 100000 * 0.35, 0.6, 1.15);
  var condF = clamp(0.7 + 0.3 * x.cond / 85, 0.75, 1.06);
  return M.value * ageF * mileF * condF * (1 + trimOf(x)[1]) * (S.trend[M.cls] || 1);
}
function ageOf(x, week) { return Math.max(0, gameYear(week == null ? S.week : week) - x.year); }

/* ---------------- Demand: the one formula behind bookings and every projection ---------------- */
function seasonF(cls, week) { return SEASONS[cls][dateOf(week).getMonth()]; }
function refRate(x) { return Math.round(M_(x.model).rate * (1 + trimOf(x)[2]) / 10) * 10; }
function refWkRate(x) { return Math.round(refRate(x) * 1.25 / 10) * 10; }
function ownedInClass(cls, exceptId) { return S.cars.filter(function (c) { return c.listed && c.id !== exceptId && M_(c.model).cls === cls; }).length; }
/* Chance one day books.
   x: the car (model, trim, year, cond, wrap) · o: { week, noise, comp } where comp is how many of your other listed cars compete in its category */
function dayProb(x, rate, weekend, o) {
  o = o || {};
  var M = M_(x.model), w = o.week == null ? S.week : o.week;
  var base = M.demand * (weekend ? M.lift : 1);
  var priceF = Math.min(1.7, Math.pow(refRate(x) / Math.max(rate, 1), M.elastic));
  var season = seasonF(M.cls, w);
  var market = S.demand[M.cls] || 1;
  var repF = 1 + (S.rep - 3) * 0.1;
  var condF = 0.55 + 0.45 * x.cond / 100;
  var ageF = clamp(1 - 0.02 * Math.max(0, gameYear(w) - x.year - 2), 0.75, 1);
  var compF = 1 / (1 + 0.025 * (o.comp || 0)); // your own listings in the same category share some renters
  var events = (S.mods.heat > 0 && M.cls === 'sports' ? 1.2 : 1) * (S.mods.show > 0 && M.exotic ? 1.4 : 1);
  var noise = o.noise == null ? NOISE_MEAN : o.noise;
  return Math.min(0.9, base * priceF * season * market * repF * condF * ageF * compF * events * (x.wrap ? 1.04 : 1) * noise);
}
function maintMonthly(x) { return M_(x.model).maint * clamp(0.75 + x.miles / 60000, 0.75, 1.9) * (x.display ? COLLECTION_MAINT : 1); }
// Repair risk rises with age, mileage above normal and worn condition
function repairMult(x, week) {
  var M = M_(x.model), w = week == null ? S.week : week;
  var mileR = clamp(0.8 + 0.4 * x.miles / expectedMiles(M, x.year, w), 0.8, 1.8);
  return (1 + 0.03 * ageOf(x, w)) * (1 + Math.max(0, 85 - x.cond) / 60) * mileR;
}
function insMonthly(x, listed) { return M_(x.model).ins * S.mods.ins * (x.display ? COLLECTION_INS : listed === false ? 0.5 : 1); }

/* project(): twelve months of expected economics for a car, month by month through the seasons.
   x: { model, trim, year, miles, cond, wrap, value } · o: { rate, wkRate, price, down, term, apr, comp, listed, extraCost }
   Cash items (gross, fees, cleaning, insurance, maintenance, repairs, damage, loan payments) are separate from value change, which is not cash. */
function project(x, o) {
  o = o || {};
  var M = M_(x.model), rate = o.rate || refRate(x), wk = o.wkRate || refWkRate(x);
  var listed = o.listed !== false && !o.display, value = x.value != null ? x.value : valueOf(x, S.week);
  var months = [], tot = { days: 0, gross: 0, fees: 0, cleaning: 0, ins: 0, maint: 0, repairs: 0, damage: 0 };
  var miles = x.miles;
  for (var m = 0; m < 12; m++) {
    var w = S.week + m * WEEKS_PER_MONTH;
    var pd = listed ? dayProb(x, rate, false, { week: w, comp: o.comp }) : 0, pe = listed ? dayProb(x, wk, true, { week: w, comp: o.comp }) : 0;
    var avgP = (5 * pd + 2 * pe) / 7;
    // Days lost to turnaround after rentals and to unscheduled repairs (about 5 days each)
    var avail = (1 - TURNAROUND * avgP) * (1 - FAIL_BASE * repairMult({ model: x.model, year: x.year, miles: miles, cond: x.cond }, w) * 5 / 7);
    var days = (5 * pd + 2 * pe) * WEEKS_PER_MONTH * avail;
    var gross = (5 * pd * rate + 2 * pe * wk) * WEEKS_PER_MONTH * avail;
    var rec = { w: w, days: days, gross: gross, fees: gross * PLATFORM_FEE, cleaning: days * M.clean, ins: insMonthly({ model: x.model, display: o.display }, listed),
      maint: maintMonthly({ model: x.model, miles: miles, display: o.display }), repairs: value * M.repair * repairMult({ model: x.model, year: x.year, miles: miles, cond: x.cond }, w) / 12 * (o.display ? COLLECTION_MAINT : 1), damage: days * DAMAGE_P * M.deductible };
    rec.opex = rec.fees + rec.cleaning + rec.ins + rec.maint + rec.repairs + rec.damage;
    rec.noi = rec.gross - rec.opex;
    months.push(rec);
    ['days', 'gross', 'fees', 'cleaning', 'ins', 'maint', 'repairs', 'damage'].forEach(function (k) { tot[k] += rec[k]; });
    miles += days * RENTAL_MILES + (o.display ? 0 : 100);
  }
  var p = {};
  ['days', 'gross', 'fees', 'cleaning', 'ins', 'maint', 'repairs', 'damage'].forEach(function (k) { p[k] = tot[k] / 12; });
  p.opex = p.fees + p.cleaning + p.ins + p.maint + p.repairs + p.damage;
  p.noi = p.gross - p.opex;
  p.util = p.days / (365 / 12);
  p.now = months[0];
  p.low = months.reduce(function (a, b) { return b.noi < a.noi ? b : a; });
  p.high = months.reduce(function (a, b) { return b.noi > a.noi ? b : a; });
  var after = { model: x.model, trim: x.trim, year: x.year, miles: miles, cond: Math.max(50, x.cond - tot.days * RENTAL_WEAR) };
  p.value = value;
  // Scale the model's value path to this car's actual price point (a listing's market value can sit off the formula)
  var vNow = valueOf({ model: x.model, trim: x.trim, year: x.year, miles: x.miles, cond: x.cond }, S.week);
  p.valueChange = valueOf(after, S.week + 52) * (value / Math.max(1, vNow)) - value;
  p.rate = rate; p.wkRate = wk;
  // Capital and financing
  var price = o.price != null ? o.price : value;
  var down = o.down == null || o.down >= 1 ? 1 : o.down;
  p.price = price; p.cashIn = Math.round(price * down) + (o.extraCost || 0);
  p.principal = down >= 1 ? 0 : price - Math.round(price * down);
  p.apr = o.apr || 0; p.term = o.term || 60;
  p.mpay = p.principal ? amortize(p.principal, p.apr, p.term) : 0;
  p.interestYr = p.principal ? interestFirstYear(p.principal, p.apr, p.term) : 0;
  p.cashflow = p.noi - p.mpay;
  p.equity = value - price - (o.extraCost || 0);
  p.annualReturn = 12 * p.noi - p.interestYr + p.valueChange + p.equity;
  p.roi = p.annualReturn / Math.max(1, p.cashIn);                    // return on the cash you put in
  p.roiUnlev = (12 * p.noi + p.valueChange + p.equity) / Math.max(1, price + (o.extraCost || 0)); // as if bought outright
  p.cashYield = 12 * p.noi / Math.max(1, price);
  p.payback = p.noi > 0 ? (price + (o.extraCost || 0)) / p.noi : Infinity;
  return p;
}

/* ---------------- Totals & financing ---------------- */
function carsValue() { return S.cars.reduce(function (t, c) { return t + c.value; }, 0); }
function debt() { return S.loans.reduce(function (t, l) { return t + l.balance; }, 0); }
function netWorth() { return S.cash + carsValue() - debt(); }
function loanOf(carId) { for (var i = 0; i < S.loans.length; i++) if (S.loans[i].carId === carId) return S.loans[i]; return null; }
function bays() { return TIERS[S.tier].bays; }
function spots() { return COLLECTION_SPOTS[S.tier]; }
function fleet() { return S.cars.filter(function (c) { return !c.display; }); }
function shown() { return S.cars.filter(function (c) { return c.display; }); }
function fixedMonthly() {
  var t = TIERS[S.tier].fee * WEEKS_PER_MONTH;
  S.cars.forEach(function (c) { t += insMonthly(c, c.listed) + maintMonthly(c); });
  S.loans.forEach(function (l) { t += l.mpay; });
  return t;
}
function apr(downPct) { return clamp(0.065 + (3 - S.rep) * 0.006 + (downPct < 0.3 ? 0.01 : 0) + (debt() > 500000 ? 0.008 : 0), 0.049, 0.14); }
function maxDebt() { return 150000 + 1.5 * Math.max(0, netWorth()); }
function amortize(principal, rateYr, months) { var r = rateYr / 12; return r ? principal * r / (1 - Math.pow(1 + r, -months)) : principal / months; }
function interestFirstYear(principal, rateYr, months) { var b = principal, pay = amortize(principal, rateYr, months), t = 0; for (var i = 0; i < 12 && i < months; i++) { var it = b * rateYr / 12; t += it; b -= pay - it; } return t; }
/* What the player can do with a listing right now: cash, finance, or nothing (and why) */
function purchaseOptions(l, price) {
  price = price || l.ask;
  var track = !!M_(l.model).track;
  var o = { track: track, bay: track ? shown().length < spots() : fleet().length < bays(), cash: S.cash >= price, finance: [], reason: '' };
  [0.2, 0.35, 0.5].forEach(function (d) {
    var down = Math.round(price * d), principal = price - down;
    o.finance.push({ down: d, amount: down, ok: S.cash >= down && debt() + principal <= maxDebt(), credit: debt() + principal <= maxDebt() });
  });
  o.canFinance = o.finance.some(function (f) { return f.ok; });
  if (!o.bay) o.reason = track ? 'This is a race car, so it can only live in your private collection, and every display spot is taken (' + spots() + ' at your garage size). Expand, sell or return a car to the rental fleet first.' : 'Every rental bay is full. Expand the garage, retire a car to your private collection, or sell one first.';
  else if (!o.cash && !o.canFinance) o.reason = S.cash < price * MIN_DOWN ? 'You need at least ' + money(price * MIN_DOWN) + ' for a 20% down payment; you have ' + money(S.cash) + '.' : 'That would exceed your credit limit of ' + moneyS(maxDebt()) + ' in total loans.';
  o.action = !o.bay ? 'nobay' : o.cash ? 'buy' : o.canFinance ? 'finance' : 'none';
  return o;
}

/* ---------------- Marketplace ---------------- */
function genListing(force) {
  force = force || {};
  var key = force.model || pickW(MARKET_MODELS, function (k) { return MODELS[k].weight; });
  var M = MODELS[key];
  var year = randi(M.years[0], M.years[1]);
  var trims = M.trims.map(function (t, i) { return i; }).filter(function (i) { return !M.trims[i][3] || year >= M.trims[i][3]; });
  var trim = trims[randi(0, trims.length - 1)];
  var exp = expectedMiles(M, year, S.week);
  var miles = Math.max(300, Math.round(exp * Math.exp(gauss() * 0.4) / 10) * 10);
  var cond = Math.round(clamp(rand(72, 97) - (miles / exp - 1) * 9 - ageOf({ year: year }) * 0.6, 50, 99));
  var x = { model: key, trim: trim, year: year, miles: miles, cond: cond };
  var market = valueOf(x, S.week);
  var r = Math.random(), f, tag = null;
  if (force.f) f = force.f;
  else if (r < 0.06) f = rand(0.76, 0.84);
  else if (r < 0.28) f = rand(0.87, 0.95);
  else if (r < 0.76) f = rand(0.96, 1.05);
  else f = rand(1.07, 1.2);
  if (f < 0.85) tag = 'Hot deal'; else if (f > 1.12) tag = 'Overpriced';
  if (M.track) tag = 'One of a kind';
  var hidden = !force.clean && Math.random() < (f < 0.86 ? 0.36 : 0.16) ? Math.round(market * rand(0.04, 0.1) / 100) * 100 : 0;
  var paint = M.livery || Math.random() < 0.45 ? M.color : PAINTS[randi(0, PAINTS.length - 1)][1];
  return {
    id: S.nextId++, model: key, trim: trim, year: year, miles: miles, cond: cond, color: paint,
    market: Math.round(market / 100) * 100, ask: Math.round(market * f / 100) * 100, hidden: hidden, inspected: false,
    reserve: Math.round(market * f * (f > 1.08 ? rand(0.85, 0.93) : f < 0.9 ? rand(0.96, 1) : rand(0.9, 0.97)) / 100) * 100,
    weeks: force.weeks || randi(2, 5), tag: tag, offered: false, counter: null
  };
}
function seedMarket() {
  // Two Corvettes so the first decision is a real trade-off (cheaper and older vs newer and pricier)
  S.market = [
    genListing({ model: 'c8', f: 0.94, clean: true, weeks: 4 }),
    genListing({ model: 'c8', f: 1.0, weeks: 4 }),
    genListing({ model: ['f488', 'nsx', 'sls', 'nsxs'][randi(0, 3)], weeks: 5 })
  ];
  while (S.market.length < 7) S.market.push(genListing());
}
function refreshMarket() {
  S.market.forEach(function (l) { l.weeks--; });
  S.market = S.market.filter(function (l) { return l.weeks > 0; });
  var target = randi(7, 9), adds = 0;
  while (S.market.length < target && adds < 4) { S.market.push(genListing()); adds++; }
  if (!S.market.some(function (l) { return l.model === 'c8'; })) S.market.push(genListing({ model: 'c8' }));
}

/* ---------------- AI investment adviser (transparent rules) ---------------- */
function listingCar(l) { return { model: l.model, trim: l.trim, year: l.year, miles: l.miles, cond: l.inspected && l.hidden ? l.cond - 12 : l.cond, value: l.market }; }
function analyze(l, price) {
  var M = MODELS[l.model], x = listingCar(l), comp = ownedInClass(M.cls);
  price = price || l.counter || l.ask;
  var known = l.inspected ? l.hidden : 0;
  var cashP = project(x, { price: price, comp: comp, extraCost: known, display: M.track });
  var opts = purchaseOptions(l, price);
  var fin = project(x, { price: price, comp: comp, extraCost: known, down: 0.2, term: 60, apr: apr(0.2), display: M.track });
  var discount = (l.market - price) / l.market;
  var exp = expectedMiles(M, l.year, S.week), mileRatio = l.miles / exp;
  // Risk: what could make this purchase go wrong
  var risk = [];
  risk.push(['Category volatility', { sports: 10, exotic: 24, collectible: 16 }[M.cls]]);
  risk.push(['Age', Math.round(clamp(ageOf(l) * 1.6, 0, 18))]);
  risk.push(['Mileage', Math.round(clamp((mileRatio - 1) * 14, 0, 14))]);
  risk.push(['Condition', Math.round(clamp((85 - x.cond) * 0.7, 0, 16))]);
  risk.push(['Running-cost burden', Math.round(clamp((cashP.maint + cashP.repairs + cashP.ins) * 12 / price * 120, 0, 16))]);
  if (!l.inspected) risk.push(['Not inspected', 12]);
  if (!opts.cash) risk.push(['Needs financing', 6]);
  if (opts.cash && S.cash - price < fixedMonthly() * 3) risk.push(['Thin cash cushion', 8]);
  var riskTotal = clamp(risk.reduce(function (t, r) { return t + r[1]; }, 0), 0, 100);
  // Score: four weighted components, each scaled 0–1 from the simulation's own numbers
  var parts = [
    ['Price vs. market', 25, clamp((discount + 0.15) / 0.35, 0, 1), (discount >= 0 ? pct(discount) + ' under' : pct(-discount) + ' over') + ' market value'],
    ['Cash yield', 30, clamp(cashP.cashYield / 0.3, 0, 1), money(cashP.noi) + '/mo net operating income = ' + pct(cashP.cashYield, 1) + ' of the price a year'],
    ['Total return', 20, clamp((cashP.roiUnlev + 0.05) / 0.4, 0, 1), pct(cashP.roiUnlev, 1) + ' a year including ' + (cashP.valueChange >= 0 ? 'appreciation' : 'depreciation') + ' of ' + signed(cashP.valueChange)],
    ['Low risk', 25, 1 - riskTotal / 100, 'Risk ' + riskTotal + '/100']
  ];
  var adj = [];
  if (opts.action === 'none' && opts.bay) adj.push(['Out of reach right now', -12]);
  if (!opts.bay) adj.push(['No free bay', -5]);
  var same = S.cars.filter(function (c) { return c.model === l.model; }).length;
  if (same >= 2) adj.push(['You already own ' + same + ' of these', -4]);
  if (opts.action === 'finance' && fin.low.noi < fin.mpay) adj.push(['Winter income won’t cover the loan payment', -4]);
  var raw = parts.reduce(function (t, p) { return t + p[1] * p[2]; }, 0) + adj.reduce(function (t, a) { return t + a[1]; }, 0);
  var score = Math.round(clamp(raw, 0, 100));
  return { l: l, M: M, x: x, price: price, cash: cashP, fin: fin, opts: opts, discount: discount, mileRatio: mileRatio, expMiles: exp, risk: risk, riskTotal: riskTotal,
    riskLabel: riskTotal < 30 ? 'Low' : riskTotal < 55 ? 'Medium' : 'High', parts: parts, adj: adj, score: score, comp: comp };
}
// Plain-English reasoning built from this listing's numbers and how it stacks up against the same model on the market
function explain(a) {
  var l = a.l, M = a.M, c = a.cash, s = [];
  if (M.track) {
    s.push('At ' + money(a.price) + ', this is the one-of-a-kind AO Racing #80 “Rexy” race car, priced ' + (a.discount >= 0 ? pct(a.discount) + ' under' : pct(-a.discount) + ' over') + ' its estimated value.');
    s.push('It isn’t street legal, so it can’t be rented: it goes straight into your private collection and costs about ' + money(c.opex) + '/mo to insure and maintain.');
    s.push('The case for it is appreciation, roughly ' + money(c.valueChange) + ' a year, plus prestige for your reputation. It earns nothing in cash, so only buy it with money you won’t need for the business.');
    if (!a.opts.bay) s.push('You need a free display spot first.');
    return s.join(' ');
  }
  var peers = S.market.filter(function (p) { return p.model === l.model && p.id !== l.id; });
  var name = M.name.replace('Corvette C8 Stingray', 'Corvette');
  var where = '';
  if (peers.length) {
    var cheaper = peers.filter(function (p) { return p.ask < a.price; }).length;
    where = cheaper === 0 ? 'is the cheapest of the ' + (peers.length + 1) + ' listed' : cheaper === peers.length ? 'is the priciest of the ' + (peers.length + 1) + ' listed' : 'sits mid-pack among ' + (peers.length + 1) + ' listed';
  }
  var vs = a.discount > 0.04 ? pct(a.discount) + ' under its market value' : a.discount < -0.04 ? pct(-a.discount) + ' over its market value' : 'close to its market value';
  s.push('At ' + money(a.price) + ', this ' + l.year + ' ' + name + ' ' + (where ? where + ', priced ' : 'is priced ') + vs + '.');
  if (a.mileRatio > 1.3) s.push('Its ' + l.miles.toLocaleString() + ' miles are ' + pct(a.mileRatio - 1) + ' above normal for a ' + l.year + ', which pushes maintenance to about ' + money(c.maint) + '/mo and raises repair risk.');
  else if (a.mileRatio < 0.7) s.push('Low miles for a ' + l.year + ' (' + l.miles.toLocaleString() + ') keep maintenance near ' + money(c.maint) + '/mo and repair risk down.');
  s.push('Expect about ' + c.days.toFixed(1) + ' rental days and ' + money(c.noi) + '/mo in net operating income on average, from ' + money(c.low.noi) + ' in ' + monthLabel(monthKey(c.low.w), true).split(' ')[0] + ' to ' + money(c.high.noi) + ' in ' + monthLabel(monthKey(c.high.w), true).split(' ')[0] + '.');
  if (c.valueChange < -0.06 * c.value) s.push('It should lose about ' + money(-c.valueChange) + ' of value over a year, which eats into the return.');
  else if (c.valueChange > 0) s.push('As a collectible it should gain about ' + money(c.valueChange) + ' a year, even though rental income is modest.');
  if (a.x.cond < 72) s.push('Condition (' + a.x.cond + '%) dampens demand and adds risk.');
  if (a.opts.action === 'finance') s.push('You’ll need to finance it: 20% down is ' + money(a.price * 0.2) + ', and the ' + money(a.fin.mpay) + '/mo payment ' + (a.fin.low.noi < a.fin.mpay ? 'exceeds the slowest month’s income.' : 'is covered even in the slow season.'));
  if (!l.inspected) s.push('It isn’t inspected yet, so any hidden problem isn’t priced in.');
  else if (l.hidden) s.push('Inspection found ' + money(l.hidden) + ' of repairs, already deducted.');
  // Point out a better-value sibling
  var best = peers.map(function (p) { return analyze(p); }).sort(function (x, y) { return y.score - x.score; })[0];
  if (best && best.score > a.score + 4) s.push('The ' + best.l.year + ' at ' + money(best.price) + ' scores higher (' + best.score + ') on ' + (best.cash.cashYield > c.cashYield ? 'cash yield' : 'risk') + '.');
  return s.slice(0, 5).join(' ');
}
function headline(score) { return score >= 75 ? 'Strong buy' : score >= 62 ? 'Good opportunity' : score >= 48 ? 'Fair deal' : score >= 35 ? 'Proceed with caution' : 'Pass'; }
function scoreColor(s) { return s >= 75 ? '#6fcf8e' : s >= 55 ? '#d4a65a' : s >= 40 ? '#f0a35a' : '#ef6a5a'; }
function ring(s, lg) { return '<div class="ring' + (lg ? ' lg' : '') + '" style="--p:' + s + ';--c:' + scoreColor(s) + '"><b>' + s + '</b></div>'; }
function shortReason(a) {
  var bits = [];
  if (a.discount > 0.08) bits.push(pct(a.discount) + ' under market');
  else if (a.discount < -0.06) bits.push(pct(-a.discount) + ' over market');
  bits.push(money(a.cash.noi) + '/mo NOI');
  if (a.mileRatio > 1.3) bits.push('high miles');
  else if (a.mileRatio < 0.7) bits.push('low miles');
  if (a.cash.valueChange > 0) bits.push('appreciating');
  bits.push(a.riskLabel.toLowerCase() + ' risk');
  return bits.join(' · ');
}

/* ---------------- Actions ---------------- */
function buy(l, price, downPct, months) {
  var o = purchaseOptions(l, price);
  if (!o.bay) return toast(o.reason);
  var cash = downPct >= 1;
  if (cash && !o.cash) return toast('Not enough cash to pay in full. Choose a financing option.');
  var down = cash ? price : Math.round(price * downPct);
  if (!cash && S.cash < down) return toast('Not enough cash for that down payment.');
  var principal = price - down;
  if (principal > 0 && debt() + principal > maxDebt()) return toast('The lender won’t extend that much credit. Put more down.');
  S.cash -= down;
  month().capex += down;
  var track = !!M_(l.model).track;
  var car = {
    id: S.nextId++, model: l.model, trim: l.trim, year: l.year, miles: l.miles, cond: l.cond, color: l.color,
    paid: price, bought: S.week, value: 0, listed: !track, display: track, rate: refRate(l), wkRate: refWkRate(l),
    down: 0, serviced: S.week - 10, gross: 0, opex: 0, days: [], vh: [], wrap: false
  };
  if (l.hidden) {
    S.cash -= l.hidden; car.cond = Math.max(40, car.cond - 12) + (l.inspected ? 8 : 0); car.opex += l.hidden;
    var mo = month(); mo.repairs += l.hidden; mo.opex += l.hidden; mo.noi -= l.hidden;
    log((l.inspected ? 'Agreed repairs' : 'Hidden issue repaired') + ' on ' + M_(l.model).name, -l.hidden, 'Repairs');
  }
  car.value = valueOf(car, S.week);
  car.vh.push(Math.round(car.value));
  S.cars.push(car);
  log('Bought ' + carName(l, true) + (principal ? ' (' + pct(downPct) + ' down)' : ''), -down, 'Purchase');
  if (principal > 0) {
    var r = apr(downPct);
    S.loans.push({ id: S.nextId++, carId: car.id, principal: principal, balance: principal, apr: r, mpay: amortize(principal, r, months), months: months, monthsLeft: months, start: S.week });
    log('Loan of ' + money(principal) + ' at ' + pct(r, 1) + ' APR over ' + months + ' months', 0, 'Financing');
  }
  if (l.hidden && !l.inspected) setTimeout(function () { modal(sumModal('Surprise in the shop', '<div class="note warn">The ' + esc(carName(l)) + ' had a problem the seller didn’t mention. Repairs cost <b>' + money(l.hidden) + '</b> and condition dropped to ' + Math.round(car.cond) + '%. An inspection would have caught it.</div>'), 'sm'); }, 350);
  if ((l.market - price) / l.market >= 0.15) unlock('sharp');
  S.market = S.market.filter(function (x) { return x.id !== l.id; });
  S.compare = S.compare.filter(function (id) { return id !== l.id; });
  if (S.tutorial === 1) S.tutorial = 2;
  checkAwards(); save();
  toast(track ? '<b>' + esc(carName(l)) + '</b> is on display in your private collection.' : '<b>' + esc(carName(l)) + '</b> is in bay ' + fleet().length + ', listed at ' + money(car.rate) + '/day.');
  return car;
}
function sell(car) {
  var price = Math.round(car.value * SELL_SPREAD);
  var loan = loanOf(car.id), payoff = loan ? loan.balance : 0;
  S.cash += price - payoff;
  month().sales += price;
  if (loan) S.loans = S.loans.filter(function (x) { return x !== loan; });
  log('Sold ' + carName(car, true) + (payoff ? ' (loan repaid ' + money(payoff) + ')' : ''), price - payoff, 'Sale');
  if (price > car.paid * 1.1) unlock('flip');
  S.cars = S.cars.filter(function (c) { return c !== car; });
  checkAwards(); save();
  toast('Sold the ' + esc(M_(car.model).name) + ' for <b>' + money(price) + '</b>.');
}
function addOpex(kind, amt) { var mo = month(); mo[kind] += amt; mo.opex += amt; mo.noi -= amt; }
function serviceCost(car) { return Math.round(maintMonthly(car) * 1.5 + 150); }
function service(car) {
  var cost = serviceCost(car);
  if (S.cash < cost) return toast('Not enough cash for a service.');
  S.cash -= cost; car.opex += cost; car.cond = Math.min(100, car.cond + 15); car.serviced = S.week; car.down = Math.max(car.down, 2);
  addOpex('maint', cost);
  log('Serviced ' + M_(car.model).name, -cost, 'Maintenance');
  save(); toast('Serviced: condition ' + Math.round(car.cond) + '%. It’s in the shop for 2 days.');
}
function wrap(car, color) {
  if (S.cash < WRAP_COST) return toast('Not enough cash for a wrap.');
  S.cash -= WRAP_COST; car.opex += WRAP_COST; car.color = color; car.wrap = true;
  month().capex += WRAP_COST;
  log('New wrap on ' + M_(car.model).name, -WRAP_COST, 'Customization');
  save(); toast('Fresh look: renters notice, +4% demand.');
}
function expand() {
  var next = TIERS[S.tier + 1];
  if (!next) return;
  if (S.cash < next.cost) return toast('You need ' + money(next.cost) + ' to expand.');
  S.cash -= next.cost; S.tier++;
  month().capex += next.cost;
  log('Expanded to ' + next.name + ' (' + next.bays + ' bays)', -next.cost, 'Expansion');
  checkAwards(); save();
  toast('Welcome to the <b>' + next.name + '</b>: ' + next.bays + ' bays.');
}
function payOff(loan) {
  if (S.cash < loan.balance) return toast('Not enough cash to pay this off.');
  S.cash -= loan.balance; month().principal += loan.balance;
  log('Paid off loan early', -loan.balance, 'Financing');
  S.loans = S.loans.filter(function (x) { return x !== loan; });
  save(); toast('Loan paid off. One less monthly bill.');
}
function inspect(l) {
  if (S.cash < INSPECTION) return toast('Not enough cash for an inspection.');
  S.cash -= INSPECTION; l.inspected = true; addOpex('repairs', INSPECTION);
  log('Inspection: ' + M_(l.model).name, -INSPECTION, 'Due diligence');
  save();
}

/* ---------------- One week of business ---------------- */
function advanceWeek() {
  if (S.over) return null;
  var sum = { gross: 0, days: 0, fees: 0, cleaning: 0, ins: 0, maint: 0, repairs: 0, garage: 0, interest: 0, principal: 0, events: [], start: netWorth(), valStart: carsValue() };
  var mo = month(), repDelta = 0;
  var listedCount = {};
  S.cars.forEach(function (c) { if (c.listed) listedCount[M_(c.model).cls] = (listedCount[M_(c.model).cls] || 0) + 1; });
  S.cars.forEach(function (c) {
    var M = M_(c.model), comp = Math.max(0, (listedCount[M.cls] || 0) - (c.listed ? 1 : 0));
    var noise = Math.exp(gauss() * NOISE_SD), booked = [0, 0, 0, 0, 0, 0, 0], blocked = false;
    for (var d = 0; d < 7; d++) {
      if (c.display) { booked[d] = 4; continue; }
      if (c.down > 0) { c.down--; booked[d] = 3; continue; }
      if (!c.listed) { booked[d] = 2; continue; }
      if (blocked) { blocked = false; booked[d] = 3; continue; }
      var weekend = d >= 5, rate = weekend ? c.wkRate : c.rate;
      mo.avail++;
      if (Math.random() < dayProb(c, rate, weekend, { noise: noise, comp: comp })) {
        booked[d] = 1; sum.days++; sum.gross += rate; c.gross += rate;
        var fee = rate * PLATFORM_FEE; sum.fees += fee; sum.cleaning += M.clean; c.opex += fee + M.clean;
        c.cond -= RENTAL_WEAR; c.miles += RENTAL_MILES;
        if (Math.random() < TURNAROUND) blocked = true;
        if (Math.random() < DAMAGE_P) {
          var dmg = Math.round(c.value * rand(0.01, 0.05) / 50) * 50, pay = Math.min(dmg, M.deductible);
          sum.repairs += pay; c.opex += pay; c.cond -= rand(3, 8); repDelta -= 0.12; c.down += randi(1, 3);
          sum.events.push({ i: '⚠', t: 'A renter damaged your ' + M.name + ': ' + money(dmg) + ' in repairs, you paid the ' + money(pay) + ' deductible.' });
        }
      }
    }
    c.days = c.days.concat(booked).slice(-28);
    // Unscheduled repairs: likelier on older, high-mileage, worn or recently neglected cars
    var q = FAIL_BASE * repairMult(c) * (S.week - c.serviced < 8 ? 0.6 : 1) * (c.display ? COLLECTION_MAINT : 1);
    if (Math.random() < q) {
      var cost = Math.round(c.value * M.repair * 1.6 * rand(0.5, 1.5) / 50) * 50 + 200;
      sum.repairs += cost; c.opex += cost; c.down += randi(3, 7); c.cond = Math.max(30, c.cond - 3); if (c.listed) repDelta -= 0.04;
      sum.events.push({ i: '🔧', t: 'Your ' + M.name + ' needs ' + money(cost) + ' of unscheduled repairs and will be in the shop for a few days.' });
    }
    var ins = insMonthly(c, c.listed) / WEEKS_PER_MONTH, mt = maintMonthly(c) / WEEKS_PER_MONTH;
    sum.ins += ins; sum.maint += mt; c.opex += ins + mt;
    c.cond = clamp(c.cond, 25, 100); if (!c.display) c.miles += 25;
  });
  sum.garage = TIERS[S.tier].fee;
  var opex = sum.fees + sum.cleaning + sum.ins + sum.maint + sum.repairs + sum.garage;
  var noi = sum.gross - opex;
  S.cash += noi;
  ['gross', 'fees', 'cleaning', 'ins', 'maint', 'repairs', 'garage', 'days'].forEach(function (k) { mo[k] += sum[k]; });
  mo.opex += opex; mo.noi += noi;
  S.totals.gross += sum.gross; S.totals.noi += noi; S.totals.bookings += sum.days;
  if (sum.gross) log('Week ' + (S.week + 1) + ' rentals (' + sum.days + ' days booked)', sum.gross, 'Rental revenue');
  if (sum.fees + sum.cleaning) log('Platform fees & cleaning', -(sum.fees + sum.cleaning), 'Operating');
  log('Insurance, maintenance & garage', -(sum.ins + sum.maint + sum.garage), 'Operating');
  if (sum.repairs) log('Repairs & deductibles', -sum.repairs, 'Repairs');

  if (S.mods.heat > 0) S.mods.heat--;
  if (S.mods.show > 0) S.mods.show--;
  randomEvent(sum);

  S.week++;
  // Monthly: loan payments fall due on the 1st, and market conditions drift
  if (monthKey(S.week) !== monthKey(S.week - 1)) {
    var nm = month();
    S.loans.forEach(function (l) {
      var interest = l.balance * l.apr / 12, princ = Math.min(l.balance, l.mpay - interest);
      l.balance = Math.max(0, l.balance - princ); l.monthsLeft--;
      S.cash -= interest + princ; sum.interest += interest; sum.principal += princ;
      nm.interest += interest; nm.principal += princ; nm.debt += interest + princ;
    });
    if (sum.interest) log('Loan payments (' + money(sum.interest) + ' interest)', -(sum.interest + sum.principal), 'Financing');
    var done = S.loans.filter(function (l) { return l.balance < 1; });
    S.loans = S.loans.filter(function (l) { return l.balance >= 1; });
    done.forEach(function () { sum.events.push({ i: '✓', t: 'A car loan is fully paid off.' }); });
    Object.keys(S.demand).forEach(function (k) { S.demand[k] = clamp(S.demand[k] + 0.3 * (1 - S.demand[k]) + gauss() * 0.06, 0.75, 1.25); });
    Object.keys(S.trend).forEach(function (k) { S.trend[k] = clamp(S.trend[k] * (1 + gauss() * 0.015), 0.82, 1.25); });
    S.mods.ins = 1 + (S.mods.ins - 1) * 0.97; // premium hikes ease off as competition returns
  }
  S.cars.forEach(function (c) { c.value = valueOf(c, S.week); if (S.week % 2 === 0) { c.vh.push(Math.round(c.value)); if (c.vh.length > 60) c.vh.shift(); } });
  var valChg = carsValue() - sum.valStart;
  month(S.week - 1).valchg += valChg;
  refreshMarket();

  if (S.cars.length) {
    var avgCond = S.cars.reduce(function (t, c) { return t + c.cond; }, 0) / S.cars.length;
    repDelta += sum.days * (avgCond > 70 ? 0.0015 : 0.0005) - (avgCond < 60 ? 0.05 : 0);
    // A curated collection on display adds a little prestige
    shown().forEach(function (c) { repDelta += M_(c.model).cls === 'sports' ? 0.0015 : 0.003; });
  }
  S.rep = clamp(S.rep + repDelta, 1, 5);

  if (S.cash < 0) {
    var od = Math.round(-S.cash * 0.02); S.cash -= od; S.negWeeks++; month().interest += od; month().debt += od;
    log('Overdraft fee', -od, 'Financing');
    sum.events.push({ i: '‼', t: 'Your account is overdrawn (' + money(S.cash) + '). Get back above $0 within ' + (3 - S.negWeeks) + ' week' + (3 - S.negWeeks === 1 ? '' : 's') + ' or the business goes under: sell a car or cut costs.' });
  } else S.negWeeks = 0;

  var nw = netWorth();
  S.history.push({ w: S.week, nw: Math.round(nw), cash: Math.round(S.cash) });
  if (S.history.length > 520) S.history.shift();
  sum.opex = opex; sum.noi = noi; sum.debt = sum.interest + sum.principal; sum.cashflow = noi - sum.debt; sum.valchg = valChg; sum.end = nw;
  if (S.negWeeks >= 3 || (nw < 0 && S.cash < 0)) S.over = 'bankrupt';
  else if (nw >= GOAL && !S.won) { S.won = true; S.over = 'won'; }
  if (S.tutorial === 3) S.tutorial = 4;
  checkAwards(); save();
  return sum;
}
function randomEvent(sum) {
  if (Math.random() > 0.3) return;
  var owned = S.cars.length > 0;
  var evs = [
    { w: 1, f: function () { S.mods.heat = 2; return { i: '☀', t: 'A warm spell is coming: sports car bookings up 20% for two weeks.' }; } },
    { w: 1, f: function () { S.mods.show = 1; return { i: '🏁', t: 'A big car show is in town: exotic bookings up 40% next week.' }; } },
    { w: S.mods.ins < 1.25 ? 0.6 : 0, f: function () { S.mods.ins = Math.min(1.3, S.mods.ins * 1.08); return { i: '📈', t: 'Insurers raised premiums 8% across the board.' }; } },
    { w: 1, f: function () { var k = ['sports', 'exotic'][randi(0, 1)], up = Math.random() < 0.5; S.trend[k] = clamp(S.trend[k] * (up ? 1.05 : 0.95), 0.82, 1.25); return { i: up ? '▲' : '▼', t: CLASS_LABEL[k] + ' car values ' + (up ? 'rose' : 'fell') + ' 5% this month.' }; } },
    { w: 0.8, f: function () { var k = ['sports', 'exotic', 'collectible'][randi(0, 2)], up = Math.random() < 0.5; S.demand[k] = clamp(S.demand[k] * (up ? 1.12 : 0.88), 0.75, 1.25); return { i: up ? '▲' : '▼', t: up ? 'Tourism is up: ' + CLASS_LABEL[k].toLowerCase() + ' rental demand strengthened.' : 'A new rental fleet opened nearby: ' + CLASS_LABEL[k].toLowerCase() + ' rental demand softened.' }; } },
    { w: 0.7, f: function () { S.trend.collectible = clamp(S.trend.collectible * 1.06, 0.82, 1.25); return { i: '◆', t: 'Collector buzz: collectible cars gained 6% in value.' }; } },
    { w: 1.1, f: function () { var l = genListing({ f: rand(0.76, 0.82), weeks: 2 }); l.tag = 'Hot deal'; S.market.unshift(l); return { i: '🔥', t: 'Hot tip: a ' + carName(l, true) + ' just listed ' + pct(1 - l.ask / l.market) + ' under market. It won’t last.' }; } },
    { w: owned ? 0.8 : 0, f: function () { S.rep = clamp(S.rep + 0.2, 1, 5); return { i: '★', t: 'An influencer rented one of your cars and raved about it. Reputation up.' }; } }
  ];
  var e = pickW(evs, function (x) { return x.w; }).f();
  sum.events.push(e);
  S.news.unshift({ w: S.week + 1, i: e.i, t: e.t }); if (S.news.length > 12) S.news.length = 12;
}

/* ---------------- Achievements ---------------- */
var AWARDS = [
  { id: 'first', name: 'Keys in Hand', desc: 'Buy your first car.', test: function () { return S.cars.length >= 1; } },
  { id: 'exotic', name: 'Supercar Club', desc: 'Own your first exotic supercar.', test: function () { return S.cars.some(function (c) { return M_(c.model).exotic; }); } },
  { id: 'ten', name: 'Collector', desc: 'Own 10 vehicles at once.', test: function () { return S.cars.length >= 10; } },
  { id: 'rev100', name: 'Rental Mogul', desc: 'Earn $100,000 in rental revenue.', test: function () { return S.totals.gross >= 100000; } },
  { id: 'sharp', name: 'Sharp Eye', desc: 'Buy a car at least 15% under market value.', test: function () { return false; } },
  { id: 'flip', name: 'Bought Low, Sold High', desc: 'Sell a car for 10%+ more than you paid.', test: function () { return false; } },
  { id: 'five', name: 'Five Stars', desc: 'Reach a 4.8-star reputation.', test: function () { return S.rep >= 4.8; } },
  { id: 'million', name: 'Seven Figures', desc: 'Reach $1,000,000 net worth.', test: function () { return netWorth() >= 1e6; } },
  { id: 'museum', name: 'Museum Curator', desc: 'Expand to the 20-bay Collector’s Museum.', test: function () { return S.tier >= 4; } },
  { id: 'debtfree', name: 'Debt Free', desc: 'Own 4+ cars with no loans outstanding.', test: function () { return S.cars.length >= 4 && S.loans.length === 0; } },
  { id: 'curator', name: 'Private Curator', desc: 'Put 3 cars on display in your private collection.', test: function () { return shown().length >= 3; } },
  { id: 'rexy', name: 'Rexy Roars', desc: 'Own the one-of-a-kind Porsche 911 GT3 R “Rexy”.', test: function () { return S.cars.some(function (c) { return c.model === 'rexy'; }); } },
  { id: 'empire', name: 'Automotive Empire', desc: 'Reach $5,000,000 net worth.', test: function () { return netWorth() >= GOAL; } }
];
function unlock(id) {
  if (S.awards[id] != null) return;
  S.awards[id] = S.week;
  toast('🏆 Achievement unlocked: <b>' + AWARDS.filter(function (x) { return x.id === id; })[0].name + '</b>');
}
function checkAwards() { AWARDS.forEach(function (a) { if (S.awards[a.id] == null && a.test()) unlock(a.id); }); }

/* ---------------- 3D previews (vehicle3d.js) ---------------- */
// Cards hold a placeholder; once on screen, it's swapped for a still render of the real 3D model in the listing's paint.
function car3d(x, color, w, h, cls) {
  var M = M_(x.model);
  if (!M.v3d) return '<div class="v3d-none"><b>' + esc(M.make + ' ' + M.name) + '</b><span>Legacy car · no 3D model</span></div>';
  return '<img class="v3d ' + (cls || '') + '" alt="' + esc(carName(x, true)) + ' in 3D" data-key="' + M.v3d + '" data-color="' + color + '" data-w="' + w + '" data-h="' + h + '" src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==">';
}
var v3dIO = null;
function load3d(img) {
  if (img.dataset.loading) return;
  img.dataset.loading = '1';
  var st = img.closest('.bay-stage');
  if (st) st.classList.add('v3d-loading');
  window.Vehicle3DPreview.snapshot(img.dataset.key, img.dataset.color, { width: +img.dataset.w, height: +img.dataset.h }).then(function (url) {
    img.src = url; img.classList.add('ready');
    if (st) st.classList.remove('v3d-loading');
  }).catch(function () { if (st) { st.classList.remove('v3d-loading'); st.classList.add('v3d-failed'); } });
}
// Render only the previews on (or near) screen; the rest wait until they scroll into view
function hydrate3d(root) {
  if (!window.Vehicle3DPreview) return;
  if (!v3dIO && 'IntersectionObserver' in window) v3dIO = new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { v3dIO.unobserve(e.target); load3d(e.target); } });
  }, { rootMargin: '200px' });
  var imgs = (root || document).querySelectorAll('img.v3d:not(.ready)');
  imgs.forEach(function (img) { if (v3dIO) v3dIO.observe(img); });
  // Some browsers hold back observer callbacks (e.g. background tabs); load what's already in view regardless
  setTimeout(function () {
    imgs.forEach(function (img) { var r = img.getBoundingClientRect(); if (!v3dIO || (r.bottom > -200 && r.top < innerHeight + 200)) load3d(img); });
  }, 600);
}
addEventListener('vehicle3d:ready', function () { hydrate3d(); mountViewer(); });
var viewerHandle = null;
function mountViewer() {
  var el = $('#viewer');
  if (viewerHandle) { viewerHandle.dispose(); viewerHandle = null; }
  if (!el || !window.Vehicle3DPreview) return;
  viewerHandle = window.Vehicle3DPreview.mount(el, el.dataset.key, el.dataset.color);
}
function viewerHTML(x, color) {
  var M = M_(x.model);
  if (!M.v3d) return '<div class="bay-stage">' + car3d(x, color) + '</div>';
  return '<div class="viewer-wrap"><div class="viewer" id="viewer" data-key="' + M.v3d + '" data-color="' + color + '"></div><span class="viewer-hint">Drag to rotate · scroll or pinch to zoom</span><button class="viewer-size" data-act="viewer-size" aria-label="Enlarge 3D view">⤢</button></div>';
}

/* ---------------- UI shell ---------------- */
var ICONS = {
  garage: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 10 12 4l9 6v10H3z"/><path d="M7 20v-6h10v6"/></svg>',
  market: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16l-1.5 11h-13z"/><path d="M8 7a4 4 0 0 1 8 0"/></svg>',
  rentals: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  finances: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/></svg>',
  adviser: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="8"/><path d="M12 8v5l3 2"/></svg>',
  awards: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="9" r="5"/><path d="M8.5 13 7 21l5-3 5 3-1.5-8"/></svg>'
};
var TABS = [['garage', 'Garage'], ['market', 'Marketplace', 'Market'], ['rentals', 'Rentals'], ['finances', 'Finances', 'Finance'], ['adviser', 'AI Adviser', 'Adviser'], ['awards', 'Achievements', 'Awards']];
var tab = 'garage', mFilter = 'all', mSort = 'score';
function renderTabs() {
  $('#tabs').innerHTML = TABS.map(function (t) {
    var dot = t[0] === 'market' && S.market.some(function (l) { return l.tag === 'Hot deal'; }) ? '<span class="dot"></span>' : '';
    var label = t[2] ? '<span class="long">' + t[1] + '</span><span class="short-l">' + t[2] + '</span>' : t[1];
    return '<button class="tab' + (tab === t[0] ? ' on' : '') + '" data-act="tab" data-tab="' + t[0] + '"' + (tab === t[0] ? ' aria-current="page"' : '') + '>' + ICONS[t[0]] + label + dot + '</button>';
  }).join('');
}
function seasonLine() {
  return ['sports', 'exotic', 'collectible'].map(function (k) { return CLASS_LABEL[k] + ' ×' + (seasonF(k, S.week) * S.demand[k]).toFixed(2); }).join(' · ');
}
function renderHUD() {
  document.body.dataset.tier = Math.min(S.tier, 4);
  $('#tier-name').textContent = TIERS[S.tier].name;
  $('#k-nw').textContent = moneyS(netWorth());
  $('#k-cash').innerHTML = '<span class="' + (S.cash < 0 ? 'down' : '') + '">' + moneyS(S.cash) + '</span>';
  $('#k-rep').innerHTML = stars(S.rep);
  var d = dateOf(S.week);
  $('#k-date').textContent = d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  var sf = seasonF('sports', S.week) * S.demand.sports;
  $('#k-week').textContent = 'Week ' + (S.week + 1) + ' · ' + seasonName(S.week) + ': rentals ' + (sf < 0.75 ? 'slow' : sf < 0.95 ? 'below average' : sf < 1.15 ? 'normal' : 'busy');
  $('#k-week').title = 'Demand this month vs. an average month: ' + seasonLine();
  $('#next-week').classList.toggle('pulse', S.tutorial === 3);
}
var VIEWS = {};
function render() {
  renderHUD(); renderTabs();
  $('#view').innerHTML = VIEWS[tab]();
  renderCoach();
  var narrow = innerWidth <= 860;
  document.querySelectorAll('.short-l').forEach(function (e) { e.style.display = narrow ? '' : 'none'; });
  document.querySelectorAll('.tab .long').forEach(function (e) { e.style.display = narrow ? 'none' : ''; });
  hydrate3d($('#view'));
}

/* ---------------- Garage view ---------------- */
function carStatus(c) {
  if (c.display) return '<span class="status display">On display</span>';
  if (c.down > 0) return '<span class="status service">In the shop</span>';
  if (!c.listed) return '<span class="status off">Off market</span>';
  var last = c.days.slice(-7), n = last.filter(function (x) { return x === 1; }).length;
  if (!last.length) return '<span class="status idle">Listed</span>';
  return n ? '<span class="status rented">Rented ' + n + '/7</span>' : '<span class="status idle">Idle</span>';
}
function util(c, n) { var d = c.days.slice(-(n || 28)).filter(function (x) { return x !== 2; }); return d.length ? d.filter(function (x) { return x === 1; }).length / d.length : 0; }
function carProjection(c) { return project(c, { rate: c.rate, wkRate: c.wkRate, comp: ownedInClass(M_(c.model).cls, c.id), listed: c.listed, display: c.display, price: c.value }); }
VIEWS.garage = function () {
  var nw = netWorth(), next = TIERS[S.tier + 1];
  var img = [0.12, 0.2, 0.3, 0.42, 0.55][Math.min(S.tier, 4)];
  var h = '<section class="hq" style="--hq-img:' + img + '"><p class="eyebrow">Headquarters · ' + fleet().length + ' of ' + bays() + ' rental bays · ' + shown().length + ' of ' + spots() + ' display spots</p><h1>' + TIERS[S.tier].name + '</h1>' +
    '<div class="hq-meta"><div class="goal"><small><span>Net worth ' + money(nw) + '</span><span>Goal ' + moneyS(GOAL) + '</span></small><div class="bar"><span style="width:' + clamp(nw / GOAL * 100, 0, 100).toFixed(1) + '%"></span></div></div>' +
    (next ? '<button class="btn' + (fleet().length >= bays() ? ' gold' : '') + '" data-act="expand"' + (S.cash < next.cost ? ' disabled' : '') + '>Expand to ' + next.bays + ' bays · ' + moneyS(next.cost) + '</button>' : '<span class="chip gold">Fully expanded</span>') +
    '</div></section><h2 class="sec-title">Rental fleet <small>' + fleet().length + ' of ' + bays() + ' bays</small></h2><div class="bays">';
  fleet().forEach(function (c, i) {
    var M = M_(c.model), gain = c.value - c.paid, p = carProjection(c);
    h += '<button class="bay" data-act="car" data-id="' + c.id + '"><div class="bay-stage"><span class="bay-no">BAY ' + String(i + 1).padStart(2, '0') + '</span><span class="bay-status">' + carStatus(c) + '</span>' + car3d(c, c.color, 760, 410) + '</div>' +
      '<div class="plaque"><b>' + esc(M.make + ' ' + M.name) + '</b><span class="v num">' + moneyS(c.value) + '</span><small>' + c.year + ' · ' + Math.round(c.miles).toLocaleString() + ' mi · ' + pct(util(c)) + ' booked</small><small class="num ' + (gain >= 0 ? 'up' : 'down') + '" style="text-align:right">' + (gain >= 0 ? '+' : '') + moneyS(gain) + '</small>' +
      '<small>Est. NOI this month</small><small class="num ' + (p.now.noi >= 0 ? 'up' : 'down') + '" style="text-align:right">' + money(p.now.noi) + '</small>' +
      '<div class="mini-bar" title="Condition ' + Math.round(c.cond) + '%"><span style="width:' + c.cond + '%;background:' + (c.cond < 60 ? 'var(--red)' : c.cond < 75 ? '#f0a35a' : 'var(--gold)') + '"></span></div></div></button>';
  });
  for (var i = fleet().length; i < bays(); i++) h += '<button class="bay empty-bay" data-act="tab" data-tab="market"><span class="plus">+</span><b>Bay ' + String(i + 1).padStart(2, '0') + ' is empty</b><span>Visit the marketplace</span></button>';
  if (next) h += '<button class="bay empty-bay locked" data-act="expand"' + (S.cash < next.cost ? ' disabled' : '') + '><span class="plus">🔒</span><b>' + next.name + '</b><span>' + (next.bays - bays()) + ' more bays and ' + (COLLECTION_SPOTS[S.tier + 1] - spots()) + ' more display spot' + (COLLECTION_SPOTS[S.tier + 1] - spots() === 1 ? '' : 's') + ' · ' + money(next.cost) + ' · ' + money(next.fee) + '/wk upkeep</span></button>';
  h += '</div>' + collectionHTML();
  if (S.news.length) h += '<section class="card panel" style="margin-top:20px"><h3>Garage news <small>Latest events</small></h3>' + S.news.slice(0, 4).map(function (n) { return '<div class="tip"><i>' + n.i + '</i><p><b>Week ' + n.w + '.</b> ' + esc(n.t) + '</p></div>'; }).join('') + '</section>';
  return h;
};

/* Private collection: cars you keep but no longer rent out. No bookings and no wear; cheaper storage insurance
   and upkeep; values keep moving (collectibles appreciate); each car on display adds a little prestige. */
function collectionHTML() {
  var h = '<section class="collection"><h2 class="sec-title">Private collection <small>' + shown().length + ' of ' + spots() + ' display spots</small></h2>' +
    '<p class="collection-note">Retired cars live here, off the rental market: storage insurance runs ' + pct(COLLECTION_INS) + ' of a rental policy, upkeep ' + pct(COLLECTION_MAINT) + ', there’s no wear, and each car on display adds a little prestige to your reputation. Values keep moving, so it’s the place for collectibles you want to hold. Retire a car from its page.</p><div class="bays">';
  shown().forEach(function (c) {
    var M = M_(c.model), gain = c.value - c.paid, p = carProjection(c);
    h += '<button class="bay display" data-act="car" data-id="' + c.id + '"><div class="bay-stage"><span class="bay-no">' + esc(M.rarity.toUpperCase()) + '</span><span class="bay-status">' + carStatus(c) + '</span>' + car3d(c, c.color, 760, 410) + '</div>' +
      '<div class="plaque"><b>' + esc(carName(c, true)) + '</b><span class="v num">' + moneyS(c.value) + '</span><small>' + (M.track ? 'Race car · display only' : 'Retired from rentals') + '</small><small class="num ' + (gain >= 0 ? 'up' : 'down') + '" style="text-align:right">' + (gain >= 0 ? '+' : '') + moneyS(gain) + ' since bought</small>' +
      '<small>Holding cost / value change</small><small class="num" style="text-align:right">' + money(-p.opex) + '/mo · <span class="' + (p.valueChange >= 0 ? 'up' : 'down') + '">' + signed(p.valueChange) + '/yr</span></small></div></button>';
  });
  for (var i = shown().length; i < spots(); i++) h += '<div class="bay empty-bay plinth"><span class="plus">◇</span><b>Empty display spot</b><span>Open a car and choose “Retire to collection”</span></div>';
  return h + '</div></section>';
}
function retire(c) {
  if (shown().length >= spots()) return toast('Every display spot is taken (' + spots() + '). Expand the garage for more.');
  c.display = true; c.listed = false; c.down = 0;
  log('Retired ' + carName(c, true) + ' to the private collection', 0, 'Collection');
  save(); toast('<b>' + esc(carName(c)) + '</b> is now on display. Bay freed up.');
}
function unretire(c) {
  if (M_(c.model).track) return toast('It’s a race car: it can’t be rented on the street.');
  if (fleet().length >= bays()) return toast('Every rental bay is full. Free one up first.');
  c.display = false; c.listed = true;
  log('Returned ' + carName(c, true) + ' to the rental fleet', 0, 'Collection');
  save(); toast('<b>' + esc(carName(c)) + '</b> is back in the rental fleet.');
}

/* ---------------- Marketplace view ---------------- */
function actionButton(a, l) {
  var o = a.opts;
  if (o.action === 'buy') return '<button class="btn gold sm" data-act="listing" data-id="' + l.id + '">Buy</button>';
  if (o.action === 'finance') return '<button class="btn gold sm" data-act="listing" data-id="' + l.id + '" title="Costs more than your cash: finance it">Finance</button>';
  if (o.action === 'nobay') return '<button class="btn sm muted-btn" data-act="listing" data-id="' + l.id + '" title="' + esc(o.reason) + '">' + (o.track ? 'No display spot' : 'No free bay') + '</button>';
  return '<button class="btn sm muted-btn" data-act="listing" data-id="' + l.id + '" title="' + esc(o.reason) + '">Insufficient funds</button>';
}
function listingCard(l, a) {
  var M = MODELS[l.model], disc = a.discount, c = a.cash;
  var tagHTML = (l.tag ? '<span class="chip ' + (l.tag === 'Hot deal' ? 'good' : l.tag === 'One of a kind' ? 'gold' : 'bad') + '" style="background:rgba(14,12,10,.8)">' + (l.tag === 'Hot deal' ? '🔥 ' : '') + l.tag + '</span>' : '') +
    '<span class="chip" style="background:rgba(14,12,10,.8)">' + l.weeks + ' wk' + (l.weeks === 1 ? '' : 's') + ' left</span>';
  return '<article class="card listing"><button class="bay-stage stage-btn" data-act="listing" data-id="' + l.id + '" aria-label="Inspect the ' + esc(carName(l, true)) + '"><div class="tagline">' + tagHTML + '</div>' + car3d(l, l.color, 760, 333) + '<span class="inspect-3d">⤢ Inspect in 3D</span></button><div class="l-body">' +
    '<div class="l-title"><div><b>' + esc(M.make + ' ' + M.name) + '</b><small>' + l.year + (M.trims.length > 1 ? ' ' + trimOf(l)[0] : '') + ' · ' + l.miles.toLocaleString() + ' mi · ' + condLabel(a.x.cond) + ' · ' + M.rarity + '</small></div>' +
    '<div class="price"><b class="num">' + money(a.price) + '</b><small class="' + (disc >= 0 ? 'up' : 'down') + '">' + (disc >= 0 ? pct(disc) + ' under' : pct(-disc) + ' over') + ' market</small></div></div>' +
    (M.track ? '<div class="stats"><div><small>Market value</small><b class="num">' + moneyS(l.market) + '</b></div><div><small>Use</small><b>Display only</b></div><div><small>Appreciation/yr</small><b class="num up">' + signed(c.valueChange) + '</b></div>' :
    '<div class="stats"><div><small>Market value</small><b class="num">' + moneyS(l.market) + '</b></div><div><small>Daily rate</small><b class="num">' + money(c.rate) + '</b></div><div><small>Bookings/mo</small><b class="num">' + c.days.toFixed(1) + ' days</b></div>') +
    '<div><small>Revenue/mo</small><b class="num">' + money(c.gross) + '</b></div><div><small>Expenses/mo</small><b class="num">' + money(c.opex) + '</b></div><div><small>Net/mo</small><b class="num ' + (c.noi >= 0 ? 'up' : 'down') + '">' + money(c.noi) + '</b></div></div>' +
    '<div class="adv-line">' + ring(a.score) + '<p><b style="color:var(--ivory)">' + headline(a.score) + '.</b> ' + esc(shortReason(a)) + '</p></div>' +
    '<div class="l-actions"><label class="cmp"><input type="checkbox" data-act="compare" data-id="' + l.id + '"' + (S.compare.indexOf(l.id) >= 0 ? ' checked' : '') + '> Compare</label><button class="btn ghost sm" data-act="listing" data-id="' + l.id + '">Details</button>' + actionButton(a, l) + '</div>' +
    '</div></article>';
}
function condLabel(c) { return c >= 92 ? 'Excellent' : c >= 80 ? 'Very good' : c >= 68 ? 'Good' : c >= 56 ? 'Fair' : 'Rough'; }
VIEWS.market = function () {
  var list = S.market.slice();
  if (mFilter === 'afford') list = list.filter(function (l) { return purchaseOptions(l).action === 'buy' || purchaseOptions(l).action === 'finance'; });
  if (mFilter === 'exotic') list = list.filter(function (l) { return MODELS[l.model].exotic; });
  if (mFilter === 'deals') list = list.filter(function (l) { return l.ask < l.market * 0.95; });
  var A = {};
  list.forEach(function (l) { A[l.id] = analyze(l); });
  list.sort(function (a, b) { return mSort === 'price' ? a.ask - b.ask : mSort === 'roi' ? A[b.id].cash.roiUnlev - A[a.id].cash.roiUnlev : mSort === 'cash' ? A[b.id].cash.noi - A[a.id].cash.noi : mSort === 'discount' ? A[b.id].discount - A[a.id].discount : A[b.id].score - A[a.id].score; });
  var h = '<div class="view-head"><div><p class="eyebrow">Used sports car market · refreshes weekly</p><h1>Marketplace</h1><p>Projections average the next 12 months of seasons at the suggested rate. Inspect before you buy, negotiate when a price looks rich, and finance what you can’t pay in cash.</p></div></div>' +
    '<div class="toolbar"><div class="seg">' + [['all', 'All'], ['afford', 'Within reach'], ['exotic', 'Exotic'], ['deals', 'Deals']].map(function (f) { return '<button class="' + (mFilter === f[0] ? 'on' : '') + '" data-act="mfilter" data-f="' + f[0] + '">' + f[1] + '</button>'; }).join('') + '</div>' +
    '<select data-input="msort" aria-label="Sort listings">' + [['score', 'adviser score'], ['cash', 'monthly net income'], ['roi', 'annual ROI'], ['discount', 'biggest discount'], ['price', 'price']].map(function (o) { return '<option value="' + o[0] + '"' + (mSort === o[0] ? ' selected' : '') + '>Sort: ' + o[1] + '</option>'; }).join('') + '</select>' +
    '<span class="dim" style="font-size:.8rem;margin-left:auto">Cash ' + money(S.cash) + ' · Free bays ' + Math.max(0, bays() - fleet().length) + ' · Display spots ' + Math.max(0, spots() - shown().length) + ' · Credit left ' + moneyS(Math.max(0, maxDebt() - debt())) + '</span></div>' +
    '<p class="season-note">' + monthLabel(monthKey(S.week), true) + ' rental demand vs. an average month: ' + seasonLine() + '</p>';
  h += list.length ? '<div class="market">' + list.map(function (l) { return listingCard(l, A[l.id]); }).join('') + '</div>' : '<div class="card empty">No listings match. New cars arrive every week.</div>';
  h += '<p class="credit">3D models by <a href="https://sketchfab.com/ddiaz-design" target="_blank" rel="noopener">ddiaz-design</a> and <a href="https://sketchfab.com/VTX_car" target="_blank" rel="noopener">VTX</a> (Rexy) on Sketchfab (CC BY / CC BY-NC-SA), repainted for each listing.</p>';
  if (S.compare.length) h += '<div class="cmpbar"><span>' + S.compare.length + ' of 3 selected to compare</span><span style="display:flex;gap:8px"><button class="btn ghost sm" data-act="compare-clear">Clear</button><button class="btn gold sm" data-act="compare-open"' + (S.compare.length < 2 ? ' disabled' : '') + '>Compare ' + S.compare.length + '</button></span></div>';
  return h;
};

/* ---------------- Rentals view ---------------- */
function rentalControls(c) {
  var M = M_(c.model), r0 = refRate(c), lo = Math.round(r0 * 0.5 / 10) * 10, hi = Math.round(r0 * 2 / 10) * 10;
  return '<div class="sliders">' +
    '<label class="switch"><input type="checkbox" data-act="list" data-id="' + c.id + '"' + (c.listed ? ' checked' : '') + '> ' + (c.listed ? 'Listed for rent' : 'Off the market (half insurance)') + '</label>' +
    '<div class="slider"><label>Weekday rate <b class="num" data-out="rate-' + c.id + '">' + money(c.rate) + '</b></label><input type="range" min="' + lo + '" max="' + hi + '" step="10" value="' + c.rate + '" data-input="rate" data-id="' + c.id + '" aria-label="Weekday rate"></div>' +
    '<div class="slider"><label>Weekend rate <b class="num" data-out="wk-' + c.id + '">' + money(c.wkRate) + '</b></label><input type="range" min="' + lo + '" max="' + Math.round(hi * 1.3 / 10) * 10 + '" step="10" value="' + c.wkRate + '" data-input="wkrate" data-id="' + c.id + '" aria-label="Weekend rate"></div>' +
    '<div class="est" data-out="est-' + c.id + '">' + estHTML(c) + '</div></div>';
}
function estHTML(c) {
  var p = carProjection(c);
  return '<div><small>This month</small><b class="num">' + p.now.days.toFixed(1) + ' days · ' + money(p.now.noi) + '</b></div><div><small>12-month avg NOI</small><b class="num ' + (p.noi >= 0 ? 'up' : 'down') + '">' + money(p.noi) + '/mo</b></div>';
}
function calendarHTML(c) {
  var d = c.days.slice(-28), pad = 28 - d.length, cells = '', start = dateOf(S.week - 4);
  for (var i = 0; i < 28; i++) {
    var v = i < pad ? null : d[i - pad], day = new Date(start.getTime() + i * 864e5).getDate();
    cells += '<span class="' + (v === 1 ? 'b' : v === 2 ? 'o' : v === 3 ? 'x' : v === 4 ? 'd' : '') + '" title="' + (v === 1 ? 'Booked' : v === 2 ? 'Off market' : v === 3 ? 'Unavailable (shop or turnaround)' : v === 4 ? 'On display' : v === 0 ? 'Available, not booked' : 'Not owned yet') + '">' + day + '</span>';
  }
  return '<div class="cal-head"><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span><span>S</span></div><div class="cal">' + cells + '</div><div class="cal-key"><span><i class="b"></i>Booked</span><span><i class="x"></i>Unavailable</span><span><i></i>Open</span></div>';
}
VIEWS.rentals = function () {
  if (S.tutorial === 2) { S.tutorial = 3; save(); }
  var h = '<div class="view-head"><div><p class="eyebrow">Pricing & bookings</p><h1>Rentals</h1><p>Cheaper rates book more often; premium rates earn more per day. Demand follows the seasons (sports cars swing the most), your reputation, each car’s condition and age, and how many of your own cars compete in the same category.</p></div></div>';
  if (!fleet().length) return h + '<div class="card empty">' + (S.cars.length ? 'All your cars are in the private collection.' : 'No cars yet.') + ' <button class="btn gold sm" data-act="tab" data-tab="market" style="margin-left:8px">Go to the marketplace</button></div>';
  h += '<p class="season-note">' + monthLabel(monthKey(S.week), true) + ': ' + seasonLine() + '</p><div class="rent-grid">' + fleet().map(function (c) {
    var M = M_(c.model);
    return '<article class="card rent"><div class="rent-car"><div class="bay-stage thumb">' + car3d(c, c.color, 520, 240) + '</div><b>' + esc(M.make + ' ' + M.name) + '</b><span class="dim" style="font-size:.76rem">' + carStatus(c) + ' &nbsp;Suggested ' + money(refRate(c)) + '/day · condition ' + Math.round(c.cond) + '%</span><button class="btn ghost sm" data-act="car" data-id="' + c.id + '">Manage car</button></div>' +
      rentalControls(c) + '<div><p class="eyebrow" style="margin-bottom:8px">Last 4 weeks · ' + pct(util(c)) + ' booked</p>' + calendarHTML(c) + '</div></article>';
  }).join('') + '</div>';
  return h;
};

/* ---------------- Finances view ---------------- */
function lineChart(pts, w, h) {
  if (pts.length < 2) return '<p class="dim" style="font-size:.84rem;padding:30px 0;text-align:center">Advance a few weeks to see your growth chart.</p>';
  var vals = pts.map(function (p) { return p.nw; }).concat(pts.map(function (p) { return p.cash; }));
  var min = Math.min.apply(null, vals.concat([0])), max = Math.max.apply(null, vals) * 1.08 || 1;
  var x = function (i) { return 44 + i / (pts.length - 1) * (w - 54); }, y = function (v) { return h - 22 - (v - min) / (max - min) * (h - 36); };
  var line = pts.map(function (p, i) { return (i ? 'L' : 'M') + x(i).toFixed(1) + ',' + y(p.nw).toFixed(1); }).join('');
  var cash = pts.map(function (p, i) { return (i ? 'L' : 'M') + x(i).toFixed(1) + ',' + y(p.cash).toFixed(1); }).join('');
  var grid = '';
  for (var t = 0; t <= 4; t++) { var v = min + (max - min) * t / 4; grid += '<line x1="44" x2="' + (w - 10) + '" y1="' + y(v) + '" y2="' + y(v) + '" stroke="rgba(244,236,222,.07)"/><text x="38" y="' + (y(v) + 3) + '" text-anchor="end" fill="#a99d8c" font-size="10">' + moneyS(v) + '</text>'; }
  return '<svg class="chart" viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="Net worth and cash over time">' + grid +
    '<defs><linearGradient id="nwfill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d4a65a" stop-opacity=".35"/><stop offset="1" stop-color="#d4a65a" stop-opacity="0"/></linearGradient></defs>' +
    '<path d="' + line + 'L' + x(pts.length - 1) + ',' + (h - 22) + 'L44,' + (h - 22) + 'Z" fill="url(#nwfill)"/>' +
    '<path d="' + cash + '" fill="none" stroke="#6aa8ff" stroke-width="1.5" stroke-dasharray="4 3" opacity=".75"/>' +
    '<path d="' + line + '" fill="none" stroke="#f0c983" stroke-width="2.2"/>' +
    '<text x="44" y="' + (h - 6) + '" fill="#a99d8c" font-size="10">Wk ' + (pts[0].w + 1) + '</text><text x="' + (w - 10) + '" y="' + (h - 6) + '" fill="#a99d8c" font-size="10" text-anchor="end">Wk ' + (pts[pts.length - 1].w + 1) + '</text></svg>';
}
function barChart(w, h) {
  var keys = Object.keys(S.months).sort().slice(-6);
  if (!keys.length) return '<p class="dim" style="font-size:.84rem;padding:30px 0;text-align:center">No months on the books yet.</p>';
  var max = Math.max.apply(null, keys.map(function (k) { return Math.max(S.months[k].gross, S.months[k].opex + (S.months[k].debt || 0)); })) || 1;
  var min = Math.min(0, Math.min.apply(null, keys.map(function (k) { return S.months[k].noi - (S.months[k].debt || 0); })));
  var span = max - min || 1, zero = 14 + (h - 36) * max / span, bw = (w - 40) / keys.length, out = '';
  var Y = function (v) { return zero - v / span * (h - 36); };
  out += '<line x1="30" x2="' + (w - 6) + '" y1="' + zero + '" y2="' + zero + '" stroke="rgba(244,236,222,.15)"/>';
  keys.forEach(function (k, i) {
    var m = S.months[k], x0 = 30 + i * bw, cf = m.noi - (m.debt || 0);
    out += '<rect x="' + (x0 + bw * 0.12) + '" y="' + Y(m.gross) + '" width="' + bw * 0.24 + '" height="' + Math.max(0, zero - Y(m.gross)) + '" rx="2" fill="#d4a65a"><title>' + monthLabel(k) + ' gross revenue ' + money(m.gross) + '</title></rect>' +
      '<rect x="' + (x0 + bw * 0.38) + '" y="' + Y(m.opex) + '" width="' + bw * 0.24 + '" height="' + Math.max(0, zero - Y(m.opex)) + '" rx="2" fill="#8b4a40"><title>Operating expenses ' + money(m.opex) + '</title></rect>' +
      '<rect x="' + (x0 + bw * 0.64) + '" y="' + Math.min(Y(cf), zero) + '" width="' + bw * 0.24 + '" height="' + Math.abs(zero - Y(cf)) + '" rx="2" fill="' + (cf >= 0 ? '#6fcf8e' : '#ef6a5a') + '"><title>Cash flow after loan payments ' + money(cf) + '</title></rect>' +
      '<text x="' + (x0 + bw * 0.5) + '" y="' + (h - 4) + '" text-anchor="middle" fill="#a99d8c" font-size="10">' + monthLabel(k) + '</text>';
  });
  return '<svg class="chart" viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="Monthly revenue, expenses and cash flow">' + out + '</svg>';
}
function statement(k) {
  var m = S.months[k] || month();
  if (m.legacy) return '<div class="kv"><span>Revenue</span><b class="num">' + money(m.gross) + '</b><span>Expenses</span><b class="num">' + money(-m.opex) + '</b></div><p class="dim" style="font-size:.76rem;margin-top:8px">Recorded before the detailed statement existed.</p>';
  var cf = m.noi - m.debt;
  return '<div class="kv">' +
    '<span>Gross rental revenue</span><b class="num up">' + money(m.gross) + '</b>' +
    '<span>&nbsp;&nbsp;Platform fees (' + pct(PLATFORM_FEE) + ')</span><b class="num down">' + money(-m.fees) + '</b>' +
    '<span>&nbsp;&nbsp;Cleaning</span><b class="num down">' + money(-m.cleaning) + '</b>' +
    '<span>&nbsp;&nbsp;Insurance</span><b class="num down">' + money(-m.ins) + '</b>' +
    '<span>&nbsp;&nbsp;Maintenance & service</span><b class="num down">' + money(-m.maint) + '</b>' +
    '<span>&nbsp;&nbsp;Repairs, damage & inspections</span><b class="num down">' + money(-m.repairs) + '</b>' +
    '<span>&nbsp;&nbsp;Garage upkeep</span><b class="num down">' + money(-m.garage) + '</b>' +
    '<span>Operating expenses</span><b class="num">' + money(-m.opex) + '</b><span class="sep"></span>' +
    '<span><b style="color:var(--ivory)">Net operating income</b></span><b class="num ' + (m.noi >= 0 ? 'up' : 'down') + '">' + money(m.noi) + '</b>' +
    '<span>&nbsp;&nbsp;Loan interest</span><b class="num down">' + money(-m.interest) + '</b>' +
    '<span>&nbsp;&nbsp;Loan principal</span><b class="num down">' + money(-m.principal) + '</b>' +
    '<span><b style="color:var(--ivory)">Operating cash flow</b></span><b class="num ' + (cf >= 0 ? 'up' : 'down') + '">' + money(cf) + '</b><span class="sep"></span>' +
    '<span>Car purchases, wraps & expansion</span><b class="num">' + money(-m.capex) + '</b>' +
    '<span>Car sales</span><b class="num">' + money(m.sales) + '</b>' +
    '<span>Vehicle value change <em class="dim">(non-cash)</em></span><b class="num ' + (m.valchg >= 0 ? 'up' : 'down') + '">' + signed(m.valchg) + '</b>' +
    '<span>Fleet utilization</span><b>' + (m.avail ? pct(m.days / m.avail) : '—') + '</b></div>';
}
VIEWS.finances = function () {
  var nw = netWorth(), keys = Object.keys(S.months).sort(), cur = monthKey(S.week);
  var last = keys.filter(function (k) { return k < cur; }).pop();
  var m = S.months[last] || month();
  var invested = S.cars.reduce(function (t, c) { return t + c.paid; }, 0);
  var fleetReturn = S.cars.reduce(function (t, c) { return t + c.gross - c.opex + (c.value - c.paid); }, 0);
  var fp = S.cars.reduce(function (t, c) { var p = carProjection(c); t.noi += p.noi; t.gross += p.gross; t.opex += p.opex; return t; }, { noi: 0, gross: 0, opex: 0 });
  var debtSvc = S.loans.reduce(function (t, l) { return t + l.mpay; }, 0);
  var k = [
    ['Net worth', money(nw), (nw >= START_CASH ? '<em class="up">+' : '<em class="down">') + pct(nw / START_CASH - 1) + ' since start</em>'],
    ['Cash', money(S.cash), '<em class="dim">Fixed costs ' + money(fixedMonthly()) + '/mo</em>'],
    ['Vehicle assets', money(carsValue()), '<em class="dim">' + S.cars.length + ' car' + (S.cars.length === 1 ? '' : 's') + ' at market value</em>'],
    ['Outstanding loans', money(debt()), '<em class="dim">' + money(debtSvc) + '/mo · limit ' + moneyS(maxDebt()) + '</em>'],
    ['Gross revenue (' + (last ? monthLabel(last) : 'this month') + ')', money(m.gross), '<em class="dim">Lifetime ' + moneyS(S.totals.gross) + '</em>'],
    ['Operating expenses', money(m.opex || 0), '<em class="dim">Fees, cleaning, insurance, upkeep, repairs</em>'],
    ['Net operating income', money(m.noi || 0), '<em class="' + ((m.noi || 0) >= 0 ? 'up' : 'down') + '">Before loan payments</em>'],
    ['Cash flow', money((m.noi || 0) - (m.debt || 0)), '<em class="dim">After ' + money(m.debt || 0) + ' of loan payments</em>'],
    ['Projected NOI', money(fp.noi) + '/mo', '<em class="dim">12-month average for your fleet</em>'],
    ['Fleet ROI', invested ? pct(fleetReturn / invested, 1) : '—', '<em class="dim">Net income + value change ÷ price paid</em>']
  ];
  var h = '<div class="view-head"><div><p class="eyebrow">Dashboard</p><h1>Finances</h1><p>Cash moves with rental income, operating costs, loan payments and purchases. Depreciation and appreciation change your cars’ value (and net worth) but aren’t cash.</p></div></div><div class="kgrid">' + k.map(function (x) { return '<div class="card k"><small>' + x[0] + '</small><b class="num">' + x[1] + '</b>' + x[2] + '</div>'; }).join('') + '</div>';
  h += '<div class="two"><section class="card panel"><h3>Net worth <small>Goal ' + moneyS(GOAL) + '</small></h3>' + lineChart(S.history.slice(-104), 640, 230) + '<div class="legend"><span><i style="background:#f0c983"></i>Net worth</span><span><i style="background:#6aa8ff"></i>Cash</span></div></section>' +
    '<section class="card panel"><h3>Monthly results <small>Last 6 months</small></h3>' + barChart(420, 230) + '<div class="legend"><span><i style="background:#d4a65a"></i>Gross revenue</span><span><i style="background:#8b4a40"></i>Operating expenses</span><span><i style="background:#6fcf8e"></i>Cash flow</span></div></section></div>';
  var opts = keys.slice(-12).reverse();
  var sel = finMonth && S.months[finMonth] ? finMonth : (last || cur);
  h += '<div class="two"><section class="card panel"><h3>Income statement <select data-input="finmonth" aria-label="Month">' + opts.map(function (k) { return '<option value="' + k + '"' + (k === sel ? ' selected' : '') + '>' + monthLabel(k, true) + (k === cur ? ' (to date)' : '') + '</option>'; }).join('') + '</select></h3>' + statement(sel) + '</section>' +
    '<section class="card panel"><h3>Loans <small>' + S.loans.length + ' active</small></h3>' + (S.loans.length ? '<div class="table-wrap"><table><thead><tr><th>Car</th><th class="r">Balance</th><th class="r">APR</th><th class="r">Monthly</th><th class="r">Left</th><th></th></tr></thead><tbody>' +
    S.loans.map(function (l) { var c = S.cars.filter(function (x) { return x.id === l.carId; })[0]; return '<tr><td>' + (c ? esc(M_(c.model).name) : 'Car') + '</td><td class="r num">' + money(l.balance) + '</td><td class="r">' + pct(l.apr, 1) + '</td><td class="r num">' + money(l.mpay) + '</td><td class="r">' + l.monthsLeft + ' mo</td><td class="r"><button class="btn sm" data-act="payoff" data-id="' + l.id + '"' + (S.cash < l.balance ? ' disabled' : '') + '>Pay off</button></td></tr>'; }).join('') + '</tbody></table></div>' : '<p class="dim" style="font-size:.84rem">No debt. Financing is offered when you buy a car.</p>') +
    '<h3 style="margin-top:18px">Ledger <small>Recent transactions</small></h3><div class="table-wrap"><table><tbody>' + S.ledger.slice(0, 10).map(function (e) { return '<tr><td class="dim" style="white-space:nowrap">Wk ' + (e.w + 1) + '</td><td>' + esc(e.text) + '</td><td class="r num ' + (e.amt > 0 ? 'up' : e.amt < 0 ? 'down' : 'dim') + '">' + (e.amt ? (e.amt > 0 ? '+' : '') + money(e.amt) : '—') + '</td></tr>'; }).join('') + '</tbody></table></div></section></div>';
  return h;
};
var finMonth = null;

/* ---------------- Adviser view ---------------- */
function portfolioTips() {
  var tips = [];
  if (!S.cars.length) tips.push(['1', 'Start with a <b>Corvette</b>: the lowest price, strongest demand relative to its cost, and the cheapest insurance. Exotics earn more per day but book far less often.']);
  S.cars.forEach(function (c) {
    var M = M_(c.model), u = util(c), name = '<b>' + esc(M.name) + '</b>';
    if (c.days.length >= 14 && c.listed && u < 0.22) tips.push(['↓', name + ' is only ' + pct(u) + ' booked. Try lowering the weekday rate to about ' + money(Math.round(c.rate * 0.88 / 10) * 10) + '.']);
    else if (c.days.length >= 14 && u > 0.7) tips.push(['↑', name + ' is ' + pct(u) + ' booked; there’s room to raise the rate to about ' + money(Math.round(c.rate * 1.1 / 10) * 10) + '.']);
    var pj = carProjection(c);
    if (S.week - c.bought > 26 && pj.noi < 150) tips.push(['$', name + ' is projected to earn only ' + money(pj.noi) + '/mo over the next year as age, mileage and repairs catch up. Selling it (' + money(c.value * SELL_SPREAD) + ') and buying a newer car may pay better.']);
    if (c.cond < 65) tips.push(['🔧', name + ' is at ' + Math.round(c.cond) + '% condition. A service (' + money(serviceCost(c)) + ') lifts demand and cuts breakdown risk.']);
    if (!c.display && M.dep < 0 && c.days.length >= 14 && u < 0.2 && shown().length < spots()) tips.push(['◇', name + ' appreciates but rarely rents (' + pct(u) + '). Retiring it to your private collection would cut its holding cost to about ' + money(carProjection(Object.assign({}, c, { display: true, listed: false })).opex) + '/mo and free a rental bay.']);
    if (!c.listed && !c.display) tips.push(['⏸', name + ' is off the market. It still costs half insurance plus upkeep, and keeps depreciating.']);
  });
  var mo = dateOf(S.week).getMonth();
  if (S.cars.length && (mo >= 10 || mo <= 1)) tips.push(['❄', 'Winter is the slow season, especially for sports cars. Keep a cash cushion for loan payments until spring.']);
  var hi = S.loans.filter(function (l) { return l.apr >= 0.08; });
  if (hi.length && S.cash > hi[0].balance + fixedMonthly() * 3) tips.push(['$', 'You have spare cash and a loan at ' + pct(hi[0].apr, 1) + '. Paying it off is a guaranteed return.']);
  if (fleet().length >= bays() && TIERS[S.tier + 1] && S.cash > TIERS[S.tier + 1].cost * 1.3) tips.push(['⌂', 'Every bay is full and you can afford to expand.']);
  if (S.cars.length && S.cash < fixedMonthly() * 2) tips.push(['!', 'Your cash covers less than two months of fixed costs (' + money(fixedMonthly()) + '/mo). Hold off on buying.']);
  if (!tips.length) tips.push(['✓', 'Your fleet looks healthy. Watch the marketplace for listings scored 70+.']);
  return tips;
}
VIEWS.adviser = function () {
  var ranked = S.market.map(function (l) { return analyze(l); }).sort(function (a, b) { return b.score - a.score; });
  var h = '<div class="view-head"><div><p class="eyebrow">Rule-based model · math shown</p><h1>AI Investment Adviser</h1><p>Every score comes from the same 12-month projection the game uses to book rentals: revenue through the seasons, operating costs, repairs, value change and financing, plus a risk check. Open a listing to see the full breakdown.</p></div></div>';
  h += '<div class="adv-grid"><section class="card panel"><h3>Top deals this week <small>Tap to open</small></h3>' + ranked.slice(0, 6).map(function (a) {
    return '<div class="rank" data-act="listing" data-id="' + a.l.id + '" role="button" tabindex="0">' + ring(a.score) + '<div><b>' + esc(carName(a.l, true)) + '</b><small>' + money(a.price) + ' · ' + money(a.cash.noi) + '/mo NOI · ROI ' + pct(a.cash.roiUnlev) + ' · ' + a.riskLabel + ' risk</small></div><span class="dim">›</span></div>';
  }).join('') + '</section><section class="card panel"><h3>Portfolio check-up <small>' + S.cars.length + ' cars</small></h3>' + portfolioTips().map(function (t) { return '<div class="tip"><i>' + t[0] + '</i><p>' + t[1] + '</p></div>'; }).join('') + '</section></div>';
  h += '<section class="card panel" style="margin-top:16px"><h3>How the score works</h3><p class="dim" style="font-size:.84rem">The score adds four components: <b>price vs. market</b> (25 pts, full marks at 20% under), <b>cash yield</b> (30 pts: 12 months of net operating income ÷ price, full marks at 30%), <b>total return</b> (20 pts: income plus a year of depreciation or appreciation plus any discount, ÷ price, full marks at 35%) and <b>low risk</b> (25 pts). ' +
    'Risk adds up category volatility, age, mileage above normal, worn condition, running-cost burden, whether it’s inspected, and whether you’d need financing or drain your cash. Small deductions apply if it’s out of reach, you have no free bay, or you already own two of the same car.</p></section>';
  return h;
};

/* ---------------- Achievements view ---------------- */
VIEWS.awards = function () {
  var n = Object.keys(S.awards).length;
  return '<div class="view-head"><div><p class="eyebrow">' + n + ' of ' + AWARDS.length + ' unlocked</p><h1>Achievements</h1></div></div><div class="awards">' + AWARDS.map(function (a, i) {
    var got = S.awards[a.id] != null;
    return '<div class="card award' + (got ? '' : ' locked') + '"><div class="medal">' + (got ? '★' : String(i + 1)) + '</div><div><b>' + a.name + '</b><p>' + a.desc + '</p>' + (got ? '<small>Unlocked in week ' + (S.awards[a.id] + 1) + '</small>' : '') + '</div></div>';
  }).join('') + '</div>';
};

/* ---------------- Modals ---------------- */
var modalCtx = null;
function modal(html, size) {
  var m = $('#modal');
  if (viewerHandle) { viewerHandle.dispose(); viewerHandle = null; }
  m.className = 'modal' + (size ? ' ' + size : '');
  m.innerHTML = html;
  $('#veil').classList.add('open'); $('#veil').setAttribute('aria-hidden', 'false');
  m.scrollTop = 0;
  var f = m.querySelector('.x'); if (f) f.focus({ preventScroll: true });
  hydrate3d(m); mountViewer();
}
function closeModal() { if (viewerHandle) { viewerHandle.dispose(); viewerHandle = null; } $('#veil').classList.remove('open'); $('#veil').setAttribute('aria-hidden', 'true'); modalCtx = null; render(); }
function head(eyebrow, title, sub) { return '<div class="m-head"><div><p class="eyebrow">' + eyebrow + '</p><h2>' + title + '</h2>' + (sub ? '<p>' + sub + '</p>' : '') + '</div><button class="x" data-act="close" aria-label="Close">✕</button></div>'; }
function sumModal(title, body) { return head('Garage update', title) + '<div class="m-body">' + body + '</div><div class="m-foot"><span></span><button class="btn gold" data-act="close">Continue</button></div>'; }

function breakdownHTML(a) {
  return '<div class="parts">' + a.parts.map(function (p) {
    var pts = p[1] * p[2];
    return '<div class="part"><span>' + p[0] + '</span><div class="pbar"><i style="width:' + (p[2] * 100).toFixed(0) + '%"></i></div><b>' + pts.toFixed(0) + '/' + p[1] + '</b><small>' + esc(p[3]) + '</small></div>';
  }).join('') + a.adj.map(function (x) { return '<div class="part adj"><span>' + esc(x[0]) + '</span><div></div><b class="down">' + x[1] + '</b><small></small></div>'; }).join('') + '</div>' +
    '<p class="dim" style="font-size:.76rem;margin-top:8px">Risk ' + a.riskTotal + '/100: ' + a.risk.filter(function (r) { return r[1] > 0; }).map(function (r) { return r[0].toLowerCase() + ' ' + r[1]; }).join(', ') + '.</p>';
}
function econHTML(p, title) {
  return '<div class="sec"><h4>' + title + '</h4><div class="kv">' +
    '<span>Rental days / month</span><b>' + p.days.toFixed(1) + ' (' + pct(p.util) + ' utilization)</b>' +
    '<span>Gross revenue / month</span><b class="num up">' + money(p.gross) + '</b>' +
    '<span>Operating expenses / month</span><b class="num down">' + money(-p.opex) + '</b>' +
    '<span>&nbsp;&nbsp;Fees & cleaning</span><b class="num dim">' + money(p.fees + p.cleaning) + '</b>' +
    '<span>&nbsp;&nbsp;Insurance</span><b class="num dim">' + money(p.ins) + '</b>' +
    '<span>&nbsp;&nbsp;Maintenance</span><b class="num dim">' + money(p.maint) + '</b>' +
    '<span>&nbsp;&nbsp;Expected repairs & damage</span><b class="num dim">' + money(p.repairs + p.damage) + '</b>' +
    '<span class="sep"></span><span>Net operating income / month</span><b class="num ' + (p.noi >= 0 ? 'up' : 'down') + '">' + money(p.noi) + '</b>' +
    '<span>Range through the seasons</span><b class="num">' + money(p.low.noi) + ' to ' + money(p.high.noi) + '</b>' +
    '<span>Value change over 12 months</span><b class="num ' + (p.valueChange >= 0 ? 'up' : 'down') + '">' + signed(p.valueChange) + '</b></div></div>';
}
function listingModal(l) {
  var M = MODELS[l.model];
  var ctx = modalCtx && modalCtx.type === 'listing' && modalCtx.id === l.id ? modalCtx : null;
  var price = l.counter || l.ask;
  if (!ctx) {
    var o0 = purchaseOptions(l, price);
    var dflt = o0.cash ? 1 : (o0.finance.filter(function (f) { return f.ok; }).map(function (f) { return f.down; }).sort().reverse()[0] || 0.2);
    ctx = modalCtx = { type: 'listing', id: l.id, down: dflt, months: 60, offer: Math.round(l.ask * 0.92 / 100) * 100 };
  }
  var a = analyze(l, price), o = a.opts;
  var cond = a.x.cond;
  var p = project(a.x, { price: price, comp: a.comp, extraCost: l.inspected ? l.hidden : 0, down: ctx.down, term: ctx.months, apr: apr(ctx.down) });
  var finOpt = o.finance.filter(function (f) { return f.down === ctx.down; })[0];
  var chosenOk = ctx.down >= 1 ? o.cash : finOpt && finOpt.ok;
  var due = ctx.down >= 1 ? price : Math.round(price * ctx.down);
  var h = head(l.year + (M.trims.length > 1 ? ' · ' + trimOf(l)[0] : '') + (M.rarity !== CLASS_LABEL[M.cls] ? ' · ' + M.rarity : '') + ' · ' + CLASS_LABEL[M.cls], esc(M.make + ' ' + M.name), l.miles.toLocaleString() + ' miles (' + (a.mileRatio > 1.15 ? pct(a.mileRatio - 1) + ' above' : a.mileRatio < 0.85 ? pct(1 - a.mileRatio) + ' below' : 'about') + ' normal for its age) · ' + condLabel(cond) + ' condition (' + cond + '%) · listed ' + l.weeks + ' more week' + (l.weeks === 1 ? '' : 's'));
  h += '<div class="m-body"><div class="m-hero">' + viewerHTML(l, l.color) + '</div>';
  h += '<div class="sec" style="margin-bottom:16px"><div class="verdict">' + ring(a.score, true) + '<div><p class="eyebrow">AI adviser · investment score</p><h3>' + headline(a.score) + '</h3><p>' + esc(explain(a)) + '</p></div></div>' +
    '<div class="adv-kpis"><div><small>Revenue / mo</small><b class="num">' + money(a.cash.gross) + '</b></div><div><small>Expenses / mo</small><b class="num">' + money(a.cash.opex) + '</b></div><div><small>Net cash flow / mo</small><b class="num ' + (p.cashflow >= 0 ? 'up' : 'down') + '">' + money(p.cashflow) + '</b><em>' + (p.mpay ? 'after ' + money(p.mpay) + ' loan' : 'no loan') + '</em></div><div><small>Annual ROI</small><b class="num">' + pct(p.roi, 1) + '</b><em>on ' + money(p.cashIn) + ' cash in</em></div><div><small>Depreciation / yr</small><b class="num ' + (a.cash.valueChange >= 0 ? 'up' : 'down') + '">' + signed(a.cash.valueChange) + '</b></div><div><small>Risk</small><b>' + a.riskLabel + '</b><em>' + a.riskTotal + '/100</em></div></div>' +
    '<details class="math"><summary>Why ' + a.score + '? Show the score breakdown</summary>' + breakdownHTML(a) +
    '<p><code>bookings/day = ' + M.demand + ' base × (suggested $' + refRate(l) + ' ÷ your rate)^' + M.elastic + ' × season × market ' + (S.demand[M.cls]).toFixed(2) + ' × reputation ' + (1 + (S.rep - 3) * 0.1).toFixed(2) + ' × condition ' + (0.55 + 0.45 * cond / 100).toFixed(2) + ' × age</code></p>' +
    '<p><code>NOI = revenue ' + money(a.cash.gross) + ' − ' + pct(PLATFORM_FEE) + ' fees − $' + M.clean + '/day cleaning − insurance ' + money(a.cash.ins) + ' − maintenance ' + money(a.cash.maint) + ' − expected repairs & damage ' + money(a.cash.repairs + a.cash.damage) + ' = ' + money(a.cash.noi) + '/mo</code></p></details></div>';
  h += '<div class="m-cols">' + econHTML(a.cash, 'Projected economics · 12-month average');
  h += '<div class="sec"><h4>Due diligence</h4>' + (l.inspected ? (l.hidden ? '<div class="note warn" style="margin-top:0">Inspection found <b>' + money(l.hidden) + '</b> of repairs; true condition is ' + cond + '%. You pay for the repairs at purchase.</div>' : '<div class="note ok" style="margin-top:0">Clean inspection report. No hidden issues.</div>') :
    '<p class="dim" style="font-size:.82rem">About one in six listings hides a mechanical problem, and “too good to be true” deals twice as often.</p><button class="btn sm" style="margin-top:8px" data-act="inspect" data-id="' + l.id + '"' + (S.cash < INSPECTION ? ' disabled' : '') + '>Pre-purchase inspection · ' + money(INSPECTION) + '</button>');
  h += '<h4 style="margin-top:16px">Negotiate</h4>';
  if (l.counter) h += '<div class="note info" style="margin-top:0">The seller countered at <b>' + money(l.counter) + '</b>.</div>';
  else if (l.offered) h += '<p class="dim" style="font-size:.82rem">The seller won’t budge. Buy at ' + money(l.ask) + ' or walk away.</p>';
  else h += '<div class="slider"><label>Your offer <b class="num" data-out="offer">' + money(ctx.offer) + ' (' + pct(1 - ctx.offer / l.ask) + ' off)</b></label><input type="range" min="' + Math.round(l.ask * 0.7 / 100) * 100 + '" max="' + l.ask + '" step="100" value="' + ctx.offer + '" data-input="offer" aria-label="Your offer"></div><button class="btn sm" style="margin-top:8px" data-act="offer" data-id="' + l.id + '">Make offer</button><p class="dim" style="font-size:.74rem;margin-top:6px">One shot. Lowball too hard and the seller may walk.</p>';
  h += '<h4 style="margin-top:16px">How to pay</h4><div class="opts">' +
    '<button class="opt' + (ctx.down >= 1 ? ' on' : '') + '" data-act="down" data-v="1"' + (o.cash ? '' : ' disabled title="You have ' + money(S.cash) + '"') + '>Cash · ' + money(price) + (o.cash ? '' : '<em>need ' + money(price - S.cash) + ' more</em>') + '</button>' +
    o.finance.map(function (f) { return '<button class="opt' + (ctx.down === f.down ? ' on' : '') + '" data-act="down" data-v="' + f.down + '"' + (f.ok ? '' : ' disabled') + '>Finance · ' + pct(f.down) + ' down (' + moneyS(f.amount) + ')' + (f.ok ? '' : '<em>' + (S.cash < f.amount ? 'not enough cash' : 'over credit limit') + '</em>') + '</button>'; }).join('') + '</div>';
  if (ctx.down < 1) h += '<div class="opts" style="margin-top:6px">' + [36, 60].map(function (mo) { return '<button class="opt' + (ctx.months === mo ? ' on' : '') + '" data-act="term" data-v="' + mo + '">' + mo + ' months</button>'; }).join('') + '</div>' +
    '<div class="kv" style="margin-top:10px"><span>Loan principal</span><b class="num">' + money(p.principal) + '</b><span>APR</span><b>' + pct(p.apr, 1) + '</b><span>Monthly payment</span><b class="num">' + money(p.mpay) + '</b><span>Total interest over ' + ctx.months + ' months</span><b class="num">' + money(p.mpay * ctx.months - p.principal) + '</b>' +
    '<span>Avg. cash flow after payment</span><b class="num ' + (p.cashflow >= 0 ? 'up' : 'down') + '">' + money(p.cashflow) + '/mo</b><span>Slowest month after payment</span><b class="num ' + (p.low.noi - p.mpay >= 0 ? 'up' : 'down') + '">' + money(p.low.noi - p.mpay) + '</b></div>' +
    (p.low.noi < p.mpay ? '<div class="note warn">In ' + monthLabel(monthKey(p.low.w), true).split(' ')[0] + ' this car is projected to earn less than its loan payment. Keep cash in reserve.</div>' : '');
  if (o.reason) h += '<div class="note warn">' + esc(o.reason) + '</div>';
  h += '</div></div></div>';
  var label = !o.bay ? 'No free bay' : o.action === 'none' ? 'Insufficient funds' : !chosenOk ? 'Choose a payment option' : ctx.down >= 1 ? 'Buy for ' + money(price) : 'Finance · ' + money(due) + ' down';
  h += '<div class="m-foot"><div class="total"><small>Due today</small><b class="num">' + (chosenOk ? money(due) : '—') + '</b></div><div style="display:flex;gap:8px"><button class="btn ghost" data-act="close">Not now</button><button class="btn gold" data-act="buy" data-id="' + l.id + '"' + (o.bay && chosenOk ? '' : ' disabled') + '>' + label + '</button></div></div>';
  modal(h);
}

function carModal(c) {
  var M = M_(c.model), loan = loanOf(c.id), sale = Math.round(c.value * SELL_SPREAD), p = carProjection(c);
  modalCtx = { type: 'car', id: c.id };
  var gain = c.value - c.paid, profit = c.gross - c.opex + gain;
  var spark = c.vh.length > 1 ? (function () { var mn = Math.min.apply(null, c.vh), mx = Math.max.apply(null, c.vh), rg = mx - mn || 1; return '<svg viewBox="0 0 200 40" class="chart" style="height:40px"><path d="' + c.vh.map(function (v, i) { return (i ? 'L' : 'M') + (i / (c.vh.length - 1) * 200).toFixed(1) + ',' + (36 - (v - mn) / rg * 32).toFixed(1); }).join('') + '" fill="none" stroke="#f0c983" stroke-width="2"/></svg>'; })() : '';
  var where = c.display ? 'Private collection' : 'Bay ' + String(fleet().indexOf(c) + 1).padStart(2, '0');
  var h = head(where + ' · ' + c.year + ' · ' + CLASS_LABEL[M.cls], esc(carName(c)), Math.round(c.miles).toLocaleString() + ' miles · condition ' + Math.round(c.cond) + '% · owned ' + (S.week - c.bought) + ' weeks');
  h += '<div class="m-body"><div class="m-hero">' + viewerHTML(c, c.color) + '</div><div class="m-cols">';
  h += '<div class="sec"><h4>Performance to date</h4><div class="kv"><span>Purchase price</span><b class="num">' + money(c.paid) + '</b><span>Current value</span><b class="num">' + money(c.value) + '</b><span>Value change (non-cash)</span><b class="num ' + (gain >= 0 ? 'up' : 'down') + '">' + signed(gain) + '</b><span class="sep"></span>' +
    '<span>Gross rental revenue</span><b class="num up">' + money(c.gross) + '</b><span>Operating expenses</span><b class="num down">' + money(-c.opex) + '</b><span>Net operating income</span><b class="num ' + (c.gross - c.opex >= 0 ? 'up' : 'down') + '">' + money(c.gross - c.opex) + '</b><span>Total return</span><b class="num ' + (profit >= 0 ? 'up' : 'down') + '">' + signed(profit) + ' (' + pct(profit / c.paid, 1) + ')</b>' +
    '<span>Utilization (4 wks)</span><b>' + pct(util(c)) + '</b>' + (loan ? '<span>Loan balance</span><b class="num">' + money(loan.balance) + '</b><span>Loan payment</span><b class="num">' + money(loan.mpay) + '/mo</b>' : '') + '</div>' + (spark ? '<p class="eyebrow" style="margin:14px 0 4px">Value history</p>' + spark : '') +
    '<h4 style="margin-top:16px">Condition</h4><div class="bar"><span style="width:' + c.cond + '%"></span></div><p class="dim" style="font-size:.78rem;margin-top:6px">Lower condition cuts demand and makes breakdowns likelier.</p>' +
    '<button class="btn sm" style="margin-top:8px" data-act="service" data-id="' + c.id + '">Service · ' + money(serviceCost(c)) + ' (+15%, 2 days in the shop)</button></div>';
  var wrapHTML = M.livery ? '<p class="dim" style="font-size:.78rem;margin-top:14px">Its race livery stays as it is: no wraps on this one.</p>' :
    '<h4 style="margin-top:16px">Customize · ' + money(WRAP_COST) + ' wrap</h4><div class="swatches">' + PAINTS.map(function (pp) { return '<button class="swatch' + (c.color === pp[1] ? ' on' : '') + '" style="background:' + pp[1] + '" title="' + pp[0] + '" aria-label="Wrap in ' + pp[0] + '" data-act="wrap" data-id="' + c.id + '" data-color="' + pp[1] + '"></button>'; }).join('') + '</div><p class="dim" style="font-size:.76rem;margin-top:6px">A fresh wrap adds 4% to rental demand.</p>';
  if (c.display) {
    var asRental = M.track ? null : project(c, { rate: c.rate, wkRate: c.wkRate, comp: ownedInClass(M.cls), price: c.value });
    h += '<div>' + econHTML(p, 'Holding it · next 12 months') + '<div class="sec" style="margin-top:14px"><h4>Private collection</h4><p class="dim" style="font-size:.84rem">' +
      (M.track ? 'A race car, so it can’t be rented. It stays on display, costs about ' + money(p.opex) + '/mo to store and maintain, and adds prestige.' :
        'Off the rental market: storage insurance and light upkeep run about ' + money(p.opex) + '/mo. Back in the fleet it would net about ' + money(asRental.noi) + '/mo, but rack up miles and wear.') + '</p>' +
      (M.track ? '' : '<button class="btn sm" style="margin-top:10px" data-act="unretire" data-id="' + c.id + '"' + (fleet().length >= bays() ? ' disabled title="Every rental bay is full"' : '') + '>Return to rental fleet</button>') + wrapHTML + '</div></div></div></div>';
  } else {
    h += '<div>' + econHTML(p, 'Next 12 months at your prices') + '<div class="sec" style="margin-top:14px"><h4>Rental pricing</h4>' + rentalControls(c) + '<p class="eyebrow" style="margin:14px 0 8px">Rental calendar · last 4 weeks</p>' + calendarHTML(c) +
      '<h4 style="margin-top:16px">Private collection</h4><p class="dim" style="font-size:.8rem">Keep it but stop renting it: storage costs about ' + money(project(c, { display: true, price: c.value }).opex) + '/mo, no wear, and it frees this bay.</p><button class="btn sm" style="margin-top:8px" data-act="retire" data-id="' + c.id + '"' + (shown().length >= spots() ? ' disabled title="Every display spot is taken"' : '') + '>Retire to collection (' + (spots() - shown().length) + ' spot' + (spots() - shown().length === 1 ? '' : 's') + ' free)</button>' +
      wrapHTML + '</div></div></div></div>';
  }
  h += '<div class="m-foot"><div class="total"><small>Sell now (' + pct(SELL_SPREAD) + ' of value' + (loan ? ', after loan payoff' : '') + ')</small><b class="num">' + money(sale - (loan ? loan.balance : 0)) + '</b></div><div style="display:flex;gap:8px"><button class="btn danger" data-act="sell" data-id="' + c.id + '">Sell for ' + money(sale) + '</button><button class="btn gold" data-act="close">Done</button></div></div>';
  modal(h);
}

/* Compare two or three listings side by side and spell out the trade-offs */
function compareModal() {
  var ls = S.compare.map(function (id) { return S.market.filter(function (l) { return l.id === id; })[0]; }).filter(Boolean);
  if (ls.length < 2) return;
  var A = ls.map(function (l) { return analyze(l); });
  var best = function (f, low) { var v = A.map(f), t = low ? Math.min.apply(null, v) : Math.max.apply(null, v); return v.map(function (x) { return x === t && v.filter(function (y) { return y === t; }).length < v.length; }); };
  var row = function (label, f, fmt, low) {
    var w = low == null ? A.map(function () { return false; }) : best(f, low);
    return '<tr><td class="dim">' + label + '</td>' + A.map(function (a, i) { return '<td class="r num' + (w[i] ? ' win' : '') + '">' + fmt(f(a), a) + '</td>'; }).join('') + '</tr>';
  };
  var t = '<table class="cmp-table"><thead><tr><th></th>' + A.map(function (a) { return '<th class="r">' + esc(carName(a.l, true)) + '</th>'; }).join('') + '</tr></thead><tbody>' +
    '<tr><td></td>' + A.map(function (a) { return '<td class="r"><div class="bay-stage cmp-shot">' + car3d(a.l, a.l.color, 420, 190) + '</div></td>'; }).join('') + '</tr>' +
    row('AI investment score', function (a) { return a.score; }, function (v) { return v + '/100'; }, false) +
    row('Purchase price', function (a) { return a.price; }, money, true) +
    row('Market value', function (a) { return a.l.market; }, money) +
    row('Price vs. market', function (a) { return a.discount; }, function (v) { return (v >= 0 ? pct(v) + ' under' : pct(-v) + ' over'); }, false) +
    row('Mileage', function (a) { return a.l.miles; }, function (v, a) { return v.toLocaleString() + ' <em class="dim">(' + (a.mileRatio > 1 ? '+' : '') + pct(a.mileRatio - 1) + ')</em>'; }, true) +
    row('Condition', function (a) { return a.x.cond; }, function (v) { return v + '%'; }, false) +
    row('Daily rate', function (a) { return a.cash.rate; }, money) +
    row('Bookings / month', function (a) { return a.cash.days; }, function (v) { return v.toFixed(1) + ' days'; }, false) +
    row('Revenue / month', function (a) { return a.cash.gross; }, money, false) +
    row('Operating expenses / month', function (a) { return a.cash.opex; }, money, true) +
    row('Net income / month', function (a) { return a.cash.noi; }, money, false) +
    row('Annual ROI (paid in cash)', function (a) { return a.cash.roiUnlev; }, function (v) { return pct(v, 1); }, false) +
    row('Value change / year', function (a) { return a.cash.valueChange; }, signed, false) +
    row('Risk', function (a) { return a.riskTotal; }, function (v, a) { return a.riskLabel + ' (' + v + ')'; }, true) +
    row('How you’d pay', function (a) { return a.opts.action; }, function (v) { return { buy: 'Cash', finance: 'Finance', none: 'Can’t afford', nobay: 'No free bay' }[v]; }) + '</tbody></table>';
  modal(head('AI adviser · side by side', 'Compare ' + ls.length + ' listings') + '<div class="m-body"><div class="table-wrap">' + t + '</div><div class="note info" style="margin-top:14px">' + tradeoffs(A) + '</div></div><div class="m-foot"><span class="dim" style="font-size:.78rem">Green marks the better figure in each row.</span><div style="display:flex;gap:8px;flex-wrap:wrap">' + ls.map(function (l) { return '<button class="btn sm" data-act="listing" data-id="' + l.id + '">Open ' + esc(l.year + ' ' + MODELS[l.model].name) + '</button>'; }).join('') + '</div></div>');
}
function tradeoffs(A) {
  var nm = function (a) { return '<b>' + esc(a.l.year + ' ' + a.M.name.replace('Corvette C8 Stingray', 'Corvette')) + '</b>'; };
  var by = function (f, low) { return A.slice().sort(function (x, y) { return low ? f(x) - f(y) : f(y) - f(x); })[0]; };
  var top = by(function (a) { return a.score; }), cheap = by(function (a) { return a.price; }, true), cash = by(function (a) { return a.cash.noi; }), roi = by(function (a) { return a.cash.roiUnlev; }), safe = by(function (a) { return a.riskTotal; }, true), lowMiles = by(function (a) { return a.mileRatio; }, true);
  var s = [];
  s.push(nm(top) + ' has the best overall score (' + top.score + ').');
  if (cheap !== top) s.push(nm(cheap) + ' needs the least capital: ' + money(top.price - cheap.price) + ' less than ' + nm(top) + (cheap.cash.roiUnlev > top.cash.roiUnlev ? ', and its smaller price lifts ROI to ' + pct(cheap.cash.roiUnlev, 1) + '.' : ', but it earns less per dollar invested.'));
  if (cash !== top && cash.cash.noi > top.cash.noi + 50) s.push(nm(cash) + ' brings in the most income (' + money(cash.cash.noi) + '/mo) but ties up ' + money(cash.price) + '.');
  if (roi !== top && roi !== cheap) s.push(nm(roi) + ' has the best return on its price (' + pct(roi.cash.roiUnlev, 1) + ').');
  if (lowMiles !== cheap && lowMiles.mileRatio < cheap.mileRatio - 0.25) s.push(nm(lowMiles) + ' has much lower mileage, so maintenance runs ' + money(cheap.cash.maint - lowMiles.cash.maint) + '/mo less and repair risk is lower: worth the premium if you value predictability.');
  if (safe !== top) s.push('Lowest risk: ' + nm(safe) + ' (' + safe.riskLabel.toLowerCase() + ').');
  var appr = A.filter(function (a) { return a.cash.valueChange > 0; });
  if (appr.length && appr.length < A.length) s.push(appr.map(nm).join(' and ') + ' should gain value while the others depreciate, which favors holding for the long term over rental income.');
  return s.join(' ');
}

function weekModal(sums) {
  var tot = sums.reduce(function (t, s) { ['gross', 'days', 'fees', 'cleaning', 'ins', 'maint', 'repairs', 'garage', 'interest', 'principal', 'valchg'].forEach(function (k) { t[k] = (t[k] || 0) + s[k]; }); t.events = t.events.concat(s.events); return t; }, { events: [] });
  var start = sums[0].start, end = sums[sums.length - 1].end, change = end - start;
  var opex = tot.fees + tot.cleaning + tot.ins + tot.maint + tot.repairs + tot.garage, noi = tot.gross - opex, debtS = tot.interest + tot.principal;
  var h = head(sums.length > 1 ? sums.length + ' weeks of business' : 'Week ' + S.week + ' report', (change >= 0 ? 'Net worth +' : 'Net worth ') + money(change), 'Now ' + money(end) + ' · cash ' + money(S.cash) + ' · ' + seasonName(S.week).toLowerCase() + ' demand');
  h += '<div class="m-body"><div class="m-cols"><div class="sec"><h4>Operations</h4><div class="kv"><span>Rental days booked</span><b>' + tot.days + '</b><span>Gross rental revenue</span><b class="num up">' + money(tot.gross) + '</b><span>Platform fees & cleaning</span><b class="num down">' + money(-(tot.fees + tot.cleaning)) + '</b><span>Insurance & maintenance</span><b class="num down">' + money(-(tot.ins + tot.maint)) + '</b><span>Repairs & deductibles</span><b class="num down">' + money(-tot.repairs) + '</b><span>Garage upkeep</span><b class="num down">' + money(-tot.garage) + '</b><span class="sep"></span><span>Net operating income</span><b class="num ' + (noi >= 0 ? 'up' : 'down') + '">' + money(noi) + '</b></div></div>' +
    '<div class="sec"><h4>Cash & value</h4><div class="kv"><span>Loan payments</span><b class="num down">' + money(-debtS) + '</b><span>Cash flow</span><b class="num ' + (noi - debtS >= 0 ? 'up' : 'down') + '">' + money(noi - debtS) + '</b><span class="sep"></span><span>Car value change (non-cash)</span><b class="num ' + (tot.valchg >= 0 ? 'up' : 'down') + '">' + signed(tot.valchg) + '</b><span>Net worth change</span><b class="num ' + (change >= 0 ? 'up' : 'down') + '">' + signed(change) + '</b></div></div></div>';
  if (tot.events.length) h += '<div class="sum-list">' + tot.events.map(function (e) { return '<div class="ev"><i>' + e.i + '</i><span>' + esc(e.t) + '</span></div>'; }).join('') + '</div>';
  else if (!S.cars.length) h += '<div class="note info">No cars, no income, but the garage still costs ' + money(TIERS[S.tier].fee) + ' a week. Head to the marketplace.</div>';
  h += '</div><div class="m-foot"><span class="dim" style="font-size:.8rem">' + dateOf(S.week).toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) + '</span><div style="display:flex;gap:8px"><button class="btn ghost" data-act="close">Close</button><button class="btn gold" data-act="advance" data-n="1">Next week ▸</button></div></div>';
  modal(h);
}

function endModal() {
  if (S.over === 'won') {
    modal(head('Goal reached in week ' + S.week, 'Automotive empire built') + '<div class="m-body"><p class="big-num">' + money(netWorth()) + '</p><p class="dim" style="margin:6px 0 16px">From ' + money(START_CASH) + ' and two empty bays to ' + S.cars.length + ' cars in ' + (S.week / 52).toFixed(1) + ' years.</p><div class="kv"><span>Lifetime rental revenue</span><b class="num">' + money(S.totals.gross) + '</b><span>Lifetime net operating income</span><b class="num">' + money(S.totals.noi) + '</b><span>Rental days booked</span><b>' + S.totals.bookings.toLocaleString() + '</b><span>Reputation</span><b>' + S.rep.toFixed(1) + ' ★</b><span>Achievements</span><b>' + Object.keys(S.awards).length + ' of ' + AWARDS.length + '</b></div></div><div class="m-foot"><a class="btn ghost" href="index.html">Visit Adrien’s garage</a><div style="display:flex;gap:8px"><button class="btn" data-act="new-game-now">New game</button><button class="btn gold" data-act="keep-playing">Keep building</button></div></div>', 'sm');
  } else {
    modal(head('Week ' + S.week, 'The business went under') + '<div class="m-body"><p class="dim">Cash stayed negative for three weeks and the lenders called in your loans. Leverage magnifies losses as well as gains, and winter is when rental income dries up.</p><div class="note info">Tip: keep a few months of fixed costs in cash, inspect cheap cars, and check whether each car covers its loan payment in the slowest month.</div></div><div class="m-foot"><span></span><button class="btn gold" data-act="new-game-now">Start over</button></div>', 'sm');
  }
}

function behindModal() {
  modal(head('Behind the Garage', 'How this game works') + '<div class="m-body" style="font-size:.9rem;color:var(--body);display:grid;gap:12px">' +
    '<p>Garage Tycoon is a small business simulation about buying sports cars, renting them out and growing net worth. I built it to combine two things I care about: cars and the financial decisions behind owning them.</p>' +
    '<div class="sec"><h4>Rental economics</h4><p>Each car has a reference daily rate, a base booking rate, insurance, maintenance that rises with mileage, a repair risk that rises with age, mileage and wear, and a yearly depreciation rate (collectibles appreciate). Bookings are simulated day by day. Demand falls as you raise the price, follows the seasons (sports cars swing from ×0.55 in January to ×1.45 in July), drifts with market conditions, and depends on your reputation, the car’s condition and age, competition from your own fleet, and random week-to-week swings. Every rental pays a ' + pct(PLATFORM_FEE) + ' platform fee and cleaning, adds wear, sometimes blocks the next day for turnaround, and carries a small chance of renter damage (you pay the insurance deductible).</p></div>' +
    '<div class="sec"><h4>Cash vs. value</h4><p>Cash moves with rental revenue, operating expenses, monthly loan payments and purchases. Depreciation and appreciation change what your cars are worth, and so your net worth, but they are never charged as cash. The monthly income statement separates gross revenue, operating expenses, net operating income, loan payments and cash flow.</p></div>' +
    '<div class="sec"><h4>The AI adviser</h4><p>A transparent model rather than a black box. It runs the same 12-month projection the simulation uses, then scores price vs. market, cash yield, total return and risk. Open any listing and choose “Show the score breakdown”.</p></div>' +
    '<div class="sec"><h4>The cars</h4><p>Every car is a real 3D model, the same ones in my portfolio garage, rendered with three.js and repainted per listing. Models by <a href="https://sketchfab.com/ddiaz-design" target="_blank" rel="noopener" style="color:var(--gold-2)">ddiaz-design</a>, and the “Rexy” Porsche 911 GT3 R by <a href="https://sketchfab.com/VTX_car" target="_blank" rel="noopener" style="color:var(--gold-2)">VTX</a>, on Sketchfab (CC BY 4.0 and CC BY-NC-SA 4.0).</p></div>' +
    '<div class="sec"><h4>Private collection</h4><p>Cars you want to keep but no longer rent can be retired to a private collection. They stop earning and stop wearing out, cost far less to insure and maintain, keep changing in value, and add a little prestige. Race cars like Rexy can only live there.</p></div>' +
    '<p class="dim">Made by Adrien Pinilla, NYU Stern. <a href="index.html" style="color:var(--gold-2)">Visit my portfolio garage →</a></p></div><div class="m-foot"><span></span><button class="btn gold" data-act="close">Back to the game</button></div>');
}

/* ---------------- Tutorial ---------------- */
var COACH = [
  { t: 'Welcome to Garage Tycoon', p: 'You have <b>$100,000</b> and a two-car garage. Buy sports cars, rent them out, and grow your net worth to <b>$5 million</b>.', btn: 'Let’s go' },
  { t: 'Step 1 · Buy a car', p: 'Open the <b>Marketplace</b>. The adviser scores each listing from its projected income, costs, depreciation and risk. Cars that cost more than your cash can be <b>financed</b> with 20% down.', tab: 'market' },
  { t: 'Step 2 · Set the price', p: 'Nice purchase. Open <b>Rentals</b> to tune the daily and weekend rate. Cheaper books more; pricier earns more per day.', tab: 'rentals' },
  { t: 'Step 3 · Run the business', p: 'Press <b>Next week</b> to simulate seven days of bookings, costs and surprises. It’s winter, so start slow.' },
  { t: 'Step 4 · Watch the money', p: 'Check <b>Finances</b> for the monthly income statement: revenue, expenses, net operating income and cash flow after loan payments.', btn: 'Got it', tab: 'finances' }
];
function renderCoach() {
  var el = $('#coach');
  if (S.tutorial >= COACH.length || S.over) { el.innerHTML = ''; return; }
  var c = COACH[S.tutorial];
  el.innerHTML = '<div class="coach" role="status"><small>Tutorial · ' + (S.tutorial + 1) + ' of ' + COACH.length + '</small><h3>' + c.t + '</h3><p>' + c.p + '</p><div class="row"><button class="btn ghost sm" data-act="tutorial-skip">Skip tutorial</button>' +
    (c.btn ? '<button class="btn gold sm" data-act="tutorial-next">' + c.btn + '</button>' : c.tab && tab !== c.tab ? '<button class="btn gold sm" data-act="tab" data-tab="' + c.tab + '">Open ' + TABS.filter(function (t) { return t[0] === c.tab; })[0][1] + '</button>' : '<span></span>') + '</div></div>';
}

/* ---------------- Toasts ---------------- */
function toast(html) {
  var t = document.createElement('div'); t.className = 'toast'; t.innerHTML = html;
  $('#toasts').appendChild(t);
  setTimeout(function () { t.style.transition = 'opacity .4s'; t.style.opacity = '0'; setTimeout(function () { t.remove(); }, 450); }, 3600);
  return false;
}

/* ---------------- Events ---------------- */
function findListing(id) { return S.market.filter(function (l) { return l.id === +id; })[0]; }
function findCar(id) { return S.cars.filter(function (c) { return c.id === +id; })[0]; }
var ACT = {
  tab: function (d) { tab = d.tab; if ($('#veil').classList.contains('open')) closeModal(); else render(); window.scrollTo({ top: 0 }); },
  advance: function (d) {
    if (S.over) return endModal();
    var sums = [];
    for (var i = 0; i < +d.n && !S.over; i++) sums.push(advanceWeek());
    render();
    if (S.over) return endModal();
    weekModal(sums);
  },
  car: function (d) { carModal(findCar(d.id)); },
  listing: function (d) { var l = findListing(d.id); if (l) { modalCtx = null; listingModal(l); } else toast('That listing just sold to someone else.'); },
  close: function () { closeModal(); },
  expand: function () { expand(); render(); },
  mfilter: function (d) { mFilter = d.f; render(); },
  compare: function (d, el) { var id = +d.id, i = S.compare.indexOf(id); if (el.checked) { if (S.compare.length >= 3) { el.checked = false; return toast('Compare up to three listings at a time.'); } S.compare.push(id); } else if (i >= 0) S.compare.splice(i, 1); save(); render(); },
  'compare-clear': function () { S.compare = []; save(); render(); },
  'compare-open': function () { compareModal(); },
  inspect: function (d) { var l = findListing(d.id); inspect(l); listingModal(l); },
  offer: function (d) {
    var l = findListing(d.id), offer = modalCtx.offer; l.offered = true;
    if (offer >= l.reserve) { l.ask = offer; toast('Offer accepted at <b>' + money(offer) + '</b>.'); }
    else if (offer >= l.reserve - l.ask * 0.07) { l.counter = l.reserve; toast('The seller countered at <b>' + money(l.reserve) + '</b>.'); }
    else if (offer < l.reserve * 0.82) { S.market = S.market.filter(function (x) { return x !== l; }); save(); closeModal(); return toast('Insulted, the seller pulled the listing.'); }
    else toast('Offer rejected. The price stays at ' + money(l.ask) + '.');
    modalCtx.down = purchaseOptions(l, l.counter || l.ask).cash ? 1 : modalCtx.down;
    save(); listingModal(l);
  },
  down: function (d) { modalCtx.down = +d.v; listingModal(findListing(modalCtx.id)); },
  term: function (d) { modalCtx.months = +d.v; listingModal(findListing(modalCtx.id)); },
  buy: function (d) { var l = findListing(d.id), car = buy(l, l.counter || l.ask, modalCtx.down, modalCtx.months); if (car) { tab = 'garage'; if (!(l.hidden && !l.inspected)) closeModal(); else render(); } },
  list: function (d, el) { var c = findCar(d.id); c.listed = el.checked; save(); if (modalCtx && modalCtx.type === 'car') carModal(c); else render(); },
  service: function (d) { var c = findCar(d.id); service(c); carModal(c); },
  retire: function (d) { var c = findCar(d.id); retire(c); carModal(c); },
  unretire: function (d) { var c = findCar(d.id); unretire(c); carModal(c); },
  wrap: function (d) { var c = findCar(d.id); if (c.color === d.color) return; wrap(c, d.color); carModal(c); },
  sell: function (d) {
    var c = findCar(d.id), btn = document.querySelector('[data-act="sell"]');
    if (!btn.dataset.sure) { btn.dataset.sure = '1'; btn.textContent = 'Tap again to confirm'; return; }
    sell(c); closeModal();
  },
  payoff: function (d) { var l = S.loans.filter(function (x) { return x.id === +d.id; })[0]; payOff(l); render(); },
  'viewer-size': function (d, el) { el.closest('.viewer-wrap').classList.toggle('big'); },
  menu: function (d, el) { var dr = $('#drawer'), open = !dr.classList.contains('open'); dr.classList.toggle('open', open); el.setAttribute('aria-expanded', open); },
  behind: function () { $('#drawer').classList.remove('open'); behindModal(); },
  'new-game': function () { $('#drawer').classList.remove('open'); modal(head('Start over?', 'New game') + '<div class="m-body"><p class="dim">This wipes your current garage and starts again with $100,000.</p></div><div class="m-foot"><span></span><div style="display:flex;gap:8px"><button class="btn ghost" data-act="close">Cancel</button><button class="btn danger" data-act="new-game-now">Start over</button></div></div>', 'sm'); },
  'new-game-now': function () { newGame(); S.tutorial = 1; tab = 'garage'; save(); closeModal(); },
  'keep-playing': function () { S.over = null; save(); closeModal(); },
  'tutorial-next': function () { S.tutorial++; if (S.tutorial === 1) tab = 'garage'; save(); render(); },
  'tutorial-skip': function () { S.tutorial = COACH.length; save(); render(); },
  'tutorial-restart': function () { $('#drawer').classList.remove('open'); S.tutorial = 0; save(); render(); }
};
document.addEventListener('click', function (e) {
  var t = e.target.closest('[data-act]');
  if (!t) { if (!e.target.closest('.drawer') && !e.target.closest('.menu-btn')) $('#drawer').classList.remove('open'); if (e.target === $('#veil')) closeModal(); return; }
  if (t.disabled) return;
  if (t.tagName === 'INPUT' && t.type === 'checkbox') { ACT[t.dataset.act](t.dataset, t, e); return; }
  e.preventDefault();
  ACT[t.dataset.act](t.dataset, t, e);
});
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape' && $('#veil').classList.contains('open')) closeModal();
  if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('rank')) { e.preventDefault(); e.target.click(); }
});
document.addEventListener('input', function (e) {
  var t = e.target, k = t.dataset.input;
  if (!k) return;
  if (k === 'msort') { mSort = t.value; render(); return; }
  if (k === 'finmonth') { finMonth = t.value; render(); return; }
  if (k === 'offer') { modalCtx.offer = +t.value; var l = findListing(modalCtx.id); document.querySelector('[data-out="offer"]').textContent = money(+t.value) + ' (' + pct(1 - t.value / l.ask) + ' off)'; return; }
  var c = findCar(t.dataset.id);
  if (k === 'rate') { c.rate = +t.value; document.querySelectorAll('[data-out="rate-' + c.id + '"]').forEach(function (o) { o.textContent = money(c.rate); }); }
  if (k === 'wkrate') { c.wkRate = +t.value; document.querySelectorAll('[data-out="wk-' + c.id + '"]').forEach(function (o) { o.textContent = money(c.wkRate); }); }
  document.querySelectorAll('[data-out="est-' + c.id + '"]').forEach(function (o) { o.innerHTML = estHTML(c); });
  save();
});
addEventListener('resize', function () { var narrow = innerWidth <= 860; document.querySelectorAll('.short-l').forEach(function (e) { e.style.display = narrow ? '' : 'none'; }); document.querySelectorAll('.tab .long').forEach(function (e) { e.style.display = narrow ? 'none' : ''; }); });

/* ---------------- Boot ---------------- */
if (!load()) newGame();
render();
if (S.over) endModal();
