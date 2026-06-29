/**
 * CHIVE centralized JSDoc typedef catalog.
 *
 * No runtime exports. Consumers reference these shapes via:
 *   @typedef {import('../types.js').Dataset} Dataset
 *
 * Pull the relative path of this file from wherever the consumer lives.
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
 * @typedef {'bar' | 'scatter' | 'pie' | 'bubble' | 'network' | 'treemap' | 'line' | 'tin'} ChartTypeKey
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
 */

/**
 * Worker-computed statistics, cached on the dataset to avoid recomputing on
 * every DATASET_ADDED event. Absent on joined datasets (joins build rows
 * fresh and do not invoke the ingest worker).
 *
 * @typedef {Object} PrecomputedStats
 * @property {Object<string, Object>} numeric - Per-column numeric stats (min, max, mean, …).
 * @property {Object<string, Object>} categorical - Per-column categorical stats (top values, distinct count, …).
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
 * stable. See `src/config/chartDefaults.js` for the full per-chart shape.
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
 * superset-typed as `ChartTypeConfig`. See `src/config/chartDefaults.js` for
 * each chart type's full field set.
 *
 * @typedef {Object} ChartConfig
 * @property {string} activeTab - Active tab id (e.g. `'preview'`, `'charts'`, `'panel'`).
 * @property {GlobalFilter} globalFilter
 * @property {ChartTypeConfig} bar
 * @property {ChartTypeConfig} scatter
 * @property {ChartTypeConfig} pie
 * @property {ChartTypeConfig} bubble
 * @property {ChartTypeConfig} network
 * @property {ChartTypeConfig} treemap
 * @property {ChartTypeConfig} line
 * @property {ChartTypeConfig} tin
 */

/**
 * Column-name buckets passed into per-chart `build`/`attachListeners`/
 * `computeDefaults` by the chartControls registry. Derived from the active
 * dataset's visible columns by `getColumnContext()` in
 * `chartControls/chartControlsManager.js`.
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
 * value untouched. Invalid hex strings are silently ignored.
 *
 * @typedef {Object} PanelBlockBorderOptions
 * @property {boolean} [enabled] - When set, replaces `block.borderEnabled`.
 * @property {string} [color] - Hex color (e.g. `'#5d645d'`). Validated via {@link isValidHexColor}; invalid values are dropped.
 */

/**
 * Frozen capture of a chart at the moment it was added to the panel.
 * Stores data + config + metadata so the panel can re-render after the
 * underlying dataset changes (or is removed) without losing the chart.
 *
 * @typedef {Object} ChartSnapshot
 * @property {number} id - Monotonic; assigned by `addChartSnapshot`.
 * @property {string} name - Sanitized title, max 100 chars.
 * @property {ChartTypeKey | null} type
 * @property {Object | null} config - Frozen copy of `chartConfig[type]` at capture time.
 * @property {Array<Object<string, *>>} dataSnapshot - Copy of the rows used.
 * @property {ColumnSpec[]} columnsSnapshot
 * @property {Object | null} metadata - Chart-specific render metadata (axis ranges, scales, …).
 * @property {string} metaSummary - Plain-text summary; max 180 chars.
 * @property {string} createdAt - ISO 8601 timestamp.
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
 * @property {number} previewRows - Must be ≥ 1.
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
 * `STATE_EVENTS` in `src/modules/state/stateEvents.js`. The wildcard `'*'` is
 * reserved for sink-style subscribers (`persistenceService`).
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
 * Returned by `onStateChange`. Calling it detaches the listener.
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

// ─── Ingest pipeline (worker → service → fileManager) ───────────────────

/**
 * Resolved payload from the data-ingest worker. Lives at `result.value`
 * when `ingestFile` resolves successfully.
 *
 * @typedef {Object} IngestPayload
 * @property {Array<Object<string, *>>} rows - Normalized rows (numeric columns parsed; missing values preserved).
 * @property {ColumnSpec[]} columns - Detected columns in source order.
 * @property {Object<string, Object>} statsNumeric - Per-column numeric stats (n, min, max, mean, median).
 * @property {Object<string, Object>} statsCategorical - Per-column categorical stats (mode, top-N, missingness).
 * @property {number} [truncatedFrom] - Original row count before the worker capped to `rowLimit`. Absent when no truncation occurred.
 */

/**
 * One progress tick emitted by the worker. Stages run roughly in this
 * order: `'parsing'` → `'decimal-detection'` → `'type-detection'` →
 * `'normalize'` → `'stats'`. `percent` is the overall pipeline progress
 * (0 to 100), not a per-stage value.
 *
 * @typedef {Object} IngestProgress
 * @property {string} stage
 * @property {number} percent - 0 to 100 inclusive.
 * @property {string} [label] - Localized label when the worker chose to send one; otherwise the host derives one via `progressLabelForStage`.
 */

/**
 * Wire shape posted to the data-ingest Worker via `postMessage`. The `id`
 * field is reflected in every response so the host can correlate concurrent
 * ingests. The host side lives in `services/dataIngestService.js`; the
 * worker side lives in `workers/dataIngestWorker.js`.
 *
 * @typedef {Object} IngestWorkerRequest
 * @property {number} id - Correlation id; mirrored on every response.
 * @property {'csv' | 'json'} kind - Parser to use.
 * @property {string} text - Raw file contents.
 * @property {Object} [options]
 * @property {number} [options.rowLimit] - Cap rows after parse; surplus rows trigger `truncatedFrom` in the done payload.
 * @property {string[]} [options.dropColumns] - Column names to strip before normalization (preset use case).
 */

/**
 * Done-state result body posted back by the Worker. Distinct from
 * {@link IngestPayload}. This is the wire shape; the host service may
 * reshape it before exposing to callers.
 *
 * @typedef {Object} IngestWorkerDoneResult
 * @property {Array<Object<string, *>>} rows
 * @property {ColumnSpec[]} columns
 * @property {string} decimalSeparator - Detected separator (`'.'` or `','`).
 * @property {NumericColumnStats[] | []} statsNumeric - Empty array when no rows.
 * @property {CategoricalColumnStats[] | []} statsCategorical - Empty array when no rows.
 * @property {number | null} truncatedFrom - Original row count when `options.rowLimit` truncated; `null` otherwise.
 */

/**
 * Discriminated union covering every message the Worker can post back.
 * Discriminate via `type` (`'progress'` | `'done'` | `'error'`).
 *
 * The `'error'` arm carries a stable `reason` code (from the parser) and/or a `message` (from the
 * onmessage catch-all for unexpected throws); the host prefers `reason`.
 *
 * @typedef {(
 *   { id: number, type: 'progress', stage: string, percent: number }
 *   | { id: number, type: 'done', result: IngestWorkerDoneResult }
 *   | { id: number, type: 'error', reason?: string, message?: string }
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
 * The host side lives in `services/persistence/workerBackend.js`; the worker
 * side lives in `workers/persistWorker.js`.
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
 * host (see `isQuotaError` in `persistenceService.js`).
 *
 * @typedef {(
 *   { id: number, ok: true, result: Object | Uint8Array | null }
 *   | { id: number, ok: false, needsResync: true }
 *   | { id: number, ok: false, error: { name: string, message: string } }
 * )} PersistWorkerResponse
 */

// ─── Join (dataService.joinDatasets) ────────────────────────────────────

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
 * @property {string} [leftDatasetName] - Used to derive the prefix for column-name conflicts (`leftPrefix.col`). Falls back to `'left'`.
 * @property {string} [rightDatasetName]
 * @property {{ trim?: boolean, caseSensitive?: boolean }} [normalization]
 */

/**
 * Result of `joinDatasets`. On success carries the merged `rows` (unmatched cells in
 * left/right/full joins are `null`) and `outputColumns` (left-then-right order, with conflicts
 * renamed `'a.salary'`, `'b.salary'`, plus `_2`, `_3` suffixes for further collisions). On failure
 * carries a stable `reason`.
 *
 * @typedef {(
 *   { ok: true, rows: Array<Object<string, *>>, outputColumns: string[] }
 *   | { ok: false, reason: string }
 * )} JoinResult
 */

// ─── Stats (dataService.calculate*) ─────────────────────────────────────

/**
 * Output of `calculateStatistics` for one numeric column.
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
 * @property {number} missingPct - 0 to 1 inclusive.
 * @property {number} unique - Distinct value count.
 * @property {number} uniquenessRate - `unique / n` (0 when `n === 0`).
 * @property {string | null} mode - Most-frequent value as a string; `null` only when `n === 0`. Ties broken by `localeCompare`.
 * @property {number} modeCount
 * @property {number} modePct - `modeCount / n`.
 * @property {number} top5Pct - Sum of the top 5 frequencies divided by `n`.
 * @property {boolean} empty - `true` when `n === 0`.
 */

// ─── Preset loading (presetService) ─────────────────────────────────────

/**
 * Descriptor for a bundled preset dataset. Either `data` (inline) or
 * `dataUrl` (remote) must be present; if both are, `data` wins.
 *
 * @typedef {Object} PresetDescriptor
 * @property {string} [id]
 * @property {string} [name]
 * @property {Array<Object<string, *>>} [data] - Inline rows.
 * @property {string} [dataUrl] - Remote source. Resolved with a 10s timeout.
 * @property {string} [dataFormat] - Wins over URL extension when distinguishing CSV vs JSON.
 * @property {string[]} [dropColumns] - Columns the loader strips after parse.
 */

/**
 * Resolved preset source. Discriminated by `mode`; callers should narrow
 * before reading fields specific to one variant.
 *
 * @typedef {(
 *   { mode: 'inline', rows: Array<Object<string, *>>, dropColumns: string[] }
 *   | { mode: 'fetched', kind: 'csv' | 'json', text: string, dropColumns: string[] }
 * )} PresetSource
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
 * @property {number} rows - Expected row count after parse.
 * @property {number} columns - Expected column count after parse.
 * @property {string[]} tags - Searchable category tags.
 * @property {string} sourceLabel - Human-readable attribution.
 * @property {string} sourceUrl - Link to the original source; may be empty.
 * @property {string} sourceLinkLabel - Anchor text for `sourceUrl`; may be empty.
 * @property {string} dataUrl - Bundled file URL resolved at module-load time.
 * @property {'csv' | 'json'} dataFormat
 * @property {string[]} [dropColumns] - Columns the loader strips after parse.
 */

// ─── UI feedback (feedbackUI.showProgress) ──────────────────────────────

/**
 * Imperative handle returned by `feedbackUI.showProgress` for driving a
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

// ─── Join workflow (fileManager.createJoinedDataset) ────────────────────

/**
 * Result returned by `fileManager.createJoinedDataset`. Uses `message`
 * rather than `reason` (the generic `Result` shape's failure field), so
 * callers route failures into `showError` directly. On success the new
 * dataset's index in `appState.data.datasets` and the generated name
 * are returned.
 *
 * @typedef {(
 *   { ok: true, index: number, datasetName: string }
 *   | { ok: false, message: string }
 * )} JoinDatasetResult
 */

export {};
