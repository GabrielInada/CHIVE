export function createBlockHeader({ blockId, index, totalBlocks, onMoveUp, onMoveDown, onRemove }) {
	const header = document.createElement('div');
	header.className = 'painel-block-header';

	const title = document.createElement('span');
	title.className = 'painel-block-title';
	title.textContent = `Block ${index + 1}`;

	const actions = document.createElement('div');
	actions.className = 'painel-block-actions';

	const upBtn = document.createElement('button');
	upBtn.type = 'button';
	upBtn.className = 'painel-block-btn';
	upBtn.dataset.panelBlockUp = blockId;
	upBtn.textContent = '↑';
	upBtn.disabled = index === 0;
	upBtn.addEventListener('click', onMoveUp);

	const downBtn = document.createElement('button');
	downBtn.type = 'button';
	downBtn.className = 'painel-block-btn';
	downBtn.dataset.panelBlockDown = blockId;
	downBtn.textContent = '↓';
	downBtn.disabled = index === totalBlocks - 1;
	downBtn.addEventListener('click', onMoveDown);

	const removeBtn = document.createElement('button');
	removeBtn.type = 'button';
	removeBtn.className = 'painel-block-btn painel-block-btn-danger';
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

export function createBlockTemplateSelect({ blockId, templateId, layouts, translate, onTemplateChange }) {
	const templateSelect = document.createElement('select');
	templateSelect.className = 'painel-block-template';
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

export function createAddBlockControls({ layouts, translate, onAddBlock }) {
	const addBlockButton = document.createElement('button');
	const addTemplateSelect = document.createElement('select');
	addTemplateSelect.className = 'painel-add-template-select';
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
	addBlockButton.className = 'btn-primario painel-add-block-btn';
	addBlockButton.dataset.panelAddBlock = '1';
	addBlockButton.textContent = translate('chive-panel-add-block');
	addBlockButton.addEventListener('click', () => {
		onAddBlock(addTemplateSelect.value || 'layout-2col');
	});

	const addControls = document.createElement('div');
	addControls.className = 'painel-add-controls';
	addControls.appendChild(addTemplateSelect);
	addControls.appendChild(addBlockButton);

	return addControls;
}

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
	borderControls.className = 'painel-block-border-controls';

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
	slot.className = chart ? 'painel-slot' : 'painel-slot vazio';
	slot.dataset.panelSlot = slotId;
	slot.dataset.panelBlockId = blockId;
	slot.dataset.panelBorderEnabled = borderEnabled ? '1' : '0';
	slot.dataset.panelBorderColor = borderColor;

	if (chart) {
		slot.dataset.panelChartId = chart.id;
		slot.draggable = desktopDnd;

		const clearBtn = document.createElement('button');
		clearBtn.type = 'button';
		clearBtn.className = 'painel-slot-limpar';
		clearBtn.dataset.clearPanelSlot = `${blockId}:${slotId}`;
		clearBtn.setAttribute('aria-label', translate('chive-panel-clear-slot'));
		clearBtn.textContent = '×';
		clearBtn.addEventListener('click', onClearSlot);

		const svgDiv = document.createElement('div');
		svgDiv.className = 'painel-slot-svg';
		svgDiv.innerHTML = chart.svgMarkup;

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
		placeholder.className = 'painel-slot-placeholder';
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
