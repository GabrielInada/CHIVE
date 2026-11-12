/** Expanded viewing of a saved chart; the original slot and project stay intact. */

import { t } from '../../../services/i18nService.js';
import { showNativeModal } from '../../../ui/nativeDialog.js';
import { mountSlot, teardownSlot } from '../slots/lifecycle.js';

/**
 * Open a viewport-sized chart with native keyboard dismissal and focus return.
 * Reuses slot lifecycle ownership for resize, simulations and WebGL disposal.
 *
 * @param {import('../../../types.js').ChartSnapshot | null} snapshot
 */
export function openExpandedChart(snapshot) {
	if (!snapshot || document.querySelector('.chart-expanded-dialog[open]')) return;
	const dialog = document.createElement('dialog');
	dialog.className = 'app-dialog chart-expanded-dialog';
	dialog.setAttribute('aria-labelledby', 'chart-expanded-title');
	const surface = document.createElement('div');
	surface.className = 'chart-expanded-surface';
	const header = document.createElement('div');
	header.className = 'chart-expanded-header';
	const title = document.createElement('h2');
	title.id = 'chart-expanded-title';
	title.textContent = snapshot.config?.customTitle || snapshot.name || t('chive-chart-expand');
	const closeButton = document.createElement('button');
	closeButton.type = 'button';
	closeButton.className = 'chart-expanded-close';
	closeButton.textContent = t('chive-chart-close-expanded');
	closeButton.autofocus = true;
	header.append(title, closeButton);
	const container = document.createElement('div');
	container.className = 'panel-chart-container chart-expanded-container';
	surface.append(header, container);
	dialog.appendChild(surface);

	const scrollPosition = { left: window.scrollX, top: window.scrollY };
	const viewport = { width: window.innerWidth, height: window.innerHeight };
	const invoker = document.activeElement;
	let closed = false;
	const close = () => {
		if (closed) return;
		closed = true;
		teardownSlot(container);
		lifecycle.close();
		if (invoker?.isConnected && (window.innerWidth !== viewport.width || window.innerHeight !== viewport.height)) {
			// Rotation may reflow the dashboard; return to the same chart in its
			// new position rather than to an unrelated old pixel offset.
			invoker.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
		} else {
			window.scrollTo({ ...scrollPosition, behavior: 'instant' });
		}
	};
	closeButton.addEventListener('click', close);
	const lifecycle = showNativeModal(dialog, { onDismiss: close });
	// Also release resources if the browser closes the native dialog directly.
	dialog.addEventListener('close', close, { once: true });
	mountSlot(container, { ...snapshot, config: { ...snapshot.config, customTitle: '' } });
}
