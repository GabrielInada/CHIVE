/**
 * CHIVE panel DOM builders.
 *
 * Stateless factories that assemble panel-block DOM elements with their
 * listeners pre-wired. The caller passes click/change handlers in via the
 * options bag; this module owns the markup only.
 *
 * Note: there is also a `createPanelBlock` in `blockStateHelpers.js` —
 * that builds the state-shape object that lives in `appState`. This file
 * is DOM-only.
 */

/**
 * Build a block header row with title and up/down/remove buttons. Up is
 * disabled on the first block, down on the last, and remove when only
 * one block exists.
 *
 * @param {Object} params
 * @param {string} params.blockId
 * @param {number} params.index - Position in the block stack (0-based).
 * @param {number} params.totalBlocks
 * @param {() => void} params.onMoveUp
 * @param {() => void} params.onMoveDown
 * @param {() => void} params.onRemove
 * @returns {HTMLElement}
 */
export function createBlockHeader({ blockId, index, totalBlocks, onMoveUp, onMoveDown, onRemove }) {
	const header = document.createElement('div');
	header.className = 'panel-block-header';

	const title = document.createElement('span');
	title.className = 'panel-block-title';
	title.textContent = `Block ${index + 1}`;

	const actions = document.createElement('div');
	actions.className = 'panel-block-actions';

	const upBtn = document.createElement('button');
	upBtn.type = 'button';
	upBtn.className = 'panel-block-btn';
	upBtn.dataset.panelBlockUp = blockId;
	upBtn.textContent = '↑';
	upBtn.disabled = index === 0;
	upBtn.addEventListener('click', onMoveUp);

	const downBtn = document.createElement('button');
	downBtn.type = 'button';
	downBtn.className = 'panel-block-btn';
	downBtn.dataset.panelBlockDown = blockId;
	downBtn.textContent = '↓';
	downBtn.disabled = index === totalBlocks - 1;
	downBtn.addEventListener('click', onMoveDown);

	const removeBtn = document.createElement('button');
	removeBtn.type = 'button';
	removeBtn.className = 'panel-block-btn panel-block-btn-danger';
	removeBtn.dataset.panelBlockRemove = blockId;
	removeBtn.textContent = '×';
	removeBtn.disabled = totalBlocks <= 1;
	removeBtn.addEventListener('click', onRemove);

	actions.appendChild(upBtn);
	actions.appendChild(downBtn);
	actions.appendChild(removeBtn);
	header.appendChild(title);
	header.appendChild(actions);

	return header;
}

/**
 * Build a `<select>` for switching a block's layout template. Pre-selects
 * the current `templateId`. The change handler fires the `change` DOM
 * event payload — read `e.target.value` to get the new template id.
 *
 * @param {Object} params
 * @param {string} params.blockId
 * @param {string} params.templateId - Initial selection.
 * @param {Object<string, { labelKey: string }>} params.layouts
 * @param {(key: string) => string} params.translate
 * @param {(event: Event) => void} params.onTemplateChange
 * @returns {HTMLSelectElement}
 */
export function createBlockTemplateSelect({ blockId, templateId, layouts, translate, onTemplateChange }) {
	const templateSelect = document.createElement('select');
	templateSelect.className = 'panel-block-template';
	templateSelect.dataset.panelBlockTemplate = blockId;

	Object.entries(layouts).forEach(([id, config]) => {
		const option = document.createElement('option');
		option.value = id;
		option.textContent = translate(config.labelKey);
		option.selected = id === templateId;
		templateSelect.appendChild(option);
	});

	templateSelect.addEventListener('change', onTemplateChange);
	return templateSelect;
}

/**
 * Build the "add block" row at the bottom of the panel: a template
 * picker `<select>` and an "add" button. The button passes the picker's
 * current value to the handler; `'layout-2col'` is used as a fallback
 * when the picker has no value.
 *
 * @param {Object} params
 * @param {Object<string, { labelKey: string }>} params.layouts
 * @param {(key: string) => string} params.translate
 * @param {(templateId: string) => void} params.onAddBlock
 * @returns {HTMLElement}
 */
export function createAddBlockControls({ layouts, translate, onAddBlock }) {
	const addBlockButton = document.createElement('button');
	const addTemplateSelect = document.createElement('select');
	addTemplateSelect.className = 'panel-add-template-select';
	addTemplateSelect.dataset.panelAddTemplate = '1';
	addTemplateSelect.setAttribute('aria-label', translate('chive-panel-layout-label'));
	const selectedTemplate = 'layout-2col';

	Object.entries(layouts).forEach(([id, config]) => {
		const option = document.createElement('option');
		option.value = id;
		option.textContent = translate(config.labelKey);
		option.selected = id === selectedTemplate;
		addTemplateSelect.appendChild(option);
	});

	addBlockButton.type = 'button';
	addBlockButton.className = 'btn-primary panel-add-block-btn';
	addBlockButton.dataset.panelAddBlock = '1';
	addBlockButton.textContent = translate('chive-panel-add-block');
	addBlockButton.addEventListener('click', () => {
		onAddBlock(addTemplateSelect.value || 'layout-2col');
	});

	const addControls = document.createElement('div');
	addControls.className = 'panel-add-controls';
	addControls.appendChild(addTemplateSelect);
	addControls.appendChild(addBlockButton);

	return addControls;
}

/**
 * Build the border-toggle + color-picker row for a single block. The
 * color picker is disabled when the toggle is off. `onPreviewColor`
 * fires on every input change (intended for cheap CSS-variable updates);
 * `onChangeColor` fires only on the `change` event (intended for state
 * writes that should land once, not on every drag tick).
 *
 * @param {Object} params
 * @param {string} params.blockId
 * @param {boolean} params.borderEnabled
 * @param {string} params.borderColor - Initial hex color (may be invalid; sanitized via `normalizeHexColor`).
 * @param {(key: string) => string} params.translate
 * @param {(color: string, fallback?: string) => string} params.normalizeHexColor
 * @param {(enabled: boolean) => void} params.onToggleBorder
 * @param {(color: string) => void} params.onPreviewColor
 * @param {(color: string) => void} params.onChangeColor
 * @returns {HTMLElement}
 */
export function createBlockBorderControls({
	blockId,
	borderEnabled,
	borderColor,
	translate,
	normalizeHexColor,
	onToggleBorder,
	onPreviewColor,
	onChangeColor,
}) {
	const borderControls = document.createElement('div');
	borderControls.className = 'panel-block-border-controls';

	const borderToggleLabel = document.createElement('label');
	borderToggleLabel.className = 'panel-borders-toggle';
	borderToggleLabel.htmlFor = `toggle-panel-slot-borders-${blockId}`;

	const borderToggle = document.createElement('input');
	borderToggle.type = 'checkbox';
	borderToggle.id = `toggle-panel-slot-borders-${blockId}`;
	borderToggle.checked = Boolean(borderEnabled);
	borderToggle.addEventListener('change', () => {
		onToggleBorder(borderToggle.checked);
	});

	const borderToggleText = document.createElement('span');
	borderToggleText.textContent = translate('chive-panel-borders-label');

	borderToggleLabel.appendChild(borderToggle);
	borderToggleLabel.appendChild(borderToggleText);

	const borderColorLabel = document.createElement('label');
	borderColorLabel.className = 'panel-borders-color';
	borderColorLabel.htmlFor = `input-panel-slot-border-color-${blockId}`;

	const borderColorText = document.createElement('span');
	borderColorText.textContent = translate('chive-panel-borders-color-label');

	const borderColorInput = document.createElement('input');
	borderColorInput.type = 'color';
	borderColorInput.id = `input-panel-slot-border-color-${blockId}`;
	borderColorInput.value = normalizeHexColor(borderColor);
	borderColorInput.disabled = !borderToggle.checked;
	borderColorInput.setAttribute('aria-label', translate('chive-panel-borders-color-label'));
	borderColorInput.addEventListener('input', () => {
		const previewColor = normalizeHexColor(borderColorInput.value, '#5d645d');
		onPreviewColor(previewColor);
	});

	borderColorInput.addEventListener('change', () => {
		onChangeColor(borderColorInput.value);
	});

	borderToggle.addEventListener('change', () => {
		borderColorInput.disabled = !borderToggle.checked;
	});

	borderColorLabel.appendChild(borderColorText);
	borderColorLabel.appendChild(borderColorInput);

	borderControls.appendChild(borderToggleLabel);
	borderControls.appendChild(borderColorLabel);

	return borderControls;
}

/**
 * Build a single slot's DOM element. The element is either a "filled"
 * slot (when `chart` is provided) — with a clear button, an empty `<div>`
 * placeholder for the chart's SVG, and drag-source listeners — or an
 * "empty" slot with a translated placeholder text.
 *
 * Drag-and-drop is wired only when `desktopDnd` is `true`. Mobile and
 * narrow layouts use a tap-to-pick UX (handled at the renderer level).
 *
 * @param {Object} params
 * @param {string} params.slotId
 * @param {string} params.blockId
 * @param {{ id: number | string } | null} params.chart - Snapshot or `null` for empty.
 * @param {boolean} params.borderEnabled
 * @param {string} params.borderColor
 * @param {boolean} params.desktopDnd
 * @param {(key: string) => string} params.translate
 * @param {() => void} params.onClearSlot
 * @param {(payload: { targetSlotId: string, targetBlockId: string, sourceSlotId: string, sourceBlockId: string, chartId: string }) => void} params.onDropData
 * @returns {HTMLElement}
 */
export function createPanelSlotElement({
	slotId,
	blockId,
	chart,
	borderEnabled,
	borderColor,
	desktopDnd,
	translate,
	onClearSlot,
	onDropData,
}) {
	const slot = document.createElement('div');
	slot.className = chart ? 'panel-slot' : 'panel-slot empty';
	slot.dataset.panelSlot = slotId;
	slot.dataset.panelBlockId = blockId;
	slot.dataset.panelBorderEnabled = borderEnabled ? '1' : '0';
	slot.dataset.panelBorderColor = borderColor;

	if (chart) {
		slot.dataset.panelChartId = chart.id;
		slot.draggable = desktopDnd;

		const clearBtn = document.createElement('button');
		clearBtn.type = 'button';
		clearBtn.className = 'panel-slot-clear';
		clearBtn.dataset.clearPanelSlot = `${blockId}:${slotId}`;
		clearBtn.setAttribute('aria-label', translate('chive-panel-clear-slot'));
		clearBtn.textContent = '×';
		clearBtn.addEventListener('click', onClearSlot);

		const svgDiv = document.createElement('div');
		svgDiv.className = 'panel-slot-svg';

		slot.appendChild(clearBtn);
		slot.appendChild(svgDiv);

		if (desktopDnd) {
			slot.addEventListener('dragstart', e => {
				e.dataTransfer.effectAllowed = 'move';
				e.dataTransfer.setData('text/panel-chart-id', String(chart.id));
				e.dataTransfer.setData('text/panel-slot-id', slotId);
				e.dataTransfer.setData('text/panel-block-id', blockId);
			});
		}
	} else {
		const placeholder = document.createElement('div');
		placeholder.className = 'panel-slot-placeholder';
		placeholder.textContent = translate('chive-panel-slot-empty');
		slot.appendChild(placeholder);
	}

	if (desktopDnd) {
		slot.addEventListener('dragover', e => {
			e.preventDefault();
			slot.classList.add('drag-over');
		});

		slot.addEventListener('dragleave', () => {
			slot.classList.remove('drag-over');
		});

		slot.addEventListener('drop', e => {
			e.preventDefault();
			slot.classList.remove('drag-over');
			onDropData({
				targetSlotId: slotId,
				targetBlockId: blockId,
				sourceSlotId: e.dataTransfer.getData('text/panel-slot-id'),
				sourceBlockId: e.dataTransfer.getData('text/panel-block-id'),
				chartId: e.dataTransfer.getData('text/panel-chart-id'),
			});
		});
	}

	return slot;
}
