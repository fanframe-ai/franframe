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

Comecar em modo conservador: 5 slots, 8 inicios/minuto e ate 30 aguardando. Apenas passar a 20 slots/30 inicios/minuto/120 aguardando depois de validar esse patamar e a cota do provedor. A fila expira pedidos nao enviados depois de 10 minutos, libera exposicao e devolve credito de teste. Um job aceito pelo provedor, mesmo incerto, nunca e tratado como nao enviado para devolver custo prematuramente.

As pausas sao independentes: "Pausar pedidos" impede novas reservas; "Pausar processamento" impede novos POSTs de IA. Ambas preservam callbacks, reconciliacao e copia de resultados. Alteracoes no painel ficam em `generation_control_audit`. RPCs operacionais nao aceitam anonimo; usuarios autenticados sem papel admin nao podem configurar limites.

Alertas: heartbeat ausente por um minuto, fila aguardando 5 minutos, copia parada 5 minutos, envio incerto, falhas acima de 2% em 5 minutos com pelo menos 20 conclusoes, exposicao de 70%/85%. 429 retorna o job para espera e aplica cooldown compartilhado, com jitter e limite de tentativas. 408/5xx/timeouts de POST mantem estado incerto, nunca reenvio cego.

Envio incerto sem ID: o worker consulta ate 100 predictions recentes e so associa uma correspondencia unica da foto privada daquele UUID e do modelo esperado. Nao encontrar nao prova que nao houve inferencia. Conferir o provedor com o UUID e horario, sem expor links assinados ou tokens. Escalar ao operador, manter reserva, nao alterar para `ready`.

## Infraestrutura e liberacao

Em 9/10/2026, consulta autenticada confirmou a organizacao `fanframe` no Supabase **Free**, com Spend Cap habilitado na interface. O upgrade Pro e a configuracao de compute nao foram executados automaticamente. Free nao comporta o volume de armazenamento previsto de milhares de PNGs 2K. Confirmar Pro/quotas antes de abrir o envelope inteiro. Nao desabilitar Spend Cap como substituto de planejamento.

Testes locais de banco nao certificam carga remota. A suite usa banco descartavel, 1.000 tentativas concorrentes, teto financeiro pequeno e disputa por slots. Os testes Edge simulam resposta perdida, 429, falha de autorizacao, vinculo de prediction e copia privada. E2E cobre recarregamento sem nova geracao e downloads desktop/iPhone. O teste sustentado de 15 minutos em homologacao equivalente, as cotas reais e o download no iframe WordPress real ainda precisam de evidencia propria.

Para canario, usar link de teste exclusivo com poucos creditos, fotos autorizadas e ate 20 imagens (US$ 1,80), contabilizadas na mesma reserva. Conferir apenas um prediction por UUID, assinatura, persistencia privada, credito e download. Nao usar usuarios/clientes reais como carga sintetica nem gerar 1.000 imagens pagas.

Congelar alteracoes duas horas antes da abertura. Operador e canal externo precisam estar definidos. Para rollback: pausar novas reservas/POSTs, continuar recebendo webhook e salvando fotos, drenar/reconciliar o aceito e restaurar somente codigo compativel com a fila. Nao restaurar banco antigo nem apagar jobs para reduzir contadores. Funcionalidades de upload direto, limpeza por TTL e liquidacao WordPress totalmente autonoma continuam fora desta entrega.

## Evidencia de 9/10/2026

Backup nativo privado de 49 tabelas foi restaurado em banco descartavel; a nova migracao preservou os registros publicos reais. O dry-run em historico remoto recuperado listou somente `20261009180000_durable_generation_queue.sql`, depois aplicada. As sete funcoes foram publicadas sem remover funcoes extras. Vault e as tres agendas estao configurados; readback de Cron confirmou execucoes bem-sucedidas e `pg_net` confirmou respostas HTTP 200 do worker. A chamada publica ao worker foi recusada com 401.

A verificacao completa passou com replay de 29 migracoes, 1.000 tentativas de reserva em pool local de 20 conexoes, teste de limites/donos/leases e 23 testes de navegador. Foram testados saldo/reserva atravessando meia-noite, negacao a usuario nao admin, auditoria de controles, retomada apos reload e historico paginado. Isto nao e um teste de 1.000 conexoes reais no Supabase remoto.

Canario inicial: um prediction, um credito de teste consumido, PNG privado legivel, 108 segundos totais e 5,30 segundos do evento ate persistencia. Trinta consultas reais de status com cinco concorrentes: zero erros, p50 359 ms e p95 588 ms. O teste usa uma identidade de teste, nao representa carga sustentada do lancamento.

Mais cinco canarios tiveram pico observado de cinco predictions em andamento. Quatro terminaram com imagens privadas em aproximadamente 74-150 segundos; um terminou sem imagem do provedor, foi marcado como falha e devolveu o credito de teste. Todos tiveram apenas uma tentativa de envio. No total dos seis canarios: cinco conclusoes, uma falha explicita, nenhum job perdido; exposicao contabilizada conservadoramente em US$ 0,54, inclusive a falha sem saida (nao e uma fatura confirmada do Replicate). Usaram asset publico de camisa como entrada nao pessoal; nao validam fidelidade de retrato. Esse lote pequeno com uma falha nao aprovou estabilidade de cinco slots para abertura.

Estado apos os testes: admissao e despacho pausados, teto nominal US$ 300/US$ 300, margem 10%, configuracao preparada para 5 slots/8 inicios por minuto/30 aguardando. Recuperacao continua funcionando. Os links de teste dos canarios foram desativados. Antes de retomar: concluir Pro/quotas/compute, definir operador e webhook externo, validar carga sustentada e cota real, e baixar pelo iframe WordPress real. Nao anunciar 20/50/100 slots nem mil usuarios simultaneos como capacidade comprovada.
