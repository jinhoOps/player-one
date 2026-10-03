/**
 * Body morph inputs, normalized 0–1. null renders the standard mannequin —
 * required whenever body stats are private, or the silhouette would leak them.
 */
export type BodyMorph = { height: number; weight: number; muscle: number } | null;

export function morphFromStats(stats: {
  height_cm?: number | null;
  weight_kg?: number | null;
  skeletal_muscle_kg?: number | null;
}): BodyMorph {
  const { height_cm: h, weight_kg: w, skeletal_muscle_kg: m } = stats;
  if (h == null || w == null || m == null) return null;
  const n = (v: number, lo: number, hi: number) => Math.min(1, Math.max(0, (v - lo) / (hi - lo)));
  return { height: n(h, 140, 200), weight: n(w, 40, 120), muscle: n(m, 15, 50) };
}
