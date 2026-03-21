

# Plano: Transformar Admin Panel em FanFrame Management System

## Problema
O admin ainda parece o painel do Corinthians: sidebar diz "Provador Tricolor", Settings tem prompt hardcoded do Corinthians, SystemStatus aponta para outro projeto Supabase (`yxtglwbrdtwmxwrrhroy`), Generations/Stats/Dashboard nao filtram por time, e Preview nao permite escolher qual time visualizar.

## Visao da Solucao

Rebranding completo para **"FanFrame"** e reorganizacao da navegacao em 3 blocos:

```text
SIDEBAR "FanFrame"
├── Dashboard (visao global com seletor de time)
├── Provadores (lista + editor de times - ja existe)
├── Geracoes (com filtro por time)
├── Estatisticas (com filtro por time)
├── Status do Sistema (apontando pro projeto correto)
├── Alertas (com filtro por time)
└── Configuracoes (apenas config global do sistema)
```

## Mudancas

### 1. Rebranding Sidebar
- **`AdminSidebar.tsx`**: Trocar "Admin Panel" / "Provador Tricolor" por "FanFrame" com icone/logo proprio
- Remover "Preview" da sidebar (mover para dentro do editor de cada time)

### 2. Dashboard com seletor de time
- **`Dashboard.tsx`**: Adicionar dropdown de seletor de time (todos / time especifico)
- **`useAdminStats.ts`**: Aceitar `teamId` opcional para filtrar queries por `team_id`
- Cards e graficos filtram pelo time selecionado

### 3. Geracoes com filtro por time
- **`Generations.tsx`**: Adicionar dropdown de time junto aos filtros existentes
- Query filtra por `team_id` quando selecionado

### 4. Estatisticas com filtro por time
- **`Stats.tsx`**: Mesmo padrao — dropdown de time + queries filtradas

### 5. Alertas com filtro por time
- **`Alerts.tsx`**: Adicionar filtro por time

### 6. Corrigir SystemStatus
- **`SystemStatus.tsx`**: Trocar URLs hardcoded do projeto antigo (`yxtglwbrdtwmxwrrhroy`) pelo projeto atual (`qmjvsftlounkitclmzzw`)

### 7. Simplificar Settings
- **`Settings.tsx`**: Remover prompt e token Replicate (agora sao por time no TeamEdit). Manter apenas configuracoes globais do sistema (ou transformar em pagina de informacoes do sistema tipo versao, projeto Supabase, etc.)

### 8. Preview dentro do time
- Mover funcionalidade de Preview para dentro do `TeamEdit.tsx` como uma aba ou botao que abre o provador do time selecionado em nova aba
- Remover rota `/admin/preview`

## Componente reutilizavel: TeamSelector
Criar um componente `<TeamSelector />` (dropdown com todos os times + opcao "Todos") que sera usado em Dashboard, Geracoes, Stats e Alertas.

## Arquivos afetados

| Arquivo | Acao |
|---|---|
| `AdminSidebar.tsx` | Rebrand para FanFrame, remover Preview |
| `Dashboard.tsx` | Adicionar TeamSelector, filtrar dados |
| `useAdminStats.ts` | Aceitar teamId, filtrar queries |
| `Generations.tsx` | Adicionar TeamSelector |
| `Stats.tsx` | Adicionar TeamSelector |
| `Alerts.tsx` | Adicionar TeamSelector |
| `SystemStatus.tsx` | Corrigir URLs do projeto Supabase |
| `Settings.tsx` | Remover config por time, simplificar |
| `TeamEdit.tsx` | Adicionar botao "Preview" que abre o provador |
| `Preview.tsx` | Remover arquivo |
| `App.tsx` | Remover rota `/admin/preview` |
| Novo: `TeamSelector.tsx` | Componente dropdown de selecao de time |

