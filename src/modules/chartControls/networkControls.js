/**
 * Network-graph controls (public facade).
 *
 * Builds the right-sidebar control group for the network graph and wires its
 * listeners. The implementation lives in the `networkControls/` folder, split
 * by responsibility; this file is the single public entry point and keeps the
 * export surface stable for the chart-controls registry in
 * `chartControlsManager.js`.
 *
 *   - builder.js   `createNetworkGraphControls` (the Data/Display/Styling/Advanced sections)
 *   - listeners.js `setupNetworkGraphControlListeners` (control wiring + reset-zoom + color presets)
 *   - defaults.js  `computeDefaults` (first-activation source/target selection)
 */

export { createNetworkGraphControls } from './networkControls/builder.js';
export { setupNetworkGraphControlListeners } from './networkControls/listeners.js';
export { computeDefaults } from './networkControls/defaults.js';
