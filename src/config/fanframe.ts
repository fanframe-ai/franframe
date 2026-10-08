export const FANFRAME_ENABLED = true;

export interface ExchangeResponse {
  ok: boolean;
  app_token?: string;
  user_id?: number;
  expires_at?: string;
  balance?: number;
  error?: string;
}

export interface BalanceResponse {
  ok: boolean;
  balance?: number;
}
