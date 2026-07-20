/**
 * CHIVE chart snapshot metadata.
 *
 * Derives the title and metadata for an "add to panel" snapshot from the active
 * dataset's `chartConfig`. Consumed by the chart-actions workflow when an
 * add-to-panel button is clicked.
 */

import { t } from '../../services/i18nService.js';
import { getActiveDataset } from '../../state/appState.js';
import { CHART_CONTAINERS } from '../../charts/workspaceDomIds.js';

const CONTAINER_ID_TO_CHART_TYPE = Object.fromEntries(
	Object.entries(CHART_CONTAINERS).map(([type, id]) => [id, type])
);

/**
 * Map from `ChartTypeKey` → builder function that derives the snapshot
 * metadata (and a short `summary` string) from the active dataset's
 * `chartConfig`. Consumed by {@link buildChartSnapshotMetadata} when
 * an "add to panel" button is clicked.
 *
 * Each builder returns at minimum `{ type, summary }`; chart-specific
 * builders may include axis bindings or config snapshots used by the
 * panel renderer.
 *
 * @private
 */
const CHART_SNAPSHOT_BUILDERS = {
	bar: (config) => {
		const category = config.bar?.category || '-';
		return {
			type: 'bar',
			summary: `${t('chive-chart-control-bar-category')}: ${category}`,
		};
	},

	scatter: (config) => {
		const x = config.scatter?.x || '-';
		const y = config.scatter?.y || '-';
		return {
			type: 'scatter',
			summary: `X: ${x} · Y: ${y}`,
		};
	},

	pie: (config) => {
		const pie = config.pie || {};
		const measureLabel = pie.measureMode === 'sum'
			? t('chive-chart-control-pie-measure-sum')
			: t('chive-chart-control-pie-measure-count');
		const category = pie.category || '-';
		const valuePart = pie.measureMode === 'sum'
			? ` · ${t('chive-chart-control-pie-value-column')}: ${pie.valueColumn || '-'}`
			: '';
		const padPart = ` · ${t('chive-chart-control-pie-pad-angle')}: ${Number(pie.padAngle || 0)}deg`;
		return {
			type: 'pie',
			measureMode: pie.measureMode,
			valueColumn: pie.valueColumn || null,
			innerRadius: pie.innerRadius,
			outerRadius: pie.outerRadius,
			padAngle: Number(pie.padAngle || 0),
			labelPosition: pie.labelPosition,
			summary: `${t('chive-chart-control-pie-category')}: ${category} · ${measureLabel}${valuePart}${padPart}`,
		};
	},

	bubble: (config) => {
		const bubble = config.bubble || {};
		const measureLabel = bubble.measureMode === 'sum'
			? t('chive-chart-control-bubble-measure-sum')
			: bubble.measureMode === 'mean'
				? t('chive-chart-control-bubble-measure-mean')
				: t('chive-chart-control-bubble-measure-count');
		const category = bubble.category || '-';
		const valuePart = bubble.measureMode === 'count'
			? ''
			: ` · ${t('chive-chart-control-bubble-value-column')}: ${bubble.valueColumn || '-'}`;
		const groupPart = bubble.groupColumn
			? ` · ${t('chive-chart-control-bubble-group')}: ${bubble.groupColumn}`
			: '';
		const topnPart = ` · ${t('chive-chart-control-bubble-topn')}: ${Number(bubble.topN || 0) === 0 ? t('chive-chart-topn-all') : bubble.topN}`;
		return {
			type: 'bubble',
			category,
			measureMode: bubble.measureMode,
			valueColumn: bubble.valueColumn || null,
			groupColumn: bubble.groupColumn || null,
			topN: bubble.topN,
			summary: `${t('chive-chart-control-bubble-category')}: ${category} · ${measureLabel}${valuePart}${groupPart}${topnPart}`,
		};
	},

	network: (config) => {
		const network = config.network || {};
		const source = network.source || '-';
		const target = network.target || '-';
		return {
			type: 'network',
			source,
			target,
			weight: network.weight || null,
			summary: `${t('chive-chart-control-network-source')}: ${source} · ${t('chive-chart-control-network-target')}: ${target}`,
		};
	},

	treemap: (config) => {
		const treemap = config.treemap || {};
		const measureLabel = treemap.measureMode === 'sum'
			? t('chive-chart-control-bar-measure-sum')
			: t('chive-chart-control-bar-measure-count');
		const category = treemap.category || '-';
		const valuePart = treemap.measureMode === 'sum'
			? ` · ${t('chive-chart-control-treemap-value-column')}: ${treemap.valueColumn || '-'}`
			: '';
		return {
			type: 'treemap',
			category,
			measureMode: treemap.measureMode,
			valueColumn: treemap.valueColumn || null,
			topN: treemap.topN,
			summary: `${t('chive-chart-control-treemap-category')}: ${category} · ${measureLabel}${valuePart}`,
		};
	},

	line: (config) => {
		const line = config.line || {};
		const x = line.x || '-';
		const y = line.y || '-';
		return {
			type: 'line',
			x,
			y,
			curve: line.curve || null,
			summary: `${t('chive-chart-control-line-x')}: ${x} · ${t('chive-chart-control-line-y')}: ${y}`,
		};
	},

	tin: (config) => {
		const tin = config.tin || {};
		const x = tin.x || '-';
		const y = tin.y || '-';
		const z = tin.z || '-';
		return {
			type: 'tin',
			x,
			y,
			z,
			summary: `${t('chive-chart-control-tin-x')}: ${x} · ${t('chive-chart-control-tin-y')}: ${y} · ${t('chive-chart-control-tin-z')}: ${z}`,
		};
	},

	scatter3d: (config) => {
		const scatter3d = config.scatter3d || {};
		const x = scatter3d.x || '-';
		const y = scatter3d.y || '-';
		const z = scatter3d.z || '-';
		return {
			type: 'scatter3d',
			x,
			y,
			z,
			summary: `${t('chive-chart-control-scatter3d-x')}: ${x} · ${t('chive-chart-control-scatter3d-y')}: ${y} · ${t('chive-chart-control-scatter3d-z')}: ${z}`,
		};
	},
};

/**
 * Resolve the snapshot title: prefer the user's `customTitle` for the
 * chart type behind `containerId`, falling back to `fallbackTitle`.
 */
export function getChartSnapshotTitle(containerId, fallbackTitle) {
	const type = CONTAINER_ID_TO_CHART_TYPE[containerId];
	if (!type) return fallbackTitle;
	const config = getActiveDataset()?.chartConfig || {};
	return String(config[type]?.customTitle || '').trim() || fallbackTitle;
}

/**
 * Build the metadata object for an `addChartToPanel` call from the
 * active dataset's current config. Returns `{}` when the type or config
 * cannot be resolved.
 */
export function buildChartSnapshotMetadata(containerId) {
	const type = CONTAINER_ID_TO_CHART_TYPE[containerId];
	const config = getActiveDataset()?.chartConfig;
	if (!type || !config) return {};
	const builder = CHART_SNAPSHOT_BUILDERS[type];
	return builder ? builder(config) : {};
}
