import type { CategoryKey } from "@/lib/items";

// One line icon per inventory category, on the same 24px grid as SlotIcon.
const PATHS: Record<CategoryKey | "all" | "trophy", string> = {
  all: "M4 4h7v7H4ZM13 4h7v7h-7ZM4 13h7v7H4ZM13 13h7v7h-7Z", // grid
  digital: "M5 6h14v9H5ZM3 18h18", // laptop
  camera: "M4 8h4l1.5-2h5L16 8h4v11H4ZM15.5 13a3.5 3.5 0 1 1-7 0 3.5 3.5 0 1 1 7 0", // camera
  bag: "M5 9h14l-1 11H6ZM9 9V7a3 3 0 0 1 6 0v2", // bag
  kitchen: "M3 11h13v1a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5ZM16 12h5", // frying pan
  living: "M8 4h8l3 7H5ZM12 11v8M8 20h8", // lamp
  hobby: "M7 8h10a4 4 0 0 1 4 4v1a3 3 0 0 1-5.4 1.8L14.5 13h-5l-1.1 1.8A3 3 0 0 1 3 13v-1a4 4 0 0 1 4-4ZM7.5 10.5v3M6 12h3M16 11.5h.01M18 13h.01", // gamepad
  care: "M10 3h4v3h-4ZM9 6h6l1 3v11H8V9ZM8 13h8", // bottle
  custom: "M4 4h7l9 9-7 7-9-9ZM8 8h.01", // tag
  trophy: "M8 4h8v5a4 4 0 0 1-8 0ZM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M9 20h6M10 17h4", // trophy
};

export function ItemIcon({
  kind,
  size = 24,
  className,
}: {
  kind: keyof typeof PATHS;
  size?: number;
  className?: string;
}) {
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
      <path d={PATHS[kind]} />
    </svg>
  );
}
