import { hierarchy, pack, scaleOrdinal, select } from 'd3';
import { hideChartTooltip, moveChartTooltip, showChartTooltip } from './tooltip.js';
import { BUBBLE_CHART, CHART_COLOR_PALETTES, CHART_DIMENSIONS } from '../../config/charts.js';
import { formatNumber } from '../../utils/formatters.js';
import { ok, fail } from '../../utils/result.js';

function normalizeCategoryValue(value) {
	return value === null || value === undefined || value === '' ? '—' : String(value);
}

function getBubblePalette(colorScheme) {
	return CHART_COLOR_PALETTES[colorScheme] || CHART_COLOR_PALETTES.Tableau10;
}

export function renderBubbleChart(container, dados, colunaCategoria, opcoes = {}) {
	if (!container || !colunaCategoria) return fail();

	const measureMode = BUBBLE_CHART.measureModes.includes(opcoes.measureMode)
		? opcoes.measureMode
		: BUBBLE_CHART.defaultMeasureMode;
	const valueColumn = opcoes.valueColumn || null;
	const topN = Number.isFinite(Number(opcoes.topN)) ? Number(opcoes.topN) : BUBBLE_CHART.defaultTopN;
	const padding = Number.isFinite(Number(opcoes.padding))
		? Number(opcoes.padding)
		: BUBBLE_CHART.defaultPadding;
	const labelMode = BUBBLE_CHART.labelModes.includes(opcoes.labelMode)
		? opcoes.labelMode
		: BUBBLE_CHART.defaultLabelMode;
	const autoLabelMinRadius = Number.isFinite(Number(opcoes.autoLabelMinRadius))
		? Number(opcoes.autoLabelMinRadius)
		: BUBBLE_CHART.autoLabelMinRadius;
	const groupColumn = opcoes.groupColumn || null;
	const locale = opcoes.locale || undefined;
	const customTitle = String(opcoes.customTitle || '').trim().slice(0, 80);
	const chartHeight = Number.isFinite(Number(opcoes.chartHeight))
		? Math.max(400, Math.min(900, Number(opcoes.chartHeight)))
		: CHART_DIMENSIONS.bubble.height;
	const colorScheme = String(opcoes.colorScheme || '').trim() || 'Tableau10';
	const labels = {
		categoria: opcoes.labels?.categoria || 'Category',
		contagem: opcoes.labels?.contagem || 'Count',
		soma: opcoes.labels?.soma || 'Sum',
		media: opcoes.labels?.media || 'Mean',
		grupo: opcoes.labels?.grupo || 'Group',
	};

	const hasValueColumn = measureMode === 'count'
		? true
		: dados.some(linha => Object.prototype.hasOwnProperty.call(linha, valueColumn));

	if (measureMode !== 'count' && !valueColumn) {
		return fail('no-value-column');
	}

	const aggregated = new Map();
	const groupByCategory = new Map();

	if (measureMode === 'count') {
		dados.forEach(linha => {
			const category = normalizeCategoryValue(linha[colunaCategoria]);
			aggregated.set(category, (aggregated.get(category) || 0) + 1);
			if (groupColumn && !groupByCategory.has(category)) {
				groupByCategory.set(category, normalizeCategoryValue(linha[groupColumn]));
			}
		});
	} else {
		if (!hasValueColumn) return fail('no-value-column');
		const counter = new Map();
		dados.forEach(linha => {
			const category = normalizeCategoryValue(linha[colunaCategoria]);
			const rawValue = Number(linha[valueColumn]);
			if (!Number.isFinite(rawValue)) return;
			aggregated.set(category, (aggregated.get(category) || 0) + rawValue);
			counter.set(category, (counter.get(category) || 0) + 1);
			if (groupColumn && !groupByCategory.has(category)) {
				groupByCategory.set(category, normalizeCategoryValue(linha[groupColumn]));
			}
		});

		if (measureMode === 'mean') {
			for (const [category, sum] of aggregated.entries()) {
				aggregated.set(category, sum / (counter.get(category) || 1));
			}
		}
	}

	if ((measureMode === 'sum' || measureMode === 'mean') && aggregated.size === 0) {
		return fail('no-numeric');
	}

	let bubbles = Array.from(aggregated.entries()).map(([category, value]) => ({
		category,
		value,
		group: groupColumn ? (groupByCategory.get(category) || '—') : category,
	}));

	bubbles.sort((a, b) => b.value - a.value || String(a.category).localeCompare(String(b.category)));
	if (topN > 0) {
		bubbles = bubbles.slice(0, topN);
	}

	if (bubbles.length === 0) {
		return fail();
	}

	container.innerHTML = '';
	hideChartTooltip();

	const largura = Math.max(container.clientWidth || CHART_DIMENSIONS.bubble.width, 320);
	const altura = chartHeight;
	const margem = CHART_DIMENSIONS.bubble.margins;
	const titleOffset = customTitle ? 20 : 0;
	const larguraInterna = largura - margem.left - margem.right;
	const alturaInterna = altura - margem.top - margem.bottom - titleOffset;

	const svg = select(container)
		.append('svg')
		.attr('width', largura)
		.attr('height', altura)
		.attr('viewBox', `0 0 ${largura} ${altura}`);

	if (customTitle) {
		svg
			.append('text')
			.attr('x', largura / 2)
			.attr('y', 16)
			.attr('text-anchor', 'middle')
			.attr('font-size', 13)
			.attr('font-weight', 600)
			.attr('fill', '#3f3a33')
			.text(customTitle);
	}

	const viewport = svg
		.append('g')
		.attr('transform', `translate(${margem.left},${margem.top + titleOffset})`);

	const root = hierarchy({ children: bubbles }).sum(d => d.value);
	const packLayout = pack()
		.size([larguraInterna, alturaInterna])
		.padding(Math.max(0, padding));
	packLayout(root);

	const leaves = root.leaves();
	const colorDomain = Array.from(new Set(leaves.map(item => item.data.group)));
	const colorScale = scaleOrdinal(getBubblePalette(colorScheme)).domain(colorDomain);
	const defs = svg.append('defs');
	let pinnedCategory = null;

	const createTooltip = item => {
		const wrapper = document.createElement('div');
		const measureLabel = measureMode === 'mean'
			? labels.media
			: measureMode === 'sum'
				? labels.soma
				: labels.contagem;

		const makeLine = (label, value) => {
			const row = document.createElement('div');
			const strong = document.createElement('strong');
			strong.textContent = `${label}:`;
			row.appendChild(strong);
			row.append(` ${value}`);
			return row;
		};

		wrapper.appendChild(makeLine(labels.categoria, item.data.category));
		wrapper.appendChild(makeLine(measureLabel, formatNumber(item.data.value, locale)));
		if (groupColumn) {
			wrapper.appendChild(makeLine(labels.grupo, item.data.group));
		}
		return wrapper;
	};

	const showTooltip = (event, item) => {
		showChartTooltip(createTooltip(item), event.pageX, event.pageY);
	};

	const node = viewport
		.selectAll('g.bubble-node')
		.data(leaves)
		.enter()
		.append('g')
		.attr('class', 'bubble-node')
		.attr('transform', d => `translate(${d.x},${d.y})`);

	node.append('title').text(d => {
		const measureLabel = measureMode === 'mean'
			? labels.media
			: measureMode === 'sum'
				? labels.soma
				: labels.contagem;
		const lines = [
			`${labels.categoria}: ${d.data.category}`,
			`${measureLabel}: ${formatNumber(d.data.value, locale)}`,
		];
		if (groupColumn) {
			lines.push(`${labels.grupo}: ${d.data.group}`);
		}
		return lines.join('\n');
	});

	node.append('circle')
		.attr('r', d => d.r)
		.attr('fill', d => colorScale(d.data.group))
		.attr('fill-opacity', 0.7)
		.attr('stroke', '#fff')
		.attr('stroke-width', 1);

	const labelNodes = node.filter(d => labelMode === 'all' || (labelMode === 'auto' && d.r >= autoLabelMinRadius));
	labelNodes.each(function appendLabel(d, index) {
		const fitsInside = d.r >= autoLabelMinRadius;
		const fontSize = fitsInside
			? Math.max(9, Math.min(13, d.r / 3))
			: Math.max(7, Math.min(10, d.r / 2));
		const textEl = select(this)
			.append('text')
			.attr('text-anchor', 'middle')
			.attr('dominant-baseline', 'middle')
			.attr('pointer-events', 'none')
			.attr('fill', fitsInside ? '#fff' : '#3f3a33')
			.attr('font-size', fontSize)
			.text(String(d.data.category));

		if (fitsInside) {
			const clipId = `bubble-clip-${index}-${Math.random().toString(36).slice(2, 8)}`;
			defs.append('clipPath')
				.attr('id', clipId)
				.attr('clipPathUnits', 'userSpaceOnUse')
				.append('circle')
				.attr('cx', margem.left + d.x)
				.attr('cy', margem.top + titleOffset + d.y)
				.attr('r', d.r);
			textEl.attr('clip-path', `url(#${clipId})`);
		} else {
			textEl.attr('dy', d.r + fontSize + 2);
		}
	});

	node
		.on('mouseenter', (event, item) => {
			if (pinnedCategory !== null) return;
			showTooltip(event, item);
		})
		.on('mousemove', event => {
			if (pinnedCategory !== null) return;
			moveChartTooltip(event.pageX, event.pageY);
		})
		.on('mouseleave', () => {
			if (pinnedCategory !== null) return;
			hideChartTooltip();
		})
		.on('click', (event, item) => {
			event.stopPropagation();
			if (pinnedCategory === item.data.category) {
				pinnedCategory = null;
				hideChartTooltip();
				return;
			}
			pinnedCategory = item.data.category;
			showTooltip(event, item);
		});

	svg.on('click', () => {
		pinnedCategory = null;
		hideChartTooltip();
	});

	return ok();
}