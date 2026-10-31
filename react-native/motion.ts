// Timings and curves of the nano loader — the same numbers as ../app.css, written as plain functions
// so they can be tested without React Native. NanoLoader.tsx samples them into Animated
// interpolations; change a value here and in app.css together.

export type Curve = (t: number) => number;

/** CSS `cubic-bezier(x1, y1, x2, y2)`: solve x(u) = t for u, return y(u). */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): Curve {
  const bx = (u: number) => ((1 - 3 * x2 + 3 * x1) * u + (3 * x2 - 6 * x1)) * u * u + 3 * x1 * u;
  const by = (u: number) => ((1 - 3 * y2 + 3 * y1) * u + (3 * y2 - 6 * y1)) * u * u + 3 * y1 * u;
  const dx = (u: number) => (3 * (1 - 3 * x2 + 3 * x1) * u + 2 * (3 * x2 - 6 * x1)) * u + 3 * x1;
  return (t) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    let u = t;
    for (let i = 0; i < 8; i++) {                       // Newton–Raphson
      const err = bx(u) - t;
      if (Math.abs(err) < 1e-6) return by(u);
      const d = dx(u);
      if (Math.abs(d) < 1e-6) break;
      u -= err / d;
    }
    let lo = 0, hi = 1;                                 // fall back to bisection
    u = t;
    while (hi - lo > 1e-6) {
      if (bx(u) < t) lo = u; else hi = u;
      u = (lo + hi) / 2;
    }
    return by(u);
  };
}

export const linear: Curve = (t) => t;
/** ease-in-out sine — every segment of the float and the flicker uses it */
export const SINE = cubicBezier(0.37, 0, 0.63, 1);

/** A CSS-style keyframe track: [offset 0…1, value] stops, `ease` applied to every segment. */
export function track(stops: Array<[number, number]>, ease: Curve = linear): Curve {
  return (p) => {
    for (let i = 1; i < stops.length; i++) {
      const [a, va] = stops[i - 1];
      const [b, vb] = stops[i];
      if (p <= b) return b === a ? vb : va + (vb - va) * ease((p - a) / (b - a));
    }
    return stops[stops.length - 1][1];
  };
}

/** Letters: a smooth rise, then a subtle elastic settle — one small dip past rest, a faint spring
 *  back. Values in logo units; each letter starts `step` seconds after the one to its left. */
export const FLOAT = {
  period: 1.0,
  step: 0.09,
  translateY: track([[0, 0], [0.3, -7], [0.54, 0.56], [0.68, -0.35], [0.8, 0], [1, 0]], SINE),
  scaleX: track([[0, 1], [0.3, 0.995], [0.54, 1.01], [0.68, 1], [0.8, 1], [1, 1]], SINE),
  scaleY: track([[0, 1], [0.3, 1.012], [0.54, 0.99], [0.68, 1], [0.8, 1], [1, 1]], SINE),
};

/** Stars: dim and shrink, flash bright, settle — each star on its own period so they never sync. */
const FLICKER_AT = [0, 0.22, 0.34, 0.46, 0.58, 0.78, 1];
const zip = (vals: number[]) => FLICKER_AT.map((at, i): [number, number] => [at, vals[i]]);
export const FLICKER = {
  stars: [{ period: 1.7, delay: 0 }, { period: 2.3, delay: -0.9 }],
  scale: track(zip([1, 0.55, 1.12, 0.9, 1, 0.8, 1]), SINE),
  opacity: track(zip([1, 0.35, 1, 0.75, 1, 0.6, 1]), SINE),
};

/** Ripples: rings born at `fromRadius` (clear of the stars), growing linearly so they stay
 *  (toRadius − fromRadius) / count = 80px apart, faded out by 330px radius. In screen px. */
export const RIPPLE = {
  period: 5.48,
  count: 5,
  fromRadius: 130,
  toRadius: 530,
  strokeWidth: 0.9,
  maxOpacity: 0.9,
  radius: track([[0, 0], [1, 1]]),                      // 0…1 of the way from fromRadius to toRadius
  opacity: track([[0, 0], [0.08, 0.9], [0.5, 0], [1, 0]]),
};

/** Where an animation with CSS `animation-delay: delay` is in its cycle (0…1) at time t. */
export function phaseAt(t: number, period: number, delay = 0): number {
  const x = ((t - delay) / period) % 1;
  return x < 0 ? x + 1 : x;
}

/**
 * Samples `curve` over one cycle of a master clock that runs 0 → 1 every `period` seconds, for
 * Animated.interpolate. The curve starts `delay` seconds into its own cycle (CSS-style: negative
 * = already running); the sample at the wrap-around point is doubled so the jump stays exact.
 */
export function loopSamples(curve: Curve, period: number, delay = 0, samples = 48) {
  const offset = phaseAt(0, period, delay);            // the curve's own phase when the clock reads 0
  const wrap = offset === 0 ? 1 : 1 - offset;          // clock value where the curve starts over
  const phase = (p: number) => (p === wrap ? 0 : p > wrap ? p - wrap : offset + p);
  const inputs = new Set<number>([wrap, Math.max(0, wrap - 1e-4)]);
  for (let i = 0; i <= samples; i++) inputs.add(i / samples);
  const inputRange = [...inputs].sort((a, b) => a - b);
  // the clock's own 1 → 0 jump is invisible for looping curves; for a one-way curve (the ripple
  // radius) the doubled sample at `wrap` makes its restart instant instead of a quick rewind
  const outputRange = inputRange.map((p) => curve(p === 1 && wrap === 1 ? 1 : phase(p)));
  return { inputRange, outputRange };
}
