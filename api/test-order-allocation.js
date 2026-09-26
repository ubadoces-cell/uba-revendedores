import { createHash } from "node:crypto";
import { database } from "../server/database.js";

const SESSION_COOKIE = "uba_rev_session";
const PRODUCT_IDS = new Set(["pistache", "chocolate50", "branco", "caramelo", "morango"]);

function db() { return database(); }
function clean(value, max = 180) { return String(value || "").trim().slice(0, max); }
function int(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0;
}
function cookie(req, name) {
  for (const part of String(req.headers.cookie || "").split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return "";
}
function sha256(value) { return createHash("sha256").update(value).digest("hex"); }

async function requireAdmin(req, sql) {
  const token = cookie(req, SESSION_COOKIE);
  if (!token) return null;
  const rows = await sql.query(`SELECT a.id, a.username FROM sessions s JOIN accounts a ON a.id=s.account_id
    WHERE s.token_hash=$1 AND s.expires_at>$2 AND a.active=1 AND a.role='admin' LIMIT 1`,
    [sha256(token), new Date().toISOString()]);
  return rows[0] || null;
}

async function ensureSchema(sql) {
  await sql.query(`CREATE TABLE IF NOT EXISTS reseller_test_orders(
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL DEFAULT 'novo',
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`, []);
}

function normalizeAllocation(orderData, raw) {
  const requested = new Map((Array.isArray(orderData?.items) ? orderData.items : []).map((item) => [String(item.productId || ""), int(item.quantity)]));
  const result = [];
  for (const entry of Array.isArray(raw) ? raw : []) {
    const productId = clean(entry?.productId, 40);
    if (!PRODUCT_IDS.has(productId) || !requested.has(productId)) continue;
    const sellers = int(entry.sellers);
    const reseller = int(entry.reseller);
    const toMake = int(entry.toMake);
    const ordered = requested.get(productId) || 0;
    if (sellers + reseller + toMake !== ordered) {
      throw Object.assign(new Error(`A divisão de ${productId} precisa somar ${ordered}.`), { statusCode: 400 });
    }
    result.push({ productId, sellers, reseller, toMake, ordered });
  }
  if (result.length !== requested.size) {
    throw Object.assign(new Error("Defina a origem de todos os sabores do pedido de teste."), { statusCode: 400 });
  }
  return result;
}

export default async function handler(req, res) {
  try {
    res.setHeader("Cache-Control", "no-store");
    const sql = db();
    await ensureSchema(sql);
    const admin = await requireAdmin(req, sql);
    if (!admin) return res.status(401).json({ error: "Acesso administrativo necessário." });

    if (req.method === "GET") {
      const id = clean(req.query?.id, 100);
      if (!id.startsWith("test_")) return res.status(400).json({ error: "Pedido de teste inválido." });
      const rows = await sql.query("SELECT id,status,data FROM reseller_test_orders WHERE id=$1 LIMIT 1", [id]);
      if (!rows[0]) return res.status(404).json({ error: "Pedido de teste não encontrado." });
      return res.status(200).json({
        id,
        status: rows[0].status,
        allocation: Array.isArray(rows[0].data?.productionAllocation) ? rows[0].data.productionAllocation : [],
        savedAt: rows[0].data?.productionAllocationSavedAt || null,
      });
    }

    if (req.method === "PATCH" || req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
      const id = clean(body.id, 100);
      if (!id.startsWith("test_")) return res.status(400).json({ error: "Pedido de teste inválido." });
      const rows = await sql.query("SELECT id,status,data FROM reseller_test_orders WHERE id=$1 LIMIT 1", [id]);
      if (!rows[0]) return res.status(404).json({ error: "Pedido de teste não encontrado." });
      const allocation = normalizeAllocation(rows[0].data || {}, body.allocations);
      const nextData = {
        ...(rows[0].data || {}),
        productionAllocation: allocation,
        productionAllocationSavedAt: new Date().toISOString(),
      };
      await sql.query("UPDATE reseller_test_orders SET data=$2::jsonb,updated_at=NOW() WHERE id=$1", [id, JSON.stringify(nextData)]);
      return res.status(200).json({ ok: true, id, allocation, stockChanged: false });
    }

    return res.status(405).json({ error: "Método não permitido." });
  } catch (error) {
    console.error(error);
    return res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : "Não foi possível salvar a divisão do pedido de teste." });
  }
}
