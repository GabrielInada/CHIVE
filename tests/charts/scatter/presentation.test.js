// @vitest-environment jsdom

/**
 * Scatter's presentation flow past its point budget: it draws a representative
 * sample with a notice that offers to draw every point, and the approval holds
 * for the container's later renders.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../src/i18n/en.json';
import { CHART_DEFINITIONS } from '../../../src/config/charts/definitions.js';
import { SCATTER_PLOT } from '../../../src/config/charts/definitions/scatter.js';
import { hideChartTooltip } from '../../../src/charts/shared/tooltip/tooltip.js';
import { renderScatterInto } from '../../../src/charts/scatter/presentation.js';

vi.mock('../../../src/services/i18nService.js', () => ({
	t: (key, ...params) => (en[key] ?? key).replace(/\$(\d+)/g, (_, n) => String(params[n - 1])),
	getLocale: () => 'en',
}));

const total = SCATTER_PLOT.maxPoints + 1;
const rows = Array.from({ length: total }, (_, index) => ({ x: index, y: index % 97 }));
const input = {
	rows,
	config: { ...CHART_DEFINITIONS.scatter.createDefaultConfig(), x: 'x', y: 'y' },
	columnTypeByName: { x: 'number', y: 'number' },
};

function mount() {
	const container = document.createElement('div');
	document.body.append(container);
	return container;
}

beforeEach(() => {
	hideChartTooltip();
	document.body.replaceChildren();
});

describe('scatter presentation past the point budget', () => {
	it('draws stored size, color and regression settings', () => {
		const container = mount();
		const result = renderScatterInto(container, {
			rows: [{ a: 1, b: 3 }, { a: 2, b: 5 }, { a: 3, b: 7 }, { a: 4, b: 9 }],
			config: Object.freeze({
				...CHART_DEFINITIONS.scatter.createDefaultConfig(),
				x: 'a', y: 'b', radius: 7, opacity: 0.4, color: '#123456',
				chartHeight: 300, customTitle: 'Trend', showXAxisLabel: false,
				regression: { enabled: true, mode: 'overall', showLine: true, showCI: false, showEquation: true },
			}),
			columnTypeByName: { a: 'number', b: 'number' },
		});
		expect(result.ok).toBe(true);
		const point = container.querySelector('.scatter-point');
		expect(point.getAttribute('r')).toBe('7');
		expect(point.getAttribute('fill')).toBe('#123456');
		expect(point.getAttribute('opacity')).toBe('0.4');
		expect(container.querySelector('svg').getAttribute('height')).toBe('300');
		expect(container.textContent).toContain('Trend');
		expect(container.querySelector('.scatter-regression-line')).not.toBeNull();
	});

	it('does not treat stored config as render-budget approval', () => {
		const container = mount();
		const result = renderScatterInto(container, {
			...input, config: { ...input.config, allowFullRender: true },
		});
		expect(result).toMatchObject({ ok: true, sampled: true });
		expect(container.querySelector('.chart-render-budget-notice')).not.toBeNull();
	});

	it('draws a sample until the notice is approved, and the approval holds for later renders', () => {
		const container = mount();

		const result = renderScatterInto(container, input);

		expect(result).toMatchObject({ ok: true, sampled: true, validCount: total });
		expect(result.renderedCount).toBeLessThan(total);
		expect(container.querySelectorAll('.scatter-point')).toHaveLength(result.renderedCount);
		const notice = container.querySelector('.chart-render-budget-notice');
		expect(notice.textContent).toContain(
			`Showing a representative ${result.renderedCount} of ${total} points. Axes and regression still use all valid points.`,
		);

		notice.querySelector('button').click();
		expect(container.querySelectorAll('.scatter-point')).toHaveLength(total);
		expect(container.querySelector('.chart-render-budget-notice')).toBeNull();

		renderScatterInto(container, input);
		expect(container.querySelectorAll('.scatter-point')).toHaveLength(total);
		expect(container.querySelector('.chart-render-budget-notice')).toBeNull();
	});

	it('keeps the approval to the container it was given in', () => {
		const approved = mount();
		renderScatterInto(approved, input);
		approved.querySelector('.chart-render-budget-notice button').click();
		const other = mount();

		renderScatterInto(other, input);

		expect(other.querySelector('.chart-render-budget-notice')).not.toBeNull();
	});
});
