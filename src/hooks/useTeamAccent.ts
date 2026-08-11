import { useMemo } from "react";
import { useTeam } from "@/contexts/TeamContext";
import { readableAccent, readableForeground } from "@/lib/teamColors";

/**
 * Tenant accent color guaranteed to be visible on the dark background,
 * plus a readable foreground for text/icons placed on top of it.
 */
export function useTeamAccent(fallback = "#FFFFFF") {
  const { team } = useTeam();
  return useMemo(() => {
    const accent = readableAccent(team?.primary_color, team?.secondary_color, fallback);
    const accentFg = readableForeground(accent, team?.secondary_color);
    return { accent, accentFg };
  }, [team?.primary_color, team?.secondary_color, fallback]);
}
