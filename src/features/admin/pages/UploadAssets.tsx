import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { Check, Upload, Loader2, AlertCircle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const ASSETS_TO_UPLOAD = [
  { localPath: "/assets/manto-1.png", storagePath: "shirts/manto-1.png", name: "Manto 1" },
  { localPath: "/assets/manto-2.png", storagePath: "shirts/manto-2.png", name: "Manto 2" },
  { localPath: "/assets/manto-3.png", storagePath: "shirts/manto-3.png", name: "Manto 3" },
  { localPath: "/assets/background-mural.png", storagePath: "backgrounds/mural.png", name: "Background Mural dos Ídolos" },
  { localPath: "/assets/background-memorial.jpg", storagePath: "backgrounds/memorial.jpg", name: "Background Memorial" },
  { localPath: "/assets/background-idolos.jpg", storagePath: "backgrounds/idolos.jpg", name: "Background Ídolos" },
  { localPath: "/assets/background-trofeus.jpg", storagePath: "backgrounds/trofeus.jpg", name: "Background Troféus" },
];

type UploadStatus = "pending" | "uploading" | "success" | "error";

interface AssetStatus {
  status: UploadStatus;
  error?: string;
}

export default function UploadAssets() {
  const { toast } = useToast();
  const [statuses, setStatuses] = useState<Record<string, AssetStatus>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isUploading, setIsUploading] = useState(false);

  const toggleSelect = (storagePath: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(storagePath)) {
        next.delete(storagePath);
      } else {
        next.add(storagePath);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === ASSETS_TO_UPLOAD.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(ASSETS_TO_UPLOAD.map(a => a.storagePath)));
    }
  };

  const updateStatus = (path: string, status: AssetStatus) => {
    setStatuses(prev => ({ ...prev, [path]: status }));
  };

  const uploadAsset = async (localPath: string, storagePath: string) => {
    updateStatus(storagePath, { status: "uploading" });
    
    try {
      const response = await fetch(localPath);
      if (!response.ok) {
        throw new Error(`Failed to fetch ${localPath}: ${response.status}`);
      }
      
      const blob = await response.blob();
      const contentType = response.headers.get("content-type") || "application/octet-stream";
      
      const { error } = await supabase.storage
        .from("tryon-assets")
        .upload(storagePath, blob, {
          contentType,
          upsert: true,
        });
      
      if (error) throw error;
      
      updateStatus(storagePath, { status: "success" });
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      updateStatus(storagePath, { status: "error", error: message });
      return false;
    }
  };

  const handleUploadSelected = async () => {
    if (selected.size === 0) {
      toast({ title: "Selecione ao menos um asset para enviar.", variant: "destructive" });
      return;
    }

    setIsUploading(true);
    let successCount = 0;
    
    const assetsToUpload = ASSETS_TO_UPLOAD.filter(a => selected.has(a.storagePath));
    
    for (const asset of assetsToUpload) {
      const success = await uploadAsset(asset.localPath, asset.storagePath);
      if (success) successCount++;
    }
    
    setIsUploading(false);
    
    if (successCount === assetsToUpload.length) {
      toast({ title: `${successCount} asset(s) enviado(s) com sucesso!` });
    } else {
      toast({ title: `${successCount}/${assetsToUpload.length} assets enviados. Verifique os erros.`, variant: "destructive" });
    }
  };

  const getStatusIcon = (storagePath: string) => {
    const status = statuses[storagePath]?.status;
    switch (status) {
      case "uploading":
        return <Loader2 className="w-5 h-5 animate-spin text-primary" />;
      case "success":
        return <Check className="w-5 h-5 text-green-500" />;
      case "error":
        return <AlertCircle className="w-5 h-5 text-destructive" />;
      default:
        return null;
    }
  };

  const allSelected = selected.size === ASSETS_TO_UPLOAD.length;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold text-foreground">Upload de Assets</h1>
        <p className="text-muted-foreground">
          Selecione os assets que deseja enviar para o bucket <code className="bg-muted px-1 rounded">tryon-assets</code>.
        </p>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Assets disponíveis</CardTitle>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={toggleAll}
                  id="select-all"
                />
                <label htmlFor="select-all" className="text-sm text-muted-foreground cursor-pointer">
                  {allSelected ? "Desmarcar todos" : "Selecionar todos"}
                </label>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {ASSETS_TO_UPLOAD.map((asset) => (
              <div
                key={asset.storagePath}
                className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => !isUploading && toggleSelect(asset.storagePath)}
              >
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={selected.has(asset.storagePath)}
                    onCheckedChange={() => toggleSelect(asset.storagePath)}
                    disabled={isUploading}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div>
                    <p className="font-medium">{asset.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {asset.localPath} → {asset.storagePath}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {statuses[asset.storagePath]?.error && (
                    <span className="text-xs text-destructive max-w-[200px] truncate">
                      {statuses[asset.storagePath].error}
                    </span>
                  )}
                  {getStatusIcon(asset.storagePath)}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Button
          onClick={handleUploadSelected}
          disabled={isUploading || selected.size === 0}
          size="lg"
          className="w-full"
        >
          {isUploading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Enviando...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4 mr-2" />
              Enviar {selected.size > 0 ? `${selected.size} selecionado(s)` : "Assets"}
            </>
          )}
        </Button>

        <p className="text-sm text-muted-foreground text-center">
          Após o upload, abra o provador do time para testar a geração.
        </p>
      </div>
    </div>
  );
}
