/**
 * Network controls: the sidebar sections, each control declared once.
 *
 * Data & Aggregation (source, target, weight and group columns), Display
 * (link distance, zoom, legend, title, node labels, reset zoom), Styling (node
 * radius, link opacity, node colors, edge color mode, palette) and Advanced
 * (the force simulation's charge and alpha decay). The shared
 * `buildDescribedControls` builds and wires them.
 *
 * @typedef {import('../../../types.js').ChartControlDescriptions} ChartControlDescriptions
 */

import { NETWORK_DEFINITION, NETWORK_GRAPH } from '../../../config/charts/definitions/network.js';
import { resetZoomControl } from '../../shared/controls/zoomControls.js';

// Written in place of an invalid node color.
const SOURCE_NODE_FALLBACK = '#e3743d';
const TARGET_NODE_FALLBACK = '#6b94c9';

/** @type {ChartControlDescriptions} */
export const NETWORK_CONTROLS = Object.freeze({
	definition: NETWORK_DEFINITION,
	sections: Object.freeze([
		{
			id: 'data',
			title: 'Data & Aggregation',
			expanded: true,
			icon: 'data',
			controls: [
				{
					widget: 'select',
					id: 'viz-select-network-source',
					key: 'source',
					label: 'chive-chart-control-network-source',
					columns: context => context.allColumns,
				},
				{
					widget: 'select',
					id: 'viz-select-network-target',
					key: 'target',
					label: 'chive-chart-control-network-target',
					columns: context => context.allColumns,
				},
				{
					widget: 'select',
					id: 'viz-select-network-weight',
					key: 'weight',
					label: 'chive-chart-control-network-weight',
					columns: context => context.numeric,
					// "None" stores null.
					toValue: value => value || null,
				},
				{
					widget: 'select',
					id: 'viz-select-network-group',
					key: 'group',
					label: 'chive-chart-control-network-group',
					columns: context => context.categorical,
					toValue: value => value || null,
				},
			],
		},
		{
			id: 'display',
			title: 'Display',
			expanded: true,
			icon: 'display',
			controls: [
				{
					widget: 'slider',
					id: 'viz-slider-network-link-distance',
					key: 'linkDistance',
					label: 'chive-chart-control-network-link-distance',
					min: 20,
					max: 140,
					step: 1,
				},
				{
					widget: 'slider',
					id: 'viz-slider-network-zoom',
					key: 'zoomScale',
					label: 'chive-chart-control-network-zoom',
					min: NETWORK_GRAPH.minZoomScale,
					max: NETWORK_GRAPH.maxZoomScale,
					step: 0.05,
				},
				{
					widget: 'checkbox',
					id: 'viz-toggle-network-show-legend',
					key: 'showLegend',
					label: 'chive-chart-control-network-show-legend',
				},
				{
					widget: 'text',
					id: 'viz-input-network-title',
					key: 'customTitle',
					label: 'chive-chart-control-common-title',
				},
				{
					widget: 'checkbox',
					id: 'viz-toggle-network-node-labels',
					key: 'showNodeLabels',
					label: 'chive-chart-control-network-node-labels',
				},
				resetZoomControl({
					id: 'viz-btn-network-reset-zoom',
					label: 'chive-chart-control-network-reset-zoom',
					sliderId: 'viz-slider-network-zoom',
					zoomScale: NETWORK_GRAPH.defaultZoomScale,
				}),
			],
		},
		{
			id: 'styling',
			title: 'Styling',
			expanded: false,
			icon: 'styling',
			controls: [
				{
					widget: 'slider',
					id: 'viz-slider-network-node-radius',
					key: 'nodeRadius',
					label: 'chive-chart-control-network-node-radius',
					min: 3,
					max: 12,
					step: 1,
				},
				{
					widget: 'slider',
					id: 'viz-slider-network-link-opacity',
					key: 'linkOpacity',
					label: 'chive-chart-control-network-link-opacity',
					min: 0.1,
					max: 1,
					step: 0.05,
				},
				{
					widget: 'color',
					id: 'viz-input-network-source-color',
					key: 'sourceNodeColor',
					label: 'chive-chart-color-source-node',
					fallback: SOURCE_NODE_FALLBACK,
				},
				{
					widget: 'color',
					id: 'viz-input-network-target-color',
					key: 'targetNodeColor',
					label: 'chive-chart-color-target-node',
					fallback: TARGET_NODE_FALLBACK,
				},
				{
					widget: 'select',
					id: 'viz-select-network-edge-color-mode',
					key: 'edgeColorMode',
					label: 'chive-chart-color-mode',
					optionLabels: { gradient: 'chive-chart-color-gradient', uniform: 'chive-chart-color-uniform' },
				},
				{
					widget: 'palette',
					id: 'viz-network-color-preset',
					key: 'colorScheme',
					label: 'chive-chart-color-palette',
					colorKeys: NETWORK_GRAPH.presetColorKeys,
					fallbacks: { sourceNodeColor: SOURCE_NODE_FALLBACK, targetNodeColor: TARGET_NODE_FALLBACK },
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
					widget: 'slider',
					id: 'viz-slider-network-charge',
					key: 'chargeStrength',
					label: 'chive-chart-control-network-charge',
					min: -300,
					max: -20,
					step: 10,
				},
				{
					widget: 'slider',
					id: 'viz-slider-network-alpha-decay',
					key: 'alphaDecay',
					label: 'chive-chart-control-network-alpha-decay',
					min: NETWORK_GRAPH.minAlphaDecay,
					max: NETWORK_GRAPH.maxAlphaDecay,
					step: 0.01,
				},
			],
		},
	]),
});
