import { axisBottom, axisLeft, extent, scaleLinear, scaleLog, scalePoint, select } from 'd3';
import { hideChartTooltip, moveChartTooltip, showChartTooltip } from './tooltip.js';
import { SCATTER_PLOT, CHART_DIMENSIONS, CHART_COLORS } from '../../config/charts.js';
import { formatNumber } from '../../utils/formatters.js';
import { interpolateColor } from '../../utils/colorUtils.js';
import { ok, fail } from '../../utils/result.js';

const SCATTER_PALETTES = {
	Pastel: ['#FFB3BA', '#FFCCCB', '#FFFFBA', '#BAE1BA', '#BAC7FF', '#E0BBE4', '#FFDFD3', '#DFF8EB'],
	Bold: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2'],
	'Colorblind-Safe': ['#0173B2', '#029E73', '#ECE133', '#CC78BC', '#CA9161', '#949494', '#ECE2F0', '#A6ACAF'],
};

const AXIS_TYPE_VALUES = {
	numeric: 'numeric',
	categorical: 'categorical',
};

function normalizeCategoryValue(value) {
	if (value === null || value === undefined || value === '') return '—';
	return String(value);
}

function isNumericLikeAxisType(axisType) {
	const value = String(axisType || '').toLowerCase();
	return value === 'numeric' || value === 'number' || value === 'numero';
}

function isCategoricalLikeAxisType(axisType) {
	const value = String(axisType || '').toLowerCase();
	return value === 'categorical' || value === 'category' || value === 'text' || value === 'texto' || value === 'date' || value === 'data';
}

function inferAxisType(axisValues, configuredAxisType) {
	if (isNumericLikeAxisType(configuredAxisType)) return AXIS_TYPE_VALUES.numeric;
	if (isCategoricalLikeAxisType(configuredAxisType)) return AXIS_TYPE_VALUES.categorical;

	const validValues = axisValues
		.filter(value => value !== null && value !== undefined && String(value).trim() !== '');
	if (validValues.length === 0) return AXIS_TYPE_VALUES.categorical;

	const numericCount = validValues
		.filter(value => Number.isFinite(Number(value)))
		.length;

	return (numericCount / validValues.length) >= 0.8
		? AXIS_TYPE_VALUES.numeric
		: AXIS_TYPE_VALUES.categorical;
}

function deterministicJitter(index, axisSeed) {
	const raw = Math.sin((index + 1) * 12.9898 * axisSeed) * 43758.5453123;
	const fraction = raw - Math.floor(raw);
	return (fraction * 2) - 1;
}

function buildCategoryDomain(pontos, key) {
	const seen = new Set();
	const domain = [];
	pontos.forEach(ponto => {
		const value = ponto[key];
		if (seen.has(value)) return;
		seen.add(value);
		domain.push(value);
	});
	return domain;
}

function buildCategoryJitterScale(scale, maxJitterCap = 16) {
	const baseStep = Number.isFinite(scale?.step?.()) ? scale.step() : 0;
	const jitterMax = Math.max(0, Math.min(maxJitterCap, baseStep * 0.24));
	return (index, axisSeed) => deterministicJitter(index, axisSeed) * jitterMax;
}

function truncateCategoryTick(value, maxLength = 20) {
	const text = String(value);
	if (text.length <= maxLength) return text;
	return `${text.slice(0, Math.max(1, maxLength - 1))}…`;
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
	if (!container || !eixoX || !eixoY) return fail();
	const xScale = opcoes.xScale === 'log' ? 'log' : 'linear';
	const yScale = opcoes.yScale === 'log' ? 'log' : 'linear';
	const showXAxisLabel = opcoes.showXAxisLabel !== false;
	const showYAxisLabel = opcoes.showYAxisLabel !== false;
	const radius = Number.isFinite(Number(opcoes.radius)) ? Number(opcoes.radius) : SCATTER_PLOT.defaultRadius;
	const opacity = Number.isFinite(Number(opcoes.opacity)) ? Number(opcoes.opacity) : SCATTER_PLOT.defaultOpacity;
	const color = /^#[0-9a-fA-F]{6}$/.test(String(opcoes.color || '').trim())
		? String(opcoes.color).trim()
		: CHART_COLORS.scatter;
	const colorMode = ['uniform', 'numeric', 'category'].includes(opcoes.colorMode)
		? opcoes.colorMode
		: 'uniform';
	const colorField = opcoes.colorField || null;
	const gradientMinColor = /^#[0-9a-fA-F]{6}$/.test(String(opcoes.gradientMinColor || '').trim())
		? String(opcoes.gradientMinColor).trim()
		: color;
	const gradientMaxColor = /^#[0-9a-fA-F]{6}$/.test(String(opcoes.gradientMaxColor || '').trim())
		? String(opcoes.gradientMaxColor).trim()
		: '#ffffff';
	const colorScheme = SCATTER_PALETTES[opcoes.colorScheme] ? opcoes.colorScheme : 'Bold';
	const customTitle = String(opcoes.customTitle || '').trim().slice(0, 80);
	const chartHeight = Number.isFinite(Number(opcoes.chartHeight))
		? Math.max(220, Math.min(720, Number(opcoes.chartHeight)))
		: CHART_DIMENSIONS.scatter.height;
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
	const configuredAxisTypes = {
		x: opcoes.axisTypes?.x,
		y: opcoes.axisTypes?.y,
	};

	let pontos = dados.map((linha, index) => ({
		xRaw: linha?.[eixoX],
		yRaw: linha?.[eixoY],
		x: Number(linha?.[eixoX]),
		y: Number(linha?.[eixoY]),
		xCategory: normalizeCategoryValue(linha?.[eixoX]),
		yCategory: normalizeCategoryValue(linha?.[eixoY]),
		index,
		raw: linha,
	}));

	const axisTypes = {
		x: inferAxisType(pontos.map(ponto => ponto.xRaw), configuredAxisTypes.x),
		y: inferAxisType(pontos.map(ponto => ponto.yRaw), configuredAxisTypes.y),
	};

	const effectiveXScale = axisTypes.x === AXIS_TYPE_VALUES.numeric
		? xScale
		: 'linear';
	const effectiveYScale = axisTypes.y === AXIS_TYPE_VALUES.numeric
		? yScale
		: 'linear';

	pontos = pontos.filter(ponto => {
		if (axisTypes.x === AXIS_TYPE_VALUES.numeric && !Number.isFinite(ponto.x)) return false;
		if (axisTypes.y === AXIS_TYPE_VALUES.numeric && !Number.isFinite(ponto.y)) return false;
		return true;
	});

	if (effectiveXScale === 'log') {
		pontos = pontos.filter(ponto => ponto.x > 0);
	}

	if (effectiveYScale === 'log') {
		pontos = pontos.filter(ponto => ponto.y > 0);
	}

	if (pontos.length === 0) {
		return fail(effectiveXScale === 'log' || effectiveYScale === 'log' ? 'log-no-positive' : undefined);
	}

	container.innerHTML = '';
	hideChartTooltip();
	const largura = Math.max(container.clientWidth || CHART_DIMENSIONS.scatter.width, 320);
	const altura = chartHeight;
	const margem = CHART_DIMENSIONS.scatter.margins;
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

	let pinnedIndex = null;

	const montarConteudoTooltip = ponto => {
		const wrapper = document.createElement('div');

		const createLine = (rotulo, valor) => {
			const linha = document.createElement('div');
			const strong = document.createElement('strong');
			strong.textContent = `${rotulo}:`;
			linha.appendChild(strong);
			linha.append(` ${valor}`);
			return linha;
		};

		const xValue = axisTypes.x === AXIS_TYPE_VALUES.numeric
			? formatNumber(ponto.x, locale)
			: ponto.xCategory;
		const yValue = axisTypes.y === AXIS_TYPE_VALUES.numeric
			? formatNumber(ponto.y, locale)
			: ponto.yCategory;

		wrapper.appendChild(createLine(labels.eixoX, xValue));
		wrapper.appendChild(createLine(labels.eixoY, yValue));
		wrapper.appendChild(createLine(labels.indice, formatNumber(ponto.index + 1, locale)));

		return wrapper;
	};

	const exibirTooltip = (event, ponto) => {
		showChartTooltip(montarConteudoTooltip(ponto), event.pageX, event.pageY);
	};

	let escalaX;
	if (axisTypes.x === AXIS_TYPE_VALUES.numeric) {
		const dominioX = normalizarDominio(extent(pontos, ponto => ponto.x));
		escalaX = (effectiveXScale === 'log' ? scaleLog() : scaleLinear())
			.domain(dominioX)
			.nice()
			.range([0, larguraInterna]);
	} else {
		escalaX = scalePoint()
			.domain(buildCategoryDomain(pontos, 'xCategory'))
			.range([0, larguraInterna])
			.padding(0.5);
	}

	let escalaY;
	if (axisTypes.y === AXIS_TYPE_VALUES.numeric) {
		const dominioY = normalizarDominio(extent(pontos, ponto => ponto.y));
		escalaY = (effectiveYScale === 'log' ? scaleLog() : scaleLinear())
			.domain(dominioY)
			.nice()
			.range([alturaInterna, 0]);
	} else {
		escalaY = scalePoint()
			.domain(buildCategoryDomain(pontos, 'yCategory'))
			.range([alturaInterna, 0])
			.padding(0.5);
	}

	const xJitterFor = axisTypes.x === AXIS_TYPE_VALUES.categorical
		? buildCategoryJitterScale(escalaX)
		: () => 0;
	const yJitterFor = axisTypes.y === AXIS_TYPE_VALUES.categorical
		? buildCategoryJitterScale(escalaY)
		: () => 0;

	const getPointX = ponto => {
		if (axisTypes.x === AXIS_TYPE_VALUES.numeric) return escalaX(ponto.x);
		return (escalaX(ponto.xCategory) || 0) + xJitterFor(ponto.index, 1.7);
	};

	const getPointY = ponto => {
		if (axisTypes.y === AXIS_TYPE_VALUES.numeric) return escalaY(ponto.y);
		return (escalaY(ponto.yCategory) || 0) + yJitterFor(ponto.index, 2.3);
	};

	let getPointColor = () => color;
	if (colorMode === 'numeric' && colorField) {
		const numericValues = pontos
			.map(ponto => Number(ponto.raw?.[colorField]))
			.filter(Number.isFinite);
		if (numericValues.length > 0) {
			const min = Math.min(...numericValues);
			const max = Math.max(...numericValues);
			const delta = max - min || 1;
			getPointColor = ponto => {
				const v = Number(ponto.raw?.[colorField]);
				if (!Number.isFinite(v)) return color;
				return interpolateColor(gradientMinColor, gradientMaxColor, (v - min) / delta);
			};
		}
	}

	if (colorMode === 'category' && colorField) {
		const palette = SCATTER_PALETTES[colorScheme];
		const categoryMap = new Map();
		pontos.forEach(ponto => {
			const cat = ponto.raw?.[colorField] === null || ponto.raw?.[colorField] === undefined || ponto.raw?.[colorField] === ''
				? '—'
				: String(ponto.raw?.[colorField]);
			if (!categoryMap.has(cat)) {
				categoryMap.set(cat, palette[categoryMap.size % palette.length]);
			}
		});
		getPointColor = ponto => {
			const cat = ponto.raw?.[colorField] === null || ponto.raw?.[colorField] === undefined || ponto.raw?.[colorField] === ''
				? '—'
				: String(ponto.raw?.[colorField]);
			return categoryMap.get(cat) || color;
		};
	}

	grupo
		.selectAll('circle')
		.data(pontos)
		.enter()
		.append('circle')
		.attr('cx', ponto => getPointX(ponto))
		.attr('cy', ponto => getPointY(ponto))
		.attr('r', radius)
		.attr('fill', ponto => getPointColor(ponto))
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

	const xAxis = grupo
		.append('g')
		.attr('transform', `translate(0,${alturaInterna})`)
		.call(
			axisTypes.x === AXIS_TYPE_VALUES.numeric
				? axisBottom(escalaX).ticks(8)
				: axisBottom(escalaX).tickFormat(value => truncateCategoryTick(value))
		);

	const yAxis = grupo
		.append('g')
		.call(
			axisTypes.y === AXIS_TYPE_VALUES.numeric
				? axisLeft(escalaY).ticks(8)
				: axisLeft(escalaY).tickFormat(value => truncateCategoryTick(value))
		);

	if (axisTypes.x === AXIS_TYPE_VALUES.categorical) {
		xAxis
			.selectAll('text')
			.style('text-anchor', 'end')
			.attr('dx', '-0.55em')
			.attr('dy', '0.2em')
			.attr('transform', 'rotate(-28)');
	}

	if (axisTypes.y === AXIS_TYPE_VALUES.categorical) {
		yAxis
			.selectAll('text')
			.style('font-size', '10px');
	}

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

	return ok();
}
