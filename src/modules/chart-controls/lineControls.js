import { CHART_COLORS, LINE_CHART } from '../../config/charts.js';
import { t } from '../../services/i18nService.js';
import { updateActiveDatasetChartConfig } from '../stateSync.js';
import {
	createCheckboxControl,
	createSelectControl,
	createSliderControl,
	createTextControl,
	normalizeHexColor,
} from './shared.js';
import { groupControls } from './controlGrouping.js';
import {
	setupCheckboxListeners,
	setupColorInputListener,
	setupExpandListener,
	setupSelectListeners,
	setupSliderListener,
	setupTextInputListener,
} from './controlListenerHelpers.js';

function buildCurveOptions() {
	return LINE_CHART.curveOptions.map(value => ({
		value,
		label: t(`chive-chart-line-curve-${value}`),
	}));
}

function buildMissingModeOptions() {
	return LINE_CHART.missingModes.map(value => ({
		value,
		label: t(`chive-chart-line-missing-${value}`),
	}));
}

function buildAggregateOptions() {
	return LINE_CHART.aggregateModes.map(value => ({
		value,
		label: t(`chive-chart-line-aggregate-${value}`),
	}));
}

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

	const colorDiv = document.createElement('div');
	colorDiv.className = 'chart-controle';
	const colorLabel = document.createElement('label');
	colorLabel.htmlFor = 'viz-input-line-color';
	colorLabel.textContent = t('chive-chart-control-line-color');
	const colorInput = document.createElement('input');
	colorInput.id = 'viz-input-line-color';
	colorInput.type = 'color';
	colorInput.className = 'chart-color-input';
	colorInput.value = normalizeHexColor(config.color, CHART_COLORS.line);
	colorInput.disabled = disabled;
	colorDiv.appendChild(colorLabel);
	colorDiv.appendChild(colorInput);
	stylingControls.push(colorDiv);

	const ghostDiv = document.createElement('div');
	ghostDiv.className = 'chart-controle';
	const ghostLabel = document.createElement('label');
	ghostLabel.htmlFor = 'viz-input-line-ghost-color';
	ghostLabel.textContent = t('chive-chart-control-line-ghost-color');
	const ghostInput = document.createElement('input');
	ghostInput.id = 'viz-input-line-ghost-color';
	ghostInput.type = 'color';
	ghostInput.className = 'chart-color-input';
	ghostInput.value = normalizeHexColor(config.ghostStrokeColor, LINE_CHART.defaultGhostStrokeColor);
	ghostInput.disabled = disabled || config.missingMode !== 'interpolate';
	ghostDiv.appendChild(ghostLabel);
	ghostDiv.appendChild(ghostInput);
	stylingControls.push(ghostDiv);

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

export function setupLineChartControlListeners(dataset, numericOptions, dateOptions, allOptions, onConfigChanged) {
	void dateOptions;

	setupExpandListener('viz-expand-line', dataset, 'line', onConfigChanged);

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
