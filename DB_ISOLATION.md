# Banco exclusivo do Revendedores

O portal usa apenas RESELLER_DATABASE_URL ou RESELLER_DATABASE_DATABASE_URL.
DATABASE_URL e POSTGRES_URL genéricas nunca são usadas.
Antes de qualquer consulta de negócio, confirma uba_database_identity.application = uba-revendedores.
A ausência dessa marca impede escritas e impede inicialização acidental no banco do Controles.

O schema de server/schema.sql só pode ser aplicado em um banco public vazio. A operação aborta se já houver tabelas.
O login administrativo deve ser provisionado de forma privada. Nenhuma credencial ou backup deve entrar neste repositório.
Clientes, pedidos, sessões e estoque são locais. Não há consulta a app_state, nem conexão com o banco do Controles.
A transferência do estoque de vendedores está desativada no servidor e na interface até implementação de API autorizada.

As configurações Asaas existentes permanecem válidas; não executar pagamentos reais em testes.
GET /api/health verifica conexão e identidade sem criar tabelas ou registros.

Validação: npm test executa login, cadastro administrativo de cliente, produção local e bloqueio de transferência em PostgreSQL local via PGlite, sem conexão externa.

Publicação: inicializar banco exclusivo, publicar branch de prévia, conferir saúde, promover produção e desconectar integração antiga somente no projeto uba-revendedores. Nunca alterar a conexão de uba-controles-okpf.
Reversão: banco antigo não foi alterado. Antes de restaurar um deploy anterior, proteger e reconciliar dados novos do portal. Não religar automaticamente o banco antigo.
