# Contributing to CHIVE

Welcome. This document is the contributor's rulebook — read it before opening your first PR.

For end-user setup and deployment, see [README.md](README.md). For the architectural shape of the codebase, see [ARCHITECTURE.md](ARCHITECTURE.md).

> [!CAUTION]
> Issues and PRs that don't follow the guidelines below may be closed until they match the expected shape.

## Bug report

Open a [bug report issue](https://github.com/GabrielInada/CHIVE/issues/new?template=bug_report.md) and fill in the template — what you observed, what you expected, and the smallest reproduction you can capture (steps, dataset, browser). The `bug` label is attached automatically.

## Feature proposal

Open a [feature proposal issue](https://github.com/GabrielInada/CHIVE/issues/new?template=feature_request.md) and fill in the template — the problem it solves, the user it serves, and how you'd expect it to behave. The `feature` label is attached automatically.

## Question

Not a bug or a feature? Start a [Q&A discussion](https://github.com/GabrielInada/CHIVE/discussions/new) instead of opening an issue.

## Documentation update

Open a [documentation issue](https://github.com/GabrielInada/CHIVE/issues/new?template=documentation-update.md) pointing at the section that needs work and what's wrong (stale, missing, unclear). The `documentation` label is attached automatically.

## Development

CHIVE is plain JavaScript (ES modules, no TypeScript) built with Vite and tested with Vitest. Before opening a PR, follow these steps:

1. Make sure your PR has a bug report or feature proposal issue associated with it. If not, open one first.
2. Fork the repo and clone your fork to your machine.
3. Install the NPM dependencies with `npm install`.
4. Create a branch from `develop` using the pattern `feat/<short-name>` (see [Branching workflow](#branching-workflow) below).
5. Make your changes in `src/`, then add or update tests in `tests/` mirroring the file structure.
6. Run `npm test` and verify all tests pass.
7. Run `npm run dev` and smoke-check the affected feature in a browser at <http://localhost:5173>.
8. Open a pull request against the **[`develop`](https://github.com/GabrielInada/CHIVE/tree/develop)** branch.

Common commands:

```bash
npm run dev          # Start Vite dev server (http://localhost:5173)
npm run build        # Production build -> dist/
npm run preview      # Preview production build
npm test             # Run all tests once (vitest run)
npm run test:watch   # Tests in watch mode
```

## Branching workflow

- `main` — production/stable branch (default)
- `develop` — integration/staging branch for testing before main
- `feat/*` — feature branches; each new feature uses pattern `feat/branchName`
- **Workflow:** Feature branches → PR to `develop` → tested → PR to `main`

## Commit & PR conventions

- Commit messages are in English.
- PRs target `develop`, never `main` directly. The only thing that lands on `main` is a merge from `develop` after it has been tested.
- Keep PRs scoped; if you discover unrelated cleanup, open a separate branch.

## Code conventions

- **CSS class names use English kebab-case:** `.panel-`, `.table-`, `.chart-`, modifiers like `.active`, `.loaded`, `.empty`
- **CSS architecture:** Cascade layers ordered: foundation → controls → data-view → visual-output → feedback. See `src/styles/STYLES_ORGANIZATION.md` for details.
- **Module exports:** camelCase for functions, PascalCase for classes
- **Dependency injection:** Event handlers and render functions are passed as callbacks for testability and to avoid circular dependencies
- **Result pattern:** Functions returning success/failure use `ok(data)` / `fail(reason)` from `src/utils/result.js`
- **DOM IDs:** Use constants from `src/config/elementIds.js` instead of hardcoded strings
- **Color utilities:** Use shared functions from `src/utils/colorUtils.js` — never duplicate hex/rgb conversion logic
- **Chart control listeners:** Use helpers from `src/modules/chartControls/controlListenerHelpers.js` for common patterns (select, checkbox, slider, etc.) — only write inline listeners when cross-dependency logic is needed
- **Join and preset dataset UIs:** Keep orchestration in modules/components and reuse existing event-driven patterns
- **No TypeScript** — plain JS with ES modules. ESLint exists, but its config is intentionally narrow and architecture-focused.

## Documentation conventions

Public functions on the state core, services, and orchestrators carry JSDoc so the IDE can read each function's contract without re-reading the file. The conventions below match the existing style; please match them rather than inventing a new one.

- **Format**: `/** ... */` blocks, tab-indented. `@param {Type} name - description`. `@returns {Type} description` (omit only when the function is `void`).
- **Minimum verbosity**: a 1-line summary plus `@param`/`@returns`. Add `@example`, `@fires`, `@throws`, `@deprecated`, or `@private` only where they convey something a reader could not infer from the signature.
- **Project typedefs** live in [`src/types.js`](src/types.js) (`AppState`, `Dataset`, `ChartConfig`, `PanelBlock`, `ChartSnapshot`, `StateEventType`, …). Import via `@typedef {import('../types.js').Foo} Foo` at the top of the consuming file, then reference `Foo` unqualified downstream. Barrels do not propagate typedefs — always import from `src/types.js` directly.
- **Mutable vs cloned returns**: functions that return a live state reference must say `"Live reference, do not mutate."` in the `@returns` description. Cloned returns say `"Deep clone."`. This footgun is real — mutating a getter return bypasses the facade and breaks reactivity. See [`appState.js`](src/modules/state/appState.js) for examples.
- **Events**: use `@fires STATE_EVENTS.FOO` (the constant name, not the string literal `'foo'`). Functions that conditionally emit must say so in the description.
- **Facade-only-write invariant**: facade module banners reference `@see ARCHITECTURE.md`. Mutation helpers under `src/modules/panelSubsystem/*` and similar are `@internal` and must not be imported from outside the module that backs them.
- **`@ts-check` is not enabled**, by choice. JSDoc here is documentation only; the editor and Claude use it for hover/intellisense without type validation.
- **No HTML site generation** (no typedoc / no jsdoc CLI). Hover and source reading are the deliverable.

## Architecture invariants — do not break

Hard rules. Breaking any of them silently degrades reactivity, and the failure mode is "the UI looks fine until the day it doesn't." See [ARCHITECTURE.md](ARCHITECTURE.md) for the why.

- All writes to application state go through a facade. Never assign to `dataset.*`, `appState.*`, or anything returned from a getter (`getActiveDataset()`, `getAllDatasets()`, `getPanelCharts()`, …).
- Event names live in `STATE_EVENTS`. Never use string literals in `src/`. (Tests intentionally keep literals to exercise the wire format — leave them alone.)
- Subscribers must not synchronously emit a state event from inside their callback (re-entrancy loop). Defer with `queueMicrotask` if you need a follow-up mutation.
- For normalize-on-read paths (e.g. applying chart-config defaults during render), use `normalizeActiveDatasetConfig` — it writes without emitting, which is the only safe shape for that case.
- Renderers are stateless. They read via getters and never mutate.
- `STATE_EVENTS.WILDCARD === '*'` is reserved for state-bus consumers (`stateSync.js`, `persistenceService.js`) that genuinely need every emission. Do not subscribe to it from controllers, renderers, or `main.js` — use a typed subscription.

**Renderer statelessness is enforced by lint.** ESLint (`npm run lint`) restricts files under `src/components/` and `src/features/` to read-only imports from `modules/state/appState.js` — the `get*` functions, `getState`, `onStateChange`, `STATE_EVENTS`, and `sanitizeChartName`. Importing any write function from those directories is an error. If you need a write from a renderer, you're writing it in the wrong layer — route it through a chartControls listener or `eventHandlers.js`, both outside the linted scope. When a new facade read is added, update `APP_STATE_READS` in `eslint.config.js`.

**Mutation of facade getter returns is blocked across all of `src/`.** A `no-restricted-syntax` rule in `eslint.config.js` catches the *inline* forms — `getActiveDataset().X = y` and `getActiveDataset().X.Y = z` at depths 1–3 — against the mutable-ref getters (`getActiveDataset`, `getAllDatasets`, `getPanelCharts`, `getChartSnapshot`, `getPanelBlocks`, `getState`). The *aliased* form (`const ds = getActiveDataset(); ds.X = y`) is caught by a local rule, `chive/no-facade-getter-mutation` ([eslint-rules/no-facade-getter-mutation.js](eslint-rules/no-facade-getter-mutation.js)): it is scope-aware and import-gated (only getters imported from `modules/index.js` or `modules/state/appState.js` count, so DOM `el.dataset.x = y` writes and same-named DI params are not flagged), and it exempts the facade internals under `src/modules/state/` that legitimately use the aliased-write pattern. One gap remains by design: *sub-property* aliasing (`const c = getActiveDataset().chartConfig; c.X = y`) is caught by neither rule — don't write it; route writes through a facade method. When a new mutable-ref getter is added to `appState.js`, update **both** `FACADE_MUTABLE_GETTERS` in `eslint.config.js` and `TRACKED_GETTERS` in the local rule.

**CI runs lint + tests on every push and PR** (`.github/workflows/lint-and-test.yml`, targeting `main` and `develop`). Even if you forget `npm run lint` locally, the merge gate catches it.

### ESLint guards

Beyond renderer statelessness, `npm run lint` enforces these additional rule classes ([eslint.config.js](eslint.config.js)):

- **Raw-static deployment guards.** CHIVE is meant to run served raw from `src/` with no build step, so bundler-/Vite-only import forms are hard errors — they pass dev/test/Vite but break when `src/` is served directly. Banned: bare `d3` / `banana-i18n` imports (use the full `https://esm.sh/…` CDN URL — see `BARE_IMPORT_BANS`), the `?worker` / `?url` / `?raw` suffixes, and `import.meta.glob` / `import.meta.env`. `import.meta.url` stays allowed: it is the standard form for `new Worker(new URL(…), import.meta.url)` and preset asset URLs. To add a runtime dependency, import its full CDN URL — never a bare specifier.
- **Pure-layer boundaries.** `utils/` and `config/` are leaf layers and may not import "upward": `config/` may not import `modules/`, `components/`, `features/`, or `services/`; `utils/` may not import `modules/`, `components/`, or `features/`. (`utils/` → `services/` is currently allowed because `formatters.js` depends on `i18nService` for translation; closing that boundary is a tracked follow-up.)
- **General hygiene, as warnings.** `no-unused-vars`, `prefer-const`, `no-var`, `eqeqeq`, and `curly` (`multi-line` — braces required only when a body spans multiple lines, matching the brace-free single-line style) run as **warnings**, not errors: CI runs `npm run lint` with no `--max-warnings`, so they surface cleanup without gating merges. Policy: architecture and deployment guards are errors; general style is warnings.

## Where do I put new code?

| If you're adding… | Put it in | Notes |
|---|---|---|
| A new chart type | `src/modules/visualizations/{name}.js` + `src/modules/chartControls/{name}Controls.js` | Register in `chartControls/chartControlsManager.js` and `config/chartDefaults.js`. |
| A new state field | The relevant domain in `src/modules/state/appState.js` + a facade method that mutates and emits a new `STATE_EVENTS` constant | Add the constant to the domain group in `stateEvents.js`. |
| A new DOM event handler | `src/modules/eventHandlers.js` (or an existing controller) | Translate the event into a facade call. Never mutate state directly. |
| A new view / tab | `src/components/` + a `renderXxx` function called from `refreshView` in `main.js` | Read state via getters; pass callbacks for user actions. |
| A pure helper (formatting, parsing, color) | `src/utils/` | No DOM access. No state imports. |
| A new derived selector | The facade that owns the underlying domain | Keep getters thin; don't compute heavy aggregates inside them. |

## Testing

- Framework: Vitest with jsdom environment
- Files needing DOM must declare `// @vitest-environment jsdom` at the top
- Tests live in `tests/` mirroring `src/` structure
- Patterns: `describe`/`it`/`expect`, `beforeEach` for state reset, `vi.mock()` for mocking
- **Windows stale cache issue:** Vitest on Windows may fail all suites with `Cannot read properties of undefined (reading 'config')` after file changes.
  - PowerShell fix: `Remove-Item -Recurse -Force node_modules/.vite, node_modules/.vitest`
  - Bash fix: `rm -rf node_modules/.vite node_modules/.vitest`
  - Then rerun: `npm test`

## Debugging

- `window.chiveDebug` exposes thirteen entries grouped as: state getters (`getState`, `getActiveDataset`, `getLoadedDatasets`), facade mutators (`updateDatasetColumns`, `updateDatasetConfig`), UI helpers (`switchTab`, `refreshView`, `showFeedback`, `showError`), and four state-log helpers (`enableStateLog`, `disableStateLog`, `getStateLog`, `clearStateLog`).
- `chiveDebug.enableStateLog()` prints every emit as `[chive:state] <type> <data>` and stores the last 100 entries; `getStateLog()` returns them, `clearStateLog()` resets the buffer, `disableStateLog()` turns it off.
- To diagnose a surprising re-render: enable the log, perform the action, then read `getStateLog()` to see the exact event chain that fired.
