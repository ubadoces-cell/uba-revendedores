import { neon } from '@neondatabase/serverless';

export function databaseUrl(env = process.env) {
  const url = String(env.RESELLER_DATABASE_URL || env.RESELLER_DATABASE_DATABASE_URL || '').trim();
  if (!url) throw new Error('Banco exclusivo do Revendedores não configurado.');
  const parsed = new URL(url);
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) throw new Error('Conexão de banco inválida.');
  return url;
}

export function database() {
  const client = neon(databaseUrl());
  let verified;
  return {
    async query(statement, params = []) {
      verified ||= client.query('SELECT application FROM public.uba_database_identity WHERE id = 1', [])
        .then(rows => {
          if (rows[0]?.application !== 'uba-revendedores') throw new Error('Identidade do banco não corresponde ao Revendedores.');
        });
      await verified;
      return client.query(statement, params);
    },
  };
}
