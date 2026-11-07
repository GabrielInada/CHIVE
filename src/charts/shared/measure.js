/**
 * The measure of the bar, pie, treemap and bubble charts: how it is named,
 * whether it reads a value column, and which value column it keeps.
 *
 * Names come back as i18n keys rather than text, so each caller translates
 * them where it translates its other labels. Any measure other than sum or
 * mean is treated as count, as category aggregation treats it. Pure: no DOM.
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

/**
 * The value column to store with `measureMode`, both when the user switches
 * the measure and when the chart is activated.
 *
 * Count keeps `valueColumn`: its select is disabled under count, and
 * switching back to sum or mean finds the user's choice still there. Sum and
 * mean keep `valueColumn` while it is one of `numericOptions`, and otherwise
 * take the first of them, so the chart draws right away.
 *
 * @param {string} [measureMode]
 * @param {string | null} valueColumn - The stored value column.
 * @param {string[]} numericOptions - Visible numeric column names.
 * @returns {string | null}
 */
export function valueColumnForMeasure(measureMode, valueColumn, numericOptions) {
	if (!measureUsesValueColumn(measureMode)) return valueColumn;
	return numericOptions.includes(valueColumn) ? valueColumn : (numericOptions[0] || null);
}
