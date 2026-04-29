// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import {
	onStateChange,
	emitStateChange,
	enableStateLog,
	disableStateLog,
	getStateLog,
	clearStateLog,
} from '../../src/modules/stateEvents.js';

describe('stateEvents', () => {
	it('registers listener and calls it on emit', () => {
		const cb = vi.fn();
		onStateChange('testEvent', cb);

		emitStateChange('testEvent', { foo: 1 });

		expect(cb).toHaveBeenCalledWith({ foo: 1 });
	});

	it('returns unsubscribe function that removes the listener', () => {
		const cb = vi.fn();
		const unsub = onStateChange('unsubTest', cb);

		emitStateChange('unsubTest', 'first');
		expect(cb).toHaveBeenCalledTimes(1);

		unsub();
		emitStateChange('unsubTest', 'second');
		expect(cb).toHaveBeenCalledTimes(1);
	});

	it('supports wildcard listeners that receive all events', () => {
		const cb = vi.fn();
		const unsub = onStateChange('*', cb);

		emitStateChange('anyEvent', { data: 42 });

		expect(cb).toHaveBeenCalledWith({ type: 'anyEvent', data: { data: 42 } });
		unsub();
	});

	it('dispatches CustomEvent on window for every emission', () => {
		const handler = vi.fn();
		window.addEventListener('chive-state-changed', handler);

		emitStateChange('windowTest', 'payload');

		expect(handler).toHaveBeenCalledTimes(1);
		const detail = handler.mock.calls[0][0].detail;
		expect(detail.type).toBe('windowTest');
		expect(detail.data).toBe('payload');

		window.removeEventListener('chive-state-changed', handler);
	});

	it('reports listener errors via chive-internal-error event', () => {
		const errorHandler = vi.fn();
		window.addEventListener('chive-internal-error', errorHandler);

		const badCb = () => { throw new Error('boom'); };
		const unsub = onStateChange('errorTest', badCb);

		emitStateChange('errorTest', null);

		expect(errorHandler).toHaveBeenCalledTimes(1);
		const detail = errorHandler.mock.calls[0][0].detail;
		expect(detail.type).toBe('state-listener-error');
		expect(detail.eventType).toBe('errorTest');
		expect(detail.message).toBe('boom');

		unsub();
		window.removeEventListener('chive-internal-error', errorHandler);
	});

	it('reports wildcard listener errors via chive-internal-error event', () => {
		const errorHandler = vi.fn();
		window.addEventListener('chive-internal-error', errorHandler);

		const badCb = () => { throw new Error('wildcard boom'); };
		const unsub = onStateChange('*', badCb);

		emitStateChange('someEvent', null);

		expect(errorHandler).toHaveBeenCalledTimes(1);
		const detail = errorHandler.mock.calls[0][0].detail;
		expect(detail.type).toBe('state-wildcard-listener-error');

		unsub();
		window.removeEventListener('chive-internal-error', errorHandler);
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
		const unsub1 = onStateChange('multiTest', cb1);
		const unsub2 = onStateChange('multiTest', cb2);

		emitStateChange('multiTest', 'hello');

		expect(cb1).toHaveBeenCalledWith('hello');
		expect(cb2).toHaveBeenCalledWith('hello');

		unsub1();
		unsub2();
	});
});
