import { defineConfig } from 'vitest/config';

// Per-file environment is set with `// @vitest-environment jsdom` in tests
// that need the DOM. Keeping the global default at `node` preserves existing
// behavior; the setup file installs fake-indexeddb on globalThis so tests
// that exercise persistenceService get a working IndexedDB without each test
// having to register one.
export default defineConfig({
	test: {
		setupFiles: ['./tests/setup/indexeddb.js'],
	},
});
