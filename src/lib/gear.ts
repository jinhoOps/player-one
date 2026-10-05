import type { EquipSlotKey } from "./game";

// What kind of thing a slot holds (docs/DESIGN.md §10). Stored in
// profiles.gear as {slot: kind}; a slot without a kind is its default. The 3D
// shape of each kind lives in the slot's registry (HEADWEAR for the head), and
// its keys must match these.

export const GEAR_KINDS = {
  head: { cap: "캡", beanie: "비니", bucket: "버킷햇" },
} as const satisfies Partial<Record<EquipSlotKey, Record<string, string>>>;

export type KindSlot = keyof typeof GEAR_KINDS;
export type HeadKind = keyof (typeof GEAR_KINDS)["head"];
export type Gear = Partial<Record<EquipSlotKey, string>>;

export const DEFAULT_KIND: Record<KindSlot, string> = { head: "cap" };

export const hasKinds = (slot: EquipSlotKey): slot is KindSlot => slot in GEAR_KINDS;

/** The kind worn in a slot: the stored one if the app knows it, else the slot's default. */
export function kindOf(gear: Gear | null | undefined, slot: KindSlot): string {
  const k = gear?.[slot];
  return k && k in GEAR_KINDS[slot] ? k : DEFAULT_KIND[slot];
}

/** Label of a stored kind, or null when none was picked. */
export function kindLabel(gear: Gear | null | undefined, slot: EquipSlotKey): string | null {
  if (!hasKinds(slot)) return null;
  const k = gear?.[slot];
  return k && k in GEAR_KINDS[slot] ? (GEAR_KINDS[slot] as Record<string, string>)[k] : null;
}
