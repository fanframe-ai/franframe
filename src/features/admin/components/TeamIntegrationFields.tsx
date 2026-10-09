import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
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

export function TeamIntegrationFields({ value, onChange }: { value: Integration; onChange: <K extends keyof Integration>(field: K, next: Integration[K]) => void }) {
  const [showToken, setShowToken] = useState(false);
  return <Card><CardContent className="pt-6 space-y-4">
    <div className="space-y-2">
      <Label htmlFor="wordpress-api-base">API WordPress / FanFrame</Label>
      <Input id="wordpress-api-base" type="url" readOnly={Boolean(value.wordpress_sites?.length)} value={value.wordpress_api_base || ''}
        onChange={event => onChange('wordpress_api_base', event.target.value || null)}
        placeholder="https://seu-site.com/wp-json/vf-fanframe/v1" />
    </div>
    {value.wordpress_sites?.map((site,index) => <div key={site.api_base} className="space-y-2">
      <Label htmlFor={`wordpress-site-${index}`}>WordPress adicional {index+1}</Label>
      <Input id={`wordpress-site-${index}`} value={site.api_base} readOnly />
    </div>)}
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
    {[1, 3, 7].map(credits => <div key={credits} className="space-y-2">
      <Label htmlFor={`checkout-${credits}`}>Checkout {credits} crédito(s)</Label>
      <Input id={`checkout-${credits}`} type="url" value={value.purchase_urls[`credits${credits}`] || ''}
        onChange={event => onChange('purchase_urls', { ...value.purchase_urls, [`credits${credits}`]: event.target.value })}
        placeholder="https://seu-site.com/checkout" />
      <Input aria-label={`Preço de ${credits} crédito(s)`} value={value.purchase_urls[`price${credits}`] || ''}
        onChange={event => onChange('purchase_urls', { ...value.purchase_urls, [`price${credits}`]: event.target.value })}
        placeholder="Preço exibido (opcional)" />
    </div>)}
    <div className="space-y-2">
      <Label>Prompt de Geração</Label>
      <Textarea value={value.generation_prompt || ''}
        onChange={event => onChange('generation_prompt', event.target.value || null)}
        placeholder="Deixe vazio para usar o prompt padrão..." rows={4} />
      <p className="text-xs text-muted-foreground">Prompt customizado para a IA de troca de roupa</p>
    </div>
  </CardContent></Card>;
}
