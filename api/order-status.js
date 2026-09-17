import { createHash } from "node:crypto";
import { neon } from "@neondatabase/serverless";

function db() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) throw new Error("DATABASE_URL não configurada.");
  return neon(url);
}
function sha256(value) { return createHash("sha256").update(value).digest("hex"); }
function clean(value, max = 180) { return String(value || "").trim().slice(0, max); }

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Método não permitido." });
  try {
    const code = clean(req.query?.code, 80);
    const token = clean(req.query?.token, 120);
    if (!code || !token) return res.status(400).json({ error: "Identificação do pedido incompleta." });
    const rows = await db().query(`SELECT code, status, payment_status, paid_at, updated_at
      FROM reseller_orders WHERE code=$1 AND public_token_hash=$2 LIMIT 1`, [code, sha256(token)]);
    if (!rows[0]) return res.status(404).json({ error: "Pedido não encontrado." });
    return res.status(200).json({
      code: rows[0].code,
      status: rows[0].status,
      paymentStatus: rows[0].payment_status,
      paidAt: rows[0].paid_at || null,
      updatedAt: rows[0].updated_at,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Não foi possível consultar o pagamento." });
  }
}
