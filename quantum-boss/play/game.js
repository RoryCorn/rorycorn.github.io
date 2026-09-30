/* Quantum Boss — free web version.
 *
 * A port of the native iOS game's band mode. The native app reads the TrueDepth
 * depth sensor through ARKit; the browser has no equivalent, so head pitch comes
 * from MediaPipe Face Landmarker running locally on the device. Nothing is
 * uploaded — there is no server here at all.
 *
 * The band design is what makes this portable: it only ever needs coarse VERTICAL
 * selection, which is the one axis a webcam can supply reliably. Constants below
 * are lifted from the native QuantumGameEngine so the feel matches.
 */

const MP_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';

// ---------------------------------------------------------------- tuning
const BAND_TOP = 0.22;          // stack spans 22%..68% of height, as on device
const BAND_BOTTOM = 0.68;
const HYSTERESIS = 0.22;        // fraction of a band height; stops boundary flicker
const TRAFFIC_CAP = 10;
const NEUTRAL_WINDOW = 8000;    // ms of rolling-median neutral — cannot saturate
const DEFAULT_REACH = 0.13;     // rad of pitch travel assumed before calibration
const WEB_WAVE_CAP = 8;         // free version: bosses at 4 and 8, then it's a win

const KIND = {
  scout:      { w: 82,  damage: 8,  score: 20, sprites: ['scout_a', 'scout_b', 'scout_c'] },
  dreadnought:{ w: 148, damage: 22, score: 75, sprites: ['dread_a'] },
};
const dwellFor = (kind, wave) => {
  const n = Math.max(wave - 1, 0);
  return kind === 'scout'
    ? 0.50 + Math.min(n * 0.045, 0.52)
    : 0.85 + Math.min(n * 0.020, 0.28);
};
const isBossWave = (w) => w % 4 === 0;

// ---------------------------------------------------------------- dom
const $ = (id) => document.getElementById(id);
const canvas = $('stage'), ctx = canvas.getContext('2d');
const screens = {
  title: $('screenTitle'), cal: $('screenCal'), over: $('screenOver'), err: $('screenErr'),
};
const show = (name) => {
  for (const k in screens) screens[k].hidden = (k !== name);
  $('hud').hidden = (name !== null);
  if (name === null) for (const k in screens) screens[k].hidden = true;
};

// ---------------------------------------------------------------- state
let W = 0, H = 0, DPR = 1;
let sprites = {}, sounds = {};
let mode = 'touch';             // 'head' | 'touch'
let bandCount = 3;
let running = false, lastT = 0;

const game = {
  wave: 1, score: 0, integrity: 100, combo: 0,
  invaders: [], debris: [], bandPhase: 0, spawnLeft: 0,
  selected: -1, lockBand: -1, shake: 0, flash: 0,
};

// aim, 0 (top of stack) .. 1 (bottom)
let aim = 0.5, aimSmooth = 0.5;
const neutral = [];             // {t, pitch} rolling window
let reach = DEFAULT_REACH;
let faceSeen = false, lastFaceT = 0;

// ---------------------------------------------------------------- boot
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
window.addEventListener('resize', resize);
resize();

function loadImage(name) {
  return new Promise((res) => {
    const i = new Image();
    i.onload = () => res([name, i]);
    i.onerror = () => res([name, null]);
    i.src = `assets/${name}.png`;
  });
}
function loadSound(name, file) {
  const a = new Audio(`assets/${file}`);
  a.preload = 'auto'; a.volume = 0.5;
  sounds[name] = a;
}
function play(name) {
  const a = sounds[name];
  if (!a) return;
  try { const c = a.cloneNode(); c.volume = a.volume; c.play().catch(() => {}); } catch {}
}

(async function preload() {
  const names = ['scout_a', 'scout_b', 'scout_c', 'dread_a'];
  const pairs = await Promise.all(names.map(loadImage));
  for (const [n, img] of pairs) sprites[n] = img;
  loadSound('boom', 'boom.mp3');
  loadSound('breach', 'breach.mp3');
  loadSound('core', 'core.m4a');
  const best = +(localStorage.getItem('qb.best') || 0);
  if (best > 0) { $('bestVal').textContent = best.toLocaleString(); $('bestLine').hidden = false; }
})();

// ---------------------------------------------------------------- bands
function bandRects() {
  const top = H * BAND_TOP, bottom = H * BAND_BOTTOM;
  const h = (bottom - top) / bandCount;
  const out = [];
  for (let i = 0; i < bandCount; i++) out.push({ y: top + i * h, h });
  return out;
}
function bandLabels() {
  return bandCount === 2 ? ['HIGH ORBIT', 'ATMOSPHERE'] : ['HIGH ORBIT', 'MID', 'ATMOSPHERE'];
}
/* Hysteresis: once a band holds selection it keeps it until the aim moves a good
 * fraction past the boundary. Without this, a jittery signal near an edge flickers
 * between bands and resets the dwell lock every few frames. */
function selectBand(t) {
  const raw = Math.min(bandCount - 1, Math.max(0, Math.floor(t * bandCount)));
  if (game.selected < 0) return raw;
  if (raw === game.selected) return raw;
  const bandH = 1 / bandCount;
  const centre = (game.selected + 0.5) * bandH;
  const dist = Math.abs(t - centre);
  return dist > bandH * (0.5 + HYSTERESIS) ? raw : game.selected;
}

// ---------------------------------------------------------------- head tracking
let landmarker = null, rafCam = 0;

async function startHeadTracking() {
  const video = $('cam');
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false,
    });
  } catch (e) {
    return fail(e && /NotAllowed|Permission/i.test(String(e.name || e))
      ? 'Camera permission was declined. You can still play with touch.'
      : 'No camera was available on this device.');
  }
  video.srcObject = stream;
  video.hidden = false;
  await video.play().catch(() => {});

  try {
    const vision = await import(`${MP_URL}/vision_bundle.mjs`);
    const files = await vision.FilesetResolver.forVisionTasks(`${MP_URL}/wasm`);
    landmarker = await vision.FaceLandmarker.createFromOptions(files, {
      baseOptions: {
        modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numFaces: 1,
      outputFacialTransformationMatrixes: true,
    });
  } catch (e) {
    return fail('Face tracking could not load. Your browser may not support it.');
  }

  mode = 'head';
  $('camDot').hidden = false;
  pumpCamera();
  beginCalibration();

  function fail(msg) {
    $('errMsg').textContent = msg;
    show('err');
    try { if (stream) stream.getTracks().forEach((t) => t.stop()); } catch {}
  }
}

/* Pitch out of the 4x4 facial transformation matrix (column-major). */
function pitchFrom(matrix) {
  const m = matrix;
  // forward vector's vertical component -> pitch, bounded and always defined
  return Math.asin(Math.max(-1, Math.min(1, -m[9])));
}

function pumpCamera() {
  const video = $('cam');
  const step = () => {
    rafCam = requestAnimationFrame(step);
    if (!landmarker || video.readyState < 2) return;
    let res;
    try { res = landmarker.detectForVideo(video, performance.now()); } catch { return; }
    const mats = res && res.facialTransformationMatrixes;
    if (!mats || !mats.length) {
      if (performance.now() - lastFaceT > 900) { faceSeen = false; $('camDot').classList.add('lost'); }
      return;
    }
    faceSeen = true; lastFaceT = performance.now();
    $('camDot').classList.remove('lost');
    const pitch = pitchFrom(mats[0].data);

    /* Rolling-median neutral over ~8s. A fixed neutral captured once drifts as the
     * player settles, and on device that drift saturated the aim sevenfold. A median
     * cannot saturate, needs no explicit recentre, and self-recovers. */
    const now = performance.now();
    neutral.push({ t: now, p: pitch });
    while (neutral.length && now - neutral[0].t > NEUTRAL_WINDOW) neutral.shift();
    const sorted = neutral.map((n) => n.p).sort((a, b) => a - b);
    const mid = sorted.length ? sorted[sorted.length >> 1] : pitch;

    if (calibrating) { calSample(pitch); return; }
    const offset = pitch - mid;
    aim = Math.min(1, Math.max(0, 0.5 + offset / (reach * 2)));
  };
  step();
}

// ---------------------------------------------------------------- calibration
let calibrating = false, calStage = 0, calT = 0, calSamples = [], calHi = null, calLo = null;

function beginCalibration() {
  calibrating = true; calStage = 0; calT = 0; calSamples = [];
  show('cal');
  calPrompt();
  requestAnimationFrame(calTick);
}
function calPrompt() {
  const top = calStage === 0;
  $('calTitle').textContent = top ? 'Look UP' : 'Look DOWN';
  $('calMsg').textContent = top
    ? 'Tip your chin up toward the top of the screen and hold.'
    : 'Now tip your chin down toward the bottom and hold.';
}
function calSample(p) { calSamples.push(p); }
function calTick(ts) {
  if (!calibrating) return;
  if (!calT) calT = ts;
  const dur = 2200;
  const k = Math.min(1, (ts - calT) / dur);
  $('calArc').style.strokeDashoffset = String(327 * (1 - k));
  $('calCount').textContent = String(Math.max(1, Math.ceil((1 - k) * (dur / 1000))));
  if (k >= 1) {
    const sorted = calSamples.slice().sort((a, b) => a - b);
    const med = sorted.length ? sorted[sorted.length >> 1] : 0;
    if (calStage === 0) { calHi = med; calStage = 1; calT = 0; calSamples = []; calPrompt(); }
    else { calLo = med; return finishCalibration(); }
  }
  requestAnimationFrame(calTick);
}
/* The measured travel IS the gearing. Shipping one person's range to everyone is the
 * single biggest failure mode: double their range and only the outer bands are
 * reachable; half of it and they never leave the middle. */
function finishCalibration() {
  calibrating = false;
  const span = Math.abs((calHi ?? 0) - (calLo ?? 0));
  if (span > 0.04) {
    reach = span / 2;
    bandCount = span >= 0.16 ? 3 : 2;   // weak signal -> fewer, bigger targets
  } else {
    reach = DEFAULT_REACH; bandCount = 2;
  }
  neutral.length = 0;
  startGame();
}

// ---------------------------------------------------------------- touch aim
function touchAim(e) {
  if (mode !== 'touch' || !running) return;
  const y = (e.touches ? e.touches[0].clientY : e.clientY);
  const top = H * BAND_TOP, bottom = H * BAND_BOTTOM;
  aim = Math.min(1, Math.max(0, (y - top) / (bottom - top)));
  e.preventDefault();
}
canvas.addEventListener('pointermove', touchAim, { passive: false });
canvas.addEventListener('pointerdown', touchAim, { passive: false });
canvas.addEventListener('touchmove', touchAim, { passive: false });

// ---------------------------------------------------------------- spawning
function bandInterval() {
  const perBand = Math.max(5.5 - game.wave * 0.30, 1.8);
  return perBand * 3.0 / bandCount;
}
function waveSize(w) { return isBossWave(w) ? 1 : Math.min(3 + Math.floor(w * 0.8), TRAFFIC_CAP); }

function spawn(kind) {
  const k = KIND[kind];
  const name = k.sprites[(Math.random() * k.sprites.length) | 0];
  const scale = Math.min(1, W / 430);
  game.invaders.push({
    kind, sprite: name,
    x: 0.12 + Math.random() * 0.76,
    drift: (Math.random() * 2 - 1) * 0.035,
    band: 0,
    // stagger, or a wave arrives as one overlapping clump
    bandElapsed: Math.random() * bandInterval() * 0.65,
    w: k.w * scale,
    dwell: 0,
    cores: kind === 'dreadnought' ? Math.min(3 + Math.floor(game.wave / 4), 6) : 1,
    coresLeft: kind === 'dreadnought' ? Math.min(3 + Math.floor(game.wave / 4), 6) : 1,
    dying: 0,
  });
}
function startWave() {
  const n = waveSize(game.wave);
  game.spawnLeft = n;
  for (let i = 0; i < n; i++) spawn(isBossWave(game.wave) ? 'dreadnought' : 'scout');
}

// ---------------------------------------------------------------- game flow
function startGame() {
  game.wave = 1; game.score = 0; game.integrity = 100; game.combo = 0;
  game.invaders = []; game.debris = []; game.selected = -1; game.shake = 0; game.flash = 0;
  startWave();
  show(null);
  running = true; lastT = 0;
  requestAnimationFrame(loop);
}
function endGame(won) {
  running = false;
  const best = +(localStorage.getItem('qb.best') || 0);
  if (game.score > best) localStorage.setItem('qb.best', String(game.score));
  $('overTitle').textContent = won ? 'You held the line' : 'The planet fell';
  $('overScore').textContent = game.score.toLocaleString();
  $('overSub').innerHTML = won
    ? 'You cleared all <span>' + WEB_WAVE_CAP + '</span> waves of the web version.'
    : 'You held out for <span>' + game.wave + '</span> wave' + (game.wave === 1 ? '' : 's') + '.';
  $('bandNote').textContent = mode === 'head'
    ? `Head tracking ran with ${bandCount} bands.`
    : 'Played with touch — try head tracking for the real thing.';
  show('over');
}

function damage(amount) {
  game.integrity = Math.max(0, game.integrity - amount);
  game.combo = 0;
  game.shake = 0.5; game.flash = 0.5;
  play('breach');
  if (game.integrity <= 0) endGame(false);
}
function collapse(inv, idx) {
  play('boom');
  game.combo++;
  game.score += KIND[inv.kind].score * Math.max(1, Math.min(game.combo, 8));
  for (let i = 0; i < 10; i++) {
    game.debris.push({
      x: inv.x * W, y: bandRects()[inv.band].y + bandRects()[inv.band].h / 2,
      vx: (Math.random() * 2 - 1) * 140, vy: -40 - Math.random() * 130,
      r: Math.random() * Math.PI, spin: (Math.random() * 2 - 1) * 6,
      s: 6 + Math.random() * 12, life: 0.9,
    });
  }
  game.invaders.splice(idx, 1);
}

function update(dt) {
  // aim smoothing — smooth before scaling, never after
  aimSmooth += (aim - aimSmooth) * Math.min(1, dt * 14);
  game.selected = selectBand(aimSmooth);

  const interval = bandInterval();
  for (let i = game.invaders.length - 1; i >= 0; i--) {
    const inv = game.invaders[i];
    /* Keep the whole hull AND its lock reticle on screen. The reticle is drawn at
     * ~0.7x the sprite width beyond centre, so a margin sized on the sprite alone
     * still clips it off the edge on narrow phones. */
    const margin = Math.min(0.34, (inv.w * 0.78) / W);
    inv.x += inv.drift * dt;
    if (inv.x < margin) { inv.x = margin; inv.drift = Math.abs(inv.drift); }
    else if (inv.x > 1 - margin) { inv.x = 1 - margin; inv.drift = -Math.abs(inv.drift); }

    inv.bandElapsed += dt;
    const step = inv.kind === 'dreadnought' ? interval * 2.4 : interval;
    if (inv.bandElapsed >= step) {
      inv.bandElapsed = 0; inv.band++;
      if (inv.band >= bandCount) {
        damage(KIND[inv.kind].damage);
        game.invaders.splice(i, 1);
        continue;
      }
    }

    // dwell: only the hull nearest the planet in the selected band collapses
    if (inv.band === game.selected) {
      /* Nearest the planet first. Everything in this list shares a band, so the
       * tiebreak that matters is how far each hull has travelled through it —
       * the one about to drop is the one you want gone. */
      const inBand = game.invaders.filter((v) => v.band === game.selected);
      const target = inBand.reduce((a, b) => (b.bandElapsed > a.bandElapsed ? b : a), inBand[0]);
      if (target === inv) {
        inv.dwell += dt / dwellFor(inv.kind, game.wave);
        if (inv.dwell >= 1) {
          inv.dwell = 0;
          inv.coresLeft--;
          if (inv.coresLeft <= 0) collapse(inv, i);
          else { play('core'); game.score += 40; }
        }
      } else inv.dwell = Math.max(0, inv.dwell - dt * 0.6);
    } else inv.dwell = Math.max(0, inv.dwell - dt * 0.6);
  }

  for (let i = game.debris.length - 1; i >= 0; i--) {
    const d = game.debris[i];
    d.x += d.vx * dt; d.y += d.vy * dt; d.vy += 420 * dt;
    d.r += d.spin * dt; d.life -= dt;
    if (d.life <= 0) game.debris.splice(i, 1);
  }

  if (game.shake > 0) game.shake = Math.max(0, game.shake - dt * 1.6);
  if (game.flash > 0) game.flash = Math.max(0, game.flash - dt * 1.8);

  if (!game.invaders.length) {
    if (game.wave >= WEB_WAVE_CAP) return endGame(true);
    game.wave++;
    game.integrity = Math.min(100, game.integrity + (isBossWave(game.wave) ? 18 : 7));
    startWave();
  }
}

// ---------------------------------------------------------------- render
function drawBackdrop() {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#05080f'); g.addColorStop(0.55, '#071427'); g.addColorStop(1, '#0a2036');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  // planet limb — a shallow arc low on the screen, looking down at Earth
  const cx = W / 2, cy = H * 1.55, r = H * 1.15;
  const pg = ctx.createRadialGradient(cx, cy - r * 0.25, r * 0.2, cx, cy, r);
  pg.addColorStop(0, 'rgba(90,180,225,0.55)');
  pg.addColorStop(0.55, 'rgba(30,90,140,0.55)');
  pg.addColorStop(1, 'rgba(6,20,40,0.9)');
  ctx.fillStyle = pg;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();

  ctx.strokeStyle = 'rgba(120,200,255,0.35)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI * 1.12, Math.PI * 1.88); ctx.stroke();
}
let stars = null;
function drawStars() {
  if (!stars) {
    stars = [];
    for (let i = 0; i < 70; i++) stars.push({ x: Math.random(), y: Math.random() * 0.55, s: Math.random() * 1.6 + 0.3 });
  }
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  for (const s of stars) { ctx.globalAlpha = 0.3 + s.s * 0.3; ctx.fillRect(s.x * W, s.y * H, s.s, s.s); }
  ctx.globalAlpha = 1;
}
function drawBands() {
  const rects = bandRects(), labels = bandLabels();
  rects.forEach((r, i) => {
    const on = i === game.selected;
    ctx.fillStyle = on ? 'rgba(77,210,255,0.13)' : 'rgba(255,255,255,0.02)';
    ctx.fillRect(0, r.y, W, r.h);
    ctx.strokeStyle = on ? 'rgba(77,210,255,0.85)' : 'rgba(255,255,255,0.12)';
    ctx.lineWidth = on ? 2 : 1;
    ctx.beginPath(); ctx.moveTo(0, r.y); ctx.lineTo(W, r.y); ctx.stroke();
    ctx.font = '600 11px ui-monospace, Menlo, monospace';
    ctx.fillStyle = on ? 'rgba(77,210,255,0.95)' : 'rgba(255,255,255,0.28)';
    ctx.fillText(labels[i], 14, r.y + 18);
  });
  const last = rects[rects.length - 1];
  ctx.strokeStyle = 'rgba(77,210,255,0.5)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, last.y + last.h); ctx.lineTo(W, last.y + last.h); ctx.stroke();
}
function drawInvaders() {
  const rects = bandRects();
  for (const inv of game.invaders) {
    const r = rects[inv.band];
    if (!r) continue;
    const img = sprites[inv.sprite];
    const cx = inv.x * W, cy = r.y + r.h / 2;
    const w = inv.w, h = w * (img && img.height ? img.height / img.width : 0.5);
    if (img) ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
    else { ctx.fillStyle = '#6cf'; ctx.beginPath(); ctx.ellipse(cx, cy, w / 2, h / 2, 0, 0, 6.3); ctx.fill(); }

    if (inv.dwell > 0.02) {
      const rad = w * 0.62;
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(cx, cy, rad, -Math.PI / 2, -Math.PI / 2 + inv.dwell * Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = 'rgba(77,210,255,0.85)'; ctx.lineWidth = 2;
      const b = rad * 1.12;
      ctx.beginPath();
      ctx.moveTo(cx - b, cy - b * 0.6); ctx.lineTo(cx - b, cy - b); ctx.lineTo(cx - b * 0.55, cy - b);
      ctx.moveTo(cx + b * 0.55, cy - b); ctx.lineTo(cx + b, cy - b); ctx.lineTo(cx + b, cy - b * 0.6);
      ctx.moveTo(cx - b, cy + b * 0.6); ctx.lineTo(cx - b, cy + b); ctx.lineTo(cx - b * 0.55, cy + b);
      ctx.moveTo(cx + b * 0.55, cy + b); ctx.lineTo(cx + b, cy + b); ctx.lineTo(cx + b, cy + b * 0.6);
      ctx.stroke();
    }
    if (inv.cores > 1) {
      const bw = w * 0.7, bx = cx - bw / 2, by = cy + h / 2 + 8;
      ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fillRect(bx, by, bw, 4);
      ctx.fillStyle = '#ff8a4d'; ctx.fillRect(bx, by, bw * (inv.coresLeft / inv.cores), 4);
    }
  }
}
function drawDebris() {
  for (const d of game.debris) {
    ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(d.r);
    ctx.globalAlpha = Math.max(0, Math.min(1, d.life / 0.45));
    ctx.fillStyle = '#7fd7ff'; ctx.fillRect(-d.s / 2, -d.s / 4, d.s, d.s / 2);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}
function render() {
  ctx.save();
  if (game.shake > 0) {
    const m = game.shake * 9;
    ctx.translate((Math.random() * 2 - 1) * m, (Math.random() * 2 - 1) * m);
  }
  drawBackdrop(); drawStars(); drawBands(); drawInvaders(); drawDebris();
  ctx.restore();
  if (game.flash > 0) {
    ctx.fillStyle = `rgba(255,61,90,${game.flash * 0.35})`;
    ctx.fillRect(0, 0, W, H);
  }
  if (mode === 'head' && !faceSeen) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, H / 2 - 34, W, 68);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
    ctx.font = '600 14px ui-monospace, Menlo, monospace';
    ctx.fillText('Face lost — move back into frame', W / 2, H / 2 + 5);
    ctx.textAlign = 'left';
  }
}
function syncHUD() {
  $('hudWave').textContent = game.wave;
  $('hudScore').textContent = game.score.toLocaleString();
  const m = Math.max(1, Math.min(game.combo, 8));
  const mult = $('hudMult');
  if (m > 1) { mult.textContent = '×' + m; mult.hidden = false; } else mult.hidden = true;
  const bar = $('hudBar');
  bar.style.width = game.integrity + '%';
  bar.className = game.integrity <= 20 ? 'crit' : game.integrity <= 45 ? 'warn' : '';
}

function loop(ts) {
  if (!running) return;
  if (!lastT) lastT = ts;
  const dt = Math.min(0.05, (ts - lastT) / 1000);
  lastT = ts;
  update(dt); render(); syncHUD();
  requestAnimationFrame(loop);
}

// ---------------------------------------------------------------- wiring
$('btnCamera').addEventListener('click', startHeadTracking);
$('btnTouch').addEventListener('click', () => { mode = 'touch'; bandCount = 3; startGame(); });
$('btnErrTouch').addEventListener('click', () => { mode = 'touch'; bandCount = 3; startGame(); });
$('btnCalSkip').addEventListener('click', () => {
  calibrating = false; reach = DEFAULT_REACH; bandCount = 2; neutral.length = 0; startGame();
});
$('btnAgain').addEventListener('click', () => {
  if (mode === 'head') beginCalibration(); else startGame();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && running) { running = false; endGame(false); }
});

/* Debug surface, same idea as __mtDebug (Maintain) and __t31 (Ten31): lets a headless
 * check drive the game without a camera or a real pointer. */
window.__qb = {
  state: () => ({
    running, mode, bandCount, wave: game.wave, score: game.score,
    integrity: game.integrity, combo: game.combo, selected: game.selected,
    aim, aimSmooth,
    invaders: game.invaders.map((i) => ({ kind: i.kind, band: i.band, dwell: +i.dwell.toFixed(3) })),
  }),
  setAim: (v) => { aim = Math.min(1, Math.max(0, v)); },
  step: (dt) => { update(dt); syncHUD(); },
  startTouch: () => { mode = 'touch'; bandCount = 3; startGame(); },
};
