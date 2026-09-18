# Bancos separados e integração UBA

## Fonte de verdade

- **UBA Revendedores (Neon/PostgreSQL):** clientes B2B, sessões, pedidos, pagamentos e eventos do Asaas.
- **UBA Controles (D1):** estoque físico, reservas, produção e histórico operacional.
- Os bancos não compartilham credenciais nem tabelas.
- A comunicação ocorre exclusivamente por API servidor-servidor autenticada.

## Variáveis do UBA Revendedores

```text
RESELLER_DATABASE_URL=<conexão do Neon exclusiva deste projeto>
RESELLER_ADMIN_USERNAME=<login do CEO neste portal>
RESELLER_ADMIN_PASSWORD=<senha forte e exclusiva>
UBA_CONTROLES_API_URL=<URL pública do UBA Controles>
UBA_INTEGRATION_SECRET=<segredo longo, igual nos dois projetos>
ASAAS_API_KEY=<chave apenas do servidor>
ASAAS_ENV=sandbox|production
ASAAS_WEBHOOK_TOKEN=<token do webhook>
```

Não reutilize `DATABASE_URL` do UBA Controles. O código exige `RESELLER_DATABASE_URL` para impedir conexão acidental ao banco errado.

## Variável do UBA Controles

```text
UBA_INTEGRATION_SECRET=<mesmo segredo do UBA Revendedores>
```

## Implantação segura

1. Exportar/guardar backup do banco atual antes de qualquer migração.
2. Criar um Neon/PostgreSQL exclusivo para o UBA Revendedores.
3. Copiar para ele somente as tabelas `reseller_*` e `asaas_webhook_events`.
4. Configurar as variáveis acima em ambiente de prévia.
5. Publicar primeiro o endpoint de integração do UBA Controles.
6. Validar cadastro, edição de perfil, login do CEO, criação de pedido e webhook em sandbox.
7. Conferir que um pedido pago movimenta o estoque no UBA Controles uma única vez.
8. Somente depois promover os dois projetos para produção.

O código não apaga nem migra dados automaticamente. A troca de banco só acontece quando `RESELLER_DATABASE_URL` é configurada no ambiente.
