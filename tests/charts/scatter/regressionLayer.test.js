// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { area, scaleLinear, scaleLog, select } from '../../../vendor/d3/d3.js';
import { computeRegression } from '../../../src/charts/scatter/regression.js';
import {
	renderRegressionAnnotation,
	renderRegressionLayer,
} from '../../../src/charts/scatter/regressionLayer.js';
import { hideChartTooltip } from '../../../src/charts/shared/tooltip/tooltip.js';

// Real math by default; a test can hand the layer a crafted result with mockReturnValueOnce.
vi.mock('../../../src/charts/scatter/regression.js', async importOriginal => {
	const actual = await importOriginal();
	return { ...actual, computeRegression: vi.fn(actual.computeRegression) };
});

const NUMERIC_AXES = { x: 'numeric', y: 'numeric' };
const LABELS = {
	regressionGroup: 'Group',
	regressionSlope: 'Slope',
	regressionIntercept: 'Intercept',
	regressionR2: 'R2',
	regressionN: 'Count',
};
const NOISY = [3.1, 4.9, 7.2, 8.8, 11.1].map((y, x) => ({ x, y }));

let group;

beforeEach(() => {
	document.body.innerHTML = '<svg></svg>';
	group = select('svg').append('g');
});

afterEach(() => {
	hideChartTooltip();
});

function render(overrides = {}) {
	return renderRegressionLayer({
		options: { regression: { enabled: true } },
		points: NOISY,
		axisTypes: NUMERIC_AXES,
		effectiveXScaleType: 'linear',
		effectiveYScaleType: 'linear',
		colorMode: 'single',
		group,
		xScale: scaleLinear().domain([0, 4]).range([0, 200]),
		yScale: scaleLinear().domain([0, 12]).range([100, 0]),
		innerWidth: 200,
		innerHeight: 100,
		labels: LABELS,
		...overrides,
	});
}

const attr = (selector, name) => [...document.querySelectorAll(selector)].map(node => node.getAttribute(name));

describe('renderRegressionLayer', () => {
	it.each([
		['the x axis is not numeric', { axisTypes: { x: 'category', y: 'numeric' } }],
		['the y axis is not numeric', { axisTypes: { x: 'numeric', y: 'category' } }],
		['there is a single point', { points: [{ x: 1, y: 2 }] }],
		['no group can be fitted', { points: [{ x: 2, y: 1 }, { x: 2, y: 5 }, { x: 2, y: 9 }] }],
	])('draws nothing when %s', (_case, overrides) => {
		expect(render(overrides)).toBeNull();
		expect(group.node().childNodes).toHaveLength(0);
	});

	it('uses the configured line width and opacities, including a zero band opacity', () => {
		render({ options: { regression: { enabled: true, lineWidth: '3', lineOpacity: 0.5, bandOpacity: 0 } } });

		expect(attr('.scatter-regression-line', 'stroke-width')).toEqual(['3']);
		expect(attr('.scatter-regression-line', 'stroke-opacity')).toEqual(['0.5']);
		expect(attr('.scatter-regression-band', 'fill-opacity')).toEqual(['0']);
	});

	it('colors a category the color map does not know with the overall color', () => {
		const points = [
			...[1.1, 2.2, 2.9].map((y, x) => ({ x, y, c: 'A' })),
			...[5.2, 3.9, 3.1].map((y, x) => ({ x, y, c: 'B' })),
		];
		const result = render({
			options: { regression: { enabled: true, mode: 'perCategory', overallColor: '#123456' } },
			points,
			colorMode: 'category',
			colorField: 'c',
			getCategoryColorValue: point => point.c,
			categoryMap: new Map([['A', '#aa0000']]),
		});

		expect(result.mode).toBe('perCategory');
		expect(attr('.scatter-regression-line', 'stroke')).toEqual(['#aa0000', '#123456']);
		expect(attr('.scatter-regression-band', 'fill')).toEqual(['#aa0000', '#123456']);
	});

	it('draws a log-scale fit with finite paths', () => {
		const points = [0.1, -0.15, 0.05, 0.12, -0.08].map((n, x) => ({ x, y: Math.exp(1 + 0.3 * x + n) }));
		const result = render({
			points,
			effectiveYScaleType: 'log',
			yScale: scaleLog().domain([1, 20]).range([100, 0]),
		});

		expect(result.results).toHaveLength(1);
		const [line] = attr('.scatter-regression-line', 'd');
		const [band] = attr('.scatter-regression-band', 'd');
		expect(line).toMatch(/^M/);
		expect(band).toMatch(/^M/);
		expect(`${line}${band}`).not.toMatch(/NaN|Infinity/);
	});

	it('lifts band bounds that a log y axis cannot draw to just above zero', () => {
		const xScale = scaleLinear().domain([0, 4]).range([0, 200]);
		const yScale = scaleLog().domain([1, 100]).range([100, 0]);
		vi.mocked(computeRegression).mockReturnValueOnce([{
			groupKey: '__overall__',
			fit: { ok: true, slope: 1, intercept: 1, r2: 0.9, n: 5 },
			sampleLine: [{ x: 0, y: 3 }, { x: 4, y: 10 }],
			sampleBand: [
				{ x: 0, yLow: 0, yHigh: 10 },
				{ x: 2, yLow: NaN, yHigh: 1e-9 },
				{ x: 4, yLow: 5, yHigh: 20 },
			],
		}]);

		render({ effectiveYScaleType: 'log', xScale, yScale });

		// The floor is a millionth of the lowest y on the axis.
		const floor = 1e-6;
		const expected = area()
			.x(d => xScale(d.x))
			.y0(d => yScale(d.low))
			.y1(d => yScale(d.high))([
				{ x: 0, low: floor, high: 10 },
				{ x: 2, low: floor, high: floor },
				{ x: 4, low: 5, high: 20 },
			]);
		expect(attr('.scatter-regression-band', 'd')).toEqual([expected]);
	});

	it('leaves band bounds below zero alone on a linear y axis', () => {
		const xScale = scaleLinear().domain([0, 4]).range([0, 200]);
		const yScale = scaleLinear().domain([-10, 10]).range([100, 0]);
		const sampleBand = [{ x: 0, yLow: -5, yHigh: 2 }, { x: 4, yLow: -1, yHigh: 6 }];
		vi.mocked(computeRegression).mockReturnValueOnce([{
			groupKey: '__overall__',
			fit: { ok: true, slope: 1, intercept: -1.5, r2: 0.9, n: 5 },
			sampleLine: [{ x: 0, y: -1.5 }, { x: 4, y: 2.5 }],
			sampleBand,
		}]);

		render({ xScale, yScale });

		const expected = area().x(d => xScale(d.x)).y0(d => yScale(d.yLow)).y1(d => yScale(d.yHigh))(sampleBand);
		expect(attr('.scatter-regression-band', 'd')).toEqual([expected]);
	});

	it.each([
		[0.123456, -25000, '0.1235', '-2.50e+4'],
		[NaN, 0.0004, 'NaN', '4.00e-4'],
		[Infinity, -Infinity, 'NaN', 'NaN'],
	])('shows slope %s and intercept %s in the hover tooltip', (slope, intercept, slopeText, interceptText) => {
		vi.mocked(computeRegression).mockReturnValueOnce([{
			groupKey: '__overall__',
			fit: { ok: true, slope, intercept, r2: 0.5, n: 4 },
			sampleLine: [{ x: 0, y: 1 }, { x: 4, y: 2 }],
			sampleBand: null,
		}]);
		render();

		document.querySelector('.scatter-regression-line').dispatchEvent(new MouseEvent('mouseenter'));

		const tooltip = document.querySelector('.chart-tooltip');
		expect(tooltip.textContent).toContain(`Slope: ${slopeText}`);
		expect(tooltip.textContent).toContain(`Intercept: ${interceptText}`);
	});
});

describe('renderRegressionAnnotation', () => {
	const fitResult = { fit: { slope: 2, intercept: 1, r2: 0.95 } };
	const annotate = (config, results = [fitResult]) => renderRegressionAnnotation({
		group,
		innerWidth: 200,
		regressionRender: { results, mode: 'overall', config },
		xScale: 'linear',
		yScale: 'log',
	});
	const texts = () => [...document.querySelectorAll('.scatter-regression-annotation text')].map(node => node.textContent);

	it('draws nothing without results', () => {
		annotate({}, []);
		expect(document.querySelector('.scatter-regression-annotation')).toBeNull();
	});

	it('shows only the equation when R² is hidden', () => {
		annotate({ showR2: false });
		expect(texts()).toEqual(['log(y) = 2·x + 1']);
	});

	it('shows only R² when the equation is hidden', () => {
		annotate({ showEquation: false });
		expect(texts()).toEqual(['R² = 0.950']);
		expect(document.querySelector('.scatter-regression-annotation text').getAttribute('y')).toBe('12');
	});
});
