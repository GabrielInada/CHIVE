// @vitest-environment jsdom

import { describe, it, expect, vi } from 'vitest';
import { createBlockBorderControls, createPanelSlotElement } from '../../../src/modules/panel/domBuilders.js';

describe('domBuilders createPanelSlotElement', () => {
	it('creates empty slot placeholder when chart is missing', () => {
		const slot = createPanelSlotElement({
			slotId: 'slot-1',
			blockId: 'block-1',
			chart: null,
			borderEnabled: false,
			borderColor: '#5d645d',
			desktopDnd: false,
			translate: key => key,
			onClearSlot: vi.fn(),
			onDropData: vi.fn(),
		});

		expect(slot.classList.contains('vazio')).toBe(true);
		expect(slot.querySelector('.painel-slot-placeholder')).toBeTruthy();
	});

	it('creates chart slot with clear button and svg preview', () => {
		const onClear = vi.fn();
		const slot = createPanelSlotElement({
			slotId: 'slot-1',
			blockId: 'block-1',
			chart: { id: 7, svgMarkup: '<svg></svg>' },
			borderEnabled: true,
			borderColor: '#112233',
			desktopDnd: false,
			translate: key => key,
			onClearSlot: onClear,
			onDropData: vi.fn(),
		});

		expect(slot.dataset.panelChartId).toBe('7');
		expect(slot.querySelector('.painel-slot-svg')).toBeTruthy();

		slot.querySelector('.painel-slot-limpar').click();
		expect(onClear).toHaveBeenCalled();
	});

	it('forwards drop payload when desktopDnd is enabled', () => {
		const onDropData = vi.fn();
		const slot = createPanelSlotElement({
			slotId: 'slot-2',
			blockId: 'block-9',
			chart: null,
			borderEnabled: false,
			borderColor: '#5d645d',
			desktopDnd: true,
			translate: key => key,
			onClearSlot: vi.fn(),
			onDropData,
		});

		const event = new Event('drop', { bubbles: true, cancelable: true });
		event.dataTransfer = {
			getData: key => {
				if (key === 'text/panel-slot-id') return 'slot-1';
				if (key === 'text/panel-block-id') return 'block-1';
				if (key === 'text/panel-chart-id') return '3';
				return '';
			},
		};

		slot.dispatchEvent(event);
		expect(onDropData).toHaveBeenCalledWith({
			targetSlotId: 'slot-2',
			targetBlockId: 'block-9',
			sourceSlotId: 'slot-1',
			sourceBlockId: 'block-1',
			chartId: '3',
		});
	});
});

describe('domBuilders createBlockBorderControls', () => {
	it('renders toggle and color input with expected ids/state', () => {
		const controls = createBlockBorderControls({
			blockId: 'block-1',
			borderEnabled: false,
			borderColor: '#112233',
			translate: key => key,
			normalizeHexColor: value => value,
			onToggleBorder: vi.fn(),
			onPreviewColor: vi.fn(),
			onChangeColor: vi.fn(),
		});

		const toggle = controls.querySelector('#toggle-panel-slot-borders-block-1');
		const color = controls.querySelector('#input-panel-slot-border-color-block-1');
		expect(toggle).toBeTruthy();
		expect(color).toBeTruthy();
		expect(toggle.checked).toBe(false);
		expect(color.disabled).toBe(true);
	});

	it('calls callbacks on toggle/input/change', () => {
		const onToggleBorder = vi.fn();
		const onPreviewColor = vi.fn();
		const onChangeColor = vi.fn();

		const controls = createBlockBorderControls({
			blockId: 'block-2',
			borderEnabled: true,
			borderColor: '#445566',
			translate: key => key,
			normalizeHexColor: value => value,
			onToggleBorder,
			onPreviewColor,
			onChangeColor,
		});

		const toggle = controls.querySelector('#toggle-panel-slot-borders-block-2');
		const color = controls.querySelector('#input-panel-slot-border-color-block-2');

		toggle.checked = false;
		toggle.dispatchEvent(new Event('change', { bubbles: true }));
		expect(onToggleBorder).toHaveBeenCalledWith(false);

		color.value = '#abcdef';
		color.dispatchEvent(new Event('input', { bubbles: true }));
		expect(onPreviewColor).toHaveBeenCalledWith('#abcdef');

		color.dispatchEvent(new Event('change', { bubbles: true }));
		expect(onChangeColor).toHaveBeenCalledWith('#abcdef');
	});
});
