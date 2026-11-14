/**
 * Choose evenly spaced categorical labels, retaining both ends. This changes
 * only the axis labels; every category remains in the plotted data.
 *
 * @param {Array<*>} values
 * @param {number} width
 * @returns {Array<*>}
 */
export function categoryTickValues(values, width) {
	const count = Math.max(2, Math.floor(width / 64));
	if (values.length <= count) return values;
	return Array.from({ length: count }, (_, index) => values[Math.round(index * (values.length - 1) / (count - 1))]);
}

/** Short axis labels keep their full value in the chart's inspection tooltip. */
export function truncateAxisLabel(value, maxLength = 12) {
	const text = String(value);
	return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}
