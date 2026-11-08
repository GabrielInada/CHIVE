/**
 * Tooltip text shared by chart presentation flows. The caller supplies its
 * translator so shared chart infrastructure stays independent of services.
 * Call on every render to follow the current interface language.
 *
 * @param {(key: string) => string} t
 * @returns {Object} Localized close, missing-value, and filter-action labels.
 */
export function tooltipLabels(t) {
	return {
		close: t('chive-tooltip-close'),
		missing: t('chive-chart-filter-missing'),
		filterActions: {
			focus: t('chive-tooltip-show-only-this'),
			add: t('chive-tooltip-add-to-filter'),
			exclude: t('chive-tooltip-exclude'),
			remove: t('chive-tooltip-remove-from-filter'),
			bringBack: t('chive-tooltip-bring-back'),
			stateIncluded: t('chive-tooltip-state-included'),
			stateExcluded: t('chive-tooltip-state-excluded'),
			filterBySource: t('chive-tooltip-filter-by-source'),
			filterByTarget: t('chive-tooltip-filter-by-target'),
		},
	};
}
