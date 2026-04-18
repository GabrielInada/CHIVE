import { arc, pie, select, zoom, zoomIdentity } from 'd3';
import { hideChartTooltip, moveChartTooltip, showChartTooltip } from './tooltip.js';
import { CHART_COLORS, CHART_DIMENSIONS, PIE_CHART } from '../../config/charts.js';
import { formatNumber } from '../../utils/formatters.js';
import { buildSliceColor as _buildSliceColor } from '../../utils/colorUtils.js';
import { ok, fail } from '../../utils/result.js';

function clamp(value, min, max) {
	return Math.min(Math.max(value, min), max);
}

function buildSliceColor(baseHex, index) {
	return _buildSliceColor(baseHex, index, CHART_COLORS.pie);
}

export function renderPieChart(container, dados, colunaCategoria, opcoes = {}) {
	if (!container || !colunaCategoria) return fail();

	const color = /^#[0-9a-fA-F]{6}$/.test(String(opcoes.color || '').trim())
		? String(opcoes.color).trim()
		: CHART_COLORS.pie;
	const locale = opcoes.locale || undefined;
		const customSliceColors = opcoes.customSliceColors || {};
	const labels = {
		categoria: opcoes.labels?.categoria || 'Category',
		contagem: opcoes.labels?.contagem || 'Count',
		percentual: opcoes.labels?.percentual || 'Percentage',
	};

	const rawInner = Number(opcoes.innerRadius);
	const rawOuter = Number(opcoes.outerRadius);
	const rawPadAngle = Number(opcoes.padAngle);
	const measureMode = opcoes.measureMode === 'sum' ? 'sum' : 'count';
	const valueColumn = opcoes.valueColumn || null;
	const showCategoryLabel = opcoes.showCategoryLabel !== false;
	const showValueLabel = opcoes.showValueLabel !== false;
	const showLegend = opcoes.showLegend !== false;
	const labelPosition = opcoes.labelPosition === 'outside' ? 'outside' : 'inside';
	const customTitle = String(opcoes.customTitle || '').trim().slice(0, 80);
	const chartHeight = Number.isFinite(Number(opcoes.chartHeight))
		? clamp(Number(opcoes.chartHeight), 220, 720)
		: CHART_DIMENSIONS.pie.height;

	const contador = new Map();
	dados.forEach(linha => {
		const valorBruto = linha[colunaCategoria];
		const categoria = valorBruto === null || valorBruto === undefined || valorBruto === ''
			? '—'
			: String(valorBruto);
		if (measureMode === 'sum') {
			if (!valueColumn) return;
			const valor = Number(linha[valueColumn]);
			if (!Number.isFinite(valor)) return;
			contador.set(categoria, (contador.get(categoria) || 0) + valor);
			return;
		}
		contador.set(categoria, (contador.get(categoria) || 0) + 1);
	});

	const linhas = Array.from(contador.entries())
		.map(([categoria, valor]) => ({ categoria, valor }))
		.sort((a, b) => b.valor - a.valor || String(a.categoria).localeCompare(String(b.categoria)));
	if (linhas.length === 0) {
		return fail(measureMode === 'sum' ? 'sum-no-numeric' : undefined);
	}

	container.innerHTML = '';
	hideChartTooltip();

	const largura = Math.max(container.clientWidth || CHART_DIMENSIONS.pie.width, 320);
	const altura = chartHeight;
	const margem = CHART_DIMENSIONS.pie.margins;
	const titleOffset = customTitle ? 18 : 0;
	const centerX = (largura - margem.left - margem.right) / 2 + margem.left;
	const centerY = (altura - margem.top - margem.bottom - titleOffset) / 2 + margem.top + titleOffset;
	const maxRadius = Math.max(PIE_CHART.minOuterRadius, Math.min(centerX - margem.left, centerY - margem.top));
	const outerRadius = clamp(
		Number.isFinite(rawOuter) ? rawOuter : PIE_CHART.defaultOuterRadius,
		PIE_CHART.minOuterRadius,
		Math.min(PIE_CHART.maxOuterRadius, maxRadius)
	);
	const innerRadius = clamp(
		Number.isFinite(rawInner) ? rawInner : PIE_CHART.defaultInnerRadius,
		PIE_CHART.minInnerRadius,
		Math.max(0, outerRadius - 8)
	);
	const total = linhas.reduce((acc, item) => acc + item.valor, 0);
	const padAngleDeg = clamp(
		Number.isFinite(rawPadAngle) ? rawPadAngle : PIE_CHART.defaultPadAngle,
		PIE_CHART.minPadAngle,
		PIE_CHART.maxPadAngle
	);
	const padAngleRad = (padAngleDeg * Math.PI) / 180;
	const zoomScale = clamp(
		Number.isFinite(Number(opcoes.zoomScale)) ? Number(opcoes.zoomScale) : PIE_CHART.defaultZoomScale,
		PIE_CHART.minZoomScale,
		PIE_CHART.maxZoomScale
	);

	const svg = select(container)
		.append('svg')
		.attr('width', largura)
		.attr('height', altura);

	const viewport = svg.append('g');

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

	const grupo = viewport
		.append('g')
		.attr('transform', `translate(${centerX},${centerY})`);

	const pieGenerator = pie()
		.sort(null)
		.padAngle(padAngleRad)
		.value(item => item.valor);

	const arcGenerator = arc()
		.innerRadius(innerRadius)
		.outerRadius(outerRadius);

	const labelArc = arc()
		.innerRadius(innerRadius + (outerRadius - innerRadius) * 0.62)
		.outerRadius(innerRadius + (outerRadius - innerRadius) * 0.62);

	let pinnedCategoria = null;

	const montarConteudoTooltip = item => {
		const percentual = total > 0 ? ((item.valor / total) * 100) : 0;
		const wrapper = document.createElement('div');
		const createLine = (rotulo, valor) => {
			const linha = document.createElement('div');
			const strong = document.createElement('strong');
			strong.textContent = `${rotulo}:`;
			linha.appendChild(strong);
			linha.append(` ${valor}`);
			return linha;
		};

		wrapper.appendChild(createLine(labels.categoria, item.categoria));
		wrapper.appendChild(createLine(labels.contagem, formatNumber(item.valor, locale)));
		wrapper.appendChild(createLine(labels.percentual, `${percentual.toFixed(1)}%`));
		return wrapper;
	};

	const exibirTooltip = (event, item) => {
		showChartTooltip(montarConteudoTooltip(item), event.pageX, event.pageY);
	};

	grupo
		.selectAll('path')
		.data(pieGenerator(linhas))
		.enter()
		.append('path')
		.attr('d', arcGenerator)
		.attr('fill', (item) => {
			const categoria = item.data.categoria;
			if (customSliceColors[categoria]) {
				return customSliceColors[categoria];
			}
			return buildSliceColor(color, linhas.findIndex(line => line.categoria === categoria));
		})
		.attr('stroke', '#fff')
		.attr('stroke-width', 1)
		.on('mouseenter', (event, item) => {
			if (pinnedCategoria !== null) return;
			exibirTooltip(event, item.data);
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
			if (pinnedCategoria === item.data.categoria) {
				pinnedCategoria = null;
				hideChartTooltip();
				return;
			}
			pinnedCategoria = item.data.categoria;
			exibirTooltip(event, item.data);
		});

	svg.on('click', () => {
		pinnedCategoria = null;
		hideChartTooltip();
	});

	const zoomBehavior = zoom()
		.extent([[0, 0], [largura, altura]])
		.scaleExtent([PIE_CHART.minZoomScale, PIE_CHART.maxZoomScale])
		.on('zoom', event => {
			viewport.attr('transform', event.transform);
		});

	svg.call(zoomBehavior);
	svg.call(zoomBehavior.transform, zoomIdentity.scale(zoomScale));

	const pieData = pieGenerator(linhas);
	if ((showCategoryLabel || showValueLabel) && labelPosition === 'inside') {
		grupo
			.selectAll('text')
			.data(pieData.filter(item => ((item.endAngle - item.startAngle) / (2 * Math.PI)) >= 0.04))
			.enter()
			.append('text')
			.attr('transform', item => `translate(${labelArc.centroid(item)})`)
			.attr('text-anchor', 'middle')
			.attr('font-size', 10)
			.attr('fill', '#fff')
			.selectAll('tspan')
			.data(item => {
				const parts = [];
				if (showCategoryLabel) parts.push({ text: String(item.data.categoria), dy: '0' });
				if (showValueLabel) parts.push({ text: formatNumber(item.data.valor, locale), dy: showCategoryLabel ? '1.1em' : '0' });
				return parts;
			})
			.enter()
			.append('tspan')
			.attr('x', 0)
			.attr('dy', part => part.dy)
			.text(part => part.text);
	}

	if ((showCategoryLabel || showValueLabel) && labelPosition === 'outside') {
		const outsideArc = arc()
			.innerRadius(outerRadius + 12)
			.outerRadius(outerRadius + 12);

		grupo
			.selectAll('polyline')
			.data(pieData.filter(item => ((item.endAngle - item.startAngle) / (2 * Math.PI)) >= 0.03))
			.enter()
			.append('polyline')
			.attr('stroke', '#6a655d')
			.attr('stroke-width', 1)
			.attr('fill', 'none')
			.attr('points', item => {
				const start = arcGenerator.centroid(item);
				const mid = outsideArc.centroid(item);
				const offsetX = mid[0] >= 0 ? 14 : -14;
				const end = [mid[0] + offsetX, mid[1]];
				return [start, mid, end].map(point => point.join(',')).join(' ');
			});

		grupo
			.selectAll('text.pie-outside-label')
			.data(pieData.filter(item => ((item.endAngle - item.startAngle) / (2 * Math.PI)) >= 0.03))
			.enter()
			.append('text')
			.attr('class', 'pie-outside-label')
			.attr('x', item => {
				const [x] = outsideArc.centroid(item);
				return x + (x >= 0 ? 18 : -18);
			})
			.attr('y', item => outsideArc.centroid(item)[1])
			.attr('text-anchor', item => outsideArc.centroid(item)[0] >= 0 ? 'start' : 'end')
			.attr('font-size', 10)
			.attr('fill', '#3f3a33')
			.selectAll('tspan')
			.data(item => {
				const parts = [];
				if (showCategoryLabel) parts.push({ text: String(item.data.categoria), dy: '0' });
				if (showValueLabel) parts.push({ text: formatNumber(item.data.valor, locale), dy: showCategoryLabel ? '1.1em' : '0' });
				return parts;
			})
			.enter()
			.append('tspan')
			.attr('x', function setX() { return this.parentNode.getAttribute('x'); })
			.attr('dy', part => part.dy)
			.text(part => part.text);
	}

	if (showLegend) {
		const legend = svg
			.append('g')
			.attr('transform', `translate(${Math.max(centerX + outerRadius + 26, largura - 180)},${Math.max(14, centerY - outerRadius)})`);

		linhas.slice(0, 8).forEach((item, index) => {
			const row = legend.append('g').attr('transform', `translate(0,${index * 16})`);
			row.append('rect')
				.attr('width', 10)
				.attr('height', 10)
				.attr('rx', 2)
				.attr('fill', customSliceColors[item.categoria] || buildSliceColor(color, index));
			row.append('text')
				.attr('x', 14)
				.attr('y', 9)
				.attr('font-size', 10)
				.attr('fill', '#3f3a33')
				.text(`${item.categoria} (${formatNumber(item.valor, locale)})`);
		});
	}

	return ok();
}
