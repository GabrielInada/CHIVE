import { axisBottom, axisLeft, extent, scaleLinear, scaleLog, select } from 'd3';
import { hideChartTooltip, moveChartTooltip, showChartTooltip } from './tooltip.js';
import { SCATTER_PLOT, CHART_DIMENSIONS, CHART_COLORS } from '../../config/index.js';
import { formatarNumero } from '../../utils/formatters.js';

function normalizarDominio([minimo, maximo]) {
	if (!Number.isFinite(minimo) || !Number.isFinite(maximo)) return [0, 1];
	if (minimo === maximo) {
		const delta = minimo === 0 ? 1 : Math.abs(minimo * 0.1);
		return [minimo - delta, maximo + delta];
	}
	return [minimo, maximo];
}

export function renderScatterPlot(container, dados, eixoX, eixoY, opcoes = {}) {
	if (!container || !eixoX || !eixoY) return { ok: false };
	const xScale = opcoes.xScale === 'log' ? 'log' : 'linear';
	const yScale = opcoes.yScale === 'log' ? 'log' : 'linear';
	const showXAxisLabel = opcoes.showXAxisLabel !== false;
	const showYAxisLabel = opcoes.showYAxisLabel !== false;
	const radius = Number.isFinite(Number(opcoes.radius)) ? Number(opcoes.radius) : SCATTER_PLOT.defaultRadius;
	const opacity = Number.isFinite(Number(opcoes.opacity)) ? Number(opcoes.opacity) : SCATTER_PLOT.defaultOpacity;
	const color = /^#[0-9a-fA-F]{6}$/.test(String(opcoes.color || '').trim())
		? String(opcoes.color).trim()
		: CHART_COLORS.scatter;
 	const labels = {
		eixoX: opcoes.labels?.eixoX || 'X',
		eixoY: opcoes.labels?.eixoY || 'Y',
		indice: opcoes.labels?.indice || 'Index',
	};
	const axisLabels = {
		x: opcoes.axisLabels?.x || eixoX,
		y: opcoes.axisLabels?.y || eixoY,
	};
	const locale = opcoes.locale || undefined;

	let pontos = dados
		.map((linha, index) => ({ x: Number(linha[eixoX]), y: Number(linha[eixoY]), index }))
		.filter(ponto => Number.isFinite(ponto.x) && Number.isFinite(ponto.y));

	if (xScale === 'log') {
		pontos = pontos.filter(ponto => ponto.x > 0);
	}

	if (yScale === 'log') {
		pontos = pontos.filter(ponto => ponto.y > 0);
	}

	if (pontos.length === 0) {
		return { ok: false, reason: xScale === 'log' || yScale === 'log' ? 'log-no-positive' : undefined };
	}

	container.innerHTML = '';
	hideChartTooltip();
	const largura = Math.max(container.clientWidth || CHART_DIMENSIONS.scatter.width, 320);
	const altura = CHART_DIMENSIONS.scatter.height;
	const margem = CHART_DIMENSIONS.scatter.margins;
	const larguraInterna = largura - margem.left - margem.right;
	const alturaInterna = altura - margem.top - margem.bottom;

	const svg = select(container)
		.append('svg')
		.attr('width', largura)
		.attr('height', altura);

	const grupo = svg
		.append('g')
		.attr('transform', `translate(${margem.left},${margem.top})`);

	let pinnedIndex = null;

	const montarConteudoTooltip = ponto => {
		const wrapper = document.createElement('div');

		const criarLinha = (rotulo, valor) => {
			const linha = document.createElement('div');
			const strong = document.createElement('strong');
			strong.textContent = `${rotulo}:`;
			linha.appendChild(strong);
			linha.append(` ${valor}`);
			return linha;
		};

		wrapper.appendChild(criarLinha(labels.eixoX, formatarNumero(ponto.x, locale)));
		wrapper.appendChild(criarLinha(labels.eixoY, formatarNumero(ponto.y, locale)));
		wrapper.appendChild(criarLinha(labels.indice, formatarNumero(ponto.index + 1, locale)));

		return wrapper;
	};

	const exibirTooltip = (event, ponto) => {
		showChartTooltip(montarConteudoTooltip(ponto), event.pageX, event.pageY);
	};

	const dominioX = normalizarDominio(extent(pontos, ponto => ponto.x));
	const dominioY = normalizarDominio(extent(pontos, ponto => ponto.y));

	const escalaX = (xScale === 'log' ? scaleLog() : scaleLinear())
		.domain(dominioX)
		.nice()
		.range([0, larguraInterna]);
	const escalaY = (yScale === 'log' ? scaleLog() : scaleLinear())
		.domain(dominioY)
		.nice()
		.range([alturaInterna, 0]);

	grupo
		.selectAll('circle')
		.data(pontos)
		.enter()
		.append('circle')
		.attr('cx', ponto => escalaX(ponto.x))
		.attr('cy', ponto => escalaY(ponto.y))
		.attr('r', radius)
		.attr('fill', color)
		.attr('opacity', opacity)
		.on('mouseenter', (event, ponto) => {
			if (pinnedIndex !== null) return;
			exibirTooltip(event, ponto);
		})
		.on('mousemove', event => {
			if (pinnedIndex !== null) return;
			moveChartTooltip(event.pageX, event.pageY);
		})
		.on('mouseleave', () => {
			if (pinnedIndex !== null) return;
			hideChartTooltip();
		})
		.on('click', (event, ponto) => {
			event.stopPropagation();
			if (pinnedIndex === ponto.index) {
				pinnedIndex = null;
				hideChartTooltip();
				return;
			}
			pinnedIndex = ponto.index;
			exibirTooltip(event, ponto);
		});

	svg.on('click', () => {
		pinnedIndex = null;
		hideChartTooltip();
	});

	grupo
		.append('g')
		.attr('transform', `translate(0,${alturaInterna})`)
		.call(axisBottom(escalaX).ticks(8));

	grupo
		.append('g')
		.call(axisLeft(escalaY).ticks(8));

	if (showXAxisLabel) {
		grupo
			.append('text')
			.attr('x', larguraInterna / 2)
			.attr('y', alturaInterna + margem.bottom - 14)
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
