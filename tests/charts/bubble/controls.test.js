// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BUBBLE_CONTROLS } from '../../../src/charts/bubble/controls/descriptions.js';
import { buildDescribedControls } from '../../../src/charts/shared/controls/describedControls.js';
import { BUBBLE_CHART, BUBBLE_DEFINITION } from '../../../src/config/charts/definitions/bubble.js';

/**
 * Writer test double. The controls' contract is that they hand the right
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

/** The sidebar's context; `allColumns` lists the visible columns the nesting levels offer. */
function createContext(allColumns = ['categoria', 'grupo'], { categories = ['categoria'], numeric = ['valor'] } = {}) {
	return {
		baseCategoricalOrAll: categories,
		categorical: categories,
		numeric,
		allColumns,
		dates: [],
		rows: [],
	};
}

function buildControls(dataset, allColumns, writer = createWriter()) {
	return buildDescribedControls(BUBBLE_CONTROLS, { dataset, context: createContext(allColumns), writer, translate: key => key });
}

/** Build the controls into the document, as the sidebar does after each commit. */
function mountControls(dataset, allColumns, writer = createWriter()) {
	document.body.replaceChildren(...buildControls(dataset, allColumns, writer));
	return writer;
}

function selectValue(id, value) {
	const select = document.getElementById(id);
	if (![...select.options].some(option => option.value === value)) {
		select.append(new Option(value, value));
	}
	select.value = value;
	select.dispatchEvent(new Event('change', { bubbles: true }));
}

function lastConfig(writer) {
	return writer.commit.mock.calls.at(-1)[0];
}

describe('bubble controls module boundaries', () => {
	it('declares its controls as descriptions, with the nesting levels beside them', async () => {
		const [descriptions, custom, nesting] = await Promise.all([
			import('../../../src/charts/bubble/controls/descriptions.js'),
			import('../../../src/charts/bubble/controls/customControls.js'),
			import('../../../src/charts/bubble/controls/nestingColumns.js'),
		]);
		expect(Object.keys(descriptions)).toEqual(['BUBBLE_CONTROLS']);
		expect(Object.keys(custom)).toEqual(['buildNestingLevels']);
		expect(Object.keys(nesting).sort()).toEqual([
			'computeNestingControlCount',
			'resolveNestingColumnsFromConfig',
		]);
		expect(BUBBLE_CONTROLS.definition).toBe(BUBBLE_DEFINITION);
	});
});

describe('bubbleControls section structure', () => {
	beforeEach(() => {
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
		return extractStructure(buildControls(dataset, allColumns));
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
		document.body.innerHTML = '';
	});

	it('renders disabled controls and falls back invalid modes/options', () => {
		const dataset = createDataset('bad', 'old', 'bad', []);
		dataset.chartConfig.bubble.enabled = false;
		dataset.chartConfig.bubble.padding = null;
		dataset.chartConfig.bubble.colorScheme = '';
		mountControls(dataset, ['categoria', 'grupo']);

		expect(document.getElementById('viz-select-bubble-measure').value).toBe('count');
		expect(document.getElementById('viz-select-bubble-nesting-mode').value).toBe('flat');
		expect(document.getElementById('viz-slider-bubble-padding').value).toBe('3');
		expect(document.getElementById('viz-select-bubble-category').disabled).toBe(true);
		expect(document.getElementById('viz-select-bubble-nesting-level-0').disabled).toBe(true);
		expect(document.querySelector('button[data-color-preset-control="viz-bubble-color-preset"][data-preset-name="Tableau10"]').disabled).toBe(true);
	});

	it('offers the measures, nesting modes and label modes the bubble definition lists', () => {
		mountControls(createDataset(), ['categoria', 'grupo']);

		const values = id => Array.from(document.getElementById(id).options, option => option.value);
		expect(values('viz-select-bubble-measure')).toEqual(BUBBLE_DEFINITION.allowedValues.measureMode);
		expect(values('viz-select-bubble-nesting-mode')).toEqual(BUBBLE_DEFINITION.allowedValues.nestingMode);
		expect(values('viz-select-bubble-label-mode')).toEqual(BUBBLE_DEFINITION.allowedValues.labelMode);
	});

	it('emits measure/value updates and keeps the value column when switching back to count', () => {
		const dataset = createDataset('count', null);
		const writer = mountControls(dataset, ['categoria', 'grupo']);

		selectValue('viz-select-bubble-measure', 'sum');
		expect(lastConfig(writer)).toEqual({ measureMode: 'sum', valueColumn: 'valor' });

		dataset.chartConfig.bubble.measureMode = 'sum';
		dataset.chartConfig.bubble.valueColumn = 'valor';
		selectValue('viz-select-bubble-value-column', 'valor');
		expect(lastConfig(writer)).toEqual({ valueColumn: 'valor' });

		selectValue('viz-select-bubble-measure', 'count');
		expect(lastConfig(writer)).toEqual({ measureMode: 'count', valueColumn: 'valor' });

		expect(writer.commit).toHaveBeenCalledTimes(3);
	});

	it('commits a forged measure as chosen', () => {
		const writer = mountControls(createDataset('sum', 'old'), ['categoria', 'grupo']);

		// The commit canonicalizes the config, which stores a measure the bubble
		// chart does not offer as count. Like count, it keeps the value column.
		selectValue('viz-select-bubble-measure', 'bogus');
		expect(lastConfig(writer)).toEqual({ measureMode: 'bogus', valueColumn: 'old' });

		selectValue('viz-select-bubble-measure', 'mean');
		expect(lastConfig(writer)).toEqual({ measureMode: 'mean', valueColumn: 'valor' });
	});
});

describe('bubbleControls nesting mode', () => {
	beforeEach(() => {
		document.body.innerHTML = '';
	});

	it('nesting mode control exists and defaults to flat', () => {
		mountControls(createDataset('count', null, 'flat'), ['categoria', 'grupo']);

		expect(document.getElementById('viz-select-bubble-nesting-mode').value).toBe('flat');
	});

	it('nesting mode control updates config when changed', () => {
		const writer = mountControls(createDataset('count', null, 'flat'), ['categoria', 'grupo']);

		selectValue('viz-select-bubble-nesting-mode', 'grouped');

		expect(lastConfig(writer)).toEqual({ nestingMode: 'grouped' });
		expect(writer.commit).toHaveBeenCalledTimes(1);
	});

	// Forged nesting and label modes are committed as chosen: the commit
	// canonicalizes the chart's config, which replaces a mode the bubble chart
	// does not offer.
	it('commits generic select, title, slider, and palette values', () => {
		const writer = mountControls(createDataset('count', null, 'flat'), ['categoria', 'grupo']);

		selectValue('viz-select-bubble-category', 'grupo');
		expect(lastConfig(writer)).toEqual({ category: 'grupo' });

		selectValue('viz-select-bubble-nesting-mode', 'unknown');
		expect(lastConfig(writer)).toEqual({ nestingMode: 'unknown' });

		selectValue('viz-select-bubble-topn', '20');
		expect(lastConfig(writer)).toEqual({ topN: 20 });

		selectValue('viz-select-bubble-label-mode', 'bad');
		expect(lastConfig(writer)).toEqual({ labelMode: 'bad' });

		const title = document.getElementById('viz-input-bubble-title');
		title.value = '  Bubble panel  ';
		title.dispatchEvent(new Event('change', { bubbles: true }));
		expect(lastConfig(writer)).toEqual({ customTitle: 'Bubble panel' });

		const padding = document.getElementById('viz-slider-bubble-padding');
		padding.value = '6';
		padding.dispatchEvent(new Event('input', { bubbles: true }));
		expect(padding.parentElement.querySelector('output').textContent).toBe('6');
		padding.dispatchEvent(new Event('change', { bubbles: true }));
		expect(lastConfig(writer)).toEqual({ padding: 6 });

		document.querySelector('button[data-color-preset-control="viz-bubble-color-preset"][data-preset-name="Bold"]').click();
		expect(lastConfig(writer)).toEqual({ colorScheme: 'Bold' });
	});

	it('marks the stored palette', () => {
		const dataset = createDataset();
		dataset.chartConfig.bubble.colorScheme = 'Pastel';
		mountControls(dataset, ['categoria', 'grupo']);

		const marked = [...document.querySelectorAll('button[data-color-preset-control="viz-bubble-color-preset"]')]
			.filter(button => button.style.border.startsWith('2px'))
			.map(button => button.dataset.presetName);
		expect(marked).toEqual(['Pastel']);
	});
});

describe('bubbleControls progressive nesting selectors', () => {
	beforeEach(() => {
		document.body.innerHTML = '';
	});

	it('grouped mode shows level 1 selector', () => {
		mountControls(createDataset('count', null, 'grouped', []), ['categoria', 'grupo', 'regiao']);

		const level0 = document.getElementById('viz-select-bubble-nesting-level-0');
		expect(level0).not.toBeNull();
		expect(level0.disabled).toBe(false);
	});

	it('selecting level 1 reveals level 2', () => {
		mountControls(createDataset('count', null, 'grouped', ['grupo']), ['categoria', 'grupo', 'regiao']);

		expect(document.getElementById('viz-select-bubble-nesting-level-0').value).toBe('grupo');
		expect(document.getElementById('viz-select-bubble-nesting-level-1')).not.toBeNull();
	});

	it('selecting level 2 reveals level 3', () => {
		mountControls(createDataset('count', null, 'grouped', ['grupo', 'regiao']), ['categoria', 'grupo', 'regiao', 'estado']);

		expect(document.getElementById('viz-select-bubble-nesting-level-0').value).toBe('grupo');
		expect(document.getElementById('viz-select-bubble-nesting-level-1').value).toBe('regiao');
		expect(document.getElementById('viz-select-bubble-nesting-level-2')).not.toBeNull();
	});

	it('labels each level with its number', () => {
		const dataset = createDataset('count', null, 'grouped', ['grupo']);
		document.body.replaceChildren(...buildDescribedControls(BUBBLE_CONTROLS, {
			dataset,
			context: createContext(['categoria', 'grupo', 'regiao']),
			writer: createWriter(),
			translate: (key, ...params) => [key, ...params].join('|'),
		}));

		const label = id => document.querySelector(`label[for="${id}"]`).textContent;
		expect(label('viz-select-bubble-nesting-level-0')).toBe('chive-chart-control-bubble-nesting-level|1');
		expect(label('viz-select-bubble-nesting-level-1')).toBe('chive-chart-control-bubble-nesting-level|2');
		expect(document.getElementById('viz-select-bubble-nesting-level-1').options[0].textContent)
			.toBe('chive-chart-control-bubble-nesting-empty');
	});

	it('options exclude already selected columns and current category column', () => {
		mountControls(createDataset('count', null, 'grouped', ['grupo']), ['categoria', 'grupo', 'regiao']);

		const optionValues = Array.from(document.getElementById('viz-select-bubble-nesting-level-1').options).map(o => o.value);

		// Should NOT include 'grupo' (already selected at level 0) or 'categoria' (is category column)
		expect(optionValues).not.toContain('grupo');
		expect(optionValues).not.toContain('categoria');
		expect(optionValues).toContain('regiao');
	});

	it('clearing level K truncates deeper levels in config updates', () => {
		const writer = mountControls(createDataset('count', null, 'grouped', ['grupo', 'regiao']), ['categoria', 'grupo', 'regiao', 'estado']);

		// Clear level 0 → should truncate all
		selectValue('viz-select-bubble-nesting-level-0', '');

		expect(lastConfig(writer)).toEqual({ nestingColumns: [], groupColumn: null });
		expect(writer.commit).toHaveBeenCalledTimes(1);
	});

	it('sets a nesting level and truncates deeper levels from that point', () => {
		const writer = mountControls(createDataset('count', null, 'grouped', ['grupo', 'regiao']), ['categoria', 'grupo', 'regiao', 'estado']);

		selectValue('viz-select-bubble-nesting-level-1', 'estado');
		expect(lastConfig(writer)).toEqual({ nestingColumns: ['grupo', 'estado'], groupColumn: 'grupo' });

		selectValue('viz-select-bubble-nesting-level-1', '');
		expect(lastConfig(writer)).toEqual({ nestingColumns: ['grupo'], groupColumn: 'grupo' });
	});

	it('reads the nesting of the moment a level changes, not the one it was built from', () => {
		const dataset = createDataset('count', null, 'grouped', ['grupo', 'regiao']);
		const writer = mountControls(dataset, ['categoria', 'grupo', 'regiao', 'estado']);

		dataset.chartConfig = { bubble: { ...dataset.chartConfig.bubble, nestingColumns: ['estado', 'grupo'] } };
		selectValue('viz-select-bubble-nesting-level-1', 'regiao');

		expect(lastConfig(writer)).toEqual({ nestingColumns: ['estado', 'regiao'], groupColumn: 'estado' });
	});

	it('flat mode nesting selectors are disabled', () => {
		mountControls(createDataset('count', null, 'flat', []), ['categoria', 'grupo', 'regiao']);

		const level0 = document.getElementById('viz-select-bubble-nesting-level-0');
		expect(level0).not.toBeNull();
		expect(level0.disabled).toBe(true);
	});

	it('initial config with groupColumn hydrates first nesting level selector correctly', () => {
		// Simulate old config with only groupColumn, no nestingColumns
		const dataset = createDataset('count', null, 'grouped', []);
		dataset.chartConfig.bubble.groupColumn = 'grupo';
		dataset.chartConfig.bubble.nestingColumns = [];

		mountControls(dataset, ['categoria', 'grupo', 'regiao']);

		expect(document.getElementById('viz-select-bubble-nesting-level-0').value).toBe('grupo');
	});
});

describe('bubbleControls nesting depth bound', () => {
	beforeEach(() => {
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
		mountControls(createDataset('count', null, 'grouped', overDeep), wideColumns);

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
		mountControls(createDataset('count', null, 'grouped', selected), wideColumns);

		expect(nestingSelectCount()).toBe(cap); // (cap - 1) filled + 1 trailing empty
		expect(document.getElementById(`viz-select-bubble-nesting-level-${cap - 1}`).value).toBe('');
	});

	it('shows no dead extra selector at exactly maxNestingDepth selected', () => {
		const selected = Array.from({ length: cap }, (_, i) => `c${i}`);
		mountControls(createDataset('count', null, 'grouped', selected), wideColumns);

		expect(nestingSelectCount()).toBe(cap); // all filled, no dead 9th
		expect(document.getElementById(`viz-select-bubble-nesting-level-${cap - 1}`).value).toBe(`c${cap - 1}`);
		expect(document.getElementById(`viz-select-bubble-nesting-level-${cap}`)).toBeNull();
	});

	it('shows no trailing selector when all eligible columns below the cap are selected', () => {
		mountControls(createDataset('count', null, 'grouped', ['c0', 'c1', 'c2', 'c3']), ['categoria', 'c0', 'c1', 'c2', 'c3']);

		expect(nestingSelectCount()).toBe(4); // 4 eligible filled, no useless trailing empty
	});

	it('does not let an empty-string column inflate the capacity', () => {
		mountControls(createDataset('count', null, 'grouped', ['c0', 'c1', 'c2', 'c3']), ['categoria', 'c0', 'c1', 'c2', 'c3', '']);

		expect(nestingSelectCount()).toBe(4); // '' dropped from allowed → no extra trailing selector
	});

	it('falls back to a valid legacy groupColumn when the canonical list filters away', () => {
		const dataset = createDataset('count', null, 'grouped', ['nonexistent']);
		dataset.chartConfig.bubble.groupColumn = 'grupo';
		mountControls(dataset, ['categoria', 'grupo', 'regiao']);

		expect(document.getElementById('viz-select-bubble-nesting-level-0').value).toBe('grupo');
	});

	it('changes the last level at the maximum depth', () => {
		const selected = Array.from({ length: cap }, (_, i) => `c${i}`);
		const dataset = createDataset('count', null, 'grouped', selected);
		const writer = mountControls(dataset, wideColumns);

		selectValue(`viz-select-bubble-nesting-level-${cap - 1}`, 'c9');

		expect(lastConfig(writer).nestingColumns).toEqual([...selected.slice(0, cap - 1), 'c9']);
	});

	it('does not resurrect a hidden out-of-allowlist entry on a level change', () => {
		const dataset = createDataset('count', null, 'grouped', ['invalid', 'grupo']);
		dataset.chartConfig.bubble.groupColumn = 'invalid';
		const writer = mountControls(dataset, ['categoria', 'grupo', 'regiao']);

		selectValue('viz-select-bubble-nesting-level-1', 'regiao');
		expect(lastConfig(writer).nestingColumns).toEqual(['grupo', 'regiao']); // 'invalid' never resurfaces
	});

	it('does not resurrect a hidden category entry on a level change', () => {
		const dataset = createDataset('count', null, 'grouped', ['categoria', 'grupo']);
		dataset.chartConfig.bubble.groupColumn = 'categoria';
		const writer = mountControls(dataset, ['categoria', 'grupo', 'regiao']);

		selectValue('viz-select-bubble-nesting-level-1', 'regiao');
		expect(lastConfig(writer).nestingColumns).toEqual(['grupo', 'regiao']); // 'categoria' never resurfaces
	});

	it('rejects a forged out-of-allowlist option at the write sink', () => {
		const writer = mountControls(createDataset('count', null, 'grouped', ['grupo']), ['categoria', 'grupo', 'regiao']);

		selectValue('viz-select-bubble-nesting-level-0', 'forged_xyz');

		expect(lastConfig(writer).nestingColumns).not.toContain('forged_xyz');
		expect(lastConfig(writer).nestingColumns).toEqual([]);
	});

	it('stores no nesting level when no visible column besides the category is eligible', () => {
		const writer = mountControls(createDataset('count', null, 'grouped', ['grupo']), ['categoria']);

		expect(Array.from(document.getElementById('viz-select-bubble-nesting-level-0').options, option => option.value)).toEqual(['']);
		selectValue('viz-select-bubble-nesting-level-0', 'grupo');
		expect(lastConfig(writer)).toEqual({ nestingColumns: [], groupColumn: null });
	});
});
