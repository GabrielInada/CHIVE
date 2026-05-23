/**
 * Live chart preview stub.
 *
 * Holds a single callback that, when set, is invoked by the chart-controls
 * listeners on every change to trigger a live re-render of the chart
 * (without waiting for the user to save). Live preview is currently
 * disabled at the wiring level (`initChartControls` is typically called
 * with `null`) — these functions are no-ops in that case.
 */

let liveRenderCallback = null;

/**
 * Register the live-render callback. Pass `null` (or any non-function)
 * to disable.
 *
 * @param {(() => void) | null | undefined} callback
 */
export function setLiveRenderCallback(callback) {
	liveRenderCallback = typeof callback === 'function' ? callback : null;
}

/**
 * Invoke the registered live-render callback if one is set. No-op
 * otherwise.
 */
export function triggerLiveRender() {
	liveRenderCallback?.();
}
