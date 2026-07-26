// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	onStateChange,
	emitStateChange,
	enableStateLog,
	disableStateLog,
	getStateLog,
	clearStateLog,
} from '../../src/state/stateEvents.js';

/**
 * The bus is module-singleton state, so a listener that outlives its test makes
 * the suite order-dependent. Register through these helpers instead of calling
 * `onStateChange` or `window.addEventListener` directly: the mutation cases
 * below add and remove listeners mid-emission, and a failed assertion throws
 * before any inline cleanup at the end of a test would run.
 */
let cleanup = [];

function subscribe(eventType, callback) {
	const unsubscribe = onStateChange(eventType, callback);
	cleanup.push(unsubscribe);
	return unsubscribe;
}

function listenOnWindow(type, handler) {
	window.addEventListener(type, handler);
	cleanup.push(() => window.removeEventListener(type, handler));
	return handler;
}

beforeEach(() => {
	cleanup = [];
});

afterEach(() => {
	cleanup.forEach(detach => detach());
	cleanup = [];
});

describe('stateEvents', () => {
	it('registers listener and calls it on emit', () => {
		const cb = vi.fn();
		subscribe('testEvent', cb);

		emitStateChange('testEvent', { foo: 1 });

		expect(cb).toHaveBeenCalledWith({ foo: 1 });
	});

	it('returns unsubscribe function that removes the listener', () => {
		const cb = vi.fn();
		const unsub = subscribe('unsubTest', cb);

		emitStateChange('unsubTest', 'first');
		expect(cb).toHaveBeenCalledTimes(1);

		unsub();
		emitStateChange('unsubTest', 'second');
		expect(cb).toHaveBeenCalledTimes(1);
	});

	it('supports wildcard listeners that receive all events', () => {
		const cb = vi.fn();
		subscribe('*', cb);

		emitStateChange('anyEvent', { data: 42 });

		expect(cb).toHaveBeenCalledWith({ type: 'anyEvent', data: { data: 42 } });
	});

	it('dispatches CustomEvent on window for every emission', () => {
		const handler = listenOnWindow('chive-state-changed', vi.fn());

		emitStateChange('windowTest', 'payload');

		expect(handler).toHaveBeenCalledTimes(1);
		const detail = handler.mock.calls[0][0].detail;
		expect(detail.type).toBe('windowTest');
		expect(detail.data).toBe('payload');
	});

	it('reports listener errors and keeps the fan-out going', () => {
		const errorHandler = listenOnWindow('chive-internal-error', vi.fn());

		const badCb = () => { throw new Error('boom'); };
		const goodCb = vi.fn();
		subscribe('errorTest', badCb);
		subscribe('errorTest', goodCb);

		emitStateChange('errorTest', null);

		expect(errorHandler).toHaveBeenCalledTimes(1);
		const detail = errorHandler.mock.calls[0][0].detail;
		expect(detail.type).toBe('state-listener-error');
		expect(detail.eventType).toBe('errorTest');
		expect(detail.message).toBe('boom');
		expect(goodCb).toHaveBeenCalledTimes(1);
	});

	it('reports wildcard listener errors and keeps the fan-out going', () => {
		const errorHandler = listenOnWindow('chive-internal-error', vi.fn());

		const badCb = () => { throw new Error('wildcard boom'); };
		const goodCb = vi.fn();
		subscribe('*', badCb);
		subscribe('*', goodCb);

		emitStateChange('someEvent', null);

		expect(errorHandler).toHaveBeenCalledTimes(1);
		const detail = errorHandler.mock.calls[0][0].detail;
		expect(detail.type).toBe('state-wildcard-listener-error');
		expect(goodCb).toHaveBeenCalledTimes(1);
	});

	it('does not fail when emitting event with no listeners', () => {
		expect(() => emitStateChange('noListenersEvent', 'data')).not.toThrow();
	});

	it('debug log records emissions only while enabled', () => {
		const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
		clearStateLog();

		emitStateChange('logBefore', { x: 1 });
		expect(getStateLog()).toHaveLength(0);

		enableStateLog();
		emitStateChange('logDuring', { x: 2 });
		const afterEnable = getStateLog();
		expect(afterEnable).toHaveLength(1);
		expect(afterEnable[0]).toMatchObject({ type: 'logDuring', data: { x: 2 } });
		expect(consoleSpy).toHaveBeenCalledWith('[chive:state]', 'logDuring', { x: 2 });

		clearStateLog();
		expect(getStateLog()).toHaveLength(0);

		emitStateChange('logCleared', { x: 3 });
		expect(getStateLog()).toHaveLength(1);

		disableStateLog();
		emitStateChange('logAfter', { x: 4 });
		expect(getStateLog()).toHaveLength(1);

		clearStateLog();
		consoleSpy.mockRestore();
	});

	it('supports multiple listeners on the same event', () => {
		const cb1 = vi.fn();
		const cb2 = vi.fn();
		subscribe('multiTest', cb1);
		subscribe('multiTest', cb2);

		emitStateChange('multiTest', 'hello');

		expect(cb1).toHaveBeenCalledWith('hello');
		expect(cb2).toHaveBeenCalledWith('hello');
	});
});

/**
 * Mutating a listener list while it is being dispatched.
 *
 * Every case asserts call order through a shared `seen` array rather than call
 * counts: a bus that delivers the right number of calls in the wrong order is
 * exactly the failure being ruled out here. The typed and the wildcard sink run
 * the same scenarios because they are two instances of one dispatch path.
 */
const BUSES = [
	{
		label: 'typed',
		subscribe: callback => subscribe('mutationDuringEmit', callback),
		emit: () => emitStateChange('mutationDuringEmit', null),
	},
	{
		label: 'wildcard',
		subscribe: callback => subscribe('*', callback),
		emit: () => emitStateChange('wildcardMutationDuringEmit', null),
	},
];

describe.each(BUSES)('stateEvents $label listeners mutated during a fan-out', bus => {
	it('runs the remaining listeners after one unsubscribes itself', () => {
		const seen = [];
		let offA = null;

		offA = bus.subscribe(() => {
			seen.push('A');
			offA();
		});
		bus.subscribe(() => seen.push('B'));
		bus.subscribe(() => seen.push('C'));

		bus.emit();

		expect(seen).toEqual(['A', 'B', 'C']);
	});

	it('suppresses only the later listener that was unsubscribed', () => {
		const seen = [];
		let offB = null;

		bus.subscribe(() => {
			seen.push('A');
			offB();
		});
		offB = bus.subscribe(() => seen.push('B'));
		bus.subscribe(() => seen.push('C'));

		bus.emit();

		expect(seen).toEqual(['A', 'C']);
	});

	it('does not skip the next listener when an earlier one is unsubscribed', () => {
		const seen = [];
		let offA = null;

		offA = bus.subscribe(() => seen.push('A'));
		bus.subscribe(() => {
			seen.push('B');
			offA();
		});
		bus.subscribe(() => seen.push('C'));

		bus.emit();

		expect(seen).toEqual(['A', 'B', 'C']);
	});

	it('holds a listener subscribed mid-emission until the next emission', () => {
		const seen = [];
		let added = false;

		bus.subscribe(() => {
			seen.push('A');
			if (!added) {
				added = true;
				bus.subscribe(() => seen.push('late'));
			}
		});

		bus.emit();
		expect(seen).toEqual(['A']);

		bus.emit();
		expect(seen).toEqual(['A', 'A', 'late']);
	});

	it('treats a re-subscription of the same function as a new registration', () => {
		const seen = [];
		const b = () => seen.push('B');
		let offB = null;
		let swapped = false;

		bus.subscribe(() => {
			seen.push('A');
			if (!swapped) {
				swapped = true;
				offB();
				offB = bus.subscribe(b);
			}
		});
		offB = bus.subscribe(b);
		bus.subscribe(() => seen.push('C'));

		bus.emit();
		expect(seen).toEqual(['A', 'C']);

		// The replacement registration sits after C, where it was appended.
		bus.emit();
		expect(seen).toEqual(['A', 'C', 'A', 'C', 'B']);
	});

	it('removes only the named registration when one function is subscribed twice', () => {
		const seen = [];
		const dup = () => seen.push('dup');
		let offFirst = null;

		bus.subscribe(() => {
			seen.push('A');
			offFirst();
		});
		offFirst = bus.subscribe(dup);
		bus.subscribe(dup);

		bus.emit();

		expect(seen).toEqual(['A', 'dup']);
	});

	it('ignores a repeated unsubscribe instead of detaching the twin registration', () => {
		const seen = [];
		const dup = () => seen.push('dup');
		const offFirst = bus.subscribe(dup);
		bus.subscribe(dup);

		offFirst();
		offFirst();
		bus.emit();

		expect(seen).toEqual(['dup']);
	});
});

/**
 * Typed listeners run before wildcard listeners, so the two sinks need one
 * shared membership boundary per emission rather than one snapshot each.
 */
describe('stateEvents mutation across both sinks', () => {
	it('holds a wildcard listener subscribed by a typed listener until the next emission', () => {
		const seen = [];
		let added = false;

		subscribe('crossSinkAdd', () => {
			seen.push('typed');
			if (!added) {
				added = true;
				subscribe('*', () => seen.push('wildcard'));
			}
		});

		emitStateChange('crossSinkAdd', null);
		expect(seen).toEqual(['typed']);

		emitStateChange('crossSinkAdd', null);
		expect(seen).toEqual(['typed', 'typed', 'wildcard']);
	});

	it('skips a wildcard registration unsubscribed by a typed listener', () => {
		const seen = [];
		let offWildcard = null;

		subscribe('crossSinkRemove', () => {
			seen.push('typed');
			offWildcard();
		});
		offWildcard = subscribe('*', () => seen.push('wildcard'));
		subscribe('*', () => seen.push('wildcard-peer'));

		emitStateChange('crossSinkRemove', null);

		expect(seen).toEqual(['typed', 'wildcard-peer']);
	});
});
