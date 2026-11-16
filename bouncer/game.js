/* =====================================================================
   BOUNCER — a retro brick-breaker for Puzzle Garden
   How the files fit together:
     levels.js  -> LEVELS: the brick layouts
     sound.js   -> Sound: effects and music, all made in code
     game.js    -> this file: playfield, physics, power-ups, controls, menus

   The playfield is always 400 wide and 600 tall in "game units".
   It gets scaled to fit whatever screen it's on, so all the numbers
   below stay the same on every phone.
   ===================================================================== */
"use strict";

const $ = id => document.getElementById(id);
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
};
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const rand = (a, b) => a + Math.random() * (b - a);

/* ---------- 1. Settings (remembered on the phone) ---------- */
const SENS = [["Slow", 1.0], ["Normal", 1.4], ["Fast", 1.9], ["Turbo", 2.6]];   // slider speed choices
const settings = Object.assign({ side: "right", sens: 1, music: true, sfx: true }, store.get("bouncer.settings", {}));
const saveSettings = () => store.set("bouncer.settings", settings);

/* ---------- 2. Playfield measurements ---------- */
const W = 400;                     // playfield width (always the same)
let H = 600;                       // playfield height: stretches to fit taller phones (see resize)
const WALL = 8, TOP = 34;          // side wall thickness, and where the ceiling is (score bar sits above)
const COLS = 12, BW = (W - WALL * 2) / COLS, BH = 16, BRICK_TOP = 72;   // brick grid
const PADDLE_H = 12, BALL_R = 5;
let PADDLE_Y = H - 44;             // where the bouncer sits
let NET_Y = H - 8;                 // EZ mode safety net

/* ---------- 3. The two modes ---------- */
const MODES = {
  // lives, starting ball speed, how much faster it can get, bouncer width,
  // safety net on/off, chance a broken brick drops a capsule, red capsules on/off
  normal: { lives: 3,        speed: 300, maxMul: 1.5,  paddle: 62, net: false, drop: 0.15, bad: true },
  ez:     { lives: Infinity, speed: 205, maxMul: 1.12, paddle: 96, net: true,  drop: 0.22, bad: false }
};

/* ---------- 4. Bricks ---------- */
const COLOURS = { r: "#e5413b", o: "#f08a24", y: "#f2cf2f", g: "#4cc23d", c: "#2fc4d4", b: "#3a73de", p: "#9450d4", w: "#e4e9ef" };
const PITCH = { r: 7, o: 6, y: 5, g: 4, c: 3, b: 2, p: 1, w: 0 };       // brick sound pitch

/* ---------- 5. Capsules (power-ups and power-downs) ----------
   w = how often it drops compared with the others. */
const POWERS = {
  expand: { label: "E", good: true,  w: 10, text: "BIGGER BOUNCER" },
  multi:  { label: "M", good: true,  w: 9,  text: "MULTI-BALL" },
  fire:   { label: "F", good: true,  w: 5,  text: "FIREBALL" },
  laser:  { label: "L", good: true,  w: 7,  text: "SHOOTER - HOLD FIRE" },
  catch:  { label: "C", good: true,  w: 7,  text: "CATCH" },
  slow:   { label: "S", good: true,  w: 6,  text: "SLOW BALL" },
  life:   { label: "+", good: true,  w: 2,  text: "EXTRA LIFE" },
  boom:   { label: "B", good: true,  w: 3,  text: "DETONATE" },
  warp:   { label: "W", good: true,  w: 1,  text: "WARP!" },
  shrink: { label: "-", good: false, w: 8,  text: "SHRINK" },
  fast:   { label: "!", good: false, w: 6,  text: "FAST BALL" },
  kill:   { label: "X", good: false, w: 2,  text: "OUCH!" }
};
const TIMED = { fire: 12, laser: 15, catch: 20, slow: 12, fast: 10 };   // seconds each timed power lasts

/* ---------- 6. Game state ---------- */
let mode = "normal", cfg = MODES.normal;
let state = "menu";        // menu | ready (ball on bouncer) | play | clear | paused | over
let pausedFrom = "play";
let levelIdx = 0, loop = 0, score = 0, lives = 3;
let bricks = [], grid = [], left = 0;      // left = bricks still to break
let balls = [], caps = [], bolts = [], parts = [], texts = [], booms = [];
let timers = { fire: 0, laser: 0, catch: 0, slow: 0, fast: 0 };
let speedMul = 1, laserCd = 0, shake = 0, netFlash = 0;
let banner = { title: "", sub: "", t: 0 }, clearT = 0, blink = 0;
let fireHeld = false;
const paddle = { x: W / 2, w: 62, step: 0 };
const keys = {};
let bg = null;
let startAt = 1;
let reached = store.get("bouncer.reached", 1);           // furthest level reached (for "start at level")
const best = Object.assign({ normal: 0, ez: 0 }, store.get("bouncer.best", {}));

/* ---------- 7. Building a level ---------- */
function buildLevel(i) {
  bricks = []; grid = []; left = 0; booms = [];
  LEVELS[i].map.forEach((row, r) => {
    grid[r] = [];
    for (let c = 0; c < COLS; c++) {
      const ch = row[c] || ".";
      if (ch === ".") { grid[r][c] = null; continue; }
      const kind = COLOURS[ch] ? "n" : ch;           // n = normal coloured brick
      const br = { r, c, ch, kind, x: WALL + c * BW, y: BRICK_TOP + r * BH, w: BW, h: BH,
                   hits: kind === "S" ? 2 : kind === "T" ? 3 : 1, alive: true, flash: 0, queued: false };
      bricks.push(br); grid[r][c] = br;
      if (kind !== "G") left++;
    }
  });
  bg = makeBackground(i);
}
const brickAt = (x, y) => {
  const row = grid[Math.floor((y - BRICK_TOP) / BH)];
  const br = row && row[Math.floor((x - WALL) / BW)];
  return br && br.alive ? br : null;
};

/* ---------- 8. Starting, serving, losing, winning ---------- */
function startGame(m) {
  Sound.init();
  mode = m; cfg = MODES[m];
  score = 0; lives = cfg.lives; loop = 0;
  levelIdx = startAt - 1;
  hideOverlays();
  startLevel();
}

function startLevel() {
  buildLevel(levelIdx);
  resetPowers();
  paddle.x = W / 2; paddle.w = targetWidth();
  caps = []; bolts = []; texts = [];
  serve();
  banner = { title: "LEVEL " + (levelIdx + 1) + (loop ? "  x" + (loop + 1) : ""), sub: LEVELS[levelIdx].name, t: 2.2 };
  Sound.startMusic(levelIdx);
}

function serve() {   // put a fresh ball on the bouncer, waiting to launch
  balls = [{ x: paddle.x, y: PADDLE_Y - BALL_R, vx: 0, vy: 0, r: BALL_R, stuck: true, off: rand(-6, 6) }];
  state = "ready";
}

function resetPowers() {
  for (const k in timers) timers[k] = 0;
  paddle.step = 0; speedMul = 1;
}

function loseLife() {
  Sound.sfx("lose"); shake = 6;
  caps = []; bolts = [];
  resetPowers();
  if (isFinite(lives)) lives--;
  if (lives <= 0) { gameOver(); return; }
  serve();
}

function levelDone() {
  if (state === "clear") return;
  state = "clear"; clearT = 2.4;
  score += 500 + (isFinite(lives) ? lives * 100 : 0);
  caps = []; bolts = [];
  banner = { title: "LEVEL CLEAR!", sub: "+" + (500 + (isFinite(lives) ? lives * 100 : 0)), t: 2.4 };
  Sound.stopMusic(); Sound.sfx("clear");
}

function nextLevel() {
  levelIdx++;
  if (levelIdx >= LEVELS.length) { levelIdx = 0; loop++; }   // after the last level, start again faster
  if (loop === 0 && levelIdx + 1 > reached) { reached = levelIdx + 1; store.set("bouncer.reached", reached); }
  startLevel();
}

function gameOver() {
  state = "over";
  Sound.stopMusic(); Sound.sfx("over");
  const isBest = score > best[mode];
  if (isBest) { best[mode] = score; store.set("bouncer.best", best); }
  $("finalScore").textContent = "SCORE " + score;
  $("finalBest").textContent = isBest ? "NEW BEST!" : "Best: " + best[mode];
  $("finalBest").classList.toggle("new", isBest);
  setTimeout(() => { if (state === "over") $("overMenu").hidden = false; }, 900);
}

/* ---------- 9. Ball speed ---------- */
function speedNow() {
  let s = cfg.speed * speedMul * (1 + loop * 0.1);
  if (timers.slow > 0) s *= 0.68;
  if (timers.fast > 0) s *= 1.35;
  return s;
}
const targetWidth = () => cfg.paddle * (1 + 0.25 * paddle.step);

/* ---------- 10. Launching and shooting ---------- */
function launch() {
  let any = false;
  balls.forEach(b => {
    if (!b.stuck) return;
    b.stuck = false; any = true;
    const a = clamp(b.off / (paddle.w / 2), -1, 1) * 0.9 + rand(-0.2, 0.2);   // angle depends where it sits
    const s = speedNow();
    b.vx = Math.sin(a) * s; b.vy = -Math.cos(a) * s;
  });
  if (any) { state = "play"; Sound.sfx("launch"); }
  return any;
}

function shoot() {
  if (laserCd > 0 || timers.laser <= 0) return;
  laserCd = 0.26;
  const hw = paddle.w / 2 - 5;
  bolts.push({ x: paddle.x - hw, y: PADDLE_Y - 4 }, { x: paddle.x + hw, y: PADDLE_Y - 4 });
  Sound.sfx("laser");
}

// What a tap on the slide area, or a press of FIRE, does
function action() {
  if (state !== "ready" && state !== "play") return;
  if (launch()) return;
  shoot();
}

/* ---------- 11. Moving the bouncer ---------- */
function movePaddle(d) {
  if (state !== "ready" && state !== "play") return;
  paddle.x = clamp(paddle.x + d, WALL + paddle.w / 2, W - WALL - paddle.w / 2);
}

/* ---------- 12. The main update, run every frame ---------- */
function update(dt) {
  blink += dt;
  if (banner.t > 0) banner.t -= dt;
  if (shake > 0) shake = Math.max(0, shake - dt * 30);
  if (netFlash > 0) netFlash -= dt;

  if (state === "clear") {
    clearT -= dt;
    if (clearT <= 0) nextLevel();
    return;
  }

  // Keyboard (for playing on a computer)
  if (keys.ArrowLeft) movePaddle(-380 * dt);
  if (keys.ArrowRight) movePaddle(380 * dt);

  // Bouncer grows or shrinks smoothly to its new size
  paddle.w += (targetWidth() - paddle.w) * Math.min(1, dt * 10);
  paddle.x = clamp(paddle.x, WALL + paddle.w / 2, W - WALL - paddle.w / 2);

  if (state === "play") {
    // Count down timed powers
    for (const k in timers) {
      if (timers[k] > 0) {
        timers[k] -= dt;
        if (timers[k] <= 0) { timers[k] = 0; if (k === "catch") launch(); }
      }
    }
    speedMul = Math.min(cfg.maxMul, speedMul + dt * 0.003);   // the ball creeps faster over time
  }
  laserCd -= dt;
  if (fireHeld) shoot();

  // Balls
  balls.forEach(b => {
    if (b.stuck) { b.x = paddle.x + b.off; b.y = PADDLE_Y - b.r; return; }
    if (state === "play") moveBall(b, dt);
    if (timers.fire > 0 && Math.random() < 0.7)
      parts.push({ x: b.x + rand(-2, 2), y: b.y + rand(-2, 2), vx: rand(-20, 20), vy: rand(-20, 20), life: 0.3, max: 0.3, col: Math.random() < 0.5 ? "#ffb02e" : "#ff5a1f", s: 3, g: 0 });
  });
  const before = balls.length;
  balls = balls.filter(b => !b.dead);
  if (before && !balls.length && state === "play") loseLife();

  // Chain explosions go off one after another, not all at once
  for (let i = booms.length - 1; i >= 0; i--) {
    booms[i].t -= dt;
    if (booms[i].t <= 0) { const br = booms[i].br; booms.splice(i, 1); detonate(br); }
  }

  // Capsules falling
  caps.forEach(c => {
    c.y += 110 * dt;
    if (c.y + 6 >= PADDLE_Y && c.y - 6 <= PADDLE_Y + PADDLE_H && Math.abs(c.x - paddle.x) <= paddle.w / 2 + 12) {
      c.dead = true; applyPower(c.t);
    }
    if (c.y > H + 10) c.dead = true;
  });
  caps = caps.filter(c => !c.dead);

  // Shooter bolts
  bolts.forEach(bt => {
    bt.y -= 640 * dt;
    const br = brickAt(bt.x, bt.y) || brickAt(bt.x, bt.y - 8);
    if (br) { bt.dead = true; hitBrick(br); }
    if (bt.y < TOP) bt.dead = true;
  });
  bolts = bolts.filter(bt => !bt.dead);

  if (left <= 0 && !booms.length && (state === "play" || state === "ready")) levelDone();
}

/* ---------- 13. Ball physics ----------
   The ball moves in tiny steps (3 units at a time) so it can never skip
   through a brick, even when it's going very fast. */
function moveBall(b, dt) {
  const spd = speedNow();
  // Keep its speed exact, and never let it go too flat (stops endless side-to-side bouncing)
  let m = Math.hypot(b.vx, b.vy) || 1;
  b.vx = b.vx / m * spd; b.vy = b.vy / m * spd;
  if (Math.abs(b.vy) < spd * 0.28) {
    b.vy = (b.vy < 0 ? -1 : 1) * spd * 0.28;
    b.vx = (b.vx < 0 ? -1 : 1) * Math.sqrt(spd * spd - b.vy * b.vy);
  }
  const steps = Math.max(1, Math.ceil(spd * dt / 3)), sdt = dt / steps;
  for (let i = 0; i < steps; i++) {
    const px = b.x, py = b.y;
    b.x += b.vx * sdt; b.y += b.vy * sdt;

    // Walls and ceiling
    if (b.x - b.r < WALL) { b.x = WALL + b.r; b.vx = Math.abs(b.vx); Sound.sfx("wall"); }
    if (b.x + b.r > W - WALL) { b.x = W - WALL - b.r; b.vx = -Math.abs(b.vx); Sound.sfx("wall"); }
    if (b.y - b.r < TOP) { b.y = TOP + b.r; b.vy = Math.abs(b.vy); Sound.sfx("wall"); }

    // Bouncer
    if (b.vy > 0 && b.y + b.r >= PADDLE_Y && py + b.r <= PADDLE_Y + 4 &&
        b.x >= paddle.x - paddle.w / 2 - b.r && b.x <= paddle.x + paddle.w / 2 + b.r) {
      hitPaddle(b);
      if (b.stuck) return;
      continue;
    }

    // EZ safety net
    if (cfg.net && b.vy > 0 && b.y + b.r >= NET_Y) {
      b.y = NET_Y - b.r; b.vy = -Math.abs(b.vy); netFlash = 0.35; Sound.sfx("net");
    }
    if (b.y - b.r > H) { b.dead = true; return; }

    // Bricks
    if (b.y - b.r < BRICK_TOP + grid.length * BH && collideBricks(b, px, py)) {
      // after a bounce, re-aim to the exact speed
      m = Math.hypot(b.vx, b.vy) || 1; b.vx = b.vx / m * spd; b.vy = b.vy / m * spd;
    }
  }
}

function hitPaddle(b) {
  // Where it lands on the bouncer sets the angle: middle = straight up, edges = steep
  const rel = clamp((b.x - paddle.x) / (paddle.w / 2), -1, 1);
  const a = rel * 1.13;                      // up to about 65 degrees
  const s = speedNow();
  b.vx = Math.sin(a) * s; b.vy = -Math.cos(a) * s;
  b.y = PADDLE_Y - b.r;
  speedMul = Math.min(cfg.maxMul, speedMul * 1.006);
  if (timers.catch > 0) { b.stuck = true; b.off = b.x - paddle.x; }
  Sound.sfx("paddle");
}

function collideBricks(b, px, py) {
  const r0 = Math.floor((b.y - b.r - BRICK_TOP) / BH), r1 = Math.floor((b.y + b.r - BRICK_TOP) / BH);
  const c0 = Math.floor((b.x - b.r - WALL) / BW), c1 = Math.floor((b.x + b.r - WALL) / BW);
  let bounced = false;
  for (let r = r0; r <= r1; r++) {
    const row = grid[r]; if (!row) continue;
    for (let c = c0; c <= c1; c++) {
      const br = row[c]; if (!br || !br.alive) continue;
      // Is the ball touching this brick? (closest point on the brick to the ball's centre)
      const nx = clamp(b.x, br.x, br.x + br.w), ny = clamp(b.y, br.y, br.y + br.h);
      const dx = b.x - nx, dy = b.y - ny;
      if (dx * dx + dy * dy > b.r * b.r) continue;

      // Fireball burns straight through everything except gold
      if (timers.fire > 0 && br.kind !== "G") { smash(br); continue; }
      if (bounced) continue;

      // Work out which side it hit by where the ball was a moment ago
      const outX = px + b.r <= br.x || px - b.r >= br.x + br.w;
      const outY = py + b.r <= br.y || py - b.r >= br.y + br.h;
      if (outY || !outX) b.vy = (b.y < br.y + br.h / 2 ? -1 : 1) * Math.abs(b.vy);
      if (outX || !outY) b.vx = (b.x < br.x + br.w / 2 ? -1 : 1) * Math.abs(b.vx);
      b.x = px; b.y = py;
      if (br.kind === "G") {        // tiny nudge off gold so it can't get stuck in a loop
        const a = rand(-0.06, 0.06), cs = Math.cos(a), sn = Math.sin(a);
        [b.vx, b.vy] = [b.vx * cs - b.vy * sn, b.vx * sn + b.vy * cs];
      }
      hitBrick(br);
      bounced = true;
    }
  }
  return bounced;
}

/* ---------- 14. Breaking bricks ---------- */
function hitBrick(br) {           // one normal hit
  if (!br.alive) return;
  br.flash = 1;
  if (br.kind === "G") { Sound.sfx("gold"); spark(br, "#ffe38a", 4); return; }
  if (br.kind === "X") { queueBoom(br, 0); return; }
  br.hits--;
  if (br.hits > 0) { score += 20; Sound.sfx("steel"); spark(br, "#d9e2ee", 4); return; }
  removeBrick(br);
}

function smash(br) {              // breaks it outright (fireball)
  if (!br.alive || br.kind === "G") return;
  if (br.kind === "X") { queueBoom(br, 0); return; }
  removeBrick(br);
}

function removeBrick(br) {
  if (!br.alive) return;
  br.alive = false; left--;
  score += br.kind === "n" ? 50 : br.kind === "S" ? 100 : br.kind === "T" ? 150 : 80;
  const col = br.kind === "n" ? COLOURS[br.ch] : br.kind === "X" ? "#ff8a2a" : "#b8c2cf";
  spark(br, col, 10);
  if (br.kind === "n") Sound.sfx("brick", PITCH[br.ch]); else Sound.sfx("steel");
  maybeDrop(br);
}

function queueBoom(br, delay) {
  if (br.queued) return;
  br.queued = true;
  booms.push({ br, t: delay });
}

function detonate(br) {           // an explosive brick goes off
  if (!br.alive) return;
  removeBrick(br);
  spark(br, "#ffd24a", 22);
  parts.push({ x: br.x + br.w / 2, y: br.y + br.h / 2, vx: 0, vy: 0, life: 0.35, max: 0.35, ring: true, col: "#ffcf5a", s: 0, g: 0 });
  shake = Math.min(9, shake + 4);
  Sound.sfx("explode");
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    const nb = grid[br.r + dr] && grid[br.r + dr][br.c + dc];
    if (!nb || !nb.alive || nb.kind === "G") continue;
    if (nb.kind === "X") queueBoom(nb, 0.08);   // explosives set each other off
    else removeBrick(nb);
  }
}

/* ---------- 15. Capsules ---------- */
function maybeDrop(br) {
  if (state !== "play" || caps.length >= 4 || Math.random() > cfg.drop) return;
  const hasX = bricks.some(b => b.alive && b.kind === "X");
  const pool = Object.entries(POWERS).filter(([k, p]) =>
    (cfg.bad || p.good) && !(k === "life" && !isFinite(lives)) && !(k === "boom" && !hasX));
  let total = pool.reduce((s, [, p]) => s + p.w, 0), pick = Math.random() * total;
  for (const [k, p] of pool) { pick -= p.w; if (pick <= 0) { caps.push({ x: br.x + br.w / 2, y: br.y + br.h / 2, t: k }); return; } }
}

function applyPower(k) {
  const p = POWERS[k];
  score += 50;
  texts.push({ x: paddle.x, y: PADDLE_Y - 24, s: p.text, col: p.good ? "#7dff9a" : "#ff7d6b", t: 1.3 });
  Sound.sfx(p.good ? "good" : "bad");
  switch (k) {
    case "expand": paddle.step = Math.min(3, paddle.step + 1); break;
    case "shrink": paddle.step = Math.max(-2, paddle.step - 1); break;
    case "multi": {
      const extra = [];
      balls.forEach(b => {
        if (b.stuck) { b.stuck = false; const s = speedNow(); b.vx = rand(-0.3, 0.3) * s; b.vy = -s; }
        [-0.45, 0.45].forEach(a => {
          if (balls.length + extra.length >= 15) return;
          const cs = Math.cos(a), sn = Math.sin(a);
          extra.push({ x: b.x, y: b.y, r: b.r, vx: b.vx * cs - b.vy * sn, vy: b.vx * sn + b.vy * cs, stuck: false });
        });
      });
      balls.push(...extra);
      if (state === "ready") state = "play";
      break;
    }
    case "fire": case "laser": case "catch": timers[k] = TIMED[k]; break;
    case "slow": timers.slow = TIMED.slow; timers.fast = 0; break;
    case "fast": timers.fast = TIMED.fast; timers.slow = 0; break;
    case "life": lives = Math.min(9, lives + 1); break;
    case "boom": bricks.forEach(b => { if (b.alive && b.kind === "X") queueBoom(b, rand(0, 0.25)); }); break;
    case "warp": levelDone(); break;
    case "kill": balls = []; loseLife(); break;
  }
}

/* ---------- 16. Particles ---------- */
function spark(br, col, n) {
  for (let i = 0; i < n; i++) parts.push({
    x: br.x + rand(2, br.w - 2), y: br.y + rand(2, br.h - 2),
    vx: rand(-120, 120), vy: rand(-140, 60), life: rand(0.35, 0.7), max: 0.7, col, s: rand(2, 4), g: 420 });
}
function updateParts(dt) {
  parts.forEach(p => { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt; });
  parts = parts.filter(p => p.life > 0);
  if (parts.length > 500) parts.splice(0, parts.length - 500);
  texts.forEach(t => { t.t -= dt; t.y -= 26 * dt; });
  texts = texts.filter(t => t.t > 0);
  bricks.forEach(b => { if (b.flash > 0) b.flash -= dt * 5; });
}

/* =====================================================================
   DRAWING
   ===================================================================== */
const view = $("view"), ctx = view.getContext("2d");
let scale = 1, offX = 0, offY = 0, dpr = 1;

function resize() {
  const r = $("stage").getBoundingClientRect();
  dpr = Math.min(window.devicePixelRatio || 1, 3);
  view.width = Math.round(r.width * dpr); view.height = Math.round(r.height * dpr);
  // Use the whole screen: the field is always 400 wide, but taller phones get a taller field
  const newH = clamp(Math.round(W * r.height / r.width), 560, 780);
  if (newH !== H) {
    H = newH; PADDLE_Y = H - 44; NET_Y = H - 8;
    if (bg) bg = makeBackground(levelIdx);
  }
  scale = Math.min(r.width / W, r.height / H);
  offX = (r.width - W * scale) / 2; offY = (r.height - H * scale) / 2;
}

// Lighten (+) or darken (-) a colour
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const t = f < 0 ? 0 : 255, a = Math.abs(f);
  r = Math.round(r + (t - r) * a); g = Math.round(g + (t - g) * a); b = Math.round(b + (t - b) * a);
  return "rgb(" + r + "," + g + "," + b + ")";
}

// Bricks are drawn once into little pictures and reused (much faster on phones)
const sprites = {};
function brickSprite(br) {
  const key = br.ch + br.hits;
  if (sprites[key]) return sprites[key];
  const S = 3, cv = document.createElement("canvas");
  cv.width = Math.ceil(BW * S); cv.height = BH * S;
  const g = cv.getContext("2d"); g.scale(S, S);
  const w = BW - 1, h = BH - 1;
  const base = br.kind === "n" ? COLOURS[br.ch] : br.kind === "S" ? "#9aa4b0" : br.kind === "T" ? "#5f6976" : br.kind === "G" ? "#d9a520" : "#b3261c";
  // body
  const grd = g.createLinearGradient(0, 0, 0, h);
  grd.addColorStop(0, shade(base, 0.35)); grd.addColorStop(0.5, base); grd.addColorStop(1, shade(base, -0.35));
  g.fillStyle = grd; g.fillRect(0, 0, w, h);
  // bevel edges
  g.fillStyle = shade(base, 0.6); g.fillRect(0, 0, w, 2); g.fillRect(0, 0, 2, h);
  g.fillStyle = shade(base, -0.55); g.fillRect(0, h - 2, w, 2); g.fillRect(w - 2, 0, 2, h);
  // shine
  g.fillStyle = "rgba(255,255,255,.18)"; g.fillRect(2, 2, w - 4, h / 2 - 2);
  if (br.kind === "S" || br.kind === "T") {           // rivets
    g.fillStyle = shade(base, -0.5);
    [[4, 4], [w - 5, 4], [4, h - 5], [w - 5, h - 5]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 1.2, 0, 7); g.fill(); });
    const lost = (br.kind === "S" ? 2 : 3) - br.hits;  // cracks show damage
    g.strokeStyle = "rgba(20,24,30,.8)"; g.lineWidth = 1;
    for (let i = 0; i < lost; i++) {
      g.beginPath(); const sx = 8 + i * 9;
      g.moveTo(sx, 2); g.lineTo(sx + 3, 6); g.lineTo(sx - 1, 9); g.lineTo(sx + 2, h - 2); g.stroke();
    }
  }
  if (br.kind === "G") {                               // diagonal glint
    g.fillStyle = "rgba(255,255,220,.45)";
    g.beginPath(); g.moveTo(8, 0); g.lineTo(13, 0); g.lineTo(7, h); g.lineTo(2, h); g.fill();
  }
  if (br.kind === "X") {                               // hazard stripes and a spark
    g.save(); g.beginPath(); g.rect(3, 3, w - 6, h - 6); g.clip();
    for (let x = -h; x < w; x += 6) { g.fillStyle = "rgba(255,210,40,.55)"; g.beginPath(); g.moveTo(x, h); g.lineTo(x + 3, h); g.lineTo(x + 3 + h, 0); g.lineTo(x + h, 0); g.fill(); }
    g.restore();
    g.fillStyle = "#ffe066"; g.beginPath();
    const cx = w / 2, cy = h / 2;
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, rr = i % 2 ? 2 : 5.5; g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
    g.fill();
  }
  return sprites[key] = cv;
}

// Each level gets its own background, drawn once
function makeBackground(i) {
  const cv = document.createElement("canvas"); cv.width = W * 2; cv.height = H * 2;
  const g = cv.getContext("2d"); g.scale(2, 2);
  const hue = (i * 47 + 210) % 360;
  const grd = g.createLinearGradient(0, 0, 0, H);
  grd.addColorStop(0, "hsl(" + hue + ",45%,13%)"); grd.addColorStop(1, "hsl(" + ((hue + 40) % 360) + ",50%,4%)");
  g.fillStyle = grd; g.fillRect(0, 0, W, H);
  g.strokeStyle = "hsla(" + hue + ",70%,70%,.07)"; g.fillStyle = "hsla(" + hue + ",70%,80%,.12)"; g.lineWidth = 1;
  const style = i % 4;
  if (style === 0) { for (let x = 0; x < W; x += 20) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); } for (let y = 0; y < H; y += 20) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); } }
  if (style === 1) { for (let x = -H; x < W; x += 24) { g.beginPath(); g.moveTo(x, H); g.lineTo(x + H, 0); g.stroke(); } }
  if (style === 2) { let s = i * 99 + 7; const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280; for (let n = 0; n < 140; n++) { g.beginPath(); g.arc(rnd() * W, rnd() * H, rnd() * 1.4 + 0.3, 0, 7); g.fill(); } }
  if (style === 3) { for (let y = 0; y < H + 30; y += 30) for (let x = 0; x < W + 30; x += 30) { g.beginPath(); g.arc(x + ((y / 30) % 2) * 15, y, 11, 0, 7); g.stroke(); } }
  return cv;
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

function draw() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#000"; ctx.fillRect(0, 0, view.width, view.height);
  const sx = shake ? rand(-shake, shake) * 0.5 : 0, sy = shake ? rand(-shake, shake) * 0.5 : 0;
  ctx.setTransform(scale * dpr, 0, 0, scale * dpr, (offX + sx) * dpr, (offY + sy) * dpr);
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();

  if (bg) ctx.drawImage(bg, 0, 0, W, H);

  // Bricks
  bricks.forEach(br => {
    if (!br.alive) return;
    ctx.drawImage(brickSprite(br), br.x, br.y, BW, BH);
    if (br.flash > 0) { ctx.fillStyle = "rgba(255,255,255," + (br.flash * 0.6) + ")"; ctx.fillRect(br.x, br.y, BW - 1, BH - 1); }
  });

  // EZ safety net
  if (cfg.net && state !== "menu") {
    ctx.strokeStyle = "rgba(90,255,140," + (0.35 + Math.max(0, netFlash) * 1.6) + ")"; ctx.lineWidth = 2;
    ctx.setLineDash([6, 5]); ctx.beginPath(); ctx.moveTo(WALL, NET_Y); ctx.lineTo(W - WALL, NET_Y); ctx.stroke(); ctx.setLineDash([]);
  }

  // Capsules
  caps.forEach(c => {
    const p = POWERS[c.t];
    roundRect(c.x - 13, c.y - 6, 26, 12, 6);
    const g = ctx.createLinearGradient(0, c.y - 6, 0, c.y + 6);
    const base = p.good ? "#2fbf4a" : "#e0412f";
    g.addColorStop(0, shade(base, 0.45)); g.addColorStop(0.5, base); g.addColorStop(1, shade(base, -0.45));
    ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = "rgba(0,0,0,.5)"; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = "#fff"; ctx.font = "bold 9px ui-monospace, Menlo, monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(p.label, c.x, c.y + 0.5);
  });

  // Shooter bolts
  ctx.fillStyle = "#ffe95a";
  bolts.forEach(bt => { ctx.fillRect(bt.x - 1, bt.y - 8, 2, 9); });

  drawPaddle();

  // Balls
  balls.forEach(b => {
    const g = ctx.createRadialGradient(b.x - 1.5, b.y - 1.5, 0.5, b.x, b.y, b.r);
    if (timers.fire > 0) { g.addColorStop(0, "#fff7c2"); g.addColorStop(0.5, "#ffae2b"); g.addColorStop(1, "#e2441b"); }
    else { g.addColorStop(0, "#ffffff"); g.addColorStop(0.6, "#c2cedd"); g.addColorStop(1, "#5d6a7c"); }
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.fill();
  });

  // Particles
  parts.forEach(p => {
    const a = Math.max(0, p.life / p.max);
    if (p.ring) {
      ctx.strokeStyle = "rgba(255,210,90," + a + ")"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(p.x, p.y, (1 - a) * 34 + 4, 0, 7); ctx.stroke();
    } else { ctx.globalAlpha = a; ctx.fillStyle = p.col; ctx.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s); ctx.globalAlpha = 1; }
  });

  drawFrame();
  drawHud();

  // Floating power-up names
  ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = "bold 13px ui-monospace, Menlo, monospace";
  texts.forEach(t => { ctx.globalAlpha = Math.min(1, t.t * 2); ctx.fillStyle = t.col; ctx.fillText(t.s, clamp(t.x, 80, W - 80), t.y); });
  ctx.globalAlpha = 1;

  // Big messages
  if (banner.t > 0 && state !== "menu") {
    const a = Math.min(1, banner.t * 2);
    const by = Math.round(H * 0.55);
    ctx.globalAlpha = a; ctx.fillStyle = "rgba(0,0,0,.45)"; ctx.fillRect(0, by - 28, W, 74);
    ctx.fillStyle = "#fff"; ctx.font = "900 30px 'Trebuchet MS', sans-serif"; ctx.fillText(banner.title, W / 2, by);
    ctx.fillStyle = "#9fd4ff"; ctx.font = "bold 15px 'Trebuchet MS', sans-serif"; ctx.fillText(banner.sub, W / 2, by + 29);
    ctx.globalAlpha = 1;
  }
  if (state === "ready" && Math.floor(blink * 2) % 2 === 0) {
    ctx.fillStyle = "#cfe8ff"; ctx.font = "bold 14px 'Trebuchet MS', sans-serif";
    ctx.fillText("TAP THE SLIDER OR PRESS LAUNCH", W / 2, PADDLE_Y - 80);
  }
  ctx.restore();
}

function drawPaddle() {
  if (state === "menu") return;
  const x = paddle.x - paddle.w / 2, y = PADDLE_Y, w = paddle.w, h = PADDLE_H;
  if (timers.laser > 0) {   // little cannons on each end
    ctx.fillStyle = "#c9d2de"; ctx.fillRect(x + 3, y - 5, 4, 6); ctx.fillRect(x + w - 7, y - 5, 4, 6);
  }
  roundRect(x, y, w, h, 6);
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, "#f7f9fc"); g.addColorStop(0.45, "#a6b1c0"); g.addColorStop(0.55, "#7b8798"); g.addColorStop(1, "#dbe2eb");
  ctx.fillStyle = g; ctx.fill();
  // red end caps
  ctx.save(); roundRect(x, y, w, h, 6); ctx.clip();
  ctx.fillStyle = "#d63a2e"; ctx.fillRect(x, y, 9, h); ctx.fillRect(x + w - 9, y, 9, h);
  ctx.fillStyle = "rgba(255,255,255,.35)"; ctx.fillRect(x, y + 1, w, 3);
  ctx.restore();
  if (timers.catch > 0) { ctx.fillStyle = "#5cff8c"; ctx.fillRect(x + 10, y - 1, w - 20, 2); }
}

function drawFrame() {   // metal walls and ceiling
  const wall = (x, y, w, h, vertical) => {
    const g = vertical ? ctx.createLinearGradient(x, 0, x + w, 0) : ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, "#5b6880"); g.addColorStop(0.5, "#c6d0e0"); g.addColorStop(1, "#46526a");
    ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  };
  wall(0, TOP - 6, WALL, H, true); wall(W - WALL, TOP - 6, WALL, H, true); wall(0, TOP - 6, W, 6, false);
}

function drawHud() {
  ctx.fillStyle = "#070a12"; ctx.fillRect(0, 0, W, TOP - 6);
  ctx.textBaseline = "middle"; ctx.font = "bold 14px ui-monospace, Menlo, Consolas, monospace";
  ctx.textAlign = "left"; ctx.fillStyle = "#e6ecff";
  ctx.fillText(String(score).padStart(7, "0"), 10, 15);
  ctx.textAlign = "center"; ctx.fillStyle = "#9fb4d8";
  ctx.fillText("LEVEL " + (levelIdx + 1), W / 2 - 30, 15);
  // lives (kept clear of the pause button in the top-right corner)
  if (state !== "menu") {
    ctx.textAlign = "left";
    if (!isFinite(lives)) { ctx.fillStyle = "#5cff8c"; ctx.fillText("EZ", W / 2 + 60, 15); }
    else {
      for (let i = 0; i < Math.min(lives, 5); i++) {
        ctx.fillStyle = "#cfd8e6"; ctx.beginPath(); ctx.arc(W / 2 + 64 + i * 11, 15, 4, 0, 7); ctx.fill();
      }
      if (lives > 5) { ctx.fillStyle = "#cfd8e6"; ctx.fillText("+" + (lives - 5), W / 2 + 118, 15); }
    }
  }
  // active timed powers, with a shrinking bar
  let px = WALL + 6;
  for (const k in timers) {
    if (timers[k] <= 0) continue;
    const p = POWERS[k];
    roundRect(px, TOP + 6, 30, 12, 6); ctx.fillStyle = p.good ? "rgba(47,191,74,.85)" : "rgba(224,65,47,.85)"; ctx.fill();
    ctx.fillStyle = "#fff"; ctx.font = "bold 9px ui-monospace, Menlo, monospace"; ctx.textAlign = "center";
    ctx.fillText(p.label, px + 15, TOP + 12.5);
    ctx.fillStyle = "rgba(255,255,255,.6)"; ctx.fillRect(px + 2, TOP + 20, 26 * (timers[k] / TIMED[k]), 2);
    px += 36;
  }
}

/* =====================================================================
   CONTROLS
   ===================================================================== */
const slider = $("slider"), fireBtn = $("fire"), dot = $("touchDot");
let slideId = null, lastX = 0, downX = 0, downT = 0;

// Slide area: works like a laptop trackpad. Moving your finger moves the bouncer
// by the same amount (times the speed setting), wherever you put your finger down.
slider.addEventListener("pointerdown", e => {
  e.preventDefault(); Sound.init();
  slideId = e.pointerId; try { slider.setPointerCapture(e.pointerId); } catch (err) {}
  lastX = downX = e.clientX; downT = performance.now();
  moveDot(e); dot.classList.add("on");
});
slider.addEventListener("pointermove", e => {
  if (e.pointerId !== slideId) return;
  const dx = e.clientX - lastX; lastX = e.clientX;
  movePaddle(dx * (W / slider.clientWidth) * SENS[settings.sens][1]);
  moveDot(e);
});
const endSlide = e => {
  if (e.pointerId !== slideId) return;
  slideId = null; dot.classList.remove("on");
  if (Math.abs(e.clientX - downX) < 10 && performance.now() - downT < 300) action();   // a quick tap = launch / fire
};
slider.addEventListener("pointerup", endSlide);
slider.addEventListener("pointercancel", endSlide);
function moveDot(e) { const r = slider.getBoundingClientRect(); dot.style.left = (e.clientX - r.left) + "px"; dot.style.top = (e.clientY - r.top) + "px"; }

// Fire button: launches the ball, releases a caught ball, and shoots (hold it down to keep shooting)
fireBtn.addEventListener("pointerdown", e => {
  e.preventDefault(); Sound.init();
  try { fireBtn.setPointerCapture(e.pointerId); } catch (err) {}
  fireHeld = true; fireBtn.classList.add("down"); action();
});
["pointerup", "pointercancel"].forEach(ev => fireBtn.addEventListener(ev, () => { fireHeld = false; fireBtn.classList.remove("down"); }));

// Mouse on a computer: the bouncer follows the mouse, click to launch / fire
view.addEventListener("pointermove", e => {
  if (e.pointerType !== "mouse") return;
  const r = view.getBoundingClientRect();
  movePaddle((e.clientX - r.left - offX) / scale - paddle.x);
});
view.addEventListener("pointerdown", e => { if (e.pointerType === "mouse") { Sound.init(); fireHeld = true; action(); } });
window.addEventListener("pointerup", e => { if (e.pointerType === "mouse") fireHeld = false; });

// Keyboard: arrows to move, space to launch / fire, P to pause
window.addEventListener("keydown", e => {
  keys[e.key] = true;
  if (e.key === " ") { e.preventDefault(); if (!e.repeat) { Sound.init(); fireHeld = true; action(); } }
  if (e.key === "p" || e.key === "Escape") togglePause();
});
window.addEventListener("keyup", e => { keys[e.key] = false; if (e.key === " ") fireHeld = false; });

// Stop the page zooming or scrolling while you play
["gesturestart", "gesturechange", "gestureend"].forEach(ev => document.addEventListener(ev, e => e.preventDefault(), { passive: false }));
document.addEventListener("touchmove", e => { if (!e.target.closest(".overlay")) e.preventDefault(); }, { passive: false });
let lastTouchEnd = 0;
document.addEventListener("touchend", e => { const now = Date.now(); if (now - lastTouchEnd < 350 && !e.target.closest(".overlay")) e.preventDefault(); lastTouchEnd = now; }, { passive: false });

/* =====================================================================
   MENUS
   ===================================================================== */
function hideOverlays() { ["menu", "pauseMenu", "overMenu"].forEach(id => $(id).hidden = true); }

function showMenu() {
  hideOverlays(); state = "menu"; Sound.stopMusic();
  startAt = clamp(startAt, 1, Math.min(reached, LEVELS.length));
  $("lvNum").textContent = startAt;
  $("scores").textContent = "Best: " + best.normal + "  |  EZ best: " + best.ez;
  levelIdx = startAt - 1; buildLevel(levelIdx); balls = []; caps = []; bolts = [];
  $("menu").hidden = false;
}

function togglePause() {
  if (state === "paused") { resume(); return; }
  if (state !== "play" && state !== "ready" && state !== "clear") return;
  pausedFrom = state; state = "paused"; fireHeld = false;
  Sound.stopMusic();
  $("pauseMenu").hidden = false;
}
function resume() {
  $("pauseMenu").hidden = true;
  state = pausedFrom;
  if (state !== "clear") Sound.startMusic(levelIdx);
}

function renderOpts() {
  document.querySelectorAll("[data-opt]").forEach(b => {
    const k = b.dataset.opt;
    b.textContent =
      k === "side" ? "Fire button: " + (settings.side === "right" ? "Right" : "Left") :
      k === "sens" ? "Slider speed: " + SENS[settings.sens][0] :
      k === "music" ? "Music: " + (settings.music ? "On" : "Off") :
      "Sounds: " + (settings.sfx ? "On" : "Off");
  });
  $("pad").classList.toggle("fire-left", settings.side === "left");
  Sound.setMusic(settings.music); Sound.setSfx(settings.sfx);
}
document.querySelectorAll("[data-opt]").forEach(b => b.addEventListener("click", () => {
  const k = b.dataset.opt;
  if (k === "side") settings.side = settings.side === "right" ? "left" : "right";
  if (k === "sens") settings.sens = (settings.sens + 1) % SENS.length;
  if (k === "music") settings.music = !settings.music;
  if (k === "sfx") settings.sfx = !settings.sfx;
  saveSettings(); renderOpts();
}));

$("playNormal").onclick = () => startGame("normal");
$("playEz").onclick = () => startGame("ez");
$("lvDown").onclick = () => { startAt = Math.max(1, startAt - 1); showMenu(); };
$("lvUp").onclick = () => { startAt = Math.min(Math.min(reached, LEVELS.length), startAt + 1); showMenu(); };
$("pauseBtn").addEventListener("pointerdown", e => { e.preventDefault(); togglePause(); });
$("resumeBtn").onclick = resume;
$("quitBtn").onclick = showMenu;
$("againBtn").onclick = () => startGame(mode);
$("menuBtn").onclick = showMenu;

// Pause automatically if you switch apps or lock the phone
document.addEventListener("visibilitychange", () => { if (document.hidden && (state === "play" || state === "ready")) togglePause(); });

/* =====================================================================
   MAIN LOOP — runs about 60 times a second
   ===================================================================== */
let lastT = 0, fireMode = "";
function frame(t) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.033, (t - lastT) / 1000 || 0);
  lastT = t;
  if (state === "ready" || state === "play" || state === "clear") update(dt);
  if (state !== "paused") updateParts(dt);
  draw();
  // Fire button label: LAUNCH when a ball is waiting, gold when the shooter is on
  const fm = balls.some(b => b.stuck) && (state === "ready" || state === "play") ? "launch" : timers.laser > 0 ? "armed" : "fire";
  if (fm !== fireMode) {
    fireMode = fm;
    fireBtn.classList.remove("launch", "armed");
    if (fm !== "fire") fireBtn.classList.add(fm);
    $("fireLabel").textContent = fm === "launch" ? "LAUNCH" : "FIRE";
  }
}

window.addEventListener("resize", resize);
renderOpts();
resize();
showMenu();
requestAnimationFrame(frame);

/* ---------- Offline + automatic updates (same as the other games) ---------- */
if ("serviceWorker" in navigator) {
  const had = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener("controllerchange", () => { if (had && state === "menu") location.reload(); });
  window.addEventListener("load", () => navigator.serviceWorker.register("../sw.js").then(reg => {
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") reg.update().catch(() => {}); });
  }).catch(() => {}));
}
