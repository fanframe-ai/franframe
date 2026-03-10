import { useState, useRef } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, Loader2, Check, ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ASSET_URLS, BACKGROUNDS } from "@/config/fanframe";
import { SHIRTS } from "@/components/wizard/ShirtSelectionScreen";

const BUCKET = "tryon-assets";

function AssetCard({
  label,
  subtitle,
  currentUrl,
  storagePath,
  aspectRatio = "3/4",
}: {
  label: string;
  subtitle?: string;
  currentUrl: string;
  storagePath: string;
  aspectRatio?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(currentUrl);
  const [done, setDone] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setDone(false);

    try {
        const { error } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, file, { cacheControl: "60", upsert: true });

      if (error) throw error;

      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
      setPreviewUrl(urlData.publicUrl + "?t=" + Date.now());
      setDone(true);
      toast({ title: "Imagem atualizada!", description: label });
    } catch (err: any) {
      toast({ title: "Erro no upload", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="relative bg-muted" style={{ aspectRatio }}>
        <img
          src={previewUrl}
          alt={label}
          className="w-full h-full object-cover"
          onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder.svg"; }}
        />
        {done && (
          <div className="absolute top-2 right-2 bg-green-500 text-white rounded-full p-1">
            <Check className="h-4 w-4" />
          </div>
        )}
      </div>
      <div className="p-3">
        <h3 className="font-semibold text-sm">{label}</h3>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
        <Button
          size="sm"
          variant="outline"
          className="mt-2 w-full"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
          {uploading ? "Enviando..." : "Substituir imagem"}
        </Button>
      </div>
    </div>
  );
}

export default function AdminAssets() {
  return (
    <AdminLayout>
      <div className="max-w-5xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Gerenciar Assets</h1>
          <p className="text-sm text-muted-foreground">Edite as imagens do provador virtual</p>
        </div>

        <Tabs defaultValue="tutorial" className="space-y-4">
          <TabsList>
            <TabsTrigger value="tutorial">Antes / Depois</TabsTrigger>
            <TabsTrigger value="shirts">Camisas</TabsTrigger>
            <TabsTrigger value="backgrounds">Cenários</TabsTrigger>
          </TabsList>

          {/* Tutorial Before/After */}
          <TabsContent value="tutorial">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <AssetCard
                label="Imagem Antes"
                subtitle="Foto de exemplo sem o manto"
                currentUrl="/assets/before-example.jpg"
                storagePath="tutorial/before.jpg"
                aspectRatio="3/4"
              />
              <AssetCard
                label="Imagem Depois"
                subtitle="Foto de exemplo com o manto"
                currentUrl="/assets/after-example.png"
                storagePath="tutorial/after.png"
                aspectRatio="3/4"
              />
            </div>
          </TabsContent>

          {/* Shirts */}
          <TabsContent value="shirts">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {SHIRTS.map((shirt) => (
                <AssetCard
                  key={shirt.id}
                  label={shirt.name}
                  subtitle={shirt.subtitle}
                  currentUrl={shirt.imageUrl}
                  storagePath={`shirts/${shirt.id}.png`}
                  aspectRatio="1/1"
                />
              ))}
            </div>
          </TabsContent>

          {/* Backgrounds */}
          <TabsContent value="backgrounds">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {BACKGROUNDS.map((bg) => (
                <AssetCard
                  key={bg.id}
                  label={bg.name}
                  subtitle={bg.subtitle}
                  currentUrl={bg.imageUrl}
                  storagePath={`backgrounds/${bg.id}.${bg.id === "mural" ? "png" : "jpg"}`}
                  aspectRatio="16/9"
                />
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
