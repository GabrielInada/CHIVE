import { defineConfig } from 'vitest/config';

// Per-file environment is set with `// @vitest-environment jsdom` in tests
// that need the DOM. Keeping the global default at `node` preserves existing
// behavior; the setup file installs fake-indexeddb on globalThis so tests
// that exercise persistenceService get a working IndexedDB without each test
// having to register one.
export default defineConfig({
	test: {
		setupFiles: ['./tests/setup/indexeddb.js'],
		// Source files import d3 via the same full URL the (former) importmap
		// pointed to so the worker can resolve it without an importmap. Tests
		// run under Node, alias the URL to the local `d3` package so we don't
		// hit the network during `npm test`.
		alias: {
			'https://esm.sh/d3@7.9.0': 'd3',
			'https://esm.sh/banana-i18n@2.4.0': 'banana-i18n',
		},
	},
});
