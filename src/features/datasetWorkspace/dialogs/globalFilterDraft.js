/**
 * Dialog-internal model for a global-filter editing session.
 *
 * Owns transient rule identity and draft transformations. The `_uid` field is
 * dialog bookkeeping and is removed before a filter leaves the dialog.
 */

import {
	createDefaultFilterConfig,
	getCategoricalFilterOptions,
} from '../../../domain/filters/chartFilter.js';
import { normalizeGlobalFilter } from '../../../domain/filters/globalFilter.js';

let nextRuleUid = 1;

/** @private */
function cloneRule(rule) {
	return JSON.parse(JSON.stringify(rule || createDefaultFilterConfig()));
}

export function createEmptyRuleDraft() {
	return {
		_uid: nextRuleUid++,
		...createDefaultFilterConfig(),
	};
}

/** @private */
function ruleFromExisting(rule) {
	return {
		_uid: nextRuleUid++,
		...cloneRule(rule),
	};
}

/** @private */
function stripUid(rule) {
	const { _uid, ...rest } = rule;
	return rest;
}

export function createInitialDraftRules(initialFilter, { numericColumns, allColumns }) {
	const initialNormalized = normalizeGlobalFilter(initialFilter, numericColumns);
	const safeInitialRules = initialNormalized.rules.filter(rule => allColumns.includes(rule.column));
	return safeInitialRules.map(rule => ruleFromExisting(rule));
}

export function finalizeGlobalFilterDraft(draftRules, allColumns) {
	return {
		rules: draftRules
			.filter(rule => rule.column && allColumns.includes(rule.column))
			.map(rule => stripUid(rule)),
		combine: 'AND',
	};
}

export function applyRuleColumnChange(rule, nextColumn, {
	rows,
	numericColumns,
	missingLabel,
}) {
	if (!nextColumn) {
		rule.column = null;
		rule.include = [];
		rule.exclude = [];
		rule.search = '';
		return;
	}
	rule.column = nextColumn;
	if (numericColumns.includes(nextColumn)) {
		rule.mode = 'numeric';
		rule.operator = 'between';
		rule.min = '';
		rule.max = '';
		rule.value = '';
		rule.exclude = [];
	} else {
		rule.mode = 'categorical';
		const options = getCategoricalFilterOptions(rows, nextColumn, {
			search: '',
			limit: Number.MAX_SAFE_INTEGER,
			missingLabel,
		});
		rule.include = options.allTokens.slice();
		rule.exclude = [];
		rule.search = '';
	}
}
