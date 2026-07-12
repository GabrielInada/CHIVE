/**
 * Pie-chart control builder.
 *
 * Builds the right-sidebar control group for the pie chart: the Data &
 * Aggregation, Display, and Styling sections, returned as
 * `chart-control-section` elements. The builder is a thin orchestrator over
 * three per-section helpers (`buildDataControls`, `buildDisplayControls`,
 * `buildStylingControls`) so each stays small; the Styling section
 * conditionally includes the palette preset and per-slice color picker grid,
 * which appear only when the chart has sectors to color.
 *
 * Slice colors persist as `config.customSliceColors[categoryToken]`.
 *
 * @typedef {import('../../../types.js').Dataset} Dataset
 */

import { CHART_COLORS, PIE_CHART } from '../../../config/charts.js';
import { t } from '../../../services/i18nService.js';
import { createCheckboxControl, createColorInputControl, createSelectControl, createSliderControl, createTextControl } from '../../shared/controls/factories.js';
import { createColorPresetControl, createColorPickerGridControl } from '../../shared/controls/factories.js';
import { groupControls } from '../../shared/controls/grouping.js';
import { getPieSectorValues } from './sectorValues.js';

/**
 * Build the Data & Aggregation controls: category / measure / value selects
 * plus the top-N count and top-N mode selects.
 *
 * @private
 * @param {Dataset} dataset
 * @param {string[]} categoryOptions
 * @param {string[]} numericOptions
 * @param {Object} config - The pie config block.
 * @returns {HTMLElement[]}
 */
function buildDataControls(dataset, categoryOptions, numericOptions, config) {
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

	return dataControls;
}

/**
 * Build the Display controls: radius/pad/zoom sliders, label and legend
 * toggles, the chart title, the label-position select, and the reset-zoom
 * button.
 *
 * @private
 * @param {Dataset} dataset
 * @param {Object} config - The pie config block.
 * @returns {HTMLElement[]}
 */
function buildDisplayControls(dataset, config) {
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

	return displayControls;
}

/**
 * Build the Styling controls: the base color input, plus the palette preset
 * and per-slice color picker grid that appear only when the chart has sectors
 * to color (a non-empty category column).
 *
 * @private
 * @param {Dataset} dataset
 * @param {Object} config - The pie config block.
 * @param {string[]} sectorValues - Source category tokens in aggregate order.
 * @returns {HTMLElement[]}
 */
function buildStylingControls(dataset, config, sectorValues) {
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
			!dataset.chartConfig.pie.enabled,
			t
		));
	}

	// Per-slice custom color picker grid
	if (sectorValues.length > 0) {
		const colorGridElement = updatePieColorPickerGrid(dataset, sectorValues);
		stylingControls.push(colorGridElement);
	}

	return stylingControls;
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
 * @param {string[]} [_allColumns=[]] - All visible column names; kept for API parity.
 * @returns {HTMLElement[]} Array of `chart-control-section` elements.
 */
export function createPieChartControls(dataset, categoryOptions, numericOptions, _allColumns = []) {
	const config = dataset.chartConfig.pie;
	const sectorValues = getPieSectorValues(dataset, config);

	return groupControls([
		{ id: 'data', title: 'Data & Aggregation', controls: buildDataControls(dataset, categoryOptions, numericOptions, config), expanded: true, icon: 'data' },
		{ id: 'display', title: 'Display', controls: buildDisplayControls(dataset, config), expanded: true, icon: 'display' },
		{ id: 'styling', title: 'Styling', controls: buildStylingControls(dataset, config, sectorValues), expanded: false, icon: 'styling' },
	]);
}

/**
 * Build the per-slice color picker grid for the pie chart. One color
 * input per sector value; commits write into `customSliceColors`.
 *
 * @private
 * @param {Dataset} dataset
 * @param {string[]} sectorValues - Source category tokens in aggregate order.
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
