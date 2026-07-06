/**
 * Bar-chart controls: section builder.
 *
 * `createBarChartControls` is a thin orchestrator that precomputes one control
 * array per section, then groups them. Each section is built by a
 * module-private helper (`buildDataControls`, `buildDisplayControls`,
 * `buildStylingControls`, `buildAdvancedControls`). Build order matches the
 * rendered section order (Data, Display, Styling, Advanced), so the arrays can
 * be grouped in the same order they are built.
 *
 * @typedef {import('../../../types.js').Dataset} Dataset
 */

import { CHART_COLORS } from '../../../config/charts.js';
import { t } from '../../../services/i18nService.js';
import {
	createCheckboxControl,
	createColorInputControl,
	createColorPresetControl,
	createSelectControl,
	createSliderControl,
	createTextControl,
} from '../shared.js';
import { groupControls } from '../controlGrouping.js';

/**
 * Build the bar-chart control sections (Data, Display, Styling, Advanced).
 *
 * Reads from `dataset.chartConfig.bar`; the resulting elements expose
 * the standard input ids that the bar listeners later attach to.
 *
 * @param {Dataset} dataset
 * @param {string[]} categoryOptions - Categorical (or fallback "all") columns for the X-axis select.
 * @param {string[]} [numericOptions=[]] - Numeric columns for the sum/mean value-column select.
 * @param {string[]} [_allColumns=[]] - All visible column names (kept for API parity; not used here).
 * @returns {HTMLElement[]} Array of `chart-control-section` elements ready to append to the params pane.
 */
export function createBarChartControls(dataset, categoryOptions, numericOptions = [], _allColumns = []) {
	const config = dataset.chartConfig.bar;
	const isDisabled = !config.enabled;

	const dataControls = buildDataControls(config, categoryOptions, numericOptions, isDisabled);
	const displayControls = buildDisplayControls(config, isDisabled);
	const stylingControls = buildStylingControls(config, isDisabled);
	const advancedControls = buildAdvancedControls(config, isDisabled);

	return groupControls([
		{ id: 'data', title: t('chive-chart-control-bar-category'), controls: dataControls, expanded: true, icon: 'data' },
		{ id: 'display', title: 'Display', controls: displayControls, expanded: true, icon: 'display' },
		{ id: 'styling', title: 'Styling', controls: stylingControls, expanded: false, icon: 'styling' },
		{ id: 'advanced', title: 'Advanced', controls: advancedControls, expanded: false, icon: 'advanced' },
	]);
}

/**
 * Data & aggregation section: category, measure mode, value column,
 * sort, and Top-N selects.
 *
 * @param {Object} config - The bar chart config block.
 * @param {string[]} categoryOptions
 * @param {string[]} numericOptions
 * @param {boolean} isDisabled
 * @returns {HTMLElement[]}
 */
function buildDataControls(config, categoryOptions, numericOptions, isDisabled) {
	const measureMode = ['count', 'sum', 'mean'].includes(config.measureMode) ? config.measureMode : 'count';
	const valueColumn = numericOptions.includes(config.valueColumn) ? config.valueColumn : null;

	const dataControls = [];

	// Category select
	const categoryDiv = createSelectControl(
		'viz-select-bar',
		t('chive-chart-control-bar-category'),
		[
			{ value: '', label: t('chive-chart-option-none') },
			...categoryOptions.map(opt => ({ value: opt, label: opt })),
		],
		config.category,
		isDisabled
	);
	dataControls.push(categoryDiv);

	// Measure mode select
	const measureDiv = createSelectControl(
		'viz-select-bar-measure',
		t('chive-chart-control-bar-measure'),
		[
			{ value: 'count', label: t('chive-chart-control-bar-measure-count') },
			{ value: 'sum', label: t('chive-chart-control-bar-measure-sum') },
			{ value: 'mean', label: t('chive-chart-control-bar-measure-mean') },
		],
		measureMode,
		isDisabled
	);
	dataControls.push(measureDiv);

	// Value column select (for sum/mean)
	const valueColDiv = createSelectControl(
		'viz-select-bar-value-column',
		t('chive-chart-control-bar-value-column'),
		[
			{ value: '', label: t('chive-chart-option-none') },
			...numericOptions.map(opt => ({ value: opt, label: opt })),
		],
		valueColumn,
		isDisabled || measureMode === 'count'
	);
	dataControls.push(valueColDiv);

	// Sort order
	const sortDiv = createSelectControl(
		'viz-select-bar-sort',
		t('chive-chart-control-bar-sort'),
		[
			{ value: 'count-desc', label: t('chive-chart-sort-count-desc') },
			{ value: 'count-asc', label: t('chive-chart-sort-count-asc') },
			{ value: 'label-asc', label: t('chive-chart-sort-label-asc') },
			{ value: 'label-desc', label: t('chive-chart-sort-label-desc') },
		],
		config.sort,
		isDisabled
	);
	dataControls.push(sortDiv);

	// Top N
	const topnDiv = createSelectControl(
		'viz-select-bar-topn',
		t('chive-chart-control-bar-topn'),
		[
			{ value: '0', label: t('chive-chart-topn-all') },
			{ value: '10', label: 'Top 10' },
			{ value: '20', label: 'Top 20' },
			{ value: '50', label: 'Top 50' },
		],
		String(config.topN),
		isDisabled
	);
	dataControls.push(topnDiv);

	return dataControls;
}

/**
 * Display section: title, X-axis label, and Y-axis label.
 *
 * @param {Object} config
 * @param {boolean} isDisabled
 * @returns {HTMLElement[]}
 */
function buildDisplayControls(config, isDisabled) {
	const displayControls = [];

	displayControls.push(createTextControl(
		'viz-input-bar-title',
		t('chive-chart-control-common-title'),
		config.customTitle,
		80,
		isDisabled
	));

	displayControls.push(createCheckboxControl(
		'viz-toggle-bar-x-label',
		t('chive-chart-control-axis-label-x'),
		config.showXAxisLabel,
		isDisabled
	));

	displayControls.push(createCheckboxControl(
		'viz-toggle-bar-y-label',
		t('chive-chart-control-axis-label-y'),
		config.showYAxisLabel,
		isDisabled
	));

	return displayControls;
}

/**
 * Styling section: color mode, uniform color, gradient endpoints, and the two
 * conditional controls (gradient distribution for `gradient`, manual threshold
 * for `gradient-manual`).
 *
 * @param {Object} config
 * @param {boolean} isDisabled
 * @returns {HTMLElement[]}
 */
function buildStylingControls(config, isDisabled) {
	const stylingControls = [];

	stylingControls.push(createSelectControl(
		'viz-select-bar-color-mode',
		t('chive-chart-color-mode'),
		[
			{ value: 'uniform', label: t('chive-chart-color-uniform') },
			{ value: 'gradient', label: t('chive-chart-color-gradient') },
			{ value: 'gradient-manual', label: t('chive-chart-color-gradient-manual') },
		],
		config.colorMode,
		isDisabled
	));

	stylingControls.push(createColorInputControl(
		'viz-input-bar-color',
		t('chive-chart-control-bar-color'),
		config.color,
		CHART_COLORS.bar,
		isDisabled || config.colorMode !== 'uniform',
	));

	stylingControls.push(createColorInputControl(
		'viz-input-bar-gradient-min',
		t('chive-chart-color-gradient-min'),
		config.gradientMinColor,
		CHART_COLORS.bar,
		isDisabled || config.colorMode === 'uniform',
	));

	stylingControls.push(createColorInputControl(
		'viz-input-bar-gradient-max',
		t('chive-chart-color-gradient-max'),
		config.gradientMaxColor,
		'#ffffff',
		isDisabled || config.colorMode === 'uniform',
	));

	// Gradient distribution sub-toggle (only for auto gradient mode)
	if (config.colorMode === 'gradient') {
		stylingControls.push(createSelectControl(
			'viz-select-bar-gradient-distribution',
			t('chive-chart-color-gradient-distribution'),
			[
				{ value: 'value', label: t('chive-chart-color-gradient-distribution-value') },
				{ value: 'rank', label: t('chive-chart-color-gradient-distribution-rank') },
			],
			config.gradientDistribution || 'value',
			isDisabled
		));
	}

	// Gradient manual threshold (only for gradient-manual mode)
	if (config.colorMode === 'gradient-manual') {
		stylingControls.push(createSliderControl(
			'viz-slider-bar-threshold',
			t('chive-chart-color-threshold'),
			Number(config.manualThresholdPct || 50),
			0,
			100,
			5,
			isDisabled
		));
	}

	return stylingControls;
}

/**
 * Advanced section: the color-palette preset control.
 *
 * @param {Object} config
 * @param {boolean} isDisabled
 * @returns {HTMLElement[]}
 */
function buildAdvancedControls(config, isDisabled) {
	const advancedControls = [];

	advancedControls.push(createColorPresetControl(
		'viz-bar-color-preset',
		t('chive-chart-color-palette'),
		config.colorScheme || 'Bold',
		isDisabled
	));

	return advancedControls;
}
