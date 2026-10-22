import { readFileSync } from 'node:fs';
import path from 'node:path';
import { build } from 'vite';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve('.');
const SOURCE_PRELOAD = '<link rel="modulepreload" href="./src/entries/app.js" />';

async function builtIndexHtml() {
	const result = await build({
		root: repoRoot,
		configFile: path.join(repoRoot, 'vite.config.js'),
		logLevel: 'silent',
		build: { write: false },
	});
	const outputs = (Array.isArray(result) ? result : [result]).flatMap(bundle => bundle.output);
	return outputs.find(file => file.fileName === 'index.html').source;
}

describe('source entry preload (#184)', () => {
	it('keeps the source preload for raw static serving', () => {
		expect(readFileSync(path.join(repoRoot, 'index.html'), 'utf8')).toContain(SOURCE_PRELOAD);
	});

	it('leaves no source or data: preload in the built page', async () => {
		const html = await builtIndexHtml();
		expect(html).not.toContain('src/entries/');
		expect(html).not.toMatch(/<link[^>]+href="data:/);
		expect(html).toMatch(/<script type="module"[^>]+src="[^"]*assets\/index-[\w-]+\.js"/);
	}, 60_000);
});
