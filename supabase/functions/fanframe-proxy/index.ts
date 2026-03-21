import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Default fallback
const DEFAULT_API_BASE = "https://timaotourvirtual.com.br/wp-json/vf-fanframe/v1";

async function resolveApiBase(teamSlug?: string): Promise<string> {
  if (!teamSlug) return DEFAULT_API_BASE;
  
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const { data } = await supabase
      .from("teams")
      .select("wordpress_api_base")
      .eq("slug", teamSlug)
      .eq("is_active", true)
      .single();
    
    if (data?.wordpress_api_base) {
      console.log(`[fanframe-proxy] Resolved API base for team ${teamSlug}: ${data.wordpress_api_base}`);
      return data.wordpress_api_base;
    }
  } catch (err) {
    console.error(`[fanframe-proxy] Error resolving team ${teamSlug}:`, err);
  }
  
  return DEFAULT_API_BASE;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, token, body, team_slug } = await req.json();

    console.log(`[fanframe-proxy] action=${action}, token=${token ? token.substring(0, 10) + "..." : "MISSING"}, team=${team_slug || "default"}`);

    if (!token) {
      return new Response(
        JSON.stringify({ ok: false, error: "Token não fornecido" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Resolve the API base URL for this team
    const FANFRAME_API_BASE = await resolveApiBase(team_slug);

    let endpoint: string;
    let method: string;
    let fetchBody: string | undefined;

    switch (action) {
      case "balance":
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

    if (action !== "exchange") {
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
