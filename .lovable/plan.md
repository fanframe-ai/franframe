

## Plano: Adicionar telas "Preview" e "Gerenciar Assets" no Admin Panel

### Resumo

Criar duas novas telas no painel admin:
1. **Preview** - Renderiza o fluxo completo do provador virtual como o usuário final vê (em um iframe ou componente embutido)
2. **Gerenciar Assets** - Tela para editar imagens do provador: antes/depois do tutorial, camisas disponíveis e cenários de fundo

---

### 1. Tela Preview (`/admin/preview`)

- Nova página `src/pages/admin/Preview.tsx`
- Usa `AdminLayout` como wrapper
- Renderiza o preview da URL principal (`/`) dentro de um iframe estilizado como tela de celular (mockup mobile)
- Botões para alternar tamanho do viewport (mobile/tablet/desktop)
- Botão para abrir em nova aba

### 2. Tela Gerenciar Assets (`/admin/assets`)

- Nova página `src/pages/admin/Assets.tsx`
- Seções organizadas em tabs:
  - **Antes/Depois** - Upload das imagens de exemplo do tutorial (before-example, after-example)
  - **Camisas** - Lista as 3 camisas com preview da imagem, nome e subtítulo; botão para fazer upload de nova imagem para cada uma (envia ao bucket `tryon-assets` no Supabase Storage)
  - **Cenários** - Lista os 4 backgrounds com preview; botão para upload de nova imagem para cada um
- Cada item mostra a imagem atual e permite substituir fazendo upload
- Os uploads vão para o bucket `tryon-assets` já existente no Storage
- Após upload, atualiza a URL no `system_settings` (nova chave `asset_overrides` com JSON das URLs customizadas)

### 3. Alterações em arquivos existentes

- **`AdminSidebar.tsx`** - Adicionar 2 novos itens de navegação: "Preview" (ícone `Eye`) e "Assets" (ícone `Image`)
- **`App.tsx`** - Adicionar 2 novas rotas protegidas: `/admin/preview` e `/admin/assets`

### Detalhes Técnicos

- As imagens das camisas e cenários já estão no Supabase Storage (`tryon-assets` bucket, público)
- O upload substituirá os arquivos existentes no mesmo path do bucket
- Para as imagens antes/depois do tutorial, serão armazenadas em `tryon-assets/tutorial/before.jpg` e `tryon-assets/tutorial/after.png`
- O componente `TutorialScreen` será atualizado para carregar as imagens do Storage ao invés de imports locais, permitindo que o admin as atualize sem rebuild
- As configurações de camisas e cenários (nomes, subtítulos) serão editáveis via `system_settings` com chave `shirts_config` e `backgrounds_config`

### Arquivos a criar
- `src/pages/admin/Preview.tsx`
- `src/pages/admin/Assets.tsx`

### Arquivos a modificar
- `src/components/admin/AdminSidebar.tsx` (2 novos nav items)
- `src/App.tsx` (2 novas rotas)

