/**
 * color.ts
 *
 * Hex/HSL conversion and contrast enforcement for card backgrounds.
 * Cards use white text — backgrounds must be dark enough to read.
 */

/** Parse hex color (#RGB, #RRGGBB, or bare RRGGBB) to HSL. */
export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  let h = hex.replace(/^#/, '');
  if (h.length === 3) {
    h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  }
  if (!/^[0-9a-fA-F]{6}$/.test(h)) {
    throw new Error(`Invalid hex color: ${hex}`);
  }

  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) {
    return { h: 0, s: 0, l };
  }

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

  let hue: number;
  if (max === r) {
    hue = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  } else if (max === g) {
    hue = ((b - r) / d + 2) / 6;
  } else {
    hue = ((r - g) / d + 4) / 6;
  }

  return { h: hue, s, l };
}

/** Convert HSL (0-1 ranges) back to #RRGGBB hex. */
export function hslToHex(h: number, s: number, l: number): string {
  if (s === 0) {
    const v = Math.round(l * 255);
    return `#${v.toString(16).padStart(2, '0')}${v.toString(16).padStart(2, '0')}${v.toString(16).padStart(2, '0')}`;
  }

  const hue2rgb = (p: number, q: number, t: number): number => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;

  const r = Math.round(hue2rgb(p, q, h + 1 / 3) * 255);
  const g = Math.round(hue2rgb(p, q, h) * 255);
  const b = Math.round(hue2rgb(p, q, h - 1 / 3) * 255);

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * Ensure a hex color is dark enough for white text overlay.
 * Clamps HSL lightness to maxLightness (default 0.45), preserving hue and saturation.
 * Returns the (possibly darkened) hex and whether it was changed.
 */
export function ensureCardContrast(
  hex: string,
  maxLightness: number = 0.45,
): { hex: string; darkened: boolean } {
  const hsl = hexToHsl(hex);
  if (hsl.l <= maxLightness) {
    // Already dark enough — normalize to #RRGGBB format
    return { hex: hslToHex(hsl.h, hsl.s, hsl.l), darkened: false };
  }
  return { hex: hslToHex(hsl.h, hsl.s, maxLightness), darkened: true };
}
