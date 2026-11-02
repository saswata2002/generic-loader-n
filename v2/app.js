// Rubik Loader — a 3 × 3 × 3 cube that turns its layers on a loop and lands solved every time.
// The move list is (R U R' U') × 6: that sequence has order 6, so after 24 turns every piece is
// home again and the loop is seamless. Drawn on a canvas with a small 3D renderer: each cubie is a
// black body with rounded stickers; faces are back-face culled and painted far-to-near.

const canvas = document.querySelector('canvas.cube');
const ctx = canvas.getContext('2d');

// ── look ───────────────────────────────────────────────────────────────────────────────────────
const COLORS = {            // classic scheme, yellow on top so the brightest face faces up
  '+y': '#FFD200', '-y': '#F1F2F4',
  '+z': '#E8322D', '-z': '#FF8A00',
  '+x': '#1F6FE5', '-x': '#14A35A',
};
const BODY = '#16161B';
const UNIT = 21;            // px per cubie (the cube is 3 units across) — 70% of the first 30 px
const STICKER = 0.84;       // sticker size within its face
const RADIUS = 0.13;        // sticker corner radius, in face units
const LIGHT = norm([-0.35, 0.85, 0.55]);   // view-space light, from the upper left

// ── timing ─────────────────────────────────────────────────────────────────────────────────────
const TURN = 0.3;           // seconds per quarter turn
const GAP = 0.06;           // pause between turns
const REST = 0.7;           // hold on the solved cube before the next loop
const SWAY = { yaw: 8, period: 6 };        // the whole cube sways a little, degrees / seconds
const BASE = { yaw: -38, pitch: 28 };      // three-quarter view: top, front and right faces showing

const MOVES = [];
for (let i = 0; i < 6; i++) MOVES.push(['x', 1, -1], ['y', 1, -1], ['x', 1, 1], ['y', 1, 1]);   // R U R' U'
const LOOP = MOVES.length * (TURN + GAP) + REST;

// ── vector helpers ─────────────────────────────────────────────────────────────────────────────
function norm(v) { const l = Math.hypot(...v); return v.map((x) => x / l); }
const AXIS = { x: 0, y: 1, z: 2 };
function rotate(v, axis, a) {          // rotate vector v about a world axis by angle a (radians)
  const c = Math.cos(a), s = Math.sin(a), [x, y, z] = v;
  if (axis === 'x') return [x, y * c - z * s, y * s + z * c];
  if (axis === 'y') return [x * c + z * s, y, -x * s + z * c];
  return [x * c - y * s, x * s + y * c, z];
}
const round = (v) => v.map((x) => Math.round(x));
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// ── the cube: 26 cubies, each with a position and its six faces (normal + tangents + colour) ──
const FACES = [
  ['+x', [1, 0, 0], [0, 1, 0], [0, 0, 1]], ['-x', [-1, 0, 0], [0, 1, 0], [0, 0, -1]],
  ['+y', [0, 1, 0], [0, 0, 1], [1, 0, 0]], ['-y', [0, -1, 0], [0, 0, 1], [-1, 0, 0]],
  ['+z', [0, 0, 1], [1, 0, 0], [0, 1, 0]], ['-z', [0, 0, -1], [-1, 0, 0], [0, 1, 0]],
];
const cubies = [];
for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) {
  if (!x && !y && !z) continue;
  const home = [x, y, z];
  cubies.push({
    pos: home.slice(),
    faces: FACES.map(([key, n, u, v]) => ({
      n, u, v,
      // a face carries a sticker only if it was on the outside of the solved cube
      color: home[AXIS[key[1]]] === (key[0] === '+' ? 1 : -1) ? COLORS[key] : null,
    })),
  });
}

/** Bake a finished quarter turn into the cubies of that layer (snapped to whole numbers). */
function applyTurn([axis, layer, dir]) {
  const a = (dir * Math.PI) / 2;
  for (const c of cubies) {
    if (c.pos[AXIS[axis]] !== layer) continue;
    c.pos = round(rotate(c.pos, axis, a));
    for (const f of c.faces) { f.n = round(rotate(f.n, axis, a)); f.u = round(rotate(f.u, axis, a)); f.v = round(rotate(f.v, axis, a)); }
  }
}

// ── camera ─────────────────────────────────────────────────────────────────────────────────────
let W = 375, H = 812, DPR = 1;
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 3);
  W = canvas.clientWidth || 375; H = canvas.clientHeight || 812;
  canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
}
resize();
if (window.ResizeObserver) new ResizeObserver(resize).observe(canvas); else addEventListener('resize', resize);

function viewOf(yawDeg, pitchDeg) {
  const yaw = (yawDeg * Math.PI) / 180, pitch = (pitchDeg * Math.PI) / 180;
  return (v) => rotate(rotate(v, 'y', yaw), 'x', pitch);   // world → view (camera looks down −z)
}
// A pinhole camera with a 220 mm lens on a full-frame sensor (36 mm across = the screen's width).
// Keeping the cube UNIT px per cubie at its centre fixes the camera distance: d = focal × W /
// (sensor × UNIT) — about 76 cubies at 375 px, so the perspective is the flat, compressed telephoto
// look (a wide lens would be ≈ 26 mm here and exaggerate the near corners).
const LENS = { focal: 220, sensor: 36 };   // mm
function project([x, y, z]) {
  const d = (LENS.focal * W) / (LENS.sensor * UNIT);
  const f = d / (d - z);
  return [W / 2 + x * UNIT * f, H / 2 - y * UNIT * f];
}

// ── drawing ────────────────────────────────────────────────────────────────────────────────────
function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (s) => Math.max(0, Math.min(255, Math.round(((n >> s) & 255) * k)));
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}
/** A rounded square on a face, as a polygon in world space: centre c, half-axes u, v. */
function roundedQuad(c, u, v, half, r) {
  const pts = [], steps = 4;
  const corners = [[1, 1, 0], [-1, 1, 1], [-1, -1, 2], [1, -1, 3]];
  for (const [sx, sy, q] of corners) {
    const cx = sx * (half - r), cy = sy * (half - r);
    for (let i = 0; i <= steps; i++) {
      const a = (q * Math.PI) / 2 + (i / steps) * (Math.PI / 2);
      const px = cx + r * Math.cos(a), py = cy + r * Math.sin(a);
      pts.push([c[0] + u[0] * px + v[0] * py, c[1] + u[1] * px + v[1] * py, c[2] + u[2] * px + v[2] * py]);
    }
  }
  return pts;
}
function fillPoly(points, color) {
  ctx.beginPath();
  points.forEach((p, i) => { const [x, y] = project(p); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
  ctx.closePath(); ctx.fillStyle = color; ctx.fill();
}

function drawCubie(c, view, turn) {
  const moving = turn && c.pos[AXIS[turn.axis]] === turn.layer;
  const tf = (v) => view(moving ? rotate(v, turn.axis, turn.angle) : v);
  const centre = tf(c.pos);
  const faces = [];
  for (const f of c.faces) {
    const n = tf(f.n);
    if (n[2] <= 0.001) continue;                           // facing away from the camera
    faces.push({ f, n, u: tf(f.u), v: tf(f.v) });
  }
  for (const { f, n, u, v } of faces) {
    const fc = [centre[0] + n[0] * 0.5, centre[1] + n[1] * 0.5, centre[2] + n[2] * 0.5];
    const body = [[1, 1], [-1, 1], [-1, -1], [1, -1]].map(([a, b]) =>
      [fc[0] + (u[0] * a + v[0] * b) * 0.5, fc[1] + (u[1] * a + v[1] * b) * 0.5, fc[2] + (u[2] * a + v[2] * b) * 0.5]);
    const lit = 0.72 + 0.28 * Math.max(0, n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]);
    fillPoly(body, shade(BODY, 0.9 + 0.25 * lit));
    if (f.color) fillPoly(roundedQuad(fc, u, v, STICKER / 2, RADIUS), shade(f.color, lit));
  }
}

function render(turn, yaw) {
  const view = viewOf(yaw, BASE.pitch);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, W, H);
  // painter's order: while a layer turns, draw the slab on the far side of the cut first, then the
  // near one; inside each slab, cubies far to near (they're convex, so that is enough)
  let groups = [cubies];
  if (turn) {
    const moving = cubies.filter((c) => c.pos[AXIS[turn.axis]] === turn.layer);
    const still = cubies.filter((c) => c.pos[AXIS[turn.axis]] !== turn.layer);
    const axisDir = [0, 0, 0]; axisDir[AXIS[turn.axis]] = turn.layer;
    const movingIsNear = view(axisDir)[2] > 0;
    groups = movingIsNear ? [still, moving] : [moving, still];
  }
  for (const g of groups) {
    const depth = (c) => {
      const moving = turn && c.pos[AXIS[turn.axis]] === turn.layer;
      return view(moving ? rotate(c.pos, turn.axis, turn.angle) : c.pos)[2];
    };
    [...g].sort((a, b) => depth(a) - depth(b)).forEach((c) => drawCubie(c, view, turn));
  }
}

// ── the loop ───────────────────────────────────────────────────────────────────────────────────
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let start = performance.now(), done = 0;     // `done` = turns already baked into the cubies
function frame(now) {
  let t = (now - start) / 1000;
  if (t >= LOOP) {                           // a full loop: the cube is solved again
    while (done < MOVES.length) applyTurn(MOVES[done++]);
    done = 0; start += LOOP * 1000; t -= LOOP;
  }
  const slot = TURN + GAP, i = Math.floor(t / slot), local = t - i * slot;
  while (done < Math.min(i, MOVES.length)) applyTurn(MOVES[done++]);
  let turn = null;
  if (i < MOVES.length && local < TURN) {
    const [axis, layer, dir] = MOVES[i];
    turn = { axis, layer, angle: (dir * Math.PI) / 2 * easeInOut(local / TURN) };
  } else if (i < MOVES.length && done === i) {
    applyTurn(MOVES[done++]);
  }
  const yaw = BASE.yaw + SWAY.yaw * Math.sin((2 * Math.PI * ((now / 1000) % SWAY.period)) / SWAY.period);
  render(turn, yaw);
  if (!reduceMotion) requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
