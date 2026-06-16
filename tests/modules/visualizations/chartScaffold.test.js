// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';
import { axisBottom, scaleBand, select } from '../../../vendor/d3/d3.js';
import {
	appendAxisLabels,
	appendBottomAxis,
	appendChartTitle,
	setupChartSvg,
} from '../../../src/modules/visualizations/chartScaffold.js';

const MARGIN = { top: 30, right: 20, bottom: 40, left: 50 };

describe('chartScaffold', () => {
	beforeEach(() => {
		document.body.innerHTML = '<div id="chart"></div>';
	});

	it('does not apply title offset when no title is provided', () => {
		const container = document.getElementById('chart');
		const result = setupChartSvg(container, {
			width: 400,
			height: 300,
			margin: MARGIN,
			customTitle: '   ',
			titleOffset: 20,
		});

		expect(result.appliedTitleOffset).toBe(0);
		expect(result.innerWidth).toBe(330);
		expect(result.innerHeight).toBe(230);
		expect(container.querySelector('g').getAttribute('transform')).toBe('translate(50,30)');
		expect(container.querySelectorAll('text')).toHaveLength(0);
	});

	it('appends the standard title attributes', () => {
		const container = document.getElementById('chart');
		const svg = select(container).append('svg').attr('width', 400).attr('height', 300);

		const title = appendChartTitle(svg, { width: 400, text: 'Revenue' });

		expect(title.node().textContent).toBe('Revenue');
		expect(title.attr('x')).toBe('200');
		expect(title.attr('y')).toBe('16');
		expect(title.attr('text-anchor')).toBe('middle');
		expect(title.attr('font-size')).toBe('13');
		expect(title.attr('font-weight')).toBe('600');
		expect(title.attr('fill')).toBe('#3f3a33');
	});

	it('sets a standard viewBox when requested', () => {
		const container = document.getElementById('chart');
		setupChartSvg(container, {
			width: 400,
			height: 300,
			margin: MARGIN,
			customTitle: 'Chart',
			viewBox: true,
		});

		expect(container.querySelector('svg').getAttribute('viewBox')).toBe('0 0 400 300');
	});

	it('applies optional clamps and inner height reserve only when provided', () => {
		const container = document.getElementById('chart');
		let result = setupChartSvg(container, {
			width: 80,
			height: 100,
			margin: { top: 20, right: 30, bottom: 20, left: 30 },
			customTitle: 'Small',
			titleOffset: 20,
		});

		expect(result.innerWidth).toBe(20);
		expect(result.innerHeight).toBe(40);

		result = setupChartSvg(container, {
			width: 80,
			height: 100,
			margin: { top: 20, right: 30, bottom: 20, left: 30 },
			customTitle: 'Small',
			titleOffset: 20,
			minInnerWidth: 40,
			minInnerHeight: 40,
			innerHeightReserve: 30,
		});

		expect(result.innerWidth).toBe(40);
		expect(result.innerHeight).toBe(40);
	});

	it('applies exact tick rotation attributes from the rotation object', () => {
		const container = document.getElementById('chart');
		const { group } = setupChartSvg(container, {
			width: 400,
			height: 300,
			margin: MARGIN,
		});
		const xScale = scaleBand().domain(['A', 'B']).range([0, 100]);

		appendBottomAxis(group, {
			axis: axisBottom(xScale),
			innerHeight: 120,
			tickRotation: { angle: -28, dx: '-0.55em', dy: '0.2em' },
		});

		const tick = container.querySelector('.tick text');
		expect(tick.style.textAnchor).toBe('end');
		expect(tick.getAttribute('dx')).toBe('-0.55em');
		expect(tick.getAttribute('dy')).toBe('0.2em');
		expect(tick.getAttribute('transform')).toBe('rotate(-28)');
	});

	it('preserves axis label positions and show/hide gates', () => {
		const container = document.getElementById('chart');
		const { group } = setupChartSvg(container, {
			width: 400,
			height: 300,
			margin: MARGIN,
		});

		appendAxisLabels(group, {
			innerWidth: 330,
			innerHeight: 230,
			marginLeft: 50,
			marginBottom: 40,
			axisLabels: { x: 'Category', y: 'Count' },
			showX: true,
			showY: true,
			xBottomInset: 14,
		});

		const labels = Array.from(container.querySelectorAll('text'));
		const xLabel = labels.find(label => label.textContent === 'Category');
		const yLabel = labels.find(label => label.textContent === 'Count');
		expect(xLabel.getAttribute('x')).toBe('165');
		expect(xLabel.getAttribute('y')).toBe('256');
		expect(yLabel.getAttribute('transform')).toBe('rotate(-90)');
		expect(yLabel.getAttribute('x')).toBe('-115');
		expect(yLabel.getAttribute('y')).toBe('-34');

		container.replaceChildren();
		const hidden = setupChartSvg(container, {
			width: 400,
			height: 300,
			margin: MARGIN,
		});
		appendAxisLabels(hidden.group, {
			innerWidth: 330,
			innerHeight: 230,
			marginLeft: 50,
			marginBottom: 40,
			axisLabels: { x: 'Hidden X', y: 'Hidden Y' },
			showX: false,
			showY: false,
		});
		expect(container.textContent).not.toContain('Hidden X');
		expect(container.textContent).not.toContain('Hidden Y');
	});
});
