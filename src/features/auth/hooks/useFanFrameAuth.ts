import { useCallback, useEffect, useRef, useState } from 'react';
import type { ExchangeResponse } from '@/config/fanframe';
import { supabase } from '@/integrations/supabase/client';
import { useTeam } from '@/features/teams/TeamContext';

type AuthState = { isAuthenticated: boolean; isLoading: boolean; error: string | null; balance: number };
const initial: AuthState = { isAuthenticated: false, isLoading: true, error: null, balance: 0 };

export function useFanFrameAuth() {
  const [state, setState] = useState<AuthState>(initial);
  const { team, isLoading: teamLoading, error: teamError } = useTeam();
  const justExchangedRef = useRef(false);
  const storageKey = team ? `vf_app_token:${team.slug}` : null;
  const getStoredToken = useCallback(() => storageKey ? localStorage.getItem(storageKey) : null, [storageKey]);
  const logout = useCallback(() => {
    if (storageKey) localStorage.removeItem(storageKey);
    setState({ ...initial, isLoading: false });
  }, [storageKey]);
  const updateBalance = useCallback((balance: number) => setState(previous => ({ ...previous, balance })), []);

  useEffect(() => {
    if (teamLoading) return;
    if (teamError || !team || !storageKey) { setState({ ...initial, isLoading: false }); return; }
    let active = true;
    const code = new URLSearchParams(window.location.search).get('code');
    if (!code) {
      setState({ isAuthenticated: Boolean(getStoredToken()), isLoading: false, error: null, balance: 0 });
      return;
    }
    setState(previous => ({ ...previous, isLoading: true, error: null }));
    supabase.functions.invoke('fanframe-proxy', { body: { action: 'exchange', team_slug: team.slug, body: { code } } })
      .then(({ data, error }) => {
        if (error) throw error;
        const exchange = data as ExchangeResponse;
        if (!exchange?.ok || !exchange.app_token) throw new Error(exchange?.error || 'Código inválido ou expirado');
        if (!active) return;
        localStorage.setItem(storageKey, exchange.app_token);
        const url = new URL(window.location.href);
        url.searchParams.delete('code');
        window.history.replaceState({}, '', url.toString());
        justExchangedRef.current = true;
        setState({ isAuthenticated: true, isLoading: false, error: null, balance: exchange.balance ?? 0 });
      })
      .catch(error => {
        if (active) setState({ isAuthenticated: false, isLoading: false, error: error instanceof Error ? error.message : 'Erro ao autenticar', balance: 0 });
      });
    return () => { active = false; };
  }, [team, teamError, teamLoading, storageKey, getStoredToken]);

  return { ...state, logout, updateBalance, getStoredToken, justExchangedRef };
}
