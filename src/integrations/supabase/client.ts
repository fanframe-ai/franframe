import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { env } from '@/config/env';
import { reportError } from '@/lib/diagnostics';

export const supabase = createClient<Database>(env.supabaseUrl, env.supabaseKey, {
  auth: { persistSession: true, autoRefreshToken: true },
  global: { fetch: async (input, init) => {
    const start = performance.now();
    const path = new URL(input instanceof Request ? input.url : String(input), env.supabaseUrl).pathname;
    const operation = path.split('/').at(-1) || 'supabase';
    try {
      const originalSignal = init?.signal || (input instanceof Request ? input.signal : undefined);
      const timeout = typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(60000) : undefined;
      const signal = originalSignal && timeout && typeof AbortSignal.any === 'function' ? AbortSignal.any([originalSignal, timeout]) : originalSignal || timeout;
      const response = await fetch(input, { ...init, signal });
      if (!response.ok) reportError('supabase_request_failed', null, { function: operation, http_status: response.status, request_id: response.headers.get('x-fanframe-request-id'), duration_ms: performance.now()-start }, response.status < 500);
      return response;
    } catch (error) { reportError('supabase_transport_failed', error, { function: operation, duration_ms: performance.now()-start }); throw error; }
  } },
});
