/**
 * CHIVE centralized JSDoc typedef catalog.
 *
 * No runtime exports. A consumer imports a shape with a typedef whose path
 * runs from the consumer's own folder to this file, such as
 * `@typedef {import('<relative path>/types.js').Dataset} Dataset`.
 * Keep that example in backticks: a comment line that starts with
 * `@typedef` declares a real typedef, which here would duplicate `Dataset`.
 *
 * Typedefs are not values, so barrel files do not propagate them. Always
 * import directly from this file.
 *
 * @see CONTRIBUTING.md  "Documentation Conventions" section
 * @see docs/development/architecture.md
 */

// ─── Primitives & unions ────────────────────────────────────────────────

/**
 * Canonical chart-type identifiers used throughout state and config.
 *
 * @typedef {'bar' | 'line' | 'scatter' | 'scatter3d' | 'pie' | 'bubble' | 'network' | 'treemap' | 'tin'} ChartTypeKey
 */

/**
 * Detected column data type.
 *
 * @typedef {'number' | 'text' | 'date'} ColumnType
 */

/**
 * Panel layout template identifier. Each template owns its own slot set
 * (see {@link PanelBlockProportions} for the per-template proportions shape).
 *
 * @typedef {'template-single' | 'template-2col' | 'template-hero2' | 'template-3col' | 'template-1x2'} PanelTemplateId
 */

/**
 * Sidebar mode currently active in the UI.
 *
 * @typedef {'data' | 'viz' | 'panel'} SidebarMode
 */

// ─── Data domain ────────────────────────────────────────────────────────

/**
 * Column metadata as detected by the ingest worker.
 *
 * @typedef {Object} ColumnSpec
 * @property {string} name - Column name as it appears in the source file.
 * @property {ColumnType} type - Detected type. Falls back to `'text'` when no rule matches.
 * @property {'.' | ','} [decimalSeparator] - Source string number format, retained even for text columns so later joins cannot reinterpret their scale. Absent on older saved datasets.
 */

/**
 * Precomputed statistics, cached on the dataset to avoid recomputing on every
 * DATASET_ADDED event. Produced at ingest for uploads, presets, and joins, with
 * both versions stamped.
 *
 * `numeric` is dropped at hydrate when `numericVersion` does not match
 * `STATS_NUMERIC_VERSION`, and `categorical` when `categoricalVersion` does not
 * match `STATS_CATEGORICAL_VERSION`, so a restored dataset can legitimately
 * carry either one alone, or neither.
 *
 * @typedef {Object} PrecomputedStats
 * @property {NumericColumnStats[]} [numeric] - Per-column numeric stats, in column order. Absent when a stale cache was invalidated at hydrate.
 * @property {CategoricalColumnStats[]} [categorical] - Per-column categorical stats, in column order. Absent when a stale cache was invalidated at hydrate.
 * @property {number} [numericVersion] - Generation of `numeric`. Absent on records written before versioning.
 * @property {number} [categoricalVersion] - Generation of `categorical`. Absent on records written before versioning.
 */

/**
 * A loaded dataset. Persists across reloads via IndexedDB and is keyed by `id`.
 *
 * @typedef {Object} Dataset
 * @property {string} id - Stable UUID (or `dataset-<ts>-<n>` fallback when `crypto.randomUUID` is unavailable). Stamped by `addDataset` if missing.
 * @property {string} name - Display name. Original filename for uploads, derived label for joins.
 * @property {string} sizeLabel - Pre-formatted size label (not raw bytes).
 * @property {Array<Object<string, *>>} rows - Parsed rows. Each row's keys match `columns[i].name`.
 * @property {ColumnSpec[]} columns - Detected columns in source order.
 * @property {string[]} selectedColumns - Names of currently visible columns (subset of `columns[].name`).
 * @property {ChartConfig} chartConfig - Per-chart-type configuration.
 * @property {PrecomputedStats} [precomputedStats] - Worker-computed stats, optional.
 */

/**
 * What a dataset shows right now, from `deriveShownDataset` in
 * `domain/datasets/shownDataset.js`. The render coordinator derives it once per
 * render pass and hands the same value to the table, the statistics, the
 * charts, live preview and the chart controls; Add to panel derives it once per
 * capture.
 *
 * @typedef {Object} ShownDataset
 * @property {Dataset} dataset - The dataset itself, a live state reference to treat as read-only. Its `chartConfig` is the stored, canonical config.
 * @property {Array<Object<string, *>>} rows - The rows that pass the global filter; the dataset's own `rows` array when no rule applies.
 * @property {GlobalFilter} filter - The global filter rules that apply. A rule whose column the dataset no longer has is dropped.
 * @property {ColumnSpec[]} visibleColumns - The columns the column list shows, in source order.
 * @property {Object<string, ColumnType>} columnTypeByName - Every column's type, hidden columns included.
 * @property {ChartTypeKey | null} activeChartType - The chart drawn: the first enabled chart in canonical order, or `null`.
 */

// ─── Chart-config domain ────────────────────────────────────────────────

/**
 * One rule inside a {@link GlobalFilter}.
 *
 * @typedef {Object} GlobalFilterRule
 * @property {string} column - Column name the rule applies to.
 * @property {'categorical' | 'numeric'} mode - Filter mode.
 * @property {string[]} [include] - Categorical: tokens to keep.
 * @property {number} [min] - Numeric: inclusive lower bound.
 * @property {number} [max] - Numeric: inclusive upper bound.
 * @property {string} [operator] - Optional numeric operator (legacy single-filter compatibility).
 */

/**
 * Dataset-wide filter applied before any per-chart filtering.
 * Combine is currently always `'AND'`; the field is preserved for future OR support.
 *
 * @typedef {Object} GlobalFilter
 * @property {GlobalFilterRule[]} rules
 * @property {'AND'} combine
 */

/**
 * Universal fields present on every per-chart config block. Each chart type
 * extends this with type-specific fields (axis bindings, color scales, …).
 * Those extras are intentionally not enumerated here to keep this typedef
 * stable. See `src/config/charts/definitions/<type>.js` for each full
 * per-chart shape.
 *
 * @typedef {Object} ChartTypeConfig
 * @property {boolean} enabled - Whether this chart type is the active one for the dataset.
 * @property {boolean} expanded - Sidebar config panel expansion state.
 * @property {string} customTitle - User-overridden title; empty string means use the default.
 * @property {number} chartHeight - Render height in pixels.
 * @property {string} [color] - Primary color (hex). Optional, not every chart uses a single color.
 * @property {string} [colorMode] - Color application mode (chart-specific values).
 */

/**
 * Per-dataset chart configuration. One block per supported chart type plus
 * the active-tab marker and global filter. The per-chart entries are
 * superset-typed as `ChartTypeConfig`. See
 * `src/config/charts/definitions/<type>.js` for each chart type's full field
 * set.
 *
 * @typedef {Object} ChartConfig
 * @property {string} activeTab - Active tab id (e.g. `'preview'`, `'charts'`, `'panel'`).
 * @property {GlobalFilter} globalFilter
 * @property {ChartTypeConfig} bar
 * @property {ChartTypeConfig} scatter
 * @property {ChartTypeConfig} scatter3d
 * @property {ChartTypeConfig} pie
 * @property {ChartTypeConfig} bubble
 * @property {ChartTypeConfig} network
 * @property {ChartTypeConfig} treemap
 * @property {ChartTypeConfig} line
 * @property {ChartTypeConfig} tin
 */

/**
 * Column-name buckets and drawn rows a chart's controls are built from: the
 * functions of its {@link ControlDescription}s and its `computeDefaults`.
 * Derived once per sidebar render from the {@link ShownDataset} by
 * `columnContextOf()` in
 * `features/datasetWorkspace/chartControls/chartControlsController.js`;
 * implementation lookup lives in `charts/registries/controls.js`.
 *
 * `baseCategoricalOrAll` is the fallback list when no categorical columns
 * exist (the chart-picker still needs to offer *something*).
 *
 * @typedef {Object} ChartControlContext
 * @property {string[]} numeric - Numeric (`'number'`) column names.
 * @property {string[]} categorical - Categorical (non-numeric) column names.
 * @property {string[]} dates - Date (`'date'`) column names.
 * @property {string[]} allColumns - All currently visible column names.
 * @property {string[]} baseCategoricalOrAll - `categorical` when non-empty, else `allColumns`.
 * @property {Array<Object<string, *>>} rows - The rows the chart draws: the dataset's rows under its global filter. The pie color grid reads them.
 */

/**
 * The write surface a chart's controls use to change their own config block.
 * Built per chart type by `createChartConfigWriter` in
 * `features/datasetWorkspace/chartControls/chartConfigAdapter.js` and handed to
 * the controls by the controls sidebar, so chart packages never import state
 * themselves.
 *
 * The two methods are not interchangeable:
 *
 *   - `commit` writes through the emitting facade, so the chart config is
 *     canonicalized (an enumerated value the chart does not offer becomes its
 *     default), `CONFIG_UPDATED` fires, auto-save marks the project dirty, and
 *     the controls sidebar refreshes.
 *   - `preview` writes through the non-emitting facade and repaints only the
 *     chart. Use it for continuous input (a color picker's `input` event):
 *     emitting there would rebuild the sidebar mid-drag and steal focus from
 *     the picker.
 *
 * @typedef {Object} ChartConfigWriter
 * @property {(patch: Object) => void} commit - Merge a patch and emit. Does not live-render.
 * @property {(patch: Object | ((currentConfig: Object) => Object)) => void} preview - Merge a patch without emitting, then live-render. Accepts a function of the current config for nested updates.
 */

/**
 * A chart's sidebar controls, declared as data. `buildDescribedControls` in
 * `charts/shared/controls/describedControls.js` builds them and wires each one
 * to the {@link ChartConfigWriter}; the controls registry hands them to the
 * controls sidebar.
 *
 * @typedef {Object} ChartControlDescriptions
 * @property {{ key: ChartTypeKey, allowedValues: Object<string, ReadonlyArray<*> | Object> }} definition - The chart's definition (`config/charts/definitions/<type>.js`). Its key names the config block the controls write, and its `allowedValues` are the options of every enumerated select.
 * @property {ReadonlyArray<ControlSection>} sections - In sidebar order.
 */

/**
 * A collapsible group of controls in the chart sidebar.
 *
 * @typedef {Object} ControlSection
 * @property {string} id - Unique within the chart; a section keeps its expansion across sidebar rebuilds by it.
 * @property {string} [titleKey] - Message key of the title.
 * @property {string} [title] - Literal title, for a section whose title has no message key yet.
 * @property {boolean} [expanded=true] - Initial expansion.
 * @property {string} [icon] - Header icon; see `createSvgIcon`.
 * @property {ControlDescription[]} controls - In section order.
 */

/**
 * One chart control: the setting it shows and writes, its widget, its options,
 * and when it is shown or disabled. Every control is also disabled while its
 * chart is off. The widget decides how the control writes: a color input
 * previews through {@link ChartConfigWriter} `preview` while the picker is open
 * and commits on `change`; every other widget commits on `change`. A `custom`
 * control is written by hand: its `build` creates and wires its elements.
 *
 * @typedef {Object} ControlDescription
 * @property {'select' | 'slider' | 'number' | 'checkbox' | 'text' | 'color' | 'palette' | 'custom'} widget
 * @property {string} [id] - DOM id. Keep it stable: the sidebar restores focus and scroll by it. A custom control names the element it builds, if it builds one.
 * @property {string} [key] - The setting the control shows and writes. `block.setting` names a setting inside a block, such as `regression.mode`: the control shows it and writes the block with it changed. A palette writes `colorScheme`; a custom control names the setting it writes, if it writes one.
 * @property {string} [label] - Message key of the label. A custom control translates its own.
 * @property {(config: Object, context: ChartControlContext) => boolean} [shownWhen] - When the control is built at all; the others are always built.
 * @property {(config: Object, context: ChartControlContext) => boolean} [disabledWhen] - When the control is disabled although its chart is on.
 * @property {(config: Object) => *} [value] - The value shown, when it is not the setting itself. A slider and a number input show it as a number.
 * @property {(value: *, current: { config: Object, context: ChartControlContext }) => *} [toValue] - The value to store for the widget's value. `current.config` is the config when the event fires.
 * @property {(value: *, current: { config: Object, context: ChartControlContext }) => Object} [toPatch] - The patch to write, for a control that writes more than its own setting. Receives the value `toValue` returned.
 * @property {(context: ChartControlContext, config: Object) => string[]} [columns] - Select: offer "None" and these columns. `config` is the config the control is built from.
 * @property {(context: ChartControlContext, translate: (key: string, ...params: *[]) => string) => Array<{ value: *, label: string }>} [options] - Select: a fixed option list, for a setting the chart definition does not enumerate.
 * @property {Object<string, string> | ((value: *) => string)} [optionLabels] - Select of an enumerated setting: the message key of each value the chart definition lists.
 * @property {(value: *, config: Object, translate: (key: string, ...params: *[]) => string) => *[]} [optionLabelParams] - Select of an enumerated setting: the parameters (`$1`, `$2`…) of a value's label, for a label that names another setting.
 * @property {(value: *, translate: (key: string, ...params: *[]) => string) => string} [optionText] - Select of an enumerated setting: the label of each value as text, in place of `optionLabels`, for labels that are not all messages (a ramp's own name).
 * @property {number} [min] - Slider; number input, optional.
 * @property {number} [max] - Slider; number input, optional.
 * @property {number | 'any'} [step] - Slider; number input, optional, where `'any'` allows any decimal.
 * @property {number} [maxLength=80] - Text.
 * @property {string | number} [fallback] - Color: shown and written in place of an invalid color. Number input: shown while the setting is not a finite number, and written in place of a typed value that is not one.
 * @property {Object<string, number>} [colorKeys] - Palette: config key to the palette position a palette button copies into it; negative positions count from the end.
 * @property {Object<string, string>} [fallbacks] - Palette: per copied key, written in place of an invalid palette color.
 * @property {(config: Object) => (string | null)} [marked] - Palette: the preset whose button is marked, the one the chart is drawn with. Defaults to the preset whose colors `colorKeys` still hold.
 * @property {(scope: CustomControlScope) => (HTMLElement | HTMLElement[])} [build] - Custom: build the control's elements, none to show nothing, each already wired.
 */

/**
 * What a custom control's `build` receives: what a chart's builder and its
 * listeners received, plus its disabled state and the controls built before
 * it in the same pass.
 *
 * @typedef {Object} CustomControlScope
 * @property {Dataset} dataset
 * @property {Object} config - The chart's config block when the control is built.
 * @property {() => Object} readConfig - The chart's config block now; listeners read it when their event fires.
 * @property {ChartControlContext} context
 * @property {ChartConfigWriter} writer
 * @property {(key: string, ...params: *[]) => string} translate
 * @property {boolean} disabled - The chart is off, or the description's `disabledWhen` holds.
 * @property {(id: string) => HTMLElement} control - The element of the widget control with that id, built earlier in this pass. Throws when there is none.
 */

// ─── Panel domain ───────────────────────────────────────────────────────

/**
 * Block proportion shape. Union: the layout template determines which fields are present.
 *
 * - `template-single`:  `{ split: 100 }`
 * - `template-2col`:    `{ split: number }` (20 to 80)
 * - `template-1x2`:     `{ split: number }` (20 to 80)
 * - `template-hero2`:   `{ splitMain: number, splitRight: number }`
 * - `template-3col`:    `{ a: number, b: number, c: number }`
 *
 * @typedef {Object} PanelBlockProportions
 * @property {number} [split]
 * @property {number} [splitMain]
 * @property {number} [splitRight]
 * @property {number} [a]
 * @property {number} [b]
 * @property {number} [c]
 */

/**
 * One block in the dashboard panel. Blocks compose vertically; each block
 * holds one layout template plus a slot map pointing at chart snapshots.
 *
 * @typedef {Object} PanelBlock
 * @property {string} id - Pattern `block-<n>`. Monotonic; reused across reloads via `panel.nextBlockId`.
 * @property {PanelTemplateId} templateId
 * @property {Object<string, number>} slots - Map of `slotId` (e.g. `'slot-1'`) → `ChartSnapshot.id`.
 * @property {PanelBlockProportions} proportions
 * @property {number | null} heightPx - Pixel height; `null` means auto (template default).
 * @property {boolean} borderEnabled
 * @property {string} borderColor - Hex color (e.g. `'#5d645d'`).
 */

/**
 * Partial border-options bag accepted by `updatePanelBlockBorder`. Either
 * or both fields may be present; missing fields leave the block's existing
 * value untouched. The facade rejects invalid fields before mutating state.
 *
 * @typedef {Object} PanelBlockBorderOptions
 * @property {boolean} [enabled] - When set, replaces `block.borderEnabled`.
 * @property {string} [color] - Hex color (e.g. `'#5d645d'`). Validated via {@link isValidHexColor}.
 */

/**
 * Captured chart state stored when a chart is added to the panel. The
 * production controller structured-clones config, rows, and columns before
 * calling the state facade, so those fields remain detached from later dataset
 * edits and survive source-dataset removal. The snapshot is not deep-frozen;
 * facade getters expose live references that callers must treat as read-only.
 *
 * @typedef {Object} ChartSnapshot
 * @property {number} id - Monotonic; assigned by `addChartSnapshot`.
 * @property {string} name - Sanitized title, max 100 chars.
 * @property {ChartTypeKey | null} type
 * @property {Object | null} config - Production capture: structured clone of `chartConfig[type]`.
 * @property {Array<Object<string, *>>} dataSnapshot - Production capture: structured clone of the rows used.
 * @property {ColumnSpec[]} columnsSnapshot - Production capture: structured clone of the dataset columns.
 * @property {Object | null} metadata - Chart-specific render metadata stored as supplied (axis ranges, scales, …).
 * @property {string} metaSummary - Plain-text summary; max 180 chars.
 * @property {string} createdAt - ISO 8601 timestamp.
 */

/**
 * What a chart's presentation flow draws from, on either surface. The
 * workspace registry passes it from Visualizations and the panel registry
 * builds it from a {@link ChartSnapshot}.
 *
 * @typedef {Object} ChartInput
 * @property {Array<Object<string, *>>} rows - The rows to draw: under the global filter in Visualizations, the captured rows in Panel.
 * @property {Object} config - The chart's config block, `chartConfig[type]`.
 * @property {Object<string, ColumnType>} [columnTypeByName] - Column name to type; line and scatter read it for their axes.
 * @property {Object} [filterCallbacks] - Global filter actions for pinned tooltips, with their labels. Visualizations only, so Panel tooltips cannot change the live dataset.
 */

// ─── UI domain ──────────────────────────────────────────────────────────

/**
 * @typedef {Object} AppStateData
 * @property {Dataset[]} datasets
 * @property {number} activeIndex - `-1` when no dataset is active; otherwise a valid index into `datasets`.
 */

/**
 * @typedef {Object} AppStatePanel
 * @property {ChartSnapshot[]} charts
 * @property {Object<string, number>} slots - Legacy single-block slot map. `PanelBlock.slots` is the authoritative per-block version.
 * @property {PanelTemplateId} layout - Mirrors `blocks[0].templateId`. Single source of truth lives on the block.
 * @property {PanelBlock[]} blocks
 * @property {number} nextBlockId - Monotonic counter for `block-<n>` ids.
 * @property {number} nextChartId - Monotonic counter for snapshot ids.
 */

/**
 * @typedef {Object} AppStateUi
 * @property {SidebarMode} sidebarMode
 * @property {number} previewRows - Integer from 1 through 1000.
 */

/**
 * Top-level application state. Held privately inside `appState.js`; never
 * exported as a reference. Use {@link getState} for a deep clone or the
 * domain-specific getters for live (read-only) references.
 *
 * @typedef {Object} AppState
 * @property {AppStateData} data
 * @property {AppStatePanel} panel
 * @property {AppStateUi} ui
 */

// ─── Event bus ──────────────────────────────────────────────────────────

/**
 * Canonical event-name string emitted by the state bus. Values match
 * `STATE_EVENTS` in `src/state/stateEvents.js`. The wildcard `'*'` is
 * reserved for sink-style subscribers (`services/persistence/autoSave.js`,
 * exposed through the public persistence facade).
 *
 * @typedef {(
 *   'activeDataset' | 'datasetAdded' | 'datasetRemoved' | 'configUpdated' | 'columnsUpdated'
 *   | 'chartAdded' | 'chartRemoved' | 'panelCleared'
 *   | 'panelBlockAdded' | 'panelBlockRemoved' | 'panelBlockMoved'
 *   | 'panelBlockProportionsUpdated' | 'panelBlockHeightUpdated'
 *   | 'panelBlockBorderUpdated' | 'panelBlockTemplateChanged' | 'panelBlockSlotAssigned'
 *   | 'sidebarModeChanged' | 'previewRowsChanged'
 *   | 'stateHydrated' | '*'
 * )} StateEventType
 */

/**
 * Callback registered with `onStateChange`. For typed events the argument is
 * the emitted payload; for the wildcard subscription it is `{ type, data }`.
 *
 * @typedef {(payload: *) => void} StateChangeListener
 */

/**
 * Returned by `onStateChange`. Calling it detaches that registration.
 *
 * Once it returns, the registration is not invoked again. If its callback is
 * already executing, that invocation completes; a registration not yet reached
 * in the current emission is skipped. Calling it more than once is safe and
 * affects only its own registration, including when the same function is
 * subscribed more than once to one event.
 *
 * @typedef {() => void} UnsubscribeFn
 */

// ─── Result pattern ─────────────────────────────────────────────────────

/**
 * Standardized success/failure shape produced by `ok()` / `fail()` in
 * `src/utils/result.js`. The success variant spreads its data fields onto
 * the result. There is no `.value` wrapper. Failures carry an optional
 * `reason` string.
 *
 * @typedef {{ ok: true, [key: string]: * } | { ok: false, reason?: string }} Result
 */

// ─── Ingest (domain/datasets/ingest.js → worker → service) ──────────────

/**
 * What to ingest: a CSV or JSON file's text, or the two datasets to join,
 * with options. `ingestDataset` takes it as is; the worker receives it with
 * a correlation id ({@link IngestWorkerRequest}).
 *
 * @typedef {Object} IngestRequest
 * @property {'csv' | 'json' | 'join'} kind - File parser or joined-data operation.
 * @property {string} [text] - Raw file contents for CSV/JSON requests.
 * @property {JoinDatasetsOptions} [join] - Complete join input for a join request.
 * @property {Object} [options]
 * @property {'auto' | '.' | ','} [options.decimalSeparator='auto'] - Explicit string number format, overriding saved column formats, or automatic detection with a dot fallback. Joins retain each source column's saved format in automatic mode. Typed numbers are preserved.
 * @property {number} [options.rowLimit] - Cap the rows after parse or join; surplus rows set `truncatedFrom`. Uploads use this only for a bounded threshold probe, then rerun uncapped after approval.
 * @property {string[]} [options.dropColumns] - Column names to strip before normalization (preset use case).
 */

/**
 * A new dataset's content, as ingest produced it. `ingestDataset` returns it
 * at `result.value`, the worker posts it in its `done` message, and
 * `ingestFile` and `joinDatasetsInWorker` resolve with it at `result.value`.
 *
 * @typedef {Object} IngestPayload
 * @property {Array<Object<string, *>>} rows - Canonical rows: every row has every column, each cell in its column type's canonical form.
 * @property {ColumnSpec[]} columns - Columns in source order, each with its type and decimal separator. JSON columns follow the first row's keys, which list integer-like names first. A join that matched nothing keeps its output columns, typed as text.
 * @property {PrecomputedStats} precomputedStats - Numeric and categorical stats with both versions stamped. Both lists are empty when there are no rows.
 * @property {number | null} truncatedFrom - Original row count when `options.rowLimit` truncated; `null` otherwise.
 */

/**
 * One progress tick reported by ingest and relayed by the worker. File
 * stages start with `'parsing'`; join stages start with `'joining'`; both
 * continue through `'decimal-detection'` → `'type-detection'` →
 * `'normalize'` → `'stats'`. `percent` is the overall pipeline progress
 * (0 to 100), not a per-stage value.
 *
 * @typedef {Object} IngestProgress
 * @property {string} stage
 * @property {number} percent - 0 to 100 inclusive.
 * @property {string} [label] - Localized label when the worker chose to send one; otherwise the host derives one via `progressLabelForStage`.
 */

/**
 * Wire shape posted to the data-ingest Worker via `postMessage`: an
 * {@link IngestRequest} plus an `id`, which is reflected in every response so
 * the host can correlate concurrent ingests. The host side lives in
 * `services/dataIngestService.js`; the worker side lives in
 * `workers/dataIngestWorker.js`.
 *
 * @typedef {IngestRequest & { id: string }} IngestWorkerRequest
 */

/**
 * Discriminated union covering every message the Worker can post back.
 * Discriminate via `type` (`'progress'` | `'done'` | `'error'`).
 *
 * The `'error'` arm carries a stable `reason` code (from the parser) and/or a `message` (from the
 * onmessage catch-all for unexpected throws); the host prefers `reason`.
 *
 * @typedef {(
 *   { id: string, type: 'progress', stage: string, percent: number }
 *   | { id: string, type: 'done', result: IngestPayload }
 *   | { id: string, type: 'error', reason?: string, message?: string }
 * )} IngestWorkerResponse
 */

// ─── Persistence worker (workerBackend → persistWorker → blobBackend) ────

/**
 * One dataset as it travels in a {@link PersistWorkerRequest}. Carries dataset
 * metadata always; the heavy `rows` payload is either included or replaced by
 * `rowsCached: true` when the worker already holds an identical copy from a
 * prior save (reference-identity dedup on the host). Never infer "cached" from
 * a missing `rows`, the flag is explicit so a legitimately empty `rows: []`
 * round-trips correctly.
 *
 * @typedef {Object} PersistWorkerDataset
 * @property {string} id
 * @property {Array<Object<string, *>>} [rows] - Present unless `rowsCached`.
 * @property {boolean} [rowsCached] - When `true`, the worker fills `rows` from its cache.
 */

/**
 * One panel chart as it travels in a {@link PersistWorkerRequest}. Like
 * {@link PersistWorkerDataset}, the heavy `dataSnapshot` / `columnsSnapshot`
 * payloads are independently either included or flagged cached.
 *
 * @typedef {Object} PersistWorkerChart
 * @property {number} id
 * @property {Array<Object<string, *>>} [dataSnapshot] - Present unless `dataSnapshotCached`.
 * @property {boolean} [dataSnapshotCached]
 * @property {ColumnSpec[]} [columnsSnapshot] - Present unless `columnsSnapshotCached`.
 * @property {boolean} [columnsSnapshotCached]
 */

/**
 * Wire shape posted to the persistence Worker via `postMessage`. The `id` is
 * reflected on every response so the host can correlate concurrent ops. Only
 * `persist` and `export` carry a `snapshot`; `import` carries SQLite bytes;
 * `hydrate` and `clear` are bare. The snapshot mirrors {@link AppState} except
 * dataset rows and chart snapshots may be dedup-flagged on `persist` (see
 * {@link PersistWorkerDataset} / {@link PersistWorkerChart}).
 * The host side lives in `services/persistence/backends/workerBackend.js`; the
 * worker side lives in `workers/persistWorker.js`.
 *
 * @typedef {Object} PersistWorkerRequest
 * @property {number} id - Correlation id; mirrored on every response.
 * @property {'persist' | 'hydrate' | 'export' | 'import' | 'clear'} op - Backend operation to run.
 * @property {Object} [snapshot] - Present for `persist` and `export`.
 * @property {boolean} [workOnly] - When `export`, omit dataset rows and panel snapshot payloads.
 * @property {Uint8Array | ArrayBuffer} [bytes] - Serialized SQLite bytes for `import`.
 */

/**
 * Discriminated union covering every message the persistence Worker can post
 * back. Discriminate via `ok`. A `needsResync` failure means a payload was
 * flagged cached but missing from the worker cache (host/worker desync); the
 * host clears its cache and retries once with full payloads. The `error`
 * envelope preserves `name` so `QuotaExceededError` still classifies on the
 * host (see `isQuotaError` in `services/persistence/errors.js`).
 *
 * @typedef {(
 *   { id: number, ok: true, result: Object | Uint8Array | null }
 *   | { id: number, ok: false, needsResync: true }
 *   | { id: number, ok: false, error: { name: string, message: string } }
 * )} PersistWorkerResponse
 */

// ─── Join (domain/datasets/join.js) ─────────────────────────────────────

/**
 * @typedef {'inner' | 'left' | 'right' | 'full'} JoinType
 */

/**
 * Options bag passed to `joinDatasets`. The left/right key arrays form a
 * composite key. `leftKeys[i]` is matched against `rightKeys[i]`.
 *
 * Key normalization is applied before comparison: by default values are
 * trimmed and case-insensitive. Numbers, booleans, and Dates are encoded
 * with type tags (e.g. `'n:42'`, `'d:2024-01-01T…'`) so type-distinct
 * values do not collide as strings.
 *
 * @typedef {Object} JoinDatasetsOptions
 * @property {Array<Object<string, *>>} leftRows
 * @property {Array<Object<string, *>>} rightRows
 * @property {string[]} leftKeys
 * @property {string[]} rightKeys - Must be the same length as `leftKeys`.
 * @property {JoinType} [joinType='inner'] - Unknown values silently fall back to `'inner'`.
 * @property {string[]} leftColumns - Columns from the left side to include in the output.
 * @property {string[]} rightColumns - Columns from the right side to include in the output.
 * @property {ColumnSpec[]} [leftColumnSpecs] - Source metadata that ingest uses to preserve string number formats after joining.
 * @property {ColumnSpec[]} [rightColumnSpecs]
 * @property {string} [leftDatasetName] - Used to derive the prefix for column-name conflicts (`leftPrefix.col`). Falls back to `'left'`.
 * @property {string} [rightDatasetName]
 * @property {{ trim?: boolean, caseSensitive?: boolean }} [normalization]
 */

/**
 * Result of `joinDatasets`. On success carries the merged `rows` (unmatched cells in
 * left/right/full joins are `null`) and `outputColumns` (left-then-right order, with conflicts
 * renamed `'a.salary'`, `'b.salary'`, plus `_2`, `_3` suffixes for further collisions). On failure
 * carries a stable `reason`. `columnSources` maps each output name back to its source
 * so ingest can retain column metadata through conflict renaming.
 *
 * @typedef {(
 *   { ok: true, rows: Array<Object<string, *>>, outputColumns: string[], columnSources: Array<{ source: string, output: string, side: 'left' | 'right' }> }
 *   | { ok: false, reason: string }
 * )} JoinResult
 */

// ─── Stats (domain/datasets/statistics.js) ──────────────────────────────

/**
 * Output of `calculateNumericStatistics` for one numeric column.
 *
 * @typedef {Object} NumericColumnStats
 * @property {string} name
 * @property {number} n
 * @property {number} min
 * @property {number} max
 * @property {number} mean - Arithmetic mean.
 * @property {number} median
 */

/**
 * Output of `calculateCategoricalStatistics` for one non-numeric column.
 *
 * When every value is missing, the entry returns `empty: true` with zeroed
 * counts so downstream renderers can render a uniform "no data" state.
 *
 * @typedef {Object} CategoricalColumnStats
 * @property {string} name
 * @property {number} n - Count of non-missing values.
 * @property {number} missing
 * @property {number} missingFraction - `missing / (n + missing)`, from 0 to 1 (0 for no rows).
 * @property {number} unique - Distinct value count.
 * @property {number} uniquenessRate - `unique / n` (0 when `n === 0`).
 * @property {string | null} mode - Most-frequent value as a string; `null` only when `n === 0`. Ties broken by `localeCompare`.
 * @property {number} modeCount
 * @property {number} modeFraction - `modeCount / n`, from 0 to 1 (0 when `n === 0`).
 * @property {number} top5Fraction - Sum of the top 5 frequencies divided by `n`, from 0 to 1 (0 when `n === 0`).
 * @property {boolean} empty - `true` when `n === 0`.
 */

// ─── Preset loading (presetService) ─────────────────────────────────────

/**
 * Descriptor for a bundled preset dataset, loaded from `dataUrl`.
 *
 * @typedef {Object} PresetDescriptor
 * @property {string} [id]
 * @property {string} [name]
 * @property {string} [dataUrl] - Remote source. Resolved with a 10s timeout.
 * @property {string} [dataFormat] - Wins over URL extension when distinguishing CSV vs JSON.
 * @property {string[]} [dropColumns] - Columns the loader strips after parse.
 */

/**
 * Fetched preset source, ready for the ingest worker.
 *
 * @typedef {Object} PresetSource
 * @property {'csv' | 'json'} kind
 * @property {string} text - Raw file contents.
 * @property {string[]} dropColumns
 */

/**
 * One entry in the bundled preset catalog (`data/presetCatalog.js`).
 * Catalog entries are the authoritative metadata used to render the preset
 * picker dialog and resolve a loaded preset via `presetService`.
 *
 * @typedef {Object} PresetCatalogEntry
 * @property {string} id - Stable identifier (e.g. `'iris'`).
 * @property {string} nameKey - i18n key resolving to the display name.
 * @property {string} descKey - i18n key resolving to the description.
 * @property {number} rowCount - Expected row count after parse.
 * @property {number} columnCount - Expected column count after parse.
 * @property {string[]} tags - Searchable category tags.
 * @property {string} sourceLabel - Human-readable attribution.
 * @property {string} sourceUrl - Link to the original source; may be empty.
 * @property {string} sourceLinkLabel - Anchor text for `sourceUrl`; may be empty.
 * @property {string} dataUrl - Bundled file URL resolved at module-load time.
 * @property {'csv' | 'json'} dataFormat
 * @property {string[]} [dropColumns] - Columns the loader strips after parse.
 */

// ─── UI feedback (ui/feedback.showProgress) ─────────────────────────────

/**
 * Imperative handle returned by `ui/feedback.showProgress` for driving a
 * non-modal progress toast. The toast has three terminal states:
 *   - **In flight**: `update()` reports percent/label progress.
 *   - **Succeeded**: `succeed()` flips the toast to its success style and
 *     auto-closes after `autoCloseMs` (default 1500).
 *   - **Failed**: `fail()` flips the toast to its failure style and
 *     stays open until the user dismisses it.
 *
 * `close()` is idempotent and removes the toast from the DOM.
 * `onCancel(handler)` wires the toast's × button to the host's cancel
 * path while the toast is in-flight; after `succeed()`/`fail()`, × just
 * closes the toast.
 *
 * @typedef {Object} ProgressHandle
 * @property {(percent: number, label?: string) => void} update
 * @property {(message?: string, autoCloseMs?: number) => void} succeed
 * @property {(message?: string) => void} fail
 * @property {() => void} close
 * @property {(handler: () => void) => void} onCancel
 */

// ─── Dataset intake (features/datasetWorkspace/workflows/intake.js) ─────

/**
 * One way to add a dataset, as `runIntake` takes it: an uploaded file, a
 * join or a sample dataset. Every text is already translated.
 *
 * @typedef {Object} IntakeSource
 * @property {string} name - The new dataset's name. Also fills the parsing stage's progress label.
 * @property {string} progressLabel - The progress toast's label until the worker reports a stage.
 * @property {(request: IntakeRequest) => Promise<Result>} ingest - Loads the source's data when it needs to, then runs Ingest in the data worker. Resolves with the worker's result, whose `value` holds the {@link IngestPayload}, or with a failure such as `'cancelled'`.
 * @property {(rowCount: number) => string} sizeLabel - The new dataset's size label, given its row count.
 * @property {((rowCount: string, rowLimit: string) => string) | null} rowWarning - The question asked when the rows are over the row limit, with both numbers formatted for the current locale. `null` exempts the source from the row limit.
 * @property {string} successMessage - The progress toast's text once the dataset is added.
 * @property {(detail: string, reason: string) => string} failureMessage - Text for the toast and the error notice when the intake fails. `detail` is Ingest's translated explanation of a known parse failure, otherwise empty. `reason` lets a source word its own failures, such as a fetch timeout, and is never shown.
 */

/**
 * What `runIntake` passes to `IntakeSource.ingest`.
 *
 * @typedef {Object} IntakeRequest
 * @property {AbortSignal} signal - Aborts when the user cancels from the progress toast.
 * @property {(progress: IngestProgress) => void} onProgress - Updates the progress toast.
 * @property {number} [rowLimit] - Present on the first request of a source with a row warning. A source that can cap its rows passes it to Ingest; one that cannot ignores it.
 */

export {};
