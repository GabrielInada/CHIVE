/**
 * The value column a chart keeps for its measure, shared by the bar, pie,
 * treemap and bubble controls.
 *
 * These four charts measure each category by count, sum or mean, and sum and
 * mean read a numeric value column. One rule decides which value column to
 * store: when the user switches the measure, and when the chart is activated.
 * Pure: no DOM.
 */

/**
 * The value column to store with `measureMode`.
 *
 * Count keeps `valueColumn`: its select is disabled in count mode, and
 * switching back to sum or mean finds the user's choice still there. Sum and
 * mean keep `valueColumn` while it is one of `numericOptions`, and otherwise
 * take the first of them, so the chart draws right away. Any other measure is
 * treated as count, as category aggregation treats it.
 *
 * @param {string} measureMode
 * @param {string | null} valueColumn - The stored value column.
 * @param {string[]} numericOptions - Visible numeric column names.
 * @returns {string | null}
 */
export function valueColumnForMeasure(measureMode, valueColumn, numericOptions) {
	if (measureMode !== 'sum' && measureMode !== 'mean') return valueColumn;
	return numericOptions.includes(valueColumn) ? valueColumn : (numericOptions[0] || null);
}
