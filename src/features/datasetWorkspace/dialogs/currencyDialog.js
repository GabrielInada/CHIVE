import { getCurrencyCodes, parseCurrencyValue, analyzeCurrencyColumn } from '../../../domain/datasets/currency.js';
import { formatNumber } from '../../../utils/formatters.js';
import { showNativeModal } from '../../../ui/nativeDialog.js';

let nextId = 0;

/** Edit one column's monetary format; the injected writer validates atomically. */
export function openCurrencyDialog({ column, rows, translate, locale, onApply }) {
	const id = `currency-dialog-${++nextId}`;
	const dialog = document.createElement('dialog');
	dialog.className = 'app-dialog';
	dialog.setAttribute('aria-labelledby', `${id}-title`);
	const form = document.createElement('form');
	form.className = 'confirm-dialog currency-dialog';
	form.method = 'dialog';
	const heading = document.createElement('h3');
	heading.id = `${id}-title`;
	heading.className = 'confirm-dialog-title';
	heading.textContent = translate('chive-currency-title', column.name);
	form.appendChild(heading);
	const body = document.createElement('div');
	body.className = 'confirm-dialog-message';
	form.appendChild(body);
	const help = document.createElement('p');
	help.id = `${id}-help`;
	help.textContent = translate('chive-currency-help');
	body.appendChild(help);

	const field = (name, labelText, options) => {
		const wrapper = document.createElement('div');
		wrapper.className = 'currency-field';
		const label = document.createElement('label');
		label.htmlFor = `${id}-${name}`;
		label.textContent = labelText;
		const select = document.createElement('select');
		select.id = label.htmlFor;
		select.name = name;
		select.className = 'rows-select';
		for (const [value, text] of options) {
			const option = document.createElement('option');
			option.value = value;
			option.textContent = text;
			select.appendChild(option);
		}
		wrapper.append(label, select);
		body.appendChild(wrapper);
		return select;
	};
	const currency = field('currency', translate('chive-currency-label'), [
		['', translate(column.type === 'number' ? 'chive-currency-none' : 'chive-currency-choose')],
		...getCurrencyCodes().map(code => [code, code]),
	]);
	currency.value = column.currency || '';
	currency.required = column.type !== 'number';
	currency.autofocus = true;
	currency.setAttribute('aria-describedby', `${id}-help ${id}-error`);
	const separator = field('decimalSeparator', translate('chive-upload-decimal-separator'), [
		['auto', translate('chive-upload-decimal-auto')],
		['.', translate('chive-upload-decimal-dot')],
		[',', translate('chive-upload-decimal-comma')],
	]);
	// Numbers have already been parsed; changing their label cannot rescale them.
	separator.value = column.type === 'number' ? column.decimalSeparator || '.' : 'auto';
	separator.disabled = column.type === 'number';
	const preview = document.createElement('p');
	preview.className = 'currency-preview';
	body.appendChild(preview);
	const error = document.createElement('p');
	error.id = `${id}-error`;
	error.className = 'currency-error';
	error.setAttribute('role', 'alert');
	body.appendChild(error);
	const actions = document.createElement('div');
	actions.className = 'confirm-dialog-actions';
	const cancel = document.createElement('button');
	cancel.type = 'button';
	cancel.className = 'btn-secondary';
	cancel.textContent = translate('chive-confirm-cancel');
	const apply = document.createElement('button');
	apply.type = 'submit';
	apply.className = 'btn-primary';
	apply.textContent = translate('chive-currency-apply');
	actions.append(cancel, apply);
	form.appendChild(actions);
	dialog.appendChild(form);
	const sample = rows.map(row => row[column.name]).filter(value => value !== null && value !== '').slice(0, 3);
	const updatePreview = () => {
		error.textContent = '';
		currency.removeAttribute('aria-invalid');
		const detected = currency.value ? analyzeCurrencyColumn(sample, { currency: currency.value, decimalSeparator: separator.value }) : null;
		const examples = sample.map(value => {
			if (!currency.value) return String(value);
			const amount = detected?.currency ? parseCurrencyValue(value, detected) : null;
			return amount === null ? '—' : formatNumber(amount, locale, currency.value);
		});
		preview.textContent = translate('chive-currency-preview', examples.join(' · '));
	};
	currency.addEventListener('change', updatePreview);
	separator.addEventListener('change', updatePreview);
	updatePreview();
	const lifecycle = showNativeModal(dialog, { onDismiss: () => lifecycle.close() });
	cancel.addEventListener('click', () => lifecycle.close());
	form.addEventListener('submit', event => {
		event.preventDefault();
		const result = onApply({ currency: currency.value, decimalSeparator: separator.value });
		if (result.ok) {
			lifecycle.close('apply');
		} else {
			error.textContent = translate(`chive-currency-error-${result.reason === 'mixed' ? 'mixed' : 'invalid'}`);
			currency.setAttribute('aria-invalid', 'true');
			currency.focus();
		}
	});
}
