// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
	setupCheckboxListeners,
	setupColorInputListener,
	setupColorPresetListeners,
	setupNumberInputListener,
	setupSelectListeners,
	setupSliderListener,
	setupSliderListeners,
	setupTextInputListener,
} from '../../../../src/charts/shared/controls/listenerBindings.js';

/**
 * Writer test double. These bindings are pure input mechanics: their whole
 * contract is which patch reaches which writer method. Merging the patch into
 * state, firing onConfigChanged, and live-rendering belong to the adapter and
 * are covered by
 * tests/features/datasetWorkspace/chartControls/chartConfigAdapter.test.js.
 */
function createWriter() {
	return { commit: vi.fn(), preview: vi.fn() };
}

describe('listenerBindings setupColorInputListener', () => {
	beforeEach(() => {
		document.body.innerHTML = '<input id="viz-input-bar-color" type="color" value="#000000">';
	});

	it('previews on input without committing, so the open picker keeps focus', () => {
		const writer = createWriter();
		setupColorInputListener('viz-input-bar-color', 'color', '#abcdef', writer);

		const input = document.getElementById('viz-input-bar-color');
		input.value = '#ff0000';
		input.dispatchEvent(new Event('input'));

		// A commit here would emit CONFIG_UPDATED, rebuild the sidebar, and steal
		// focus from the picker mid-drag.
		expect(writer.commit).not.toHaveBeenCalled();
		expect(writer.preview).toHaveBeenCalledTimes(1);
		expect(writer.preview.mock.calls[0][0].color.toLowerCase()).toBe('#ff0000');
	});

	it('commits on the change event', () => {
		const writer = createWriter();
		setupColorInputListener('viz-input-bar-color', 'color', '#abcdef', writer);

		const input = document.getElementById('viz-input-bar-color');
		input.value = '#00ff00';
		input.dispatchEvent(new Event('change'));

		expect(writer.commit).toHaveBeenCalledTimes(1);
		expect(writer.commit.mock.calls[0][0].color.toLowerCase()).toBe('#00ff00');
	});

	it('falls back to the default color when the input value is not a valid hex', () => {
		const writer = createWriter();
		setupColorInputListener('viz-input-bar-color', 'color', '#abcdef', writer);

		const input = document.getElementById('viz-input-bar-color');
		// jsdom sanitizes the value automatically, but we can override directly.
		Object.defineProperty(input, 'value', { value: 'not-a-color', configurable: true });
		input.dispatchEvent(new Event('input'));

		expect(writer.preview.mock.calls[0][0].color).toBe('#abcdef');
	});

	it('is a no-op when the element is absent', () => {
		const writer = createWriter();
		expect(() => setupColorInputListener('missing-color', 'color', '#abcdef', writer)).not.toThrow();
		expect(writer.commit).not.toHaveBeenCalled();
		expect(writer.preview).not.toHaveBeenCalled();
	});
});

describe('listenerBindings generic listeners', () => {
	beforeEach(() => {
		document.body.innerHTML = `
			<select id="select-mode"><option value="7">7</option></select>
			<input id="check-enabled" type="checkbox">
			<input id="title-input" value="  Chart title  ">
			<input id="number-input" value="12.5">
			<label><input id="slider-input" type="range" value="42"><output>0</output></label>
			<input id="slider-no-output" type="range" value="9">
			<button data-color-preset-control="bar-colors" data-preset-name="warm" type="button"></button>
			<button data-color-preset-control="bar-colors" data-preset-name="empty" type="button"></button>
			<button data-color-preset-control="bar-colors" data-preset-name="missing" type="button"></button>
		`;
	});

	it('wires select, checkbox, and text inputs with transforms, skipping absent elements', () => {
		const writer = createWriter();

		setupSelectListeners([
			{ id: 'select-mode', key: 'mode', transform: value => Number(value) },
			{ id: 'missing-select', key: 'missing' },
		], writer);
		setupCheckboxListeners([
			{ id: 'check-enabled', key: 'enabled' },
			{ id: 'missing-check', key: 'missing' },
		], writer);
		setupTextInputListener('title-input', 'title', writer);
		setupTextInputListener('missing-title', 'title', writer);

		document.getElementById('select-mode').dispatchEvent(new Event('change'));
		document.getElementById('check-enabled').checked = true;
		document.getElementById('check-enabled').dispatchEvent(new Event('change'));
		document.getElementById('title-input').dispatchEvent(new Event('change'));

		expect(writer.commit.mock.calls[0][0]).toEqual({ mode: 7 });
		expect(writer.commit.mock.calls[1][0]).toEqual({ enabled: true });
		expect(writer.commit.mock.calls[2][0]).toEqual({ title: 'Chart title' });
		expect(writer.commit).toHaveBeenCalledTimes(3);
	});

	it('wires number inputs with finite parsing and default fallback', () => {
		const writer = createWriter();
		setupNumberInputListener('number-input', 'size', 5, writer);
		setupNumberInputListener('missing-number', 'size', 5, writer);

		const input = document.getElementById('number-input');
		input.dispatchEvent(new Event('change'));
		expect(writer.commit.mock.calls.at(-1)[0].size).toBe(12.5);

		input.value = 'not numeric';
		input.dispatchEvent(new Event('change'));
		expect(writer.commit.mock.calls.at(-1)[0].size).toBe(5);
		expect(writer.commit).toHaveBeenCalledTimes(2);
	});

	it('wires sliders, syncs sibling outputs, and supports batched sliders', () => {
		const writer = createWriter();
		setupSliderListener('slider-input', 'height', writer);
		setupSliderListener('missing-slider', 'height', writer);
		setupSliderListeners([{ id: 'slider-no-output', key: 'size' }], writer);

		const slider = document.getElementById('slider-input');
		slider.value = '77';
		slider.dispatchEvent(new Event('input'));
		expect(slider.parentElement.querySelector('output').textContent).toBe('77');
		slider.dispatchEvent(new Event('change'));
		expect(writer.commit.mock.calls.at(-1)[0].height).toBe(77);

		const noOutput = document.getElementById('slider-no-output');
		noOutput.value = '13';
		noOutput.dispatchEvent(new Event('input'));
		noOutput.dispatchEvent(new Event('change'));
		expect(writer.commit.mock.calls.at(-1)[0].size).toBe(13);
	});

	it('applies color preset buttons and ignores empty or missing palettes', () => {
		const writer = createWriter();
		setupColorPresetListeners(
			'bar-colors',
			{ color: 0, gradientMaxColor: -1, fallbackColor: 99 },
			{ fallbackColor: '#123456' },
			writer,
			{
				warm: ['#111111', 'not-a-color', '#eeeeee'],
				empty: [],
			},
		);

		document.querySelector('[data-preset-name="warm"]').click();
		expect(writer.commit.mock.calls.at(-1)[0]).toEqual(expect.objectContaining({
			colorScheme: 'warm',
			color: '#111111',
			gradientMaxColor: '#eeeeee',
			fallbackColor: '#123456',
		}));
		expect(writer.commit).toHaveBeenCalledTimes(1);

		document.querySelector('[data-preset-name="empty"]').click();
		document.querySelector('[data-preset-name="missing"]').click();
		expect(writer.commit).toHaveBeenCalledTimes(1);
	});
});
