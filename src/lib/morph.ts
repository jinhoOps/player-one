import type { BodyType, HairStyle } from "./game";

/**
 * Body morph inputs for the SD character. Each axis is -1…1 relative to a
 * Korean young-adult average for the body type; null means "unknown" and
 * renders the average. Visibility is enforced upstream: a private stat never
 * reaches here, so the silhouette can't leak it.
 */
export type BodyMorph = {
  body: BodyType | "neutral";
  /** Cosmetic, always public; null falls back to the body type's default. */
  hair: HairStyle | null;
  height: number | null;
  weight: number | null;
  muscle: number | null;
};

const AVERAGE = {
  female: { height: 161, bmi: 21, muscle: 0.37 },
  male: { height: 174, bmi: 23.5, muscle: 0.45 },
  neutral: { height: 168, bmi: 22.3, muscle: 0.41 },
};

const clamp = (v: number) => Math.min(1, Math.max(-1, v));

export function morphFromStats(stats: {
  body_type?: BodyType | null;
  hair_style?: HairStyle | null;
  height_cm?: number | null;
  weight_kg?: number | null;
  skeletal_muscle_kg?: number | null;
}): BodyMorph {
  const { body_type, height_cm: h, weight_kg: w, skeletal_muscle_kg: m } = stats;
  const body = body_type ?? "neutral";
  const avg = AVERAGE[body];
  // Weight reads as BMI, so it needs a height; muscle reads as a share of weight.
  const bmi = h != null && w != null ? w / (h / 100) ** 2 : null;
  return {
    body,
    hair: stats.hair_style ?? null,
    height: h != null ? clamp((h - avg.height) / 18) : null,
    weight: bmi != null ? clamp((bmi - avg.bmi) / 7) : null,
    muscle: w != null && m != null ? clamp((m / w - avg.muscle) / 0.08) : null,
  };
}
