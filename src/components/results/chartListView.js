import {
	PREVIEW_BAR_SVG,
	PREVIEW_BUBBLE_SVG,
	PREVIEW_NETWORK_SVG,
	PREVIEW_PIE_SVG,
	PREVIEW_SCATTER_SVG,
	PREVIEW_TREEMAP_SVG,
} from '../../modules/chart-controls/previews.js';

export const CHART_TYPES = ['bar', 'scatter', 'pie', 'bubble', 'network', 'treemap'];

const PREVIEW_SVGS = {
	bar: PREVIEW_BAR_SVG,
	scatter: PREVIEW_SCATTER_SVG,
	pie: PREVIEW_PIE_SVG,
	bubble: PREVIEW_BUBBLE_SVG,
	network: PREVIEW_NETWORK_SVG,
	treemap: PREVIEW_TREEMAP_SVG,
};

const CATEGORY_KEYS = {
	bar: 'chive-viz-category-comparison',
	scatter: 'chive-viz-category-relationship',
	pie: 'chive-viz-category-composition',
	bubble: 'chive-viz-category-hierarchy',
	network: 'chive-viz-category-relationship',
	treemap: 'chive-viz-category-composition',
};

export function renderChartListDOM({
	container,
	activeChartType,
	translate,
	onSelect,
}) {
	container.innerHTML = '';

	CHART_TYPES.forEach(type => {
		const row = document.createElement('button');
		const isActive = type === activeChartType;
		row.className = `viz-chart-row${isActive ? ' ativo' : ''}`;
		row.type = 'button';
		row.dataset.chartType = type;

		const preview = document.createElement('span');
		preview.className = 'viz-chart-row-preview';
		preview.innerHTML = PREVIEW_SVGS[type];

		const name = document.createElement('span');
		name.className = 'viz-chart-row-name';
		name.textContent = translate(`chive-chart-toggle-${type}`);

		const tag = document.createElement('span');
		tag.className = 'viz-chart-row-category';
		tag.textContent = translate(CATEGORY_KEYS[type]);

		row.appendChild(preview);
		row.appendChild(name);
		row.appendChild(tag);
		container.appendChild(row);
	});

	container.onclick = event => {
		const row = event.target.closest('[data-chart-type]');
		if (!row || !container.contains(row)) return;
		const type = row.dataset.chartType;
		onSelect(type === activeChartType ? null : type);
	};
}
