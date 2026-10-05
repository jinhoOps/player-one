import { supabase } from "./supabase";
import type { SheetData } from "@/components/CharacterSheet";
import { ageFrom, type BodyType, type ClassKey, type HairStyle, type Visibility } from "./game";
import { kindLabel, kindOf, type Gear } from "./gear";
import { morphFromStats } from "./morph";

// Mirrors public.profiles (supabase/migrations).
export type Profile = {
  user_id: string;
  handle: string | null;
  nickname: string | null;
  title: string | null;
  birth_date: string | null;
  class_key: ClassKey | null;
  job_title: string | null;
  body_type: BodyType | null;
  hair_style: HairStyle | null;
  /** The helmet stays equipped but the 3D character doesn't wear it. Public, like the hairstyle. */
  hide_headwear: boolean;
  /** Kind worn per slot ({head: "beanie"}); see src/lib/gear.ts. */
  gear: Gear;
  height_cm: number | null;
  weight_kg: number | null;
  skeletal_muscle_kg: number | null;
  body_fat_pct: number | null;
  head_cm: number | null;
  hat_size: string | null;
  top_size: string | null;
  waist_cm: number | null;
  bottom_size: string | null;
  shoe_mm: number | null;
  wealth_tier: number | null;
  visibility: Visibility;
  /** When the nickname was changed, kept by the server (limit_nickname_changes). */
  nickname_changes: string[];
};

export type ProfilePatch = Partial<Omit<Profile, "user_id" | "nickname_changes">>;

// Nickname changes: at most 3 in any 7 days, 3 minutes apart (enforced in the DB).
export const NICKNAME_WEEKLY = 3;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const COOLDOWN_MS = 3 * 60 * 1000;

/** How many nickname changes are left this week, and when the next one opens if none now. */
export function nicknameQuota(p: Profile, now = Date.now()) {
  if (!p.nickname) return { left: NICKNAME_WEEKLY, nextAt: null, free: true };
  const recent = (p.nickname_changes ?? []).map((t) => Date.parse(t)).filter((t) => t > now - WEEK_MS).sort();
  const left = NICKNAME_WEEKLY - recent.length;
  const last = recent[recent.length - 1];
  const nextAt =
    left <= 0 ? recent[0] + WEEK_MS : last != null && last + COOLDOWN_MS > now ? last + COOLDOWN_MS : null;
  return { left: Math.max(left, 0), nextAt, free: false };
}

/** "10. 4. 오후 03:12" — also takes Postgres timestamptz text ("2026-10-04 15:12:00+00"). */
export function formatWhen(t: string | number | null | undefined) {
  if (t == null) return "";
  const d = new Date(typeof t === "string" ? t.replace(" ", "T").replace(/([+-]\d\d)$/, "$1:00") : t);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** A save error in words a player can act on. */
export function profileErrorText(e: unknown) {
  const err = e as { message?: string; hint?: string; code?: string };
  const msg = err?.message ?? String(e);
  if (msg.includes("nickname_cooldown")) return `닉네임은 3분에 한 번 바꿀 수 있어요. ${formatWhen(err.hint)} 이후에 다시 해 봐요`;
  if (msg.includes("nickname_weekly_limit"))
    return `닉네임은 일주일에 ${NICKNAME_WEEKLY}번까지 바꿀 수 있어요. ${formatWhen(err.hint)} 이후에 다시 해 봐요`;
  if (err?.code === "23505" || /duplicate|unique/i.test(msg)) return "이미 누가 쓰고 있는 핸들이에요. 다른 이름으로 해 봐요";
  if (err?.code === "23514" && /handle/.test(msg)) return "핸들은 영소문자·숫자·_ 3–20자예요";
  return msg;
}

/** Remove the signed-in account; profile and items go with it. */
export async function deleteMyAccount() {
  const { error } = await supabase.rpc("delete_my_account");
  if (error) throw error;
}

// Shape returned by get_public_profile(handle). Absent keys are private or empty.
export type PublicProfile = {
  handle: string;
  nickname?: string;
  title?: string;
  level?: number;
  class_key?: ClassKey;
  job_title?: string;
  body_type?: BodyType;
  hair_style?: HairStyle;
  hide_headwear?: boolean;
  height_cm?: number;
  weight_kg?: number;
  skeletal_muscle_kg?: number;
  body_fat_pct?: number;
  wealth_tier?: number;
  equipment: {
    head: { equipped: boolean; kind?: string; head_cm?: number; hat_size?: string };
    top: { equipped: boolean; top_size?: string };
    bottom: { equipped: boolean; waist_cm?: number; bottom_size?: string };
    shoes: { equipped: boolean; shoe_mm?: number };
  };
};

export async function fetchMyProfile(userId: string) {
  const { data, error } = await supabase.from("profiles").select("*").eq("user_id", userId).single();
  if (error) throw error;
  return data as Profile;
}

export async function updateMyProfile(userId: string, patch: ProfilePatch) {
  const { data, error } = await supabase.from("profiles").update(patch).eq("user_id", userId).select().single();
  if (error) throw error;
  return data as Profile;
}

export async function fetchPublicProfile(handle: string) {
  const { data, error } = await supabase.rpc("get_public_profile", { p_handle: handle });
  if (error) throw error;
  return data as PublicProfile | null;
}

// ---- View models for CharacterSheet ----

const join = (...parts: (string | number | null | undefined)[]) =>
  parts.filter((p) => p != null && p !== "").join(" · ") || null;

export function sheetFromOwn(p: Profile): SheetData {
  return {
    nickname: p.nickname,
    title: p.title,
    level: ageFrom(p.birth_date),
    classKey: p.class_key,
    jobTitle: p.job_title,
    stats: p,
    equipment: {
      head: {
        equipped: p.head_cm != null || !!p.hat_size,
        detail: join(kindLabel(p.gear, "head"), p.head_cm && `${p.head_cm}cm`, p.hat_size),
      },
      top: { equipped: !!p.top_size, detail: join(p.top_size) },
      bottom: { equipped: p.waist_cm != null || !!p.bottom_size, detail: join(p.waist_cm && `${p.waist_cm}cm`, p.bottom_size) },
      shoes: { equipped: p.shoe_mm != null, detail: join(p.shoe_mm && `${p.shoe_mm}mm`) },
    },
    wealthTier: p.wealth_tier,
    hideHeadwear: p.hide_headwear,
    headKind: kindOf(p.gear, "head"),
    morph: morphFromStats(p),
  };
}

export function sheetFromPublic(p: PublicProfile): SheetData {
  const e = p.equipment;
  return {
    nickname: p.nickname ?? p.handle,
    title: p.title,
    level: p.level,
    classKey: p.class_key,
    jobTitle: p.job_title,
    stats: p,
    equipment: {
      head: {
        equipped: e.head.equipped,
        detail: join(kindLabel({ head: e.head.kind }, "head"), e.head.head_cm && `${e.head.head_cm}cm`, e.head.hat_size),
      },
      top: { equipped: e.top.equipped, detail: join(e.top.top_size) },
      bottom: {
        equipped: e.bottom.equipped,
        detail: join(e.bottom.waist_cm && `${e.bottom.waist_cm}cm`, e.bottom.bottom_size),
      },
      shoes: { equipped: e.shoes.equipped, detail: join(e.shoes.shoe_mm && `${e.shoes.shoe_mm}mm`) },
    },
    wealthTier: p.wealth_tier,
    hideHeadwear: !!p.hide_headwear,
    headKind: kindOf({ head: e.head.kind }, "head"),
    // Private body fields are absent from the RPC response → neutral defaults.
    morph: morphFromStats(p),
  };
}
