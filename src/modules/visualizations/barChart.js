import { axisBottom, axisLeft, max, scaleBand, scaleLinear, select } from 'd3';

export function renderBarChart(container, dados, colunaCategoria) {
	if (!container || !colunaCategoria) return { ok: false };

	const contador = new Map();
	dados.forEach(linha => {
		const valorBruto = linha[colunaCategoria];
		const categoria = valorBruto === null || valorBruto === undefined || valorBruto === ''
			? '—'
			: String(valorBruto);
		contador.set(categoria, (contador.get(categoria) || 0) + 1);
	});

	const linhas = Array.from(contador.entries()).sort((a, b) => b[1] - a[1]);
	if (linhas.length === 0) return { ok: false };

	container.innerHTML = '';
	const largura = Math.max(container.clientWidth || 700, 320);
	const altura = 320;
	const margem = { top: 12, right: 12, bottom: 90, left: 52 };
	const larguraInterna = largura - margem.left - margem.right;
	const alturaInterna = altura - margem.top - margem.bottom;

	const svg = select(container)
		.append('svg')
		.attr('width', largura)
		.attr('height', altura);

	const grupo = svg
		.append('g')
		.attr('transform', `translate(${margem.left},${margem.top})`);

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
		.attr('fill', '#d4622a');

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
		.call(axisLeft(escalaY).ticks(6));

	return { ok: true };
}
