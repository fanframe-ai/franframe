import { useState, useEffect, useCallback, useRef } from "react";
import { 
  FANFRAME_STORAGE_KEYS,
  type ExchangeResponse 
} from "@/config/fanframe";
import { supabase } from "@/integrations/supabase/client";

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  balance: number;
}

/**
 * Hook de autenticação FanFrame
 * Implementado conforme documentação seção 7.1 e 7.2
 */
export function useFanFrameAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: true,
    error: null,
    balance: 0,
  });
  const justExchangedRef = useRef(false);

  // Obter token do localStorage
  const getStoredToken = useCallback((): string | null => {
    return localStorage.getItem(FANFRAME_STORAGE_KEYS.appToken);
  }, []);

  // Salvar token no localStorage
  const storeToken = useCallback((token: string) => {
    localStorage.setItem(FANFRAME_STORAGE_KEYS.appToken, token);
  }, []);

  // Limpar token do localStorage
  const clearToken = useCallback(() => {
    localStorage.removeItem(FANFRAME_STORAGE_KEYS.appToken);
    localStorage.removeItem(FANFRAME_STORAGE_KEYS.userId);
    localStorage.removeItem(FANFRAME_STORAGE_KEYS.generationId);
  }, []);

  /**
   * 7.1 - Trocar code por app_token
   * POST /handoff/exchange
   * Body: { "code": "XXXX" }
   * Retorno: { ok: true, app_token: "...", user_id: 100, expires_at: "...", balance: 0 }
   */
  const exchangeCodeForToken = useCallback(async (code: string): Promise<boolean> => {
    console.log("[FanFrame][Exchange] ========== INÍCIO EXCHANGE ==========");
    console.log("[FanFrame][Exchange] Timestamp:", new Date().toISOString());
    console.log("[FanFrame][Exchange] Code recebido:", code ? `${code.substring(0, 5)}...` : "VAZIO");
    console.log("[FanFrame][Exchange] Usando proxy edge function");
    
    try {
      setAuthState(prev => ({ ...prev, isLoading: true, error: null }));

      console.log("[FanFrame][Exchange] Iniciando invoke fanframe-proxy...");
      
      const fetchStartTime = performance.now();

      const { data, error: invokeError } = await supabase.functions.invoke("fanframe-proxy", {
        body: { action: "exchange", token: "exchange", body: { code } },
      });

      const fetchEndTime = performance.now();
      console.log("[FanFrame][Exchange] Invoke completado em:", Math.round(fetchEndTime - fetchStartTime), "ms");

      if (invokeError) {
        throw new Error(invokeError.message || "Erro na comunicação com o servidor");
      }

      console.log("[FanFrame][Exchange] Response:", JSON.stringify(data));

      const exchangeData = data as ExchangeResponse;

      // Verificar se a resposta foi ok: true
      if (!exchangeData.ok || !exchangeData.app_token) {
        console.error("[FanFrame][Exchange] ❌ Exchange falhou:", exchangeData.error);
        throw new Error(exchangeData.error || "Código inválido ou expirado");
      }

      // Alias for rest of function
      const responseData = exchangeData;

      // Salvar token conforme documentação: localStorage com chave "vf_app_token"
      console.log("[FanFrame][Exchange] Token recebido:", responseData.app_token!.substring(0, 10) + "...");
      storeToken(responseData.app_token!);
      console.log("[FanFrame][Exchange] ✅ Token salvo no localStorage");

      // Salvar user_id separadamente
      if (responseData.user_id) {
        localStorage.setItem(FANFRAME_STORAGE_KEYS.userId, responseData.user_id.toString());
        console.log("[FanFrame][Exchange] ✅ User ID salvo:", responseData.user_id);
      }

      // Remover code da URL
      const url = new URL(window.location.href);
      url.searchParams.delete("code");
      window.history.replaceState({}, "", url.toString());
      console.log("[FanFrame][Exchange] URL limpa (code removido)");

      // Usar balance do exchange (é o valor correto no momento do login)
      justExchangedRef.current = true;
      setAuthState({
        isAuthenticated: true,
        isLoading: false,
        error: null,
        balance: responseData.balance ?? 0,
      });

      console.log("[FanFrame][Exchange] ✅ SUCESSO! Autenticação concluída!");
      console.log("[FanFrame][Exchange] User ID:", responseData.user_id);
      console.log("[FanFrame][Exchange] Saldo:", responseData.balance);
      console.log("[FanFrame][Exchange] Expira em:", responseData.expires_at);
      console.log("[FanFrame][Exchange] ========== FIM EXCHANGE (SUCESSO) ==========");
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao autenticar";
      console.error("[FanFrame][Exchange] ❌ ERRO (catch):", message);
      console.error("[FanFrame][Exchange] Tipo do erro:", typeof error);
      console.error("[FanFrame][Exchange] Stack:", error instanceof Error ? error.stack : "N/A");
      console.log("[FanFrame][Exchange] ========== FIM EXCHANGE (ERRO) ==========");
      
      setAuthState({
        isAuthenticated: false,
        isLoading: false,
        error: message,
        balance: 0,
      });
      return false;
    }
  }, [storeToken]);

  /**
   * Logout - limpar token
   */
  const logout = useCallback(() => {
    clearToken();
    setAuthState({
      isAuthenticated: false,
      isLoading: false,
      error: null,
      balance: 0,
    });
  }, [clearToken]);

  /**
   * Atualizar saldo na UI
   */
  const updateBalance = useCallback((newBalance: number) => {
    setAuthState(prev => ({ ...prev, balance: newBalance }));
  }, []);

  /**
   * Inicialização conforme documentação seção 7.1 e 7.2
   */
  useEffect(() => {
    const init = async () => {
      console.log("[FanFrame][Init] ========== INÍCIO INICIALIZAÇÃO ==========");
      console.log("[FanFrame][Init] Timestamp:", new Date().toISOString());
      console.log("[FanFrame][Init] URL completa:", window.location.href);
      console.log("[FanFrame][Init] Origin:", window.location.origin);
      console.log("[FanFrame][Init] Pathname:", window.location.pathname);
      console.log("[FanFrame][Init] Search:", window.location.search);
      
      // 7.1 - Ler parâmetro "code" da URL
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get("code");
      console.log("[FanFrame][Init] Parâmetro 'code' na URL:", code ? `${code.substring(0, 5)}...` : "NÃO ENCONTRADO");

      if (code) {
        // Se existir code: chamar Exchange
        console.log("[FanFrame][Init] Code encontrado! Iniciando exchange...");
        await exchangeCodeForToken(code);
        console.log("[FanFrame][Init] ========== FIM INICIALIZAÇÃO (VIA EXCHANGE) ==========");
        return;
      }

      // 7.2 - Se não existir code, buscar token salvo
      const storedToken = getStoredToken();
      console.log("[FanFrame][Init] Token no localStorage:", storedToken ? "EXISTE" : "NÃO EXISTE");
      console.log("[FanFrame][Init] Token (primeiros 10 chars):", storedToken ? storedToken.substring(0, 10) + "..." : "N/A");

      if (storedToken) {
        // Token existe - marcar como autenticado
        console.log("[FanFrame][Init] ✅ Token encontrado, marcando como autenticado");
        // O saldo será buscado pelo hook useFanFrameCredits
        setAuthState({
          isAuthenticated: true,
          isLoading: false,
          error: null,
          balance: 0,
        });
        console.log("[FanFrame][Init] ========== FIM INICIALIZAÇÃO (TOKEN EXISTENTE) ==========");
      } else {
        // Sem code e sem token - não autenticado
        console.log("[FanFrame][Init] ⚠️ Sem code e sem token - usuário não autenticado");
        setAuthState({
          isAuthenticated: false,
          isLoading: false,
          error: null,
          balance: 0,
        });
        console.log("[FanFrame][Init] ========== FIM INICIALIZAÇÃO (NÃO AUTENTICADO) ==========");
      }
    };

    init();
  }, [exchangeCodeForToken, getStoredToken]);

  return {
    ...authState,
    logout,
    updateBalance,
    getStoredToken,
    justExchangedRef,
  };
}
