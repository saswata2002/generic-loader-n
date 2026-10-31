/* ══ phone.js — from the `vercel-sim-prototype` skill ═════════════════════════════════════════
   Load in <head>, right AFTER phone.css (a script after a stylesheet waits for it, so the frame
   size can be read before first paint):
     <link rel="stylesheet" href="(../)phone.css"><script src="(../)phone.js"></script>
   It does five things, the same on every page:
     1. vN/ opened without its trailing slash ("/v2"): the page's own relative files would load
        from the ROOT iteration (Vercel serves /v2 as v2/index.html without redirecting), so it
        re-opens /v2/.
     2. Where it runs → <html> classes, before first paint:
          is-phone   a phone, a Vercel Sim, or Chrome's device mode — the frame becomes the screen
          in-sim     a Vercel Sim: the iOS / Android apps (window.VercelSim, set at document start)
                     or the Mac app / DevTools device mode (Chromium with an iPhone user agent)
          is-desktop everything else — the 375 × 812 frame on a stage
          solo       ?solo=… in the URL (recordings, spec-sheet previews): no prototype tools
     3. A plain phone browser (not a Sim): lays the page out at 375 CSS px and scales it to the
        screen, the way the Sims do, so a 360 / 412 / 440-wide phone shows the design unchanged.
     4. Desktop: a window shorter than the frame shrinks the frame to fit (--frame-k).
        <html data-fit="off"> keeps it at 1:1.
     5. Haptics: window.haptic(kind) with iOS's vocabulary — selection · light · soft · medium ·
        rigid · heavy · success · warning · error — through the Vercel Sim's native bridge
        (webkit.messageHandlers.haptic: real UIFeedbackGenerator on iOS, the vibrator on Android),
        else navigator.vibrate (Android Chrome), else the iOS 18+ Safari switch tick. Any element
        with data-haptic="kind" buzzes the moment the finger lifts on it. */
(() => {
  const d = document.documentElement;
  const here = d.dataset.variant || '1';

  // 1 ─ trailing slash
  if (here !== '1' && !/\/$|\.html?$/i.test(location.pathname)) {
    location.replace(location.pathname + '/' + location.search + location.hash);
    return;
  }

  // 2 ─ where are we
  const ua = navigator.userAgent;
  const bridge = window.webkit && window.webkit.messageHandlers;
  const inApp = !!(window.VercelSim || (bridge && (bridge.__vsReady || bridge.__vsVibrate)));
  const chromiumIPhone = /iPhone|iPod/.test(ua) && !!navigator.userAgentData;      // Safari has no userAgentData
  const coarse = matchMedia('(pointer: coarse)').matches;
  const shortSide = Math.min(screen.width, screen.height);
  const inSim = inApp || chromiumIPhone;
  const isPhone = inSim || (coarse && shortSide <= 520);
  d.classList.add(isPhone ? 'is-phone' : 'is-desktop');
  if (inSim) d.classList.add('in-sim');
  if (/[?&]solo=/.test(location.search)) d.classList.add('solo');

  const css = getComputedStyle(d);
  const px = (name, dflt) => parseFloat(css.getPropertyValue(name)) || dflt;
  const FRAME_W = px('--frame-w', 375), FRAME_H = px('--frame-h', 812);

  // 3 ─ plain phone browser: lay out at the frame width, scaled to the screen
  const meta = document.querySelector('meta[name="viewport" i]');
  if (isPhone && !inSim && meta && !new RegExp(`width\\s*=\\s*${FRAME_W}\\b`).test(meta.content)) {
    let k = shortSide / FRAME_W, tries = 0;
    const set = () => { const s = k.toFixed(5); meta.content = `width=${FRAME_W}, initial-scale=${s}, minimum-scale=${s}, maximum-scale=${s}, user-scalable=no, viewport-fit=cover`; };
    set();
    // browsers snap the page scale, which can leave the layout at 374 or 376 — nudge until it reads 375
    const check = () => {
      const w = d.clientWidth;
      if (w === FRAME_W || tries++ >= 10) return;
      k *= w > FRAME_W ? 1.0004 : 0.9996; set(); requestAnimationFrame(check);
    };
    addEventListener('DOMContentLoaded', () => requestAnimationFrame(check), { once: true });
  }

  // 4 ─ desktop: fit a short window
  if (!isPhone && d.dataset.fit !== 'off') {
    const fit = () => d.style.setProperty('--frame-k', Math.max(0.5, Math.min(1, (innerHeight - 40) / FRAME_H, (innerWidth - 24) / FRAME_W)).toFixed(4));
    fit(); addEventListener('resize', fit);
  }

  // 5 ─ haptics
  const VIBRATE = { selection: 10, light: 14, soft: 12, medium: 22, rigid: 18, heavy: 32, success: [14, 70, 24], warning: [22, 90, 22], error: [24, 60, 24, 60, 24] };
  const TICKS = { heavy: [0, 28], success: [0, 90], warning: [0, 120], error: [0, 80, 160] };
  const isIOS = /iP(hone|ad|od)/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  let sw = null, last = 0;
  const tick = () => {
    if (!sw) {
      sw = document.createElement('label'); sw.setAttribute('aria-hidden', 'true');
      Object.assign(sw.style, { position: 'fixed', left: '-100px', top: '0', width: '1px', height: '1px', opacity: '0', pointerEvents: 'none', overflow: 'hidden' });
      const inp = document.createElement('input'); inp.type = 'checkbox'; inp.setAttribute('switch', ''); inp.tabIndex = -1;
      sw.append(inp); document.body.append(sw);
    }
    sw.click();
  };
  window.haptic = (kind = 'light') => {
    const now = performance.now();
    if (now - last < 28) return;                                    // two haptics this close feel like one buzz
    last = now;
    try {
      const h = window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.haptic;
      if (h) { h.postMessage(String(kind)); return; }
      if (!isIOS && navigator.vibrate) { if (!navigator.userActivation || navigator.userActivation.hasBeenActive) navigator.vibrate(VIBRATE[kind] ?? 10); return; }
      if (isIOS) (TICKS[kind] || [0]).forEach((ms) => (ms ? setTimeout(tick, ms) : tick()));
    } catch (_) { /* a nicety — never break the tap */ }
  };
  // [data-haptic] taps fire on the finger's lift (≤ 10px drift), not on the click a phone sends
  // 150–350ms later; that click is then skipped so the tap isn't felt twice. Mouse → click.
  let down = null, felt = null;
  const target = (el) => el && el.closest && el.closest('[data-haptic]');
  const fire = (el) => { if (el && !el.disabled && el.getAttribute('aria-disabled') !== 'true') window.haptic(el.dataset.haptic || 'light'); };
  document.addEventListener('pointerdown', (e) => { down = e.pointerType === 'mouse' || !e.isPrimary ? null : { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now() }; }, true);
  document.addEventListener('pointercancel', () => { down = null; }, true);
  document.addEventListener('pointerup', (e) => {
    const p = down; down = null;
    if (!p || e.pointerId !== p.id || Math.hypot(e.clientX - p.x, e.clientY - p.y) > 10 || performance.now() - p.t > 700) return;
    const el = target(e.target); if (!el) return;
    fire(el); felt = { el, t: performance.now() };
  }, true);
  document.addEventListener('click', (e) => {
    const el = target(e.target); if (!el) return;
    if (felt && felt.el === el && performance.now() - felt.t < 900) { felt = null; return; }
    fire(el);
  }, true);
})();
