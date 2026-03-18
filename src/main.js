import {
	formatarTamanhoArquivo,
	parsearCSV,
	parsearJSON,
	processarDados,
} from './services/dataService.js';
import { filterVisibleColumns, getNumericColumnNames, getCategoricalColumnNames } from './utils/columnHelpers.js';
import {
	esconderErro,
	mostrarErro,
	renderizarEstadoVazio,
	renderizarInterface,
	renderizarListaArquivos,
} from './components/resultsView.js';
import { t, inicializarI18n, definirLocale, obterLocale } from './services/i18nService.js';
import { FILE_SIZE_LIMIT_BYTES, ROW_LIMIT, PREVIEW_DEFAULT_ROWS, SUPPORTED_FORMATS } from './config/index.js';

const datasetsCarregados = [];
let indiceAtivo = -1;
let linhasPreviewSelecionadas = PREVIEW_DEFAULT_ROWS;
let modoSidebar = 'dados';

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

	const colunasVisiveis = filterVisibleColumns(dataset);
	const numericas = getNumericColumnNames(colunasVisiveis);
	const categoricas = getCategoricalColumnNames(colunasVisiveis);
	const baseBar = categoricas.length > 0
		? categoricas
		: colunasVisiveis.map(coluna => coluna.nome);

	if (colunasVisiveis.length === 0) {
		container.innerHTML = `<div class="tabela-sem-colunas">${t('chive-chart-sidebar-empty')}</div>`;
		return;
	}

	const config = dataset.configGraficos;
	const barExpanded = config.bar.expanded === true;
	const scatterExpanded = config.scatter.expanded === true;

	const previewBarSVG = `
		<svg viewBox="0 0 84 38" aria-hidden="true">
			<rect x="6" y="18" width="10" height="14" rx="2"></rect>
			<rect x="22" y="10" width="10" height="22" rx="2"></rect>
			<rect x="38" y="14" width="10" height="18" rx="2"></rect>
			<rect x="54" y="6" width="10" height="26" rx="2"></rect>
			<rect x="70" y="21" width="8" height="11" rx="2"></rect>
		</svg>
	`;

	const previewScatterSVG = `
		<svg viewBox="0 0 84 38" aria-hidden="true">
			<circle cx="12" cy="28" r="2.6"></circle>
			<circle cx="22" cy="24" r="2.6"></circle>
			<circle cx="30" cy="19" r="2.6"></circle>
			<circle cx="40" cy="16" r="2.6"></circle>
			<circle cx="50" cy="13" r="2.6"></circle>
			<circle cx="61" cy="10" r="2.6"></circle>
			<circle cx="70" cy="7" r="2.6"></circle>
		</svg>
	`;

	container.innerHTML = `
		<article class="viz-card ${config.bar.enabled ? 'enabled' : ''}">
			<div class="viz-card-header">
				<label class="viz-toggle-linha">
					<input id="viz-toggle-bar" class="coluna-checkbox" type="checkbox" ${config.bar.enabled ? 'checked' : ''} />
					<span class="coluna-nome">${t('chive-chart-toggle-bar')}</span>
					<span class="viz-category-tag">${t('chive-viz-category-comparison')}</span>
				</label>
				<div class="viz-preview">${previewBarSVG}</div>
				<button id="viz-expand-bar" class="viz-expand-btn" type="button" aria-expanded="${barExpanded}" title="${barExpanded ? t('chive-viz-toggle-collapse') : t('chive-viz-toggle-expand')}">${barExpanded ? '▾' : '▸'}</button>
			</div>
			<p class="viz-card-desc">${t('chive-viz-bar-desc')}</p>
			<div id="viz-body-bar" class="viz-card-body" ${barExpanded ? '' : 'hidden'}>
				<div class="chart-controle">
					<label for="viz-select-bar">${t('chive-chart-control-bar-category')}</label>
					<select id="viz-select-bar" class="linhas-select" ${config.bar.enabled ? '' : 'disabled'}>
						<option value="">${t('chive-chart-option-none')}</option>
						${baseBar.map(nome => `<option value="${nome}" ${nome === config.bar.category ? 'selected' : ''}>${nome}</option>`).join('')}
					</select>
				</div>
				<div class="chart-controle">
					<label for="viz-select-bar-sort">${t('chive-chart-control-bar-sort')}</label>
					<select id="viz-select-bar-sort" class="linhas-select" ${config.bar.enabled ? '' : 'disabled'}>
						<option value="count-desc" ${config.bar.sort === 'count-desc' ? 'selected' : ''}>${t('chive-chart-sort-count-desc')}</option>
						<option value="count-asc" ${config.bar.sort === 'count-asc' ? 'selected' : ''}>${t('chive-chart-sort-count-asc')}</option>
						<option value="label-asc" ${config.bar.sort === 'label-asc' ? 'selected' : ''}>${t('chive-chart-sort-label-asc')}</option>
						<option value="label-desc" ${config.bar.sort === 'label-desc' ? 'selected' : ''}>${t('chive-chart-sort-label-desc')}</option>
					</select>
				</div>
				<div class="chart-controle">
					<label for="viz-select-bar-topn">${t('chive-chart-control-bar-topn')}</label>
					<select id="viz-select-bar-topn" class="linhas-select" ${config.bar.enabled ? '' : 'disabled'}>
						<option value="0" ${Number(config.bar.topN) === 0 ? 'selected' : ''}>${t('chive-chart-topn-all')}</option>
						<option value="10" ${Number(config.bar.topN) === 10 ? 'selected' : ''}>Top 10</option>
						<option value="20" ${Number(config.bar.topN) === 20 ? 'selected' : ''}>Top 20</option>
						<option value="50" ${Number(config.bar.topN) === 50 ? 'selected' : ''}>Top 50</option>
					</select>
				</div>
			</div>
		</article>

		<article class="viz-card ${config.scatter.enabled ? 'enabled' : ''}">
			<div class="viz-card-header">
				<label class="viz-toggle-linha">
					<input id="viz-toggle-scatter" class="coluna-checkbox" type="checkbox" ${config.scatter.enabled ? 'checked' : ''} />
					<span class="coluna-nome">${t('chive-chart-toggle-scatter')}</span>
					<span class="viz-category-tag">${t('chive-viz-category-relationship')}</span>
				</label>
				<div class="viz-preview">${previewScatterSVG}</div>
				<button id="viz-expand-scatter" class="viz-expand-btn" type="button" aria-expanded="${scatterExpanded}" title="${scatterExpanded ? t('chive-viz-toggle-collapse') : t('chive-viz-toggle-expand')}">${scatterExpanded ? '▾' : '▸'}</button>
			</div>
			<p class="viz-card-desc">${t('chive-viz-scatter-desc')}</p>
			<div id="viz-body-scatter" class="viz-card-body" ${scatterExpanded ? '' : 'hidden'}>
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
				<div class="chart-controle">
					<label for="viz-select-scatter-xscale">${t('chive-chart-control-scatter-xscale')}</label>
					<select id="viz-select-scatter-xscale" class="linhas-select" ${config.scatter.enabled ? '' : 'disabled'}>
						<option value="linear" ${config.scatter.xScale === 'linear' ? 'selected' : ''}>${t('chive-chart-scale-linear')}</option>
						<option value="log" ${config.scatter.xScale === 'log' ? 'selected' : ''}>${t('chive-chart-scale-log')}</option>
					</select>
				</div>
				<div class="chart-controle">
					<label for="viz-select-scatter-yscale">${t('chive-chart-control-scatter-yscale')}</label>
					<select id="viz-select-scatter-yscale" class="linhas-select" ${config.scatter.enabled ? '' : 'disabled'}>
						<option value="linear" ${config.scatter.yScale === 'linear' ? 'selected' : ''}>${t('chive-chart-scale-linear')}</option>
						<option value="log" ${config.scatter.yScale === 'log' ? 'selected' : ''}>${t('chive-chart-scale-log')}</option>
					</select>
				</div>
				<div class="chart-controle">
					<label for="viz-select-scatter-radius">${t('chive-chart-control-scatter-radius')}</label>
					<select id="viz-select-scatter-radius" class="linhas-select" ${config.scatter.enabled ? '' : 'disabled'}>
						<option value="2" ${Number(config.scatter.radius) === 2 ? 'selected' : ''}>2</option>
						<option value="3" ${Number(config.scatter.radius) === 3 ? 'selected' : ''}>3</option>
						<option value="4" ${Number(config.scatter.radius) === 4 ? 'selected' : ''}>4</option>
						<option value="6" ${Number(config.scatter.radius) === 6 ? 'selected' : ''}>6</option>
					</select>
				</div>
				<div class="chart-controle">
					<label for="viz-select-scatter-opacity">${t('chive-chart-control-scatter-opacity')}</label>
					<select id="viz-select-scatter-opacity" class="linhas-select" ${config.scatter.enabled ? '' : 'disabled'}>
						<option value="0.3" ${Number(config.scatter.opacity) === 0.3 ? 'selected' : ''}>30%</option>
						<option value="0.5" ${Number(config.scatter.opacity) === 0.5 ? 'selected' : ''}>50%</option>
						<option value="0.7" ${Number(config.scatter.opacity) === 0.7 ? 'selected' : ''}>70%</option>
						<option value="1" ${Number(config.scatter.opacity) === 1 ? 'selected' : ''}>100%</option>
					</select>
				</div>
			</div>
		</article>
	`;

	const toggleBar = document.getElementById('viz-toggle-bar');
	const toggleScatter = document.getElementById('viz-toggle-scatter');
	const selectBar = document.getElementById('viz-select-bar');
	const selectBarSort = document.getElementById('viz-select-bar-sort');
	const selectBarTopN = document.getElementById('viz-select-bar-topn');
	const selectX = document.getElementById('viz-select-x');
	const selectY = document.getElementById('viz-select-y');
	const selectScatterXScale = document.getElementById('viz-select-scatter-xscale');
	const selectScatterYScale = document.getElementById('viz-select-scatter-yscale');
	const selectScatterRadius = document.getElementById('viz-select-scatter-radius');
	const selectScatterOpacity = document.getElementById('viz-select-scatter-opacity');
	const expandBar = document.getElementById('viz-expand-bar');
	const expandScatter = document.getElementById('viz-expand-scatter');

	toggleBar.addEventListener('change', () => {
		atualizarConfigGraficosAtiva({
			...config,
			bar: {
				...config.bar,
				enabled: toggleBar.checked,
				expanded: toggleBar.checked ? true : config.bar.expanded,
			},
		});
	});

	toggleScatter.addEventListener('change', () => {
		atualizarConfigGraficosAtiva({
			...config,
			scatter: {
				...config.scatter,
				enabled: toggleScatter.checked,
				expanded: toggleScatter.checked ? true : config.scatter.expanded,
			},
		});
	});

	expandBar.addEventListener('click', () => {
		atualizarConfigGraficosAtiva({
			...config,
			bar: {
				...config.bar,
				expanded: !config.bar.expanded,
			},
		});
	});

	expandScatter.addEventListener('click', () => {
		atualizarConfigGraficosAtiva({
			...config,
			scatter: {
				...config.scatter,
				expanded: !config.scatter.expanded,
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

	selectBarSort.addEventListener('change', () => {
		atualizarConfigGraficosAtiva({
			...config,
			bar: {
				...config.bar,
				sort: selectBarSort.value || 'count-desc',
			},
		});
	});

	selectBarTopN.addEventListener('change', () => {
		atualizarConfigGraficosAtiva({
			...config,
			bar: {
				...config.bar,
				topN: Number(selectBarTopN.value) || 0,
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

	selectScatterXScale.addEventListener('change', () => {
		atualizarConfigGraficosAtiva({
			...config,
			scatter: {
				...config.scatter,
				xScale: selectScatterXScale.value === 'log' ? 'log' : 'linear',
			},
		});
	});

	selectScatterYScale.addEventListener('change', () => {
		atualizarConfigGraficosAtiva({
			...config,
			scatter: {
				...config.scatter,
				yScale: selectScatterYScale.value === 'log' ? 'log' : 'linear',
			},
		});
	});

	selectScatterRadius.addEventListener('change', () => {
		atualizarConfigGraficosAtiva({
			...config,
			scatter: {
				...config.scatter,
				radius: Number(selectScatterRadius.value) || 3,
			},
		});
	});

	selectScatterOpacity.addEventListener('change', () => {
		atualizarConfigGraficosAtiva({
			...config,
			scatter: {
				...config.scatter,
				opacity: Number(selectScatterOpacity.value) || 0.7,
			},
		});
	});
}

function atualizarEstadoBotaoAvancar(dataset) {
	const btnAvancar = document.getElementById('btn-avancar');
	btnAvancar.disabled = !dataset;
}

function normalizarConfigGraficos(dataset) {
	const colunasVisiveis = filterVisibleColumns(dataset);
	const numericas = getNumericColumnNames(colunasVisiveis);
	const categoricas = getCategoricalColumnNames(colunasVisiveis);
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
			enabled: barConfig.enabled === true,
			category: barCategoria,
			expanded: barConfig.expanded === true,
			sort: ['count-desc', 'count-asc', 'label-asc', 'label-desc'].includes(barConfig.sort)
				? barConfig.sort
				: 'count-desc',
			topN: [0, 10, 20, 50].includes(Number(barConfig.topN)) ? Number(barConfig.topN) : 0,
		},
		scatter: {
			enabled: scatterConfig.enabled === true,
			x: scatterX,
			y: scatterY,
			expanded: scatterConfig.expanded === true,
			xScale: scatterConfig.xScale === 'log' ? 'log' : 'linear',
			yScale: scatterConfig.yScale === 'log' ? 'log' : 'linear',
			radius: [2, 3, 4, 6].includes(Number(scatterConfig.radius)) ? Number(scatterConfig.radius) : 3,
			opacity: [0.3, 0.5, 0.7, 1].includes(Number(scatterConfig.opacity)) ? Number(scatterConfig.opacity) : 0.7,
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
			if (arquivo.size > FILE_SIZE_LIMIT_BYTES) {
				const confirmarArquivoGrande = window.confirm(
					t(
						'chive-warn-large-file',
						arquivo.name,
						formatarTamanhoArquivo(arquivo.size),
						formatarTamanhoArquivo(FILE_SIZE_LIMIT_BYTES)
					)
				);
				if (!confirmarArquivoGrande) {
					const erroCancelado = new Error('Upload cancelado pelo usuário (arquivo grande).');
					erroCancelado.cancelado = true;
					throw erroCancelado;
				}
			}

			const extensao = arquivo.name.split('.').pop().toLowerCase();
			if (!SUPPORTED_FORMATS.includes(extensao)) {
				throw new Error(t('chive-error-format', arquivo.name));
			}

			const textoArquivo = await lerArquivoTexto(arquivo);
			const dadosBrutos = extensao === 'csv'
				? parsearCSV(textoArquivo)
				: parsearJSON(textoArquivo);
			const { dados, colunas } = processarDados(dadosBrutos);

			if (dados.length > ROW_LIMIT) {
				const confirmarLinhas = window.confirm(
					t(
						'chive-warn-large-rows',
						arquivo.name,
						dados.length.toLocaleString(obterLocale()),
						ROW_LIMIT.toLocaleString(obterLocale())
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
						enabled: false,
						category: null,
						expanded: false,
						sort: 'count-desc',
						topN: 0,
					},
					scatter: {
						enabled: false,
						x: null,
						y: null,
						expanded: false,
						xScale: 'linear',
						yScale: 'linear',
						radius: 3,
						opacity: 0.7,
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
