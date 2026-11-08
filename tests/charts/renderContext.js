/**
 * Explicit text fixtures for low-level renderer tests and stable SVG snapshots.
 * Presentation tests exercise the real translated labels instead.
 */
const LABELS = {
	close: 'Close', category: 'Category', measure: 'Value', percentage: 'Percentage',
	other: 'Other', missing: '(missing)', group: 'Group', children: 'Children', level: 'Level',
	node: 'Node', linkWeight: 'Weight', source: 'Source', target: 'Target',
	xAxis: 'X', yAxis: 'Y', index: 'Index', count: 'Count',
	regressionSlope: 'Slope', regressionIntercept: 'Intercept', regressionR2: 'R²',
	regressionN: 'Points', regressionGroup: 'Group',
	filterActions: { filterBySource: 'Filter source', filterByTarget: 'Filter target' },
};

export function renderContext(columns, overrides = {}) {
	const labels = { ...LABELS, ...overrides.labels };
	return {
		...overrides,
		labels,
		axisLabels: {
			x: columns.category ?? columns.x,
			y: columns.category ? labels.measure : columns.y,
			z: columns.z,
			...overrides.axisLabels,
		},
	};
}
