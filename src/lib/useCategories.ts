"use client";

import { useCallback, useEffect, useState } from "react";
import { CATEGORIES, categoryMeta, colorForCategory } from "@/lib/finance";

export interface CategoryItem {
  name: string;
  icon: string;
}

/**
 * Daftar kategori dari Neon (`/api/categories`), fallback ke daftar
 * statis bila offline. Custom + baris yang ditambah langsung di DB
 * otomatis muncul.
 */
export function useCategories() {
  const [list, setList] = useState<CategoryItem[]>(() =>
    CATEGORIES.map(({ name, icon }) => ({ name, icon })),
  );

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/categories", { cache: "no-store" });
      if (!r.ok) return;
      const j = (await r.json()) as { categories?: CategoryItem[] };
      if (Array.isArray(j.categories) && j.categories.length > 0)
        setList(j.categories);
    } catch {
      // offline: pakai daftar statis
    }
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect -- muat referensi eksternal sekali saat mount */
  useEffect(() => {
    void refresh();
  }, [refresh]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const addCategory = useCallback(
    async (name: string, icon: string): Promise<boolean> => {
      try {
        const r = await fetch("/api/categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, icon }),
        });
        if (!r.ok) return false;
        await refresh();
        return true;
      } catch {
        return false;
      }
    },
    [refresh],
  );

  const iconOf = useCallback(
    (name: string) =>
      list.find((c) => c.name === name)?.icon ?? categoryMeta(name).icon,
    [list],
  );
  return { list, iconOf, colorOf: colorForCategory, refresh, addCategory };
}

export type Categories = ReturnType<typeof useCategories>;
