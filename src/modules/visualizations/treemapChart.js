import { hierarchy, select, treemap, treemapSquarify } from 'd3';
import {
	buildCategoricalFilterActions,
	createFilterStateBadge,
	createTooltipActionGroup,
	hideChartTooltip,
	moveChartTooltip,
	showChartTooltip,
	showPinnedChartTooltip,
} from './tooltip.js';
import { CHART_COLORS, CHART_DIMENSIONS, TREEMAP_CHART } from '../../config/charts.js';
import { formatNumber } from '../../utils/formatters.js';
import { toCategoryToken } from '../../utils/chartFilters.js';

const COLOR_PALETTE = {
	Bold: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2'],
	Pastel: ['#FFB3BA', '#FFCCCB', '#FFFFBA', '#BAE1BA', '#BAC7FF', '#E0BBE4', '#FFDFD3', '#DFF8EB'],
	'Colorblind-Safe': ['#0173B2', '#029E73', '#ECE133', '#CC78BC', '#CA9161', '#949494', '#ECE2F0', '#A6ACAF'],
};

function getSchemeColors(schemeName) {
	return COLOR_PALETTE[schemeName] || COLOR_PALETTE['Bold'];
}

function clamp(value, min, max) {
	return Math.min(Math.max(value, min), max);
}

function truncate(text, maxLen) {
	return text.length > maxLen ? `${text.slice(0, maxLen - 1)}…` : text;
}

export function renderTreeMap(container, dados, colunaCategoria, opcoes = {}) {
	if (!container || !colunaCategoria) return { ok: false };

	const measureMode = TREEMAP_CHART.measureModes.includes(opcoes.measureMode)
		? opcoes.measureMode
		: TREEMAP_CHART.defaultMeasureMode;
	const valueColumn = opcoes.valueColumn || null;
	const topN = Number.isFinite(Number(opcoes.topN)) ? Number(opcoes.topN) : TREEMAP_CHART.defaultTopN;
	const padding = Number.isFinite(Number(opcoes.padding)) ? clamp(Number(opcoes.padding), 1, 6) : TREEMAP_CHART.defaultPadding;
	const showLabels = opcoes.showLabels !== false;
	const showValues = opcoes.showValues !== false;
	const customTitle = String(opcoes.customTitle || '').trim().slice(0, 80);
	const chartHeight = Number.isFinite(Number(opcoes.chartHeight))
		? clamp(Number(opcoes.chartHeight), 220, 720)
		: 380;
	const colorMode = opcoes.colorMode || 'scheme';
	const colorScheme = opcoes.colorScheme || 'Bold';
	const uniformColor = /^#[0-9a-fA-F]{6}$/.test(String(opcoes.color || '').trim())
		? String(opcoes.color).trim()
		: CHART_COLORS.treemap;
	const locale = opcoes.locale || undefined;
	const labels = {
		categoria: opcoes.labels?.categoria || 'Category',
		contagem: opcoes.labels?.contagem || 'Count',
		soma: opcoes.labels?.soma || 'Sum',
		percentual: opcoes.labels?.percentual || 'Percentage',
		focusOnThis: opcoes.labels?.focusOnThis || 'Show only this',
		addToFilter: opcoes.labels?.addToFilter || 'Add to global filter',
	};

	// Aggregate data
	const hasValueColumn = measureMode === 'count'
		? true
		: dados.some(linha => Object.prototype.hasOwnProperty.call(linha, valueColumn));

	if (measureMode === 'sum' && (!valueColumn || !hasValueColumn)) {
		return { ok: false, reason: 'no-value-column' };
	}

	const contador = new Map();
	dados.forEach(linha => {
		const valorBruto = linha[colunaCategoria];
		const categoria = valorBruto === null || valorBruto === undefined || valorBruto === ''
			? '—'
			: String(valorBruto);
		if (measureMode === 'sum') {
			const valor = Number(linha[valueColumn]);
			if (!Number.isFinite(valor)) return;
			contador.set(categoria, (contador.get(categoria) || 0) + valor);
		} else {
			contador.set(categoria, (contador.get(categoria) || 0) + 1);
		}
	});

	if (contador.size === 0) return { ok: false };

	let entradas = Array.from(contador.entries())
		.filter(([, v]) => v > 0)
		.sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));

	if (topN > 0) entradas = entradas.slice(0, topN);
	if (entradas.length === 0) return { ok: false };

	const total = entradas.reduce((acc, [, v]) => acc + v, 0);

	container.innerHTML = '';
	hideChartTooltip();

	const largura = Math.max(container.clientWidth || CHART_DIMENSIONS.bar?.width || 700, 320);
	const titleOffset = customTitle ? 24 : 0;
	const altura = chartHeight;

	const svg = select(container)
		.append('svg')
		.attr('width', largura)
		.attr('height', altura);

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

	const treemapWidth = largura;
	const treemapHeight = altura - titleOffset;

	const rootData = {
		name: 'root',
		children: entradas.map(([nome, valor]) => ({ name: nome, value: valor })),
	};

	const root = hierarchy(rootData)
		.sum(d => d.value)
		.sort((a, b) => b.value - a.value);

	const layoutFn = treemap()
		.tile(treemapSquarify)
		.size([treemapWidth, treemapHeight])
		.padding(padding)
		.round(true);

	layoutFn(root);

	const schemeColors = getSchemeColors(colorScheme);
	const getColor = (d, i) => {
		if (colorMode === 'uniform') return uniformColor;
		return schemeColors[i % schemeColors.length];
	};

	let pinnedName = null;
	const filterCallbacks = opcoes.filterCallbacks || {};
	const filterLabels = filterCallbacks.filterActionLabels || {};
	const actionLabels = {
		focus: filterLabels.focus || labels.focusOnThis,
		add: filterLabels.add || labels.addToFilter,
		exclude: filterLabels.exclude || 'Hide this',
		remove: filterLabels.remove || 'Remove from filter',
		bringBack: filterLabels.bringBack || 'Bring back',
	};

	const buildTooltipContent = (d, pct) => {
		const wrapper = document.createElement('div');
		const valorLabel = measureMode === 'sum' ? labels.soma : labels.contagem;

		const createLine = (rotulo, valor) => {
			const linha = document.createElement('div');
			const strong = document.createElement('strong');
			strong.textContent = `${rotulo}:`;
			linha.appendChild(strong);
			linha.append(` ${valor}`);
			return linha;
		};

		wrapper.appendChild(createLine(labels.categoria, String(d.data.name)));
		wrapper.appendChild(createLine(valorLabel, formatNumber(d.data.value, locale)));
		wrapper.appendChild(createLine(labels.percentual, `${pct.toFixed(1)}%`));
		return wrapper;
	};

	const leaves = root.leaves();

	const cellGroup = svg
		.append('g')
		.attr('transform', `translate(0,${titleOffset})`);

	const cells = cellGroup
		.selectAll('g')
		.data(leaves)
		.enter()
		.append('g')
		.attr('transform', d => `translate(${d.x0},${d.y0})`);

	cells
		.append('rect')
		.attr('width', d => Math.max(0, d.x1 - d.x0))
		.attr('height', d => Math.max(0, d.y1 - d.y0))
		.attr('rx', 2)
		.attr('fill', (d, i) => getColor(d, i))
		.attr('opacity', 0.88)
		.attr('stroke', '#fffef9')
		.attr('stroke-width', 1)
		.style('cursor', 'pointer')
		.on('mouseenter', (event, d) => {
			if (pinnedName !== null) return;
			const pct = total > 0 ? (d.data.value / total) * 100 : 0;
			showChartTooltip(buildTooltipContent(d, pct), event.pageX, event.pageY);
		})
		.on('mousemove', event => {
			if (pinnedName !== null) return;
			moveChartTooltip(event.pageX, event.pageY);
		})
		.on('mouseleave', () => {
			if (pinnedName !== null) return;
			hideChartTooltip();
		})
		.on('click', (event, d) => {
			event.stopPropagation();
			if (pinnedName === d.data.name) {
				pinnedName = null;
				hideChartTooltip();
				return;
			}
			pinnedName = d.data.name;
			const pct = total > 0 ? (d.data.value / total) * 100 : 0;
			const content = buildTooltipContent(d, pct);
			const token = toCategoryToken(d.data.name);
			const state = typeof filterCallbacks.getTokenFilterState === 'function'
				? filterCallbacks.getTokenFilterState(colunaCategoria, token)
				: null;
			const omitFocus = typeof filterCallbacks.isShowOnlyThisRedundant === 'function'
				? !!filterCallbacks.isShowOnlyThisRedundant(colunaCategoria, token)
				: false;
			const actions = buildCategoricalFilterActions({
				column: colunaCategoria,
				token,
				state,
				labels: actionLabels,
				omitFocus,
				onFocus: filterCallbacks.onFocusGlobalFilter,
				onAdd: filterCallbacks.onAddToGlobalFilter,
				onExclude: filterCallbacks.onExcludeGlobalFilter,
				onRemove: filterCallbacks.onRemoveFromGlobalFilter,
				onBringBack: filterCallbacks.onBringBackGlobalFilter,
			});
			const stateBadge = createFilterStateBadge({
				state,
				includedLabel: filterLabels.stateIncluded,
				excludedLabel: filterLabels.stateExcluded,
			});
			const actionSet = actions.length > 0 ? createTooltipActionGroup(actions) : null;
			showPinnedChartTooltip(content, event.pageX, event.pageY, {
				headerTitle: String(d.data.name),
				closeLabel: filterLabels.close,
				onDismiss: () => {
					pinnedName = null;
					hideChartTooltip();
				},
				actionSets: actionSet ? [actionSet] : [],
				stateBadge,
			});
		});

	if (showLabels || showValues) {
		cells.each(function(d) {
			const w = d.x1 - d.x0;
			const h = d.y1 - d.y0;
			if (w < 24 || h < 14) return;

			const g = select(this);
			const cx = w / 2;

			if (showLabels && showValues && h >= 32) {
				g.append('text')
					.attr('x', cx)
					.attr('y', h / 2 - 7)
					.attr('text-anchor', 'middle')
					.attr('dominant-baseline', 'middle')
					.attr('font-size', clamp(Math.min(w / 6, h / 4, 13), 8, 13))
					.attr('fill', '#fffef9')
					.attr('pointer-events', 'none')
					.text(truncate(d.data.name, Math.max(3, Math.floor(w / 7))));

				g.append('text')
					.attr('x', cx)
					.attr('y', h / 2 + 8)
					.attr('text-anchor', 'middle')
					.attr('dominant-baseline', 'middle')
					.attr('font-size', clamp(Math.min(w / 7, h / 5, 11), 7, 11))
					.attr('fill', 'rgba(255,254,249,0.8)')
					.attr('pointer-events', 'none')
					.text(formatNumber(d.data.value, locale));
			} else if (showLabels) {
				g.append('text')
					.attr('x', cx)
					.attr('y', h / 2)
					.attr('text-anchor', 'middle')
					.attr('dominant-baseline', 'middle')
					.attr('font-size', clamp(Math.min(w / 6, h / 4, 13), 8, 13))
					.attr('fill', '#fffef9')
					.attr('pointer-events', 'none')
					.text(truncate(d.data.name, Math.max(3, Math.floor(w / 7))));
			} else if (showValues) {
				g.append('text')
					.attr('x', cx)
					.attr('y', h / 2)
					.attr('text-anchor', 'middle')
					.attr('dominant-baseline', 'middle')
					.attr('font-size', clamp(Math.min(w / 7, h / 4, 12), 7, 12))
					.attr('fill', '#fffef9')
					.attr('pointer-events', 'none')
					.text(formatNumber(d.data.value, locale));
			}
		});
	}

	svg.on('click', () => {
		pinnedName = null;
		hideChartTooltip();
	});

	return { ok: true };
}
