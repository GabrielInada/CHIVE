import { describe, it, expect } from 'vitest';
import {
	normalizePanelChartId,
	addChartSnapshotToState,
	removeChartSnapshotFromState,
	getChartSnapshotFromState,
	assignChartToSlotInState,
	clearPanelState,
	validatePanelSlotsState,
	addPanelBlockState,
	removePanelBlockState,
	movePanelBlockState,
	updatePanelBlockProportionsState,
	updatePanelBlockHeightState,
	updatePanelBlockBorderState,
	setPanelBlockTemplateState,
	assignChartToPanelBlockSlotState,
	migrateLegacyPanelStateState,
} from '../../../src/modules/panel/panelStateMutations.js';

function makeBlock(id, templateId = 'layout-2col') {
	return { id, templateId, slots: {}, proportions: { split: 50 }, heightPx: null, borderEnabled: false, borderColor: '#5d645d' };
}

let nextBlockId = 1;
function createPanelBlock(templateId = 'layout-2col') {
	return makeBlock(`block-${nextBlockId++}`, templateId);
}

function makeAppState(overrides = {}) {
	nextBlockId = 1;
	return {
		data: { datasets: [], activeIndex: -1 },
		panel: {
			charts: [],
			slots: {},
			layout: 'layout-2col',
			blocks: [makeBlock('block-0')],
			nextBlockId: 1,
			nextChartId: 0,
			...overrides,
		},
		ui: {},
	};
}

const ensureDefault = (appState) => () => {
	if (appState.panel.blocks.length === 0) {
		appState.panel.blocks.push(createPanelBlock());
	}
};

describe('normalizePanelChartId', () => {
	it('returns number for valid numeric input', () => {
		expect(normalizePanelChartId(5)).toBe(5);
		expect(normalizePanelChartId('3')).toBe(3);
		expect(normalizePanelChartId(0)).toBe(0);
	});

	it('returns null for invalid input', () => {
		expect(normalizePanelChartId('abc')).toBeNull();
		expect(normalizePanelChartId(NaN)).toBeNull();
		expect(normalizePanelChartId(Infinity)).toBeNull();
	});

	it('coerces null/undefined to 0 (Number() semantics)', () => {
		expect(normalizePanelChartId(null)).toBe(0);
		expect(normalizePanelChartId(undefined)).toBeNull();
	});
});

describe('addChartSnapshotToState', () => {
	it('adds snapshot with incremented id and sanitized name', () => {
		const panel = { charts: [], nextChartId: 0 };
		const { id, snapshot } = addChartSnapshotToState(panel, { nome: '  Test  ', svgMarkup: '<svg/>' }, s => s.trim());
		expect(id).toBe(0);
		expect(snapshot.nome).toBe('Test');
		expect(panel.charts.length).toBe(1);
		expect(panel.nextChartId).toBe(1);
	});

	it('truncates metaSummary to 180 characters', () => {
		const panel = { charts: [], nextChartId: 0 };
		const long = 'a'.repeat(200);
		const { snapshot } = addChartSnapshotToState(panel, { nome: 'X', svgMarkup: '', metaSummary: long }, s => s);
		expect(snapshot.metaSummary.length).toBe(180);
	});

	it('defaults metaSummary to empty string for non-string input', () => {
		const panel = { charts: [], nextChartId: 0 };
		const { snapshot } = addChartSnapshotToState(panel, { nome: 'X', svgMarkup: '' }, s => s);
		expect(snapshot.metaSummary).toBe('');
	});
});

describe('removeChartSnapshotFromState', () => {
	it('removes chart and cleans up slot references', () => {
		const appState = makeAppState({ charts: [{ id: 0, nome: 'A' }], slots: { 'slot-1': 0 }, nextChartId: 1 });
		appState.panel.blocks[0].slots = { 'slot-1': 0 };

		const result = removeChartSnapshotFromState(appState, 0, ensureDefault(appState));
		expect(result).toBe(0);
		expect(appState.panel.charts.length).toBe(0);
		expect(appState.panel.slots['slot-1']).toBeUndefined();
		expect(appState.panel.blocks[0].slots['slot-1']).toBeUndefined();
	});

	it('returns null for invalid chart id', () => {
		const appState = makeAppState();
		expect(removeChartSnapshotFromState(appState, 'invalid', ensureDefault(appState))).toBeNull();
	});
});

describe('getChartSnapshotFromState', () => {
	it('returns chart by id', () => {
		const panel = { charts: [{ id: 0, nome: 'A' }, { id: 1, nome: 'B' }] };
		expect(getChartSnapshotFromState(panel, 1).nome).toBe('B');
	});

	it('returns null for non-existent chart', () => {
		expect(getChartSnapshotFromState({ charts: [] }, 99)).toBeNull();
	});

	it('returns null for invalid id', () => {
		expect(getChartSnapshotFromState({ charts: [] }, 'abc')).toBeNull();
	});
});

describe('assignChartToSlotInState', () => {
	it('assigns chart to slot', () => {
		const appState = makeAppState({ charts: [{ id: 0 }] });
		const getSnapshot = (id) => appState.panel.charts.find(c => c.id === id) || null;
		assignChartToSlotInState(appState, 'slot-1', 0, getSnapshot);
		expect(appState.panel.slots['slot-1']).toBe(0);
	});

	it('removes slot when chartId is null', () => {
		const appState = makeAppState({ slots: { 'slot-1': 0 } });
		assignChartToSlotInState(appState, 'slot-1', null, () => null);
		expect(appState.panel.slots['slot-1']).toBeUndefined();
	});

	it('throws for invalid chart id', () => {
		const appState = makeAppState();
		expect(() => assignChartToSlotInState(appState, 'slot-1', 'abc', () => null)).toThrow('not found');
	});

	it('throws for non-existent chart', () => {
		const appState = makeAppState();
		expect(() => assignChartToSlotInState(appState, 'slot-1', 99, () => null)).toThrow('not found');
	});
});

describe('clearPanelState', () => {
	it('resets all panel state', () => {
		const appState = makeAppState({
			charts: [{ id: 0 }],
			slots: { 'slot-1': 0 },
			nextChartId: 5,
			nextBlockId: 3,
		});
		clearPanelState(appState, createPanelBlock);
		expect(appState.panel.charts).toEqual([]);
		expect(appState.panel.slots).toEqual({});
		expect(appState.panel.nextChartId).toBe(0);
		expect(appState.panel.blocks.length).toBe(1);
	});
});

describe('validatePanelSlotsState', () => {
	it('removes slots referencing non-existent charts', () => {
		const appState = makeAppState({
			charts: [{ id: 1 }],
			slots: { 'slot-1': 1, 'slot-2': 99 },
		});
		appState.panel.blocks[0].slots = { 'slot-1': 1, 'slot-2': 99 };

		validatePanelSlotsState(appState, ensureDefault(appState));
		expect(appState.panel.slots['slot-1']).toBe(1);
		expect(appState.panel.slots['slot-2']).toBeUndefined();
		expect(appState.panel.blocks[0].slots['slot-2']).toBeUndefined();
	});
});

describe('addPanelBlockState', () => {
	it('adds block when under limit', () => {
		const appState = makeAppState();
		const block = addPanelBlockState(appState, 'layout-single', ensureDefault(appState), createPanelBlock, 4);
		expect(block).not.toBeNull();
		expect(appState.panel.blocks.length).toBe(2);
	});

	it('returns null when at block limit', () => {
		const appState = makeAppState();
		const result = addPanelBlockState(appState, 'layout-2col', ensureDefault(appState), createPanelBlock, 1);
		expect(result).toBeNull();
	});
});

describe('removePanelBlockState', () => {
	it('removes block and keeps at least one', () => {
		const appState = makeAppState({ blocks: [makeBlock('block-A'), makeBlock('block-B')] });
		removePanelBlockState(appState, 'block-A', ensureDefault(appState), createPanelBlock);
		expect(appState.panel.blocks.length).toBe(1);
		expect(appState.panel.blocks[0].id).toBe('block-B');
	});

	it('creates new default block when removing the last one', () => {
		const appState = makeAppState({ blocks: [makeBlock('block-only')] });
		removePanelBlockState(appState, 'block-only', ensureDefault(appState), createPanelBlock);
		expect(appState.panel.blocks.length).toBe(1);
		expect(appState.panel.blocks[0].id).not.toBe('block-only');
	});
});

describe('movePanelBlockState', () => {
	it('moves block to target index', () => {
		const appState = makeAppState({ blocks: [makeBlock('A'), makeBlock('B'), makeBlock('C')] });
		const result = movePanelBlockState(appState, 'A', 2, ensureDefault(appState));
		expect(result).toBe(2);
		expect(appState.panel.blocks.map(b => b.id)).toEqual(['B', 'C', 'A']);
	});

	it('returns null for non-existent block', () => {
		const appState = makeAppState();
		expect(movePanelBlockState(appState, 'nope', 0, ensureDefault(appState))).toBeNull();
	});

	it('returns null when target equals current index', () => {
		const appState = makeAppState({ blocks: [makeBlock('A'), makeBlock('B')] });
		expect(movePanelBlockState(appState, 'A', 0, ensureDefault(appState))).toBeNull();
	});

	it('clamps target index to valid range', () => {
		const appState = makeAppState({ blocks: [makeBlock('A'), makeBlock('B')] });
		const result = movePanelBlockState(appState, 'A', 99, ensureDefault(appState));
		expect(result).toBe(1);
	});
});

describe('updatePanelBlockProportionsState', () => {
	it('updates proportions with clamped values', () => {
		const appState = makeAppState({ blocks: [makeBlock('A')] });
		const clamp = (v, min, max) => Math.max(min, Math.min(max, Number(v)));
		const result = updatePanelBlockProportionsState(appState, 'A', { split: 70 }, ensureDefault(appState), clamp);
		expect(result.split).toBe(70);
	});

	it('returns null for non-existent block', () => {
		const appState = makeAppState();
		const clamp = (v) => v;
		expect(updatePanelBlockProportionsState(appState, 'nope', { split: 50 }, ensureDefault(appState), clamp)).toBeNull();
	});

	it('returns null for null or non-object proportions', () => {
		const appState = makeAppState({ blocks: [makeBlock('A')] });
		const clamp = (v) => v;
		expect(updatePanelBlockProportionsState(appState, 'A', null, ensureDefault(appState), clamp)).toBeNull();
		expect(updatePanelBlockProportionsState(appState, 'A', 'string', ensureDefault(appState), clamp)).toBeNull();
	});
});

describe('updatePanelBlockHeightState', () => {
	it('sets height clamped to min/max', () => {
		const appState = makeAppState({ blocks: [makeBlock('A')] });
		const result = updatePanelBlockHeightState(appState, 'A', 500, ensureDefault(appState), 220, 760);
		expect(result).toBe(500);
	});

	it('clamps below min', () => {
		const appState = makeAppState({ blocks: [makeBlock('A')] });
		expect(updatePanelBlockHeightState(appState, 'A', 100, ensureDefault(appState), 220, 760)).toBe(220);
	});

	it('clamps above max', () => {
		const appState = makeAppState({ blocks: [makeBlock('A')] });
		expect(updatePanelBlockHeightState(appState, 'A', 999, ensureDefault(appState), 220, 760)).toBe(760);
	});

	it('returns null for non-existent block', () => {
		const appState = makeAppState();
		expect(updatePanelBlockHeightState(appState, 'nope', 300, ensureDefault(appState), 220, 760)).toBeNull();
	});

	it('returns null for non-finite height', () => {
		const appState = makeAppState({ blocks: [makeBlock('A')] });
		expect(updatePanelBlockHeightState(appState, 'A', 'abc', ensureDefault(appState), 220, 760)).toBeNull();
	});
});

describe('updatePanelBlockBorderState', () => {
	it('updates border enabled and color', () => {
		const appState = makeAppState({ blocks: [makeBlock('A')] });
		const result = updatePanelBlockBorderState(appState, 'A', { enabled: true, color: '#ff0000' }, ensureDefault(appState));
		expect(result.enabled).toBe(true);
		expect(result.color).toBe('#ff0000');
	});

	it('ignores invalid hex color', () => {
		const appState = makeAppState({ blocks: [makeBlock('A')] });
		const result = updatePanelBlockBorderState(appState, 'A', { color: 'not-hex' }, ensureDefault(appState));
		expect(result.color).toBe('#5d645d');
	});

	it('returns null for non-existent block', () => {
		const appState = makeAppState();
		expect(updatePanelBlockBorderState(appState, 'nope', { enabled: true }, ensureDefault(appState))).toBeNull();
	});

	it('returns null for null options', () => {
		const appState = makeAppState({ blocks: [makeBlock('A')] });
		expect(updatePanelBlockBorderState(appState, 'A', null, ensureDefault(appState))).toBeNull();
	});
});

describe('setPanelBlockTemplateState', () => {
	const normalize = (t) => ['layout-single', 'layout-2col', 'layout-3col'].includes(t) ? t : 'layout-2col';
	const getSlots = (t) => {
		if (t === 'layout-single') return ['slot-1'];
		if (t === 'layout-3col') return ['slot-1', 'slot-2', 'slot-3'];
		return ['slot-1', 'slot-2'];
	};
	const defaultProps = () => ({ split: 50 });

	it('changes template and returns ok', () => {
		const appState = makeAppState({ blocks: [makeBlock('A')] });
		const result = setPanelBlockTemplateState(appState, 'A', 'layout-single', ensureDefault(appState), normalize, getSlots, defaultProps);
		expect(result.ok).toBe(true);
		expect(result.templateId).toBe('layout-single');
		expect(appState.panel.blocks[0].templateId).toBe('layout-single');
	});

	it('returns ok without changes when same template', () => {
		const appState = makeAppState({ blocks: [makeBlock('A')] });
		const result = setPanelBlockTemplateState(appState, 'A', 'layout-2col', ensureDefault(appState), normalize, getSlots, defaultProps);
		expect(result.ok).toBe(true);
	});

	it('returns not ok for non-existent block', () => {
		const appState = makeAppState();
		expect(setPanelBlockTemplateState(appState, 'nope', 'layout-2col', ensureDefault(appState), normalize, getSlots, defaultProps).ok).toBe(false);
	});

	it('updates panel layout when first block template changes', () => {
		const block = makeBlock('block-0');
		const appState = makeAppState({ blocks: [block] });
		setPanelBlockTemplateState(appState, 'block-0', 'layout-3col', ensureDefault(appState), normalize, getSlots, defaultProps);
		expect(appState.panel.layout).toBe('layout-3col');
	});

	it('prunes slots not in new template', () => {
		const block = makeBlock('A');
		block.templateId = 'layout-3col';
		block.slots = { 'slot-1': 0, 'slot-2': 1, 'slot-3': 2 };
		const appState = makeAppState({ blocks: [block] });
		setPanelBlockTemplateState(appState, 'A', 'layout-single', ensureDefault(appState), normalize, getSlots, defaultProps);
		expect(Object.keys(appState.panel.blocks[0].slots)).toEqual(['slot-1']);
	});
});

describe('assignChartToPanelBlockSlotState', () => {
	it('assigns chart to block slot', () => {
		const chart = { id: 0, nome: 'A' };
		const appState = makeAppState({ charts: [chart] });
		const getSnapshot = (id) => appState.panel.charts.find(c => c.id === id) || null;
		const result = assignChartToPanelBlockSlotState(appState, 'block-0', 'slot-1', 0, ensureDefault(appState), getSnapshot);
		expect(result.ok).toBe(true);
		expect(appState.panel.blocks[0].slots['slot-1']).toBe(0);
	});

	it('clears slot when chartId is null', () => {
		const block = makeBlock('block-0');
		block.slots = { 'slot-1': 0 };
		const appState = makeAppState({ blocks: [block] });
		const result = assignChartToPanelBlockSlotState(appState, 'block-0', 'slot-1', null, ensureDefault(appState), () => null);
		expect(result.ok).toBe(true);
		expect(appState.panel.blocks[0].slots['slot-1']).toBeUndefined();
	});

	it('returns not ok for non-existent block', () => {
		const appState = makeAppState();
		expect(assignChartToPanelBlockSlotState(appState, 'nope', 'slot-1', null, ensureDefault(appState), () => null).ok).toBe(false);
	});

	it('throws for non-existent chart', () => {
		const appState = makeAppState();
		const getSnapshot = () => null;
		expect(() => assignChartToPanelBlockSlotState(appState, 'block-0', 'slot-1', 99, ensureDefault(appState), getSnapshot)).toThrow('not found');
	});
});

describe('migrateLegacyPanelStateState', () => {
	it('migrates legacy slots to first block', () => {
		const appState = makeAppState({ layout: 'layout-3col', slots: { 'slot-1': 0, 'slot-2': 1 } });
		const result = migrateLegacyPanelStateState(appState, createPanelBlock);
		expect(result.templateId).toBe('layout-3col');
		expect(appState.panel.blocks[0].slots).toEqual({ 'slot-1': 0, 'slot-2': 1 });
		expect(appState.panel.layout).toBeUndefined();
	});
});
