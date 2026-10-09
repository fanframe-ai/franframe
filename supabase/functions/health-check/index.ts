import { requireAdmin, serviceClient, type Client } from '../_shared/auth.ts';
import { endpoint, json } from '../_shared/http.ts';
import { requireWorker } from '../generation-worker/index.ts';
type HealthClient = Client;

interface HealthCheckResult {
  service_id: string;
  service_name: string;
  status: "operational" | "degraded" | "partial_outage" | "major_outage";
  response_time_ms: number;
  error_message?: string;
}

async function checkDatabase(supabase: HealthClient): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    const { error } = await supabase.from("generations").select("id").limit(1);
    const responseTime = Date.now() - start;
    
    if (error) throw error;
    
    return {
      service_id: "database",
      service_name: "Banco de Dados",
      status: responseTime < 1000 ? "operational" : responseTime < 2000 ? "degraded" : "partial_outage",
      response_time_ms: responseTime,
    };
  } catch (err) {
    return {
      service_id: "database",
      service_name: "Banco de Dados",
      status: "major_outage",
      response_time_ms: Date.now() - start,
      error_message: err instanceof Error ? err.message : "Database error",
    };
  }
}

async function checkAuth(supabase: HealthClient): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    const { error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 });
    const responseTime = Date.now() - start;
    
    if (error) throw error;
    
    return {
      service_id: "auth",
      service_name: "Autenticação",
      status: responseTime < 500 ? "operational" : "degraded",
      response_time_ms: responseTime,
    };
  } catch (err) {
    return {
      service_id: "auth",
      service_name: "Autenticação",
      status: "major_outage",
      response_time_ms: Date.now() - start,
      error_message: err instanceof Error ? err.message : "Auth error",
    };
  }
}

async function checkReplicate(supabase: HealthClient): Promise<HealthCheckResult> {
  const start = Date.now();
  const { data } = await supabase.from('team_secrets').select('replicate_api_token').not('replicate_api_token', 'is', null).limit(1).maybeSingle();
  const replicateToken = data?.replicate_api_token || Deno.env.get("REPLICATE_API_TOKEN");
  
  if (!replicateToken) {
    return {
      service_id: "replicate",
      service_name: "API IA (Replicate)",
      status: "major_outage",
      response_time_ms: 0,
      error_message: "REPLICATE_API_TOKEN not configured",
    };
  }
  
  try {
    const response = await fetch("https://api.replicate.com/v1/account", {
      method: "GET",
      signal: AbortSignal.timeout(15000),
      headers: {
        "Authorization": `Bearer ${replicateToken}`,
      },
    });
    
    const responseTime = Date.now() - start;
    
    if (response.status === 401) {
      return {
        service_id: "replicate",
        service_name: "API IA (Replicate)",
        status: "major_outage",
        response_time_ms: responseTime,
        error_message: "Invalid API token",
      };
    }
    
    if (response.status === 429) {
      return {
        service_id: "replicate",
        service_name: "API IA (Replicate)",
        status: "degraded",
        response_time_ms: responseTime,
        error_message: "Rate limited",
      };
    }
    
    if (!response.ok) {
      return {
        service_id: "replicate",
        service_name: "API IA (Replicate)",
        status: "partial_outage",
        response_time_ms: responseTime,
        error_message: `HTTP ${response.status}`,
      };
    }
    
    return {
      service_id: "replicate",
      service_name: "API IA (Replicate)",
      status: responseTime < 1500 ? "operational" : "degraded",
      response_time_ms: responseTime,
    };
  } catch (err) {
    return {
      service_id: "replicate",
      service_name: "API IA (Replicate)",
      status: "major_outage",
      response_time_ms: Date.now() - start,
      error_message: err instanceof Error ? err.message : "Connection error",
    };
  }
}

async function checkEdgeFunctions(): Promise<HealthCheckResult> {
  const start = Date.now();
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  
  if (!supabaseUrl) {
    return {
      service_id: "edge-functions",
      service_name: "Funções de Backend",
      status: "major_outage",
      response_time_ms: 0,
      error_message: "SUPABASE_URL not configured",
    };
  }
  
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/generation-status`, {
      method: "POST",
      body: '{}', signal: AbortSignal.timeout(10000),
      headers: {
        "apikey": anonKey || "",
      },
    });
    
    const responseTime = Date.now() - start;
    
    if (response.status === 400 || response.status === 401) {
      return {
        service_id: "edge-functions",
        service_name: "Funções de Backend",
        status: responseTime < 1000 ? "operational" : "degraded",
        response_time_ms: responseTime,
      };
    }
    
    return {
      service_id: "edge-functions",
      service_name: "Funções de Backend",
      status: "degraded",
      response_time_ms: responseTime,
      error_message: `HTTP ${response.status}`,
    };
  } catch (err) {
    return {
      service_id: "edge-functions",
      service_name: "Funções de Backend",
      status: "major_outage",
      response_time_ms: Date.now() - start,
      error_message: err instanceof Error ? err.message : "Connection error",
    };
  }
}

async function checkRealtime(): Promise<HealthCheckResult> {
  const start = Date.now();
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) return { service_id: "realtime", service_name: "Tempo Real", status: "major_outage", response_time_ms: 0, error_message: "Realtime configuration unavailable" };
  try {
    const url = new URL(`${supabaseUrl.replace(/^http/, 'ws')}/realtime/v1/websocket`);
    url.searchParams.set('apikey', anonKey);
    url.searchParams.set('vsn', '1.0.0');
    const socket = new WebSocket(url);
    try {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Realtime timeout')), 5000);
        socket.onopen = () => { clearTimeout(timeout); resolve(); };
        socket.onerror = () => { clearTimeout(timeout); reject(new Error('Realtime unavailable')); };
      });
    } finally { socket.close(); }
    const responseTime = Date.now() - start;
    return { service_id: 'realtime', service_name: 'Tempo Real', status: responseTime < 1500 ? 'operational' : 'degraded', response_time_ms: responseTime };
  } catch {
    return { service_id: 'realtime', service_name: 'Tempo Real', status: 'major_outage', response_time_ms: Date.now() - start, error_message: 'Realtime unavailable' };
  }
}

async function checkCDN(supabase: HealthClient): Promise<HealthCheckResult> {
  const start = Date.now();
  
  try {
    const { data } = await supabase.from('teams').select('shirts').eq('is_active', true).limit(1).maybeSingle();
    const asset = data?.shirts?.[0]; const assetUrl = asset?.assetPath || asset?.imageUrl;
    if (!assetUrl || new URL(assetUrl).protocol !== 'https:') throw new Error('Asset configuration unavailable');
    const response = await fetch(assetUrl, { method: 'HEAD', redirect: 'error', signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error(`Asset HTTP ${response.status}`);
    
    const responseTime = Date.now() - start;
    
    return {
      service_id: "cdn",
      service_name: "CDN / Assets",
      status: responseTime < 800 ? "operational" : "degraded",
      response_time_ms: responseTime,
    };
  } catch (err) {
    return {
      service_id: "cdn",
      service_name: "CDN / Assets",
      status: "degraded",
      response_time_ms: Date.now() - start,
      error_message: err instanceof Error ? err.message : "Connection error",
    };
  }
}

export const handler = endpoint(async (req) => {
  const supabase = serviceClient();
  try { await requireWorker(req); } catch { await requireAdmin(req, supabase); }
  const startTime = Date.now();

  try {
    // Run all health checks in parallel
    const [dbResult, authResult, replicateResult, edgeResult, realtimeResult, cdnResult] = await Promise.all([
      checkDatabase(supabase),
      checkAuth(supabase),
      checkReplicate(supabase),
      checkEdgeFunctions(),
      checkRealtime(),
      checkCDN(supabase),
    ]);

    const results = [dbResult, authResult, replicateResult, edgeResult, realtimeResult, cdnResult];


    // Save results to database
    const { error: insertError } = await supabase
      .from("health_checks")
      .insert(results.map(r => ({
        service_id: r.service_id,
        service_name: r.service_name,
        status: r.status,
        response_time_ms: r.response_time_ms,
        error_message: r.error_message || null,
      })));

    if (insertError) {
      console.error("Error saving health checks:", insertError);
    }

    // Calculate overall status
    const statuses = results.map(r => r.status);
    let overallStatus: string;
    
    if (statuses.every(s => s === "operational")) {
      overallStatus = "operational";
    } else if (statuses.some(s => s === "major_outage")) {
      overallStatus = "major_outage";
    } else if (statuses.some(s => s === "partial_outage")) {
      overallStatus = "partial_outage";
    } else {
      overallStatus = "degraded";
    }

    const totalTime = Date.now() - startTime;
    console.log(`Health checks completed in ${totalTime}ms. Overall status: ${overallStatus}`);

    return json({
        success: true,
        overall_status: overallStatus,
        results,
        check_duration_ms: totalTime,
        checked_at: new Date().toISOString(),
      });

  } catch (error) {
    console.error("Error in health-check:", error instanceof Error ? error.name : "unknown");
    return json({ error: "health_check_failed", success: false }, 500);
  }
});
if (import.meta.main) Deno.serve(handler);
