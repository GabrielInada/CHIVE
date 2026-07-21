# Contributor Reference

Detailed contributor notes for CHIVE. Start with
[CONTRIBUTING.md](../../CONTRIBUTING.md); use this file when a change needs the
deeper rules behind documentation, JSDoc, architecture lint guards, testing,
or debugging.

| Field | Value |
|---|---|
| Audience | Contributors and maintainers changing code, tests, or documentation. |
| Source of truth | Detailed JSDoc conventions, lint guard explanations, testing notes, and debugging helpers. |
| Update when | Architecture guards, JSDoc style, test setup, or debug exports change. |

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
  removing, or renaming a state field, `appState.js` export, facade method,
  `STATE_EVENTS` constant, production emitter/subscriber, persistence schema
  identifier, guarded getter, or supported panel chart.

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
  [`appState.js`](../../src/state/appState.js) for examples.
- **Captured vs frozen:** use “captured” or “detached” for panel data/config
  copied with `structuredClone`. Do not call the state object frozen unless the
  implementation actually applies `Object.freeze`; panel getters remain live
  references under the read-only policy.
- **Events:** use `@fires STATE_EVENTS.FOO`, with the constant name rather than
  the string literal. Functions that conditionally emit must say so in the
  description.
- **Facade-only-write invariant:** facade module banners reference
  `@see docs/development/architecture.md`. Exact state/facade/event details
  live in [Architecture reference](architecture-reference.md). Mutation helpers
  under `src/state/panel/` are `@internal` and must not be imported from
  outside `panelStateFacade.js`.
- **`@ts-check` is not enabled**, by choice. JSDoc here is documentation only;
  editors can use it for hover/intellisense without type validation.
- **No HTML site generation:** no typedoc or jsdoc CLI. Hover and source reading
  are the deliverable.

## Architecture Guard Details

The architecture invariants in [CONTRIBUTING.md](../../CONTRIBUTING.md) are
enforced partly by lint and partly by review.

**The renderer write-facade boundary is enforced by lint.** ESLint (`npm run lint`)
restricts renderer and DOM-builder files (the dataset workspace views and
dialogs, the panel feature presentation paths under `src/features/panel/`, and
the settings dialog; see
[`eslint.config.js`](../../eslint.config.js))
to the members listed in `APP_STATE_READS` in `eslint.config.js`: the current
focused getters (excluding persistence-only `getPersistenceSnapshot`),
`getState`, `onStateChange`, `STATE_EVENTS`, and `sanitizeChartName`. Importing
any write function from those directories is an error. If you need a write from
a renderer or DOM builder, route it through a feature controller (`panelController.js`,
a chart-controls listener, or an `app/bindings/` workflow module), all outside the
linted scope.
When a new renderer-safe read is added, update `APP_STATE_READS` in
`eslint.config.js`; reads meant for persistence, debug, or internal use are
not added there (`getPersistenceSnapshot` is the precedent).

**The browser entrypoint boundary is enforced by lint.** `src/entries/*.js`
import only from `src/app/` (and not from each other). Put initialization order in
`app/applicationInitializer.js`, render scheduling in
`app/renderCoordinator.js`, and debug-surface construction in
`app/debugApi.js`; do not wire features or services back into the entrypoint.

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
`src/state/` that legitimately use the aliased-write pattern. One gap
remains by design: sub-property aliasing
(`const c = getActiveDataset().chartConfig; c.X = y`) is caught by neither rule.
Do not write it; route writes through a facade method. When a new mutable-ref
getter is added to `appState.js`, update both `FACADE_MUTABLE_GETTERS` in
`eslint.config.js` and `TRACKED_GETTERS` in the local rule.

**State-bus routing is a reviewed contract with drift coverage.** Callers of
`emitStateChange` and `onStateChange` use `STATE_EVENTS.*`; the registry itself
necessarily defines the string wire values, and tests may exercise literals.
Do not synchronously emit from a subscriber. When an owner truly needs a
follow-up mutation, use a lint-safe deferral such as
`window.queueMicrotask(() => { ... })`. The only production wildcard
subscription is in `src/services/persistence/autoSave.js`; feature/render
owners use typed subscriptions.

**CI runs the full local check on every push and PR** through
`.github/workflows/lint-and-test.yml`, targeting `main` and `develop`.

CI runs `npm run check`, which executes JavaScript lint, CSS lint, tests, and
the production build. The CSS lint step is owned by
[Stylesheet organization](styles.md): it checks `src/styles/**/*.css`, ignores
vendored CSS, blocks on correctness errors, and keeps selector/custom property
naming conventions warning-only under the current policy.

## ESLint Guards

Beyond the no-write-during-render invariant (renderers do not write state during
render; chart config is canonicalized at the state boundaries via
`canonicalizeChartConfig`, so render never repairs it), `npm run lint` enforces
these rule classes in [`eslint.config.js`](../../eslint.config.js):

- **Raw-static deployment guards.** CHIVE is meant to run served raw from `src/`
  and `vendor/` with no build step, so bundler-/Vite-only import forms are hard
  errors. Banned forms include bare `d3` / `banana-i18n` imports, `https://esm.sh`
  runtime imports, the `?worker` / `?url` / `?raw` suffixes, and
  `import.meta.glob` / `import.meta.env`. `import.meta.url` stays allowed for
  workers and preset asset URLs. Browser runtime dependencies should be vendored
  into `vendor/` with license files committed, then smoke-tested with a plain
  static server.
- **Pure-layer boundaries.** `utils/` and `config/` are leaf layers and may not
  import `app/`, `state/`, `features/`, `services/`, or `ui/`. Ownership-neutral
  `utils/` additionally may not import `domain/` or `charts/`. `domain/` has the
  higher-layer boundary and may not import the chart presentation layer under
  `src/charts/`; domain owner directories such as `domain/charts/` may depend
  on one another. Both `utils/` and `domain/` reject direct `document` and
  `window` access.
- **Composition-layer dependency direction.** `entries/` and `app/` are the composition
  layers: `features/` and `ui/` may not import either of them. `ui/` (ownerless
  browser UI mechanics such as feedback toasts and the dialog focus trap) is a
  strict leaf that imports only `config/`, `utils/`, `types.js`, or vendored
  modules. `tests/lint/boundaries.test.js` proves each boundary still fires,
  guarding against flat-config blocks silently dropping a pattern group.
  Reverse edges from general `state/`, `services/`, `workers/`, and `data/`
  modules into `ui/` are not yet lint-banned; no such edge exists today, and
  enforcing them requires careful flat-config restatements around
  `persistWorker.js`, so it is deferred to a later tranche. These restrictions
  do not claim that the complete repository import graph is a DAG.
- **DOM ID ownership.** Centralize an ID only when multiple modules consume it
  or it forms a contract with static HTML. Put that contract in the owner's
  `domIds.js` (`charts/workspaceDomIds.js` for chart workspace blocks). A
  single-module HTML contract may stay as an exported constant in that owner
  module; other single-use selectors stay literal-local. Cover static markup in
  `tests/staticHtml/parity.test.js`.
- **Panel state internals.** `src/state/panel/` may import only state,
  domain, config, utils, shared types, or vendored modules. Presentation,
  feature, chart, service, and legacy panel-subsystem imports are lint errors.
- **General hygiene, as warnings.** `no-unused-vars`, `prefer-const`, `no-var`,
  `eqeqeq`, and `curly` run as warnings, not errors. Architecture, deployment,
  and correctness rules are errors; general style is surfaced without gating
  merges.
- **`no-undef` is an error.** Browser and Web Worker globals are maintained by
  hand in `BROWSER_GLOBALS` to avoid the `globals` dependency. The first time
  you use a new browser API, add it there or lint will flag it.

## Where Do I Put New Code?

The code placement table, source tree layout, and naming vocabulary live in
the [Source map](source-map.md#where-do-i-put-new-code).

## Testing

- Framework: Vitest with the default Node environment.
- Files needing DOM opt into jsdom by declaring
  `// @vitest-environment jsdom` at the top.
- Tests live in `tests/` and mirror source ownership at the directory or
  package level; not every implementation file needs a one-to-one test file.
- Split multi-concern suites with a dotted concern suffix such as
  `<owner>.<concern>.test.js`.
- Put fixtures shared by sibling suites in `*.testSupport.js` modules. Vitest
  does not collect that suffix as a test suite.
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

`app/debugApi.js` constructs `window.chiveDebug`, which exposes state getters
(`getState`, `getStateSummary`, `getActiveDataset`, `getLoadedDatasets`), facade mutators
(`updateDatasetColumns`, `updateDatasetConfig`), UI helpers (`switchTab`, `refreshView`, `showFeedback`,
`showError`), and state-log helpers (`enableStateLog`, `disableStateLog`,
`getStateLog`, `clearStateLog`).

`chiveDebug.enableStateLog()` prints every emit as
`[chive:state] <type> <data>` and stores the last 100 entries. To diagnose a
surprising re-render, enable the log, perform the action, then read
`getStateLog()` to see the exact event chain that fired.
