import { csvParse, max, mean, median, min } from 'd3';
import { TYPE_DETECTION, COLUMN_TYPES, TYPE_DEFAULTS } from '../config/types.js';

export function detectType(values) {
	const validValues = values
		.slice(0, TYPE_DETECTION.sampleSize)
		.filter(v => v !== null && v !== undefined && String(v).trim() !== '');

	if (validValues.length === 0) return TYPE_DEFAULTS.fallback;

	const totalNumbers = validValues.filter(v => !isNaN(Number(v))).length;
	if (totalNumbers / validValues.length >= TYPE_DETECTION.numberThreshold) return COLUMN_TYPES.NUMBER;

	const totalDates = validValues.filter(v => !isNaN(Date.parse(v))).length;
	if (totalDates / validValues.length >= TYPE_DETECTION.dateThreshold) return COLUMN_TYPES.DATE;

	return TYPE_DEFAULTS.fallback;
}

export function parseCsv(text) {
	const rows = csvParse(text);

	if (rows.columns) delete rows.columns;
	if (rows.length === 0) throw new Error('O arquivo CSV está vazio.');

	return rows;
}

export function parseJson(text) {
	let parsed;

	try {
		parsed = JSON.parse(text);
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

export function processData(rawData) {
	const columnNames = Object.keys(rawData[0]);

	const columns = columnNames.map(name => {
		const values = rawData.map(row => row[name]);
		return { nome: name, tipo: detectType(values) };
	});

	const rows = rawData.map(row => {
		const convertedRow = {};

		columns.forEach(({ nome: name, tipo }) => {
			const value = row[name];
			if (tipo === 'numero' && value !== '' && value !== null && value !== undefined) {
				convertedRow[name] = Number(value);
			} else {
				convertedRow[name] = value;
			}
		});

		return convertedRow;
	});

	return { dados: rows, colunas: columns };
}

export function calculateStatistics(rows, columns) {
	return columns
		.filter(column => column.tipo === 'numero')
		.map(({ nome }) => {
			const values = rows
				.map(row => row[nome])
				.filter(value => value !== null && value !== undefined && !isNaN(value));

			if (values.length === 0) return null;

			return {
				nome,
				n: values.length,
				min: min(values),
				max: max(values),
				media: mean(values),
				mediana: median(values),
			};
		})
		.filter(Boolean);
}

export function formatFileSize(sizeBytes) {
	if (sizeBytes < 1024) return `${sizeBytes} B`;
	if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`;
	return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}