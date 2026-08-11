/**
 * Contrast-safe tenant colors.
 * The app background is near-black, so a tenant whose primary color is dark
 * (e.g. #000000) would render invisible buttons/headers. These helpers derive
 * an accent that always reads on the dark surface, plus a readable foreground.
 */

const BG_LUM = 0; // app background is black

function parseHex(hex?: string | null): [number, number, number] | null {
  if (!hex) return null;
  let h = hex.trim().replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function toHex([r, g, b]: [number, number, number]) {
  return (
    "#" +
    [r, g, b]
      .map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0"))
      .join("")
  );
}

function luminance(rgb: [number, number, number]) {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: number, b: number) {
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

function lighten(rgb: [number, number, number], amount: number): [number, number, number] {
  return [
    rgb[0] + (255 - rgb[0]) * amount,
    rgb[1] + (255 - rgb[1]) * amount,
    rgb[2] + (255 - rgb[2]) * amount,
  ];
}

/** Ensures the color is visible against the dark app background. */
export function readableAccent(primary?: string | null, secondary?: string | null, fallback = "#FFFFFF") {
  const p = parseHex(primary);
  if (!p) return fallback;
  if (contrast(luminance(p), BG_LUM) >= 3) return toHex(p);

  // Try the secondary color before fabricating one.
  const s = parseHex(secondary);
  if (s && contrast(luminance(s), BG_LUM) >= 3) return toHex(s);

  // Lighten the primary until it reads on black.
  let step = 0.1;
  let candidate = p;
  while (step <= 1 && contrast(luminance(candidate), BG_LUM) < 3.5) {
    candidate = lighten(p, step);
    step += 0.1;
  }
  return toHex(candidate);
}

/** Foreground that reads on top of the given accent color. */
export function readableForeground(accent: string, preferred?: string | null) {
  const a = parseHex(accent);
  if (!a) return "#000000";
  const la = luminance(a);
  const pref = parseHex(preferred);
  if (pref && contrast(luminance(pref), la) >= 4.5) return toHex(pref);
  return la > 0.45 ? "#000000" : "#FFFFFF";
}

export function withAlpha(hex: string, alphaHex: string) {
  const rgb = parseHex(hex);
  return rgb ? toHex(rgb) + alphaHex : hex;
}
