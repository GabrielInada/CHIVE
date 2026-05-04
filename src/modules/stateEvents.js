/**
 * Canonical names for every state-change event the app emits.
 *
 * Emitters and subscribers should reference these constants instead of
 * string literals so a typo becomes a static error rather than a silent
 * dropped subscription. Test suites intentionally keep using literals to
 * exercise the wire format independently of this registry.
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
	SLOT_ASSIGNED: 'slotAssigned',
	LAYOUT_CHANGED: 'layoutChanged',
	PANEL_CLEARED: 'panelCleared',
	PANEL_BLOCK_ADDED: 'panelBlockAdded',
	PANEL_BLOCK_REMOVED: 'panelBlockRemoved',
	PANEL_BLOCK_MOVED: 'panelBlockMoved',
	PANEL_BLOCK_PROPORTIONS_UPDATED: 'panelBlockProportionsUpdated',
	PANEL_BLOCK_HEIGHT_UPDATED: 'panelBlockHeightUpdated',
	PANEL_BLOCK_BORDER_UPDATED: 'panelBlockBorderUpdated',
	PANEL_BLOCK_TEMPLATE_CHANGED: 'panelBlockTemplateChanged',
	PANEL_BLOCK_SLOT_ASSIGNED: 'panelBlockSlotAssigned',
	PANEL_MIGRATED_TO_BLOCKS: 'panelMigratedToBlocks',

	// ui domain
	SIDEBAR_MODE_CHANGED: 'sidebarModeChanged',
	CHART_EXPANDED_CHANGED: 'chartExpandedChanged',
	PREVIEW_ROWS_CHANGED: 'previewRowsChanged',

	// meta
	STATE_RESET: 'stateReset',
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
 * Log entries hold live references to payloads (no clone) — mutations after
 * emit will affect the recorded entry. Acceptable for a debug tool.
 */
export function enableStateLog() {
	stateLogEnabled = true;
}

export function disableStateLog() {
	stateLogEnabled = false;
}

export function getStateLog() {
	return stateLog.slice();
}

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
