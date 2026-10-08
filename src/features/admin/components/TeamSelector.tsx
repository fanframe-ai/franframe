import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Team {
  id: string;
  name: string;
  slug: string;
}

interface TeamSelectorProps {
  value: string | null;
  onChange: (teamId: string | null) => void;
  className?: string;
}

export function TeamSelector({ value, onChange, className }: TeamSelectorProps) {
  const [teams, setTeams] = useState<Team[]>([]);

  useEffect(() => {
    const fetchTeams = async () => {
      const { data } = await supabase
        .from("teams")
        .select("id, name, slug")
        .order("name");
      if (data) setTeams(data);
    };
    fetchTeams();
  }, []);

  return (
    <Select
      value={value || "all"}
      onValueChange={(v) => onChange(v === "all" ? null : v)}
    >
      <SelectTrigger className={className ?? "w-[200px]"}>
        <SelectValue placeholder="Todos os times" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Todos os times</SelectItem>
        {teams.map((team) => (
          <SelectItem key={team.id} value={team.id}>
            {team.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
