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

### Acesso rápido

- [Versão preservada antes do aviso](https://github.com/ubadoces-cell/uba-revendedores/tree/backup/2026-11-02-antes-aviso-login-whatsapp)
- [Histórico de commits do site](https://github.com/ubadoces-cell/uba-revendedores/commits/main/)

> Este é um backup **do código e dos arquivos do repositório**, não um backup automático dos pedidos, clientes ou dados da produção.
