import { axisBottom, axisLeft, max, scaleBand, scaleLinear, select } from 'd3';
import { hideChartTooltip, moveChartTooltip, showChartTooltip } from './tooltip.js';
import { BAR_CHART, CHART_DIMENSIONS, CHART_COLORS } from '../../config/index.js';
import { formatarNumero } from '../../utils/formatters.js';

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
	const labels = {
		categoria: opcoes.labels?.categoria || 'Category',
		contagem: opcoes.labels?.contagem || 'Count',
		percentual: opcoes.labels?.percentual || 'Percentage',
	};
	const locale = opcoes.locale || undefined;

	const contador = new Map();
	dados.forEach(linha => {
		const valorBruto = linha[colunaCategoria];
		const categoria = valorBruto === null || valorBruto === undefined || valorBruto === ''
			? '—'
			: String(valorBruto);
		contador.set(categoria, (contador.get(categoria) || 0) + 1);
	});

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
	const altura = CHART_DIMENSIONS.bar.height;
	const margem = CHART_DIMENSIONS.bar.margins;
	const larguraInterna = largura - margem.left - margem.right;
	const alturaInterna = altura - margem.top - margem.bottom;

	const svg = select(container)
		.append('svg')
		.attr('width', largura)
		.attr('height', altura);

	const grupo = svg
		.append('g')
		.attr('transform', `translate(${margem.left},${margem.top})`);

	let pinnedCategoria = null;

	const montarConteudoTooltip = item => {
		const percentual = totalContagem > 0 ? ((item[1] / totalContagem) * 100) : 0;
		const wrapper = document.createElement('div');

		const criarLinha = (rotulo, valor) => {
			const linha = document.createElement('div');
			const strong = document.createElement('strong');
			strong.textContent = `${rotulo}:`;
			linha.appendChild(strong);
			linha.append(` ${valor}`);
			return linha;
		};

		wrapper.appendChild(criarLinha(labels.categoria, String(item[0])));
		wrapper.appendChild(criarLinha(labels.contagem, formatarNumero(item[1], locale)));
		wrapper.appendChild(criarLinha(labels.percentual, `${percentual.toFixed(1)}%`));

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
		.attr('fill', CHART_COLORS.bar)
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

	return { ok: true };
}
