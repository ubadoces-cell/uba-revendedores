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

### Acesso rápido

- [Versão preservada antes do aviso](https://github.com/ubadoces-cell/uba-revendedores/tree/backup/2026-11-02-antes-aviso-login-whatsapp)
- [Versão preservada antes da aba Tabelas](https://github.com/ubadoces-cell/uba-revendedores/tree/backup/2026-11-02-antes-aba-tabelas)
- [Backup antes da grade de cards estilo marketplace](https://github.com/ubadoces-cell/uba-revendedores/tree/backup/2026-11-03-antes-grade-mercado-livre)
- [Backup antes do banner da aba Tabelas](https://github.com/ubadoces-cell/uba-revendedores/tree/backup/2026-11-03-antes-banner-tabelas)
- [Backup antes da correção do banner principal](https://github.com/ubadoces-cell/uba-revendedores/tree/backup/2026-11-03-antes-troca-hero-tabelas)
- [Histórico de commits do site](https://github.com/ubadoces-cell/uba-revendedores/commits/main/)

> Este é um backup **do código e dos arquivos do repositório**, não um backup automático dos pedidos, clientes ou dados da produção.
