export const FANFRAME_ENABLED = true;

export interface ExchangeResponse {
  ok: boolean;
  app_token?: string;
  user_id?: number;
  expires_at?: string;
  balance?: number;
  error?: string;
  wordpress_origin?: string;
  purchase_urls?: Record<string, string>;
}

export interface BalanceResponse {
  ok: boolean;
  balance?: number;
  wordpress_origin?: string;
  purchase_urls?: Record<string, string>;
}
