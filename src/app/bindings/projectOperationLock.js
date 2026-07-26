/**
 * Mutual exclusion for whole-project operations.
 *
 * Project export, project import, and stored-data clearing each read, replace,
 * or delete the entire persisted project. Overlapping two of them produces a
 * result neither one asked for: an import that finishes after a clear recreates
 * the project the user just deleted, and a clear that lands during an import
 * deletes the file the user just chose. They share one gate instead of each
 * keeping a private busy flag.
 *
 * The lock covers main-thread workflow ownership only. It does not order writes
 * inside the persistence package, which serializes its own operations.
 */

/** @type {string | null} */
let currentOperation = null;

/**
 * Take the project-operation lock.
 *
 * The release function is idempotent, so a `finally` block can call it without
 * checking whether an earlier path already released.
 *
 * @param {string} name - Operation name, reported to a caller that finds the lock taken.
 * @returns {(() => void) | null} A release function, or `null` when another operation holds the lock.
 */
export function acquireProjectOperation(name) {
	if (currentOperation) return null;
	currentOperation = name;
	let released = false;
	return () => {
		if (released) return;
		released = true;
		currentOperation = null;
	};
}

/**
 * @returns {string | null} The running operation's name, or `null` when idle.
 */
export function getRunningProjectOperation() {
	return currentOperation;
}

/**
 * Test seam. Production code releases through the function returned by
 * {@link acquireProjectOperation}; a module-level lock otherwise leaks between
 * test cases.
 *
 * @internal
 */
export function __resetProjectOperationLockForTesting() {
	currentOperation = null;
}
