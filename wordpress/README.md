# Plugin WordPress

`vf-fanframe-1.0.1.zip` e o pacote corrigido entregue ao administrador do site
Sao Paulo. Inclui os fontes PHP, assets e `CORRECAO.md` com instrucoes.
Nao contem credenciais e nao e instalado pelo deploy Vercel ou Supabase.

As correcoes verificam gravacoes do codigo e da sessao, fazem rollback se
a troca falhar e completam a coluna `last_seen_at` durante a ativacao.
Erros de armazenamento deixam de ser apresentados como codigo invalido.
O fluxo de compra/debito nao foi alterado.

Antes de substituir o plugin no WordPress, faca backup do plugin e banco
externo. Depois de substituir, desative e reative para executar o instalador.
Nao apague tabelas nem saldos. Teste com um link novo gerado pelo tour.

## Teste isolado

Requer PHP 8.1+ com PDO SQLite. Usa armazenamento temporario e doubles da API
WordPress; nao acessa banco, saldo ou usuarios reais. O teste cobre criacao,
troca, validacao da sessao, expiracao, consumo unico, rollback, atualizacao
de schema, preservacao de saldo e erros REST. A sintaxe do pacote tambem foi
verificada em PHP 8.3 antes da entrega.

```sh
TEST_DIR="$(mktemp -d)"
unzip -q wordpress/vf-fanframe-1.0.1.zip -d "$TEST_DIR"
VF_FANFRAME_PLUGIN_DIR="$TEST_DIR/vf-fanframe" php wordpress/tests/handoff.php
```

Esses testes nao substituem a verificacao de configuracao EXT_DB_*, permissoes,
cache, instalacao em MySQL e login real no site pelo administrador.
