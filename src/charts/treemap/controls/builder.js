/**
 * Treemap controls: section builder.
 *
 * Builds the right-sidebar control group for the treemap chart (Data, Display,
 * Styling, Advanced). The treemap squarifies categories by a count/sum measure.
 *
 * @typedef {import('../../../types.js').Dataset} Dataset
 */

import { CHART_COLORS, TREEMAP_CHART } from '../../../config/charts.js';
import { t } from '../../../services/i18nService.js';
import {
	createCheckboxControl,
	createColorInputControl,
	createColorPresetControl,
	createSelectControl,
	createSliderControl,
	createTextControl,
} from '../../../modules/chartControls/shared.js';
import { groupControls } from '../../../modules/chartControls/controlGrouping.js';

/**
 * Build the treemap control sections (Data, Display, Styling, Advanced).
 *
 * @param {Dataset} dataset
 * @param {string[]} categoryOptions - Categorical (or fallback "all") column names for the category select.
 * @param {string[]} [numericOptions=[]] - Numeric column names; populates the sum value-column select.
 * @param {string[]} [_allColumns=[]] - All visible column names; kept for API parity.
 * @returns {HTMLElement[]} Array of `chart-control-section` elements.
 */
export function createTreeMapControls(dataset, categoryOptions, numericOptions = [], _allColumns = []) {
	const config = dataset.chartConfig.treemap;
	const measureMode = TREEMAP_CHART.measureModes.includes(config.measureMode) ? config.measureMode : 'count';
	const valueColumn = numericOptions.includes(config.valueColumn) ? config.valueColumn : null;
	const isDisabled = !config.enabled;

	// ====== DATA SECTION ======
	const dataControls = [];

	dataControls.push(createSelectControl(
		'viz-select-treemap-category',
		t('chive-chart-control-treemap-category'),
		[
			{ value: '', label: t('chive-chart-option-none') },
			...categoryOptions.map(opt => ({ value: opt, label: opt })),
		],
		config.category,
		isDisabled
	));

	dataControls.push(createSelectControl(
		'viz-select-treemap-measure',
		t('chive-chart-control-treemap-measure'),
		[
			{ value: 'count', label: t('chive-chart-control-bar-measure-count') },
			{ value: 'sum', label: t('chive-chart-control-bar-measure-sum') },
		],
		measureMode,
		isDisabled
	));

	dataControls.push(createSelectControl(
		'viz-select-treemap-value-column',
		t('chive-chart-control-treemap-value-column'),
		[
			{ value: '', label: t('chive-chart-option-none') },
			...numericOptions.map(opt => ({ value: opt, label: opt })),
		],
		valueColumn,
		isDisabled || measureMode === 'count'
	));

	dataControls.push(createSelectControl(
		'viz-select-treemap-topn',
		t('chive-chart-control-bar-topn'),
		[
			{ value: '0', label: t('chive-chart-topn-all') },
			{ value: '10', label: 'Top 10' },
			{ value: '20', label: 'Top 20' },
			{ value: '50', label: 'Top 50' },
		],
		String(config.topN),
		isDisabled
	));

	// ====== DISPLAY SECTION ======
	const displayControls = [];

	displayControls.push(createTextControl(
		'viz-input-treemap-title',
		t('chive-chart-control-common-title'),
		config.customTitle,
		80,
		isDisabled
	));

	displayControls.push(createSliderControl(
		'viz-slider-treemap-padding',
		t('chive-chart-control-treemap-padding'),
		Number(config.padding || 2),
		1,
		6,
		1,
		isDisabled
	));

	displayControls.push(createCheckboxControl(
		'viz-toggle-treemap-labels',
		t('chive-chart-control-treemap-show-labels'),
		config.showLabels,
		isDisabled
	));

	displayControls.push(createCheckboxControl(
		'viz-toggle-treemap-values',
		t('chive-chart-control-treemap-show-values'),
		config.showValues,
		isDisabled
	));

	// ====== STYLING SECTION ======
	const stylingControls = [];

	stylingControls.push(createSelectControl(
		'viz-select-treemap-color-mode',
		t('chive-chart-color-mode'),
		[
			{ value: 'scheme', label: t('chive-chart-color-scheme') },
			{ value: 'uniform', label: t('chive-chart-color-uniform') },
		],
		config.colorMode || 'scheme',
		isDisabled
	));

	stylingControls.push(createColorInputControl(
		'viz-input-treemap-color',
		t('chive-chart-control-bar-color'),
		config.color,
		CHART_COLORS.treemap,
		isDisabled || config.colorMode !== 'uniform',
	));

	// ====== ADVANCED SECTION ======
	const advancedControls = [];

	advancedControls.push(createColorPresetControl(
		'viz-treemap-color-preset',
		t('chive-chart-color-palette'),
		config.colorScheme || 'Bold',
		isDisabled
	));

	return groupControls([
		{ id: 'data', title: t('chive-chart-control-treemap-category'), controls: dataControls, expanded: true, icon: 'data' },
		{ id: 'display', title: 'Display', controls: displayControls, expanded: true, icon: 'display' },
		{ id: 'styling', title: 'Styling', controls: stylingControls, expanded: false, icon: 'styling' },
		{ id: 'advanced', title: 'Advanced', controls: advancedControls, expanded: false, icon: 'advanced' },
	]);
}
