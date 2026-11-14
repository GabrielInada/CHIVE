/**
 * Size a chart to its own container, including narrow dashboard slots. Keep a
 * small drawing floor; containers narrower than that can scroll locally.
 * Hidden containers use the chart's usual fallback until they become visible.
 *
 * @param {HTMLElement} container
 * @param {number} fallback
 * @returns {number}
 */
export function resolveChartWidth(container, fallback) {
	return Math.max(container.clientWidth || fallback, 240);
}
