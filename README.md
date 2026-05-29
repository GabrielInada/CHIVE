# CHIVE: Connected Hierarchical Interactive Visualization Engine

## Live deployments

CHIVE is hosted in two places:

| Environment | URL | Branch | Host |
|---|---|---|---|
| **Stable** | https://apps.roberto.eti.br/chive/ | `main` | Self hosted server |
| **Preview** | https://gabrielinada.github.io/CHIVE/ | `develop` | GitHub Pages |

- **Stable** reflects the released state of the project. It is our "Ready-To-Use" and reliable version of the project.
- **Preview** reflects `develop` and is intended for trying out upcoming features before they are merged into `main`. It is our "beta" version of the project. We do not guarantee that everything is working "fine" here, but it usually has some extra features which are being tested.

Both deployments serve the **same source files unchanged** (`index.html`, `about.html`, `src/`). No build step runs at deploy time. The app uses native browser ES modules and loads `d3` and `banana-i18n` from the `esm.sh` CDN, so any host that can serve static files (nginx, Apache, GitHub Pages, `python -m http.server`) works.

## Static Server Deployment
The app runtime uses:

1. Native browser ES modules (`<script type="module">`)
2. External dependencies (`d3`, `banana-i18n`) loaded directly from the `esm.sh` CDN via full URLs in the source files

### Deploy Requirements

1. Serve files over HTTP/HTTPS (do not use `file://`).
2. Serve these files/folders at minimum:
	1. `index.html`
	2. `about.html`
	3. `src/` (includes app code, styles, and icon assets under `src/icons/`)
3. Allow access to these external origins (default setup):
	1. `https://esm.sh`
	2. `https://fonts.googleapis.com`
	3. `https://fonts.gstatic.com`

### Deploy Steps

1. Upload the project files as static content (at least `index.html`, `about.html`, and `src/`).
2. Serve with any static web server (Nginx, Apache, Caddy, IIS, etc.).
3. Open `index.html` through HTTP/HTTPS (not `file://`).

### Post-Deploy Smoke Test

1. Open app URL.
2. Check browser console has no module/CORS/CSP errors.
3. Upload a small CSV or JSON file.
4. Verify preview renders and charts can be displayed.

### Important Notes

1. The default setup loads dependencies from CDN (`esm.sh`), so the server/client must have internet access.

## Local static test

If you want to test the static runtime mode locally, run a static server from the project root:

1. Open terminal in project folder.
2. Start one of these servers:

Python:

```powershell
python -m http.server 8080
```

3. Open `http://localhost:8080/`.
4. Check browser console/network for module loading errors.

### Local Test Checklist

1. App shell loads successfully.
2. No red errors in browser console.
3. Upload file works.
4. At least one chart renders.

## Testing (Vitest)

Tests are for local development/CI quality checks. They are not required on the production static server.

### Prerequisite (local only)

1. Install Node.js LTS.
2. Install dependencies once in project root:

```powershell
npm install
```

### Run test suite

Run all tests once:

```powershell
npm test
```

Run tests in watch mode (during development):

```powershell
npm run test:watch
```

### Suggested workflow

1. Make code changes.
2. Run `npm test`.
3. If tests pass, run local static test (`python -m http.server 8080`) and do a quick browser smoke check.
