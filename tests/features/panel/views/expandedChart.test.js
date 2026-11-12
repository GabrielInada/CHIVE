// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openExpandedChart } from '../../../../src/features/panel/views/expandedChart.js';
import { mountSlot, teardownSlot } from '../../../../src/features/panel/slots/lifecycle.js';

vi.mock('../../../../src/features/panel/slots/lifecycle.js', () => ({
	mountSlot: vi.fn(),
	teardownSlot: vi.fn(),
}));

describe('expanded chart viewing', () => {
	beforeEach(() => {
		document.body.innerHTML = '<button id="expand">Expand</button><div class="panel-slot">Original chart</div>';
		document.getElementById('expand').focus();
		vi.stubGlobal('scrollTo', vi.fn());
		vi.clearAllMocks();
	});
	afterEach(() => vi.unstubAllGlobals());

	it.each(['button', 'escape', 'backdrop'])('returns to the dashboard and releases the chart when closed by %s', method => {
		const config = Object.freeze({ customTitle: 'Saved chart title', chartHeight: 400 });
		const snapshot = Object.freeze({ id: 4, type: 'line', name: 'Saved line', config });
		openExpandedChart(snapshot);
		const dialog = document.querySelector('dialog');
		const container = dialog.querySelector('.panel-chart-container');
		expect(dialog.open).toBe(true);
		expect(dialog.querySelector('h2').textContent).toBe('Saved chart title');
		expect(document.querySelector('.panel-slot').textContent).toBe('Original chart');
		expect(snapshot.config).toBe(config);
		expect(mountSlot.mock.calls[0][1].config.customTitle).toBe('');
		if (method === 'button') dialog.querySelector('button').click();
		else if (method === 'escape') dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
		else dialog.click();
		expect(document.querySelector('dialog')).toBeNull();
		expect(teardownSlot).toHaveBeenCalledExactlyOnceWith(container);
		expect(document.activeElement.id).toBe('expand');
		expect(window.scrollTo).toHaveBeenCalledWith({ left: 0, top: 0, behavior: 'instant' });
	});

	it('returns to the same chart after rotation reflows the dashboard', () => {
		const trigger = document.getElementById('expand');
		trigger.scrollIntoView = vi.fn();
		vi.stubGlobal('innerWidth', 390);
		openExpandedChart({ id: 4, type: 'line', name: 'Saved line', config: {} });
		vi.stubGlobal('innerWidth', 844);
		document.querySelector('.chart-expanded-close').click();
		expect(trigger.scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
		expect(document.activeElement).toBe(trigger);
	});
});
