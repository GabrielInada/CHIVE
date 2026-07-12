# Contributing to CHIVE

Welcome. This document is the contributor's rulebook. Read it before opening your first PR.

For end-user setup and deployment, see [README.md](README.md) and the [documentation hub](docs/README.md). For the architectural shape of the codebase, see [Architecture overview](docs/development/architecture.md). For exact state, facade, event, and subscriber details, see [Architecture reference](docs/development/architecture-reference.md). For source tree layout, naming, and code placement, see the [Source map](docs/development/source-map.md). For detailed JSDoc, lint, testing, and debugging notes, see [Contributor reference](docs/development/contributor-reference.md).

> [!CAUTION]
> Issues and PRs that don't follow the guidelines below may be closed until they match the expected shape.

## Bug report

Open a [bug report issue](https://github.com/GabrielInada/CHIVE/issues/new?template=bug_report.md) and fill in the template: what you observed, what you expected, and the smallest reproduction you can capture (steps, dataset, browser). The `bug` label is attached automatically.

## Feature proposal

Open a [feature proposal issue](https://github.com/GabrielInada/CHIVE/issues/new?template=feature_request.md) and fill in the template: the problem it solves, the user it serves, and how you'd expect it to behave. The `feature` label is attached automatically.

## Question

Not a bug or a feature? Start a [Q&A discussion](https://github.com/GabrielInada/CHIVE/discussions/new) instead of opening an issue.

## Documentation update

Open a [documentation issue](https://github.com/GabrielInada/CHIVE/issues/new?template=documentation-update.md) pointing at the section that needs work and what's wrong (stale, missing, unclear). The `documentation` label is attached automatically.

## Development

CHIVE is plain JavaScript (browser ES modules, no TypeScript) designed for static hosting without a required build step. Vite is the local dev server and optional build/preview tool; Vitest runs the automated test suite. Develop changes in this order:

1. Make sure your PR has a bug report, feature proposal, or documentation issue associated with it. If not, open one first.
2. Fork the repo and clone your fork to your machine.
3. Install an active Node.js LTS release that satisfies the engine requirements of the locked dependencies, then install the NPM dependencies with `npm install`. If install or local tooling reports an unsupported Node.js version, switch to a newer active LTS release before continuing.
4. Create a branch from `develop` using the pattern `feat/<short-name>` (see [Branching workflow](#branching-workflow) below).
5. Make your changes in `src/`, then add or update tests in `tests/` mirroring the file structure.
6. Run `npm run lint` and fix any errors. General hygiene warnings should be reviewed, but they do not fail CI.
7. Run `npm test` and verify all tests pass.
8. Run `npm run dev` and smoke-check the affected feature in a browser at <http://localhost:5173>.
9. If your change touches imports, workers, assets, deployment, or runtime dependency loading, run a production-style static smoke test from the project root: `python -m http.server 8080`, then open <http://localhost:8080/>. This catches the raw-static deployment issues described in [ESLint guards](docs/development/contributor-reference.md#eslint-guards).
10. Open a pull request against the **[`develop`](https://github.com/GabrielInada/CHIVE/tree/develop)** branch.

Common commands:

```bash
npm run dev          # Start Vite dev server (http://localhost:5173)
npm run build        # Optional Vite production build -> dist/
npm run preview      # Preview the optional Vite build
npm run lint         # Run ESLint architecture/deployment guards
npm run lint:fix     # Apply safe automatic lint fixes; architecture errors usually need manual fixes
npm run lint:css     # Run Stylelint CSS correctness checks
npm run lint:css:fix # Apply safe Stylelint fixes
npm test             # Run all tests once (vitest run)
npm run test:watch   # Tests in watch mode
```

Before opening a PR, check that:

- The PR links the relevant bug report, feature proposal, or documentation issue.
- Tests were added or updated when behavior changed.
- `npm run lint` passes without errors.
- `npm run lint:css` passes without errors when CSS changed.
- `npm test` passes.
- The affected feature was smoke-checked with `npm run dev`.
- The local static smoke test was run if the change affects raw-static runtime behavior.

## Branching workflow

- `main`: production/stable branch (default)
- `develop`: integration/staging branch for testing before main
- `feat/*`: feature branches; each new feature uses pattern `feat/branchName`
- **Workflow:** Feature branches → PR to `develop` → tested → PR to `main`

## Commit & PR conventions

- Commit messages are in English.
- PRs target `develop`, never `main` directly. The only thing that lands on `main` is a merge from `develop` after it has been tested.
- Keep PRs scoped; if you discover unrelated cleanup, open a separate branch.

## Code conventions

- **CSS class names use English kebab-case:** `.panel-`, `.table-`, `.chart-`, modifiers like `.active`, `.loaded`, `.empty`
- **CSS architecture:** Cascade layers ordered: foundation → controls → data-view → visual-output → feedback. Stylelint checks project-owned CSS under `src/styles/`; vendor CSS is not linted. See [Stylesheet organization](docs/development/styles.md) for details.
- **Module exports:** camelCase for functions, PascalCase for classes
- **Dependency injection:** Event handlers and render functions are passed as callbacks for testability and to avoid circular dependencies
- **State reads:** when adding or changing a call site that needs only a primitive or small derived value, prefer a focused selector (`getActiveDatasetIndex()`, `getPreviewRows()`) over pulling a whole live object from a getter. See the [live-reference read policy](docs/development/architecture-reference.md#live-reference-read-policy)
- **Result pattern:** Functions returning success/failure use `ok(data)` / `fail(reason)` from `src/utils/result.js`
- **DOM IDs:** Use constants from `src/config/elementIds.js` instead of hardcoded strings
- **Color utilities:** Use shared functions from `src/utils/colorUtils.js`; never duplicate hex/rgb conversion logic
- **Chart control listeners:** Use helpers from `src/modules/chartControls/controlListenerHelpers.js` for common patterns (select, checkbox, slider, etc.); only write inline listeners when cross-dependency logic is needed
- **Join and preset dataset UIs:** Keep orchestration in modules/components and reuse existing event-driven patterns
- **No TypeScript:** plain JS with ES modules. ESLint exists, but its config is intentionally narrow and architecture-focused.

## Translations and presets

- For UI strings, update `src/i18n/en.json`, `src/i18n/pt-BR.json`, and `src/i18n/qqq.json` together. See [Translation Contributor Guide](docs/development/i18n.md).
- For bundled sample datasets, add files under `src/data/presets/`, register them in `src/data/presetCatalog.js`, and add the required translation keys. See [Preset Dataset Contributor Guide](docs/development/preset-datasets.md).

## Documentation conventions

Public functions on the state core, services, and orchestrators carry JSDoc so the IDE can read each function's contract without re-reading the file. Keep JSDoc and docs close to the existing style.

When moving, renaming, or adding documentation:

- Search for old file names and paths with `rg`.
- Check Markdown links changed by the edit.
- Update issue templates when a top-level or user-facing doc target changes.
- Update the documentation hub when a user-facing or top-level doc is added, moved, or renamed.
- Update [Architecture reference](docs/development/architecture-reference.md) when adding, removing, or renaming a state field, facade method, `STATE_EVENTS` constant, or production subscriber.

For exact JSDoc rules and documentation maintenance notes, see
[Contributor reference](docs/development/contributor-reference.md#documentation-and-jsdoc-conventions).

## Architecture invariants: do not break

Hard rules. Breaking any of them silently degrades reactivity, and the failure mode is "the UI looks fine until the day it doesn't." See [Architecture overview](docs/development/architecture.md) for the why.

- All writes to application state go through a facade. Never assign to `dataset.*`, `appState.*`, or anything returned from a getter (`getActiveDataset()`, `getAllDatasets()`, `getPanelCharts()`, …).
- Event names live in `STATE_EVENTS`. Never use string literals in `src/`. (Tests intentionally keep literals to exercise the wire format; leave them alone.)
- Subscribers must not synchronously emit a state event from inside their callback (re-entrancy loop). Defer with `queueMicrotask` if you need a follow-up mutation.
- Make chart config valid at the state boundaries, not during render. `canonicalizeChartConfig` runs at persistence restore, `addDataset`, the emitting config writes (`updateActiveDatasetConfig`, `setActiveChartType`), and defensively in `replaceAllState`; render never repairs config. Reserve `normalizeActiveDatasetConfig` (writes without emitting) for the intentional non-emitting live-preview writes (color picker, chart-height drag).
- Renderers and DOM builders do not call write facades. They read durable state via getters and derive DOM from it; user input is surfaced through callbacks injected by a feature controller or manager (e.g. `panelController`, `eventHandlers`, a chart-controls listener). Module-local transient UI state (search query, dialog draft, focus anchor) is allowed; durable application state goes through a facade.
- `STATE_EVENTS.WILDCARD === '*'` is reserved for state-bus consumers (`persistenceService.js`) that genuinely need every emission. Do not subscribe to it from feature controllers/managers, renderers, or `app/renderCoordinator.js`; use a typed subscription.

Lint guard details and the known aliasing gap are documented in
[Contributor reference](docs/development/contributor-reference.md#architecture-guard-details).

## Where do I put new code?

See the [Source map](docs/development/source-map.md#where-do-i-put-new-code)
for the code placement table, the source tree layout, and the naming
vocabulary.

## Testing

Run `npm run lint` and `npm test` before opening a PR. Add or update tests in
`tests/` when behavior changes, mirroring the `src/` structure. For jsdom setup,
mocking patterns, and the Windows stale-cache workaround, see
[Contributor reference](docs/development/contributor-reference.md#testing).

## Debugging

Use `window.chiveDebug` for state reads, selected facade mutators, UI helpers,
and state-event logging. See
[Contributor reference](docs/development/contributor-reference.md#debugging) for
the exposed entries and state-log workflow.
