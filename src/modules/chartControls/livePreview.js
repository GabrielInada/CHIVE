/**
 * Live chart preview stub.
 *
 * Holds a single callback that, when set, is invoked by the chartControls
 * listeners and the chart height drag to trigger a live re-render of the
 * chart (without waiting for the commit write). The application initializer
 * registers the render coordinator's throttled `livePreviewRender` here; when no
 * callback is registered these functions are no-ops.
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
