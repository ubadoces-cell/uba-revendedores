# Bancos separados e integração UBA

## Fonte de verdade

- **UBA Revendedores (Neon/PostgreSQL):** clientes B2B, sessões, pedidos, pagamentos e eventos do Asaas.
- **UBA Controles (Neon/PostgreSQL na Vercel):** estoque físico, reservas, produção e histórico operacional.
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

Não reutilize `DATABASE_URL` do UBA Controles. A integração Neon existente cria `RESELLER_DATABASE_DATABASE_URL`, também aceita. Não há fallback para `DATABASE_URL` ou `POSTGRES_URL`. Se as duas variáveis exclusivas estiverem presentes com valores diferentes, o servidor recusa a conexão.

## Variável do UBA Controles

```text
UBA_INTEGRATION_SECRET=<mesmo segredo do UBA Revendedores>
```

## Implantação segura

1. Exportar/guardar backup do banco atual antes de qualquer migração.
2. Criar um Neon/PostgreSQL exclusivo para o UBA Revendedores.
3. Iniciar o banco exclusivo vazio. Por decisão do proprietário, não migrar os dados antigos e não apagá-los da origem.
4. Configurar as variáveis acima em ambiente de prévia.
5. Publicar primeiro o endpoint de integração do UBA Controles.
6. Validar cadastro, edição de perfil, login do CEO, criação de pedido e webhook em sandbox.
7. Conferir que um pedido pago movimenta o estoque no UBA Controles uma única vez.
8. Somente depois promover os dois projetos para produção.

O código não apaga nem migra dados automaticamente. A troca de banco só acontece quando `RESELLER_DATABASE_URL` é configurada no ambiente.
