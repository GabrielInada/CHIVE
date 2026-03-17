import {
	formatarTamanhoArquivo,
	parsearCSV,
	parsearJSON,
	processarDados,
} from './services/dataService.js';
import {
	esconderErro,
	mostrarErro,
	renderizarEstadoVazio,
	renderizarInterface,
	renderizarListaArquivos,
} from './components/resultsView.js';
import { t, inicializarI18n, definirLocale, obterLocale } from './services/i18nService.js';

const datasetsCarregados = [];
let indiceAtivo = -1;
let linhasPreviewSelecionadas = 10;
let modoSidebar = 'dados';
const LIMITE_ALERTA_TAMANHO_BYTES = 15 * 1024 * 1024;
const LIMITE_ALERTA_LINHAS = 200000;

window.datasetsCarregados = datasetsCarregados;
window.datasetAtivo = null;
window.dadosCarregados = null;
window.colunasDetectadas = null;

function sincronizarGlobais() {
	const datasetAtivo = datasetsCarregados[indiceAtivo] ?? null;
	window.datasetAtivo = datasetAtivo;
	window.dadosCarregados = datasetAtivo ? datasetAtivo.dados : null;
	window.colunasDetectadas = datasetAtivo ? datasetAtivo.colunas : null;
	window.colunasSelecionadasAtivas = datasetAtivo ? datasetAtivo.colunasSelecionadas : null;
}

function atualizarSelecaoColunasAtivas(colunasSelecionadas) {
	const datasetAtivo = datasetsCarregados[indiceAtivo];
	if (!datasetAtivo) return;

	datasetAtivo.colunasSelecionadas = colunasSelecionadas;
	atualizarVisao();
}

function atualizarConfigGraficosAtiva(configGraficos) {
	const datasetAtivo = datasetsCarregados[indiceAtivo];
	if (!datasetAtivo) return;

	datasetAtivo.configGraficos = {
		...datasetAtivo.configGraficos,
		...configGraficos,
	};
	atualizarVisao();
}

function atualizarModoSidebar(novoModo) {
	modoSidebar = novoModo === 'viz' ? 'viz' : 'dados';
	document.getElementById('sidebar-panel-dados').classList.toggle('ativo', modoSidebar === 'dados');
	document.getElementById('sidebar-panel-viz').classList.toggle('ativo', modoSidebar === 'viz');
}

function renderizarControlesVisualizacoesSidebar(dataset) {
	const container = document.getElementById('lista-visualizacoes-conteudo');
	if (!dataset) {
		container.innerHTML = `<div class="tabela-sem-colunas">${t('chive-chart-sidebar-empty')}</div>`;
		return;
	}

	const nomesSelecionados = Array.isArray(dataset.colunasSelecionadas)
		? dataset.colunasSelecionadas
		: dataset.colunas.map(coluna => coluna.nome);
	const colunasVisiveis = dataset.colunas.filter(coluna => nomesSelecionados.includes(coluna.nome));
	const numericas = colunasVisiveis.filter(coluna => coluna.tipo === 'numero').map(coluna => coluna.nome);
	const categoricas = colunasVisiveis.filter(coluna => coluna.tipo !== 'numero').map(coluna => coluna.nome);
	const baseBar = categoricas.length > 0
		? categoricas
		: colunasVisiveis.map(coluna => coluna.nome);

	if (colunasVisiveis.length === 0) {
		container.innerHTML = `<div class="tabela-sem-colunas">${t('chive-chart-sidebar-empty')}</div>`;
		return;
	}

	const config = dataset.configGraficos;
	container.innerHTML = `
		<label class="coluna-item">
			<input id="viz-toggle-bar" class="coluna-checkbox" type="checkbox" ${config.bar.enabled ? 'checked' : ''} />
			<span class="coluna-nome">${t('chive-chart-toggle-bar')}</span>
		</label>
		<div class="chart-controle">
			<label for="viz-select-bar">${t('chive-chart-control-bar-category')}</label>
			<select id="viz-select-bar" class="linhas-select" ${config.bar.enabled ? '' : 'disabled'}>
				<option value="">${t('chive-chart-option-none')}</option>
				${baseBar.map(nome => `<option value="${nome}" ${nome === config.bar.category ? 'selected' : ''}>${nome}</option>`).join('')}
			</select>
		</div>
		<label class="coluna-item">
			<input id="viz-toggle-scatter" class="coluna-checkbox" type="checkbox" ${config.scatter.enabled ? 'checked' : ''} />
			<span class="coluna-nome">${t('chive-chart-toggle-scatter')}</span>
		</label>
		<div class="chart-controle">
			<label for="viz-select-x">${t('chive-chart-control-scatter-x')}</label>
			<select id="viz-select-x" class="linhas-select" ${config.scatter.enabled ? '' : 'disabled'}>
				<option value="">${t('chive-chart-option-none')}</option>
				${numericas.map(nome => `<option value="${nome}" ${nome === config.scatter.x ? 'selected' : ''}>${nome}</option>`).join('')}
			</select>
		</div>
		<div class="chart-controle">
			<label for="viz-select-y">${t('chive-chart-control-scatter-y')}</label>
			<select id="viz-select-y" class="linhas-select" ${config.scatter.enabled ? '' : 'disabled'}>
				<option value="">${t('chive-chart-option-none')}</option>
				${numericas.map(nome => `<option value="${nome}" ${nome === config.scatter.y ? 'selected' : ''}>${nome}</option>`).join('')}
			</select>
		</div>
	`;

	const toggleBar = document.getElementById('viz-toggle-bar');
	const toggleScatter = document.getElementById('viz-toggle-scatter');
	const selectBar = document.getElementById('viz-select-bar');
	const selectX = document.getElementById('viz-select-x');
	const selectY = document.getElementById('viz-select-y');

	toggleBar.addEventListener('change', () => {
		atualizarConfigGraficosAtiva({
			...config,
			bar: {
				...config.bar,
				enabled: toggleBar.checked,
			},
		});
	});

	toggleScatter.addEventListener('change', () => {
		atualizarConfigGraficosAtiva({
			...config,
			scatter: {
				...config.scatter,
				enabled: toggleScatter.checked,
			},
		});
	});

	selectBar.addEventListener('change', () => {
		atualizarConfigGraficosAtiva({
			...config,
			bar: {
				...config.bar,
				category: selectBar.value || null,
			},
		});
	});

	selectX.addEventListener('change', () => {
		atualizarConfigGraficosAtiva({
			...config,
			scatter: {
				...config.scatter,
				x: selectX.value || null,
			},
		});
	});

	selectY.addEventListener('change', () => {
		atualizarConfigGraficosAtiva({
			...config,
			scatter: {
				...config.scatter,
				y: selectY.value || null,
			},
		});
	});
}

function atualizarEstadoBotaoAvancar(dataset) {
	const btnAvancar = document.getElementById('btn-avancar');
	if (!dataset) {
		btnAvancar.disabled = true;
		return;
	}

	const qtdSelecionadas = Array.isArray(dataset.colunasSelecionadas)
		? dataset.colunasSelecionadas.length
		: 0;
	btnAvancar.disabled = qtdSelecionadas === 0;
}

function normalizarConfigGraficos(dataset) {
	const nomesSelecionados = Array.isArray(dataset.colunasSelecionadas)
		? dataset.colunasSelecionadas
		: dataset.colunas.map(coluna => coluna.nome);
	const colunasVisiveis = dataset.colunas.filter(coluna => nomesSelecionados.includes(coluna.nome));
	const numericas = colunasVisiveis.filter(coluna => coluna.tipo === 'numero').map(coluna => coluna.nome);
	const categoricas = colunasVisiveis.filter(coluna => coluna.tipo !== 'numero').map(coluna => coluna.nome);
	const baseBar = categoricas.length > 0
		? categoricas
		: colunasVisiveis.map(coluna => coluna.nome);

	const configAtual = dataset.configGraficos || {};
	const aba = configAtual.aba === 'charts' ? 'charts' : 'preview';
	const barConfig = configAtual.bar || {};
	const scatterConfig = configAtual.scatter || {};
	const barCategoria = baseBar.includes(barConfig.category)
		? barConfig.category
		: (baseBar[0] ?? null);
	const scatterX = numericas.includes(scatterConfig.x)
		? scatterConfig.x
		: (numericas[0] ?? null);
	const scatterY = numericas.includes(scatterConfig.y)
		? scatterConfig.y
		: (numericas[1] ?? numericas[0] ?? null);

	dataset.configGraficos = {
		aba,
		bar: {
			enabled: barConfig.enabled !== false,
			category: barCategoria,
		},
		scatter: {
			enabled: scatterConfig.enabled !== false,
			x: scatterX,
			y: scatterY,
		},
	};
}

function atualizarVisao() {
	if (datasetsCarregados.length === 0) {
		indiceAtivo = -1;
		sincronizarGlobais();
		renderizarEstadoVazio();
		return;
	}

	if (indiceAtivo < 0 || indiceAtivo >= datasetsCarregados.length) {
		indiceAtivo = 0;
	}

	const datasetAtivo = datasetsCarregados[indiceAtivo];
	normalizarConfigGraficos(datasetAtivo);
	sincronizarGlobais();

	renderizarListaArquivos(
		datasetsCarregados,
		indiceAtivo,
		selecionarArquivo,
		removerArquivo
	);

	renderizarInterface(
		datasetAtivo.dados,
		datasetAtivo.colunas,
		datasetAtivo.nome,
		datasetAtivo.tamanho,
		linhasPreviewSelecionadas,
		datasetAtivo.colunasSelecionadas,
		atualizarSelecaoColunasAtivas,
		datasetAtivo.configGraficos,
		atualizarConfigGraficosAtiva
	);

	atualizarEstadoBotaoAvancar(datasetAtivo);
	renderizarControlesVisualizacoesSidebar(datasetAtivo);
}

function selecionarArquivo(indice) {
	if (indice < 0 || indice >= datasetsCarregados.length) return;
	indiceAtivo = indice;
	atualizarVisao();
}

function removerArquivo(indice) {
	if (indice < 0 || indice >= datasetsCarregados.length) return;

	datasetsCarregados.splice(indice, 1);

	if (datasetsCarregados.length === 0) {
		atualizarVisao();
		return;
	}

	if (indice < indiceAtivo) {
		indiceAtivo -= 1;
	} else if (indice === indiceAtivo) {
		indiceAtivo = Math.max(0, indiceAtivo - 1);
	}

	atualizarVisao();
}

function lerArquivoTexto(arquivo) {
	return new Promise((resolve, reject) => {
		const leitor = new FileReader();

		leitor.onload = evento => resolve(evento.target.result);
		leitor.onerror = () => reject(new Error(t('chive-error-read', arquivo.name)));

		leitor.readAsText(arquivo, 'UTF-8');
	});
}

async function processarArquivos(arquivos) {
	esconderErro();

	const listaArquivos = Array.from(arquivos);
	if (listaArquivos.length === 0) return;

	const resultados = await Promise.allSettled(
		listaArquivos.map(async arquivo => {
			if (arquivo.size > LIMITE_ALERTA_TAMANHO_BYTES) {
				const confirmarArquivoGrande = window.confirm(
					t(
						'chive-warn-large-file',
						arquivo.name,
						formatarTamanhoArquivo(arquivo.size),
						formatarTamanhoArquivo(LIMITE_ALERTA_TAMANHO_BYTES)
					)
				);
				if (!confirmarArquivoGrande) {
					const erroCancelado = new Error('Upload cancelado pelo usuário (arquivo grande).');
					erroCancelado.cancelado = true;
					throw erroCancelado;
				}
			}

			const extensao = arquivo.name.split('.').pop().toLowerCase();
			if (!['csv', 'json'].includes(extensao)) {
				throw new Error(t('chive-error-format', arquivo.name));
			}

			const textoArquivo = await lerArquivoTexto(arquivo);
			const dadosBrutos = extensao === 'csv'
				? parsearCSV(textoArquivo)
				: parsearJSON(textoArquivo);
			const { dados, colunas } = processarDados(dadosBrutos);

			if (dados.length > LIMITE_ALERTA_LINHAS) {
				const confirmarLinhas = window.confirm(
					t(
						'chive-warn-large-rows',
						arquivo.name,
						dados.length.toLocaleString(obterLocale()),
						LIMITE_ALERTA_LINHAS.toLocaleString(obterLocale())
					)
				);
				if (!confirmarLinhas) {
					const erroCancelado = new Error('Upload cancelado pelo usuário (muitas linhas).');
					erroCancelado.cancelado = true;
					throw erroCancelado;
				}
			}

			return {
				nome: arquivo.name,
				tamanho: formatarTamanhoArquivo(arquivo.size),
				dados,
				colunas,
				colunasSelecionadas: colunas.map(coluna => coluna.nome),
				configGraficos: {
					aba: 'preview',
					bar: {
						enabled: true,
						category: null,
					},
					scatter: {
						enabled: true,
						x: null,
						y: null,
					},
				},
			};
		})
	);

	const datasetsNovos = resultados
		.filter(resultado => resultado.status === 'fulfilled')
		.map(resultado => resultado.value);

	const erros = resultados
		.filter(resultado => resultado.status === 'rejected')
		.filter(resultado => !resultado.reason?.cancelado)
		.map(resultado => resultado.reason?.message || t('chive-error-unknown'));

	if (datasetsNovos.length > 0) {
		datasetsCarregados.push(...datasetsNovos);
		indiceAtivo = datasetsCarregados.length - 1;
		atualizarVisao();

		datasetsNovos.forEach(dataset => {
			console.log('✓ Dados carregados:', dataset.nome, '-', dataset.dados.length, 'linhas,', dataset.colunas.length, 'colunas');
		});
		console.log('Acesse todos os datasets via: window.datasetsCarregados');
	}

	if (erros.length > 0) {
		mostrarErro(erros.join(' | '));
		erros.forEach(erro => console.error(erro));
	}
}

const zonaUpload = document.getElementById('zona-upload');
const inputArquivo = document.getElementById('input-arquivo');
const botaoToggleSidebar = document.getElementById('btn-toggle-sidebar');
const selectLinhasPreview = document.getElementById('select-linhas-preview');
const selectLang = document.getElementById('select-lang');
const btnAvancar = document.getElementById('btn-avancar');
const btnEditarColunas = document.getElementById('btn-editar-colunas');

inicializarI18n();

linhasPreviewSelecionadas = Number(selectLinhasPreview.value) || 10;

function atualizarRotuloSidebar() {
	const recolhida = document.body.classList.contains('sidebar-collapsed');
	botaoToggleSidebar.textContent = recolhida ? '»' : '«';
	botaoToggleSidebar.setAttribute('aria-expanded', String(!recolhida));
	botaoToggleSidebar.setAttribute(
		'aria-label',
		recolhida ? t('chive-sidebar-expand') : t('chive-sidebar-collapse')
	);
	botaoToggleSidebar.title = recolhida ? t('chive-sidebar-expand') : t('chive-sidebar-collapse');
}

botaoToggleSidebar.addEventListener('click', () => {
	document.body.classList.toggle('sidebar-collapsed');
	atualizarRotuloSidebar();
});

atualizarRotuloSidebar();
atualizarModoSidebar('dados');

selectLang.addEventListener('change', evento => {
	definirLocale(evento.target.value);
});

window.addEventListener('chive-locale-changed', () => {
	atualizarRotuloSidebar();
	atualizarVisao();
});

zonaUpload.addEventListener('click', () => {
	inputArquivo.click();
});

zonaUpload.addEventListener('keydown', evento => {
	if (evento.key === 'Enter' || evento.key === ' ') inputArquivo.click();
});

inputArquivo.addEventListener('change', evento => {
	if (evento.target.files.length > 0) {
		processarArquivos(evento.target.files);
		evento.target.value = '';
	}
});

zonaUpload.addEventListener('dragover', evento => {
	evento.preventDefault();
	zonaUpload.classList.add('arrastando');
});

zonaUpload.addEventListener('dragleave', evento => {
	if (!zonaUpload.contains(evento.relatedTarget)) {
		zonaUpload.classList.remove('arrastando');
	}
});

zonaUpload.addEventListener('drop', evento => {
	evento.preventDefault();
	zonaUpload.classList.remove('arrastando');

	const arquivos = evento.dataTransfer.files;
	if (arquivos.length > 0) {
		processarArquivos(arquivos);
	}
});

document.addEventListener('dragover', evento => evento.preventDefault());
document.addEventListener('drop', evento => evento.preventDefault());

document.getElementById('btn-avancar').addEventListener('click', () => {
	if (datasetsCarregados.length === 0) return;
	const datasetAtivo = datasetsCarregados[indiceAtivo];
	if (!datasetAtivo || !Array.isArray(datasetAtivo.colunasSelecionadas) || datasetAtivo.colunasSelecionadas.length === 0) {
		return;
	}
	atualizarModoSidebar('viz');
});

btnEditarColunas.addEventListener('click', () => {
	atualizarModoSidebar('dados');
});

console.log('DataViz Dia 01 carregado.');
console.log('Carregue um ou vários CSV/JSON para começar.');

selectLinhasPreview.addEventListener('change', evento => {
	linhasPreviewSelecionadas = Number(evento.target.value) || 10;
	if (datasetsCarregados.length > 0) atualizarVisao();
});
