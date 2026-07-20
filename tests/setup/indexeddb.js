// Polyfills `indexedDB` and IDB request/transaction globals so tests that
// import services/persistence.js (or anything that touches IDB indirectly) can run
// in Node without a real browser. Harmless for tests that don't use IDB.
import 'fake-indexeddb/auto';

// jsdom exposes HTMLDialogElement but does not yet implement the modal methods
// in every supported release. Keep this test-only shim deliberately small:
// production relies on the browser's native top-layer implementation.
const DialogElement = globalThis.HTMLDialogElement;
if (typeof DialogElement !== 'undefined') {
	if (typeof DialogElement.prototype.showModal !== 'function') {
		DialogElement.prototype.showModal = function showModal() {
			if (!this.isConnected) throw new DOMException('Dialog is not connected', 'InvalidStateError');
			if (this.open) throw new DOMException('Dialog is already open', 'InvalidStateError');
			this.open = true;
		};
	}

	if (typeof DialogElement.prototype.close !== 'function') {
		DialogElement.prototype.close = function close(returnValue = '') {
			if (!this.open) return;
			this.returnValue = String(returnValue);
			this.open = false;
			this.dispatchEvent(new Event('close'));
		};
	}
}
