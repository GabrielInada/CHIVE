import { mergeChartConfigWithDefaults } from '../charts/chartConfig.js';

/**
 * Re-merge each persisted Panel snapshot's config against the current chart
 * defaults so old snapshots absorb any config keys added since they were saved.
 *
 * @param {Object} panel
 * @returns {Object}
 */
export function mergePanelSnapshotConfigsWithDefaults(panel) {
	if (!panel || !Array.isArray(panel.charts)) return panel;
	const charts = panel.charts.map(snapshot => {
		if (!snapshot || !snapshot.type) return snapshot;
		const merged = mergeChartConfigWithDefaults({ [snapshot.type]: snapshot.config || {} });
		return { ...snapshot, config: merged[snapshot.type] };
	});
	return { ...panel, charts };
}
