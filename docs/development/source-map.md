# Source Map

Where code lives, what to name it, and where new code goes. Start with the
[Architecture overview](architecture.md) for the ownership model behind these
roles; use this file when you need to place or name a file.

| Field | Value |
|---|---|
| Audience | Contributors deciding where a file belongs and what to name it. |
| Source of truth | Source tree layout, naming vocabulary, code placement rules, and structure direction. |
| Update when | Directories move, a naming role is added or retired, or placement rules change. |

## Current Source Tree

CHIVE is served raw from `src/`, so the tree below is both the source layout
and the deployed layout. Roles, not file history, decide where a file belongs.

| Path | Role |
|---|---|
| `src/main.js` | Orchestrator: boot, service wiring, broad refresh scheduling, and the `window.chiveDebug` handle. |
| `src/types.js` | Shared JSDoc typedefs (`AppState`, `Dataset`, `ChartConfig`, ...). Always imported directly, never through barrels. |
| `src/config/` | Pure leaf layer: chart defaults, element IDs, limits, locale, and format constants. No imports from modules, components, or services. |
| `src/utils/` | Pure leaf layer: DOM-free helpers (result pattern, color utilities, filters, formatters). Same import rule as `config/`. |
| `src/components/` | Leaf renderers for the dataset workspace: `components/datasetWorkspace/` holds the top view `datasetWorkspaceView.js` plus the preview, stats, columns, and dialog views and the per-chart `chartRenders/` sections. |
| `src/modules/state/` | State core: `appState.js`, the data/panel/ui facades, `stateEvents.js`, and `stateDebug.js`. The only write path for application state. |
| `src/modules/eventHandlers/` | DOM intent translation: workflow modules that turn user events into facade calls, wired by `modules/eventHandlers.js`. |
| `src/modules/fileManager.js`, `panelManager.js`, `uiManager.js`, `chartControls/` | Feature managers: each owns a domain end to end (DOM intent, facade writes, bus subscriptions, render triggering). `chartControls/` also holds the per-chart controls packages (`barControls/`, `scatterControls/`, ...). |
| `src/modules/feedbackUI.js`, `dialogFocus.js` | Cross-feature UI helpers: user feedback surface and dialog focus management. |
| `src/modules/panelSubsystem/` | Panel rendering, export, resize, slot lifecycle, and the panel's internal mutation helpers. |
| `src/modules/visualizations/` | Chart renderers (D3), some with subpackages (`scatterPlot/`, `lineChart/`, ...). Read-only with respect to application state. |
| `src/services/` | Side-effecting services: `dataService/`, `persistenceService/` with the `persistence/` backends, `i18nService.js`, `presetService.js`, and `dataIngestService.js`. |
| `src/data/` | Bundled preset datasets (`presets/`) and `presetCatalog.js`. |
| `src/workers/` | Background workers: `persistWorker.js` for persistence and `dataIngestWorker.js` for data ingest. |
| `src/styles/` | CSS layer files. Source of truth: [Stylesheet organization](styles.md). |
| `src/i18n/` | Locale JSON files. Source of truth: [Translation guide](i18n.md). |
| `src/icons/` | App icons and static SVG assets. |

## Naming Vocabulary

Use this vocabulary consistently for new files and for renames that ride along
with real work:

| Name | Use For | Example |
|---|---|---|
| Orchestrator | App boot, broad scheduling, global wiring | `main.js` fills this role |
| Controller | Feature/domain flow ownership: DOM intent, facade writes, service calls, render coordination | a future `panelController.js` |
| View | DOM building/rendering from inputs and callbacks | `components/datasetWorkspace/tablePreviewView.js` |
| Renderer | Chart/SVG rendering from explicit inputs | `modules/visualizations/scatterPlot.js` |
| Service | Side effects, persistence, ingest, i18n, reusable domain operations | `services/persistenceService.js` |
| Facade | State or service boundary | `modules/state/dataStateFacade.js` |
| Registry | Supported-type maps and implementation lookup | `modules/chartControls/chartTypes.js` |
| Adapter | Bridge between a generic system and a chart/domain implementation | a future `panelAdapter.js` |

Manager is legacy naming, still valid for existing files: `fileManager.js`,
`panelManager.js`, `uiManager.js`, and `chartControlsManager.js` keep their
names until their domains are reworked for real. Controller is the name for
new feature or domain flow owners. Do not rename a Manager for aesthetics
alone; do not use Controller for pure renderers, services, registries, or
math helpers.

## Where Do I Put New Code?

| If you're adding... | Put it in | Notes |
|---|---|---|
| A new chart type | For current 2D chart work: `src/modules/visualizations/{name}.js` + `src/modules/chartControls/{name}Controls.js` + `src/components/datasetWorkspace/chartRenders/{name}ChartSection.js` | Follow the chart-type checklist below. The first Three.js-capable chart pilots the per-chart package layout instead; see [Direction](#direction). |
| A new state field | The relevant domain in `src/modules/state/appState.js` + a facade method that mutates and emits a new `STATE_EVENTS` constant | Add the constant to the domain group in `stateEvents.js`. |
| A new DOM event handler | The matching workflow file under `src/modules/eventHandlers/` (or an existing feature manager) | Translate the event into a facade call. Never mutate state directly. Register a global `document`/`window` listener once behind a module-level guard so a repeated `setup*` call cannot stack duplicates. |
| A new view / tab | `src/components/` + a `renderXxx` function called from `refreshView` in `main.js` | Read state via getters; pass callbacks for user actions. |
| A pure helper | `src/utils/` | No DOM access. No state imports. |
| A new derived selector | The facade that owns the underlying domain | Keep getters thin; do not compute heavy aggregates inside them. |

For a new chart type, update the full chart surface in one pass:

- Register the type, controls, defaults, workspace render, and panel dispatch in
  `chartControls/chartTypes.js`, `chartControls/chartControlsManager.js`,
  `config/chartDefaults.js`, `components/datasetWorkspace/chartsView.js`, and
  `panelSubsystem/renderChartFromSpec.js`.
- Add i18n strings, tests, [Chart and data reference](../user/chart-reference.md)
  coverage, and a chart deep dive.

Non-JS additions have their own homes:

- Tests mirror `src/` under `tests/`.
- CSS goes through `src/styles/`; see
  [Stylesheet organization](styles.md).
- UI strings go through `src/i18n/` (all locales together); see the
  [Translation guide](i18n.md).
- Preset datasets go through `src/data/presets/` plus the catalog and
  translation keys; see the
  [Preset dataset guide](preset-datasets.md).

## Direction

The tree is moving toward a hybrid feature/domain structure in small,
behavior-preserving steps. Structure follows ownership, not file history.
The rules, in place of a speculative target tree:

- The dataset workspace replaces the "results" naming, and the workspace
  files now live in `components/datasetWorkspace/`. DOM element ids, CSS
  classes, and i18n keys keep the old naming until they are touched with
  real work.
- Per-chart packages are the long-term chart direction: a chart's data prep,
  options, math/scales, renderers, controls, workspace section, and panel
  adapter live together. The first Three.js-capable chart pilots this layout;
  existing charts migrate one at a time, when they are already being changed.
- D3 stays the math engine (scales, extents, grouping, hierarchy and layout
  math, interpolation, data transforms). Three.js, when it lands, owns
  scene/camera/material/geometry rendering only. The contract:
  rows/config/columns -> chart model -> D3 math/layout -> SVG or Three
  renderer.
- Chart package boundaries: data, options, math, and scales files stay pure;
  renderers never import application state or write facades; controls may
  call config-write facades while that remains the pattern; a workspace
  section receives callbacks and owns no global state; a panel adapter maps
  chart config/data to the panel's snapshot and render contracts. Boundary
  lint rules land before or during the chart migration.
- Tests mirror moves: when a source file moves, its tests move with it under
  `tests/`.
- Explicitly avoided: big-bang migrations, broad `index.js` barrels, naming
  every module a Controller, moving CSS into feature folders, and renames
  for aesthetics alone.
