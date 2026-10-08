import { supabase } from '@/integrations/supabase/client';

export function credentials(teamSlug: string) {
  const testToken = new URLSearchParams(window.location.search).get('test_token');
  return { team_slug: teamSlug, ...(testToken ? { test_token: testToken } : { app_token: localStorage.getItem(`vf_app_token:${teamSlug}`) }) };
}
export async function invoke<T>(name: string, body: object): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error || data?.error) throw new Error(data?.error || error?.message || 'Erro de conexão');
  return data as T;
}
export type Generation = { id: string; status: 'pending' | 'processing' | 'awaiting_payment' | 'completed' | 'failed'; result_image_url: string | null; error_message: string | null; shirt_id: string; created_at: string };
export function generationStatus(teamSlug: string, queueId: string) {
  return invoke<Generation>('generation-status', { ...credentials(teamSlug), queue_id: queueId });
}
export function generationHistory(teamSlug: string) {
  return invoke<{ entries: Generation[] }>('generation-status', { ...credentials(teamSlug), action: 'history' });
}
