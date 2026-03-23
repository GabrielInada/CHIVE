import { CHART_COLORS } from '../../config/index.js';
import { t } from '../../services/i18nService.js';
import { updateActiveDatasetChartConfig } from '../stateSync.js';
import { createCheckboxControl, createSliderControl, createTextControl, normalizeHexColor } from './shared.js';

export function createBarChartControls(dataset, categoryOptions) {
	const config = dataset.configGraficos.bar;
	const controls = [];

	const categoryDiv = document.createElement('div');
	categoryDiv.className = 'chart-controle';

	const categoryLabel = document.createElement('label');
	categoryLabel.htmlFor = 'viz-select-bar';
	categoryLabel.textContent = t('chive-chart-control-bar-category');

	const categorySelect = document.createElement('select');
	categorySelect.id = 'viz-select-bar';
	categorySelect.className = 'linhas-select';
	categorySelect.disabled = !dataset.configGraficos.bar.enabled;

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
	controls.push(categoryDiv);

	const sortDiv = document.createElement('div');
	sortDiv.className = 'chart-controle';

	const sortLabel = document.createElement('label');
	sortLabel.htmlFor = 'viz-select-bar-sort';
	sortLabel.textContent = t('chive-chart-control-bar-sort');

	const sortSelect = document.createElement('select');
	sortSelect.id = 'viz-select-bar-sort';
	sortSelect.className = 'linhas-select';
	sortSelect.disabled = !dataset.configGraficos.bar.enabled;

	const sortOptions = [
		{ value: 'count-desc', label: t('chive-chart-sort-count-desc') },
		{ value: 'count-asc', label: t('chive-chart-sort-count-asc') },
		{ value: 'label-asc', label: t('chive-chart-sort-label-asc') },
		{ value: 'label-desc', label: t('chive-chart-sort-label-desc') },
	];

	sortOptions.forEach(opt => {
		const option = document.createElement('option');
		option.value = opt.value;
		option.textContent = opt.label;
		option.selected = opt.value === config.sort;
		sortSelect.appendChild(option);
	});

	sortDiv.appendChild(sortLabel);
	sortDiv.appendChild(sortSelect);
	controls.push(sortDiv);

	const topnDiv = document.createElement('div');
	topnDiv.className = 'chart-controle';

	const topnLabel = document.createElement('label');
	topnLabel.htmlFor = 'viz-select-bar-topn';
	topnLabel.textContent = t('chive-chart-control-bar-topn');

	const topnSelect = document.createElement('select');
	topnSelect.id = 'viz-select-bar-topn';
	topnSelect.className = 'linhas-select';
	topnSelect.disabled = !dataset.configGraficos.bar.enabled;

	const topnOptions = [
		{ value: '0', label: t('chive-chart-topn-all') },
		{ value: '10', label: 'Top 10' },
		{ value: '20', label: 'Top 20' },
		{ value: '50', label: 'Top 50' },
	];

	topnOptions.forEach(opt => {
		const option = document.createElement('option');
		option.value = opt.value;
		option.textContent = opt.label;
		option.selected = String(config.topN) === opt.value;
		topnSelect.appendChild(option);
	});

	topnDiv.appendChild(topnLabel);
	topnDiv.appendChild(topnSelect);
	controls.push(topnDiv);

	controls.push(createCheckboxControl(
		'viz-toggle-bar-x-label',
		t('chive-chart-control-axis-label-x'),
		config.showXAxisLabel,
		!dataset.configGraficos.bar.enabled
	));

	controls.push(createCheckboxControl(
		'viz-toggle-bar-y-label',
		t('chive-chart-control-axis-label-y'),
		config.showYAxisLabel,
		!dataset.configGraficos.bar.enabled
	));

	controls.push(createTextControl(
		'viz-input-bar-title',
		t('chive-chart-control-common-title'),
		config.customTitle,
		80,
		!dataset.configGraficos.bar.enabled
	));

	controls.push(createSliderControl(
		'viz-slider-bar-height',
		t('chive-chart-control-common-height'),
		Number(config.chartHeight || 320),
		220,
		720,
		10,
		!dataset.configGraficos.bar.enabled
	));

	const colorDiv = document.createElement('div');
	colorDiv.className = 'chart-controle';

	const colorLabel = document.createElement('label');
	colorLabel.htmlFor = 'viz-input-bar-color';
	colorLabel.textContent = t('chive-chart-control-bar-color');

	const colorInput = document.createElement('input');
	colorInput.id = 'viz-input-bar-color';
	colorInput.type = 'color';
	colorInput.className = 'chart-color-input';
	colorInput.value = normalizeHexColor(config.color, CHART_COLORS.bar);
	colorInput.disabled = !dataset.configGraficos.bar.enabled;

	colorDiv.appendChild(colorLabel);
	colorDiv.appendChild(colorInput);
	controls.push(colorDiv);

	return controls;
}

export function setupBarChartControlListeners(dataset, baseBar, onConfigChanged) {
	const toggleBar = document.getElementById('viz-toggle-bar');
	const expandBar = document.getElementById('viz-expand-bar');

	if (toggleBar) {
		toggleBar.addEventListener('change', () => {
			const categoriaAtual = dataset.configGraficos.bar?.category;
			const categoriaPadrao = baseBar.includes(categoriaAtual)
				? categoriaAtual
				: (baseBar[0] || null);
			updateActiveDatasetChartConfig({
				bar: {
					...dataset.configGraficos.bar,
					enabled: toggleBar.checked,
					category: toggleBar.checked ? categoriaPadrao : categoriaAtual,
					expanded: toggleBar.checked ? true : dataset.configGraficos.bar?.expanded === true,
				},
			});
			onConfigChanged?.();
		});
	}

	if (expandBar) {
		expandBar.addEventListener('click', () => {
			const expanded = expandBar.getAttribute('aria-expanded') === 'true';
			updateActiveDatasetChartConfig({
				bar: {
					...dataset.configGraficos.bar,
					expanded: !expanded,
				},
			});
			onConfigChanged?.();
		});
	}

	const selectBar = document.getElementById('viz-select-bar');
	if (selectBar) {
		selectBar.addEventListener('change', () => {
			updateActiveDatasetChartConfig({
				bar: {
					...dataset.configGraficos.bar,
					category: selectBar.value,
				},
			});
			onConfigChanged?.();
		});
	}

	const selectBarSort = document.getElementById('viz-select-bar-sort');
	if (selectBarSort) {
		selectBarSort.addEventListener('change', () => {
			updateActiveDatasetChartConfig({
				bar: {
					...dataset.configGraficos.bar,
					sort: selectBarSort.value,
				},
			});
			onConfigChanged?.();
		});
	}

	const selectBarTopN = document.getElementById('viz-select-bar-topn');
	if (selectBarTopN) {
		selectBarTopN.addEventListener('change', () => {
			updateActiveDatasetChartConfig({
				bar: {
					...dataset.configGraficos.bar,
					topN: Number(selectBarTopN.value),
				},
			});
			onConfigChanged?.();
		});
	}

	const inputBarColor = document.getElementById('viz-input-bar-color');
	if (inputBarColor) {
		inputBarColor.addEventListener('change', () => {
			updateActiveDatasetChartConfig({
				bar: {
					...dataset.configGraficos.bar,
					color: normalizeHexColor(inputBarColor.value, CHART_COLORS.bar),
				},
			});
			onConfigChanged?.();
		});
	}

	const toggleBarXLabel = document.getElementById('viz-toggle-bar-x-label');
	if (toggleBarXLabel) {
		toggleBarXLabel.addEventListener('change', () => {
			updateActiveDatasetChartConfig({
				bar: {
					...dataset.configGraficos.bar,
					showXAxisLabel: toggleBarXLabel.checked,
				},
			});
			onConfigChanged?.();
		});
	}

	const toggleBarYLabel = document.getElementById('viz-toggle-bar-y-label');
	if (toggleBarYLabel) {
		toggleBarYLabel.addEventListener('change', () => {
			updateActiveDatasetChartConfig({
				bar: {
					...dataset.configGraficos.bar,
					showYAxisLabel: toggleBarYLabel.checked,
				},
			});
			onConfigChanged?.();
		});
	}

	const inputBarTitle = document.getElementById('viz-input-bar-title');
	if (inputBarTitle) {
		inputBarTitle.addEventListener('change', () => {
			updateActiveDatasetChartConfig({
				bar: {
					...dataset.configGraficos.bar,
					customTitle: String(inputBarTitle.value || '').trim(),
				},
			});
			onConfigChanged?.();
		});
	}

	const sliderBarHeight = document.getElementById('viz-slider-bar-height');
	if (sliderBarHeight) {
		const syncOutput = () => {
			const output = sliderBarHeight.parentElement?.querySelector('output');
			if (output) output.textContent = sliderBarHeight.value;
		};
		sliderBarHeight.addEventListener('input', syncOutput);
		sliderBarHeight.addEventListener('change', () => {
			updateActiveDatasetChartConfig({
				bar: {
					...dataset.configGraficos.bar,
					chartHeight: Number(sliderBarHeight.value),
				},
			});
			onConfigChanged?.();
		});
	}
}
