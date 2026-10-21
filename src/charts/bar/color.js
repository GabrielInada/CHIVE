/**
 * Bar-chart color accessor.
 *
 * Builds the per-bar fill function for the three color modes: `uniform` (one
 * color), `gradient` (value- or rank-distributed interpolation between two
 * stops), and `gradient-manual` (two-color split at a percentile threshold).
 * Pure over `colorUtils`; no DOM, no d3. Used by `renderers/svg.js`.
 */

import { interpolateColor, buildRankMap } from '../../utils/colorUtils.js';

/**
 * Build a `(entry) => colorString` accessor for the bar entries. The entry is
 * the object the renderer binds to each rect; `gradient` rank mode keys off
 * entry identity, so pass the same references the renderer renders.
 *
 * @param {Object} params
 * @param {Array<{ value: number }>} params.entries
 * @param {'uniform'|'gradient'|'gradient-manual'} params.colorMode
 * @param {string} params.color
 * @param {string} params.gradientMinColor
 * @param {string} params.gradientMaxColor
 * @param {'value'|'rank'} params.gradientDistribution
 * @param {number} params.manualThresholdPct
 * @returns {(entry: { value: number }) => string}
 */
export function createBarColorAccessor({
	entries,
	colorMode,
	color,
	gradientMinColor,
	gradientMaxColor,
	gradientDistribution,
	manualThresholdPct,
}) {
	const minValue = Math.min(...entries.map(item => item.value));
	const maxValue = Math.max(...entries.map(item => item.value));
	const valueRange = maxValue - minValue || 1;
	const thresholdValue = minValue + (valueRange * (manualThresholdPct / 100));
	const rankMap = (colorMode === 'gradient' && gradientDistribution === 'rank')
		? buildRankMap(entries, item => item.value)
		: null;
	const rankDenom = Math.max(entries.length - 1, 1);

	return (item) => {
		if (colorMode === 'uniform') return color;
		if (colorMode === 'gradient') {
			if (rankMap) {
				const rank = rankMap.get(item);
				if (rank === undefined) return gradientMinColor;
				return interpolateColor(gradientMinColor, gradientMaxColor, rank / rankDenom);
			}
			return interpolateColor(gradientMinColor, gradientMaxColor, (item.value - minValue) / valueRange);
		}
		if (colorMode === 'gradient-manual') {
			return item.value <= thresholdValue ? gradientMinColor : gradientMaxColor;
		}
		return color;
	};
}
