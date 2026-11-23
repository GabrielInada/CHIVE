// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deriveShownDataset } from '../../../../src/domain/datasets/shownDataset.js';

vi.mock('../../../../src/services/i18nService.js', () => ({ t: key => key }));

vi.mock('../../../../src/state/appState.js', () => ({
	onStateChange: vi.fn(),
	STATE_EVENTS: {},
	setActiveChartType: vi.fn(),
	// The change events below reach the real controls, which write through these.
	updateActiveDatasetConfig: vi.fn(),
	transformActiveDatasetConfigSilently: vi.fn(),
}));

vi.mock('../../../../src/features/datasetWorkspace/dialogs/chartTypePickerDialog.js', () => ({
	openChartTypePickerDialog: vi.fn(() => Promise.resolve(null)),
}));

const SHOWN = deriveShownDataset({
	rows: [{ categoria: 'A', valor: 1 }],
	columns: [{ name: 'categoria', type: 'text' }, { name: 'valor', type: 'number' }],
	selectedColumns: ['categoria', 'valor'],
	chartConfig: { bar: { enabled: true } },
});

// jsdom does no layout, so each element reports the top this map gives its id.
let topById;
let renderSidebar;
let params;

/** The sidebar keeps the last interaction in module state, so each test loads it fresh. */
beforeEach(async () => {
	document.body.innerHTML = '<div id="viz-chart-params"></div>';
	params = document.getElementById('viz-chart-params');
	Object.defineProperty(params, 'scrollTop', { value: 0, writable: true });
	topById = {};
	vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
		return { top: topById[this.id] ?? 0 };
	});
	vi.resetModules();
	({ renderChartControlsSidebar: renderSidebar } = await import(
		'../../../../src/features/datasetWorkspace/chartControls/chartControlsController.js'
	));
	renderSidebar(SHOWN);
});

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
});

const control = () => params.querySelector('#viz-select-bar');

describe('chart controls sidebar scroll anchoring', () => {
	it('keeps a just-changed control at the same viewport offset across a re-render', () => {
		params.scrollTop = 100;
		topById['viz-select-bar'] = 200;
		control().dispatchEvent(new Event('change', { bubbles: true }));

		// The re-render pushes the control 60px further down the pane.
		topById['viz-select-bar'] = 260;
		renderSidebar(SHOWN);

		expect(params.scrollTop).toBe(160);
		expect(document.activeElement).toBe(control());
	});

	it('anchors to the focused control once the last interaction is stale', () => {
		vi.useFakeTimers({ now: 0, toFake: ['Date'] });
		const other = params.querySelector('#viz-select-bar-sort');
		other.dispatchEvent(new Event('change', { bubbles: true }));
		vi.setSystemTime(2001);

		params.scrollTop = 100;
		const focused = control();
		focused.focus();
		// Read as the render starts; the rebuilt control sits 50px higher.
		focused.getBoundingClientRect = () => ({ top: 200 });
		topById['viz-select-bar'] = 150;
		renderSidebar(SHOWN);

		expect(params.scrollTop).toBe(50);
		expect(document.activeElement).toBe(control());
	});

	it('restores the previous scroll offset when the anchor has no id', () => {
		params.scrollTop = 80;
		const unnamed = document.createElement('button');
		params.querySelector('.chart-control-section').append(unnamed);
		unnamed.dispatchEvent(new Event('click', { bubbles: true }));
		topById['viz-select-bar'] = 40;

		renderSidebar(SHOWN);

		expect(params.scrollTop).toBe(80);
	});

	it('restores the previous scroll offset when the anchor is gone after the render', () => {
		params.scrollTop = 80;
		control().dispatchEvent(new Event('change', { bubbles: true }));

		renderSidebar(null);

		expect(params.querySelector('.table-no-columns')).not.toBeNull();
		expect(params.scrollTop).toBe(80);
	});

	it('ignores interactions on non-HTML targets', () => {
		params.scrollTop = 80;
		const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		icon.id = 'viz-select-bar';
		params.append(icon);
		icon.dispatchEvent(new Event('click', { bubbles: true }));
		icon.remove();
		topById['viz-select-bar'] = 500;

		renderSidebar(SHOWN);

		expect(params.scrollTop).toBe(80);
	});

	it('falls back to a plain focus when focus options are rejected', () => {
		control().dispatchEvent(new Event('change', { bubbles: true }));
		const plainFocus = HTMLElement.prototype.focus;
		const focus = vi.spyOn(HTMLElement.prototype, 'focus').mockImplementation(function (options) {
			if (options) throw new TypeError('focus options unsupported');
			plainFocus.call(this);
		});

		renderSidebar(SHOWN);

		expect(focus).toHaveBeenCalledTimes(2);
		expect(focus.mock.calls[1]).toEqual([]);
		expect(document.activeElement).toBe(control());
	});
});
