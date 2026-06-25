# CHIVE: Connected Hierarchical Interactive Visualization Engine

CHIVE is a client-side browser tool for exploring CSV/JSON data, building interactive D3 visualizations, and composing charts into dashboard panels. It runs as static files, with no CHIVE backend required.

![CHIVE workspace preview](docs/assets/readme-preview.png)

## Documented Deployments

| Environment | URL | Branch | Host |
|---|---|---|---|
| **Stable** | [apps.roberto.eti.br/chive](https://apps.roberto.eti.br/chive/) | `main` | Self-hosted server |
| **Preview** | [gabrielinada.github.io/CHIVE](https://gabrielinada.github.io/CHIVE/) | `develop` | GitHub Pages |

- **Stable** is the documented public endpoint for the released state of the project and is the recommended version for normal use when available.
- **Preview** reflects `develop`, is deployed by the GitHub Pages workflow, and is intended for trying upcoming features before they are merged into `main`.

CHIVE's static runtime serves the source files unchanged: `index.html`, `about.html`, `src/`, and `vendor/`. The GitHub Pages preview workflow copies that set directly; self-hosted deployments should serve the same raw-static set. No production build step is required at deploy time.

## What You Can Do

- Load CSV-like text data (`.csv`, `.tsv`, `.dsv`, `.txt`) and JSON files.
- Use bundled sample datasets for quick experiments.
- Preview rows, inspect detected columns, and select which columns stay visible.
- Review numeric and categorical summaries.
- Build bar, scatter, pie/donut, bubble, network, treemap, line, and TIN charts.
- Apply global filters to focus the active dataset.
- Join datasets through the browser UI.
- Save chart snapshots into dashboard panel layouts.
- Export the dashboard panel as SVG.
- Export/import full CHIVE project files, or export a work-only project file without row payloads.
- Switch the UI between English and Brazilian Portuguese.

## Quick Start

1. Open the [Stable deployment](https://apps.roberto.eti.br/chive/) or the [Preview deployment](https://gabrielinada.github.io/CHIVE/).
2. Load a sample dataset, or upload a CSV/JSON file from your machine.
3. Review the table preview and choose the columns you want to keep visible.
4. Open the visualization view and pick a chart type.
5. Configure the chart columns and options in the sidebar.
6. Add useful charts to the panel.
7. Arrange the panel layout and export it as SVG when needed.
8. Use the Project menu in the results toolbar to export or import a full project file.

## Local Development

Install an active Node.js LTS release that satisfies the engine requirements of the locked dependencies, then install dependencies once. If install or local tooling reports an unsupported Node.js version, switch to a newer active LTS release and retry.

```powershell
npm install
```

Start the Vite dev server:

```powershell
npm run dev
```

Open <http://localhost:5173/>.

Run local checks:

```powershell
npm run lint
npm test
```

Useful commands:

```powershell
npm run dev          # Start Vite dev server
npm run build        # Optional Vite production build into dist/
npm run preview      # Preview the optional Vite build
npm run lint         # Run ESLint architecture/deployment guards
npm run lint:fix     # Apply safe automatic lint fixes
npm test             # Run all tests once
npm run test:watch   # Run tests in watch mode
```

## Static Deployment

CHIVE is designed to run from a static web server. The app runtime uses:

1. Native browser ES modules through `<script type="module">`.
2. Vendored JavaScript runtime dependencies loaded from `vendor/d3/` and `vendor/banana-i18n/`.
3. A vendored SQLite-WASM runtime loaded from `vendor/sqlite/` (`sqlite3.js`, `sqlite3.wasm`, and companion files referenced by the loader).
4. Vendored fonts loaded from `vendor/fonts/`.

### Requirements

1. Serve files over HTTP/HTTPS. Do not open the app with `file://`.
2. Serve these files and folders at minimum:
   - `index.html`
   - `about.html`
   - `src/`
   - `vendor/`
3. Serve vendored `.js` files with a JavaScript MIME type, font files with a font MIME type when possible, and `vendor/sqlite/sqlite3.wasm` as `application/wasm` when possible. Browsers can fall back to non-streaming WASM compilation, but the correct MIME avoids a slower path.

The default CHIVE runtime does not require external JavaScript or font CDNs.

### Deploy Steps

1. Upload the project files as static content.
2. Serve them with a static web server such as Nginx, Apache, Caddy, IIS, or GitHub Pages.
3. Open `index.html` through HTTP/HTTPS.

### Post-Deploy Smoke Test

1. Open the app URL.
2. Check that the browser console has no module, CORS, or CSP errors.
3. Load a bundled sample dataset or upload a small CSV/JSON file.
4. Verify the table preview renders.
5. Create at least one chart.
6. Make a change, wait a couple of seconds for the auto-save, reload, and confirm the dataset restores.

## Local Static Test

To test the production-style static runtime locally, run a static server from the project root:

```powershell
python -m http.server 8080
```

Then open <http://localhost:8080/>.

Checklist:

1. App shell loads successfully.
2. Browser console has no red errors.
3. File upload or sample dataset loading works.
4. At least one chart renders.

## Docker (Optional)

Docker is an optional way to self-host CHIVE with a hardened Nginx config. It does
not change the app: the image serves the same static files (`index.html`,
`about.html`, `src/`, `vendor/`) and there is still no backend. The raw-static
deployment above remains fully supported and is not affected.

Run it with Docker Compose from the project root:

```powershell
docker compose up --build
```

Then open <http://localhost:8080/>.

Equivalent plain Docker commands:

```powershell
docker build -t chive .
docker run --rm -p 8080:80 chive
```

The image serves all runtime assets from a single origin and ships an enforcing
local-only Content-Security-Policy (with a documented `'unsafe-eval'` exception
that D3's CSV parser requires). The policy was manually verified after a
Report-Only smoke test. For dependency changes, temporarily switch the header in
`docker/security-headers.conf` back to `Content-Security-Policy-Report-Only`,
retest in the browser console, then return it to enforcing. See
[Privacy and security](docs/PRIVACY_AND_SECURITY.md) for the trust model.

## Data And Privacy

CHIVE has no application backend in the default deployments. Uploaded datasets are parsed and visualized in the browser. The app uses browser storage so auto-saved work can survive refreshes:

- IndexedDB stores one SQLite project byte image containing datasets and dashboard panel state.
- `localStorage` stores small UI preferences and the selected locale.

Project changes auto-save: a save runs automatically a couple of seconds after you stop editing, and CHIVE also attempts a best-effort lifecycle save when the page hides, freezes, or closes. Hard crashes or interrupted closes can still lose changes made since the last successful save.

Project export downloads a SQLite-backed `.chive.sqlite3` file. Full exports include dataset rows and saved chart snapshot payloads; work-only exports omit those heavy payloads and are meant for layout/work transfer only. Import currently accepts full project files and replaces the current datasets and panel.

JavaScript runtime dependencies and fonts are served from the same static host as vendored files. If you need stricter controls for sensitive data, self-host CHIVE and review the static-host trust boundary before use. See [Privacy and security](docs/PRIVACY_AND_SECURITY.md) for the detailed trust model.

## Documentation

- [Architecture overview](ARCHITECTURE.md): fast mental model for state, events, facades, and rendering boundaries.
- [Architecture reference](docs/ARCHITECTURE_REFERENCE.md): exact state schema, facade methods, event registry, and subscribers.
- [Privacy and security](docs/PRIVACY_AND_SECURITY.md): browser storage, runtime network dependencies, and trust boundaries.
- [Translation contributor guide](docs/I18N.md): how to add or update UI strings across supported locales.
- [Preset dataset contributor guide](docs/PRESET_DATASETS.md): how to add bundled sample datasets and their attribution.
- [Security policy](SECURITY.md): where to report security concerns.
- [Contributing](CONTRIBUTING.md): development workflow, code conventions, lint rules, and tests.
- [Stylesheet organization](src/styles/STYLES_ORGANIZATION.md): CSS layers, feature ownership, and responsive rules.
- [Chart and data reference](docs/CHART_REFERENCE.md): which columns and modes each chart type needs, plus the common empty states.
- [User guide](docs/USER_GUIDE.md): practical walkthrough for loading data, charting, filtering, dashboards, import/export, and storage basics.

## Project Status

CHIVE is an open-source research project from UFRA (Federal Rural University of the Amazon). The codebase is plain JavaScript with browser ES modules, D3, Vite for local development, Vitest for tests, and no frontend framework.

## License

See [LICENSE](LICENSE).
