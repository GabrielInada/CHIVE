/**
 * Keep one-finger gestures available for page scrolling and taps. Two fingers
 * manipulate zoomable charts; mouse and trackpad behavior follows D3's default.
 *
 * @param {MouseEvent | WheelEvent | TouchEvent} event
 * @returns {boolean}
 */
export function allowChartZoom(event) {
	return (!event.touches || event.touches.length > 1)
		&& (!event.ctrlKey || event.type === 'wheel') && !event.button;
}
