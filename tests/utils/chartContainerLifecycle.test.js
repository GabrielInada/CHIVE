// @vitest-environment jsdom

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
	CHART_DISPOSE_HOOK,
	clearChartContainer,
	showChartMessage,
} from '../../src/utils/chartContainerLifecycle.js';

describe('chartContainerLifecycle', () => {
	let warnSpy;

	beforeEach(() => {
		document.body.innerHTML = '';
		warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
	});

	afterEach(() => {
		warnSpy.mockRestore();
	});

	describe('clearChartContainer', () => {
		it('runs the stashed dispose hook, removes it, then empties the container', () => {
			const container = document.createElement('div');
			container.innerHTML = '<canvas></canvas>';
			const callOrder = [];
			container[CHART_DISPOSE_HOOK] = vi.fn(() => {
				callOrder.push('dispose');
				// The DOM must still be intact while the disposer runs.
				expect(container.querySelector('canvas')).not.toBeNull();
			});

			clearChartContainer(container);
			callOrder.push('cleared');

			expect(callOrder).toEqual(['dispose', 'cleared']);
			expect(container[CHART_DISPOSE_HOOK]).toBeUndefined();
			expect(container.innerHTML).toBe('');
		});

		it('is a no-op for null and undefined containers', () => {
			expect(() => clearChartContainer(null)).not.toThrow();
			expect(() => clearChartContainer(undefined)).not.toThrow();
		});

		it('just empties a container that has no hook', () => {
			const container = document.createElement('div');
			container.innerHTML = '<svg></svg>';

			clearChartContainer(container);

			expect(container.innerHTML).toBe('');
		});

		it('swallows a throwing hook, still clearing the DOM and the hook reference', () => {
			const container = document.createElement('div');
			container.innerHTML = '<canvas></canvas>';
			container[CHART_DISPOSE_HOOK] = vi.fn(() => {
				throw new Error('stale disposer');
			});

			expect(() => clearChartContainer(container)).not.toThrow();
			expect(container[CHART_DISPOSE_HOOK]).toBeUndefined();
			expect(container.innerHTML).toBe('');
			expect(warnSpy).toHaveBeenCalled();

			// A later clear must not re-run the poisoned hook.
			clearChartContainer(container);
			expect(warnSpy).toHaveBeenCalledTimes(1);
		});

		it('ignores a non-function hook value but still removes it', () => {
			const container = document.createElement('div');
			container.innerHTML = '<canvas></canvas>';
			container[CHART_DISPOSE_HOOK] = 'not-a-function';

			clearChartContainer(container);

			expect(container[CHART_DISPOSE_HOOK]).toBeUndefined();
			expect(container.innerHTML).toBe('');
		});
	});

	describe('showChartMessage', () => {
		it('replaces the container contents with a .chart-empty element', () => {
			const container = document.createElement('div');
			container.id = 'chart-test-container';
			container.innerHTML = '<svg></svg>';
			document.body.appendChild(container);

			showChartMessage('chart-test-container', 'Nothing to show');

			expect(container.children).toHaveLength(1);
			const empty = container.firstElementChild;
			expect(empty.className).toBe('chart-empty');
			expect(empty.textContent).toBe('Nothing to show');
		});

		it('runs a stashed dispose hook before rendering the message', () => {
			const container = document.createElement('div');
			container.id = 'chart-test-container';
			document.body.appendChild(container);
			const dispose = vi.fn();
			container[CHART_DISPOSE_HOOK] = dispose;

			showChartMessage('chart-test-container', 'Nothing to show');

			expect(dispose).toHaveBeenCalledTimes(1);
			expect(container[CHART_DISPOSE_HOOK]).toBeUndefined();
		});

		it('is a no-op when the container id does not resolve', () => {
			expect(() => showChartMessage('missing-container', 'msg')).not.toThrow();
		});
	});
});
