import { neon } from "@neondatabase/serverless";

export function database() {
  const explicit = String(process.env.RESELLER_DATABASE_URL || "").trim();
  const integrated = String(process.env.RESELLER_DATABASE_DATABASE_URL || "").trim();
  if (explicit && integrated && explicit !== integrated) {
    throw Object.assign(new Error("Configurações de banco exclusivo conflitantes."), { statusCode: 503 });
  }
  const url = explicit || integrated;
  if (!url) {
    throw Object.assign(
      new Error("RESELLER_DATABASE_URL não configurada para o banco exclusivo do UBA Revendedores."),
      { statusCode: 503 },
    );
  }
  return neon(url);
}
