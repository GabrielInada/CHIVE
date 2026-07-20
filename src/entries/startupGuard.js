/**
 * Dependency-free startup guard shared by both static pages.
 *
 * This is a classic script on purpose: it can expose recovery UI even when a
 * module graph fails before evaluation.
 */

(() => {
	const screen = document.getElementById('startup-screen');
	const message = document.getElementById('startup-message');
	const reload = document.getElementById('startup-reload');
	if (!screen || !message || !reload) return;

	let locale = 'pt';
	try {
		const saved = localStorage.getItem('chive-locale');
		if (saved === 'en') locale = 'en';
		else if (saved === 'pt-BR') locale = 'pt';
		else if (!String(window.navigator.language || '').toLowerCase().startsWith('pt')) locale = 'en';
	} catch {
		locale = 'pt';
	}

	const copy = key => message.dataset[`${key}${locale === 'en' ? 'En' : 'Pt'}`];
	message.textContent = copy('loading');
	reload.textContent = reload.dataset[locale === 'en' ? 'labelEn' : 'labelPt'];
	reload.addEventListener('click', () => window.location.reload());

	const slowTimer = window.setTimeout(() => {
		message.textContent = copy('slow');
		reload.hidden = false;
	}, 10000);

	window.chiveStartupGuard = Object.freeze({
		update(text) {
			if (text) message.textContent = text;
		},
		complete() {
			window.clearTimeout(slowTimer);
		},
		fail(text) {
			window.clearTimeout(slowTimer);
			message.textContent = text || copy('error');
			screen.setAttribute('role', 'alert');
			reload.hidden = false;
		},
	});
})();
