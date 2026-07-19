/**
 * Line-chart controls: section builder.
 *
 * Builds the right-sidebar control group for the line chart (Data &
 * Aggregation, Styling, Display). The X-axis accepts any column type (numeric,
 * categorical, or date); date detection happens inside `computeDefaults`.
 *
 * @typedef {import('../../../types.js').Dataset} Dataset
 */

import { CHART_COLORS } from '../../../config/charts/definitions.js';
import { LINE_CHART } from '../../../config/charts/definitions/line.js';
import { t } from '../../../services/i18nService.js';
import {
	createCheckboxControl,
	createColorInputControl,
	createSelectControl,
	createSliderControl,
	createTextControl,
} from '../../shared/controls/factories.js';
import { groupControls } from '../../shared/controls/grouping.js';

/** @private */
function buildCurveOptions() {
	return LINE_CHART.curveOptions.map(value => ({
		value,
		label: t(`chive-chart-line-curve-${value}`),
	}));
}

/** @private */
function buildMissingModeOptions() {
	return LINE_CHART.missingModes.map(value => ({
		value,
		label: t(`chive-chart-line-missing-${value}`),
	}));
}

/** @private */
function buildAggregateOptions() {
	return LINE_CHART.aggregateModes.map(value => ({
		value,
		label: t(`chive-chart-line-aggregate-${value}`),
	}));
}

/**
 * Build the line-chart control sections (Data, Styling, Display).
 *
 * @param {Dataset} dataset
 * @param {string[]} [numericOptions=[]] - Numeric column names; populates the Y-axis select.
 * @param {string[]} [dateOptions=[]] - Date column names; reserved for future date-axis-only mode (not currently restricted).
 * @param {string[]} [allOptions=[]] - All visible column names; populates the X-axis select.
 * @returns {HTMLElement[]} Array of `chart-control-section` elements.
 */
export function createLineChartControls(dataset, numericOptions = [], dateOptions = [], allOptions = []) {
	const config = dataset.chartConfig.line;
	const disabled = !config.enabled;

	// ====== DATA & AGGREGATION SECTION ======
	const dataControls = [];

	const xOptions = [
		{ value: '', label: t('chive-chart-option-none') },
		...allOptions.map(opt => ({ value: opt, label: opt })),
	];
	dataControls.push(createSelectControl(
		'viz-select-line-x',
		t('chive-chart-control-line-x'),
		xOptions,
		config.x,
		disabled,
	));

	const yOptions = [
		{ value: '', label: t('chive-chart-option-none') },
		...numericOptions.map(opt => ({ value: opt, label: opt })),
	];
	dataControls.push(createSelectControl(
		'viz-select-line-y',
		t('chive-chart-control-line-y'),
		yOptions,
		config.y,
		disabled,
	));

	dataControls.push(createSelectControl(
		'viz-select-line-aggregate',
		t('chive-chart-control-line-aggregate'),
		buildAggregateOptions(),
		config.aggregateMode,
		disabled,
	));

	dataControls.push(createCheckboxControl(
		'viz-toggle-line-sort-x',
		t('chive-chart-control-line-sort-x'),
		config.sortX !== false,
		disabled,
	));

	// ====== STYLING SECTION ======
	const stylingControls = [];

	stylingControls.push(createSelectControl(
		'viz-select-line-curve',
		t('chive-chart-control-line-curve'),
		buildCurveOptions(),
		config.curve,
		disabled,
	));

	stylingControls.push(createSelectControl(
		'viz-select-line-missing',
		t('chive-chart-control-line-missing'),
		buildMissingModeOptions(),
		config.missingMode,
		disabled,
	));

	stylingControls.push(createSliderControl(
		'viz-slider-line-stroke-width',
		t('chive-chart-control-line-stroke-width'),
		Number(config.strokeWidth || LINE_CHART.defaultStrokeWidth),
		0.5,
		6,
		0.5,
		disabled,
	));

	stylingControls.push(createColorInputControl(
		'viz-input-line-color',
		t('chive-chart-control-line-color'),
		config.color,
		CHART_COLORS.line,
		disabled,
	));

	stylingControls.push(createColorInputControl(
		'viz-input-line-ghost-color',
		t('chive-chart-control-line-ghost-color'),
		config.ghostStrokeColor,
		LINE_CHART.defaultGhostStrokeColor,
		disabled || config.missingMode !== 'interpolate',
	));

	stylingControls.push(createCheckboxControl(
		'viz-toggle-line-show-points',
		t('chive-chart-control-line-show-points'),
		config.showPoints === true,
		disabled,
	));

	// ====== DISPLAY SECTION ======
	const displayControls = [];

	displayControls.push(createCheckboxControl(
		'viz-toggle-line-x-label',
		t('chive-chart-control-axis-label-x'),
		config.showXAxisLabel,
		disabled,
	));

	displayControls.push(createCheckboxControl(
		'viz-toggle-line-y-label',
		t('chive-chart-control-axis-label-y'),
		config.showYAxisLabel,
		disabled,
	));

	displayControls.push(createTextControl(
		'viz-input-line-title',
		t('chive-chart-control-common-title'),
		config.customTitle,
		80,
		disabled,
	));

	// Quiet "unused" warning while leaving the date list available for future
	// affordances (e.g. surfacing date columns first in the X picker).
	void dateOptions;

	return groupControls([
		{ id: 'data', title: 'Data & Aggregation', controls: dataControls, expanded: true, icon: 'data' },
		{ id: 'styling', title: 'Styling', controls: stylingControls, expanded: true, icon: 'styling' },
		{ id: 'display', title: 'Display', controls: displayControls, expanded: false, icon: 'display' },
	]);
}
