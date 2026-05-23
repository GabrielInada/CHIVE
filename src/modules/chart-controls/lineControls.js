/**
 * Line-chart controls module.
 *
 * Builds the right-sidebar control group for the line chart and wires its
 * listeners. The X-axis accepts any column type (numeric, categorical, or
 * date) — date detection happens inside {@link computeDefaults}.
 *
 * @typedef {import('../../types.js').Dataset} Dataset
 * @typedef {import('../../types.js').ChartControlContext} ChartControlContext
 */

import { CHART_COLORS, LINE_CHART } from '../../config/charts.js';
import { t } from '../../services/i18nService.js';
import { updateActiveDatasetChartConfig } from '../stateSync.js';
import {
	createCheckboxControl,
	createColorInputControl,
	createSelectControl,
	createSliderControl,
	createTextControl,
	normalizeHexColor,
} from './shared.js';
import { groupControls } from './controlGrouping.js';
import {
	setupCheckboxListeners,
	setupColorInputListener,
	setupSelectListeners,
	setupSliderListener,
	setupTextInputListener,
} from './controlListenerHelpers.js';

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
	const config = dataset.configGraficos.line;
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

	displayControls.push(createSliderControl(
		'viz-slider-line-height',
		t('chive-chart-control-common-height'),
		Number(config.chartHeight || 320),
		220,
		720,
		10,
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

/**
 * Wire listeners for every line-chart control element. The X-axis accepts
 * any column from `allOptions`; the Y-axis is restricted to `numericOptions`.
 *
 * @param {Dataset} dataset
 * @param {string[]} numericOptions
 * @param {string[]} dateOptions - Currently unused (reserved for date-axis mode).
 * @param {string[]} allOptions - All visible columns; used to validate the X-axis select.
 * @param {() => void} [onConfigChanged]
 * @returns {void}
 */
export function setupLineChartControlListeners(dataset, numericOptions, dateOptions, allOptions, onConfigChanged) {
	void dateOptions;

	const xSelect = document.getElementById('viz-select-line-x');
	if (xSelect) {
		xSelect.addEventListener('change', () => {
			const selected = allOptions.includes(xSelect.value) ? xSelect.value : null;
			updateActiveDatasetChartConfig({
				line: { ...dataset.configGraficos.line, x: selected },
			});
			onConfigChanged?.();
		});
	}

	const ySelect = document.getElementById('viz-select-line-y');
	if (ySelect) {
		ySelect.addEventListener('change', () => {
			const selected = numericOptions.includes(ySelect.value) ? ySelect.value : null;
			updateActiveDatasetChartConfig({
				line: { ...dataset.configGraficos.line, y: selected },
			});
			onConfigChanged?.();
		});
	}

	setupSelectListeners([
		{
			id: 'viz-select-line-curve',
			key: 'curve',
			transform: v => (LINE_CHART.curveOptions.includes(v) ? v : LINE_CHART.defaultCurve),
		},
		{
			id: 'viz-select-line-missing',
			key: 'missingMode',
			transform: v => (LINE_CHART.missingModes.includes(v) ? v : LINE_CHART.defaultMissingMode),
		},
		{
			id: 'viz-select-line-aggregate',
			key: 'aggregateMode',
			transform: v => (LINE_CHART.aggregateModes.includes(v) ? v : LINE_CHART.defaultAggregateMode),
		},
	], dataset, 'line', onConfigChanged);

	setupCheckboxListeners([
		{ id: 'viz-toggle-line-sort-x', key: 'sortX' },
		{ id: 'viz-toggle-line-show-points', key: 'showPoints' },
		{ id: 'viz-toggle-line-x-label', key: 'showXAxisLabel' },
		{ id: 'viz-toggle-line-y-label', key: 'showYAxisLabel' },
	], dataset, 'line', onConfigChanged);

	setupTextInputListener('viz-input-line-title', 'customTitle', dataset, 'line', onConfigChanged);
	setupSliderListener('viz-slider-line-height', 'chartHeight', dataset, 'line', onConfigChanged);
	setupSliderListener('viz-slider-line-stroke-width', 'strokeWidth', dataset, 'line', onConfigChanged);

	setupColorInputListener('viz-input-line-color', 'color', CHART_COLORS.line, dataset, 'line', onConfigChanged);
	setupColorInputListener('viz-input-line-ghost-color', 'ghostStrokeColor', LINE_CHART.defaultGhostStrokeColor, dataset, 'line', onConfigChanged);
}

/**
 * Compute the line chart's activation defaults. The X-axis prefers the
 * user's current pick → first date column → first numeric → first
 * available. The Y-axis picks the first numeric column that is not also X.
 *
 * @param {Dataset} dataset
 * @param {ChartControlContext} ctx
 * @returns {{ x: string | null, y: string | null }}
 */
export function computeDefaults(dataset, ctx) {
	const currentX = dataset.configGraficos?.line?.x;
	const currentY = dataset.configGraficos?.line?.y;
	const xDefault = ctx.todasColunas.includes(currentX)
		? currentX
		: (ctx.datas[0] ?? ctx.numericas[0] ?? ctx.todasColunas[0] ?? null);
	const yCandidates = ctx.numericas.filter(name => name !== xDefault);
	const yDefault = ctx.numericas.includes(currentY) && currentY !== xDefault
		? currentY
		: (yCandidates[0] ?? ctx.numericas[0] ?? null);
	return { x: xDefault, y: yDefault };
}
