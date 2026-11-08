/**
 * Treemap controls: the sidebar sections, each control declared once.
 *
 * Data (category, measure, value column, Top-N), Display (title, padding,
 * labels, values), Styling (color mode, uniform color) and Advanced (palette).
 * The shared `buildDescribedControls` builds and wires them; the treemap
 * squarifies categories by a count or sum measure.
 *
 * @typedef {import('../../../types.js').ChartControlDescriptions} ChartControlDescriptions
 */

import { CHART_COLORS } from '../../../config/charts/definitions.js';
import { TREEMAP_CHART, TREEMAP_DEFINITION } from '../../../config/charts/definitions/treemap.js';
import { measureControl, topNControl, valueColumnControl } from '../../shared/controls/categoryControls.js';
import { findAppliedColorPreset } from '../../shared/controls/factories.js';

/** @type {ChartControlDescriptions} */
export const TREEMAP_CONTROLS = Object.freeze({
	definition: TREEMAP_DEFINITION,
	sections: Object.freeze([
		{
			id: 'data',
			titleKey: 'chive-chart-control-treemap-category',
			expanded: true,
			icon: 'data',
			controls: [
				{
					widget: 'select',
					id: 'viz-select-treemap-category',
					key: 'category',
					label: 'chive-chart-control-treemap-category',
					columns: context => context.baseCategoricalOrAll,
					toValue: value => value || null,
				},
				measureControl('viz-select-treemap-measure'),
				valueColumnControl('viz-select-treemap-value-column'),
				topNControl({ id: 'viz-select-treemap-topn', label: 'chive-chart-control-bar-topn', topNOptions: TREEMAP_CHART.topNOptions }),
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
					id: 'viz-input-treemap-title',
					key: 'customTitle',
					label: 'chive-chart-control-common-title',
				},
				{
					widget: 'slider',
					id: 'viz-slider-treemap-padding',
					key: 'padding',
					label: 'chive-chart-control-treemap-padding',
					min: 1,
					max: 6,
					step: 1,
					value: config => config.padding || TREEMAP_CHART.defaultPadding,
				},
				{
					widget: 'checkbox',
					id: 'viz-toggle-treemap-labels',
					key: 'showLabels',
					label: 'chive-chart-control-treemap-show-labels',
				},
				{
					widget: 'checkbox',
					id: 'viz-toggle-treemap-values',
					key: 'showValues',
					label: 'chive-chart-control-treemap-show-values',
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
					id: 'viz-select-treemap-color-mode',
					key: 'colorMode',
					label: 'chive-chart-color-mode',
					optionLabels: { scheme: 'chive-chart-color-scheme', uniform: 'chive-chart-color-uniform' },
				},
				{
					widget: 'color',
					id: 'viz-input-treemap-color',
					key: 'color',
					label: 'chive-chart-control-bar-color',
					fallback: CHART_COLORS.treemap,
					disabledWhen: config => config.colorMode !== 'uniform',
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
					id: 'viz-treemap-color-preset',
					key: 'colorScheme',
					label: 'chive-chart-color-palette',
					colorKeys: TREEMAP_CHART.presetColorKeys,
					fallbacks: { color: CHART_COLORS.treemap },
					// Scheme mode draws the stored palette. Uniform mode draws the one color a
					// palette button copies in, so that palette counts only until it is edited.
					marked: config => (config.colorMode === 'uniform'
						? findAppliedColorPreset(config, TREEMAP_CHART.presetColorKeys)
						: config.colorScheme),
				},
			],
		},
	]),
});
