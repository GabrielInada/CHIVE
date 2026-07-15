/**
 * State-event classification for project dirty tracking.
 *
 * Pure predicates that decide whether a state change should mark the project
 * dirty (triggering an auto-save) or is a UI-only change handled separately.
 */

import { STATE_EVENTS } from '../../modules/state/stateEvents.js';
import { isPlainObject } from './snapshot.js';

/**
 * True when a config update only changes the UI tab marker.
 *
 * @param {*} payload
 * @returns {boolean}
 */
export function isActiveTabOnlyPatch(payload) {
	if (!isPlainObject(payload)) return false;
	const keys = Object.keys(payload);
	return keys.length === 1 && Object.prototype.hasOwnProperty.call(payload, 'activeTab');
}

/**
 * @internal
 * @param {string} eventType
 * @returns {boolean}
 */
export function isUiPrefsEvent(eventType) {
	return eventType === STATE_EVENTS.SIDEBAR_MODE_CHANGED
		|| eventType === STATE_EVENTS.PREVIEW_ROWS_CHANGED;
}

/**
 * Classify state events for project dirty tracking.
 *
 * @param {{ type: string, data?: * }} event
 * @returns {boolean}
 */
export function isProjectDirtyEvent(event) {
	if (!event?.type) return false;
	if (event.type === STATE_EVENTS.STATE_HYDRATED) return false;
	if (isUiPrefsEvent(event.type)) return false;
	if (event.type === STATE_EVENTS.CONFIG_UPDATED && isActiveTabOnlyPatch(event.data)) return false;
	return true;
}
