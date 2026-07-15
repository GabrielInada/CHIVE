/**
 * Stats view, renders the numeric and categorical stat strips below the
 * table preview. Reuses worker-precomputed stats when possible (see
 * {@link getNumericStats}); falls back to live computation for joined
 * datasets or filtered slices.
 */

import { calculateStatistics, calculateCategoricalStatistics } from '../../../services/dataService.js';
import { getActiveDataset } from '../../../modules/state/appState.js';
import { t, getLocale } from '../../../services/i18nService.js';
import { formatNumber } from '../../../utils/formatters.js';

/**
 * Reuse worker-computed numeric stats when the rows we're rendering are
 * the active dataset's full unfiltered rows. Falls back to live calc for
 * joined datasets (no worker pass) or filtered slices.
 *
 * @private
 */
function getNumericStats(rows, visibleColumns) {
	const dataset = getActiveDataset();
	const precomputed = dataset?.precomputedStats?.numeric;
	if (Array.isArray(precomputed) && dataset.rows === rows) {
		const visibleNames = new Set(
			visibleColumns.filter(c => c.type === 'number').map(c => c.name),
		);
		return precomputed.filter(stat => visibleNames.has(stat.name));
	}
	return calculateStatistics(rows, visibleColumns);
}

/** @private */
function getCategoricalStats(rows, visibleColumns) {
	const dataset = getActiveDataset();
	const precomputed = dataset?.precomputedStats?.categorical;
	if (Array.isArray(precomputed) && dataset.rows === rows) {
		const visibleNames = new Set(
			visibleColumns.filter(c => c.type !== 'number').map(c => c.name),
		);
		return precomputed.filter(stat => visibleNames.has(stat.name));
	}
	return calculateCategoricalStatistics(rows, visibleColumns);
}

/** @private */
function createStatLine(label, value) {
	const row = document.createElement('div');
	row.className = 'stat-row';
	const spanLabel = document.createElement('span');
	spanLabel.textContent = label;
	const spanValue = document.createElement('span');
	spanValue.textContent = value;
	row.appendChild(spanLabel);
	row.appendChild(spanValue);
	return row;
}

/** @private */
function formatPct(rate) {
	if (!Number.isFinite(rate)) return '0%';
	return `${(rate * 100).toFixed(1)}%`;
}

/** @private */
function truncateText(text, maxLength = 18) {
	const str = String(text ?? '');
	return str.length > maxLength ? `${str.slice(0, maxLength - 1)}…` : str;
}

/**
 * Render the numeric stats card (one column per numeric field with N,
 * min, max, mean, median). Hides the card when no numeric columns are
 * visible.
 *
 * @param {Array<Object<string, *>>} rows
 * @param {Array<{ name: string, type: string }>} visibleColumns
 * @returns {void}
 */
export function renderStats(rows, visibleColumns) {
	const stats = getNumericStats(rows, visibleColumns);
	const cardStats = document.getElementById('card-stats');

	if (stats.length > 0) {
		cardStats.style.display = 'block';
		document.getElementById('badge-num-columns').textContent = t('chive-stats-badge', stats.length);
		const containerStats = document.getElementById('container-stats');
		containerStats.replaceChildren();
		const locale = getLocale();

		stats.forEach(stat => {
			const column = document.createElement('div');
			column.className = 'stat-col';

			const name = document.createElement('div');
			name.className = 'stat-col-name';
			name.title = stat.name;
			name.textContent = stat.name;

			column.appendChild(name);
			column.appendChild(createStatLine(t('chive-stat-valid'), stat.n.toLocaleString(locale)));
			column.appendChild(createStatLine(t('chive-stat-min'), formatNumber(stat.min, locale)));
			column.appendChild(createStatLine(t('chive-stat-max'), formatNumber(stat.max, locale)));
			column.appendChild(createStatLine(t('chive-stat-mean'), formatNumber(stat.mean, locale)));
			column.appendChild(createStatLine(t('chive-stat-median'), formatNumber(stat.median, locale)));

			containerStats.appendChild(column);
		});
		return;
	}

	cardStats.style.display = 'none';
	document.getElementById('container-stats').replaceChildren();
}

/**
 * Render the categorical stats card (one column per non-numeric field
 * with non-empty count, missing count, distinct count, mode, top-5%).
 * Hides the card when no categorical columns are visible. Empty columns
 * render an "empty" placeholder line.
 *
 * @param {Array<Object<string, *>>} rows
 * @param {Array<{ name: string, type: string }>} visibleColumns
 * @returns {void}
 */
export function renderCategoricalStats(rows, visibleColumns) {
	const card = document.getElementById('card-cat-stats');
	if (!card) return;

	const stats = getCategoricalStats(rows, visibleColumns);
	const container = document.getElementById('container-cat-stats');
	const badge = document.getElementById('badge-cat-columns');

	if (stats.length === 0) {
		card.style.display = 'none';
		if (container) container.replaceChildren();
		return;
	}

	card.style.display = 'block';
	if (badge) badge.textContent = t('chive-cat-stats-badge', stats.length);
	if (!container) return;
	container.replaceChildren();

	const locale = getLocale();

	stats.forEach(stat => {
		const column = document.createElement('div');
		column.className = 'stat-col';

		const name = document.createElement('div');
		name.className = 'stat-col-name';
		name.title = stat.name;
		name.textContent = stat.name;
		column.appendChild(name);

		if (stat.empty) {
			column.appendChild(createStatLine(t('chive-cat-stat-non-empty'), '0'));
			column.appendChild(createStatLine(
				t('chive-cat-stat-missing'),
				`${stat.missing.toLocaleString(locale)} (${formatPct(stat.missingPct)})`,
			));
			const empty = document.createElement('div');
			empty.className = 'stat-row';
			const span = document.createElement('span');
			span.textContent = t('chive-cat-stat-empty');
			empty.appendChild(span);
			column.appendChild(empty);
			container.appendChild(column);
			return;
		}

		column.appendChild(createStatLine(t('chive-cat-stat-non-empty'), stat.n.toLocaleString(locale)));
		column.appendChild(createStatLine(
			t('chive-cat-stat-missing'),
			`${stat.missing.toLocaleString(locale)} (${formatPct(stat.missingPct)})`,
		));
		column.appendChild(createStatLine(
			t('chive-cat-stat-unique'),
			`${stat.unique.toLocaleString(locale)} (${formatPct(stat.uniquenessRate)})`,
		));
		const modeLine = createStatLine(
			t('chive-cat-stat-mode'),
			`${truncateText(stat.mode)} · ${stat.modeCount.toLocaleString(locale)} (${formatPct(stat.modePct)})`,
		);
		modeLine.title = String(stat.mode ?? '');
		column.appendChild(modeLine);
		column.appendChild(createStatLine(t('chive-cat-stat-top5-pct'), formatPct(stat.top5Pct)));

		container.appendChild(column);
	});
}
