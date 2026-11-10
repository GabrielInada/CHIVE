import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve('.');
const srcRoot = path.join(repoRoot, 'src');
const typeCatalog = path.join(srcRoot, 'types.js');
const RELATIVE_IMPORT = /\bimport\(\s*(['"])(\.{1,2}\/[^'"]*)\1\s*\)/g;

function collectJavaScriptFiles(directory) {
	return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
		const absolutePath = path.join(directory, entry.name);
		if (entry.isDirectory()) return collectJavaScriptFiles(absolutePath);
		return entry.isFile() && entry.name.endsWith('.js') ? [absolutePath] : [];
	});
}

// Only editors read JSDoc types such as `@typedef {import('../types.js').Dataset} Dataset`.
// When a move leaves one pointing at a missing file, the type quietly becomes `any` and no
// lint rule, test, or build step fails, so this scan checks every relative import() path
// in src/, comments included.
describe('relative import() paths', () => {
	it('point at files that exist', () => {
		const broken = [];
		let reachesTypeCatalog = false;

		for (const file of collectJavaScriptFiles(srcRoot)) {
			const relativePath = path.relative(repoRoot, file).split(path.sep).join('/');
			readFileSync(file, 'utf8').split(/\r?\n/).forEach((line, index) => {
				for (const match of line.matchAll(RELATIVE_IMPORT)) {
					const specifier = match[2];
					const target = path.resolve(path.dirname(file), specifier);
					if (target === typeCatalog) reachesTypeCatalog = true;
					if (!statSync(target, { throwIfNoEntry: false })?.isFile()) {
						broken.push(`${relativePath}:${index + 1} ${specifier}`);
					}
				}
			});
		}

		expect(reachesTypeCatalog, 'the scan should find the src/types.js typedef imports').toBe(true);
		expect(broken).toEqual([]);
	});
});
