/**
 * Pie controls written by hand, for the ones no shared widget covers:
 *
 * - the radius sliders, which keep the inner radius below the outer one;
 * - the palette, which colors the sectors in order, repeating the palette;
 * - the slice grid, one color picker per sector.
 *
 * Each is the `build` of a `custom` description in `descriptions.js`. It
 * creates its elements with the shared factories and wires them itself, so
 * nothing is looked up in the document.
 *
 * Slice colors persist as `config.customSliceColors[categoryKey]`. The palette
 * and the grid list every category over all dataset rows; the grid shows each
 * sector's drawn color, which comes from the rows the chart draws
 * (`ChartControlContext.rows`).
 *
 * @typedef {import('../../../types.js').CustomControlScope} CustomControlScope
 */

import { CHART_COLORS } from '../../../config/charts/definitions.js';
import { PIE_CHART } from '../../../config/charts/definitions/pie.js';
import { normalizeHexColor } from '../../../utils/colorUtils.js';
import {
	createColorPickerGridControl,
	createColorPresetControl,
	createSliderControl,
	findAppliedColorPreset,
} from '../../shared/controls/factories.js';
import { getPieSectorValues, getPieSwatchColors } from './sectorValues.js';

// How far the inner radius stays below the outer one.
const RADIUS_GAP = 8;

/** @param {HTMLInputElement} slider */
function syncSliderOutput(slider) {
	const output = slider.parentElement?.querySelector('output');
	if (output) output.textContent = slider.value;
}

/**
 * The inner and outer radius sliders. A change commits the inner radius
 * clamped to stay below the other slider's position, and moves the inner
 * slider when the clamp changed it.
 *
 * @param {CustomControlScope} scope
 * @returns {HTMLElement[]}
 */
export function buildRadiusSliders({ config, readConfig, writer, translate, disabled }) {
	const innerControl = createSliderControl(
		'viz-slider-pie-inner-radius',
		translate('chive-chart-control-pie-inner-radius'),
		Number(config.innerRadius),
		PIE_CHART.minInnerRadius,
		PIE_CHART.maxOuterRadius - RADIUS_GAP,
		1,
		disabled,
	);
	const outerControl = createSliderControl(
		'viz-slider-pie-outer-radius',
		translate('chive-chart-control-pie-outer-radius'),
		Number(config.outerRadius),
		PIE_CHART.minOuterRadius,
		PIE_CHART.maxOuterRadius,
		1,
		disabled,
	);
	const innerSlider = innerControl.querySelector('input');
	const outerSlider = outerControl.querySelector('input');
	const clampInner = (innerRadius, outerRadius) => {
		const clamped = Math.min(innerRadius, Math.max(0, outerRadius - RADIUS_GAP));
		if (String(clamped) !== innerSlider.value) {
			innerSlider.value = String(clamped);
			syncSliderOutput(innerSlider);
		}
		return clamped;
	};

	innerSlider.addEventListener('input', () => syncSliderOutput(innerSlider));
	innerSlider.addEventListener('change', () => {
		const outerRadius = Number(outerSlider.value || readConfig().outerRadius || PIE_CHART.defaultOuterRadius);
		writer.commit({ innerRadius: clampInner(Number(innerSlider.value), outerRadius) });
	});

	outerSlider.addEventListener('input', () => syncSliderOutput(outerSlider));
	outerSlider.addEventListener('change', () => {
		const outerRadius = Number(outerSlider.value);
		const innerRadius = Number(innerSlider.value || readConfig().innerRadius || PIE_CHART.defaultInnerRadius);
		writer.commit({ outerRadius, innerRadius: clampInner(innerRadius, outerRadius) });
	});

	return [innerControl, outerControl];
}

/**
 * The palette buttons, shown while the chart has sectors to color. A button
 * colors the sectors in their aggregate order, repeating the palette, and
 * keeps the colors of categories it does not list. A palette stays marked
 * only while every sector keeps the color it got.
 *
 * @param {CustomControlScope} scope
 * @returns {HTMLElement[]}
 */
export function buildSlicePalette({ dataset, config, readConfig, writer, translate, disabled }) {
	const sectorValues = getPieSectorValues(dataset.rows, config);
	if (sectorValues.length === 0) return [];

	const slicePositions = Object.fromEntries(sectorValues.map(({ key }, index) => [key, index]));
	return [createColorPresetControl(
		'viz-pie-color-preset',
		translate('chive-chart-color-palette'),
		findAppliedColorPreset(config.customSliceColors, slicePositions),
		disabled,
		translate,
		(presetName, presetColors) => {
			// WHY: build the colors as own keys. Assigning one to a category
			// named `__proto__` would call the prototype setter, which ignores
			// a string, and the category would lose its color.
			const presetSliceColors = Object.fromEntries(sectorValues.map(({ key }, index) => [
				key,
				presetColors[index % presetColors.length],
			]));
			writer.commit({
				colorScheme: presetName,
				customSliceColors: {
					...(readConfig().customSliceColors || {}),
					...presetSliceColors,
				},
			});
		},
	)];
}

/**
 * The slice grid, shown while the chart has sectors to color: one color
 * picker per sector, showing the color the chart draws it with. A picker
 * previews while it is open and commits when it closes.
 *
 * @param {CustomControlScope} scope
 * @returns {HTMLElement[]}
 */
export function buildSliceColorGrid({ dataset, config, readConfig, context, writer, translate, disabled }) {
	const sectorValues = getPieSectorValues(dataset.rows, config, { missingLabel: translate('chive-chart-filter-missing') });
	if (sectorValues.length === 0) return [];

	const grid = createColorPickerGridControl(
		'viz-pie-color-grid',
		translate('chive-chart-color-pie-slices'),
		sectorValues,
		getPieSwatchColors(context.rows, config),
		disabled,
		null,
	);
	grid.querySelectorAll('input[data-color-grid-control="viz-pie-color-grid"]').forEach(input => {
		// Preview writes skip the sidebar rebuild, so the open picker keeps focus.
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
			// A computed key, as in the preview above, so a category named
			// `__proto__` keeps its color.
			writer.commit({
				customSliceColors: {
					...(readConfig().customSliceColors || {}),
					[sector]: normalizeHexColor(input.value, CHART_COLORS.pie),
				},
			});
		});
	});
	return [grid];
}
