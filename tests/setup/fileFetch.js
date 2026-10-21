// Serve the repo's own files to `fetch`. Source modules build asset URLs with
// `new URL(path, import.meta.url)`. Under Vitest that is either a `file:` URL,
// which Node's fetch rejects, or (after Vite's asset transform in a jsdom test)
// a root path on the jsdom origin, where no server listens. Both read from
// disk here; every other URL goes to the real fetch, and a test that stubs
// `fetch` itself still replaces this one.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const networkFetch = globalThis.fetch;

function localPath(url) {
	if (url.protocol === 'file:') return fileURLToPath(url);
	if (globalThis.location && url.origin === globalThis.location.origin) {
		return path.join(repoRoot, decodeURIComponent(url.pathname));
	}
	return null;
}

globalThis.fetch = async (input, init) => {
	const raw = input instanceof Request ? input.url : String(input);
	const filePath = localPath(new URL(raw, globalThis.location?.href));
	if (!filePath) return networkFetch(input, init);
	try {
		return new Response(await readFile(filePath), { status: 200 });
	} catch {
		return new Response(null, { status: 404 });
	}
};
