/**
 * TIN (Triangulated Irregular Network) surface renderer (orchestrator).
 *
 * Renders a Z surface over X/Y points using Delaunay triangulation, with
 * configurable subdivision, color ramps (Viridis/Inferno/Plasma/etc.),
 * isolines, hull outline, and an optional threshold line. The most
 * option-dense of the chart renderers. The pipeline is split across peer
 * modules under `charts/tin/` and wired together here: option
 * normalization, color-scale construction, subdivision/iso geometry, and the
 * isoline hover interaction. Shared SVG/axis scaffolding lives in
 * {@link chartScaffold}.
 *
 * The surface fill groups leaves into compound paths by color, with two
 * browser-local rendering modes (`colorRenderingMode`):
 *
 * - `optimized` (default): each subdivided leaf triangle is filed into one of
 *   `TIN_CHART.rampBuckets` color buckets by its mean-Z, and every leaf in a
 *   bucket is merged into a single <path>. That caps the fill DOM (and SVG
 *   export) at one node per bucket instead of one per leaf, so a render that
 *   would emit tens of thousands of polygons stays cheap enough to repaint
 *   live while a color picker drags. The trade-off is fills deviating from the
 *   exact ramp by at most half a bucket.
 * - `full-ramp`: each leaf keeps its exact `colorAt(meanZ)` ramp color, and
 *   leaves whose final CSS color strings are exactly equal share one compound
 *   <path>. Lossless with respect to the per-leaf color; can emit more paths
 *   than the bucketed mode.
 *
 * Both modes share the same triangulation, subdivision traversal, and adaptive
 * depth budget. Flat fill mode is grouped the same way, and a constant-Z
 * surface paints at the ramp's low color in either mode.
 *
 * @typedef {import('../../../types.js').Result} Result
 */

import { Delaunay, axisBottom, axisLeft, extent, scaleLinear } from '../../../../vendor/d3/d3.js';
import { CHART_DIMENSIONS } from '../../../config/charts/definitions.js';
import { TIN_CHART } from '../../../config/charts/definitions/tin.js';
import { formatNumber, toFiniteNumber } from '../../../utils/formatters.js';
import { interpolateColor } from '../../../utils/colorUtils.js';
import { ok, fail } from '../../../utils/result.js';
import { createTooltipLine, hideChartTooltip, moveChartTooltip, showChartTooltip } from '../../shared/tooltip/tooltip.js';
import {
	appendAxisLabels,
	appendBottomAxis,
	appendLeftAxis,
	setupChartSvg,
} from '../../shared/svg/scaffold.js';
import { normalizeTinOptions } from '../options.js';
import { createTinColorScale } from '../color.js';
import {
	appendSubdividedFragments,
	collectUniqueEdges,
	computeIsolineSegments,
	resolveSurfaceDepth,
} from '../math.js';
import { createIsolineHoverHandlers } from '../interaction.js';

/**
 * Render a TIN surface chart into `container`. Returns `ok()` on success,
 * or `fail()` when required arguments are missing or no triangulation can
 * be built from the data.
 *
 * Common option keys: `fillMode` ('smooth' | 'flat'), `colorRenderingMode`
 * ('optimized' | 'full-ramp'), `subdivisionDepth`,
 * `gradientMinColor`/`gradientMaxColor`, `gradientDistribution` ('value' |
 * 'rank'), `colorRamp` (one of `TIN_COLOR_RAMPS`), `showEdges`/`edgeColor`,
 * `showPoints`/`pointRadius`, `showZLabels`, `showHull`/`hullColor`,
 * `showIsolines`/`isolineMode` ('count' | 'step')/`isolineCount`/`isolineStep`,
 * `colorIsolinesByZ`, `showThreshold`/`thresholdValue`, axis-label toggles,
 * `customTitle`, `chartHeight`, `locale`.
 *
 * @param {HTMLElement} container - Target DOM element. Existing contents are replaced.
 * @param {Array<Object<string, *>>} rows - Source rows.
 * @param {string} xColumn - Numeric X column.
 * @param {string} yColumn - Numeric Y column.
 * @param {string} zColumn - Numeric Z column (the surface height).
 * @param {Object} [options={}] - Render options bag.
 * @returns {Result}
 */
export function renderTinChart(container, rows, xColumn, yColumn, zColumn, options = {}) {
	if (!container || !xColumn || !yColumn || !zColumn) return fail();

	const cfg = normalizeTinOptions(options, xColumn, yColumn, zColumn);
	const { axisLabels, locale } = cfg;

	const hasCoordinate = value => Number.isFinite(toFiniteNumber(value));
	const points = (Array.isArray(rows) ? rows : [])
		.filter(row => row && hasCoordinate(row[xColumn]) && hasCoordinate(row[yColumn]) && hasCoordinate(row[zColumn]))
		.map((row, index) => ({
			x: toFiniteNumber(row[xColumn]),
			y: toFiniteNumber(row[yColumn]),
			z: toFiniteNumber(row[zColumn]),
			raw: row,
			index,
		}))
		.filter(p => Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z));

	if (points.length < 3) return fail('insufficient-points');

	const width = Math.max(container.clientWidth || CHART_DIMENSIONS.tin.width, 320);
	const height = cfg.chartHeight;
	const margin = { ...CHART_DIMENSIONS.tin.margins };
	const legendHeight = 14;
	const legendGap = 22;
	const {
		svg,
		group,
		innerWidth,
		innerHeight,
		appliedTitleOffset: titleOffset,
	} = setupChartSvg(container, {
		width,
		height,
		margin,
		customTitle: cfg.customTitle,
		minInnerWidth: 40,
		minInnerHeight: 40,
		innerHeightReserve: legendGap,
	});
	hideChartTooltip();

	const [xMin, xMax] = extent(points, p => p.x);
	const [yMin, yMax] = extent(points, p => p.y);
	const [zMin, zMax] = extent(points, p => p.z);

	const xScale = scaleLinear()
		.domain(xMin === xMax ? [xMin - 1, xMax + 1] : [xMin, xMax])
		.nice()
		.range([0, innerWidth]);
	const yScale = scaleLinear()
		.domain(yMin === yMax ? [yMin - 1, yMax + 1] : [yMin, yMax])
		.nice()
		.range([innerHeight, 0]);

	const { sampleRamp, colorAt, bucketAt, bucketCount } = createTinColorScale({
		colorRamp: cfg.colorRamp,
		gradientMin: cfg.gradientMin,
		gradientMax: cfg.gradientMax,
		gradientDistribution: cfg.gradientDistribution,
		zValues: points.map(p => p.z),
		zMin,
		zMax,
	});

	// In screen coordinates so the Delaunay triangulation matches what the
	// user sees (otherwise scale flipping on Y can change which triangles form).
	const screenPoints = points.map(p => ({
		sx: xScale(p.x),
		sy: yScale(p.y),
		z: p.z,
		raw: p.raw,
		index: p.index,
	}));
	const delaunay = Delaunay.from(screenPoints, d => d.sx, d => d.sy);

	const trianglesGroup = group.append('g').attr('class', 'tin-triangles');
	const tris = delaunay.triangles;
	const triangleCount = tris.length / 3;
	const effectiveSubdivisionDepth = resolveSurfaceDepth({
		requestedDepth: cfg.requestedSubdivisionDepth,
		fillMode: cfg.fillMode,
		zMin,
		zMax,
		triangleCount,
	});
	// Mode-specific leaf sinks over one shared traversal. Optimized files each
	// leaf into a fixed bucket array; full-ramp groups leaves by their exact
	// colorAt(meanZ) CSS color, in first-leaf encounter order (Map insertion
	// order), so the output stays deterministic in both modes.
	const fullRamp = cfg.colorRenderingMode === 'full-ramp';
	const bucketFragments = fullRamp ? null : Array.from({ length: bucketCount }, () => []);
	/** @type {Map<string, string[]> | null} */
	const colorFragments = fullRamp ? new Map() : null;
	const pushLeaf = fullRamp
		? (meanZ, fragment) => {
			const color = colorAt(meanZ);
			const fragments = colorFragments.get(color);
			if (fragments) fragments.push(fragment);
			else colorFragments.set(color, [fragment]);
		}
		: (meanZ, fragment) => {
			bucketFragments[bucketAt(meanZ)].push(fragment);
		};
	for (let i = 0; i < tris.length; i += 3) {
		const a = screenPoints[tris[i]];
		const b = screenPoints[tris[i + 1]];
		const c = screenPoints[tris[i + 2]];
		const triangle = [
			{ x: a.sx, y: a.sy, z: a.z },
			{ x: b.sx, y: b.sy, z: b.z },
			{ x: c.sx, y: c.sy, z: c.z },
		];
		appendSubdividedFragments(triangle, effectiveSubdivisionDepth, pushLeaf);
	}

	// One <path> per non-empty color group instead of one <polygon> per leaf.
	if (fullRamp) {
		// Constant-Z needs no special case here: tForZ collapses to 0, so every
		// leaf's colorAt is already the ramp's low color and one path comes out.
		for (const [color, fragments] of colorFragments) {
			trianglesGroup.append('path')
				.attr('d', fragments.join(''))
				.attr('fill', color)
				.attr('stroke', 'none');
		}
	} else {
		// A constant-Z surface (single bucket, depth 0) paints at the ramp's low
		// color to match the pre-bucketing output; otherwise each bucket uses its
		// center.
		const constantZ = zMin === zMax;
		for (let bucket = 0; bucket < bucketCount; bucket++) {
			const fragments = bucketFragments[bucket];
			if (fragments.length === 0) continue;
			trianglesGroup.append('path')
				.attr('d', fragments.join(''))
				.attr('fill', sampleRamp(constantZ ? 0 : (bucket + 0.5) / bucketCount))
				.attr('stroke', 'none');
		}
	}

	if (cfg.showHull) {
		const hull = delaunay.hullPolygon();
		if (hull && hull.length > 0) {
			group.append('path')
				.attr('d', `M${hull.map(pt => `${pt[0]},${pt[1]}`).join('L')}Z`)
				.attr('fill', 'none')
				.attr('stroke', cfg.hullColor)
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

	const attachIsolineHoverHandlers = createIsolineHoverHandlers({ axisLabels, locale });

	if (cfg.showIsolines && zMin !== zMax) {
		const isolinesGroup = group.append('g').attr('class', 'tin-isolines');
		let levels;
		if (cfg.isolineMode === 'step') {
			levels = [];
			let level = Math.ceil(zMin / cfg.isolineStep) * cfg.isolineStep;
			while (level <= zMax && levels.length < TIN_CHART.maxIsolineLevels) {
				levels.push(level);
				level += cfg.isolineStep;
			}
		} else {
			levels = scaleLinear().domain([zMin, zMax]).nice().ticks(cfg.isolineCount);
		}
		let labelGroup = null;
		const zDeltaForIsolines = zMax - zMin;
		const hitStrokeWidth = Math.max(6, cfg.isolineWidth);
		levels.forEach(level => {
			const { segments, longest } = computeIsolineSegments(triangleVerts, level);
			const strokeColor = cfg.colorIsolinesByZ
				? interpolateColor(cfg.isolineMinColor, cfg.isolineMaxColor, (level - zMin) / zDeltaForIsolines)
				: cfg.isolineColor;
			segments.forEach(seg => {
				isolinesGroup.append('line')
					.attr('x1', seg.x1)
					.attr('y1', seg.y1)
					.attr('x2', seg.x2)
					.attr('y2', seg.y2)
					.attr('stroke', strokeColor)
					.attr('stroke-width', cfg.isolineWidth)
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
			if (cfg.showIsolineLabels && longest) {
				if (!labelGroup) labelGroup = group.append('g').attr('class', 'tin-isoline-labels');
				labelGroup.append('text')
					.attr('transform', `translate(${longest.midX},${longest.midY}) rotate(${longest.angleDeg})`)
					.attr('text-anchor', 'middle')
					.attr('dominant-baseline', 'middle')
					.attr('font-size', cfg.isolineLabelSize)
					.attr('fill', cfg.colorIsolinesByZ ? strokeColor : cfg.isolineLabelColor)
					.attr('stroke', '#fffef9')
					.attr('stroke-width', 2.5)
					.attr('paint-order', 'stroke')
					.attr('pointer-events', 'none')
					.text(formatNumber(level, locale));
			}
		});
		attachIsolineHoverHandlers(isolinesGroup);
	}

	if (cfg.showThreshold && cfg.thresholdValue >= zMin && cfg.thresholdValue <= zMax) {
		const { segments } = computeIsolineSegments(triangleVerts, cfg.thresholdValue);
		if (segments.length > 0) {
			const thresholdGroup = group.append('g').attr('class', 'tin-threshold-contour');
			const thresholdHitWidth = Math.max(6, cfg.thresholdWidth);
			segments.forEach(seg => {
				thresholdGroup.append('line')
					.attr('x1', seg.x1)
					.attr('y1', seg.y1)
					.attr('x2', seg.x2)
					.attr('y2', seg.y2)
					.attr('stroke', cfg.thresholdColor)
					.attr('stroke-width', cfg.thresholdWidth)
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
					.attr('data-z', cfg.thresholdValue);
			});
			attachIsolineHoverHandlers(thresholdGroup);
		}
	}

	if (cfg.showEdges) {
		const edges = collectUniqueEdges(delaunay.triangles);
		const edgeGroup = group.append('g').attr('class', 'tin-edges');
		edges.forEach(([p, q]) => {
			const a = screenPoints[p];
			const b = screenPoints[q];
			edgeGroup.append('line')
				.attr('x1', a.sx)
				.attr('y1', a.sy)
				.attr('x2', b.sx)
				.attr('y2', b.sy)
				.attr('stroke', cfg.edgeColor)
				.attr('stroke-width', 0.6)
				.attr('opacity', 0.5);
		});
	}

	if (cfg.showPoints) {
		const pointsGroup = group.append('g').attr('class', 'tin-points');
		const circles = pointsGroup
			.selectAll('circle')
			.data(screenPoints)
			.enter()
			.append('circle')
			.attr('cx', d => d.sx)
			.attr('cy', d => d.sy)
			.attr('r', cfg.pointRadius)
			.attr('fill', '#3f3a33')
			.attr('stroke', '#fffef9')
			.attr('stroke-width', 0.8);

		circles
			.on('mouseenter', (event, d) => {
				const wrapper = document.createElement('div');
				wrapper.appendChild(createTooltipLine(axisLabels.x, formatNumber(d.x, locale)));
				wrapper.appendChild(createTooltipLine(axisLabels.y, formatNumber(d.y, locale)));
				wrapper.appendChild(createTooltipLine(axisLabels.z, formatNumber(d.z, locale)));
				showChartTooltip(wrapper, event.pageX, event.pageY);
			})
			.on('mousemove', event => moveChartTooltip(event.pageX, event.pageY))
			.on('mouseleave', () => hideChartTooltip());
	}

	if (cfg.showZLabels) {
		const labelGroup = group.append('g').attr('class', 'tin-z-labels');
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

	appendBottomAxis(group, {
		axis: axisBottom(xScale).ticks(6),
		innerHeight,
	});

	appendLeftAxis(group, { axis: axisLeft(yScale).ticks(6) });

	appendAxisLabels(group, {
		innerWidth,
		innerHeight,
		marginLeft: margin.left,
		marginBottom: margin.bottom,
		axisLabels,
		showX: cfg.showXAxisLabel,
		showY: cfg.showYAxisLabel,
		xBottomInset: 14,
	});

	const legendY = margin.top + titleOffset + innerHeight + legendGap - legendHeight;
	const legendLeft = margin.left;
	const legendWidth = Math.min(180, innerWidth);
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

	return ok({ triangles: triangleCount, polygons: triangleCount * 4 ** effectiveSubdivisionDepth });
}
