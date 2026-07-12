// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Real-bus rendering test for panelController.
 *
 * Unlike panelController.facade.test.js / panelController.edges.test.js (which mock
 * appState at module scope), this file uses the REAL appState + state bus and
 * mocks ONLY the panel renderers. That is the only way to prove the production
 * path: a facade write emits a typed event, the controller's subscription fires,
 * and the renderers run exactly once.
 */
const renderMocks = vi.hoisted(() => ({
	renderSidebarPanel: vi.fn(),
	renderCanvasPanel: vi.fn(),
	fillLayoutSelect: vi.fn(),
}));
vi.mock('../../../src/features/panel/views/panelView.js', () => renderMocks);

import {
	addChartSnapshot,
	removeChartSnapshot,
	clearPanel,
	replaceAllState,
} from '../../../src/modules/state/appState.js';
import {
	initPanelController,
	_resetPanelControllerForTesting,
} from '../../../src/features/panel/panelController.js';

function resetPanelState() {
	// replaceAllState only touches the slices it is given; pass an explicit panel
	// slice (replaceAllState({}) would reset nothing).
	replaceAllState({ panel: { charts: [], slots: {}, blocks: [], layout: 'template-2col' } });
}

describe('panelController real-bus rendering', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Reset state BEFORE wiring subscriptions so the reset's emit has no listener.
		resetPanelState();
		initPanelController();
	});

	afterEach(() => {
		// Detach in afterEach so a failed assertion still cleans up and cannot leak
		// subscriptions into the next case.
		_resetPanelControllerForTesting();
	});

	it('renders sidebar + canvas once when a chart is added via the facade', () => {
		addChartSnapshot({ name: 'c', type: 'bar', config: {}, dataSnapshot: [], columnsSnapshot: [] });

		expect(renderMocks.renderSidebarPanel).toHaveBeenCalledTimes(1);
		expect(renderMocks.renderCanvasPanel).toHaveBeenCalledTimes(1);
	});

	it('renders sidebar + canvas once when a chart is removed via the facade', () => {
		const chartId = addChartSnapshot({ name: 'c', type: 'bar', config: {}, dataSnapshot: [], columnsSnapshot: [] });
		// Clear the render spies after seeding so the add does not count toward the
		// remove assertion.
		vi.clearAllMocks();

		removeChartSnapshot(chartId);

		expect(renderMocks.renderSidebarPanel).toHaveBeenCalledTimes(1);
		expect(renderMocks.renderCanvasPanel).toHaveBeenCalledTimes(1);
	});

	it('renders sidebar + canvas + selector once when the panel is cleared via the facade', () => {
		clearPanel();

		expect(renderMocks.renderSidebarPanel).toHaveBeenCalledTimes(1);
		expect(renderMocks.renderCanvasPanel).toHaveBeenCalledTimes(1);
		expect(renderMocks.fillLayoutSelect).toHaveBeenCalledTimes(1);
	});
});
