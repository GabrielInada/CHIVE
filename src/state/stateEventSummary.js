/** Metadata-only projections. Never walk rows, snapshots, column names or config values. */

import { CHART_TYPE_KEYS } from '../config/charts/definitions.js';

const CONFIG_KEYS = ['activeTab', 'activeChartType', 'globalFilter', ...CHART_TYPE_KEYS];
const integer = value => Number.isSafeInteger(value) ? value : null;
const count = value => Array.isArray(value) ? value.length : null;

/**
 * The registry is passed in by its owner to avoid a state-bus import cycle.
 * Unrecognized or malformed payloads produce no metadata, never a raw fallback.
 */
export function summarizeStateEvent(type, data, events) {
	try {
		switch (type) {
			case events.ACTIVE_DATASET_CHANGED:
			case events.DATASET_REMOVED:
				return { index: integer(data) };
			case events.DATASET_ADDED:
				return {
					index: integer(data?.index),
					rowsCount: count(data?.dataset?.rows),
					columnsCount: count(data?.dataset?.columns),
				};
			case events.DATASET_CONFIG_UPDATED:
				return { fields: CONFIG_KEYS.filter(key => Object.hasOwn(data || {}, key)) };
			case events.COLUMN_SELECTION_CHANGED:
				return { columnsCount: count(data) };
			case events.CHART_SNAPSHOT_ADDED:
				return {
					id: integer(data?.id),
					rowsCount: count(data?.snapshot?.dataSnapshot),
					columnsCount: count(data?.snapshot?.columnsSnapshot),
				};
			case events.CHART_SNAPSHOT_REMOVED:
				return { id: integer(data) };
			case events.PANEL_BLOCK_MOVED:
				return { targetIndex: integer(data?.targetIndex) };
			case events.PANEL_BLOCK_HEIGHT_UPDATED:
				return { heightPx: integer(data?.heightPx) };
			case events.PANEL_BLOCK_BORDER_UPDATED:
				return { enabled: typeof data?.enabled === 'boolean' ? data.enabled : null };
			case events.PREVIEW_ROWS_CHANGED:
				return { rows: integer(data) };
			case events.SIDEBAR_MODE_CHANGED:
				return { mode: ['data', 'viz', 'panel'].includes(data) ? data : null };
			default:
				return null;
		}
	} catch {
		// Diagnostics must never prevent delivery of the original event.
		return null;
	}
}
