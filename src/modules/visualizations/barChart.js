import { axisBottom, axisLeft, max, scaleBand, scaleLinear, select } from 'd3';
import { hideChartTooltip, moveChartTooltip, showChartTooltip } from './tooltip.js';
import { BAR_CHART, CHART_DIMENSIONS, CHART_COLORS } from '../../config/charts.js';
import { formatNumber } from '../../utils/formatters.js';
import { interpolateColor } from '../../utils/colorUtils.js';

function ordenarCategorias(linhas, ordenacao) {
	if (ordenacao === 'count-asc') {
		return linhas.sort((a, b) => a[1] - b[1] || String(a[0]).localeCompare(String(b[0])));
	}

	if (ordenacao === 'label-asc') {
		return linhas.sort((a, b) => String(a[0]).localeCompare(String(b[0])));
	}

	if (ordenacao === 'label-desc') {
		return linhas.sort((a, b) => String(b[0]).localeCompare(String(a[0])));
	}

	return linhas.sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));
}

export function renderBarChart(container, dados, colunaCategoria, opcoes = {}) {
	if (!container || !colunaCategoria) return { ok: false };
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
	};
	const measureMode = BAR_CHART.measureModes.includes(opcoes.measureMode)
		? opcoes.measureMode
		: BAR_CHART.defaultMeasureMode;
	const valueColumn = opcoes.valueColumn || null;
	const hasValueColumn = (measureMode === 'count')
		? true
		: dados.some(linha => Object.prototype.hasOwnProperty.call(linha, valueColumn));
	const axisLabels = {
		x: opcoes.axisLabels?.x || colunaCategoria,
		y: opcoes.axisLabels?.y
			|| (measureMode === 'mean'
				? labels.media
				: measureMode === 'sum'
					? labels.soma
					: labels.contagem),
	};
	const color = /^#[0-9a-fA-F]{6}$/.test(String(opcoes.color || '').trim())
		? String(opcoes.color).trim()
		: CHART_COLORS.bar;
	const colorMode = ['uniform', 'gradient', 'gradient-manual'].includes(opcoes.colorMode)
		? opcoes.colorMode
		: 'uniform';
	const gradientMinColor = /^#[0-9a-fA-F]{6}$/.test(String(opcoes.gradientMinColor || '').trim())
		? String(opcoes.gradientMinColor).trim()
		: color;
	const gradientMaxColor = /^#[0-9a-fA-F]{6}$/.test(String(opcoes.gradientMaxColor || '').trim())
		? String(opcoes.gradientMaxColor).trim()
		: '#ffffff';
	const manualThresholdPct = Number.isFinite(Number(opcoes.manualThresholdPct))
		? Math.max(0, Math.min(100, Number(opcoes.manualThresholdPct)))
		: 50;
	const customTitle = String(opcoes.customTitle || '').trim().slice(0, 80);
	const chartHeight = Number.isFinite(Number(opcoes.chartHeight))
		? Math.max(220, Math.min(720, Number(opcoes.chartHeight)))
		: CHART_DIMENSIONS.bar.height;
	const locale = opcoes.locale || undefined;

	const contador = new Map();
	const contadorN = new Map();

	if (measureMode === 'count') {
		dados.forEach(linha => {
			const valorBruto = linha[colunaCategoria];
			const categoria = valorBruto === null || valorBruto === undefined || valorBruto === ''
				? '—'
				: String(valorBruto);
			contador.set(categoria, (contador.get(categoria) || 0) + 1);
		});
	} else {
		if (!valueColumn || !hasValueColumn) return { ok: false, reason: 'no-value-column' };
		dados.forEach(linha => {
			const valorBruto = linha[colunaCategoria];
			const categoria = valorBruto === null || valorBruto === undefined || valorBruto === ''
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
		return { ok: false, reason: 'no-numeric' };
	}

	let linhas = Array.from(contador.entries());
	linhas = ordenarCategorias(linhas, ordenacao);

	if (topN > 0) {
		linhas = linhas.slice(0, topN);
	}

	if (linhas.length === 0) return { ok: false };
	const totalContagem = linhas.reduce((acc, item) => acc + item[1], 0);

	container.innerHTML = '';
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

		const createLine = (rotulo, valor) => {
			const linha = document.createElement('div');
			const strong = document.createElement('strong');
			strong.textContent = `${rotulo}:`;
			linha.appendChild(strong);
			linha.append(` ${valor}`);
			return linha;
		};

		wrapper.appendChild(createLine(labels.categoria, String(item[0])));
		wrapper.appendChild(createLine(valorLabel, formatNumber(item[1], locale)));
		if (measureMode !== 'mean') {
			wrapper.appendChild(createLine(labels.percentual, `${percentual.toFixed(1)}%`));
		}

		return wrapper;
	};

	const exibirTooltip = (event, item) => {
		showChartTooltip(montarConteudoTooltip(item), event.pageX, event.pageY);
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

	const getBarColor = (item) => {
		if (colorMode === 'uniform') return color;
		if (colorMode === 'gradient') {
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
			exibirTooltip(event, item);
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

	return { ok: true };
}
