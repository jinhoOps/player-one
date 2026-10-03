import { supabase } from "./supabase";

// Inventory (docs/DESIGN.md §1 인벤토리). Mirrors public.items (supabase/migrations).

export const CATEGORIES = {
  digital: { label: "디지털", hint: "노트북·태블릿·폰·모니터·키보드·마우스·이어폰·충전기" },
  camera: { label: "카메라", hint: "바디·렌즈·삼각대·액션캠·드론·조명" },
  bag: { label: "가방·잡화", hint: "백팩·토트·지갑·시계·안경·벨트·우산·부티크" },
  kitchen: { label: "주방", hint: "팬·웍·냄비·칼·도마·식기·텀블러·주방가전" },
  living: { label: "리빙·가전", hint: "청소기·공기청정기·가습기·조명·침구·수건·가구" },
  hobby: { label: "취미·레저", hint: "게임기·악기·캠핑·자전거·운동기구·피규어·문구" },
  care: { label: "뷰티·케어", hint: "드라이기·면도기·향수·전동칫솔" },
} as const;
export type BuiltInCategory = keyof typeof CATEGORIES;
export type CategoryKey = BuiltInCategory | "custom";
export const CATEGORY_KEYS = Object.keys(CATEGORIES) as BuiltInCategory[];

export const STATUS_LABELS = { using: "사용 중", spare: "예비", gone: "처분" } as const;
export type ItemStatus = keyof typeof STATUS_LABELS;

export const VERDICT_LABELS = { again: "같은 걸로", other: "다른 걸로", never: "안 삼" } as const;
export type Verdict = keyof typeof VERDICT_LABELS;

/** The trophy shelf on the public profile holds this many (enforced in the DB too). */
export const SHELF_SIZE = 6;

export type Item = {
  id: string;
  user_id: string;
  category: CategoryKey;
  custom_category: string | null;
  name: string;
  brand: string | null;
  model: string | null;
  bought_on: string | null;
  price: number | null;
  store_url: string | null;
  qty: number | null;
  qty_target: number | null;
  status: ItemStatus;
  verdict: Verdict | null;
  note: string | null;
  displayed: boolean;
  created_at: string;
};

export type ItemInput = Omit<Item, "id" | "user_id" | "created_at">;

/** Shape returned by get_public_trophies(handle): icon-level fields only. */
export type Trophy = { category: CategoryKey; name: string; brand?: string; since?: number };

/** What the public shelf shows of an item; the owner's preview uses the same. */
export const toTrophy = (i: Item): Trophy => ({
  category: i.category,
  name: i.name,
  brand: i.brand ?? undefined,
  since: i.bought_on ? Number(i.bought_on.slice(0, 4)) : undefined,
});

export const categoryLabel = (i: Pick<Item, "category" | "custom_category">) =>
  i.category === "custom" ? (i.custom_category ?? "기타") : CATEGORIES[i.category].label;

/** Stock-kept and below its target: time to top up. */
export const needsRefill = (i: Pick<Item, "qty" | "qty_target" | "status">) =>
  i.status !== "gone" && i.qty_target != null && (i.qty ?? 0) < i.qty_target;

/** Years in use, counting the year it was bought as year one. */
export const yearsOwned = (boughtOn: string | null, now = new Date()) =>
  boughtOn ? now.getFullYear() - Number(boughtOn.slice(0, 4)) + 1 : null;

export async function fetchMyItems() {
  const { data, error } = await supabase.from("items").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data as Item[];
}

export async function insertItem(input: ItemInput) {
  const { data, error } = await supabase.from("items").insert(input).select().single();
  if (error) throw error;
  return data as Item;
}

export async function updateItem(id: string, patch: Partial<ItemInput>) {
  const { data, error } = await supabase.from("items").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data as Item;
}

export async function deleteItem(id: string) {
  const { error } = await supabase.from("items").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchPublicTrophies(handle: string) {
  const { data, error } = await supabase.rpc("get_public_trophies", { p_handle: handle });
  if (error) throw error;
  return (data ?? []) as Trophy[];
}
