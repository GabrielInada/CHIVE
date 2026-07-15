/**
 * Pie-chart control listeners.
 *
 * Wires every pie-chart control: the `measureMode` <-> `valueColumn`
 * dependency, the inner/outer radius cross-constraint, the Reset Zoom button,
 * the palette-preset -> per-slice color mapping, and the per-slice color picker
 * grid (live `input` writes via the non-emitting facade, `change` commits
 * through the emitting facade).
 *
 * @typedef {import('../../../types.js').Dataset} Dataset
 * @typedef {import('../../../types.js').ChartConfigWriter} ChartConfigWriter
 */

import { CHART_COLORS, PIE_CHART } from '../../../config/charts.js';
import { COLOR_PRESETS, normalizeHexColor } from '../../shared/controls/factories.js';
import {
	setupSelectListeners,
	setupCheckboxListeners,
	setupTextInputListener,
	setupColorInputListener,
	setupSliderListeners,
} from '../../shared/controls/listenerBindings.js';
import { getPieSectorValues } from './sectorValues.js';

/**
 * Wire listeners for every pie-chart control. Handles cross-constraints
 * between inner/outer radius sliders, the `measureMode` ↔ `valueColumn`
 * dependency, the Reset Zoom button, palette-preset → per-slice color
 * mapping, and per-slice color picker grid (live `input` writes via the
 * non-emitting facade, `change` commits through the emitting facade).
 *
 * @param {Dataset} dataset
 * @param {string[]} basePie - Categorical (or fallback "all") column names; kept for parity.
 * @param {string[]} numeric - Numeric column names; used to validate the value-column select.
 * @param {string[]} allColumns - Visible column names.
 * @param {ChartConfigWriter} writer
 * @returns {void}
 */
export function setupPieChartControlListeners(dataset, basePie, numeric, allColumns, writer) {
	const sectorValues = getPieSectorValues(dataset, dataset.chartConfig.pie);

	setupSelectListeners([
		{ id: 'viz-select-pie-category', key: 'category' },
		{ id: 'viz-select-pie-value-column', key: 'valueColumn', transform: v => v || null },
		{ id: 'viz-select-pie-label-position', key: 'labelPosition', transform: v => v === 'outside' ? 'outside' : 'inside' },
		{ id: 'viz-select-pie-topn', key: 'topN', transform: v => Number(v) },
		{ id: 'viz-select-pie-topn-mode', key: 'topNMode', transform: v => v === 'truncate' ? 'truncate' : 'other' },
	], writer);

	// Measure select (custom: updates valueColumn dependency)
	const measureSelect = document.getElementById('viz-select-pie-measure');
	if (measureSelect) {
		measureSelect.addEventListener('change', () => {
			const measureMode = measureSelect.value === 'sum' ? 'sum' : 'count';
			const currentValueColumn = dataset.chartConfig.pie?.valueColumn;
			const nextValueColumn = measureMode === 'sum'
				? (numeric.includes(currentValueColumn) ? currentValueColumn : (numeric[0] || null))
				: currentValueColumn;
			writer.commit({
				measureMode,
				valueColumn: nextValueColumn,
			});
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
			writer.commit({ innerRadius });
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
			writer.commit({ outerRadius, innerRadius });
		});
	}

	setupSliderListeners([
		{ id: 'viz-slider-pie-pad-angle', key: 'padAngle' },
		{ id: 'viz-slider-pie-zoom', key: 'zoomScale' },
	], writer);

	// Reset zoom button (custom: resets slider DOM + config)
	const pieZoomSlider = document.getElementById('viz-slider-pie-zoom');
	const resetPieZoomButton = document.getElementById('viz-btn-pie-reset-zoom');
	if (resetPieZoomButton) {
		resetPieZoomButton.addEventListener('click', () => {
			if (pieZoomSlider) {
				pieZoomSlider.value = String(PIE_CHART.defaultZoomScale);
				syncSliderOutput(pieZoomSlider);
			}
			writer.commit({
				zoomScale: PIE_CHART.defaultZoomScale,
			});
		});
	}

	setupCheckboxListeners([
		{ id: 'viz-toggle-pie-category-label', key: 'showCategoryLabel' },
		{ id: 'viz-toggle-pie-value-label', key: 'showValueLabel' },
		{ id: 'viz-toggle-pie-legend', key: 'showLegend' },
	], writer);

	setupColorInputListener('viz-input-pie-color', 'color', CHART_COLORS.pie, writer);
	setupTextInputListener('viz-input-pie-title', 'customTitle', writer);

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

			writer.commit({
				colorScheme: presetName,
				customSliceColors: nextSliceColors,
			});
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
			writer.preview(current => ({
				customSliceColors: {
					...(current.customSliceColors || {}),
					[sector]: next,
				},
			}));
		});
		input.addEventListener('change', () => {
			const sector = input.dataset.colorItem;
			if (!sector) return;

			const nextSliceColors = { ...(dataset.chartConfig.pie.customSliceColors || {}) };
			nextSliceColors[sector] = normalizeHexColor(input.value, CHART_COLORS.pie);

			writer.commit({
				customSliceColors: nextSliceColors,
			});
		});
	});
}
