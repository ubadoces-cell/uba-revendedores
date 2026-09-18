import { createHash, randomBytes } from "node:crypto";
import { requireAdmin } from "../server/admin-auth.js";
import { currentCustomer } from "../server/customer-auth.js";
import { database } from "../server/database.js";

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
};

function sha256(value) { return createHash("sha256").update(value).digest("hex"); }
function clean(value, max = 180) { return String(value || "").trim().slice(0, max); }
function digits(value) { return String(value || "").replace(/\D/g, ""); }
function int(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.trunc(number)) : 0;
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
  await sql.query(`ALTER TABLE reseller_orders
    ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'aguardando_pagamento',
    ADD COLUMN IF NOT EXISTS asaas_customer_id TEXT,
    ADD COLUMN IF NOT EXISTS asaas_payment_id TEXT,
    ADD COLUMN IF NOT EXISTS pix_payload TEXT,
    ADD COLUMN IF NOT EXISTS pix_encoded_image TEXT,
    ADD COLUMN IF NOT EXISTS pix_expiration_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS public_token_hash TEXT,
    ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS stock_applied BOOLEAN NOT NULL DEFAULT FALSE`, []);
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
function serialize(row, includePix = false) {
  const order = {
    id: row.id,
    code: row.code,
    status: row.status,
    paymentStatus: row.payment_status || "aguardando_pagamento",
    paidAt: row.paid_at || null,
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
  if (includePix) {
    order.payment = {
      status: order.paymentStatus,
      payload: row.pix_payload || "",
      encodedImage: row.pix_encoded_image || "",
      expirationAt: row.pix_expiration_at || null,
    };
  }
  return order;
}
function asaasConfig() {
  const apiKey = String(process.env.ASAAS_API_KEY || "").trim();
  const environment = String(process.env.ASAAS_ENV || "sandbox").trim().toLowerCase();
  if (!apiKey) throw Object.assign(new Error("ASAAS_API_KEY não configurada na Vercel."), { statusCode: 503 });
  if (!["sandbox", "production"].includes(environment)) {
    throw Object.assign(new Error("ASAAS_ENV deve ser sandbox ou production."), { statusCode: 503 });
  }
  return {
    apiKey,
    baseUrl: environment === "production" ? "https://api.asaas.com/v3" : "https://api-sandbox.asaas.com/v3",
  };
}
async function asaas(path, options = {}) {
  const { apiKey, baseUrl } = asaasConfig();
  const response = await fetch(baseUrl + path, {
    ...options,
    headers: {
      accept: "application/json",
      access_token: apiKey,
      "content-type": "application/json",
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const details = Array.isArray(data.errors) ? data.errors.map((item) => item.description).filter(Boolean).join(" ") : "";
    throw Object.assign(new Error(details || data.message || "O Asaas recusou a solicitação."), { statusCode: 502 });
  }
  return data;
}
async function findOrCreateCustomer(customer) {
  const found = await asaas(`/customers?cpfCnpj=${encodeURIComponent(customer.doc)}&limit=1`);
  if (Array.isArray(found.data) && found.data[0]?.id) return found.data[0].id;
  const created = await asaas("/customers", {
    method: "POST",
    body: JSON.stringify({
      name: customer.name,
      cpfCnpj: customer.doc,
      email: customer.email || undefined,
      mobilePhone: customer.phone || undefined,
      externalReference: customer.reference,
      notificationDisabled: false,
    }),
  });
  if (!created.id) throw Object.assign(new Error("O Asaas não retornou o cliente criado."), { statusCode: 502 });
  return created.id;
}
function dueDateTomorrow() {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

export default async function handler(req, res) {
  let insertedOrderId = "";
  try {
    const sql = database();
    await ensureSchema(sql);

    if (req.method === "POST") {
      asaasConfig();
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
      const account = await currentCustomer(req, sql);
      if (!account || account.status !== "approved") {
        return res.status(401).json({ error: "Entre com uma conta aprovada para gerar o pedido." });
      }
      const purpose = "commerce";
      const calculated = calculate(normalizeItems(body.items), purpose);
      if (calculated.units < 50) return res.status(400).json({ error: "O pedido mínimo é de 50 unidades." });

      const buyer = body.buyer && typeof body.buyer === "object" ? body.buyer : {};
      const delivery = body.delivery && typeof body.delivery === "object" ? body.delivery : {};
      const customerName = clean(buyer.name || account.name, 140);
      const customerDoc = digits(buyer.doc || account.doc);
      if (!customerName) return res.status(400).json({ error: "Informe o nome do comprador." });
      if (![11, 14].includes(customerDoc.length)) {
        return res.status(400).json({ error: "Informe um CPF ou CNPJ válido para gerar o Pix." });
      }

      const id = randomBytes(16).toString("hex");
      insertedOrderId = id;
      const publicToken = randomBytes(24).toString("hex");
      const code = `UBA-${Date.now().toString(36).toUpperCase()}-${randomBytes(2).toString("hex").toUpperCase()}`;
      const safeDelivery = {
        cep: clean(delivery.cep, 20),
        city: clean(delivery.city, 100),
        street: clean(delivery.street, 180),
        number: clean(delivery.number, 30),
        complement: clean(delivery.complement, 120),
      };
      const email = clean(account.email, 180);
      const phone = clean(account.phone, 60);
      await sql.query(`INSERT INTO reseller_orders
        (id, code, status, payment_status, public_token_hash, customer_name, customer_email, customer_phone,
         customer_store, customer_doc, purpose, delivery, items, units, total_cents)
        VALUES ($1,$2,'novo','aguardando_pagamento',$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12,$13)`, [
        id, code, sha256(publicToken), customerName, email, phone,
        clean(buyer.store || account.store, 140), customerDoc, purpose,
        JSON.stringify(safeDelivery), JSON.stringify(calculated.items), calculated.units, calculated.totalCents,
      ]);
      await sql.query(`UPDATE reseller_customer_accounts SET
        name=$2,doc=$3,doc_norm=$4,store=$5,address_cep=$6,address_city=$7,address_street=$8,
        address_number=$9,address_complement=$10,updated_at=NOW() WHERE id=$1`, [
        account.id, customerName, customerDoc, customerDoc, clean(buyer.store || account.store, 140),
        safeDelivery.cep, safeDelivery.city, safeDelivery.street, safeDelivery.number, safeDelivery.complement,
      ]);

      const asaasCustomerId = await findOrCreateCustomer({
        name: customerName, doc: customerDoc, email, phone, reference: code,
      });
      const payment = await asaas("/payments", {
        method: "POST",
        body: JSON.stringify({
          customer: asaasCustomerId,
          billingType: "PIX",
          value: calculated.totalCents / 100,
          dueDate: dueDateTomorrow(),
          description: `Pedido UBA Doces ${code}`,
          externalReference: code,
        }),
      });
      if (!payment.id) throw Object.assign(new Error("O Asaas não retornou a cobrança Pix."), { statusCode: 502 });
      const qr = await asaas(`/payments/${encodeURIComponent(payment.id)}/pixQrCode`);
      const rows = await sql.query(`UPDATE reseller_orders SET
        asaas_customer_id=$1, asaas_payment_id=$2, pix_payload=$3, pix_encoded_image=$4,
        pix_expiration_at=$5, updated_at=NOW() WHERE id=$6 RETURNING *`, [
        asaasCustomerId, payment.id, clean(qr.payload, 2000), clean(qr.encodedImage, 2000000),
        qr.expirationDate || null, id,
      ]);
      return res.status(201).json({ order: serialize(rows[0], true), publicToken });
    }

    const admin = await requireAdmin(req, sql);
    if (!admin) return res.status(401).json({ error: "Acesso administrativo necessário." });

    if (req.method === "GET") {
      const rows = await sql.query("SELECT * FROM reseller_orders ORDER BY created_at DESC LIMIT 200", []);
      return res.status(200).json({ orders: rows.map((row) => serialize(row, false)) });
    }

    if (req.method === "PATCH") {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
      const id = clean(body.id, 80);
      const status = clean(body.status, 40);
      if (!id || !STATUSES.includes(status)) return res.status(400).json({ error: "Pedido ou status inválido." });
      const rows = await sql.query(`UPDATE reseller_orders SET status = $1, updated_at = NOW()
        WHERE id = $2 RETURNING *`, [status, id]);
      if (!rows[0]) return res.status(404).json({ error: "Pedido não encontrado." });
      return res.status(200).json({ order: serialize(rows[0], false) });
    }

    return res.status(405).json({ error: "Método não permitido." });
  } catch (error) {
    console.error(error);
    if (insertedOrderId) {
      try {
        const sql = database();
        await sql.query("UPDATE reseller_orders SET payment_status='erro_pagamento', updated_at=NOW() WHERE id=$1", [insertedOrderId]);
      } catch { /* preserve original error */ }
    }
    return res.status(error.statusCode || 500).json({
      error: error.statusCode ? error.message : "Não foi possível gerar a cobrança Pix.",
    });
  }
}
