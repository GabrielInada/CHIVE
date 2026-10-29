/**
 * Scatter-plot tooltip and filter interactions.
 *
 * Builds the hover-tooltip content and the click-to-pin tooltip, which offers
 * the shared global-filter actions for each categorical axis. The
 * pinned-state bookkeeping (`pinnedIndex`) and circle event wiring stay in
 * the renderer; these closures are stateless with respect to it. DOM is built
 * with `textContent`/`appendChild` and the shared tooltip builders, never with
 * string markup. Used by `renderers/svg.js`.
 */

import {
	createTooltipLine,
	showChartTooltip,
} from '../shared/tooltip/tooltip.js';
import { showPinnedFilterTooltip } from '../shared/tooltip/filterActions.js';
import { formatNumber } from '../../utils/formatters.js';
import { AXIS_TYPE_VALUES } from './axisHelpers.js';

/**
 * Create the hover and pinned tooltip handlers for a scatter render.
 *
 * @param {Object} params
 * @param {{x: string, y: string}} params.axisTypes - Axis-type enum values.
 * @param {{x: string, y: string}} params.axisLabels - Resolved axis label text.
 * @param {Object} params.labels - i18n label bag (index/count).
 * @param {string|undefined} params.locale - Number-format locale.
 * @param {(key: string) => string} params.categoryLabel - Text shown for a category key.
 * @param {Object} params.filterCallbacks - Click-to-filter callback bag.
 * @param {?string} params.xFilterColumn - X filter column name (from the options bag).
 * @param {?string} params.yFilterColumn - Y filter column name (from the options bag).
 * @returns {{ showTooltip: (event: Object, point: Object) => void, showPinnedTooltip: (event: Object, point: Object, onDismiss: Function) => void }}
 */
export function createScatterInteractions({
	axisTypes,
	axisLabels,
	labels,
	locale,
	categoryLabel,
	filterCallbacks,
	xFilterColumn,
	yFilterColumn,
}) {
	const buildTooltipContent = point => {
		const wrapper = document.createElement('div');

		const xValue = axisTypes.x === AXIS_TYPE_VALUES.numeric
			? formatNumber(point.x, locale)
			: categoryLabel(point.xCategory);
		const yValue = axisTypes.y === AXIS_TYPE_VALUES.numeric
			? formatNumber(point.y, locale)
			: categoryLabel(point.yCategory);

		wrapper.appendChild(createTooltipLine(axisLabels.x, xValue));
		wrapper.appendChild(createTooltipLine(axisLabels.y, yValue));
		if (point.isAggregate) {
			wrapper.appendChild(createTooltipLine(labels.count, formatNumber(point.count, locale)));
		} else {
			wrapper.appendChild(createTooltipLine(labels.index, formatNumber(point.index + 1, locale)));
		}

		return wrapper;
	};

	const showTooltip = (event, point) => {
		showChartTooltip(buildTooltipContent(point), event.pageX, event.pageY);
	};

	const showPinnedTooltip = (event, point, onDismiss) => {
		const categories = [];
		if (axisTypes.x === AXIS_TYPE_VALUES.categorical) {
			categories.push({ column: xFilterColumn, token: point.xCategoryToken, heading: `${axisLabels.x}` });
		}
		if (axisTypes.y === AXIS_TYPE_VALUES.categorical) {
			categories.push({ column: yFilterColumn, token: point.yCategoryToken, heading: `${axisLabels.y}` });
		}

		const headerTitle = axisTypes.x === AXIS_TYPE_VALUES.categorical
			? categoryLabel(point.xCategory)
			: axisTypes.y === AXIS_TYPE_VALUES.categorical
				? categoryLabel(point.yCategory)
				: '';

		showPinnedFilterTooltip(buildTooltipContent(point), event.pageX, event.pageY, {
			headerTitle,
			onDismiss,
			filterCallbacks,
			categories,
		});
	};

	return { showTooltip, showPinnedTooltip };
}
