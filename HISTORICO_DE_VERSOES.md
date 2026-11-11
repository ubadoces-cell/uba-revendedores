# Histórico de versões e backups — UBA Revendedores

Este arquivo documenta as cópias de segurança do site antes de alterações, para permitir que a UBA DOCES solicite a restauração de uma versão anterior.

## Procedimento para todas as próximas atualizações

1. Consultar o commit atual da branch `main`.
2. **Antes de modificar ou publicar**, criar uma branch separada chamada `backup/AAAA-MM-DD-descricao` apontando para o commit exato da versão vigente.
3. Fazer as alterações em uma branch de trabalho distinta, revisar o resultado e publicar por pull request.
4. Registrar aqui a branch do backup, o commit anterior e o motivo da atualização.
5. Se o proprietário solicitar uma volta, restaurar por um novo pull request a partir do backup correto, preservando o histórico. Alterações em pedidos, usuários ou banco de dados exigem avaliação específica, pois o backup de código não substitui backup de dados.

## Registro de versões

| Data | Atualização planejada | Versão anterior (commit) | Cópia de segurança |
|---|---|---|---|
| 2026-11-02 | Aviso de acesso por login e senha fornecidos pelo atendimento WhatsApp | `89d99c7801eb40a12060a2bd37708c9c6db51d27` | `backup/2026-11-02-antes-aviso-login-whatsapp` |
| 2026-11-02 | Nova aba Tabelas protegida por login; frete fixo de R$ 5,00 nos bairros atendidos de Limoeiro do Norte | `206cb9ebad0e28625052111f66ff1e16a56e05a6` | `backup/2026-11-02-antes-aba-tabelas` |
| 2026-11-03 | Produtos em cards de marketplace: 4 colunas no desktop e 3 nas demais telas, respeitando cores e funcionalidades anteriores | `ca7bebf87506bdb70bdc5597ed30df35e91c23a3` | `backup/2026-11-03-antes-grade-mercado-livre` |
| 2026-11-03 | Banner de benefícios na aba Tabelas, inspirado na referência enviada pelo cliente e com +60 comerciantes, regras da revenda e CTA | `37a997ce76934824ee700cd6c9531f17fea5daa1` | `backup/2026-11-03-antes-banner-tabelas` |
| 2026-11-03 | Correção solicitada: remover banner duplicado; alternar o banner original do topo ao abrir Tabelas, voltando ao original em Catálogo | `9b378976cad2d4c5293ab36aafc84cc489b398a2` | `backup/2026-11-03-antes-troca-hero-tabelas` |
| 2026-11-03 | Detalhar as vantagens no banner principal quando abrir Tabelas: exemplo de lucro bruto, comparativo de preços, vantagens e segmentos de revenda | `18db61f32a48f191c04495c64850cfa6eee1ef88` | `backup/2026-11-03-antes-vantagens-hero-tabelas` |
| 2026-11-03 | Frete fixo alterado de R$ 5,00 para R$ 4,99 nos bairros atendidos de Limoeiro do Norte, incluindo banner, API, checkout e Pix | `a193acec61206eafb08191a31000945818484a16` | `backup/2026-11-03-antes-frete-499` |
| 2026-11-03 | Unificar frete R$ 4,99 e navegação inferior Catálogo/Tabelas Liquid Glass (2 opções), com login protegido | `34f0b14cde3cecf98cf03ceba712627511a95b88` | `backup/2026-11-03-apos-frete-499-antes-liquid-glass` |
| 2026-11-03 | Melhorar legibilidade do vidro roxo na navegação Catálogo/Tabelas e evitar zoom automático ao focar quantidade no iPhone | `8b7caa7e63cb3cee310f9a3d81e0a1b0db900063` | `backup/2026-11-03-antes-vidro-roxo-sem-zoom` |
| 2026-11-03 | Remover impressão/PDF da tabela e reservar consulta integral para sessão segura do CEO (cliente comum, mesmo aprovado, recebe acesso negado) | `f29eeef79192935f30ca99a2c0891ad29cc5f12f` | `backup/2026-11-03-antes-tabela-exclusiva-ceo` |
| 2026-11-03 | Corrigir resumo Pix com subtotal de alfajores pela faixa de quantidade, frete de R$ 4,99 e cotação oficial do servidor antes de gerar cobrança | `43097f9372346970e2d319f0a44a099d0c9bf5e5` | `backup/2026-11-03-antes-resumo-pix` |
| 2026-11-04 | Restaurar Liquid Glass Catálogo/Tabelas e liberar tabela completa a contas comerciais aprovadas; demais sem login permanecem bloqueadas | `96b96440f0beaedf9279eeef619ddeccef4f341f` | `backup/2026-11-04-antes-tabela-revendedor-aprovado` |
| 2026-11-05 | Redesign visual Atelier UBA v2.1: banner ametista, vitrine escura, profundidade suave, novos estados e transições responsivas, preservando regras de negócio | `68e11f2b38f86525f0c417b116808beb0725d159` | `backup/2026-11-05-antes-redesign-atelier` |
| 2026-11-05 | Corrigir contraste integral no modo claro (catálogo, banners, tabela, carrinho e Pix), reposicionando resumo móvel acima do Liquid Glass | `21df653662f43dd8a743fa1ee7fbfb01ca2606fb` | `backup/2026-11-05-antes-contraste-claro-carrinho` |
| 2026-11-05 | Simplificar banner inicial e criar aba Informações no Liquid Glass, com guia de acesso, vantagens, dúvidas, frete e Pix sem expor tabela de revenda | `652ddde81133d5720d4078c736e8e5c61b035e22` | `backup/2026-11-05-antes-informacoes-liquid-glass` |
| 2026-11-11 | Redesign visual "Noite UBA" v3.0: fundo noturno com grade fina, vidro, cápsulas, destaque lilás com brilho e Lora itálico; só CSS, sem mexer em dados, preços, estoque, pedidos ou Pix | `dac32b4b26004177936734364649f155b0ff9243` | `backup/2026-11-11-antes-noite-uba` |
| 2026-11-11 | v3.1: mesmo visual no modo claro ("Dia UBA"), remoção da linha escura nas fotos dos alfajores e abas inferiores legíveis; só CSS | `3c341949dc504f07ca532a8a25d719b799b88805` | `backup/2026-11-11-antes-modo-claro` |

### Acesso rápido

- [Versão preservada antes do aviso](https://github.com/ubadoces-cell/uba-revendedores/tree/backup/2026-11-02-antes-aviso-login-whatsapp)
- [Versão preservada antes da aba Tabelas](https://github.com/ubadoces-cell/uba-revendedores/tree/backup/2026-11-02-antes-aba-tabelas)
- [Backup antes da grade de cards estilo marketplace](https://github.com/ubadoces-cell/uba-revendedores/tree/backup/2026-11-03-antes-grade-mercado-livre)
- [Backup antes do banner da aba Tabelas](https://github.com/ubadoces-cell/uba-revendedores/tree/backup/2026-11-03-antes-banner-tabelas)
- [Backup antes da correção do banner principal](https://github.com/ubadoces-cell/uba-revendedores/tree/backup/2026-11-03-antes-troca-hero-tabelas)
- [Backup antes de detalhar vantagens no banner Tabelas](https://github.com/ubadoces-cell/uba-revendedores/tree/backup/2026-11-03-antes-vantagens-hero-tabelas)
- [Backup antes da redução do frete para R$ 4,99](https://github.com/ubadoces-cell/uba-revendedores/tree/backup/2026-11-03-antes-frete-499)
- [Backup antes da barra Liquid Glass (após frete R$ 4,99)](https://github.com/ubadoces-cell/uba-revendedores/tree/backup/2026-11-03-apos-frete-499-antes-liquid-glass)
- [Backup antes do vidro roxo e correção de zoom](https://github.com/ubadoces-cell/uba-revendedores/tree/backup/2026-11-03-antes-vidro-roxo-sem-zoom)
- [Backup antes de tornar a tabela exclusiva do CEO](https://github.com/ubadoces-cell/uba-revendedores/tree/backup/2026-11-03-antes-tabela-exclusiva-ceo)
- [Backup antes de corrigir resumo Pix](https://github.com/ubadoces-cell/uba-revendedores/tree/backup/2026-11-03-antes-resumo-pix)
- [Backup antes de restaurar o acesso comercial à Tabela](https://github.com/ubadoces-cell/uba-revendedores/tree/backup/2026-11-04-antes-tabela-revendedor-aprovado)
- [Backup completo antes do redesign Atelier UBA v2.1](https://github.com/ubadoces-cell/uba-revendedores/tree/backup/2026-11-05-antes-redesign-atelier)
- [Backup antes de corrigir contraste do modo claro e carrinho](https://github.com/ubadoces-cell/uba-revendedores/tree/backup/2026-11-05-antes-contraste-claro-carrinho)
- [Backup antes de incluir Informações no Liquid Glass](https://github.com/ubadoces-cell/uba-revendedores/tree/backup/2026-11-05-antes-informacoes-liquid-glass)
- [Backup antes do visual Noite UBA v3.0](https://github.com/ubadoces-cell/uba-revendedores/tree/backup/2026-11-11-antes-noite-uba)
- [Backup antes do modo claro v3.1](https://github.com/ubadoces-cell/uba-revendedores/tree/backup/2026-11-11-antes-modo-claro)
- [Histórico de commits do site](https://github.com/ubadoces-cell/uba-revendedores/commits/main/)

> Este é um backup **do código e dos arquivos do repositório**, não um backup automático dos pedidos, clientes ou dados da produção.
