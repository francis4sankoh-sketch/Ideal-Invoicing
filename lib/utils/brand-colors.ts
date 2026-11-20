// A business's brand colour plus a pale and a dark version of it, for backgrounds and hovers.
const FALLBACK = '#1f3a5f';

function mix(hex: string, target: number, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => Math.round(c * (1 - amount) + target * amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

export function brandPalette(color: string | null | undefined) {
  const base = color && /^#[0-9a-f]{6}$/i.test(color) ? color : FALLBACK;
  return { base, pale: mix(base, 255, 0.93), dark: mix(base, 0, 0.42) };
}
