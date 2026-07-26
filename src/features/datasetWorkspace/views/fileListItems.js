/**
 * Render the dataset file-list items with case-insensitive name filtering and
 * a visible-count cap. Returns counts so the caller can render pagination
 * ("Show more / show less") above or below the items.
 *
 * @param {Object} args
 * @param {HTMLElement} args.list
 * @param {Array<{ name: string, rows: Array<*>, columns: Array<*>, sizeLabel: string }>} args.datasets
 * @param {number} args.activeIndex - Active dataset index; `-1` if none.
 * @param {(key: string, ...args: *) => string} args.translate
 * @param {() => string} args.getLocale
 * @param {(index: number) => void} args.onSelect
 * @param {(index: number) => void} args.onRemove
 * @param {string} [args.filter=''] - Name substring filter; case-insensitive.
 * @param {number} [args.visibleLimit=15] - Cap on rendered items.
 * @returns {{ total: number, filtered: number, rendered: number, hasMore: boolean }}
 */
export function renderFileListDOM({
	list,
	datasets,
	activeIndex,
	translate,
	getLocale,
	onSelect,
	onRemove,
	filter = '',
	visibleLimit = 15,
}) {
	list.replaceChildren();

	const normalizedFilter = String(filter || '').trim().toLowerCase();
	const indexedDatasets = datasets.map((dataset, index) => ({ dataset, index }));
	const filteredDatasets = normalizedFilter
		? indexedDatasets.filter(({ dataset }) => String(dataset.name || '').toLowerCase().includes(normalizedFilter))
		: indexedDatasets;
	const safeLimit = Number.isFinite(visibleLimit) && visibleLimit > 0 ? Math.floor(visibleLimit) : 15;
	const visibleDatasets = filteredDatasets.slice(0, safeLimit);

	visibleDatasets.forEach(({ dataset, index }) => {
		const item = document.createElement('div');
		item.className = `file-item ${index === activeIndex ? 'active' : ''}`;
		item.dataset.idx = String(index);

		const selectButton = document.createElement('button');
		selectButton.className = 'file-item-button';
		selectButton.type = 'button';
		selectButton.dataset.fileAction = 'select';
		selectButton.dataset.idx = String(index);

		const name = document.createElement('span');
		name.className = 'file-item-name';
		name.title = dataset.name;
		name.textContent = dataset.name;

		const meta = document.createElement('span');
		meta.className = 'file-item-meta';
		meta.textContent = translate(
			'chive-file-meta',
			dataset.rows.length.toLocaleString(getLocale()),
			dataset.columns.length,
			dataset.sizeLabel
		);

		const removeButton = document.createElement('button');
		removeButton.className = 'file-item-remove';
		removeButton.type = 'button';
		removeButton.dataset.fileAction = 'remove';
		removeButton.dataset.idx = String(index);
		removeButton.setAttribute('aria-label', translate('chive-remove-file', dataset.name));
		removeButton.textContent = '×';

		selectButton.appendChild(name);
		selectButton.appendChild(meta);
		item.appendChild(selectButton);
		item.appendChild(removeButton);
		list.appendChild(item);
	});

	if (filteredDatasets.length === 0) {
		const empty = document.createElement('div');
		empty.className = 'file-list-empty';
		empty.textContent = translate('chive-files-no-match');
		list.appendChild(empty);
	}

	list.onclick = event => {
		const target = event.target.closest('[data-file-action]');
		if (!target) return;

		const index = Number(target.dataset.idx);
		if (Number.isNaN(index)) return;

		if (target.dataset.fileAction === 'remove') {
			onRemove(index);
			return;
		}
		onSelect(index);
	};

	return {
		total: datasets.length,
		filtered: filteredDatasets.length,
		rendered: visibleDatasets.length,
		hasMore: filteredDatasets.length > visibleDatasets.length,
	};
}
