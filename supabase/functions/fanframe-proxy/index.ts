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

    if (!token) {
      return new Response(
        JSON.stringify({ ok: false, error: "Token não fornecido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let endpoint: string;
    let method: string;
    let fetchBody: string | undefined;

    switch (action) {
      case "balance":
        endpoint = `${FANFRAME_API_BASE}/credits/balance`;
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
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    console.log(`[fanframe-proxy] ${action} -> ${method} ${endpoint}`);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    // Exchange doesn't use X-Fanframe-Token, it uses the code in the body
    if (action !== "exchange") {
      headers["X-Fanframe-Token"] = token;
    }

    const response = await fetch(endpoint, {
      method,
      headers,
      body: fetchBody,
    });

    const responseText = await response.text();
    console.log(`[fanframe-proxy] Response ${response.status}:`, responseText);

    return new Response(responseText, {
      status: response.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[fanframe-proxy] Error:", error);
    return new Response(
      JSON.stringify({ ok: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
