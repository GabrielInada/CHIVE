// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	updateActiveDatasetConfig: vi.fn(),
}));

vi.mock('../../../src/state/appState.js', () => ({
	updateActiveDatasetConfig: mocks.updateActiveDatasetConfig,
}));

import { setupSidebarNavigationButtons } from '../../../src/app/bindings/sidebarNavigation.js';

describe('eventHandlers', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		document.body.innerHTML = `
			<button id="btn-advance" type="button"></button>
			<button id="btn-edit-columns" type="button"></button>
		`;
	});

	it('delegates durable tab navigation to the state facade', () => {
		setupSidebarNavigationButtons();

		// Navigation no longer reads the active dataset; the no-dataset guard lives
		// in the facade (updateActiveDatasetConfig no-ops without an active
		// dataset), so this pins the delegation only.
		mocks.updateActiveDatasetConfig.mockClear();
		document.getElementById('btn-advance').click();
		expect(mocks.updateActiveDatasetConfig).toHaveBeenCalledWith({ activeTab: 'charts' });

		mocks.updateActiveDatasetConfig.mockClear();
		document.getElementById('btn-edit-columns').click();
		expect(mocks.updateActiveDatasetConfig).toHaveBeenCalledWith({ activeTab: 'preview' });
	});
});
