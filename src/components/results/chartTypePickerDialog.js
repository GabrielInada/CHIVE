import { CHART_TYPES, PREVIEW_SVGS, CATEGORY_KEYS } from '../../modules/chart-controls/chartTypes.js';

function buildChartCard(type, translate, isActive) {
	const card = document.createElement('button');
	card.type = 'button';
	card.className = `preset-card chart-picker-card${isActive ? ' selecionado' : ''}`;
	card.dataset.chartType = type;

	const preview = document.createElement('span');
	preview.className = 'chart-picker-card-preview';
	// innerHTML: static SVG markup from PREVIEW_SVGS; not user input.
	preview.innerHTML = PREVIEW_SVGS[type];
	card.appendChild(preview);

	const name = document.createElement('div');
	name.className = 'preset-card-nome';
	name.textContent = translate(`chive-chart-toggle-${type}`);
	card.appendChild(name);

	const tag = document.createElement('div');
	tag.className = 'chart-picker-card-category';
	tag.textContent = translate(CATEGORY_KEYS[type]);
	card.appendChild(tag);

	const desc = document.createElement('div');
	desc.className = 'preset-card-desc';
	desc.textContent = translate(`chive-viz-${type}-desc`);
	card.appendChild(desc);

	return card;
}

export function openChartTypePickerDialog({ activeChartType = null, translate }) {
	return new Promise(resolve => {
		const overlay = document.createElement('div');
		overlay.className = 'join-overlay';

		const dialog = document.createElement('div');
		dialog.className = 'join-dialog chart-picker-dialog';
		dialog.setAttribute('role', 'dialog');
		dialog.setAttribute('aria-modal', 'true');

		const title = document.createElement('h3');
		title.className = 'join-title';
		title.textContent = translate('chive-chart-picker-dialog-title');
		dialog.appendChild(title);

		const grid = document.createElement('div');
		grid.className = 'chart-picker-grid';
		dialog.appendChild(grid);

		const footer = document.createElement('div');
		footer.className = 'join-footer';

		const clearButton = document.createElement('button');
		clearButton.type = 'button';
		clearButton.className = 'btn-secundario';
		clearButton.textContent = translate('chive-chart-picker-clear');

		const cancelButton = document.createElement('button');
		cancelButton.type = 'button';
		cancelButton.className = 'btn-secundario';
		cancelButton.textContent = translate('chive-chart-picker-cancel');

		footer.appendChild(clearButton);
		footer.appendChild(cancelButton);
		dialog.appendChild(footer);

		overlay.appendChild(dialog);
		document.body.appendChild(overlay);

		const closeDialog = result => {
			document.removeEventListener('keydown', onEscape);
			overlay.remove();
			resolve(result);
		};

		const onEscape = event => {
			if (event.key !== 'Escape') return;
			closeDialog(null);
		};

		CHART_TYPES.forEach(type => {
			const card = buildChartCard(type, translate, type === activeChartType);
			card.addEventListener('click', () => closeDialog({ chartType: type }));
			grid.appendChild(card);
		});

		clearButton.addEventListener('click', () => closeDialog({ chartType: null }));
		cancelButton.addEventListener('click', () => closeDialog(null));

		overlay.addEventListener('click', event => {
			if (event.target === overlay) closeDialog(null);
		});

		document.addEventListener('keydown', onEscape);
	});
}
