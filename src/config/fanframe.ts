// FanFrame WordPress Integration Configuration
// Seguindo estritamente a documentação oficial

// Supabase Storage base URL for permanent assets (projeto conectado ao app)
const STORAGE_BASE = "https://qmjvsftlounkitclmzzw.supabase.co/storage/v1/object/public/tryon-assets";

// Flag para ativar/desativar integração
export const FANFRAME_ENABLED = true;

// API Base URL - WordPress REST API
export const FANFRAME_API_BASE = "https://tricolorvirtualexperience.net/wp-json/vf-fanframe/v1";

// API Endpoints conforme documentação seção 5
export const FANFRAME_ENDPOINTS = {
  // 5.1 Exchange (trocar code por app_token)
  exchange: `${FANFRAME_API_BASE}/handoff/exchange`,
  // 5.2 Consultar saldo
  balance: `${FANFRAME_API_BASE}/credits/balance`,
  // 5.3 Debitar 1 crédito
  debit: `${FANFRAME_API_BASE}/credits/debit`,
} as const;

// Credit purchase URLs (abrem em nova aba) - conforme seção 3
export const FANFRAME_PURCHASE_URLS = {
  credits1: "https://tricolorvirtualexperience.net/buy-credits?pack=1",
  credits3: "https://tricolorvirtualexperience.net/buy-credits?pack=3", // CTA principal recomendado
  credits7: "https://tricolorvirtualexperience.net/buy-credits?pack=7",
} as const;

// LocalStorage keys - conforme documentação seção 9: "vf_app_token"
export const FANFRAME_STORAGE_KEYS = {
  appToken: "vf_app_token",
  userId: "vf_user_id",
  generationId: "vf_generation_id",
} as const;

// Error codes from API - conforme seção 5.3
export const FANFRAME_ERROR_CODES = {
  noCredits: "no_credits",
} as const;

// Tipos para respostas da API conforme documentação seção 5

// 5.1 Exchange Response
export interface ExchangeResponse {
  ok: boolean;
  app_token?: string;
  user_id?: number;
  expires_at?: string;
  balance?: number;
  error?: string;
}

// 5.2 Balance Response
export interface BalanceResponse {
  ok: boolean;
  balance?: number;
}

// 5.3 Debit Response
export interface DebitResponse {
  ok: boolean;
  balance_after?: number;
  reason?: string;
}

// Background interface
export interface Background {
  id: string;
  name: string;
  subtitle: string;
  imageUrl: string;
  assetPath: string;
}

// Asset URLs from Supabase Storage (permanent, publicly accessible)
export const ASSET_URLS = {
  background: `${STORAGE_BASE}/backgrounds/mural.png`,
  shirts: {
    "manto-1": `${STORAGE_BASE}/shirts/manto-1.png`,
    "manto-2": `${STORAGE_BASE}/shirts/manto-2.png`,
    "manto-3": `${STORAGE_BASE}/shirts/manto-3.png`,
  },
  backgrounds: {
    "mural": `${STORAGE_BASE}/backgrounds/mural.png`,
    "memorial": `${STORAGE_BASE}/backgrounds/memorial.jpg`,
    "idolos": `${STORAGE_BASE}/backgrounds/idolos.jpg`,
    "trofeus": `${STORAGE_BASE}/backgrounds/trofeus.jpg`,
  },
  tutorial: {
    before: `${STORAGE_BASE}/tutorial/before.jpg`,
    after: `${STORAGE_BASE}/tutorial/after.png`,
  },
} as const;

export const BACKGROUNDS: Background[] = [
  {
    id: "mural",
    name: "Mural dos Ídolos",
    subtitle: "Os maiores craques do Corinthians",
    imageUrl: ASSET_URLS.backgrounds["mural"],
    assetPath: ASSET_URLS.backgrounds["mural"],
  },
  {
    id: "memorial",
    name: "Memorial do Corinthians",
    subtitle: "A história do Timão",
    imageUrl: ASSET_URLS.backgrounds["memorial"],
    assetPath: ASSET_URLS.backgrounds["memorial"],
  },
  {
    id: "idolos",
    name: "Galeria dos Ídolos",
    subtitle: "Os maiores ídolos corintianos",
    imageUrl: ASSET_URLS.backgrounds["idolos"],
    assetPath: ASSET_URLS.backgrounds["idolos"],
  },
  {
    id: "trofeus",
    name: "Sala de Troféus",
    subtitle: "A história em conquistas",
    imageUrl: ASSET_URLS.backgrounds["trofeus"],
    assetPath: ASSET_URLS.backgrounds["trofeus"],
  },
];

// Helper para obter URL completa de um asset
export const getAssetFullUrl = (assetPath: string): string => {
  // Se já é URL absoluta (do Storage), retorna direto
  if (assetPath.startsWith('http')) {
    return assetPath;
  }
  // Fallback para paths locais (não deve acontecer mais)
  if (typeof window !== 'undefined') {
    return `${window.location.origin}${assetPath}`;
  }
  return assetPath;
};
