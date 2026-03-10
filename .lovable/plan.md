

## Vistoria: Problemas encontrados no fluxo Admin Assets -> Provador

Identifiquei **3 problemas críticos** que impedem que as edições feitas no admin reflitam no provador:

---

### Problema 1: URLs de Storage apontam para projetos Supabase DIFERENTES

O arquivo `src/config/fanframe.ts` define as URLs dos assets apontando para **dois projetos Supabase diferentes**:
- `yxtglwbrdtwmxwrrhroy.supabase.co` (shirts e alguns backgrounds)
- `nosobqpiqhskkcfefbuw.supabase.co` (mural background)

Porém, o admin faz upload para o projeto **conectado ao app**: `qmjvsftlounkitclmzzw.supabase.co`.

Ou seja, o admin sobe a imagem num bucket, mas o provador carrega de outro. **Nada vai atualizar.**

**Correção**: Alterar `STORAGE_BASE` em `fanframe.ts` para usar a URL do projeto conectado (`qmjvsftlounkitclmzzw.supabase.co`), ou construir a URL dinamicamente a partir do `supabase` client.

### Problema 2: Imagens do Tutorial são imports locais (bundled)

O `TutorialScreen.tsx` importa as imagens antes/depois com `import`:
```typescript
import beforeExample from "@/assets/before-example.jpg";
import afterExample from "@/assets/after-example.png";
```

Essas imagens são embutidas no bundle do Vite. Mesmo que o admin faça upload para `tutorial/before.jpg` no Storage, o provador continuará mostrando as imagens originais.

**Correção**: Alterar `TutorialScreen.tsx` para carregar as imagens do Supabase Storage (com fallback para os imports locais caso ainda não existam no bucket).

### Problema 3: Cache do Storage

O upload usa `cacheControl: "3600"` (1 hora). Após substituir uma imagem, o usuário pode ver a versão antiga por até 1 hora. Devemos adicionar um cache-buster (`?t=timestamp`) nas URLs ou reduzir o cache time.

---

### Plano de correção

**Arquivos a modificar:**

1. **`src/config/fanframe.ts`** - Corrigir `STORAGE_BASE` para apontar ao projeto Supabase correto (`qmjvsftlounkitclmzzw.supabase.co`), unificando todas as URLs.

2. **`src/components/wizard/TutorialScreen.tsx`** - Substituir imports locais por URLs do Supabase Storage (com fallback para os imports locais).

3. **`src/pages/admin/Assets.tsx`** - Verificar que os `storagePath` dos cards correspondem exatamente aos paths usados nas URLs do provador.

