"use client";

import { useCallback, useEffect, useState } from "react";
import { deleteItem, fetchMyItems, insertItem, updateItem, type Item, type ItemInput } from "./items";
import { useSession } from "./useSession";

// The signed-in user's inventory, newest first. null while loading.
export function useMyItems() {
  const userId = useSession()?.user.id;
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    fetchMyItems().then(setItems, (e) => setError(e.message));
  }, [userId]);

  const save = useCallback(async (input: ItemInput, id?: string) => {
    const saved = id ? await updateItem(id, input) : await insertItem(input);
    setItems((list) => (id ? (list ?? []).map((i) => (i.id === id ? saved : i)) : [saved, ...(list ?? [])]));
  }, []);

  const remove = useCallback(async (id: string) => {
    await deleteItem(id);
    setItems((list) => (list ?? []).filter((i) => i.id !== id));
  }, []);

  return { items, error, save, remove };
}
