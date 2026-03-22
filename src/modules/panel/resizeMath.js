export function clampPercent(value, min = 20, max = 80) {
	const n = Number(value);
	if (!Number.isFinite(n)) return min;
	return Math.max(min, Math.min(max, n));
}

export function normalizeHexColor(color, fallback = '#5d645d') {
	const value = String(color || '').trim();
	return /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;
}

export function computeDynamicMinHeight(templateId, proportions) {
	const BASE_MIN_HEIGHT = 220;
	const MAX_MIN_HEIGHT = 620;
	const SLOT_MIN_HEIGHT = 96;
	const ROW_GAP = 10;

	let dynamicMinHeight = BASE_MIN_HEIGHT;

	if (templateId === 'layout-1x2') {
		const split = clampPercent(proportions?.split ?? 50, 20, 80) / 100;
		const smallestRow = Math.min(split, 1 - split);
		dynamicMinHeight = ROW_GAP + SLOT_MIN_HEIGHT / Math.max(smallestRow, 0.01);
	} else if (templateId === 'layout-hero2') {
		const splitRight = clampPercent(proportions?.splitRight ?? 50, 20, 80) / 100;
		const smallestRow = Math.min(splitRight, 1 - splitRight);
		dynamicMinHeight = ROW_GAP + SLOT_MIN_HEIGHT / Math.max(smallestRow, 0.01);
	}

	return Math.max(BASE_MIN_HEIGHT, Math.min(dynamicMinHeight, MAX_MIN_HEIGHT));
}
