# Operacao do lancamento

Implementacao do [plano preservado](plans/launch-scale-2026-10-10.md). Teto aprovado pelo usuario: US$ 300 para o evento e US$ 300 por dia. A margem de 10% limita a exposicao estimada a US$ 270 (3.000 saidas 2K de US$ 0,09, incluindo reservas, falhas pagas e canarios). O limite do evento nao reinicia a meia-noite. Creditos dos visitantes nao sao saldo Replicate. Hospedagem, cambio, impostos, transferencia e usos externos dessa conta nao entram nesse teto.

## Configuracao

Aplicar a nova migracao com admissao e despacho pausados, depois publicar as sete funcoes versionadas. Nao reaplicar migracoes antigas divergentes. Regenerar tipos a partir do replay SQL ou banco remoto. O gerador oficial postgres-meta pode ser executado sem Docker com `FANFRAME_GENERATE_TYPES=1 FANFRAME_TYPEGEN_PATH=<postgres-meta/dist/server/server.js> npm run test:db`; a instalacao desse gerador fica fora do repositorio.

O script `scripts/configure-generation-schedule.mjs` usa conexao PostgreSQL privada (`DATABASE_URL` ou variaveis PG), `SUPABASE_URL`, `SUPABASE_ACCESS_TOKEN` e `GENERATION_WORKER_SECRET` (aleatorio, pelo menos 32 caracteres). Em conexoes PG hospedadas, usar `PGSSLROOTCERT` com o certificado oficial baixado em Database Settings; o script valida certificado e hostname. Nao preencher valores em comandos versionados, `.env` cliente ou logs. Sem `--apply`, apenas consulta configuracao. Com `--apply`, exige pausas ativas, configura somente o secret do worker, armazena credenciais no Vault, instala Cron e testa autenticacao. Nao imprime tokens nem comandos de Cron com credenciais.

```sh
node scripts/configure-generation-schedule.mjs --apply
node scripts/configure-generation-schedule.mjs
```

Tres agendas: worker a cada 5 segundos, monitor SQL a cada minuto e health check a cada 5 minutos. Sem trabalho, o worker recebe apenas chamadas periodicas de heartbeat (aproximadamente a cada 30 segundos). Com fila, cada invocacao processa no maximo quatro itens em lotes de dois; leases evitam duplicacao entre invocacoes sobrepostas. `pg_net` assincrono nao comprova sucesso HTTP: verificar tambem respostas HTTP e heartbeat.

`GENERATION_ALERT_WEBHOOK` opcional recebe POST HTTPS com `text` e `alert` (ID, severidade, mensagem, horario). Escolher um endpoint compativel, configurar como secret privado e testar uma notificacao antes de abrir. Alertas tambem ficam no painel, deduplicados enquanto nao resolvidos. Sem URL/operador definido nao existe alerta externo entregue.

## Limites e operacao

No dashboard admin, consultar fila, execucao, envios incertos, persistencia, pendencias de debito, reserva/gasto estimado e p95 recente. O p95 total inclui espera; p95 para salvar mede evento ate copia privada. Sem amostra, mostrar "sem amostra". Health check antigo nao e prova de saude atual.

Liberacao inicial: 1 slot, teto de 6 inicios/minuto e ate 3 aguardando. Em 9/10 o usuario pediu e salvou 6 slots pelo painel; o controle antigo tambem ajustou o teto de envios para 9/min. O controle revisado preserva esse teto ao salvar concorrencia. O teto de inicios nao e vazao garantida: um slot com geracoes de 108 segundos entrega aproximadamente uma foto a cada dois minutos. Aumentar concorrencia apenas apos validar o proximo patamar e a cota do provedor; nao tratar 20 slots/30 inicios/minuto/120 aguardando como capacidade ja aprovada. Um job aceito pelo provedor, mesmo incerto, nunca e tratado como nao enviado para devolver custo prematuramente.

### Retencao em picos

A migracao `20261009213000_peak_generation_retention.sql` amplia a capacidade global minima para 60 pedidos aguardando, sem alterar slots, teto financeiro, margem ou ritmo de envio. Fotos ja enviadas ao Storage podem aguardar ate 30 minutos antes de expirar sem envio ao provedor; uploads incompletos continuam expirando em 10 minutos. Expiracao nao encerra envios incertos e devolve apenas reservas nao consumidas, sem cobrar WordPress. Uma fila limitada nao promete atender um pico infinito: 60 pedidos com 6 slots e tempos de 90-150 segundos podem exigir aproximadamente 15-25 minutos para drenar, antes de outras restricoes do provedor.

O cliente novo consulta capacidade autenticada sem reenviar a foto enquanto a fila esta cheia, usa backoff com jitter de 30-60 segundos e mantem foto/escolhas em memoria. Ao haver vaga, a reserva transacional continua validando capacidade, credito e orcamento. UUID aceito e persistido e recuperado apos reload; fotos ainda nao aceitas ficam somente em memoria, nao em armazenamento persistente do navegador. Uma resposta de envio perdida e consultada pelo UUID antes de repetir o mesmo pedido. Pagina oculta nao faz polling; retornar ou reconectar retoma a consulta. Preparacao longa consulta a cada 30 segundos, em vez de cinco.

A tela mostra a foto original, camisa e cenario, com preparacao imediata e fases reais de geracao/finalizacao. Nao mostra posicao na fila, porcentagens ficticias nem progresso por tempo. Isto melhora a experiencia, mas nao elimina latencia da IA. O frontend novo foi publicado na revisao `52787c1`, com status Vercel bem-sucedido e arquivos do build conferidos no dominio de producao. Aumentar capacidade no banco sozinho nao altera a SPA.

As pausas sao independentes: "Pausar pedidos" impede novas reservas; "Pausar processamento" impede novos POSTs de IA. Ambas preservam callbacks, reconciliacao e copia de resultados. Alteracoes no painel ficam em `generation_control_audit`. RPCs operacionais nao aceitam anonimo; usuarios autenticados sem papel admin nao podem configurar limites.

Alertas: heartbeat ausente por um minuto, fila aguardando 5 minutos, copia parada 5 minutos, envio incerto, falhas acima de 2% em 5 minutos com pelo menos 20 conclusoes, exposicao de 70%/85%. 429 retorna o job para espera e aplica cooldown compartilhado, com jitter e limite de tentativas. 408/5xx/timeouts de POST mantem estado incerto, nunca reenvio cego.

Envio incerto sem ID: o worker consulta ate 100 predictions recentes e so associa uma correspondencia unica da foto privada daquele UUID e do modelo esperado. Nao encontrar nao prova que nao houve inferencia. Conferir o provedor com o UUID e horario, sem expor links assinados ou tokens. Escalar ao operador, manter reserva, nao alterar para `ready`.

## Infraestrutura e liberacao

Em 9/10/2026, a primeira consulta autenticada confirmou a organizacao `fanframe` no Supabase Free. Apos o usuario realizar o upgrade, nova consulta autenticada confirmou **Pro**, com o projeto `fanframe` em `ACTIVE_HEALTHY`, regiao `sa-east-1`. Nao foi comprado compute adicional automaticamente. Pro resolve a restricao anterior de plano, mas nao comprova throughput, folga de banco ou cota de IA. Nao desabilitar Spend Cap como substituto de planejamento.

Testes locais de banco nao certificam carga remota. A suite usa banco descartavel, 1.000 tentativas concorrentes, teto financeiro pequeno e disputa por slots. Os testes Edge simulam resposta perdida, 429, falha de autorizacao, vinculo de prediction e copia privada. E2E cobre recarregamento sem nova geracao e downloads desktop/iPhone. O teste sustentado de 15 minutos em homologacao equivalente, as cotas reais e o download no iframe WordPress real ainda precisam de evidencia propria.

Para canario, usar link de teste exclusivo com poucos creditos, fotos autorizadas e ate 20 imagens (US$ 1,80), contabilizadas na mesma reserva. Conferir apenas um prediction por UUID, assinatura, persistencia privada, credito e download. Nao usar usuarios/clientes reais como carga sintetica nem gerar 1.000 imagens pagas.

Congelar alteracoes duas horas antes da abertura. Operador e canal externo precisam estar definidos. Para rollback: pausar novas reservas/POSTs, continuar recebendo webhook e salvando fotos, drenar/reconciliar o aceito e restaurar somente codigo compativel com a fila. Nao restaurar banco antigo nem apagar jobs para reduzir contadores. Funcionalidades de upload direto, limpeza por TTL e liquidacao WordPress totalmente autonoma continuam fora desta entrega.

## Evidencia de 9/10/2026

Backup nativo privado de 49 tabelas foi restaurado em banco descartavel; a nova migracao preservou os registros publicos reais. O dry-run em historico remoto recuperado listou somente `20261009180000_durable_generation_queue.sql`, depois aplicada. As sete funcoes foram publicadas sem remover funcoes extras. Vault e as tres agendas estao configurados; readback de Cron confirmou execucoes bem-sucedidas e `pg_net` confirmou respostas HTTP 200 do worker. A chamada publica ao worker foi recusada com 401.

A verificacao completa passou com replay de 29 migracoes, 1.000 tentativas de reserva em pool local de 20 conexoes, teste de limites/donos/leases e 23 testes de navegador. Foram testados saldo/reserva atravessando meia-noite, negacao a usuario nao admin, auditoria de controles, retomada apos reload e historico paginado. Isto nao e um teste de 1.000 conexoes reais no Supabase remoto.

Canario inicial: um prediction, um credito de teste consumido, PNG privado legivel, 108 segundos totais e 5,30 segundos do evento ate persistencia. Trinta consultas reais de status com cinco concorrentes: zero erros, p50 359 ms e p95 588 ms. O teste usa uma identidade de teste, nao representa carga sustentada do lancamento.

Mais cinco canarios tiveram pico observado de cinco predictions em andamento. Quatro terminaram com imagens privadas em aproximadamente 74-150 segundos; um terminou sem imagem do provedor, foi marcado como falha e devolveu o credito de teste. Todos tiveram apenas uma tentativa de envio. No total dos seis canarios: cinco conclusoes, uma falha explicita, nenhum job perdido; exposicao contabilizada conservadoramente em US$ 0,54, inclusive a falha sem saida (nao e uma fatura confirmada do Replicate). Usaram asset publico de camisa como entrada nao pessoal; nao validam fidelidade de retrato. Esse lote pequeno com uma falha nao aprovou estabilidade de cinco slots para abertura.

Depois dos testes, admissao e despacho ficaram pausados. Apos confirmar Pro e readback de Cron/HTTP, foi aplicada liberacao limitada auditada pelo admin: admissao/despacho ativos, teto nominal US$ 300/US$ 300, margem 10%, 1 slot/6 inicios por minuto/3 aguardando. Leitura independente confirmou controles e registro de auditoria. Esse modo nao representa aprovacao de alta capacidade. Os links de teste dos canarios foram desativados.

Codigo publicado na `main` em `2649309`, com CI e deploy Production da Vercel bem-sucedidos. Health check remoto apos o upgrade confirmou DB, Replicate, Edge Functions e Realtime operacionais; Auth e CDN apresentaram latencia classificada como degradada, sem falha de resposta. Nao anunciar saude perfeita nem 20/50/100 slots ou mil usuarios simultaneos como capacidade comprovada. Permanecem pendentes operador e webhook externo testado, carga sustentada em homologacao equivalente, cota real e download pelo iframe WordPress real. Consulta e recuperacao continuam funcionando independentemente das pausas.
