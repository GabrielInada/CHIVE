/**
 * Column-controls strip view. Renders the action buttons (All / Clear /
 * Only numeric / Only text) plus the per-column checkboxes.
 *
 * The action buttons swap the entire selection; the per-column checkboxes
 * emit the resolved set every time one is toggled.
 *
 * @param {Object} args
 * @param {HTMLElement} args.actionsContainer - Container for the action buttons.
 * @param {HTMLElement} args.columnsList - Container for the per-column checkboxes.
 * @param {Array<{ name: string, type: string }>} args.columns
 * @param {Set<string>} args.selectedNames - Names of currently selected columns.
 * @param {'all' | 'numeric' | 'text' | null} args.activeFilter - Drives the "active" highlight on the action buttons.
 * @param {string[]} args.columnNames - All column names.
 * @param {string[]} args.numericNames
 * @param {string[]} args.textNames
 * @param {(key: string, ...args: *) => string} args.translate
 * @param {(type: string) => string} args.translateType
 * @param {(names: string[]) => void} args.onColumnSelectionChange - Fired with the new selection list.
 * @param {(name: string) => void} [args.onColumnFormat] - Opens the currency editor.
 * @returns {void}
 */
export function renderColumnControlsDOM({
	actionsContainer,
	columnsList,
	columns,
	selectedNames,
	activeFilter,
	columnNames,
	numericNames,
	textNames,
	translate,
	translateType,
	onColumnSelectionChange,
	onColumnFormat,
}) {
	actionsContainer.replaceChildren();

	const createActionButton = (action, text, active = false) => {
		const button = document.createElement('button');
		button.className = `column-action${active ? ' active' : ''}`;
		button.type = 'button';
		button.dataset.columnAction = action;
		button.textContent = text;
		return button;
	};

	actionsContainer.appendChild(createActionButton('all', translate('chive-action-select-all'), activeFilter === 'all'));
	actionsContainer.appendChild(createActionButton('clear', translate('chive-action-clear')));
	actionsContainer.appendChild(createActionButton('numeric', translate('chive-action-only-numeric'), activeFilter === 'numeric'));
	actionsContainer.appendChild(createActionButton('text', translate('chive-action-only-text'), activeFilter === 'text'));

	actionsContainer.onclick = event => {
		const target = event.target.closest('[data-column-action]');
		if (!target || !onColumnSelectionChange) return;
		const action = target.dataset.columnAction;
		if (action === 'all') {
			onColumnSelectionChange(columnNames);
			return;
		}
		if (action === 'clear') {
			onColumnSelectionChange([]);
			return;
		}
		if (action === 'numeric') {
			onColumnSelectionChange(numericNames);
			return;
		}
		if (action === 'text') {
			onColumnSelectionChange(textNames);
		}
	};

	columnsList.replaceChildren();
	columns.forEach(({ name, type, currency, currencyIssue }) => {
		const item = document.createElement('div');
		item.className = 'column-item';
		const label = document.createElement('label');
		label.className = 'column-selection';
		label.title = name;

		const checkbox = document.createElement('input');
		checkbox.className = 'column-checkbox';
		checkbox.type = 'checkbox';
		checkbox.dataset.column = name;
		checkbox.checked = selectedNames.has(name);

		const nameSpan = document.createElement('span');
		nameSpan.className = 'column-name';
		nameSpan.textContent = name;

		const editable = onColumnFormat && type !== 'date';
		const typeSpan = document.createElement(editable ? 'button' : 'span');
		typeSpan.className = `type-tag ${type}`;
		typeSpan.textContent = currency ? translate('chive-type-currency', currency)
			: currencyIssue ? translate('chive-currency-unresolved') : translateType(type);
		if (editable) {
			typeSpan.type = 'button';
			typeSpan.classList.add('column-format');
			typeSpan.setAttribute('aria-label', translate('chive-currency-edit', name, typeSpan.textContent));
			typeSpan.title = translate('chive-currency-title', name);
			typeSpan.addEventListener('click', () => onColumnFormat(name));
		}

		label.appendChild(checkbox);
		label.appendChild(nameSpan);
		item.append(label, typeSpan);
		columnsList.appendChild(item);
	});

	columnsList.onchange = event => {
		const target = event.target;
		if (!(target instanceof HTMLInputElement) || target.type !== 'checkbox' || !onColumnSelectionChange) return;

		const selected = Array.from(columnsList.querySelectorAll('.column-checkbox:checked'))
			.map(checkbox => checkbox.dataset.column)
			.filter(Boolean);
		onColumnSelectionChange(selected);
	};
}
