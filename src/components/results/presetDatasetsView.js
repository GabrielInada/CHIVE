import { PRESET_CATALOG } from '../../data/presetCatalog.js';

function buildPresetCard(entry, translate) {
	const card = document.createElement('button');
	card.type = 'button';
	card.className = 'preset-card';
	card.dataset.presetId = entry.id;

	const name = document.createElement('div');
	name.className = 'preset-card-nome';
	name.textContent = translate(entry.nameKey);
	card.appendChild(name);

	const desc = document.createElement('div');
	desc.className = 'preset-card-desc';
	desc.textContent = translate(entry.descKey);
	card.appendChild(desc);

	const meta = document.createElement('div');
	meta.className = 'preset-card-meta';
	meta.textContent = translate('chive-preset-card-meta', [entry.rows, entry.columns]);
	card.appendChild(meta);

	if (entry.sourceLabel || entry.sourceUrl) {
		const source = document.createElement('div');
		source.className = 'preset-card-source';
		const label = translate('chive-preset-source-label');
		const labelSpan = document.createElement('span');
		labelSpan.textContent = `${label} `;
		source.appendChild(labelSpan);

		if (entry.sourceLabel) {
			const sourceName = document.createElement('span');
			sourceName.textContent = entry.sourceLabel;
			source.appendChild(sourceName);
		}

		if (entry.sourceUrl) {
			if (entry.sourceLabel) {
				source.appendChild(document.createTextNode(' - '));
			}
			const link = document.createElement('a');
			link.href = entry.sourceUrl;
			link.target = '_blank';
			link.rel = 'noopener noreferrer';
			link.className = 'preset-card-source-link';
			link.textContent = entry.sourceLinkLabel || entry.sourceUrl;
			source.appendChild(link);
		}

		card.appendChild(source);
	}

	return card;
}

export function openPresetDatasetsDialog({ translate }) {
	return new Promise(resolve => {
		const overlay = document.createElement('div');
		overlay.className = 'join-overlay';

		const dialog = document.createElement('div');
		dialog.className = 'join-dialog preset-dialog';
		dialog.setAttribute('role', 'dialog');
		dialog.setAttribute('aria-modal', 'true');

		const title = document.createElement('h3');
		title.className = 'join-title';
		title.textContent = translate('chive-preset-dialog-title');
		dialog.appendChild(title);

		const grid = document.createElement('div');
		grid.className = 'preset-cards-grid';
		dialog.appendChild(grid);

		const footer = document.createElement('div');
		footer.className = 'join-footer';
		const cancelButton = document.createElement('button');
		cancelButton.type = 'button';
		cancelButton.className = 'btn-secundario';
		cancelButton.textContent = translate('chive-preset-cancel');

		const loadButton = document.createElement('button');
		loadButton.type = 'button';
		loadButton.className = 'btn-primario';
		loadButton.textContent = translate('chive-preset-load');
		loadButton.disabled = true;

		footer.appendChild(cancelButton);
		footer.appendChild(loadButton);
		dialog.appendChild(footer);

		overlay.appendChild(dialog);
		document.body.appendChild(overlay);

		let selectedId = null;

		const closeDialog = result => {
			document.removeEventListener('keydown', onEscape);
			overlay.remove();
			resolve(result);
		};

		const onEscape = event => {
			if (event.key !== 'Escape') return;
			closeDialog(null);
		};

		PRESET_CATALOG.forEach(entry => {
			const card = buildPresetCard(entry, translate);
			card.addEventListener('click', () => {
				selectedId = entry.id;
				Array.from(grid.querySelectorAll('.preset-card')).forEach(node => {
					node.classList.toggle('selecionado', node.dataset.presetId === selectedId);
				});
				loadButton.disabled = false;
			});
			grid.appendChild(card);
		});

		cancelButton.addEventListener('click', () => closeDialog(null));
		loadButton.addEventListener('click', () => {
			const selected = PRESET_CATALOG.find(item => item.id === selectedId) || null;
			closeDialog(selected);
		});

		overlay.addEventListener('click', event => {
			if (event.target === overlay) closeDialog(null);
		});

		document.addEventListener('keydown', onEscape);
	});
}
