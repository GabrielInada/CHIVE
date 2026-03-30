function createOption(value, label, selected = false) {
	const option = document.createElement('option');
	option.value = String(value);
	option.textContent = label;
	option.selected = selected;
	return option;
}

function createCheckboxList(listId, items, selectedValues, title) {
	const wrapper = document.createElement('div');
	wrapper.className = 'join-list-wrapper';

	const heading = document.createElement('div');
	heading.className = 'join-list-title';
	heading.textContent = title;
	wrapper.appendChild(heading);

	const list = document.createElement('div');
	list.className = 'join-list';
	list.id = listId;

	items.forEach(item => {
		const row = document.createElement('label');
		row.className = 'join-list-item';

		const checkbox = document.createElement('input');
		checkbox.type = 'checkbox';
		checkbox.value = item;
		checkbox.checked = selectedValues.has(item);

		const text = document.createElement('span');
		text.textContent = item;

		row.appendChild(checkbox);
		row.appendChild(text);
		list.appendChild(row);
	});

	wrapper.appendChild(list);
	return wrapper;
}

function getCheckedValues(container, selector) {
	return Array.from(container.querySelectorAll(selector))
		.filter(input => input.checked)
		.map(input => input.value);
}

function renderDatasetColumnPickers({
	container,
	prefix,
	dataset,
	translate,
	isLeft,
	defaultKey,
}) {
	container.innerHTML = '';

	if (!dataset) return;

	const columnNames = dataset.colunas.map(column => column.nome);
	const keySelection = new Set(defaultKey ? [defaultKey] : []);
	const allColumns = new Set(columnNames);

	const keysLabel = isLeft
		? translate('chive-join-left-keys')
		: translate('chive-join-right-keys');
	const columnsLabel = isLeft
		? translate('chive-join-left-columns')
		: translate('chive-join-right-columns');

	container.appendChild(
		createCheckboxList(`${prefix}-keys`, columnNames, keySelection, keysLabel)
	);
	container.appendChild(
		createCheckboxList(`${prefix}-columns`, columnNames, allColumns, columnsLabel)
	);
}

export function openJoinBuilderDialog({ datasets, translate }) {
	if (!Array.isArray(datasets) || datasets.length < 2) {
		window.alert(translate('chive-join-error-min-files'));
		return Promise.resolve(null);
	}

	return new Promise(resolve => {
		const overlay = document.createElement('div');
		overlay.className = 'join-overlay';

		const dialog = document.createElement('div');
		dialog.className = 'join-dialog';
		dialog.setAttribute('role', 'dialog');
		dialog.setAttribute('aria-modal', 'true');

		const title = document.createElement('h3');
		title.className = 'join-title';
		title.textContent = translate('chive-join-dialog-title');
		dialog.appendChild(title);

		const controls = document.createElement('div');
		controls.className = 'join-controls';

		const leftGroup = document.createElement('div');
		leftGroup.className = 'join-control';
		const leftLabel = document.createElement('label');
		leftLabel.textContent = translate('chive-join-left-file');
		leftLabel.htmlFor = 'join-left-file';
		const leftSelect = document.createElement('select');
		leftSelect.id = 'join-left-file';
		leftSelect.className = 'linhas-select';
		datasets.forEach((dataset, index) => {
			leftSelect.appendChild(createOption(index, dataset.nome, index === 0));
		});
		leftGroup.appendChild(leftLabel);
		leftGroup.appendChild(leftSelect);

		const rightGroup = document.createElement('div');
		rightGroup.className = 'join-control';
		const rightLabel = document.createElement('label');
		rightLabel.textContent = translate('chive-join-right-file');
		rightLabel.htmlFor = 'join-right-file';
		const rightSelect = document.createElement('select');
		rightSelect.id = 'join-right-file';
		rightSelect.className = 'linhas-select';
		datasets.forEach((dataset, index) => {
			rightSelect.appendChild(createOption(index, dataset.nome, index === 1));
		});
		rightGroup.appendChild(rightLabel);
		rightGroup.appendChild(rightSelect);

		const typeGroup = document.createElement('div');
		typeGroup.className = 'join-control';
		const typeLabel = document.createElement('label');
		typeLabel.textContent = translate('chive-join-type');
		typeLabel.htmlFor = 'join-type';
		const typeSelect = document.createElement('select');
		typeSelect.id = 'join-type';
		typeSelect.className = 'linhas-select';
		[
			{ value: 'inner', label: translate('chive-join-type-inner') },
			{ value: 'left', label: translate('chive-join-type-left') },
			{ value: 'right', label: translate('chive-join-type-right') },
			{ value: 'full', label: translate('chive-join-type-full') },
		].forEach(item => typeSelect.appendChild(createOption(item.value, item.label, item.value === 'inner')));
		typeGroup.appendChild(typeLabel);
		typeGroup.appendChild(typeSelect);

		controls.appendChild(leftGroup);
		controls.appendChild(rightGroup);
		controls.appendChild(typeGroup);
		dialog.appendChild(controls);

		const columnsGrid = document.createElement('div');
		columnsGrid.className = 'join-columns-grid';
		const leftColumnsContainer = document.createElement('div');
		leftColumnsContainer.className = 'join-column-panel';
		const rightColumnsContainer = document.createElement('div');
		rightColumnsContainer.className = 'join-column-panel';
		columnsGrid.appendChild(leftColumnsContainer);
		columnsGrid.appendChild(rightColumnsContainer);
		dialog.appendChild(columnsGrid);

		const footer = document.createElement('div');
		footer.className = 'join-footer';
		const cancelButton = document.createElement('button');
		cancelButton.type = 'button';
		cancelButton.className = 'btn-secundario';
		cancelButton.textContent = translate('chive-join-cancel');
		const createButton = document.createElement('button');
		createButton.type = 'button';
		createButton.className = 'btn-primario';
		createButton.textContent = translate('chive-join-create');
		footer.appendChild(cancelButton);
		footer.appendChild(createButton);
		dialog.appendChild(footer);

		overlay.appendChild(dialog);
		document.body.appendChild(overlay);

		const onEscape = event => {
			if (event.key !== 'Escape') return;
			closeDialog(null);
		};

		const closeDialog = result => {
			document.removeEventListener('keydown', onEscape);
			overlay.remove();
			resolve(result);
		};

		const refreshColumnPanels = () => {
			const leftDataset = datasets[Number(leftSelect.value)];
			const rightDataset = datasets[Number(rightSelect.value)];
			const leftDefaultKey = leftDataset?.colunas?.[0]?.nome || null;
			const rightDefaultKey = rightDataset?.colunas?.[0]?.nome || null;
			renderDatasetColumnPickers({
				container: leftColumnsContainer,
				prefix: 'join-left',
				dataset: leftDataset,
				translate,
				isLeft: true,
				defaultKey: leftDefaultKey,
			});
			renderDatasetColumnPickers({
				container: rightColumnsContainer,
				prefix: 'join-right',
				dataset: rightDataset,
				translate,
				isLeft: false,
				defaultKey: rightDefaultKey,
			});
		};

		leftSelect.addEventListener('change', refreshColumnPanels);
		rightSelect.addEventListener('change', refreshColumnPanels);
		cancelButton.addEventListener('click', () => closeDialog(null));

		overlay.addEventListener('click', event => {
			if (event.target === overlay) closeDialog(null);
		});

		document.addEventListener('keydown', onEscape);

		createButton.addEventListener('click', () => {
			const leftIndex = Number(leftSelect.value);
			const rightIndex = Number(rightSelect.value);
			if (leftIndex === rightIndex) {
				window.alert(translate('chive-join-error-select-different-files'));
				return;
			}

			const leftKeys = getCheckedValues(leftColumnsContainer, '#join-left-keys input[type="checkbox"]');
			const rightKeys = getCheckedValues(rightColumnsContainer, '#join-right-keys input[type="checkbox"]');
			if (leftKeys.length === 0 || rightKeys.length === 0) {
				window.alert(translate('chive-join-error-keys-required'));
				return;
			}
			if (leftKeys.length !== rightKeys.length) {
				window.alert(translate('chive-join-error-key-count-mismatch'));
				return;
			}

			const leftColumns = getCheckedValues(leftColumnsContainer, '#join-left-columns input[type="checkbox"]');
			const rightColumns = getCheckedValues(rightColumnsContainer, '#join-right-columns input[type="checkbox"]');
			if ((leftColumns.length + rightColumns.length) === 0) {
				window.alert(translate('chive-join-error-columns-required'));
				return;
			}

			closeDialog({
				leftIndex,
				rightIndex,
				joinType: typeSelect.value,
				leftKeys,
				rightKeys,
				leftColumns,
				rightColumns,
			});
		});

		refreshColumnPanels();
	});
}
