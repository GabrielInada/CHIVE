/**
 * Pie controls: the sidebar sections, each control declared once.
 *
 * Data & Aggregation (category, measure, value column, Top-N and what it does
 * with the rest), Display (radius, pad angle and zoom sliders, label and
 * legend toggles, title, label position, reset zoom) and Styling (base color,
 * palette, slice colors). The shared `buildDescribedControls` builds and wires
 * them; the controls no shared widget covers are written by hand in
 * `customControls.js`.
 *
 * @typedef {import('../../../types.js').ChartControlDescriptions} ChartControlDescriptions
 */

import { CHART_COLORS } from '../../../config/charts/definitions.js';
import { PIE_CHART, PIE_DEFINITION } from '../../../config/charts/definitions/pie.js';
import { measureControl, topNControl, valueColumnControl } from '../../shared/controls/categoryControls.js';
import { resetZoomControl } from '../../shared/controls/zoomControls.js';
import { buildRadiusSliders, buildSliceColorGrid, buildSlicePalette } from './customControls.js';

/** @type {ChartControlDescriptions} */
export const PIE_CONTROLS = Object.freeze({
	definition: PIE_DEFINITION,
	sections: Object.freeze([
		{
			id: 'data',
			titleKey: 'chive-chart-control-section-data-aggregation',
			expanded: true,
			icon: 'data',
			controls: [
				{
					widget: 'select',
					id: 'viz-select-pie-category',
					key: 'category',
					label: 'chive-chart-control-pie-category',
					columns: context => context.baseCategoricalOrAll,
				},
				measureControl('viz-select-pie-measure'),
				valueColumnControl('viz-select-pie-value-column'),
				{
					...topNControl({ id: 'viz-select-pie-topn', label: 'chive-chart-control-pie-topn', topNOptions: PIE_CHART.topNOptions }),
					// A limit that is not a number shows the default.
					value: config => String(Number.isFinite(Number(config.topN)) ? Number(config.topN) : PIE_CHART.defaultTopN),
				},
				{
					widget: 'select',
					id: 'viz-select-pie-topn-mode',
					key: 'topNMode',
					label: 'chive-chart-control-pie-topn-mode',
					optionLabels: {
						other: 'chive-chart-pie-topn-mode-other',
						truncate: 'chive-chart-pie-topn-mode-truncate',
					},
				},
			],
		},
		{
			id: 'display',
			titleKey: 'chive-chart-control-section-display',
			expanded: true,
			icon: 'display',
			controls: [
				// The inner and outer radius sliders, built together: each clamps the
				// inner radius against the other's position.
				{ widget: 'custom', build: buildRadiusSliders },
				{
					widget: 'slider',
					id: 'viz-slider-pie-pad-angle',
					key: 'padAngle',
					label: 'chive-chart-control-pie-pad-angle',
					min: PIE_CHART.minPadAngle,
					max: PIE_CHART.maxPadAngle,
					step: 0.5,
				},
				{
					widget: 'slider',
					id: 'viz-slider-pie-zoom',
					key: 'zoomScale',
					label: 'chive-chart-control-pie-zoom',
					min: PIE_CHART.minZoomScale,
					max: PIE_CHART.maxZoomScale,
					step: 0.05,
				},
				{
					widget: 'checkbox',
					id: 'viz-toggle-pie-category-label',
					key: 'showCategoryLabel',
					label: 'chive-chart-control-pie-sector-label',
				},
				{
					widget: 'checkbox',
					id: 'viz-toggle-pie-value-label',
					key: 'showValueLabel',
					label: 'chive-chart-control-pie-sector-value',
				},
				{
					widget: 'checkbox',
					id: 'viz-toggle-pie-legend',
					key: 'showLegend',
					label: 'chive-chart-control-pie-show-legend',
				},
				{
					widget: 'text',
					id: 'viz-input-pie-title',
					key: 'customTitle',
					label: 'chive-chart-control-common-title',
				},
				{
					widget: 'select',
					id: 'viz-select-pie-label-position',
					key: 'labelPosition',
					label: 'chive-chart-control-pie-label-position',
					optionLabels: {
						inside: 'chive-chart-control-pie-label-position-inside',
						outside: 'chive-chart-control-pie-label-position-outside',
					},
				},
				resetZoomControl({
					id: 'viz-btn-pie-reset-zoom',
					label: 'chive-chart-control-pie-reset-zoom',
					sliderId: 'viz-slider-pie-zoom',
					zoomScale: PIE_CHART.defaultZoomScale,
				}),
			],
		},
		{
			id: 'styling',
			titleKey: 'chive-chart-control-section-styling',
			expanded: false,
			icon: 'styling',
			controls: [
				{
					widget: 'color',
					id: 'viz-input-pie-color',
					key: 'color',
					label: 'chive-chart-control-pie-color',
					fallback: CHART_COLORS.pie,
				},
				{ widget: 'custom', id: 'viz-pie-color-preset', key: 'colorScheme', build: buildSlicePalette },
				{ widget: 'custom', id: 'viz-pie-color-grid', key: 'customSliceColors', build: buildSliceColorGrid },
			],
		},
	]),
});
