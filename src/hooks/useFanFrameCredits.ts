import { useState, useCallback } from "react";
import { 
  FANFRAME_STORAGE_KEYS, 
  FANFRAME_ERROR_CODES,
  type BalanceResponse,
  type DebitResponse
} from "@/config/fanframe";
import { supabase } from "@/integrations/supabase/client";

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

  const handleAuthError = useCallback(() => {
    console.log("[FanFrame] Token inválido/expirado (401), limpando...");
    localStorage.removeItem(FANFRAME_STORAGE_KEYS.appToken);
    localStorage.removeItem(FANFRAME_STORAGE_KEYS.generationId);
    if (onTokenExpired) {
      onTokenExpired();
    }
  }, [onTokenExpired]);

  /**
   * Consultar saldo via proxy
   */
  const fetchBalance = useCallback(async (): Promise<number | null> => {
    console.log("[FanFrame][Balance] Consultando saldo via proxy...");
    
    try {
      const storedToken = localStorage.getItem(FANFRAME_STORAGE_KEYS.appToken);
      if (!storedToken) {
        console.error("[FanFrame][Balance] Token não encontrado");
        return null;
      }

      setState({ isLoading: true, error: null });

      const { data, error } = await supabase.functions.invoke("fanframe-proxy", {
        body: { action: "balance", token: storedToken },
      });

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
  }, [handleAuthError]);

  /**
   * Debitar 1 crédito via proxy
   */
  const debitCredit = useCallback(async (generationId: string): Promise<{
    success: boolean;
    balanceAfter?: number;
    errorCode?: string;
  }> => {
    console.log("[FanFrame][Debit] Debitando crédito via proxy, generation:", generationId);
    
    try {
      setState({ isLoading: true, error: null });

      const storedToken = localStorage.getItem(FANFRAME_STORAGE_KEYS.appToken);
      if (!storedToken) {
        handleAuthError();
        return { success: false, errorCode: "no_token" };
      }

      const { data, error } = await supabase.functions.invoke("fanframe-proxy", {
        body: {
          action: "debit",
          token: storedToken,
          body: { generation_id: generationId },
        },
      });

      if (error) {
        console.error("[FanFrame][Debit] Erro invoke:", error);
        setState({ isLoading: false, error: "Erro ao debitar crédito" });
        return { success: false, errorCode: "invoke_error" };
      }

      // Check for 401 from proxy
      if (data?.status === 401) {
        handleAuthError();
        setState({ isLoading: false, error: "Sessão expirada" });
        return { success: false, errorCode: "session_expired" };
      }

      const response = data as DebitResponse;

      if (response.ok === false && response.reason === FANFRAME_ERROR_CODES.noCredits) {
        setState({ isLoading: false, error: null });
        return { success: false, errorCode: FANFRAME_ERROR_CODES.noCredits };
      }

      if (response.ok === false) {
        setState({ isLoading: false, error: response.reason || "Débito negado" });
        return { success: false, errorCode: response.reason || "unknown" };
      }

      if (response.ok === true) {
        console.log("[FanFrame][Debit] Sucesso! Saldo após:", response.balance_after);
        setState({ isLoading: false, error: null });
        return { success: true, balanceAfter: response.balance_after };
      }

      setState({ isLoading: false, error: "Resposta inesperada" });
      return { success: false, errorCode: "invalid_response" };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao debitar crédito";
      console.error("[FanFrame][Debit] Erro:", message);
      setState({ isLoading: false, error: message });
      return { success: false, errorCode: "network_error" };
    }
  }, [handleAuthError]);

  const generateGenerationId = useCallback((): string => {
    const stored = localStorage.getItem(FANFRAME_STORAGE_KEYS.generationId);
    if (stored) return stored;

    const newId = crypto.randomUUID();
    localStorage.setItem(FANFRAME_STORAGE_KEYS.generationId, newId);
    return newId;
  }, []);

  const clearGenerationId = useCallback(() => {
    localStorage.removeItem(FANFRAME_STORAGE_KEYS.generationId);
  }, []);

  return {
    ...state,
    fetchBalance,
    debitCredit,
    generateGenerationId,
    clearGenerationId,
  };
}
