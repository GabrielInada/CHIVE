import domainNoChartPresentation from './domain-no-chart-presentation.js';
import noFacadeGetterMutation from './no-facade-getter-mutation.js';
import uiStrictLeaf from './ui-strict-leaf.js';

export default {
	rules: {
		'domain-no-chart-presentation': domainNoChartPresentation,
		'no-facade-getter-mutation': noFacadeGetterMutation,
		'ui-strict-leaf': uiStrictLeaf,
	},
};
