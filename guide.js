/* MotifFlow guide and how-it-works pages: language switch (shared with the home page) and the active chapter in the side index.
   Both languages are in the HTML; the <html lang> attribute decides which one is shown (see styles.css). */
(() => {
  const store = {
    get(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* storage unavailable */ } },
  };
  const titles = {
    en: 'MotifFlow Guide — from loop to variations',
    it: 'Guida di MotifFlow — dal loop alle variazioni',
  };

  function applyLang(next) {
    const lang = next === 'it' ? 'it' : 'en';
    document.documentElement.lang = lang;
    const custom = document.body.dataset[lang === 'it' ? 'titleIt' : 'titleEn'];
    document.title = custom || titles[lang];
    document.querySelectorAll('[data-lang]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
    store.set('mf-lang', lang);
  }
  document.querySelectorAll('[data-lang]').forEach((b) => b.addEventListener('click', () => applyLang(b.dataset.lang)));
  const saved = store.get('mf-lang');
  applyLang(saved || ((navigator.language || '').toLowerCase().startsWith('it') ? 'it' : 'en'));
  const year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());

  // highlight the chapter being read
  const links = new Map();
  document.querySelectorAll('.guide-toc a[href^="#"]').forEach((a) => links.set(a.getAttribute('href').slice(1), a));
  if (!('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      links.forEach((a) => a.removeAttribute('aria-current'));
      const a = links.get(en.target.id);
      if (a) a.setAttribute('aria-current', 'true');
    });
  }, { rootMargin: '-30% 0px -60% 0px' });
  document.querySelectorAll('.g-sec').forEach((s) => io.observe(s));
})();
