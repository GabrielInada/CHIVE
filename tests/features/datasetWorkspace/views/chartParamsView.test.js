// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { renderChartParamsDOM } from '../../../../src/features/datasetWorkspace/views/chartParamsView.js';

describe('renderChartParamsDOM', () => {
	it('renders an active chart without optional description or click callback', () => {
		const container = document.createElement('div');
		const control = document.createElement('section');
		control.className = 'chart-control-section';

		renderChartParamsDOM({
			container,
			activeChartType: 'bar',
			chartTitle: 'Bar',
			chartDescription: '',
			controls: [control],
			translate: key => key,
		});

		expect(container.querySelector('.viz-chart-picker-trigger-label')?.textContent).toBe('Bar');
		expect(container.querySelector('.viz-params-desc')).toBeNull();
		expect(container.querySelector('.chart-control-section')).toBe(control);
		expect(() => container.querySelector('.viz-chart-picker-trigger').click()).not.toThrow();
	});

	it('renders empty placeholder state and wires the trigger callback when provided', () => {
		const container = document.createElement('div');
		const onClick = vi.fn();

		renderChartParamsDOM({
			container,
			activeChartType: null,
			controls: [],
			translate: key => key,
			onChartTypeTriggerClick: onClick,
		});

		container.querySelector('.viz-chart-picker-trigger').click();
		expect(onClick).toHaveBeenCalledTimes(1);
		expect(container.querySelector('.viz-chart-picker-trigger-label')?.classList.contains('placeholder')).toBe(true);
		expect(container.querySelector('.viz-params-empty')?.textContent).toBe('chive-chart-params-empty');
	});
});
