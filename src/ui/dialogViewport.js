/**
 * Keep a modal inside the visible area when a software keyboard covers part of
 * the layout viewport. Pinch zoom keeps native panning and magnification; it must
 * not reflow the dialog to undo the user's zoom. CSS handles the no-API fallback.
 * @param {HTMLDialogElement} dialog
 * @returns {() => void}
 */
export function observeDialogViewport(dialog) {
	const viewport = window.visualViewport;
	if (!viewport) return () => {};
	let frame = null;
	let disposed = false;
	const properties = ['--dialog-viewport-height', '--dialog-viewport-top', '--dialog-viewport-bottom'];
	const update = () => {
		frame = null;
		if (disposed) return;
		if (viewport.scale !== 1) {
			properties.forEach(name => dialog.style.removeProperty(name));
			return;
		}
		const values = [viewport.height, viewport.offsetTop, Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)];
		properties.forEach((name, index) => {
			const value = `${values[index]}px`;
			if (dialog.style.getPropertyValue(name) !== value) dialog.style.setProperty(name, value);
		});
		// The browser may focus a field before the keyboard finishes resizing.
		// Reveal it again inside the newly constrained, scrollable form body.
		const focused = document.activeElement;
		if (viewport.height < window.innerHeight && dialog.contains(focused) && focused.matches('input, select, textarea, [contenteditable="true"]')) {
			focused.scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
		}
	};
	const schedule = () => {
		if (frame === null) frame = window.requestAnimationFrame(update);
	};
	viewport.addEventListener('resize', schedule);
	viewport.addEventListener('scroll', schedule);
	update();
	return () => {
		disposed = true;
		viewport.removeEventListener('resize', schedule);
		viewport.removeEventListener('scroll', schedule);
		if (frame !== null) window.cancelAnimationFrame(frame);
		properties.forEach(name => dialog.style.removeProperty(name));
	};
}
