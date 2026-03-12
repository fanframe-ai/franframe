import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const FANFRAME_API_BASE = "https://timaotourvirtual.com.br/wp-json/vf-fanframe/v1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, token, body } = await req.json();

    console.log(`[fanframe-proxy] action=${action}, token=${token ? token.substring(0, 10) + "..." : "MISSING"}`);

    if (!token) {
      return new Response(
        JSON.stringify({ ok: false, error: "Token não fornecido" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let endpoint: string;
    let method: string;
    let fetchBody: string | undefined;

    switch (action) {
      case "balance":
        // Add cache-buster to prevent WordPress/CDN caching stale balance
        endpoint = `${FANFRAME_API_BASE}/credits/balance?_t=${Date.now()}`;
        method = "GET";
        break;
      case "debit":
        endpoint = `${FANFRAME_API_BASE}/credits/debit`;
        method = "POST";
        fetchBody = JSON.stringify(body || {});
        break;
      case "exchange":
        endpoint = `${FANFRAME_API_BASE}/handoff/exchange`;
        method = "POST";
        fetchBody = JSON.stringify(body || {});
        break;
      default:
        return new Response(
          JSON.stringify({ ok: false, error: "Ação inválida" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    console.log(`[fanframe-proxy] ${action} -> ${method} ${endpoint}`);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Pragma": "no-cache",
    };

    // Exchange doesn't use X-Fanframe-Token, it uses the code in the body
    if (action !== "exchange") {
      // Send token in multiple ways to maximize compatibility
      headers["X-Fanframe-Token"] = token;
      headers["Authorization"] = `Bearer ${token}`;
    }

    console.log(`[fanframe-proxy] Outgoing headers:`, JSON.stringify(headers));
    if (fetchBody) {
      console.log(`[fanframe-proxy] Outgoing body:`, fetchBody);
    }

    const response = await fetch(endpoint, {
      method,
      headers,
      body: fetchBody,
    });

    const responseText = await response.text();
    console.log(`[fanframe-proxy] Upstream response ${response.status}:`, responseText);

    // ALWAYS return 200 to avoid Supabase SDK throwing FunctionsHttpError
    // Include upstream status in body for client-side handling
    if (response.status === 401) {
      return new Response(
        JSON.stringify({ status: 401, error: "Token inválido", upstream: responseText }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(responseText, {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[fanframe-proxy] Error:", error);
    return new Response(
      JSON.stringify({ ok: false, error: error.message }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
