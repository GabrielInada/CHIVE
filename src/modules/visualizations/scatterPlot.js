import { axisBottom, axisLeft, extent, scaleLinear, select } from 'd3';

function normalizarDominio([minimo, maximo]) {
	if (!Number.isFinite(minimo) || !Number.isFinite(maximo)) return [0, 1];
	if (minimo === maximo) {
		const delta = minimo === 0 ? 1 : Math.abs(minimo * 0.1);
		return [minimo - delta, maximo + delta];
	}
	return [minimo, maximo];
}

export function renderScatterPlot(container, dados, eixoX, eixoY) {
	if (!container || !eixoX || !eixoY) return { ok: false };

	const pontos = dados
		.map(linha => ({ x: Number(linha[eixoX]), y: Number(linha[eixoY]) }))
		.filter(ponto => Number.isFinite(ponto.x) && Number.isFinite(ponto.y));

	if (pontos.length === 0) return { ok: false };

	container.innerHTML = '';
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

	const dominioX = normalizarDominio(extent(pontos, ponto => ponto.x));
	const dominioY = normalizarDominio(extent(pontos, ponto => ponto.y));

	const escalaX = scaleLinear().domain(dominioX).nice().range([0, larguraInterna]);
	const escalaY = scaleLinear().domain(dominioY).nice().range([alturaInterna, 0]);

	grupo
		.selectAll('circle')
		.data(pontos)
		.enter()
		.append('circle')
		.attr('cx', ponto => escalaX(ponto.x))
		.attr('cy', ponto => escalaY(ponto.y))
		.attr('r', 2.8)
		.attr('fill', '#1a472a')
		.attr('opacity', 0.72);

	grupo
		.append('g')
		.attr('transform', `translate(0,${alturaInterna})`)
		.call(axisBottom(escalaX).ticks(8));

	grupo
		.append('g')
		.call(axisLeft(escalaY).ticks(8));

	return { ok: true };
}
