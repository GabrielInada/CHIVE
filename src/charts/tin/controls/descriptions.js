/**
 * TIN controls: the sidebar sections, each control declared once.
 *
 * Data (the X, Y and Z numeric columns), Display (title, axis labels),
 * Surface (fill mode, subdivision, color ramp, the custom ramp's gradient
 * colors, distribution and palette) and Overlays (mesh edges, points, Z
 * labels and hull; isolines; the threshold line). The shared
 * `buildDescribedControls` builds and wires them.
 *
 * @typedef {import('../../../types.js').ChartControlDescriptions} ChartControlDescriptions
 */

import { CHART_COLORS } from '../../../config/charts/definitions.js';
import { TIN_CHART, TIN_DEFINITION } from '../../../config/charts/definitions/tin.js';
import { numericAxisControl } from '../../shared/controls/axisControls.js';
import { findAppliedColorPreset } from '../../shared/controls/factories.js';

// The light end of the custom ramp, written in place of an invalid color.
const GRADIENT_MAX_FALLBACK = '#ffffff';

const isCustomRamp = config => config.colorRamp === 'custom';

/** @type {ChartControlDescriptions} */
export const TIN_CONTROLS = Object.freeze({
	definition: TIN_DEFINITION,
	sections: Object.freeze([
		{
			id: 'data',
			titleKey: 'chive-chart-control-section-data',
			expanded: true,
			icon: 'data',
			controls: [
				numericAxisControl({ id: 'viz-select-tin-x', key: 'x', label: 'chive-chart-control-tin-x' }),
				numericAxisControl({ id: 'viz-select-tin-y', key: 'y', label: 'chive-chart-control-tin-y' }),
				numericAxisControl({ id: 'viz-select-tin-z', key: 'z', label: 'chive-chart-control-tin-z' }),
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
					id: 'viz-input-tin-title',
					key: 'customTitle',
					label: 'chive-chart-control-common-title',
				},
				{
					widget: 'checkbox',
					id: 'viz-toggle-tin-x-label',
					key: 'showXAxisLabel',
					label: 'chive-chart-control-axis-label-x',
				},
				{
					widget: 'checkbox',
					id: 'viz-toggle-tin-y-label',
					key: 'showYAxisLabel',
					label: 'chive-chart-control-axis-label-y',
				},
			],
		},
		{
			id: 'surface',
			titleKey: 'chive-chart-control-section-surface',
			expanded: false,
			icon: 'styling',
			controls: [
				{
					widget: 'select',
					id: 'viz-select-tin-fill-mode',
					key: 'fillMode',
					label: 'chive-chart-control-tin-fill-mode',
					optionLabels: { smooth: 'chive-chart-control-tin-fill-smooth', flat: 'chive-chart-control-tin-fill-flat' },
				},
				{
					widget: 'slider',
					id: 'viz-slider-tin-subdivision',
					key: 'subdivisionDepth',
					label: 'chive-chart-control-tin-subdivision',
					min: TIN_CHART.minSubdivisionDepth,
					max: TIN_CHART.maxSubdivisionDepth,
					step: 1,
					value: config => config.subdivisionDepth ?? TIN_CHART.defaultSubdivisionDepth,
					disabledWhen: config => config.fillMode === 'flat',
				},
				{
					widget: 'select',
					id: 'viz-select-tin-color-ramp',
					key: 'colorRamp',
					label: 'chive-chart-color-ramp',
					// A named ramp shows its own name; only the two-color ramp has a message.
					optionText: (ramp, translate) => (ramp === 'custom'
						? translate('chive-chart-color-ramp-custom')
						: ramp.charAt(0).toUpperCase() + ramp.slice(1)),
				},
				{
					widget: 'color',
					id: 'viz-input-tin-gradient-min',
					key: 'gradientMinColor',
					label: 'chive-chart-color-gradient-min',
					fallback: CHART_COLORS.tin,
					disabledWhen: config => !isCustomRamp(config),
				},
				{
					widget: 'color',
					id: 'viz-input-tin-gradient-max',
					key: 'gradientMaxColor',
					label: 'chive-chart-color-gradient-max',
					fallback: GRADIENT_MAX_FALLBACK,
					disabledWhen: config => !isCustomRamp(config),
				},
				{
					widget: 'select',
					id: 'viz-select-tin-gradient-distribution',
					key: 'gradientDistribution',
					label: 'chive-chart-color-gradient-distribution',
					optionLabels: {
						value: 'chive-chart-color-gradient-distribution-value',
						rank: 'chive-chart-color-gradient-distribution-rank',
					},
				},
				{
					widget: 'palette',
					id: 'viz-tin-color-preset',
					key: 'colorScheme',
					label: 'chive-chart-color-palette',
					colorKeys: TIN_CHART.presetColorKeys,
					fallbacks: { gradientMinColor: CHART_COLORS.tin, gradientMaxColor: GRADIENT_MAX_FALLBACK },
					disabledWhen: config => !isCustomRamp(config),
					// A named ramp ignores the gradient colors, so no palette is in use.
					marked: config => (isCustomRamp(config) ? findAppliedColorPreset(config, TIN_CHART.presetColorKeys) : null),
				},
			],
		},
		{
			id: 'overlays',
			titleKey: 'chive-chart-control-section-overlays',
			expanded: false,
			icon: 'advanced',
			// Each overlay's settings are disabled while the overlay is off.
			controls: [
				{
					widget: 'checkbox',
					id: 'viz-toggle-tin-edges',
					key: 'showEdges',
					label: 'chive-chart-control-tin-show-edges',
				},
				{
					widget: 'color',
					id: 'viz-input-tin-edge-color',
					key: 'edgeColor',
					label: 'chive-chart-control-tin-edge-color',
					fallback: TIN_CHART.defaultEdgeColor,
					disabledWhen: config => !config.showEdges,
				},
				{
					widget: 'checkbox',
					id: 'viz-toggle-tin-points',
					key: 'showPoints',
					label: 'chive-chart-control-tin-show-points',
				},
				{
					widget: 'slider',
					id: 'viz-slider-tin-point-radius',
					key: 'pointRadius',
					label: 'chive-chart-control-tin-point-radius',
					min: 1,
					max: 8,
					step: 1,
					value: config => config.pointRadius || TIN_CHART.defaultPointRadius,
					disabledWhen: config => !config.showPoints,
				},
				{
					widget: 'checkbox',
					id: 'viz-toggle-tin-z-labels',
					key: 'showZLabels',
					label: 'chive-chart-control-tin-show-z-labels',
				},
				{
					widget: 'checkbox',
					id: 'viz-toggle-tin-hull',
					key: 'showHull',
					label: 'chive-chart-control-tin-show-hull',
				},
				{
					widget: 'color',
					id: 'viz-input-tin-hull-color',
					key: 'hullColor',
					label: 'chive-chart-control-tin-hull-color',
					fallback: TIN_CHART.defaultHullColor,
					disabledWhen: config => !config.showHull,
				},
				{
					widget: 'checkbox',
					id: 'viz-toggle-tin-isolines',
					key: 'showIsolines',
					label: 'chive-chart-control-tin-show-isolines',
				},
				{
					widget: 'select',
					id: 'viz-select-tin-isoline-mode',
					key: 'isolineMode',
					label: 'chive-chart-control-tin-isoline-mode',
					optionLabels: { count: 'chive-chart-control-tin-isoline-mode-count', step: 'chive-chart-control-tin-isoline-mode-step' },
					disabledWhen: config => !config.showIsolines,
				},
				{
					widget: 'slider',
					id: 'viz-slider-tin-isoline-count',
					key: 'isolineCount',
					label: 'chive-chart-control-tin-isoline-count',
					min: TIN_CHART.minIsolineCount,
					max: TIN_CHART.maxIsolineCount,
					step: 1,
					value: config => config.isolineCount ?? TIN_CHART.defaultIsolineCount,
					disabledWhen: config => !config.showIsolines || config.isolineMode === 'step',
				},
				{
					widget: 'number',
					id: 'viz-input-tin-isoline-step',
					key: 'isolineStep',
					label: 'chive-chart-control-tin-isoline-step',
					min: 0,
					step: 'any',
					fallback: TIN_CHART.defaultIsolineStep,
					// A step that is not positive shows the default.
					value: config => (Number(config.isolineStep) > 0 ? config.isolineStep : TIN_CHART.defaultIsolineStep),
					disabledWhen: config => !config.showIsolines || config.isolineMode === 'count',
				},
				{
					widget: 'color',
					id: 'viz-input-tin-isoline-color',
					key: 'isolineColor',
					label: 'chive-chart-control-tin-isoline-color',
					fallback: TIN_CHART.defaultIsolineColor,
					disabledWhen: config => !config.showIsolines || config.colorIsolinesByZ === true,
				},
				{
					widget: 'slider',
					id: 'viz-slider-tin-isoline-width',
					key: 'isolineWidth',
					label: 'chive-chart-control-tin-isoline-width',
					min: TIN_CHART.minIsolineWidth,
					max: TIN_CHART.maxIsolineWidth,
					step: 0.1,
					value: config => config.isolineWidth ?? TIN_CHART.defaultIsolineWidth,
					disabledWhen: config => !config.showIsolines,
				},
				{
					widget: 'checkbox',
					id: 'viz-toggle-tin-color-isolines-by-z',
					key: 'colorIsolinesByZ',
					label: 'chive-chart-control-tin-color-isolines-by-z',
					disabledWhen: config => !config.showIsolines,
				},
				{
					widget: 'color',
					id: 'viz-input-tin-isoline-min-color',
					key: 'isolineMinColor',
					label: 'chive-chart-control-tin-isoline-min-color',
					fallback: TIN_CHART.defaultIsolineMinColor,
					disabledWhen: config => !config.showIsolines || config.colorIsolinesByZ !== true,
				},
				{
					widget: 'color',
					id: 'viz-input-tin-isoline-max-color',
					key: 'isolineMaxColor',
					label: 'chive-chart-control-tin-isoline-max-color',
					fallback: TIN_CHART.defaultIsolineMaxColor,
					disabledWhen: config => !config.showIsolines || config.colorIsolinesByZ !== true,
				},
				{
					widget: 'checkbox',
					id: 'viz-toggle-tin-isoline-labels',
					key: 'showIsolineLabels',
					label: 'chive-chart-control-tin-show-isoline-labels',
					disabledWhen: config => !config.showIsolines,
				},
				{
					widget: 'slider',
					id: 'viz-slider-tin-isoline-label-size',
					key: 'isolineLabelSize',
					label: 'chive-chart-control-tin-isoline-label-size',
					min: TIN_CHART.minIsolineLabelSize,
					max: TIN_CHART.maxIsolineLabelSize,
					step: 1,
					value: config => config.isolineLabelSize ?? TIN_CHART.defaultIsolineLabelSize,
					disabledWhen: config => !config.showIsolines || !config.showIsolineLabels,
				},
				{
					widget: 'color',
					id: 'viz-input-tin-isoline-label-color',
					key: 'isolineLabelColor',
					label: 'chive-chart-control-tin-isoline-label-color',
					fallback: TIN_CHART.defaultIsolineLabelColor,
					disabledWhen: config => !config.showIsolines || !config.showIsolineLabels,
				},
				{
					widget: 'checkbox',
					id: 'viz-toggle-tin-threshold',
					key: 'showThreshold',
					label: 'chive-chart-control-tin-show-threshold',
				},
				{
					widget: 'number',
					id: 'viz-input-tin-threshold-value',
					key: 'thresholdValue',
					label: 'chive-chart-control-tin-threshold-value',
					step: 'any',
					fallback: TIN_CHART.defaultThresholdValue,
					disabledWhen: config => !config.showThreshold,
				},
				{
					widget: 'color',
					id: 'viz-input-tin-threshold-color',
					key: 'thresholdColor',
					label: 'chive-chart-control-tin-threshold-color',
					fallback: TIN_CHART.defaultThresholdColor,
					disabledWhen: config => !config.showThreshold,
				},
				{
					widget: 'slider',
					id: 'viz-slider-tin-threshold-width',
					key: 'thresholdWidth',
					label: 'chive-chart-control-tin-threshold-width',
					min: TIN_CHART.minThresholdWidth,
					max: TIN_CHART.maxThresholdWidth,
					step: 0.1,
					value: config => config.thresholdWidth ?? TIN_CHART.defaultThresholdWidth,
					disabledWhen: config => !config.showThreshold,
				},
			],
		},
	]),
});
