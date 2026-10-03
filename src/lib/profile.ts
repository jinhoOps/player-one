import { supabase } from "./supabase";
import type { SheetData } from "@/components/CharacterSheet";
import { ageFrom, type BodyType, type ClassKey, type HairStyle, type Visibility } from "./game";
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
};

export type ProfilePatch = Partial<Omit<Profile, "user_id">>;

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
  height_cm?: number;
  weight_kg?: number;
  skeletal_muscle_kg?: number;
  body_fat_pct?: number;
  wealth_tier?: number;
  equipment: {
    head: { equipped: boolean; head_cm?: number; hat_size?: string };
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
      head: { equipped: p.head_cm != null || !!p.hat_size, detail: join(p.head_cm && `${p.head_cm}cm`, p.hat_size) },
      top: { equipped: !!p.top_size, detail: join(p.top_size) },
      bottom: { equipped: p.waist_cm != null || !!p.bottom_size, detail: join(p.waist_cm && `${p.waist_cm}cm`, p.bottom_size) },
      shoes: { equipped: p.shoe_mm != null, detail: join(p.shoe_mm && `${p.shoe_mm}mm`) },
    },
    wealthTier: p.wealth_tier,
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
      head: { equipped: e.head.equipped, detail: join(e.head.head_cm && `${e.head.head_cm}cm`, e.head.hat_size) },
      top: { equipped: e.top.equipped, detail: join(e.top.top_size) },
      bottom: {
        equipped: e.bottom.equipped,
        detail: join(e.bottom.waist_cm && `${e.bottom.waist_cm}cm`, e.bottom.bottom_size),
      },
      shoes: { equipped: e.shoes.equipped, detail: join(e.shoes.shoe_mm && `${e.shoes.shoe_mm}mm`) },
    },
    wealthTier: p.wealth_tier,
    // Private body fields are absent from the RPC response → neutral defaults.
    morph: morphFromStats(p),
  };
}
