const stateListeners = {};

function reportListenerError(errorType, eventType, err) {
	window.dispatchEvent(new CustomEvent('chive-internal-error', {
		detail: {
			type: errorType,
			eventType,
			message: String(err?.message || err),
		},
	}));
}

export function onStateChange(eventType, callback) {
	if (!stateListeners[eventType]) {
		stateListeners[eventType] = [];
	}
	stateListeners[eventType].push(callback);

	return () => {
		const index = stateListeners[eventType].indexOf(callback);
		if (index > -1) {
			stateListeners[eventType].splice(index, 1);
		}
	};
}

export function emitStateChange(eventType, data) {
	if (stateListeners[eventType]) {
		stateListeners[eventType].forEach(cb => {
			try {
				cb(data);
			} catch (err) {
				reportListenerError('state-listener-error', eventType, err);
			}
		});
	}

	if (stateListeners['*']) {
		stateListeners['*'].forEach(cb => {
			try {
				cb({ type: eventType, data });
			} catch (err) {
				reportListenerError('state-wildcard-listener-error', eventType, err);
			}
		});
	}

	window.dispatchEvent(new CustomEvent('chive-state-changed', {
		detail: { type: eventType, data },
	}));
}
