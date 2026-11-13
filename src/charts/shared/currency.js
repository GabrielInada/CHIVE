import { measureUsesValueColumn } from './measure.js';
import { formatNumber } from '../../utils/formatters.js';

/** Resolve monetary units from the actual fields used by a chart. Counts have no currency. */
export function getChartCurrencies(config, columnCurrencyByName = {}) {
	const currencyOf = name => Object.hasOwn(columnCurrencyByName, name) ? columnCurrencyByName[name] : undefined;
	return {
		x: currencyOf(config.x),
		y: config.aggregateMode === 'count' ? undefined : currencyOf(config.y),
		z: currencyOf(config.z),
		category: currencyOf(config.category),
		weight: currencyOf(config.weight),
		nesting: (Array.isArray(config.nestingColumns) ? config.nestingColumns : [config.groupColumn]).map(currencyOf),
		measure: measureUsesValueColumn(config.measureMode) ? currencyOf(config.valueColumn) : undefined,
	};
}

/** Format a numeric category label without changing its grouping or filter key. */
export function formatCurrencyCategory(label, currency, locale) {
	return currency && label !== '' && Number.isFinite(Number(label))
		? formatNumber(Number(label), locale, currency) : label;
}

/** Reserve space for full currency ticks and the vertical axis title. */
export function currencyAxisMargin(base, values, currency, locale) {
	if (!currency) return base;
	let length = 0;
	for (const value of values) {
		if (Number.isFinite(value)) length = Math.max(length, formatNumber(value, locale, currency).length);
	}
	return Math.max(base, length * 7 + 32);
}
