import { describe, test, expect } from 'vitest';
import { hexToHsl, hslToHex, ensureCardContrast } from '../lib/color';

describe('hexToHsl', () => {
  test('pure black', () => {
    const { h, s, l } = hexToHsl('#000000');
    expect(l).toBe(0);
  });

  test('pure white', () => {
    const { h, s, l } = hexToHsl('#ffffff');
    expect(l).toBe(1);
    expect(s).toBe(0);
  });

  test('pure red', () => {
    const { h, s, l } = hexToHsl('#ff0000');
    expect(h).toBeCloseTo(0, 5);
    expect(s).toBeCloseTo(1, 5);
    expect(l).toBeCloseTo(0.5, 5);
  });

  test('handles #RGB shorthand', () => {
    const full = hexToHsl('#ff6600');
    const short = hexToHsl('#f60');
    expect(short.h).toBeCloseTo(full.h, 5);
    expect(short.s).toBeCloseTo(full.s, 5);
    expect(short.l).toBeCloseTo(full.l, 5);
  });

  test('handles bare hex without #', () => {
    const withHash = hexToHsl('#4a6fa5');
    const bare = hexToHsl('4a6fa5');
    expect(bare.h).toBeCloseTo(withHash.h, 5);
    expect(bare.s).toBeCloseTo(withHash.s, 5);
    expect(bare.l).toBeCloseTo(withHash.l, 5);
  });

  test('throws on invalid hex', () => {
    expect(() => hexToHsl('#xyz')).toThrow('Invalid hex color');
    expect(() => hexToHsl('#12345')).toThrow('Invalid hex color');
    expect(() => hexToHsl('')).toThrow('Invalid hex color');
  });
});

describe('hslToHex', () => {
  test('black', () => {
    expect(hslToHex(0, 0, 0)).toBe('#000000');
  });

  test('white', () => {
    expect(hslToHex(0, 0, 1)).toBe('#ffffff');
  });

  test('mid gray', () => {
    const hex = hslToHex(0, 0, 0.5);
    expect(hex).toBe('#808080');
  });
});

describe('hexToHsl / hslToHex round-trip', () => {
  const colors = ['#e63946', '#4a6fa5', '#2d3748', '#1a0533', '#fca311', '#0a2463', '#87ceeb'];

  for (const color of colors) {
    test(`round-trip: ${color}`, () => {
      const hsl = hexToHsl(color);
      const back = hslToHex(hsl.h, hsl.s, hsl.l);
      // Allow ±1 per channel due to rounding
      const origR = parseInt(color.slice(1, 3), 16);
      const origG = parseInt(color.slice(3, 5), 16);
      const origB = parseInt(color.slice(5, 7), 16);
      const backR = parseInt(back.slice(1, 3), 16);
      const backG = parseInt(back.slice(3, 5), 16);
      const backB = parseInt(back.slice(5, 7), 16);
      expect(Math.abs(origR - backR)).toBeLessThanOrEqual(1);
      expect(Math.abs(origG - backG)).toBeLessThanOrEqual(1);
      expect(Math.abs(origB - backB)).toBeLessThanOrEqual(1);
    });
  }
});

describe('ensureCardContrast', () => {
  test('dark color passes through unchanged', () => {
    const { hex, darkened } = ensureCardContrast('#1a0533');
    expect(darkened).toBe(false);
    // Should be essentially the same color
    const origR = parseInt('1a', 16);
    const resultR = parseInt(hex.slice(1, 3), 16);
    expect(Math.abs(origR - resultR)).toBeLessThanOrEqual(1);
  });

  test('white gets darkened', () => {
    const { hex, darkened } = ensureCardContrast('#ffffff');
    expect(darkened).toBe(true);
    const hsl = hexToHsl(hex);
    expect(hsl.l).toBeCloseTo(0.45, 2);
  });

  test('light parchment gets darkened', () => {
    const { hex, darkened } = ensureCardContrast('#e8dcc8');
    expect(darkened).toBe(true);
    const hsl = hexToHsl(hex);
    expect(hsl.l).toBeLessThanOrEqual(0.451);
  });

  test('preserves hue when darkening', () => {
    const original = hexToHsl('#f5e6d3');
    const { hex } = ensureCardContrast('#f5e6d3');
    const result = hexToHsl(hex);
    expect(result.h).toBeCloseTo(original.h, 2);
  });

  test('custom maxLightness threshold', () => {
    const { hex, darkened } = ensureCardContrast('#808080', 0.3);
    expect(darkened).toBe(true);
    const hsl = hexToHsl(hex);
    expect(hsl.l).toBeCloseTo(0.3, 2);
  });

  test('exactly at maxLightness passes through', () => {
    // Create a color with exactly 0.45 lightness
    const atThreshold = hslToHex(0.5, 0.5, 0.45);
    const { darkened } = ensureCardContrast(atThreshold, 0.45);
    expect(darkened).toBe(false);
  });

  test('just above maxLightness gets clamped', () => {
    const justAbove = hslToHex(0.5, 0.5, 0.46);
    const { darkened } = ensureCardContrast(justAbove, 0.45);
    expect(darkened).toBe(true);
  });

  test('handles #RGB shorthand', () => {
    const { hex, darkened } = ensureCardContrast('#fff');
    expect(darkened).toBe(true);
    expect(hex).toMatch(/^#[0-9a-f]{6}$/);
  });

  test('handles bare hex without #', () => {
    const { hex, darkened } = ensureCardContrast('ffffff');
    expect(darkened).toBe(true);
    expect(hex).toMatch(/^#[0-9a-f]{6}$/);
  });

  test('throws on invalid hex', () => {
    expect(() => ensureCardContrast('nope')).toThrow('Invalid hex color');
  });
});
