import { dsvFormat, max, mean, median, min } from 'd3';
import { TYPE_DETECTION, COLUMN_TYPES, TYPE_DEFAULTS } from '../config/types.js';

function normalizeKeyValue(value, { trim = true, caseSensitive = false } = {}) {
	if (value === null || value === undefined) return '';

	if (typeof value === 'number') {
		if (!Number.isFinite(value)) return '';
		return `n:${String(value)}`;
	}

	if (typeof value === 'boolean') {
		return `b:${String(value)}`;
	}

	if (value instanceof Date && !Number.isNaN(value.getTime())) {
		return `d:${value.toISOString()}`;
	}

	let text = String(value);
	if (trim) text = text.trim();
	if (!caseSensitive) text = text.toLowerCase();
	return `s:${text}`;
}

function buildCompositeKey(row, keyColumns, normalizationOptions) {
	return keyColumns
		.map(columnName => normalizeKeyValue(row?.[columnName], normalizationOptions))
		.join('\u0001');
}

function ensureUniqueColumnName(baseName, usedNames) {
	if (!usedNames.has(baseName)) {
		usedNames.add(baseName);
		return baseName;
	}

	let suffix = 2;
	let nextName = `${baseName}_${suffix}`;
	while (usedNames.has(nextName)) {
		suffix += 1;
		nextName = `${baseName}_${suffix}`;
	}
	usedNames.add(nextName);
	return nextName;
}

function sanitizePrefix(fileName, fallback) {
	const base = String(fileName || '')
		.replace(/\.[^.]+$/, '')
		.trim()
		.replace(/[^\w\- ]+/g, '')
		.replace(/\s+/g, '-');
	return base || fallback;
}

export function joinDatasets({
	leftRows,
	rightRows,
	leftKeys,
	rightKeys,
	joinType = 'inner',
	leftColumns,
	rightColumns,
	leftDatasetName,
	rightDatasetName,
	normalization = { trim: true, caseSensitive: false },
}) {
	if (!Array.isArray(leftRows) || !Array.isArray(rightRows)) {
		throw new Error('join-invalid-datasets');
	}

	if (!Array.isArray(leftKeys) || !Array.isArray(rightKeys) || leftKeys.length === 0 || rightKeys.length === 0) {
		throw new Error('join-keys-required');
	}

	if (leftKeys.length !== rightKeys.length) {
		throw new Error('join-keys-mismatch');
	}

	const normalizedJoinType = ['inner', 'left', 'right', 'full'].includes(joinType) ? joinType : 'inner';
	const selectedLeftColumns = Array.isArray(leftColumns) ? leftColumns : [];
	const selectedRightColumns = Array.isArray(rightColumns) ? rightColumns : [];

	const conflicts = new Set(selectedLeftColumns.filter(columnName => selectedRightColumns.includes(columnName)));
	const usedOutputNames = new Set();
	const leftPrefix = sanitizePrefix(leftDatasetName, 'left');
	const rightPrefix = sanitizePrefix(rightDatasetName, 'right');

	const leftColumnMap = selectedLeftColumns.map(columnName => {
		const baseName = conflicts.has(columnName) ? `${leftPrefix}.${columnName}` : columnName;
		return {
			source: columnName,
			output: ensureUniqueColumnName(baseName, usedOutputNames),
		};
	});

	const rightColumnMap = selectedRightColumns.map(columnName => {
		const baseName = conflicts.has(columnName) ? `${rightPrefix}.${columnName}` : columnName;
		return {
			source: columnName,
			output: ensureUniqueColumnName(baseName, usedOutputNames),
		};
	});

	const rightIndex = new Map();
	rightRows.forEach((row, rowIndex) => {
		const key = buildCompositeKey(row, rightKeys, normalization);
		const bucket = rightIndex.get(key) || [];
		bucket.push({ row, rowIndex });
		rightIndex.set(key, bucket);
	});

	const matchedRightIndices = new Set();
	const outputRows = [];

	const pushMergedRow = (leftRow, rightRow) => {
		const merged = {};

		leftColumnMap.forEach(({ source, output }) => {
			merged[output] = leftRow ? leftRow[source] : null;
		});

		rightColumnMap.forEach(({ source, output }) => {
			merged[output] = rightRow ? rightRow[source] : null;
		});

		outputRows.push(merged);
	};

	leftRows.forEach(leftRow => {
		const key = buildCompositeKey(leftRow, leftKeys, normalization);
		const matches = rightIndex.get(key) || [];

		if (matches.length > 0) {
			matches.forEach(({ row, rowIndex }) => {
				matchedRightIndices.add(rowIndex);
				pushMergedRow(leftRow, row);
			});
			return;
		}

		if (normalizedJoinType === 'left' || normalizedJoinType === 'full') {
			pushMergedRow(leftRow, null);
		}
	});

	if (normalizedJoinType === 'right' || normalizedJoinType === 'full') {
		rightRows.forEach((rightRow, rightIndexValue) => {
			if (matchedRightIndices.has(rightIndexValue)) return;
			pushMergedRow(null, rightRow);
		});
	}

	return {
		rows: outputRows,
		outputColumns: [
			...leftColumnMap.map(item => item.output),
			...rightColumnMap.map(item => item.output),
		],
	};
}

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

/**
 * Detect the delimiter used in a delimited text file by inspecting the first line.
 * Counts occurrences of each candidate delimiter and returns the one with the highest count.
 * In case of a tie, priority order is: comma → semicolon → tab → pipe.
 *
 * @param {string} firstLine - The first non-empty line of the file content
 * @returns {string} The detected delimiter character
 */
export function detectDelimiter(firstLine) {
	const candidates = [',', ';', '\t', '|'];
	const scores = candidates.map(delimiter => ({
		delimiter,
		count: firstLine.split(delimiter).length - 1,
	}));

	// Find the maximum count
	const maxCount = Math.max(...scores.map(s => s.count));

	// If nothing scored, fall back to comma
	if (maxCount === 0) return ',';

	// Return the first (highest-priority) delimiter that achieved the max count
	return scores.find(s => s.count === maxCount).delimiter;
}

/**
 * Parse a delimited text file with automatic delimiter detection.
 * Inspects the first line to detect the delimiter, then parses the full content.
 *
 * @param {string} text - Full file content as a string
 * @returns {Array<Object>} Parsed rows as plain objects
 */
export function parseCsv(text) {
	if (!text || text.trim().length === 0) {
		throw new Error('O arquivo CSV está vazio.');
	}

	const firstLine = text.split(/\r?\n/).find(line => line.trim().length > 0) || '';
	const delimiter = detectDelimiter(firstLine);
	const rows = dsvFormat(delimiter).parse(text);

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
	if (!Array.isArray(rawData)) {
		throw new Error('rawData must be an array');
	}

	if (rawData.length === 0) {
		return { dados: [], colunas: [] };
	}

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