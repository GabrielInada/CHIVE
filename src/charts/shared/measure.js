/**
 * The measure of the bar, pie, treemap and bubble charts: how it is named and
 * whether it reads a value column.
 *
 * Returns i18n keys rather than text, so each caller translates them where it
 * translates its other labels. Any measure other than sum or mean is treated
 * as count, as category aggregation treats it. Pure: no DOM.
 */

const MEASURE_LABEL_KEYS = Object.freeze({
	count: 'chive-tooltip-count',
	sum: 'chive-tooltip-sum',
	mean: 'chive-tooltip-mean',
});

const MEASURE_OPTION_LABEL_KEYS = Object.freeze({
	count: 'chive-chart-control-measure-count',
	sum: 'chive-chart-control-measure-sum',
	mean: 'chive-chart-control-measure-mean',
});

/**
 * @param {string} [measureMode]
 * @returns {'count' | 'sum' | 'mean'}
 */
function resolveMeasure(measureMode) {
	return measureMode === 'sum' || measureMode === 'mean' ? measureMode : 'count';
}

/**
 * The key of the measure label's short form ("Sum"), shown with the numbers:
 * in tooltips and on the bar chart's y axis.
 *
 * @param {string} [measureMode]
 * @returns {string}
 */
export function measureLabelKey(measureMode) {
	return MEASURE_LABEL_KEYS[resolveMeasure(measureMode)];
}

/**
 * The key of the measure label's long form ("Sum numeric column"), shown by
 * the measure select and in Panel capture subtitles.
 *
 * @param {string} [measureMode]
 * @returns {string}
 */
export function measureOptionLabelKey(measureMode) {
	return MEASURE_OPTION_LABEL_KEYS[resolveMeasure(measureMode)];
}

/**
 * Whether the measure reads a numeric value column: true for sum and mean.
 *
 * @param {string} [measureMode]
 * @returns {boolean}
 */
export function measureUsesValueColumn(measureMode) {
	return resolveMeasure(measureMode) !== 'count';
}
