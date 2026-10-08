export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};
export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}
export function endpoint(handle: (req: Request) => Promise<Response>) {
  return async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
    try { return await handle(req); }
    catch (error) {
      if (error instanceof HttpError) return json({ error: error.message }, error.status);
      console.error('Request failed:', error instanceof Error ? error.name : 'unknown');
      return json({ error: 'Não foi possível concluir a operação.' }, 500);
    }
  };
}
export function requiredString(value: unknown, name: string, max = 4096): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new HttpError(400, `invalid_${name}`);
  return value;
}
export async function body(req: Request): Promise<Record<string, unknown>> {
  const raw = await req.text();
  if (raw.length > 16 * 1024 * 1024) throw new HttpError(413, 'image_too_large');
  try {
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error();
    return data;
  } catch { throw new HttpError(400, 'invalid_json'); }
}
