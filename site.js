/* Shared by the legal pages and 404: the language chosen on the home page (navigation and footer labels)
   and the current year. The home page (main.js) and the guide (guide.js) do the same on their own. */
(() => {
  let lang = null;
  try { lang = window.localStorage.getItem('mf-lang'); } catch (e) { /* storage unavailable */ }
  if (!lang) lang = (navigator.language || '').toLowerCase().startsWith('it') ? 'it' : 'en';
  document.documentElement.lang = lang === 'it' ? 'it' : 'en';
  const year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());
})();
