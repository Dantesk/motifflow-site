/* ==========================================================================
   CONFIG — edit these before launch.
   checkoutUrl:      Lemon Squeezy / Paddle / Stripe checkout link. While empty,
                     "Buy" buttons just scroll to the pricing card (#buy).
   trialDownloadMac: direct link to the macOS trial installer (.dmg / .pkg).
   trialDownloadWin: direct link to the Windows trial installer (.exe / .msi).
   ========================================================================== */
const CONFIG = {
  checkoutUrl: '',       // e.g. 'https://motifflow.lemonsqueezy.com/checkout/buy/XXXX'
  trialDownloadMac: '',  // e.g. 'https://downloads.example.com/MotifFlow-Trial.dmg'
  trialDownloadWin: '',  // e.g. 'https://downloads.example.com/MotifFlow-Trial-Setup.exe'
};

document.documentElement.classList.add('js');

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- i18n ---------- */
const store = {
  get(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* storage unavailable */ } },
};
const dict = window.MF_I18N || { it: {}, en: {} };
const i18nEls = Array.from(document.querySelectorAll('[data-i18n]'));
// capture the English copy straight from the HTML so it never drifts
const en = Object.assign({}, dict.en || {});
i18nEls.forEach((el) => { const k = el.dataset.i18n; if (!(k in en)) en[k] = el.innerHTML; });
en['meta.title'] = document.title;
let lang = 'en';

function t(key) { return (lang === 'it' && dict.it[key]) || en[key] || key; }

function applyLang(next) {
  lang = next === 'it' ? 'it' : 'en';
  document.documentElement.lang = lang;
  i18nEls.forEach((el) => { el.innerHTML = t(el.dataset.i18n); });
  document.title = t('meta.title');
  document.querySelectorAll('[data-lang]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
  store.set('mf-lang', lang);
  updateReadout(true);
}
document.querySelectorAll('[data-lang]').forEach((b) => b.addEventListener('click', () => applyLang(b.dataset.lang)));

/* ---------- checkout + trial ---------- */
document.querySelectorAll('[data-checkout]').forEach((a) => {
  a.addEventListener('click', (e) => {
    if (!CONFIG.checkoutUrl) return; // falls back to #buy anchor
    e.preventDefault();
    window.location.href = CONFIG.checkoutUrl;
  });
});
document.querySelectorAll('[data-trial]').forEach((a) => {
  const url = a.dataset.trial === 'mac' ? CONFIG.trialDownloadMac : CONFIG.trialDownloadWin;
  if (url) { a.href = url; return; }
  a.addEventListener('click', (e) => {
    e.preventDefault();
    const note = document.getElementById('trialNote');
    if (note) note.hidden = false;
  });
});

/* ---------- nav state ---------- */
const nav = document.getElementById('nav');

/* ---------- scroll reveal ---------- */
const reveals = document.querySelectorAll('.reveal');
if ('IntersectionObserver' in window && !reducedMotion) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
  reveals.forEach((el) => io.observe(el));
} else {
  reveals.forEach((el) => el.classList.add('in'));
}

/* ---------- scroll → story progress ----------
   Each section carries data-act (0..4). When a section's centre crosses the
   viewport centre the scene sits exactly on that act; in between we interpolate. */
const actSections = Array.from(document.querySelectorAll('[data-act]'));
const SIDE = { top: 1, how: 0.3, neural: 1, variations: 0.65, style: -1, music: 1, workflow: 1, features: 0, pricing: -0.7, faq: 0 };
let keys = [];
function measure() {
  keys = actSections.map((s) => {
    const r = s.getBoundingClientRect();
    return {
      y: r.top + window.scrollY + r.height / 2,
      act: parseFloat(s.dataset.act),
      side: SIDE[s.id] ?? 0,
      name: s.dataset.actName,
    };
  });
  keys[0].y = Math.min(keys[0].y, window.innerHeight / 2); // hero is "on" at the very top
}
function progressAt(y) {
  if (y <= keys[0].y) return { act: keys[0].act, side: keys[0].side, k: 0 };
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i], b = keys[i + 1];
    if (y <= b.y) {
      const f = (y - a.y) / Math.max(1, b.y - a.y);
      return { act: a.act + (b.act - a.act) * f, side: a.side + (b.side - a.side) * f, k: f < 0.5 ? i : i + 1 };
    }
  }
  const l = keys[keys.length - 1];
  return { act: l.act, side: l.side, k: keys.length - 1 };
}

/* DAW-style readout: bar.beat.sixteenth from page position */
const posEl = document.getElementById('transportPos');
const actEl = document.getElementById('transportAct');
let lastName = '';
function updateReadout(force) {
  const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  const frac = Math.min(1, Math.max(0, window.scrollY / max));
  const six = Math.floor(frac * 64 * 16);
  const bar = Math.floor(six / 16) + 1, beat = Math.floor((six % 16) / 4) + 1, st = (six % 4) + 1;
  if (posEl) posEl.textContent = `${String(bar).padStart(3, '0')}.${beat}.${st}`;
  if (keys.length && actEl) {
    const { k } = progressAt(window.scrollY + window.innerHeight / 2);
    const name = keys[k].name;
    if (force || name !== lastName) { actEl.textContent = t(name); lastName = name; }
  }
}

let scene = null;
function onScroll() {
  nav.classList.toggle('scrolled', window.scrollY > 24);
  if (!keys.length) return;
  const { act, side } = progressAt(window.scrollY + window.innerHeight / 2);
  if (scene) scene.setTarget(act, side);
  updateReadout(false);
}

measure();
window.addEventListener('scroll', onScroll, { passive: true });
window.addEventListener('resize', () => { measure(); onScroll(); });
window.addEventListener('load', () => { measure(); onScroll(); });

applyLang(store.get('mf-lang') || 'en');

/* ---------- WebGL ---------- */
(async () => {
  const canvas = document.getElementById('scene');
  try {
    const { createScene } = await import('./scene.js');
    scene = createScene(canvas, { reducedMotion });
    const { act, side } = progressAt(window.scrollY + window.innerHeight / 2);
    scene.jump(act, side);
    window.__mf = scene; // handy for debugging in the console
  } catch (err) {
    // No WebGL (or CDN blocked): the CSS gradient on #scene remains as the backdrop.
    console.warn('MotifFlow scene disabled:', err && err.message);
    canvas.classList.add('no-webgl');
  }
  onScroll();
})();
