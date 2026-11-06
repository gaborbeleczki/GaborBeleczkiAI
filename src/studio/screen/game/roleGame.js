// "A day in the role": the platformer from the original portfolio (gaborbeleczki.com),
// adapted for the studio's display. Changes from the original: it can draw into a canvas it is
// given (no DOM host), take keys fed to it instead of listening on an element, and be stepped by
// its host (tick) instead of running its own requestAnimationFrame loop.

const T = 32, ROWS = 13, COLS = 122, GROUND = 11 * T, STEP = 1 / 120;
const C = { paper: '#f2f2f3', grid: 'rgba(29,31,32,0.06)', ink: '#1d2d3d', ink2: '#416180', mid: '#5980a6', soft: '#94bce3', pale: '#d6ebff', red: '#c8432b', coral: '#ff8a6e', gray: '#cfd0d3', dgray: '#3a3a3d', hatch: 'rgba(65,97,128,0.34)', gfill: '#e3e8ee' };
const SIGNS = [3, 29, 57, 85, 98], FLAGX = 113 * T + 16, HQX = 116 * T, HQW = 5 * T, HQH = 6 * T, HQDOOR = HQX + HQW / 2 - 10;
const COINS = [[5, 9], [6, 9], [7, 9], [25, 8], [26, 7], [27, 8], [33, 8], [34, 7], [35, 6], [38, 5], [39, 5], [43, 5], [44, 5], [46, 9], [47, 9], [48, 9],
  [52, 7], [53, 7], [60, 7], [66, 6], [69, 9], [70, 9], [71, 9], [74, 7], [82, 7], [83, 7], [88, 7], [89, 7], [92, 7], [93, 7], [96, 9], [97, 9],
  [106, 8], [107, 7], [108, 6], [109, 5], [110, 4]];
const MUS = ['Prompt biceps', 'Agentic shoulders', 'Context-window lats', 'Neural six-pack', 'Full-stack AI'];
const ISSUES = ['Pilot purgatory', 'Shadow AI', 'Licence, zero logins', '47-page risk form', 'Steering committee #6', 'Prompts saved in Word', 'Hallucinated citation', 'POC with no owner', 'Model retired mid-pilot', 'Data out of scope', 'Vendor demo ≠ production', 'Sign-off pending, week 9', 'Excel macro rebranded AI', 'Token budget exceeded', 'Use case: "add AI"', 'Approved for one team only'];
const sizeOf = L => ({ w: 20 + L * 1.6, h: 30 + L * 3 });
const FOES = [['box', 19, 10], ['bug', 45, 10], ['box', 58, 10], ['box', 70, 10], ['bug', 77, 10], ['bug', 90, 7], ['box', 96, 10], ['bug', 103, 10]];

function build() {
  const g = Array.from({ length: ROWS }, () => Array(COLS).fill(' '));
  const set = (x, y, c) => { if (x >= 0 && x < COLS && y >= 0 && y < ROWS) g[y][x] = c; };
  const ground = (a, b) => { for (let x = a; x <= b; x++) { set(x, 11, '#'); set(x, 12, '#'); } };
  const col = (x, h) => { for (let y = 11 - h; y < 11; y++) set(x, y, '#'); };
  const row = (a, b, y, c) => { for (let x = a; x <= b; x++) set(x, y, c); };
  ground(0, 24); ground(28, 50); ground(55, 80); ground(85, COLS - 1);
  set(9, 7, 'b'); set(10, 7, '0'); set(11, 7, 'B'); row(15, 16, 7, 'B');
  for (let i = 0; i < 4; i++) col(32 + i, i + 1);
  row(38, 44, 6, '='); set(40, 3, 'B'); set(41, 3, '1'); set(42, 3, 'b');
  row(52, 53, 8, '=');
  col(60, 2); col(66, 3); col(74, 2); set(62, 7, 'B'); set(63, 7, '2'); set(64, 7, 'b');
  row(82, 83, 8, '=');
  row(88, 93, 8, '='); set(90, 4, 'b'); set(91, 4, '3'); set(92, 4, 'B');
  set(100, 7, 'B'); set(101, 7, '4'); set(102, 7, 'B');
  for (let i = 0; i < 6; i++) col(105 + i, i + 1);
  return g;
}

function glyph(ctx, s, cx, cy, r) {
  ctx.beginPath();
  if (s === 'circle') ctx.arc(cx, cy, r, 0, Math.PI * 2);
  else if (s === 'square') ctx.rect(cx - r * 0.85, cy - r * 0.85, r * 1.7, r * 1.7);
  else {
    const P = s === 'diamond' ? [[0, -1.1], [1.1, 0], [0, 1.1], [-1.1, 0]] : s === 'tri' ? [[0, -1.1], [1.05, 0.8], [-1.05, 0.8]] : [0, 1, 2, 3, 4, 5].map(k => [Math.cos(Math.PI / 3 * k), Math.sin(Math.PI / 3 * k)]);
    P.forEach(([x, y], i) => (i ? ctx.lineTo(cx + x * r, cy + y * r) : ctx.moveTo(cx + x * r, cy + y * r)));
    ctx.closePath();
  }
  ctx.fill();
}

export function mount(host, opts) {
  const D = opts.duties, reduce = !!opts.reduce, wrap = opts.keyTarget || null;
  const own = !opts.canvas;
  const cv = opts.canvas || document.createElement('canvas');
  if (own) {
    cv.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;display:block';
    host.appendChild(cv);
  }
  const ctx = cv.getContext('2d');
  let cssW = 1, cssH = 1, dpr = 1, sc = 1, viewW = 1;
  const resize = () => {
    if (own) { cssW = Math.max(1, host.clientWidth); cssH = Math.max(1, host.clientHeight); dpr = Math.min(2, window.devicePixelRatio || 1); }
    else { cssW = opts.size.w; cssH = opts.size.h; dpr = 1; }
    cv.width = Math.round(cssW * dpr); cv.height = Math.round(cssH * dpr); sc = cssH / (ROWS * T); viewW = cssW / sc;
  };
  resize();

  let s = 7;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const ISQ = ISSUES.slice().sort(() => rnd() - 0.5); let iss = 0;
  const issue = () => ISQ[iss++ % ISQ.length];
  const sky = [];
  for (let i = 0; i < 46; i++) sky.push({ x: i * 110 + rnd() * 40, w: 46 + rnd() * 70, h: 50 + rnd() * 150 });

  let grid, crates, coins, foes, tokens, pops, parts, bumps, player, lives, nCoins, stomps, time, lastSec, phase = 'ready', camX = 0, shake = 0, checkpoint, reached, flagY, winT, tAnim = 0;
  const got = D.map(() => false);
  const keys = { left: false, right: false, jump: false, run: false };

  const hudEl = k => opts.hudRoot && opts.hudRoot.querySelector(`[data-g="${k}"]`);
  const fmt = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
  const hudCoins = () => { const e = hudEl('coins'); if (e) e.textContent = String(nCoins).padStart(3, '0'); };
  const hudLives = () => { const e = hudEl('lives'); if (e) e.textContent = String(Math.max(0, lives)); };
  const hudTime = () => { const e = hudEl('time'); if (e) e.textContent = fmt(time); };
  const stats = () => ({ got: got.filter(Boolean).length, coins: nCoins, stomps, time: fmt(time) });
  const notify = () => { if (opts.onPhase) opts.onPhase(phase, stats()); };

  function reset() {
    grid = build(); crates = [];
    grid.forEach((r, y) => r.forEach((c, x) => { if (/[0-4]/.test(c)) crates[+c] = [x, y]; }));
    got.forEach((g, i) => { if (g) grid[crates[i][1]][crates[i][0]] = 'U'; });
    coins = COINS.map(([x, y]) => ({ x: x * T + T / 2, y: y * T + T / 2, taken: false }));
    foes = FOES.map(([type, x, y]) => { const w = type === 'box' ? 26 : 24, h = type === 'box' ? 22 : 16; return { type, w, h, x: x * T + (T - w) / 2, y: (y + 1) * T - h, vx: type === 'box' ? -42 : -74, vy: 0, alive: true, dead: 0, flip: false, active: false, onGround: false, anim: rnd() * 6 }; });
    tokens = []; pops = []; parts = []; bumps = [];
    const L0 = got.filter(Boolean).length, sz = sizeOf(L0);
    player = { x: 2 * T, y: GROUND - sz.h, w: sz.w, h: sz.h, vx: 0, vy: 0, onGround: true, face: 1, coyote: 0, buffer: 0, inv: 0, anim: 0, squash: 0, hidden: false, lvl: L0, flex: 0, isP: true };
    lives = 3; nCoins = 0; stomps = 0; time = 0; lastSec = 0; camX = 0; checkpoint = 2 * T; reached = SIGNS.map((_, i) => i === 0); flagY = 2 * T + 8; winT = 0;
    hudCoins(); hudLives(); hudTime();
  }
  reset();

  const isSolid = c => c === '#' || c === '=' || c === 'B' || c === 'b' || c === 'U' || (c >= '0' && c <= '4');
  const solid = (cx, cy) => { if (cx < 0 || cx >= COLS) return true; if (cy < 0 || cy >= ROWS) return false; return isSolid(grid[cy][cx]); };

  function moveX(o, dx) {
    o.x += dx; o.hitWall = 0;
    const top = Math.floor(o.y / T), bot = Math.floor((o.y + o.h - 0.01) / T);
    if (dx > 0) { const cx = Math.floor((o.x + o.w) / T); for (let cy = top; cy <= bot; cy++) if (solid(cx, cy)) { o.x = cx * T - o.w; o.vx = o.isP ? 0 : o.vx; o.hitWall = 1; break; } }
    else if (dx < 0) { const cx = Math.floor(o.x / T); for (let cy = top; cy <= bot; cy++) if (solid(cx, cy)) { o.x = (cx + 1) * T; o.vx = o.isP ? 0 : o.vx; o.hitWall = -1; break; } }
  }
  function moveY(o, dy) {
    o.y += dy; o.onGround = false;
    const l = Math.floor(o.x / T), r = Math.floor((o.x + o.w - 0.01) / T);
    if (dy > 0) { const cy = Math.floor((o.y + o.h) / T); for (let cx = l; cx <= r; cx++) if (solid(cx, cy)) { o.y = cy * T - o.h; o.vy = 0; o.onGround = true; break; } }
    else if (dy < 0) {
      const cy = Math.floor(o.y / T); let hit = -1, best = 1e9;
      for (let cx = l; cx <= r; cx++) if (solid(cx, cy)) { const d = Math.abs(cx * T + T / 2 - (o.x + o.w / 2)); if (d < best) { best = d; hit = cx; } }
      if (hit >= 0) { o.y = (cy + 1) * T; o.vy = 0; if (o.isP) bump(hit, cy); }
    }
  }
  const boxSolid = (x, y, w, h) => { for (let cx = Math.floor(x / T); cx <= Math.floor((x + w - 0.01) / T); cx++) for (let cy = Math.floor(y / T); cy <= Math.floor((y + h - 0.01) / T); cy++) if (solid(cx, cy)) return true; return false; };
  function grow(p, dt) {
    const tg = sizeOf(p.lvl); if (p.w >= tg.w && p.h >= tg.h) return;
    const nw = Math.min(tg.w, p.w + 24 * dt), nh = Math.min(tg.h, p.h + 40 * dt), dw = nw - p.w, dh = nh - p.h;
    for (const [x, y] of [[p.x - dw / 2, p.y - dh], [p.x - dw / 2, p.y], [p.x - dw, p.y - dh], [p.x, p.y - dh]]) if (!boxSolid(x, y, nw, nh)) { p.x = x; p.y = y; p.w = nw; p.h = nh; return; }
  }
  function absorb(k) {
    const p = player; p.lvl = Math.min(5, p.lvl + 1); p.flex = 0.9; shake = 0.4;
    spark(p.x + p.w / 2, p.y + p.h * 0.4, C.coral, 18);
    pop(`+ ${MUS[p.lvl - 1]}`, p.x + p.w / 2, p.y - 10, C.red);
  }
  const spark = (x, y, c, n) => { if (reduce) return; for (let i = 0; i < n; i++) { const a = rnd() * Math.PI * 2, v = 60 + rnd() * 160; parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, life: 0.5 + rnd() * 0.4, c, s: 2 + rnd() * 3 }); } };
  const pop = (txt, x, y, c, strike) => pops.push({ txt, x, y, t: 0, c: c || C.ink2, strike: !!strike });

  function bump(cx, cy) {
    const c = grid[cy][cx];
    bumps.push({ cx, cy, t: 0 });
    if (c >= '0' && c <= '4') {
      const i = +c; grid[cy][cx] = 'U';
      tokens.push({ i, x: cx * T + 5, y: cy * T, y0: cy * T, t: 0, state: 'rise', taken: false });
      spark(cx * T + 16, cy * T, C.red, 10); shake = 0.5;
      if (!got[i]) { got[i] = true; pop(`Deliverable ${D[i].n}`, cx * T + 16, cy * T - 50, C.red); if (opts.onCollect) opts.onCollect(i); }
    } else if (c === 'b') {
      grid[cy][cx] = 'U'; nCoins++; hudCoins();
      pops.push({ coin: true, x: cx * T + 16, y: cy * T - 6, t: 0 }); pop('+1 use case', cx * T + 16, cy * T - 28);
    }
    foes.forEach(f => { if (f.alive && f.onGround && f.x + f.w > cx * T && f.x < cx * T + T && Math.abs(f.y + f.h - cy * T) < 3) { f.alive = false; f.flip = true; f.vy = -320; stomps++; pop(issue(), f.x + f.w / 2, f.y - 6, C.red, true); } });
  }

  function hurt(f) {
    lives--; hudLives(); shake = 0.8;
    if (lives <= 0) { shake = 0; phase = 'over'; clearKeys(); notify(); return; }
    const p = player; p.inv = 1.8; p.vy = -380; p.vx = (p.x + p.w / 2 < f.x + f.w / 2 ? -1 : 1) * 260;
  }
  function die() {
    lives--; hudLives();
    if (lives <= 0) { phase = 'over'; clearKeys(); notify(); return; }
    const p = player; p.x = checkpoint; p.y = GROUND - p.h - 2; p.vx = p.vy = 0; p.inv = 1.2;
    camX = Math.max(0, Math.min(COLS * T - viewW, p.x - viewW * 0.4));
  }

  function stepPlayer(dt) {
    const p = player, dir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0), maxv = keys.run ? 330 : 230, acc = p.onGround ? 2000 : 1300;
    if (dir) { p.vx += dir * acc * dt; if (Math.sign(p.vx) === -dir) p.vx += dir * 1500 * dt; p.face = dir; }
    else { const fr = (p.onGround ? 1900 : 450) * dt; p.vx = Math.abs(p.vx) <= fr ? 0 : p.vx - Math.sign(p.vx) * fr; }
    p.vx = Math.max(-maxv, Math.min(maxv, p.vx));
    p.coyote = p.onGround ? 0.09 : p.coyote - dt;
    p.buffer -= dt;
    if (p.buffer > 0 && p.coyote > 0) {
      p.vy = Math.abs(p.vx) > 260 ? -800 : -760; p.buffer = 0; p.coyote = 0; p.onGround = false;
      if (!reduce) for (let i = 0; i < 4; i++) parts.push({ x: p.x + p.w / 2, y: p.y + p.h, vx: (rnd() - 0.5) * 120, vy: -rnd() * 40, life: 0.3, c: C.gray, s: 3 });
    }
    if (!keys.jump && p.vy < -300) p.vy = -300;
    p.vy = Math.min(900, p.vy + (p.vy < 0 && keys.jump ? 1900 : 2600) * dt);
    grow(p, dt); p.flex = Math.max(0, p.flex - dt);
    const wasG = p.onGround, vyB = p.vy;
    moveX(p, p.vx * dt); moveY(p, p.vy * dt);
    if (!wasG && p.onGround && vyB > 420) { p.squash = 1; if (!reduce) for (let i = 0; i < 5; i++) parts.push({ x: p.x + p.w / 2, y: p.y + p.h, vx: (rnd() - 0.5) * 160, vy: -rnd() * 50, life: 0.35, c: C.gray, s: 3 }); }
    p.squash = Math.max(0, p.squash - dt * 6);
    p.anim += dt * Math.max(0.4, Math.abs(p.vx) / 230);
    p.inv = Math.max(0, p.inv - dt);
  }

  const over = (a, x, y, w, h) => a.x < x + w && a.x + a.w > x && a.y < y + h && a.y + a.h > y;

  function update(dt) {
    const p = player;
    if (phase === 'playing') {
      time += dt;
      if (Math.floor(time) !== lastSec) { lastSec = Math.floor(time); hudTime(); }
      stepPlayer(dt);
    } else if (phase === 'flag') {
      p.y = Math.min(GROUND - p.h, p.y + 300 * dt); flagY = Math.min(GROUND - 34, flagY + 300 * dt);
      if (p.y >= GROUND - p.h && flagY >= GROUND - 34) { phase = 'walk'; p.face = 1; p.onGround = true; }
    } else if (phase === 'walk') {
      p.vx = 140; p.x += p.vx * dt; p.anim += dt * 0.7; p.onGround = true;
      if (p.x > HQDOOR) { p.hidden = true; winT += dt; if (winT > 0.5) { phase = 'won'; notify(); } }
    }
    coins.forEach(c => { if (!c.taken && over(p, c.x - 7, c.y - 7, 14, 14)) { c.taken = true; nCoins++; hudCoins(); spark(c.x, c.y, C.soft, 6); } });
    tokens.forEach(k => {
      k.t += dt;
      if (k.state === 'rise') { k.y = k.y0 - Math.min(1, k.t / 0.45) * 36; if (k.t >= 0.6) { k.state = 'fly'; k.fx = k.x; k.fy = k.y; k.ft = 0; } }
      else {
        k.ft += dt; const u = reduce ? 1 : Math.min(1, k.ft / 0.35), e = u * u;
        k.x = k.fx + (p.x + p.w / 2 - 11 - k.fx) * e; k.y = k.fy + (p.y + p.h * 0.45 - 13 - k.fy) * e;
        if (u >= 1 && !k.taken) { k.taken = true; absorb(k); }
      }
    });
    tokens = tokens.filter(k => !k.taken);
    foes.forEach(f => {
      if (!f.active) { if (f.x < camX + viewW + 40) f.active = true; else return; }
      f.anim += dt;
      if (!f.alive) { f.dead += dt; if (f.flip) { f.vy += 2400 * dt; f.y += f.vy * dt; } return; }
      f.vy = Math.min(900, f.vy + 2400 * dt);
      moveX(f, f.vx * dt); if (f.hitWall) f.vx = -f.vx;
      moveY(f, f.vy * dt);
      if (f.onGround) { const ax = f.vx > 0 ? f.x + f.w + 1 : f.x - 1; if (!solid(Math.floor(ax / T), Math.floor((f.y + f.h + 2) / T))) f.vx = -f.vx; }
      if (f.y > ROWS * T + 50) f.alive = false;
      if (phase === 'playing' && over(p, f.x, f.y, f.w, f.h)) {
        if (p.vy > 60 && p.y + p.h - f.y < 15) { f.alive = false; f.dead = 0; stomps++; p.vy = keys.jump ? -640 : -440; spark(f.x + f.w / 2, f.y, C.dgray, 8); pop(issue(), f.x + f.w / 2, f.y - 10, C.red, true); }
        else if (p.inv <= 0) hurt(f);
      }
    });
    parts.forEach(q => { q.life -= dt; q.vy += 900 * dt; q.x += q.vx * dt; q.y += q.vy * dt; });
    parts = parts.filter(q => q.life > 0);
    pops.forEach(q => { q.t += dt; });
    pops = pops.filter(q => q.t < (q.coin ? 0.5 : q.strike ? 1.6 : 1));
    bumps.forEach(b => { b.t += dt; });
    bumps = bumps.filter(b => b.t < 0.2);
    if (phase === 'playing') {
      SIGNS.forEach((sx, i) => { if (!reached[i] && p.x > sx * T) { reached[i] = true; checkpoint = sx * T; pop('Checkpoint', sx * T + 16, GROUND - 74, C.ink2); } });
      if (p.x + p.w >= FLAGX) { phase = 'flag'; p.x = FLAGX - p.w + 2; p.vx = 0; p.vy = 0; clearKeys(); pop('HQ in sight', FLAGX, p.y - 20, C.red); }
      if (p.y > ROWS * T + 40) die();
    }
    const tgt = Math.max(0, Math.min(COLS * T - viewW, p.x + p.w / 2 - viewW * 0.4));
    camX = reduce ? tgt : camX + (tgt - camX) * Math.min(1, dt * 8);
    shake = Math.max(0, shake - dt * 3);
  }

  function drawSky(off) {
    ctx.lineWidth = 1.2 / sc; ctx.strokeStyle = '#b5d9fd'; ctx.fillStyle = 'rgba(214,235,255,0.45)';
    sky.forEach(b => {
      if (b.x + b.w < off - 50 || b.x > off + viewW + 50) return;
      ctx.fillRect(b.x, GROUND - b.h, b.w, b.h); ctx.strokeRect(b.x, GROUND - b.h, b.w, b.h);
      ctx.beginPath(); for (let y = GROUND - b.h + 14; y < GROUND - 8; y += 14) { ctx.moveTo(b.x + 8, y); ctx.lineTo(b.x + b.w - 8, y); } ctx.stroke();
    });
  }
  function drawGrid() {
    const x0 = Math.floor(camX / T) * T;
    ctx.strokeStyle = C.grid; ctx.lineWidth = 1 / sc; ctx.beginPath();
    for (let x = x0; x <= camX + viewW + T; x += T) { ctx.moveTo(x, 0); ctx.lineTo(x, ROWS * T); }
    for (let y = 0; y <= ROWS * T; y += T) { ctx.moveTo(x0, y); ctx.lineTo(camX + viewW + T, y); }
    ctx.stroke();
  }
  function drawSigns() {
    ctx.font = '600 10px "IBM Plex Mono", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    SIGNS.forEach((sx, i) => {
      const x = sx * T + 16; if (x < camX - 200 || x > camX + viewW + 200) return;
      const txt = `${D[i].n} · ${D[i].t}`.toUpperCase(), bw = ctx.measureText(txt).width + 18, on = reached[i];
      ctx.fillStyle = C.ink; ctx.fillRect(x - 1.5, GROUND - 46, 3, 46);
      ctx.fillStyle = on ? C.ink : '#fbfbfc'; ctx.fillRect(x - bw / 2, GROUND - 66, bw, 22);
      ctx.strokeStyle = C.ink; ctx.lineWidth = 1.5; ctx.strokeRect(x - bw / 2, GROUND - 66, bw, 22);
      ctx.fillStyle = on ? '#f5f5f8' : C.ink; ctx.fillText(txt, x, GROUND - 55);
    });
  }
  function drawHQ() {
    if (HQX > camX + viewW + 40) return;
    const y0 = GROUND - HQH;
    ctx.fillStyle = '#e9edf2'; ctx.fillRect(HQX, y0, HQW, HQH);
    ctx.save(); ctx.beginPath(); ctx.rect(HQX, y0, HQW, 22); ctx.clip();
    ctx.strokeStyle = C.hatch; ctx.lineWidth = 1.2; ctx.beginPath(); for (let x = HQX - 30; x < HQX + HQW; x += 8) { ctx.moveTo(x, y0 + 22); ctx.lineTo(x + 22, y0); } ctx.stroke(); ctx.restore();
    ctx.strokeStyle = C.ink; ctx.lineWidth = 2; ctx.strokeRect(HQX, y0, HQW, HQH); ctx.beginPath(); ctx.moveTo(HQX, y0 + 22); ctx.lineTo(HQX + HQW, y0 + 22); ctx.stroke();
    ctx.lineWidth = 1.4; ctx.strokeStyle = C.ink2;
    for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) ctx.strokeRect(HQX + 14 + c * 42, y0 + 36 + r * 34, 24, 20);
    ctx.fillStyle = C.ink; ctx.fillRect(HQX + HQW / 2 - 16, GROUND - 46, 32, 46);
    ctx.fillRect(HQX + 18, GROUND - 92, HQW - 36, 34);
    ctx.fillStyle = '#f5f5f8'; ctx.font = '13px "Saira Stencil One", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('END USER AI', HQX + HQW / 2, GROUND - 82); ctx.fillText('STRATEGY', HQX + HQW / 2, GROUND - 67);
    ctx.fillStyle = C.ink; ctx.fillRect(HQX + HQW - 30, y0 - 34, 2, 34);
    ctx.fillStyle = C.red; ctx.beginPath(); ctx.moveTo(HQX + HQW - 28, y0 - 34); ctx.lineTo(HQX + HQW - 8, y0 - 28); ctx.lineTo(HQX + HQW - 28, y0 - 22); ctx.fill();
  }
  function drawFlag() {
    if (FLAGX > camX + viewW + 40 || FLAGX < camX - 60) return;
    ctx.fillStyle = C.ink; ctx.fillRect(FLAGX - 1.5, 2 * T, 3, GROUND - 2 * T);
    ctx.beginPath(); ctx.arc(FLAGX, 2 * T, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(FLAGX - 10, GROUND - 10, 20, 10);
    ctx.fillStyle = C.red; ctx.beginPath(); ctx.moveTo(FLAGX - 2, flagY); ctx.lineTo(FLAGX - 32, flagY + 11); ctx.lineTo(FLAGX - 2, flagY + 22); ctx.fill();
  }
  function drawTiles() {
    const c0 = Math.max(0, Math.floor(camX / T) - 1), c1 = Math.min(COLS - 1, Math.ceil((camX + viewW) / T) + 1);
    const isG = (c, r) => r >= 0 && r < ROWS && c >= 0 && c < COLS && grid[r][c] === '#';
    ctx.beginPath(); let any = false;
    for (let c = c0; c <= c1; c++) for (let r = 0; r < ROWS; r++) if (grid[r][c] === '#') { ctx.rect(c * T, r * T, T, T); any = true; }
    if (any) {
      ctx.fillStyle = C.gfill; ctx.fill(); ctx.save(); ctx.clip();
      ctx.strokeStyle = C.hatch; ctx.lineWidth = 1.2; ctx.beginPath();
      for (let x = Math.floor((c0 * T - ROWS * T) / 10) * 10; x < (c1 + 1) * T; x += 10) { ctx.moveTo(x, ROWS * T); ctx.lineTo(x + ROWS * T, 0); }
      ctx.stroke(); ctx.restore();
      ctx.strokeStyle = C.ink; ctx.lineWidth = 2; ctx.beginPath();
      for (let c = c0; c <= c1; c++) for (let r = 0; r < ROWS; r++) if (grid[r][c] === '#') {
        const x = c * T, y = r * T;
        if (!isG(c, r - 1)) { ctx.moveTo(x, y); ctx.lineTo(x + T, y); }
        if (!isG(c - 1, r)) { ctx.moveTo(x, y); ctx.lineTo(x, y + T); }
        if (!isG(c + 1, r)) { ctx.moveTo(x + T, y); ctx.lineTo(x + T, y + T); }
      }
      ctx.stroke();
    }
    for (let c = c0; c <= c1; c++) for (let r = 0; r < ROWS; r++) {
      const ch = grid[r][c]; if (ch === ' ' || ch === '#') continue;
      const b = bumps.find(q => q.cx === c && q.cy === r), x = c * T, y = r * T - (b ? Math.sin(Math.PI * b.t / 0.2) * 8 : 0);
      ctx.lineWidth = 1.5; ctx.strokeStyle = C.ink;
      if (ch === '=') {
        ctx.fillStyle = '#c6d4e2'; ctx.fillRect(x, y, T, 14); ctx.strokeRect(x, y, T, 14);
        ctx.strokeStyle = C.ink2; ctx.lineWidth = 1; ctx.beginPath(); for (let k = 4; k < T; k += 8) { ctx.moveTo(x + k, y); ctx.lineTo(x + k, y + (k % 16 === 4 ? 6 : 4)); } ctx.stroke();
      } else if (ch === 'B' || ch === 'b') {
        ctx.fillStyle = '#dfe5ec'; ctx.fillRect(x, y, T, T); ctx.strokeRect(x + 0.75, y + 0.75, T - 1.5, T - 1.5);
        ctx.lineWidth = 1; ctx.strokeStyle = C.mid; ctx.beginPath(); ctx.moveTo(x, y + 16); ctx.lineTo(x + T, y + 16); ctx.moveTo(x + 16, y); ctx.lineTo(x + 16, y + 16); ctx.moveTo(x + 8, y + 16); ctx.lineTo(x + 8, y + T); ctx.moveTo(x + 24, y + 16); ctx.lineTo(x + 24, y + T); ctx.stroke();
      } else if (ch === 'U') {
        ctx.fillStyle = '#b9babd'; ctx.fillRect(x, y, T, T); ctx.strokeStyle = C.dgray; ctx.strokeRect(x + 0.75, y + 0.75, T - 1.5, T - 1.5);
        ctx.strokeStyle = 'rgba(29,31,32,0.25)'; ctx.strokeRect(x + 5, y + 5, T - 10, T - 10);
      } else {
        const i = +ch, blink = reduce ? 1 : 0.55 + 0.45 * Math.sin(tAnim * 5 + i);
        ctx.fillStyle = C.ink; ctx.fillRect(x, y, T, T); ctx.strokeStyle = C.mid; ctx.strokeRect(x + 3.5, y + 3.5, T - 7, T - 7);
        ctx.fillStyle = '#f5f5f8'; ctx.font = '14px "Saira Stencil One", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(D[i].n, x + 16, y + 17);
        ctx.fillStyle = `rgba(255,138,110,${blink.toFixed(2)})`; ctx.fillRect(x + 3, y + 3, 5, 5);
      }
    }
  }
  function drawCoins() {
    coins.forEach(c => {
      if (c.taken || c.x < camX - 20 || c.x > camX + viewW + 20) return;
      const w = reduce ? 6 : Math.abs(Math.cos(tAnim * 4 + c.x * 0.05)) * 6 + 1.2;
      ctx.fillStyle = C.soft; ctx.strokeStyle = C.ink2; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(c.x, c.y, w, 7.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(c.x, c.y - 3.5); ctx.lineTo(c.x, c.y + 3.5); ctx.stroke();
    });
    pops.forEach(q => { if (!q.coin) return; const u = q.t / 0.5; ctx.globalAlpha = 1 - u; ctx.fillStyle = C.soft; ctx.strokeStyle = C.ink2; ctx.beginPath(); ctx.ellipse(q.x, q.y - u * 40, 6, 7.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.globalAlpha = 1; });
  }
  function drawTokens() {
    tokens.forEach(k => {
      const cx = k.x + 11, cy = k.y + 13, r = 18 + (reduce ? 0 : Math.sin(k.t * 5) * 2.5);
      ctx.strokeStyle = `rgba(200,67,43,0.55)`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#ffffff'; ctx.strokeStyle = C.ink; ctx.beginPath(); ctx.moveTo(k.x, k.y); ctx.lineTo(k.x + 15, k.y); ctx.lineTo(k.x + 22, k.y + 7); ctx.lineTo(k.x + 22, k.y + 26); ctx.lineTo(k.x, k.y + 26); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(k.x + 15, k.y); ctx.lineTo(k.x + 15, k.y + 7); ctx.lineTo(k.x + 22, k.y + 7); ctx.stroke();
      ctx.fillStyle = C.ink; glyph(ctx, D[k.i].s, cx, cy + 2, 5.5);
      ctx.fillStyle = C.red; ctx.font = '600 10px "IBM Plex Mono", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillText(D[k.i].n, cx, k.y - 7);
    });
  }
  function drawFoes() {
    foes.forEach(f => {
      if (f.x < camX - 40 || f.x > camX + viewW + 40) return;
      if (!f.alive && !f.flip && f.dead > 0.5) return;
      if (!f.alive && f.flip && f.y > ROWS * T + 40) return;
      ctx.save(); ctx.translate(f.x + f.w / 2, f.y + f.h);
      if (f.flip) { ctx.translate(0, -f.h / 2); ctx.scale(1, -1); ctx.translate(0, f.h / 2); }
      const dir = f.vx > 0 ? 1 : -1, step = reduce ? 0 : Math.sin(f.anim * 10);
      ctx.lineWidth = 1.5;
      if (f.type === 'box') {
        const hh = !f.alive && !f.flip ? 7 : f.h;
        ctx.fillStyle = C.ink; ctx.fillRect(-11 + step * 2, -3, 7, 3); ctx.fillRect(4 - step * 2, -3, 7, 3);
        ctx.fillStyle = '#e4e4e6'; ctx.strokeStyle = C.dgray; ctx.fillRect(-13, -hh - 2, 26, hh - 1); ctx.strokeRect(-13, -hh - 2, 26, hh - 1);
        if (hh > 10) {
          ctx.fillStyle = C.soft; ctx.fillRect(-13, -hh + 8, 26, 4);
          ctx.fillStyle = '#ffffff'; ctx.fillRect(-8, -hh + 1, 6, 6); ctx.fillRect(2, -hh + 1, 6, 6);
          ctx.fillStyle = C.ink; ctx.fillRect(-6 + dir * 1.5, -hh + 3, 2.5, 2.5); ctx.fillRect(4 + dir * 1.5, -hh + 3, 2.5, 2.5);
          ctx.strokeStyle = C.dgray; ctx.beginPath(); ctx.moveTo(-13, -hh - 2); ctx.lineTo(-7, -hh - 7); ctx.moveTo(13, -hh - 2); ctx.lineTo(7, -hh - 7); ctx.stroke();
        }
      } else {
        const sq = !f.alive && !f.flip ? 0.4 : 1;
        ctx.strokeStyle = '#7a2414'; ctx.beginPath();
        for (let k = -1; k <= 1; k++) { const o = (k % 2 ? step : -step) * 2; ctx.moveTo(k * 6, -6 * sq); ctx.lineTo(k * 6 - 4 + o, 0); ctx.moveTo(k * 6, -6 * sq); ctx.lineTo(k * 6 + 4 - o, 0); }
        ctx.stroke();
        ctx.fillStyle = C.red; ctx.beginPath(); ctx.ellipse(0, -9 * sq, 12, 7 * sq, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#a3321d'; ctx.beginPath(); ctx.arc(dir * 11, -10 * sq, 5 * sq, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#7a2414'; ctx.beginPath(); ctx.moveTo(-2, -16 * sq); ctx.lineTo(2, -2 * sq); ctx.stroke();
        if (sq === 1) { ctx.fillStyle = '#ffffff'; ctx.fillRect(dir * 12 - 1, -12, 2.5, 2.5); ctx.beginPath(); ctx.strokeStyle = '#7a2414'; ctx.moveTo(dir * 13, -14); ctx.lineTo(dir * 18, -20); ctx.stroke(); }
      }
      ctx.restore();
    });
  }
  function limb(S, E, H, th, L) {
    const skin = '#eccbb0';
    ctx.lineCap = 'butt'; ctx.lineJoin = 'round'; ctx.strokeStyle = L ? skin : '#2c455d'; ctx.lineWidth = th;
    ctx.beginPath(); ctx.moveTo(S[0], S[1]); ctx.lineTo(E[0], E[1]); ctx.lineTo(H[0], H[1]); ctx.stroke();
    if (L > 0) {
      const ux = E[0] - S[0], uy = E[1] - S[1], ul = Math.hypot(ux, uy) || 1;
      let nx = -uy / ul, ny = ux / ul;
      if (nx * Math.sign(S[0]) < 0 || (Math.abs(nx) < 0.3 && ny > 0)) { nx = -nx; ny = -ny; }
      const rb = 0.9 + L * 0.55, bx = (S[0] + E[0]) / 2 + nx * th * 0.35, by = (S[1] + E[1]) / 2 + ny * th * 0.35;
      ctx.fillStyle = skin; ctx.beginPath(); ctx.ellipse(bx, by, ul / 2 + 0.6, th / 2 + rb * 0.6, Math.atan2(uy, ux), 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = C.mid; ctx.lineWidth = 0.6; ctx.beginPath();
      ctx.moveTo(S[0], S[1]); ctx.lineTo(bx + nx * rb * 0.55, by + ny * rb * 0.55); ctx.lineTo(E[0], E[1]); ctx.stroke();
      const on = reduce ? 1 : 0.5 + 0.5 * Math.sin(tAnim * 6 + S[0]);
      ctx.fillStyle = `rgba(255,138,110,${(0.45 + on * 0.55).toFixed(2)})`; ctx.fillRect(E[0] - 1.1, E[1] - 1.1, 2.2, 2.2);
      ctx.fillStyle = '#2c455d'; ctx.fillRect(S[0] - th / 2 - 0.5, S[1] - 1.5, th + 1, 3);
    }
    ctx.fillStyle = skin; ctx.fillRect(H[0] - 1.6, H[1] - 1.6, 3.2, 3.2);
  }
  function drawPlayer() {
    const p = player;
    if (p.hidden || (p.inv > 0 && !reduce && Math.floor(p.inv * 12) % 2 === 0)) return;
    const run = p.onGround && Math.abs(p.vx) > 15, sw = run && !reduce ? Math.sin(p.anim * 12) : 0, air = !p.onGround && phase !== 'walk', flex = p.flex > 0 && !air;
    const L = p.lvl, g = p.h / 30, m = Math.min(3, L), th = L ? 4 + L * 0.4 : 4;
    ctx.save(); ctx.translate(p.x + p.w / 2, p.y + p.h);
    const sq = p.squash * 0.18; ctx.scale(p.face * (1 + sq) * g, (1 - sq) * g);
    if (L >= 5) {
      const pu = reduce ? 0 : Math.sin(tAnim * 4) * 1.5;
      ctx.strokeStyle = 'rgba(255,138,110,0.55)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(0, -17, 17 + pu, 20 + pu, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = C.coral; for (let k = 0; k < 3; k++) { const a = (reduce ? 0 : tAnim * 2) + k * 2.094; ctx.fillRect(Math.cos(a) * (17 + pu) - 1.5, -17 + Math.sin(a) * (20 + pu) - 1.5, 3, 3); }
    }
    let F, B;
    if (flex) { F = [[7 + m, -20], [12 + m, -21], [12 + m, -28]]; B = [[-7 - m, -20], [-12 - m, -21], [-12 - m, -28]]; }
    else if (air) { F = [[6 + m, -21], [8 + m, -26], [7 + m, -31]]; B = [[-6 - m, -20], [-9 - m, -17], [-10 - m, -13]]; }
    else { F = [[6 + m, -20], [6 + m - sw * 1.2, -15.5], [6 + m - sw * 2.5, -11]]; B = [[-6 - m, -20], [-6 - m + sw * 1.2, -15.5], [-6 - m + sw * 2.5, -11]]; }
    ctx.fillStyle = C.ink;
    if (air) { ctx.fillRect(-7, -12, 5, 9); ctx.fillRect(2, -10, 5, 9); }
    else { ctx.fillRect(-6 + sw * 3, -10, 5, 10); ctx.fillRect(1 - sw * 3, -10, 5, 10); }
    limb(B[0], B[1], B[2], th, L);
    ctx.fillStyle = C.ink2; ctx.beginPath(); ctx.moveTo(-7 - m, -22); ctx.lineTo(8 + m, -22); ctx.lineTo(8 + m * 0.3, -9); ctx.lineTo(-7 - m * 0.3, -9); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#f5f5f8'; ctx.fillRect(-1, -22, 4, 4);
    if (L >= 4) { ctx.fillStyle = C.soft; for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) ctx.fillRect(-2.3 + c * 3.4, -17 + r * 2.8, 2.6, 2.1); }
    else { ctx.fillStyle = C.red; ctx.fillRect(0, -19, 2.5, 9); }
    if (L >= 2) { ctx.fillStyle = C.soft; ctx.fillRect(-6 - m * 0.5, -20, 4, 4); ctx.fillStyle = C.ink; ctx.fillRect(-5 - m * 0.5, -19, 2, 2); }
    limb(F[0], F[1], F[2], th, L);
    ctx.fillStyle = '#eccbb0'; ctx.fillRect(-6, -32, 13, 10);
    ctx.fillStyle = C.ink; ctx.fillRect(-7, -34, 14, 4); ctx.fillRect(-7, -32, 3, 5);
    ctx.fillRect(3, -28, 2, 2.5);
    ctx.strokeStyle = C.ink; ctx.lineWidth = 1; ctx.strokeRect(1.5, -29.5, 5, 4);
    if (L >= 3) { ctx.fillStyle = C.red; ctx.fillRect(-7, -31.2, 14, 1.6); ctx.fillStyle = reduce || Math.sin(tAnim * 5) > 0 ? C.coral : C.red; ctx.fillRect(-8, -32, 3, 3); }
    ctx.restore();
  }
  function drawFx() {
    parts.forEach(q => { ctx.globalAlpha = Math.max(0, Math.min(1, q.life * 2)); ctx.fillStyle = q.c; ctx.fillRect(q.x - q.s / 2, q.y - q.s / 2, q.s, q.s); });
    ctx.globalAlpha = 1;
    ctx.font = '600 10px "IBM Plex Mono", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    pops.forEach(q => {
      if (q.coin) return;
      const life = q.strike ? 1.6 : 1, y = q.y - q.t * (q.strike ? 18 : 26), txt = q.txt.toUpperCase();
      ctx.globalAlpha = Math.max(0, 1 - q.t / life); ctx.fillStyle = q.c; ctx.fillText(txt, q.x, y);
      if (q.strike && q.t > 0.35) { const tw = ctx.measureText(txt).width + 6, u = Math.min(1, (q.t - 0.35) / 0.3); ctx.fillRect(q.x - tw / 2, y - 4.5, tw * u, 1.5); }
    });
    ctx.globalAlpha = 1;
  }
  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = C.paper; ctx.fillRect(0, 0, cssW, cssH);
    const live = phase === 'playing' || phase === 'flag' || phase === 'walk', k = dpr * sc, sx = reduce || !live || shake <= 0 ? 0 : (rnd() - 0.5) * shake * 8 * dpr;
    ctx.setTransform(k, 0, 0, k, -camX * 0.35 * k + sx, 0); drawSky(camX * 0.35);
    ctx.setTransform(k, 0, 0, k, -camX * k + sx, 0);
    drawGrid(); drawSigns(); drawHQ(); drawFlag(); drawTiles(); drawCoins(); drawTokens(); drawFoes(); drawPlayer(); drawFx();
  }

  const KEYS = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'jump', KeyW: 'jump', Space: 'jump', KeyZ: 'jump', ShiftLeft: 'run', ShiftRight: 'run', KeyX: 'run' };
  const clearKeys = () => { keys.left = keys.right = keys.jump = keys.run = false; };
  const onDown = e => {
    if (e.code === 'Enter') { e.preventDefault(); if (phase === 'paused') api.resume(); else if (phase !== 'playing' && phase !== 'flag' && phase !== 'walk') api.start(); return; }
    if (e.code === 'Escape' || e.code === 'KeyP') { if (phase === 'playing') api.pause(); else if (phase === 'paused') api.resume(); return; }
    const k = KEYS[e.code];
    if (!k || phase !== 'playing') return;
    e.preventDefault();
    if (k === 'jump' && !keys.jump) player.buffer = 0.12;
    keys[k] = true;
  };
  const onUp = e => { const k = KEYS[e.code]; if (k) { keys[k] = false; if (phase === 'playing') e.preventDefault(); } };
  const onOut = e => { if (phase === 'playing' && !wrap.contains(e.relatedTarget)) api.pause(); };
  if (wrap) { wrap.addEventListener('keydown', onDown); wrap.addEventListener('keyup', onUp); wrap.addEventListener('focusout', onOut); }

  let visible = true;
  const io = own ? new IntersectionObserver(es => { visible = es[0].isIntersecting; if (!visible && phase === 'playing') api.pause(); }, { threshold: 0.15 }) : null;
  if (io) io.observe(host);
  const ro = own ? new ResizeObserver(() => { resize(); draw(); }) : null;
  if (ro) ro.observe(host);

  let raf = 0, last = performance.now(), acc = 0;
  function step(dt) {
    if (phase === 'playing' || phase === 'flag' || phase === 'walk') { acc += dt; while (acc >= STEP) { update(STEP); acc -= STEP; } }
    else acc = 0;
    tAnim += dt;
    draw();
  }
  function loop(now) {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000)); last = now;
    if (!visible) return;
    step(dt);
  }
  if (!opts.manual) raf = requestAnimationFrame(loop);

  const focus = () => { if (!wrap) return; try { wrap.focus({ preventScroll: true }); } catch (e) { wrap.focus(); } };
  const api = {
    start() { if (phase === 'over' || phase === 'won') reset(); phase = 'playing'; clearKeys(); focus(); notify(); },
    resume() { if (phase === 'paused') { phase = 'playing'; focus(); notify(); } },
    pause() { if (phase === 'playing') { phase = 'paused'; clearKeys(); notify(); } },
    restart() { reset(); phase = 'playing'; clearKeys(); focus(); notify(); },
    press(k, down) { if (phase !== 'playing') return; if (k === 'jump' && down && !keys.jump) player.buffer = 0.12; keys[k] = down; },
    reveal() {
      got.fill(true); crates.forEach(([x, y]) => { if (grid[y][x] !== 'U') grid[y][x] = 'U'; }); tokens = [];
      const p = player, z = sizeOf(5); p.y += p.h - z.h; p.x -= (z.w - p.w) / 2; p.w = z.w; p.h = z.h; p.lvl = 5;
    },
    /** host-driven stepping (opts.manual) */
    tick(dt) { step(Math.min(0.1, Math.max(0, dt))); },
    /** host-fed keys (no keyTarget); returns true when the game used the key */
    key(e, down) {
      if (down) { const was = phase; onDown(e); return e.code === 'Enter' || e.code === 'Escape' || e.code === 'KeyP' || (was === 'playing' && !!KEYS[e.code]); }
      onUp(e); return !!KEYS[e.code];
    },
    get phase() { return phase; },
    player() { return { x: player.x, y: player.y, lvl: player.lvl }; },
    stats() { return stats(); },
    destroy() {
      cancelAnimationFrame(raf); if (io) io.disconnect(); if (ro) ro.disconnect();
      if (wrap) { wrap.removeEventListener('keydown', onDown); wrap.removeEventListener('keyup', onUp); wrap.removeEventListener('focusout', onOut); }
      if (own) cv.remove();
    }
  };
  return api;
}
