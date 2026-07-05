/**
 * 3D-scatter camera interaction.
 *
 * Pure input mechanics: pointer drag rotates, wheel and keyboard zoom,
 * Home resets. Owns only the spherical camera state (theta around the Y
 * axis, phi from the Y axis, distance from the origin); the renderer maps
 * that state onto the Three camera in its `onChange` callback and issues
 * exactly one render per input. Render-on-demand by design, there is no
 * animation loop here.
 *
 * Browser specifics that matter: the drag uses pointer capture so it
 * survives leaving the canvas, the wheel listener is registered
 * NON-passive so `preventDefault()` can stop page scroll, and handled
 * keyboard keys also call `preventDefault()` so arrows do not scroll.
 */

const PHI_EPSILON = 0.05;

/**
 * Attach the orbit interaction to a canvas.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {Object} args
 * @param {Object} args.constants - `SCATTER3D_CHART.camera`: initial angles/distance, clamps, speeds.
 * @param {(state: { theta: number, phi: number, distance: number }) => void} args.onChange
 *   Called after every accepted input with the new camera state.
 * @returns {{ state: { theta: number, phi: number, distance: number }, detach: () => void }}
 */
export function attachScatter3dInteraction(canvas, { constants, onChange }) {
	const state = {
		theta: constants.initialTheta,
		phi: constants.initialPhi,
		distance: constants.initialDistance,
	};

	let dragging = false;
	let lastX = 0;
	let lastY = 0;

	function clampState() {
		state.phi = Math.min(Math.PI - PHI_EPSILON, Math.max(PHI_EPSILON, state.phi));
		state.distance = Math.min(constants.maxDistance, Math.max(constants.minDistance, state.distance));
	}

	function emit() {
		clampState();
		onChange(state);
	}

	function onPointerDown(event) {
		if (event.button !== 0) return;
		dragging = true;
		lastX = event.clientX;
		lastY = event.clientY;
		canvas.setPointerCapture?.(event.pointerId);
	}

	function onPointerMove(event) {
		if (!dragging) return;
		const dx = event.clientX - lastX;
		const dy = event.clientY - lastY;
		lastX = event.clientX;
		lastY = event.clientY;
		state.theta -= dx * constants.rotateSpeed;
		state.phi -= dy * constants.rotateSpeed;
		emit();
	}

	function onPointerEnd(event) {
		if (!dragging) return;
		dragging = false;
		if (canvas.hasPointerCapture?.(event.pointerId)) {
			canvas.releasePointerCapture(event.pointerId);
		}
	}

	function onWheel(event) {
		event.preventDefault();
		state.distance += event.deltaY * constants.zoomSpeed;
		emit();
	}

	function onKeyDown(event) {
		switch (event.key) {
			case 'ArrowLeft':
				state.theta += constants.keyRotateStep;
				break;
			case 'ArrowRight':
				state.theta -= constants.keyRotateStep;
				break;
			case 'ArrowUp':
				state.phi -= constants.keyRotateStep;
				break;
			case 'ArrowDown':
				state.phi += constants.keyRotateStep;
				break;
			case '+':
			case '=':
				state.distance -= constants.keyZoomStep;
				break;
			case '-':
				state.distance += constants.keyZoomStep;
				break;
			case 'Home':
				state.theta = constants.initialTheta;
				state.phi = constants.initialPhi;
				state.distance = constants.initialDistance;
				break;
			default:
				return;
		}
		event.preventDefault();
		emit();
	}

	canvas.addEventListener('pointerdown', onPointerDown);
	canvas.addEventListener('pointermove', onPointerMove);
	canvas.addEventListener('pointerup', onPointerEnd);
	canvas.addEventListener('pointercancel', onPointerEnd);
	canvas.addEventListener('wheel', onWheel, { passive: false });
	canvas.addEventListener('keydown', onKeyDown);

	return {
		state,
		detach() {
			canvas.removeEventListener('pointerdown', onPointerDown);
			canvas.removeEventListener('pointermove', onPointerMove);
			canvas.removeEventListener('pointerup', onPointerEnd);
			canvas.removeEventListener('pointercancel', onPointerEnd);
			canvas.removeEventListener('wheel', onWheel);
			canvas.removeEventListener('keydown', onKeyDown);
		},
	};
}
