import { t, getLocale } from '../../../services/i18nService.js';
import { renderTinChart } from '../../../modules/visualizations/index.js';
import { CHART_CONTAINERS, CHART_BLOCKS } from '../../../config/elementIds.js';
import { showChartMessage } from './sharedRenderHelpers.js';

export function renderTinChartSection({ config, rows }) {
	const block = document.getElementById(CHART_BLOCKS.tin);
	const container = document.getElementById(CHART_CONTAINERS.tin);
	if (!config || !config.enabled) {
		if (block) block.style.display = 'none';
		container?.replaceChildren();
		return;
	}
	if (block) block.style.display = 'block';
	if (!container) return;
	container.style.minHeight = `${Number(config.chartHeight || 460)}px`;
	const result = renderTinChart(
		container,
		rows,
		config.x,
		config.y,
		config.z,
		{
			customTitle: config.customTitle,
			chartHeight: config.chartHeight,
			fillMode: config.fillMode,
			subdivisionDepth: config.subdivisionDepth,
			colorRamp: config.colorRamp,
			gradientMinColor: config.gradientMinColor,
			gradientMaxColor: config.gradientMaxColor,
			gradientDistribution: config.gradientDistribution,
			showEdges: config.showEdges,
			edgeColor: config.edgeColor,
			showPoints: config.showPoints,
			pointRadius: config.pointRadius,
			showZLabels: config.showZLabels,
			showHull: config.showHull,
			hullColor: config.hullColor,
			showIsolines: config.showIsolines,
			isolineMode: config.isolineMode,
			isolineCount: config.isolineCount,
			isolineStep: config.isolineStep,
			isolineColor: config.isolineColor,
			isolineWidth: config.isolineWidth,
			colorIsolinesByZ: config.colorIsolinesByZ,
			isolineMinColor: config.isolineMinColor,
			isolineMaxColor: config.isolineMaxColor,
			showIsolineLabels: config.showIsolineLabels,
			isolineLabelSize: config.isolineLabelSize,
			isolineLabelColor: config.isolineLabelColor,
			showThreshold: config.showThreshold,
			thresholdValue: config.thresholdValue,
			thresholdColor: config.thresholdColor,
			thresholdWidth: config.thresholdWidth,
			showXAxisLabel: config.showXAxisLabel,
			showYAxisLabel: config.showYAxisLabel,
			axisLabels: {
				x: config.x || t('chive-chart-control-tin-x'),
				y: config.y || t('chive-chart-control-tin-y'),
				z: config.z || t('chive-chart-control-tin-z'),
			},
			locale: getLocale(),
		}
	);
	if (!result.ok) {
		const chave = result.reason === 'insufficient-points'
			? 'chive-chart-empty-tin-insufficient-points'
			: 'chive-chart-empty-tin';
		showChartMessage(CHART_CONTAINERS.tin, t(chave));
	}
}
