// @vitest-environment jsdom

import { describe, it, expect, vi } from 'vitest';
import {
	normalizeHexColor,
	createCheckboxControl,
	createTextControl,
	createSliderControl,
	createSelectControl,
	COLOR_PRESETS,
	hexToRgb,
	rgbToHex,
	interpolateColor,
	createColorPresetControl,
	createColorPickerGridControl,
} from '../../../src/modules/chart-controls/shared.js';

describe('normalizeHexColor', () => {
	it('returns valid hex color unchanged', () => {
		expect(normalizeHexColor('#ff0000', '#000000')).toBe('#ff0000');
		expect(normalizeHexColor('#ABCDEF', '#000000')).toBe('#ABCDEF');
	});

	it('returns fallback for invalid color', () => {
		expect(normalizeHexColor('red', '#000000')).toBe('#000000');
		expect(normalizeHexColor('', '#111111')).toBe('#111111');
		expect(normalizeHexColor(null, '#222222')).toBe('#222222');
		expect(normalizeHexColor('#fff', '#333333')).toBe('#333333');
	});
});

describe('hexToRgb', () => {
	it('converts hex to rgb components', () => {
		expect(hexToRgb('#ff0000')).toEqual({ r: 255, g: 0, b: 0 });
		expect(hexToRgb('#00ff00')).toEqual({ r: 0, g: 255, b: 0 });
		expect(hexToRgb('#0000ff')).toEqual({ r: 0, g: 0, b: 255 });
		expect(hexToRgb('#ffffff')).toEqual({ r: 255, g: 255, b: 255 });
	});

	it('handles hex without hash', () => {
		expect(hexToRgb('ff0000')).toEqual({ r: 255, g: 0, b: 0 });
	});

	it('returns black for invalid hex', () => {
		expect(hexToRgb('invalid')).toEqual({ r: 0, g: 0, b: 0 });
	});
});

describe('rgbToHex', () => {
	it('converts rgb to hex string', () => {
		expect(rgbToHex(255, 0, 0)).toBe('#FF0000');
		expect(rgbToHex(0, 255, 0)).toBe('#00FF00');
		expect(rgbToHex(0, 0, 0)).toBe('#000000');
	});

	it('clamps values to 0-255 range', () => {
		expect(rgbToHex(300, -10, 128)).toBe('#FF0080');
	});
});

describe('interpolateColor', () => {
	it('returns first color at t=0', () => {
		expect(interpolateColor('#000000', '#ffffff', 0)).toBe('#000000');
	});

	it('returns second color at t=1', () => {
		expect(interpolateColor('#000000', '#ffffff', 1)).toBe('#FFFFFF');
	});

	it('returns midpoint at t=0.5', () => {
		const mid = interpolateColor('#000000', '#ffffff', 0.5);
		expect(mid).toBe('#808080');
	});

	it('clamps t to 0-1 range', () => {
		expect(interpolateColor('#000000', '#ffffff', -1)).toBe('#000000');
		expect(interpolateColor('#000000', '#ffffff', 2)).toBe('#FFFFFF');
	});
});

describe('COLOR_PRESETS', () => {
	it('has Pastel, Bold, and Colorblind-Safe presets', () => {
		expect(COLOR_PRESETS).toHaveProperty('Pastel');
		expect(COLOR_PRESETS).toHaveProperty('Bold');
		expect(COLOR_PRESETS).toHaveProperty('Colorblind-Safe');
	});

	it('each preset is a non-empty array of hex colors', () => {
		Object.values(COLOR_PRESETS).forEach(colors => {
			expect(Array.isArray(colors)).toBe(true);
			expect(colors.length).toBeGreaterThan(0);
			colors.forEach(c => expect(c).toMatch(/^#[0-9a-fA-F]{6}$/));
		});
	});
});

describe('createCheckboxControl', () => {
	it('creates checkbox with correct structure', () => {
		const el = createCheckboxControl('cb-test', 'My Checkbox', true);
		const input = el.querySelector('input');
		expect(input.type).toBe('checkbox');
		expect(input.checked).toBe(true);
		expect(input.id).toBe('cb-test');
	});

	it('creates unchecked disabled checkbox', () => {
		const el = createCheckboxControl('cb-dis', 'Disabled', false, true);
		const input = el.querySelector('input');
		expect(input.checked).toBe(false);
		expect(input.disabled).toBe(true);
	});
});

describe('createTextControl', () => {
	it('creates text input with value and maxLength', () => {
		const el = createTextControl('txt-test', 'Title', 'hello', 50);
		const input = el.querySelector('input');
		expect(input.type).toBe('text');
		expect(input.value).toBe('hello');
		expect(input.maxLength).toBe(50);
	});

	it('handles null value', () => {
		const el = createTextControl('txt-null', 'Title', null);
		const input = el.querySelector('input');
		expect(input.value).toBe('');
	});
});

describe('createSliderControl', () => {
	it('creates range input with correct attributes', () => {
		const el = createSliderControl('slider-test', 'Radius', 5, 1, 10, 0.5);
		const input = el.querySelector('input[type="range"]');
		expect(input.min).toBe('1');
		expect(input.max).toBe('10');
		expect(input.step).toBe('0.5');
		expect(input.value).toBe('5');
	});

	it('includes output element with current value', () => {
		const el = createSliderControl('s', 'Label', 7, 0, 100, 1);
		const output = el.querySelector('output');
		expect(output.textContent).toBe('7');
	});
});

describe('createSelectControl', () => {
	it('creates select with options', () => {
		const opts = [
			{ value: 'a', label: 'Alpha' },
			{ value: 'b', label: 'Beta' },
		];
		const el = createSelectControl('sel-test', 'Choice', opts, 'b');
		const select = el.querySelector('select');
		expect(select.options.length).toBe(2);
		expect(select.options[1].selected).toBe(true);
	});

	it('creates disabled select', () => {
		const el = createSelectControl('sel-dis', 'X', [], '', true);
		expect(el.querySelector('select').disabled).toBe(true);
	});
});

describe('createColorPresetControl', () => {
	it('creates buttons for each preset', () => {
		const el = createColorPresetControl('preset-test', 'Palette', 'Bold');
		const buttons = el.querySelectorAll('button');
		expect(buttons.length).toBe(Object.keys(COLOR_PRESETS).length);
	});

	it('calls onSelect callback when button clicked', () => {
		const onSelect = vi.fn();
		const el = createColorPresetControl('preset-cb', 'Palette', 'Bold', false, onSelect);
		const firstBtn = el.querySelector('button');
		firstBtn.click();
		expect(onSelect).toHaveBeenCalledTimes(1);
		expect(onSelect.mock.calls[0][0]).toBe(Object.keys(COLOR_PRESETS)[0]);
	});

	it('does not call onSelect when disabled', () => {
		const onSelect = vi.fn();
		const el = createColorPresetControl('preset-dis', 'Palette', 'Bold', true, onSelect);
		el.querySelector('button').click();
		expect(onSelect).not.toHaveBeenCalled();
	});
});

describe('createColorPickerGridControl', () => {
	it('creates color inputs for each item', () => {
		const el = createColorPickerGridControl('grid', 'Colors', ['cat1', 'cat2'], { cat1: '#ff0000', cat2: '#00ff00' });
		const inputs = el.querySelectorAll('input[type="color"]');
		expect(inputs.length).toBe(2);
		expect(inputs[0].value).toBe('#ff0000');
	});

	it('uses fallback color for missing items', () => {
		const el = createColorPickerGridControl('grid2', 'Colors', ['x'], {});
		const input = el.querySelector('input[type="color"]');
		expect(input.value).toBe('#999999');
	});

	it('calls onColorChange when input changes', () => {
		const onChange = vi.fn();
		const el = createColorPickerGridControl('grid3', 'Colors', ['item1'], { item1: '#aabbcc' }, false, onChange);
		const input = el.querySelector('input[type="color"]');
		input.value = '#112233';
		input.dispatchEvent(new Event('change'));
		expect(onChange).toHaveBeenCalledWith('item1', '#112233');
	});
});
