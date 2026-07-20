/**
 * Scatter-plot tooltip and filter interactions.
 *
 * Builds the hover-tooltip content and the click-to-pin tooltip (with the
 * shared categorical filter actions and state badge). The pinned-state
 * bookkeeping (`pinnedIndex`) and circle event wiring stay in the renderer;
 * these closures are stateless with respect to it. DOM is built with
 * `textContent`/`appendChild` and the shared tooltip builders, never with
 * string markup. Used by `renderers/svg.js`.
 */

import {
	buildCategoricalFilterActions,
	createFilterStateBadge,
	createTooltipActionGroup,
	createTooltipLine,
	showChartTooltip,
	showPinnedChartTooltip,
} from '../shared/tooltip/tooltip.js';
import { toCategoryToken } from '../../domain/filters/chartFilter.js';
import { formatNumber, isNullish } from '../../utils/formatters.js';
import { AXIS_TYPE_VALUES } from './axisHelpers.js';

/**
 * Create the hover and pinned tooltip handlers for a scatter render.
 *
 * @param {Object} params
 * @param {{x: string, y: string}} params.axisTypes - Axis-type enum values.
 * @param {{x: string, y: string}} params.axisLabels - Resolved axis label text.
 * @param {Object} params.labels - i18n label bag (index/count).
 * @param {string|undefined} params.locale - Number-format locale.
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
	filterCallbacks,
	xFilterColumn,
	yFilterColumn,
}) {
	const filterLabels = filterCallbacks.filterActionLabels || {};
	const actionLabels = {
		focus: filterLabels.focus || 'Show only this',
		add: filterLabels.add || 'Add to filter',
		exclude: filterLabels.exclude || 'Hide this',
		remove: filterLabels.remove || 'Remove from filter',
		bringBack: filterLabels.bringBack || 'Bring back',
	};

	const buildTooltipContent = point => {
		const wrapper = document.createElement('div');

		const xValue = axisTypes.x === AXIS_TYPE_VALUES.numeric
			? formatNumber(point.x, locale)
			: point.xCategory;
		const yValue = axisTypes.y === AXIS_TYPE_VALUES.numeric
			? formatNumber(point.y, locale)
			: point.yCategory;

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

	const buildAxisActionSet = (column, rawValue, headingLabel) => {
		if (!column || isNullish(rawValue) || rawValue === '') return null;
		const token = toCategoryToken(rawValue);
		const state = typeof filterCallbacks.getTokenFilterState === 'function'
			? filterCallbacks.getTokenFilterState(column, token)
			: null;
		const omitFocus = typeof filterCallbacks.isShowOnlyThisRedundant === 'function'
			? !!filterCallbacks.isShowOnlyThisRedundant(column, token)
			: false;
		const actions = buildCategoricalFilterActions({
			column,
			token,
			state,
			labels: actionLabels,
			omitFocus,
			onFocus: filterCallbacks.onFocusGlobalFilter,
			onAdd: filterCallbacks.onAddToGlobalFilter,
			onExclude: filterCallbacks.onExcludeGlobalFilter,
			onRemove: filterCallbacks.onRemoveFromGlobalFilter,
			onBringBack: filterCallbacks.onBringBackGlobalFilter,
		});
		if (actions.length === 0) return null;
		const wrap = document.createElement('div');
		wrap.className = 'chart-tooltip__action-set-wrap';
		if (headingLabel) {
			const heading = document.createElement('div');
			heading.className = 'chart-tooltip__action-set-label';
			heading.textContent = headingLabel;
			wrap.appendChild(heading);
		}
		wrap.appendChild(createTooltipActionGroup(actions));
		return { node: wrap, state };
	};

	const showPinnedTooltip = (event, point, onDismiss) => {
		const content = buildTooltipContent(point);
		const actionSets = [];
		let primaryState = null;
		let primaryColumn = null;
		let primaryToken = null;

		if (axisTypes.x === AXIS_TYPE_VALUES.categorical && xFilterColumn) {
			const xResult = buildAxisActionSet(xFilterColumn, point.xCategory, `${axisLabels.x}`);
			if (xResult) {
				actionSets.push(xResult.node);
				primaryState = xResult.state;
				primaryColumn = xFilterColumn;
				primaryToken = toCategoryToken(point.xCategory);
			}
		}
		if (axisTypes.y === AXIS_TYPE_VALUES.categorical && yFilterColumn) {
			const yResult = buildAxisActionSet(yFilterColumn, point.yCategory, `${axisLabels.y}`);
			if (yResult) {
				actionSets.push(yResult.node);
				if (!primaryState) {
					primaryState = yResult.state;
					primaryColumn = yFilterColumn;
					primaryToken = toCategoryToken(point.yCategory);
				}
			}
		}

		const stateBadge = actionSets.length === 1 && primaryState
			? createFilterStateBadge({
				state: primaryState,
				includedLabel: filterLabels.stateIncluded,
				excludedLabel: filterLabels.stateExcluded,
			})
			: null;

		const headerTitle = axisTypes.x === AXIS_TYPE_VALUES.categorical
			? String(point.xCategory ?? '')
			: axisTypes.y === AXIS_TYPE_VALUES.categorical
				? String(point.yCategory ?? '')
				: '';

		showPinnedChartTooltip(content, event.pageX, event.pageY, {
			headerTitle,
			closeLabel: filterLabels.close,
			onDismiss,
			actionSets,
			stateBadge,
		});
		// Reference primaryColumn/primaryToken to silence unused-var warnings; they document
		// the per-axis context for future enhancements.
		void primaryColumn;
		void primaryToken;
	};

	return { showTooltip, showPinnedTooltip };
}
