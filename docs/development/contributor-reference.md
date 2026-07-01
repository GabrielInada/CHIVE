# Contributor Reference

Detailed contributor notes for CHIVE. Start with
[CONTRIBUTING.md](../../CONTRIBUTING.md); use this file when a change needs the
deeper rules behind documentation, JSDoc, architecture lint guards, code
placement, testing, or debugging.

| Field | Value |
|---|---|
| Audience | Contributors and maintainers changing code, tests, or documentation. |
| Source of truth | Detailed JSDoc conventions, lint guard explanations, code placement guidance, testing notes, and debugging helpers. |
| Update when | Architecture guards, JSDoc style, code ownership, test setup, or debug exports change. |

## Documentation And JSDoc Conventions

Public functions on the state core, services, and orchestrators carry JSDoc so
the IDE can read each function's contract without re-reading the file. Match the
existing style.

When moving, renaming, or adding documentation:

- Search for old file names and paths with `rg`.
- Check Markdown links changed by the edit.
- Update issue templates when a top-level or user-facing doc target changes.
- Update [Documentation hub](../README.md) when a user-facing or top-level doc
  is added, moved, or renamed.
- Update [Architecture reference](architecture-reference.md) when adding,
  removing, or renaming a state field, facade method, `STATE_EVENTS` constant,
  or production subscriber.

JSDoc rules:

- **Format:** `/** ... */` blocks, tab-indented. Use
  `@param {Type} name - description`. Use `@returns {Type} description` and
  omit it only when the function is `void`.
- **Minimum verbosity:** a 1-line summary plus `@param`/`@returns`. Add
  `@example`, `@fires`, `@throws`, `@deprecated`, or `@private` only where they
  convey something a reader could not infer from the signature.
- **Project typedefs** live in [`src/types.js`](../../src/types.js)
  (`AppState`, `Dataset`, `ChartConfig`, `PanelBlock`, `ChartSnapshot`,
  `StateEventType`, ...). Import via
  `@typedef {import('../types.js').Foo} Foo` at the top of the consuming file,
  then reference `Foo` unqualified downstream. Barrels do not propagate
  typedefs; always import from `src/types.js` directly.
- **Mutable vs cloned returns:** functions that return a live state reference
  must say `"Live reference, do not mutate."` in the `@returns` description.
  Cloned returns say `"Deep clone."` Mutating a getter return bypasses the
  facade and breaks reactivity. See
  [`appState.js`](../../src/modules/state/appState.js) for examples.
- **Events:** use `@fires STATE_EVENTS.FOO`, with the constant name rather than
  the string literal. Functions that conditionally emit must say so in the
  description.
- **Facade-only-write invariant:** facade module banners reference
  `@see docs/development/architecture.md`. Exact state/facade/event details
  live in [Architecture reference](architecture-reference.md). Mutation helpers
  under `src/modules/panelSubsystem/*` and similar are `@internal` and must not
  be imported from outside the module that backs them.
- **`@ts-check` is not enabled**, by choice. JSDoc here is documentation only;
  editors can use it for hover/intellisense without type validation.
- **No HTML site generation:** no typedoc or jsdoc CLI. Hover and source reading
  are the deliverable.

## Architecture Guard Details

The architecture invariants in [CONTRIBUTING.md](../../CONTRIBUTING.md) are
enforced partly by lint and partly by review.

**The write-facade boundary is enforced by lint.** ESLint (`npm run lint`)
restricts renderer and DOM-builder files (`src/components/`, `src/features/`,
`src/modules/visualizations/`, and an explicit list of presentation files under
`src/modules/panelSubsystem/`; see [`eslint.config.js`](../../eslint.config.js))
to read-only imports from `modules/state/appState.js`: the `get*` functions,
`getState`, `onStateChange`, `STATE_EVENTS`, and `sanitizeChartName`. Importing
any write function from those directories is an error. If you need a write from
a renderer or DOM builder, route it through a feature manager (`panelManager.js`,
a chart-controls listener, or an `eventHandlers/` workflow module), all outside the
linted scope.
When a new facade read is added, update `APP_STATE_READS` in `eslint.config.js`.

**Mutation of facade getter returns is blocked across all of `src/`.** A
`no-restricted-syntax` rule in `eslint.config.js` catches inline assignments and
in-place mutating method calls against the mutable-ref getters:
`getActiveDataset`, `getAllDatasets`, `getPanelCharts`, `getChartSnapshot`,
`getPanelBlocks`, `getState`, and `getPersistenceSnapshot`.
`getPersistenceSnapshot` is the save path's read-only live-reference view; treat
it exactly like the other live getters. The aliased form
(`const ds = getActiveDataset(); ds.X = y`) is caught by the local
`chive/no-facade-getter-mutation` rule
([`eslint-rules/no-facade-getter-mutation.js`](../../eslint-rules/no-facade-getter-mutation.js)).
It is scope-aware and import-gated, and it exempts the facade internals under
`src/modules/state/` that legitimately use the aliased-write pattern. One gap
remains by design: sub-property aliasing
(`const c = getActiveDataset().chartConfig; c.X = y`) is caught by neither rule.
Do not write it; route writes through a facade method. When a new mutable-ref
getter is added to `appState.js`, update both `FACADE_MUTABLE_GETTERS` in
`eslint.config.js` and `TRACKED_GETTERS` in the local rule.

**CI runs lint and tests on every push and PR** through
`.github/workflows/lint-and-test.yml`, targeting `main` and `develop`.

CI runs `npm run lint`, `npm run lint:css`, and `npm test`. The CSS lint step is
owned by [Stylesheet organization](styles.md): it checks `src/styles/**/*.css`,
ignores vendored CSS, blocks on correctness errors, and keeps selector/custom
property naming conventions warning-only during the first rollout.

## ESLint Guards

Beyond renderer statelessness, `npm run lint` enforces these rule classes in
[`eslint.config.js`](../../eslint.config.js):

- **Raw-static deployment guards.** CHIVE is meant to run served raw from `src/`
  and `vendor/` with no build step, so bundler-/Vite-only import forms are hard
  errors. Banned forms include bare `d3` / `banana-i18n` imports, `https://esm.sh`
  runtime imports, the `?worker` / `?url` / `?raw` suffixes, and
  `import.meta.glob` / `import.meta.env`. `import.meta.url` stays allowed for
  workers and preset asset URLs. Browser runtime dependencies should be vendored
  into `vendor/` with license files committed, then smoke-tested with a plain
  static server.
- **Pure-layer boundaries.** `utils/` and `config/` are leaf layers and may not
  import `modules/`, `components/`, `features/`, or `services/`.
- **General hygiene, as warnings.** `no-unused-vars`, `prefer-const`, `no-var`,
  `eqeqeq`, and `curly` run as warnings, not errors. Architecture, deployment,
  and correctness rules are errors; general style is surfaced without gating
  merges.
- **`no-undef` is an error.** Browser and Web Worker globals are maintained by
  hand in `BROWSER_GLOBALS` to avoid the `globals` dependency. The first time
  you use a new browser API, add it there or lint will flag it.

## Where Do I Put New Code?

| If you're adding... | Put it in | Notes |
|---|---|---|
| A new chart type | `src/modules/visualizations/{name}.js` + `src/modules/chartControls/{name}Controls.js` | Register in `chartControls/chartControlsManager.js` and `config/chartDefaults.js`. Document its data contract, modes, and empty states in [Chart and data reference](../user/chart-reference.md). |
| A new state field | The relevant domain in `src/modules/state/appState.js` + a facade method that mutates and emits a new `STATE_EVENTS` constant | Add the constant to the domain group in `stateEvents.js`. |
| A new DOM event handler | The matching workflow file under `src/modules/eventHandlers/` (or an existing feature manager) | Translate the event into a facade call. Never mutate state directly. Register a global `document`/`window` listener once behind a module-level guard so a repeated `setup*` call cannot stack duplicates. |
| A new view / tab | `src/components/` + a `renderXxx` function called from `refreshView` in `main.js` | Read state via getters; pass callbacks for user actions. |
| A pure helper | `src/utils/` | No DOM access. No state imports. |
| A new derived selector | The facade that owns the underlying domain | Keep getters thin; do not compute heavy aggregates inside them. |

## Testing

- Framework: Vitest with jsdom environment.
- Files needing DOM must declare `// @vitest-environment jsdom` at the top.
- Tests live in `tests/` mirroring `src/` structure.
- Patterns: `describe`/`it`/`expect`, `beforeEach` for state reset, and
  `vi.mock()` for mocking.

Vitest on Windows may fail all suites with
`Cannot read properties of undefined (reading 'config')` after file changes.
Clear the Vite/Vitest caches and rerun:

```powershell
Remove-Item -Recurse -Force node_modules/.vite, node_modules/.vitest
npm test
```

Bash equivalent:

```bash
rm -rf node_modules/.vite node_modules/.vitest
npm test
```

## Debugging

`window.chiveDebug` exposes state getters (`getState`, `getActiveDataset`,
`getLoadedDatasets`), facade mutators (`updateDatasetColumns`,
`updateDatasetConfig`), UI helpers (`switchTab`, `refreshView`, `showFeedback`,
`showError`), and state-log helpers (`enableStateLog`, `disableStateLog`,
`getStateLog`, `clearStateLog`).

`chiveDebug.enableStateLog()` prints every emit as
`[chive:state] <type> <data>` and stores the last 100 entries. To diagnose a
surprising re-render, enable the log, perform the action, then read
`getStateLog()` to see the exact event chain that fired.
