/**
 * CHIVE category chart control descriptions.
 *
 * The measure, value-column and Top-N selects that the category charts (bar,
 * pie, treemap and bubble) share, as control descriptions for
 * `buildDescribedControls`. Each chart passes its own ids, which the sidebar
 * restores focus and scroll by.
 *
 * Shared leaf infrastructure: labels are message keys.
 *
 * @typedef {import('../../../types.js').ControlDescription} ControlDescription
 */

import { measureOptionLabelKey, measureUsesValueColumn, valueColumnForMeasure } from '../measure.js';
import { topNSelectOptions } from './factories.js';

/**
 * The measure select, offering the measures the chart definition lists. A
 * change also writes the value column the new measure keeps.
 *
 * @param {string} id
 * @returns {ControlDescription}
 */
export function measureControl(id) {
	return {
		widget: 'select',
		id,
		key: 'measureMode',
		label: 'chive-chart-control-measure',
		optionLabels: measureOptionLabelKey,
		// Count keeps the stored value column, so switching back to sum or mean
		// restores it.
		toPatch: (measureMode, { config, context }) => ({
			measureMode,
			valueColumn: valueColumnForMeasure(measureMode, config.valueColumn, context.numeric),
		}),
	};
}

/**
 * The value-column select: "None" and the visible numeric columns, disabled
 * while the measure counts rows.
 *
 * @param {string} id
 * @returns {ControlDescription}
 */
export function valueColumnControl(id) {
	return {
		widget: 'select',
		id,
		key: 'valueColumn',
		label: 'chive-chart-control-value-column',
		columns: context => context.numeric,
		disabledWhen: config => !measureUsesValueColumn(config.measureMode),
		// A forged option cannot store a column the measure cannot read.
		toValue: (value, { context }) => (context.numeric.includes(value) ? value : null),
	};
}

/**
 * The Top-N select: "All" for 0 and "Top N" for each other limit the chart
 * definition lists. The limit is stored as a number.
 *
 * @param {Object} options
 * @param {string} options.id
 * @param {string} options.label - Message key of the label.
 * @param {number[]} options.topNOptions - The limits the chart definition lists.
 * @returns {ControlDescription}
 */
export function topNControl({ id, label, topNOptions }) {
	return {
		widget: 'select',
		id,
		key: 'topN',
		label,
		options: (context, translate) => topNSelectOptions(topNOptions, translate('chive-chart-topn-all')),
		toValue: Number,
	};
}
