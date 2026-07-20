# Static Hosting

CHIVE is designed to run from a static web server.

| Field | Value |
|---|---|
| Audience | Deployers serving CHIVE from static hosting. |
| Source of truth | Raw static file set, MIME guidance, and static-runtime smoke tests. |
| Update when | Required runtime files, vendored assets, worker/WASM loading, MIME needs, or deployment smoke checks change. |

The app runtime uses:

1. Native browser ES modules through `<script type="module">`.
2. Vendored JavaScript runtime dependencies loaded from `vendor/d3/`,
   `vendor/three/`, and `vendor/banana-i18n/`.
3. A vendored SQLite-WASM runtime loaded from `vendor/sqlite/` (`sqlite3.js`,
   `sqlite3.wasm`, and companion files referenced by the loader).
4. Vendored fonts loaded from `vendor/fonts/`.

## Why Raw-Static Remains A Constraint

Raw-static hosting is CHIVE's production contract, not just another deployment
option. GitHub Pages and the Docker/Nginx image copy and serve the checked-in
HTML, `src/`, and `vendor/` files directly; Vite remains a development server
and optional bundle check rather than a required production step.

Keeping that contract means browser-runtime imports stay relative, runtime
dependencies stay vendored, and workers and assets use standard browser URLs.
It also means import, asset, and runtime-dependency changes need a plain static
server smoke test. Replacing this path with a mandatory build would be an
explicit deployment-architecture change affecting hosting, dependency
provenance, and CI guards, not incidental build-tool cleanup.

## Requirements

1. Serve files over HTTP/HTTPS. Do not open the app with `file://`.
2. Serve these files and folders at minimum:
   - `index.html`
   - `about.html`
   - `src/`
   - `vendor/`
3. Serve vendored `.js` and `.mjs` files with a JavaScript MIME type, font files
   with a font MIME type when possible, and `vendor/sqlite/sqlite3.wasm` as
   `application/wasm` when possible. Browsers can fall back to non-streaming
   WASM compilation, but the correct MIME avoids a slower path.

The minimum-file list is the runtime manifest in
`scripts/runtime-manifest.mjs`; CI parity-tests this documentation, the
Dockerfile, and the Pages deployment workflow against that manifest.

The default CHIVE runtime does not require external JavaScript or font CDNs.

## Deploy Steps

1. Upload the project files as static content.
2. Serve them with a static web server such as Nginx, Apache, Caddy, IIS, or
   GitHub Pages.
3. Open `index.html` through HTTP/HTTPS.

## Post-Deploy Smoke Test

1. Open the app URL.
2. Check that the browser console has no module, CORS, or CSP errors.
3. Load a bundled sample dataset or upload a small CSV/JSON file.
4. Verify the table preview renders.
5. Create at least one SVG chart and, when WebGL is available, a 3D scatter
   chart.
6. Make a change, wait a couple of seconds for the auto-save, reload, and
   confirm the dataset restores.

## Local Static Test

To test the production-style static runtime locally, run a static server from
the project root:

```powershell
python -m http.server 8080
```

Then open <http://localhost:8080/>.

Checklist:

1. App shell loads successfully.
2. Browser console has no red errors.
3. File upload or sample dataset loading works.
4. At least one SVG chart renders and, when WebGL is available, the 3D scatter
   renders on its canvas.

For the browser storage and trust model, see
[Privacy and security](../user/privacy-security.md).
