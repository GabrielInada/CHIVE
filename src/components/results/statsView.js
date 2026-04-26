import { calculateStatistics, calculateCategoricalStatistics } from '../../services/dataService.js';
import { t, getLocale } from '../../services/i18nService.js';
import { formatNumber } from '../../utils/formatters.js';

function createStatLine(label, valor) {
	const linha = document.createElement('div');
	linha.className = 'stat-linha';
	const spanLabel = document.createElement('span');
	spanLabel.textContent = label;
	const spanValor = document.createElement('span');
	spanValor.textContent = valor;
	linha.appendChild(spanLabel);
	linha.appendChild(spanValor);
	return linha;
}

function formatPct(rate) {
	if (!Number.isFinite(rate)) return '0%';
	return `${(rate * 100).toFixed(1)}%`;
}

function truncateText(text, maxLength = 18) {
	const str = String(text ?? '');
	return str.length > maxLength ? `${str.slice(0, maxLength - 1)}…` : str;
}

export function renderStats(rows, visibleColumns) {
	const stats = calculateStatistics(rows, visibleColumns);
	const cardStats = document.getElementById('card-stats');

	if (stats.length > 0) {
		cardStats.style.display = 'block';
		document.getElementById('badge-num-colunas').textContent = t('chive-stats-badge', stats.length);
		const containerStats = document.getElementById('container-stats');
		containerStats.innerHTML = '';

		stats.forEach(stat => {
			const coluna = document.createElement('div');
			coluna.className = 'stat-col';

			const nome = document.createElement('div');
			nome.className = 'stat-col-nome';
			nome.title = stat.nome;
			nome.textContent = stat.nome;

			coluna.appendChild(nome);
			coluna.appendChild(createStatLine(t('chive-stat-valid'), stat.n.toLocaleString(getLocale())));
			coluna.appendChild(createStatLine(t('chive-stat-min'), formatNumber(stat.min)));
			coluna.appendChild(createStatLine(t('chive-stat-max'), formatNumber(stat.max)));
			coluna.appendChild(createStatLine(t('chive-stat-mean'), formatNumber(stat.media)));
			coluna.appendChild(createStatLine(t('chive-stat-median'), formatNumber(stat.mediana)));

			containerStats.appendChild(coluna);
		});
		return;
	}

	cardStats.style.display = 'none';
	document.getElementById('container-stats').innerHTML = '';
}

export function renderCategoricalStats(rows, visibleColumns) {
	const card = document.getElementById('card-cat-stats');
	if (!card) return;

	const stats = calculateCategoricalStatistics(rows, visibleColumns);
	const container = document.getElementById('container-cat-stats');
	const badge = document.getElementById('badge-cat-colunas');

	if (stats.length === 0) {
		card.style.display = 'none';
		if (container) container.innerHTML = '';
		return;
	}

	card.style.display = 'block';
	if (badge) badge.textContent = t('chive-cat-stats-badge', stats.length);
	if (!container) return;
	container.innerHTML = '';

	const locale = getLocale();

	stats.forEach(stat => {
		const coluna = document.createElement('div');
		coluna.className = 'stat-col';

		const nome = document.createElement('div');
		nome.className = 'stat-col-nome';
		nome.title = stat.nome;
		nome.textContent = stat.nome;
		coluna.appendChild(nome);

		if (stat.empty) {
			coluna.appendChild(createStatLine(t('chive-cat-stat-non-empty'), '0'));
			coluna.appendChild(createStatLine(
				t('chive-cat-stat-missing'),
				`${stat.missing.toLocaleString(locale)} (${formatPct(stat.missingPct)})`,
			));
			const empty = document.createElement('div');
			empty.className = 'stat-linha';
			const span = document.createElement('span');
			span.textContent = t('chive-cat-stat-empty');
			empty.appendChild(span);
			coluna.appendChild(empty);
			container.appendChild(coluna);
			return;
		}

		coluna.appendChild(createStatLine(t('chive-cat-stat-non-empty'), stat.n.toLocaleString(locale)));
		coluna.appendChild(createStatLine(
			t('chive-cat-stat-missing'),
			`${stat.missing.toLocaleString(locale)} (${formatPct(stat.missingPct)})`,
		));
		coluna.appendChild(createStatLine(
			t('chive-cat-stat-unique'),
			`${stat.unique.toLocaleString(locale)} (${formatPct(stat.uniquenessRate)})`,
		));
		const modeLine = createStatLine(
			t('chive-cat-stat-mode'),
			`${truncateText(stat.mode)} · ${stat.modeCount.toLocaleString(locale)} (${formatPct(stat.modePct)})`,
		);
		modeLine.title = String(stat.mode ?? '');
		coluna.appendChild(modeLine);
		coluna.appendChild(createStatLine(t('chive-cat-stat-top5-pct'), formatPct(stat.top5Pct)));

		container.appendChild(coluna);
	});
}
