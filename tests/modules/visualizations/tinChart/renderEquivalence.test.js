// @vitest-environment jsdom

/**
 * SVG-equivalence guard for the tinChart split.
 *
 * Captured against the pre-split renderer on develop, this pins the full
 * `svg.outerHTML` plus the returned result object for a representative option
 * matrix. The split is a pure code move, so every snapshot below must stay
 * byte-identical afterwards. Conditions are stabilized so the output is
 * deterministic across runs: explicit locale, a pinned `clientWidth` (jsdom
 * does no layout, so `container.clientWidth` is 0 and a CSS width is ignored;
 * without this the renderer falls back to CHART_DIMENSIONS.tin.width), a fixed
 * chartHeight, fixed input rows, and the pinned vendored d3.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { renderTinChart } from '../../../../src/modules/visualizations/tinChart.js';
import { hideChartTooltip } from '../../../../src/charts/shared/tooltip/tooltip.js';

const ROWS = [
	{ x: 0, y: 0, z: 1 },
	{ x: 10, y: 0, z: 3 },
	{ x: 10, y: 10, z: 5 },
	{ x: 0, y: 10, z: 7 },
	{ x: 5, y: 5, z: 4 },
	{ x: 3, y: 8, z: 6 },
	{ x: 8, y: 2, z: 2 },
];

const BASE = { locale: 'en-US', chartHeight: 400 };

function makeContainer() {
	document.body.innerHTML = '<div id="tin"></div>';
	const container = document.getElementById('tin');
	// jsdom does no layout: pin clientWidth so the renderer uses a real width
	// instead of silently falling back to the configured default.
	Object.defineProperty(container, 'clientWidth', { value: 640, configurable: true });
	return container;
}

function render(options) {
	const container = makeContainer();
	const result = renderTinChart(container, ROWS, 'x', 'y', 'z', { ...BASE, ...options });
	return { html: container.querySelector('svg').outerHTML, result };
}

const CASES = {
	'smooth named ramp (viridis), value distribution, all overlays': {
		fillMode: 'smooth',
		colorRamp: 'viridis',
		gradientDistribution: 'value',
		subdivisionDepth: 2,
		showEdges: true,
		showPoints: true,
		showZLabels: true,
		showHull: true,
	},
	'flat custom gradient, rank distribution': {
		fillMode: 'flat',
		colorRamp: 'custom',
		gradientMinColor: '#000000',
		gradientMaxColor: '#ffffff',
		gradientDistribution: 'rank',
		subdivisionDepth: 2,
	},
	'isolines count-mode with labels': {
		colorRamp: 'terrain',
		subdivisionDepth: 1,
		showIsolines: true,
		isolineMode: 'count',
		isolineCount: 4,
		showIsolineLabels: true,
		colorIsolinesByZ: true,
		isolineMinColor: '#0000ff',
		isolineMaxColor: '#ff0000',
		showEdges: false,
		showPoints: false,
	},
	'isolines step-mode + threshold': {
		colorRamp: 'plasma',
		subdivisionDepth: 0,
		showIsolines: true,
		isolineMode: 'step',
		isolineStep: 1.5,
		showThreshold: true,
		thresholdValue: 4,
		showEdges: false,
		showPoints: false,
	},
};

describe('tinChart render equivalence (pure-move guard)', () => {
	beforeEach(() => {
		document.body.innerHTML = '<div id="tin"></div>';
	});

	afterEach(() => {
		hideChartTooltip();
	});

	for (const [name, options] of Object.entries(CASES)) {
		it(`is byte-stable: ${name}`, () => {
			const { html, result } = render(options);
			expect(result.ok).toBe(true);
			expect(result).toMatchSnapshot();
			expect(html).toMatchSnapshot();
		});
	}
});
