import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { Linter } from 'eslint';

export const repoRoot = path.resolve(import.meta.dirname, '../..');

const toPosix = value => value.split(path.sep).join('/');

export function readRepoFile(relativePath) {
	return readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

export function extractJsonContract(markdown, contractName) {
	const escaped = contractName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const match = markdown.match(new RegExp(
		'```json\\s+' + escaped + '\\r?\\n([\\s\\S]*?)\\r?\\n```',
	));
	if (!match) throw new Error(`Missing JSON contract block: ${contractName}`);
	return JSON.parse(match[1]);
}

function tableCells(line) {
	if (!line.trim().startsWith('|')) return [];
	return line.trim().slice(1, -1).split('|').map(cell => cell.trim());
}

export function extractMarkdownTable(markdown, expectedHeaders) {
	const lines = markdown.split(/\r?\n/);
	const headerIndex = lines.findIndex(line => {
		const cells = tableCells(line);
		return cells.length === expectedHeaders.length
			&& cells.every((cell, index) => cell === expectedHeaders[index]);
	});
	if (headerIndex === -1) {
		throw new Error(`Missing Markdown table: ${expectedHeaders.join(' | ')}`);
	}

	const rows = [];
	for (let index = headerIndex + 2; index < lines.length; index += 1) {
		const cells = tableCells(lines[index]);
		if (cells.length !== expectedHeaders.length) break;
		rows.push(Object.fromEntries(
			expectedHeaders.map((header, cellIndex) => [header, cells[cellIndex]]),
		));
	}
	return rows;
}

export function stripInlineCode(value) {
	return value.replaceAll('`', '').trim();
}

export function splitContractSites(value) {
	const normalized = stripInlineCode(value);
	if (normalized === '—') return [];
	return normalized.split(/\s*<br\s*\/?\s*>\s*/i).filter(Boolean).sort();
}

function headingSlug(heading) {
	return heading
		.replace(/<[^>]*>/g, '')
		.replace(/`/g, '')
		.trim()
		.toLowerCase()
		.replace(/[^\p{L}\p{N}\s_-]/gu, '')
		.replace(/\s+/g, '-');
}

function markdownAnchors(markdown) {
	const anchors = new Set();
	const counts = new Map();
	for (const match of markdown.matchAll(/^#{1,6}\s+(.+?)\s*#*$/gm)) {
		const base = headingSlug(match[1]);
		const count = counts.get(base) || 0;
		counts.set(base, count + 1);
		anchors.add(count === 0 ? base : `${base}-${count}`);
	}
	return anchors;
}

export function localMarkdownLinkProblems(relativePaths) {
	const problems = [];
	for (const sourceRelativePath of relativePaths) {
		const sourceAbsolutePath = path.join(repoRoot, sourceRelativePath);
		const markdown = readFileSync(sourceAbsolutePath, 'utf8');
		for (const match of markdown.matchAll(/(?<!!)\[[^\]]*\]\(([^)]+)\)/g)) {
			let target = match[1].trim();
			if (target.startsWith('<') && target.endsWith('>')) {
				target = target.slice(1, -1);
			}
			if (/^[a-z][a-z\d+.-]*:/i.test(target) || target.startsWith('//')) continue;

			const [rawPath, rawFragment = ''] = target.split('#', 2);
			const decodedPath = decodeURIComponent(rawPath);
			const targetAbsolutePath = decodedPath
				? path.resolve(path.dirname(sourceAbsolutePath), decodedPath)
				: sourceAbsolutePath;
			if (!existsSync(targetAbsolutePath)) {
				problems.push(`${sourceRelativePath}: missing ${target}`);
				continue;
			}
			if (!rawFragment || path.extname(targetAbsolutePath).toLowerCase() !== '.md') continue;

			const anchors = markdownAnchors(readFileSync(targetAbsolutePath, 'utf8'));
			const fragment = decodeURIComponent(rawFragment).toLowerCase();
			if (!anchors.has(fragment)) {
				problems.push(`${sourceRelativePath}: missing anchor #${fragment} in ${toPosix(path.relative(repoRoot, targetAbsolutePath))}`);
			}
		}
	}
	return problems;
}

export function sourceMapTreePaths(markdown) {
	return extractMarkdownTable(markdown, ['Path', 'Role'])
		.map(row => stripInlineCode(row.Path));
}

export function missingRepoPaths(relativePaths) {
	return relativePaths
		.filter(relativePath => !existsSync(path.join(repoRoot, relativePath)))
		.sort();
}

function enclosingFunctionName(node) {
	let current = node.parent;
	while (current) {
		if (current.type === 'FunctionDeclaration' && current.id?.name) {
			return current.id.name;
		}
		if (current.type === 'FunctionExpression' || current.type === 'ArrowFunctionExpression') {
			if (current.id?.name) return current.id.name;
			if (current.parent?.type === 'VariableDeclarator' && current.parent.id.type === 'Identifier') {
				return current.parent.id.name;
			}
			if (current.parent?.type === 'Property' && current.parent.key.type === 'Identifier') {
				return current.parent.key.name;
			}
		}
		current = current.parent;
	}
	return '<module>';
}

function stateEventConstant(node) {
	if (node?.type !== 'MemberExpression') return null;
	if (node.object?.type !== 'Identifier' || node.object.name !== 'STATE_EVENTS') return null;
	if (!node.computed && node.property?.type === 'Identifier') return node.property.name;
	if (node.computed && node.property?.type === 'Literal') return String(node.property.value);
	return null;
}

function javascriptFiles(directory) {
	const files = [];
	for (const entry of readdirSync(directory, { withFileTypes: true })) {
		const absolutePath = path.join(directory, entry.name);
		if (entry.isDirectory()) files.push(...javascriptFiles(absolutePath));
		else if (entry.isFile() && entry.name.endsWith('.js')) files.push(absolutePath);
	}
	return files;
}

function addSite(map, eventName, site) {
	if (!map.has(eventName)) map.set(eventName, new Set());
	map.get(eventName).add(site);
}

export function collectStateBusSites() {
	const emitters = new Map();
	const subscribers = new Map();
	for (const absolutePath of javascriptFiles(path.join(repoRoot, 'src'))) {
		const relativePath = toPosix(path.relative(repoRoot, absolutePath));
		const linter = new Linter();
		const messages = linter.verify(readFileSync(absolutePath, 'utf8'), {
			languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
			plugins: {
				docs: {
					rules: {
						collectStateBusSites: {
							create() {
								return {
									CallExpression(node) {
										if (node.callee.type !== 'Identifier') return;
										if (!['emitStateChange', 'onStateChange'].includes(node.callee.name)) return;
										const eventName = stateEventConstant(node.arguments[0]);
										if (!eventName) return;
										const target = node.callee.name === 'emitStateChange' ? emitters : subscribers;
										addSite(target, eventName, `${relativePath}#${enclosingFunctionName(node)}`);
									},
								};
							},
						},
					},
				},
			},
			rules: { 'docs/collectStateBusSites': 'error' },
		});
		const fatal = messages.find(message => message.fatal);
		if (fatal) throw new Error(`Failed to parse ${relativePath}: ${fatal.message}`);
	}

	const normalize = map => Object.fromEntries(
		[...map.entries()].map(([eventName, sites]) => [eventName, [...sites].sort()]),
	);
	return { emitters: normalize(emitters), subscribers: normalize(subscribers) };
}

function collectVariableValue(relativePath, variableName, readValue) {
	let value;
	const linter = new Linter();
	const messages = linter.verify(readRepoFile(relativePath), {
		languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
		plugins: {
			docs: {
				rules: {
					collectVariable: {
						create() {
							return {
								VariableDeclarator(node) {
									if (node.id.type === 'Identifier' && node.id.name === variableName) {
										value = readValue(node.init);
									}
								},
							};
						},
					},
				},
			},
		},
		rules: { 'docs/collectVariable': 'error' },
	});
	const fatal = messages.find(message => message.fatal);
	if (fatal) throw new Error(`Failed to parse ${relativePath}: ${fatal.message}`);
	if (value === undefined) throw new Error(`Missing ${variableName} in ${relativePath}`);
	return value;
}

export function eslintMutableGetterLists() {
	const inlinePattern = collectVariableValue(
		'eslint.config.js',
		'FACADE_MUTABLE_GETTERS',
		node => node?.type === 'Literal' ? node.value : undefined,
	);
	const inline = inlinePattern.slice(1, -1).split('|').sort();

	const tracked = collectVariableValue(
		'eslint-rules/no-facade-getter-mutation.js',
		'TRACKED_GETTERS',
		node => {
			const elements = node?.type === 'NewExpression'
				&& node.callee.type === 'Identifier'
				&& node.callee.name === 'Set'
				&& node.arguments[0]?.type === 'ArrayExpression'
				? node.arguments[0].elements
				: null;
			return elements?.map(element => element.value).sort();
		},
	);
	return { inline, tracked };
}

export function readStringConstant(relativePath, variableName) {
	return collectVariableValue(
		relativePath,
		variableName,
		node => node?.type === 'Literal' ? node.value : undefined,
	);
}

export function sqliteTableNames() {
	return Array.from(
		readRepoFile('src/services/persistence/sqlite/core.js')
			.matchAll(/CREATE TABLE IF NOT EXISTS\s+([a-z_]+)/g),
		match => match[1],
	).sort();
}

export function sqliteIndexedDbVersion() {
	const match = readRepoFile('src/services/persistence/backends/blobBackend.js')
		.match(/getIndexedDb\(\)\.open\(dbName,\s*(\d+)\)/);
	if (!match) throw new Error('Missing IndexedDB open version in blobBackend.js');
	return Number(match[1]);
}
