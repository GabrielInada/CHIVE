import noFacadeGetterMutation from './no-facade-getter-mutation.js';
import noChartPresentationImports from './no-chart-presentation-imports.js';
import uiStrictLeaf from './ui-strict-leaf.js';

export default {
	rules: {
		'no-chart-presentation-imports': noChartPresentationImports,
		'no-facade-getter-mutation': noFacadeGetterMutation,
		'ui-strict-leaf': uiStrictLeaf,
	},
};
