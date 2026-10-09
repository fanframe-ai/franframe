import { supabase } from '@/integrations/supabase/client';
import { reportError } from '@/lib/diagnostics';

export function credentials(teamSlug: string) {
  const testToken = new URLSearchParams(window.location.search).get('test_token');
  return { team_slug: teamSlug, ...(testToken ? { test_token: testToken } : { app_token: localStorage.getItem(`vf_app_token:${teamSlug}`) }) };
}
export class FunctionError extends Error {
  constructor(public code: string, public status: number, public requestId?: string) { super(code); }
}
export async function invoke<T>(name: string, body: object): Promise<T> {
  const start = performance.now();
  const { data, error } = await supabase.functions.invoke(name, { body }).catch(failure => {
    reportError('function_transport_failed', failure, { function: name, duration_ms: performance.now()-start }); throw failure;
  });
  if (error || data?.error) {
    let code = data?.error || 'connection_failed'; let status = 0; let requestId = data?.request_id;
    if (error?.context instanceof Response) {
      status = error.context.status;
      requestId = error.context.headers.get('x-fanframe-request-id') || requestId;
      try { const value = await error.context.json(); code = value.error || code; requestId = value.request_id || requestId; } catch { /* Transport failure. */ }
    }
    const failure = new FunctionError(code, status, requestId);
    reportError('function_failed', failure, { function: name, code, http_status: status, request_id: requestId,
      generation_id: 'queue_id' in body ? body.queue_id : 'request_id' in body ? body.request_id : undefined, duration_ms: performance.now()-start }, status > 0 && status < 500);
    throw failure;
  }
  return data as T;
}
export type Generation = { id: string; status: 'pending' | 'processing' | 'awaiting_payment' | 'completed' | 'failed'; phase?: 'preparing' | 'generating' | 'finishing'; result_image_url: string | null; error_message: string | null; shirt_id: string; created_at: string; next_poll_after?: number };
export function generationStatus(teamSlug: string, queueId: string) {
  return invoke<Generation>('generation-status', { ...credentials(teamSlug), queue_id: queueId });
}
export function generationHistory(teamSlug: string, page = 0) {
  return invoke<{ entries: Generation[]; has_more?: boolean }>('generation-status', { ...credentials(teamSlug), action: 'history', page });
}
