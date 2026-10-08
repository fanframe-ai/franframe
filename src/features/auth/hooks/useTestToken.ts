import { useState, useEffect, useCallback } from 'react';
import { useTeam } from '@/features/teams/TeamContext';
import { credentials, invoke } from '@/integrations/supabase/functions';
export function useTestToken() {
  const { team } = useTeam();
  const teamSlug = team?.slug;
  const [balance, setBalance] = useState(0);
  const [isTestMode, setMode] = useState(false);
  const [isLoading, setLoading] = useState(true);
  const refreshTestBalance = useCallback(async () => {
    if (!teamSlug) return;
    const token = new URLSearchParams(location.search).get('test_token');
    if (!token) { setMode(false); setLoading(false); return; }
    try {
      const value = await invoke<{ balance: number }>('fanframe-proxy', { ...credentials(teamSlug), action: 'test' });
      setBalance(value.balance); setMode(true);
    } catch { setBalance(0); setMode(false); }
    finally { setLoading(false); }
  }, [teamSlug]);
  useEffect(() => { void refreshTestBalance(); }, [refreshTestBalance]);
  return { isTestMode, testBalance: balance, isLoading, refreshTestBalance };
}
