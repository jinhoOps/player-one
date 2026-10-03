import type { EquipSlotKey } from "@/lib/game";

// One line icon per equipment slot. The slot keys keep their RPG meaning in
// code (helm, armor, greaves, boots); on screen the icon stands alone and the
// plain name (SLOT_LABELS) goes to the tooltip and screen readers.
const PATHS: Record<EquipSlotKey, string> = {
  head: "M5 15a7 7 0 0 1 14 0v2H5ZM3 17h18M12 8V5", // cap
  top: "M8 4 4 7l2 4 2-1v10h8V10l2 1 2-4-4-3-2 2h-4Z", // shirt
  bottom: "M7 4h10l1 16h-4l-2-10-2 10H6Z", // trousers
  shoes: "M7 5v9l-3 2v3h16v-2l-6-2-2-3V5Z", // boot
};

export function SlotIcon({ slot, size = 24, className }: { slot: EquipSlotKey; size?: number; className?: string }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      strokeLinecap="round"
      aria-hidden
    >
      <path d={PATHS[slot]} />
    </svg>
  );
}
