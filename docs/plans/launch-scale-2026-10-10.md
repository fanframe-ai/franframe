# FanFrame Plano de escala para o lancamento de 10 de outubro

Data: 09/10/2026. Status: plano de execucao, ainda nao implementado.
Escopo: FanFrame, incluindo seus contratos com WordPress e Replicate. Nao inclui redimensionar o tour ou o WordPress.
Base inspecionada: `main` em `185eb6d48d946961d16f5738b2c5b6cf8fe848dd`, mais alteracoes locais existentes.

## Decisao

Manter Vercel, Supabase e Replicate. Transformar a fila existente em trabalho duravel, controlar quantas geracoes chegam ao provedor e reservar o custo antes de chamar a IA. O site pode receber mais visitantes que o numero de fotos processadas simultaneamente; a fila absorve picos curtos, mas nao cria capacidade infinita.

Preservar Seedream 5 Pro, 2K, PNG, autenticacao por time, imagens privadas, assinatura dos webhooks e idempotencia por UUID. Nao trocar modelo, banco, hospedagem ou integracao de pagamentos na vespera. Nao acrescentar Kubernetes, Redis, outro provedor de IA ou Realtime por visitante neste lancamento.

Prioridade: nao gastar ou debitar em duplicidade; manter resultados recuperaveis; admitir apenas o trabalho que cabe no orcamento e na capacidade medida; aumentar vazao progressivamente. Quando faltar capacidade, preservar consulta de resultados e download, limitando novas geracoes.

## Evidencias e limites

Na auditoria de 09/10, as ultimas 24 horas tinham sete geracoes concluidas, de um unico dono, sem sobreposicao. A mediana foi aproximadamente 67 segundos e o maior tempo, 84 segundos. Isso comprova funcionamento em baixa carga, nao capacidade de pico.

O backend atual inicia uma prediction imediatamente em `generate-tryon`; o registro `generation_queue` nao tem um consumidor independente. O frontend consulta status a cada tres segundos e pode criar outro UUID ao tentar novamente. Nao havia tarefas em `cron.job`. Os ultimos health checks persistidos eram de abril.

O banco tinha aproximadamente 14 MB. A amostra de seis resultados recentes tinha media de 6,27 MB por PNG. O painel estima US$ 0,04 por foto, mas o preco publicado do modelo 2K e US$ 0,09. Fonte: [Seedream 5 Pro](https://replicate.com/bytedance/seedream-5-pro).

O plano efetivamente contratado em Supabase/Vercel, a cota e o saldo da conta Replicate, o publico esperado e o teto financeiro precisam ser confirmados antes da ativacao. Nenhum numero de capacidade abaixo e uma garantia contratual ou resultado de teste de carga.

## Ordem de entrega

Estimativa de planejamento: uma janela de 8 a 12 horas de trabalho focado, sujeita aos testes e ao estado dos ambientes. Congelar alteracoes pelo menos duas horas antes da abertura. Se a janela acabar, usar o modo limitado descrito adiante; nao cortar a verificacao de credito para ganhar tempo.

| Etapa | Trabalho | Evidencia para prosseguir |
| --- | --- | --- |
| 1 | Conferir contas, cotas e orcamentos; backup; registrar versoes; incorporar seletivamente as correcoes ja publicadas que ainda estao locais | Ambiente reproduzivel, limites registrados e reversao definida |
| 2 | Admissao atomica, teto financeiro, uma geracao ativa por dono/time, chave de pausa; corrigir retry/polling no cliente | Corridas concorrentes nao excedem saldo, limite ou orcamento |
| 3 | Despachante duravel sobre a fila existente, limitador por conta do provedor e recuperacao de workers | Jobs sobrevivem a fechamento do navegador e reinicio do worker |
| 4 | Webhook duravel, reconciliacao, persistencia independente da foto, painel operacional enxuto | Callback repetido/perdido nao perde resultado nem dispara nova IA |
| 5 | Testes de falha e carga em homologacao, canario real pequeno, verificacao completa | Criterios de liberacao atendidos e maior patamar sustentado registrado |
| 6 | Publicacao compativel, smoke test, abertura gradual e acompanhamento | Nenhum job legado perdido; controle de pausa exercitado |

As etapas 2 a 4 formam um unico fluxo financeiro. Nao ativar uma fila pela metade nem publicar workers que usem outro caminho de cobranca.

Mapa de implementacao para evitar mudancas dispersas:

| Local | Responsabilidade |
| --- | --- |
| `supabase/migrations/<nova_migracao>.sql` | Admissao, reservas, leases, estados privados, indices de trabalho elegivel e RPCs restritas a service role |
| `supabase/functions/generate-tryon/index.ts` | Validar, reservar, persistir entrada e aceitar o job; nao chamar IA diretamente no fluxo novo |
| Nova funcao interna de worker e `functions/_shared` | Despacho, persistencia e reconciliacao com limites compartilhados |
| `replicate-webhook/index.ts` | Validar e registrar evento duravel, sem depender da copia sincrona do PNG |
| `generation-status/index.ts` e `_shared/auth.ts` | Recuperar job ativo, liquidar pelo UUID, consultar status enxuto e renovar download |
| `src/features/tryon` e `src/features/auth` | Retomar UUID, estados de fila e alta demanda, polling e saldo coerentes |
| `src/features/admin` | Metricas agregadas, custo real estimado, saude recente e comandos de pausa |
| `scripts/deploy-functions.mjs` e `supabase/config.toml` | Incluir explicitamente o worker e sua autenticacao; configurar Cron/segredos de servidor |
| `scripts/test-database.mjs`, `supabase/tests`, `tests/e2e` | Corridas financeiras, falhas externas, retomada, isolamento e contratos |
| `src/integrations/supabase/types.ts` | Regenerar tipos depois da nova migracao |

Novas tabelas operacionais permanecem privadas, com RLS e grants minimos. Nao devolver segredos, leases internas ou dados de outros donos nas respostas publicas.

## Admissao e protecao financeira

1. Autenticar time e dono no backend. Validar imagem e assets. Requisicao repetida com mesmo UUID e mesmo conteudo recupera o job existente; conteudo ou dono diferente e conflito.
2. Aplicar limite de chamadas autenticadas antes de leituras externas repetidas. O limite atual de 25 geracoes/hora por dono continua; adicionar uma unica geracao ativa por dono/time, incluindo fila, envio incerto e pagamento pendente. Varios navegadores nao multiplicam a permissao.
3. Em transacao curta, reservar vaga de admissao, credito local quando aplicavel e exposicao financeira. Nao manter transacao SQL aberta esperando WordPress, upload ou Replicate. Uma lease por dono e verificacao de versao devem impedir que um saldo lido antes de um debito concorrente autorize outra geracao.
4. Persistir a foto privada e somente entao marcar o job como pronto para despacho. Reserva com upload incompleto expira sem chamar IA. Revalidar a admissao se o upload exceder a validade da lease. Nao guardar base64 no banco.
5. Reservar US$ 0,09 por saida solicitada em unidades monetarias inteiras, com preco/modelo/resolucao registrados no job. Incluir links de teste, jobs em fila, em execucao, incertos e imagens concluidas ainda sem debito WordPress.
6. Admitir apenas se `gasto_estimado + reservas + novo_custo <= teto_operacional`, tanto globalmente quanto por time. Fazer a verificacao e a reserva na mesma transacao. Contadores em memoria de Edge Functions nao servem como limite global.
7. Transferir reserva para gasto, sem somar duas vezes, quando o custo for reconhecido. Nao liberar reserva de uma chamada ambigua ou supor que toda falha foi gratuita; conferir a situacao no provedor. Reservas atravessam a meia-noite sem desaparecer do limite total. Separar teto do evento de teto diario para nao dobrar acidentalmente a exposicao na virada do dia.
8. Avisar aos 70% e 85% do teto; impedir novas admissoes ao atingir o limite operacional. Concluir trabalho ja aceito e pago pela reserva. Manter uma margem, proposta inicial de 10%, fora desse limite para diferencas operacionais. Ela nao transforma a estimativa local em teto da fatura de terceiros.

Expor tres comandos administrativos autenticados e auditados: pausar novas admissoes, pausar novos despachos e retomar com limites definidos. A pausa nunca bloqueia webhook, reconciliacao, liquidacao, historico ou download. Nenhum comando fica disponivel pela chave publica do Supabase.

Limite de uma geracao por dono reduz abuso e custo de resultados abandonados. Nao substitui limites por conta do provedor, por time e globais. Se varios times usarem a mesma credencial Replicate, compartilhar a cota de despacho dessa conta. Nunca contornar a cota criando mais tokens.

Proteger as rotas diretas do Supabase: regras de firewall apenas na Vercel nao protegem chamadas que nao passam por ela. Limitar tamanho real do corpo durante a leitura, nao somente depois de montar o JSON; limitar tambem frequencia de status/historico por identidade, sem impedir o polling contratado. Limites por IP, quando aplicaveis, usam origem confiavel e toleram usuarios em rede compartilhada. Nao aceitar saldo, time ou URL arbitraria enviada pelo cliente como autoridade.

## Fila e despacho

Reutilizar `generation_queue`, acrescentando somente campos e RPCs necessarios em uma nova migracao. Campos previstos: etapa operacional, elegibilidade de despacho, tentativas, proxima tentativa, lease e sua versao, versao dos parametros, custo reservado e situacao de reconciliacao. Manter a separacao entre estado da geracao e estado financeiro, sem quebrar clientes antigos que consultam os status atuais.

Gravar os parametros efetivos de cada job, incluindo prompt, modelo, referencias e resolucao. Uma edicao administrativa enquanto o usuario espera nao deve alterar uma geracao ja aceita.

O consumidor recebe lotes por RPC transacional, com `FOR UPDATE SKIP LOCKED` e controle atomico dos slots/rate limits compartilhados. Cada atualizacao exige a versao da lease; um worker antigo nao pode sobrescrever trabalho recuperado. Expiracao da lease depois do inicio do POST ao provedor leva a reconciliacao, nunca a reenvio automatico.

Usar uma Edge Function interna, autenticada com segredo exclusivamente de servidor, acionada pelo Supabase Cron a cada cinco segundos enquanto o fluxo estiver habilitado. Ela despacha poucos jobs e termina; nao espera a IA gerar nem mantem um loop infinito. Aplicar limite de invocacoes de worker sobrepostas. O mesmo acionamento pode cuidar da persistencia e, a cada minuto, da reconciliacao, com cotas separadas para nao deixar novos envios atrasarem resultados prontos. O [Supabase Cron](https://supabase.com/docs/guides/cron) suporta intervalos em segundos; medir o custo e reduzir chamadas ociosas quando nao houver fila.

Uma notificacao imediata apos a admissao pode reduzir a espera inicial, mas e apenas uma aceleracao: a recuperacao depende da fila e do agendamento, nao de uma chamada em background no navegador.

Configuracao inicial proposta, sujeita ao canario:

| Controle | Valor inicial |
| --- | --- |
| Geracoes simultaneas no provedor | 20 por conta, respeitando tambem o limite global |
| Inicio de predictions | 30/minuto, suavizado, burst maximo de 5; reduzir se a cota real for menor |
| Geracoes ativas por dono/time | 1, incluindo pagamento pendente |
| Espera desejada antes de iniciar | Ate 10 minutos; estimativa, nao promessa fixa |
| Fila inicial maxima | 120 aguardando, ou menos se a espera estimada ultrapassar 10 minutos |
| Persistencia de imagens por invocacao de worker | 2 em paralelo, com limite global inicial de 4 |
| Varredura de recuperacao | A cada minuto, em lotes limitados |
| Orcamento diario e do evento | Obrigatorios antes da ativacao; sem valor implica novas geracoes desabilitadas |

O limite de 120 usa uma duracao inicial conservadora de 90 segundos: `20 * 600 / 90`, arredondado para baixo com folga. Recalcular com a latencia e vazao observadas. Aumentar o teto da fila apenas quando a vazao medida justificar; fila grande sozinha aumenta abandono e latencia.

Se a fila encher, responder com indisponibilidade temporaria e `Retry-After`, sem iniciar IA ou debitar credito. A interface informa alta demanda e permite tentar depois, sem repeticao agressiva. Jobs aceitos que ainda nao foram enviados podem expirar de forma segura, liberando as reservas; jobs enviados nao sao expirados como se nunca tivessem existido.

O Replicate publica 600 criacoes/minuto e 3.000 chamadas/minuto para os demais endpoints, com restricoes adicionais por saldo/conta. Isso e limite da API, nao garantia de GPUs ou vazao do modelo. Confirmar a cota efetiva antes de qualquer aumento. Fonte: [rate limits](https://replicate.com/docs/topics/predictions/rate-limits).

## Falhas sem geracao duplicada

| Situacao | Conduta |
| --- | --- |
| 429 explicito antes de criar prediction | Devolver job para espera; respeitar `Retry-After`, usar backoff com jitter e diminuir despacho |
| Erro de validacao ou autorizacao do provedor | Parar aquele job; alertar configuracao; nao repetir indefinidamente |
| Timeout, conexao perdida ou 5xx no POST de criacao | Tratar como envio incerto: manter UUID e reserva, aguardar callback e investigar; nao criar outra prediction as cegas |
| Prediction ID conhecido, sem callback | Consultar esse ID no reconciliador e recuperar o estado; nao criar outra foto |
| Callback repetido ou fora de ordem | Transicoes condicionais idempotentes, sem regressao de estado, credito ou custo duplicado |
| Storage temporariamente indisponivel | Repetir somente a copia do resultado, nao a inferencia |
| Navegador fechado, recarregado ou sem rede | Continuar o job no servidor; retomar o mesmo UUID autenticado |
| Sessao WordPress expirada | Solicitar reconexao; preservar resultado privado e estado de debito |

O UUID da aplicacao nao prova idempotencia do POST do Replicate. Sem uma garantia documentada desse endpoint, nao prometer execucao externa exatamente uma vez. Habilitar evento `start`, alem de `completed`, ajuda a obter cedo o prediction ID, mas nao substitui recuperacao.

O webhook deve verificar assinatura e vinculo ao job e gravar duravelmente o evento/estado antes de responder 2xx. A copia da imagem fica em trabalho persistente e idempotente, com verificacao de HTTPS, dominio, tamanho e destino privado. Se a gravacao do evento falhar, devolver erro para permitir retry. O evento privado pode guardar a URL temporaria de saida; nao a publicar nem registrar em logs.

Priorizar salvar a foto sobre iniciar novas fotos. O Replicate recomenda resposta rapida e suas retentativas terminais terminam aproximadamente um minuto depois da conclusao; logo, callback sozinho nao basta. Os resultados de predictions via API sao removidos apos uma hora por padrao. Fontes: [webhooks](https://replicate.com/docs/topics/webhooks/receive-webhook) e [retencao](https://replicate.com/docs/topics/predictions/data-retention).

Meta operacional: iniciar reconciliacao de job sem atualizacao apos tres minutos; alertar aos cinco; dar prioridade maxima a resultado ainda nao copiado e alertar novamente antes de 15 minutos. Timeout de recuperacao nao autoriza nova geracao nem devolucao prematura de reserva ambigua. Escalar ao operador quando nao houver prediction ID nem callback verificavel.

## Creditos WordPress no lancamento

O FanFrame guarda o hash do token de sessao, nao o token recuperavel. Um cron nao consegue chamar `/credits/debit` usando apenas esse hash. Nao inventar cobranca autonoma, guardar tokens em texto puro ou cobrar antecipadamente sem um contrato de estorno.

Para amanha, manter o contrato existente: foto pronta vira `awaiting_payment`; o cliente autenticado liquida o debito com o UUID e so entao recebe a imagem. Ao retornar, consultar primeiro o job ativo desse dono/time e retomar a liquidacao antes de oferecer outra geracao. Debito repetido ou resposta perdida devem ser resolvidos pelo mesmo UUID, com exclusao mutua local entre liquidacao e nova admissao.

Esse fluxo ainda admite uma foto custeada pelo FanFrame que o usuario abandona antes do debito. Ela continua consumindo o orcamento de IA e bloqueia nova geracao daquele dono ate a reconciliacao. Monitorar quantidade, idade e custo de `awaiting_payment`; nao contabilizar como receita, nao liberar novas tentativas para driblar a pendencia e nao afirmar que o credito foi descontado antes da confirmacao.

Automatizar liquidacao sem navegador fica para uma segunda etapa, com contrato servidor a servidor de reserva/confirmacao/estorno no WordPress ou credencial delegada de escopo e validade limitados. Isso exige validacao conjunta, mesmo considerando o WordPress pronto para escala.

## Menos consultas e transferencia

- Trocar o polling fixo de tres segundos por resposta com `next_poll_after`: aproximadamente 10-15 segundos em fila e 5-10 em processamento, com jitter e apenas uma consulta em voo por cliente. Quando a aba ficar oculta, pausar; ao voltar, consultar imediatamente o mesmo UUID.
- Repetir falhas transitorias de consulta com backoff de ate 30 segundos. Um erro de status/download nunca cria novo UUID. Persistir somente o identificador de recuperacao por time; toda leitura ainda exige identidade no servidor.
- Em 1.000 clientes aguardando, passar de 3 para 10 segundos reduz a taxa nominal de 20.000 para 6.000 consultas/minuto, cerca de 70%, antes da latencia e das abas ocultas. Ainda e carga relevante: testar a rota autenticada real e suas consultas SQL.
- Status deve buscar somente os campos necessarios. Consolidar verificacao de identidade/time/job em RPC restrita se o teste mostrar custo das tres idas atuais ao banco; nao sacrificar revogacao, expiracao ou isolamento por time para ganhar cache.
- Assinar URL apenas quando entregar o resultado. Reutilizar no cliente ate perto da expiracao, renovando no download. Historico paginado, proposta inicial de 10 itens, evitando assinar 50 imagens de uma vez.
- No painel, usar agregados SQL e listas paginadas; remover refetch de todo o dia a cada evento Realtime. Uma atualizacao operacional a cada 15-30 segundos e suficiente. Enquanto isso nao estiver pronto, nao deixar paginas analiticas pesadas atualizando durante o evento.
- Cachear somente assets publicos versionados; manter HTML atualizavel. Nao colocar saldo, identidade, respostas privadas ou fotos de usuarios em cache publico. Reutilizar a chave privada de verificacao de webhook com invalidacao por credencial/rotacao, sem busca no provedor a cada job.

Upload direto para Storage privado por autorizacao curta e caminho associado ao UUID e a proxima otimizacao se o teste de pico revelar gargalo no JSON/base64. Nessa mudanca, validar propriedade, tamanho, tipo e conteudo no servidor antes de enfileirar, usar caminho imutavel e remover uploads orfaos. Nao liberar escrita anonima no bucket. Para amanha, manter o caminho atual se ele passar no teste de tamanho maximo e carga admitida.

Nao redimensionar agressivamente rostos ou camisas para economizar transferencia sem comparacao visual. Manter o arquivo final 2K; miniaturas leves para historico podem entrar depois. Os workers devem ter concorrencia limitada porque as [Edge Functions](https://supabase.com/docs/guides/functions/limits) possuem limites de memoria, CPU e duracao: nao processar dezenas de PNGs simultaneamente dentro de uma unica invocacao.

## Capacidade e orcamento

Estimativas matematicas usando 67 segundos por foto, sem degradacao em concorrencia. A capacidade verdadeira e o menor valor entre provedor, despacho, persistencia, banco e orcamento. A mediana de sete execucoes nao e uma estimativa confiavel de p95.

| Fotos simultaneas | Inicio maximo proposto/min | Vazao teorica aproximada/min | Tempo ideal para terminar um lote de 1.000 |
| --- | --- | --- | --- |
| 20 | 30 | 18 | 56 minutos |
| 50 | 60 | 45 | 23 minutos |
| 100 | 120 | 90 | 12 minutos |

O lote de 1.000 e ilustrativo: a admissao inicial de 120 em fila rejeitaria temporariamente o excedente para nao prometer uma espera de quase uma hora. Mil visitantes simultaneos nao significam mil pedidos de foto; testar navegacao e geracao separadamente. So abrir 50 ou 100 slots depois de confirmar cota e observar estabilidade nesse patamar.

| Saidas 2K | Estimativa de IA |
| --- | --- |
| 100 | US$ 9 |
| 1.000 | US$ 90 |
| 5.000 | US$ 450 |
| 10.000 | US$ 900 |

Valores de IA consideram apenas a quantidade de saidas de cada linha, cobradas do usuario ou nao, e nao incluem hospedagem, transferencia, impostos, cambio ou taxas de pagamento. Qualquer saida adicional, inclusive abandonada, aumenta o total. Base: US$ 0,09 por saida 2K na [pagina do modelo](https://replicate.com/bytedance/seedream-5-pro). Com um teto ilustrativo de IA de US$ 100 e margem de 10%, admitir no maximo 1.000 saidas reservadas/concluidas dentro desse envelope, contando perdas e testes. Nao confundir credito comprado pelo visitante com saldo financeiro da conta Replicate.

No pacote de sete, a receita bruta por foto e R$ 29,90 / 7 = R$ 4,27. Acompanhar margem por foto entregue: receita liquida menos IA, infraestrutura alocada e falhas/abandonos. Nao estimar lucro usando somente fotos cobradas; todo custo do provedor precisa entrar. Nao converter dolar por uma cotacao fixa inventada.

Infraestrutura sugerida: Supabase Pro com Small como ponto inicial de teste, aproximadamente US$ 30/mes para uma organizacao/projeto elegivel ao credito de compute (25 + 15 - 10). Se o teste indicar pressao, avaliar Medium, aproximadamente US$ 75/mes nessa mesma composicao. Nao comprar capacidade so pelo numero de visitantes. Fontes: [precos](https://supabase.com/pricing) e [compute](https://supabase.com/docs/guides/platform/compute-and-disk). O plano atual ainda precisa ser conferido.

A troca de compute pode causar indisponibilidade; fazer antes da abertura e repetir o smoke test. Durante o evento, controlar admissao e despacho primeiro. O [Spend Cap](https://supabase.com/docs/guides/platform/cost-control) cobre apenas certos itens, nao compute, e pode restringir servicos ao atingir franquias: nao e um teto financeiro universal nem substitui a reserva de custo na aplicacao.

Manter a SPA na Vercel/CDN. Conferir plano comercial; Pro parte de US$ 20/mes, com cobranca conforme assentos e uso. Fontes: [precos Vercel](https://vercel.com/pricing) e [restricoes do Hobby](https://vercel.com/docs/plans/hobby). Supabase Pro/Small mais uma base Vercel Pro fica em cerca de US$ 50/mes antes de IA, extras e impostos, nao US$ 50 por dia.

No Replicate, provisionar saldo suficiente para o envelope do evento e a folga operacional; saldo baixo pode reduzir a cota. Nao habilitar recarga ilimitada. Conferir limites/alertas disponiveis na conta, lembrando que chaves usadas por outros sistemas podem gastar fora do controle do FanFrame.

Mil PNGs de 6,27 MB representam aproximadamente 6,27 GB de armazenamento, sem fotos de entrada. Cada visualizacao/download pode acrescentar transferencia. Nao guardar imagens em logs, nem proxyar downloads grandes pela Vercel: manter entrega privada por URL curta do Storage.

No lancamento, inventariar arquivos e alertar sobre crescimento. Depois, automatizar limpeza idempotente de originais e orfaos por TTL aprovado, excluindo jobs ativos/em recuperacao. Definir prazo de resultados compativel com a promessa de historico antes de apagar fotos; nao executar uma limpeza em massa na vespera.

## Validacao antes de abrir

Usar homologacao isolada, com banco/storage equivalentes e provedores simulados por configuracao exclusivamente de servidor. Um stub acessivel por parametro do cliente e proibido. Testar 100, 500 e 1.000 clientes com identidades distintas e dados sinteticos, sem gerar 1.000 imagens pagas ou bombardear o WordPress de producao.

Executar subida gradual, pico repentino, carga sustentada por 15 minutos no maior patamar aprovado e drenagem da fila. Simular latencia da IA de 60-90 segundos e cauda de 180 segundos, callbacks repetidos/perdidos, 429, timeout depois de aceitar POST, reinicio do worker, falha do Storage e debito confirmado cuja resposta se perde.

Incluir fotos pequenas e entradas no limite de 10 MiB. Medir CPU/memoria das Edge Functions, conexoes/CPU/locks do banco, trafego de Storage, chamadas por foto, idade da fila e custo reservado. Medir a mesma regiao/configuracao que sera publicada. Carga local sozinha nao certifica Supabase remoto.

| Criterio | Meta para liberar o patamar |
| --- | --- |
| Credito, custo e tenant | Zero debito duplicado, saldo negativo, acesso cruzado ou extrapolacao do teto por corrida |
| Criacao da IA | Nenhum reenvio automatico quando o primeiro envio for incerto |
| Durabilidade | Todos os jobs aceitos recuperados ou terminados explicitamente; nenhum perdido apos reinicio |
| Status autenticado | p95 abaixo de 1 segundo no patamar aprovado |
| Confirmacao de admissao | p95 abaixo de 3 segundos com dependencias saudaveis, excluindo transferencia da foto; medir tambem o tempo percebido total |
| Erros internos | Menos de 1% em carga estavel; recusas deliberadas por limite medidas separadamente |
| Banco | Sem saturacao de conexoes ou locks crescentes; proposta de margem: CPU e conexoes abaixo de 70% sustentado |
| Callback para foto salva | p95 abaixo de 15 segundos; perda de webhook recuperada antes da expiracao do provedor |
| Cliente | Recarregar, fechar/reabrir, duas abas e falha de rede retomam o mesmo job; download funciona no iframe real e em celular |

Essas sao metas de aceitacao, nao metricas ja alcancadas. Ajustar o teto de admissao ao maior patamar que efetivamente passou. Registrar os resultados por cenario, incluindo falhas, consumo e configuracao.

Rodar `npm run test:db`, `npm run test:edge`, `npm run test:e2e` e finalizar com `npm run verify`. Adicionar testes de concorrencia para orcamento, dono e workers, nao apenas aumentar testes de interface. O CI existente e necessario, mas nao substitui o teste de carga.

Depois dos testes simulados, executar um canario real pequeno com usuarios de teste e fotos autorizadas: validar prediction, assinatura, Storage, debito e download. Um envelope inicial de ate 20 imagens 2K representa US$ 1,80 em saidas do modelo; registrar isso no orcamento. Esse canario valida integracao, nao prova 100 predictions simultaneas. Aumentos reais posteriores tambem consomem o envelope financeiro.

## Publicacao e operacao

Seguir [deployment](../deployment.md). Criar migracao nova e regenerar tipos; nao editar migracao aplicada, nao reparar historico as cegas e nao fazer push de SQL historico duplicado. Usar o procedimento de comparacao com historico remoto recuperado, backup e dry-run mostrando apenas a nova alteracao.

Publicar schema aditivo e backend compativel antes do frontend. Identificar jobs legados com prediction ID e nunca reenvia-los como itens novos. Ativar worker para os jobs elegiveis da nova versao; passar a admissao para a fila por flag controlada. Verificar cada etapa com jobs antigos e novos. Conferir que preview nao usa banco/provedor de producao inadvertidamente.

Corrigir o custo de US$ 0,04 no painel e mostrar separadamente gasto estimado, reserva, fotos entregues, falhas e resultados aguardando debito. Mostrar horario da ultima verificacao e estado desconhecido quando envelhecer; dados de abril nao podem aparecer como saude atual.

Monitorar a cada minuto: taxa de sucesso, 429/5xx, p95, jobs por etapa, idade do mais antigo, heartbeat do worker, fotos ainda nao copiadas, pendencias de debito, gasto e reservas. Logs estruturados por UUID e etapa, sem tokens, fotos, corpo completo de webhook ou URLs assinadas. Definir um operador e um canal de alerta testado antes da abertura; nao depender de alguem observar o console do navegador.

Abrir com 20 slots somente se esse patamar passou. Aumentar primeiro para 30, depois 50, e depois em passos menores ate 100, com pelo menos dez minutos estaveis por patamar e amostra suficiente de conclusoes. Exigir fila sob controle, erros abaixo de 1%, ausencia de 429 sustentado, folga no banco e orcamento. Nao usar apenas CPU baixa como sinal de que o provedor suporta mais.

Se 429 persistir, reduzir taxa de despacho e respeitar cooldown. Se erros superarem 2% por cinco minutos, p95 dobrar ou a fila parar de drenar, voltar ao ultimo patamar estavel. Se houver debito duplicado, exposicao indevida ou falha do limitador financeiro, pausar novas admissoes imediatamente.

Se heartbeat ficar ausente por mais de um minuto, ou houver resultados prontos sem copia ha mais de cinco, alertar e priorizar recuperacao. Monitoramento da aplicacao deve ser complementado pelo painel externo do provedor/uptime para detectar falha do proprio Supabase. Nao executar geracoes pagas como health check frequente.

Reversao: pausar novas admissoes/despachos, continuar recebendo callbacks e salvando imagens, drenar/reconciliar o aceito e restaurar somente versoes compativeis. Nao apagar jobs, reservations ou eventos; nao restaurar cegamente um backend antigo que ignore a fila nova. Usar migracao corretiva aditiva quando necessario.

## Modo limitado se o prazo acabar

Sem fila duravel validada, nao simular fila com timers no cliente nem liberar geracoes ilimitadas. Manter despacho imediato com um semaforo atomico no banco, teto de custo, uma geracao por dono e limite global definido pelo teste. Proposta conservadora de canario: 5-10 slots; reduzir se nem esse patamar passar.

Quando nao houver vaga, retornar alta demanda sem iniciar IA e sem debitar credito. Manter recuperacao do mesmo UUID, webhook, download e monitoramento. Essa alternativa sacrifica conversao no pico, mas preserva estabilidade e limita gasto. Nao anunciar capacidade alta neste modo.

Se nem identidade, idempotencia financeira, recuperacao ou limite de gasto passarem, deixar consulta/download disponiveis e manter novas geracoes pausadas ate corrigir. Lancamento comercial nao torna seguro ignorar esses criterios.

## Fora da vespera

- Liquidacao WordPress totalmente autonoma e protocolo de reserva/estorno.
- Upload direto, miniaturas e retencao automatizada, se nao forem exigidos pelos testes de lancamento.
- Novo sistema de cache, novo broker, multiplas regioes, provedor alternativo e mudanca de modelo.
- Reformulacao visual do painel; primeiro entregar metricas operacionais corretas.

Resultado esperado: lancamento com capacidade mensuravel e ajustavel, custo reservado antes de cada inferencia e recuperacao sem repetir geracao. A capacidade maxima publicada sera a comprovada nos testes e no aumento gradual, nao um numero inferido do nome do plano contratado.
