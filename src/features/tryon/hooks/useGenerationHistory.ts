import { useState, useEffect, useCallback } from 'react';
import { useTeam } from '@/features/teams/TeamContext';
import { generationHistory } from '@/integrations/supabase/functions';
export interface HistoryEntry { id: string; result_image_url: string; shirt_id: string; created_at: string }
export function useGenerationHistory() {
  const { team } = useTeam();
  const teamSlug = team?.slug;
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [isLoading, setLoading] = useState(false);
  const refresh = useCallback(async () => {
    if (!teamSlug) return;
    setLoading(true);
    try { const result = await generationHistory(teamSlug); setEntries(result.entries.filter((entry): entry is typeof entry & { result_image_url: string } => !!entry.result_image_url)); }
    catch { setEntries([]); }
    finally { setLoading(false); }
  }, [teamSlug]);
  useEffect(() => { void refresh(); }, [refresh]);
  return { entries, isLoading, refresh };
}
