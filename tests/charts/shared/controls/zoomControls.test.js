// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { buildDescribedControls } from '../../../../src/charts/shared/controls/describedControls.js';
import { resetZoomControl } from '../../../../src/charts/shared/controls/zoomControls.js';

const translate = key => `t(${key})`;

const ZOOM_SLIDER = { widget: 'slider', id: 'demo-zoom', key: 'zoomScale', label: 'chive-zoom', min: 0.5, max: 4, step: 0.05 };
const RESET = resetZoomControl({ id: 'demo-reset-zoom', label: 'chive-reset-zoom', sliderId: 'demo-zoom', zoomScale: 1 });

function build(controls, config = {}) {
	const dataset = { chartConfig: { demo: { enabled: true, zoomScale: 2.5, ...config } } };
	const writer = { commit: vi.fn(), preview: vi.fn() };
	const root = document.createElement('div');
	root.append(...buildDescribedControls(
		{ definition: { key: 'demo', allowedValues: {} }, sections: [{ id: 'display', title: 'Display', controls }] },
		{ dataset, context: {}, writer, translate },
	));
	return { writer, get: id => root.querySelector(`#${id}`) };
}

describe('resetZoomControl', () => {
	it('describes a custom control that writes the zoom', () => {
		expect(RESET).toEqual(expect.objectContaining({ widget: 'custom', id: 'demo-reset-zoom', key: 'zoomScale' }));
	});

	it('builds a button with its id and translated label, disabled while the chart is off', () => {
		const { get } = build([ZOOM_SLIDER, RESET]);
		const button = get('demo-reset-zoom');

		expect([button.type, button.className, button.textContent, button.disabled])
			.toEqual(['button', 'chart-control-btn', 't(chive-reset-zoom)', false]);
		expect(button.parentElement.className).toBe('chart-control');
		expect(build([ZOOM_SLIDER, RESET], { enabled: false }).get('demo-reset-zoom').disabled).toBe(true);
	});

	it('puts the zoom slider and its output back to the zoom and commits it on click', () => {
		const { get, writer } = build([ZOOM_SLIDER, RESET]);
		const slider = get('demo-zoom');
		slider.value = '3';
		slider.dispatchEvent(new Event('input', { bubbles: true }));

		get('demo-reset-zoom').click();

		expect(slider.value).toBe('1');
		expect(slider.parentElement.querySelector('output').textContent).toBe('1');
		expect(writer.commit).toHaveBeenCalledTimes(1);
		expect(writer.commit).toHaveBeenCalledWith({ zoomScale: 1 });
	});

	it('needs its zoom slider described before it', () => {
		expect(() => build([RESET, ZOOM_SLIDER])).toThrow('No control "demo-zoom" is built before the custom control that needs it.');
	});
});
