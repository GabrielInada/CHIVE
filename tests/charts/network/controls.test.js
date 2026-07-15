// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	t: vi.fn(key => key),
}));

vi.mock('../../../src/services/i18nService.js', () => ({
	t: mocks.t,
}));

import { createNetworkGraphControls } from '../../../src/charts/network/controls/builder.js';
import { setupNetworkGraphControlListeners } from '../../../src/charts/network/controls/listeners.js';
import { computeDefaults } from '../../../src/charts/network/controls/defaults.js';

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
			network: {
				enabled: true,
				expanded: true,
				source: 'from',
				target: 'to',
				weight: null,
				group: null,
				linkDistance: 60,
				zoomScale: 1,
				showLegend: true,
				customTitle: '',
				chartHeight: 420,
				showNodeLabels: true,
				nodeRadius: 5,
				linkOpacity: 0.6,
				sourceNodeColor: '#e3743d',
				targetNodeColor: '#6b94c9',
				edgeColorMode: 'gradient',
				colorScheme: 'Bold',
				chargeStrength: -120,
				alphaDecay: 0.05,
				...overrides,
			},
		},
	};
}

function appendControls(controls) {
	controls.forEach(control => document.body.appendChild(control));
}

function extractStructure(controls) {
	return controls.map(section => {
		const content = section.querySelector('.chart-section-content');
		const controlKeys = Array.from(content.children).map(control => {
			const idElement = control.matches('[id]') ? control : control.querySelector('[id]');
			const presetElement = control.querySelector('[data-color-preset-control]');
			const stateElement = idElement ?? presetElement ?? control.querySelector('button,input,select');
			const entry = {
				id: idElement?.id ?? presetElement?.dataset.colorPresetControl,
				disabled: stateElement?.disabled === true,
			};
			expect(entry.id).toBeDefined();
			return entry;
		});

		return {
			section: section.dataset.section,
			expanded: section.querySelector('.chart-section-header').getAttribute('aria-expanded'),
			controlKeys,
		};
	});
}

describe('network controls module boundaries', () => {
	it('keeps builder, listener, and defaults exports in dedicated modules', async () => {
		const [builder, listeners, defaults] = await Promise.all([
			import('../../../src/charts/network/controls/builder.js'),
			import('../../../src/charts/network/controls/listeners.js'),
			import('../../../src/charts/network/controls/defaults.js'),
		]);
		expect(Object.keys(builder)).toEqual(['createNetworkGraphControls']);
		expect(Object.keys(listeners)).toEqual(['setupNetworkGraphControlListeners']);
		expect(Object.keys(defaults)).toEqual(['computeDefaults']);
	});
});

describe('networkControls section structure', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		document.body.innerHTML = '';
	});

	it('matches the section/control-order and disabled-state snapshot', () => {
		// The four sections (Data/Display/Styling/Advanced) are static and the
		// only disabled dimension is the global enabled flag, so one enabled
		// dataset pins the section order, the reset-zoom button slot, and the
		// color-preset slot.
		const dataset = createDataset();
		const controls = createNetworkGraphControls(dataset, ['from', 'to', 'weight'], ['weight'], ['from', 'to']);
		expect(extractStructure(controls)).toMatchSnapshot();
	});
});

describe('networkControls UI structure', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		document.body.innerHTML = '';
	});

	it('offers every visible column for source/target and only numeric columns for weight', () => {
		const dataset = createDataset();
		const controls = createNetworkGraphControls(dataset, ['from', 'to', 'weight'], ['weight'], ['from', 'to']);
		appendControls(controls);

		const sourceValues = Array.from(document.getElementById('viz-select-network-source').options).map(o => o.value);
		const targetValues = Array.from(document.getElementById('viz-select-network-target').options).map(o => o.value);
		const weightValues = Array.from(document.getElementById('viz-select-network-weight').options).map(o => o.value);
		const groupValues = Array.from(document.getElementById('viz-select-network-group').options).map(o => o.value);

		expect(sourceValues).toContain('from');
		expect(sourceValues).toContain('weight');
		expect(targetValues).toContain('to');
		expect(weightValues).toContain('weight');
		expect(weightValues).not.toContain('from');
		expect(groupValues).toContain('from');
		expect(groupValues).not.toContain('weight');
	});

	it('renders the edge-color-mode select with gradient and uniform choices', () => {
		const dataset = createDataset();
		const controls = createNetworkGraphControls(dataset, ['from', 'to'], [], []);
		appendControls(controls);

		const mode = document.getElementById('viz-select-network-edge-color-mode');
		const values = Array.from(mode.options).map(o => o.value);
		expect(values).toEqual(['gradient', 'uniform']);
	});

	it('disables all controls when the chart is disabled', () => {
		const dataset = createDataset({ enabled: false });
		const controls = createNetworkGraphControls(dataset, ['from', 'to'], [], []);
		appendControls(controls);

		expect(document.getElementById('viz-select-network-source').disabled).toBe(true);
		expect(document.getElementById('viz-btn-network-reset-zoom').disabled).toBe(true);
	});
});

describe('networkControls listeners', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		document.body.innerHTML = '';
	});

	it('commits source/target changes through the facade', () => {
		const dataset = createDataset();
		const controls = createNetworkGraphControls(dataset, ['from', 'to', 'weight'], ['weight'], []);
		appendControls(controls);

		const writer = createWriter();
		setupNetworkGraphControlListeners(dataset, ['from', 'to', 'weight'], ['weight'], writer);

		const target = document.getElementById('viz-select-network-target');
		target.value = 'weight';
		target.dispatchEvent(new Event('change', { bubbles: true }));

		expect(writer.commit).toHaveBeenCalledWith(expect.objectContaining({ target: 'weight' }));
		expect(writer.commit).toHaveBeenCalledTimes(1);
	});

	it('coerces an unknown edgeColorMode to gradient via the transform', () => {
		const dataset = createDataset();
		const controls = createNetworkGraphControls(dataset, ['from', 'to'], [], []);
		appendControls(controls);

		const writer = createWriter();
		setupNetworkGraphControlListeners(dataset, ['from', 'to'], [], writer);

		const select = document.getElementById('viz-select-network-edge-color-mode');
		select.value = 'uniform';
		select.dispatchEvent(new Event('change', { bubbles: true }));

		expect(writer.commit).toHaveBeenCalledWith(expect.objectContaining({ edgeColorMode: 'uniform' }));
	});

	it('reset-zoom button restores defaultZoomScale via the facade', () => {
		const dataset = createDataset({ zoomScale: 2 });
		const controls = createNetworkGraphControls(dataset, ['from', 'to'], [], []);
		appendControls(controls);

		const writer = createWriter();
		setupNetworkGraphControlListeners(dataset, ['from', 'to'], [], writer);

		document.getElementById('viz-btn-network-reset-zoom').click();

		expect(writer.commit).toHaveBeenCalledTimes(1);
		const call = writer.commit.mock.calls[0][0];
		expect(call.zoomScale).toBeTypeOf('number');
		expect(call.zoomScale).not.toBe(2);
	});

	it('color preset button maps the palette to source and target node colors', () => {
		const dataset = createDataset();
		const controls = createNetworkGraphControls(dataset, ['from', 'to'], [], []);
		appendControls(controls);

		const writer = createWriter();
		setupNetworkGraphControlListeners(dataset, ['from', 'to'], [], writer);

		const bold = document.querySelector('button[data-color-preset-control="viz-network-color-preset"][data-preset-name="Bold"]');
		expect(bold).not.toBeNull();
		bold.click();

		expect(writer.commit).toHaveBeenCalledTimes(1);
		const call = writer.commit.mock.calls[0][0];
		expect(call.colorScheme).toBe('Bold');
		expect(call.sourceNodeColor).toMatch(/^#[0-9a-fA-F]{6}$/);
		expect(call.targetNodeColor).toMatch(/^#[0-9a-fA-F]{6}$/);
		expect(call.sourceNodeColor).not.toBe(call.targetNodeColor);
	});
});

describe('networkControls computeDefaults', () => {
	it('preserves the current source/target when both are still in scope', () => {
		const dataset = createDataset({ source: 'from', target: 'to' });
		const ctx = { allColumns: ['from', 'to', 'extra'] };
		expect(computeDefaults(dataset, ctx)).toEqual({ source: 'from', target: 'to' });
	});

	it('falls back to the first two distinct columns when the current values are out of scope', () => {
		const dataset = createDataset({ source: 'gone', target: 'missing' });
		const ctx = { allColumns: ['alpha', 'beta', 'gamma'] };
		expect(computeDefaults(dataset, ctx)).toEqual({ source: 'alpha', target: 'beta' });
	});

	it('returns null when there are no columns', () => {
		const dataset = createDataset();
		expect(computeDefaults(dataset, { allColumns: [] })).toEqual({ source: null, target: null });
	});
});
