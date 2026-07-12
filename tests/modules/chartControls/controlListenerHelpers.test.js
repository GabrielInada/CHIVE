// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	updateActiveDatasetConfig: vi.fn(),
	normalizeActiveDatasetConfig: vi.fn(),
}));

vi.mock('../../../src/modules/state/appState.js', () => ({
	normalizeActiveDatasetConfig: mocks.normalizeActiveDatasetConfig,
	updateActiveDatasetConfig: mocks.updateActiveDatasetConfig,
}));

import {
	previewChartConfigPatch,
	setupCheckboxListeners,
	setupColorInputListener,
	setupColorPresetListeners,
	setupNumberInputListener,
	setupSelectListeners,
	setupSliderListener,
	setupSliderListeners,
	setupTextInputListener,
} from '../../../src/modules/chartControls/controlListenerHelpers.js';
import { setLiveRenderCallback } from '../../../src/modules/chartControls/livePreview.js';

describe('controlListenerHelpers setupColorInputListener', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		setLiveRenderCallback(null);
		document.body.innerHTML = '<input id="viz-input-bar-color" type="color" value="#000000">';
	});

	function makeDataset(initialColor) {
		return {
			chartConfig: {
				bar: {
					color: initialColor,
					enabled: false,
				},
			},
		};
	}

	it('routes input writes through the non-emitting facade and triggers a chart-only re-render', () => {
		const dataset = makeDataset('#000000');
		const liveRender = vi.fn();
		setLiveRenderCallback(liveRender);
		setupColorInputListener('viz-input-bar-color', 'color', '#abcdef', dataset, 'bar');

		const input = document.getElementById('viz-input-bar-color');
		input.value = '#ff0000';
		input.dispatchEvent(new Event('input'));

		// No emitting facade call (would rebuild the sidebar and disrupt the picker).
		expect(mocks.updateActiveDatasetConfig).not.toHaveBeenCalled();

		// Non-emitting facade write happened with a normalizer that produces the new color.
		expect(mocks.normalizeActiveDatasetConfig).toHaveBeenCalledTimes(1);
		const normalizer = mocks.normalizeActiveDatasetConfig.mock.calls[0][0];
		const result = normalizer({ bar: { color: '#000000', other: 'keep' } });
		expect(result.bar.color.toLowerCase()).toBe('#ff0000');
		expect(result.bar.other).toBe('keep');

		// Chart-only re-render fired so the user sees the new color live.
		expect(liveRender).toHaveBeenCalledTimes(1);
	});

	it('commits via the emitting facade on the change event', () => {
		const dataset = makeDataset('#000000');
		setupColorInputListener('viz-input-bar-color', 'color', '#abcdef', dataset, 'bar');

		const input = document.getElementById('viz-input-bar-color');
		input.value = '#00ff00';
		input.dispatchEvent(new Event('change'));

		expect(mocks.updateActiveDatasetConfig).toHaveBeenCalledTimes(1);
		const callArg = mocks.updateActiveDatasetConfig.mock.calls[0][0];
		expect(callArg.bar.color.toLowerCase()).toBe('#00ff00');
	});

	it('falls back to the default color when the input value is not a valid hex', () => {
		const dataset = makeDataset('#000000');
		setLiveRenderCallback(vi.fn());
		setupColorInputListener('viz-input-bar-color', 'color', '#abcdef', dataset, 'bar');

		const input = document.getElementById('viz-input-bar-color');
		// jsdom sanitizes the value automatically, but we can override directly.
		Object.defineProperty(input, 'value', { value: 'not-a-color', configurable: true });
		input.dispatchEvent(new Event('input'));

		const normalizer = mocks.normalizeActiveDatasetConfig.mock.calls[0][0];
		const result = normalizer({ bar: { color: '#000000' } });
		expect(result.bar.color).toBe('#abcdef');
	});

	it('supports functional nested live-preview patches for chart packages', () => {
		const liveRender = vi.fn();
		setLiveRenderCallback(liveRender);

		previewChartConfigPatch('pie', current => ({
			customSliceColors: {
				...current.customSliceColors,
				North: '#ff0000',
			},
		}));

		const normalizer = mocks.normalizeActiveDatasetConfig.mock.calls[0][0];
		const result = normalizer({
			pie: {
				enabled: true,
				customSliceColors: { South: '#00ff00' },
			},
		});
		expect(result.pie).toEqual({
			enabled: true,
			customSliceColors: {
				South: '#00ff00',
				North: '#ff0000',
			},
		});
		expect(liveRender).toHaveBeenCalledTimes(1);
	});
});

describe('controlListenerHelpers generic listeners', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		setLiveRenderCallback(null);
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

	function dataset() {
		return {
			chartConfig: {
				bar: {
					mode: 'old',
					enabled: false,
					title: '',
					size: 1,
					height: 10,
					color: '#000000',
					gradientMaxColor: '#ffffff',
				},
			},
		};
	}

	it('wires select, checkbox, and text inputs with transforms and callbacks', () => {
		const changed = vi.fn();
		const ds = dataset();

		setupSelectListeners([
			{ id: 'select-mode', key: 'mode', transform: value => Number(value) },
			{ id: 'missing-select', key: 'missing' },
		], ds, 'bar', changed);
		setupCheckboxListeners([
			{ id: 'check-enabled', key: 'enabled' },
			{ id: 'missing-check', key: 'missing' },
		], ds, 'bar', changed);
		setupTextInputListener('title-input', 'title', ds, 'bar', changed);
		setupTextInputListener('missing-title', 'title', ds, 'bar', changed);

		document.getElementById('select-mode').dispatchEvent(new Event('change'));
		document.getElementById('check-enabled').checked = true;
		document.getElementById('check-enabled').dispatchEvent(new Event('change'));
		document.getElementById('title-input').dispatchEvent(new Event('change'));

		expect(mocks.updateActiveDatasetConfig.mock.calls[0][0].bar).toEqual(expect.objectContaining({ mode: 7 }));
		expect(mocks.updateActiveDatasetConfig.mock.calls[1][0].bar).toEqual(expect.objectContaining({ enabled: true }));
		expect(mocks.updateActiveDatasetConfig.mock.calls[2][0].bar).toEqual(expect.objectContaining({ title: 'Chart title' }));
		expect(changed).toHaveBeenCalledTimes(3);
	});

	it('wires number inputs with finite parsing and default fallback', () => {
		const ds = dataset();
		const changed = vi.fn();
		setupNumberInputListener('number-input', 'size', 5, ds, 'bar', changed);
		setupNumberInputListener('missing-number', 'size', 5, ds, 'bar', changed);

		const input = document.getElementById('number-input');
		input.dispatchEvent(new Event('change'));
		expect(mocks.updateActiveDatasetConfig.mock.calls.at(-1)[0].bar.size).toBe(12.5);

		input.value = 'not numeric';
		input.dispatchEvent(new Event('change'));
		expect(mocks.updateActiveDatasetConfig.mock.calls.at(-1)[0].bar.size).toBe(5);
		expect(changed).toHaveBeenCalledTimes(2);
	});

	it('wires sliders, syncs sibling outputs, and supports batched sliders', () => {
		const ds = dataset();
		const changed = vi.fn();
		setupSliderListener('slider-input', 'height', ds, 'bar', changed);
		setupSliderListener('missing-slider', 'height', ds, 'bar', changed);
		setupSliderListeners([{ id: 'slider-no-output', key: 'size' }], ds, 'bar', changed);

		const slider = document.getElementById('slider-input');
		slider.value = '77';
		slider.dispatchEvent(new Event('input'));
		expect(slider.parentElement.querySelector('output').textContent).toBe('77');
		slider.dispatchEvent(new Event('change'));
		expect(mocks.updateActiveDatasetConfig.mock.calls.at(-1)[0].bar.height).toBe(77);

		const noOutput = document.getElementById('slider-no-output');
		noOutput.value = '13';
		noOutput.dispatchEvent(new Event('input'));
		noOutput.dispatchEvent(new Event('change'));
		expect(mocks.updateActiveDatasetConfig.mock.calls.at(-1)[0].bar.size).toBe(13);
	});

	it('applies color preset buttons and ignores empty or missing palettes', () => {
		const ds = dataset();
		const changed = vi.fn();
		setupColorPresetListeners(
			'bar-colors',
			{ color: 0, gradientMaxColor: -1, fallbackColor: 99 },
			{ fallbackColor: '#123456' },
			ds,
			'bar',
			changed,
			{
				warm: ['#111111', 'not-a-color', '#eeeeee'],
				empty: [],
			},
		);

		document.querySelector('[data-preset-name="warm"]').click();
		const update = mocks.updateActiveDatasetConfig.mock.calls.at(-1)[0].bar;
		expect(update).toEqual(expect.objectContaining({
			colorScheme: 'warm',
			color: '#111111',
			gradientMaxColor: '#eeeeee',
			fallbackColor: '#123456',
		}));
		expect(changed).toHaveBeenCalledTimes(1);

		document.querySelector('[data-preset-name="empty"]').click();
		document.querySelector('[data-preset-name="missing"]').click();
		expect(changed).toHaveBeenCalledTimes(1);
	});
});
