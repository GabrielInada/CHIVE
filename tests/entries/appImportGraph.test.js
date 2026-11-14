import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { moduleScriptSrcs, staticClosure } from '../helpers/importGraph.js';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const moduleEntries = moduleScriptSrcs(repoRoot, 'index.html');
const entry = moduleEntries[1];
const { visited, bareSpecs, dynamicReached } = staticClosure(repoRoot, entry);
const application = staticClosure(repoRoot, 'src/app/applicationInitializer.js');

describe('application startup import graph', () => {
	it('loads the dependency-free startup guard before the application entry', () => {
		expect(moduleEntries).toEqual([
			'src/entries/startupGuard.js',
			'src/entries/app.js',
		]);
	});

	it('uses only relative raw-static specifiers', () => {
		expect([...bareSpecs]).toEqual([]);
		expect([...application.bareSpecs]).toEqual([]);
	});

	it('keeps Three.js and the debug surface outside the static startup closure', () => {
		for (const deferred of [
			'src/app/applicationInitializer.js',
			'src/app/debugApi.js',
			'src/charts/scatter3d/renderers/three.js',
			'vendor/three/three.module.js',
			'vendor/three/three.core.js',
		]) {
			expect(visited.has(deferred), deferred).toBe(false);
		}
		expect(visited.has('src/app/diagnosticApi.js')).toBe(true);
		expect(visited.has('src/state/appState.js')).toBe(false);
	});

	it('records the expected on-demand entry points', () => {
		for (const deferred of [
			'src/app/applicationInitializer.js',
			'src/app/debugApi.js',
		]) {
			expect(dynamicReached.has(deferred), deferred).toBe(true);
		}
		expect(application.dynamicReached.has('src/charts/scatter3d/renderers/three.js')).toBe(true);
		expect(application.visited.has('vendor/three/three.module.js')).toBe(false);
	});

	it('fetches message catalogs instead of importing JSON modules', () => {
		const jsonModules = [...visited, ...dynamicReached, ...application.visited, ...application.dynamicReached]
			.filter(path => path.endsWith('.json'));
		expect(jsonModules).toEqual([]);
	});
});
