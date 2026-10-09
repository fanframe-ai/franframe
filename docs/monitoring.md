# Monitoramento e diagnóstico

O Status usa `system_status_snapshot()`, restrito a administradores, para agregar todas as amostras dos últimos 90 dias no banco. Os critérios atuais usam `probe_version=2`; observações antigas são preservadas, sem misturar critérios nos percentuais novos. Disponibilidade medida em 30 dias é a proporção de respostas disponíveis nas amostras, não uma promessa de uptime contínuo.

Health check roda a cada cinco minutos e verifica leitura do banco, API administrativa Auth, rota generation-status, handshake WebSocket, conta Replicate e uma referência pública de imagem. Não gera uma foto paga nem prova todos os fluxos. Resposta lenta bem-sucedida continua disponível. Falhas de conexão/5xx são confirmadas em uma segunda tentativa; falta de configuração ou autorização fica sem confirmação, e 429 fica disponível com restrições. A evidência expira após sete minutos. Falha de leitura do painel não é indisponibilidade dos serviços. Falha ao salvar a verificação retorna 503 e nunca sucesso aparente.

## Logs

As funções emitem JSON estruturado com evento, estágio, duração, HTTP, código e identificadores de requisição/geração/time. O header `x-fanframe-request-id` correlaciona resposta e logs Supabase. Worker, reserva, submissão incerta, reconciliação, salvamento, webhook, WordPress e liquidação registram falhas. Polls bem-sucedidos e worker ocioso não emitem um log por requisição.

No navegador, falhas de API/SDK, renderização e rejeições não tratadas usam o mesmo formato seguro, com um identificador local de diagnóstico. Mensagens brutas, payloads, fotos, tokens, códigos de handoff, URL assinada e senhas não são enviados aos logs. Os logs do frontend ficam no console do navegador; não existe coletor remoto de telemetria do cliente nesta versão. Para uma ocorrência, obtenha o request ID/UUID e procure nos logs da função correspondente no Supabase.

`GENERATION_ALERT_WEBHOOK` pode encaminhar alertas operacionais a um canal privado. Sem configurar esse destino, não há notificação externa imediata. Não coloque esse segredo no frontend. Limites financeiros e eventos incertos devem continuar sendo acompanhados no dashboard.

## Custos

Gerações 2K reservam US$ 0,09 e o painel soma os custos registrados por geração. Orçamento e exposição usam centavos inteiros e margem de segurança. Custos antigos desconhecidos não são inventados retroativamente, e a estimativa do painel não substitui a fatura Replicate.
