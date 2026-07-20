import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Linter } from 'eslint';

const toPosix = value => value.split(path.sep).join('/');

function relativeToRepo(repoRoot, absolutePath) {
	return toPosix(path.relative(repoRoot, absolutePath));
}

/**
 * Collect static and literal dynamic module specifiers from JavaScript source.
 *
 * @param {string} code
 * @param {string} label
 */
export function collectSpecifiers(code, label) {
	const staticSpecs = [];
	const dynamicSpecs = [];
	const linter = new Linter();
	const messages = linter.verify(code, {
		languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
		plugins: {
			graph: {
				rules: {
					collect: {
						create() {
							return {
								ImportDeclaration: node => staticSpecs.push(node.source.value),
								ExportNamedDeclaration: node => {
									if (node.source) staticSpecs.push(node.source.value);
								},
								ExportAllDeclaration: node => staticSpecs.push(node.source.value),
								ImportExpression: node => {
									if (
										node.source?.type === 'Literal'
										&& typeof node.source.value === 'string'
									) {
										dynamicSpecs.push(node.source.value);
									}
								},
							};
						},
					},
				},
			},
		},
		rules: { 'graph/collect': 'error' },
	});
	const fatal = messages.find(message => message.fatal);
	if (fatal) throw new Error(`Failed to parse ${label}: ${fatal.message}`);
	return { staticSpecs, dynamicSpecs };
}

/**
 * Walk the raw-static startup graph. JavaScript under src/ is traversed;
 * JSON and vendor files are recorded as leaves.
 *
 * @param {string} repoRoot
 * @param {string} entryRelPath
 */
export function staticClosure(repoRoot, entryRelPath) {
	const visited = new Set();
	const bareSpecs = new Set();
	const dynamicReached = new Set();

	const visit = relPath => {
		if (visited.has(relPath)) return;
		visited.add(relPath);
		if (!(relPath.startsWith('src/') && relPath.endsWith('.js'))) return;
		const absolutePath = path.join(repoRoot, relPath);
		const { staticSpecs, dynamicSpecs } = collectSpecifiers(
			readFileSync(absolutePath, 'utf8'),
			relPath,
		);
		for (const specifier of staticSpecs) {
			if (!specifier.startsWith('.')) {
				bareSpecs.add(specifier);
				continue;
			}
			visit(relativeToRepo(repoRoot, path.resolve(path.dirname(absolutePath), specifier)));
		}
		for (const specifier of dynamicSpecs) {
			if (!specifier.startsWith('.')) continue;
			dynamicReached.add(
				relativeToRepo(repoRoot, path.resolve(path.dirname(absolutePath), specifier)),
			);
		}
	};

	visit(entryRelPath);
	return { visited, bareSpecs, dynamicReached };
}

/**
 * @param {string} repoRoot
 * @param {string} htmlRelPath
 * @returns {string[]}
 */
export function moduleScriptSrcs(repoRoot, htmlRelPath) {
	const html = readFileSync(path.join(repoRoot, htmlRelPath), 'utf8');
	const pattern = /<script\b[^>]*\btype=["']module["'][^>]*\bsrc=["']([^"']+)["'][^>]*>/g;
	return Array.from(
		html.matchAll(pattern),
		match => toPosix(match[1]).replace(/^\.\//, ''),
	);
}
