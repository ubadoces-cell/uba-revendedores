import { createHash, randomBytes } from "node:crypto";
import { neon } from "@neondatabase/serverless";

const SESSION_COOKIE = "uba_rev_session";
const STATUSES = ["novo", "confirmado", "em_producao", "pronto", "concluido", "cancelado"];
const PRODUCTS = {
  pistache: { name: "Pistache", group: "pistache" },
  chocolate50: { name: "Chocolate 50%", group: "chocolate50" },
  branco: { name: "Chocolate Branco", group: "standard" },
  caramelo: { name: "Caramelo", group: "standard" },
  morango: { name: "Morango", group: "standard" },
};
const PRICING = {
  commerce: [
    { min: 50, max: 99, chocolate50: 460, standard: 510, pistache: 610 },
    { min: 100, max: 199, chocolate50: 455, standard: 488, pistache: 553 },
    { min: 200, max: 399, chocolate50: 420, standard: 450, pistache: 510 },
    { min: 400, max: null, chocolate50: 385, standard: 413, pistache: 468 },
  ],
  event: [
    { min: 50, max: 99, chocolate50: 460, standard: 510, pistache: 610 },
    { min: 100, max: 199, chocolate50: 459, standard: 491, pistache: 557 },
    { min: 200, max: 399, chocolate50: 438, standard: 469, pistache: 531 },
    { min: 400, max: null, chocolate50: 420, standard: 450, pistache: 510 },
  ],
};

function db() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) throw new Error("DATABASE_URL não configurada.");
  return neon(url);
}
function sha256(value) { return createHash("sha256").update(value).digest("hex"); }
function clean(value, max = 180) { return String(value || "").trim().slice(0, max); }
function int(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.trunc(number)) : 0;
}
function cookie(req, name) {
  for (const part of String(req.headers.cookie || "").split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return "";
}
async function requireAdmin(req, sql) {
  const token = cookie(req, SESSION_COOKIE);
  if (!token) return null;
  const rows = await sql.query(`SELECT a.id, a.username FROM sessions s JOIN accounts a ON a.id = s.account_id
    WHERE s.token_hash = $1 AND s.expires_at > $2 AND a.active = 1 AND a.role = 'admin' LIMIT 1`,
    [sha256(token), new Date().toISOString()]);
  return rows[0] || null;
}
async function ensureSchema(sql) {
  await sql.query(`CREATE TABLE IF NOT EXISTS reseller_orders (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL DEFAULT '',
    customer_phone TEXT NOT NULL DEFAULT '',
    customer_store TEXT NOT NULL DEFAULT '',
    customer_doc TEXT NOT NULL DEFAULT '',
    purpose TEXT NOT NULL,
    delivery JSONB NOT NULL,
    items JSONB NOT NULL,
    units INTEGER NOT NULL,
    total_cents INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`, []);
}
function normalizeItems(rawItems) {
  const merged = new Map();
  for (const raw of Array.isArray(rawItems) ? rawItems : []) {
    const productId = clean(raw?.productId, 40);
    const quantity = int(raw?.quantity);
    if (!PRODUCTS[productId] || !quantity) continue;
    merged.set(productId, (merged.get(productId) || 0) + quantity);
  }
  return [...merged.entries()].map(([productId, quantity]) => ({
    productId, name: PRODUCTS[productId].name, quantity,
  }));
}
function calculate(items, purpose) {
  const units = items.reduce((sum, item) => sum + item.quantity, 0);
  const tiers = PRICING[purpose] || PRICING.commerce;
  const tier = tiers.find((item) => units >= item.min && (item.max === null || units <= item.max));
  if (!tier) return { units, totalCents: 0, items };
  let totalCents = 0;
  const pricedItems = items.map((item) => {
    const unitCents = tier[PRODUCTS[item.productId].group];
    const subtotalCents = unitCents * item.quantity;
    totalCents += subtotalCents;
    return { ...item, unitCents, subtotalCents };
  });
  return { units, totalCents, items: pricedItems };
}
function serialize(row) {
  return {
    id: row.id,
    code: row.code,
    status: row.status,
    customer: {
      name: row.customer_name,
      email: row.customer_email,
      phone: row.customer_phone,
      store: row.customer_store,
      doc: row.customer_doc,
    },
    purpose: row.purpose,
    delivery: row.delivery,
    items: row.items,
    units: Number(row.units),
    totalCents: Number(row.total_cents),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export default async function handler(req, res) {
  try {
    const sql = db();
    await ensureSchema(sql);

    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
      const purpose = body.purpose === "event" ? "event" : "commerce";
      const calculated = calculate(normalizeItems(body.items), purpose);
      if (calculated.units < 50) return res.status(400).json({ error: "O pedido mínimo é de 50 unidades." });

      const customer = body.customer && typeof body.customer === "object" ? body.customer : {};
      const buyer = body.buyer && typeof body.buyer === "object" ? body.buyer : {};
      const delivery = body.delivery && typeof body.delivery === "object" ? body.delivery : {};
      const customerName = clean(buyer.name || customer.name, 140);
      if (!customerName) return res.status(400).json({ error: "Informe o nome do comprador." });

      const id = randomBytes(16).toString("hex");
      const code = `UBA-${Date.now().toString(36).toUpperCase()}-${randomBytes(2).toString("hex").toUpperCase()}`;
      const safeDelivery = {
        cep: clean(delivery.cep, 20),
        city: clean(delivery.city, 100),
        street: clean(delivery.street, 180),
        number: clean(delivery.number, 30),
        complement: clean(delivery.complement, 120),
      };
      const rows = await sql.query(`INSERT INTO reseller_orders
        (id, code, status, customer_name, customer_email, customer_phone, customer_store, customer_doc, purpose, delivery, items, units, total_cents)
        VALUES ($1,$2,'novo',$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11,$12)
        RETURNING *`, [
        id, code, customerName, clean(customer.email, 180), clean(customer.phone, 60),
        clean(buyer.store || customer.store, 140), clean(buyer.doc || customer.doc, 40), purpose,
        JSON.stringify(safeDelivery), JSON.stringify(calculated.items), calculated.units, calculated.totalCents,
      ]);
      return res.status(201).json({ order: serialize(rows[0]) });
    }

    const admin = await requireAdmin(req, sql);
    if (!admin) return res.status(401).json({ error: "Acesso administrativo necessário." });

    if (req.method === "GET") {
      const rows = await sql.query("SELECT * FROM reseller_orders ORDER BY created_at DESC LIMIT 200", []);
      return res.status(200).json({ orders: rows.map(serialize) });
    }

    if (req.method === "PATCH") {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
      const id = clean(body.id, 80);
      const status = clean(body.status, 40);
      if (!id || !STATUSES.includes(status)) return res.status(400).json({ error: "Pedido ou status inválido." });
      const rows = await sql.query(`UPDATE reseller_orders SET status = $1, updated_at = NOW()
        WHERE id = $2 RETURNING *`, [status, id]);
      if (!rows[0]) return res.status(404).json({ error: "Pedido não encontrado." });
      return res.status(200).json({ order: serialize(rows[0]) });
    }

    return res.status(405).json({ error: "Método não permitido." });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Não foi possível processar os pedidos." });
  }
}
