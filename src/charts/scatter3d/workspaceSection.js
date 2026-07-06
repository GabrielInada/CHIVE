/**
 * 3D-scatter workspace section adapter. Same contract as the
 * `chartRenders/*Section.js` adapters: receives `{ config, rows }`,
 * owns the static block's visibility, and delegates the render plus the
 * localized fail/notice handling to the package's presentation flow.
 */

import { CHART_CONTAINERS, CHART_BLOCKS } from '../../config/elementIds.js';
import { clearChartContainer } from '../../utils/chartContainerLifecycle.js';
import { renderScatter3dInto } from './presentation.js';

/**
 * Render the 3D-scatter section.
 *
 * @param {Object} args
 * @param {Object} args.config
 * @param {Array<Object<string, *>>} args.rows
 * @returns {void}
 */
export function renderScatter3dChartSection({ config, rows }) {
	const block = document.getElementById(CHART_BLOCKS.scatter3d);
	const container = document.getElementById(CHART_CONTAINERS.scatter3d);
	if (!config || !config.enabled) {
		if (block) block.style.display = 'none';
		clearChartContainer(container);
		return;
	}
	if (block) block.style.display = 'block';
	if (!container) return;
	container.style.minHeight = `${Number(config.chartHeight || 460)}px`;
	renderScatter3dInto(container, rows, config);
}
