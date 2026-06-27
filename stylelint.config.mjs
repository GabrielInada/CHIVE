const CLASS_PATTERN =
	'^[a-z][a-z0-9]*(?:-[a-z0-9]+)*(?:(?:__(?:[a-z0-9]+(?:-[a-z0-9]+)*))|(?:--(?:[a-z0-9]+(?:-[a-z0-9]+)*)))*$';

export default {
	extends: ['stylelint-config-standard'],
	ignoreFiles: [
		'vendor/**/*.css',
		'dist/**',
		'coverage/**',
		'node_modules/**',
	],
	rules: {
		// CHIVE uses explicit cascade layers and feature bundles, so source order
		// does not always map cleanly to selector specificity.
		'no-descending-specificity': null,
		'alpha-value-notation': null,
		'at-rule-empty-line-before': null,
		'color-function-alias-notation': null,
		'color-function-notation': null,
		'color-hex-length': null,
		'comment-empty-line-before': null,
		'declaration-block-no-redundant-longhand-properties': null,
		'declaration-empty-line-before': null,
		'declaration-property-value-keyword-no-deprecated': null,
		'keyframes-name-pattern': null,
		'media-feature-range-notation': null,
		'property-no-vendor-prefix': null,
		'rule-empty-line-before': null,
		'value-keyword-case': null,
		'selector-class-pattern': [CLASS_PATTERN, {
			message:
				'Expected class selector to use English kebab-case with optional BEM-style __element/--modifier.',
			severity: 'warning',
		}],
		'custom-property-pattern': ['^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$', {
			message: 'Expected custom property to use lowercase kebab-case.',
			severity: 'warning',
		}],
	},
};
