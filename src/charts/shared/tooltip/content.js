/**
 * Chart-tooltip DOM builders.
 *
 * Pure, stateless helpers that construct tooltip content nodes: body rows,
 * action buttons and groups, the pinned-shell wrapper, and the filter-state
 * badge. None of them touch the overlay singleton in `tooltip.js`, so they can
 * be exercised in isolation. All DOM is built with `textContent` / `append` /
 * `appendChild` (no innerHTML), keeping arbitrary user data XSS-safe.
 *
 * Class names come from `classNames.js` so the overlay focus trap keeps
 * matching the buttons these builders emit.
 */

import {
	ACTION_CLASS,
	ACTION_GROUP_CLASS,
	ACTION_GROUP_LABEL_CLASS,
	ACTION_GROUP_WRAP_CLASS,
	ACTIONS_CLASS,
	CLOSE_CLASS,
	DIVIDER_CLASS,
	HEADER_CLASS,
	HEADER_TITLE_CLASS,
	STATE_BADGE_CLASS,
	STATE_BADGE_ICON_CLASS,
} from './classNames.js';

/**
 * Build a single `<div><strong>{label}:</strong> {value}</div>` row used
 * inside chart tooltip bodies. Uses `textContent`/`append` (no innerHTML)
 * so the row is XSS-safe with arbitrary user data.
 *
 * @param {string} label
 * @param {string | number} value
 * @returns {HTMLDivElement}
 */
export function createTooltipLine(label, value) {
	const row = document.createElement('div');
	const strong = document.createElement('strong');
	strong.textContent = `${label}:`;
	row.appendChild(strong);
	row.append(` ${value}`);
	return row;
}

/**
 * Build a primary (default-style) filter action button.
 *
 * @param {{ label: string, onClick: () => void }} args
 * @returns {HTMLButtonElement}
 */
export function createTooltipFilterAction({ label, onClick }) {
	return createTooltipAction({ label, onClick });
}

/**
 * Build a danger-style exclude action button.
 *
 * @param {{ label: string, onClick: () => void }} args
 * @returns {HTMLButtonElement}
 */
export function createTooltipExcludeAction({ label, onClick }) {
	return createTooltipAction({ label, onClick, variant: 'danger' });
}

/** @private */
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

/**
 * Build a `<div role="group">` wrapping a series of action buttons. Each
 * `actionDef` is `{ label, onClick, title?, variant?, disabled?, ariaLabel? }`.
 * Entries with empty/whitespace `label` are skipped.
 *
 * @param {Array<Object>} [actions=[]]
 * @returns {HTMLDivElement}
 */
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

/** @private */
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

/**
 * Compose the pinned tooltip's DOM shell: header + body + state badge +
 * action groups (separated by a divider). Exported for the overlay core's
 * `showPinnedChartTooltip`; it is not part of the public tooltip surface.
 *
 * @param {Object} args
 * @param {string} [args.headerTitle]
 * @param {Node | string} [args.content]
 * @param {Array<Node>} [args.actionSets]
 * @param {Node | null} [args.stateBadge]
 * @param {string} [args.closeLabel]
 * @param {() => void} [args.onDismiss]
 * @returns {HTMLDivElement}
 */
export function buildPinnedShell({ headerTitle, content, actionSets, stateBadge, closeLabel, onDismiss }) {
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

/**
 * Build the "included"/"excluded" badge shown inside pinned tooltips when
 * the token participates in the global filter. Returns `null` (no badge)
 * for any other state.
 *
 * @param {{ state: 'included' | 'excluded' | null, includedLabel?: string, excludedLabel?: string }} args
 * @returns {HTMLDivElement | null}
 */
export function createFilterStateBadge({ state, includedLabel, excludedLabel }) {
	if (state !== 'included' && state !== 'excluded') return null;
	const badge = document.createElement('div');
	badge.className = `${STATE_BADGE_CLASS} ${STATE_BADGE_CLASS}--${state}`;
	const icon = document.createElement('span');
	icon.className = STATE_BADGE_ICON_CLASS;
	icon.textContent = state === 'included' ? '✓' : '⊘';
	badge.appendChild(icon);
	const text = document.createElement('span');
	text.textContent = state === 'included' ? (includedLabel || 'In filter') : (excludedLabel || 'Excluded');
	badge.appendChild(text);
	return badge;
}

/**
 * Build an action group with an optional label heading above it. Without
 * a label, behaves identically to {@link createTooltipActionGroup}.
 *
 * @param {Array<Object>} actions
 * @param {string} [label]
 * @returns {HTMLElement}
 */
export function createNamedActionGroup(actions, label) {
	const group = createTooltipActionGroup(actions);
	group.classList.add(ACTION_GROUP_CLASS);
	if (label) {
		const heading = document.createElement('div');
		heading.className = ACTION_GROUP_LABEL_CLASS;
		heading.textContent = label;
		const wrap = document.createElement('div');
		wrap.className = ACTION_GROUP_WRAP_CLASS;
		wrap.appendChild(heading);
		wrap.appendChild(group);
		return wrap;
	}
	return group;
}
