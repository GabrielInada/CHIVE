/**
 * Sample datasets picker dialog. Modal grid of bundled sample dataset cards;
 * resolves with the chosen `SampleDatasetCatalogEntry` or `null` on cancel.
 *
 * @typedef {import('../../../types.js').SampleDatasetCatalogEntry} SampleDatasetCatalogEntry
 */

import { SAMPLE_DATASET_CATALOG } from '../../../data/sampleDatasetCatalog.js';
import { showNativeModal } from '../../../ui/nativeDialog.js';

/**
 * Build one sample dataset card: name, description, row/column counts, optional
 * source attribution + link.
 *
 * @private
 */
function buildSampleDatasetCard(entry, translate) {
	const card = document.createElement('button');
	card.type = 'button';
	card.className = 'picker-card';
	card.dataset.sampleDatasetId = entry.id;

	const name = document.createElement('div');
	name.className = 'picker-card-name';
	name.textContent = translate(entry.nameKey);
	card.appendChild(name);

	const desc = document.createElement('div');
	desc.className = 'picker-card-desc';
	desc.textContent = translate(entry.descKey);
	card.appendChild(desc);

	const meta = document.createElement('div');
	meta.className = 'sample-dataset-card-meta';
	meta.textContent = translate('chive-sample-dataset-card-meta', entry.rowCount, entry.columnCount);
	card.appendChild(meta);

	if (entry.sourceLabel || entry.sourceUrl) {
		const source = document.createElement('div');
		source.className = 'sample-dataset-card-source';
		const label = translate('chive-sample-dataset-source-label');
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
				source.appendChild(document.createTextNode(', '));
			}
			const link = document.createElement('a');
			link.href = entry.sourceUrl;
			link.target = '_blank';
			link.rel = 'noopener noreferrer';
			link.className = 'sample-dataset-card-source-link';
			link.textContent = entry.sourceLinkLabel || entry.sourceUrl;
			source.appendChild(link);
		}

		card.appendChild(source);
	}

	return card;
}

/**
 * Open the sample datasets picker dialog. Returns a Promise that
 * resolves with the chosen catalog entry or `null` on cancel /
 * Escape / backdrop click. The "Load" button is disabled until a card
 * is selected.
 *
 * @param {{ translate: (key: string, ...args: *) => string }} args
 * @returns {Promise<SampleDatasetCatalogEntry | null>}
 */
export function openSampleDatasetsDialog({ translate }) {
	return new Promise(resolve => {
		const dialog = document.createElement('dialog');
		dialog.className = 'app-dialog';
		dialog.setAttribute('aria-labelledby', 'sample-datasets-dialog-title');

		const surface = document.createElement('form');
		surface.method = 'dialog';
		surface.className = 'join-dialog sample-datasets-dialog';

		const title = document.createElement('h3');
		title.className = 'join-title';
		title.id = 'sample-datasets-dialog-title';
		title.textContent = translate('chive-sample-dataset-dialog-title');
		surface.appendChild(title);

		const grid = document.createElement('div');
		grid.className = 'sample-dataset-cards-grid';
		surface.appendChild(grid);

		const footer = document.createElement('div');
		footer.className = 'join-footer';
		const cancelButton = document.createElement('button');
		cancelButton.type = 'button';
		cancelButton.className = 'btn-secondary';
		cancelButton.textContent = translate('chive-sample-dataset-cancel');

		const loadButton = document.createElement('button');
		loadButton.type = 'button';
		loadButton.className = 'btn-primary';
		loadButton.textContent = translate('chive-sample-dataset-load');
		loadButton.disabled = true;

		footer.appendChild(cancelButton);
		footer.appendChild(loadButton);
		surface.appendChild(footer);
		dialog.appendChild(surface);

		let selectedId = null;
		let settled = false;

		const closeDialog = result => {
			if (settled) return;
			settled = true;
			lifecycle.close();
			resolve(result);
		};

		SAMPLE_DATASET_CATALOG.forEach(entry => {
			const card = buildSampleDatasetCard(entry, translate);
			card.addEventListener('click', () => {
				selectedId = entry.id;
				Array.from(grid.querySelectorAll('.picker-card')).forEach(node => {
					node.classList.toggle('selected', node.dataset.sampleDatasetId === selectedId);
				});
				loadButton.disabled = false;
			});
			grid.appendChild(card);
		});

		cancelButton.addEventListener('click', () => closeDialog(null));
		loadButton.addEventListener('click', () => {
			const selected = SAMPLE_DATASET_CATALOG.find(item => item.id === selectedId) || null;
			closeDialog(selected);
		});

		const lifecycle = showNativeModal(dialog, {
			onDismiss: () => closeDialog(null),
		});
	});
}
