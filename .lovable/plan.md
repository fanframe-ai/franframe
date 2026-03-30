
Objetivo: corrigir o download quando existe marca d’água, porque hoje ao falhar a aplicação da watermark o sistema cai no fallback errado e abre a URL da imagem em vez de baixar.

1. Corrigir o fallback de download no resultado
- Arquivo principal: `src/components/wizard/ResultScreen.tsx`
- Hoje o fluxo tenta:
  - buscar a imagem gerada
  - aplicar watermark via canvas
  - baixar
- Quando isso falha, o `catch` cria um `<a>` com `href = generatedImage`, o que em muitos navegadores apenas redireciona para a URL do bucket.
- Vou ajustar esse fallback para seguir o mesmo padrão que já funciona em:
  - `src/components/wizard/TestResultScreen.tsx`
  - `src/components/wizard/HistoryScreen.tsx`
- Ou seja: fazer `fetch` da imagem, converter para `Blob`, gerar `URL.createObjectURL(blob)` e só então disparar o download.

2. Deixar o fluxo com watermark mais robusto
- Ainda em `ResultScreen.tsx`, vou melhorar a lógica de `handleDownload` para ter dois caminhos claros:
  - sucesso: aplica watermark e baixa a imagem final
  - fallback: se a watermark falhar, baixa a imagem original por blob sem redirecionar o usuário
- Isso evita que qualquer erro de canvas/CORS/loading quebre a experiência.

3. Revisar o carregamento da marca d’água
- A função `applyWatermark` já usa `team?.watermark_url || "/watermark.webp"`.
- Vou manter essa lógica, mas estruturar melhor o tratamento de erro para que falhas no carregamento da watermark não acionem navegação acidental.
- Se necessário, o plano inclui também definir `crossOrigin` no asset da watermark para reduzir chance de problema em canvas com imagem do bucket.

4. Validar os cenários afetados
- Cenários a verificar após a implementação:
  - baixar foto com watermark personalizada
  - baixar foto quando a watermark estiver ausente
  - baixar foto quando a watermark existir mas falhar ao carregar
  - confirmar que em nenhum desses casos o navegador abre a URL da imagem
- Também vou conferir se o nome do arquivo continua correto com o slug do time.

Detalhes técnicos
- Causa raiz encontrada:
  - em `src/components/wizard/ResultScreen.tsx`, o `catch` final usa `link.href = generatedImage`
  - isso depende do comportamento do navegador e normalmente vira navegação para o arquivo remoto
- Referência do padrão correto já existente no projeto:
  - `src/components/wizard/TestResultScreen.tsx`
  - `src/components/wizard/HistoryScreen.tsx`
- Ajuste planejado:
```text
generatedImage/url remota
  -> fetch
  -> blob
  -> URL.createObjectURL(blob)
  -> anchor.download
  -> click()
  -> revokeObjectURL()
```

Impacto esperado
- O botão “Baixar Foto” volta a iniciar download automático mesmo quando a marca d’água dá erro.
- O usuário não será mais redirecionado para o link da imagem.
- O comportamento ficará consistente entre resultado normal, resultado de teste e histórico.
