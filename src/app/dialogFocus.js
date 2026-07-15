/**
 * CHIVE modal dialog focus management.
 *
 * Shared focus trap + scroll lock for the `join-overlay`/`join-dialog` modal
 * dialogs (chart-type picker, global filter, preset datasets, join builder).
 * One module-level capture keydown listener always traps Tab within the
 * top-most open dialog, so nested/rapid-open dialogs never fight over focus.
 *
 * Lives in `app/` because no single feature owns it: the dataset workspace
 * dialogs, `components/settingsDialog.js`, and `app/bindings/keyboardShortcuts.js`
 * (which consumes {@link isAnyDialogOpen}) all depend on it. Not in `utils/`
 * because it holds module state and touches the DOM.
 */

const FOCUSABLE_SELECTOR = 'a[href], button, input, select, textarea, [tabindex]';

/**
 * Active dialogs, oldest first. The last element is the top-most dialog that
 * currently owns the Tab trap.
 *
 * @type {Array<{ overlay: Element, dialog: HTMLElement, isVisible: (el: Element) => boolean, trigger: Element | null, addedTabindex: boolean }>}
 */
const stack = [];

let keydownHandler = null;
let scrollLocked = false;
let previousBodyOverflow = '';

/** @private */
function topEntry() {
	return stack.length > 0 ? stack[stack.length - 1] : null;
}

/**
 * Default visibility check. Injectable so jsdom tests can stub it (jsdom
 * reports zero client rects for genuinely visible nodes).
 *
 * @private
 * @param {Element} el
 * @returns {boolean}
 */
function defaultIsVisible(el) {
	if (typeof window === 'undefined' || typeof window.getComputedStyle !== 'function') return true;
	const style = window.getComputedStyle(el);
	if (style.display === 'none' || style.visibility === 'hidden') return false;
	return el.getClientRects().length > 0;
}

/**
 * Focusable descendants of `dialog`, in DOM order, excluding disabled,
 * negative-tabindex, hidden-ancestor, and not-visible elements.
 *
 * @private
 * @param {HTMLElement} dialog
 * @param {(el: Element) => boolean} isVisible
 * @returns {HTMLElement[]}
 */
function getFocusable(dialog, isVisible) {
	const out = [];
	for (const el of dialog.querySelectorAll(FOCUSABLE_SELECTOR)) {
		if (el.disabled) continue;
		const tabindex = el.getAttribute('tabindex');
		if (tabindex !== null && Number(tabindex) < 0) continue;
		if (el.closest('[hidden], [aria-hidden="true"], [inert]')) continue;
		if (!isVisible(el)) continue;
		out.push(el);
	}
	return out;
}

/** @private */
function onDocumentKeydown(event) {
	if (event.key !== 'Tab') return;
	pruneDisconnectedEntries();
	const top = topEntry();
	if (!top) return;

	const focusables = getFocusable(top.dialog, top.isVisible);
	if (focusables.length === 0) {
		// Nothing tabbable: keep focus from leaving the dialog entirely.
		event.preventDefault();
		return;
	}

	const first = focusables[0];
	const last = focusables[focusables.length - 1];
	const active = document.activeElement;
	const escaped = !top.dialog.contains(active);

	if (event.shiftKey) {
		if (escaped || active === first) {
			event.preventDefault();
			last.focus();
		}
	} else if (escaped || active === last) {
		event.preventDefault();
		first.focus();
	}
}

/** @private */
function ensureGlobalListener() {
	if (keydownHandler) return;
	keydownHandler = onDocumentKeydown;
	document.addEventListener('keydown', keydownHandler, true);
}

/** @private */
function teardownGlobalListener() {
	if (!keydownHandler) return;
	document.removeEventListener('keydown', keydownHandler, true);
	keydownHandler = null;
}

/** @private */
function lockScroll() {
	if (scrollLocked) return;
	scrollLocked = true;
	previousBodyOverflow = document.body.style.overflow;
	document.body.style.overflow = 'hidden';
}

/** @private */
function restoreScroll() {
	if (!scrollLocked) return;
	scrollLocked = false;
	document.body.style.overflow = previousBodyOverflow;
}

/**
 * Remove an entry from the stack and release its per-entry resources. When the
 * stack empties, tear down the shared listener and restore body scroll. Safe
 * to call more than once and on an already-removed entry.
 *
 * @private
 */
function cleanupEntry(entry) {
	const index = stack.indexOf(entry);
	if (index === -1) return;
	stack.splice(index, 1);
	if (entry.addedTabindex && entry.dialog) {
		entry.dialog.removeAttribute('tabindex');
		entry.addedTabindex = false;
	}
	if (stack.length === 0) {
		teardownGlobalListener();
		restoreScroll();
	}
}

/**
 * Drop every entry whose overlay has left the DOM (a dialog removed outside
 * the centralized close path). Runs the full per-entry cleanup, not just a
 * stack splice. Called before any top-of-stack read.
 *
 * @private
 */
function pruneDisconnectedEntries() {
	for (const entry of [...stack]) {
		if (!entry.overlay || !entry.overlay.isConnected) {
			cleanupEntry(entry);
		}
	}
}

/** @private */
function resolveInitialFocus(entry, initialFocus) {
	if (initialFocus && entry.isVisible(initialFocus)) return initialFocus;
	const focusables = getFocusable(entry.dialog, entry.isVisible);
	if (focusables.length > 0) return focusables[0];
	// Fallback: focus the dialog shell itself, adding a temporary tabindex only
	// when it has none so we can clean it up on release.
	if (!entry.dialog.hasAttribute('tabindex')) {
		entry.dialog.setAttribute('tabindex', '-1');
		entry.addedTabindex = true;
	}
	return entry.dialog;
}

/**
 * Install focus management for a freshly opened modal dialog: trap Tab within
 * `dialog`, lock body scroll, and (deferred to a microtask) move focus inside.
 *
 * Call after the dialog's content is populated. The returned handles are split
 * so the caller can restore focus *after* removing the overlay:
 * `release()` -> `overlay.remove()` -> `restoreFocus()`.
 *
 * @param {Element} overlay - The backdrop element appended to `document.body`.
 * @param {HTMLElement} dialog - The dialog element inside `overlay`.
 * @param {Object} [options]
 * @param {HTMLElement} [options.initialFocus] - Preferred element to focus on open.
 * @param {(el: Element) => boolean} [options.isVisible] - Visibility predicate (test seam).
 * @returns {{ release: () => void, restoreFocus: () => void }}
 */
export function installDialogFocus(overlay, dialog, { initialFocus, isVisible = defaultIsVisible } = {}) {
	const entry = {
		overlay,
		dialog,
		isVisible,
		trigger: document.activeElement,
		addedTabindex: false,
	};

	let released = false;
	let restored = false;
	let wasTopOnRelease = false;

	stack.push(entry);
	ensureGlobalListener();
	lockScroll();

	// Defer initial focus so dialogs that build content synchronously after
	// install still focus the right element. Bail if the dialog was released,
	// removed, or superseded before the microtask ran.
	Promise.resolve().then(() => {
		if (released || !overlay.isConnected || topEntry() !== entry) return;
		const target = resolveInitialFocus(entry, initialFocus);
		if (target) target.focus();
	});

	function release() {
		if (released) return;
		released = true;
		pruneDisconnectedEntries();
		wasTopOnRelease = topEntry() === entry;
		cleanupEntry(entry);
	}

	function restoreFocus() {
		if (restored) return;
		restored = true;
		if (wasTopOnRelease && entry.trigger && entry.trigger.isConnected) {
			entry.trigger.focus();
		}
	}

	return { release, restoreFocus };
}

/**
 * Whether any modal dialog is currently open. Prunes stale entries first so a
 * dialog removed outside the close path cannot leave a phantom-open state.
 *
 * @returns {boolean}
 */
export function isAnyDialogOpen() {
	pruneDisconnectedEntries();
	return stack.length > 0;
}
