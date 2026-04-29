const TOOLTIP_OFFSET = 12;
const VIEWPORT_PADDING = 8;
const PINNED_CLASS = 'chart-tooltip--fixado';
const ACTION_CLASS = 'chart-tooltip__action';
const ACTIONS_CLASS = 'chart-tooltip__actions';
const HEADER_CLASS = 'chart-tooltip__header';
const HEADER_TITLE_CLASS = 'chart-tooltip__header-title';
const CLOSE_CLASS = 'chart-tooltip__close';
const DIVIDER_CLASS = 'chart-tooltip__divider';
const STATE_BADGE_CLASS = 'chart-tooltip__filter-state';
const ACTION_GROUP_CLASS = 'chart-tooltip__action-set';

let tooltipEl;
let pinnedAnchor = null;
let pinnedDismissHandler = null;
let pinnedKeydownHandler = null;
let pinnedDocClickHandler = null;

function ensureTooltip() {
	if (tooltipEl && tooltipEl.isConnected) return tooltipEl;

	tooltipEl = document.createElement('div');
	tooltipEl.className = 'chart-tooltip';
	tooltipEl.style.display = 'none';
	tooltipEl.tabIndex = -1;
	document.body.appendChild(tooltipEl);
	return tooltipEl;
}

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

export function hideChartTooltip() {
	const el = ensureTooltip();
	el.style.display = 'none';
	clearPinState(el);
}

export function showChartTooltip(content, x, y) {
	const el = ensureTooltip();
	if (content instanceof Node) {
		el.replaceChildren(content);
	} else {
		el.textContent = String(content ?? '');
	}
	el.style.display = 'block';
	moveChartTooltip(x, y);
}

export function moveChartTooltip(x, y) {
	const el = ensureTooltip();
	const rect = el.getBoundingClientRect();
	const vw = typeof window !== 'undefined' ? window.innerWidth : 0;
	const vh = typeof window !== 'undefined' ? window.innerHeight : 0;
	const scrollX = typeof window !== 'undefined' ? window.scrollX : 0;
	const scrollY = typeof window !== 'undefined' ? window.scrollY : 0;
	const w = rect.width || 0;
	const h = rect.height || 0;

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

	el.style.left = `${left}px`;
	el.style.top = `${top}px`;
}

function getFocusableActions() {
	if (!tooltipEl) return [];
	return Array.from(tooltipEl.querySelectorAll(`button.${ACTION_CLASS}:not([disabled]), button.${CLOSE_CLASS}`));
}

function dismissPinned() {
	if (typeof pinnedDismissHandler === 'function') {
		const fn = pinnedDismissHandler;
		pinnedDismissHandler = null;
		fn();
		return;
	}
	hideChartTooltip();
}

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

export function unpinTooltip() {
	const el = ensureTooltip();
	clearPinState(el);
}

export function repositionPinnedTooltip() {
	if (!pinnedAnchor) return;
	const point = pinnedAnchor();
	if (!point || typeof point.x !== 'number' || typeof point.y !== 'number') return;
	moveChartTooltip(point.x, point.y);
}

export function isTooltipPinned() {
	return ensureTooltip().classList.contains(PINNED_CLASS);
}

export function createTooltipFilterAction({ label, onClick }) {
	return createTooltipAction({ label, onClick });
}

export function createTooltipExcludeAction({ label, onClick }) {
	return createTooltipAction({ label, onClick, variant: 'danger' });
}

function createTooltipAction({ label, onClick, title, variant, disabled, ariaLabel }) {
	const action = document.createElement('button');
	action.type = 'button';
	action.className = variant ? `${ACTION_CLASS} ${ACTION_CLASS}--${variant}` : ACTION_CLASS;
	action.textContent = label;
	if (title) action.title = title;
	action.setAttribute('aria-label', ariaLabel || title || label);
	if (disabled) {
		action.disabled = true;
		action.setAttribute('aria-disabled', 'true');
	}
	action.addEventListener('click', evt => {
		evt.preventDefault();
		evt.stopPropagation();
		if (action.disabled) return;
		if (typeof onClick === 'function') onClick();
	});
	return action;
}

export function createTooltipActionGroup(actions = []) {
	const group = document.createElement('div');
	group.className = ACTIONS_CLASS;
	group.setAttribute('role', 'group');
	const normalizedActions = Array.isArray(actions) ? actions : [];
	for (const actionDef of normalizedActions) {
		if (!actionDef || typeof actionDef.label !== 'string' || actionDef.label.trim().length === 0) {
			continue;
		}
		group.appendChild(createTooltipAction(actionDef));
	}
	return group;
}

function createCloseButton(label, onDismiss) {
	const btn = document.createElement('button');
	btn.type = 'button';
	btn.className = CLOSE_CLASS;
	btn.setAttribute('aria-label', label || 'Close');
	btn.title = label || 'Close';
	btn.textContent = '×';
	btn.addEventListener('click', evt => {
		evt.preventDefault();
		evt.stopPropagation();
		if (typeof onDismiss === 'function') onDismiss();
	});
	return btn;
}

function buildPinnedShell({ headerTitle, content, actionSets, stateBadge, closeLabel, onDismiss }) {
	const wrapper = document.createElement('div');

	if (headerTitle || onDismiss) {
		const header = document.createElement('div');
		header.className = HEADER_CLASS;
		const titleEl = document.createElement('span');
		titleEl.className = HEADER_TITLE_CLASS;
		titleEl.textContent = headerTitle ? String(headerTitle) : '';
		header.appendChild(titleEl);
		if (onDismiss) {
			header.appendChild(createCloseButton(closeLabel, onDismiss));
		}
		wrapper.appendChild(header);
	}

	if (content instanceof Node) {
		wrapper.appendChild(content);
	} else if (typeof content === 'string') {
		const p = document.createElement('div');
		p.textContent = content;
		wrapper.appendChild(p);
	}

	if (stateBadge instanceof Node) {
		wrapper.appendChild(stateBadge);
	}

	const groups = Array.isArray(actionSets) ? actionSets.filter(Boolean) : [];
	if (groups.length > 0) {
		const divider = document.createElement('div');
		divider.className = DIVIDER_CLASS;
		wrapper.appendChild(divider);
		for (const group of groups) {
			if (group instanceof Node) {
				wrapper.appendChild(group);
			}
		}
	}

	return wrapper;
}

export function createFilterStateBadge({ state, includedLabel, excludedLabel }) {
	if (state !== 'included' && state !== 'excluded') return null;
	const badge = document.createElement('div');
	badge.className = `${STATE_BADGE_CLASS} ${STATE_BADGE_CLASS}--${state}`;
	const icon = document.createElement('span');
	icon.className = `${STATE_BADGE_CLASS}-icon`;
	icon.textContent = state === 'included' ? '✓' : '⊘';
	badge.appendChild(icon);
	const text = document.createElement('span');
	text.textContent = state === 'included' ? (includedLabel || 'In filter') : (excludedLabel || 'Excluded');
	badge.appendChild(text);
	return badge;
}

export function createNamedActionGroup(actions, label) {
	const group = createTooltipActionGroup(actions);
	group.classList.add(ACTION_GROUP_CLASS);
	if (label) {
		const heading = document.createElement('div');
		heading.className = `${ACTION_GROUP_CLASS}-label`;
		heading.textContent = label;
		const wrap = document.createElement('div');
		wrap.className = `${ACTION_GROUP_CLASS}-wrap`;
		wrap.appendChild(heading);
		wrap.appendChild(group);
		return wrap;
	}
	return group;
}

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

/**
 * Build the canonical action set for a categorical filter token.
 *
 * @param {Object} params
 * @param {string} params.column - dataset column name
 * @param {string} params.token - already-tokenized value (use toCategoryToken)
 * @param {'included'|'excluded'|null} params.state - current state in the global filter
 * @param {Object} params.labels - localized labels: focus, add, exclude, remove, bringBack
 * @param {Function} [params.onFocus] - (column, token) => void
 * @param {Function} [params.onAdd] - (column, token) => void
 * @param {Function} [params.onExclude] - (column, token) => void
 * @param {Function} [params.onRemove] - (column, token) => void  // remove from include
 * @param {Function} [params.onBringBack] - (column, token) => void  // remove from exclude
 * @returns {Array<HTMLElement>} array of action button elements
 */
export function buildCategoricalFilterActions({ column, token, state, labels = {}, omitFocus = false, onFocus, onAdd, onExclude, onRemove, onBringBack }) {
	const actions = [];
	if (typeof onFocus === 'function' && !omitFocus) {
		actions.push({
			label: labels.focus || 'Show only this',
			variant: 'primary',
			onClick: () => onFocus(column, token),
		});
	}
	if (state === 'included') {
		if (typeof onRemove === 'function') {
			actions.push({
				label: labels.remove || 'Remove from filter',
				onClick: () => onRemove(column, token),
			});
		}
	} else if (state === 'excluded') {
		if (typeof onBringBack === 'function') {
			actions.push({
				label: labels.bringBack || 'Bring back',
				onClick: () => onBringBack(column, token),
			});
		}
	} else {
		if (typeof onAdd === 'function') {
			actions.push({
				label: labels.add || 'Add to filter',
				onClick: () => onAdd(column, token),
			});
		}
		if (typeof onExclude === 'function') {
			actions.push({
				label: labels.exclude || 'Hide this',
				variant: 'danger',
				onClick: () => onExclude(column, token),
			});
		}
	}
	return actions;
}
