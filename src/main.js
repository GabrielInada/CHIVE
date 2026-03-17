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
import { t, inicializarI18n, definirLocale } from './services/i18nService.js';

const datasetsCarregados = [];
let indiceAtivo = -1;
let linhasPreviewSelecionadas = 10;

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
		atualizarSelecaoColunasAtivas
	);
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
			const extensao = arquivo.name.split('.').pop().toLowerCase();
			if (!['csv', 'json'].includes(extensao)) {
				throw new Error(t('chive-error-format', arquivo.name));
			}

			const textoArquivo = await lerArquivoTexto(arquivo);
			const dadosBrutos = extensao === 'csv'
				? parsearCSV(textoArquivo)
				: parsearJSON(textoArquivo);
			const { dados, colunas } = processarDados(dadosBrutos);

			return {
				nome: arquivo.name,
				tamanho: formatarTamanhoArquivo(arquivo.size),
				dados,
				colunas,
				colunasSelecionadas: colunas.map(coluna => coluna.nome),
			};
		})
	);

	const datasetsNovos = resultados
		.filter(resultado => resultado.status === 'fulfilled')
		.map(resultado => resultado.value);

	const erros = resultados
		.filter(resultado => resultado.status === 'rejected')
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
	const total = datasetsCarregados.length;

	alert(
		'Datasets prontos!\n\n' +
		`Total carregado: ${total} arquivo${total > 1 ? 's' : ''}.\n` +
		'No Dia 02, este botão vai enviar todos os datasets carregados.\n\n' +
		'Todos os datasets: window.datasetsCarregados\n' +
		'Dataset ativo: window.datasetAtivo\n\n' +
		'Abra o DevTools (F12 → Console) e digite:\n' +
		'window.datasetsCarregados'
	);
});

console.log('DataViz Dia 01 carregado.');
console.log('Carregue um ou vários CSV/JSON para começar.');

selectLinhasPreview.addEventListener('change', evento => {
	linhasPreviewSelecionadas = Number(evento.target.value) || 10;
	if (datasetsCarregados.length > 0) atualizarVisao();
});
