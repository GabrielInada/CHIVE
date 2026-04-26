let liveRenderCallback = null;

export function setLiveRenderCallback(callback) {
	liveRenderCallback = typeof callback === 'function' ? callback : null;
}

export function triggerLiveRender() {
	liveRenderCallback?.();
}
