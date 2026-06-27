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

For the full contributor workflow and command list, see
[CONTRIBUTING.md](CONTRIBUTING.md).

## Deployment

CHIVE runs from static files and has no required production build step. For
hosting requirements, MIME types, smoke tests, and optional Docker hosting, see:

- [Static hosting](docs/deployment/static-hosting.md)
- [Docker deployment](docs/deployment/docker.md)

## Data And Privacy

CHIVE has no application backend in the default deployments. Uploaded datasets are parsed and visualized in the browser. The app uses browser storage so auto-saved work can survive refreshes:

- IndexedDB stores one SQLite project byte image containing datasets and dashboard panel state.
- `localStorage` stores small UI preferences and the selected locale.

Project changes auto-save: a save runs automatically a couple of seconds after you stop editing, and CHIVE also attempts a best-effort lifecycle save when the page hides, freezes, or closes. Hard crashes or interrupted closes can still lose changes made since the last successful save.

Project export downloads a SQLite-backed `.chive.sqlite3` file. Full exports include dataset rows and saved chart snapshot payloads; work-only exports omit those heavy payloads and are meant for layout/work transfer only. Import currently accepts full project files and replaces the current datasets and panel.

JavaScript runtime dependencies and fonts are served from the same static host as vendored files. If you need stricter controls for sensitive data, self-host CHIVE and review the static-host trust boundary before use. See [Privacy and security](docs/user/privacy-security.md) for the detailed trust model.

## Documentation

Start with the [documentation hub](docs/README.md). It groups the docs by
reader path: using CHIVE, deploying it, contributing code, understanding the
architecture, adding charts/datasets/translations, and maintaining docs or
vendored assets.

## Project Status

CHIVE is an open-source research project from UFRA (Federal Rural University of the Amazon). The codebase is plain JavaScript with browser ES modules, D3, Vite for local development, Vitest for tests, and no frontend framework.

## License

See [LICENSE](LICENSE).
