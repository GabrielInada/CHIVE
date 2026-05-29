/**
 * Pie-chart controls module.
 *
 * Builds the right-sidebar control group for the pie chart and wires its
 * listeners. Notable: per-slice color picker grid (one color input per
 * category), palette presets that map an N-color palette to N sectors,
 * and cross-constraint logic between inner/outer radius sliders.
 *
 * Slice colors persist as `config.customSliceColors[categoryToken]`.
 *
 * @typedef {import('../../types.js').Dataset} Dataset
 * @typedef {import('../../types.js').ChartControlContext} ChartControlContext
 */

import { CHART_COLORS, PIE_CHART } from '../../config/charts.js';
import { isNullish } from '../../utils/formatters.js';
import { compareStrings } from '../../utils/chartFilters.js';
import { t } from '../../services/i18nService.js';
import { updateActiveDatasetChartConfig } from '../state/stateSync.js';
import { normalizeActiveDatasetConfig } from '../state/appState.js';
import { triggerLiveRender } from './livePreview.js';
import { createCheckboxControl, createColorInputControl, createSelectControl, createSliderControl, createTextControl, normalizeHexColor } from './shared.js';
import { createColorPresetControl, createColorPickerGridControl, COLOR_PRESETS } from './shared.js';
import { groupControls } from './controlGrouping.js';
import {
	setupSelectListeners,
	setupCheckboxListeners,
	setupTextInputListener,
	setupColorInputListener,
	setupSliderListeners,
} from './controlListenerHelpers.js';

/**
 * Compute the category-token order that will appear in the rendered pie
 * (descending by aggregate, with a string tiebreaker so order is stable).
 * Used to drive the per-slice color picker grid and the palette-preset
 * mapping. Missing values bucket under `'N/A'`.
 *
 * @private
 * @param {Dataset} dataset
 * @param {Object} config - The pie config block.
 * @returns {string[]}
 */
function getPieSectorValues(dataset, config) {
	if (!config?.category || !Array.isArray(dataset?.rows)) return [];

	const counter = new Map();
	dataset.rows.forEach(row => {
		const rawValue = row[config.category];
		const category = isNullish(rawValue) || rawValue === ''
			? 'N/A'
			: String(rawValue);

		if (config.measureMode === 'sum') {
			if (!config.valueColumn) return;
			const numericValue = Number(row[config.valueColumn]);
			if (!Number.isFinite(numericValue)) return;
			counter.set(category, (counter.get(category) || 0) + numericValue);
			return;
		}

		counter.set(category, (counter.get(category) || 0) + 1);
	});

	return Array.from(counter.entries())
		.sort((a, b) => b[1] - a[1] || compareStrings(a[0], b[0]))
		.map(([category]) => category);
}

/**
 * Build the pie-chart control sections (Data, Display, Styling).
 *
 * The Styling section conditionally includes the palette preset and
 * per-slice color picker grid, they appear only when the chart has
 * sectors to color (i.e. a non-empty category column).
 *
 * @param {Dataset} dataset
 * @param {string[]} categoryOptions - Categorical (or fallback "all") column names for the category select.
 * @param {string[]} numericOptions - Numeric column names; populates the sum value-column select.
 * @param {string[]} [allColumns=[]] - All visible column names; kept for API parity.
 * @returns {HTMLElement[]} Array of `chart-control-section` elements.
 */
export function createPieChartControls(dataset, categoryOptions, numericOptions, allColumns = []) {
	const config = dataset.chartConfig.pie;
	const sectorValues = getPieSectorValues(dataset, config);

	// ====== DATA & AGGREGATION SECTION ======
	const dataControls = [];

	const categoryDiv = document.createElement('div');
	categoryDiv.className = 'chart-controle';

	const categoryLabel = document.createElement('label');
	categoryLabel.htmlFor = 'viz-select-pie-category';
	categoryLabel.textContent = t('chive-chart-control-pie-category');

	const categorySelect = document.createElement('select');
	categorySelect.id = 'viz-select-pie-category';
	categorySelect.className = 'rows-select';
	categorySelect.disabled = !dataset.chartConfig.pie.enabled;

	const noneOption = document.createElement('option');
	noneOption.value = '';
	noneOption.textContent = t('chive-chart-option-none');
	categorySelect.appendChild(noneOption);

	categoryOptions.forEach(opt => {
		const option = document.createElement('option');
		option.value = opt;
		option.textContent = opt;
		option.selected = opt === config.category;
		categorySelect.appendChild(option);
	});

	categoryDiv.appendChild(categoryLabel);
	categoryDiv.appendChild(categorySelect);
	dataControls.push(categoryDiv);

	const measureDiv = document.createElement('div');
	measureDiv.className = 'chart-controle';

	const measureLabel = document.createElement('label');
	measureLabel.htmlFor = 'viz-select-pie-measure';
	measureLabel.textContent = t('chive-chart-control-pie-measure');

	const measureSelect = document.createElement('select');
	measureSelect.id = 'viz-select-pie-measure';
	measureSelect.className = 'rows-select';
	measureSelect.disabled = !dataset.chartConfig.pie.enabled;

	[
		{ value: 'count', label: t('chive-chart-control-pie-measure-count') },
		{ value: 'sum', label: t('chive-chart-control-pie-measure-sum') },
	].forEach(opt => {
		const option = document.createElement('option');
		option.value = opt.value;
		option.textContent = opt.label;
		option.selected = opt.value === config.measureMode;
		measureSelect.appendChild(option);
	});

	measureDiv.appendChild(measureLabel);
	measureDiv.appendChild(measureSelect);
	dataControls.push(measureDiv);

	const valueDiv = document.createElement('div');
	valueDiv.className = 'chart-controle';

	const valueLabel = document.createElement('label');
	valueLabel.htmlFor = 'viz-select-pie-value-column';
	valueLabel.textContent = t('chive-chart-control-pie-value-column');

	const valueSelect = document.createElement('select');
	valueSelect.id = 'viz-select-pie-value-column';
	valueSelect.className = 'rows-select';
	valueSelect.disabled = !dataset.chartConfig.pie.enabled || config.measureMode !== 'sum';

	const noneOptionValue = document.createElement('option');
	noneOptionValue.value = '';
	noneOptionValue.textContent = t('chive-chart-option-none');
	valueSelect.appendChild(noneOptionValue);

	numericOptions.forEach(opt => {
		const option = document.createElement('option');
		option.value = opt;
		option.textContent = opt;
		option.selected = opt === config.valueColumn;
		valueSelect.appendChild(option);
	});

	valueDiv.appendChild(valueLabel);
	valueDiv.appendChild(valueSelect);
	dataControls.push(valueDiv);

	dataControls.push(createSelectControl(
		'viz-select-pie-topn',
		t('chive-chart-control-pie-topn'),
		[
			{ value: '0', label: t('chive-chart-topn-all') },
			{ value: '10', label: 'Top 10' },
			{ value: '20', label: 'Top 20' },
			{ value: '50', label: 'Top 50' },
		],
		String(Number.isFinite(Number(config.topN)) ? Number(config.topN) : PIE_CHART.defaultTopN),
		!dataset.chartConfig.pie.enabled
	));

	dataControls.push(createSelectControl(
		'viz-select-pie-topn-mode',
		t('chive-chart-control-pie-topn-mode'),
		[
			{ value: 'other', label: t('chive-chart-pie-topn-mode-other') },
			{ value: 'truncate', label: t('chive-chart-pie-topn-mode-truncate') },
		],
		config.topNMode === 'truncate' ? 'truncate' : 'other',
		!dataset.chartConfig.pie.enabled
	));

	// ====== DISPLAY SECTION ======
	const displayControls = [];

	displayControls.push(createSliderControl(
		'viz-slider-pie-inner-radius',
		t('chive-chart-control-pie-inner-radius'),
		Number(config.innerRadius),
		PIE_CHART.minInnerRadius,
		PIE_CHART.maxOuterRadius - 8,
		1,
		!dataset.chartConfig.pie.enabled
	));

	displayControls.push(createSliderControl(
		'viz-slider-pie-outer-radius',
		t('chive-chart-control-pie-outer-radius'),
		Number(config.outerRadius),
		PIE_CHART.minOuterRadius,
		PIE_CHART.maxOuterRadius,
		1,
		!dataset.chartConfig.pie.enabled
	));

	displayControls.push(createSliderControl(
		'viz-slider-pie-pad-angle',
		t('chive-chart-control-pie-pad-angle'),
		Number(config.padAngle),
		PIE_CHART.minPadAngle,
		PIE_CHART.maxPadAngle,
		0.5,
		!dataset.chartConfig.pie.enabled
	));

	displayControls.push(createSliderControl(
		'viz-slider-pie-zoom',
		t('chive-chart-control-pie-zoom'),
		Number(config.zoomScale),
		PIE_CHART.minZoomScale,
		PIE_CHART.maxZoomScale,
		0.05,
		!dataset.chartConfig.pie.enabled
	));

	displayControls.push(createCheckboxControl(
		'viz-toggle-pie-category-label',
		t('chive-chart-control-pie-sector-label'),
		config.showCategoryLabel,
		!dataset.chartConfig.pie.enabled
	));

	displayControls.push(createCheckboxControl(
		'viz-toggle-pie-value-label',
		t('chive-chart-control-pie-sector-value'),
		config.showValueLabel,
		!dataset.chartConfig.pie.enabled
	));

	displayControls.push(createCheckboxControl(
		'viz-toggle-pie-legend',
		t('chive-chart-control-pie-show-legend'),
		config.showLegend,
		!dataset.chartConfig.pie.enabled
	));

	displayControls.push(createTextControl(
		'viz-input-pie-title',
		t('chive-chart-control-common-title'),
		config.customTitle,
		80,
		!dataset.chartConfig.pie.enabled
	));

	displayControls.push(createSliderControl(
		'viz-slider-pie-height',
		t('chive-chart-control-common-height'),
		Number(config.chartHeight || 360),
		220,
		720,
		10,
		!dataset.chartConfig.pie.enabled
	));

	const labelPositionDiv = document.createElement('div');
	labelPositionDiv.className = 'chart-controle';

	const labelPositionLabel = document.createElement('label');
	labelPositionLabel.htmlFor = 'viz-select-pie-label-position';
	labelPositionLabel.textContent = t('chive-chart-control-pie-label-position');

	const labelPositionSelect = document.createElement('select');
	labelPositionSelect.id = 'viz-select-pie-label-position';
	labelPositionSelect.className = 'rows-select';
	labelPositionSelect.disabled = !dataset.chartConfig.pie.enabled;

	[
		{ value: 'inside', label: t('chive-chart-control-pie-label-position-inside') },
		{ value: 'outside', label: t('chive-chart-control-pie-label-position-outside') },
	].forEach(opt => {
		const option = document.createElement('option');
		option.value = opt.value;
		option.textContent = opt.label;
		option.selected = opt.value === config.labelPosition;
		labelPositionSelect.appendChild(option);
	});

	labelPositionDiv.appendChild(labelPositionLabel);
	labelPositionDiv.appendChild(labelPositionSelect);
	displayControls.push(labelPositionDiv);

	const resetZoomDiv = document.createElement('div');
	resetZoomDiv.className = 'chart-controle';
	const resetZoomBtn = document.createElement('button');
	resetZoomBtn.type = 'button';
	resetZoomBtn.id = 'viz-btn-pie-reset-zoom';
	resetZoomBtn.className = 'chart-control-btn';
	resetZoomBtn.textContent = t('chive-chart-control-pie-reset-zoom');
	resetZoomBtn.disabled = !dataset.chartConfig.pie.enabled;
	resetZoomDiv.appendChild(resetZoomBtn);
	displayControls.push(resetZoomDiv);

	// ====== STYLING SECTION ======
	const stylingControls = [];

	stylingControls.push(createColorInputControl(
		'viz-input-pie-color',
		t('chive-chart-control-pie-color'),
		config.color,
		CHART_COLORS.pie,
		!dataset.chartConfig.pie.enabled,
	));

	// Palette presets for quick color application
	if (sectorValues.length > 0) {
		stylingControls.push(createColorPresetControl(
			'viz-pie-color-preset',
			t('chive-chart-color-palette'),
			config.colorScheme || 'Bold',
			!dataset.chartConfig.pie.enabled
		));
	}

	// Per-slice custom color picker grid
	if (sectorValues.length > 0) {
		const colorGridElement = updatePieColorPickerGrid(dataset, sectorValues);
		stylingControls.push(colorGridElement);
	}

	// ====== Group and return all sections ======
	return groupControls([
		{ id: 'data', title: 'Data & Aggregation', controls: dataControls, expanded: true, icon: 'data' },
		{ id: 'display', title: 'Display', controls: displayControls, expanded: true, icon: 'display' },
		{ id: 'styling', title: 'Styling', controls: stylingControls, expanded: false, icon: 'styling' },
	]);
}

/**
 * Build the per-slice color picker grid for the pie chart. One color
 * input per sector value; commits write into `customSliceColors`.
 *
 * @private
 * @param {Dataset} dataset
 * @param {string[]} sectorValues - Category tokens in the order they appear in the rendered pie.
 * @returns {HTMLElement}
 */
function updatePieColorPickerGrid(dataset, sectorValues) {
	return createColorPickerGridControl(
		'viz-pie-color-grid',
		t('chive-chart-color-pie-slices'),
		sectorValues,
		dataset.chartConfig.pie.customSliceColors || {},
		!dataset.chartConfig.pie.enabled,
		null
	);
}


/**
 * Wire listeners for every pie-chart control. Handles cross-constraints
 * between inner/outer radius sliders, the `measureMode` ↔ `valueColumn`
 * dependency, the Reset Zoom button, palette-preset → per-slice color
 * mapping, and per-slice color picker grid (live `input` writes via the
 * non-emitting facade, `change` commits through the emitting facade).
 *
 * The `allColumnsOrCallback` parameter is overloaded for backward
 * compatibility (callback in arg 4 or arg 5).
 *
 * @param {Dataset} dataset
 * @param {string[]} basePie - Categorical (or fallback "all") column names; kept for parity.
 * @param {string[]} numeric - Numeric column names; used to validate the value-column select.
 * @param {string[] | (() => void)} [allColumnsOrCallback]
 * @param {() => void} [onConfigChangedMaybe]
 * @returns {void}
 */
export function setupPieChartControlListeners(dataset, basePie, numeric, allColumnsOrCallback = [], onConfigChangedMaybe) {
	const onConfigChanged = typeof allColumnsOrCallback === 'function'
		? allColumnsOrCallback
		: onConfigChangedMaybe;
	const sectorValues = getPieSectorValues(dataset, dataset.chartConfig.pie);

	setupSelectListeners([
		{ id: 'viz-select-pie-category', key: 'category' },
		{ id: 'viz-select-pie-value-column', key: 'valueColumn', transform: v => v || null },
		{ id: 'viz-select-pie-label-position', key: 'labelPosition', transform: v => v === 'outside' ? 'outside' : 'inside' },
		{ id: 'viz-select-pie-topn', key: 'topN', transform: v => Number(v) },
		{ id: 'viz-select-pie-topn-mode', key: 'topNMode', transform: v => v === 'truncate' ? 'truncate' : 'other' },
	], dataset, 'pie', onConfigChanged);

	// Measure select (custom: updates valueColumn dependency)
	const measureSelect = document.getElementById('viz-select-pie-measure');
	if (measureSelect) {
		measureSelect.addEventListener('change', () => {
			const measureMode = measureSelect.value === 'sum' ? 'sum' : 'count';
			const currentValueColumn = dataset.chartConfig.pie?.valueColumn;
			const nextValueColumn = measureMode === 'sum'
				? (numeric.includes(currentValueColumn) ? currentValueColumn : (numeric[0] || null))
				: currentValueColumn;
			updateActiveDatasetChartConfig({
				pie: {
					...dataset.chartConfig.pie,
					measureMode,
					valueColumn: nextValueColumn,
				},
			});
			onConfigChanged?.();
		});
	}

	// Inner/outer radius sliders (custom: cross-constraint logic)
	const innerSlider = document.getElementById('viz-slider-pie-inner-radius');
	const outerSlider = document.getElementById('viz-slider-pie-outer-radius');
	const syncSliderOutput = slider => {
		const output = slider?.parentElement?.querySelector('output');
		if (output) output.textContent = slider.value;
	};

	if (innerSlider) {
		innerSlider.addEventListener('input', () => syncSliderOutput(innerSlider));
		innerSlider.addEventListener('change', () => {
			const outerRadius = Number(outerSlider?.value || dataset.chartConfig.pie.outerRadius || PIE_CHART.defaultOuterRadius);
			const innerRadius = Math.min(Number(innerSlider.value), Math.max(0, outerRadius - 8));
			if (String(innerRadius) !== innerSlider.value) {
				innerSlider.value = String(innerRadius);
				syncSliderOutput(innerSlider);
			}
			updateActiveDatasetChartConfig({
				pie: { ...dataset.chartConfig.pie, innerRadius },
			});
			onConfigChanged?.();
		});
	}

	if (outerSlider) {
		outerSlider.addEventListener('input', () => syncSliderOutput(outerSlider));
		outerSlider.addEventListener('change', () => {
			const outerRadius = Number(outerSlider.value);
			const currentInner = Number(innerSlider?.value || dataset.chartConfig.pie.innerRadius || PIE_CHART.defaultInnerRadius);
			const innerRadius = Math.min(currentInner, Math.max(0, outerRadius - 8));
			if (innerSlider && String(innerRadius) !== innerSlider.value) {
				innerSlider.value = String(innerRadius);
				syncSliderOutput(innerSlider);
			}
			updateActiveDatasetChartConfig({
				pie: { ...dataset.chartConfig.pie, outerRadius, innerRadius },
			});
			onConfigChanged?.();
		});
	}

	setupSliderListeners([
		{ id: 'viz-slider-pie-pad-angle', key: 'padAngle' },
		{ id: 'viz-slider-pie-zoom', key: 'zoomScale' },
		{ id: 'viz-slider-pie-height', key: 'chartHeight' },
	], dataset, 'pie', onConfigChanged);

	// Reset zoom button (custom: resets slider DOM + config)
	const pieZoomSlider = document.getElementById('viz-slider-pie-zoom');
	const resetPieZoomButton = document.getElementById('viz-btn-pie-reset-zoom');
	if (resetPieZoomButton) {
		resetPieZoomButton.addEventListener('click', () => {
			if (pieZoomSlider) {
				pieZoomSlider.value = String(PIE_CHART.defaultZoomScale);
				syncSliderOutput(pieZoomSlider);
			}
			updateActiveDatasetChartConfig({
				pie: { ...dataset.chartConfig.pie, zoomScale: PIE_CHART.defaultZoomScale },
			});
			onConfigChanged?.();
		});
	}

	setupCheckboxListeners([
		{ id: 'viz-toggle-pie-category-label', key: 'showCategoryLabel' },
		{ id: 'viz-toggle-pie-value-label', key: 'showValueLabel' },
		{ id: 'viz-toggle-pie-legend', key: 'showLegend' },
	], dataset, 'pie', onConfigChanged);

	setupColorInputListener('viz-input-pie-color', 'color', CHART_COLORS.pie, dataset, 'pie', onConfigChanged);
	setupTextInputListener('viz-input-pie-title', 'customTitle', dataset, 'pie', onConfigChanged);

	// Pie color presets (custom: maps palette to per-slice colors)
	const presetButtons = document.querySelectorAll('button[data-color-preset-control="viz-pie-color-preset"]');
	presetButtons.forEach(button => {
		button.addEventListener('click', () => {
			const presetName = button.dataset.presetName;
			const presetColors = COLOR_PRESETS[presetName] || [];
			if (presetColors.length === 0 || sectorValues.length === 0) return;

			const nextSliceColors = { ...(dataset.chartConfig.pie.customSliceColors || {}) };
			sectorValues.forEach((sector, index) => {
				nextSliceColors[sector] = presetColors[index % presetColors.length];
			});

			updateActiveDatasetChartConfig({
				pie: {
					...dataset.chartConfig.pie,
					colorScheme: presetName,
					customSliceColors: nextSliceColors,
				},
			});
			onConfigChanged?.();
		});
	});

	// Per-slice color grid: live drag-preview writes go through the
	// non-emitting facade path (no sidebar rebuild during drag); `change`
	// commits through the emitting facade for the final state.
	const perSliceInputs = document.querySelectorAll('input[data-color-grid-control="viz-pie-color-grid"]');
	perSliceInputs.forEach(input => {
		input.addEventListener('input', () => {
			const sector = input.dataset.colorItem;
			if (!sector) return;
			const next = normalizeHexColor(input.value, CHART_COLORS.pie);
			normalizeActiveDatasetConfig(prev => ({
				...prev,
				pie: {
					...prev.pie,
					customSliceColors: {
						...(prev.pie?.customSliceColors || {}),
						[sector]: next,
					},
				},
			}));
			triggerLiveRender();
		});
		input.addEventListener('change', () => {
			const sector = input.dataset.colorItem;
			if (!sector) return;

			const nextSliceColors = { ...(dataset.chartConfig.pie.customSliceColors || {}) };
			nextSliceColors[sector] = normalizeHexColor(input.value, CHART_COLORS.pie);

			updateActiveDatasetChartConfig({
				pie: {
					...dataset.chartConfig.pie,
					customSliceColors: nextSliceColors,
				},
			});
			onConfigChanged?.();
		});
	});
}

/**
 * Compute the pie chart's activation defaults. Preserves the user's
 * current `category` and `valueColumn` when they still match visible
 * columns; otherwise falls back to the first available column.
 *
 * @param {Dataset} dataset
 * @param {ChartControlContext} ctx
 * @returns {{ category: string | null, valueColumn: string | null }}
 */
export function computeDefaults(dataset, ctx) {
	const currentCat = dataset.chartConfig?.pie?.category;
	const currentVal = dataset.chartConfig?.pie?.valueColumn;
	return {
		category: ctx.baseCategoricalOrAll.includes(currentCat)
			? currentCat
			: (ctx.baseCategoricalOrAll[0] || null),
		valueColumn: ctx.numeric.includes(currentVal) ? currentVal : (ctx.numeric[0] || null),
	};
}
