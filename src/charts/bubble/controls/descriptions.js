/**
 * Bubble controls: the sidebar sections, each control declared once.
 *
 * Data (category, nesting mode, measure, value column, nesting levels,
 * Top-N), Display (title, label mode) and Styling (padding, palette). The
 * shared `buildDescribedControls` builds and wires them; the nesting levels,
 * which no shared widget covers, are written by hand in `customControls.js`.
 *
 * @typedef {import('../../../types.js').ChartControlDescriptions} ChartControlDescriptions
 */

import { BUBBLE_CHART, BUBBLE_DEFINITION } from '../../../config/charts/definitions/bubble.js';
import { measureControl, topNControl, valueColumnControl } from '../../shared/controls/categoryControls.js';
import { buildNestingLevels } from './customControls.js';

/** @type {ChartControlDescriptions} */
export const BUBBLE_CONTROLS = Object.freeze({
	definition: BUBBLE_DEFINITION,
	sections: Object.freeze([
		{
			id: 'data',
			titleKey: 'chive-chart-control-bubble-category',
			expanded: true,
			icon: 'data',
			controls: [
				{
					widget: 'select',
					id: 'viz-select-bubble-category',
					key: 'category',
					label: 'chive-chart-control-bubble-category',
					columns: context => context.baseCategoricalOrAll,
				},
				{
					widget: 'select',
					id: 'viz-select-bubble-nesting-mode',
					key: 'nestingMode',
					label: 'chive-chart-control-bubble-nesting-mode',
					optionLabels: {
						flat: 'chive-chart-control-bubble-nesting-flat',
						grouped: 'chive-chart-control-bubble-nesting-grouped',
					},
				},
				measureControl('viz-select-bubble-measure'),
				valueColumnControl('viz-select-bubble-value-column'),
				{
					widget: 'custom',
					key: 'nestingColumns',
					disabledWhen: config => config.nestingMode !== 'grouped',
					build: buildNestingLevels,
				},
				topNControl({ id: 'viz-select-bubble-topn', label: 'chive-chart-control-bubble-topn', topNOptions: BUBBLE_CHART.topNOptions }),
			],
		},
		{
			id: 'display',
			titleKey: 'chive-chart-control-section-display',
			expanded: true,
			icon: 'display',
			controls: [
				{
					widget: 'text',
					id: 'viz-input-bubble-title',
					key: 'customTitle',
					label: 'chive-chart-control-common-title',
				},
				{
					widget: 'select',
					id: 'viz-select-bubble-label-mode',
					key: 'labelMode',
					label: 'chive-chart-control-bubble-label-mode',
					optionLabels: {
						all: 'chive-chart-control-bubble-label-mode-all',
						hover: 'chive-chart-control-bubble-label-mode-hover',
						auto: 'chive-chart-control-bubble-label-mode-auto',
					},
				},
			],
		},
		{
			id: 'styling',
			titleKey: 'chive-chart-control-section-styling',
			expanded: false,
			icon: 'styling',
			controls: [
				{
					widget: 'slider',
					id: 'viz-slider-bubble-padding',
					key: 'padding',
					label: 'chive-chart-control-bubble-padding',
					min: 1,
					max: 10,
					step: 1,
					value: config => config.padding ?? BUBBLE_CHART.defaultPadding,
				},
				{
					widget: 'palette',
					id: 'viz-bubble-color-preset',
					key: 'colorScheme',
					label: 'chive-chart-color-palette',
					// The bubbles take the palette's colors, so a button stores only its name.
					marked: config => config.colorScheme,
				},
			],
		},
	]),
});
