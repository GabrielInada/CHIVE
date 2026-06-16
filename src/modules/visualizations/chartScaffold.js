/**
 * Shared SVG and axis scaffold helpers for chart renderers.
 *
 * These helpers centralize DOM setup that is common across D3 renderers while
 * leaving chart-specific scale construction and data rendering inside each
 * renderer.
 */

import { select } from '../../../vendor/d3/d3.js';

/**
 * Append the standard chart title text to an SVG.
 *
 * @param {import('../../../vendor/d3/d3.js').Selection} svg - SVG selection.
 * @param {Object} options
 * @param {number} options.width - SVG width used for the default centered x position.
 * @param {string} options.text - Title text. Empty text is a no-op.
 * @param {number} [options.x=width / 2] - Title x position.
 * @param {number} [options.y=16] - Title y position.
 * @param {string} [options.textAnchor='middle'] - SVG text-anchor value.
 * @param {number} [options.fontSize=13] - Font size.
 * @param {number} [options.fontWeight=600] - Font weight.
 * @param {string} [options.fill='#3f3a33'] - Fill color.
 * @returns {import('../../../vendor/d3/d3.js').Selection} Title text selection or an empty selection.
 */
export function appendChartTitle(svg, {
	width,
	text,
	x = width / 2,
	y = 16,
	textAnchor = 'middle',
	fontSize = 13,
	fontWeight = 600,
	fill = '#3f3a33',
}) {
	const titleText = String(text || '').trim();
	if (!titleText) return svg.selectAll('text').filter(() => false);

	return svg
		.append('text')
		.attr('x', x)
		.attr('y', y)
		.attr('text-anchor', textAnchor)
		.attr('font-size', fontSize)
		.attr('font-weight', fontWeight)
		.attr('fill', fill)
		.text(titleText);
}

/**
 * Replace container contents and create the standard SVG/group scaffold.
 *
 * @param {HTMLElement} container - Target DOM element.
 * @param {Object} options
 * @param {number} options.width - SVG width.
 * @param {number} options.height - SVG height.
 * @param {{left:number,right:number,top:number,bottom:number}} options.margin - Chart margins.
 * @param {string} [options.customTitle=''] - Optional title text.
 * @param {number} [options.titleOffset=20] - Offset applied only when a title exists.
 * @param {boolean|string|Array<number>} [options.viewBox=false] - ViewBox configuration.
 * @param {?number} [options.minInnerWidth=null] - Optional minimum inner width.
 * @param {?number} [options.minInnerHeight=null] - Optional minimum inner height.
 * @param {number} [options.innerHeightReserve=0] - Extra vertical space reserved below the chart.
 * @returns {{svg: import('../../../vendor/d3/d3.js').Selection, group: import('../../../vendor/d3/d3.js').Selection, innerWidth: number, innerHeight: number, appliedTitleOffset: number}}
 */
export function setupChartSvg(container, {
	width,
	height,
	margin,
	customTitle = '',
	titleOffset = 20,
	viewBox = false,
	minInnerWidth = null,
	minInnerHeight = null,
	innerHeightReserve = 0,
}) {
	container.replaceChildren();

	const titleText = String(customTitle || '').trim();
	const appliedTitleOffset = titleText ? titleOffset : 0;
	const rawInnerWidth = width - margin.left - margin.right;
	const rawInnerHeight = height - margin.top - margin.bottom - appliedTitleOffset - innerHeightReserve;
	const innerWidth = Number.isFinite(Number(minInnerWidth))
		? Math.max(Number(minInnerWidth), rawInnerWidth)
		: rawInnerWidth;
	const innerHeight = Number.isFinite(Number(minInnerHeight))
		? Math.max(Number(minInnerHeight), rawInnerHeight)
		: rawInnerHeight;

	const svg = select(container)
		.append('svg')
		.attr('width', width)
		.attr('height', height);

	if (viewBox === true) {
		svg.attr('viewBox', `0 0 ${width} ${height}`);
	} else if (viewBox) {
		svg.attr('viewBox', Array.isArray(viewBox) ? viewBox.join(' ') : viewBox);
	}

	appendChartTitle(svg, { width, text: titleText });

	const group = svg
		.append('g')
		.attr('transform', `translate(${margin.left},${margin.top + appliedTitleOffset})`);

	return { svg, group, innerWidth, innerHeight, appliedTitleOffset };
}

/**
 * Append a bottom axis and optionally rotate tick labels.
 *
 * @param {import('../../../vendor/d3/d3.js').Selection} group - Chart group selection.
 * @param {Object} options
 * @param {Function} options.axis - D3 axis generator.
 * @param {number} options.innerHeight - Chart inner height.
 * @param {?Object} [options.tickRotation=null] - Optional tick rotation config.
 * @returns {import('../../../vendor/d3/d3.js').Selection} Axis group selection.
 */
export function appendBottomAxis(group, { axis, innerHeight, tickRotation = null }) {
	const axisGroup = group
		.append('g')
		.attr('transform', `translate(0,${innerHeight})`)
		.call(axis);

	if (tickRotation) {
		const {
			angle,
			dx,
			dy,
			textAnchor = 'end',
		} = tickRotation;

		axisGroup
			.selectAll('text')
			.style('text-anchor', textAnchor)
			.attr('dx', dx)
			.attr('dy', dy)
			.attr('transform', `rotate(${angle})`);
	}

	return axisGroup;
}

/**
 * Append a left axis.
 *
 * @param {import('../../../vendor/d3/d3.js').Selection} group - Chart group selection.
 * @param {Object} options
 * @param {Function} options.axis - D3 axis generator.
 * @returns {import('../../../vendor/d3/d3.js').Selection} Axis group selection.
 */
export function appendLeftAxis(group, { axis }) {
	return group
		.append('g')
		.call(axis);
}

/**
 * Append standard x/y axis labels.
 *
 * @param {import('../../../vendor/d3/d3.js').Selection} group - Chart group selection.
 * @param {Object} options
 * @param {number} options.innerWidth - Chart inner width.
 * @param {number} options.innerHeight - Chart inner height.
 * @param {number} options.marginLeft - Left margin.
 * @param {number} options.marginBottom - Bottom margin.
 * @param {{x:string,y:string}} options.axisLabels - Axis label text.
 * @param {boolean} options.showX - Whether to render the x label.
 * @param {boolean} options.showY - Whether to render the y label.
 * @param {number} [options.xBottomInset=18] - X label inset from the bottom margin.
 * @returns {{xLabel: import('../../../vendor/d3/d3.js').Selection|null, yLabel: import('../../../vendor/d3/d3.js').Selection|null}}
 */
export function appendAxisLabels(group, {
	innerWidth,
	innerHeight,
	marginLeft,
	marginBottom,
	axisLabels,
	showX,
	showY,
	xBottomInset = 18,
}) {
	const xLabel = showX
		? group
			.append('text')
			.attr('x', innerWidth / 2)
			.attr('y', innerHeight + marginBottom - xBottomInset)
			.attr('text-anchor', 'middle')
			.attr('fill', '#5f5a53')
			.attr('font-size', 11)
			.text(axisLabels.x)
		: null;

	const yLabel = showY
		? group
			.append('text')
			.attr('transform', 'rotate(-90)')
			.attr('x', -innerHeight / 2)
			.attr('y', -marginLeft + 16)
			.attr('text-anchor', 'middle')
			.attr('fill', '#5f5a53')
			.attr('font-size', 11)
			.text(axisLabels.y)
		: null;

	return { xLabel, yLabel };
}
