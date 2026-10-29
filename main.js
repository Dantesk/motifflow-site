/* ==========================================================================
   CONFIG — edit these before launch.
   checkoutUrl:      Stripe Payment Link (https://buy.stripe.com/...). While empty,
                     "Buy" buttons just scroll to the pricing card (#buy).
   trialDownloadMac: direct https link to the macOS trial installer (.pkg).
   trialDownloadWin: direct https link to the Windows trial installer (.exe).
   supportEmail:     shown in the footer when set.
   Links are only used if they are https and on an allowed host (see ALLOWED_HOSTS):
   a typo or a tampered value can never send buyers somewhere else.
   ========================================================================== */
const CONFIG = {
  checkoutUrl: '',       // e.g. 'https://buy.stripe.com/XXXXXXXX'
  trialDownloadMac: '',  // e.g. 'https://github.com/Dantesk/motifflow-site/releases/download/v0.9.1/MotifFlow-0.9.1-mac.pkg'
  trialDownloadWin: '',  // e.g. 'https://github.com/Dantesk/motifflow-site/releases/download/v0.9.1/MotifFlow-0.9.1-win.exe'
  supportEmail: '',      // e.g. 'support@motifflow.app'
};

const ALLOWED_HOSTS = {
  checkout: ['buy.stripe.com', 'checkout.stripe.com'],
  download: ['github.com', 'objects.githubusercontent.com', 'dantesk.github.io'],
};

/** The URL if it is https on one of the allowed hosts, otherwise null. */
function safeUrl(value, hosts) {
  if (!value) return null;
  try {
    const u = new URL(value);
    if (u.protocol !== 'https:') return null;
    return hosts.some((h) => u.hostname === h || u.hostname.endsWith('.' + h)) ? u.href : null;
  } catch (e) {
    return null;
  }
}

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
i18nEls.forEach((el) => { const k = el.dataset.i18n; if (!(k in en)) en[k] = el.textContent; });
en['meta.title'] = document.title;
let lang = 'en';

function t(key) { return (lang === 'it' && dict.it[key]) || en[key] || key; }

function applyLang(next) {
  lang = next === 'it' ? 'it' : 'en';
  document.documentElement.lang = lang;
  // textContent, never innerHTML: translations are plain text, so no markup can ever be injected
  i18nEls.forEach((el) => { el.textContent = t(el.dataset.i18n); });
  document.title = t('meta.title');
  document.querySelectorAll('[data-lang]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
  store.set('mf-lang', lang);
  updateReadout(true);
}
document.querySelectorAll('[data-lang]').forEach((b) => b.addEventListener('click', () => applyLang(b.dataset.lang)));

/* ---------- checkout + trial ---------- */
const checkoutUrl = safeUrl(CONFIG.checkoutUrl, ALLOWED_HOSTS.checkout);
document.querySelectorAll('[data-checkout]').forEach((a) => {
  if (!checkoutUrl) return; // falls back to the #buy anchor
  a.href = checkoutUrl;
  a.rel = 'noopener';
});
document.querySelectorAll('[data-trial]').forEach((a) => {
  const url = safeUrl(a.dataset.trial === 'mac' ? CONFIG.trialDownloadMac : CONFIG.trialDownloadWin, ALLOWED_HOSTS.download);
  if (url) { a.href = url; a.rel = 'noopener'; return; }
  a.addEventListener('click', (e) => {
    e.preventDefault();
    const note = document.getElementById('trialNote');
    if (note) note.hidden = false;
  });
});

/* ---------- footer ---------- */
const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = String(new Date().getFullYear());
if (/^[^\s@<>"']+@[^\s@<>"']+\.[a-z]{2,}$/i.test(CONFIG.supportEmail)) {
  const link = document.getElementById('supportLink');
  link.textContent = CONFIG.supportEmail;
  link.href = 'mailto:' + CONFIG.supportEmail;
  document.getElementById('support').hidden = false;
}

/* ---------- slow scroll for in-page links ----------
   The 3D scene tells the story as you scroll: a jump of the browser's own smooth scroll is over in
   a fraction of a second and the animation is lost. In-page links glide instead, at a pace that lets
   every act play (longer for longer distances). Any wheel, touch or key press stops the glide. */
let glide = null;
function stopGlide() {
  if (!glide) return;
  cancelAnimationFrame(glide.raf);
  glide = null;
  document.documentElement.style.scrollBehavior = '';
}
function glideTo(targetY, onDone) {
  stopGlide();
  const startY = window.scrollY;
  const distance = targetY - startY;
  if (Math.abs(distance) < 2) { if (onDone) onDone(); return; }
  // about 500 px per second, never shorter than 1.4 s or longer than 8 s
  const duration = Math.min(8000, Math.max(1400, Math.abs(distance) / 0.5));
  const ease = (t) => 0.5 - 0.5 * Math.cos(Math.PI * t);   // ease in-out sine: gentle start and end, even pace between
  document.documentElement.style.scrollBehavior = 'auto';   // our own animation, not the CSS one
  const t0 = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - t0) / duration);
    window.scrollTo(0, startY + distance * ease(t));
    if (t < 1) { glide.raf = requestAnimationFrame(step); return; }
    stopGlide();
    if (onDone) onDone();
  };
  glide = { raf: requestAnimationFrame(step) };
}
['wheel', 'touchstart', 'keydown', 'mousedown'].forEach((ev) => window.addEventListener(ev, stopGlide, { passive: true }));

document.querySelectorAll('a[href^="#"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const id = a.getAttribute('href').slice(1);
    const target = id ? document.getElementById(id) : null;
    if (!target || reducedMotion) return;   // no target, or reduced motion: the browser's normal jump
    e.preventDefault();
    const navH = nav ? nav.getBoundingClientRect().height + 16 : 0;
    const y = Math.max(0, target.getBoundingClientRect().top + window.scrollY - (id === 'top' ? 0 : navH));
    glideTo(y, () => {
      history.replaceState(null, '', '#' + id);
      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });   // keyboard and screen-reader users land in the section
    });
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
  } catch (err) {
    // No WebGL: the CSS gradient on #scene remains as the backdrop.
    console.warn('MotifFlow scene disabled:', err && err.message);
    canvas.classList.add('no-webgl');
  }
  onScroll();
})();
