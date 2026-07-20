/**
 * Bubble-chart controls: section builder.
 *
 * `createBubbleChartControls` is a thin orchestrator that precomputes one control
 * array per section, then groups them. Each section is built by a module-private
 * helper (`buildDataControls`, `buildDisplayControls`, `buildStylingControls`).
 * Build order matches the rendered section order (Data, Display, Styling), so the
 * arrays can be grouped in the same order they are built.
 *
 * Notable: the bubble chart supports *progressive nesting*, a variable-depth column
 * hierarchy ({@link createNestingControls}) that appends one new select per filled
 * level. Legacy `groupColumn` is migrated to the canonical `nestingColumns` array on
 * read via the shared `resolveNestingColumnsFromConfig`.
 *
 * @typedef {import('../../../types.js').Dataset} Dataset
 */

import { BUBBLE_CHART } from '../../../config/charts/definitions/bubble.js';
import { t } from '../../../services/i18nService.js';
import { normalizeColumnNameList } from '../../../domain/datasets/columns.js';
import {
	createTextControl,
	createSliderControl,
	createSelectControl,
	createColorPresetControl,
} from '../../shared/controls/factories.js';
import { groupControls } from '../../shared/controls/grouping.js';
import { resolveNestingColumnsFromConfig, computeNestingControlCount } from './nestingColumns.js';

/**
 * Build progressive nesting-level selectors. Each filled level appends a
 * fresh empty selector below it (up to the configured max). Selecting an
 * empty value truncates all deeper levels.
 *
 * @private
 * @param {Object} config
 * @param {string | null} categoryColumn - Currently selected category column (excluded from nesting options).
 * @param {string[]} allColumns - All visible column names.
 * @param {boolean} disabled - Forces every select disabled when true.
 * @returns {HTMLElement[]}
 */
function createNestingControls(config, categoryColumn, allColumns, disabled) {
	// Normalize allColumns first (drops '' / non-string / duplicates) so an empty
	// or junk column name cannot inflate allowed.size and spawn a useless trailing
	// selector; the category is excluded because it is never a valid nesting level.
	const allowed = new Set(
		normalizeColumnNameList(allColumns, { max: Infinity }).filter(name => name !== categoryColumn),
	);
	const nestingColumns = resolveNestingColumnsFromConfig(config, allowed);
	const nestingMode = BUBBLE_CHART.nestingModes.includes(config.nestingMode)
		? config.nestingMode
		: BUBBLE_CHART.defaultNestingMode;

	const controls = [];
	const isGrouped = nestingMode === 'grouped';
	const nestingDisabled = disabled || !isGrouped;

	// One shared source of truth for the level count (flat-vs-grouped + capacity
	// bound), kept identical to the listeners' wiring count.
	const levelCount = computeNestingControlCount(config, allowed);

	for (let i = 0; i < levelCount; i++) {
		// Exclude already-selected columns at other levels and the category column
		const excludedColumns = new Set(
			nestingColumns.filter((_, idx) => idx !== i)
		);
		if (categoryColumn) excludedColumns.add(categoryColumn);

		const availableColumns = allColumns.filter(col => !excludedColumns.has(col));
		const options = [
			{ value: '', label: t('chive-chart-control-bubble-nesting-empty') },
			...availableColumns.map(opt => ({ value: opt, label: opt })),
		];

		const currentValue = nestingColumns[i] || '';
		controls.push(createSelectControl(
			`viz-select-bubble-nesting-level-${i}`,
			t('chive-chart-control-bubble-nesting-level', i + 1),
			options,
			currentValue,
			nestingDisabled
		));

		// If this level is empty, don't show more levels
		if (!currentValue) break;
	}

	return controls;
}

/**
 * Data & nesting section: category, nesting mode, measure mode, value column,
 * the progressive nesting-level selectors, and Top-N.
 *
 * @param {Object} config - The bubble chart config block.
 * @param {string[]} categoryOptions
 * @param {string[]} numericOptions
 * @param {string[]} allColumns
 * @param {boolean} disabled
 * @returns {HTMLElement[]}
 */
function buildDataControls(config, categoryOptions, numericOptions, allColumns, disabled) {
	const measureMode = BUBBLE_CHART.measureModes.includes(config.measureMode)
		? config.measureMode
		: BUBBLE_CHART.defaultMeasureMode;
	const nestingMode = BUBBLE_CHART.nestingModes.includes(config.nestingMode)
		? config.nestingMode
		: BUBBLE_CHART.defaultNestingMode;

	const dataControls = [];
	dataControls.push(createSelectControl(
		'viz-select-bubble-category',
		t('chive-chart-control-bubble-category'),
		[
			{ value: '', label: t('chive-chart-option-none') },
			...categoryOptions.map(opt => ({ value: opt, label: opt })),
		],
		config.category,
		disabled
	));

	dataControls.push(createSelectControl(
		'viz-select-bubble-nesting-mode',
		t('chive-chart-control-bubble-nesting-mode'),
		[
			{ value: 'flat', label: t('chive-chart-control-bubble-nesting-flat') },
			{ value: 'grouped', label: t('chive-chart-control-bubble-nesting-grouped') },
		],
		nestingMode,
		disabled
	));

	dataControls.push(createSelectControl(
		'viz-select-bubble-measure',
		t('chive-chart-control-bubble-measure'),
		[
			{ value: 'count', label: t('chive-chart-control-bubble-measure-count') },
			{ value: 'sum', label: t('chive-chart-control-bubble-measure-sum') },
			{ value: 'mean', label: t('chive-chart-control-bubble-measure-mean') },
		],
		measureMode,
		disabled
	));

	dataControls.push(createSelectControl(
		'viz-select-bubble-value-column',
		t('chive-chart-control-bubble-value-column'),
		[
			{ value: '', label: t('chive-chart-option-none') },
			...numericOptions.map(opt => ({ value: opt, label: opt })),
		],
		config.valueColumn,
		disabled || measureMode === 'count'
	));

	// Progressive nesting level selectors
	const nestingControls = createNestingControls(config, config.category, allColumns, disabled);
	dataControls.push(...nestingControls);

	dataControls.push(createSelectControl(
		'viz-select-bubble-topn',
		t('chive-chart-control-bubble-topn'),
		BUBBLE_CHART.topNOptions.map(option => ({
			value: String(option),
			label: option === 0 ? t('chive-chart-topn-all') : `Top ${option}`,
		})),
		String(config.topN),
		disabled
	));

	return dataControls;
}

/**
 * Display section: title and label mode.
 *
 * @param {Object} config
 * @param {boolean} disabled
 * @returns {HTMLElement[]}
 */
function buildDisplayControls(config, disabled) {
	const displayControls = [];
	displayControls.push(createTextControl(
		'viz-input-bubble-title',
		t('chive-chart-control-common-title'),
		config.customTitle,
		80,
		disabled
	));

	displayControls.push(createSelectControl(
		'viz-select-bubble-label-mode',
		t('chive-chart-control-bubble-label-mode'),
		[
			{ value: 'all', label: t('chive-chart-control-bubble-label-mode-all') },
			{ value: 'hover', label: t('chive-chart-control-bubble-label-mode-hover') },
			{ value: 'auto', label: t('chive-chart-control-bubble-label-mode-auto') },
		],
		config.labelMode,
		disabled
	));

	return displayControls;
}

/**
 * Styling section: padding slider and color-palette preset.
 *
 * @param {Object} config
 * @param {boolean} disabled
 * @returns {HTMLElement[]}
 */
function buildStylingControls(config, disabled) {
	const stylingControls = [];
	stylingControls.push(createSliderControl(
		'viz-slider-bubble-padding',
		t('chive-chart-control-bubble-padding'),
		Number(config.padding ?? BUBBLE_CHART.defaultPadding),
		1,
		10,
		1,
		disabled
	));
	stylingControls.push(createColorPresetControl(
		'viz-bubble-color-preset',
		t('chive-chart-color-palette'),
		config.colorScheme || 'Tableau10',
		disabled,
		t
	));

	return stylingControls;
}

/**
 * Build the bubble-chart control sections (Data + nesting, Display, Styling).
 *
 * @param {Dataset} dataset
 * @param {string[]} categoryOptions - Categorical (or fallback "all") column names for the root category select.
 * @param {string[]} [numericOptions=[]] - Numeric column names for the sum/mean value-column select.
 * @param {string[]} [allColumns=[]] - All visible column names; used to populate the progressive nesting selects.
 * @returns {HTMLElement[]} Array of `chart-control-section` elements.
 */
export function createBubbleChartControls(dataset, categoryOptions, numericOptions = [], allColumns = []) {
	const config = dataset.chartConfig.bubble;
	const disabled = !config.enabled;

	const dataControls = buildDataControls(config, categoryOptions, numericOptions, allColumns, disabled);
	const displayControls = buildDisplayControls(config, disabled);
	const stylingControls = buildStylingControls(config, disabled);

	return groupControls([
		{ id: 'data', title: t('chive-chart-control-bubble-category'), controls: dataControls, expanded: true, icon: 'data' },
		{ id: 'display', title: 'Display', controls: displayControls, expanded: true, icon: 'display' },
		{ id: 'styling', title: 'Styling', controls: stylingControls, expanded: false, icon: 'styling' },
	]);
}
