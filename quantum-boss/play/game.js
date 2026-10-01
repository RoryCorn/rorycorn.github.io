/* Quantum Boss — browser edition.
 *
 * A port of the iPhone game (~/git/quantum-boss): its band-mode engine, its renderer,
 * its six planetary conditions, its sounds and its art. Numbers below come from
 * QuantumGameEngine.swift, Invader.swift, ShipCatalog.swift, GameView.swift and
 * PlanetaryConditions.swift so the two feel the same.
 *
 * The iPhone reads gaze through ARKit. Here the face comes from MediaPipe Face
 * Landmarker, running on the device: head pitch plus the eyes' look-up/look-down
 * blendshapes, each calibrated separately and blended by how clean its signal is.
 * Nothing leaves the device. Mouse, touch and keyboard play too.
 */

const MP_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
const MP_MODEL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const MONO = 'ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace';

// ------------------------------------------------------------------ tuning (from the iPhone)
const BAND_TOP = 0.22, BAND_BOTTOM = 0.68;   // stack spans 22%..68% of height
const ATMOS_Y = 0.80;                        // drawn atmosphere line
const HYSTERESIS = 0.22;                     // fraction of a band; stops boundary flicker
const REACQUIRE = 0.4;                       // seconds after a kill before a new lock builds
const BOSS_NAMES = ['THE ARCHON', 'VOID SOVEREIGN', 'PALE MONARCH', 'THE OBSERVER', 'NULL REGENT', 'THE LAST EIGENSTATE'];
const KIND = {
  scout: { w: 82, damage: 8, score: 20 },
  dread: { w: 148, damage: 22, score: 75 },
};
// Tied to the sprite, not randomised, so the variety is learnable (ShipCatalog.swift).
const SCOUTS = [
  { name: 'scout_a', dwell: 0.62, fall: 1.45 },   // the darter
  { name: 'scout_b', dwell: 1.00, fall: 1.00 },   // baseline
  { name: 'scout_c', dwell: 1.55, fall: 0.68 },   // the twin-disc heavy
];
const DREADS = [{ name: 'dread_a', dwell: 1, fall: 1 }, { name: 'dread_b', dwell: 1, fall: 1 }];
const dwellFor = (kind, wave) => {
  const n = Math.max(wave - 1, 0);
  return kind === 'scout' ? 0.50 + Math.min(n * 0.045, 0.52) : 0.85 + Math.min(n * 0.020, 0.28);
};
const isBossWave = (n) => n % 4 === 0;
const bossNameFor = (n) => BOSS_NAMES[(Math.floor(n / 4) - 1) % BOSS_NAMES.length];

const CYAN = [100, 210, 255], ORANGE = [255, 159, 10], RED = [255, 69, 58], PURPLE = [191, 90, 242];
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const params = new URLSearchParams(location.search);

// ------------------------------------------------------------------ dom
const $ = (id) => document.getElementById(id);
const stage = $('stage'), canvas = $('view'), ctx = canvas.getContext('2d');
const sky = $('sky'), introVid = $('intro'), cam = $('cam');
const screens = {
  gate: $('scrGate'), intro: $('scrIntro'), menu: $('scrMenu'), cal: $('scrCal'),
  pause: $('scrPause'), over: $('scrOver'), err: $('scrErr'),
};
function showScreen(name) {
  for (const k in screens) screens[k].hidden = k !== name;
  const playing = name === null;
  $('hud').hidden = !playing;
  $('btnPause').hidden = !playing;
  if (!playing) $('trackLost').hidden = true;
}

// ------------------------------------------------------------------ sizing
let W = 0, H = 0, DPR = 1, u = 1;
const soft = document.createElement('canvas'), sctx = soft.getContext('2d');
const soft2 = document.createElement('canvas'), sctx2 = soft2.getContext('2d');
const SOFT = 0.25;   // weather glows render at quarter size, are blurred once there, then scale up
sctx2.filter = 'blur(1px)';
const FILTER_OK = sctx2.filter === 'blur(1px)';
sctx2.filter = 'none';

function resize() {
  const r = stage.getBoundingClientRect();
  const nw = Math.max(1, Math.round(r.width)), nh = Math.max(1, Math.round(r.height));
  if (W && (nw !== W || nh !== H)) rescaleWorld(nw / W, nh / H, nw / 393);
  W = nw; H = nh;
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  u = clamp(W / 393, 0.8, 1.7);
  stage.style.setProperty('--u', u.toFixed(3));
  canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
  soft.width = soft2.width = Math.ceil(W * SOFT); soft.height = soft2.height = Math.ceil(H * SOFT);
}
window.addEventListener('resize', resize);
if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);

// ------------------------------------------------------------------ assets
const sprites = {};
for (const s of [...SCOUTS, ...DREADS]) {
  const img = new Image();
  img.src = `assets/${s.name}.png`;
  img.onload = () => { s.aspect = img.naturalHeight / Math.max(1, img.naturalWidth); };
  s.img = img; s.aspect = 0.5;
  sprites[s.name] = s;
}

// ------------------------------------------------------------------ audio (GameAudio.swift)
const SFX = {
  collapse: ['sfx_boom1.mp3', 'sfx_boom2.mp3', 'sfx_boom3.mp3', 'sfx_boom4.mp3'],
  bossFall: ['sfx_boom2.mp3'],             // the longest, for the biggest kill
  coreDown: ['sfx_core.m4a'],
  breach: ['sfx_escape.mp3'],              // a hull slips past
  critical: ['sfx_breach.mp3'],            // the planet in serious trouble
  waveStart: ['sfx_wave.mp3'],
  gameOver: ['sfx_over.mp3'],
  lockStart: ['sfx_zap.mp3'],
  shipArrive: ['sfx_ship1.mp3', 'sfx_ship2.mp3', 'sfx_ship3.mp3', 'sfx_ship4.mp3'],
  bossArrive: ['sfx_bossship1.mp3', 'sfx_bossship2.mp3'],
  stinger: ['sfx_brass.mp3'],
};
const VOLUME = {
  collapse: 0.8, coreDown: 0.85, bossFall: 1.0, breach: 0.95, critical: 1.0, waveStart: 0.5,
  gameOver: 0.9, lockStart: 0.55, shipArrive: 0.35, bossArrive: 0.8, stinger: 0.7,
};
const AC = window.AudioContext || window.webkitAudioContext;
const audio = { ctx: null, master: null, buffers: {}, ambient: null, ambientGain: null, muted: false };
try { audio.muted = localStorage.getItem('qb.muted') === '1'; } catch {}

function initAudio() {
  if (audio.ctx || !AC) return;
  audio.ctx = new AC();
  audio.master = audio.ctx.createGain();
  audio.master.gain.value = audio.muted ? 0 : 1;
  audio.master.connect(audio.ctx.destination);
  const files = new Set([].concat(...Object.values(SFX), 'sfx_sky.mp3'));
  for (const f of files) {
    fetch(`assets/${f}`).then((r) => r.arrayBuffer())
      .then((b) => new Promise((ok, bad) => audio.ctx.decodeAudioData(b, ok, bad)))
      .then((buf) => { audio.buffers[f] = buf; if (f === 'sfx_sky.mp3' && state.mode === 'play') startAmbient(); })
      .catch(() => {});
  }
}
function unlockAudio() {
  initAudio();
  if (audio.ctx && audio.ctx.state !== 'running') audio.ctx.resume().catch(() => {});
}
function play(effect) {
  if (!audio.ctx || audio.muted) return;
  const buf = audio.buffers[pick(SFX[effect])];
  if (!buf) return;
  const src = audio.ctx.createBufferSource();
  const g = audio.ctx.createGain();
  g.gain.value = VOLUME[effect] ?? 0.7;
  src.buffer = buf; src.connect(g); g.connect(audio.master);
  src.start();
}
function startAmbient() {
  const buf = audio.buffers['sfx_sky.mp3'];
  if (!audio.ctx || !buf || audio.ambient) return;
  audio.ambientGain = audio.ctx.createGain();
  audio.ambientGain.gain.value = 0.16;
  audio.ambient = audio.ctx.createBufferSource();
  audio.ambient.buffer = buf; audio.ambient.loop = true;
  audio.ambient.connect(audio.ambientGain); audio.ambientGain.connect(audio.master);
  audio.ambient.start();
}
function stopAmbient() {
  try { if (audio.ambient) audio.ambient.stop(); } catch {}
  audio.ambient = null;
}
function setMuted(m) {
  audio.muted = m;
  try { localStorage.setItem('qb.muted', m ? '1' : '0'); } catch {}
  if (audio.master) audio.master.gain.value = m ? 0 : 1;
  introVid.muted = m; narration.muted = m;
  $('btnSound').textContent = m ? 'SOUND: OFF' : 'SOUND: ON';
}
const narration = new Audio('assets/narration.m4a');
narration.preload = 'auto';

// ------------------------------------------------------------------ planetary conditions (PlanetaryConditions.swift)
const CONDITIONS = {
  thunderstorm: { title: '⚡  ELECTRICAL STORM', short: 'STORM' },
  aurora: { title: '✦  AURORA BOREALIS', short: 'AURORA' },
  meteorShower: { title: '☄  METEOR SHOWER', short: 'METEORS' },
  solarStorm: { title: '☀  GEOMAGNETIC STORM', short: 'SOLAR' },
  nightSide: { title: '·  NIGHT SIDE', short: 'NIGHT' },
  cyclone: { title: '◉  CYCLONIC STORM', short: 'CYCLONE' },
};
function makeMeteor(dense) {
  return {
    u: rand(-0.25, 1.0), v: rand(-0.15, 0.30), size: dense ? rand(1.8, 3.4) : rand(1.6, 3.0),
    phase: Math.random(), rate: dense ? rand(2.5, 7.0) : rand(3.5, 9.0),
    angle: dense ? rand(0.42, 0.62) : rand(0.38, 0.66), length: rand(70, 190),
  };
}
function makeWeather(condition) {
  const w = { condition, motes: [], flashes: [], ribbons: [], strays: [] };
  for (let i = 0; i < 8; i++) w.strays.push(makeMeteor(false));   // every sky gets a few
  if (condition === 'thunderstorm') {
    // strikes come from a few storm cells, so they read as a weather system
    const cells = [0, 1, 2].map(() => ({ u: rand(0.12, 0.88), v: rand(0.12, 0.72) }));
    let t = rand(0.8, 2.2);
    while (t < 1800) {
      const c = pick(cells);
      w.flashes.push({ time: t, u: clamp(c.u + rand(-0.09, 0.09), 0.02, 0.98), v: clamp(c.v + rand(-0.07, 0.07), 0.02, 0.95), strength: rand(0.4, 1) });
      t += rand(0.9, 3.4);
    }
  } else if (condition === 'aurora') {
    for (let i = 0; i < 4; i++) {
      w.ribbons.push({
        v0: 0.04 + i * 0.11 + rand(-0.02, 0.02), height: rand(0.07, 0.14), amp: rand(0.02, 0.05),
        freq: rand(2.5, 5.5), speed: rand(0.25, 0.6), phase: rand(0, Math.PI * 2),
        hue: rand(0.30, 0.78), alpha: rand(0.34, 0.55),
      });
    }
  } else if (condition === 'meteorShower') {
    for (let i = 0; i < 18; i++) w.motes.push(makeMeteor(true));
  } else if (condition === 'solarStorm') {
    for (let i = 0; i < 14; i++) w.motes.push({ u: Math.random(), v: rand(0.02, 0.34), size: rand(20, 60), phase: rand(0, Math.PI * 2), rate: rand(0.5, 1.6) });
  } else if (condition === 'nightSide') {
    // lights come in clumps: coastlines and river valleys, not sensor noise
    for (let c = 0; c < 8; c++) {
      const cu = rand(0.05, 0.95), cv = rand(0.10, 0.90);
      const n = 8 + ((Math.random() * 11) | 0);
      for (let i = 0; i < n; i++) {
        w.motes.push({ u: cu + rand(-0.1, 0.1) * Math.random(), v: cv + rand(-0.09, 0.09) * Math.random(), size: rand(0.9, 2.4), phase: rand(0, Math.PI * 2), rate: rand(1.5, 5.0) });
      }
    }
  } else if (condition === 'cyclone') {
    w.motes.push({ u: rand(0.28, 0.72), v: rand(0.34, 0.56), size: rand(0.26, 0.38), phase: rand(0, Math.PI * 2), rate: rand(0.07, 0.13), angle: Math.random() < 0.5 ? 1 : -1 });
  }
  return w;
}
function pickCondition() {
  const forced = params.get('weather');
  if (forced && CONDITIONS[forced]) return forced;
  let last = null;
  try { last = localStorage.getItem('qb.lastCondition'); } catch {}
  const pool = Object.keys(CONDITIONS).filter((c) => c !== last);
  const c = pick(pool);
  try { localStorage.setItem('qb.lastCondition', c); } catch {}
  return c;
}
// the planet's visible limb in the plate, and points on its face
const limb = (uu) => { const k = uu * 2 - 1; return H * 0.288 + k * k * H * 0.024; };
const surface = (uu, v) => { const top = limb(uu); return [uu * W, top + v * (H - top)]; };

function hsb(h, s, b) {
  const i = Math.floor(h * 6), f = h * 6 - i;
  const p = b * (1 - s), q = b * (1 - f * s), t = b * (1 - (1 - f) * s);
  const [r, g, bl] = [[b, t, p], [q, b, p], [p, b, t], [p, q, b], [t, p, b], [b, p, q]][((i % 6) + 6) % 6];
  return [Math.round(r * 255), Math.round(g * 255), Math.round(bl * 255)];
}
function ellipse(c, x, y, rx, ry) { c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2); }

function drawWeather(w, t) {
  // glows go into the quarter-size layer; crisp things straight onto the canvas
  sctx.setTransform(1, 0, 0, 1, 0, 0);
  sctx.clearRect(0, 0, soft.width, soft.height);
  sctx.setTransform(SOFT, 0, 0, SOFT, 0, 0);
  let softUsed = false;
  const c = w.condition;

  if (c === 'nightSide') {
    const top = limb(0.5);
    const g = ctx.createLinearGradient(0, top, 0, H);
    g.addColorStop(0, 'rgba(5,10,28,0.55)'); g.addColorStop(1, 'rgba(3,5,18,0.86)');
    ctx.fillStyle = g; ctx.fillRect(0, top, W, H - top);
  }
  if (c === 'aurora') {
    softUsed = true;
    for (const r of w.ribbons) {
      sctx.beginPath();
      const lower = [];
      for (let uu = 0; uu <= 1.0001; uu += 0.02) {
        const wave = Math.sin(uu * r.freq + t * r.speed + r.phase) + 0.45 * Math.sin(uu * r.freq * 2.1 - t * r.speed * 0.8 + r.phase);
        const v = r.v0 + r.amp * wave;
        const p = surface(uu, v);
        if (uu === 0) sctx.moveTo(p[0], p[1]); else sctx.lineTo(p[0], p[1]);
        lower.push(surface(uu, v + r.height));
      }
      for (let i = lower.length - 1; i >= 0; i--) sctx.lineTo(lower[i][0], lower[i][1]);
      sctx.closePath();
      const breathe = 0.68 + 0.32 * Math.sin(t * r.speed * 0.9 + r.phase);
      const col = hsb(r.hue, 0.85, 1);
      const a = surface(0.5, r.v0), b = surface(0.5, r.v0 + r.height);
      const g = sctx.createLinearGradient(a[0], a[1], b[0], b[1]);
      g.addColorStop(0, rgba(col, r.alpha * breathe)); g.addColorStop(0.5, rgba(col, r.alpha * breathe * 0.45)); g.addColorStop(1, rgba(col, 0));
      sctx.fillStyle = g; sctx.fill();
    }
  }
  if (c === 'thunderstorm') {
    for (const f of w.flashes) {
      const age = t - f.time;
      if (age < 0) break;
      if (age >= 0.45) continue;
      const env = age < 0.05 ? age / 0.05 : Math.max(0, 1 - (age - 0.05) / 0.40);   // all attack, slow decay
      const k = env * env * (0.72 + 0.28 * Math.sin(age * 78)) * f.strength;
      if (k <= 0.02) continue;
      softUsed = true;
      const [x, y] = surface(f.u, f.v);
      const r = W * 0.21;
      const g = sctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(235,245,255,${k})`); g.addColorStop(0.5, `rgba(148,191,255,${k * 0.45})`); g.addColorStop(1, 'rgba(148,191,255,0)');
      sctx.fillStyle = g; sctx.save(); sctx.translate(x, y); sctx.scale(1, 0.7); sctx.translate(-x, -y);
      ellipse(sctx, x, y, r, r); sctx.fill(); sctx.restore();
      if (k > 0.3) { sctx.fillStyle = `rgba(255,255,255,${k})`; ellipse(sctx, x, y, W * 0.10, W * 0.06); sctx.fill(); }
      ctx.fillStyle = `rgba(199,222,255,${k * 0.12})`; ctx.fillRect(0, 0, W, H);   // the strike lights the scene
    }
  }
  if (c === 'solarStorm') {
    softUsed = true;
    const pulse = 0.5 + 0.5 * Math.sin(t * 0.55);
    sctx.beginPath();
    let p0 = surface(0, 0); sctx.moveTo(p0[0], p0[1]);
    for (let uu = 0; uu <= 1.0001; uu += 0.02) { const p = surface(uu, 0); sctx.lineTo(p[0], p[1]); }
    for (let uu = 1; uu >= -0.0001; uu -= 0.02) { const p = surface(uu, 0.18); sctx.lineTo(p[0], p[1]); }
    sctx.closePath();
    const a = surface(0.5, 0), b = surface(0.5, 0.18);
    const g = sctx.createLinearGradient(a[0], a[1], b[0], b[1]);
    g.addColorStop(0, `rgba(255,148,66,${0.16 + 0.22 * pulse})`); g.addColorStop(1, 'rgba(255,148,66,0)');
    sctx.fillStyle = g; sctx.fill();
    for (const m of w.motes) {
      const [x, y] = surface(m.u, m.v);
      const al = (0.5 + 0.5 * Math.sin(t * m.rate + m.phase)) * 0.26;
      sctx.fillStyle = `rgba(255,107,184,${al})`;
      ellipse(sctx, x, y, m.size * u * 2, m.size * u); sctx.fill();
    }
  }
  if (c === 'cyclone') {
    const s = w.motes[0];
    if (s) {
      softUsed = true;
      const [cx, cy] = surface(s.u, s.v);
      const maxR = W * s.size, spin = s.angle * t * s.rate + s.phase, arms = 5;
      for (let a = 0; a < arms; a++) {
        for (let i = 0; i < 34; i++) {
          const f = 0.22 + (i / 33) * 0.78;
          const th = a * (Math.PI * 2 / arms) + f * 3.4 + spin;
          const r = maxR * f;
          const x = cx + Math.cos(th) * r, y = cy + Math.sin(th) * r * 0.68;
          const blob = maxR * (0.14 - f * 0.075);
          sctx.fillStyle = `rgba(255,255,255,${(1 - f) * 0.34})`;
          ellipse(sctx, x, y, blob, blob * 0.68); sctx.fill();
        }
      }
      const eye = maxR * 0.15;
      const g = sctx.createRadialGradient(cx, cy, eye * 0.5, cx, cy, eye * 2.1);
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.45, 'rgba(255,255,255,0)');
      g.addColorStop(0.75, 'rgba(255,255,255,0.75)'); g.addColorStop(1, 'rgba(255,255,255,0.1)');
      sctx.fillStyle = g; ellipse(sctx, cx, cy, eye * 2.1, eye * 1.45); sctx.fill();
    }
  }
  if (softUsed) {
    let layer = soft;
    if (FILTER_OK) {
      sctx2.setTransform(1, 0, 0, 1, 0, 0);
      sctx2.clearRect(0, 0, soft2.width, soft2.height);
      sctx2.filter = `blur(${(2.6 * u).toFixed(1)}px)`;   // about 10pt at full size
      sctx2.drawImage(soft, 0, 0);
      sctx2.filter = 'none';
      layer = soft2;
    }
    ctx.save();
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(layer, 0, 0, W, H);
    ctx.restore();
  }
  if (c === 'nightSide') {
    for (const m of w.motes) {
      const [x, y] = surface(m.u, m.v);
      const a = (0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * m.rate + m.phase))) * 0.8;
      const r = m.size * u;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r * 2.4);
      g.addColorStop(0, `rgba(255,204,122,${a * 0.5})`); g.addColorStop(1, 'rgba(255,204,122,0)');
      ctx.fillStyle = g; ellipse(ctx, x, y, r * 2.4, r * 2.4); ctx.fill();
      ctx.fillStyle = `rgba(255,240,204,${a})`; ellipse(ctx, x, y, r / 2, r / 2); ctx.fill();
    }
  }
  if (c === 'meteorShower') drawMeteors(w.motes, t);
  drawMeteors(w.strays, t);   // last, so a streak passes in front of the weather
}
function drawMeteors(set, t) {
  const travel = Math.hypot(W, H);
  for (const m of set) {
    const cycle = ((t / m.rate + m.phase) % 1 + 1) % 1;
    if (cycle >= 0.26) continue;                 // visible a quarter of the time: an event
    const p = cycle / 0.26;
    const dx = Math.cos(m.angle), dy = Math.sin(m.angle);
    const hx = m.u * W + dx * travel * p, hy = m.v * H + dy * travel * p;
    const fade = Math.max(0, 1 - (hy / H - 0.72) / 0.22);
    if (fade <= 0.01) continue;
    const len = m.length * u, tx = hx - dx * len, ty = hy - dy * len;
    const a = Math.sin(p * Math.PI) * fade;
    const g = ctx.createLinearGradient(tx, ty, hx, hy);
    g.addColorStop(0, 'rgba(199,230,255,0)'); g.addColorStop(1, `rgba(199,230,255,${a * 0.85})`);
    ctx.save();
    ctx.strokeStyle = g; ctx.lineWidth = m.size * u; ctx.lineCap = 'round';
    ctx.shadowColor = `rgba(199,230,255,${a * 0.6})`; ctx.shadowBlur = 4 * u;
    ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(hx, hy); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = `rgba(255,255,255,${a})`; ellipse(ctx, hx, hy, m.size * u, m.size * u); ctx.fill();
  }
}

// ------------------------------------------------------------------ game state
const state = {
  mode: 'gate',            // gate | intro | menu | cal | play | pause | over | err
  input: 'pointer',        // eyes | pointer | auto
  keysOverride: false,     // pointer play, but the keyboard is picking bands
  wave: 1, score: 0, integrity: 100, combo: 0, best: 0,
  invaders: [], debris: [], pending: [], waveElapsed: 0, runClock: 0,
  bandCount: 3, selectedBand: null, heldBand: null, bandDwell: 0, targetId: null,
  reacquire: 0, impactFlash: 0, banner: null, bannerT: 0, weather: null, overT: 0,
};
try { state.best = +(localStorage.getItem('qb.best') || 0); } catch {}
let nextId = 1;
const byId = (id) => state.invaders.find((v) => v.id === id) || null;

function rescaleWorld(sx, sy, newU) {
  const k = clamp(newU, 0.8, 1.7) / u;
  for (const v of state.invaders) {
    v.anchor.x *= sx; v.anchor.y *= sy; v.pos.x *= sx; v.pos.y *= sy;
    v.w = KIND[v.kind].w * clamp(newU, 0.8, 1.7); v.driftAmp *= k; v.vx *= k;
  }
  for (const d of state.debris) { d.x *= sx; d.y *= sy; }
}

// bands
function bandRange(i) {
  const top = H * BAND_TOP, h = (H * BAND_BOTTOM - top) / state.bandCount;
  return [top + h * i, top + h * (i + 1)];
}
const bandCentre = (i) => { const r = bandRange(i); return (r[0] + r[1]) / 2; };
function bandAt(y) {
  const top = H * BAND_TOP, bottom = H * BAND_BOTTOM;
  if (y < top || y > bottom) return null;
  return clamp(Math.floor(((y - top) / (bottom - top)) * state.bandCount), 0, state.bandCount - 1);
}
/* Once a band holds selection it keeps it until the aim moves a good way past the
 * boundary; a jittery signal near an edge would otherwise reset the lock every frame. */
function selectBand(t) {
  const n = state.bandCount;
  const raw = clamp(Math.floor(t * n), 0, n - 1);
  const cur = state.selectedBand;
  if (cur == null || raw === cur) return raw;
  const centre = (cur + 0.5) / n;
  return Math.abs(t - centre) > (1 / n) * (0.5 + HYSTERESIS) ? raw : cur;
}
const bandInterval = () => Math.max(5.5 - state.wave * 0.30, 1.8) * 3.0 / state.bandCount;

// ------------------------------------------------------------------ engine
function showBanner(text) { state.banner = text; state.bannerT = 2.0; }

function startRun() {
  Object.assign(state, {
    wave: 1, score: 0, integrity: 100, combo: 0, invaders: [], debris: [], pending: [],
    waveElapsed: 0, runClock: 0, selectedBand: null, heldBand: null, bandDwell: 0, targetId: null,
    reacquire: 0, impactFlash: 0, banner: null, bannerT: 0, overT: 0,
  });
  state.weather = makeWeather(pickCondition());
  $('hCond').textContent = CONDITIONS[state.weather.condition].short;
  const startWave = Math.max(1, parseInt(params.get('wave') || '1', 10) || 1);
  beginWave(startWave);
  state.mode = 'play';
  showScreen(null);
  stage.classList.toggle('is-pointer', state.input === 'pointer' && finePointer);
  startAmbient();
  lastT = 0;
}

function beginWave(n) {
  state.wave = n; state.waveElapsed = 0; state.pending = [];
  if (isBossWave(n)) {
    // exactly one boss; escorts keep the pressure on
    state.pending.push({ d: 0, kind: 'dread' });
    let d = 3.5;
    for (let i = 0; i < Math.min(Math.floor(n / 4), 4); i++) { state.pending.push({ d, kind: 'scout' }); d += rand(1.2, 2.2); }
    showBanner(`⚠  ${bossNameFor(n)}  INBOUND`);
    play('stinger');
  } else {
    const cap = Math.min(3 + n, 10);
    let d = 0;
    for (let i = 0; i < cap; i++) { state.pending.push({ d, kind: 'scout' }); d += rand(0.35, 1.1); }
    showBanner(n === 1 && state.weather ? CONDITIONS[state.weather.condition].title : `WAVE ${n}`);
    play('waveStart');
  }
}

function makeCores(count) {
  // laid out across the hull, alternating above and below its midline
  return Array.from({ length: count }, (_, i) => {
    const t = count === 1 ? 0.5 : i / (count - 1);
    return { ox: t * 1.3 - 0.65, oy: i % 2 === 0 ? -0.18 : 0.22, down: false, downT: 0 };
  });
}

function spawn(kind) {
  const sprite = pick(kind === 'scout' ? SCOUTS : DREADS);
  const w = KIND[kind].w * u;
  const lo = w * 0.5, hi = Math.max(lo, W - w * 0.5);
  // spread deliberately: take the candidate with the widest gap
  let x = rand(lo, hi), widest = -1;
  for (let i = 0; i < 12; i++) {
    const cand = rand(lo, hi);
    let gap = Infinity;
    for (const v of state.invaders) if (!v.collapsing) gap = Math.min(gap, Math.abs(v.pos.x - cand));
    if (gap > widest) { widest = gap; x = cand; }
    if (gap > w * 1.6) break;
  }
  const y = bandCentre(0);
  const inv = {
    id: nextId++, kind, sprite, w,
    anchor: { x, y }, pos: { x, y },
    vx: (Math.random() < 0.5 ? -1 : 1) * rand(14, 34) * u,
    band: 0, bandElapsed: rand(0, bandInterval() * 0.65),
    dwell: 0, collapsing: false, collapseT: 0, age: 0,
    phase: rand(0, Math.PI * 2),
    driftAmp: Math.min(20 + state.wave * 2.0, 54) * u,
    driftSpeed: Math.min(0.7 + state.wave * 0.08, 2.2),
    partner: null, bossName: null, cores: [],
  };
  if (kind === 'dread') {
    inv.bossName = bossNameFor(state.wave);
    inv.cores = makeCores(Math.min(3 + Math.floor(state.wave / 8), 6));
  }
  // entanglement from wave 3: pair with an unpaired hull already on the field
  if (state.wave >= 3 && Math.random() < 0.5) {
    const other = state.invaders.find((v) => !v.partner && !v.collapsing);
    if (other) { inv.partner = other.id; other.partner = inv.id; }
  }
  state.invaders.push(inv);
  play(kind === 'dread' ? 'bossArrive' : 'shipArrive');
}

function advanceBands(dt) {
  const interval = bandInterval();
  const breached = [];
  for (const v of state.invaders) {
    if (v.collapsing) continue;
    v.age += dt;
    v.bandElapsed += dt;
    const step = (v.kind === 'dread' ? interval * 2.4 : interval) / v.sprite.fall;
    if (v.bandElapsed >= step) {
      v.bandElapsed = 0; v.band++;
      if (v.band >= state.bandCount) { breached.push(v); continue; }
    }
    // lateral drift, bouncing inside the field: presentation only in band play
    v.anchor.x += v.vx * dt;
    const lo = v.w * 0.5, hi = W - v.w * 0.5;
    if (v.anchor.x < lo || v.anchor.x > hi) { v.vx = -v.vx; v.anchor.x = clamp(v.anchor.x, lo, hi); }
    // ease toward the band centre so a band change reads as a fall, not a jump
    v.anchor.y += (bandCentre(v.band) - v.anchor.y) * Math.min(dt * 4, 1);
    // superposition wobble, steadying as the lock builds
    v.phase += dt * v.driftSpeed * 2.0;
    const amp = v.driftAmp * (1 - v.dwell * 0.8);
    v.pos.x = v.anchor.x + Math.sin(v.phase) * amp;
    v.pos.y = v.anchor.y + Math.cos(v.phase * 0.7) * amp * 0.25;
  }
  separateWithinBands();
  if (!breached.length) return;
  const ids = new Set(breached.map((v) => v.id));
  state.invaders = state.invaders.filter((v) => !ids.has(v.id));
  for (const v of state.invaders) if (ids.has(v.partner)) v.partner = null;
  const damage = breached.reduce((s, v) => s + KIND[v.kind].damage, 0);
  state.integrity = Math.max(0, state.integrity - damage);
  state.combo = 0;
  state.impactFlash = 1;
  play('breach');
  if (state.integrity <= 35 && state.integrity > 0) play('critical');
  showBanner(`ATMOSPHERE BREACHED  −${damage}`);
  if (state.integrity <= 0) endRun();
}
/* nudge hulls sharing a band apart so they stay individually readable */
function separateWithinBands() {
  const live = state.invaders.filter((v) => !v.collapsing);
  for (let i = 0; i < live.length; i++) {
    for (let j = i + 1; j < live.length; j++) {
      const a = live[i], b = live[j];
      if (a.band !== b.band) continue;
      const dx = b.anchor.x - a.anchor.x, need = (a.w + b.w) * 0.5 * 0.92;
      if (Math.abs(dx) >= need) continue;
      const s = dx >= 0 ? 1 : -1, push = (need - Math.abs(dx)) * 0.12;
      a.anchor.x = clamp(a.anchor.x - s * push, a.w * 0.5, W - a.w * 0.5);
      b.anchor.x = clamp(b.anchor.x + s * push, b.w * 0.5, W - b.w * 0.5);
    }
  }
}

/* the hull in a band that is closest to dropping out of it */
function leadInvader(band) {
  const interval = bandInterval();
  let best = null, bestP = -1;
  for (const v of state.invaders) {
    if (v.collapsing || v.band !== band) continue;
    const p = v.bandElapsed / ((v.kind === 'dread' ? interval * 2.4 : interval) / v.sprite.fall);
    if (p > bestP) { bestP = p; best = v; }
  }
  return best;
}
function clearLock(dt, rate) {
  state.bandDwell = Math.max(0, state.bandDwell - dt / rate);
  state.targetId = null;
  for (const v of state.invaders) if (!v.collapsing) v.dwell = 0;
}
function buildLock(target, dt) {
  if (state.targetId !== target.id) { state.bandDwell = 0; play('lockStart'); }
  state.targetId = target.id;
  state.bandDwell = Math.min(1, state.bandDwell + dt / (dwellFor(target.kind, state.wave) * target.sprite.dwell));
  for (const v of state.invaders) if (!v.collapsing) v.dwell = v === target ? state.bandDwell : 0;
  if (state.bandDwell >= 1) { state.bandDwell = 0; lockComplete(target); }
}
function updateLock(dt) {
  const bandPlay = state.input === 'eyes' || state.input === 'auto' || state.keysOverride;
  if (state.reacquire > 0) { state.reacquire -= dt; clearLock(dt, 0.4); return; }
  if (bandPlay) {
    // nothing may be destroyed while the camera has lost the player
    if (state.input === 'eyes' && !track.live) { clearLock(dt, 0.4); return; }
    const band = state.selectedBand;
    if (band !== state.heldBand) state.bandDwell = 0;
    state.heldBand = band;
    const lead = band == null ? null : leadInvader(band);
    if (!lead) { clearLock(dt, 0.5); return; }
    buildLock(lead, dt);
    return;
  }
  // pointer play: the hull under the pointer, with magnetism and a sticky hold
  if (!ptr.active) { state.selectedBand = null; clearLock(dt, 0.5); return; }
  const forgive = Math.max(1.28 - (state.wave - 1) * 0.09, 1.0);
  const radius = (v) => Math.max(v.w * 0.70, 76 * u) * forgive;
  const dist = (v) => Math.hypot(ptr.x - v.pos.x, ptr.y - v.pos.y);
  let cur = byId(state.targetId);
  if (cur && (cur.collapsing || dist(cur) > radius(cur) * 1.5)) cur = null;
  if (!cur) {
    let bestD = Infinity;
    for (const v of state.invaders) {
      if (v.collapsing) continue;
      const d = dist(v);
      if (d < radius(v) && d < bestD) { bestD = d; cur = v; }
    }
  }
  if (!cur) { state.selectedBand = bandAt(ptr.y); clearLock(dt, 0.5); return; }
  state.selectedBand = cur.band;
  buildLock(cur, dt);
}
function lockComplete(v) {
  if (v.bossName) {
    // each completed lock knocks out one core; the hull goes with the last
    const core = v.cores.find((c) => !c.down);
    if (core) {
      core.down = true; core.downT = 0;
      state.score += 40; state.combo += 1;
      play('coreDown');
      const left = v.cores.filter((c) => !c.down).length;
      if (left > 0) { showBanner(`CORE DOWN — ${left} REMAIN`); state.reacquire = 0.25; return; }
    }
  }
  collapse(v);
}
function collapse(v) {
  if (v.collapsing) return;
  v.collapsing = true; v.collapseT = 0;
  state.combo += 1;
  state.score += KIND[v.kind].score * Math.max(1, Math.min(state.combo, 8));
  play(v.bossName ? 'bossFall' : 'collapse');
  shatter(v);
  state.reacquire = REACQUIRE; state.targetId = null; state.bandDwell = 0;
  if (v.partner) {
    const p = byId(v.partner);
    if (p && !p.collapsing) {
      // its partner is instantly displaced somewhere else on the field
      const m = p.w * 0.6, nx = rand(m, Math.max(m, W - m));
      p.anchor.x = nx; p.pos.x = nx; p.dwell = 0; p.partner = null;
      showBanner('SPOOKY ACTION AT A DISTANCE');
    }
    v.partner = null;
  }
}
/* break a hull into tumbling pieces of its own sprite (4x2: near-square chunks) */
function shatter(v) {
  const cols = 4, rows = 2, h = v.w * v.sprite.aspect;
  const pw = v.w / cols, ph = h / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const ox = ((c + 0.5) / cols) * v.w - v.w / 2, oy = ((r + 0.5) / rows) * h - h / 2;
      state.debris.push({
        sprite: v.sprite, sx: c / cols, sy: r / rows, sw: 1 / cols, sh: 1 / rows, w: pw, h: ph,
        x: v.pos.x + ox, y: v.pos.y + oy,
        vx: ox * rand(3.5, 6.5) + rand(-40, 40) * u, vy: oy * rand(3.5, 6.5) - rand(60, 170) * u,
        rot: rand(0, Math.PI * 2), spin: rand(-6, 6), life: rand(1.1, 1.7),
      });
    }
  }
  if (state.debris.length > 120) state.debris.splice(0, state.debris.length - 120);
}
function advanceCollapses(dt) {
  for (const v of state.invaders) {
    if (v.collapsing) v.collapseT += dt;
    for (const c of v.cores) if (c.down) c.downT += dt;
  }
  state.invaders = state.invaders.filter((v) => !(v.collapsing && v.collapseT >= 0.42));
}
function updateDebris(dt) {
  const g = 620 * u;
  for (const d of state.debris) { d.vy += g * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.rot += d.spin * dt; d.life -= dt; }
  state.debris = state.debris.filter((d) => d.life > 0 && d.y < H + 120);
}
function checkWaveComplete() {
  if (state.mode !== 'play' || state.invaders.length || state.pending.length) return;
  // surviving a wave repairs some of the surface
  state.integrity = Math.min(100, state.integrity + (isBossWave(state.wave) ? 18 : 7));
  beginWave(state.wave + 1);
}
function endRun() {
  state.mode = 'over';
  state.overT = 0.9;   // let the last explosion play out
  play('gameOver');
}
function showOver() {
  const newBest = state.score > state.best;
  if (newBest) { state.best = state.score; try { localStorage.setItem('qb.best', String(state.best)); } catch {} }
  $('overScore').textContent = state.score.toLocaleString();
  $('overWave').textContent = `HELD TO WAVE ${state.wave}`;
  $('overBest').hidden = !newBest;
  showScreen('over');
  stopAmbient();
  $('btnAgain').focus({ preventScroll: true });
}

function update(dt) {
  state.runClock += dt;
  state.waveElapsed += dt;
  while (state.pending.length && state.pending[0].d <= state.waveElapsed) spawn(state.pending.shift().kind);
  if (state.input === 'eyes') state.selectedBand = selectBand(track.aim);
  if (state.input === 'auto') autoPilot(dt);
  advanceBands(dt);
  if (state.mode !== 'play') return;
  updateLock(dt);
  advanceCollapses(dt);
  updateDebris(dt);
  state.impactFlash = Math.max(0, state.impactFlash - dt * 1.6);
  if (state.bannerT > 0) { state.bannerT -= dt; if (state.bannerT <= 0) state.banner = null; }
  checkWaveComplete();
}

// a stand-in player for unattended checks (?autoplay): looks at the most urgent band
let autoT = 0;
function autoPilot(dt) {
  autoT -= dt;
  if (autoT > 0) return;
  autoT = 0.35;
  let best = null, bestP = -1;
  const interval = bandInterval();
  for (const v of state.invaders) {
    if (v.collapsing) continue;
    const p = v.band + v.bandElapsed / ((v.kind === 'dread' ? interval * 2.4 : interval) / v.sprite.fall);
    if (p > bestP) { bestP = p; best = v; }
  }
  if (best) state.selectedBand = best.band;
}

// ------------------------------------------------------------------ rendering (GameView.swift)
function drawBands() {
  const n = state.bandCount;
  const names = n === 2 ? ['HIGH ORBIT', 'ATMOSPHERE'] : ['HIGH ORBIT', 'MID', 'ATMOSPHERE'];
  ctx.font = `700 ${9 * u}px ${MONO}`;
  ctx.textBaseline = 'top';
  for (let i = 0; i < n; i++) {
    const [y0, y1] = bandRange(i);
    const on = state.selectedBand === i;
    ctx.fillStyle = on ? rgba(CYAN, 0.10) : 'rgba(255,255,255,0.015)';
    ctx.fillRect(0, y0, W, y1 - y0);
    if (on && state.bandDwell > 0) {           // the lock fill sweeps across the band
      ctx.fillStyle = rgba(CYAN, 0.16);
      ctx.fillRect(0, y0, W * state.bandDwell, y1 - y0);
    }
    ctx.fillStyle = on ? rgba(CYAN, 0.55) : 'rgba(255,255,255,0.10)';
    ctx.fillRect(0, y0, W, 1);
    ctx.fillStyle = on ? rgba(CYAN, 1) : 'rgba(255,255,255,0.25)';
    ctx.fillText(names[i], 14 * u, y0 + 5 * u);
  }
}
function drawAtmosphere() {
  const lineY = H * ATMOS_Y, f = state.impactFlash;
  const g = ctx.createLinearGradient(0, lineY, 0, H);
  g.addColorStop(0, rgba(CYAN, 0.18 + f * 0.5)); g.addColorStop(0.5, rgba(RED, f * 0.35)); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, lineY, W, H - lineY);
  ctx.fillStyle = rgba(CYAN, 0.35 + f * 0.5); ctx.fillRect(0, lineY, W, 1.5);
}
function arc(x, y, r, from, to, color, width) {
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(x, y, r, from, to); ctx.stroke();
}
function drawInvader(v, bandPlay) {
  const { x, y } = v.pos;
  const h = v.w * v.sprite.aspect;
  const accent = v.partner ? PURPLE : CYAN;
  const born = Math.min(1, v.age / 0.35);
  if (v.collapsing) {                         // bloom ring as the hull goes
    const k = v.collapseT / 0.42, r = v.w * (0.5 + k * 1.4);
    ctx.strokeStyle = rgba(CYAN, (1 - k) * 0.6); ctx.lineWidth = 2.5;
    ellipse(ctx, x, y, r, r); ctx.stroke();
    return;
  }
  // the targeting ring: wide while nothing has a lock, tightening as one builds
  const spread = 1 - v.dwell;
  if (spread > 0.02) {
    const r = v.w * (0.62 + spread * 0.30);
    ctx.strokeStyle = rgba(accent, (0.10 + 0.16 * spread) * born); ctx.lineWidth = 1.2;
    ellipse(ctx, x, y, r, r * 0.55); ctx.stroke();
  }
  const img = v.sprite.img;
  if (img.complete && img.naturalWidth) {
    const s = 0.85 + 0.15 * born;
    ctx.globalAlpha = born;
    ctx.drawImage(img, x - (v.w * s) / 2, y - (h * s) / 2, v.w * s, h * s);
    ctx.globalAlpha = 1;
  }
  const r = v.w * 0.62;
  if (v.bossName) {
    for (const c of v.cores) drawCore(v, c);
    if (v.dwell > 0.001) arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * v.dwell, 'rgba(255,255,255,0.95)', 4);
  } else if (v.dwell > 0.001) {
    arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * v.dwell, 'rgba(255,255,255,0.95)', 3.5);
    const b = r * 1.16, arm = 9 * u;
    ctx.strokeStyle = rgba(CYAN, 0.85); ctx.lineWidth = 1.8; ctx.lineCap = 'butt';
    ctx.beginPath();
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      const cx = x + sx * b, cy = y + sy * b * 0.72;
      ctx.moveTo(cx - sx * arm, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx, cy - sy * arm);
    }
    ctx.stroke();
  }
  // in band play, mark which hull the band lock resolves to
  if (bandPlay && v.id === state.targetId) {
    const tr = v.w * 0.72, arm = tr * 0.42;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    ctx.beginPath();
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      const cx = x + sx * tr, cy = y + sy * tr * 0.62;
      ctx.moveTo(cx - sx * arm, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx, cy - sy * arm * 0.7);
    }
    ctx.stroke();
    ctx.font = `700 ${9 * u}px ${MONO}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText('TARGET', x, y - tr * 0.72 - 12 * u);
    ctx.textAlign = 'left';
  }
}
function drawCore(v, c) {
  const h = v.w * v.sprite.aspect;
  const x = v.pos.x + c.ox * v.w / 2, y = v.pos.y + c.oy * h / 2;
  if (c.down) {
    const t = Math.min(c.downT / 0.5, 1);
    if (t >= 1) return;
    const r = (14 + t * 34) * u;
    ctx.strokeStyle = rgba(ORANGE, 0.7 * (1 - t)); ctx.lineWidth = 2;
    ellipse(ctx, x, y, r, r); ctx.stroke();
    return;
  }
  const r = 13 * u;
  const g = ctx.createRadialGradient(x, y, 1, x, y, r);
  g.addColorStop(0, '#ffffff'); g.addColorStop(1, rgba(ORANGE, 0.5));
  ctx.fillStyle = g; ellipse(ctx, x, y, r, r); ctx.fill();
  ctx.strokeStyle = rgba(ORANGE, 0.9); ctx.lineWidth = 1.5; ctx.stroke();
}
function drawDebris() {
  for (const d of state.debris) {
    const img = d.sprite.img;
    if (!img.complete || !img.naturalWidth) continue;
    ctx.save();
    ctx.translate(d.x, d.y); ctx.rotate(d.rot);
    ctx.globalAlpha = Math.min(d.life / 0.45, 1);
    const iw = img.naturalWidth, ih = img.naturalHeight;
    ctx.drawImage(img, d.sx * iw, d.sy * ih, d.sw * iw, d.sh * ih, -d.w / 2, -d.h / 2, d.w, d.h);
    ctx.restore();
  }
}
function drawLinks() {
  const seen = new Set();
  ctx.save();
  ctx.setLineDash([5 * u, 7 * u]);
  ctx.strokeStyle = rgba(PURPLE, 0.35); ctx.lineWidth = 1.2;
  for (const v of state.invaders) {
    if (!v.partner || seen.has(v.id) || v.collapsing) continue;
    const p = byId(v.partner);
    if (!p || p.collapsing) continue;
    seen.add(v.id); seen.add(p.id);
    ctx.beginPath(); ctx.moveTo(v.pos.x, v.pos.y); ctx.lineTo(p.pos.x, p.pos.y); ctx.stroke();
  }
  ctx.restore();
}
function drawReticle() {
  if (state.input !== 'pointer' || state.keysOverride || !ptr.active || !ptr.mouse) return;
  // the iPhone's gaze reticle, made solid enough to read over a saucer for mouse play
  const r = 14 * u;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 3;
  ctx.strokeStyle = rgba(RED, 0.9); ctx.lineWidth = 2;
  ellipse(ctx, ptr.x, ptr.y, r, r); ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = rgba(RED, 0.85); ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(ptr.x - 5 * u, ptr.y); ctx.lineTo(ptr.x + 5 * u, ptr.y);
  ctx.moveTo(ptr.x, ptr.y - 5 * u); ctx.lineTo(ptr.x, ptr.y + 5 * u);
  ctx.stroke();
}
function render() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, W, H);
  if (!state.weather) return;
  const t = state.runClock;
  drawWeather(state.weather, t);
  drawBands();
  drawAtmosphere();
  drawDebris();
  drawLinks();
  const bandPlay = state.input !== 'pointer' || state.keysOverride;
  for (const v of state.invaders) drawInvader(v, bandPlay);
  drawReticle();
  // scrim behind the HUD only, so readouts stay legible over a bright hull
  const g = ctx.createLinearGradient(0, 0, 0, 215 * u);
  g.addColorStop(0, 'rgba(0,0,0,0.8)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, 215 * u);
}

// HUD: only touch the DOM when something changed
const hudCache = {};
function setText(id, val) { if (hudCache[id] !== val) { hudCache[id] = val; $(id).textContent = val; } }
function syncHUD() {
  setText('hWave', String(state.wave));
  setText('hScore', state.score.toLocaleString());
  const m = Math.min(state.combo, 8);
  setText('hScoreLbl', m > 1 ? `SCORE  ×${m}` : 'SCORE');
  $('hScoreLbl').classList.toggle('is-combo', m > 1);
  const bar = $('hInteg');
  const iw = `${state.integrity}%`;
  if (hudCache.integ !== iw) { hudCache.integ = iw; bar.style.width = iw; }
  bar.className = state.integrity < 25 ? 'crit' : state.integrity < 55 ? 'warn' : '';
  const boss = state.invaders.find((v) => v.bossName && !v.collapsing);
  $('hBoss').hidden = !boss;
  if (boss) {
    const left = boss.cores.filter((c) => !c.down).length;
    setText('hBossName', boss.bossName);
    setText('hBossCores', `${left} CORES`);
    $('hBossBar').style.width = `${(left / boss.cores.length) * 100}%`;
  }
  const b = $('hBanner');
  if (state.banner) { if (b.hidden || b.textContent !== state.banner) { b.textContent = state.banner; b.hidden = false; } }
  else if (!b.hidden) b.hidden = true;
  $('trackLost').hidden = !(state.input === 'eyes' && state.mode === 'play' && !track.live);
}

// ------------------------------------------------------------------ loop
let lastT = 0;
function frame(ts) {
  requestAnimationFrame(frame);
  if (!lastT) lastT = ts;
  const dt = Math.min(0.05, (ts - lastT) / 1000);
  lastT = ts;
  if (state.mode === 'play') {
    update(dt);
  } else if (state.mode === 'over' && state.overT > 0) {
    // the final explosion plays out before the summary
    advanceCollapses(dt); updateDebris(dt);
    state.impactFlash = Math.max(0, state.impactFlash - dt * 1.6);
    state.overT -= dt;
    if (state.overT <= 0) showOver();
  }
  if (state.mode === 'play' || state.mode === 'pause' || (state.mode === 'over' && state.overT > 0)) {
    render();
    if (state.mode === 'play') syncHUD();
  }
}

// ------------------------------------------------------------------ pointer and keys
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
const ptr = { x: 0, y: 0, active: false, mouse: false, lastX: 0, lastY: 0 };
function ptrPos(e) {
  const r = canvas.getBoundingClientRect();
  ptr.x = e.clientX - r.left; ptr.y = e.clientY - r.top;
}
canvas.addEventListener('pointermove', (e) => {
  ptrPos(e);
  ptr.mouse = e.pointerType === 'mouse';
  if (ptr.mouse) ptr.active = true;
  if (state.keysOverride && Math.hypot(ptr.x - ptr.lastX, ptr.y - ptr.lastY) > 12) state.keysOverride = false;
  if (state.mode === 'play') e.preventDefault();
}, { passive: false });
canvas.addEventListener('pointerdown', (e) => {
  ptrPos(e); ptr.mouse = e.pointerType === 'mouse'; ptr.active = true; state.keysOverride = false;
  try { canvas.setPointerCapture(e.pointerId); } catch {}
  e.preventDefault();
}, { passive: false });
const ptrUp = (e) => { if (e.pointerType !== 'mouse') ptr.active = false; };
canvas.addEventListener('pointerup', ptrUp);
canvas.addEventListener('pointercancel', () => { ptr.active = false; });
canvas.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') ptr.active = false; });

window.addEventListener('keydown', (e) => {
  const k = e.key;
  if (k === 'm' || k === 'M') { setMuted(!audio.muted); return; }
  if (state.mode === 'play' && (k === 'p' || k === 'P' || k === 'Escape')) { pauseGame(); e.preventDefault(); return; }
  if (state.mode === 'pause' && (k === 'p' || k === 'P' || k === 'Escape')) { resumeGame(); e.preventDefault(); return; }
  if (state.mode !== 'play' || state.input === 'eyes') return;
  const n = state.bandCount;
  let band = null;
  if (k === 'ArrowUp' || k === 'w' || k === 'W') band = Math.max(0, (state.selectedBand ?? 1) - 1);
  else if (k === 'ArrowDown' || k === 's' || k === 'S') band = Math.min(n - 1, (state.selectedBand ?? 0) + 1);
  else if (/^[1-3]$/.test(k) && +k <= n) band = +k - 1;
  if (band == null) return;
  e.preventDefault();
  state.keysOverride = true; ptr.lastX = ptr.x; ptr.lastY = ptr.y;
  state.selectedBand = band;
});

// ------------------------------------------------------------------ eyes: MediaPipe, calibrated per player
/* One Euro filter: smooths hard when the aim is still, lets fast moves through. */
class OneEuro {
  constructor(minCutoff, beta, dCutoff) { this.minCutoff = minCutoff; this.beta = beta; this.dCutoff = dCutoff; this.x = null; this.dx = 0; this.t = 0; }
  static alpha(cutoff, dt) { const tau = 1 / (2 * Math.PI * cutoff); return 1 / (1 + tau / dt); }
  filter(v, t) {
    if (this.x == null) { this.x = v; this.t = t; return v; }
    const dt = Math.max(1e-3, t - this.t); this.t = t;
    const dx = (v - this.x) / dt;
    this.dx += OneEuro.alpha(this.dCutoff, dt) * (dx - this.dx);
    const cutoff = this.minCutoff + this.beta * Math.abs(this.dx);
    this.x += OneEuro.alpha(cutoff, dt) * (v - this.x);
    return this.x;
  }
}
const track = {
  landmarker: null, stream: null, live: false, lastFace: 0, lastVideoT: -1,
  head: 0, eye: 0, aim: 0.5, map: null, filter: new OneEuro(1.2, 2.0, 1.0),
  cal: null,
};
function blend(cats, name) { const c = cats.find((x) => x.categoryName === name); return c ? c.score : 0; }

async function startEyes() {
  state.input = 'eyes';
  $('calTitle').textContent = 'STARTING CAMERA';
  $('calMsg').textContent = 'Allow camera access when your browser asks.';
  $('calCount').textContent = '';
  $('calArc').style.strokeDashoffset = '327';
  $('btnCalSkip').hidden = true;
  state.mode = 'cal';
  showScreen('cal');
  if (!track.stream) {
    try {
      track.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
    } catch (e) {
      return camFail(/NotAllowed|Permission|Security/i.test(String((e && e.name) || e))
        ? 'Camera access was declined, so eye control cannot start. You can still play with touch or the mouse.'
        : 'No camera was found on this device. You can still play with touch or the mouse.');
    }
    cam.srcObject = track.stream;
    await cam.play().catch(() => {});
  }
  // the preview inside the calibration ring
  const preview = $('calCam');
  if (!preview.firstChild) {
    const v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.autoplay = true; v.srcObject = track.stream;
    preview.appendChild(v); v.play().catch(() => {});
  }
  if (!track.landmarker) {
    $('calMsg').textContent = 'Loading face tracking…';
    try {
      const vision = await import(`${MP_URL}/vision_bundle.mjs`);
      const files = await vision.FilesetResolver.forVisionTasks(`${MP_URL}/wasm`);
      const opts = (delegate) => ({
        baseOptions: { modelAssetPath: MP_MODEL, delegate },
        runningMode: 'VIDEO', numFaces: 1,
        outputFaceBlendshapes: true, outputFacialTransformationMatrixes: true,
      });
      try { track.landmarker = await vision.FaceLandmarker.createFromOptions(files, opts('GPU')); }
      catch { track.landmarker = await vision.FaceLandmarker.createFromOptions(files, opts('CPU')); }
    } catch {
      return camFail('Face tracking could not load in this browser. You can still play with touch or the mouse.');
    }
    camLoop();
  }
  beginCalibration();
}
function camFail(msg) {
  $('errMsg').textContent = msg;
  state.mode = 'err';
  showScreen('err');
}
function camLoop() {
  requestAnimationFrame(camLoop);
  if (!track.landmarker || cam.readyState < 2 || cam.currentTime === track.lastVideoT) {
    if (performance.now() - track.lastFace > 400) track.live = false;
    return;
  }
  track.lastVideoT = cam.currentTime;
  let res;
  try { res = track.landmarker.detectForVideo(cam, performance.now()); } catch { return; }
  const mats = res && res.facialTransformationMatrixes;
  const shapes = res && res.faceBlendshapes;
  if (!mats || !mats.length) {
    if (performance.now() - track.lastFace > 400) track.live = false;
    return;
  }
  track.lastFace = performance.now(); track.live = true;
  const m = mats[0].data;
  track.head = Math.asin(clamp(-m[9], -1, 1));   // forward vector's vertical component
  if (shapes && shapes.length) {
    const c = shapes[0].categories;
    track.eye = (blend(c, 'eyeLookDownLeft') + blend(c, 'eyeLookDownRight')) / 2
              - (blend(c, 'eyeLookUpLeft') + blend(c, 'eyeLookUpRight')) / 2;
  }
  if (track.cal && track.cal.collecting) track.cal.samples.push({ h: track.head, e: track.eye });
  if (track.map) {
    const mp = track.map;
    let a;
    if (mp.wH + mp.wE > 0) {
      const aH = (track.head - mp.hU) / (mp.hD - mp.hU), aE = (track.eye - mp.eU) / (mp.eD - mp.eU);
      a = (mp.wH * aH + mp.wE * aE) / (mp.wH + mp.wE);
    } else {
      a = 0.5 + (track.head - mp.neutral) / (2 * 0.13);
    }
    a = clamp(0.5 + (a - 0.5) * 1.15, 0, 1);   // nobody plays at the extremes they calibrated at
    track.aim = clamp(track.filter.filter(a, performance.now() / 1000), 0, 1);
  }
}

/* Look up, then down. Head and eyes are measured separately and each one's share of the
 * aim is set by how cleanly it separated the two holds. The measured travel IS the
 * gearing: shipping one person's range to everyone was the iPhone game's biggest lesson. */
function beginCalibration() {
  const cal = { stage: -1, t: 0, collecting: false, samples: [], up: null, down: null, waitFace: 0 };
  track.cal = cal;
  setTimeout(() => { if (track.cal === cal) $('btnCalSkip').hidden = false; }, 3000);
  nextCalStage();
}
function nextCalStage() {
  const cal = track.cal;
  cal.stage++; cal.t = 0; cal.samples = []; cal.collecting = false;
  const up = cal.stage === 0;
  $('calTitle').textContent = up ? 'LOOK UP' : 'LOOK DOWN';
  $('calMsg').textContent = up
    ? 'Tip your head and eyes up toward HIGH ORBIT, at the top of the screen, and hold.'
    : 'Now down toward the ATMOSPHERE, at the bottom, and hold.';
  requestAnimationFrame(calTick);
}
let calLast = 0;
function calTick(ts) {
  const cal = track.cal;
  if (!cal || state.mode !== 'cal') return;
  const dt = calLast ? Math.min(0.05, (ts - calLast) / 1000) : 0;
  calLast = ts;
  const dur = 2.2;
  if (!track.live) {
    cal.collecting = false;
    $('calCount').textContent = '';
    $('calMsg').textContent = 'Looking for your face… sit facing the screen in good light.';
    requestAnimationFrame(calTick);
    return;
  }
  if (!cal.collecting) {
    cal.collecting = true;
    $('calMsg').textContent = cal.stage === 0
      ? 'Tip your head and eyes up toward HIGH ORBIT, at the top of the screen, and hold.'
      : 'Now down toward the ATMOSPHERE, at the bottom, and hold.';
  }
  cal.t += dt;
  const k = Math.min(1, cal.t / dur);
  $('calArc').style.strokeDashoffset = String(327 * (1 - k));
  $('calCount').textContent = String(Math.max(1, Math.ceil((1 - k) * dur)));
  if (k < 1) { requestAnimationFrame(calTick); return; }
  // keep the steady part of the hold: drop the first third while the player settles
  const held = cal.samples.slice(Math.floor(cal.samples.length / 3));
  if (cal.stage === 0) { cal.up = held; calLast = 0; nextCalStage(); return; }
  cal.down = held;
  finishCalibration(cal);
}
const median = (a) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };
const iqr = (a) => { if (a.length < 4) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length * 0.75)] - s[Math.floor(s.length * 0.25)]; };
function finishCalibration(cal) {
  cal.collecting = false; track.cal = null; calLast = 0;
  const upH = cal.up.map((s) => s.h), dnH = cal.down.map((s) => s.h);
  const upE = cal.up.map((s) => s.e), dnE = cal.down.map((s) => s.e);
  const hU = median(upH), hD = median(dnH), eU = median(upE), eD = median(dnE);
  const spanH = Math.abs(hD - hU), spanE = Math.abs(eD - eU);
  const rH = spanH / ((iqr(upH) + iqr(dnH)) / 2 + 0.004);   // separation over noise
  const rE = spanE / ((iqr(upE) + iqr(dnE)) / 2 + 0.02);
  const wH = spanH > 0.02 ? rH : 0, wE = spanE > 0.06 ? rE : 0;
  track.map = { hU, hD, eU, eD, wH, wE, neutral: (hU + hD) / 2 };
  track.filter = new OneEuro(1.2, 2.0, 1.0);
  // a weak signal gets fewer, bigger targets
  state.bandCount = Math.max(rH * (wH > 0), rE * (wE > 0)) >= 5 ? 3 : 2;
  afterCalibration();
}
function skipCalibration() {
  track.cal = null; calLast = 0;
  track.map = { hU: 0, hD: 0, eU: 0, eD: 0, wH: 0, wE: 0, neutral: track.head };
  state.bandCount = 2;
  afterCalibration();
}
function afterCalibration() {
  $('calTitle').textContent = 'READY';
  $('calMsg').textContent = state.bandCount === 3
    ? 'Three bands. Look at a band and hold your focus on it.'
    : 'Two bands, so each target is bigger. Look at a band and hold your focus on it.';
  $('calCount').textContent = '';
  $('calArc').style.strokeDashoffset = '0';
  setTimeout(() => {
    if (resumeAfterCal) {
      resumeAfterCal = false;
      for (const v of state.invaders) v.band = Math.min(v.band, state.bandCount - 1);
      state.selectedBand = null; state.heldBand = null; state.bandDwell = 0;
      state.mode = 'play'; showScreen(null); lastT = 0;
    }
    else startRun();
  }, 900);
}
let resumeAfterCal = false;

// ------------------------------------------------------------------ flow
function pauseGame() {
  if (state.mode !== 'play') return;
  state.mode = 'pause';
  $('btnRecal').hidden = state.input !== 'eyes';
  showScreen('pause');
  $('btnResume').focus({ preventScroll: true });
}
function resumeGame() {
  if (state.mode !== 'pause') return;
  state.mode = 'play'; showScreen(null); lastT = 0;
}
function toMenu() {
  state.mode = 'menu';
  stopAmbient();
  $('bestVal').textContent = state.best.toLocaleString();
  $('menuBest').hidden = !(state.best > 0);
  $('btnPointer').textContent = finePointer ? 'PLAY WITH MOUSE' : 'PLAY WITH TOUCH';
  $('btnErrPointer').textContent = finePointer ? 'PLAY WITH THE MOUSE INSTEAD' : 'PLAY WITH TOUCH INSTEAD';
  $('keyHint').hidden = !finePointer;
  showScreen('menu');
}
function startPointer() { state.input = 'pointer'; state.bandCount = 3; state.keysOverride = false; startRun(); }

let introTimers = [];
function playIntro() {
  state.mode = 'intro';
  showScreen('intro');
  $('introTitle').classList.remove('is-on');
  $('btnSkip').hidden = true;
  introVid.currentTime = 0;
  introVid.volume = 1; introVid.muted = audio.muted;
  narration.currentTime = 0; narration.volume = 0.45; narration.muted = audio.muted;
  introVid.play().catch(() => {});
  narration.play().catch(() => {});
  // the reel leads the first 3.9s, then the narrator; the reel returns once they finish
  introTimers = [
    setTimeout(() => { $('btnSkip').hidden = false; }, 500),
    setTimeout(() => { narration.volume = 1; introVid.volume = 0.45; }, 3900),
    setTimeout(() => { introVid.volume = 1; }, ((narration.duration || 12.1) + 0.4) * 1000),
    setTimeout(() => { $('introTitle').classList.add('is-on'); }, 15000),
  ];
}
function endIntro() {
  if (state.mode !== 'intro') return;
  introTimers.forEach(clearTimeout);
  introVid.pause(); narration.pause();
  toMenu();
}
introVid.addEventListener('ended', endIntro);

$('btnBegin').addEventListener('click', () => {
  unlockAudio();
  sky.play().catch(() => {});
  if (params.has('skipintro')) toMenu(); else playIntro();
});
$('btnSkip').addEventListener('click', endIntro);
$('btnEyes').addEventListener('click', () => { unlockAudio(); startEyes(); });
$('btnPointer').addEventListener('click', () => { unlockAudio(); startPointer(); });
$('btnSound').addEventListener('click', () => setMuted(!audio.muted));
$('btnCalSkip').addEventListener('click', skipCalibration);
$('btnPause').addEventListener('click', pauseGame);
$('btnResume').addEventListener('click', resumeGame);
$('btnRecal').addEventListener('click', () => { resumeAfterCal = true; startEyes(); });
$('btnQuit').addEventListener('click', toMenu);
$('btnMenu').addEventListener('click', toMenu);
$('btnAgain').addEventListener('click', () => { if (state.input === 'eyes') startRun(); else startPointer(); });
$('btnErrPointer').addEventListener('click', startPointer);
$('btnErrMenu').addEventListener('click', toMenu);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { pauseGame(); if (state.mode === 'intro') { introVid.pause(); narration.pause(); } }
});

// ------------------------------------------------------------------ boot
resize();
setMuted(audio.muted);
if (finePointer) $('btnBegin').textContent = 'CLICK TO BEGIN';
requestAnimationFrame(frame);
sky.play().catch(() => {});   // muted, so browsers allow it before any tap
if (params.has('autoplay')) {
  // unattended check: no tap, no camera, a stand-in player picks bands
  state.input = 'auto';
  startRun();
} else if (params.get('screen') === 'menu') {
  toMenu();
} else if (params.get('screen') === 'over') {   // layout check only
  state.score = 2525; state.wave = 8; state.best = 0; showOver();
} else if (params.get('screen') === 'cal') {    // layout check only
  state.mode = 'cal'; showScreen('cal');
  $('calTitle').textContent = 'LOOK UP'; $('calCount').textContent = '2';
  $('calMsg').textContent = 'Tip your head and eyes up toward HIGH ORBIT, at the top of the screen, and hold.';
  $('calArc').style.strokeDashoffset = '140';
}

/* For testing without a camera or a real pointer. */
window.__qb = {
  state: () => ({
    mode: state.mode, input: state.input, wave: state.wave, score: state.score, integrity: state.integrity,
    combo: state.combo, bandCount: state.bandCount, selected: state.selectedBand, weather: state.weather && state.weather.condition,
    invaders: state.invaders.map((v) => ({ kind: v.kind, band: v.band, dwell: +v.dwell.toFixed(2), boss: v.bossName, x: Math.round(v.pos.x), y: Math.round(v.pos.y), dying: v.collapsing })),
    banner: state.banner, aim: track.aim, live: track.live,
  }),
  setBand: (b) => { state.keysOverride = true; state.selectedBand = b; },
  wave: (n) => { state.invaders = []; state.pending = []; beginWave(n); },
};
