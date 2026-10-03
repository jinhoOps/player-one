"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { ClassKey, EquipSlotKey } from "./game";
import type { BodyMorph } from "./morph";
import { morphFromStats } from "./morph";
import type { PublicProfile } from "./profile";
import { supabase } from "./supabase";

// The village (docs/DESIGN.md §9): one private Realtime channel. Presence says
// who is here and where they stand; broadcast carries speech bubbles. Nothing
// is stored, and a villager carries only public profile fields.

export type Villager = {
  /** Presence key: one per open tab. */
  key: string;
  handle: string;
  nickname: string;
  classKey: ClassKey | null;
  morph: BodyMorph;
  equipped: Record<EquipSlotKey, boolean>;
  /** Where they stand, as fractions of the book's footprint (x, z). */
  at: [number, number];
};
export type Look = Omit<Villager, "key" | "at">;
export type Bubble = { text: string; id: number };

export const SAY_MAX = 60;
const SAY_MS = 6000;

/** A villager's look from what get_public_profile returned: public fields only. */
export function lookFromPublic(p: PublicProfile): Look {
  const e = p.equipment;
  return {
    handle: p.handle,
    nickname: p.nickname ?? p.handle,
    classKey: p.class_key ?? null,
    morph: morphFromStats(p),
    equipped: { head: e.head.equipped, top: e.top.equipped, bottom: e.bottom.equipped, shoes: e.shoes.equipped },
  };
}

/** The last leave in flight; a join waits for it (see useVillage). */
let leaving: Promise<unknown> = Promise.resolve();

/** Somewhere along the village's main lane, so newcomers land near each other. */
const spawn = (): [number, number] => [0.4 + Math.random() * 0.2, 0.55 + Math.random() * 0.15];

export function useVillage(look: Look | null) {
  const key = useMemo(() => crypto.randomUUID(), []);
  const [others, setOthers] = useState<Villager[]>([]);
  const [at, setAt] = useState<[number, number]>(spawn);
  const [bubbles, setBubbles] = useState<Record<string, Bubble>>({});
  const [status, setStatus] = useState<"joining" | "here" | "error">("joining");
  const channel = useRef<RealtimeChannel | null>(null);
  const me = useRef<{ look: Look | null; at: [number, number] }>({ look, at });

  useEffect(() => {
    me.current = { look, at };
  }, [look, at]);

  const pop = useCallback((who: string, text: string) => {
    const id = Date.now() + Math.random();
    setBubbles((b) => ({ ...b, [who]: { text, id } }));
    setTimeout(() => setBubbles((b) => (b[who]?.id === id ? Object.fromEntries(Object.entries(b).filter(([k]) => k !== who)) : b)), SAY_MS);
  }, []);

  const handle = look?.handle;
  useEffect(() => {
    if (!handle) return;
    let gone = false;
    let ch: RealtimeChannel | null = null;
    // The client hands back a channel it still holds for the same topic, so a
    // rejoin waits until the last leave is done. A private channel checks the
    // player's token against the RLS policies.
    leaving
      .then(() => supabase.realtime.setAuth())
      .then(() => {
        if (gone) return;
        const c = supabase.channel("village", { config: { private: true, presence: { key } } });
        ch = channel.current = c;
        c.on("presence", { event: "sync" }, () => {
          const state = c.presenceState<Omit<Villager, "key">>();
          // One figure per player: a second tab of someone else shows once.
          const byHandle = new Map<string, Villager>();
          for (const [k, metas] of Object.entries(state)) {
            const m = metas[metas.length - 1];
            if (k !== key && m?.handle) byHandle.set(m.handle, { ...m, key: k });
          }
          setOthers([...byHandle.values()]);
        })
          .on("broadcast", { event: "say" }, ({ payload }) => {
            if (typeof payload?.key === "string" && typeof payload?.text === "string") pop(payload.key, payload.text.slice(0, SAY_MAX));
          })
          .subscribe((s) => {
            if (gone) return;
            if (s === "SUBSCRIBED") {
              setStatus("here");
              const { look: l, at: a } = me.current;
              if (l) c.track({ ...l, at: a });
            } else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT") setStatus("error");
          });
      });
    return () => {
      gone = true;
      channel.current = null;
      if (ch) leaving = supabase.removeChannel(ch);
    };
  }, [handle, key, pop]);

  // A changed look (the profile was edited) shows up for everyone.
  useEffect(() => {
    if (status === "here" && look) channel.current?.track({ ...look, at: me.current.at });
  }, [look, status]);

  const moveTo = useCallback((to: [number, number]) => {
    setAt(to);
    const l = me.current.look;
    if (l) channel.current?.track({ ...l, at: to });
  }, []);

  const say = useCallback(
    (raw: string) => {
      const text = raw.trim().slice(0, SAY_MAX);
      if (!text) return;
      pop(key, text);
      channel.current?.send({ type: "broadcast", event: "say", payload: { key, text } });
    },
    [key, pop],
  );

  const self: Villager | null = look ? { ...look, key, at } : null;
  return { self, others, bubbles, status, moveTo, say };
}
