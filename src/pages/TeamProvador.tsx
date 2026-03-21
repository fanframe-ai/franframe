import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { useTeam } from "@/contexts/TeamContext";
import Index from "./Index";

export default function TeamProvadorPage() {
  const { slug } = useParams<{ slug: string }>();
  const { setSlug } = useTeam();

  useEffect(() => {
    if (slug) {
      setSlug(slug);
    }
  }, [slug, setSlug]);

  return <Index />;
}
