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

// Words that give an item's category away, beyond the hints above (brands, everyday names).
const CATEGORY_WORDS: Record<BuiltInCategory, string[]> = {
  digital: ["맥북", "아이폰", "아이패드", "갤럭시", "에어팟", "버즈", "애플워치", "워치", "헤드폰", "스피커", "케이블", "허브", "보조배터리", "ssd", "pc"],
  camera: ["카메라", "필름", "스트로보", "짐벌", "고프로", "후지", "소니 a"],
  bag: ["가방", "파우치", "선글라스", "모자", "신발", "운동화", "스니커즈", "목걸이", "반지"],
  kitchen: ["프라이팬", "후라이팬", "그릇", "접시", "컵", "머그", "수저", "커피", "에어프라이어", "전자레인지", "밥솥", "토스터"],
  living: ["로봇청소기", "선풍기", "제습기", "베개", "이불", "매트리스", "의자", "책상", "소파", "커튼", "세탁기", "냉장고", "tv"],
  hobby: ["닌텐도", "스위치", "플스", "피아노", "텐트", "랜턴", "킥보드", "덤벨", "요가", "레고", "책", "만년필"],
  care: ["고데기", "로션", "크림", "샴푸", "칫솔", "트리머", "마사지"],
};

/** A built-in category the item's name points to, or null when nothing matches. */
export function guessCategory(name: string): BuiltInCategory | null {
  const n = name.toLowerCase().replace(/\s+/g, "");
  if (!n) return null;
  for (const k of CATEGORY_KEYS) {
    const words = [...CATEGORIES[k].hint.split("·"), ...CATEGORY_WORDS[k]];
    if (words.some((w) => n.includes(w.toLowerCase().replace(/\s+/g, "")))) return k;
  }
  return null;
}
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
