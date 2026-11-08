/**
 * 3D scatter controls: the sidebar sections, each control declared once.
 *
 * Data (the X, Y and Z numeric columns), Display (title, point size,
 * opacity) and Styling (point color). The shared `buildDescribedControls`
 * builds and wires them.
 *
 * @typedef {import('../../../types.js').ChartControlDescriptions} ChartControlDescriptions
 */

import { CHART_COLORS } from '../../../config/charts/definitions.js';
import { SCATTER3D_CHART, SCATTER3D_DEFINITION } from '../../../config/charts/definitions/scatter3d.js';
import { numericAxisControl } from '../../shared/controls/axisControls.js';

/** @type {ChartControlDescriptions} */
export const SCATTER3D_CONTROLS = Object.freeze({
	definition: SCATTER3D_DEFINITION,
	sections: Object.freeze([
		{
			id: 'data',
			title: 'Data',
			expanded: true,
			icon: 'data',
			controls: [
				numericAxisControl({ id: 'viz-select-scatter3d-x', key: 'x', label: 'chive-chart-control-scatter3d-x' }),
				numericAxisControl({ id: 'viz-select-scatter3d-y', key: 'y', label: 'chive-chart-control-scatter3d-y' }),
				numericAxisControl({ id: 'viz-select-scatter3d-z', key: 'z', label: 'chive-chart-control-scatter3d-z' }),
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
					id: 'viz-input-scatter3d-title',
					key: 'customTitle',
					label: 'chive-chart-control-common-title',
				},
				{
					widget: 'slider',
					id: 'viz-slider-scatter3d-point-size',
					key: 'pointSize',
					label: 'chive-chart-control-scatter3d-point-size',
					min: SCATTER3D_CHART.minPointSize,
					max: SCATTER3D_CHART.maxPointSize,
					step: 0.005,
					value: config => config.pointSize ?? SCATTER3D_CHART.defaultPointSize,
				},
				{
					widget: 'slider',
					id: 'viz-slider-scatter3d-opacity',
					key: 'opacity',
					label: 'chive-chart-control-scatter3d-opacity',
					min: SCATTER3D_CHART.minOpacity,
					max: SCATTER3D_CHART.maxOpacity,
					step: 0.05,
					value: config => config.opacity ?? SCATTER3D_CHART.defaultOpacity,
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
					widget: 'color',
					id: 'viz-input-scatter3d-color',
					key: 'color',
					label: 'chive-chart-control-scatter3d-color',
					fallback: CHART_COLORS.scatter3d,
				},
			],
		},
	]),
});
