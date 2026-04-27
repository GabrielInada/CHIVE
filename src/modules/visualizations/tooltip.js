const TOOLTIP_OFFSET = 12;
const VIEWPORT_PADDING = 8;
const PINNED_CLASS = 'chart-tooltip--fixado';
const ACTION_CLASS = 'chart-tooltip__action';

let tooltipEl;
let pinnedAnchor = null;

function ensureTooltip() {
	if (tooltipEl && tooltipEl.isConnected) return tooltipEl;

	tooltipEl = document.createElement('div');
	tooltipEl.className = 'chart-tooltip';
	tooltipEl.style.display = 'none';
	document.body.appendChild(tooltipEl);
	return tooltipEl;
}

function clearPinState(el) {
	el.classList.remove(PINNED_CLASS);
	pinnedAnchor = null;
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

export function pinTooltip(anchor) {
	const el = ensureTooltip();
	el.classList.add(PINNED_CLASS);
	pinnedAnchor = typeof anchor === 'function' ? anchor : null;
	if (pinnedAnchor) repositionPinnedTooltip();
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
	const action = document.createElement('button');
	action.type = 'button';
	action.className = ACTION_CLASS;
	action.textContent = label;
	action.addEventListener('click', evt => {
		evt.stopPropagation();
		if (typeof onClick === 'function') onClick();
	});
	return action;
}
