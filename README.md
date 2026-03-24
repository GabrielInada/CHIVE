# CHIVE - Connected Hierarchical Interactive Visualization Engine


## Static Server Deployment
The app runtime uses:

1. Native browser ES modules (`<script type="module">`)
2. An HTML `importmap` (in `index.html`) for external dependencies (`d3`, `banana-i18n`)

### Deploy Requirements

1. Serve files over HTTP/HTTPS (do not use `file://`).
2. Serve these files/folders at minimum:
	1. `index.html`
	2. `src/`
	3. `public/`
3. Allow access to these external origins (default setup):
	1. `https://esm.sh`
	2. `https://fonts.googleapis.com`
	3. `https://fonts.gstatic.com`

### Deploy Steps

1. Upload the project files as static content (at least `index.html`, `src/`, and `public/` if used).
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
