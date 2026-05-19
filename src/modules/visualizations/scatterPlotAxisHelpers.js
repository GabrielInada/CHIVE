import { compareStrings, normalizeCategoryValue } from '../../utils/chartFilters.js';

export const AXIS_TYPE_VALUES = {
	numeric: 'numeric',
	categorical: 'categorical',
};

export function isNumericLikeAxisType(axisType) {
	const value = String(axisType || '').toLowerCase();
	return value === 'numeric' || value === 'number' || value === 'numero';
}

export function isCategoricalLikeAxisType(axisType) {
	const value = String(axisType || '').toLowerCase();
	return value === 'categorical' || value === 'category' || value === 'text' || value === 'texto' || value === 'date' || value === 'data';
}

export function inferAxisType(axisValues, configuredAxisType) {
	if (isNumericLikeAxisType(configuredAxisType)) return AXIS_TYPE_VALUES.numeric;
	if (isCategoricalLikeAxisType(configuredAxisType)) return AXIS_TYPE_VALUES.categorical;

	const validValues = axisValues
		.filter(value => value !== null && value !== undefined && String(value).trim() !== '');
	if (validValues.length === 0) return AXIS_TYPE_VALUES.categorical;

	const numericCount = validValues
		.filter(value => Number.isFinite(Number(value)))
		.length;

	return (numericCount / validValues.length) >= 0.8
		? AXIS_TYPE_VALUES.numeric
		: AXIS_TYPE_VALUES.categorical;
}

export function deterministicJitter(index, axisSeed) {
	const raw = Math.sin((index + 1) * 12.9898 * axisSeed) * 43758.5453123;
	const fraction = raw - Math.floor(raw);
	return (fraction * 2) - 1;
}

export function buildCategoryDomain(pontos, key) {
	const seen = new Set();
	const domain = [];
	pontos.forEach(ponto => {
		const value = ponto[key];
		if (seen.has(value)) return;
		seen.add(value);
		domain.push(value);
	});
	return domain;
}

export function buildCategoryJitterScale(scale, maxJitterCap = 16) {
	const baseStep = Number.isFinite(scale?.step?.()) ? scale.step() : 0;
	const jitterMax = Math.max(0, Math.min(maxJitterCap, baseStep * 0.24));
	return (index, axisSeed) => deterministicJitter(index, axisSeed) * jitterMax;
}

export function truncateCategoryTick(value, maxLength = 20) {
	const text = String(value);
	if (text.length <= maxLength) return text;
	return `${text.slice(0, Math.max(1, maxLength - 1))}…`;
}

export function estimateLongestCategoryLength(points, key) {
	return points.reduce((maxLength, point) => Math.max(maxLength, String(point[key] || '').length), 0);
}

export function computeAdaptiveMargins(baseMargins, points, axisTypes) {
	const margins = { ...baseMargins };

	if (axisTypes.y === AXIS_TYPE_VALUES.categorical) {
		const maxYLength = estimateLongestCategoryLength(points, 'yCategory');
		const estimatedLeft = 28 + (Math.min(maxYLength, 64) * 6.8);
		margins.left = Math.max(baseMargins.left, Math.min(340, Math.round(estimatedLeft)));
	}

	if (axisTypes.x === AXIS_TYPE_VALUES.categorical) {
		const maxXLength = estimateLongestCategoryLength(points, 'xCategory');
		const estimatedBottom = 48 + (Math.min(maxXLength, 52) * 4.2);
		margins.bottom = Math.max(baseMargins.bottom, Math.min(250, Math.round(estimatedBottom)));
	}

	return margins;
}

export function aggregateCategoricalPairs(points) {
	const groups = new Map();

	points.forEach(point => {
		const key = `${point.xCategory}${point.yCategory}`;
		if (!groups.has(key)) {
			groups.set(key, {
				...point,
				isAggregate: true,
				count: 0,
				rawRows: [],
			});
		}

		const group = groups.get(key);
		group.count += 1;
		group.rawRows.push(point.raw);

		if (point.index < group.index) {
			group.index = point.index;
			group.raw = point.raw;
		}
	});

	return Array.from(groups.values());
}

export function pickMostFrequentCategory(rows, fieldName) {
	const categoryCount = new Map();

	rows.forEach(row => {
		const category = normalizeCategoryValue(row?.[fieldName]);
		categoryCount.set(category, (categoryCount.get(category) || 0) + 1);
	});

	let bestCategory = '—';
	let bestCount = -1;
	for (const [category, count] of categoryCount.entries()) {
		if (count > bestCount) {
			bestCategory = category;
			bestCount = count;
			continue;
		}
		if (count === bestCount && compareStrings(category, bestCategory) < 0) {
			bestCategory = category;
		}
	}

	return bestCategory;
}

export function normalizarDominio([minimo, maximo]) {
	if (!Number.isFinite(minimo) || !Number.isFinite(maximo)) return [0, 1];
	if (minimo === maximo) {
		const delta = minimo === 0 ? 1 : Math.abs(minimo * 0.1);
		return [minimo - delta, maximo + delta];
	}
	return [minimo, maximo];
}
