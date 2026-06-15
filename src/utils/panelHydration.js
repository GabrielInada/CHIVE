import { mergeChartConfigWithDefaults } from '../config/chartDefaults.js';

/**
 * Re-merge each persisted chart spec against the current chart defaults so
 * old specs absorb any new chart config keys added since they were saved.
 *
 * @param {Object} panel
 * @returns {Object}
 */
export function rehydratePanelChartSpecs(panel) {
	if (!panel || !Array.isArray(panel.charts)) return panel;
	const charts = panel.charts.map(spec => {
		if (!spec || !spec.type) return spec;
		const merged = mergeChartConfigWithDefaults({ [spec.type]: spec.config || {} });
		return { ...spec, config: merged[spec.type] };
	});
	return { ...panel, charts };
}
