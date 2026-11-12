/**
 * Observe an element's available width, coalescing layout changes into one
 * animation frame. Hidden elements never trigger rendering. The returned
 * disposer also cancels any pending callback.
 *
 * @param {HTMLElement | null} element
 * @param {() => void} onResize
 * @returns {() => void}
 */
export function observeWidth(element, onResize) {
	if (!element || typeof ResizeObserver !== 'function') return () => {};
	let width = element.clientWidth;
	let frame = null;
	const observer = new ResizeObserver(entries => {
		const nextWidth = entries[0].contentRect.width;
		if (nextWidth === width) return;
		width = nextWidth;
		if (frame !== null) window.cancelAnimationFrame(frame);
		frame = null;
		if (width <= 0) return;
		frame = window.requestAnimationFrame(() => {
			frame = null;
			onResize();
		});
	});
	observer.observe(element);
	return () => {
		observer.disconnect();
		if (frame !== null) window.cancelAnimationFrame(frame);
	};
}
