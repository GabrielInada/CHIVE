/**
 * 3D-scatter option normalization.
 *
 * Pure: raw renderer config in, clamped and defaulted values out. The
 * renderer reads column bindings directly; visual-setting bounds and defaults
 * live here, while presentation supplies text separately.
 */

import { CHART_HEIGHT_LIMITS } from '../../config/charts/definitions.js';
import { SCATTER3D_CHART } from '../../config/charts/definitions/scatter3d.js';
import { clamp } from '../../utils/formatters.js';

/**
 * Normalize the scatter3d renderer config.
 *
 * @param {Object} [config]
 * @param {number} [config.chartHeight]
 * @param {number} [config.pointSize]
 * @param {number} [config.opacity]
 * @param {string} [config.color]
 * @param {string} [config.customTitle]
 * @returns {{
 *   chartHeight: number,
 *   pointSize: number,
 *   opacity: number,
 *   color: string,
 *   customTitle: string,
 * }}
 */
export function normalizeScatter3dOptions(config = {}) {
	const heightLimits = CHART_HEIGHT_LIMITS.scatter3d;
	const chartHeight = Number.isFinite(Number(config.chartHeight))
		? clamp(Number(config.chartHeight), heightLimits.min, heightLimits.max)
		: clamp(460, heightLimits.min, heightLimits.max);

	const pointSize = Number.isFinite(Number(config.pointSize))
		? clamp(Number(config.pointSize), SCATTER3D_CHART.minPointSize, SCATTER3D_CHART.maxPointSize)
		: SCATTER3D_CHART.defaultPointSize;

	const opacity = Number.isFinite(Number(config.opacity))
		? clamp(Number(config.opacity), SCATTER3D_CHART.minOpacity, SCATTER3D_CHART.maxOpacity)
		: SCATTER3D_CHART.defaultOpacity;

	const color = typeof config.color === 'string' && config.color.trim() !== ''
		? config.color
		: '#2f6b4f';

	const customTitle = typeof config.customTitle === 'string' ? config.customTitle.trim() : '';

	return { chartHeight, pointSize, opacity, color, customTitle };
}
