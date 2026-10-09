import { useCallback, useEffect, useRef, useState } from 'react';
import type { ExchangeResponse } from '@/config/fanframe';
import { supabase } from '@/integrations/supabase/client';
import { useTeam } from '@/features/teams/TeamContext';
import { rememberWordpressSource, wordpressOriginHint } from '@/features/auth/wordpress-session';
import { reportError } from '@/lib/diagnostics';

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
    const origin = wordpressOriginHint();
    if (!code && !origin) {
      setState({ isAuthenticated: Boolean(getStoredToken()), isLoading: false, error: null, balance: 0 });
      return;
    }
    setState(previous => ({ ...previous, isLoading: true, error: null }));
    const acceptSession = (token: string, response: ExchangeResponse) => {
      if (!active) return;
      if (origin && response.wordpress_origin !== origin) throw new Error('session_origin_mismatch');
      rememberWordpressSource(team.slug, response);
      localStorage.setItem(storageKey, token);
      const url = new URL(window.location.href);
      url.searchParams.delete('code');
      window.history.replaceState({}, '', url.toString());
      justExchangedRef.current = true;
      setState({ isAuthenticated: true, isLoading: false, error: null, balance: response.balance ?? 0 });
    };
    const request = code
      ? { action: 'exchange', team_slug: team.slug, wordpress_origin: origin, body: { code } }
      : { action: 'balance', team_slug: team.slug, app_token: getStoredToken() };
    supabase.functions.invoke('fanframe-proxy', { body: request })
      .then(({ data, error }) => {
        if (error) throw error;
        const exchange = data as ExchangeResponse;
        const token = code ? exchange?.app_token : getStoredToken();
        if (!exchange?.ok || !token) throw new Error('Código inválido ou expirado');
        acceptSession(token, exchange);
      })
      .catch(async error => {
        if (!active) return;
        const token = getStoredToken();
        try { if (token) {
          // Reopening the tour can reuse a consumed handoff code; validate the saved session instead.
          const validation = await supabase.functions.invoke('fanframe-proxy', { body: { action: 'balance', team_slug: team.slug, app_token: token } });
          if (!active) return;
          if (!validation.error && validation.data?.ok && typeof validation.data.balance === 'number' && (!origin || validation.data.wordpress_origin === origin)) {
            acceptSession(token, validation.data);
            return;
          }
          if (validation.error && 'context' in validation.error && validation.error.context instanceof Response && validation.error.context.status === 401) {
            localStorage.removeItem(storageKey);
          }
        } } catch (failure) { reportError('wordpress_session_recovery_failed', failure); }
        reportError('wordpress_session_failed', error, { stage: code ? 'exchange' : 'balance' }, true);
        if (active) setState({ isAuthenticated: false, isLoading: false, error: 'Reabra o FanFrame pelo site de origem.', balance: 0 });
      });
    return () => { active = false; };
  }, [team, teamError, teamLoading, storageKey, getStoredToken]);

  return { ...state, logout, updateBalance, getStoredToken, justExchangedRef };
}
