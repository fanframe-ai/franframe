import { useState, useCallback } from "react";
import { 
  FANFRAME_ENDPOINTS, 
  FANFRAME_STORAGE_KEYS, 
  FANFRAME_ERROR_CODES,
  type BalanceResponse,
  type DebitResponse
} from "@/config/fanframe";

interface CreditsState {
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook para gerenciar créditos FanFrame
 * Sempre consulta a API diretamente, sem cache.
 */
export function useFanFrameCredits(onTokenExpired?: () => void) {
  const [state, setState] = useState<CreditsState>({
    isLoading: false,
    error: null,
  });

  const getAuthHeaders = useCallback((): HeadersInit => {
    const token = localStorage.getItem(FANFRAME_STORAGE_KEYS.appToken);
    return {
      "Content-Type": "application/json",
      "X-Fanframe-Token": token || "",
    };
  }, []);

  const handleAuthError = useCallback((status: number) => {
    if (status === 401) {
      console.log("[FanFrame] Token inválido/expirado (401), limpando...");
      localStorage.removeItem(FANFRAME_STORAGE_KEYS.appToken);
      localStorage.removeItem(FANFRAME_STORAGE_KEYS.generationId);
      if (onTokenExpired) {
        onTokenExpired();
      }
    }
  }, [onTokenExpired]);

  /**
   * Consultar saldo - sempre direto da API, sem cache
   */
  const fetchBalance = useCallback(async (): Promise<number | null> => {
    console.log("[FanFrame][Balance] Consultando saldo...");
    
    try {
      const storedToken = localStorage.getItem(FANFRAME_STORAGE_KEYS.appToken);
      if (!storedToken) {
        console.error("[FanFrame][Balance] Token não encontrado");
        return null;
      }

      setState({ isLoading: true, error: null });

      const response = await fetch(FANFRAME_ENDPOINTS.balance, {
        method: "GET",
        headers: getAuthHeaders(),
        cache: "no-store",
      });

      if (response.status === 401) {
        handleAuthError(401);
        setState({ isLoading: false, error: "Sessão expirada. Reabra pelo tour." });
        return null;
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[FanFrame][Balance] Erro HTTP:", response.status, errorText);
        setState({ isLoading: false, error: `Erro ${response.status}` });
        return null;
      }

      const data: BalanceResponse = await response.json();

      if (!data.ok) {
        throw new Error("Erro ao consultar saldo");
      }

      const balance = data.balance ?? 0;
      console.log("[FanFrame][Balance] Saldo atual:", balance);
      setState({ isLoading: false, error: null });
      return balance;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao consultar saldo";
      console.error("[FanFrame][Balance] Erro:", message);
      setState({ isLoading: false, error: message });
      return null;
    }
  }, [getAuthHeaders, handleAuthError]);

  /**
   * Debitar 1 crédito
   */
  const debitCredit = useCallback(async (generationId: string): Promise<{
    success: boolean;
    balanceAfter?: number;
    errorCode?: string;
  }> => {
    console.log("[FanFrame][Debit] Debitando crédito, generation:", generationId);
    
    try {
      setState({ isLoading: true, error: null });

      const response = await fetch(FANFRAME_ENDPOINTS.debit, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ generation_id: generationId }),
        cache: "no-store",
      });

      if (response.status === 401) {
        handleAuthError(401);
        setState({ isLoading: false, error: "Sessão expirada" });
        return { success: false, errorCode: "session_expired" };
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[FanFrame][Debit] Erro HTTP:", response.status, errorText);
        setState({ isLoading: false, error: `Erro ${response.status}` });
        return { success: false, errorCode: `http_${response.status}` };
      }

      const data: DebitResponse = await response.json();

      if (data.ok === false && data.reason === FANFRAME_ERROR_CODES.noCredits) {
        setState({ isLoading: false, error: null });
        return { success: false, errorCode: FANFRAME_ERROR_CODES.noCredits };
      }

      if (data.ok === false) {
        setState({ isLoading: false, error: data.reason || "Débito negado" });
        return { success: false, errorCode: data.reason || "unknown" };
      }

      if (data.ok === true) {
        console.log("[FanFrame][Debit] Sucesso! Saldo após:", data.balance_after);
        setState({ isLoading: false, error: null });
        return { success: true, balanceAfter: data.balance_after };
      }

      setState({ isLoading: false, error: "Resposta inesperada" });
      return { success: false, errorCode: "invalid_response" };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao debitar crédito";
      console.error("[FanFrame][Debit] Erro:", message);
      setState({ isLoading: false, error: message });
      return { success: false, errorCode: "network_error" };
    }
  }, [getAuthHeaders, handleAuthError]);

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
