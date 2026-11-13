/**
 * Shared scatter-plot presentation flow.
 *
 * Workspace and Panel pass stored config unchanged to the same renderer,
 * alongside presentation-owned text and runtime context. This flow also shows
 * localized empty states on both surfaces.
 * Localized labels stay here so the renderer remains
 * stateless and i18n-free. Column types are forwarded per axis so the
 * renderer can honor explicit numeric/categorical axis decisions, and the
 * data column names double as the click-to-filter columns.
 */

import { getChartCurrencies } from '../shared/currency.js';
import { t, getLocale } from '../../services/i18nService.js';
import { tooltipLabels } from '../shared/tooltip/labels.js';
import { showChartMessage } from '../shared/containerLifecycle.js';
import {
	appendRenderBudgetNotice,
	approveFullRender,
	hasFullRenderApproval,
} from '../shared/renderBudget.js';
import { renderScatterPlot } from './renderers/svg.js';

const EMPTY_FILTER_CALLBACKS = Object.freeze({});

/**
 * Render a scatter plot from a live config block or captured panel snapshot.
 *
 * @param {HTMLElement} container
 * @param {import('../../types.js').ChartInput} input
 * @returns {import('../../types.js').Result}
 */
export function renderScatterInto(container, input) {
	const { rows, config, columnCurrencyByName = {}, columnTypeByName = {}, filterCallbacks = EMPTY_FILTER_CALLBACKS } = input;
	container.querySelector('.chart-render-budget-notice')?.remove();
	const result = renderScatterPlot(container, rows, config, {
		axisLabels: {
			x: config.x || t('chive-chart-control-scatter-x'),
			y: config.y || t('chive-chart-control-scatter-y'),
		},
		axisTypes: {
			x: columnTypeByName[config.x],
			y: columnTypeByName[config.y],
		},
		locale: getLocale(),
		currencies: getChartCurrencies(config, columnCurrencyByName),
		labels: {
			...tooltipLabels(t),
			xAxis: t('chive-chart-control-scatter-x'),
			yAxis: t('chive-chart-control-scatter-y'),
			index: t('chive-tooltip-row'),
			count: t('chive-tooltip-count'),
			regressionSlope: t('chive-chart-tooltip-regression-slope'),
			regressionIntercept: t('chive-chart-tooltip-regression-intercept'),
			regressionR2: t('chive-chart-tooltip-regression-r2'),
			regressionN: t('chive-chart-tooltip-regression-n'),
			regressionGroup: t('chive-chart-tooltip-regression-group'),
		},
		filterCallbacks,
		allowFullRender: hasFullRenderApproval(container, 'scatter'),
	});

	if (result.ok && result.sampled) {
		appendRenderBudgetNotice(container, {
			message: t(
				'chive-chart-scatter-sampling-notice',
				String(result.renderedCount),
				String(result.validCount),
			),
			actionLabel: t('chive-chart-render-full'),
			onApprove: () => {
				approveFullRender(container, 'scatter');
				renderScatterInto(container, input);
			},
		});
	}

	if (!result.ok) {
		const key = result.reason === 'log-no-positive'
			? 'chive-chart-empty-scatter-log'
			: 'chive-chart-empty-scatter';
		showChartMessage(container, t(key));
	}
	return result;
}
