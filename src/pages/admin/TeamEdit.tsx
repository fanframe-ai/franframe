import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AssetCard } from "@/components/admin/AssetCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Save, ArrowLeft, Plus, Eye, EyeOff, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const STORAGE_BASE = "https://qmjvsftlounkitclmzzw.supabase.co/storage/v1/object/public/tryon-assets";

interface ShirtItem {
  id: string;
  name: string;
  subtitle: string;
  imageUrl: string;
  assetPath: string;
  promptDescription: string;
  visible: boolean;
}

interface BackgroundItem {
  id: string;
  name: string;
  subtitle: string;
  imageUrl: string;
  assetPath: string;
  visible: boolean;
}

interface PurchaseUrlEntry {
  label: string;
  url: string;
}

interface TeamData {
  id?: string;
  slug: string;
  name: string;
  subdomain: string;
  wordpress_api_base: string;
  purchase_urls: Record<string, string>;
  replicate_api_token: string | null;
  generation_prompt: string | null;
  shirts: ShirtItem[];
  backgrounds: BackgroundItem[];
  tutorial_assets: { before: string; after: string };
  primary_color: string;
  secondary_color: string;
  logo_url: string | null;
  watermark_url: string | null;
  is_active: boolean;
  text_overrides: Record<string, string>;
}

const emptyTeam: TeamData = {
  slug: "",
  name: "",
  subdomain: "",
  wordpress_api_base: "",
  purchase_urls: {},
  replicate_api_token: null,
  generation_prompt: null,
  shirts: [],
  backgrounds: [],
  tutorial_assets: { before: "", after: "" },
  primary_color: "#000000",
  secondary_color: "#FFFFFF",
  logo_url: null,
  watermark_url: null,
  is_active: true,
};

export default function TeamEdit() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isNew = slug === "novo";

  const [form, setForm] = useState<TeamData>(emptyTeam);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [purchaseUrls, setPurchaseUrls] = useState<PurchaseUrlEntry[]>([]);

  useEffect(() => {
    if (!isNew && slug) {
      loadTeam(slug);
    }
  }, [slug]);

  const loadTeam = async (teamSlug: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from("teams")
      .select("*")
      .eq("slug", teamSlug)
      .maybeSingle();

    if (error || !data) {
      toast({ title: "Time não encontrado", variant: "destructive" });
      navigate("/admin/teams");
      return;
    }

    const teamData: TeamData = {
      id: data.id,
      slug: data.slug,
      name: data.name,
      subdomain: data.subdomain,
      wordpress_api_base: data.wordpress_api_base,
      purchase_urls: (data.purchase_urls as Record<string, string>) || {},
      replicate_api_token: data.replicate_api_token,
      generation_prompt: data.generation_prompt,
      shirts: (data.shirts as unknown as ShirtItem[]) || [],
      backgrounds: (data.backgrounds as unknown as BackgroundItem[]) || [],
      tutorial_assets: (data.tutorial_assets as { before: string; after: string }) || { before: "", after: "" },
      primary_color: data.primary_color || "#000000",
      secondary_color: data.secondary_color || "#FFFFFF",
      logo_url: data.logo_url,
      watermark_url: data.watermark_url,
      is_active: data.is_active ?? true,
    };

    setForm(teamData);
    setPurchaseUrls(
      Object.entries(teamData.purchase_urls).map(([label, url]) => ({ label, url }))
    );
    setLoading(false);
  };

  const updateField = (field: keyof TeamData, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  // --- Shirts ---
  const addShirt = () => {
    const id = `camisa-${Date.now()}`;
    const newShirt: ShirtItem = {
      id,
      name: "",
      subtitle: "",
      imageUrl: "",
      assetPath: "",
      promptDescription: "",
      visible: true,
    };
    updateField("shirts", [...form.shirts, newShirt]);
  };

  const updateShirt = (index: number, updates: Partial<ShirtItem>) => {
    const shirts = [...form.shirts];
    shirts[index] = { ...shirts[index], ...updates };
    updateField("shirts", shirts);
  };

  const removeShirt = (index: number) => {
    updateField("shirts", form.shirts.filter((_, i) => i !== index));
  };

  // --- Backgrounds ---
  const addBackground = () => {
    const id = `cenario-${Date.now()}`;
    const newBg: BackgroundItem = {
      id,
      name: "",
      subtitle: "",
      imageUrl: "",
      assetPath: "",
      visible: true,
    };
    updateField("backgrounds", [...form.backgrounds, newBg]);
  };

  const updateBackground = (index: number, updates: Partial<BackgroundItem>) => {
    const bgs = [...form.backgrounds];
    bgs[index] = { ...bgs[index], ...updates };
    updateField("backgrounds", bgs);
  };

  const removeBackground = (index: number) => {
    updateField("backgrounds", form.backgrounds.filter((_, i) => i !== index));
  };

  // --- Purchase URLs ---
  const addPurchaseUrl = () => {
    setPurchaseUrls([...purchaseUrls, { label: "", url: "" }]);
  };

  const updatePurchaseUrl = (index: number, field: "label" | "url", value: string) => {
    const urls = [...purchaseUrls];
    urls[index][field] = value;
    setPurchaseUrls(urls);
  };

  const removePurchaseUrl = (index: number) => {
    setPurchaseUrls(purchaseUrls.filter((_, i) => i !== index));
  };

  // --- Save ---
  const handleSave = async () => {
    if (!form.slug || !form.name || !form.subdomain || !form.wordpress_api_base) {
      toast({ title: "Preencha os campos obrigatórios", variant: "destructive" });
      return;
    }

    setSaving(true);

    const purchaseUrlsObj: Record<string, string> = {};
    purchaseUrls.forEach((p) => {
      if (p.label && p.url) purchaseUrlsObj[p.label] = p.url;
    });

    const payload = {
      slug: form.slug,
      name: form.name,
      subdomain: form.subdomain,
      wordpress_api_base: form.wordpress_api_base,
      purchase_urls: purchaseUrlsObj,
      replicate_api_token: form.replicate_api_token || null,
      generation_prompt: form.generation_prompt || null,
      shirts: form.shirts as any,
      backgrounds: form.backgrounds as any,
      tutorial_assets: form.tutorial_assets as any,
      primary_color: form.primary_color,
      secondary_color: form.secondary_color,
      logo_url: form.logo_url || null,
      watermark_url: form.watermark_url || null,
      is_active: form.is_active,
    };

    try {
      if (isNew) {
        const { error } = await supabase.from("teams").insert(payload as any);
        if (error) throw error;
        toast({ title: "Time criado com sucesso!" });
        navigate("/admin/teams");
      } else {
        const { error } = await supabase.from("teams").update(payload as any).eq("id", form.id!);
        if (error) throw error;
        toast({ title: "Time atualizado!" });
      }
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="max-w-5xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/teams")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">
              {isNew ? "Criar Novo Provador" : `Editar: ${form.name}`}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isNew ? "Configure todos os detalhes do novo time" : `fanframe.lovable.app/${form.slug}`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={(v) => updateField("is_active", v)} />
              <span className="text-sm text-muted-foreground">{form.is_active ? "Ativo" : "Inativo"}</span>
            </div>
            {!isNew && form.slug && (
              <Button variant="outline" asChild>
                <a href={`${window.location.origin}/${form.slug}?preview=admin`} target="_blank" rel="noopener noreferrer">
                  <Eye className="h-4 w-4 mr-2" />
                  Preview
                </a>
              </Button>
            )}
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Salvar
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="general" className="space-y-6">
          <TabsList className="grid grid-cols-6 w-full">
            <TabsTrigger value="general">Geral</TabsTrigger>
            <TabsTrigger value="integration">Integração</TabsTrigger>
            <TabsTrigger value="shirts">Camisas</TabsTrigger>
            <TabsTrigger value="backgrounds">Cenários</TabsTrigger>
            <TabsTrigger value="tutorial">Tutorial</TabsTrigger>
            <TabsTrigger value="branding">Branding</TabsTrigger>
          </TabsList>

          {/* === GERAL === */}
          <TabsContent value="general">
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nome do Time *</Label>
                    <Input value={form.name} onChange={(e) => updateField("name", e.target.value)} placeholder="São Paulo FC" />
                  </div>
                  <div className="space-y-2">
                    <Label>Slug *</Label>
                    <Input
                      value={form.slug}
                      onChange={(e) => updateField("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                      placeholder="saopaulo"
                      disabled={!isNew}
                    />
                    <p className="text-xs text-muted-foreground">Identificador único (não pode ser alterado depois)</p>
                  </div>
                </div>
                {form.slug && (
                  <div className="space-y-2">
                    <Label>URL do Provador</Label>
                    <div className="flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-2">
                      <span className="text-sm text-muted-foreground">fanframe.lovable.app/</span>
                      <span className="text-sm font-medium">{form.slug}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">URL pública onde o provador será acessado</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* === INTEGRAÇÃO === */}
          <TabsContent value="integration">
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="space-y-2">
                  <Label>URL da API WordPress *</Label>
                  <Input
                    value={form.wordpress_api_base}
                    onChange={(e) => updateField("wordpress_api_base", e.target.value)}
                    placeholder="https://example.com/wp-json/vf-fanframe/v1"
                  />
                  <p className="text-xs text-muted-foreground">Endpoint base da API FanFrame no WordPress do time</p>
                </div>

                <div className="space-y-2">
                  <Label>Token Replicate API</Label>
                  <div className="flex gap-2">
                    <Input
                      type={showToken ? "text" : "password"}
                      value={form.replicate_api_token || ""}
                      onChange={(e) => updateField("replicate_api_token", e.target.value || null)}
                      placeholder="r8_... (vazio = usa token global)"
                    />
                    <Button variant="outline" size="icon" onClick={() => setShowToken(!showToken)}>
                      {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Se vazio, usa o token global do sistema</p>
                </div>

                <div className="space-y-2">
                  <Label>Prompt de Geração</Label>
                  <Textarea
                    value={form.generation_prompt || ""}
                    onChange={(e) => updateField("generation_prompt", e.target.value || null)}
                    placeholder="Deixe vazio para usar o prompt padrão..."
                    rows={4}
                  />
                  <p className="text-xs text-muted-foreground">Prompt customizado para a IA de troca de roupa</p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>URLs de Compra de Créditos</Label>
                    <Button size="sm" variant="outline" onClick={addPurchaseUrl}>
                      <Plus className="h-4 w-4 mr-1" /> Adicionar
                    </Button>
                  </div>
                  {purchaseUrls.length === 0 && (
                    <p className="text-sm text-muted-foreground py-2">Nenhuma URL de compra configurada</p>
                  )}
                  {purchaseUrls.map((entry, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <Input
                        value={entry.label}
                        onChange={(e) => updatePurchaseUrl(i, "label", e.target.value)}
                        placeholder="Nome do pacote (ex: 5 créditos)"
                        className="flex-1"
                      />
                      <Input
                        value={entry.url}
                        onChange={(e) => updatePurchaseUrl(i, "url", e.target.value)}
                        placeholder="https://loja.com/pacote"
                        className="flex-1"
                      />
                      <Button size="icon" variant="ghost" className="text-destructive shrink-0" onClick={() => removePurchaseUrl(i)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* === CAMISAS === */}
          <TabsContent value="shirts">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Camisas do Time</h2>
                  <p className="text-sm text-muted-foreground">{form.shirts.length} camisa(s) cadastrada(s)</p>
                </div>
                <Button onClick={addShirt}>
                  <Plus className="h-4 w-4 mr-2" /> Adicionar Camisa
                </Button>
              </div>

              {form.shirts.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    Nenhuma camisa cadastrada. Clique em "Adicionar Camisa" para começar.
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {form.shirts.map((shirt, index) => (
                    <AssetCard
                      key={shirt.id}
                      label={shirt.name}
                      subtitle={shirt.subtitle}
                      promptDescription={shirt.promptDescription}
                      currentUrl={shirt.imageUrl || "/placeholder.svg"}
                      storagePath={`${form.slug}/shirts/${shirt.id}.png`}
                      aspectRatio="1/1"
                      editable
                      visible={shirt.visible !== false}
                      onTextChange={(name, subtitle, promptDesc) =>
                        updateShirt(index, { name, subtitle, promptDescription: promptDesc })
                      }
                      onVisibilityChange={(v) => updateShirt(index, { visible: v })}
                      onRemove={() => removeShirt(index)}
                      onImageUploaded={(url) =>
                        updateShirt(index, { imageUrl: url, assetPath: url })
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* === CENÁRIOS === */}
          <TabsContent value="backgrounds">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Cenários</h2>
                  <p className="text-sm text-muted-foreground">{form.backgrounds.length} cenário(s) cadastrado(s)</p>
                </div>
                <Button onClick={addBackground}>
                  <Plus className="h-4 w-4 mr-2" /> Adicionar Cenário
                </Button>
              </div>

              {form.backgrounds.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    Nenhum cenário cadastrado. Clique em "Adicionar Cenário" para começar.
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {form.backgrounds.map((bg, index) => (
                    <AssetCard
                      key={bg.id}
                      label={bg.name}
                      subtitle={bg.subtitle}
                      currentUrl={bg.imageUrl || "/placeholder.svg"}
                      storagePath={`${form.slug}/backgrounds/${bg.id}.png`}
                      aspectRatio="16/9"
                      editable
                      visible={bg.visible !== false}
                      onTextChange={(name, subtitle) =>
                        updateBackground(index, { name, subtitle })
                      }
                      onVisibilityChange={(v) => updateBackground(index, { visible: v })}
                      onRemove={() => removeBackground(index)}
                      onImageUploaded={(url) =>
                        updateBackground(index, { imageUrl: url, assetPath: url })
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* === TUTORIAL === */}
          <TabsContent value="tutorial">
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold">Imagens do Tutorial</h2>
                <p className="text-sm text-muted-foreground">Antes e depois exibidos no tutorial do provador</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <AssetCard
                  label="Imagem Antes"
                  subtitle="Foto de exemplo sem a camisa"
                  currentUrl={form.tutorial_assets?.before || "/placeholder.svg"}
                  storagePath={`${form.slug}/tutorial/before.jpg`}
                  aspectRatio="3/4"
                  onImageUploaded={(url) =>
                    updateField("tutorial_assets", { ...form.tutorial_assets, before: url })
                  }
                />
                <AssetCard
                  label="Imagem Depois"
                  subtitle="Foto de exemplo com a camisa"
                  currentUrl={form.tutorial_assets?.after || "/placeholder.svg"}
                  storagePath={`${form.slug}/tutorial/after.png`}
                  aspectRatio="3/4"
                  onImageUploaded={(url) =>
                    updateField("tutorial_assets", { ...form.tutorial_assets, after: url })
                  }
                />
              </div>
            </div>
          </TabsContent>

          {/* === BRANDING === */}
          <TabsContent value="branding">
            <Card>
              <CardContent className="pt-6 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Cor Primária</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={form.primary_color}
                        onChange={(e) => updateField("primary_color", e.target.value)}
                        className="w-12 h-10 p-1 cursor-pointer"
                      />
                      <Input value={form.primary_color} onChange={(e) => updateField("primary_color", e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Cor Secundária</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={form.secondary_color}
                        onChange={(e) => updateField("secondary_color", e.target.value)}
                        className="w-12 h-10 p-1 cursor-pointer"
                      />
                      <Input value={form.secondary_color} onChange={(e) => updateField("secondary_color", e.target.value)} />
                    </div>
                  </div>
                </div>

                {/* Color preview */}
                <div className="flex gap-4">
                  <div
                    className="rounded-lg h-20 flex-1 flex items-center justify-center text-white font-bold text-lg shadow-sm"
                    style={{ backgroundColor: form.primary_color, color: form.secondary_color }}
                  >
                    {form.name || "Nome do Time"}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-4">
                    <Label>Logo do Time</Label>
                    <AssetCard
                      label="Logo"
                      subtitle="Exibido no topo do provador"
                      currentUrl={form.logo_url || "/placeholder.svg"}
                      storagePath={`${form.slug}/branding/logo.png`}
                      aspectRatio="1/1"
                      onImageUploaded={(url) => updateField("logo_url", url)}
                    />
                  </div>
                  <div className="space-y-4">
                    <Label>Marca d'água</Label>
                    <AssetCard
                      label="Watermark"
                      subtitle="Aplicada nas imagens geradas"
                      currentUrl={form.watermark_url || "/placeholder.svg"}
                      storagePath={`${form.slug}/branding/watermark.webp`}
                      aspectRatio="1/1"
                      onImageUploaded={(url) => updateField("watermark_url", url)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
