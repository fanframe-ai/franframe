# Integração WordPress/FanFrame - Documentação Técnica

## Visão Geral

Esta aplicação React se integra com um sistema WordPress através da API REST FanFrame. O WordPress atua como o sistema central de autenticação e gerenciamento de créditos, enquanto esta aplicação React é o "app embarcado" que consome esses serviços.

## Arquitetura da Integração

```
┌─────────────────────────────────────────────────────────────────┐
│                        WordPress (FanFrame)                      │
│  - Gerencia usuários e autenticação                             │
│  - Controla saldo de créditos                                   │
│  - Processa compras de pacotes                                  │
│  - Expõe API REST em /wp-json/vf-fanframe/v1/                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ API REST (HTTPS)
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     React App (Este Projeto)                     │
│  - Recebe "code" via URL do WordPress                           │
│  - Troca code por app_token (Exchange)                          │
│  - Consulta saldo de créditos                                   │
│  - Debita créditos antes de gerar imagem                        │
│  - Armazena token no localStorage                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Configuração Central

**Arquivo:** `src/config/fanframe.ts`

### Flag de Controle

```typescript
// Ativa/desativa toda a integração FanFrame
export const FANFRAME_ENABLED = true;
```

Quando `false`:
- App funciona sem autenticação
- Créditos não são verificados
- Tela de compra de créditos é pulada

### Base URL da API

```typescript
export const FANFRAME_API_BASE = "https://tricolorvirtualexperience.net/wp-json/vf-fanframe/v1";
```

### Endpoints Disponíveis

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/handoff/exchange` | POST | Troca `code` por `app_token` |
| `/credits/balance` | GET | Consulta saldo atual |
| `/credits/debit` | POST | Debita 1 crédito |

```typescript
export const FANFRAME_ENDPOINTS = {
  exchange: `${FANFRAME_API_BASE}/handoff/exchange`,
  balance: `${FANFRAME_API_BASE}/credits/balance`,
  debit: `${FANFRAME_API_BASE}/credits/debit`,
} as const;
```

### URLs de Compra de Créditos

Abrem em nova aba direcionando para o checkout do WordPress:

```typescript
export const FANFRAME_PURCHASE_URLS = {
  credits1: "https://tricolorvirtualexperience.net/buy-credits?pack=1",
  credits3: "https://tricolorvirtualexperience.net/buy-credits?pack=3", // Recomendado
  credits7: "https://tricolorvirtualexperience.net/buy-credits?pack=7",
} as const;
```

### Chaves do LocalStorage

```typescript
export const FANFRAME_STORAGE_KEYS = {
  appToken: "vf_app_token",      // Token de autenticação
  generationId: "vf_generation_id", // UUID para idempotência
} as const;
```

---

## Fluxo de Autenticação

**Arquivo:** `src/hooks/useFanFrameAuth.ts`

### Diagrama de Fluxo

```
┌──────────────────────────────────────────────────────────────────┐
│                    FLUXO DE AUTENTICAÇÃO                         │
└──────────────────────────────────────────────────────────────────┘

1. Usuário acessa app via WordPress
   │
   ▼
2. WordPress redireciona com ?code=XXXX na URL
   │
   ▼
3. App detecta "code" na URL
   │
   ▼
4. POST /handoff/exchange { "code": "XXXX" }
   │
   ├─── Sucesso: { ok: true, app_token: "...", balance: 5 }
   │    │
   │    ▼
   │    Salva token em localStorage["vf_app_token"]
   │    Remove "code" da URL
   │    Usuário autenticado ✓
   │
   └─── Erro: { ok: false, error: "código inválido" }
        │
        ▼
        Mostra tela de acesso negado

───────────────────────────────────────────────────────────────────

ACESSO SUBSEQUENTE (sem code na URL):

1. App verifica localStorage["vf_app_token"]
   │
   ├─── Token existe: usuário autenticado ✓
   │
   └─── Token não existe: mostra tela de acesso negado
```

### Implementação do Hook

```typescript
export function useFanFrameAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: true,
    error: null,
    balance: 0,
  });

  // Retorna:
  return {
    isAuthenticated,  // boolean - usuário está logado?
    isLoading,        // boolean - processando autenticação?
    error,            // string | null - mensagem de erro
    balance,          // number - saldo atual
    logout,           // () => void - limpa token
    updateBalance,    // (n: number) => void - atualiza saldo na UI
    getStoredToken,   // () => string | null - retorna token
  };
}
```

### Processo de Exchange

```typescript
const exchangeCodeForToken = async (code: string): Promise<boolean> => {
  const response = await fetch(FANFRAME_ENDPOINTS.exchange, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });

  const data: ExchangeResponse = await response.json();
  
  if (data.ok && data.app_token) {
    localStorage.setItem("vf_app_token", data.app_token);
    // Remove code da URL para evitar reuso
    const url = new URL(window.location.href);
    url.searchParams.delete("code");
    window.history.replaceState({}, "", url.toString());
    return true;
  }
  return false;
};
```

---

## Sistema de Créditos

**Arquivo:** `src/hooks/useFanFrameCredits.ts`

### Headers de Autenticação

**IMPORTANTE:** Usa header customizado, NÃO usa Bearer token padrão:

```typescript
const getAuthHeaders = (): HeadersInit => {
  const token = localStorage.getItem("vf_app_token");
  return {
    "Content-Type": "application/json",
    "X-Fanframe-Token": token || "",  // Header customizado!
  };
};
```

### Consultar Saldo

```typescript
// GET /credits/balance
// Header: X-Fanframe-Token: <app_token>

const fetchBalance = async (): Promise<number | null> => {
  const response = await fetch(FANFRAME_ENDPOINTS.balance, {
    method: "GET",
    headers: getAuthHeaders(),
  });

  // Resposta esperada:
  // { ok: true, balance: 7 }
  
  // Se 401: token expirado, fazer logout
  if (response.status === 401) {
    handleAuthError(401);
    return null;
  }

  const data: BalanceResponse = await response.json();
  return data.balance ?? 0;
};
```

### Debitar Crédito

```typescript
// POST /credits/debit
// Header: X-Fanframe-Token: <app_token>
// Body: { "generation_id": "UUID" }

const debitCredit = async (generationId: string): Promise<DebitResult> => {
  const response = await fetch(FANFRAME_ENDPOINTS.debit, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ generation_id: generationId }),
  });

  const data: DebitResponse = await response.json();

  // Respostas possíveis:
  // Sucesso: { ok: true, balance_after: 6 }
  // Sem créditos: { ok: false, reason: "no_credits" }
  
  if (data.ok === false && data.reason === "no_credits") {
    return { success: false, errorCode: "no_credits" };
  }

  if (data.ok === true) {
    return { success: true, balanceAfter: data.balance_after };
  }
};
```

### Idempotência com generation_id

O `generation_id` garante que mesmo com retries, o crédito só é debitado uma vez:

```typescript
const generateGenerationId = (): string => {
  // Verifica se já existe um salvo (para retry)
  const stored = localStorage.getItem("vf_generation_id");
  if (stored) return stored;

  // Gera novo UUID
  const newId = crypto.randomUUID();
  localStorage.setItem("vf_generation_id", newId);
  return newId;
};

const clearGenerationId = () => {
  // Chama após geração BEM-SUCEDIDA
  localStorage.removeItem("vf_generation_id");
};
```

---

## Tratamento de Token Expirado

Quando a API retorna HTTP 401:

```typescript
const handleAuthError = (status: number) => {
  if (status === 401) {
    // Limpa dados locais
    localStorage.removeItem("vf_app_token");
    localStorage.removeItem("vf_generation_id");
    
    // Callback para logout
    onTokenExpired?.();
  }
};
```

O usuário verá a tela `AccessDeniedScreen` com instrução para reabrir via WordPress.

---

## Fluxo Completo do Usuário

```
┌──────────────────────────────────────────────────────────────────┐
│                    JORNADA DO USUÁRIO                            │
└──────────────────────────────────────────────────────────────────┘

WordPress                          React App
    │                                  │
    │  Usuário clica "Abrir App"       │
    │ ─────────────────────────────►   │
    │  Redireciona com ?code=XXXX      │
    │                                  │
    │                            ┌─────┴─────┐
    │                            │ Exchange  │
    │  ◄─────────────────────────┤ code→token│
    │  Valida code               └─────┬─────┘
    │                                  │
    │                            ┌─────┴─────┐
    │                            │ Welcome   │
    │                            │ Screen    │
    │                            └─────┬─────┘
    │                                  │
    │                            ┌─────┴─────┐
    │                            │ Buy       │
    │                            │ Credits   │◄──── Mostra saldo
    │                            └─────┬─────┘      + opções compra
    │                                  │
    │  ◄───── Usuário compra ──────────┤
    │  (abre nova aba no WP)           │
    │                                  │
    │                            ┌─────┴─────┐
    │                            │ Tutorial  │
    │                            └─────┬─────┘
    │                                  │
    │                            ┌─────┴─────┐
    │                            │ Seleciona │
    │                            │ Camisa    │
    │                            └─────┬─────┘
    │                                  │
    │                            ┌─────┴─────┐
    │                            │ Upload    │
    │                            │ Foto      │
    │                            └─────┬─────┘
    │                                  │
    │                            ┌─────┴─────┐
    │  ◄─────── Debit ─────────  │ Gerar     │
    │  Debita 1 crédito          │ Resultado │
    │                            └─────┬─────┘
    │                                  │
    │                            ┌─────┴─────┐
    │                            │ Exibe     │
    │                            │ Resultado │
    │                            └───────────┘
```

---

## Tipos TypeScript

### Respostas da API

```typescript
// POST /handoff/exchange
interface ExchangeResponse {
  ok: boolean;
  app_token?: string;
  user_id?: number;
  expires_at?: string;
  balance?: number;
  error?: string;
}

// GET /credits/balance
interface BalanceResponse {
  ok: boolean;
  balance?: number;
}

// POST /credits/debit
interface DebitResponse {
  ok: boolean;
  balance_after?: number;
  reason?: string;  // "no_credits" quando sem saldo
}
```

---

## Tela de Acesso Negado

**Arquivo:** `src/components/wizard/AccessDeniedScreen.tsx`

Exibida quando:
- Não há `code` na URL E
- Não há `vf_app_token` no localStorage

Instruções para o usuário retornar ao WordPress.

---

## Tela de Compra de Créditos

**Arquivo:** `src/components/wizard/BuyCreditsScreen.tsx`

Funcionalidades:
- Mostra saldo atual
- Botões para comprar pacotes (abrem nova aba)
- Botão "Atualizar Saldo" para refresh após compra
- Botão "Continuar" para prosseguir

```typescript
interface BuyCreditsScreenProps {
  onRefreshBalance: () => Promise<void>;
  isRefreshing: boolean;
  onContinue: () => void;
}
```

---

## Integração no Index.tsx

**Arquivo:** `src/pages/Index.tsx`

```typescript
const Index = () => {
  // Hooks de integração
  const { 
    isAuthenticated, 
    isLoading: authLoading, 
    balance, 
    updateBalance,
    logout,
    getStoredToken 
  } = useFanFrameAuth();

  const { 
    fetchBalance, 
    isLoading: creditsLoading,
    clearGenerationId 
  } = useFanFrameCredits(logout);

  // Fetch inicial do saldo após autenticação
  useEffect(() => {
    if (isAuthenticated && getStoredToken()) {
      const newBalance = await fetchBalance();
      if (newBalance !== null) updateBalance(newBalance);
    }
  }, [isAuthenticated]);

  // Loading state
  if (FANFRAME_ENABLED && authLoading) {
    return <Loader2 className="animate-spin" />;
  }

  // Not authenticated
  if (FANFRAME_ENABLED && !isAuthenticated) {
    return <AccessDeniedScreen />;
  }

  // ... resto do wizard
};
```

---

## Ordem das Telas (Wizard)

Com `FANFRAME_ENABLED = true`:

1. **Welcome** → "Experimentar Agora"
2. **Buy Credits** → Mostra saldo, opções de compra
3. **Tutorial** → Como funciona
4. **Shirt Selection** → Escolhe camisa e fundo
5. **Upload** → Envia foto
6. **Result** → Gera e mostra resultado

---

## Debug e Logs

Todos os logs usam prefixo `[FanFrame]`:

```javascript
console.log("[FanFrame] Inicializando...");
console.log("[FanFrame] Token salvo no localStorage");
console.log("[FanFrame] Consultando saldo...");
console.log("[FanFrame] Debitando crédito...");
console.log("[FanFrame] Débito realizado! Saldo após:", balance);
```

---

## Checklist para Migração/Debug

### Verificar Configuração
- [ ] `FANFRAME_ENABLED` está `true`?
- [ ] `FANFRAME_API_BASE` aponta para URL correta?
- [ ] WordPress está respondendo nos endpoints?

### Verificar Autenticação
- [ ] URL contém `?code=` quando vindo do WordPress?
- [ ] Exchange retorna `ok: true` e `app_token`?
- [ ] Token está sendo salvo em `localStorage["vf_app_token"]`?

### Verificar Créditos
- [ ] Header `X-Fanframe-Token` está sendo enviado?
- [ ] Balance endpoint retorna `ok: true`?
- [ ] Debit usa `generation_id` único?

### Verificar CORS
- [ ] WordPress permite origem do app React?
- [ ] Headers `Access-Control-Allow-*` configurados?

---

## Erros Comuns

| Erro | Causa | Solução |
|------|-------|---------|
| 401 no balance/debit | Token expirado ou inválido | Usuário deve reabrir via WordPress |
| CORS error | WordPress não permite origem | Configurar CORS no WordPress |
| `no_credits` no debit | Saldo zerado | Redirecionar para compra |
| Exchange falha | Code já usado ou expirado | Usuário deve reiniciar fluxo |

---

## Contato e Suporte

Para questões sobre a API WordPress/FanFrame, consultar a documentação do plugin FanFrame ou o administrador do WordPress em `tricolorvirtualexperience.net`.
