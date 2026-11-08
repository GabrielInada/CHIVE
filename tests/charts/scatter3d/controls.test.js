// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SCATTER3D_CONTROLS } from '../../../src/charts/scatter3d/controls/descriptions.js';
import { computeDefaults } from '../../../src/charts/scatter3d/controls/activationDefaults.js';
import { buildDescribedControls } from '../../../src/charts/shared/controls/describedControls.js';
import { CHART_COLORS } from '../../../src/config/charts/definitions.js';
import { SCATTER3D_CHART, SCATTER3D_DEFINITION } from '../../../src/config/charts/definitions/scatter3d.js';

/**
 * Writer test double. The controls' contract is that they hand the right
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

function createContext({ numeric = ['width', 'height', 'depth'], categorical = ['name'] } = {}) {
	const allColumns = [...categorical, ...numeric];
	return {
		allColumns,
		numeric,
		categorical,
		baseCategoricalOrAll: categorical.length > 0 ? categorical : allColumns,
		dates: [],
		rows: [],
	};
}

function buildControls(dataset, writer = createWriter(), context = createContext()) {
	return buildDescribedControls(SCATTER3D_CONTROLS, { dataset, context, writer, translate: key => key });
}

/** Build the controls into the document, as the sidebar does after each commit. */
function mountControls(dataset, writer = createWriter(), context = createContext()) {
	document.body.replaceChildren(...buildControls(dataset, writer, context));
	return writer;
}

function changeSelect(id, value) {
	const select = document.getElementById(id);
	if (!Array.from(select.options).some(option => option.value === value)) {
		select.appendChild(new Option(value, value));
	}
	select.value = value;
	select.dispatchEvent(new Event('change', { bubbles: true }));
}

function lastConfig(writer) {
	return writer.commit.mock.calls.at(-1)[0];
}

describe('scatter3d controls module boundaries', () => {
	it('declares its controls as descriptions, with no builder or listener module', async () => {
		const [descriptions, defaults] = await Promise.all([
			import('../../../src/charts/scatter3d/controls/descriptions.js'),
			import('../../../src/charts/scatter3d/controls/activationDefaults.js'),
		]);
		expect(Object.keys(descriptions)).toEqual(['SCATTER3D_CONTROLS']);
		expect(Object.keys(defaults)).toEqual(['computeDefaults']);
		expect(SCATTER3D_CONTROLS.definition).toBe(SCATTER3D_DEFINITION);
	});
});

describe('scatter3d controls', () => {
	beforeEach(() => {
		document.body.innerHTML = '';
	});

	it('builds the Data, Display, and Styling sections', () => {
		const controls = buildControls(createDataset());

		expect(controls.map(section => section.dataset.section)).toEqual(['data', 'display', 'styling']);
		expect(controls.map(section => section.querySelector('.chart-section-header').getAttribute('aria-expanded')))
			.toEqual(['true', 'true', 'false']);
	});

	it('offers only numeric columns plus the none option for x/y/z', () => {
		mountControls(createDataset());

		for (const axis of ['x', 'y', 'z']) {
			const values = Array.from(document.getElementById(`viz-select-scatter3d-${axis}`).options).map(o => o.value);
			expect(values).toEqual(['', 'width', 'height', 'depth']);
		}
	});

	it('shows "None" for any falsy axis, even beside columns named "0" and "false"', () => {
		mountControls(
			createDataset({ x: 0, y: false, z: 'depth' }),
			createWriter(),
			createContext({ numeric: ['0', 'false', 'depth'] }),
		);

		expect(document.getElementById('viz-select-scatter3d-x').selectedIndex).toBe(0);
		expect(document.getElementById('viz-select-scatter3d-y').selectedIndex).toBe(0);
		expect(document.getElementById('viz-select-scatter3d-z').value).toBe('depth');
	});

	it('reflects the config values and disables everything when the chart is off', () => {
		mountControls(createDataset({ enabled: false, pointSize: 0.08, opacity: 0.4, color: '#112233' }));

		const states = [...document.querySelectorAll('select, input')].map(element => element.disabled);
		expect(states).toHaveLength(7);
		expect(states.every(Boolean)).toBe(true);
		expect(document.getElementById('viz-slider-scatter3d-point-size').value).toBe('0.08');
		expect(document.getElementById('viz-slider-scatter3d-opacity').value).toBe('0.4');
		expect(document.getElementById('viz-input-scatter3d-color').value).toBe('#112233');
	});

	it('shows the default point size and opacity while they are unset, and a value of 0 as 0', () => {
		const output = id => document.getElementById(id).parentElement.querySelector('output').textContent;

		mountControls(createDataset({ pointSize: null, opacity: undefined }));
		expect(output('viz-slider-scatter3d-point-size')).toBe(String(SCATTER3D_CHART.defaultPointSize));
		expect(output('viz-slider-scatter3d-opacity')).toBe(String(SCATTER3D_CHART.defaultOpacity));

		mountControls(createDataset({ pointSize: 0, opacity: 0 }));
		expect(output('viz-slider-scatter3d-point-size')).toBe('0');
		expect(output('viz-slider-scatter3d-opacity')).toBe('0');
	});

	it('gives the point size and opacity sliders their ranges', () => {
		mountControls(createDataset());

		const range = id => ['min', 'max', 'step'].map(attribute => document.getElementById(id)[attribute]);
		expect(range('viz-slider-scatter3d-point-size'))
			.toEqual([String(SCATTER3D_CHART.minPointSize), String(SCATTER3D_CHART.maxPointSize), '0.005']);
		expect(range('viz-slider-scatter3d-opacity'))
			.toEqual([String(SCATTER3D_CHART.minOpacity), String(SCATTER3D_CHART.maxOpacity), '0.05']);
	});
});

describe('scatter3d control writes', () => {
	beforeEach(() => {
		document.body.innerHTML = '';
	});

	it('writes axis picks clamped to the numeric columns, null for none or a forged option', () => {
		const writer = mountControls(createDataset());

		changeSelect('viz-select-scatter3d-x', 'depth');
		expect(lastConfig(writer)).toEqual({ x: 'depth' });

		changeSelect('viz-select-scatter3d-y', 'not-a-column');
		expect(lastConfig(writer)).toEqual({ y: null });

		changeSelect('viz-select-scatter3d-z', '');
		expect(lastConfig(writer)).toEqual({ z: null });
	});

	it('writes point size, opacity, title, and color', () => {
		const writer = mountControls(createDataset());

		const size = document.getElementById('viz-slider-scatter3d-point-size');
		size.value = '0.05';
		size.dispatchEvent(new Event('change', { bubbles: true }));
		expect(lastConfig(writer)).toEqual({ pointSize: 0.05 });

		const opacity = document.getElementById('viz-slider-scatter3d-opacity');
		opacity.value = '0.35';
		opacity.dispatchEvent(new Event('change', { bubbles: true }));
		expect(lastConfig(writer)).toEqual({ opacity: 0.35 });

		const title = document.getElementById('viz-input-scatter3d-title');
		title.value = '  Cloud  ';
		title.dispatchEvent(new Event('change', { bubbles: true }));
		expect(lastConfig(writer)).toEqual({ customTitle: 'Cloud' });

		const color = document.getElementById('viz-input-scatter3d-color');
		color.value = '#abcdef';
		color.dispatchEvent(new Event('input', { bubbles: true }));
		expect(writer.preview).toHaveBeenCalledWith({ color: '#abcdef' });
		color.dispatchEvent(new Event('change', { bubbles: true }));
		expect(lastConfig(writer)).toEqual({ color: '#abcdef' });

		color.type = 'text';
		color.value = 'not-a-color';
		color.dispatchEvent(new Event('change', { bubbles: true }));
		expect(lastConfig(writer)).toEqual({ color: CHART_COLORS.scatter3d });
	});
});

describe('scatter3d activation defaults', () => {
	it('picks three distinct numeric columns (tin pickPreferred semantics)', () => {
		const dataset = { chartConfig: { scatter3d: {} } };

		// Mirrors tinControls/activationDefaults.js exactly: the preferred index is
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
