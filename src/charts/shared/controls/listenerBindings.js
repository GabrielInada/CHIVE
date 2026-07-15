/**
 * CHIVE chart-control listener bindings.
 *
 * Wires DOM elements built by the shared control factories
 * (`charts/shared/controls/factories.js`) to a {@link ChartConfigWriter}.
 *
 * These helpers are pure input mechanics: they read DOM values, normalize them,
 * and hand the result to the injected writer. They hold no state knowledge and
 * no reference to the dataset or chart key, which is what keeps them (and the
 * chart packages that call them) independent of `state/` and `features/`. The
 * writer is built per chart type by
 * `features/datasetWorkspace/chartControls/chartConfigAdapter.js` and arrives
 * through the controls registry.
 *
 * @typedef {import('../../../types.js').ChartConfigWriter} ChartConfigWriter
 */

import { normalizeHexColor } from '../../../utils/colorUtils.js';

/**
 * Wire `change` listeners on a batch of `<select>` elements. Each entry's
 * `transform` (when present) maps the raw `value` to the stored config
 * value (e.g. parseInt, lookup table).
 *
 * @param {Array<{ id: string, key: string, transform?: (value: string) => * }>} controls
 * @param {ChartConfigWriter} writer
 */
export function setupSelectListeners(controls, writer) {
	controls.forEach(({ id, key, transform }) => {
		const el = document.getElementById(id);
		if (!el) return;
		el.addEventListener('change', () => {
			const value = transform ? transform(el.value) : el.value;
			writer.commit({ [key]: value });
		});
	});
}

/**
 * Wire `change` listeners on a batch of checkbox inputs. Stored value is
 * the checkbox's boolean `checked` state.
 *
 * @param {Array<{ id: string, key: string }>} controls
 * @param {ChartConfigWriter} writer
 */
export function setupCheckboxListeners(controls, writer) {
	controls.forEach(({ id, key }) => {
		const el = document.getElementById(id);
		if (!el) return;
		el.addEventListener('change', () => {
			writer.commit({ [key]: el.checked });
		});
	});
}

/**
 * Wire a `change` listener on a single text input. Trims the value
 * before writing.
 *
 * @param {string} elementId
 * @param {string} configKey
 * @param {ChartConfigWriter} writer
 */
export function setupTextInputListener(elementId, configKey, writer) {
	const el = document.getElementById(elementId);
	if (!el) return;
	el.addEventListener('change', () => {
		writer.commit({ [configKey]: String(el.value || '').trim() });
	});
}

/**
 * Wire a color input. Two events are wired so live painting works
 * without disrupting the picker:
 *
 *   - `input`, fires continuously while the picker is open, and goes through
 *     {@link ChartConfigWriter#preview}: the non-emitting path, which repaints
 *     only the chart. Emitting here would refresh the view and rebuild the
 *     controls sidebar, stealing focus from the open picker.
 *   - `change`, fires when the picker closes, and goes through
 *     {@link ChartConfigWriter#commit} so `CONFIG_UPDATED` fires, the auto-save
 *     controller marks the project dirty, and the sidebar refreshes.
 *
 * Values are normalized via {@link normalizeHexColor} with the provided
 * `defaultColor` as the fallback.
 *
 * @param {string} elementId
 * @param {string} configKey
 * @param {string} defaultColor - Fallback for invalid hex values.
 * @param {ChartConfigWriter} writer
 */
export function setupColorInputListener(elementId, configKey, defaultColor, writer) {
	const el = document.getElementById(elementId);
	if (!el) return;
	el.addEventListener('input', () => {
		writer.preview({ [configKey]: normalizeHexColor(el.value, defaultColor) });
	});
	el.addEventListener('change', () => {
		writer.commit({ [configKey]: normalizeHexColor(el.value, defaultColor) });
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
 * @param {ChartConfigWriter} writer
 */
export function setupNumberInputListener(elementId, configKey, defaultValue, writer) {
	const el = document.getElementById(elementId);
	if (!el) return;
	el.addEventListener('change', () => {
		const parsed = parseFloat(el.value);
		writer.commit({ [configKey]: Number.isFinite(parsed) ? parsed : defaultValue });
	});
}

/**
 * Wire a slider input. The slider's sibling `<output>` element gets
 * synced on every `input` event (for live tick display); the config
 * write goes through on `change` (when the user releases the slider).
 *
 * @param {string} elementId
 * @param {string} configKey
 * @param {ChartConfigWriter} writer
 */
export function setupSliderListener(elementId, configKey, writer) {
	const el = document.getElementById(elementId);
	if (!el) return;

	const syncOutput = () => {
		const output = el.parentElement?.querySelector('output');
		if (output) output.textContent = el.value;
	};

	el.addEventListener('input', syncOutput);
	el.addEventListener('change', () => {
		writer.commit({ [configKey]: Number(el.value) });
	});
}

/**
 * Wire `change`/`input` listeners on a batch of sliders.
 *
 * @param {Array<{ id: string, key: string }>} controls
 * @param {ChartConfigWriter} writer
 */
export function setupSliderListeners(controls, writer) {
	controls.forEach(({ id, key }) => {
		setupSliderListener(id, key, writer);
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
 * @param {ChartConfigWriter} writer
 * @param {Object<string, string[]>} COLOR_PRESETS - Palette name → color array.
 */
export function setupColorPresetListeners(controlId, colorKeys, defaultColors, writer, COLOR_PRESETS) {
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
			writer.commit(partial);
		});
	});
}
