import { defineConfig } from 'vitest/config';

// Per-file environment is set with `// @vitest-environment jsdom` in tests
// that need the DOM. Keeping the global default at `node` preserves existing
// behavior; the setup file installs fake-indexeddb on globalThis so tests
// that exercise persistence get a working IndexedDB without each test
// having to register one.
export default defineConfig({
	test: {
		setupFiles: ['./tests/setup/indexeddb.js'],
		coverage: {
			// Report coverage for our own source only. Bundled third-party
			// libraries (d3, sqlite, banana-i18n) are large and barely
			// exercised, so including them buries the real numbers.
			include: ['src/**/*.js'],
			// types.js is JSDoc typedefs only; i18n holds JSON message
			// catalogs. Neither contains testable runtime logic. main.js (the
			// boot orchestrator) is left in deliberately so its real, untested
			// code stays visible.
			exclude: ['src/types.js', 'src/i18n/**'],
		},
	},
});
