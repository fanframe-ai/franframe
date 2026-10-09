import { supabase } from '@/integrations/supabase/client';

export function credentials(teamSlug: string) {
  const testToken = new URLSearchParams(window.location.search).get('test_token');
  return { team_slug: teamSlug, ...(testToken ? { test_token: testToken } : { app_token: localStorage.getItem(`vf_app_token:${teamSlug}`) }) };
}
export class FunctionError extends Error {
  constructor(public code: string, public status: number) { super(code); }
}
export async function invoke<T>(name: string, body: object): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error || data?.error) {
    let code = data?.error || 'connection_failed'; let status = 0;
    if (error?.context instanceof Response) {
      status = error.context.status;
      try { code = (await error.context.json()).error || code; } catch { /* Transport failure. */ }
    }
    throw new FunctionError(code, status);
  }
  return data as T;
}
export type Generation = { id: string; status: 'pending' | 'processing' | 'awaiting_payment' | 'completed' | 'failed'; result_image_url: string | null; error_message: string | null; shirt_id: string; created_at: string; next_poll_after?: number };
export function generationStatus(teamSlug: string, queueId: string) {
  return invoke<Generation>('generation-status', { ...credentials(teamSlug), queue_id: queueId });
}
export function generationHistory(teamSlug: string, page = 0) {
  return invoke<{ entries: Generation[]; has_more?: boolean }>('generation-status', { ...credentials(teamSlug), action: 'history', page });
}
