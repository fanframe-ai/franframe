# Documentação FanFrame

Esta página é o índice dos guias atuais. Comece pelo [README](../README.md), depois abra o documento correspondente à mudança:

- [Arquitetura e segurança](architecture.md)
- [Instalação, testes e fixtures](development.md)
- [Deploy e reversão](deployment.md)
- [Contrato de sessão, créditos e checkout WordPress](wordpress-integration.md)
- [Modelo de imagem, geração e webhook Replicate](replicate-integration.md)
- [Design system](design-system.md)

O projeto é multi-time: `teams` guarda configuração pública, `team_secrets` guarda tokens Replicate, `fanframe_sessions` identifica usuários WordPress por time, e `test_links` fornece créditos de homologação. O backend usa PostgreSQL e Edge Functions Deno no Supabase. O frontend usa React, TypeScript e Vite, publicado como SPA na Vercel.
