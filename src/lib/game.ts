// Game vocabulary: classes, rarity, wealth tiers, visibility keys. See docs/DESIGN.md §1.

export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

export const CLASSES = {
  warrior: { name: "전사", jobs: "현장·제조·운동·영업", concept: "몸으로 돌파" },
  mage: { name: "마법사", jobs: "개발·연구·데이터", concept: "지식으로 세계를 조작" },
  tank: { name: "탱커", jobs: "공공·관리·CS·운영", concept: "버티고 지킴" },
  healer: { name: "힐러", jobs: "의료·돌봄·교육", concept: "남을 회복시킴" },
  ranger: { name: "레인저", jobs: "디자인·기획·마케팅", concept: "원거리 정밀 타격" },
  merchant: { name: "상인", jobs: "자영업·금융·사업", concept: "자원 순환" },
  bard: { name: "음유시인", jobs: "크리에이터·예술", concept: "버프와 영향력" },
} as const;

export type ClassKey = keyof typeof CLASSES;

export type WealthTier = { label: string; rarity: Rarity };

// Index is what gets stored (profiles.wealth_tier). Never store the amount.
// 0–9: 천만 원 단위 (1억 미만), 10–18: 억 단위 (1억~10억), 19: 10억 이상.
export const WEALTH_TIERS: WealthTier[] = [
  ...Array.from({ length: 10 }, (_, i): WealthTier => ({
    label: i === 0 ? "1천만 원 미만" : `${i}천만 ~ ${i === 9 ? "1억" : `${i + 1}천만`} 원`,
    rarity: i < 3 ? "common" : "uncommon",
  })),
  ...Array.from({ length: 9 }, (_, i): WealthTier => ({
    label: `${i + 1}억 ~ ${i + 2}억 원`,
    rarity: i + 1 < 5 ? "rare" : "epic",
  })),
  { label: "10억 원 이상", rarity: "legendary" },
];

export const VISIBILITY_KEYS = [
  "nickname",
  "title",
  "level",
  "class",
  "job_title",
  "height",
  "weight",
  "skeletal_muscle",
  "body_fat",
  "head",
  "top",
  "bottom",
  "shoes",
  "wealth",
] as const;

export type VisibilityKey = (typeof VISIBILITY_KEYS)[number];
export type Visibility = Record<VisibilityKey, boolean>;

export const EQUIP_SLOTS = ["head", "top", "bottom", "shoes"] as const;
export type EquipSlotKey = (typeof EQUIP_SLOTS)[number];

export const SLOT_LABELS: Record<EquipSlotKey, string> = {
  head: "HELM",
  top: "ARMOR",
  bottom: "LEGS",
  shoes: "BOOTS",
};

export function ageFrom(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const b = new Date(birthDate);
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  if (now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) age--;
  return age;
}
