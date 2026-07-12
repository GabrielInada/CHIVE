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
| `src/config/` | Pure leaf layer: canonical chart identities, chart defaults, element IDs, limits, locale, and format constants. No imports from modules, components, or services. |
| `src/utils/` | Pure leaf layer: DOM-free helpers (result pattern, color utilities, filters, formatters). Same import rule as `config/`. One deliberate DOM exception: `chartContainerLifecycle.js`, the dispose-aware chart-container clear shared by components, the panel subsystem, and chart packages. |
| `src/components/` | Leaf renderers for the dataset workspace: `components/datasetWorkspace/` holds the top view `datasetWorkspaceView.js` plus the preview, stats, columns, and dialogs. |
| `src/modules/state/` | State core: `appState.js`, the data/panel/ui facades, `stateEvents.js`, and `stateDebug.js`. The only write path for application state. |
| `src/modules/eventHandlers/` | DOM intent translation: workflow modules that turn user events into facade calls, wired by `modules/eventHandlers.js`. |
| `src/modules/fileManager.js`, `panelManager.js`, `uiManager.js`, `chartControls/` | Feature managers: each owns a domain end to end (DOM intent, facade writes, bus subscriptions, render triggering). `chartControls/` holds the shared control infrastructure used by chart packages. |
| `src/modules/feedbackUI.js`, `dialogFocus.js` | Cross-feature UI helpers: user feedback surface and dialog focus management. |
| `src/modules/panelSubsystem/` | Panel rendering, export, resize, slot lifecycle, and the panel's internal mutation helpers. |
| `src/charts/` | Chart presentation metadata (`catalog.js` and `previews.js`), independent controls/workspace/panel lookup under `registries/`, D3/SVG per-chart packages (`charts/bar/`, `charts/pie/`, `charts/treemap/`, `charts/bubble/`, `charts/line/`, `charts/scatter/`, `charts/network/`, and `charts/tin/`), the Three.js/WebGL package (`charts/scatter3d/`), and shared chart-only infrastructure under `charts/shared/`. A package keeps its data prep, options, renderers, controls, workspace section, presentation flow, and panel adapter together; leaf boundaries are enforced by lint. |
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
| Renderer | Chart/SVG/WebGL rendering from explicit inputs | `charts/bar/renderers/svg.js` |
| Service | Side effects, persistence, ingest, i18n, reusable domain operations | `services/persistenceService.js` |
| Facade | State or service boundary | `modules/state/dataStateFacade.js` |
| Catalog | Identity-keyed descriptive or presentation metadata | `charts/catalog.js` |
| Registry | Supported-type implementation lookup for one integration surface | `charts/registries/workspace.js` |
| Adapter | Bridge between a generic system and a chart/domain implementation | `charts/bar/panelAdapter.js` |

Manager is legacy naming, still valid for existing files: `fileManager.js`,
`panelManager.js`, `uiManager.js`, and `chartControlsManager.js` keep their
names until their domains are reworked for real. Controller is the name for
new feature or domain flow owners. Do not rename a Manager for aesthetics
alone; do not use Controller for pure renderers, services, registries, or
math helpers.

## Where Do I Put New Code?

| If you're adding... | Put it in | Notes |
|---|---|---|
| A new chart type | A per-chart package under `src/charts/{name}/` | Use `charts/bar/` as the SVG template or `charts/scatter3d/` as the Three.js/WebGL template, then follow the chart-type checklist below. |
| A new state field | The relevant domain in `src/modules/state/appState.js` + a facade method that mutates and emits a new `STATE_EVENTS` constant | Add the constant to the domain group in `stateEvents.js`. |
| A new DOM event handler | The matching workflow file under `src/modules/eventHandlers/` (or an existing feature manager) | Translate the event into a facade call. Never mutate state directly. Register a global `document`/`window` listener once behind a module-level guard so a repeated `setup*` call cannot stack duplicates. |
| A new view / tab | `src/components/` + a `renderXxx` function called from `refreshView` in `main.js` | Read state via getters; pass callbacks for user actions. |
| A pure helper | `src/utils/` | No DOM access (single deliberate exception: `chartContainerLifecycle.js`). No state imports. |
| A new derived selector | The facade that owns the underlying domain | Keep getters thin; do not compute heavy aggregates inside them. |

For a new chart type, update the full chart surface in one pass:

- Build the package's data/options modules, renderer, controls, workspace
  section, presentation flow, and panel adapter, then register those entry
  points in `charts/registries/controls.js`,
  `charts/registries/workspace.js`, and `charts/registries/panel.js`.
- Register the chart identity and visual precedence in
  `config/chartTypes.js`, its preview/category metadata in
  `charts/catalog.js` and `charts/previews.js`, and its default config block in
  `config/chartDefaults.js`.
- The type also registers in `types.js` (`ChartTypeKey`),
  `config/elementIds.js`, `eventHandlers/chartSnapshotMetadata.js`, and the
  static chart block in `index.html`. Add chart constants to `config/charts.js`
  when the implementation needs them.
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
- Per-chart packages are the chart direction: a chart's data prep,
  options, math/scales, renderers, controls, workspace section, and panel
  adapter live together. `charts/scatter3d/` established the Three.js path and
  `charts/bar/` established the shared SVG path. `charts/pie/`,
  `charts/treemap/`, `charts/bubble/`, `charts/line/`, `charts/scatter/`,
  `charts/network/`, and `charts/tin/` are the completed migrations from the
  legacy SVG directories.
- Chart integration stays split by surface. `charts/registries/controls.js`,
  `workspace.js`, and `panel.js` each import only their own adapters and expose
  canonical-order support lists; no universal chart registry joins those
  import graphs.
- D3 stays the math engine (scales, extents, grouping, hierarchy and layout
  math, interpolation, data transforms). Three.js owns
  scene/camera/material/geometry rendering only. The contract:
  rows/config/columns -> chart model -> D3 math/layout -> SVG or Three
  renderer.
- Chart package boundaries: data, options, color, math, and scales files stay pure;
  renderers never import application state or write facades; controls may
  write only through shared chart-control adapters; a workspace
  section receives callbacks and owns no global state; a panel adapter maps
  chart config/data to the panel's snapshot and render contracts. Boundary
  lint rules for `src/charts/**` are in place in `eslint.config.js`.
- Canvas charts have no SVG export yet: the scatter3d block ships without a
  download button and panel exports omit canvas slots (with a feedback
  notice). A raster export path is a later tranche.
- Tests mirror moves: when a source file moves, its tests move with it under
  `tests/`; per-chart packages mirror under `tests/charts/<name>/`.
- Explicitly avoided: big-bang migrations, broad `index.js` barrels, naming
  every module a Controller, moving CSS into feature folders, and renames
  for aesthetics alone.
