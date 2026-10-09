import { useState } from 'react';
import { Eye, EyeOff, Plus, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

type Integration = {
  wordpress_api_base: string | null;
  wordpress_sites?: { api_base: string; purchase_urls?: Record<string, string> }[];
  replicate_api_token: string | null;
  generation_prompt: string | null;
  purchase_urls: Record<string, string>;
};

function CheckoutFields({ id, value, onChange }: { id: string; value: Record<string, string>; onChange: (next: Record<string, string>) => void }) {
  return <div className="space-y-4">
    {[1, 3, 7].map(credits => <div key={credits} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_160px]">
      <div className="min-w-0 space-y-2">
        <Label htmlFor={`${id}-checkout-${credits}`}>Checkout {credits} {credits === 1 ? 'crédito' : 'créditos'}</Label>
        <Input id={`${id}-checkout-${credits}`} type="url" value={value[`credits${credits}`] || ''}
          onChange={event => onChange({ ...value, [`credits${credits}`]: event.target.value })}
          placeholder="https://seu-site.com/checkout/?add-to-cart=..." />
      </div>
      <div className="min-w-0 space-y-2">
        <Label htmlFor={`${id}-price-${credits}`}>Preço de {credits} {credits === 1 ? 'crédito' : 'créditos'}</Label>
        <Input id={`${id}-price-${credits}`} value={value[`price${credits}`] || ''}
          onChange={event => onChange({ ...value, [`price${credits}`]: event.target.value })} placeholder="Preço opcional" />
      </div>
    </div>)}
  </div>;
}

export function TeamIntegrationFields({ value, onChange }: { value: Integration; onChange: <K extends keyof Integration>(field: K, next: Integration[K]) => void }) {
  const [showToken, setShowToken] = useState(false);
  const sites = value.wordpress_sites || [];
  const updateSite = (index: number, updates: Partial<(typeof sites)[number]>) => {
    onChange('wordpress_sites', sites.map((site, i) => i === index ? { ...site, ...updates } : site));
  };
  return <Card><CardContent className="pt-6 space-y-4">
    <fieldset className="min-w-0 space-y-4 border-b pb-6">
      <legend className="mb-4 text-base font-semibold">WordPress principal</legend>
      <div className="space-y-2">
      <Label htmlFor="wordpress-api-base">URL WordPress</Label>
      <Input id="wordpress-api-base" type="url" readOnly={Boolean(sites.length)} value={value.wordpress_api_base || ''}
        onChange={event => onChange('wordpress_api_base', event.target.value || null)}
        placeholder="https://seu-site.com/wp-json/vf-fanframe/v1" />
      </div>
      {value.wordpress_api_base && <CheckoutFields id="primary" value={value.purchase_urls} onChange={next => onChange('purchase_urls', next)} />}
    </fieldset>
    {sites.map((site, index) => <fieldset key={index} className="min-w-0 space-y-4 border-b pb-6">
      <legend className="mb-4 text-base font-semibold">WordPress adicional {index + 1}</legend>
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1 space-y-2">
          <Label htmlFor={`wordpress-site-${index}`}>URL WordPress</Label>
          <Input id={`wordpress-site-${index}`} type="url" value={site.api_base}
            onChange={event => updateSite(index, { api_base: event.target.value })}
            placeholder="https://outro-site.com/wp-json/vf-fanframe/v1" />
        </div>
        <Button type="button" variant="outline" size="icon" aria-label={`Remover WordPress adicional ${index + 1}`}
          title={`Remover WordPress adicional ${index + 1}`} onClick={() => onChange('wordpress_sites', sites.filter((_, i) => i !== index))}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <CheckoutFields id={`site-${index}`} value={site.purchase_urls || {}} onChange={next => updateSite(index, { purchase_urls: next })} />
    </fieldset>)}
    <Button type="button" variant="outline" disabled={sites.length >= 3 || !value.wordpress_api_base?.trim()}
      onClick={() => onChange('wordpress_sites', [...sites, { api_base: '', purchase_urls: {} }])}>
      <Plus className="mr-2 h-4 w-4" />Adicionar WordPress
    </Button>
    <div className="space-y-2">
      <Label>Token Replicate API</Label>
      <div className="flex gap-2">
        <Input type={showToken ? 'text' : 'password'} value={value.replicate_api_token || ''}
          onChange={event => onChange('replicate_api_token', event.target.value || null)}
          placeholder="r8_... (vazio = usa token global)" />
        <Button variant="outline" size="icon" onClick={() => setShowToken(!showToken)}>
          {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Se vazio, usa o token global do sistema</p>
    </div>
    <div className="space-y-2">
      <Label>Prompt de Geração</Label>
      <Textarea value={value.generation_prompt || ''}
        onChange={event => onChange('generation_prompt', event.target.value || null)}
        placeholder="Deixe vazio para usar o prompt padrão..." rows={4} />
      <p className="text-xs text-muted-foreground">Prompt customizado para a IA de troca de roupa</p>
    </div>
  </CardContent></Card>;
}
