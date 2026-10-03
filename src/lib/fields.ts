import type { VisibilityKey } from "./game";

// CharacterSheet field id → visibility key.
export const FIELD_VISIBILITY: Record<string, VisibilityKey> = {
  height_cm: "height",
  weight_kg: "weight",
  skeletal_muscle_kg: "skeletal_muscle",
  body_fat_pct: "body_fat",
  head: "head",
  top: "top",
  bottom: "bottom",
  shoes: "shoes",
  class: "class",
  job_title: "job_title",
  wealth: "wealth",
};

export const VISIBILITY_LABELS: Record<VisibilityKey, string> = {
  nickname: "닉네임",
  title: "칭호",
  level: "레벨 (만 나이)",
  class: "클래스",
  job_title: "직업명",
  height: "키",
  weight: "몸무게",
  skeletal_muscle: "골격근량",
  body_fat: "체지방률",
  head: "투구 (머리둘레·모자)",
  top: "상의",
  bottom: "하의 (허리·사이즈)",
  shoes: "신발",
  wealth: "자산 티어",
};
