// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
	const dataset = { chartConfig: { bar: { chartHeight: 320 } } };
	return {
		dataset,
		t: vi.fn(key => key),
		getActiveDataset: vi.fn(() => dataset),
		updateActiveDatasetConfig: vi.fn(),
		normalizeActiveDatasetConfig: vi.fn(),
		triggerLiveRender: vi.fn(),
	};
});

vi.mock('../../../src/services/i18nService.js', () => ({
	t: mocks.t,
}));

vi.mock('../../../src/state/appState.js', async (importOriginal) => ({
	...(await importOriginal()),
	getActiveDataset: mocks.getActiveDataset,
	normalizeActiveDatasetConfig: mocks.normalizeActiveDatasetConfig,
	updateActiveDatasetConfig: mocks.updateActiveDatasetConfig,
}));

vi.mock('../../../src/modules/chartControls/livePreview.js', () => ({
	triggerLiveRender: mocks.triggerLiveRender,
}));

import { ensureChartHeightResizeHandles } from '../../../src/modules/chartControls/chartHeightResize.js';

function getHandle() {
	return document.getElementById('chart-block-bar').querySelector('.chart-height-resize-handle');
}

function pointer(type, props = {}) {
	return new MouseEvent(type, { bubbles: true, cancelable: true, ...props });
}

describe('ensureChartHeightResizeHandles', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.dataset.chartConfig.bar.chartHeight = 320;
		// Only the bar block exists; every other chart key is skipped (no block).
		document.body.innerHTML = '<div id="chart-block-bar"><div id="chart-bar-container"></div></div>';
	});

	it('creates a single labelled handle button on the chart block', () => {
		ensureChartHeightResizeHandles();
		const handle = getHandle();
		expect(handle).not.toBeNull();
		expect(handle.tagName).toBe('BUTTON');
		expect(handle.type).toBe('button');
		expect(handle.getAttribute('aria-label')).toBe('chive-chart-resize-height');
	});

	it('is idempotent: a second call does not add another handle', () => {
		ensureChartHeightResizeHandles();
		ensureChartHeightResizeHandles();
		expect(document.getElementById('chart-block-bar').querySelectorAll('.chart-height-resize-handle').length).toBe(1);
	});

	it('skips chart keys whose block or container is missing', () => {
		// No blocks at all: should not throw and should create nothing.
		document.body.innerHTML = '';
		expect(() => ensureChartHeightResizeHandles()).not.toThrow();
		expect(document.querySelector('.chart-height-resize-handle')).toBeNull();
	});

	describe('keyboard resize', () => {
		beforeEach(() => ensureChartHeightResizeHandles());

		it('ArrowUp commits a 10px smaller height', () => {
			getHandle().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true }));
			expect(mocks.updateActiveDatasetConfig).toHaveBeenCalledTimes(1);
			expect(mocks.updateActiveDatasetConfig.mock.calls[0][0].bar.chartHeight).toBe(310);
		});

		it('ArrowDown commits a 10px larger height', () => {
			getHandle().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
			expect(mocks.updateActiveDatasetConfig.mock.calls[0][0].bar.chartHeight).toBe(330);
		});

		it('clamps the committed height to the chart max', () => {
			mocks.dataset.chartConfig.bar.chartHeight = 720;
			getHandle().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
			expect(mocks.updateActiveDatasetConfig.mock.calls[0][0].bar.chartHeight).toBe(720);
		});

		it('ignores non-arrow keys', () => {
			getHandle().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
			expect(mocks.updateActiveDatasetConfig).not.toHaveBeenCalled();
		});

		it('falls back to the rendered box when no height is configured', () => {
			// No finite configured height -> readChartHeight uses the box (0 in
			// jsdom), clamped up to the min (220). ArrowUp then commits the min.
			mocks.dataset.chartConfig.bar = {};
			getHandle().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true }));
			expect(mocks.updateActiveDatasetConfig.mock.calls[0][0].bar.chartHeight).toBe(220);
		});
	});

	describe('pointer drag', () => {
		beforeEach(() => ensureChartHeightResizeHandles());

		it('tracks the cursor live and commits the final height on release', () => {
			const block = document.getElementById('chart-block-bar');
			const container = document.getElementById('chart-bar-container');

			getHandle().dispatchEvent(pointer('pointerdown', { button: 0, clientY: 100 }));
			expect(block.classList.contains('is-resizing')).toBe(true);

			window.dispatchEvent(pointer('pointermove', { clientY: 150 }));
			// Live write: container box tracks the cursor (+50px from 320).
			expect(container.style.minHeight).toBe('370px');
			expect(mocks.triggerLiveRender).toHaveBeenCalled();
			expect(mocks.normalizeActiveDatasetConfig).toHaveBeenCalled();
			// The updater closure carries the new height.
			const updater = mocks.normalizeActiveDatasetConfig.mock.calls[0][0];
			expect(updater({ bar: { chartHeight: 320 } }).bar.chartHeight).toBe(370);

			window.dispatchEvent(pointer('pointerup'));
			expect(block.classList.contains('is-resizing')).toBe(false);
			expect(mocks.updateActiveDatasetConfig).toHaveBeenCalledTimes(1);
			expect(mocks.updateActiveDatasetConfig.mock.calls[0][0].bar.chartHeight).toBe(370);
		});

		it('does not commit when the height never changed', () => {
			getHandle().dispatchEvent(pointer('pointerdown', { button: 0, clientY: 100 }));
			window.dispatchEvent(pointer('pointerup'));
			expect(mocks.updateActiveDatasetConfig).not.toHaveBeenCalled();
		});

		it('ignores non-primary pointer buttons', () => {
			getHandle().dispatchEvent(pointer('pointerdown', { button: 1, clientY: 100 }));
			window.dispatchEvent(pointer('pointermove', { clientY: 150 }));
			expect(mocks.normalizeActiveDatasetConfig).not.toHaveBeenCalled();
			expect(mocks.triggerLiveRender).not.toHaveBeenCalled();
		});
	});
});
