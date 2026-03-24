/**
 * Create a chart card UI element with toggle and controls.
 * Uses textContent for dynamic labels and trusted inline SVG previews.
 */
export function createChartCard(container, chartName, enabled, expanded, label, category, description, previewSvg, controlsBuilder) {
	const article = document.createElement('article');
	article.className = enabled ? 'viz-card enabled' : 'viz-card';

	const header = document.createElement('div');
	header.className = 'viz-card-header';

	const toggleLabel = document.createElement('label');
	toggleLabel.className = 'viz-toggle-linha';

	const checkbox = document.createElement('input');
	checkbox.id = `viz-toggle-${chartName}`;
	checkbox.className = 'coluna-checkbox';
	checkbox.type = 'checkbox';
	checkbox.checked = enabled;

	const labelSpan = document.createElement('span');
	labelSpan.className = 'coluna-nome';
	labelSpan.textContent = label;

	const categoryTag = document.createElement('span');
	categoryTag.className = 'viz-category-tag';
	categoryTag.textContent = category;

	toggleLabel.appendChild(checkbox);
	toggleLabel.appendChild(labelSpan);
	toggleLabel.appendChild(categoryTag);

	const previewDiv = document.createElement('div');
	previewDiv.className = 'viz-preview';
	previewDiv.innerHTML = previewSvg;

	const expandBtn = document.createElement('button');
	expandBtn.id = `viz-expand-${chartName}`;
	expandBtn.className = 'viz-expand-btn';
	expandBtn.type = 'button';
	expandBtn.setAttribute('aria-expanded', String(expanded));
	expandBtn.textContent = expanded ? '▾' : '▸';

	header.appendChild(toggleLabel);
	header.appendChild(previewDiv);
	header.appendChild(expandBtn);

	const desc = document.createElement('p');
	desc.className = 'viz-card-desc';
	desc.textContent = description;

	const body = document.createElement('div');
	body.id = `viz-body-${chartName}`;
	body.className = 'viz-card-body';
	if (!expanded) {
		body.hidden = true;
	}

	const controls = controlsBuilder();
	controls.forEach(control => body.appendChild(control));

	article.appendChild(header);
	article.appendChild(desc);
	article.appendChild(body);

	container.appendChild(article);
}