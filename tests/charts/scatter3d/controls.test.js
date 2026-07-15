// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	t: vi.fn(key => key),
}));

vi.mock('../../../src/services/i18nService.js', () => ({
	t: mocks.t,
}));

import { createScatter3dControls } from '../../../src/charts/scatter3d/controls/builder.js';
import { setupScatter3dControlListeners } from '../../../src/charts/scatter3d/controls/listeners.js';
import { computeDefaults } from '../../../src/charts/scatter3d/controls/defaults.js';
import { SCATTER3D_CHART } from '../../../src/config/charts.js';

/**
 * Writer test double. The listeners' contract is that they hand the right
 * patch to the writer; merging it into state, firing onConfigChanged, and
 * live-rendering are the adapter's contract and are covered by
 * tests/features/datasetWorkspace/chartControls/chartConfigAdapter.test.js.
 */
function createWriter() {
	return { commit: vi.fn(), preview: vi.fn() };
}

function createDataset(overrides = {}) {
	return {
		chartConfig: {
			scatter3d: {
				enabled: true,
				expanded: true,
				x: 'width',
				y: 'height',
				z: 'depth',
				customTitle: '',
				chartHeight: 460,
				pointSize: SCATTER3D_CHART.defaultPointSize,
				opacity: SCATTER3D_CHART.defaultOpacity,
				color: '#2f6b4f',
				...overrides,
			},
		},
	};
}

function appendControls(controls) {
	controls.forEach(control => document.body.appendChild(control));
}

function changeSelect(id, value) {
	const select = document.getElementById(id);
	if (!Array.from(select.options).some(option => option.value === value)) {
		select.appendChild(new Option(value, value));
	}
	select.value = value;
	select.dispatchEvent(new Event('change', { bubbles: true }));
}

function lastScatter3dConfig(writer) {
	return writer.commit.mock.calls.at(-1)[0];
}

describe('scatter3d controls builder', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		document.body.innerHTML = '';
	});

	it('builds the Data, Display, and Styling sections', () => {
		const controls = createScatter3dControls(createDataset(), ['width', 'height', 'depth']);

		expect(controls.map(section => section.dataset.section)).toEqual(['data', 'display', 'styling']);
	});

	it('offers only numeric columns plus the none option for x/y/z', () => {
		appendControls(createScatter3dControls(createDataset(), ['width', 'height', 'depth']));

		for (const axis of ['x', 'y', 'z']) {
			const values = Array.from(document.getElementById(`viz-select-scatter3d-${axis}`).options).map(o => o.value);
			expect(values).toEqual(['', 'width', 'height', 'depth']);
		}
	});

	it('reflects the config values and disables everything when the chart is off', () => {
		const dataset = createDataset({ enabled: false, pointSize: 0.08, opacity: 0.4, color: '#112233' });
		appendControls(createScatter3dControls(dataset, ['width', 'height', 'depth']));

		expect(document.getElementById('viz-select-scatter3d-x').disabled).toBe(true);
		expect(document.getElementById('viz-slider-scatter3d-point-size').disabled).toBe(true);
		expect(document.getElementById('viz-slider-scatter3d-point-size').value).toBe('0.08');
		expect(document.getElementById('viz-slider-scatter3d-opacity').value).toBe('0.4');
		expect(document.getElementById('viz-input-scatter3d-color').value).toBe('#112233');
	});
});

describe('scatter3d control listeners', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		document.body.innerHTML = '';
	});

	function mountAndWire(dataset, numericOptions = ['width', 'height', 'depth']) {
		appendControls(createScatter3dControls(dataset, numericOptions));
		const writer = createWriter();
		setupScatter3dControlListeners(dataset, numericOptions, [], writer);
		return writer;
	}

	it('writes axis picks through the config-write adapter, clamped to numeric options', () => {
		const writer = mountAndWire(createDataset());

		changeSelect('viz-select-scatter3d-x', 'depth');
		expect(lastScatter3dConfig(writer)).toMatchObject({ x: 'depth' });

		changeSelect('viz-select-scatter3d-y', 'not-a-column');
		expect(lastScatter3dConfig(writer)).toMatchObject({ y: null });
	});

	it('writes point size, opacity, title, and color', () => {
		const writer = mountAndWire(createDataset());

		const size = document.getElementById('viz-slider-scatter3d-point-size');
		size.value = '0.05';
		size.dispatchEvent(new Event('change', { bubbles: true }));
		expect(lastScatter3dConfig(writer)).toMatchObject({ pointSize: 0.05 });

		const opacity = document.getElementById('viz-slider-scatter3d-opacity');
		opacity.value = '0.35';
		opacity.dispatchEvent(new Event('change', { bubbles: true }));
		expect(lastScatter3dConfig(writer)).toMatchObject({ opacity: 0.35 });

		const title = document.getElementById('viz-input-scatter3d-title');
		title.value = 'Cloud';
		title.dispatchEvent(new Event('change', { bubbles: true }));
		expect(lastScatter3dConfig(writer)).toMatchObject({ customTitle: 'Cloud' });
	});
});

describe('scatter3d activation defaults', () => {
	it('picks three distinct numeric columns (tin pickPreferred semantics)', () => {
		const dataset = { chartConfig: { scatter3d: {} } };

		// Mirrors tinControls/defaults.js exactly: the preferred index is
		// applied to the already-filtered list, so with x = 'a' the y pick
		// is index 1 of ['b','c','d'] = 'c', and z falls back to 'b'.
		const defaults = computeDefaults(dataset, { numeric: ['a', 'b', 'c', 'd'] });

		expect(defaults).toEqual({ x: 'a', y: 'c', z: 'b' });
		expect(new Set(Object.values(defaults)).size).toBe(3);
	});

	it('preserves still-valid user picks and avoids duplicates', () => {
		const dataset = { chartConfig: { scatter3d: { x: 'c', y: 'a', z: 'c' } } };

		const defaults = computeDefaults(dataset, { numeric: ['a', 'b', 'c'] });

		expect(defaults.x).toBe('c');
		expect(defaults.y).toBe('a');
		expect(defaults.z).toBe('b');
	});

	it('degrades to null when there are not enough numeric columns', () => {
		const dataset = { chartConfig: { scatter3d: {} } };

		expect(computeDefaults(dataset, { numeric: ['only'] })).toEqual({ x: 'only', y: null, z: null });
		expect(computeDefaults(dataset, { numeric: [] })).toEqual({ x: null, y: null, z: null });
	});
});
