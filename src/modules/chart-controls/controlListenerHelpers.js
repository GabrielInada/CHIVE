import { updateActiveDatasetChartConfig } from '../stateSync.js';
import { normalizeHexColor } from './shared.js';

/**
 * Create a config updater function for a given chart key.
 * Returns a function that merges partial updates into the current chart config.
 */
function makeUpdater(dataset, chartKey, onConfigChanged) {
	return (partialUpdate) => {
		updateActiveDatasetChartConfig({
			[chartKey]: {
				...dataset.configGraficos[chartKey],
				...partialUpdate,
			},
		});
		onConfigChanged?.();
	};
}

/**
 * Setup expand button listener for a chart section.
 */
export function setupExpandListener(elementId, dataset, chartKey, onConfigChanged) {
	const el = document.getElementById(elementId);
	if (!el) return;
	el.addEventListener('click', () => {
		const expanded = el.getAttribute('aria-expanded') === 'true';
		makeUpdater(dataset, chartKey, onConfigChanged)({ expanded: !expanded });
	});
}

/**
 * Batch setup select control listeners.
 * Each entry: { id, key, transform? }
 * - id: DOM element ID
 * - key: config property name to update
 * - transform: optional fn(value) => transformed value (default: identity)
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
 * Batch setup checkbox toggle listeners.
 * Each entry: { id, key }
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
 * Setup a text input listener that trims the value.
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
 * Setup a color input listener with hex normalization.
 */
export function setupColorInputListener(elementId, configKey, defaultColor, dataset, chartKey, onConfigChanged) {
	const el = document.getElementById(elementId);
	if (!el) return;
	el.addEventListener('change', () => {
		makeUpdater(dataset, chartKey, onConfigChanged)({
			[configKey]: normalizeHexColor(el.value, defaultColor),
		});
	});
}

/**
 * Setup a slider with output sync and config update.
 * The slider's sibling <output> element gets synced on input.
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
 * Batch setup slider listeners.
 * Each entry: { id, key }
 */
export function setupSliderListeners(controls, dataset, chartKey, onConfigChanged) {
	controls.forEach(({ id, key }) => {
		setupSliderListener(id, key, dataset, chartKey, onConfigChanged);
	});
}

/**
 * Setup color preset button listeners.
 * colorKeys maps preset palette positions to config keys:
 *   { color: 0, gradientMinColor: 0, gradientMaxColor: -1 }
 *   where 0 = first palette color, -1 = last palette color
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
