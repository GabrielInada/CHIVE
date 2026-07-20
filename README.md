# CHIVE: Connected Hierarchical Interactive Visualization Engine

CHIVE is a client-side browser tool for exploring CSV/JSON data, building interactive D3 and Three.js visualizations, and composing charts into dashboard panels. It runs as static files and does not require a remote or server-side CHIVE application backend.

## Documented Deployments

| Environment | URL | Branch | Host |
|---|---|---|---|
| **Stable** | [apps.roberto.eti.br/chive](https://apps.roberto.eti.br/chive/) | `main` | Self-hosted server |
| **Preview** | [gabrielinada.github.io/CHIVE](https://gabrielinada.github.io/CHIVE/) | `develop` | GitHub Pages |

- **Stable** is the documented public endpoint for the released state of the project and is the recommended version for normal use when available.
- **Preview** reflects `develop`, is deployed by the GitHub Pages workflow, and is intended for trying upcoming features before they are merged into `main`.

CHIVE's static runtime serves the source files unchanged. For the exact file
set, MIME guidance, smoke tests, and self-hosting notes, see
[Static hosting](docs/deployment/static-hosting.md).

## What You Can Do

- Load CSV-like text data (`.csv`, `.tsv`, `.dsv`, `.txt`) and JSON files.
- Use bundled sample datasets for quick experiments.
- Preview rows, inspect detected columns, and select which columns stay visible.
- Review numeric and categorical summaries.
- Build bar, scatter, 3D scatter, pie/donut, bubble, network, treemap, line, and TIN charts.
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
npm run check
```

For the full contributor workflow and command list, see
[CONTRIBUTING.md](CONTRIBUTING.md).

## Deployment

CHIVE runs from static files and has no required production build step. For
hosting requirements, MIME types, smoke tests, and optional Docker hosting, see:

- [Static hosting](docs/deployment/static-hosting.md)
- [Docker deployment](docs/deployment/docker.md)

## Data And Privacy

CHIVE's default deployments do not use a remote or server-side application
backend. Uploaded datasets are parsed and visualized in the browser, and
browser storage is used for auto-save. For exact storage keys, import/export
payloads, runtime network behavior, and trust boundaries, see
[Privacy and security](docs/user/privacy-security.md).

## Documentation

Start with the [documentation hub](docs/README.md). It groups the docs by
reader path: using CHIVE, deploying it, contributing code, understanding the
architecture, adding charts/datasets/translations, and maintaining docs or
vendored assets.

## Project Status

CHIVE is an open-source research project from UFRA (Federal Rural University of the Amazon). The codebase is plain JavaScript with browser ES modules, D3, Vite for local development, Vitest for tests, and no frontend framework.

## License

See [LICENSE](LICENSE).
