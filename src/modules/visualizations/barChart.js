/**
 * Bar-chart renderer.
 *
 * Renders a vertical bar chart with count/sum/mean aggregation, Top-N
 * trimming, color modes (uniform / auto gradient / manual threshold), and
 * click-to-filter tooltip actions. Internal D3 helpers (scale setup, label
 * positioning, gradient interpolation) are intentionally undocumented per
 * the Tier 5 plan — only the entry signature is part of the public API.
 *
 * @typedef {import('../../types.js').Result} Result
 */

import { axisBottom, axisLeft, max, scaleBand, scaleLinear, select } from 'https://esm.sh/d3@7.9.0';
import {
	buildCategoricalFilterActions,
	createFilterStateBadge,
	createTooltipActionGroup,
	createTooltipLine,
	hideChartTooltip,
	moveChartTooltip,
	showChartTooltip,
	showPinnedChartTooltip,
} from './tooltip.js';
import { BAR_CHART, CHART_DIMENSIONS, CHART_COLORS } from '../../config/charts.js';
import { formatNumber, isNullish } from '../../utils/formatters.js';
import { toCategoryToken, compareStrings } from '../../utils/chartFilters.js';
import { interpolateColor, buildRankMap, isValidHexColor } from '../../utils/colorUtils.js';
import { ok, fail } from '../../utils/result.js';

// WHY: every count-based sort uses `|| compareStrings(a[0], b[0])` as a tiebreaker
// so categories with equal counts have a deterministic visual order. Without the
// secondary string compare, sort stability varies by browser engine and the bar
// order can flicker between renders on identical data.
function ordenarCategorias(linhas, ordenacao) {
	if (ordenacao === 'count-asc') {
		return linhas.sort((a, b) => a[1] - b[1] || compareStrings(a[0], b[0]));
	}

	if (ordenacao === 'label-asc') {
		return linhas.sort((a, b) => compareStrings(a[0], b[0]));
	}

	if (ordenacao === 'label-desc') {
		return linhas.sort((a, b) => compareStrings(b[0], a[0]));
	}

	return linhas.sort((a, b) => b[1] - a[1] || compareStrings(a[0], b[0]));
}

/**
 * Render a bar chart into `container`. Returns `ok()` on success, or
 * `fail(reason)` on early exit:
 *   - no `colunaCategoria` or no container → `fail()`
 *   - `measureMode` is sum/mean but `valueColumn` is missing → `fail('no-value-column')`
 *   - sum/mean over no parseable numbers → `fail('no-numeric')`
 *   - empty data → `fail()`
 *
 * The full option bag varies; see `BAR_CHART` and `CHART_DIMENSIONS` in
 * `config/charts.js` for the field set and defaults. Frequently used keys
 * include `ordenacao` (count-desc/asc, label-asc/desc), `topN`, `measureMode`
 * ('count' | 'sum' | 'mean'), `valueColumn`, `colorMode`
 * ('uniform' | 'gradient' | 'gradient-manual'), color stops, axis label
 * toggles, `customTitle`, `chartHeight`, `locale`, and the localized
 * `labels`/`axisLabels` bags.
 *
 * @param {HTMLElement} container - Target DOM element. Existing contents are replaced.
 * @param {Array<Object<string, *>>} rows - Source rows.
 * @param {string} colunaCategoria - Categorical column name (required).
 * @param {Object} [opcoes={}] - Render options bag.
 * @returns {Result}
 */
export function renderBarChart(container, rows, colunaCategoria, opcoes = {}) {
	if (!container || !colunaCategoria) return fail();
	const ordenacao = opcoes.ordenacao || BAR_CHART.defaultSort;
	const topN = Number.isFinite(Number(opcoes.topN)) ? Number(opcoes.topN) : BAR_CHART.defaultTopN;
	const showXAxisLabel = opcoes.showXAxisLabel !== false;
	const showYAxisLabel = opcoes.showYAxisLabel !== false;
	const labels = {
		categoria: opcoes.labels?.categoria || 'Category',
		contagem: opcoes.labels?.contagem || 'Count',
		soma: opcoes.labels?.soma || 'Sum',
		media: opcoes.labels?.media || 'Mean',
		percentual: opcoes.labels?.percentual || 'Percentage',
		focusOnThis: opcoes.labels?.focusOnThis || 'Show only this',
		addToFilter: opcoes.labels?.addToFilter || 'Add to global filter',
	};
	const measureMode = BAR_CHART.measureModes.includes(opcoes.measureMode)
		? opcoes.measureMode
		: BAR_CHART.defaultMeasureMode;
	const valueColumn = opcoes.valueColumn || null;
	const hasValueColumn = (measureMode === 'count')
		? true
		: rows.some(linha => Object.prototype.hasOwnProperty.call(linha, valueColumn));
	const axisLabels = {
		x: opcoes.axisLabels?.x || colunaCategoria,
		y: opcoes.axisLabels?.y
			|| (measureMode === 'mean'
				? labels.media
				: measureMode === 'sum'
					? labels.soma
					: labels.contagem),
	};
	const color = isValidHexColor(String(opcoes.color || '').trim())
		? String(opcoes.color).trim()
		: CHART_COLORS.bar;
	const colorMode = ['uniform', 'gradient', 'gradient-manual'].includes(opcoes.colorMode)
		? opcoes.colorMode
		: 'uniform';
	const gradientMinColor = isValidHexColor(String(opcoes.gradientMinColor || '').trim())
		? String(opcoes.gradientMinColor).trim()
		: color;
	const gradientMaxColor = isValidHexColor(String(opcoes.gradientMaxColor || '').trim())
		? String(opcoes.gradientMaxColor).trim()
		: '#ffffff';
	const manualThresholdPct = Number.isFinite(Number(opcoes.manualThresholdPct))
		? Math.max(0, Math.min(100, Number(opcoes.manualThresholdPct)))
		: 50;
	const gradientDistribution = opcoes.gradientDistribution === 'rank' ? 'rank' : 'value';
	const customTitle = String(opcoes.customTitle || '').trim().slice(0, 80);
	const chartHeight = Number.isFinite(Number(opcoes.chartHeight))
		? Math.max(220, Math.min(720, Number(opcoes.chartHeight)))
		: CHART_DIMENSIONS.bar.height;
	const locale = opcoes.locale || undefined;

	const contador = new Map();
	const contadorN = new Map();

	if (measureMode === 'count') {
		rows.forEach(linha => {
			const valorBruto = linha[colunaCategoria];
			const categoria = isNullish(valorBruto) || valorBruto === ''
				? '—'
				: String(valorBruto);
			contador.set(categoria, (contador.get(categoria) || 0) + 1);
		});
	} else {
		if (!valueColumn || !hasValueColumn) return fail('no-value-column');
		rows.forEach(linha => {
			const valorBruto = linha[colunaCategoria];
			const categoria = isNullish(valorBruto) || valorBruto === ''
				? '—'
				: String(valorBruto);
			const valor = Number(linha[valueColumn]);
			if (!Number.isFinite(valor)) return;
			contador.set(categoria, (contador.get(categoria) || 0) + valor);
			contadorN.set(categoria, (contadorN.get(categoria) || 0) + 1);
		});

		if (measureMode === 'mean') {
			for (const [categoria, soma] of contador.entries()) {
				contador.set(categoria, soma / (contadorN.get(categoria) || 1));
			}
		}
	}

	if ((measureMode === 'sum' || measureMode === 'mean') && contador.size === 0) {
		return fail('no-numeric');
	}

	let linhas = Array.from(contador.entries());
	linhas = ordenarCategorias(linhas, ordenacao);

	if (topN > 0) {
		linhas = linhas.slice(0, topN);
	}

	if (linhas.length === 0) return fail();
	const totalContagem = linhas.reduce((acc, item) => acc + item[1], 0);

	container.replaceChildren();
 	hideChartTooltip();
	const largura = Math.max(container.clientWidth || CHART_DIMENSIONS.bar.width, 320);
	const altura = chartHeight;
	const margem = CHART_DIMENSIONS.bar.margins;
	const titleOffset = customTitle ? 20 : 0;
	const larguraInterna = largura - margem.left - margem.right;
	const alturaInterna = altura - margem.top - margem.bottom - titleOffset;

	const svg = select(container)
		.append('svg')
		.attr('width', largura)
		.attr('height', altura);

	const grupo = svg
		.append('g')
		.attr('transform', `translate(${margem.left},${margem.top + titleOffset})`);

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

	let pinnedCategoria = null;

	const montarConteudoTooltip = item => {
		const percentual = totalContagem > 0 ? ((item[1] / totalContagem) * 100) : 0;
		const wrapper = document.createElement('div');
		const valorLabel = measureMode === 'mean'
			? labels.media
			: measureMode === 'sum'
				? labels.soma
				: labels.contagem;

		wrapper.appendChild(createTooltipLine(labels.categoria, String(item[0])));
		wrapper.appendChild(createTooltipLine(valorLabel, formatNumber(item[1], locale)));
		if (measureMode !== 'mean') {
			wrapper.appendChild(createTooltipLine(labels.percentual, `${percentual.toFixed(1)}%`));
		}

		return wrapper;
	};

	const exibirTooltip = (event, item) => {
		showChartTooltip(montarConteudoTooltip(item), event.pageX, event.pageY);
	};

	const filterCallbacks = opcoes.filterCallbacks || {};
	const filterLabels = filterCallbacks.filterActionLabels || {};
	const actionLabels = {
		focus: filterLabels.focus || labels.focusOnThis,
		add: filterLabels.add || labels.addToFilter,
		exclude: filterLabels.exclude || 'Hide this',
		remove: filterLabels.remove || 'Remove from filter',
		bringBack: filterLabels.bringBack || 'Bring back',
	};

	const exibirTooltipFixado = (event, item, onDismiss) => {
		const content = montarConteudoTooltip(item);
		const token = toCategoryToken(item[0]);
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
			headerTitle: String(item[0]),
			closeLabel: filterLabels.close,
			onDismiss,
			actionSets: actionSet ? [actionSet] : [],
			stateBadge,
		});
	};

	const escalaX = scaleBand()
		.domain(linhas.map(item => item[0]))
		.range([0, larguraInterna])
		.padding(0.14);

	const escalaY = scaleLinear()
		.domain([0, max(linhas, item => item[1]) || 0])
		.nice()
		.range([alturaInterna, 0]);

	const minValor = Math.min(...linhas.map(item => item[1]));
	const maxValor = Math.max(...linhas.map(item => item[1]));
	const deltaValor = maxValor - minValor || 1;
	const thresholdValue = minValor + (deltaValor * (manualThresholdPct / 100));
	const rankMap = (colorMode === 'gradient' && gradientDistribution === 'rank')
		? buildRankMap(linhas, item => item[1])
		: null;
	const rankDenom = Math.max(linhas.length - 1, 1);

	const getBarColor = (item) => {
		if (colorMode === 'uniform') return color;
		if (colorMode === 'gradient') {
			if (rankMap) {
				const rank = rankMap.get(item);
				if (rank === undefined) return gradientMinColor;
				return interpolateColor(gradientMinColor, gradientMaxColor, rank / rankDenom);
			}
			return interpolateColor(gradientMinColor, gradientMaxColor, (item[1] - minValor) / deltaValor);
		}
		if (colorMode === 'gradient-manual') {
			return item[1] <= thresholdValue ? gradientMinColor : gradientMaxColor;
		}
		return color;
	};

	grupo
		.selectAll('rect')
		.data(linhas)
		.enter()
		.append('rect')
		.attr('x', item => escalaX(item[0]))
		.attr('y', item => escalaY(item[1]))
		.attr('width', escalaX.bandwidth())
		.attr('height', item => alturaInterna - escalaY(item[1]))
		.attr('rx', 3)
		.attr('fill', item => getBarColor(item))
		.on('mouseenter', (event, item) => {
			if (pinnedCategoria !== null) return;
			exibirTooltip(event, item);
		})
		.on('mousemove', event => {
			if (pinnedCategoria !== null) return;
			moveChartTooltip(event.pageX, event.pageY);
		})
		.on('mouseleave', () => {
			if (pinnedCategoria !== null) return;
			hideChartTooltip();
		})
		.on('click', (event, item) => {
			event.stopPropagation();
			if (pinnedCategoria === item[0]) {
				pinnedCategoria = null;
				hideChartTooltip();
				return;
			}
			pinnedCategoria = item[0];
			exibirTooltipFixado(event, item, () => {
				pinnedCategoria = null;
				hideChartTooltip();
			});
		});

	svg.on('click', () => {
		pinnedCategoria = null;
		hideChartTooltip();
	});

	grupo
		.append('g')
		.attr('transform', `translate(0,${alturaInterna})`)
		.call(axisBottom(escalaX))
		.selectAll('text')
		.style('text-anchor', 'end')
		.attr('dx', '-0.6em')
		.attr('dy', '0.15em')
		.attr('transform', 'rotate(-30)');

	grupo
		.append('g')
		.call(axisLeft(escalaY).ticks(BAR_CHART.ticks));

	if (showXAxisLabel) {
		grupo
			.append('text')
			.attr('x', larguraInterna / 2)
			.attr('y', alturaInterna + margem.bottom - 18)
			.attr('text-anchor', 'middle')
			.attr('fill', '#5f5a53')
			.attr('font-size', 11)
			.text(axisLabels.x);
	}

	if (showYAxisLabel) {
		grupo
			.append('text')
			.attr('transform', 'rotate(-90)')
			.attr('x', -alturaInterna / 2)
			.attr('y', -margem.left + 16)
			.attr('text-anchor', 'middle')
			.attr('fill', '#5f5a53')
			.attr('font-size', 11)
			.text(axisLabels.y);
	}

	return ok();
}
