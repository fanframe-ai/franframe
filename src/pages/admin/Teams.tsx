import { useState, useEffect, useRef } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Upload, Loader2, Save, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface TeamRow {
  id: string;
  slug: string;
  name: string;
  subdomain: string;
  wordpress_api_base: string;
  purchase_urls: Record<string, string>;
  replicate_api_token: string | null;
  generation_prompt: string | null;
  shirts: any[];
  backgrounds: any[];
  tutorial_assets: { before: string; after: string };
  primary_color: string;
  secondary_color: string;
  logo_url: string | null;
  watermark_url: string | null;
  is_active: boolean;
  created_at: string;
}

const emptyTeam: Omit<TeamRow, "id" | "created_at"> = {
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

function TeamForm({
  team,
  onSave,
  onCancel,
}: {
  team: Partial<TeamRow> & typeof emptyTeam;
  onSave: (data: typeof emptyTeam) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState(team);
  const [saving, setSaving] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    if (!form.slug || !form.name || !form.subdomain || !form.wordpress_api_base) {
      toast({ title: "Preencha os campos obrigatórios", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await onSave(form as typeof emptyTeam);
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: string, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="general">
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="general">Geral</TabsTrigger>
          <TabsTrigger value="integration">Integração</TabsTrigger>
          <TabsTrigger value="assets">Assets</TabsTrigger>
          <TabsTrigger value="branding">Branding</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nome do Time *</Label>
              <Input value={form.name} onChange={(e) => updateField("name", e.target.value)} placeholder="São Paulo FC" />
            </div>
            <div className="space-y-2">
              <Label>Slug *</Label>
              <Input value={form.slug} onChange={(e) => updateField("slug", e.target.value.toLowerCase().replace(/\s/g, "-"))} placeholder="saopaulo" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Subdomínio *</Label>
              <Input value={form.subdomain} onChange={(e) => updateField("subdomain", e.target.value)} placeholder="ffsaopaulo" />
              <p className="text-xs text-muted-foreground">{form.subdomain || "ff..."}.lovable.app</p>
            </div>
            <div className="flex items-center gap-3 pt-6">
              <Switch checked={form.is_active} onCheckedChange={(v) => updateField("is_active", v)} />
              <Label>Time ativo</Label>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="integration" className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label>WordPress API Base *</Label>
            <Input value={form.wordpress_api_base} onChange={(e) => updateField("wordpress_api_base", e.target.value)} placeholder="https://example.com/wp-json/vf-fanframe/v1" />
          </div>
          <div className="space-y-2">
            <Label>Token Replicate API</Label>
            <div className="flex gap-2">
              <Input
                type={showToken ? "text" : "password"}
                value={form.replicate_api_token || ""}
                onChange={(e) => updateField("replicate_api_token", e.target.value || null)}
                placeholder="r8_... (deixe vazio para usar o token global)"
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
              placeholder="Deixe vazio para usar o prompt padrão do sistema..."
              rows={4}
            />
          </div>
          <div className="space-y-2">
            <Label>URLs de Compra (JSON)</Label>
            <Textarea
              value={JSON.stringify(form.purchase_urls, null, 2)}
              onChange={(e) => {
                try {
                  updateField("purchase_urls", JSON.parse(e.target.value));
                } catch {}
              }}
              rows={4}
              className="font-mono text-xs"
            />
          </div>
        </TabsContent>

        <TabsContent value="assets" className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label>Camisas (JSON)</Label>
            <Textarea
              value={JSON.stringify(form.shirts, null, 2)}
              onChange={(e) => {
                try {
                  updateField("shirts", JSON.parse(e.target.value));
                } catch {}
              }}
              rows={8}
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">Array de objetos com: id, name, subtitle, imageUrl, assetPath, promptDescription</p>
          </div>
          <div className="space-y-2">
            <Label>Cenários (JSON)</Label>
            <Textarea
              value={JSON.stringify(form.backgrounds, null, 2)}
              onChange={(e) => {
                try {
                  updateField("backgrounds", JSON.parse(e.target.value));
                } catch {}
              }}
              rows={8}
              className="font-mono text-xs"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tutorial - Imagem Antes</Label>
              <Input
                value={form.tutorial_assets?.before || ""}
                onChange={(e) => updateField("tutorial_assets", { ...form.tutorial_assets, before: e.target.value })}
                placeholder="URL da imagem antes"
              />
            </div>
            <div className="space-y-2">
              <Label>Tutorial - Imagem Depois</Label>
              <Input
                value={form.tutorial_assets?.after || ""}
                onChange={(e) => updateField("tutorial_assets", { ...form.tutorial_assets, after: e.target.value })}
                placeholder="URL da imagem depois"
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="branding" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Cor Primária</Label>
              <div className="flex gap-2">
                <Input type="color" value={form.primary_color} onChange={(e) => updateField("primary_color", e.target.value)} className="w-12 h-10 p-1" />
                <Input value={form.primary_color} onChange={(e) => updateField("primary_color", e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Cor Secundária</Label>
              <div className="flex gap-2">
                <Input type="color" value={form.secondary_color} onChange={(e) => updateField("secondary_color", e.target.value)} className="w-12 h-10 p-1" />
                <Input value={form.secondary_color} onChange={(e) => updateField("secondary_color", e.target.value)} />
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Logo URL</Label>
            <Input value={form.logo_url || ""} onChange={(e) => updateField("logo_url", e.target.value || null)} placeholder="URL do logo do time" />
          </div>
          <div className="space-y-2">
            <Label>Watermark URL</Label>
            <Input value={form.watermark_url || ""} onChange={(e) => updateField("watermark_url", e.target.value || null)} placeholder="/watermark.webp ou URL externa" />
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex gap-3 justify-end pt-4 border-t">
        <Button variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Salvar Time
        </Button>
      </div>
    </div>
  );
}

export default function AdminTeams() {
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTeam, setEditingTeam] = useState<TeamRow | null>(null);
  const [creating, setCreating] = useState(false);
  const { toast } = useToast();

  const fetchTeams = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("teams")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) {
      toast({ title: "Erro ao carregar times", description: error.message, variant: "destructive" });
    } else {
      setTeams((data as unknown as TeamRow[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTeams();
  }, []);

  const handleCreate = async (data: typeof emptyTeam) => {
    const { error } = await supabase.from("teams").insert(data as any);
    if (error) {
      toast({ title: "Erro ao criar time", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Time criado com sucesso!" });
    setCreating(false);
    fetchTeams();
  };

  const handleUpdate = async (data: typeof emptyTeam) => {
    if (!editingTeam) return;
    const { error } = await supabase.from("teams").update(data as any).eq("id", editingTeam.id);
    if (error) {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Time atualizado!" });
    setEditingTeam(null);
    fetchTeams();
  };

  const handleDelete = async (team: TeamRow) => {
    if (!confirm(`Desativar o time "${team.name}"? Os dados serão preservados.`)) return;
    const { error } = await supabase.from("teams").update({ is_active: false } as any).eq("id", team.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Time desativado" });
    fetchTeams();
  };

  if (creating) {
    return (
      <AdminLayout>
        <div className="max-w-3xl">
          <h1 className="text-2xl font-bold mb-6">Criar Novo Time</h1>
          <TeamForm team={emptyTeam} onSave={handleCreate} onCancel={() => setCreating(false)} />
        </div>
      </AdminLayout>
    );
  }

  if (editingTeam) {
    return (
      <AdminLayout>
        <div className="max-w-3xl">
          <h1 className="text-2xl font-bold mb-6">Editar: {editingTeam.name}</h1>
          <TeamForm team={editingTeam} onSave={handleUpdate} onCancel={() => setEditingTeam(null)} />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="max-w-5xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Gerenciar Times</h1>
            <p className="text-sm text-muted-foreground">Configure os times do sistema multi-tenant</p>
          </div>
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Time
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : teams.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Nenhum time cadastrado.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {teams.map((team) => (
              <Card key={team.id} className={!team.is_active ? "opacity-50" : ""}>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-4">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                      style={{ backgroundColor: team.primary_color }}
                    >
                      {team.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-semibold">{team.name}</h3>
                      <p className="text-xs text-muted-foreground">
                        {team.subdomain}.lovable.app · {team.shirts?.length || 0} camisas · {team.backgrounds?.length || 0} cenários
                        {!team.is_active && " · Inativo"}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setEditingTeam(team)}>
                      <Pencil className="h-4 w-4 mr-1" /> Editar
                    </Button>
                    {team.is_active && (
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDelete(team)}>
                        <EyeOff className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
