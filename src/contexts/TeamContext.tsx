import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface TeamShirt {
  id: string;
  name: string;
  subtitle: string;
  imageUrl: string;
  assetPath: string;
  promptDescription: string;
}

export interface TeamBackground {
  id: string;
  name: string;
  subtitle: string;
  imageUrl: string;
  assetPath: string;
}

export interface TeamConfig {
  id: string;
  slug: string;
  name: string;
  subdomain: string;
  wordpress_api_base: string;
  purchase_urls: Record<string, string>;
  replicate_api_token: string | null;
  generation_prompt: string | null;
  shirts: TeamShirt[];
  backgrounds: TeamBackground[];
  tutorial_assets: { before: string; after: string };
  primary_color: string;
  secondary_color: string;
  logo_url: string | null;
  watermark_url: string | null;
  is_active: boolean;
}

interface TeamContextValue {
  team: TeamConfig | null;
  isLoading: boolean;
  error: string | null;
}

const TeamContext = createContext<TeamContextValue>({
  team: null,
  isLoading: true,
  error: null,
});

export function useTeam() {
  return useContext(TeamContext);
}

function resolveTeamSlug(): string {
  // 1. Check query param (for dev/preview)
  const params = new URLSearchParams(window.location.search);
  const teamParam = params.get("team");
  if (teamParam) return teamParam;

  // 2. Check subdomain
  const hostname = window.location.hostname;
  
  // Handle lovable.app subdomains: ffcorinthians.lovable.app
  if (hostname.endsWith(".lovable.app")) {
    const sub = hostname.split(".")[0];
    // Remove "ff" prefix if present (convention: ff<slug>.lovable.app)
    if (sub.startsWith("ff")) {
      return sub.slice(2);
    }
    // Preview URLs like id-preview--xxx.lovable.app -> fallback
  }

  // Handle custom domains: check teams table by subdomain match
  // For now, return the full hostname as subdomain to match against DB
  if (!hostname.includes("localhost") && !hostname.includes("lovable.app")) {
    // Custom domain - will be matched by subdomain column in DB
    return hostname;
  }

  // Fallback: corinthians (default team)
  return "corinthians";
}

export function TeamProvider({ children }: { children: ReactNode }) {
  const [team, setTeam] = useState<TeamConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadTeam = async () => {
      try {
        const slug = resolveTeamSlug();
        console.log("[TeamContext] Resolving team for slug:", slug);

        // Try by slug first, then by subdomain
        let { data, error: fetchError } = await supabase
          .from("teams")
          .select("*")
          .eq("slug", slug)
          .eq("is_active", true)
          .maybeSingle();

        // If not found by slug, try by subdomain
        if (!data && !fetchError) {
          const result = await supabase
            .from("teams")
            .select("*")
            .eq("subdomain", slug)
            .eq("is_active", true)
            .maybeSingle();
          data = result.data;
          fetchError = result.error;
        }

        if (fetchError) {
          console.error("[TeamContext] Error fetching team:", fetchError);
          setError("Erro ao carregar configuração do time");
          setIsLoading(false);
          return;
        }

        if (!data) {
          console.error("[TeamContext] Team not found for slug:", slug);
          setError("Time não encontrado");
          setIsLoading(false);
          return;
        }

        const teamConfig: TeamConfig = {
          id: data.id,
          slug: data.slug,
          name: data.name,
          subdomain: data.subdomain,
          wordpress_api_base: data.wordpress_api_base,
          purchase_urls: (data.purchase_urls as Record<string, string>) || {},
          replicate_api_token: data.replicate_api_token,
          generation_prompt: data.generation_prompt,
          shirts: (data.shirts as unknown as TeamShirt[]) || [],
          backgrounds: (data.backgrounds as unknown as TeamBackground[]) || [],
          tutorial_assets: (data.tutorial_assets as { before: string; after: string }) || { before: "", after: "" },
          primary_color: data.primary_color || "#000000",
          secondary_color: data.secondary_color || "#FFFFFF",
          logo_url: data.logo_url,
          watermark_url: data.watermark_url,
          is_active: data.is_active ?? true,
        };

        console.log("[TeamContext] Team loaded:", teamConfig.name);
        setTeam(teamConfig);
      } catch (err) {
        console.error("[TeamContext] Unexpected error:", err);
        setError("Erro inesperado ao carregar time");
      } finally {
        setIsLoading(false);
      }
    };

    loadTeam();
  }, []);

  return (
    <TeamContext.Provider value={{ team, isLoading, error }}>
      {children}
    </TeamContext.Provider>
  );
}
