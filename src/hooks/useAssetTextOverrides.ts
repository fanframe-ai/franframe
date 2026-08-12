import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface TextOverrides {
  [id: string]: { name?: string; subtitle?: string; hidden?: boolean };
}

export function useAssetTextOverrides(settingsKey: string, enabled: boolean = true) {
  const [overrides, setOverrides] = useState<TextOverrides>({});

  useEffect(() => {
    if (!enabled) {
      setOverrides({});
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", settingsKey)
        .maybeSingle();
      if (data?.value) {
        try { setOverrides(JSON.parse(data.value)); } catch {}
      }
    })();
  }, [settingsKey, enabled]);

  const getName = (id: string, fallback: string) => overrides[id]?.name ?? fallback;
  const getSubtitle = (id: string, fallback: string) => overrides[id]?.subtitle ?? fallback;
  const isVisible = (id: string) => overrides[id]?.hidden !== true;

  return { getName, getSubtitle, isVisible };
}
