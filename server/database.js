import { neon } from "@neondatabase/serverless";

export function database() {
  const url = String(process.env.RESELLER_DATABASE_URL || "").trim();
  if (!url) {
    throw Object.assign(
      new Error("RESELLER_DATABASE_URL não configurada para o banco exclusivo do UBA Revendedores."),
      { statusCode: 503 },
    );
  }
  return neon(url);
}
