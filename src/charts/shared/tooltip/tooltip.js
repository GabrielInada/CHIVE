/**
 * Shared chart-tooltip rendering.
 *
 * One persistent tooltip element is appended to `document.body` and
 * reused across all charts via {@link ensureTooltip}. Tooltips have two
 * modes:
 *
 * - **Hover**, `showChartTooltip` + `moveChartTooltip` track the cursor.
 * - **Pinned**, `showPinnedChartTooltip` (or `pinTooltip` after a hover)
 *   sticks the tooltip in place, traps Tab focus, and listens for Escape /
 *   outside-click to dismiss.
 *
 * The pinned shell renders a header with optional title + close button,
 * the chart-provided content, an optional filter-state badge, and grouped
 * action buttons (built via {@link buildCategoricalFilterActions} on the
 * chart side).
 *
 * This module owns the overlay singleton and its lifecycle. The DOM builders
 * live in `content.js` (re-exported below so the public surface stays a
 * single import) and the categorical filter-action defs in
 * `filterActions.js`. Highest-traffic helper in the chart layer, imported
 * by every chart.
 */

import {
	ACTION_CLASS,
	BASE_CLASS,
	CLOSE_CLASS,
	PINNED_CLASS,
} from './classNames.js';
import { buildPinnedShell } from './content.js';

// Re-export the content builders so the public tooltip API stays a single
// import surface. buildPinnedShell stays internal (imported above, not
// re-exported): it is only used by showPinnedChartTooltip.
export {
	createFilterStateBadge,
	createNamedActionGroup,
	createTooltipActionGroup,
	createTooltipExcludeAction,
	createTooltipFilterAction,
	createTooltipLine,
} from './content.js';
export { buildCategoricalFilterActions } from './filterActions.js';

const TOOLTIP_OFFSET = 12;
const VIEWPORT_PADDING = 8;

let tooltipEl;
let pinnedAnchor = null;
let pinnedDismissHandler = null;
let pinnedKeydownHandler = null;
let pinnedDocClickHandler = null;
let latestPosition = null;
let positionFrame = null;
let measuredSize = { width: 0, height: 0 };
let measurementDirty = true;
let resizeListenerInstalled = false;

function onViewportResize() {
	measurementDirty = true;
	schedulePositionWrite();
}

/**
 * Lazily create (or recover) the singleton tooltip element. Re-attaches
 * if a previous element was removed from the DOM (e.g. by full-page
 * re-renders).
 *
 * @private
 * @returns {HTMLElement}
 */
function ensureTooltip() {
	if (tooltipEl && tooltipEl.isConnected) return tooltipEl;

	tooltipEl = document.createElement('div');
	tooltipEl.className = BASE_CLASS;
	tooltipEl.hidden = true;
	tooltipEl.tabIndex = -1;
	measurementDirty = true;
	document.body.appendChild(tooltipEl);
	if (!resizeListenerInstalled) {
		window.addEventListener('resize', onViewportResize);
		resizeListenerInstalled = true;
	}
	return tooltipEl;
}

/** @private */
function clearPinState(el) {
	el.classList.remove(PINNED_CLASS);
	pinnedAnchor = null;
	if (pinnedKeydownHandler) {
		document.removeEventListener('keydown', pinnedKeydownHandler, true);
		pinnedKeydownHandler = null;
	}
	if (pinnedDocClickHandler) {
		document.removeEventListener('mousedown', pinnedDocClickHandler, true);
		pinnedDocClickHandler = null;
	}
	pinnedDismissHandler = null;
}

/**
 * Hide the tooltip and clear any pinned state (focus traps, document
 * listeners). Idempotent.
 *
 * @returns {void}
 */
export function hideChartTooltip() {
	if (!tooltipEl) return;
	clearPinState(tooltipEl);
	if (tooltipEl.isConnected) {
		tooltipEl.hidden = true;
		if (positionFrame !== null) {
			window.cancelAnimationFrame(positionFrame);
			positionFrame = null;
		}
	} else {
		// Node was removed by a full-page re-render; drop the ref so the next
		// ensureTooltip() recreates and re-attaches it.
		tooltipEl = null;
	}
}

/**
 * Show the tooltip with `content` at viewport coordinates `(x, y)`. The
 * content may be a DOM Node (replaces children) or a string
 * (`textContent`).
 *
 * @param {Node | string} content
 * @param {number} x
 * @param {number} y
 * @returns {void}
 */
export function showChartTooltip(content, x, y) {
	const el = ensureTooltip();
	if (content instanceof Node) {
		el.replaceChildren(content);
	} else {
		el.textContent = String(content ?? '');
	}
	measurementDirty = true;
	el.hidden = false;
	moveChartTooltip(x, y);
}

/**
 * Reposition the (already-shown) tooltip to viewport `(x, y)` with
 * automatic viewport clamping: flips to the opposite side when it would
 * overflow right/bottom, then clamps to viewport padding so the tooltip
 * is always fully visible.
 *
 * @param {number} x
 * @param {number} y
 * @returns {void}
 */
export function moveChartTooltip(x, y) {
	ensureTooltip();
	latestPosition = { x, y };
	schedulePositionWrite();
}

function schedulePositionWrite() {
	if (!latestPosition || !tooltipEl || tooltipEl.hidden || positionFrame !== null) return;
	positionFrame = window.requestAnimationFrame(writeTooltipPosition);
}

function writeTooltipPosition() {
	positionFrame = null;
	if (!latestPosition || !tooltipEl || tooltipEl.hidden) return;
	if (measurementDirty) {
		const rect = tooltipEl.getBoundingClientRect();
		measuredSize = { width: rect.width || 0, height: rect.height || 0 };
		measurementDirty = false;
	}
	const vw = typeof window !== 'undefined' ? window.innerWidth : 0;
	const vh = typeof window !== 'undefined' ? window.innerHeight : 0;
	const scrollX = typeof window !== 'undefined' ? window.scrollX : 0;
	const scrollY = typeof window !== 'undefined' ? window.scrollY : 0;
	const { width: w, height: h } = measuredSize;
	const { x, y } = latestPosition;

	let left = x + TOOLTIP_OFFSET;
	let top = y + TOOLTIP_OFFSET;

	if (vw > 0 && w > 0 && (left - scrollX) + w > vw - VIEWPORT_PADDING) {
		left = x - w - TOOLTIP_OFFSET;
	}
	if (vh > 0 && h > 0 && (top - scrollY) + h > vh - VIEWPORT_PADDING) {
		top = y - h - TOOLTIP_OFFSET;
	}

	if (vw > 0 && (left - scrollX) < VIEWPORT_PADDING) {
		left = scrollX + VIEWPORT_PADDING;
	}
	if (vh > 0 && (top - scrollY) < VIEWPORT_PADDING) {
		top = scrollY + VIEWPORT_PADDING;
	}

	tooltipEl.style.left = `${left}px`;
	tooltipEl.style.top = `${top}px`;
}

/** @private */
function getFocusableActions() {
	if (!tooltipEl) return [];
	return Array.from(tooltipEl.querySelectorAll(`button.${ACTION_CLASS}:not([disabled]), button.${CLOSE_CLASS}`));
}

/**
 * Invoke the registered dismiss handler if any; otherwise hide the
 * tooltip outright. The handler is cleared before invocation to prevent
 * recursive dismissal.
 *
 * @private
 */
function dismissPinned() {
	if (typeof pinnedDismissHandler === 'function') {
		const fn = pinnedDismissHandler;
		pinnedDismissHandler = null;
		fn();
		return;
	}
	hideChartTooltip();
}

/**
 * Wire Escape-to-dismiss, Tab focus-trap, and outside-click dismiss on
 * the document. Stored handler references are cleared by
 * {@link clearPinState}.
 *
 * @private
 */
function attachPinnedListeners() {
	pinnedKeydownHandler = (event) => {
		if (event.key === 'Escape') {
			event.preventDefault();
			event.stopPropagation();
			dismissPinned();
			return;
		}
		if (event.key === 'Tab' && tooltipEl) {
			const focusables = getFocusableActions();
			if (focusables.length === 0) return;
			const active = document.activeElement;
			const idx = focusables.indexOf(active);
			if (idx === -1) {
				event.preventDefault();
				focusables[0].focus();
				return;
			}
			const dir = event.shiftKey ? -1 : 1;
			const next = focusables[(idx + dir + focusables.length) % focusables.length];
			event.preventDefault();
			next.focus();
		}
	};
	document.addEventListener('keydown', pinnedKeydownHandler, true);

	pinnedDocClickHandler = (event) => {
		if (!tooltipEl) return;
		if (tooltipEl.contains(event.target)) return;
		dismissPinned();
	};
	document.addEventListener('mousedown', pinnedDocClickHandler, true);
}

/**
 * Pin the (currently shown) tooltip in place. Attaches Escape / Tab /
 * outside-click handlers and optionally moves keyboard focus to the
 * first action button.
 *
 * @param {(() => { x: number, y: number }) | null} anchor - Returns the desired pinned coordinates; used by {@link repositionPinnedTooltip} when the chart re-flows.
 * @param {Object} [options]
 * @param {() => void} [options.onDismiss] - Replaces the default `hideChartTooltip` dismissal.
 * @param {boolean} [options.autoFocus=true] - Set to `false` to keep current focus.
 * @returns {void}
 */
export function pinTooltip(anchor, options = {}) {
	const el = ensureTooltip();
	el.classList.add(PINNED_CLASS);
	pinnedAnchor = typeof anchor === 'function' ? anchor : null;

	if (pinnedKeydownHandler) document.removeEventListener('keydown', pinnedKeydownHandler, true);
	if (pinnedDocClickHandler) document.removeEventListener('mousedown', pinnedDocClickHandler, true);
	pinnedKeydownHandler = null;
	pinnedDocClickHandler = null;
	pinnedDismissHandler = typeof options.onDismiss === 'function' ? options.onDismiss : null;

	attachPinnedListeners();

	if (pinnedAnchor) repositionPinnedTooltip();

	if (options.autoFocus !== false) {
		const focusables = getFocusableActions();
		if (focusables.length > 0) {
			focusables[0].focus({ preventScroll: true });
		}
	}
}

/**
 * Remove pinned state without hiding the tooltip. Removes document
 * listeners but keeps the element visible.
 *
 * @returns {void}
 */
export function unpinTooltip() {
	if (!tooltipEl) return;
	clearPinState(tooltipEl);
}

/**
 * Call after the chart has re-flowed (zoom, drag, layout change) so the
 * pinned tooltip stays anchored. No-op when no anchor was provided.
 *
 * @returns {void}
 */
export function repositionPinnedTooltip() {
	if (!pinnedAnchor) return;
	const point = pinnedAnchor();
	if (!point || typeof point.x !== 'number' || typeof point.y !== 'number') return;
	moveChartTooltip(point.x, point.y);
}

/**
 * True when the tooltip is currently in pinned mode.
 *
 * @returns {boolean}
 */
export function isTooltipPinned() {
	return !!tooltipEl && tooltipEl.classList.contains(PINNED_CLASS);
}

/**
 * Show a pinned tooltip at `(x, y)`: builds the shell + applies pin state
 * in one call. Most charts call this directly after a click rather than
 * combining `showChartTooltip` + `pinTooltip`.
 *
 * @param {Node | string} content
 * @param {number} x
 * @param {number} y
 * @param {Object} [options]
 * @param {string} [options.headerTitle]
 * @param {() => void} [options.onDismiss]
 * @param {() => { x: number, y: number }} [options.anchor]
 * @param {Array<Node>} [options.actionSets]
 * @param {Node | null} [options.stateBadge]
 * @param {string} [options.closeLabel]
 * @returns {void}
 */
export function showPinnedChartTooltip(content, x, y, options = {}) {
	const {
		headerTitle,
		onDismiss,
		anchor,
		actionSets,
		stateBadge,
		closeLabel,
	} = options;
	const shell = buildPinnedShell({
		headerTitle,
		content,
		actionSets,
		stateBadge,
		closeLabel,
		onDismiss,
	});
	showChartTooltip(shell, x, y);
	pinTooltip(anchor || null, { onDismiss });
}
