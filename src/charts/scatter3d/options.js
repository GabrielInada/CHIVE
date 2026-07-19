/**
 * 3D-scatter option normalization.
 *
 * Pure: raw renderer options in, clamped and defaulted values out. The
 * renderer never reads raw config fields directly; everything visual
 * flows through here so the clamps live in one place.
 */

import { CHART_HEIGHT_LIMITS } from '../../config/charts/definitions.js';
import { SCATTER3D_CHART } from '../../config/charts/definitions/scatter3d.js';
import { clamp } from '../../utils/formatters.js';

/**
 * Normalize the scatter3d renderer options.
 *
 * @param {Object} [options]
 * @param {number} [options.chartHeight]
 * @param {number} [options.pointSize]
 * @param {number} [options.opacity]
 * @param {string} [options.color]
 * @param {string} [options.customTitle]
 * @returns {{
 *   chartHeight: number,
 *   pointSize: number,
 *   opacity: number,
 *   color: string,
 *   customTitle: string,
 * }}
 */
export function normalizeScatter3dOptions(options = {}) {
	const heightLimits = CHART_HEIGHT_LIMITS.scatter3d;
	const chartHeight = Number.isFinite(Number(options.chartHeight))
		? clamp(Number(options.chartHeight), heightLimits.min, heightLimits.max)
		: clamp(460, heightLimits.min, heightLimits.max);

	const pointSize = Number.isFinite(Number(options.pointSize))
		? clamp(Number(options.pointSize), SCATTER3D_CHART.minPointSize, SCATTER3D_CHART.maxPointSize)
		: SCATTER3D_CHART.defaultPointSize;

	const opacity = Number.isFinite(Number(options.opacity))
		? clamp(Number(options.opacity), SCATTER3D_CHART.minOpacity, SCATTER3D_CHART.maxOpacity)
		: SCATTER3D_CHART.defaultOpacity;

	const color = typeof options.color === 'string' && options.color.trim() !== ''
		? options.color
		: '#2f6b4f';

	const customTitle = typeof options.customTitle === 'string' ? options.customTitle.trim() : '';

	return { chartHeight, pointSize, opacity, color, customTitle };
}
