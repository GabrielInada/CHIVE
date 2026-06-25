/**
 * Bar-chart color accessor.
 *
 * Builds the per-bar fill function for the three color modes: `uniform` (one
 * color), `gradient` (value- or rank-distributed interpolation between two
 * stops), and `gradient-manual` (two-color split at a percentile threshold).
 * Pure over `colorUtils`; no DOM, no d3. Used by `barChart.js`.
 */

import { interpolateColor, buildRankMap } from '../../../utils/colorUtils.js';

/**
 * Build a `(entry) => colorString` accessor for the bar entries. The entry is
 * the `[category, value]` tuple, identical to what the renderer binds to each
 * rect; `gradient` rank mode keys off tuple identity, so pass the same array
 * references the renderer renders.
 *
 * @param {Object} params
 * @param {Array<[string, number]>} params.entries
 * @param {'uniform'|'gradient'|'gradient-manual'} params.colorMode
 * @param {string} params.color
 * @param {string} params.gradientMinColor
 * @param {string} params.gradientMaxColor
 * @param {'value'|'rank'} params.gradientDistribution
 * @param {number} params.manualThresholdPct
 * @returns {(entry: [string, number]) => string}
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
	const minValor = Math.min(...entries.map(item => item[1]));
	const maxValor = Math.max(...entries.map(item => item[1]));
	const deltaValor = maxValor - minValor || 1;
	const thresholdValue = minValor + (deltaValor * (manualThresholdPct / 100));
	const rankMap = (colorMode === 'gradient' && gradientDistribution === 'rank')
		? buildRankMap(entries, item => item[1])
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
			return interpolateColor(gradientMinColor, gradientMaxColor, (item[1] - minValor) / deltaValor);
		}
		if (colorMode === 'gradient-manual') {
			return item[1] <= thresholdValue ? gradientMinColor : gradientMaxColor;
		}
		return color;
	};
}
