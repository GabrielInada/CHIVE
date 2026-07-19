/**
 * TIN geometry and subdivision math.
 *
 * Pure helpers (no DOM, no d3) for the triangulated surface: triangle
 * midpoints, recursive fill subdivision, iso-level segment extraction, unique
 * Delaunay edge collection, and the effective subdivision-depth resolver.
 * `appendSubdividedFragments` is the one impure helper here: it feeds each
 * leaf to the caller's sink callback. Used by `renderers/svg.js`.
 */

import { TIN_CHART } from '../../config/charts/definitions/tin.js';

/** Midpoint of two TIN vertices in `{ x, y, z }` space. */
export function midpoint(a, b) {
	return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 };
}

/** Format a screen coordinate for a path `d` string. 2dp keeps the payload small. */
export function fmtCoord(n) {
	return String(Math.round(n * 100) / 100);
}

/** Round a requested subdivision depth and clamp it to the configured bounds. */
export function clampDepth(value) {
	const n = Math.round(Number(value));
	if (!Number.isFinite(n)) return TIN_CHART.defaultSubdivisionDepth;
	return Math.max(TIN_CHART.minSubdivisionDepth, Math.min(TIN_CHART.maxSubdivisionDepth, n));
}

/**
 * Resolve the effective subdivision depth for the surface fill. Renderer-internal;
 * exported so it can be unit-tested without a DOM or a Delaunay run.
 *
 * Flat mode and constant-Z surfaces collapse to depth 0 (every leaf would share a
 * single color bucket, so subdivision adds nothing). Otherwise the requested depth
 * is clamped to the configured bounds and then stepped down until the leaf count
 * fits the surface budget, which bounds the geometry/path work for large datasets.
 *
 * @param {Object} args
 * @param {number} args.requestedDepth
 * @param {string} args.fillMode - 'flat' collapses to depth 0.
 * @param {number} args.zMin
 * @param {number} args.zMax
 * @param {number} args.triangleCount - Base Delaunay triangle count.
 * @returns {number} Effective depth, never negative.
 */
export function resolveSurfaceDepth({ requestedDepth, fillMode, zMin, zMax, triangleCount }) {
	if (fillMode === 'flat' || zMin === zMax) return 0;
	let depth = clampDepth(requestedDepth);
	while (depth > 0 && triangleCount * 4 ** depth > TIN_CHART.maxSurfaceLeaves) {
		depth--;
	}
	return depth;
}

// Recursively subdivides a triangle into 4^depth sub-triangles and hands each
// leaf's mean-Z plus path fragment to a caller-provided sink. Leaves go
// straight into the sink rather than an intermediate object per leaf, so a
// single render can produce hundreds of thousands of facets without the
// matching GC churn. The renderer supplies a mode-specific sink: the optimized
// mode files fragments into per-bucket lists, the full-ramp mode groups them
// by exact ramp color; either way each group merges into one <path>.
/**
 * @param {Array} triangle - `[a, b, c]` vertices in `{ x, y, z }` screen space.
 * @param {number} depth - Remaining subdivision levels.
 * @param {(meanZ: number, fragment: string) => void} pushLeaf - Leaf sink;
 *   receives each leaf's mean-Z and its `M...L...L...Z` path fragment.
 */
export function appendSubdividedFragments(triangle, depth, pushLeaf) {
	if (depth <= 0) {
		const [a, b, c] = triangle;
		const meanZ = (a.z + b.z + c.z) / 3;
		const fragment = `M${fmtCoord(a.x)},${fmtCoord(a.y)}L${fmtCoord(b.x)},${fmtCoord(b.y)}L${fmtCoord(c.x)},${fmtCoord(c.y)}Z`;
		pushLeaf(meanZ, fragment);
		return;
	}
	const [a, b, c] = triangle;
	const ab = midpoint(a, b);
	const bc = midpoint(b, c);
	const ca = midpoint(c, a);
	appendSubdividedFragments([a, ab, ca], depth - 1, pushLeaf);
	appendSubdividedFragments([b, bc, ab], depth - 1, pushLeaf);
	appendSubdividedFragments([c, ca, bc], depth - 1, pushLeaf);
	appendSubdividedFragments([ab, bc, ca], depth - 1, pushLeaf);
}

// Computes the iso-segment crossings for a single Z level across an array of
// triangles in screen coordinates. Returns the visible segments plus a
// descriptor of the longest one (used to anchor a label or any per-level
// annotation). Pure function, extracted so the regular-isoline pass, the
// threshold contour, and any per-segment styling all consume one source of
// truth for level-crossing geometry.
export function computeIsolineSegments(triangleVerts, level) {
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

/**
 * Collect the unique undirected edges of a triangulation.
 *
 * Takes the raw `delaunay.triangles` index array (not the d3 Delaunay object)
 * so this module stays free of any d3-owned type.
 *
 * @param {ArrayLike<number>} triangles - Flat triangle-vertex index array.
 * @returns {Array<[number, number]>} Unique vertex-index pairs.
 */
export function collectUniqueEdges(triangles) {
	const edges = new Set();
	const pairs = [];
	for (let i = 0; i < triangles.length; i += 3) {
		const a = triangles[i];
		const b = triangles[i + 1];
		const c = triangles[i + 2];
		[[a, b], [b, c], [c, a]].forEach(([p, q]) => {
			const key = p < q ? `${p}:${q}` : `${q}:${p}`;
			if (edges.has(key)) return;
			edges.add(key);
			pairs.push([p, q]);
		});
	}
	return pairs;
}
