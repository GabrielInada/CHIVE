import { csvParse, max, mean, median, min } from 'd3';

export function detectarTipo(valores) {
	const valoresValidos = valores
		.slice(0, 20)
		.filter(v => v !== null && v !== undefined && String(v).trim() !== '');

	if (valoresValidos.length === 0) return 'texto';

	const totalNumeros = valoresValidos.filter(v => !isNaN(Number(v))).length;
	if (totalNumeros / valoresValidos.length >= 0.8) return 'numero';

	const totalDatas = valoresValidos.filter(v => !isNaN(Date.parse(v))).length;
	if (totalDatas / valoresValidos.length >= 0.8) return 'data';

	return 'texto';
}

export function parsearCSV(texto) {
	const dados = csvParse(texto);

	if (dados.columns) delete dados.columns;
	if (dados.length === 0) throw new Error('O arquivo CSV está vazio.');

	return dados;
}

export function parsearJSON(texto) {
	let parsed;

	try {
		parsed = JSON.parse(texto);
	} catch {
		throw new Error('O arquivo JSON contém erros de sintaxe. Verifique o formato.');
	}

	if (Array.isArray(parsed)) {
		if (parsed.length === 0) throw new Error('O arquivo JSON está vazio.');
		return parsed;
	}

	if (typeof parsed === 'object' && parsed !== null) {
		const chaveArray = Object.keys(parsed).find(chave => Array.isArray(parsed[chave]));
		if (chaveArray) {
			const arr = parsed[chaveArray];
			if (arr.length === 0) throw new Error('O array de dados no JSON está vazio.');
			return arr;
		}
	}

	throw new Error('Formato JSON não reconhecido. O arquivo deve ser um array de objetos: [{...}, {...}]');
}

export function processarDados(dadosBrutos) {
	const nomesColunas = Object.keys(dadosBrutos[0]);

	const colunas = nomesColunas.map(nome => {
		const valores = dadosBrutos.map(linha => linha[nome]);
		return { nome, tipo: detectarTipo(valores) };
	});

	const dados = dadosBrutos.map(linha => {
		const linhaConvertida = {};

		colunas.forEach(({ nome, tipo }) => {
			const valor = linha[nome];
			if (tipo === 'numero' && valor !== '' && valor !== null && valor !== undefined) {
				linhaConvertida[nome] = Number(valor);
			} else {
				linhaConvertida[nome] = valor;
			}
		});

		return linhaConvertida;
	});

	return { dados, colunas };
}

export function calcularEstatisticas(dados, colunas) {
	return colunas
		.filter(coluna => coluna.tipo === 'numero')
		.map(({ nome }) => {
			const valores = dados
				.map(linha => linha[nome])
				.filter(valor => valor !== null && valor !== undefined && !isNaN(valor));

			if (valores.length === 0) return null;

			return {
				nome,
				n: valores.length,
				min: min(valores),
				max: max(valores),
				media: mean(valores),
				mediana: median(valores),
			};
		})
		.filter(Boolean);
}

export function formatarTamanhoArquivo(tamanho) {
	if (tamanho < 1024) return `${tamanho} B`;
	if (tamanho < 1024 * 1024) return `${(tamanho / 1024).toFixed(1)} KB`;
	return `${(tamanho / (1024 * 1024)).toFixed(1)} MB`;
}