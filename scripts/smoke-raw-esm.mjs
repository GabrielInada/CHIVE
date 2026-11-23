/**
 * Raw-ESM smoke test: boots CHIVE in headless Chrome from a plain static
 * server, the way production serves it, with no Vite in between.
 *
 * The server only serves the runtime manifest (index.html, about.html, src/,
 * vendor/), so a runtime reference to node_modules or any other file outside
 * the deployed set fails here the same way it would on GitHub Pages.
 *
 * It automates the "Local Static Test" checklist in
 * docs/deployment/static-hosting.md: the shell loads, a CSV upload reaches the
 * table, a chart renders, the auto-save lands in the SQLite worker, and a
 * reload restores the dataset. Any console error, uncaught exception, failed
 * request, or HTTP error on the page or in a worker fails the run.
 *
 * Chrome is found through CHROME_PATH or the usual install locations.
 * Usage: npm run smoke
 */

import { spawn } from 'node:child_process';
import { createReadStream, existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout } from 'node:timers';
import { fileURLToPath, URL } from 'node:url';
import { RUNTIME_FILE_SET } from './runtime-manifest.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const STEP_TIMEOUT_MS = 30_000;
// Late errors, such as a worker failing after the page reports ready, need a
// moment to arrive before a step counts as clean.
const SETTLE_MS = 750;

const MIME_TYPES = {
	'.html': 'text/html; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
	'.mjs': 'text/javascript; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.json': 'application/json; charset=utf-8',
	'.svg': 'image/svg+xml',
	'.png': 'image/png',
	'.ico': 'image/x-icon',
	'.woff2': 'font/woff2',
	'.wasm': 'application/wasm',
	'.txt': 'text/plain; charset=utf-8',
	'.md': 'text/plain; charset=utf-8',
};

const SAMPLE_CSV = 'region,sales\nNorth,10\nSouth,20\nEast,15\n';

const problems = [];
const report = (where, message) => problems.push(`[${where}] ${message}`);

// --- Static server -----------------------------------------------------------

function resolveRuntimePath(urlPath) {
	let relative;
	try {
		relative = decodeURIComponent(urlPath.split('?')[0]).replace(/^\/+/, '');
	} catch {
		return null;
	}
	if (relative === '') relative = 'index.html';
	const normalized = path.posix.normalize(relative);
	const [top] = normalized.split('/');
	if (normalized.startsWith('..') || !RUNTIME_FILE_SET.includes(top)) return null;
	return path.join(ROOT, normalized);
}

async function startServer() {
	const server = createServer(async (req, res) => {
		const file = resolveRuntimePath(req.url || '/');
		const info = file && await stat(file).catch(() => null);
		if (!info?.isFile()) {
			// The favicon request is the browser's own, not the app's.
			if (req.url !== '/favicon.ico') report('server', `404 ${req.url}`);
			res.writeHead(404).end();
			return;
		}
		const type = MIME_TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
		res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
		createReadStream(file).pipe(res);
	});
	await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
	return server;
}

// --- Chrome ------------------------------------------------------------------

function findChrome() {
	const candidates = [
		process.env.CHROME_PATH,
		'C:/Program Files/Google/Chrome/Application/chrome.exe',
		'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
		'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
		'/usr/bin/google-chrome',
		'/usr/bin/google-chrome-stable',
		'/usr/bin/chromium',
		'/usr/bin/chromium-browser',
	];
	const found = candidates.find(candidate => candidate && existsSync(candidate));
	if (!found) throw new Error('Chrome not found. Set CHROME_PATH to a Chrome or Chromium binary.');
	return found;
}

async function launchChrome(profileDir) {
	const args = [
		'--headless=new',
		'--remote-debugging-port=0',
		`--user-data-dir=${profileDir}`,
		'--no-first-run',
		'--no-default-browser-check',
		'--disable-extensions',
		'--window-size=1366,900',
		'about:blank',
	];
	// Ubuntu runners block the user namespaces Chrome's sandbox needs. The page
	// is our own code from 127.0.0.1, so CI runs without it.
	if (process.env.CI) args.unshift('--no-sandbox');
	const chrome = spawn(findChrome(), args, { stdio: 'ignore' });

	// Port 0 lets Chrome pick a free port; it writes the choice to this file.
	const portFile = path.join(profileDir, 'DevToolsActivePort');
	const deadline = Date.now() + STEP_TIMEOUT_MS;
	while (Date.now() < deadline) {
		const text = await readFile(portFile, 'utf8').catch(() => '');
		const [port, browserPath] = text.split(/\r?\n/);
		if (port && browserPath) return { chrome, wsUrl: `ws://127.0.0.1:${port}${browserPath}` };
		if (chrome.exitCode !== null) break;
		await delay(100);
	}
	chrome.kill();
	throw new Error('Chrome did not open a DevTools port.');
}

function connect(wsUrl) {
	const socket = new WebSocket(wsUrl);
	let nextId = 0;
	const pending = new Map();
	const listeners = new Set();

	socket.addEventListener('message', event => {
		const message = JSON.parse(event.data);
		if (message.id !== undefined) {
			const waiter = pending.get(message.id);
			pending.delete(message.id);
			if (message.error) waiter?.reject(new Error(`${waiter.method}: ${message.error.message}`));
			else waiter?.resolve(message.result);
			return;
		}
		for (const listener of listeners) listener(message);
	});

	const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
		const id = ++nextId;
		pending.set(id, { resolve, reject, method });
		socket.send(JSON.stringify({ id, method, params, sessionId }));
	});

	const opened = new Promise((resolve, reject) => {
		socket.addEventListener('open', resolve, { once: true });
		socket.addEventListener('error', () => reject(new Error('DevTools socket failed.')), { once: true });
	});

	return { opened, send, onEvent: fn => listeners.add(fn), close: () => socket.close() };
}

// --- Problem capture ----------------------------------------------------------

function describeRemote(arg) {
	if (arg.type === 'string') return arg.value;
	return arg.description ?? arg.value ?? arg.type;
}

/** Turn on error reporting for a page or worker session. */
async function watchSession(cdp, sessionId) {
	await Promise.all([
		cdp.send('Runtime.enable', {}, sessionId),
		cdp.send('Log.enable', {}, sessionId),
		cdp.send('Network.enable', {}, sessionId).catch(() => {}),
	]);
}

function captureProblems(cdp, sessionNames) {
	cdp.onEvent(({ method, params, sessionId }) => {
		const where = sessionNames.get(sessionId) || 'browser';
		if (method === 'Runtime.exceptionThrown') {
			const details = params.exceptionDetails;
			report(where, `uncaught: ${details.exception?.description || details.text}`);
		} else if (method === 'Runtime.consoleAPICalled' && (params.type === 'error' || params.type === 'assert')) {
			report(where, `console.${params.type}: ${params.args.map(describeRemote).join(' ')}`);
		} else if (method === 'Log.entryAdded' && params.entry.level === 'error') {
			report(where, `${params.entry.source}: ${params.entry.text} ${params.entry.url || ''}`.trim());
		} else if (method === 'Network.responseReceived' && params.response.status >= 400) {
			report(where, `HTTP ${params.response.status} ${params.response.url}`);
		} else if (method === 'Network.loadingFailed' && !params.canceled) {
			report(where, `request failed: ${params.errorText}`);
		}
	});
}

// --- Page helpers -------------------------------------------------------------

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function evaluate(cdp, sessionId, expression) {
	const { result, exceptionDetails } = await cdp.send('Runtime.evaluate', {
		expression,
		awaitPromise: true,
		returnByValue: true,
	}, sessionId);
	if (exceptionDetails) throw new Error(`evaluate failed: ${exceptionDetails.exception?.description || exceptionDetails.text}`);
	return result.value;
}

async function waitFor(cdp, sessionId, label, expression) {
	const deadline = Date.now() + STEP_TIMEOUT_MS;
	let last;
	while (Date.now() < deadline) {
		// Any reported problem fails the run, so stop instead of waiting out
		// the timeout on a page that will never get there.
		if (problems.length > stepProblemsBefore) {
			await delay(SETTLE_MS);
			throw new Error(`stopped waiting for ${label} after a reported problem`);
		}
		last = await evaluate(cdp, sessionId, expression).catch(error => error.message);
		if (last === true) return;
		if (typeof last === 'string' && last.startsWith('fail:')) throw new Error(`${label}: ${last}`);
		await delay(100);
	}
	throw new Error(`Timed out waiting for ${label} (last: ${JSON.stringify(last)})`);
}

async function navigate(cdp, sessionId, url) {
	const loaded = new Promise(resolve => {
		cdp.onEvent(function onLoad({ method, sessionId: from }) {
			if (method === 'Page.loadEventFired' && from === sessionId) resolve();
		});
	});
	await cdp.send('Page.navigate', { url }, sessionId);
	await loaded;
}

async function click(cdp, sessionId, selector) {
	await waitFor(cdp, sessionId, `${selector} to exist`, `Boolean(document.querySelector(${JSON.stringify(selector)}))`);
	await evaluate(cdp, sessionId, `document.querySelector(${JSON.stringify(selector)}).click()`);
}

let stepProblemsBefore = 0;

async function step(name, fn) {
	stepProblemsBefore = problems.length;
	await fn();
	await delay(SETTLE_MS);
	const fresh = problems.length - stepProblemsBefore;
	console.log(`${fresh ? 'FAIL' : 'ok  '} ${name}`);
}

const APP_READY = `(() => {
	const status = window.chiveDebug?.getStartupStatus?.();
	if (status?.status === 'failed') return 'fail: startup ' + JSON.stringify(status);
	return status?.status === 'ready'
		&& document.getElementById('app-shell')?.hidden === false
		&& document.getElementById('startup-screen')?.hidden === true;
})()`;

const persistence = expression => `(() => {
	const p = window.chiveDebug.getDiagnosticReport().persistence;
	return ${expression};
})()`;

// --- Run ------------------------------------------------------------------------

/** A worker's errors are only seen if the run attached to it. */
function expectWorker(sessionNames, file) {
	const names = [...sessionNames.values()];
	if (!names.some(name => name.startsWith('worker ') && name.includes(file))) {
		report('smoke', `never attached to ${file}; attached: ${names.join(', ')}`);
	}
}

async function run(cdp, page, origin, workDir, sessionNames) {
	await step('index.html boots to ready', async () => {
		await navigate(cdp, page, `${origin}/`);
		await waitFor(cdp, page, 'app ready', APP_READY);
		await waitFor(cdp, page, 'empty load from the SQLite worker', persistence(
			"p.load.status === 'empty' && p.backend.mode === 'worker' || 'load ' + JSON.stringify(p)",
		));
	});

	await step('CSV upload reaches the table', async () => {
		const csvPath = path.join(workDir, 'smoke.csv');
		await writeFile(csvPath, SAMPLE_CSV);
		const { root } = await cdp.send('DOM.getDocument', {}, page);
		const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: '#file-input' }, page);
		await cdp.send('DOM.setFileInputFiles', { nodeId, files: [csvPath] }, page);
		await waitFor(cdp, page, 'one dataset', 'window.chiveDebug.getStateSummary()?.datasetsCount === 1');
		await waitFor(cdp, page, 'three table rows', "document.querySelectorAll('#table-container table tbody tr').length === 3");
		expectWorker(sessionNames, 'dataIngestWorker.js');
	});

	await step('a bar chart renders', async () => {
		await click(cdp, page, '#tab-charts');
		await click(cdp, page, '#btn-advance');
		await click(cdp, page, '#viz-chart-picker-trigger');
		await click(cdp, page, '.chart-picker-card[data-chart-type="bar"]');
		// D3 keeps each mark's datum on the element, which tells bars apart
		// from background and legend rects.
		await waitFor(cdp, page, 'a bar per region', `[...document.querySelectorAll('#charts-grid svg rect')]
			.filter(rect => rect.__data__ !== undefined).length >= 3`);
	});

	await step('auto-save lands in the SQLite worker', async () => {
		await waitFor(cdp, page, 'saved', persistence(
			"p.save.status === 'saved' && p.backend.mode === 'worker' && p.backend.fallbackCount === 0 || 'save ' + JSON.stringify(p)",
		));
		expectWorker(sessionNames, 'persistWorker.js');
	});

	await step('reload restores the dataset', async () => {
		await navigate(cdp, page, `${origin}/`);
		await waitFor(cdp, page, 'app ready', APP_READY);
		await waitFor(cdp, page, 'restored load', persistence(
			"p.load.status === 'restored' || 'load ' + JSON.stringify(p)",
		));
		await waitFor(cdp, page, 'one restored dataset', 'window.chiveDebug.getStateSummary()?.datasetsCount === 1');
	});

	await step('the debug console API installs', async () => {
		await waitFor(cdp, page, 'chiveDebug.getState', "typeof window.chiveDebug?.getState === 'function'");
		const errors = await evaluate(cdp, page, 'window.chiveDebug.getErrorLog()');
		for (const entry of errors) report('app', `error log: ${entry.type} ${entry.name}: ${entry.message}`);
	});

	await step('about.html boots', async () => {
		await navigate(cdp, page, `${origin}/about.html`);
		await waitFor(cdp, page, 'about shell', `(() => document.getElementById('app-shell')?.hidden === false
			&& document.getElementById('startup-screen')?.hidden === true)()`);
	});
}

async function main() {
	const server = await startServer();
	const origin = `http://127.0.0.1:${server.address().port}`;
	const workDir = await mkdtemp(path.join(tmpdir(), 'chive-smoke-'));
	const profileDir = path.join(workDir, 'profile');
	let chrome;
	let cdp;
	let failure = null;

	try {
		const launched = await launchChrome(profileDir);
		chrome = launched.chrome;
		cdp = connect(launched.wsUrl);
		await cdp.opened;

		const sessionNames = new Map();
		captureProblems(cdp, sessionNames);

		// Workers start paused so their console and network are watched from
		// the first line. The persistence worker falls back to the main thread
		// silently, so a page-only capture would miss its failures.
		cdp.onEvent(async ({ method, params }) => {
			if (method !== 'Target.attachedToTarget') return;
			const { sessionId, targetInfo } = params;
			sessionNames.set(sessionId, `${targetInfo.type} ${targetInfo.url.replace(origin, '')}`);
			try {
				await watchSession(cdp, sessionId);
				await cdp.send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: true, flatten: true }, sessionId).catch(() => {});
			} finally {
				await cdp.send('Runtime.runIfWaitingForDebugger', {}, sessionId).catch(() => {});
			}
		});

		const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
		const { sessionId: page } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
		sessionNames.set(page, 'page');
		await watchSession(cdp, page);
		await cdp.send('Page.enable', {}, page);
		await cdp.send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: true, flatten: true }, page);

		await run(cdp, page, origin, workDir, sessionNames);
	} catch (error) {
		failure = error;
	} finally {
		await cdp?.send('Browser.close').catch(() => {});
		cdp?.close();
		chrome?.kill();
		server.close();
		await rm(workDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => {});
	}

	if (failure) console.error(`\nSmoke test stopped: ${failure.message}`);
	if (problems.length) {
		console.error(`\n${problems.length} problem(s):`);
		for (const problem of problems) console.error(`  ${problem}`);
	}
	if (failure || problems.length) {
		process.exitCode = 1;
	} else {
		console.log('\nRaw-ESM smoke test passed.');
	}
}

await main();
