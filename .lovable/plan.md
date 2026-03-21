

# Plano: Reformulacao do Admin — UX Amigavel para Criar Provadores

## Problema Atual
- A tela `/admin/teams` usa campos JSON brutos para camisas e cenarios — impossivel para nao-devs
- A tela `/admin/assets` e separada e hardcoded para Corinthians
- Configuracoes (prompt, token) estao em `/admin/settings` mas agora devem ser por time
- Sidebar tem itens redundantes (Assets separado de Teams)

## Visao Geral da Solucao

Unificar tudo em uma experiencia **wizard-like** dentro de `/admin/teams/:slug` com abas visuais, uploads de imagem via drag-and-drop (reutilizando o pattern do `AssetCard` que ja existe em Assets.tsx), e eliminando campos JSON.

```text
/admin/teams (lista)
  └── /admin/teams/novo (criar)
  └── /admin/teams/:slug (editar)
        ├── Tab: Informacoes Gerais (nome, slug, subdominio, ativo)
        ├── Tab: Integracao (WordPress URL, Replicate token, prompt)
        ├── Tab: Camisas (cards visuais com upload + nome + subtitulo + visibilidade)
        ├── Tab: Cenarios (cards visuais com upload + nome + subtitulo + visibilidade)
        ├── Tab: Tutorial (upload antes/depois)
        └── Tab: Branding (cores, logo upload, watermark upload)
```

## Mudancas Planejadas

### 1. Refatorar `/admin/teams` — Tela de Edicao de Time (arquivo principal)

**`src/pages/admin/Teams.tsx`** — reescrever completamente:

- **Lista de times**: manter como esta, esta OK
- **Formulario de edicao**: substituir as tabs "Assets" (JSON) por interface visual:
  - **Tab Camisas**: grid de `AssetCard` com botao "Adicionar Camisa". Cada card tem: upload de imagem, nome, subtitulo, descricao para o prompt, toggle visibilidade, botao remover. Dados salvos no JSONB `shirts` da tabela `teams` (com imageUrl apontando para Supabase Storage `tryon-assets/{team_slug}/shirts/{id}.png`)
  - **Tab Cenarios**: mesma abordagem, salva em `backgrounds`
  - **Tab Tutorial**: dois cards (antes/depois) com upload, salva em `tutorial_assets`
  - **Tab Branding**: color pickers, upload de logo e watermark
  - **Tab Integracao**: WordPress URL, token Replicate (campo password), prompt textarea, URLs de compra (campos simples key/value ao inves de JSON)

### 2. Extrair `AssetCard` como componente reutilizavel

**`src/components/admin/AssetCard.tsx`** — extrair o componente `AssetCard` de `Assets.tsx` para ser reutilizado tanto em Assets quanto em Teams. Adicionar props para:
- `onRemove` (botao de deletar)
- Upload que salva no storage path `{team_slug}/shirts/{id}.png`

### 3. Remover pagina `/admin/assets`

A pagina Assets se torna redundante — toda gestao de assets acontece dentro da edicao do time. Remover a rota e o item da sidebar.

### 4. Atualizar Sidebar

**`src/components/admin/AdminSidebar.tsx`**:
- Remover item "Assets" (agora esta dentro de Times)
- Mover "Configuracoes" para ser mais especifico (configuracoes globais vs por time)

### 5. Mover configuracoes por time

As configuracoes que hoje estao em `/admin/settings` (prompt, token Replicate) agora sao por time. Manter `/admin/settings` apenas para configuracoes **globais** do sistema. Prompt e token ficam na tab "Integracao" de cada time.

### 6. Adicionar rota `/admin/teams/:slug`

**`src/App.tsx`**: adicionar rota parametrizada para edicao individual de time.

### 7. UX para adicionar camisas/cenarios sem JSON

Interface com botao "+ Adicionar Camisa" que cria um card vazio onde o usuario:
1. Faz upload da imagem
2. Digita nome e subtitulo
3. Digita descricao para o prompt (texto simples explicando a camisa)
4. Toggle de visibilidade

O array JSONB e montado automaticamente pelo codigo ao salvar — o usuario nunca ve JSON.

## Detalhes Tecnicos

- **Storage paths**: `tryon-assets/{team_slug}/shirts/{shirt_id}.png`, `tryon-assets/{team_slug}/backgrounds/{bg_id}.png`, etc.
- **Geracao de IDs**: usar `slug` do time + counter ou input do usuario (ex: "manto-1")
- **Componentes reutilizados**: `AssetCard` (extraido), `Input`, `Switch`, `Tabs`, `Button`
- **Sem migracao de banco**: a tabela `teams` ja tem os campos JSONB necessarios
- **URLs de compra**: trocar JSON textarea por lista de inputs dinamicos (label + URL)

## Arquivos Afetados

| Arquivo | Acao |
|---|---|
| `src/pages/admin/Teams.tsx` | Reescrever formulario com UX visual |
| `src/components/admin/AssetCard.tsx` | Novo — componente extraido |
| `src/pages/admin/Assets.tsx` | Remover (redundante) |
| `src/components/admin/AdminSidebar.tsx` | Remover item Assets |
| `src/App.tsx` | Adicionar rota `/admin/teams/:slug`, remover rota `/admin/assets` |

