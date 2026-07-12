/**
 * Settings dialog component.
 *
 * Callback-driven modal for global preferences, opened by the settings
 * controller from the shared header on every page. Renders two sections in
 * one scrollable body: General (interface language) and Performance (TIN
 * color rendering). Changes apply immediately through the provided callbacks;
 * there is no Save/Cancel transaction, and the component owns no storage.
 *
 * Every label carries a `data-i18n` (or `data-i18n-title`) attribute, so a
 * locale change made from the open dialog is refreshed in place by the i18n
 * service's static retranslation pass: no DOM rebuild, which also keeps focus
 * on the language control.
 */

import { installDialogFocus } from '../modules/dialogFocus.js';
import { t } from '../services/i18nService.js';
import { SUPPORTED_LOCALES, LOCALE_LABELS } from '../config/locale.js';
import { TIN_COLOR_RENDERING_MODES } from '../config/settings.js';

const TIN_MODE_LABEL_KEYS = {
	'optimized': 'chive-settings-tin-optimized',
	'full-ramp': 'chive-settings-tin-full-ramp',
};

/**
 * Build a section heading + control container.
 *
 * @private
 * @param {string} titleKey - i18n key for the section heading.
 * @returns {{ section: HTMLElement }}
 */
function createSection(titleKey) {
	const section = document.createElement('section');
	section.className = 'settings-section';
	const title = document.createElement('h4');
	title.className = 'settings-section-title';
	title.dataset.i18n = titleKey;
	title.textContent = t(titleKey);
	section.appendChild(title);
	return { section };
}

/**
 * Open the settings dialog. The caller (settings controller) supplies the
 * current values and the service-backed callbacks; close is triggered by the
 * close button, Escape, or a backdrop click.
 *
 * @param {Object} args
 * @param {string} args.locale - Currently active locale code.
 * @param {string} args.tinColorRendering - Current TIN color-rendering mode.
 * @param {(locale: string) => void} args.onLocaleChange - Applied immediately; the dialog stays open.
 * @param {(mode: string) => void} args.onTinColorRenderingChange - Applied immediately.
 * @param {() => void} [args.onClose] - Called once after any close path.
 * @returns {{ close: () => void }}
 */
export function openSettingsDialog({
	locale,
	tinColorRendering,
	onLocaleChange,
	onTinColorRenderingChange,
	onClose,
}) {
	const overlay = document.createElement('div');
	overlay.className = 'settings-overlay';

	const dialog = document.createElement('div');
	dialog.className = 'settings-dialog';
	dialog.setAttribute('role', 'dialog');
	dialog.setAttribute('aria-modal', 'true');
	dialog.setAttribute('aria-labelledby', 'settings-dialog-title');

	const header = document.createElement('div');
	header.className = 'settings-dialog-header';

	const title = document.createElement('h3');
	title.className = 'settings-dialog-title';
	title.id = 'settings-dialog-title';
	title.dataset.i18n = 'chive-settings-title';
	title.textContent = t('chive-settings-title');
	header.appendChild(title);

	const closeBtn = document.createElement('button');
	closeBtn.type = 'button';
	closeBtn.className = 'settings-close-btn';
	closeBtn.dataset.i18nTitle = 'chive-settings-close';
	closeBtn.title = t('chive-settings-close');
	closeBtn.setAttribute('aria-label', t('chive-settings-close'));
	closeBtn.textContent = '×';
	header.appendChild(closeBtn);

	dialog.appendChild(header);

	const body = document.createElement('div');
	body.className = 'settings-dialog-body';

	// General: interface language.
	const { section: generalSection } = createSection('chive-settings-section-general');
	const languageControl = document.createElement('div');
	languageControl.className = 'settings-control';
	const languageLabel = document.createElement('label');
	languageLabel.className = 'settings-control-label';
	languageLabel.htmlFor = 'settings-language-select';
	languageLabel.dataset.i18n = 'chive-settings-language';
	languageLabel.textContent = t('chive-settings-language');
	languageControl.appendChild(languageLabel);

	const languageSelect = document.createElement('select');
	languageSelect.className = 'settings-select';
	languageSelect.id = 'settings-language-select';
	SUPPORTED_LOCALES.forEach(code => {
		const option = document.createElement('option');
		option.value = code;
		option.textContent = LOCALE_LABELS[code] || code;
		option.selected = code === locale;
		languageSelect.appendChild(option);
	});
	languageSelect.addEventListener('change', () => {
		onLocaleChange(languageSelect.value);
	});
	languageControl.appendChild(languageSelect);
	generalSection.appendChild(languageControl);
	body.appendChild(generalSection);

	// Performance: TIN color rendering.
	const { section: performanceSection } = createSection('chive-settings-section-performance');
	const tinField = document.createElement('fieldset');
	tinField.className = 'settings-fieldset';
	const tinLegend = document.createElement('legend');
	tinLegend.className = 'settings-control-label';
	tinLegend.dataset.i18n = 'chive-settings-tin-rendering';
	tinLegend.textContent = t('chive-settings-tin-rendering');
	tinField.appendChild(tinLegend);

	const segmented = document.createElement('div');
	segmented.className = 'settings-segmented';
	TIN_COLOR_RENDERING_MODES.forEach(mode => {
		const segment = document.createElement('label');
		segment.className = 'settings-segment';
		const input = document.createElement('input');
		input.type = 'radio';
		input.name = 'settings-tin-color-rendering';
		input.value = mode;
		input.checked = mode === tinColorRendering;
		input.addEventListener('change', () => {
			if (input.checked) onTinColorRenderingChange(mode);
		});
		const text = document.createElement('span');
		text.dataset.i18n = TIN_MODE_LABEL_KEYS[mode];
		text.textContent = t(TIN_MODE_LABEL_KEYS[mode]);
		segment.appendChild(input);
		segment.appendChild(text);
		segmented.appendChild(segment);
	});
	tinField.appendChild(segmented);

	const hint = document.createElement('p');
	hint.className = 'settings-hint';
	hint.dataset.i18n = 'chive-settings-tin-hint';
	hint.textContent = t('chive-settings-tin-hint');
	tinField.appendChild(hint);

	performanceSection.appendChild(tinField);
	body.appendChild(performanceSection);

	dialog.appendChild(body);
	overlay.appendChild(dialog);
	document.body.appendChild(overlay);

	const focusControl = installDialogFocus(overlay, dialog);

	let closed = false;
	const closeDialog = () => {
		if (closed) return;
		closed = true;
		document.removeEventListener('keydown', onEscape);
		focusControl.release();
		overlay.remove();
		focusControl.restoreFocus();
		if (typeof onClose === 'function') onClose();
	};

	const onEscape = event => {
		if (event.key !== 'Escape') return;
		closeDialog();
	};

	closeBtn.addEventListener('click', closeDialog);
	overlay.addEventListener('click', event => {
		if (event.target === overlay) closeDialog();
	});
	document.addEventListener('keydown', onEscape);

	return { close: closeDialog };
}
