import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Monitor, Tablet, Smartphone, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

const viewports = [
  { id: "mobile", label: "Mobile", icon: Smartphone, width: 375, height: 812 },
  { id: "tablet", label: "Tablet", icon: Tablet, width: 768, height: 1024 },
  { id: "desktop", label: "Desktop", icon: Monitor, width: 1280, height: 800 },
] as const;

export default function AdminPreview() {
  const [viewport, setViewport] = useState<typeof viewports[number]>(viewports[0]);

  const previewUrl = window.location.origin + "/?preview=admin";

  return (
    <AdminLayout>
      <div className="flex flex-col h-[calc(100vh-4rem)]">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">Preview</h1>
            <p className="text-sm text-muted-foreground">Visualize o provador como o usuário final</p>
          </div>
          <div className="flex items-center gap-2">
            {viewports.map((vp) => (
              <Button
                key={vp.id}
                variant={viewport.id === vp.id ? "default" : "outline"}
                size="sm"
                onClick={() => setViewport(vp)}
              >
                <vp.icon className="h-4 w-4 mr-1" />
                {vp.label}
              </Button>
            ))}
            <Button variant="outline" size="sm" asChild>
              <a href={previewUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-1" />
                Abrir
              </a>
            </Button>
          </div>
        </div>

        {/* Preview Frame */}
        <div className="flex-1 flex items-start justify-center overflow-auto bg-muted/30 rounded-lg p-4">
          <div
            className={cn(
              "bg-black rounded-[2rem] shadow-2xl overflow-hidden border-4 border-muted-foreground/20 transition-all duration-300",
              viewport.id === "mobile" && "p-2",
              viewport.id === "tablet" && "p-2",
              viewport.id === "desktop" && "p-1 rounded-xl"
            )}
            style={{
              width: Math.min(viewport.width + 16, viewport.id === "desktop" ? 1280 : viewport.width + 16),
              height: Math.min(viewport.height + 16, 760),
            }}
          >
            <iframe
              key={viewport.id}
              src={previewUrl}
              className="w-full h-full rounded-[1.5rem] bg-white"
              style={{
                width: viewport.width,
                height: viewport.height - 16,
                maxWidth: "100%",
                maxHeight: "100%",
              }}
              title="Preview do Provador"
            />
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
