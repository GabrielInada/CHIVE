import { calcularEstatisticas } from '../../services/dataService.js';
import { t, obterLocale } from '../../services/i18nService.js';
import { formatarNumero } from '../../utils/formatters.js';

export function renderizarStats(dados, colunasVisiveis) {
	const stats = calcularEstatisticas(dados, colunasVisiveis);
	const cardStats = document.getElementById('card-stats');

	if (stats.length > 0) {
		cardStats.style.display = 'block';
		document.getElementById('badge-num-colunas').textContent = t('chive-stats-badge', stats.length);
		const containerStats = document.getElementById('container-stats');
		containerStats.innerHTML = '';

		const criarLinhaStat = (label, valor) => {
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
			coluna.appendChild(criarLinhaStat(t('chive-stat-valid'), stat.n.toLocaleString(obterLocale())));
			coluna.appendChild(criarLinhaStat(t('chive-stat-min'), formatarNumero(stat.min)));
			coluna.appendChild(criarLinhaStat(t('chive-stat-max'), formatarNumero(stat.max)));
			coluna.appendChild(criarLinhaStat(t('chive-stat-mean'), formatarNumero(stat.media)));
			coluna.appendChild(criarLinhaStat(t('chive-stat-median'), formatarNumero(stat.mediana)));

			containerStats.appendChild(coluna);
		});
		return;
	}

	cardStats.style.display = 'none';
	document.getElementById('container-stats').innerHTML = '';
}
