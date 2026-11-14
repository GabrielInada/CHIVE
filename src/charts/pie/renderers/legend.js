import { formatNumber } from '../../../utils/formatters.js';
import { wrapSvgText } from '../../shared/svg/wrapText.js';

/** Lay out every pie category, wrapping narrow legends instead of cutting them off. */
export function appendPieLegend(svg, sectors, { stacked, width, locale, currency }) {
	const legend = svg.append('g').attr('class', stacked ? 'pie-legend-stacked' : null);
	let height = 0;
	sectors.forEach(item => {
		const row = legend.append('g').attr('transform', `translate(0,${height})`);
		row.append('rect')
			.attr('width', 10)
			.attr('height', 10)
			.attr('rx', 2)
			.attr('fill', item.color);
		const text = row.append('text')
			.attr('x', 14)
			.attr('y', stacked ? 11 : 9)
			.attr('font-size', stacked ? 12 : 10)
			.attr('fill', '#3f3a33')
			.text(`${item.label} (${formatNumber(item.value, locale, currency)})`);
		const lines = stacked ? wrapSvgText(text, width - 14) : 1;
		height += stacked ? Math.max(20, lines * 16 + 6) : 16;
	});
	return { legend, height: height + 16 };
}
