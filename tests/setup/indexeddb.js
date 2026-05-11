// Polyfills `indexedDB` and IDB request/transaction globals so tests that
// import persistenceService (or anything that touches IDB indirectly) can run
// in Node without a real browser. Harmless for tests that don't use IDB.
import 'fake-indexeddb/auto';
