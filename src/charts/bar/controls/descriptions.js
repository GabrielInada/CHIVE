/**
 * Bar controls: the sidebar sections, each control declared once.
 *
 * Data (category, measure, value column, sort, Top-N), Display (title, axis
 * labels), Styling (color mode, the uniform and gradient colors, and the
 * gradient distribution or manual threshold of the gradient modes) and
 * Advanced (palette). The shared `buildDescribedControls` builds and wires
 * them.
 *
 * @typedef {import('../../../types.js').ChartControlDescriptions} ChartControlDescriptions
 */

import { CHART_COLORS } from '../../../config/charts/definitions.js';
import { BAR_CHART, BAR_DEFINITION } from '../../../config/charts/definitions/bar.js';
import { measureControl, topNControl, valueColumnControl } from '../../shared/controls/categoryControls.js';
import { measureLabelKey } from '../../shared/measure.js';

// The light end of the gradient, written in place of an invalid color.
const GRADIENT_MAX_FALLBACK = '#ffffff';

/** @type {ChartControlDescriptions} */
export const BAR_CONTROLS = Object.freeze({
	definition: BAR_DEFINITION,
	sections: Object.freeze([
		{
			id: 'data',
			titleKey: 'chive-chart-control-bar-category',
			expanded: true,
			icon: 'data',
			controls: [
				{
					widget: 'select',
					id: 'viz-select-bar',
					key: 'category',
					label: 'chive-chart-control-bar-category',
					columns: context => context.baseCategoricalOrAll,
				},
				measureControl('viz-select-bar-measure'),
				valueColumnControl('viz-select-bar-value-column'),
				{
					widget: 'select',
					id: 'viz-select-bar-sort',
					key: 'sort',
					label: 'chive-chart-control-bar-sort',
					optionLabels: {
						'count-desc': 'chive-chart-sort-measure-desc',
						'count-asc': 'chive-chart-sort-measure-asc',
						'label-asc': 'chive-chart-sort-label-asc',
						'label-desc': 'chive-chart-sort-label-desc',
					},
					// The count orders sort by the measure, so their labels name it.
					optionLabelParams: (sort, config, translate) => (sort.startsWith('count-')
						? [translate(measureLabelKey(config.measureMode))]
						: []),
				},
				topNControl({ id: 'viz-select-bar-topn', label: 'chive-chart-control-bar-topn', topNOptions: BAR_CHART.topNOptions }),
			],
		},
		{
			id: 'display',
			title: 'Display',
			expanded: true,
			icon: 'display',
			controls: [
				{
					widget: 'text',
					id: 'viz-input-bar-title',
					key: 'customTitle',
					label: 'chive-chart-control-common-title',
				},
				{
					widget: 'checkbox',
					id: 'viz-toggle-bar-x-label',
					key: 'showXAxisLabel',
					label: 'chive-chart-control-axis-label-x',
				},
				{
					widget: 'checkbox',
					id: 'viz-toggle-bar-y-label',
					key: 'showYAxisLabel',
					label: 'chive-chart-control-axis-label-y',
				},
			],
		},
		{
			id: 'styling',
			title: 'Styling',
			expanded: false,
			icon: 'styling',
			controls: [
				{
					widget: 'select',
					id: 'viz-select-bar-color-mode',
					key: 'colorMode',
					label: 'chive-chart-color-mode',
					optionLabels: {
						uniform: 'chive-chart-color-uniform',
						gradient: 'chive-chart-color-gradient',
						'gradient-manual': 'chive-chart-color-gradient-manual',
					},
				},
				{
					widget: 'color',
					id: 'viz-input-bar-color',
					key: 'color',
					label: 'chive-chart-control-bar-color',
					fallback: CHART_COLORS.bar,
					disabledWhen: config => config.colorMode !== 'uniform',
				},
				{
					widget: 'color',
					id: 'viz-input-bar-gradient-min',
					key: 'gradientMinColor',
					label: 'chive-chart-color-gradient-min',
					fallback: CHART_COLORS.bar,
					disabledWhen: config => config.colorMode === 'uniform',
				},
				{
					widget: 'color',
					id: 'viz-input-bar-gradient-max',
					key: 'gradientMaxColor',
					label: 'chive-chart-color-gradient-max',
					fallback: GRADIENT_MAX_FALLBACK,
					disabledWhen: config => config.colorMode === 'uniform',
				},
				{
					widget: 'select',
					id: 'viz-select-bar-gradient-distribution',
					key: 'gradientDistribution',
					label: 'chive-chart-color-gradient-distribution',
					optionLabels: {
						value: 'chive-chart-color-gradient-distribution-value',
						rank: 'chive-chart-color-gradient-distribution-rank',
					},
					shownWhen: config => config.colorMode === 'gradient',
				},
				{
					widget: 'slider',
					id: 'viz-slider-bar-threshold',
					key: 'manualThresholdPct',
					label: 'chive-chart-color-threshold',
					min: 0,
					max: 100,
					step: 5,
					value: config => Number(config.manualThresholdPct || 50),
					shownWhen: config => config.colorMode === 'gradient-manual',
				},
			],
		},
		{
			id: 'advanced',
			title: 'Advanced',
			expanded: false,
			icon: 'advanced',
			controls: [
				{
					widget: 'palette',
					id: 'viz-bar-color-preset',
					key: 'colorScheme',
					label: 'chive-chart-color-palette',
					colorKeys: BAR_CHART.presetColorKeys,
					fallbacks: {
						color: CHART_COLORS.bar,
						gradientMinColor: CHART_COLORS.bar,
						gradientMaxColor: GRADIENT_MAX_FALLBACK,
					},
				},
			],
		},
	]),
});
