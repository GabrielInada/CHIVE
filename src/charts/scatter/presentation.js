/**
 * Shared scatter-plot presentation flow.
 *
 * Workspace and panel integrations both map their config into the same SVG
 * renderer contract. This flow also shows localized empty states on both surfaces.
 * Localized labels stay here so the renderer remains
 * stateless and i18n-free. Column types are forwarded per axis so the
 * renderer can honor explicit numeric/categorical axis decisions, and the
 * data column names double as the click-to-filter columns.
 */

import { t, getLocale } from '../../services/i18nService.js';
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
	const { rows, config, columnTypeByName = {}, filterCallbacks = EMPTY_FILTER_CALLBACKS } = input;
	container.querySelector('.chart-render-budget-notice')?.remove();
	const result = renderScatterPlot(container, rows, config.x, config.y, {
		customTitle: config.customTitle,
		chartHeight: config.chartHeight,
		xScale: config.xScale,
		yScale: config.yScale,
		radius: config.radius,
		opacity: config.opacity,
		sizeMode: config.sizeMode,
		sizeField: config.sizeField,
		sizeMin: config.sizeMin,
		sizeMax: config.sizeMax,
		color: config.color,
		colorMode: config.colorMode,
		colorField: config.colorField,
		gradientMinColor: config.gradientMinColor,
		gradientMaxColor: config.gradientMaxColor,
		gradientDistribution: config.gradientDistribution,
		colorScheme: config.colorScheme,
		categoricalPairMode: config.categoricalPairMode,
		showXAxisLabel: config.showXAxisLabel,
		showYAxisLabel: config.showYAxisLabel,
		regression: config.regression,
		axisLabels: {
			x: config.x || t('chive-chart-control-scatter-x'),
			y: config.y || t('chive-chart-control-scatter-y'),
		},
		axisTypes: {
			x: columnTypeByName[config.x],
			y: columnTypeByName[config.y],
		},
		locale: getLocale(),
		labels: {
			close: t('chive-tooltip-close'),
			xAxis: t('chive-chart-control-scatter-x'),
			yAxis: t('chive-chart-control-scatter-y'),
			index: t('chive-tooltip-row'),
			count: t('chive-tooltip-count'),
			regressionSlope: t('chive-chart-tooltip-regression-slope'),
			regressionIntercept: t('chive-chart-tooltip-regression-intercept'),
			regressionR2: t('chive-chart-tooltip-regression-r2'),
			regressionN: t('chive-chart-tooltip-regression-n'),
			regressionGroup: t('chive-chart-tooltip-regression-group'),
			missing: t('chive-chart-filter-missing'),
		},
		xColumn: config.x,
		yColumn: config.y,
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
