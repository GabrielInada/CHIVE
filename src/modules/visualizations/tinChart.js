/**
 * TIN (Triangulated Irregular Network) surface renderer.
 *
 * Renders a Z surface over X/Y points using Delaunay triangulation, with
 * configurable subdivision, color ramps (Viridis/Inferno/Plasma/etc.),
 * isolines, hull outline, and an optional threshold line. The most
 * option-dense of the chart renderers.
 *
 * Internal D3 helpers (Delaunay setup, isoline extraction, color-ramp
 * resolution) are intentionally undocumented per the Tier 5 plan.
 *
 * @typedef {import('../../types.js').Result} Result
 */

import {
	Delaunay,
	axisBottom,
	axisLeft,
	extent,
	interpolateGreys,
	interpolateInferno,
	interpolateMagma,
	interpolatePlasma,
	interpolateRgbBasis,
	interpolateTurbo,
	interpolateViridis,
	scaleLinear,
	select,
} from 'https://esm.sh/d3@7.9.0';
import { CHART_COLORS, CHART_DIMENSIONS, TIN_CHART, TIN_COLOR_RAMPS } from '../../config/charts.js';
import { formatNumber } from '../../utils/formatters.js';
import { interpolateColor, isValidHexColor } from '../../utils/colorUtils.js';
import { ok, fail } from '../../utils/result.js';
import { createTooltipLine, hideChartTooltip, moveChartTooltip, showChartTooltip } from './tooltip.js';

/** @private */
function normalizeColor(value, fallback) {
	const v = String(value || '').trim();
	return isValidHexColor(v) ? v : fallback;
}

// d3 ships sequential interpolators for the common scientific ramps. Terrain
// isn't built in, so we synthesize one with interpolateRgbBasis through a
// canonical low-to-high-elevation gradient (deep water → shore → grass →
// foothills → mountain → snow). Keys must match TIN_COLOR_RAMPS minus 'custom'.
const D3_RAMP_BY_NAME = {
	viridis: interpolateViridis,
	plasma: interpolatePlasma,
	magma: interpolateMagma,
	inferno: interpolateInferno,
	turbo: interpolateTurbo,
	grays: interpolateGreys,
	terrain: interpolateRgbBasis([
		'#3b6797',
		'#5e9cba',
		'#92c0a8',
		'#c8d9a5',
		'#b1a877',
		'#8a6f4a',
		'#ffffff',
	]),
};

function resolveColorRamp(rampName) {
	return TIN_COLOR_RAMPS.includes(rampName) ? rampName : 'custom';
}

function clampDepth(value) {
	const n = Math.round(Number(value));
	if (!Number.isFinite(n)) return TIN_CHART.defaultSubdivisionDepth;
	return Math.max(TIN_CHART.minSubdivisionDepth, Math.min(TIN_CHART.maxSubdivisionDepth, n));
}

function midpoint(a, b) {
	return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 };
}

// Recursively subdivides a triangle into 4^depth flat-colored sub-triangles.
// Each leaf gets the mean-Z color of its 3 vertices — this approximates a
// Gouraud-shaded fill in pure SVG so the chart still exports cleanly.
function emitSubdivided(triangle, depth, colorAt, outPolygons) {
	if (depth <= 0) {
		const meanZ = (triangle[0].z + triangle[1].z + triangle[2].z) / 3;
		outPolygons.push({ vertices: triangle, fill: colorAt(meanZ) });
		return;
	}
	const [a, b, c] = triangle;
	const ab = midpoint(a, b);
	const bc = midpoint(b, c);
	const ca = midpoint(c, a);
	emitSubdivided([a, ab, ca], depth - 1, colorAt, outPolygons);
	emitSubdivided([b, bc, ab], depth - 1, colorAt, outPolygons);
	emitSubdivided([c, ca, bc], depth - 1, colorAt, outPolygons);
	emitSubdivided([ab, bc, ca], depth - 1, colorAt, outPolygons);
}

// Computes the iso-segment crossings for a single Z level across an array of
// triangles in screen coordinates. Returns the visible segments plus a
// descriptor of the longest one (used to anchor a label or any per-level
// annotation). Pure function — extracted so the regular-isoline pass, the
// threshold contour, and any per-segment styling all consume one source of
// truth for level-crossing geometry.
function computeIsolineSegments(triangleVerts, level) {
	const edgePairs = [[0, 1], [1, 2], [2, 0]];
	const segments = [];
	let longest = null;
	for (const verts of triangleVerts) {
		const crossings = [];
		for (let k = 0; k < edgePairs.length; k++) {
			const v1 = verts[edgePairs[k][0]];
			const v2 = verts[edgePairs[k][1]];
			const d1 = v1.z - level;
			const d2 = v2.z - level;
			if ((d1 < 0 && d2 >= 0) || (d1 >= 0 && d2 < 0)) {
				const t = d1 / (d1 - d2);
				crossings.push({
					x: v1.sx + t * (v2.sx - v1.sx),
					y: v1.sy + t * (v2.sy - v1.sy),
				});
			}
		}
		if (crossings.length === 2) {
			const dx = crossings[0].x - crossings[1].x;
			const dy = crossings[0].y - crossings[1].y;
			const len2 = dx * dx + dy * dy;
			if (len2 < 1e-9) continue;
			segments.push({
				x1: crossings[0].x,
				y1: crossings[0].y,
				x2: crossings[1].x,
				y2: crossings[1].y,
			});
			if (longest === null || len2 > longest.length2) {
				let angleDeg = Math.atan2(crossings[1].y - crossings[0].y, crossings[1].x - crossings[0].x) * 180 / Math.PI;
				if (angleDeg > 90) angleDeg -= 180;
				else if (angleDeg < -90) angleDeg += 180;
				longest = {
					length2: len2,
					midX: (crossings[0].x + crossings[1].x) / 2,
					midY: (crossings[0].y + crossings[1].y) / 2,
					angleDeg,
				};
			}
		}
	}
	return { segments, longest };
}

function collectUniqueEdges(delaunay) {
	const tris = delaunay.triangles;
	const edges = new Set();
	const pairs = [];
	for (let i = 0; i < tris.length; i += 3) {
		const a = tris[i];
		const b = tris[i + 1];
		const c = tris[i + 2];
		[[a, b], [b, c], [c, a]].forEach(([p, q]) => {
			const key = p < q ? `${p}:${q}` : `${q}:${p}`;
			if (edges.has(key)) return;
			edges.add(key);
			pairs.push([p, q]);
		});
	}
	return pairs;
}

/**
 * Render a TIN surface chart into `container`. Returns `ok()` on success,
 * or `fail()` when required arguments are missing or no triangulation can
 * be built from the data.
 *
 * Common option keys: `fillMode` ('smooth' | 'flat'), `subdivisionDepth`,
 * `gradientMinColor`/`gradientMaxColor`, `gradientDistribution` ('value' |
 * 'rank'), `colorRamp` (one of `TIN_COLOR_RAMPS`), `showEdges`/`edgeColor`,
 * `showPoints`/`pointRadius`, `showZLabels`, `showHull`/`hullColor`,
 * `showIsolines`/`isolineMode` ('count' | 'step')/`isolineCount`/`isolineStep`,
 * `colorIsolinesByZ`, `showThreshold`/`thresholdValue`, axis-label toggles,
 * `customTitle`, `chartHeight`, `locale`.
 *
 * @param {HTMLElement} container - Target DOM element. Existing contents are replaced.
 * @param {Array<Object<string, *>>} dados - Source rows.
 * @param {string} eixoX - Numeric X column.
 * @param {string} eixoY - Numeric Y column.
 * @param {string} eixoZ - Numeric Z column (the surface height).
 * @param {Object} [opcoes={}] - Render options bag.
 * @returns {Result}
 */
export function renderTinChart(container, dados, eixoX, eixoY, eixoZ, opcoes = {}) {
	if (!container || !eixoX || !eixoY || !eixoZ) return fail();

	const fillMode = opcoes.fillMode === 'flat' ? 'flat' : 'smooth';
	const subdivisionDepth = clampDepth(opcoes.subdivisionDepth);
	const effectiveSubdivisionDepth = fillMode === 'flat' ? 0 : subdivisionDepth;
	const gradientMin = normalizeColor(opcoes.gradientMinColor, CHART_COLORS.tin);
	const gradientMax = normalizeColor(opcoes.gradientMaxColor, '#ffffff');
	const gradientDistribution = opcoes.gradientDistribution === 'rank' ? 'rank' : 'value';
	const colorRamp = resolveColorRamp(opcoes.colorRamp);
	const showEdges = opcoes.showEdges !== false;
	const edgeColor = normalizeColor(opcoes.edgeColor, TIN_CHART.defaultEdgeColor);
	const showPoints = opcoes.showPoints !== false;
	const pointRadius = Number.isFinite(Number(opcoes.pointRadius))
		? Math.max(1, Number(opcoes.pointRadius))
		: TIN_CHART.defaultPointRadius;
	const showZLabels = opcoes.showZLabels === true;
	const showHull = opcoes.showHull === true;
	const hullColor = normalizeColor(opcoes.hullColor, TIN_CHART.defaultHullColor);
	const showIsolines = opcoes.showIsolines === true;
	const isolineMode = opcoes.isolineMode === 'step' ? 'step' : 'count';
	const isolineCountRaw = Math.round(Number(opcoes.isolineCount));
	const isolineCount = Number.isFinite(isolineCountRaw)
		? Math.max(TIN_CHART.minIsolineCount, Math.min(TIN_CHART.maxIsolineCount, isolineCountRaw))
		: TIN_CHART.defaultIsolineCount;
	const isolineStepRaw = Number(opcoes.isolineStep);
	const isolineStep = Number.isFinite(isolineStepRaw) && isolineStepRaw > 0
		? isolineStepRaw
		: TIN_CHART.defaultIsolineStep;
	const isolineColor = normalizeColor(opcoes.isolineColor, TIN_CHART.defaultIsolineColor);
	const isolineWidthRaw = Number(opcoes.isolineWidth);
	const isolineWidth = Number.isFinite(isolineWidthRaw)
		? Math.max(TIN_CHART.minIsolineWidth, Math.min(TIN_CHART.maxIsolineWidth, isolineWidthRaw))
		: TIN_CHART.defaultIsolineWidth;
	const showIsolineLabels = opcoes.showIsolineLabels === true;
	const isolineLabelSizeRaw = Math.round(Number(opcoes.isolineLabelSize));
	const isolineLabelSize = Number.isFinite(isolineLabelSizeRaw)
		? Math.max(TIN_CHART.minIsolineLabelSize, Math.min(TIN_CHART.maxIsolineLabelSize, isolineLabelSizeRaw))
		: TIN_CHART.defaultIsolineLabelSize;
	const isolineLabelColor = normalizeColor(opcoes.isolineLabelColor, TIN_CHART.defaultIsolineLabelColor);
	const colorIsolinesByZ = opcoes.colorIsolinesByZ === true;
	const isolineMinColor = normalizeColor(opcoes.isolineMinColor, TIN_CHART.defaultIsolineMinColor);
	const isolineMaxColor = normalizeColor(opcoes.isolineMaxColor, TIN_CHART.defaultIsolineMaxColor);
	const showThreshold = opcoes.showThreshold === true;
	const thresholdValueRaw = Number(opcoes.thresholdValue);
	const thresholdValue = Number.isFinite(thresholdValueRaw)
		? thresholdValueRaw
		: TIN_CHART.defaultThresholdValue;
	const thresholdColor = normalizeColor(opcoes.thresholdColor, TIN_CHART.defaultThresholdColor);
	const thresholdWidthRaw = Number(opcoes.thresholdWidth);
	const thresholdWidth = Number.isFinite(thresholdWidthRaw)
		? Math.max(TIN_CHART.minThresholdWidth, Math.min(TIN_CHART.maxThresholdWidth, thresholdWidthRaw))
		: TIN_CHART.defaultThresholdWidth;
	const showXAxisLabel = opcoes.showXAxisLabel !== false;
	const showYAxisLabel = opcoes.showYAxisLabel !== false;
	const customTitle = String(opcoes.customTitle || '').trim().slice(0, 80);
	const chartHeight = Number.isFinite(Number(opcoes.chartHeight))
		? Math.max(220, Math.min(900, Number(opcoes.chartHeight)))
		: CHART_DIMENSIONS.tin.height;
	const locale = opcoes.locale || undefined;
	const axisLabels = {
		x: opcoes.axisLabels?.x || eixoX,
		y: opcoes.axisLabels?.y || eixoY,
		z: opcoes.axisLabels?.z || eixoZ,
	};

	const isMissing = v => v === null || v === undefined || v === '';
	const pontos = (Array.isArray(dados) ? dados : [])
		.filter(row => row && !isMissing(row[eixoX]) && !isMissing(row[eixoY]) && !isMissing(row[eixoZ]))
		.map((row, index) => ({
			x: Number(row[eixoX]),
			y: Number(row[eixoY]),
			z: Number(row[eixoZ]),
			raw: row,
			index,
		}))
		.filter(p => Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z));

	if (pontos.length < 3) return fail('insufficient-points');

	container.replaceChildren();
	hideChartTooltip();

	const largura = Math.max(container.clientWidth || CHART_DIMENSIONS.tin.width, 320);
	const altura = chartHeight;
	const margem = { ...CHART_DIMENSIONS.tin.margins };
	const titleOffset = customTitle ? 20 : 0;
	const legendHeight = 14;
	const legendGap = 22;
	const larguraInterna = Math.max(40, largura - margem.left - margem.right);
	const alturaInterna = Math.max(40, altura - margem.top - margem.bottom - titleOffset - legendGap);

	const svg = select(container)
		.append('svg')
		.attr('width', largura)
		.attr('height', altura);

	if (customTitle) {
		svg.append('text')
			.attr('x', largura / 2)
			.attr('y', 16)
			.attr('text-anchor', 'middle')
			.attr('font-size', 13)
			.attr('font-weight', 600)
			.attr('fill', '#3f3a33')
			.text(customTitle);
	}

	const grupo = svg.append('g')
		.attr('transform', `translate(${margem.left},${margem.top + titleOffset})`);

	const [xMin, xMax] = extent(pontos, p => p.x);
	const [yMin, yMax] = extent(pontos, p => p.y);
	const [zMin, zMax] = extent(pontos, p => p.z);

	const escalaX = scaleLinear()
		.domain(xMin === xMax ? [xMin - 1, xMax + 1] : [xMin, xMax])
		.nice()
		.range([0, larguraInterna]);
	const escalaY = scaleLinear()
		.domain(yMin === yMax ? [yMin - 1, yMax + 1] : [yMin, yMax])
		.nice()
		.range([alturaInterna, 0]);

	const rampInterp = colorRamp === 'custom' ? null : D3_RAMP_BY_NAME[colorRamp];
	const sampleRamp = rampInterp
		? t => rampInterp(Math.max(0, Math.min(1, t)))
		: t => interpolateColor(gradientMin, gradientMax, Math.max(0, Math.min(1, t)));

	let colorAt;
	if (gradientDistribution === 'rank') {
		const sortedZ = [...pontos.map(p => p.z)].sort((a, b) => a - b);
		const rankFor = z => {
			let lo = 0;
			let hi = sortedZ.length;
			while (lo < hi) {
				const mid = (lo + hi) >>> 1;
				if (sortedZ[mid] < z) lo = mid + 1;
				else hi = mid;
			}
			return lo / Math.max(sortedZ.length - 1, 1);
		};
		colorAt = z => sampleRamp(rankFor(z));
	} else {
		const zDelta = zMax - zMin || 1;
		colorAt = z => sampleRamp((z - zMin) / zDelta);
	}

	// In screen coordinates so the Delaunay triangulation matches what the
	// user sees (otherwise scale flipping on Y can change which triangles form).
	const screenPoints = pontos.map(p => ({
		sx: escalaX(p.x),
		sy: escalaY(p.y),
		z: p.z,
		raw: p.raw,
		index: p.index,
	}));
	const delaunay = Delaunay.from(screenPoints, d => d.sx, d => d.sy);

	const trianglesGroup = grupo.append('g').attr('class', 'tin-triangles');
	const polygons = [];
	const tris = delaunay.triangles;
	for (let i = 0; i < tris.length; i += 3) {
		const a = screenPoints[tris[i]];
		const b = screenPoints[tris[i + 1]];
		const c = screenPoints[tris[i + 2]];
		const triangle = [
			{ x: a.sx, y: a.sy, z: a.z },
			{ x: b.sx, y: b.sy, z: b.z },
			{ x: c.sx, y: c.sy, z: c.z },
		];
		emitSubdivided(triangle, effectiveSubdivisionDepth, colorAt, polygons);
	}

	trianglesGroup
		.selectAll('polygon')
		.data(polygons)
		.enter()
		.append('polygon')
		.attr('points', d => d.vertices.map(v => `${v.x},${v.y}`).join(' '))
		.attr('fill', d => d.fill)
		.attr('stroke', 'none');

	if (showHull) {
		const hull = delaunay.hullPolygon();
		if (hull && hull.length > 0) {
			grupo.append('path')
				.attr('d', `M${hull.map(pt => `${pt[0]},${pt[1]}`).join('L')}Z`)
				.attr('fill', 'none')
				.attr('stroke', hullColor)
				.attr('stroke-width', 1.5);
		}
	}

	const triangleVerts = [];
	for (let i = 0; i < tris.length; i += 3) {
		triangleVerts.push([
			screenPoints[tris[i]],
			screenPoints[tris[i + 1]],
			screenPoints[tris[i + 2]],
		]);
	}

	const attachIsolineHoverHandlers = (group) => {
		group
			.on('pointerover', event => {
				const target = event.target;
				if (!target?.classList?.contains?.('tin-isoline-hit')) return;
				const z = Number(target.dataset.z);
				if (!Number.isFinite(z)) return;
				const wrapper = document.createElement('div');
				wrapper.appendChild(createTooltipLine(axisLabels.z, formatNumber(z, locale)));
				showChartTooltip(wrapper, event.pageX, event.pageY);
			})
			.on('pointermove', event => {
				if (event.target?.classList?.contains?.('tin-isoline-hit')) {
					moveChartTooltip(event.pageX, event.pageY);
				}
			})
			.on('pointerout', event => {
				if (event.target?.classList?.contains?.('tin-isoline-hit')) {
					hideChartTooltip();
				}
			});
	};

	if (showIsolines && zMin !== zMax) {
		const isolinesGroup = grupo.append('g').attr('class', 'tin-isolines');
		let levels;
		if (isolineMode === 'step') {
			levels = [];
			let level = Math.ceil(zMin / isolineStep) * isolineStep;
			while (level <= zMax && levels.length < TIN_CHART.maxIsolineLevels) {
				levels.push(level);
				level += isolineStep;
			}
		} else {
			levels = scaleLinear().domain([zMin, zMax]).nice().ticks(isolineCount);
		}
		let labelGroup = null;
		const zDeltaForIsolines = zMax - zMin;
		const hitStrokeWidth = Math.max(6, isolineWidth);
		levels.forEach(level => {
			const { segments, longest } = computeIsolineSegments(triangleVerts, level);
			const strokeColor = colorIsolinesByZ
				? interpolateColor(isolineMinColor, isolineMaxColor, (level - zMin) / zDeltaForIsolines)
				: isolineColor;
			segments.forEach(seg => {
				isolinesGroup.append('line')
					.attr('x1', seg.x1)
					.attr('y1', seg.y1)
					.attr('x2', seg.x2)
					.attr('y2', seg.y2)
					.attr('stroke', strokeColor)
					.attr('stroke-width', isolineWidth)
					.attr('fill', 'none')
					.attr('pointer-events', 'none');
				isolinesGroup.append('line')
					.attr('class', 'tin-isoline-hit')
					.attr('x1', seg.x1)
					.attr('y1', seg.y1)
					.attr('x2', seg.x2)
					.attr('y2', seg.y2)
					.attr('stroke', 'transparent')
					.attr('stroke-width', hitStrokeWidth)
					.attr('fill', 'none')
					.attr('pointer-events', 'stroke')
					.attr('data-z', level);
			});
			if (showIsolineLabels && longest) {
				if (!labelGroup) labelGroup = grupo.append('g').attr('class', 'tin-isoline-labels');
				labelGroup.append('text')
					.attr('transform', `translate(${longest.midX},${longest.midY}) rotate(${longest.angleDeg})`)
					.attr('text-anchor', 'middle')
					.attr('dominant-baseline', 'middle')
					.attr('font-size', isolineLabelSize)
					.attr('fill', colorIsolinesByZ ? strokeColor : isolineLabelColor)
					.attr('stroke', '#fffef9')
					.attr('stroke-width', 2.5)
					.attr('paint-order', 'stroke')
					.attr('pointer-events', 'none')
					.text(formatNumber(level, locale));
			}
		});
		attachIsolineHoverHandlers(isolinesGroup);
	}

	if (showThreshold && thresholdValue >= zMin && thresholdValue <= zMax) {
		const { segments } = computeIsolineSegments(triangleVerts, thresholdValue);
		if (segments.length > 0) {
			const thresholdGroup = grupo.append('g').attr('class', 'tin-threshold-contour');
			const thresholdHitWidth = Math.max(6, thresholdWidth);
			segments.forEach(seg => {
				thresholdGroup.append('line')
					.attr('x1', seg.x1)
					.attr('y1', seg.y1)
					.attr('x2', seg.x2)
					.attr('y2', seg.y2)
					.attr('stroke', thresholdColor)
					.attr('stroke-width', thresholdWidth)
					.attr('fill', 'none')
					.attr('pointer-events', 'none');
				thresholdGroup.append('line')
					.attr('class', 'tin-isoline-hit')
					.attr('x1', seg.x1)
					.attr('y1', seg.y1)
					.attr('x2', seg.x2)
					.attr('y2', seg.y2)
					.attr('stroke', 'transparent')
					.attr('stroke-width', thresholdHitWidth)
					.attr('fill', 'none')
					.attr('pointer-events', 'stroke')
					.attr('data-z', thresholdValue);
			});
			attachIsolineHoverHandlers(thresholdGroup);
		}
	}

	if (showEdges) {
		const edges = collectUniqueEdges(delaunay);
		const edgeGroup = grupo.append('g').attr('class', 'tin-edges');
		edges.forEach(([p, q]) => {
			const a = screenPoints[p];
			const b = screenPoints[q];
			edgeGroup.append('line')
				.attr('x1', a.sx)
				.attr('y1', a.sy)
				.attr('x2', b.sx)
				.attr('y2', b.sy)
				.attr('stroke', edgeColor)
				.attr('stroke-width', 0.6)
				.attr('opacity', 0.5);
		});
	}

	if (showPoints) {
		const pointsGroup = grupo.append('g').attr('class', 'tin-points');
		const circles = pointsGroup
			.selectAll('circle')
			.data(screenPoints)
			.enter()
			.append('circle')
			.attr('cx', d => d.sx)
			.attr('cy', d => d.sy)
			.attr('r', pointRadius)
			.attr('fill', '#3f3a33')
			.attr('stroke', '#fffef9')
			.attr('stroke-width', 0.8);

		circles
			.on('mouseenter', (event, d) => {
				const wrapper = document.createElement('div');
				wrapper.appendChild(createTooltipLine(axisLabels.x, formatNumber(Number(d.raw?.[eixoX]), locale)));
				wrapper.appendChild(createTooltipLine(axisLabels.y, formatNumber(Number(d.raw?.[eixoY]), locale)));
				wrapper.appendChild(createTooltipLine(axisLabels.z, formatNumber(Number(d.raw?.[eixoZ]), locale)));
				showChartTooltip(wrapper, event.pageX, event.pageY);
			})
			.on('mousemove', event => moveChartTooltip(event.pageX, event.pageY))
			.on('mouseleave', () => hideChartTooltip());
	}

	if (showZLabels) {
		const labelGroup = grupo.append('g').attr('class', 'tin-z-labels');
		screenPoints.forEach(d => {
			labelGroup.append('text')
				.attr('x', d.sx + 5)
				.attr('y', d.sy - 5)
				.attr('font-size', 9)
				.attr('fill', '#3f3a33')
				.attr('pointer-events', 'none')
				.text(formatNumber(d.z, locale));
		});
	}

	grupo.append('g')
		.attr('transform', `translate(0,${alturaInterna})`)
		.call(axisBottom(escalaX).ticks(6));

	grupo.append('g')
		.call(axisLeft(escalaY).ticks(6));

	if (showXAxisLabel) {
		grupo.append('text')
			.attr('x', larguraInterna / 2)
			.attr('y', alturaInterna + margem.bottom - 14)
			.attr('text-anchor', 'middle')
			.attr('fill', '#5f5a53')
			.attr('font-size', 11)
			.text(axisLabels.x);
	}

	if (showYAxisLabel) {
		grupo.append('text')
			.attr('transform', 'rotate(-90)')
			.attr('x', -alturaInterna / 2)
			.attr('y', -margem.left + 16)
			.attr('text-anchor', 'middle')
			.attr('fill', '#5f5a53')
			.attr('font-size', 11)
			.text(axisLabels.y);
	}

	const legendY = margem.top + titleOffset + alturaInterna + legendGap - legendHeight;
	const legendLeft = margem.left;
	const legendWidth = Math.min(180, larguraInterna);
	const legend = svg.append('g')
		.attr('class', 'tin-legend')
		.attr('transform', `translate(${legendLeft},${legendY})`);
	const stops = 12;
	for (let i = 0; i < stops; i++) {
		const t0 = i / stops;
		const t1 = (i + 1) / stops;
		legend.append('rect')
			.attr('x', t0 * legendWidth)
			.attr('y', 0)
			.attr('width', (t1 - t0) * legendWidth + 0.5)
			.attr('height', legendHeight)
			.attr('fill', sampleRamp(t0));
	}
	legend.append('text')
		.attr('x', 0)
		.attr('y', legendHeight + 10)
		.attr('font-size', 10)
		.attr('fill', '#5f5a53')
		.text(`${axisLabels.z}: ${formatNumber(zMin, locale)}`);
	legend.append('text')
		.attr('x', legendWidth)
		.attr('y', legendHeight + 10)
		.attr('text-anchor', 'end')
		.attr('font-size', 10)
		.attr('fill', '#5f5a53')
		.text(formatNumber(zMax, locale));

	return ok({ triangles: tris.length / 3, polygons: polygons.length });
}
