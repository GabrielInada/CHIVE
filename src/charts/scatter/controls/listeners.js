/**
 * Scatter-plot control listeners.
 *
 * Wires every scatter control's listener after the DOM is mounted. The X/Y
 * axis selects carry custom listeners that lock the corresponding scale to
 * `'linear'` when the user picks a non-numeric column; colorMode and the
 * regression mode also have cross-dependency logic that updates sibling fields.
 * All config writes go through the shared chart-control adapters
 * (`commitChartConfigPatch`, `previewChartConfigPatch`), so the package never
 * imports application state.
 *
 * @typedef {import('../../../types.js').Dataset} Dataset
 * @typedef {import('../../../types.js').ChartConfigWriter} ChartConfigWriter
 */

import { CHART_COLORS } from '../../../config/charts.js';
import { normalizeHexColor, COLOR_PRESETS } from '../../shared/controls/factories.js';
import {
	setupSelectListeners,
	setupCheckboxListeners,
	setupTextInputListener,
	setupColorInputListener,
	setupSliderListener,
	setupColorPresetListeners,
} from '../../shared/controls/listenerBindings.js';

/**
 * Wire listeners for every scatter-plot control. The X/Y axis selects have
 * custom listeners that lock the corresponding scale to `'linear'` when
 * the user picks a non-numeric column.
 *
 * @param {Dataset} dataset
 * @param {string[]} numeric
 * @param {string[]} allOptions
 * @param {ChartConfigWriter} writer
 * @returns {void}
 */
export function setupScatterPlotControlListeners(dataset, numeric, allOptions, writer) {
	const categorical = allOptions.filter(option => !numeric.includes(option));

	const attachAxisListener = (selectId, axisKey, scaleKey) => {
		const select = document.getElementById(selectId);
		if (!select) return;
		select.addEventListener('change', () => {
			const selected = allOptions.includes(select.value) ? select.value : null;
			const currentScale = dataset.chartConfig.scatter?.[scaleKey] === 'log' ? 'log' : 'linear';
			writer.commit({
				[axisKey]: selected,
				[scaleKey]: numeric.includes(selected) ? currentScale : 'linear',
			});
		});
	};

	attachAxisListener('viz-select-x', 'x', 'xScale');
	attachAxisListener('viz-select-y', 'y', 'yScale');

	// Simple selects (no cross-dependency logic)
	setupSelectListeners([
		{
			id: 'viz-select-scatter-xscale',
			key: 'xScale',
			transform: v => (numeric.includes(dataset.chartConfig.scatter?.x) && v === 'log' ? 'log' : 'linear'),
		},
		{
			id: 'viz-select-scatter-yscale',
			key: 'yScale',
			transform: v => (numeric.includes(dataset.chartConfig.scatter?.y) && v === 'log' ? 'log' : 'linear'),
		},
		{ id: 'viz-select-scatter-radius', key: 'radius', transform: v => Number(v) },
		{ id: 'viz-select-scatter-opacity', key: 'opacity', transform: v => Number(v) },
		{
			id: 'viz-select-scatter-size-mode',
			key: 'sizeMode',
			transform: v => (v === 'numeric' ? 'numeric' : 'uniform'),
		},
		{
			id: 'viz-select-scatter-size-field',
			key: 'sizeField',
			transform: v => (numeric.includes(v) ? v : null),
		},
		{
			id: 'viz-select-scatter-categorical-mode',
			key: 'categoricalPairMode',
			transform: value => (value === 'aggregate' ? 'aggregate' : 'jitter'),
		},
		{ id: 'viz-select-scatter-color-field', key: 'colorField', transform: v => v || null },
		{ id: 'viz-select-scatter-color-scheme', key: 'colorScheme' },
	], writer);

	// colorMode needs custom logic (updates colorField/colorFieldType)
	const colorModeSelect = document.getElementById('viz-select-scatter-color-mode');
	if (colorModeSelect) {
		colorModeSelect.addEventListener('change', () => {
			const value = colorModeSelect.value;
			const availableFields = value === 'category' ? categorical : numeric;
			const currentField = dataset.chartConfig.scatter.colorField;
			const currentRegression = dataset.chartConfig.scatter.regression || {};
			const nextRegressionMode = value === 'category' ? currentRegression.mode : 'overall';
			writer.commit({
				colorMode: value === 'uniform' ? 'uniform' : value,
				colorField: value === 'uniform'
					? null
					: (availableFields.includes(currentField) ? currentField : (availableFields[0] || null)),
				colorFieldType: value === 'category' ? 'category' : (value === 'numeric' ? 'numeric' : null),
				regression: { ...currentRegression, mode: nextRegressionMode || 'overall' },
			});
		});
	}

	// Scatter color input (custom: sets colorMode to uniform)
	const inputScatterColor = document.getElementById('viz-input-scatter-color');
	if (inputScatterColor) {
		inputScatterColor.addEventListener('input', () => {
			writer.preview({
				colorMode: 'uniform',
				colorField: null,
				colorFieldType: null,
				color: normalizeHexColor(inputScatterColor.value, CHART_COLORS.scatter),
			});
		});
		inputScatterColor.addEventListener('change', () => {
			writer.commit({
				colorMode: 'uniform',
				colorField: null,
				colorFieldType: null,
				color: normalizeHexColor(inputScatterColor.value, CHART_COLORS.scatter),
			});
		});
	}

	setupColorInputListener('viz-input-scatter-gradient-min', 'gradientMinColor', CHART_COLORS.scatter, writer);
	setupColorInputListener('viz-input-scatter-gradient-max', 'gradientMaxColor', '#ffffff', writer);
	setupSelectListeners([
		{ id: 'viz-select-scatter-gradient-distribution', key: 'gradientDistribution', transform: v =>
			['value', 'rank'].includes(v) ? v : 'value' },
	], writer);

	setupColorPresetListeners('viz-scatter-color-preset', {
		color: 0, gradientMinColor: 0, gradientMaxColor: -1,
	}, {
		color: CHART_COLORS.scatter, gradientMinColor: CHART_COLORS.scatter, gradientMaxColor: '#ffffff',
	}, writer, COLOR_PRESETS);

	setupCheckboxListeners([
		{ id: 'viz-toggle-scatter-x-label', key: 'showXAxisLabel' },
		{ id: 'viz-toggle-scatter-y-label', key: 'showYAxisLabel' },
	], writer);

	setupTextInputListener('viz-input-scatter-title', 'customTitle', writer);
	setupSliderListener('viz-slider-scatter-size-min', 'sizeMin', writer);
	setupSliderListener('viz-slider-scatter-size-max', 'sizeMax', writer);

	const updateRegression = patch => {
		const currentRegression = dataset.chartConfig.scatter?.regression || {};
		writer.commit({
			regression: { ...currentRegression, ...patch },
		});
	};

	const attachRegressionCheckbox = (id, key) => {
		const el = document.getElementById(id);
		if (!el) return;
		el.addEventListener('change', () => {
			updateRegression({ [key]: Boolean(el.checked) });
		});
	};

	attachRegressionCheckbox('viz-toggle-scatter-regression-enabled', 'enabled');
	attachRegressionCheckbox('viz-toggle-scatter-regression-ci', 'showCI');
	attachRegressionCheckbox('viz-toggle-scatter-regression-equation', 'showEquation');
	attachRegressionCheckbox('viz-toggle-scatter-regression-r2', 'showR2');

	const regressionModeSelect = document.getElementById('viz-select-scatter-regression-mode');
	if (regressionModeSelect) {
		regressionModeSelect.addEventListener('change', () => {
			const value = regressionModeSelect.value === 'perCategory' ? 'perCategory' : 'overall';
			const currentScatter = dataset.chartConfig.scatter || {};
			const patch = {
				regression: { ...(currentScatter.regression || {}), mode: value },
			};
			if (value === 'perCategory') {
				const needsField = currentScatter.colorMode !== 'category' || !currentScatter.colorField;
				if (needsField) {
					const firstCategorical = categorical[0] || null;
					if (firstCategorical) {
						patch.colorMode = 'category';
						patch.colorField = firstCategorical;
						patch.colorFieldType = 'category';
					}
				}
			}
			writer.commit(patch);
		});
	}
}
