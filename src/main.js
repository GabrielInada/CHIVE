import {
	formatarTamanhoArquivo,
	parsearCSV,
	parsearJSON,
	processarDados,
} from './services/dataService.js';
import {
	esconderErro,
	mostrarErro,
	renderizarInterface,
} from './components/resultsView.js';

window.dadosCarregados = null;
window.colunasDetectadas = null;

function processarArquivo(arquivo) {
	esconderErro();

	const extensao = arquivo.name.split('.').pop().toLowerCase();
	if (!['csv', 'json'].includes(extensao)) {
		mostrarErro('Formato não suportado. Envie um arquivo .csv ou .json');
		return;
	}

	const tamanhoFormatado = formatarTamanhoArquivo(arquivo.size);

	const leitor = new FileReader();

	leitor.onload = evento => {
		const textoArquivo = evento.target.result;

		try {
			const dadosBrutos = extensao === 'csv'
				? parsearCSV(textoArquivo)
				: parsearJSON(textoArquivo);

			const { dados, colunas } = processarDados(dadosBrutos);

			window.dadosCarregados = dados;
			window.colunasDetectadas = colunas;

			renderizarInterface(dados, colunas, arquivo.name, tamanhoFormatado);

			console.log('✓ Dados carregados:', dados.length, 'linhas,', colunas.length, 'colunas');
			console.log('  Colunas:', colunas.map(coluna => `${coluna.nome} (${coluna.tipo})`).join(', '));
			console.log('  Acesse via: window.dadosCarregados');
		} catch (erro) {
			mostrarErro(erro.message);
			console.error('Erro ao processar arquivo:', erro);
		}
	};

	leitor.onerror = () => {
		mostrarErro('Erro ao ler o arquivo. Tente novamente.');
	};

	leitor.readAsText(arquivo, 'UTF-8');
}

const zonaUpload = document.getElementById('zona-upload');
const inputArquivo = document.getElementById('input-arquivo');

zonaUpload.addEventListener('click', () => {
	inputArquivo.click();
});

zonaUpload.addEventListener('keydown', evento => {
	if (evento.key === 'Enter' || evento.key === ' ') inputArquivo.click();
});

inputArquivo.addEventListener('change', evento => {
	if (evento.target.files.length > 0) {
		processarArquivo(evento.target.files[0]);
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
		processarArquivo(arquivos[0]);
		if (arquivos.length > 1) {
			mostrarErro('Múltiplos arquivos detectados. Processando apenas o primeiro.');
		}
	}
});

document.addEventListener('dragover', evento => evento.preventDefault());
document.addEventListener('drop', evento => evento.preventDefault());

document.getElementById('btn-avancar').addEventListener('click', () => {
	alert(
		'Dados prontos!\n\n' +
		'No Dia 02, este botão vai abrir os gráficos.\n\n' +
		'Os dados estão em: window.dadosCarregados\n' +
		'As colunas estão em: window.colunasDetectadas\n\n' +
		'Abra o DevTools (F12 → Console) e digite:\n' +
		'window.dadosCarregados'
	);
});

console.log('DataViz Dia 01 carregado.');
console.log('Carregue um CSV ou JSON para começar.');
