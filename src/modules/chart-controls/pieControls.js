import { CHART_COLORS, PIE_CHART } from '../../config/charts.js';
import { t } from '../../services/i18nService.js';
import { updateActiveDatasetChartConfig } from '../stateSync.js';
import { createCheckboxControl, createSliderControl, createTextControl, normalizeHexColor } from './shared.js';
import { createColorPresetControl, createColorPickerGridControl, COLOR_PRESETS } from './shared.js';
import { createChartFilterControls, setupChartFilterControlListeners } from './filterControls.js';
import { groupControls } from './controlGrouping.js';

function getPieSectorValues(dataset, config) {
	if (!config?.category || !Array.isArray(dataset?.dados)) return [];

	const counter = new Map();
	dataset.dados.forEach(row => {
		const rawValue = row[config.category];
		const category = rawValue === null || rawValue === undefined || rawValue === ''
			? '—'
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
		.sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))
		.map(([category]) => category);
}

export function createPieChartControls(dataset, categoryOptions, numericOptions, allColumns = []) {
	const config = dataset.configGraficos.pie;
	const sectorValues = getPieSectorValues(dataset, config);

	// ====== FILTERS SECTION (Top priority, always expanded) ======
	const filterControls = createChartFilterControls({
		chartKey: 'pie',
		rows: dataset.dados,
		allColumns,
		numericColumns: numericOptions,
		rawFilter: config.filter,
		disabled: !dataset.configGraficos.pie.enabled,
	});

	// ====== DATA & AGGREGATION SECTION ======
	const dataControls = [];

	const categoryDiv = document.createElement('div');
	categoryDiv.className = 'chart-controle';

	const categoryLabel = document.createElement('label');
	categoryLabel.htmlFor = 'viz-select-pie-category';
	categoryLabel.textContent = t('chive-chart-control-pie-category');

	const categorySelect = document.createElement('select');
	categorySelect.id = 'viz-select-pie-category';
	categorySelect.className = 'linhas-select';
	categorySelect.disabled = !dataset.configGraficos.pie.enabled;

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
	measureSelect.className = 'linhas-select';
	measureSelect.disabled = !dataset.configGraficos.pie.enabled;

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
	valueSelect.className = 'linhas-select';
	valueSelect.disabled = !dataset.configGraficos.pie.enabled || config.measureMode !== 'sum';

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

	// ====== DISPLAY SECTION ======
	const displayControls = [];

	displayControls.push(createSliderControl(
		'viz-slider-pie-inner-radius',
		t('chive-chart-control-pie-inner-radius'),
		Number(config.innerRadius),
		PIE_CHART.minInnerRadius,
		PIE_CHART.maxOuterRadius - 8,
		1,
		!dataset.configGraficos.pie.enabled
	));

	displayControls.push(createSliderControl(
		'viz-slider-pie-outer-radius',
		t('chive-chart-control-pie-outer-radius'),
		Number(config.outerRadius),
		PIE_CHART.minOuterRadius,
		PIE_CHART.maxOuterRadius,
		1,
		!dataset.configGraficos.pie.enabled
	));

	displayControls.push(createSliderControl(
		'viz-slider-pie-pad-angle',
		t('chive-chart-control-pie-pad-angle'),
		Number(config.padAngle),
		PIE_CHART.minPadAngle,
		PIE_CHART.maxPadAngle,
		0.5,
		!dataset.configGraficos.pie.enabled
	));

	displayControls.push(createSliderControl(
		'viz-slider-pie-zoom',
		t('chive-chart-control-pie-zoom'),
		Number(config.zoomScale),
		PIE_CHART.minZoomScale,
		PIE_CHART.maxZoomScale,
		0.05,
		!dataset.configGraficos.pie.enabled
	));

	displayControls.push(createCheckboxControl(
		'viz-toggle-pie-category-label',
		t('chive-chart-control-pie-sector-label'),
		config.showCategoryLabel,
		!dataset.configGraficos.pie.enabled
	));

	displayControls.push(createCheckboxControl(
		'viz-toggle-pie-value-label',
		t('chive-chart-control-pie-sector-value'),
		config.showValueLabel,
		!dataset.configGraficos.pie.enabled
	));

	displayControls.push(createCheckboxControl(
		'viz-toggle-pie-legend',
		t('chive-chart-control-pie-show-legend'),
		config.showLegend,
		!dataset.configGraficos.pie.enabled
	));

	displayControls.push(createTextControl(
		'viz-input-pie-title',
		t('chive-chart-control-common-title'),
		config.customTitle,
		80,
		!dataset.configGraficos.pie.enabled
	));

	displayControls.push(createSliderControl(
		'viz-slider-pie-height',
		t('chive-chart-control-common-height'),
		Number(config.chartHeight || 360),
		220,
		720,
		10,
		!dataset.configGraficos.pie.enabled
	));

	const labelPositionDiv = document.createElement('div');
	labelPositionDiv.className = 'chart-controle';

	const labelPositionLabel = document.createElement('label');
	labelPositionLabel.htmlFor = 'viz-select-pie-label-position';
	labelPositionLabel.textContent = t('chive-chart-control-pie-label-position');

	const labelPositionSelect = document.createElement('select');
	labelPositionSelect.id = 'viz-select-pie-label-position';
	labelPositionSelect.className = 'linhas-select';
	labelPositionSelect.disabled = !dataset.configGraficos.pie.enabled;

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
	resetZoomBtn.disabled = !dataset.configGraficos.pie.enabled;
	resetZoomDiv.appendChild(resetZoomBtn);
	displayControls.push(resetZoomDiv);

	// ====== STYLING SECTION ======
	const stylingControls = [];

	const colorDiv = document.createElement('div');
	colorDiv.className = 'chart-controle';

	const colorLabel = document.createElement('label');
	colorLabel.htmlFor = 'viz-input-pie-color';
	colorLabel.textContent = t('chive-chart-control-pie-color');

	const colorInput = document.createElement('input');
	colorInput.id = 'viz-input-pie-color';
	colorInput.type = 'color';
	colorInput.className = 'chart-color-input';
	colorInput.value = normalizeHexColor(config.color, CHART_COLORS.pie);
	colorInput.disabled = !dataset.configGraficos.pie.enabled;

	colorDiv.appendChild(colorLabel);
	colorDiv.appendChild(colorInput);
	stylingControls.push(colorDiv);

	// Palette presets for quick color application
	if (sectorValues.length > 0) {
		stylingControls.push(createColorPresetControl(
			'viz-pie-color-preset',
			t('chive-chart-color-palette'),
			config.colorScheme || 'Bold',
			!dataset.configGraficos.pie.enabled
		));
	}

	// Per-slice custom color picker grid
	if (sectorValues.length > 0) {
		const colorGridElement = updatePieColorPickerGrid(dataset, sectorValues);
		stylingControls.push(colorGridElement);
	}

	// ====== Group and return all sections ======
	return groupControls([
		{ id: 'filter', title: t('chive-chart-filter-column'), controls: filterControls, expanded: true, icon: 'filter' },
		{ id: 'data', title: 'Data & Aggregation', controls: dataControls, expanded: true, icon: 'data' },
		{ id: 'display', title: 'Display', controls: displayControls, expanded: true, icon: 'display' },
		{ id: 'styling', title: 'Styling', controls: stylingControls, expanded: false, icon: 'styling' },
	]);
}

function updatePieColorPickerGrid(dataset, sectorValues) {
	return createColorPickerGridControl(
		'viz-pie-color-grid',
		t('chive-chart-color-pie-slices'),
		sectorValues,
		dataset.configGraficos.pie.customSliceColors || {},
		!dataset.configGraficos.pie.enabled,
		null
	);
}


export function setupPieChartControlListeners(dataset, basePie, numericas, allColumnsOrCallback = [], onConfigChangedMaybe) {
	const onConfigChanged = typeof allColumnsOrCallback === 'function'
		? allColumnsOrCallback
		: onConfigChangedMaybe;
	const sectorValues = getPieSectorValues(dataset, dataset.configGraficos.pie);
	const togglePie = document.getElementById('viz-toggle-pie');
	const expandPie = document.getElementById('viz-expand-pie');

	if (togglePie) {
		togglePie.addEventListener('change', () => {
			const categoriaAtual = dataset.configGraficos.pie?.category;
			const valueAtual = dataset.configGraficos.pie?.valueColumn;
			const categoriaPadrao = basePie.includes(categoriaAtual)
				? categoriaAtual
				: (basePie[0] || null);
			const valuePadrao = numericas.includes(valueAtual)
				? valueAtual
				: (numericas[0] || null);
			updateActiveDatasetChartConfig({
				pie: {
					...dataset.configGraficos.pie,
					enabled: togglePie.checked,
					category: togglePie.checked ? categoriaPadrao : categoriaAtual,
					valueColumn: togglePie.checked ? valuePadrao : valueAtual,
					expanded: togglePie.checked ? true : dataset.configGraficos.pie?.expanded === true,
				},
			});
			onConfigChanged?.();
		});
	}

	if (expandPie) {
		expandPie.addEventListener('click', () => {
			const expanded = expandPie.getAttribute('aria-expanded') === 'true';
			updateActiveDatasetChartConfig({
				pie: {
					...dataset.configGraficos.pie,
					expanded: !expanded,
				},
			});
			onConfigChanged?.();
		});
	}

	const categorySelect = document.getElementById('viz-select-pie-category');
	if (categorySelect) {
		categorySelect.addEventListener('change', () => {
			updateActiveDatasetChartConfig({
				pie: {
					...dataset.configGraficos.pie,
					category: categorySelect.value,
				},
			});
			onConfigChanged?.();
		});
	}

	const measureSelect = document.getElementById('viz-select-pie-measure');
	if (measureSelect) {
		measureSelect.addEventListener('change', () => {
			const measureMode = measureSelect.value === 'sum' ? 'sum' : 'count';
			const currentValueColumn = dataset.configGraficos.pie?.valueColumn;
			const nextValueColumn = measureMode === 'sum'
				? (numericas.includes(currentValueColumn) ? currentValueColumn : (numericas[0] || null))
				: currentValueColumn;
			updateActiveDatasetChartConfig({
				pie: {
					...dataset.configGraficos.pie,
					measureMode,
					valueColumn: nextValueColumn,
				},
			});
			onConfigChanged?.();
		});
	}

	const valueSelect = document.getElementById('viz-select-pie-value-column');
	if (valueSelect) {
		valueSelect.addEventListener('change', () => {
			updateActiveDatasetChartConfig({
				pie: {
					...dataset.configGraficos.pie,
					valueColumn: valueSelect.value || null,
				},
			});
			onConfigChanged?.();
		});
	}

	const innerSlider = document.getElementById('viz-slider-pie-inner-radius');
	const outerSlider = document.getElementById('viz-slider-pie-outer-radius');
	const padAngleSlider = document.getElementById('viz-slider-pie-pad-angle');
	const pieZoomSlider = document.getElementById('viz-slider-pie-zoom');
	const syncSliderOutput = slider => {
		const output = slider?.parentElement?.querySelector('output');
		if (output) {
			output.textContent = slider.value;
		}
	};

	if (innerSlider) {
		innerSlider.addEventListener('input', () => syncSliderOutput(innerSlider));
		innerSlider.addEventListener('change', () => {
			const outerRadius = Number(outerSlider?.value || dataset.configGraficos.pie.outerRadius || PIE_CHART.defaultOuterRadius);
			const innerRadius = Math.min(Number(innerSlider.value), Math.max(0, outerRadius - 8));
			if (String(innerRadius) !== innerSlider.value) {
				innerSlider.value = String(innerRadius);
				syncSliderOutput(innerSlider);
			}
			updateActiveDatasetChartConfig({
				pie: {
					...dataset.configGraficos.pie,
					innerRadius,
				},
			});
			onConfigChanged?.();
		});
	}

	if (outerSlider) {
		outerSlider.addEventListener('input', () => syncSliderOutput(outerSlider));
		outerSlider.addEventListener('change', () => {
			const outerRadius = Number(outerSlider.value);
			const currentInner = Number(innerSlider?.value || dataset.configGraficos.pie.innerRadius || PIE_CHART.defaultInnerRadius);
			const innerRadius = Math.min(currentInner, Math.max(0, outerRadius - 8));
			if (innerSlider && String(innerRadius) !== innerSlider.value) {
				innerSlider.value = String(innerRadius);
				syncSliderOutput(innerSlider);
			}
			updateActiveDatasetChartConfig({
				pie: {
					...dataset.configGraficos.pie,
					outerRadius,
					innerRadius,
				},
			});
			onConfigChanged?.();
		});
	}

	if (padAngleSlider) {
		padAngleSlider.addEventListener('input', () => syncSliderOutput(padAngleSlider));
		padAngleSlider.addEventListener('change', () => {
			updateActiveDatasetChartConfig({
				pie: {
					...dataset.configGraficos.pie,
					padAngle: Number(padAngleSlider.value),
				},
			});
			onConfigChanged?.();
		});
	}

	if (pieZoomSlider) {
		pieZoomSlider.addEventListener('input', () => syncSliderOutput(pieZoomSlider));
		pieZoomSlider.addEventListener('change', () => {
			updateActiveDatasetChartConfig({
				pie: {
					...dataset.configGraficos.pie,
					zoomScale: Number(pieZoomSlider.value),
				},
			});
			onConfigChanged?.();
		});
	}

	const resetPieZoomButton = document.getElementById('viz-btn-pie-reset-zoom');
	if (resetPieZoomButton) {
		resetPieZoomButton.addEventListener('click', () => {
			if (pieZoomSlider) {
				pieZoomSlider.value = String(PIE_CHART.defaultZoomScale);
				syncSliderOutput(pieZoomSlider);
			}
			updateActiveDatasetChartConfig({
				pie: {
					...dataset.configGraficos.pie,
					zoomScale: PIE_CHART.defaultZoomScale,
				},
			});
			onConfigChanged?.();
		});
	}

	const toggleCategoryLabel = document.getElementById('viz-toggle-pie-category-label');
	if (toggleCategoryLabel) {
		toggleCategoryLabel.addEventListener('change', () => {
			updateActiveDatasetChartConfig({
				pie: {
					...dataset.configGraficos.pie,
					showCategoryLabel: toggleCategoryLabel.checked,
				},
			});
			onConfigChanged?.();
		});
	}

	const toggleValueLabel = document.getElementById('viz-toggle-pie-value-label');
	if (toggleValueLabel) {
		toggleValueLabel.addEventListener('change', () => {
			updateActiveDatasetChartConfig({
				pie: {
					...dataset.configGraficos.pie,
					showValueLabel: toggleValueLabel.checked,
				},
			});
			onConfigChanged?.();
		});
	}

	const toggleLegend = document.getElementById('viz-toggle-pie-legend');
	if (toggleLegend) {
		toggleLegend.addEventListener('change', () => {
			updateActiveDatasetChartConfig({
				pie: {
					...dataset.configGraficos.pie,
					showLegend: toggleLegend.checked,
				},
			});
			onConfigChanged?.();
		});
	}

	const labelPositionSelect = document.getElementById('viz-select-pie-label-position');
	if (labelPositionSelect) {
		labelPositionSelect.addEventListener('change', () => {
			const labelPosition = labelPositionSelect.value === 'outside' ? 'outside' : 'inside';
			updateActiveDatasetChartConfig({
				pie: {
					...dataset.configGraficos.pie,
					labelPosition,
				},
			});
			onConfigChanged?.();
		});
	}

	const colorInput = document.getElementById('viz-input-pie-color');
	if (colorInput) {
		colorInput.addEventListener('change', () => {
			updateActiveDatasetChartConfig({
				pie: {
					...dataset.configGraficos.pie,
					color: normalizeHexColor(colorInput.value, CHART_COLORS.pie),
				},
			});
			onConfigChanged?.();
		});
	}

	const presetButtons = document.querySelectorAll('button[data-color-preset-control="viz-pie-color-preset"]');
	presetButtons.forEach(button => {
		button.addEventListener('click', () => {
			const presetName = button.dataset.presetName;
			const presetColors = COLOR_PRESETS[presetName] || [];
			if (presetColors.length === 0 || sectorValues.length === 0) return;

			const nextSliceColors = { ...(dataset.configGraficos.pie.customSliceColors || {}) };
			sectorValues.forEach((sector, index) => {
				nextSliceColors[sector] = presetColors[index % presetColors.length];
			});

			updateActiveDatasetChartConfig({
				pie: {
					...dataset.configGraficos.pie,
					colorScheme: presetName,
					customSliceColors: nextSliceColors,
				},
			});
			onConfigChanged?.();
		});
	});

	const perSliceInputs = document.querySelectorAll('input[data-color-grid-control="viz-pie-color-grid"]');
	perSliceInputs.forEach(input => {
		input.addEventListener('change', () => {
			const sector = input.dataset.colorItem;
			if (!sector) return;

			const nextSliceColors = { ...(dataset.configGraficos.pie.customSliceColors || {}) };
			nextSliceColors[sector] = normalizeHexColor(input.value, CHART_COLORS.pie);

			updateActiveDatasetChartConfig({
				pie: {
					...dataset.configGraficos.pie,
					customSliceColors: nextSliceColors,
				},
			});
			onConfigChanged?.();
		});
	});

	const inputPieTitle = document.getElementById('viz-input-pie-title');
	if (inputPieTitle) {
		inputPieTitle.addEventListener('change', () => {
			updateActiveDatasetChartConfig({
				pie: {
					...dataset.configGraficos.pie,
					customTitle: String(inputPieTitle.value || '').trim(),
				},
			});
			onConfigChanged?.();
		});
	}

	const sliderPieHeight = document.getElementById('viz-slider-pie-height');
	if (sliderPieHeight) {
		const syncOutput = () => {
			const output = sliderPieHeight.parentElement?.querySelector('output');
			if (output) output.textContent = sliderPieHeight.value;
		};
		sliderPieHeight.addEventListener('input', syncOutput);
		sliderPieHeight.addEventListener('change', () => {
			updateActiveDatasetChartConfig({
				pie: {
					...dataset.configGraficos.pie,
					chartHeight: Number(sliderPieHeight.value),
				},
			});
			onConfigChanged?.();
		});
	}

	setupChartFilterControlListeners({
		chartKey: 'pie',
		rows: dataset.dados,
		numericColumns: numericas,
		rawFilter: dataset.configGraficos.pie?.filter,
		onFilterChange: nextFilter => {
			updateActiveDatasetChartConfig({
				pie: {
					...dataset.configGraficos.pie,
					filter: nextFilter,
				},
			});
			onConfigChanged?.();
		},
	});
}
