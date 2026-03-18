let tooltipEl;

function ensureTooltip() {
	if (tooltipEl) return tooltipEl;

	tooltipEl = document.createElement('div');
	tooltipEl.className = 'chart-tooltip';
	tooltipEl.style.display = 'none';
	document.body.appendChild(tooltipEl);
	return tooltipEl;
}

export function hideChartTooltip() {
	const el = ensureTooltip();
	el.style.display = 'none';
}

export function showChartTooltip(html, x, y) {
	const el = ensureTooltip();
	el.innerHTML = html;
	el.style.display = 'block';
	moveChartTooltip(x, y);
}

export function moveChartTooltip(x, y) {
	const el = ensureTooltip();
	const offset = 12;
	el.style.left = `${x + offset}px`;
	el.style.top = `${y + offset}px`;
}
