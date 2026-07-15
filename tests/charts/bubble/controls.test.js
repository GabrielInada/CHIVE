// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	t: vi.fn(key => key),
}));

vi.mock('../../../src/services/i18nService.js', () => ({
	t: mocks.t,
}));

import {
	createBubbleChartControls,
} from '../../../src/charts/bubble/controls/builder.js';
import { setupBubbleChartControlListeners } from '../../../src/charts/bubble/controls/listeners.js';
import { computeDefaults } from '../../../src/charts/bubble/controls/defaults.js';
import { BUBBLE_CHART } from '../../../src/config/charts.js';

/**
 * Writer test double. The listeners' contract is that they hand the right
 * patch to the writer; merging it into state, firing onConfigChanged, and
 * live-rendering are the adapter's contract and are covered by
 * tests/features/datasetWorkspace/chartControls/chartConfigAdapter.test.js.
 */
function createWriter() {
	return { commit: vi.fn(), preview: vi.fn() };
}

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

function lastConfig(writer) {
	return writer.commit.mock.calls.at(-1)[0];
}

describe('bubble controls module boundaries', () => {
	it('keeps builder, listener, defaults, and nesting exports in dedicated modules', async () => {
		const [builder, listeners, defaults, nesting] = await Promise.all([
			import('../../../src/charts/bubble/controls/builder.js'),
			import('../../../src/charts/bubble/controls/listeners.js'),
			import('../../../src/charts/bubble/controls/defaults.js'),
			import('../../../src/charts/bubble/controls/nestingColumns.js'),
		]);
		expect(Object.keys(builder)).toEqual(['createBubbleChartControls']);
		expect(Object.keys(listeners)).toEqual(['setupBubbleChartControlListeners']);
		expect(Object.keys(defaults)).toEqual(['computeDefaults']);
		expect(Object.keys(nesting).sort()).toEqual([
			'computeNestingControlCount',
			'resolveNestingColumnsFromConfig',
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

		const writer = createWriter();
		setupBubbleChartControlListeners(dataset, ['categoria'], ['valor'], ['categoria', 'grupo'], writer);

		const measureSelect = document.getElementById('viz-select-bubble-measure');
		const valueSelect = document.getElementById('viz-select-bubble-value-column');

		measureSelect.value = 'sum';
		measureSelect.dispatchEvent(new Event('change', { bubbles: true }));
		expect(writer.commit).toHaveBeenCalledWith(expect.objectContaining({
				measureMode: 'sum',
				valueColumn: 'valor',
			}));

		dataset.chartConfig.bubble.measureMode = 'sum';
		dataset.chartConfig.bubble.valueColumn = 'valor';
		valueSelect.value = 'valor';
		valueSelect.dispatchEvent(new Event('change', { bubbles: true }));
		expect(writer.commit).toHaveBeenCalledWith(expect.objectContaining({
				valueColumn: 'valor',
			}));

		dataset.chartConfig.bubble.valueColumn = 'valor';
		measureSelect.value = 'count';
		measureSelect.dispatchEvent(new Event('change', { bubbles: true }));
		expect(writer.commit).toHaveBeenCalledWith(expect.objectContaining({
				measureMode: 'count',
				valueColumn: null,
			}));

		expect(writer.commit).toHaveBeenCalledTimes(3);
	});

	it('coerces invalid measure and value-column selections', () => {
		const dataset = createDataset('sum', 'old');
		appendControls(createBubbleChartControls(dataset, ['categoria'], ['valor'], ['categoria', 'grupo']));

		const writer = createWriter();
		setupBubbleChartControlListeners(dataset, ['categoria'], ['valor'], ['categoria', 'grupo'], writer);

		selectValue('viz-select-bubble-measure', 'bogus');
		expect(lastConfig(writer)).toEqual(expect.objectContaining({ measureMode: 'count', valueColumn: null }));

		dataset.chartConfig.bubble.valueColumn = 'old';
		selectValue('viz-select-bubble-measure', 'mean');
		expect(lastConfig(writer)).toEqual(expect.objectContaining({ measureMode: 'mean', valueColumn: 'valor' }));

		selectValue('viz-select-bubble-value-column', 'missing');
		expect(lastConfig(writer).valueColumn).toBeNull();
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

		const writer = createWriter();
		setupBubbleChartControlListeners(dataset, ['categoria'], ['valor'], ['categoria', 'grupo'], writer);

		const nestingSelect = document.getElementById('viz-select-bubble-nesting-mode');
		nestingSelect.value = 'grouped';
		nestingSelect.dispatchEvent(new Event('change', { bubbles: true }));

		expect(writer.commit).toHaveBeenCalledWith(expect.objectContaining({
				nestingMode: 'grouped',
			}));
		expect(writer.commit).toHaveBeenCalledTimes(1);
	});

	it('coerces generic select, title, slider, and palette listeners', () => {
		const dataset = createDataset('count', null, 'flat');
		appendControls(createBubbleChartControls(dataset, ['categoria'], ['valor'], ['categoria', 'grupo']));

		const writer = createWriter();
		setupBubbleChartControlListeners(dataset, ['categoria'], ['valor'], ['categoria', 'grupo'], writer);

		selectValue('viz-select-bubble-category', 'grupo');
		expect(lastConfig(writer).category).toBe('grupo');

		selectValue('viz-select-bubble-nesting-mode', 'unknown');
		expect(lastConfig(writer).nestingMode).toBe('flat');

		selectValue('viz-select-bubble-topn', '20');
		expect(lastConfig(writer).topN).toBe(20);

		selectValue('viz-select-bubble-label-mode', 'bad');
		expect(lastConfig(writer).labelMode).toBe('auto');

		const title = document.getElementById('viz-input-bubble-title');
		title.value = '  Bubble panel  ';
		title.dispatchEvent(new Event('change', { bubbles: true }));
		expect(lastConfig(writer).customTitle).toBe('Bubble panel');

		const padding = document.getElementById('viz-slider-bubble-padding');
		padding.value = '6';
		padding.dispatchEvent(new Event('input', { bubbles: true }));
		expect(padding.parentElement.querySelector('output').textContent).toBe('6');
		padding.dispatchEvent(new Event('change', { bubbles: true }));
		expect(lastConfig(writer).padding).toBe(6);

		document.querySelector('button[data-color-preset-control="viz-bubble-color-preset"][data-preset-name="Bold"]').click();
		expect(lastConfig(writer).colorScheme).toBe('Bold');
	});

	it('safely skips listener setup when controls are absent', () => {
		const dataset = createDataset();

		const writer = createWriter();
		expect(() => setupBubbleChartControlListeners(dataset, ['categoria'], ['valor'], [], writer)).not.toThrow();
		expect(writer.commit).not.toHaveBeenCalled();
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

		const writer = createWriter();
		setupBubbleChartControlListeners(dataset, ['categoria'], ['valor'], ['categoria', 'grupo', 'regiao', 'estado'], writer);

		// Clear level 0 → should truncate all
		const level0 = document.getElementById('viz-select-bubble-nesting-level-0');
		level0.value = '';
		level0.dispatchEvent(new Event('change', { bubbles: true }));

		expect(writer.commit).toHaveBeenCalledWith(expect.objectContaining({
				nestingColumns: [],
				groupColumn: null,
			}));
		expect(writer.commit).toHaveBeenCalledTimes(1);
	});

	it('sets a nesting level and truncates deeper levels from that point', () => {
		const dataset = createDataset('count', null, 'grouped', ['grupo', 'regiao']);
		appendControls(createBubbleChartControls(dataset, ['categoria'], ['valor'], ['categoria', 'grupo', 'regiao', 'estado']));

		const writer = createWriter();
		setupBubbleChartControlListeners(dataset, ['categoria'], ['valor'], ['categoria', 'grupo', 'regiao', 'estado'], writer);

		selectValue('viz-select-bubble-nesting-level-1', 'estado');
		expect(lastConfig(writer)).toEqual(expect.objectContaining({
			nestingColumns: ['grupo', 'estado'],
			groupColumn: 'grupo',
		}));

		selectValue('viz-select-bubble-nesting-level-1', '');
		expect(lastConfig(writer)).toEqual(expect.objectContaining({
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

describe('bubbleControls nesting depth bound', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		document.body.innerHTML = '';
	});

	const cap = BUBBLE_CHART.maxNestingDepth;
	// More than `cap` eligible (non-category) columns, so the hard cap binds before
	// the column count in the boundary tests.
	const wideColumns = ['categoria', ...Array.from({ length: 10 }, (_, i) => `c${i}`)];

	function nestingSelectCount() {
		return document.querySelectorAll('[id^="viz-select-bubble-nesting-level-"]').length;
	}

	it('caps the rendered nesting-select count at the hard maximum', () => {
		const overDeep = Array.from({ length: cap + 4 }, (_, i) => `c${i}`);
		const dataset = createDataset('count', null, 'grouped', overDeep);
		appendControls(createBubbleChartControls(dataset, ['categoria'], ['valor'], wideColumns));

		const eligibleUniqueColumns = new Set(wideColumns.filter(name => name !== 'categoria')).size;
		const upperBound = Math.max(
			BUBBLE_CHART.maxInitialNestingControlsVisible,
			Math.min(cap, eligibleUniqueColumns),
		);
		expect(nestingSelectCount()).toBeLessThanOrEqual(upperBound);
		expect(nestingSelectCount()).toBe(cap);
	});

	it('shows one trailing empty selector at maxNestingDepth - 1 selected', () => {
		const selected = Array.from({ length: cap - 1 }, (_, i) => `c${i}`);
		const dataset = createDataset('count', null, 'grouped', selected);
		appendControls(createBubbleChartControls(dataset, ['categoria'], ['valor'], wideColumns));

		expect(nestingSelectCount()).toBe(cap); // (cap - 1) filled + 1 trailing empty
		expect(document.getElementById(`viz-select-bubble-nesting-level-${cap - 1}`).value).toBe('');
	});

	it('shows no dead extra selector at exactly maxNestingDepth selected', () => {
		const selected = Array.from({ length: cap }, (_, i) => `c${i}`);
		const dataset = createDataset('count', null, 'grouped', selected);
		appendControls(createBubbleChartControls(dataset, ['categoria'], ['valor'], wideColumns));

		expect(nestingSelectCount()).toBe(cap); // all filled, no dead 9th
		expect(document.getElementById(`viz-select-bubble-nesting-level-${cap - 1}`).value).toBe(`c${cap - 1}`);
		expect(document.getElementById(`viz-select-bubble-nesting-level-${cap}`)).toBeNull();
	});

	it('shows no trailing selector when all eligible columns below the cap are selected', () => {
		const allColumns = ['categoria', 'c0', 'c1', 'c2', 'c3'];
		const dataset = createDataset('count', null, 'grouped', ['c0', 'c1', 'c2', 'c3']);
		appendControls(createBubbleChartControls(dataset, ['categoria'], ['valor'], allColumns));

		expect(nestingSelectCount()).toBe(4); // 4 eligible filled, no useless trailing empty
	});

	it('does not let an empty-string column inflate the capacity', () => {
		const allColumns = ['categoria', 'c0', 'c1', 'c2', 'c3', ''];
		const dataset = createDataset('count', null, 'grouped', ['c0', 'c1', 'c2', 'c3']);
		appendControls(createBubbleChartControls(dataset, ['categoria'], ['valor'], allColumns));

		expect(nestingSelectCount()).toBe(4); // '' dropped from allowed → no extra trailing selector
	});

	it('falls back to a valid legacy groupColumn when the canonical list filters away', () => {
		const dataset = createDataset('count', null, 'grouped', ['nonexistent']);
		dataset.chartConfig.bubble.groupColumn = 'grupo';
		appendControls(createBubbleChartControls(dataset, ['categoria'], ['valor'], ['categoria', 'grupo', 'regiao']));

		expect(document.getElementById('viz-select-bubble-nesting-level-0').value).toBe('grupo');
	});

	it('does not wire a 9th nesting level beyond the cap', () => {
		const selected = Array.from({ length: cap }, (_, i) => `c${i}`);
		const dataset = createDataset('count', null, 'grouped', selected);
		appendControls(createBubbleChartControls(dataset, ['categoria'], ['valor'], wideColumns));

		// Forge a level-`cap` selector the builder never renders, BEFORE wiring, so the
		// test proves no listener attaches (not merely that the element is absent).
		const rogue = document.createElement('select');
		rogue.id = `viz-select-bubble-nesting-level-${cap}`;
		const option = document.createElement('option');
		option.value = 'c0';
		rogue.appendChild(option);
		rogue.value = 'c0';
		document.body.appendChild(rogue);

		const writer = createWriter();
		setupBubbleChartControlListeners(dataset, ['categoria'], ['valor'], wideColumns, writer);
		rogue.dispatchEvent(new Event('change', { bubbles: true }));

		expect(writer.commit).not.toHaveBeenCalled();
	});

	it('does not wire a second nesting level in flat mode', () => {
		const dataset = createDataset('count', null, 'flat', []);
		appendControls(createBubbleChartControls(dataset, ['categoria'], ['valor'], ['categoria', 'grupo', 'regiao']));

		const rogue = document.createElement('select');
		rogue.id = 'viz-select-bubble-nesting-level-1';
		const option = document.createElement('option');
		option.value = 'grupo';
		rogue.appendChild(option);
		rogue.value = 'grupo';
		document.body.appendChild(rogue);

		const writer = createWriter();
		setupBubbleChartControlListeners(dataset, ['categoria'], ['valor'], ['categoria', 'grupo', 'regiao'], writer);
		rogue.dispatchEvent(new Event('change', { bubbles: true }));

		expect(writer.commit).not.toHaveBeenCalled();
	});

	it('does not resurrect a hidden out-of-allowlist entry on a level change', () => {
		const allColumns = ['categoria', 'grupo', 'regiao'];
		const dataset = createDataset('count', null, 'grouped', ['invalid', 'grupo']);
		dataset.chartConfig.bubble.groupColumn = 'invalid';
		appendControls(createBubbleChartControls(dataset, ['categoria'], ['valor'], allColumns));
		const writer = createWriter();
		setupBubbleChartControlListeners(dataset, ['categoria'], ['valor'], allColumns, writer);

		selectValue('viz-select-bubble-nesting-level-1', 'regiao');
		expect(lastConfig(writer).nestingColumns).toEqual(['grupo', 'regiao']); // 'invalid' never resurfaces
	});

	it('does not resurrect a hidden category entry on a level change', () => {
		const allColumns = ['categoria', 'grupo', 'regiao'];
		const dataset = createDataset('count', null, 'grouped', ['categoria', 'grupo']);
		dataset.chartConfig.bubble.groupColumn = 'categoria';
		appendControls(createBubbleChartControls(dataset, ['categoria'], ['valor'], allColumns));
		const writer = createWriter();
		setupBubbleChartControlListeners(dataset, ['categoria'], ['valor'], allColumns, writer);

		selectValue('viz-select-bubble-nesting-level-1', 'regiao');
		expect(lastConfig(writer).nestingColumns).toEqual(['grupo', 'regiao']); // 'categoria' never resurfaces
	});

	it('rejects a forged out-of-allowlist option at the write sink', () => {
		const allColumns = ['categoria', 'grupo', 'regiao'];
		const dataset = createDataset('count', null, 'grouped', ['grupo']);
		appendControls(createBubbleChartControls(dataset, ['categoria'], ['valor'], allColumns));
		const writer = createWriter();
		setupBubbleChartControlListeners(dataset, ['categoria'], ['valor'], allColumns, writer);

		const level0 = document.getElementById('viz-select-bubble-nesting-level-0');
		const forged = document.createElement('option');
		forged.value = 'forged_xyz';
		level0.appendChild(forged);
		level0.value = 'forged_xyz';
		level0.dispatchEvent(new Event('change', { bubbles: true }));

		expect(lastConfig(writer).nestingColumns).not.toContain('forged_xyz');
		expect(lastConfig(writer).nestingColumns).toEqual([]);
	});

	it('allowlist-filters on the explicit empty-array (allow-nothing) signature', () => {
		const allColumns = ['categoria', 'grupo', 'regiao'];
		const dataset = createDataset('count', null, 'grouped', ['grupo']);
		appendControls(createBubbleChartControls(dataset, ['categoria'], ['valor'], allColumns));
		const writer = createWriter();
		setupBubbleChartControlListeners(dataset, ['categoria'], ['valor'], [], writer);

		selectValue('viz-select-bubble-nesting-level-0', 'grupo');
		expect(lastConfig(writer).nestingColumns).toEqual([]); // empty allowlist allows nothing
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
