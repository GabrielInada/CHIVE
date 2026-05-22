/**
 * CHIVE — centralized JSDoc typedef catalog.
 *
 * No runtime exports. Consumers reference these shapes via:
 *   @typedef {import('../types.js').Dataset} Dataset
 *
 * Pull the relative path of this file from wherever the consumer lives.
 * Typedefs are not values, so barrels (modules/index.js) do not propagate
 * them — always import directly from this file.
 *
 * Field names follow the codebase's mixed Portuguese/English convention
 * (dataset.nome, dataset.dados, dataset.colunas) — do not rename for English
 * consistency; renaming breaks persistence and a large surface of callers.
 *
 * @see CONTRIBUTING.md  "Documentation Conventions" section
 * @see ARCHITECTURE.md
 */

// ─── Primitives & unions ────────────────────────────────────────────────

/**
 * Canonical chart-type identifiers used throughout state and config.
 *
 * @typedef {'bar' | 'scatter' | 'pie' | 'bubble' | 'network' | 'treemap' | 'line' | 'tin'} ChartTypeKey
 */

/**
 * Detected column data type. Values are Portuguese for historical reasons.
 *
 * @typedef {'numero' | 'texto' | 'data'} ColumnType
 */

/**
 * Panel layout template identifier. Each template owns its own slot set
 * (see {@link PanelBlockProportions} for the per-template proportions shape).
 *
 * @typedef {'layout-single' | 'layout-2col' | 'layout-hero2' | 'layout-3col' | 'layout-1x2'} PanelTemplateId
 */

/**
 * Sidebar mode currently active in the UI.
 *
 * @typedef {'dados' | 'viz' | 'panel'} SidebarMode
 */

// ─── Data domain ────────────────────────────────────────────────────────

/**
 * Column metadata as detected by the ingest worker.
 *
 * @typedef {Object} ColumnSpec
 * @property {string} nome - Column name as it appears in the source file.
 * @property {ColumnType} tipo - Detected type. Falls back to `'texto'` when no rule matches.
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
 * @property {string} nome - Display name. Original filename for uploads, derived label for joins.
 * @property {string} tamanho - Pre-formatted size label (not raw bytes).
 * @property {Array<Object<string, *>>} dados - Parsed rows. Each row's keys match `colunas[i].nome`.
 * @property {ColumnSpec[]} colunas - Detected columns in source order.
 * @property {string[]} colunasSelecionadas - Names of currently visible columns (subset of `colunas[].nome`).
 * @property {ChartConfig} configGraficos - Per-chart-type configuration.
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
 * extends this with type-specific fields (axis bindings, color scales, …) —
 * those extras are intentionally not enumerated here to keep this typedef
 * stable. See `src/config/chartDefaults.js` for the full per-chart shape.
 *
 * @typedef {Object} ChartTypeConfig
 * @property {boolean} enabled - Whether this chart type is the active one for the dataset.
 * @property {boolean} expanded - Sidebar config panel expansion state.
 * @property {string} customTitle - User-overridden title; empty string means use the default.
 * @property {number} chartHeight - Render height in pixels.
 * @property {string} [color] - Primary color (hex). Optional — not every chart uses a single color.
 * @property {string} [colorMode] - Color application mode (chart-specific values).
 */

/**
 * Per-dataset chart configuration. One block per supported chart type plus
 * the active-tab marker and global filter. The per-chart entries are
 * superset-typed as `ChartTypeConfig` — see `src/config/chartDefaults.js` for
 * each chart type's full field set.
 *
 * @typedef {Object} ChartConfig
 * @property {string} aba - Active tab id (e.g. `'preview'`, `'viz'`).
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

// ─── Panel domain ───────────────────────────────────────────────────────

/**
 * Block proportion shape. Union: the layout template determines which fields are present.
 *
 * - `layout-single`:  `{ split: 100 }`
 * - `layout-2col`:    `{ split: number }` (20–80)
 * - `layout-1x2`:     `{ split: number }` (20–80)
 * - `layout-hero2`:   `{ splitMain: number, splitRight: number }`
 * - `layout-3col`:    `{ a: number, b: number, c: number }`
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
 * Frozen capture of a chart at the moment it was added to the panel.
 * Stores data + config + metadata so the panel can re-render after the
 * underlying dataset changes (or is removed) without losing the chart.
 *
 * @typedef {Object} ChartSnapshot
 * @property {number} id - Monotonic; assigned by `addChartSnapshot`.
 * @property {string} nome - Sanitized title, max 100 chars.
 * @property {ChartTypeKey | null} type
 * @property {Object | null} config - Frozen copy of `configGraficos[type]` at capture time.
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
 * `STATE_EVENTS` in `src/modules/stateEvents.js`. The wildcard `'*'` is
 * reserved for sink-style subscribers (`stateSync`, `persistenceService`).
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
 * the result — there is no `.value` wrapper. Failures carry an optional
 * `reason` string.
 *
 * @typedef {{ ok: true, [key: string]: * } | { ok: false, reason?: string }} Result
 */

export {};
