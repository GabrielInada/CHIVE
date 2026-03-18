import { axisBottom, axisLeft, extent, scaleLinear, scaleLog, select } from 'd3';
import { hideChartTooltip, moveChartTooltip, showChartTooltip } from './tooltip.js';

function formatarNumero(valor, locale) {
	if (!Number.isFinite(valor)) return '—';
	return Number.isInteger(valor)
		? valor.toLocaleString(locale)
		: valor.toLocaleString(locale, { maximumFractionDigits: 4 });
}

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
	const radius = Number.isFinite(Number(opcoes.radius)) ? Number(opcoes.radius) : 3;
	const opacity = Number.isFinite(Number(opcoes.opacity)) ? Number(opcoes.opacity) : 0.7;
 	const labels = {
		eixoX: opcoes.labels?.eixoX || 'X',
		eixoY: opcoes.labels?.eixoY || 'Y',
		indice: opcoes.labels?.indice || 'Index',
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
	const largura = Math.max(container.clientWidth || 700, 320);
	const altura = 320;
	const margem = { top: 12, right: 12, bottom: 44, left: 52 };
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

	const montarHtmlTooltip = ponto => `
		<div><strong>${labels.eixoX}:</strong> ${formatarNumero(ponto.x, locale)}</div>
		<div><strong>${labels.eixoY}:</strong> ${formatarNumero(ponto.y, locale)}</div>
		<div><strong>${labels.indice}:</strong> ${formatarNumero(ponto.index + 1, locale)}</div>
	`;

	const exibirTooltip = (event, ponto) => {
		showChartTooltip(montarHtmlTooltip(ponto), event.pageX, event.pageY);
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
		.attr('fill', '#1a472a')
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

	return { ok: true };
}
