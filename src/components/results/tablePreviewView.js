import { t } from '../../services/i18nService.js';
import { formatNumber } from '../../utils/formatters.js';

function translateType(tipo) {
	if (tipo === 'numero') return t('chive-type-number');
	if (tipo === 'texto') return t('chive-type-text');
	return tipo;
}

export function renderTablePreview(dados, colunasVisiveis, limite) {
	const containerTabela = document.getElementById('container-tabela');
	if (colunasVisiveis.length === 0) {
		containerTabela.innerHTML = '';
		const vazio = document.createElement('div');
		vazio.className = 'tabela-sem-colunas';
		vazio.textContent = t('chive-no-columns-selected');
		containerTabela.appendChild(vazio);
		return;
	}

	const linhasPreviewDados = dados.slice(0, limite);
	const tabela = document.createElement('table');
	tabela.className = 'tabela-preview';

	const thead = document.createElement('thead');
	const trHead = document.createElement('tr');
	colunasVisiveis.forEach(({ nome, tipo }) => {
		const th = document.createElement('th');
		if (tipo === 'numero') th.classList.add('num');
		th.textContent = nome;
		trHead.appendChild(th);
	});
	thead.appendChild(trHead);

	const tbody = document.createElement('tbody');
	linhasPreviewDados.forEach(linha => {
		const tr = document.createElement('tr');
		colunasVisiveis.forEach(({ nome, tipo }) => {
			const td = document.createElement('td');
			if (tipo === 'numero') td.classList.add('num');
			const val = linha[nome];
			const exibir = val === null || val === undefined || val === ''
				? '—'
				: (tipo === 'numero' ? formatNumber(val) : String(val));
			td.textContent = exibir;
			tr.appendChild(td);
		});
		tbody.appendChild(tr);
	});

	const tfoot = document.createElement('tfoot');
	const trFoot = document.createElement('tr');
	colunasVisiveis.forEach(({ tipo }) => {
		const td = document.createElement('td');
		td.textContent = translateType(tipo);
		trFoot.appendChild(td);
	});
	tfoot.appendChild(trFoot);

	tabela.appendChild(thead);
	tabela.appendChild(tbody);
	tabela.appendChild(tfoot);

	containerTabela.innerHTML = '';
	containerTabela.appendChild(tabela);
}
