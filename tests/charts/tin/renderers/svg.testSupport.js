export const VALID_ROWS = [
	{ x: 0, y: 0, z: 1 },
	{ x: 10, y: 0, z: 3 },
	{ x: 10, y: 10, z: 5 },
	{ x: 0, y: 10, z: 7 },
	{ x: 5, y: 5, z: 4 },
];

export const BW_RAMP = { colorRamp: 'custom', gradientMinColor: '#000000', gradientMaxColor: '#ffffff' };

// Each <path> in .tin-triangles holds one subpath (an `M...Z` block) per leaf
// triangle in its color bucket, so counting `M`s recovers the leaf total that
// the old per-polygon DOM exposed directly.
export function countSubpaths(container) {
	let total = 0;
	for (const path of container.querySelectorAll('.tin-triangles path')) {
		total += (path.getAttribute('d').match(/M/g) || []).length;
	}
	return total;
}

export function pathFills(container) {
	return Array.from(container.querySelectorAll('.tin-triangles path')).map(p => p.getAttribute('fill'));
}

export function gridRows(n, zFn) {
	const rows = [];
	for (let i = 0; i < n; i++) {
		for (let j = 0; j < n; j++) {
			rows.push({ x: i, y: j, z: zFn(i, j) });
		}
	}
	return rows;
}
