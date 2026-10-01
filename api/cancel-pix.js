import { createHash } from "node:crypto";
import { database } from "../server/database.js";

function db() { return database(); }
function sha256(value) { return createHash("sha256").update(String(value || "")).digest("hex"); }
function clean(value, max = 180) { return String(value || "").trim().slice(0, max); }

function asaasConfig() {
  const apiKey = String(process.env.ASAAS_API_KEY || "").trim();
  const environment = String(process.env.ASAAS_ENV || "sandbox").trim().toLowerCase();
  if (!apiKey) throw Object.assign(new Error("ASAAS_API_KEY não configurada na Vercel."), { statusCode: 503 });
  if (!["sandbox", "production"].includes(environment)) throw Object.assign(new Error("ASAAS_ENV deve ser sandbox ou production."), { statusCode: 503 });
  return {
    apiKey,
    baseUrl: environment === "production" ? "https://api.asaas.com/v3" : "https://api-sandbox.asaas.com/v3",
  };
}

async function cancelAsaasPayment(paymentId) {
  if (!paymentId) return;
  const { apiKey, baseUrl } = asaasConfig();
  const response = await fetch(`${baseUrl}/payments/${encodeURIComponent(paymentId)}`, {
    method: "DELETE",
    headers: { accept: "application/json", access_token: apiKey },
  });
  if (response.ok || response.status === 404) return;
  const data = await response.json().catch(() => ({}));
  const details = Array.isArray(data.errors)
    ? data.errors.map((item) => item.description).filter(Boolean).join(" ")
    : "";
  throw Object.assign(new Error(details || data.message || "Não foi possível cancelar o Pix anterior no Asaas."), {
    statusCode: response.status === 400 || response.status === 409 ? 409 : 502,
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido." });
  try {
    res.setHeader("Cache-Control", "no-store");
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const code = clean(body.code, 80);
    const publicToken = clean(body.publicToken, 120);
    if (!code || !publicToken) return res.status(400).json({ error: "Identificação do Pix anterior incompleta." });

    const sql = db();
    const rows = await sql.query(`SELECT id, payment_status, asaas_payment_id, stock_applied
      FROM reseller_orders WHERE code=$1 AND public_token_hash=$2 LIMIT 1`, [code, sha256(publicToken)]);
    const order = rows[0];
    if (!order) return res.status(404).json({ error: "Pix anterior não encontrado." });

    if (order.stock_applied || ["pago", "confirmado_asaas"].includes(String(order.payment_status || ""))) {
      return res.status(409).json({ error: "Esse Pix já foi confirmado e não pode ser substituído." });
    }

    await cancelAsaasPayment(order.asaas_payment_id);
    await sql.query(`DELETE FROM reseller_orders
      WHERE id=$1 AND COALESCE(stock_applied,FALSE)=FALSE
        AND COALESCE(payment_status,'') NOT IN ('pago','confirmado_asaas')`, [order.id]);

    return res.status(200).json({ cancelled: true, code });
  } catch (error) {
    console.error(error);
    return res.status(error.statusCode || 500).json({
      error: error.statusCode ? error.message : "Não foi possível substituir o Pix anterior.",
    });
  }
}
