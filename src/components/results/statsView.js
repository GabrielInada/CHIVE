import { calculateStatistics } from '../../services/dataService.js';
import { t, getLocale } from '../../services/i18nService.js';
import { formatNumber } from '../../utils/formatters.js';

export function renderStats(rows, visibleColumns) {
	const stats = calculateStatistics(rows, visibleColumns);
	const cardStats = document.getElementById('card-stats');

	if (stats.length > 0) {
		cardStats.style.display = 'block';
		document.getElementById('badge-num-colunas').textContent = t('chive-stats-badge', stats.length);
		const containerStats = document.getElementById('container-stats');
		containerStats.innerHTML = '';

		const createStatLine = (label, valor) => {
			const linha = document.createElement('div');
			linha.className = 'stat-linha';
			const spanLabel = document.createElement('span');
			spanLabel.textContent = label;
			const spanValor = document.createElement('span');
			spanValor.textContent = valor;
			linha.appendChild(spanLabel);
			linha.appendChild(spanValor);
			return linha;
		};

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
