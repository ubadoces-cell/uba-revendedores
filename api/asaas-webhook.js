import { timingSafeEqual } from "node:crypto";
import { database } from "../server/database.js";

function db() {
  return database();
}
function safeEqual(left, right) {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  return a.length === b.length && timingSafeEqual(a, b);
}
async function ensureSchema(sql) {
  await sql.query(`CREATE TABLE IF NOT EXISTS asaas_webhook_events (
    event_id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    payment_id TEXT,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`, []);
  await sql.query(`ALTER TABLE reseller_orders
    ADD COLUMN IF NOT EXISTS production_allocation JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS customer_note TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS stock_applied BOOLEAN NOT NULL DEFAULT FALSE`, []);
}
function paymentStatusFor(event) {
  return ({
    PAYMENT_CREATED: "aguardando_pagamento",
    PAYMENT_UPDATED: "aguardando_pagamento",
    PAYMENT_CONFIRMED: "confirmado_asaas",
    PAYMENT_RECEIVED: "pago",
    PAYMENT_OVERDUE: "vencido",
    PAYMENT_DELETED: "cancelado",
    PAYMENT_REFUNDED: "estornado",
    PAYMENT_REFUND_IN_PROGRESS: "estorno_em_andamento",
    PAYMENT_CHARGEBACK_REQUESTED: "contestacao",
    PAYMENT_CHARGEBACK_DISPUTE: "contestacao",
  })[event] || "";
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido." });
  const expected = String(process.env.ASAAS_WEBHOOK_TOKEN || "");
  const received = String(req.headers["asaas-access-token"] || "");
  if (!expected || !safeEqual(received, expected)) return res.status(401).json({ error: "Webhook não autorizado." });

  const sql = db();
  let eventId = "";
  try {
    await ensureSchema(sql);
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    eventId = String(body.id || "").slice(0, 160);
    const eventType = String(body.event || "").slice(0, 80);
    const paymentId = String(body.payment?.id || "").slice(0, 120);
    const externalReference = String(body.payment?.externalReference || "").slice(0, 120);
    if (!eventId || !eventType || !paymentId) return res.status(400).json({ error: "Evento inválido." });

    const inserted = await sql.query(`INSERT INTO asaas_webhook_events(event_id,event_type,payment_id)
      VALUES($1,$2,$3) ON CONFLICT(event_id) DO NOTHING RETURNING event_id`,
      [eventId, eventType, paymentId]);
    if (!inserted[0]) return res.status(200).json({ received: true, duplicate: true });

    const orders = await sql.query(`SELECT * FROM reseller_orders
      WHERE asaas_payment_id=$1 OR code=$2 ORDER BY created_at DESC LIMIT 1`,
      [paymentId, externalReference]);
    const order = orders[0];
    if (!order) return res.status(200).json({ received: true, unmatched: true });

    const paymentStatus = paymentStatusFor(eventType);
    if (paymentStatus) {
      if (eventType === "PAYMENT_RECEIVED") {
        await sql.query(`UPDATE reseller_orders SET payment_status='pago',
          status=CASE WHEN status='novo' THEN 'confirmado' ELSE status END,
          paid_at=COALESCE(paid_at,NOW()), updated_at=NOW() WHERE id=$1`, [order.id]);
        // A origem física (Vendedores / Revendedores / Fabricar) é escolhida manualmente pelo CEO
        // quando o pedido entra em Produção. O webhook não movimenta estoque automaticamente.
      } else {
        await sql.query("UPDATE reseller_orders SET payment_status=$1, updated_at=NOW() WHERE id=$2", [paymentStatus, order.id]);
      }
    }
    return res.status(200).json({ received: true });
  } catch (error) {
    console.error(error);
    if (eventId) {
      try { await sql.query("DELETE FROM asaas_webhook_events WHERE event_id=$1", [eventId]); } catch {}
    }
    return res.status(500).json({ error: "Não foi possível processar o webhook." });
  }
}
