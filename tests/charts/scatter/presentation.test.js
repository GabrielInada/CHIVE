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
