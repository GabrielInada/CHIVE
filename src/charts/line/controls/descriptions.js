/**
 * Line controls: the sidebar sections, each control declared once.
 *
 * Data & Aggregation (X and Y columns, aggregation, X sorting), Styling
 * (curve, missing values, stroke width, line and ghost colors, points) and
 * Display (axis labels, title). The shared `buildDescribedControls` builds and
 * wires them. The X axis takes any visible column, the Y axis a numeric one.
 *
 * @typedef {import('../../../types.js').ChartControlDescriptions} ChartControlDescriptions
 */

import { CHART_COLORS } from '../../../config/charts/definitions.js';
import { LINE_CHART, LINE_DEFINITION } from '../../../config/charts/definitions/line.js';

/** @type {ChartControlDescriptions} */
export const LINE_CONTROLS = Object.freeze({
	definition: LINE_DEFINITION,
	sections: Object.freeze([
		{
			id: 'data',
			title: 'Data & Aggregation',
			expanded: true,
			icon: 'data',
			controls: [
				{
					widget: 'select',
					id: 'viz-select-line-x',
					key: 'x',
					label: 'chive-chart-control-line-x',
					columns: context => context.allColumns,
					// A forged option cannot store a column the dataset does not show.
					toValue: (value, { context }) => (context.allColumns.includes(value) ? value : null),
				},
				{
					widget: 'select',
					id: 'viz-select-line-y',
					key: 'y',
					label: 'chive-chart-control-line-y',
					columns: context => context.numeric,
					// A forged option cannot store a column that is not numeric.
					toValue: (value, { context }) => (context.numeric.includes(value) ? value : null),
				},
				{
					widget: 'select',
					id: 'viz-select-line-aggregate',
					key: 'aggregateMode',
					label: 'chive-chart-control-line-aggregate',
					optionLabels: mode => `chive-chart-line-aggregate-${mode}`,
				},
				{
					widget: 'checkbox',
					id: 'viz-toggle-line-sort-x',
					key: 'sortX',
					label: 'chive-chart-control-line-sort-x',
					// The X values are sorted unless sorting is turned off.
					value: config => config.sortX !== false,
				},
			],
		},
		{
			id: 'styling',
			title: 'Styling',
			expanded: true,
			icon: 'styling',
			controls: [
				{
					widget: 'select',
					id: 'viz-select-line-curve',
					key: 'curve',
					label: 'chive-chart-control-line-curve',
					optionLabels: curve => `chive-chart-line-curve-${curve}`,
				},
				{
					widget: 'select',
					id: 'viz-select-line-missing',
					key: 'missingMode',
					label: 'chive-chart-control-line-missing',
					optionLabels: mode => `chive-chart-line-missing-${mode}`,
				},
				{
					widget: 'slider',
					id: 'viz-slider-line-stroke-width',
					key: 'strokeWidth',
					label: 'chive-chart-control-line-stroke-width',
					min: 0.5,
					max: 6,
					step: 0.5,
					value: config => config.strokeWidth || LINE_CHART.defaultStrokeWidth,
				},
				{
					widget: 'color',
					id: 'viz-input-line-color',
					key: 'color',
					label: 'chive-chart-control-line-color',
					fallback: CHART_COLORS.line,
				},
				{
					widget: 'color',
					id: 'viz-input-line-ghost-color',
					key: 'ghostStrokeColor',
					label: 'chive-chart-control-line-ghost-color',
					fallback: LINE_CHART.defaultGhostStrokeColor,
					// The ghost line bridges gaps only when missing values are interpolated.
					disabledWhen: config => config.missingMode !== 'interpolate',
				},
				{
					widget: 'checkbox',
					id: 'viz-toggle-line-show-points',
					key: 'showPoints',
					label: 'chive-chart-control-line-show-points',
				},
			],
		},
		{
			id: 'display',
			title: 'Display',
			expanded: false,
			icon: 'display',
			controls: [
				{
					widget: 'checkbox',
					id: 'viz-toggle-line-x-label',
					key: 'showXAxisLabel',
					label: 'chive-chart-control-axis-label-x',
				},
				{
					widget: 'checkbox',
					id: 'viz-toggle-line-y-label',
					key: 'showYAxisLabel',
					label: 'chive-chart-control-axis-label-y',
				},
				{
					widget: 'text',
					id: 'viz-input-line-title',
					key: 'customTitle',
					label: 'chive-chart-control-common-title',
				},
			],
		},
	]),
});
