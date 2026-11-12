/** Wrap SVG text at word boundaries, splitting long tokens without losing text. */

/**
 * Keeps a single-line label unchanged. Measurements use the rendered SVG font;
 * the estimate is for DOM test environments without SVG text measurement.
 *
 * @param {import('../../../../vendor/d3/d3.js').Selection} selection
 * @param {number} width - Available text width in CSS pixels.
 * @param {number} [lineHeight=16]
 * @returns {number} Number of rendered lines.
 */
export function wrapSvgText(selection, width, lineHeight = 16) {
	const node = selection.node();
	if (!node) return 0;
	const text = selection.text().trim();
	if (!text) return 0;
	const fontSize = Number(selection.attr('font-size')) || 13;
	const fits = value => {
		node.textContent = value;
		const measured = node.getComputedTextLength?.();
		return (measured || Array.from(value).length * fontSize * 0.6) <= Math.max(24, width);
	};
	if (fits(text)) return 1;
	const lines = [];
	let line = '';
	for (const word of text.split(/\s+/u)) {
		const candidate = line ? `${line} ${word}` : word;
		if (fits(candidate)) {
			line = candidate;
			continue;
		}
		if (line) lines.push(line);
		line = '';
		for (const character of word) {
			if (line && !fits(line + character)) {
				lines.push(line);
				line = '';
			}
			line += character;
		}
	}
	if (line) lines.push(line);
	selection.text('').attr('aria-label', text);
	lines.forEach((value, index) => {
		selection.append('tspan')
			.attr('x', selection.attr('x') || 0)
			.attr('dy', index === 0 ? 0 : lineHeight)
			.text(value);
	});
	return lines.length;
}
