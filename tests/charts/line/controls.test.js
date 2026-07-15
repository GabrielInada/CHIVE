// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	t: vi.fn(key => key),
	updateActiveDatasetConfig: vi.fn(),
}));

vi.mock('../../../src/services/i18nService.js', () => ({
	t: mocks.t,
}));

vi.mock('../../../src/state/appState.js', async (importOriginal) => ({
	...(await importOriginal()),
	updateActiveDatasetConfig: mocks.updateActiveDatasetConfig,
}));

vi.mock('../../../src/modules/chartControls/livePreview.js', () => ({
	triggerLiveRender: vi.fn(),
}));

import { createLineChartControls } from '../../../src/charts/line/controls/builder.js';
import { setupLineChartControlListeners } from '../../../src/charts/line/controls/listeners.js';
import { computeDefaults } from '../../../src/charts/line/controls/defaults.js';

function createDataset(overrides = {}) {
	return {
		chartConfig: {
			line: {
				enabled: true,
				expanded: true,
				x: 'month',
				y: 'visits',
				customTitle: '',
				chartHeight: 320,
				curve: 'linear',
				missingMode: 'connect',
				strokeWidth: 1.5,
				color: '#4e79a7',
				ghostStrokeColor: '#cccccc',
				showPoints: false,
				sortX: true,
				aggregateMode: 'none',
				showXAxisLabel: true,
				showYAxisLabel: true,
				...overrides,
			},
		},
	};
}

function appendControls(controls) {
	controls.forEach(control => document.body.appendChild(control));
}

function selectValue(id, value) {
	const select = document.getElementById(id);
	if (![...select.options].some(option => option.value === value)) {
		const option = document.createElement('option');
		option.value = value;
		select.appendChild(option);
	}
	select.value = value;
	select.dispatchEvent(new Event('change', { bubbles: true }));
}

function lastConfig() {
	return mocks.updateActiveDatasetConfig.mock.calls.at(-1)[0].line;
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

describe('line controls module boundaries', () => {
	it('keeps builder, listener, and defaults exports in dedicated modules', async () => {
		const [builder, listeners, defaults] = await Promise.all([
			import('../../../src/charts/line/controls/builder.js'),
			import('../../../src/charts/line/controls/listeners.js'),
			import('../../../src/charts/line/controls/defaults.js'),
		]);
		expect(Object.keys(builder)).toEqual(['createLineChartControls']);
		expect(Object.keys(listeners)).toEqual(['setupLineChartControlListeners']);
		expect(Object.keys(defaults)).toEqual(['computeDefaults']);
	});
});

describe('lineControls section structure', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		document.body.innerHTML = '';
	});

	it('matches the section/control-order and disabled-state snapshot across missing modes', () => {
		// Drive the missingMode dimension: 'interpolate' enables the ghost-color
		// picker, every other mode disables it, so the snapshot pins that
		// conditional disabled slot (not just control presence/order).
		const byMode = {};
		for (const missingMode of ['interpolate', 'connect']) {
			const dataset = createDataset({ missingMode });
			const controls = createLineChartControls(
				dataset,
				['visits', 'signups'],
				['month'],
				['month', 'visits', 'signups'],
			);
			byMode[missingMode] = extractStructure(controls);
		}

		expect(byMode).toMatchSnapshot();
	});
});

describe('lineControls UI structure', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		document.body.innerHTML = '';
	});

	it('offers every visible column as X and only numeric columns as Y', () => {
		const dataset = createDataset();
		const controls = createLineChartControls(dataset, ['visits', 'signups'], ['month'], ['month', 'visits', 'signups']);
		appendControls(controls);

		const xValues = Array.from(document.getElementById('viz-select-line-x').options).map(o => o.value);
		const yValues = Array.from(document.getElementById('viz-select-line-y').options).map(o => o.value);

		expect(xValues).toContain('month');
		expect(xValues).toContain('visits');
		expect(yValues).toContain('visits');
		expect(yValues).not.toContain('month');
	});

	it('disables the ghost color picker when missing mode is not interpolate', () => {
		const connectDataset = createDataset({ missingMode: 'connect' });
		const connectControls = createLineChartControls(connectDataset, ['visits'], ['month'], ['month', 'visits']);
		appendControls(connectControls);
		expect(document.getElementById('viz-input-line-ghost-color').disabled).toBe(true);

		document.body.innerHTML = '';
		const interpDataset = createDataset({ missingMode: 'interpolate' });
		const interpControls = createLineChartControls(interpDataset, ['visits'], ['month'], ['month', 'visits']);
		appendControls(interpControls);
		expect(document.getElementById('viz-input-line-ghost-color').disabled).toBe(false);
	});

	it('renders disabled controls and default stroke width fallback', () => {
		const dataset = createDataset({ enabled: false, strokeWidth: 0, showPoints: true });
		const controls = createLineChartControls(dataset, ['visits'], ['month'], ['month', 'visits']);
		appendControls(controls);

		expect(document.getElementById('viz-select-line-x').disabled).toBe(true);
		expect(document.getElementById('viz-slider-line-stroke-width').value).toBe('1.5');
		expect(document.getElementById('viz-toggle-line-show-points').checked).toBe(true);
	});
});

describe('lineControls listeners', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		document.body.innerHTML = '';
	});

	it('updates curve when the user changes the curve select', () => {
		const dataset = createDataset();
		const controls = createLineChartControls(dataset, ['visits'], ['month'], ['month', 'visits']);
		appendControls(controls);

		const onConfigChanged = vi.fn();
		setupLineChartControlListeners(dataset, ['visits'], ['month'], ['month', 'visits'], onConfigChanged);

		const select = document.getElementById('viz-select-line-curve');
		select.value = 'monotone';
		select.dispatchEvent(new Event('change', { bubbles: true }));

		expect(mocks.updateActiveDatasetConfig).toHaveBeenCalledWith({
			line: expect.objectContaining({ curve: 'monotone' }),
		});
		expect(onConfigChanged).toHaveBeenCalledTimes(1);
	});

	it('coerces an unknown missingMode to the default value', () => {
		const dataset = createDataset();
		const controls = createLineChartControls(dataset, ['visits'], ['month'], ['month', 'visits']);
		appendControls(controls);

		setupLineChartControlListeners(dataset, ['visits'], ['month'], ['month', 'visits'], vi.fn());

		const select = document.getElementById('viz-select-line-missing');
		select.value = 'gap';
		select.dispatchEvent(new Event('change', { bubbles: true }));

		expect(mocks.updateActiveDatasetConfig).toHaveBeenCalledWith({
			line: expect.objectContaining({ missingMode: 'gap' }),
		});
	});

	it('rejects Y values that are not numeric columns', () => {
		const dataset = createDataset();
		const controls = createLineChartControls(dataset, ['visits'], ['month'], ['month', 'visits']);
		appendControls(controls);

		setupLineChartControlListeners(dataset, ['visits'], ['month'], ['month', 'visits'], vi.fn());

		const ySelect = document.getElementById('viz-select-line-y');
		ySelect.value = '';
		ySelect.dispatchEvent(new Event('change', { bubbles: true }));

		expect(mocks.updateActiveDatasetConfig).toHaveBeenCalledWith({
			line: expect.objectContaining({ y: null }),
		});
	});

	it('updates X/Y selections for valid values and coerces invalid X to null', () => {
		const dataset = createDataset();
		const controls = createLineChartControls(dataset, ['visits', 'signups'], ['month'], ['month', 'visits', 'signups']);
		appendControls(controls);

		const onConfigChanged = vi.fn();
		setupLineChartControlListeners(dataset, ['visits', 'signups'], ['month'], ['month', 'visits', 'signups'], onConfigChanged);

		selectValue('viz-select-line-x', 'signups');
		expect(lastConfig().x).toBe('signups');

		selectValue('viz-select-line-y', 'signups');
		expect(lastConfig().y).toBe('signups');

		selectValue('viz-select-line-x', 'missing');
		expect(lastConfig().x).toBeNull();
		expect(onConfigChanged).toHaveBeenCalledTimes(3);
	});

	it('coerces invalid curve, missing, and aggregate options to defaults', () => {
		const dataset = createDataset();
		const controls = createLineChartControls(dataset, ['visits'], ['month'], ['month', 'visits']);
		appendControls(controls);

		setupLineChartControlListeners(dataset, ['visits'], ['month'], ['month', 'visits'], vi.fn());

		selectValue('viz-select-line-curve', 'made-up');
		expect(lastConfig().curve).toBe('linear');

		selectValue('viz-select-line-missing', 'made-up');
		expect(lastConfig().missingMode).toBe('connect');

		selectValue('viz-select-line-aggregate', 'made-up');
		expect(lastConfig().aggregateMode).toBe('none');
	});

	it('skips listener setup when controls are absent', () => {
		const dataset = createDataset();

		expect(() => setupLineChartControlListeners(dataset, ['visits'], ['month'], ['month', 'visits'])).not.toThrow();
		expect(mocks.updateActiveDatasetConfig).not.toHaveBeenCalled();
	});

	it('toggles sortX through the checkbox', () => {
		const dataset = createDataset();
		const controls = createLineChartControls(dataset, ['visits'], ['month'], ['month', 'visits']);
		appendControls(controls);

		setupLineChartControlListeners(dataset, ['visits'], ['month'], ['month', 'visits'], vi.fn());

		const checkbox = document.getElementById('viz-toggle-line-sort-x');
		checkbox.checked = false;
		checkbox.dispatchEvent(new Event('change', { bubbles: true }));

		expect(mocks.updateActiveDatasetConfig).toHaveBeenCalledWith({
			line: expect.objectContaining({ sortX: false }),
		});
	});
});

describe('lineControls computeDefaults', () => {
	it('preserves visible current values when they remain valid', () => {
		const dataset = createDataset({ x: 'month', y: 'visits' });

		expect(computeDefaults(dataset, {
			allColumns: ['month', 'visits'],
			dates: ['month'],
			numeric: ['visits'],
		})).toEqual({ x: 'month', y: 'visits' });
	});

	it('falls back through date, numeric, all-column, and empty defaults', () => {
		expect(computeDefaults(createDataset({ x: 'old', y: 'oldY' }), {
			allColumns: ['month', 'visits', 'signups'],
			dates: ['month'],
			numeric: ['visits', 'signups'],
		})).toEqual({ x: 'month', y: 'visits' });

		expect(computeDefaults(createDataset({ x: 'old', y: 'visits' }), {
			allColumns: ['visits', 'signups'],
			dates: [],
			numeric: ['visits', 'signups'],
		})).toEqual({ x: 'visits', y: 'signups' });

		expect(computeDefaults({ chartConfig: {} }, {
			allColumns: ['category'],
			dates: [],
			numeric: [],
		})).toEqual({ x: 'category', y: null });

		expect(computeDefaults({ chartConfig: {} }, {
			allColumns: [],
			dates: [],
			numeric: [],
		})).toEqual({ x: null, y: null });
	});
});
