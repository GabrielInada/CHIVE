export function showChartMessage(containerId, message) {
	const container = document.getElementById(containerId);
	container.replaceChildren();
	const empty = document.createElement('div');
	empty.className = 'chart-vazio';
	empty.textContent = message;
	container.appendChild(empty);
}
