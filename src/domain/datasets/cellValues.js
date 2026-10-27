import { COLUMN_TYPES } from '../../config/columnTypeDetection.js';
import { normalizeNumericString } from './typeDetection.js';

/**
 * CHIVE cell values: what a dataset cell means.
 *
 * Rows enter memory at a few seams: ingest, project load and import, and
 * panel captures. Each seam canonicalizes its cells here, so readers see one
 * form per column type and never repair values themselves:
 *
 *   - missing: `null`. Blank or whitespace-only strings are missing, and so is
 *     anything a number or date column cannot parse. Text such as "N/A" is a
 *     value.
 *   - number: a finite number.
 *   - date: an ISO string, `YYYY-MM-DD` when the source has no time of day,
 *     else `YYYY-MM-DDTHH:mm:ss.sssZ`. A source written without an offset
 *     keeps its wall-clock reading in the UTC fields, so a date formatted in
 *     UTC reads the same in every time zone.
 *   - text: a non-blank string. Ingest trims it; saved text is read verbatim.
 *
 * Pure, safe to use in workers and tests.
 *
 * @typedef {import('../../types.js').ColumnSpec} ColumnSpec
 * @typedef {import('../../types.js').ColumnType} ColumnType
 */

/**
 * Filter token of the missing bucket in chart filter include and exclude
 * lists. Every other category's token is `v:` plus its key, so data cannot
 * collide with it.
 *
 * @type {string}
 */
export const MISSING_TOKEN = '__chive_missing__';

/**
 * Category key of the missing bucket. Every other key is the cell's string
 * form; a text cell spelled exactly like this key joins the missing bucket.
 *
 * @type {string}
 */
export const MISSING_KEY = '__chive_missing__';

/**
 * Generation of the stored cell format. Persistence stamps it on every save
 * and hands the stored value back to {@link canonicalizeRows}. Projects saved
 * before cells were canonical carry none.
 *
 * @type {number}
 */
export const CELL_FORMAT_VERSION = 1;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

// ISO forms Date.parse reads as UTC midnight: YYYY, YYYY-MM, YYYY-MM-DD.
const ISO_DATE_ONLY = /^(?:[+-]\d{6}|\d{4})(?:-\d{2}(?:-\d{2})?)?$/;
// ISO date-times. Group 1 is the offset; without one, Date.parse reads local
// time, so the wall-clock reading is parsed as UTC instead.
const ISO_DATE_TIME = /^(?:[+-]\d{6}|\d{4})-\d{2}-\d{2}[Tt ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?([Zz]|[+-]\d{2}:?\d{2})?$/;
// Clues inside Date.parse's fallback formats ("01/15/2024", "Jan 15, 2024 10:30 PM").
const HAS_TIME = /\d:\d{2}/;
const HAS_ZONE = /\b(?:GMT|UTC|UT|Z)\b|\b[ECMP][SD]T\b|\d:\d{2}(?::\d{2}(?:\.\d+)?)?\s*(?:[AP]M\s*)?[+-]\d{2}:?\d{2}\b/i;
// Exact Date#toISOString output, the form dates were saved in before cells
// were canonical.
const SAVED_INSTANT = /^(?:[+-]\d{6}|\d{4})-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
// The two canonical date forms.
const CANONICAL_DATE = /^(?:[+-]\d{6}|\d{4})-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}\.\d{3}Z)?$/;

/**
 * Canonical form of one raw cell at ingest. Text is trimmed here and only
 * here.
 *
 * @param {*} raw - A parsed value: a CSV string, any JSON value, or a joined cell.
 * @param {ColumnType} type - The column's detected type.
 * @param {{ decimalSeparator?: '.' | ',' }} [options] - The column's string number format. Typed numbers keep their value.
 * @returns {number | string | null}
 */
export function toCanonicalCell(raw, type, { decimalSeparator = '.' } = {}) {
	return canonicalCell(raw, type, decimalSeparator, true);
}

/**
 * Bring rows read back from storage or a panel capture to canonical form.
 *
 * Fills absent columns with `null`, turns blank and unparseable cells into
 * `null`, and recovers the dates of projects saved before cells were
 * canonical. Never mutates its input.
 *
 * Those projects stored each date as the instant of its local-time reading,
 * so a date-only column became local midnights: 03:00Z in UTC-3, 15:00Z the
 * day before in UTC+9. When every such instant in a column shares one time
 * of day, give or take a one-hour DST shift, that time is the saving zone's
 * midnight and each instant becomes its date. Otherwise the column held real
 * times and keeps them.
 *
 * @param {Array<Object<string, *>>} rows
 * @param {ColumnSpec[]} columns
 * @param {{ formatVersion?: number }} [options] - The stored {@link CELL_FORMAT_VERSION}; absent for data saved before it existed.
 * @returns {Array<Object<string, *>>} `rows` itself when every cell is already canonical, otherwise a new array that reuses unchanged rows.
 */
export function canonicalizeRows(rows, columns, { formatVersion } = {}) {
	if (!Array.isArray(rows) || !Array.isArray(columns)) return rows;
	const legacy = !(typeof formatVersion === 'number' && formatVersion >= CELL_FORMAT_VERSION);
	const readers = columns
		.filter(column => typeof column?.name === 'string')
		.map(column => [column.name, columnReader(rows, column, legacy)]);

	let result = null;
	for (let i = 0; i < rows.length; i++) {
		const row = rows[i];
		const isRecord = row !== null && typeof row === 'object';
		let next = isRecord ? null : {};
		for (const [name, read] of readers) {
			const value = isRecord ? row[name] : undefined;
			const canonical = read(value);
			if (next === null && (!Object.is(canonical, value) || !Object.hasOwn(row, name))) next = { ...row };
			if (next !== null) next[name] = canonical;
		}
		if (next !== null && result === null) result = rows.slice(0, i);
		if (result !== null) result.push(next ?? row);
	}
	return result ?? rows;
}

/**
 * Key that groups a canonical cell into a category. Charts group and color by
 * it.
 *
 * @param {*} value - A canonical cell; `undefined` reads as missing.
 * @returns {string} {@link MISSING_KEY} for a missing cell, else the cell's string form.
 */
export function categoryKey(value) {
	return value === null || value === undefined ? MISSING_KEY : String(value);
}

/**
 * Display label and filter token of a category.
 *
 * @param {string} key - From {@link categoryKey}.
 * @param {{ missingLabel?: string }} [options] - Localized label of the missing bucket.
 * @returns {{ label: string, token: string }}
 */
export function describeCategory(key, { missingLabel = '(missing)' } = {}) {
	if (key === MISSING_KEY) return { label: missingLabel, token: MISSING_TOKEN };
	return { label: key, token: `v:${key}` };
}

/** @private */
function canonicalCell(raw, type, decimalSeparator, trimText) {
	if (raw === null || raw === undefined) return null;
	if (type === COLUMN_TYPES.NUMBER) return canonicalNumber(raw, decimalSeparator);
	if (type === COLUMN_TYPES.DATE) return canonicalDate(raw);
	return canonicalText(raw, trimText);
}

/** @private */
function canonicalNumber(raw, decimalSeparator) {
	if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
	const text = String(raw).trim();
	if (text === '') return null;
	const parsed = Number(normalizeNumericString(text, decimalSeparator));
	return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Non-strings are read through `String`, as type detection reads them.
 *
 * @private
 */
function canonicalDate(raw) {
	if (raw instanceof Date) return toIsoInstant(raw.getTime());
	// Trim first: Date.parse reads " 2024-01-15" as local time, not UTC.
	const text = String(raw).trim();
	if (text === '') return null;
	if (ISO_DATE_ONLY.test(text)) return toIsoDate(Date.parse(text));

	const isoDateTime = ISO_DATE_TIME.exec(text);
	if (isoDateTime) {
		const normalized = text.replace(/[ t]/, 'T');
		return toIsoInstant(Date.parse(isoDateTime[1] ? normalized : `${normalized}Z`));
	}

	const ms = Date.parse(text);
	if (Number.isNaN(ms)) return null;
	const hasTime = HAS_TIME.test(text);
	if (HAS_ZONE.test(text)) {
		// Without a time of day, the instant is the stated zone's midnight.
		return hasTime ? toIsoInstant(ms) : midnightDate(ms, midnightOffset([ms]));
	}
	// Date.parse read this fallback format as local time; keep its wall-clock reading.
	const local = new Date(ms);
	if (!hasTime) return toIsoDate(utcTime(local.getFullYear(), local.getMonth(), local.getDate()));
	return toIsoInstant(utcTime(
		local.getFullYear(), local.getMonth(), local.getDate(),
		local.getHours(), local.getMinutes(), local.getSeconds(), local.getMilliseconds(),
	));
}

/** @private */
function canonicalText(raw, trimText) {
	if (typeof raw === 'string') {
		const trimmed = raw.trim();
		if (trimmed === '') return null;
		return trimText ? trimmed : raw;
	}
	if (typeof raw === 'object') return JSON.stringify(raw);
	return String(raw);
}

/**
 * Per-column cell reader for {@link canonicalizeRows}. A legacy date column is
 * scanned once up front to find whether its saved instants are midnights.
 *
 * @private
 */
function columnReader(rows, column, legacy) {
	const { name, type } = column;
	const decimalSeparator = column.decimalSeparator === ',' ? ',' : '.';
	const read = value => canonicalCell(value, type, decimalSeparator, false);
	if (type !== COLUMN_TYPES.DATE) return read;
	// Saved dates already in a canonical form came from this module; parsing
	// each one again would dominate load time.
	const readDate = value => (typeof value === 'string' && CANONICAL_DATE.test(value) ? value : read(value));
	if (!legacy) return readDate;

	const instants = [];
	for (const row of rows) {
		const ms = savedInstant(row?.[name]);
		if (ms !== null) instants.push(ms);
	}
	const offset = midnightOffset(instants);
	if (offset === null) return readDate;
	return value => {
		const ms = savedInstant(value);
		return ms === null ? readDate(value) : midnightDate(ms, offset);
	};
}

/**
 * Instant of a date cell saved before cells were canonical: a Date (old
 * IndexedDB projects) or its `toISOString` text.
 *
 * @private
 * @returns {number | null}
 */
function savedInstant(value) {
	let ms = NaN;
	if (value instanceof Date) ms = value.getTime();
	else if (typeof value === 'string' && SAVED_INSTANT.test(value)) ms = Date.parse(value);
	return Number.isFinite(ms) ? ms : null;
}

/**
 * When all instants share one time of day within an hour, the offset that
 * moves each of them to within half an hour of its local midnight. `null`
 * when they do not, or when there are none.
 *
 * @private
 * @param {number[]} instants
 * @returns {number | null}
 */
function midnightOffset(instants) {
	if (instants.length === 0) return null;
	const times = instants.map(ms => ((ms % DAY_MS) + DAY_MS) % DAY_MS).sort((a, b) => a - b);
	// The times sit on the arc left over by the widest gap between them, which
	// may wrap past midnight (00:00Z and 23:00Z for the UK).
	let widestGap = times[0] + DAY_MS - times[times.length - 1];
	let start = times[0];
	for (let i = 1; i < times.length; i++) {
		const gap = times[i] - times[i - 1];
		if (gap > widestGap) {
			widestGap = gap;
			start = times[i];
		}
	}
	const spread = DAY_MS - widestGap;
	if (spread > HOUR_MS) return null;
	const middle = (start + spread / 2) % DAY_MS;
	// Midnights up to 10:30Z belong to zones west of UTC (Hawaii is 10:00Z),
	// later ones to zones east of it (New Zealand is 11:00Z or 12:00Z).
	return middle <= 10.5 * HOUR_MS ? -middle : DAY_MS - middle;
}

/**
 * Date of the midnight that `offset`, from {@link midnightOffset}, moves `ms` onto.
 *
 * @private
 */
function midnightDate(ms, offset) {
	return toIsoDate(Math.round((ms + offset) / DAY_MS) * DAY_MS);
}

/** @private */
function toIsoInstant(ms) {
	const date = new Date(ms);
	return Number.isNaN(date.getTime()) ? null : formatUtc(date, true);
}

/** @private */
function toIsoDate(ms) {
	const date = new Date(ms);
	return Number.isNaN(date.getTime()) ? null : formatUtc(date, false);
}

/**
 * `Date#toISOString`, or its date part, written out. The built-in costs about
 * three times as much, and ingest pays it once per date cell.
 *
 * @private
 * @param {Date} date - A valid date.
 * @param {boolean} withTime
 * @returns {string}
 */
function formatUtc(date, withTime) {
	const year = date.getUTCFullYear();
	if (year < 0 || year > 9999) {
		const iso = date.toISOString();
		return withTime ? iso : iso.slice(0, iso.indexOf('T'));
	}
	const day = `${pad(year, 4)}-${pad(date.getUTCMonth() + 1, 2)}-${pad(date.getUTCDate(), 2)}`;
	if (!withTime) return day;
	const time = `${pad(date.getUTCHours(), 2)}:${pad(date.getUTCMinutes(), 2)}:${pad(date.getUTCSeconds(), 2)}`;
	return `${day}T${time}.${pad(date.getUTCMilliseconds(), 3)}Z`;
}

/** @private */
function pad(value, length) {
	return String(value).padStart(length, '0');
}

/**
 * Epoch milliseconds of a UTC wall-clock reading. Unlike `Date.UTC`, years 0
 * to 99 stay themselves instead of becoming 1900 to 1999.
 *
 * @private
 */
function utcTime(year, monthIndex, day, hours = 0, minutes = 0, seconds = 0, ms = 0) {
	const date = new Date(0);
	date.setUTCFullYear(year, monthIndex, day);
	date.setUTCHours(hours, minutes, seconds, ms);
	return date.getTime();
}
