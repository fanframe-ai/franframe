import { useState, useEffect, useCallback } from 'react';
import { useTeam } from '@/features/teams/TeamContext';
import { generationHistory } from '@/integrations/supabase/functions';
import { toast } from '@/components/ui/use-toast';
export interface HistoryEntry { id: string; result_image_url: string; shirt_id: string; created_at: string }
export function useGenerationHistory() {
  const { team } = useTeam();
  const teamSlug = team?.slug;
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [isLoading, setLoading] = useState(false);
  const [page, setPage] = useState(0); const [hasMore, setHasMore] = useState(false);
  const refresh = useCallback(async () => {
    if (!teamSlug) return;
    setLoading(true);
    try { const result = await generationHistory(teamSlug); setEntries(result.entries.filter((entry): entry is typeof entry & { result_image_url: string } => !!entry.result_image_url)); setPage(0); setHasMore(!!result.has_more); }
    catch { setEntries([]); }
    finally { setLoading(false); }
  }, [teamSlug]);
  useEffect(() => { void refresh(); }, [refresh]);
  const loadMore = async () => {
    if (!teamSlug || isLoading || !hasMore) return;
    setLoading(true);
    try { const result = await generationHistory(teamSlug, page + 1); setEntries(previous => [...previous, ...result.entries.filter((entry): entry is typeof entry & { result_image_url: string } => !!entry.result_image_url)].filter((entry, index, all) => all.findIndex(item => item.id === entry.id) === index)); setPage(value => value + 1); setHasMore(!!result.has_more); }
    catch { toast({ title: 'Nao foi possivel carregar as fotos', description: 'Tente novamente.', variant: 'destructive' }); }
    finally { setLoading(false); }
  };
  return { entries, isLoading, refresh, hasMore, loadMore };
}
