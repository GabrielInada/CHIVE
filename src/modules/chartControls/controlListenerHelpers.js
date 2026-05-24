/**
 * CHIVE chart-control listener helpers.
 *
 * Wires DOM elements built by `shared.js` (selects, checkboxes, sliders,
 * color inputs) to writes against the active dataset's `chartConfig`.
 * Every helper takes the dataset reference, the chart-type key, and an
 * optional `onConfigChanged` callback that fires after the state write.
 *
 * @typedef {import('../../types.js').Dataset} Dataset
 * @typedef {import('../../types.js').ChartTypeKey} ChartTypeKey
 */

import { updateActiveDatasetChartConfig } from '../state/stateSync.js';
import { normalizeActiveDatasetConfig } from '../state/appState.js';
import { normalizeHexColor } from './shared.js';
import { triggerLiveRender } from './livePreview.js';

/**
 * Build a `(partialUpdate) => void` updater that merges fields into the
 * chart-type's config block and fires the change callback.
 *
 * @private
 */
function makeUpdater(dataset, chartKey, onConfigChanged) {
	return (partialUpdate) => {
		updateActiveDatasetChartConfig({
			[chartKey]: {
				...dataset.chartConfig[chartKey],
				...partialUpdate,
			},
		});
		onConfigChanged?.();
	};
}

/**
 * Wire `change` listeners on a batch of `<select>` elements. Each entry's
 * `transform` (when present) maps the raw `value` to the stored config
 * value (e.g. parseInt, lookup table).
 *
 * @param {Array<{ id: string, key: string, transform?: (value: string) => *  }>} controls
 * @param {Dataset} dataset
 * @param {ChartTypeKey} chartKey
 * @param {(() => void) | null | undefined} onConfigChanged
 */
export function setupSelectListeners(controls, dataset, chartKey, onConfigChanged) {
	const update = makeUpdater(dataset, chartKey, onConfigChanged);
	controls.forEach(({ id, key, transform }) => {
		const el = document.getElementById(id);
		if (!el) return;
		el.addEventListener('change', () => {
			const value = transform ? transform(el.value) : el.value;
			update({ [key]: value });
		});
	});
}

/**
 * Wire `change` listeners on a batch of checkbox inputs. Stored value is
 * the checkbox's boolean `checked` state.
 *
 * @param {Array<{ id: string, key: string }>} controls
 * @param {Dataset} dataset
 * @param {ChartTypeKey} chartKey
 * @param {(() => void) | null | undefined} onConfigChanged
 */
export function setupCheckboxListeners(controls, dataset, chartKey, onConfigChanged) {
	const update = makeUpdater(dataset, chartKey, onConfigChanged);
	controls.forEach(({ id, key }) => {
		const el = document.getElementById(id);
		if (!el) return;
		el.addEventListener('change', () => {
			update({ [key]: el.checked });
		});
	});
}

/**
 * Wire a `change` listener on a single text input. Trims the value
 * before writing.
 *
 * @param {string} elementId
 * @param {string} configKey
 * @param {Dataset} dataset
 * @param {ChartTypeKey} chartKey
 * @param {(() => void) | null | undefined} onConfigChanged
 */
export function setupTextInputListener(elementId, configKey, dataset, chartKey, onConfigChanged) {
	const el = document.getElementById(elementId);
	if (!el) return;
	el.addEventListener('change', () => {
		makeUpdater(dataset, chartKey, onConfigChanged)({
			[configKey]: String(el.value || '').trim(),
		});
	});
}

/**
 * Wire a color input. Two events are wired so live painting works
 * without disrupting the picker:
 *
 *   - `input` — fires continuously while the picker is open. Goes
 *     through `normalizeActiveDatasetConfig` (the non-emitting facade
 *     path) so the state stays consistent without firing
 *     `CONFIG_UPDATED`. That event would trigger `refreshView` and
 *     rebuild the controls sidebar, stealing focus from the picker.
 *     After the write, the registered live-render callback re-paints
 *     only the chart visualizations.
 *   - `change` — fires when the picker closes. Goes through the emitting
 *     facade so `CONFIG_UPDATED` fires, the auto-save subscription
 *     debounces the write into IndexedDB, and the sidebar refreshes.
 *
 * Values are normalized via {@link normalizeHexColor} with the provided
 * `defaultColor` as the fallback.
 *
 * @param {string} elementId
 * @param {string} configKey
 * @param {string} defaultColor - Fallback for invalid hex values.
 * @param {Dataset} dataset
 * @param {ChartTypeKey} chartKey
 * @param {(() => void) | null | undefined} onConfigChanged
 */
export function setupColorInputListener(elementId, configKey, defaultColor, dataset, chartKey, onConfigChanged) {
	const el = document.getElementById(elementId);
	if (!el) return;
	el.addEventListener('input', () => {
		const next = normalizeHexColor(el.value, defaultColor);
		normalizeActiveDatasetConfig(prev => ({
			...prev,
			[chartKey]: { ...prev[chartKey], [configKey]: next },
		}));
		triggerLiveRender();
	});
	el.addEventListener('change', () => {
		makeUpdater(dataset, chartKey, onConfigChanged)({
			[configKey]: normalizeHexColor(el.value, defaultColor),
		});
	});
}

/**
 * Wire a `change` listener on a free numeric input. Falls back to
 * `defaultValue` when the parsed value is not finite (covers empty
 * strings and arbitrary garbage).
 *
 * @param {string} elementId
 * @param {string} configKey
 * @param {number} defaultValue
 * @param {Dataset} dataset
 * @param {ChartTypeKey} chartKey
 * @param {(() => void) | null | undefined} onConfigChanged
 */
export function setupNumberInputListener(elementId, configKey, defaultValue, dataset, chartKey, onConfigChanged) {
	const el = document.getElementById(elementId);
	if (!el) return;
	el.addEventListener('change', () => {
		const parsed = parseFloat(el.value);
		const next = Number.isFinite(parsed) ? parsed : defaultValue;
		makeUpdater(dataset, chartKey, onConfigChanged)({
			[configKey]: next,
		});
	});
}

/**
 * Wire a slider input. The slider's sibling `<output>` element gets
 * synced on every `input` event (for live tick display); the config
 * write goes through on `change` (when the user releases the slider).
 *
 * @param {string} elementId
 * @param {string} configKey
 * @param {Dataset} dataset
 * @param {ChartTypeKey} chartKey
 * @param {(() => void) | null | undefined} onConfigChanged
 */
export function setupSliderListener(elementId, configKey, dataset, chartKey, onConfigChanged) {
	const el = document.getElementById(elementId);
	if (!el) return;

	const syncOutput = () => {
		const output = el.parentElement?.querySelector('output');
		if (output) output.textContent = el.value;
	};

	el.addEventListener('input', syncOutput);
	el.addEventListener('change', () => {
		makeUpdater(dataset, chartKey, onConfigChanged)({
			[configKey]: Number(el.value),
		});
	});
}

/**
 * Wire `change`/`input` listeners on a batch of sliders.
 *
 * @param {Array<{ id: string, key: string }>} controls
 * @param {Dataset} dataset
 * @param {ChartTypeKey} chartKey
 * @param {(() => void) | null | undefined} onConfigChanged
 */
export function setupSliderListeners(controls, dataset, chartKey, onConfigChanged) {
	controls.forEach(({ id, key }) => {
		setupSliderListener(id, key, dataset, chartKey, onConfigChanged);
	});
}

/**
 * Wire click listeners on color-preset buttons. Each button's click
 * writes the corresponding palette positions to the config keys named
 * in `colorKeys`.
 *
 * `colorKeys` maps config keys → palette indices. Negative indices count
 * from the end (`-1` = last color), matching JS slice semantics.
 *
 * @example
 *   setupColorPresetListeners('bar-color', { color: 0, gradientMaxColor: -1 }, …);
 *
 * @param {string} controlId
 * @param {Object<string, number>} colorKeys
 * @param {Object<string, string>} defaultColors - Fallback per config key when the palette lookup fails.
 * @param {Dataset} dataset
 * @param {ChartTypeKey} chartKey
 * @param {(() => void) | null | undefined} onConfigChanged
 * @param {Object<string, string[]>} COLOR_PRESETS - Palette name → color array.
 */
export function setupColorPresetListeners(controlId, colorKeys, defaultColors, dataset, chartKey, onConfigChanged, COLOR_PRESETS) {
	const update = makeUpdater(dataset, chartKey, onConfigChanged);
	const buttons = document.querySelectorAll(`button[data-color-preset-control="${controlId}"]`);
	buttons.forEach(button => {
		button.addEventListener('click', () => {
			const presetName = button.dataset.presetName;
			const palette = COLOR_PRESETS[presetName] || [];
			if (palette.length === 0) return;

			const partial = { colorScheme: presetName };
			Object.entries(colorKeys).forEach(([key, paletteIndex]) => {
				const idx = paletteIndex < 0 ? palette.length + paletteIndex : paletteIndex;
				partial[key] = normalizeHexColor(palette[idx], defaultColors[key] || palette[0]);
			});
			update(partial);
		});
	});
}
