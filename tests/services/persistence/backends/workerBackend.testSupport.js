import { vi } from 'vitest';
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import { createBlobBackend } from '../../../../src/services/persistence/backends/blobBackend.js';
import { createPersistHandler } from '../../../../src/workers/persistWorker.js';

export const sqlite3Ready = sqlite3InitModule().then(sqlite3 => {
	sqlite3.config.log = () => {};
	sqlite3.config.warn = () => {};
	return sqlite3;
});

export const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Flexible Worker double. `postMessage` records the message and optionally
// hands it to a `_deliver(data, self)` driver (a real handler for round-trips,
// or a script for forced responses). `emit` / `emitError` simulate the worker
// posting back / crashing.
export class MockWorker {
	constructor() {
		this.onmessage = null;
		this.onerror = null;
		this.terminated = false;
		this.posted = [];
		this._deliver = null;
	}
	postMessage(data) {
		this.posted.push(data);
		if (this._deliver) this._deliver(data, this);
	}
	terminate() { this.terminated = true; }
	emit(message) { if (this.onmessage) this.onmessage({ data: message }); }
	emitError(event = {}) { if (this.onerror) this.onerror(event); }
}

// Back a MockWorker with a real createPersistHandler + real SQLite backend, so
// postMessage → reconstruct → SQLite write → emit, exactly like production.
export function attachRealHandler(worker, dbName, gate) {
	const backend = createBlobBackend({ initSqlite: () => sqlite3Ready, dbName });
	const handler = createPersistHandler(backend, msg => worker.emit(msg));
	worker._deliver = data => {
		if (gate && !gate()) return;     // gated workers stop responding (hang)
		void handler.handleMessage(data);
	};
	worker._backend = backend;
}

export function spyFallback(dbName) {
	const real = createBlobBackend({ initSqlite: () => sqlite3Ready, dbName });
	return {
		available: () => real.available(),
		hydrate: vi.fn(() => real.hydrate()),
		persist: vi.fn(snapshot => real.persist(snapshot)),
		exportBytes: vi.fn((snapshot, options) => real.exportBytes(snapshot, options)),
		importBytes: vi.fn(bytes => real.importBytes(bytes)),
		clear: vi.fn(() => real.clear()),
	};
}

// Build a persistence-shaped snapshot. Pass explicit payload refs to simulate
// the immutable-per-id invariant across saves (reuse the same ref = unchanged).
export function snap({ rows, dataSnapshot, columnsSnapshot, activeIndex = 0, withChart = true } = {}) {
	const datasetRows = rows || [{ x: 1 }];
	const chartData = dataSnapshot || [{ x: 1 }];
	const chartCols = columnsSnapshot || [{ name: 'x', type: 'number' }];
	return {
		data: {
			datasets: [{
				id: 'ds-1',
				name: 'a.csv',
				rows: datasetRows,
				columns: [{ name: 'x', type: 'number' }],
				selectedColumns: ['x'],
				chartConfig: {},
			}],
			activeIndex,
		},
		panel: withChart
			? {
				charts: [{ id: 0, type: 'bar', config: {}, dataSnapshot: chartData, columnsSnapshot: chartCols }],
				slots: {}, layout: 'template-2col', blocks: [], nextBlockId: 1, nextChartId: 1,
			}
			: { charts: [], slots: {}, layout: 'template-2col', blocks: [], nextBlockId: 1, nextChartId: 0 },
		ui: { sidebarMode: 'data', previewRows: 10 },
	};
}

let counter = 0;

export function nextDb() {
	counter += 1;
	return `wb-test-${counter}`;
}
