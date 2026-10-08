import { useState, useCallback } from "react";
import type { BalanceResponse } from "@/config/fanframe";
import { supabase } from "@/integrations/supabase/client";
import { useTeam } from "@/features/teams/TeamContext";

interface CreditsState {
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook para gerenciar créditos FanFrame
 * Usa edge function proxy para evitar CORS
 */
export function useFanFrameCredits(onTokenExpired?: () => void) {
  const [state, setState] = useState<CreditsState>({
    isLoading: false,
    error: null,
  });
  const { team } = useTeam();

  const handleAuthError = useCallback(() => {
    console.log("[FanFrame] Token inválido/expirado (401), limpando...");
    localStorage.removeItem(`vf_app_token:${team?.slug}`);
    if (onTokenExpired) {
      onTokenExpired();
    }
  }, [onTokenExpired, team?.slug]);

  /**
   * Consultar saldo via proxy
   */
  const fetchBalance = useCallback(async (): Promise<number | null> => {
    console.log("[FanFrame][Balance] Consultando saldo via proxy...");

    try {
      const storedToken = localStorage.getItem(`vf_app_token:${team?.slug}`);
      if (!storedToken) {
        console.error("[FanFrame][Balance] Token não encontrado");
        return null;
      }

      setState({ isLoading: true, error: null });

      const { data, error } = await supabase.functions.invoke("fanframe-proxy", {
        body: { action: "balance", token: storedToken, team_slug: team?.slug },
      });

      if (error && 'context' in error && error.context instanceof Response && error.context.status === 401) {
        handleAuthError();
        setState({ isLoading: false, error: "Sessão expirada. Reabra pelo tour." });
        return null;
      }
      if (error) {
        console.error("[FanFrame][Balance] Erro invoke:", error);
        setState({ isLoading: false, error: "Erro ao consultar saldo" });
        return null;
      }

      if (data?.status === 401 || data?.error === "Token inválido") {
        handleAuthError();
        setState({ isLoading: false, error: "Sessão expirada. Reabra pelo tour." });
        return null;
      }

      const response = data as BalanceResponse;

      if (!response.ok) {
        throw new Error("Erro ao consultar saldo");
      }

      const balance = response.balance ?? 0;
      console.log("[FanFrame][Balance] Saldo atual:", balance);
      setState({ isLoading: false, error: null });
      return balance;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao consultar saldo";
      console.error("[FanFrame][Balance] Erro:", message);
      setState({ isLoading: false, error: message });
      return null;
    }
  }, [handleAuthError, team?.slug]);

  return {
    ...state,
    fetchBalance,
  };
}
