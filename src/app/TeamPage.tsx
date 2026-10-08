import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useTeam } from "@/features/teams/TeamContext";
import { supabase } from "@/integrations/supabase/client";
import { invoke } from "@/integrations/supabase/functions";
import Index from "@/features/tryon/TryOnPage";

export default function TeamProvadorPage() {
  const { slug } = useParams<{ slug: string }>();
  const { setSlug } = useTeam();
  const [resolving, setResolving] = useState(true);

  useEffect(() => {
    if (!slug) {
      setResolving(false);
      return;
    }

    const resolve = async () => {
      // Check if there's already a test_token query param
      const params = new URLSearchParams(window.location.search);
      if (params.get("test_token")) {
        setSlug(slug);
        setResolving(false);
        return;
      }

      // Try the full slug as a team first
      const { data: team } = await supabase
        .from("teams")
        .select("slug")
        .eq("slug", slug)
        .eq("is_active", true)
        .maybeSingle();

      if (team) {
        // Exact match - regular team
        setSlug(slug);
        setResolving(false);
        return;
      }

      // Try to extract test token from the end of the slug
      // Format: teamslug-TOKEN (token is last 8 chars after last hyphen)
      const lastHyphen = slug.lastIndexOf("-");
      if (lastHyphen > 0) {
        const possibleTeamSlug = slug.substring(0, lastHyphen);
        const possibleToken = slug.substring(lastHyphen + 1);

        try {
          await invoke('fanframe-proxy', { action: 'test', team_slug: possibleTeamSlug, test_token: possibleToken });
          const url = new URL(window.location.href);
          url.searchParams.set('test_token', possibleToken);
          url.pathname = `/${possibleTeamSlug}`;
          window.history.replaceState({}, '', url.toString());
          setSlug(possibleTeamSlug);
          setResolving(false);
          return;
        } catch { /* invalid link; resolve original slug normally */ }
      }

      // Fallback: just use the slug as-is
      setSlug(slug);
      setResolving(false);
    };

    resolve();
  }, [slug, setSlug]);

  if (resolving) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return <Index />;
}
