import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { moduleScriptSrcs, staticClosure } from '../helpers/importGraph.js';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const moduleEntries = moduleScriptSrcs(repoRoot, 'index.html');
const entry = moduleEntries[1];
const { visited, bareSpecs, dynamicReached } = staticClosure(repoRoot, entry);

describe('application startup import graph', () => {
	it('loads the dependency-free startup guard before the application entry', () => {
		expect(moduleEntries).toEqual([
			'src/entries/startupGuard.js',
			'src/entries/app.js',
		]);
	});

	it('uses only relative raw-static specifiers', () => {
		expect([...bareSpecs]).toEqual([]);
	});

	it('keeps Three.js and the debug surface outside the static startup closure', () => {
		for (const deferred of [
			'src/app/debugApi.js',
			'src/charts/scatter3d/renderers/three.js',
			'vendor/three/three.module.js',
			'vendor/three/three.core.js',
		]) {
			expect(visited.has(deferred), deferred).toBe(false);
		}
	});

	it('records the expected on-demand entry points', () => {
		for (const deferred of [
			'src/app/debugApi.js',
			'src/charts/scatter3d/renderers/three.js',
			'src/i18n/en.json',
			'src/i18n/pt-BR.json',
		]) {
			expect(dynamicReached.has(deferred), deferred).toBe(true);
		}
	});
});
