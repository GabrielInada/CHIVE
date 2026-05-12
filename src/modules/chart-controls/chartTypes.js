import {
	PREVIEW_BAR_SVG,
	PREVIEW_BUBBLE_SVG,
	PREVIEW_LINE_SVG,
	PREVIEW_NETWORK_SVG,
	PREVIEW_PIE_SVG,
	PREVIEW_SCATTER_SVG,
	PREVIEW_TREEMAP_SVG,
} from './previews.js';

export const CHART_TYPES = ['bar', 'line', 'scatter', 'pie', 'bubble', 'network', 'treemap'];

export const PREVIEW_SVGS = {
	bar: PREVIEW_BAR_SVG,
	scatter: PREVIEW_SCATTER_SVG,
	pie: PREVIEW_PIE_SVG,
	bubble: PREVIEW_BUBBLE_SVG,
	network: PREVIEW_NETWORK_SVG,
	treemap: PREVIEW_TREEMAP_SVG,
	line: PREVIEW_LINE_SVG,
};

export const CATEGORY_KEYS = {
	bar: 'chive-viz-category-comparison',
	scatter: 'chive-viz-category-relationship',
	pie: 'chive-viz-category-composition',
	bubble: 'chive-viz-category-hierarchy',
	network: 'chive-viz-category-relationship',
	treemap: 'chive-viz-category-composition',
	line: 'chive-viz-category-trend',
};
