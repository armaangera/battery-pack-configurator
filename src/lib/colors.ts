/**
 * Stable, perceptually distinct color assignment for architectures.
 *
 * Palette is tuned to sit comfortably on the warm-stone background:
 * muted, mid-saturation earth tones (rust, slate, teal, ochre, plum…)
 * that read as distinct without competing with the UI chrome. For
 * larger sets we fall through to evenly-spaced HSL hues at the same
 * brightness/saturation envelope so additions feel like part of the
 * same family.
 */

// 10 mid-saturation hues drawn from / harmonised with the site palette
// (Mahogany Red, Pacific Blue), plus muted earth tones. Ordered so the
// first N slots stay perceptually distinct for small N.
export const ARCH_PALETTE = [
  "#b3001b", // 1 mahogany (matches --accent)
  "#50b2c0", // 2 pacific blue
  "#475569", // 3 slate
  "#92400e", // 4 cocoa
  "#3f6212", // 5 olive
  "#6b21a8", // 6 plum
  "#115e59", // 7 deep teal
  "#a16207", // 8 mustard
  "#831843", // 9 mulberry
  "#201e1f", // 10 shadow grey
];

/**
 * Build a name → color map that guarantees every distinct name gets a
 * distinct color (no wrap-around collisions). For ≤ palette size we use
 * the hand-picked palette in order; beyond that we synthesize extra
 * colors with evenly-spaced HSL hues so the mapping never collides.
 *
 * Assignment is by sorted name so the same input set always yields the
 * same mapping across renders.
 */
export function buildArchColorMap(names: Iterable<string>): Map<string, string> {
  const unique = Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
  const n = unique.length;
  const map = new Map<string, string>();

  if (n === 0) return map;

  // If we have enough palette slots, use them directly.
  if (n <= ARCH_PALETTE.length) {
    unique.forEach((name, i) => map.set(name, ARCH_PALETTE[i]));
    return map;
  }

  // Otherwise generate n evenly-spaced HSL hues at the same muted
  // envelope as the palette above — moderate saturation, mid-dark
  // lightness — so synthetic slots feel like part of the same family.
  unique.forEach((name, i) => {
    const hue = Math.round((i * 360) / n);
    const light = i % 2 === 0 ? 32 : 40;
    map.set(name, `hsl(${hue}, 45%, ${light}%)`);
  });
  return map;
}

/**
 * Build a key → unique color map where every key gets a fully distinct
 * color, regardless of how the keys are grouped (e.g. multiple thermal
 * traces per architecture). Used where we need one color per *line*,
 * not one color per architecture.
 *
 * Uses the hand-picked ARCH_PALETTE for the first N slots, then
 * synthesizes evenly-spaced HSL hues alternating lightness bands so
 * even close-numbered slots stay visually distinct.
 */
export function buildUniqueColorMap(keys: Iterable<string>): Map<string, string> {
  const unique = Array.from(new Set(keys));
  const n = unique.length;
  const map = new Map<string, string>();

  if (n === 0) return map;

  // Use palette first for small sets — these are the most distinct.
  if (n <= ARCH_PALETTE.length) {
    unique.forEach((key, i) => map.set(key, ARCH_PALETTE[i]));
    return map;
  }

  // For larger sets, fill palette then synthesize the rest at the
  // same muted envelope as the palette — moderate saturation, mid-dark
  // lightness — so the chart still reads as one family.
  unique.forEach((key, i) => {
    if (i < ARCH_PALETTE.length) {
      map.set(key, ARCH_PALETTE[i]);
      return;
    }
    const extra = i - ARCH_PALETTE.length;
    // Golden-ratio hue stepping gives well-separated hues without
    // matching any existing palette entry too closely.
    const hue = Math.round((extra * 137.508) % 360);
    const light = extra % 2 === 0 ? 32 : 40;
    map.set(key, `hsl(${hue}, 45%, ${light}%)`);
  });
  return map;
}
