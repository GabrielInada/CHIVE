/**
 * CHIVE state bus, canonical event registry, subscriber API, and emit pipeline.
 *
 * @typedef {import('../../types.js').StateEventType} StateEventType
 * @typedef {import('../../types.js').StateChangeListener} StateChangeListener
 * @typedef {import('../../types.js').UnsubscribeFn} UnsubscribeFn
 *
 * @see docs/development/architecture.md
 */

/**
 * Canonical names for every state-change event the app emits.
 *
 * Emitters and subscribers should reference these constants instead of
 * string literals so a typo becomes a static error rather than a silent
 * dropped subscription. Test suites intentionally keep using literals to
 * exercise the wire format independently of this registry.
 *
 * @type {Readonly<Record<string, StateEventType>>}
 */
export const STATE_EVENTS = Object.freeze({
	// data domain
	ACTIVE_DATASET: 'activeDataset',
	DATASET_ADDED: 'datasetAdded',
	DATASET_REMOVED: 'datasetRemoved',
	CONFIG_UPDATED: 'configUpdated',
	COLUMNS_UPDATED: 'columnsUpdated',

	// panel domain
	CHART_ADDED: 'chartAdded',
	CHART_REMOVED: 'chartRemoved',
	PANEL_CLEARED: 'panelCleared',
	PANEL_BLOCK_ADDED: 'panelBlockAdded',
	PANEL_BLOCK_REMOVED: 'panelBlockRemoved',
	PANEL_BLOCK_MOVED: 'panelBlockMoved',
	PANEL_BLOCK_PROPORTIONS_UPDATED: 'panelBlockProportionsUpdated',
	PANEL_BLOCK_HEIGHT_UPDATED: 'panelBlockHeightUpdated',
	PANEL_BLOCK_BORDER_UPDATED: 'panelBlockBorderUpdated',
	PANEL_BLOCK_TEMPLATE_CHANGED: 'panelBlockTemplateChanged',
	PANEL_BLOCK_SLOT_ASSIGNED: 'panelBlockSlotAssigned',

	// ui domain
	SIDEBAR_MODE_CHANGED: 'sidebarModeChanged',
	PREVIEW_ROWS_CHANGED: 'previewRowsChanged',

	// meta
	STATE_HYDRATED: 'stateHydrated',
	WILDCARD: '*',
});

const stateListeners = {};

const STATE_LOG_CAP = 100;
const stateLog = [];
let stateLogEnabled = false;

/**
 * Enable the in-memory mutation log. Every subsequent emission is appended to
 * stateLog and printed via console.log under the `[chive:state]` tag. Off by
 * default; flip on at runtime via `window.chiveDebug.enableStateLog()`.
 *
 * Log entries hold live references to payloads (no clone), mutations after
 * emit will affect the recorded entry. Acceptable for a debug tool.
 */
export function enableStateLog() {
	stateLogEnabled = true;
}

/**
 * Disable the in-memory mutation log. Existing entries are preserved; use
 * {@link clearStateLog} to discard them.
 */
export function disableStateLog() {
	stateLogEnabled = false;
}

/**
 * Read the current mutation log.
 *
 * @returns {Array<{ type: StateEventType, data: *, t: number }>} Shallow copy of the log buffer (last 100 entries max). Each entry's `data` is a live reference to the original payload, do not mutate.
 */
export function getStateLog() {
	return stateLog.slice();
}

/**
 * Discard all entries from the mutation log.
 */
export function clearStateLog() {
	stateLog.length = 0;
}

function reportListenerError(errorType, eventType, err) {
	window.dispatchEvent(new CustomEvent('chive-internal-error', {
		detail: {
			type: errorType,
			eventType,
			message: String(err?.message || err),
		},
	}));
}

/**
 * Subscribe to a state event. Pass `STATE_EVENTS.WILDCARD` (`'*'`) to receive
 * every emission, reserved for sink-style consumers (e.g.
 * `persistenceService`); do not use from controllers or renderers.
 *
 * @param {StateEventType} eventType - Event name. Always use `STATE_EVENTS.*` constants, not string literals.
 * @param {StateChangeListener} callback - Receives the payload for typed events, or `{ type, data }` for wildcard.
 * @returns {UnsubscribeFn} Call to detach the listener.
 *
 * @example
 *   // Typed subscription
 *   const off = onStateChange(STATE_EVENTS.DATASET_ADDED, ({ index, dataset }) => { ... });
 *   off(); // later
 *
 * @example
 *   // Wildcard sink
 *   onStateChange(STATE_EVENTS.WILDCARD, ({ type, data }) => {
 *       console.log('emit:', type, data);
 *   });
 */
export function onStateChange(eventType, callback) {
	if (!stateListeners[eventType]) {
		stateListeners[eventType] = [];
	}
	stateListeners[eventType].push(callback);

	return () => {
		const index = stateListeners[eventType].indexOf(callback);
		if (index > -1) {
			stateListeners[eventType].splice(index, 1);
		}
	};
}

/**
 * Emit a state-change event. Fan-out goes to three sinks:
 *   1. Listeners registered for `eventType` (typed payload).
 *   2. Wildcard listeners (`'*'`), invoked with `{ type, data }`.
 *   3. A `chive-state-changed` CustomEvent on `window` (browser extension hook).
 *
 * Listener errors are caught and rebroadcast as a `chive-internal-error`
 * CustomEvent on `window`, one bad subscriber cannot break the fan-out.
 *
 * When the in-memory log is enabled ({@link enableStateLog}), the emission
 * is also appended to the log buffer and printed under `[chive:state]`.
 *
 * @param {StateEventType} eventType
 * @param {*} [data] - Event payload. Type varies per event; see emission sites in the facades.
 */
export function emitStateChange(eventType, data) {
	if (stateLogEnabled) {
		stateLog.push({ type: eventType, data, t: Date.now() });
		if (stateLog.length > STATE_LOG_CAP) {
			stateLog.shift();
		}
		console.log('[chive:state]', eventType, data);
	}

	if (stateListeners[eventType]) {
		stateListeners[eventType].forEach(cb => {
			try {
				cb(data);
			} catch (err) {
				reportListenerError('state-listener-error', eventType, err);
			}
		});
	}

	if (stateListeners['*']) {
		stateListeners['*'].forEach(cb => {
			try {
				cb({ type: eventType, data });
			} catch (err) {
				reportListenerError('state-wildcard-listener-error', eventType, err);
			}
		});
	}

	window.dispatchEvent(new CustomEvent('chive-state-changed', {
		detail: { type: eventType, data },
	}));
}
