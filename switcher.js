/* ══ Iteration tab (prototype tool) — from the `vercel-sim-prototype` skill ════════════════════
   Each iteration is its OWN copy of the flow so they can be changed independently:
   1 = the project root, n = vn/ (each with its own index.html and its own JS/CSS; assets, fonts and
   this switcher are shared). The page's iteration is <html data-variant="n">; picking another number
   opens that copy, ?v=n jumps straight to iteration n. The options are read from the buttons, so this
   file never changes when iterations are added or removed. Paths are relative (any base path).
   The Vercel Sims press these same buttons (element.click()), so their picker runs this code too. */
(() => {
  const nav = document.getElementById('vswitch'); if (!nav) return;
  const here = document.documentElement.dataset.variant || '1';
  const root = here === '1' ? './' : '../';
  const path = (n) => (String(n) === '1' ? root : `${root}v${n}/`);
  const opts = [...nav.querySelectorAll('.vswitch__b[data-v]')];
  const want = new URLSearchParams(location.search).get('v');
  if (want && want !== here && opts.some((b) => b.dataset.v === want)) { location.replace(path(want)); return; }
  opts.forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.v === here));
    b.addEventListener('click', () => { if (b.dataset.v !== here) location.href = path(b.dataset.v); });
  });
  // Reset: a clean restart of this iteration (a fresh load). The icon turns first so the press reads.
  const reset = document.getElementById('vreset');
  if (reset) reset.addEventListener('click', () => {
    reset.classList.add('is-spinning');
    setTimeout(() => location.replace(path(here)), 260);
  });
  // Spec Sheet (the spec-sheet skill's page): the motion spec, opened on this iteration
  const spec = document.getElementById('vspec');
  if (spec) spec.addEventListener('click', () => { location.href = `${root}spec/?v=${here}`; });
})();
