# CHIVE Architecture Reference

This is the implementation reference for the architecture described in
[Architecture overview](architecture.md). Use the overview first for the mental
model; use this file when you need exact state, facade, event, subscriber, or
panel lifecycle details.

For chart-level internals (each renderer's pipeline, its controls, and the math or algorithm
behind it), see the per-chart deep dives in [charts/](charts/README.md).

| Field | Value |
|---|---|
| Audience | Contributors changing state, facades, events, persistence, subscribers, or panel lifecycle code. |
| Source of truth | Exact state schema, facade exports, event registry, subscriber behavior, persistence flow, and panel snapshot lifecycle. |
| Update when | State fields, facade methods, `STATE_EVENTS`, persistence schema, production subscribers, or panel lifecycle behavior change. |

The code remains the source of truth. When a state field, facade method,
`STATE_EVENTS` constant, or production subscriber changes, update this
reference in the same PR.

## Detailed Rationale

CHIVE uses the Observer pattern over a single mutable state object held in
module scope, with all ordinary writes mediated by facade functions. The
closest classical analogue is a Backbone-style model plus events: one in-memory
object holds state, facades expose legal mutations, and an event bus broadcasts
changes to subscribers.

The pattern exists because CHIVE has a narrow browser-only runtime, D3 owns the
chart DOM imperatively, and the project deliberately keeps its dependency
surface small. The async surfaces that do exist, IndexedDB persistence (which
runs in a long-lived Web Worker) and the data-ingest Web Worker, plug in through
service/facade boundaries.

| Alternative | What It Would Buy | Why CHIVE Does Not Use It |
|---|---|---|
| No central state | Less structure for tiny features. | Dataset, chart, panel, and UI state are shared by too many modules; direct DOM/event threading becomes ad hoc. |
| Shared state with direct mutation | Fewer files. | Every caller would need to remember to emit after writing. Missed emits silently break reactivity. |
| Flux / Redux | Pure reducers, actions, time-travel tooling. | The action/reducer ceremony is heavy for this surface area, and immutable snapshots do not help much when D3 mutates chart DOM imperatively. |
| MobX / signals / proxies | Automatic dependency tracking. | Reactivity becomes implicit and harder to debug for a small research codebase. |
| React / Vue / Svelte | Component model and ecosystem. | Adds a framework/build dependency and creates friction with D3-owned DOM. |
| Raw `window.dispatchEvent` everywhere | No custom bus. | No static registry, no central store, and typo-prone subscriptions. |

## State Schema

The private state object is declared in
[`src/state/appState.js`](../../src/state/appState.js):

```js
const appState = {
	data: {
		datasets: [],
		activeIndex: -1,
	},
	panel: {
		charts: [],
		slots: {},
		layout: 'template-2col',
		blocks: [],
		nextBlockId: 1,
		nextChartId: 0,
	},
	ui: {
		sidebarMode: 'data',
		previewRows: 10,
	},
};
```

`data.datasets` holds `Dataset` records. `data.activeIndex` is `-1` when no
dataset is active.

`panel.charts` holds chart snapshots. `panel.blocks` is the current dashboard
block list. `panel.slots` is a legacy single-block slot map; per-block
`block.slots` is authoritative for current layouts. `panel.layout` mirrors the
first block template for compatibility.

`ui.sidebarMode` is one of `data`, `viz`, or `panel`. `ui.previewRows` is the
preview table row count and must be at least 1.

`getState()` returns a deep clone. The domain getters return live references and
must not be mutated by callers.

## App State Exports

### Read And Utility Exports

| Method | Domain | Mutates | Emits | Notes |
|---|---|---|---|---|
| `getState()` | all | No | No | Returns a deep clone of the full state. |
| `getPersistenceSnapshot()` | all | No | No | Returns a no-clone, live-reference view (`{ data, panel, ui }`) used by the save path. Keeps the deep clone off the auto-save hot path. Do not mutate. |
| `getActiveDataset()` | data | No | No | Returns a live dataset reference or `null`. Do not mutate. |
| `getActiveDatasetIndex()` | data | No | No | Returns the active dataset index, or `-1` when none. Primitive number. |
| `getAllDatasets()` | data | No | No | Returns the live datasets array. Do not mutate. |
| `getPreviewRows()` | ui | No | No | Returns the preview-table row count. Primitive number. |
| `getPanelCharts()` | panel | No | No | Returns the live chart snapshot array. Do not mutate. |
| `getChartSnapshot(chartId)` | panel | No | No | Returns a live snapshot reference or `null`. Do not mutate. |
| `getPanelBlocks()` | panel | May insert default block | No | Returns live blocks. Ensures a default block exists. Do not mutate. |
| `sanitizeChartName(name)` | utility | No | No | Coerces to string, trims, and caps display names at 100 chars. |
| `validatePanelSlots()` | panel | `panel.slots`, `block.slots` | No | Drops slot assignments pointing at missing chart snapshots. |

`onStateChange` and `STATE_EVENTS` are re-exported from
[`stateEvents.js`](../../src/state/stateEvents.js) through
`appState.js`.

### Live-Reference Read Policy

Live references are a deliberate choice where identity, rows, snapshots, or
large data make cloning expensive or semantically important (the save path's
reference-identity dedup depends on them). When a call site needs only a
primitive or small derived value, use or add a focused selector such as
`getActiveDatasetIndex()` or `getPreviewRows()` instead of pulling a whole
live object. Do not add broad clone-based "safe getters" for datasets, rows,
configs, panel charts, or snapshots without a proven need.

Bookkeeping when the read surface changes: any new object- or array-returning
read facade whose result must be treated read-only (this includes the
clone-returning `getState()`) gets a row in the table above and an entry in
both lint guard lists (`FACADE_MUTABLE_GETTERS` in `eslint.config.js` and
`TRACKED_GETTERS` in `eslint-rules/no-facade-getter-mutation.js`). A new
renderer-safe read also goes in `APP_STATE_READS`; reads meant for
persistence, debug, or internal use are not added there
(`getPersistenceSnapshot()` is the precedent). The `getPanelBlocks()`
insert-on-read side effect is a known issue tracked separately from this
policy.

### Data Facade Methods

| Method | Mutates | Emits | Notes |
|---|---|---|---|
| `setActiveDataset(index)` | `data.activeIndex` | `ACTIVE_DATASET` | Payload is the selected index. Throws when out of range. |
| `addDataset(dataset)` | `data.datasets`, maybe `data.activeIndex` | `DATASET_ADDED` | Stamps `dataset.id` when missing. Returns new index. |
| `removeDataset(index)` | `data.datasets`, `data.activeIndex`, `panel.charts`, `panel.slots` | `DATASET_REMOVED` | Clears panel snapshots and legacy slots because they may reference removed data. |
| `updateActiveDatasetConfig(updates)` | active `dataset.chartConfig` | `CONFIG_UPDATED` | Shallow-merges updates then canonicalizes; emits the raw patch. No-op when no active dataset exists. |
| `updateActiveDatasetColumns(columnNames)` | active `dataset.selectedColumns` | `COLUMNS_UPDATED` | Replaces the selected-column list. No-op when no active dataset exists. |
| `normalizeActiveDatasetConfig(normalizer)` | active `dataset.chartConfig` | No | Non-emitting escape hatch (live-preview writes). Do not add an emit here. |
| `setActiveChartType(chartType, activatedOverrides)` | active `dataset.chartConfig` | `CONFIG_UPDATED` | Radio-style chart activation. Emits `{ activeChartType }`. |

### Panel Facade Methods

| Method | Mutates | Emits | Notes |
|---|---|---|---|
| `addChartSnapshot(chartSnapshot)` | `panel.charts`, `panel.nextChartId` | `CHART_ADDED` | Sanitizes name, truncates `metaSummary`, stamps `createdAt`. |
| `removeChartSnapshot(chartId)` | `panel.charts`, `panel.slots`, `block.slots` | `CHART_REMOVED` | No-op when `chartId` cannot be normalized. |
| `clearPanel()` | `panel.charts`, `panel.slots`, `panel.blocks`, counters, `panel.layout` | `PANEL_CLEARED` | Resets to one fresh `template-2col` block. |
| `addPanelBlock(templateId)` | `panel.blocks`, `panel.nextBlockId` | `PANEL_BLOCK_ADDED` | Capped at 4 blocks; returns `null` at limit. |
| `removePanelBlock(blockId)` | `panel.blocks` | `PANEL_BLOCK_REMOVED` | Inserts a fresh default block if removal would empty the panel. |
| `movePanelBlock(blockId, targetIndex)` | `panel.blocks` order | `PANEL_BLOCK_MOVED` | Target is clamped. No-op when unchanged or invalid. |
| `updatePanelBlockProportions(blockId, partialProportions)` | `block.proportions` | `PANEL_BLOCK_PROPORTIONS_UPDATED` | Values are clamped to 20-80. |
| `updatePanelBlockHeight(blockId, heightPx)` | `block.heightPx` | `PANEL_BLOCK_HEIGHT_UPDATED` | Height is rounded and clamped to 220-760. |
| `updatePanelBlockBorder(blockId, options)` | `block.borderEnabled`, `block.borderColor` | `PANEL_BLOCK_BORDER_UPDATED` | Invalid colors are ignored. |
| `setPanelBlockTemplate(blockId, templateId)` | `block.templateId`, `block.proportions`, `block.slots`, maybe `panel.layout` | `PANEL_BLOCK_TEMPLATE_CHANGED` | Drops slots not present in the new template. |
| `assignChartToPanelBlockSlot(blockId, slotId, chartId)` | `block.slots` | `PANEL_BLOCK_SLOT_ASSIGNED` | `chartId === null` clears the slot; missing chart ids throw. |

### UI And Meta Methods

| Method | Domain | Mutates | Emits | Notes |
|---|---|---|---|---|
| `setSidebarMode(mode)` | ui | `ui.sidebarMode` | `SIDEBAR_MODE_CHANGED` | Valid modes: `data`, `viz`, `panel`. No-op when unchanged. |
| `setPreviewRows(rows)` | ui | `ui.previewRows` | `PREVIEW_ROWS_CHANGED` | Throws when `rows < 1`. |
| `replaceAllState({ data, panel, ui })` | all | full state slices | `STATE_HYDRATED` | Hydration escape hatch. Emits once after all slices are replaced. |

## Event Registry

Every typed event also reaches wildcard subscribers and dispatches a
`chive-state-changed` `CustomEvent` on `window`. The production wildcard
subscriber is `persistence.js`; it ignores `STATE_HYDRATED`.

| Event | Value | Emitted By | Payload | Typed Production Subscribers |
|---|---|---|---|---|
| `STATE_EVENTS.ACTIVE_DATASET` | `activeDataset` | `setActiveDataset` | selected index | `renderCoordinator.js` |
| `STATE_EVENTS.DATASET_ADDED` | `datasetAdded` | `addDataset` | `{ index, dataset }` | `renderCoordinator.js` |
| `STATE_EVENTS.DATASET_REMOVED` | `datasetRemoved` | `removeDataset` | removed index | `renderCoordinator.js` |
| `STATE_EVENTS.CONFIG_UPDATED` | `configUpdated` | `updateActiveDatasetConfig`, `setActiveChartType` | updates object or `{ activeChartType }` | `renderCoordinator.js` |
| `STATE_EVENTS.COLUMNS_UPDATED` | `columnsUpdated` | `updateActiveDatasetColumns` | column-name array | `renderCoordinator.js` |
| `STATE_EVENTS.CHART_ADDED` | `chartAdded` | `addChartSnapshot` | `{ id, snapshot }` | `panelController.js` |
| `STATE_EVENTS.CHART_REMOVED` | `chartRemoved` | `removeChartSnapshot` | normalized chart id | `panelController.js` |
| `STATE_EVENTS.PANEL_CLEARED` | `panelCleared` | `clearPanel` | none | `panelController.js` |
| `STATE_EVENTS.PANEL_BLOCK_ADDED` | `panelBlockAdded` | `addPanelBlock` | new block | `panelController.js` |
| `STATE_EVENTS.PANEL_BLOCK_REMOVED` | `panelBlockRemoved` | `removePanelBlock` | block id | `panelController.js` |
| `STATE_EVENTS.PANEL_BLOCK_MOVED` | `panelBlockMoved` | `movePanelBlock` | `{ blockId, targetIndex }` | `panelController.js` |
| `STATE_EVENTS.PANEL_BLOCK_PROPORTIONS_UPDATED` | `panelBlockProportionsUpdated` | `updatePanelBlockProportions` | `{ blockId, proportions }` | `panelController.js` |
| `STATE_EVENTS.PANEL_BLOCK_HEIGHT_UPDATED` | `panelBlockHeightUpdated` | `updatePanelBlockHeight` | `{ blockId, heightPx }` | `panelController.js` |
| `STATE_EVENTS.PANEL_BLOCK_BORDER_UPDATED` | `panelBlockBorderUpdated` | `updatePanelBlockBorder` | `{ blockId, enabled, color }` | `panelController.js` |
| `STATE_EVENTS.PANEL_BLOCK_TEMPLATE_CHANGED` | `panelBlockTemplateChanged` | `setPanelBlockTemplate` | `{ blockId, templateId }` | `panelController.js` |
| `STATE_EVENTS.PANEL_BLOCK_SLOT_ASSIGNED` | `panelBlockSlotAssigned` | `assignChartToPanelBlockSlot` | `{ blockId, slotId, chartId }` | `panelController.js` |
| `STATE_EVENTS.SIDEBAR_MODE_CHANGED` | `sidebarModeChanged` | `setSidebarMode` | sidebar mode | none |
| `STATE_EVENTS.PREVIEW_ROWS_CHANGED` | `previewRowsChanged` | `setPreviewRows` | row count | `renderCoordinator.js` |
| `STATE_EVENTS.STATE_HYDRATED` | `stateHydrated` | `replaceAllState` | none | `renderCoordinator.js` |
| `STATE_EVENTS.WILDCARD` | `*` | not emitted directly | wildcard callbacks receive `{ type, data }` after typed emits | `persistence.js` |

## Subscriber Map

[`src/app/renderCoordinator.js`](../../src/app/renderCoordinator.js) schedules a
full `refreshView()` through `scheduleFullRefresh` for `ACTIVE_DATASET`,
`DATASET_ADDED`, `DATASET_REMOVED`, and
`STATE_HYDRATED` (an animation-frame-coalesced wrapper, so a synchronous burst such as
add-then-select paints once). The narrowed events repaint only their regions
through `scheduleRegion`: `COLUMNS_UPDATED` the workspace and chart-controls
regions; `CONFIG_UPDATED` the same, plus the panel region when the payload switches
to the panel tab; `PREVIEW_ROWS_CHANGED` the workspace region. Boot and the
`chiveDebug` handle render synchronously through `runFullRefreshNow`; nothing calls
`refreshView()` bare.

[`src/features/panel/panelController.js`](../../src/features/panel/panelController.js) subscribes to:

- `CHART_ADDED`
- `CHART_REMOVED`
- `PANEL_CLEARED`
- `PANEL_BLOCK_SLOT_ASSIGNED`
- `PANEL_BLOCK_ADDED`
- `PANEL_BLOCK_REMOVED`
- `PANEL_BLOCK_MOVED`
- `PANEL_BLOCK_TEMPLATE_CHANGED`
- `PANEL_BLOCK_PROPORTIONS_UPDATED`
- `PANEL_BLOCK_HEIGHT_UPDATED`
- `PANEL_BLOCK_BORDER_UPDATED`

Chart add/remove/slot events re-render the panel sidebar and canvas. Layout
events re-render the canvas and refresh the layout selector. `PANEL_CLEARED`
re-renders the sidebar, canvas, and layout selector (clear also resets
blocks/layout). The panel handlers render synchronously (they are not routed
through the render coordinator's coalescer).

[`src/services/persistence.js`](../../src/services/persistence.js)
subscribes to `WILDCARD` after hydration and tracks semantic project dirtiness
to schedule the debounced auto-save. It ignores `STATE_HYDRATED` and UI
preference events (`SIDEBAR_MODE_CHANGED`, `PREVIEW_ROWS_CHANGED`). UI
preferences are written immediately to `localStorage`; dataset configuration,
including `activeTab`, is project content written by the debounced `saveNow()`
or the best-effort page-lifecycle close net.

Dataset add/remove/select render through the bus (the data facade emits
`DATASET_ADDED`/`DATASET_REMOVED`/`ACTIVE_DATASET`, which the render coordinator
subscribes to). Boot and manual `chiveDebug` calls do a synchronous full render
through `runFullRefreshNow`; everything else is scheduled (locale and the full-refresh bus
events through `scheduleFullRefresh`, preview-row changes through a workspace region
flush). `refreshView()` is never called bare. Live-preview rendering while controls
are adjusted stays its own narrow path (charts only).

## Persistence

Project persistence is implemented in
[`src/services/persistence/`](../../src/services/persistence/)
behind the stable public facade
[`src/services/persistence.js`](../../src/services/persistence.js), which is
the only supported import path into the package. Storage backends live in
[`src/services/persistence/backends/`](../../src/services/persistence/backends/)
and the SQLite schema and snapshot SQL in
[`src/services/persistence/sqlite/core.js`](../../src/services/persistence/sqlite/core.js).

All SQLite work runs **off the main thread** in a long-lived Web Worker. The
default backend is `workerBackend`
([`src/services/persistence/backends/workerBackend.js`](../../src/services/persistence/backends/workerBackend.js)),
which delegates `hydrate`/`persist`/`clear` to
[`src/workers/persistWorker.js`](../../src/workers/persistWorker.js); the worker
constructs a `createBlobBackend()` so fingerprinting, schema, the whole-DB
export, and the IndexedDB write never block the UI thread. `workerBackend` does
not statically import sqlite, so SQLite-WASM stays out of the main bundle (it is
loaded in the worker chunk, or via a dynamic-import fallback). If a worker is
unavailable (spawn/parse/CSP failure, a crash, or a watchdog timeout), the
backend transparently completes the operation on a main-thread `blobBackend`
fallback so the latest edit is never silently lost.

The runtime path is:

1. Boot calls `hydrateState()`.
2. `workerBackend.hydrate()` runs `blobBackend.hydrate()` in the worker, which
   reads IndexedDB database `chive-sqlite`, store `db`, key `project`.
3. The stored value is a single SQLite database byte image (`Uint8Array`),
   deserialized into sqlite-wasm in memory.
4. `sqlite/core.js`'s `readSnapshot()` reads project tables and reattaches chart
   snapshot payloads.
5. `persistence.js` validates datasets, applies the optional panel
   transform, reads `chive.ui`, and calls `replaceAllState()`.

Saves are automatic. `enablePersistenceAutoSave(getPersistenceSnapshot)`
subscribes to the state bus, marks the project dirty on content events, and
schedules a debounced `saveNow()` (default ~2s quiet window) so a burst of edits
collapses into one whole-DB write. The save path reads
`getPersistenceSnapshot()` (live references, no clone) rather than `getState()`,
so a metadata-only save no longer deep-clones every dataset row on the main
thread. The worker additionally caches row and chart-snapshot payloads by id:
the host omits a payload from the `postMessage` when its array reference is
unchanged since the last save (sound because dataset `rows` and chart
`dataSnapshot`/`columnsSnapshot` are immutable per id), and the worker refills it
from cache. A capped cache-miss resync self-heals any host/worker drift.
`saveNow()` coalesces concurrent calls by returning the same in-flight promise.
On success it clears dirty only if no newer revision was emitted during the save;
if a mid-save edit occurred, it starts one follow-up save after the first promise
settles. Failures keep dirty set and surface through the injected error callback
(an error toast); there is no native unsaved-changes prompt.

The lifecycle close net is explicitly best-effort. `visibilitychange` to hidden
is the primary trigger while the page is still alive; `pagehide` and the Page
Lifecycle `freeze` event, where supported, are backstops. Browser unload cannot
guarantee a synchronous multi-MB SQLite byte-image write to IndexedDB, especially
through the worker route, so interrupted closes can still lose changes made
since the last successful save.

Project transfer uses the same backend seam. `exportProject()` sends a
live-reference snapshot to `workerBackend.exportBytes()`, which serializes a
SQLite byte image in the worker and returns it to the UI for download. Full
exports include `dataset_payload` and `panel_snapshot_payload`; work-only
exports write a normal image first, then clear those payload tables and `VACUUM`
before the byte export so metadata, panel layout, and deterministic dataset
fingerprints remain intact. `importProjectBytes()` accepts full project bytes,
validates the `meta` marker before normalizing app state, persists the imported
project as the new local SQLite project, then calls `replaceAllState()`.
Work-only imports are intentionally rejected in v1 because dataset re-linking
semantics are not implemented yet.

The SQLite schema version is `1`:

| Table | Purpose |
|---|---|
| `meta` | `format = chive-project`, `schema_version = 1`. |
| `datasets` | Dataset metadata/config, selected columns, stats, display size, deterministic fingerprint, and `position` for dataset list order. |
| `app_state` | JSON docs for `data_state` (`activeDatasetId`) and `panel` without row payloads. |
| `dataset_payload` | Dataset rows JSON, one row per dataset id. |
| `panel_snapshot_payload` | Saved chart snapshot rows/columns keyed by chart id. |

The split powers full vs. work-only project exports: work-only files preserve
metadata and layout without row payload table contents. Local persistence always
writes payloads; missing dataset payloads during normal hydrate/import are
treated as malformed data and collapse to validation-safe empty/dropped records,
except that project import detects `rows: null` and rejects the file as a
work-only import.

Existing users with the old raw IndexedDB database `chive-state` are imported
once by `legacyIndexedDbReader.js` when no SQLite project exists and
`localStorage.chive.migrated` is absent. `clearPersistedState()` deletes the new
SQLite DB, best-effort deletes `chive-state`, removes `chive.ui`, and sets the
migration tombstone without touching `chive-locale` or `chive.settings` (the
browser-local settings key owned by `settingsService.js`).

## Mutation Rules

- Application state writes go through facade methods exported from
  `appState.js`.
- Do not mutate values returned from live-reference getters.
- Production code uses `STATE_EVENTS.*` constants, not string literals.
- Do not synchronously emit a state event from inside a state subscriber.
- `STATE_EVENTS.WILDCARD` is reserved for sink-style state-bus consumers.
- Chart config is canonicalized at the state boundaries via `canonicalizeChartConfig`
  (`domain/charts/chartConfig.js`): default-filled, legacy-migrated, and trimmed of
  global-filter rules whose column is gone. It runs at persistence restore
  (`normalizeStoredSnapshot`, so both the persisted bytes and hydrated memory are
  canonical), `addDataset`, and the emitting config writes (`updateActiveDatasetConfig`,
  `setActiveChartType`), plus defensively in `replaceAllState`. "Canonical" here means
  object/default shape, legacy migration, and stale-filter cleanup, not scalar/enum value
  validation, and it does not strip unknown top-level keys.
- `normalizeActiveDatasetConfig` is the non-emitting escape hatch: it writes without
  emitting to avoid `CONFIG_UPDATED` re-entry. It backs the intentional live-preview
  writes (color/height); with boundary canonicalization in place, nothing else
  should need it.
- `getPanelBlocks` and `validatePanelSlots` may repair panel state without
  emitting; callers use them for internal consistency cleanup, not user-visible
  mutations.
- `replaceAllState` is the hydration exception: it rewrites slices directly and
  emits one `STATE_HYDRATED`.

## Panel Lifecycle

Panel charts are stored as snapshot specs, not as pre-rendered SVG or canvas
output. A snapshot contains `{ id, name, type, config, dataSnapshot,
columnsSnapshot, metadata, metaSummary, createdAt }`.

The lifecycle is:

1. `panelController.addChartToPanel` reads the active dataset, applies the global
   filter, captures data/config/metadata, and calls `addChartSnapshot`.
2. The panel facade stores the snapshot in `panel.charts` and emits
   `CHART_ADDED`.
3. `panelController` re-renders the sidebar/canvas.
4. `views/panelView.js` mounts each assigned slot.
5. `slots/lifecycle.js`'s `mountSlot` tears down any old mount, calls
   `renderChartFromSpec`, and attaches a `ResizeObserver` for responsive
   re-rendering.
6. Its `teardownSlot` disconnects the observer, cancels a pending
   animation frame, stops any network-graph force simulation, hides the shared
   tooltip, and clears the container through `clearChartContainer`, including
   canvas/WebGL dispose hooks.
7. `export/svgExporter.js` clones live SVG nodes from the rendered DOM when exporting.
   Canvas/WebGL charts are omitted from the SVG export and counted; a chart
   panel with no exportable SVG charts returns `no-exportable-charts`.

`renderChartFromSpec` resolves implementations through the panel-only registry
in `src/charts/registries/panel.js`. Its `SUPPORTED_PANEL_CHART_TYPES` export is
in canonical order: `bar`, `line`, `scatter`, `scatter3d`, `pie`, `bubble`,
`network`, `treemap`, and `tin`. Renderers mount either SVG or canvas output
depending on the chart type.

## Adding A State Feature

1. Add the state field to the correct domain in `appState.js`.
2. Update the matching typedef in `src/types.js`.
3. Add a facade method for every legal write.
4. Add a `STATE_EVENTS` constant if downstream code needs to react.
5. Emit the event from the facade method with an explicit payload.
6. Subscribe from the module that owns the resulting render/side effect.
7. Update this reference: state schema, facade table, event table, and
   subscriber map.
8. Add or update tests when the behavior is not already covered.

## Adding A Panel Feature

1. Decide whether the feature is snapshot data, block layout state, or pure
   rendering behavior.
2. Store persistent panel data in `panel.charts`, `panel.blocks`, or a field
   owned by one of those shapes.
3. Route writes through `panelStateFacade.js`.
4. Emit a panel event only when a subscriber must react.
5. Keep renderer callbacks injected from `panelController`; renderers should not
   import write facades directly.
6. If adding a chart type to panel rendering, add its adapter to
   `src/charts/registries/panel.js`; `SUPPORTED_PANEL_CHART_TYPES` is derived
   from that registry in canonical chart order. If the type changes export
   behavior, update `src/features/panel/export/svgExporter.js` and the relevant tests.
7. Update this reference and any relevant tests.

## Debugging State Events

The browser console debug surface lives at `window.chiveDebug`.

- `window.chiveDebug.enableStateLog()` enables logging.
- `window.chiveDebug.disableStateLog()` disables logging.
- `window.chiveDebug.getStateLog()` returns the last 100 entries.
- `window.chiveDebug.clearStateLog()` clears the buffer.

When enabled, each emission is logged as `[chive:state] <type> <data>`.
