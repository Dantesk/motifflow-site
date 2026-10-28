# motifflow-site

Marketing and sales website for **MotifFlow** (VST3 / Standalone for macOS and Windows).
Plain static files, no build step: `index.html`, `styles.css`, `main.js`, `scene.js`, `i18n.js`.

## Files

| File | What it is |
| --- | --- |
| `index.html` | The page. English copy lives here. |
| `styles.css` | All styles (palette tokens at the top). |
| `main.js` | **CONFIG** (checkout + trial links), language toggle, scroll reveal, scroll → scene progress. |
| `scene.js` | Three.js scroll story (waveform → piano roll → four lanes → MIDI clip → ambient field). |
| `i18n.js` | Italian translations, keyed by `data-i18n`. |
| `privacy.html`, `terms.html` | Placeholder legal pages, marked *draft — to be reviewed*. |
| `assets/` | Icons, favicon, `og-image.png` (1200×630). |
| `.nojekyll` | Tells GitHub Pages to serve files as-is. |

Three.js is loaded from a pinned CDN URL through an import map
(`https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js`).

## Before launch

1. Open `main.js` and fill in `CONFIG`:
   - `checkoutUrl` — Lemon Squeezy / Paddle / Stripe checkout link. Every element with `data-checkout` uses it. While empty, "Buy" scrolls to the pricing card.
   - `trialDownloadMac`, `trialDownloadWin` — direct installer links. While empty, the buttons show "Trial downloads open at launch."
   - Paddle and Lemon Squeezy also offer overlay checkouts: add their script tag in `index.html` and call it from the `data-checkout` click handler in `main.js`.
2. Have `privacy.html` and `terms.html` reviewed and fill in the `[bracketed]` parts.
3. If you use a custom domain, update `og:image` in `index.html` to an absolute URL (`https://yourdomain/assets/og-image.png`) so social previews work everywhere.

## Run locally

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

(Opening `index.html` straight from disk won't work: ES modules need an http server.)

## Deploy on GitHub Pages

1. Create a new **public** repository called `motifflow-site`.
2. Push these files to the `main` branch, at the repository root:
   ```bash
   git init && git add . && git commit -m "MotifFlow site"
   git branch -M main
   git remote add origin git@github.com:<you>/motifflow-site.git
   git push -u origin main
   ```
   (You can leave `_screens/` out — it only holds preview screenshots.)
3. On GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `main` / `/ (root)` → Save**.
4. After a minute the site is live at `https://<you>.github.io/motifflow-site/`.

### Custom domain

1. Add a file called `CNAME` at the repo root containing just your domain, e.g. `motifflow.com` (or set it in Settings → Pages → Custom domain, which creates the file for you).
2. At your DNS provider:
   - apex domain (`motifflow.com`): four `A` records to `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - `www` subdomain: a `CNAME` record to `<you>.github.io`
3. Back in Settings → Pages, tick **Enforce HTTPS** once the certificate is issued.

## Editing copy and translations

- English text: edit it in `index.html`.
- Italian: edit the matching key in `i18n.js` (`data-i18n="hero.sub"` → `"hero.sub": "…"`).
- New text: add a `data-i18n="your.key"` attribute in the HTML and the Italian string in `i18n.js`.

## Performance and accessibility notes

- Particle count adapts: ~40k on desktop, ~12k on phones, trimmed further if frame time is slow. Pixel ratio capped at 2.
- Rendering pauses when the tab is hidden.
- With `prefers-reduced-motion`, the scene renders a still frame per scroll position and scroll reveals are disabled.
- If WebGL is unavailable the page falls back to a CSS gradient backdrop.

## Trademark note

Basic Pitch attribution must stay factual: "powered by Basic Pitch, the open-source neural model by Spotify's Audio Intelligence Lab (Apache 2.0)". Do not add the Spotify logo or wording that implies a partnership.
