import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AssetCard } from './AssetCard';
import type { ShirtItem, BackgroundItem } from '../team-types';

export function TeamShirtFields({ slug, shirts, onAdd, onChange, onRemove }: {
  slug: string; shirts: ShirtItem[]; onAdd: () => void;
  onChange: (index: number, updates: Partial<ShirtItem>) => void; onRemove: (index: number) => void;
}) {
  return <div className="space-y-4">
    <div className="flex items-center justify-between">
      <div><h2 className="text-lg font-semibold">Camisas do Time</h2><p className="text-sm text-muted-foreground">{shirts.length} camisa(s) cadastrada(s)</p></div>
      <Button onClick={onAdd}><Plus className="h-4 w-4 mr-2" /> Adicionar Camisa</Button>
    </div>
    {shirts.length === 0 ? <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhuma camisa cadastrada. Clique em "Adicionar Camisa" para começar.</CardContent></Card> :
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {shirts.map((shirt, index) => <AssetCard key={shirt.id} label={shirt.name} subtitle={shirt.subtitle}
          promptDescription={shirt.promptDescription} currentUrl={shirt.imageUrl || '/placeholder.svg'}
          storagePath={`${slug}/shirts/${shirt.id}.png`} aspectRatio="1/1" editable visible={shirt.visible !== false}
          onTextChange={(name, subtitle, promptDescription) => onChange(index, { name, subtitle, promptDescription })}
          onVisibilityChange={visible => onChange(index, { visible })} onRemove={() => onRemove(index)}
          onImageUploaded={url => onChange(index, { imageUrl: url, assetPath: url })} />)}
      </div>}
  </div>;
}

export function TeamBackgroundFields({ slug, backgrounds, onAdd, onChange, onRemove }: {
  slug: string; backgrounds: BackgroundItem[]; onAdd: () => void;
  onChange: (index: number, updates: Partial<BackgroundItem>) => void; onRemove: (index: number) => void;
}) {
  return <div className="space-y-4">
    <div className="flex items-center justify-between">
      <div><h2 className="text-lg font-semibold">Cenários</h2><p className="text-sm text-muted-foreground">{backgrounds.length} cenário(s) cadastrado(s)</p></div>
      <Button onClick={onAdd}><Plus className="h-4 w-4 mr-2" /> Adicionar Cenário</Button>
    </div>
    {backgrounds.length === 0 ? <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhum cenário cadastrado. Clique em "Adicionar Cenário" para começar.</CardContent></Card> :
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {backgrounds.map((background, index) => <AssetCard key={background.id} label={background.name} subtitle={background.subtitle}
          currentUrl={background.imageUrl || '/placeholder.svg'} storagePath={`${slug}/backgrounds/${background.id}.png`}
          aspectRatio="16/9" editable visible={background.visible !== false}
          onTextChange={(name, subtitle) => onChange(index, { name, subtitle })}
          onVisibilityChange={visible => onChange(index, { visible })} onRemove={() => onRemove(index)}
          onImageUploaded={url => onChange(index, { imageUrl: url, assetPath: url })} />)}
      </div>}
  </div>;
}
