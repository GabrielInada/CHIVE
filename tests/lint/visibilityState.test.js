import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve('.');

function collectJavaScriptFiles(directory) {
	return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
		const absolutePath = path.join(directory, entry.name);
		if (entry.isDirectory()) return collectJavaScriptFiles(absolutePath);
		return entry.isFile() && entry.name.endsWith('.js') ? [absolutePath] : [];
	});
}

describe('visibility state policy', () => {
	it('keeps visibility out of inline display declarations', () => {
		const files = [
			...collectJavaScriptFiles(path.join(repoRoot, 'src')),
			path.join(repoRoot, 'index.html'),
			path.join(repoRoot, 'about.html'),
		];

		for (const file of files) {
			const source = readFileSync(file, 'utf8');
			const relativePath = path.relative(repoRoot, file);

			expect(source, `${relativePath} must use the hidden property for visibility state`)
				.not.toContain('.style.display');
			expect(source, `${relativePath} must not encode visibility in an inline style attribute`)
				.not.toMatch(/\bstyle\s*=\s*["'][^"']*\bdisplay\s*:/i);
		}
	});
});
