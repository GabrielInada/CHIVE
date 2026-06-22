// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	t: vi.fn(key => key),
	updateActiveDatasetConfig: vi.fn(),
}));

vi.mock('../../../src/services/i18nService.js', () => ({
	t: mocks.t,
}));

vi.mock('../../../src/modules/state/appState.js', async (importOriginal) => ({
	...(await importOriginal()),
	updateActiveDatasetConfig: mocks.updateActiveDatasetConfig,
}));

import {
	computeDefaults,
	createBubbleChartControls,
	setupBubbleChartControlListeners,
} from '../../../src/modules/chartControls/bubbleControls.js';

function createDataset(measureMode = 'count', valueColumn = null, nestingMode = 'flat', nestingColumns = []) {
	return {
		rows: [
			{ categoria: 'A', valor: 10, grupo: 'X', regiao: 'Norte' },
			{ categoria: 'B', valor: 20, grupo: 'Y', regiao: 'Sul' },
		],
		chartConfig: {
			bubble: {
				enabled: true,
				expanded: true,
				category: 'categoria',
				groupColumn: nestingColumns.length > 0 ? nestingColumns[0] : 'grupo',
				nestingColumns,
				customTitle: '',
				chartHeight: 700,
				topN: 10,
				measureMode,
				valueColumn,
				padding: 3,
				labelMode: 'auto',
				nestingMode,
				colorScheme: 'Tableau10',
				filter: {
					column: null,
					mode: 'categorical',
					include: [],
					operator: 'between',
				},
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
	return mocks.updateActiveDatasetConfig.mock.calls.at(-1)[0].bubble;
}

describe('bubbleControls public surface', () => {
	it('exposes exactly the three documented bubble-control exports (no internal leaks)', async () => {
		const mod = await import('../../../src/modules/chartControls/bubbleControls.js');
		expect(Object.keys(mod).sort()).toEqual([
			'computeDefaults',
			'createBubbleChartControls',
			'setupBubbleChartControlListeners',
		]);
	});
});

describe('bubbleControls section structure', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		document.body.innerHTML = '';
	});

	const allColumns = ['categoria', 'grupo', 'regiao', 'estado'];

	// Records each nesting select as { id, value, disabled } (keeping the resolved
	// <select> element separate from its string key) so the snapshot pins the
	// progressive reveal, the flat-mode disabling, and the legacy-groupColumn
	// migration, not just the control ids. Every other control records its id
	// string; the id-less color-preset wrapper records its data attribute (a
	// string with no backing id element, which is why el and key are kept apart).
	function extractStructure(controls) {
		return controls.map(section => {
			const content = section.querySelector('.chart-section-content');
			const controlKeys = Array.from(content.children).map(control => {
				const el = control.matches('[id]') ? control : control.querySelector('[id]');
				if (el && el.id.startsWith('viz-select-bubble-nesting-level-')) {
					return { id: el.id, value: el.value, disabled: el.disabled };
				}
				return el?.id ?? control.querySelector('[data-color-preset-control]')?.dataset.colorPresetControl;
			});
			expect(controlKeys).not.toContain(undefined);

			return {
				section: section.dataset.section,
				expanded: section.querySelector('.chart-section-header').getAttribute('aria-expanded'),
				controlKeys,
			};
		});
	}

	function structureFor(nestingMode, nestingColumns, groupColumn) {
		// createDataset forces groupColumn from nestingColumns, so override it
		// explicitly to separate the genuinely-empty cases from the legacy fallback.
		const dataset = createDataset('count', null, nestingMode, nestingColumns);
		dataset.chartConfig.bubble.groupColumn = groupColumn;
		return extractStructure(createBubbleChartControls(dataset, ['categoria'], ['valor'], allColumns));
	}

	it('matches the section and control-order structure snapshot across nesting states', () => {
		// flat mode always renders exactly one level (maxInitialNestingControlsVisible
		// is 1), so flat-empty vs flat-retained differ only by the level-0 select's
		// value/disabled. grouped-one carries a stale groupColumn ('estado') to prove
		// the canonical nestingColumns wins over the legacy fallback.
		const byState = {
			'flat-empty': structureFor('flat', [], null),
			'flat-retained': structureFor('flat', ['grupo'], null),
			'grouped-empty': structureFor('grouped', [], null),
			'grouped-legacy': structureFor('grouped', [], 'grupo'),
			'grouped-one': structureFor('grouped', ['grupo'], 'estado'),
			'grouped-two': structureFor('grouped', ['grupo', 'regiao'], null),
		};

		expect(byState).toMatchSnapshot();
	});
});

describe('bubbleControls measure mode', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		document.body.innerHTML = '';
	});

	it('disables value-column selector in count mode and enables it for sum/mean', () => {
		const controls = createBubbleChartControls(createDataset('count', null), ['categoria'], ['valor'], ['categoria', 'grupo']);
		controls.forEach(control => document.body.appendChild(control));
		const valueSelect = document.getElementById('viz-select-bubble-value-column');
		expect(valueSelect.disabled).toBe(true);

		document.body.innerHTML = '';
		const sumControls = createBubbleChartControls(createDataset('sum', 'valor'), ['categoria'], ['valor'], ['categoria', 'grupo']);
		sumControls.forEach(control => document.body.appendChild(control));
		expect(document.getElementById('viz-select-bubble-value-column').disabled).toBe(false);
	});

	it('renders disabled controls and falls back invalid modes/options', () => {
		const dataset = createDataset('bad', 'old', 'bad', []);
		dataset.chartConfig.bubble.enabled = false;
		dataset.chartConfig.bubble.padding = null;
		dataset.chartConfig.bubble.colorScheme = '';
		appendControls(createBubbleChartControls(dataset, ['categoria'], ['valor'], ['categoria', 'grupo']));

		expect(document.getElementById('viz-select-bubble-measure').value).toBe('count');
		expect(document.getElementById('viz-select-bubble-nesting-mode').value).toBe('flat');
		expect(document.getElementById('viz-slider-bubble-padding').value).toBe('3');
		expect(document.getElementById('viz-select-bubble-category').disabled).toBe(true);
		expect(document.querySelector('button[data-color-preset-control="viz-bubble-color-preset"][data-preset-name="Tableau10"]').disabled).toBe(true);
	});

	it('emits measure/value updates and clears value column when switching back to count', () => {
		const dataset = createDataset('count', null);
		const controls = createBubbleChartControls(dataset, ['categoria'], ['valor'], ['categoria', 'grupo']);
		controls.forEach(control => document.body.appendChild(control));

		const onConfigChanged = vi.fn();
		setupBubbleChartControlListeners(dataset, ['categoria'], ['valor'], ['categoria', 'grupo'], onConfigChanged);

		const measureSelect = document.getElementById('viz-select-bubble-measure');
		const valueSelect = document.getElementById('viz-select-bubble-value-column');

		measureSelect.value = 'sum';
		measureSelect.dispatchEvent(new Event('change', { bubbles: true }));
		expect(mocks.updateActiveDatasetConfig).toHaveBeenCalledWith({
			bubble: expect.objectContaining({
				measureMode: 'sum',
				valueColumn: 'valor',
			}),
		});

		dataset.chartConfig.bubble.measureMode = 'sum';
		dataset.chartConfig.bubble.valueColumn = 'valor';
		valueSelect.value = 'valor';
		valueSelect.dispatchEvent(new Event('change', { bubbles: true }));
		expect(mocks.updateActiveDatasetConfig).toHaveBeenCalledWith({
			bubble: expect.objectContaining({
				valueColumn: 'valor',
			}),
		});

		dataset.chartConfig.bubble.valueColumn = 'valor';
		measureSelect.value = 'count';
		measureSelect.dispatchEvent(new Event('change', { bubbles: true }));
		expect(mocks.updateActiveDatasetConfig).toHaveBeenCalledWith({
			bubble: expect.objectContaining({
				measureMode: 'count',
				valueColumn: null,
			}),
		});

		expect(onConfigChanged).toHaveBeenCalledTimes(3);
	});

	it('coerces invalid measure and value-column selections', () => {
		const dataset = createDataset('sum', 'old');
		appendControls(createBubbleChartControls(dataset, ['categoria'], ['valor'], ['categoria', 'grupo']));

		setupBubbleChartControlListeners(dataset, ['categoria'], ['valor'], ['categoria', 'grupo'], vi.fn());

		selectValue('viz-select-bubble-measure', 'bogus');
		expect(lastConfig()).toEqual(expect.objectContaining({ measureMode: 'count', valueColumn: null }));

		dataset.chartConfig.bubble.valueColumn = 'old';
		selectValue('viz-select-bubble-measure', 'mean');
		expect(lastConfig()).toEqual(expect.objectContaining({ measureMode: 'mean', valueColumn: 'valor' }));

		selectValue('viz-select-bubble-value-column', 'missing');
		expect(lastConfig().valueColumn).toBeNull();
	});
});

describe('bubbleControls nesting mode', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		document.body.innerHTML = '';
	});

	it('nesting mode control exists and defaults to flat', () => {
		const controls = createBubbleChartControls(createDataset('count', null, 'flat'), ['categoria'], ['valor'], ['categoria', 'grupo']);
		controls.forEach(control => document.body.appendChild(control));

		const nestingSelect = document.getElementById('viz-select-bubble-nesting-mode');
		expect(nestingSelect).not.toBeNull();
		expect(nestingSelect.value).toBe('flat');
	});

	it('nesting mode control updates config when changed', () => {
		const dataset = createDataset('count', null, 'flat');
		const controls = createBubbleChartControls(dataset, ['categoria'], ['valor'], ['categoria', 'grupo']);
		controls.forEach(control => document.body.appendChild(control));

		const onConfigChanged = vi.fn();
		setupBubbleChartControlListeners(dataset, ['categoria'], ['valor'], ['categoria', 'grupo'], onConfigChanged);

		const nestingSelect = document.getElementById('viz-select-bubble-nesting-mode');
		nestingSelect.value = 'grouped';
		nestingSelect.dispatchEvent(new Event('change', { bubbles: true }));

		expect(mocks.updateActiveDatasetConfig).toHaveBeenCalledWith({
			bubble: expect.objectContaining({
				nestingMode: 'grouped',
			}),
		});
		expect(onConfigChanged).toHaveBeenCalledTimes(1);
	});

	it('coerces generic select, title, slider, and palette listeners', () => {
		const dataset = createDataset('count', null, 'flat');
		appendControls(createBubbleChartControls(dataset, ['categoria'], ['valor'], ['categoria', 'grupo']));

		setupBubbleChartControlListeners(dataset, ['categoria'], ['valor'], ['categoria', 'grupo'], vi.fn());

		selectValue('viz-select-bubble-category', 'grupo');
		expect(lastConfig().category).toBe('grupo');

		selectValue('viz-select-bubble-nesting-mode', 'unknown');
		expect(lastConfig().nestingMode).toBe('flat');

		selectValue('viz-select-bubble-topn', '20');
		expect(lastConfig().topN).toBe(20);

		selectValue('viz-select-bubble-label-mode', 'bad');
		expect(lastConfig().labelMode).toBe('auto');

		const title = document.getElementById('viz-input-bubble-title');
		title.value = '  Bubble panel  ';
		title.dispatchEvent(new Event('change', { bubbles: true }));
		expect(lastConfig().customTitle).toBe('Bubble panel');

		const padding = document.getElementById('viz-slider-bubble-padding');
		padding.value = '6';
		padding.dispatchEvent(new Event('input', { bubbles: true }));
		expect(padding.parentElement.querySelector('output').textContent).toBe('6');
		padding.dispatchEvent(new Event('change', { bubbles: true }));
		expect(lastConfig().padding).toBe(6);

		document.querySelector('button[data-color-preset-control="viz-bubble-color-preset"][data-preset-name="Bold"]').click();
		expect(lastConfig().colorScheme).toBe('Bold');
	});

	it('safely skips listener setup when controls are absent', () => {
		const dataset = createDataset();

		expect(() => setupBubbleChartControlListeners(dataset, ['categoria'], ['valor'], vi.fn())).not.toThrow();
		expect(mocks.updateActiveDatasetConfig).not.toHaveBeenCalled();
	});
});

describe('bubbleControls progressive nesting selectors', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		document.body.innerHTML = '';
	});

	it('grouped mode shows level 1 selector', () => {
		const dataset = createDataset('count', null, 'grouped', []);
		const controls = createBubbleChartControls(dataset, ['categoria'], ['valor'], ['categoria', 'grupo', 'regiao']);
		controls.forEach(control => document.body.appendChild(control));

		const level0 = document.getElementById('viz-select-bubble-nesting-level-0');
		expect(level0).not.toBeNull();
		expect(level0.disabled).toBe(false);
	});

	it('selecting level 1 reveals level 2', () => {
		const dataset = createDataset('count', null, 'grouped', ['grupo']);
		const controls = createBubbleChartControls(dataset, ['categoria'], ['valor'], ['categoria', 'grupo', 'regiao']);
		controls.forEach(control => document.body.appendChild(control));

		const level0 = document.getElementById('viz-select-bubble-nesting-level-0');
		const level1 = document.getElementById('viz-select-bubble-nesting-level-1');

		expect(level0).not.toBeNull();
		expect(level0.value).toBe('grupo');
		expect(level1).not.toBeNull();
	});

	it('selecting level 2 reveals level 3', () => {
		const dataset = createDataset('count', null, 'grouped', ['grupo', 'regiao']);
		const controls = createBubbleChartControls(dataset, ['categoria'], ['valor'], ['categoria', 'grupo', 'regiao', 'estado']);
		controls.forEach(control => document.body.appendChild(control));

		const level0 = document.getElementById('viz-select-bubble-nesting-level-0');
		const level1 = document.getElementById('viz-select-bubble-nesting-level-1');
		const level2 = document.getElementById('viz-select-bubble-nesting-level-2');

		expect(level0.value).toBe('grupo');
		expect(level1.value).toBe('regiao');
		expect(level2).not.toBeNull();
	});

	it('options exclude already selected columns and current category column', () => {
		const dataset = createDataset('count', null, 'grouped', ['grupo']);
		const controls = createBubbleChartControls(dataset, ['categoria'], ['valor'], ['categoria', 'grupo', 'regiao']);
		controls.forEach(control => document.body.appendChild(control));

		const level1 = document.getElementById('viz-select-bubble-nesting-level-1');
		const optionValues = Array.from(level1.options).map(o => o.value);

		// Should NOT include 'grupo' (already selected at level 0) or 'categoria' (is category column)
		expect(optionValues).not.toContain('grupo');
		expect(optionValues).not.toContain('categoria');
		// Should include 'regiao'
		expect(optionValues).toContain('regiao');
	});

	it('clearing level K truncates deeper levels in config updates', () => {
		const dataset = createDataset('count', null, 'grouped', ['grupo', 'regiao']);
		const controls = createBubbleChartControls(dataset, ['categoria'], ['valor'], ['categoria', 'grupo', 'regiao', 'estado']);
		controls.forEach(control => document.body.appendChild(control));

		const onConfigChanged = vi.fn();
		setupBubbleChartControlListeners(dataset, ['categoria'], ['valor'], ['categoria', 'grupo', 'regiao', 'estado'], onConfigChanged);

		// Clear level 0 → should truncate all
		const level0 = document.getElementById('viz-select-bubble-nesting-level-0');
		level0.value = '';
		level0.dispatchEvent(new Event('change', { bubbles: true }));

		expect(mocks.updateActiveDatasetConfig).toHaveBeenCalledWith({
			bubble: expect.objectContaining({
				nestingColumns: [],
				groupColumn: null,
			}),
		});
		expect(onConfigChanged).toHaveBeenCalledTimes(1);
	});

	it('sets a nesting level and truncates deeper levels from that point', () => {
		const dataset = createDataset('count', null, 'grouped', ['grupo', 'regiao']);
		appendControls(createBubbleChartControls(dataset, ['categoria'], ['valor'], ['categoria', 'grupo', 'regiao', 'estado']));

		setupBubbleChartControlListeners(dataset, ['categoria'], ['valor'], ['categoria', 'grupo', 'regiao', 'estado'], vi.fn());

		selectValue('viz-select-bubble-nesting-level-1', 'estado');
		expect(lastConfig()).toEqual(expect.objectContaining({
			nestingColumns: ['grupo', 'estado'],
			groupColumn: 'grupo',
		}));

		selectValue('viz-select-bubble-nesting-level-1', '');
		expect(lastConfig()).toEqual(expect.objectContaining({
			nestingColumns: ['grupo'],
			groupColumn: 'grupo',
		}));
	});

	it('flat mode nesting selectors are disabled', () => {
		const dataset = createDataset('count', null, 'flat', []);
		const controls = createBubbleChartControls(dataset, ['categoria'], ['valor'], ['categoria', 'grupo', 'regiao']);
		controls.forEach(control => document.body.appendChild(control));

		const level0 = document.getElementById('viz-select-bubble-nesting-level-0');
		expect(level0).not.toBeNull();
		expect(level0.disabled).toBe(true);
	});

	it('initial config with groupColumn hydrates first nesting level selector correctly', () => {
		// Simulate old config with only groupColumn, no nestingColumns
		const dataset = createDataset('count', null, 'grouped', []);
		dataset.chartConfig.bubble.groupColumn = 'grupo';
		dataset.chartConfig.bubble.nestingColumns = [];

		const controls = createBubbleChartControls(dataset, ['categoria'], ['valor'], ['categoria', 'grupo', 'regiao']);
		controls.forEach(control => document.body.appendChild(control));

		// The migration in createNestingControls should pick up groupColumn
		const level0 = document.getElementById('viz-select-bubble-nesting-level-0');
		expect(level0).not.toBeNull();
		expect(level0.value).toBe('grupo');
	});
});

describe('bubbleControls computeDefaults', () => {
	it('preserves valid category and sum/mean value columns', () => {
		const dataset = createDataset('sum', 'valor');
		expect(computeDefaults(dataset, {
			baseCategoricalOrAll: ['categoria', 'grupo'],
			numeric: ['valor'],
		})).toEqual({ category: 'categoria', valueColumn: 'valor' });
	});

	it('falls back category and value columns while preserving count-mode value', () => {
		expect(computeDefaults(createDataset('mean', 'old'), {
			baseCategoricalOrAll: ['grupo'],
			numeric: ['valor'],
		})).toEqual({ category: 'grupo', valueColumn: 'valor' });

		expect(computeDefaults(createDataset('count', 'old'), {
			baseCategoricalOrAll: [],
			numeric: [],
		})).toEqual({ category: null, valueColumn: 'old' });
	});
});
