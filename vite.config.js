import { defineConfig } from 'vite';

const SOURCE_ENTRY_PRELOAD = /^[ \t]*<link rel="modulepreload" href="\.\/src\/entries\/[^"]+\.js" \/>\r?\n/gm;

// WHY: the HTML pages preload their source entry so raw static serving starts
// sooner. The build replaces that entry with a hashed bundle and emits its own
// preloads, so the source link only survives as an inlined `data:` URL, which
// the page CSP blocks (#184). Drop it before Vite processes the HTML.
export function dropSourceEntryPreloads() {
	return {
		name: 'chive:drop-source-entry-preloads',
		apply: 'build',
		transformIndexHtml: {
			order: 'pre',
			handler: html => html.replace(SOURCE_ENTRY_PRELOAD, ''),
		},
	};
}

export default defineConfig({
	plugins: [dropSourceEntryPreloads()],
});
