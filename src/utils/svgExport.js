function sanitizeFileName(value) {
	return String(value || 'chart')
		.trim()
		.toLowerCase()
		.replace(/\s+/g, '-')
		.replace(/[^a-z0-9._-]/g, '')
		.replace(/-+/g, '-')
		.replace(/^[-.]+|[-.]+$/g, '') || 'chart';
}

function ensureSvgAttributes(svg) {
	if (!svg.getAttribute('xmlns')) {
		svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
	}
	if (!svg.getAttribute('xmlns:xlink')) {
		svg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
	}

	const width = svg.getAttribute('width');
	const height = svg.getAttribute('height');
	if (!svg.getAttribute('viewBox') && width && height) {
		svg.setAttribute('viewBox', `0 0 ${Number(width)} ${Number(height)}`);
	}
}

export function captureSvgMarkupFromContainer(containerId) {
	const container = document.getElementById(containerId);
	if (!container) return { ok: false, reason: 'container-not-found' };

	const sourceSvg = container.querySelector('svg');
	if (!sourceSvg) return { ok: false, reason: 'svg-not-found' };

	const svg = sourceSvg.cloneNode(true);
	ensureSvgAttributes(svg);
	const serializer = new XMLSerializer();
	return { ok: true, svgMarkup: serializer.serializeToString(svg) };
}

export function downloadSvgMarkup(svgMarkup, fileNameBase) {
	if (!svgMarkup) return { ok: false, reason: 'empty-markup' };
	const blob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement('a');
	anchor.href = url;
	anchor.download = `${sanitizeFileName(fileNameBase)}.svg`;
	document.body.appendChild(anchor);
	anchor.click();
	anchor.remove();
	URL.revokeObjectURL(url);
	return { ok: true };
}

export function downloadSvgFromContainer(containerId, fileNameBase) {
	const capturado = captureSvgMarkupFromContainer(containerId);
	if (!capturado.ok) return capturado;
	return downloadSvgMarkup(capturado.svgMarkup, fileNameBase);
}
