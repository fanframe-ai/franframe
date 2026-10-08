export function readEnvironment(values: Record<string, string | undefined>) {
  const url = values.VITE_SUPABASE_URL;
  const key = values.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('Configure VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY.');
  const parsed = new URL(url);
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('URL Supabase inválida.');
  return { supabaseUrl: url.replace(/\/$/, ''), supabaseKey: key, projectId: parsed.hostname.split('.')[0] };
}
export const env = readEnvironment(import.meta.env);
