/**
 * 3D scatter identity, rendering constants, static metadata, and fresh config.
 */

const COLOR = '#2f6b4f';

export const SCATTER3D_CHART = {
  defaultPointSize: 0.03,
  minPointSize: 0.01,
  maxPointSize: 0.1,
  defaultOpacity: 0.85,
  minOpacity: 0.1,
  maxOpacity: 1,
  // Rendered point budget; buildScatter3dPoints stride-samples above this,
  // always keeping the rows that carry each axis min/max.
  maxPoints: 50000,
  // WebGL buffer cost scales with the square of the pixel ratio; cap it so
  // high-DPR screens do not quadruple the framebuffer for a preview chart.
  maxDevicePixelRatio: 2,
  camera: {
    fov: 45,
    initialTheta: Math.PI / 4,
    initialPhi: Math.PI / 3,
    initialDistance: 4,
    minDistance: 1.6,
    maxDistance: 10,
    rotateSpeed: 0.008,
    zoomSpeed: 0.0015,
    keyRotateStep: 0.15,
    keyZoomStep: 0.4,
  },
};

function createDefaultConfig() {
	return {
		enabled: false,
		expanded: false,
		x: null,
		y: null,
		z: null,
		customTitle: '',
		chartHeight: 460,
		pointSize: SCATTER3D_CHART.defaultPointSize,
		opacity: SCATTER3D_CHART.defaultOpacity,
		color: COLOR,
	};
}

export const SCATTER3D_DEFINITION = Object.freeze({
	key: 'scatter3d',
	color: COLOR,
	dimensions: {
		width: 700,
		height: 460,
		margins: {
			top: 0,
			right: 0,
			bottom: 0,
			left: 0,
		},
	},
	heightLimits: { min: 280, max: 900 },
	workspaceIds: {
		container: 'chart-scatter3d-container',
		block: 'chart-block-scatter3d',
	},
	catalogCategoryKey: 'chive-viz-category-relationship',
	createDefaultConfig,
});
