// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	t: vi.fn((key, ...args) => (args.length ? `${key}(${args.join(',')})` : key)),
}));

vi.mock('../../../src/services/i18nService.js', () => ({
	t: mocks.t,
}));

import {
	createChartFilterControls,
	setupChartFilterControlListeners,
} from '../../../src/modules/chart-controls/filterControls.js';

const ROWS = [
	{ region: 'North', sales: 10 },
	{ region: 'North', sales: 15 },
	{ region: 'South', sales: 20 },
	{ region: 'East', sales: 5 },
];

function appendControls(controls) {
	controls.forEach(control => document.body.appendChild(control));
}

describe('filterControls UI structure', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		document.body.innerHTML = '';
	});

	it('renders only the column select when no column is selected', () => {
		const controls = createChartFilterControls({
			chartKey: 'bar',
			rows: ROWS,
			allColumns: ['region', 'sales'],
			numericColumns: ['sales'],
			rawFilter: { column: null },
		});
		appendControls(controls);

		expect(document.getElementById('viz-filter-bar-column')).not.toBeNull();
		expect(document.getElementById('viz-filter-bar-operator')).toBeNull();
		expect(document.getElementById('viz-filter-bar-list')).toBeNull();
	});

	it('renders operator + min + max when a numeric column is filtered with between', () => {
		const controls = createChartFilterControls({
			chartKey: 'bar',
			rows: ROWS,
			allColumns: ['region', 'sales'],
			numericColumns: ['sales'],
			rawFilter: { column: 'sales', operator: 'between', min: '10', max: '20' },
		});
		appendControls(controls);

		const operator = document.getElementById('viz-filter-bar-operator');
		expect(operator).not.toBeNull();
		expect(Array.from(operator.options).map(o => o.value)).toEqual(['between', 'lt', 'gt', 'eq']);
		expect(document.getElementById('viz-filter-bar-min')).not.toBeNull();
		expect(document.getElementById('viz-filter-bar-max')).not.toBeNull();
		expect(document.getElementById('viz-filter-bar-value')).toBeNull();
	});

	it('renders a single value input for non-between numeric operators', () => {
		const controls = createChartFilterControls({
			chartKey: 'bar',
			rows: ROWS,
			allColumns: ['region', 'sales'],
			numericColumns: ['sales'],
			rawFilter: { column: 'sales', operator: 'gt', value: '5' },
		});
		appendControls(controls);

		expect(document.getElementById('viz-filter-bar-min')).toBeNull();
		expect(document.getElementById('viz-filter-bar-max')).toBeNull();
		expect(document.getElementById('viz-filter-bar-value')).not.toBeNull();
	});

	it('renders search + checkbox list + select-all/clear buttons in categorical mode', () => {
		const controls = createChartFilterControls({
			chartKey: 'bar',
			rows: ROWS,
			allColumns: ['region', 'sales'],
			numericColumns: ['sales'],
			rawFilter: { column: 'region', include: [] },
		});
		appendControls(controls);

		expect(document.getElementById('viz-filter-bar-search')).not.toBeNull();
		expect(document.getElementById('viz-filter-bar-list')).not.toBeNull();
		expect(document.getElementById('viz-filter-bar-select-all')).not.toBeNull();
		expect(document.getElementById('viz-filter-bar-clear')).not.toBeNull();

		const checkboxes = document.querySelectorAll('#viz-filter-bar-list input[type="checkbox"][data-token]');
		const tokens = Array.from(checkboxes).map(cb => cb.dataset.token).sort();
		expect(tokens).toEqual(['v:East', 'v:North', 'v:South']);
	});
});

describe('filterControls listeners', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		document.body.innerHTML = '';
	});

	it('switching to a numeric column emits a numeric filter scaffold', () => {
		const onFilterChange = vi.fn();
		const controls = createChartFilterControls({
			chartKey: 'bar',
			rows: ROWS,
			allColumns: ['region', 'sales'],
			numericColumns: ['sales'],
			rawFilter: { column: null },
		});
		appendControls(controls);

		setupChartFilterControlListeners({
			chartKey: 'bar',
			rows: ROWS,
			numericColumns: ['sales'],
			rawFilter: { column: null },
			onFilterChange,
		});

		const columnSelect = document.getElementById('viz-filter-bar-column');
		columnSelect.value = 'sales';
		columnSelect.dispatchEvent(new Event('change', { bubbles: true }));

		expect(onFilterChange).toHaveBeenCalledTimes(1);
		expect(onFilterChange).toHaveBeenCalledWith(
			expect.objectContaining({ column: 'sales', mode: 'numeric', operator: 'between' }),
		);
	});

	it('switching to a categorical column emits a categorical filter with all tokens included', () => {
		const onFilterChange = vi.fn();
		const controls = createChartFilterControls({
			chartKey: 'bar',
			rows: ROWS,
			allColumns: ['region', 'sales'],
			numericColumns: ['sales'],
			rawFilter: { column: null },
		});
		appendControls(controls);

		setupChartFilterControlListeners({
			chartKey: 'bar',
			rows: ROWS,
			numericColumns: ['sales'],
			rawFilter: { column: null },
			onFilterChange,
		});

		const columnSelect = document.getElementById('viz-filter-bar-column');
		columnSelect.value = 'region';
		columnSelect.dispatchEvent(new Event('change', { bubbles: true }));

		expect(onFilterChange).toHaveBeenCalledTimes(1);
		const payload = onFilterChange.mock.calls[0][0];
		expect(payload.column).toBe('region');
		expect(payload.mode).toBe('categorical');
		expect(payload.include.sort()).toEqual(['v:East', 'v:North', 'v:South']);
	});

	it('emits min/max on either input change in between mode', () => {
		const onFilterChange = vi.fn();
		const controls = createChartFilterControls({
			chartKey: 'bar',
			rows: ROWS,
			allColumns: ['region', 'sales'],
			numericColumns: ['sales'],
			rawFilter: { column: 'sales', operator: 'between', min: '', max: '' },
		});
		appendControls(controls);

		setupChartFilterControlListeners({
			chartKey: 'bar',
			rows: ROWS,
			numericColumns: ['sales'],
			rawFilter: { column: 'sales', operator: 'between', min: '', max: '' },
			onFilterChange,
		});

		const minInput = document.getElementById('viz-filter-bar-min');
		minInput.value = '7';
		minInput.dispatchEvent(new Event('change', { bubbles: true }));

		expect(onFilterChange).toHaveBeenCalledWith(expect.objectContaining({ min: '7', max: '' }));

		const maxInput = document.getElementById('viz-filter-bar-max');
		maxInput.value = '15';
		maxInput.dispatchEvent(new Event('change', { bubbles: true }));

		expect(onFilterChange).toHaveBeenLastCalledWith(expect.objectContaining({ min: '7', max: '15' }));
	});

	it('checking a single value emits include with just that token', () => {
		const onFilterChange = vi.fn();
		const controls = createChartFilterControls({
			chartKey: 'bar',
			rows: ROWS,
			allColumns: ['region', 'sales'],
			numericColumns: ['sales'],
			rawFilter: { column: 'region', include: [] },
		});
		appendControls(controls);

		setupChartFilterControlListeners({
			chartKey: 'bar',
			rows: ROWS,
			numericColumns: ['sales'],
			rawFilter: { column: 'region', include: [] },
			onFilterChange,
		});

		const north = document.querySelector('#viz-filter-bar-list input[data-token="v:North"]');
		expect(north).not.toBeNull();
		north.checked = true;
		north.dispatchEvent(new Event('change', { bubbles: true }));

		expect(onFilterChange).toHaveBeenCalledTimes(1);
		expect(onFilterChange).toHaveBeenCalledWith(expect.objectContaining({ include: ['v:North'] }));
	});

	it('select-all button checks every visible row and emits the full include set', () => {
		const onFilterChange = vi.fn();
		const controls = createChartFilterControls({
			chartKey: 'bar',
			rows: ROWS,
			allColumns: ['region', 'sales'],
			numericColumns: ['sales'],
			rawFilter: { column: 'region', include: [] },
		});
		appendControls(controls);

		setupChartFilterControlListeners({
			chartKey: 'bar',
			rows: ROWS,
			numericColumns: ['sales'],
			rawFilter: { column: 'region', include: [] },
			onFilterChange,
		});

		document.getElementById('viz-filter-bar-select-all').click();

		expect(onFilterChange).toHaveBeenCalledTimes(1);
		const payload = onFilterChange.mock.calls[0][0];
		expect(payload.include.sort()).toEqual(['v:East', 'v:North', 'v:South']);
	});

	it('clear button unchecks all and emits an empty include set', () => {
		const onFilterChange = vi.fn();
		const controls = createChartFilterControls({
			chartKey: 'bar',
			rows: ROWS,
			allColumns: ['region', 'sales'],
			numericColumns: ['sales'],
			rawFilter: { column: 'region', include: ['v:North', 'v:South', 'v:East'] },
		});
		appendControls(controls);

		setupChartFilterControlListeners({
			chartKey: 'bar',
			rows: ROWS,
			numericColumns: ['sales'],
			rawFilter: { column: 'region', include: ['v:North', 'v:South', 'v:East'] },
			onFilterChange,
		});

		document.getElementById('viz-filter-bar-clear').click();

		expect(onFilterChange).toHaveBeenCalledTimes(1);
		expect(onFilterChange).toHaveBeenCalledWith(expect.objectContaining({ include: [] }));
	});

	it('search input does NOT emit on `input` — only on `change` (blur/Enter)', () => {
		const onFilterChange = vi.fn();
		const controls = createChartFilterControls({
			chartKey: 'bar',
			rows: ROWS,
			allColumns: ['region', 'sales'],
			numericColumns: ['sales'],
			rawFilter: { column: 'region', include: [] },
		});
		appendControls(controls);

		setupChartFilterControlListeners({
			chartKey: 'bar',
			rows: ROWS,
			numericColumns: ['sales'],
			rawFilter: { column: 'region', include: [] },
			onFilterChange,
		});

		const search = document.getElementById('viz-filter-bar-search');
		search.value = 'No';
		search.dispatchEvent(new Event('input', { bubbles: true }));

		// Live-renders the list but does not commit
		expect(onFilterChange).not.toHaveBeenCalled();

		search.dispatchEvent(new Event('change', { bubbles: true }));
		expect(onFilterChange).toHaveBeenCalledTimes(1);
		expect(onFilterChange).toHaveBeenCalledWith(expect.objectContaining({ search: 'No' }));
	});
});
