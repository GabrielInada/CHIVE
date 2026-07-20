/**
 * State-event classification for project dirty tracking.
 *
 * Pure predicates that decide whether a state change should mark the project
 * dirty (triggering an auto-save) or is a UI-only change handled separately.
 */

import { STATE_EVENTS } from '../../state/stateEvents.js';
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
	return true;
}
