// Village sky by Korean time (docs/DESIGN.md §9). Seven phases; deep night
// wraps past midnight.

export const PHASES = {
  night: { label: "깊은 밤", from: 23, sky: ["#1d2340", "#3a3d63"], light: "#9fb0e8", sun: 0.55, tint: "#8f98c6" },
  dawn: { label: "새벽", from: 4, sky: ["#3b4a7a", "#d9a7b5"], light: "#c9b4d8", sun: 0.6, tint: "#b9aed0" },
  early: { label: "이른 아침", from: 6, sky: ["#a9cfe8", "#fde3c2"], light: "#ffe2bd", sun: 1.0, tint: "#f4e6d6" },
  morning: { label: "오전", from: 9, sky: ["#8fc3ec", "#e6f3fb"], light: "#fff4e2", sun: 1.25, tint: "#ffffff" },
  day: { label: "낮", from: 12, sky: ["#7db8ea", "#dff0fb"], light: "#ffffff", sun: 1.4, tint: "#ffffff" },
  dusk: { label: "해질녘", from: 17, sky: ["#6d7fbf", "#f6b27a"], light: "#ffc18a", sun: 0.95, tint: "#f6d2b4" },
  evening: { label: "저녁", from: 19, sky: ["#2e3566", "#7a6c9c"], light: "#b3b0e6", sun: 0.65, tint: "#a6a3d0" },
} as const;
export type Phase = keyof typeof PHASES;

/** The phase for a moment, read on the Korea clock wherever the viewer is. */
export function kstPhase(at = new Date()): Phase {
  const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: "Asia/Seoul" }).format(at));
  if (h >= 23 || h < 4) return "night";
  if (h < 6) return "dawn";
  if (h < 9) return "early";
  if (h < 12) return "morning";
  if (h < 17) return "day";
  if (h < 19) return "dusk";
  return "evening";
}
