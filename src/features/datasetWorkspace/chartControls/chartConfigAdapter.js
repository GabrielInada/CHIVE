/**
 * CHIVE chart-config write adapter.
 *
 * Builds the {@link ChartConfigWriter} that a chart package's control listeners
 * write through. This is the only place chart-control writes touch state: the
 * chart packages receive the writer as an argument from the controls registry
 * and never import `state/` themselves, which is what lets the chart-package
 * lint boundary ban state outright.
 *
 * @typedef {import('../../../types.js').Dataset} Dataset
 * @typedef {import('../../../types.js').ChartTypeKey} ChartTypeKey
 * @typedef {import('../../../types.js').ChartConfigWriter} ChartConfigWriter
 */

import { normalizeActiveDatasetConfig, updateActiveDatasetConfig } from '../../../state/appState.js';

/**
 * Create the write surface for one dataset + chart-type pair.
 *
 * `commit` and `preview` deliberately take different paths through the state
 * facades; see {@link ChartConfigWriter} for why. Both callbacks are optional,
 * so a writer built without them is inert rather than a crash.
 *
 * @param {Object} deps
 * @param {Dataset} deps.dataset - Read for the current config block when merging a commit patch.
 * @param {ChartTypeKey} deps.chartKey - Config block this writer owns.
 * @param {(() => void) | null} [deps.onConfigChanged] - Fired after a commit write.
 * @param {(() => void) | null} [deps.requestLiveRender] - Fired after a preview write. Pass the live-preview bridge's `triggerLiveRender`, not a raw render callback, so the registered callback stays replaceable.
 * @returns {ChartConfigWriter}
 */
export function createChartConfigWriter({ dataset, chartKey, onConfigChanged, requestLiveRender }) {
	return {
		commit(patch) {
			updateActiveDatasetConfig({
				[chartKey]: {
					...dataset.chartConfig[chartKey],
					...patch,
				},
			});
			onConfigChanged?.();
		},

		preview(partialUpdate) {
			normalizeActiveDatasetConfig(prev => {
				const currentConfig = prev[chartKey] || {};
				const patch = typeof partialUpdate === 'function'
					? partialUpdate(currentConfig)
					: partialUpdate;
				return {
					...prev,
					[chartKey]: {
						...currentConfig,
						...patch,
					},
				};
			});
			requestLiveRender?.();
		},
	};
}
