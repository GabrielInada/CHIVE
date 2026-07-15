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
| `src/main.js` | Browser entrypoint: waits for DOM readiness, starts the application, and installs the debug surface. |
| `src/app/` | Application orchestration: `applicationInitializer.js` owns initialization order and the top-level error boundary; `renderCoordinator.js` owns full/region scheduling, render composition, and render-affecting state subscriptions; `debugApi.js` constructs `window.chiveDebug`; `domBindings.js` composes every DOM listener in boot order. `uiManager.js` owns the app shell (tabs, sidebar mode, sidebar collapse), `settingsController.js` the settings flow, and `feedbackUI.js` / `dialogFocus.js` are cross-feature UI helpers no single feature owns. |
| `src/app/bindings/` | App-level DOM intent translation: workflow modules that turn user events into facade calls, wired by `app/domBindings.js`. These are app-level rather than feature-owned because project transfer owns the whole project, sidebar navigation spans both features, the keyboard shortcut is global, and the chart actions are delegated off static `index.html` markup. Feature-owned bindings live with their feature (see `features/datasetWorkspace/bindings/`). |
| `src/types.js` | Shared JSDoc typedefs (`AppState`, `Dataset`, `ChartConfig`, ...). Always imported directly, never through barrels. |
| `src/config/` | Pure leaf layer: canonical chart identities, chart defaults, element IDs, limits, locale, and format constants. No imports from modules, components, or services. |
| `src/utils/` | Pure leaf layer: DOM-free helpers (result pattern, color utilities, filters, formatters). Same import rule as `config/`. One deliberate DOM exception: `chartContainerLifecycle.js`, the dispose-aware chart-container clear shared by components, the panel feature, and chart packages. |
| `src/domain/` | Pure product rules with one owner per subdirectory. `domain/panel/` holds the layout-template registry (`layoutTemplates.js`) and the panel-block model with the shared percentage clamp (`panelBlockModel.js`). `domain/datasets/` holds the dataset algorithms: parsing and delimiter detection (`parse.js`), type and decimal detection (`typeDetection.js`), row normalization (`processData.js`), per-column statistics (`statistics.js`), and joins (`join.js`). Leaf layer like `config/` and `utils/`: no imports from modules, components, services, or charts. |
| `src/components/` | Leaf renderers: `components/settingsDialog.js` is the callback-driven global settings modal opened from the shared header. The dataset workspace views and dialogs now live in `features/datasetWorkspace/`. |
| `src/state/` | State core: `appState.js`, the data/panel/ui facades, `stateEvents.js`, and `stateDebug.js`. Panel facade-only mutation primitives live under `state/panel/`. The only write path for application state. |
| `src/features/datasetWorkspace/chartControls/` | The charts tab's controls sidebar: `chartControlsController.js` owns it end to end (DOM intent, facade writes, render triggering), `chartConfigAdapter.js` builds the `ChartConfigWriter` each chart package writes through, `livePreviewBridge.js` holds the replaceable live-render callback, and `chartHeightResize.js` owns the drag handles. The pure control DOM factories and the writer-driven listener bindings live under `charts/shared/controls/`. |
| `src/features/datasetWorkspace/` | Dataset workspace feature package: `datasetController.js` owns file upload, dataset add/remove/select, joins, and preset loading (facade writes); `workspaceView.js` composes the right-hand pane; `views/` and `dialogs/` are the callback-driven, state-read-only renderers; `bindings/` holds the delegated dataset-row listeners. Durable state remains under `state/`. |
| `src/features/panel/` | Panel feature package: `panelController.js` owns user intent, facade writes, bus subscriptions, and render coordination; `views/`, `layout/`, `slots/`, and `export/` own presentation mechanics. Durable state remains under `state/`; pure layout templates and the block model remain under `domain/panel/`. |
| `src/charts/` | Chart presentation metadata (`catalog.js` and `previews.js`), independent controls/workspace/panel lookup under `registries/`, D3/SVG per-chart packages (`charts/bar/`, `charts/pie/`, `charts/treemap/`, `charts/bubble/`, `charts/line/`, `charts/scatter/`, `charts/network/`, and `charts/tin/`), the Three.js/WebGL package (`charts/scatter3d/`), and shared chart-only infrastructure under `charts/shared/` (SVG scaffold, tooltip, control factories and grouping). A package keeps its data prep, options, renderers, controls, workspace section, presentation flow, and panel adapter together; leaf boundaries are enforced by lint. |
| `src/services/` | Side-effecting services, each crossing a browser boundary: `persistence.js` (the only public persistence import path) with the `persistence/` package behind it, `i18nService.js`, `settingsService.js` (owner of the `chive.settings` localStorage key), `presetService.js`, and `dataIngestService.js`. The pure dataset algorithms are not here; they live in `domain/datasets/`. |
| `src/services/persistence/` | Persistence internals, private to the package and reachable only through `services/persistence.js`: lifecycle and backend selection (`lifecycle.js`), snapshot normalization (`snapshot.js`), autosave, dirty tracking, errors, project file naming, and UI prefs. `backends/` holds the storage backends (`workerBackend.js` hosts the worker, `blobBackend.js` does the SQLite work, `legacyIndexedDbReader.js` reads the pre-SQLite format once); `sqlite/core.js` holds the schema and snapshot SQL. `workers/persistWorker.js` is the one permitted internals importer. |
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
| Initializer | One-time application initialization and global setup order | `app/applicationInitializer.js` |
| Coordinator | Ordered work spanning several render regions | `app/renderCoordinator.js` |
| Controller | Feature/domain flow ownership: DOM intent, facade writes, service calls, render coordination | `features/panel/panelController.js` |
| View | DOM building/rendering from inputs and callbacks | `features/datasetWorkspace/views/tablePreviewView.js` |
| Renderer | Chart/SVG/WebGL rendering from explicit inputs | `charts/bar/renderers/svg.js` |
| Service | Side effects: persistence, ingest, i18n, preset fetching | `services/persistence.js` |
| Facade | State or service boundary | `state/dataStateFacade.js` |
| Catalog | Identity-keyed descriptive or presentation metadata | `charts/catalog.js` |
| Registry | Supported-type implementation lookup for one integration surface | `charts/registries/workspace.js` |
| Adapter | Bridge between a generic system and a chart/domain implementation | `charts/bar/panelAdapter.js` |

Manager is legacy naming, still valid for `uiManager.js`, which keeps its name
until its domain is reworked for real. Controller is the name for new feature or
domain flow owners, and for a Manager whose responsibilities genuinely change:
`chartControlsManager.js` became `chartControlsController.js` when its write path
was inverted, not for looks. Do not rename a Manager for aesthetics alone; do not
use Controller for pure renderers, services, registries, or math helpers.

## Where Do I Put New Code?

| If you're adding... | Put it in | Notes |
|---|---|---|
| A new chart type | A per-chart package under `src/charts/{name}/` | Use `charts/bar/` as the SVG template or `charts/scatter3d/` as the Three.js/WebGL template, then follow the chart-type checklist below. |
| A new state field | The relevant domain in `src/state/appState.js` + a facade method that mutates and emits a new `STATE_EVENTS` constant | Add the constant to the domain group in `stateEvents.js`. |
| A new DOM event handler | The owning feature's `bindings/` directory, or `src/app/bindings/` when no single feature owns it (or an existing feature controller/manager) | Translate the event into a facade call. Never mutate state directly. Register a global `document`/`window` listener once behind a module-level guard so a repeated `setup*` call cannot stack duplicates. |
| A new dataset-workspace view / tab | `src/features/datasetWorkspace/views/` (or `dialogs/`) + a `renderXxx` function composed by `app/renderCoordinator.js` | Read state via getters; pass callbacks for user actions. |
| A new panel view or interaction | The matching `src/features/panel/` subdirectory | Keep flow ownership in `panelController.js`, durable state in its facade, and pure rules under `domain/panel/`. |
| A pure helper | `src/utils/` | No DOM access (single deliberate exception: `chartContainerLifecycle.js`). No state imports. |
| A pure domain rule | `src/domain/{owner}/` | Product rules owned by one feature domain (e.g. the panel layout templates, the dataset algorithms). Same leaf constraints as `utils/`, plus no chart imports. |
| A new dataset algorithm (parse, type, stats, join) | `src/domain/datasets/` | Pure and I/O-free, so it belongs in the domain leaf, not `services/`. Import it directly; there is no barrel. |
| A change to how projects are stored | `src/services/persistence/` | Reach the package only through `services/persistence.js`; lint enforces this. Do not change persisted shapes or snapshot identity as part of a structural move. |
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

- The dataset workspace replaces the "results" naming, and its controller,
  views, dialogs, and delegated bindings now live together under
  `features/datasetWorkspace/`. DOM element ids, CSS classes, and i18n keys
  keep the old naming until they are touched with real work.
- The panel and the dataset workspace are the complete feature packages under
  `src/features/`. The panel keeps its controller, views, layout interactions,
  slot lifecycle, and SVG export together under `features/panel/`; the dataset
  workspace keeps its controller, views, dialogs, and bindings together under
  `features/datasetWorkspace/`. State ownership and pure domain rules stay in
  their respective layers.
- The browser entrypoint is intentionally thin. Initialization order lives in
  `app/applicationInitializer.js`, render scheduler state stays together in
  `app/renderCoordinator.js`, and debug API assembly lives in `app/debugApi.js`.
- `services/` means "crosses a browser side-effect boundary", not "reusable
  logic". Persistence, ingest worker hosting, preset fetching, and i18n
  qualify. The dataset algorithms did not, so parsing, type detection, row
  processing, statistics, and joins live in `domain/datasets/`, where the
  domain leaf lint rule keeps them I/O-free and DOM-free.
- Persistence is one package with one public door. `services/persistence.js`
  is the only import path into it; lifecycle, snapshot, autosave, backends,
  and the SQLite core are private behind it, and a lint boundary enforces
  that. `workers/persistWorker.js` is the single exception, since hosting the
  blob backend off the main thread is the point of the worker.
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
