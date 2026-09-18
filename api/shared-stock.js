import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { neon } from "@neondatabase/serverless";

const PRODUCT_MAP = {
  chocolate50: { id: "p1", name: "Chocolate 50% cacau" },
  branco: { id: "p2", name: "Chocolate branco" },
  caramelo: { id: "p3", name: "Caramelo" },
  morango: { id: "p4", name: "Morango" },
  pistache: { id: "p5", name: "Pistache" },
};
const REVERSE_MAP = Object.fromEntries(Object.entries(PRODUCT_MAP).map(([key, value]) => [value.id, key]));
const SESSION_COOKIE = "uba_rev_session";

function db() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) throw new Error("DATABASE_URL não configurada.");
  return neon(url);
}
function int(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0;
}
function parseCookie(req, name) {
  for (const part of String(req.headers.cookie || "").split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return "";
}
function sha256(value) { return createHash("sha256").update(value).digest("hex"); }
function safeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && timingSafeEqual(a, b);
}
async function ensureSchema(sql) {
  await sql.query(`CREATE TABLE IF NOT EXISTS shared_stock_state (
    id INTEGER PRIMARY KEY,
    data TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`, []);
  await sql.query(`CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP::text)
  )`, []);
}
function emptyState() {
  return {
    products: Object.fromEntries(Object.values(PRODUCT_MAP).map((product) => [product.id, { sellers: 0, reseller: 0, separated: 0, toMake: 0 }])),
    history: [],
  };
}
function historyItem(value) {
  const item = value && typeof value === "object" ? value : {};
  const productId = String(item.productId || "");
  if (!Object.values(PRODUCT_MAP).some((product) => product.id === productId)) return null;
  const rawType = String(item.type || item.tipo || "adjustment");
  const type = ({
    vendedores_para_pedido: "sellers_to_order",
    producao_pedido: "production",
    producao_revendedores: "production",
    ajuste: "order",
  })[rawType] || rawType;
  return {
    id: String(item.id || randomBytes(16).toString("hex")),
    type,
    productId,
    productName: String(item.productName || item.produtoNome || productId),
    qty: int(item.qty ?? item.quantidade),
    note: String(item.note || item.observacao || ""),
    at: String(item.at || item.criadoEm || new Date().toISOString()),
    actor: String(item.actor || item.criadoPor || "CEO"),
  };
}
function normalize(value) {
  const state = emptyState();
  if (value && typeof value === "object") {
    for (const productId of Object.keys(state.products)) {
      const item = value.products?.[productId] || {};
      state.products[productId] = {
        sellers: int(item.sellers), reseller: int(item.reseller),
        separated: int(item.separated), toMake: int(item.toMake),
      };
    }
    state.history = Array.isArray(value.history) ? value.history.map(historyItem).filter(Boolean).slice(0, 200) : [];
  }
  return state;
}
async function loadState(sql) {
  const rows = await sql.query(`SELECT data FROM shared_stock_state WHERE id = 1`, []);
  if (rows[0]) {
    try { return normalize(JSON.parse(rows[0].data)); } catch { /* seed below */ }
  }
  const state = emptyState();
  let appRows = [];
  try { appRows = await sql.query(`SELECT data FROM app_state WHERE id = 1`, []); } catch { appRows = []; }
  if (appRows[0]) {
    try {
      const app = JSON.parse(appRows[0].data);
      for (const product of Object.values(PRODUCT_MAP)) {
        state.products[product.id] = {
          sellers: int(app.estoque?.porSabor?.[product.id]),
          reseller: int(app.estoque?.revendedoresPorSabor?.[product.id]),
          separated: int(app.estoque?.separadoPedidosPorSabor?.[product.id]),
          toMake: int(app.estoque?.fabricarRevendedoresPorSabor?.[product.id]),
        };
      }
      state.history = Array.isArray(app.estoque?.historicoCompartilhado) ? app.estoque.historicoCompartilhado.slice(0, 200) : [];
    } catch { /* keep empty */ }
  }
  await saveState(sql, state);
  return state;
}
async function saveState(sql, state) {
  const now = new Date().toISOString();
  await sql.query(`INSERT INTO shared_stock_state (id, data, updated_at) VALUES (1, $1, $2)
    ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`, [JSON.stringify(normalize(state)), now]);
  return normalize(state);
}
async function requireAdmin(req, sql) {
  const token = parseCookie(req, SESSION_COOKIE);
  if (!token) return null;
  const rows = await sql.query(`SELECT a.id, a.username FROM sessions s JOIN accounts a ON a.id = s.account_id
    WHERE s.token_hash = $1 AND s.expires_at > $2 AND a.active = 1 AND a.role = 'admin' LIMIT 1`, [sha256(token), new Date().toISOString()]);
  return rows[0] || null;
}
function publicState(state) {
  const stock = {};
  for (const [key, product] of Object.entries(PRODUCT_MAP)) stock[key] = state.products[product.id];
  return { stock, history: state.history };
}
function movement(type, productId, quantity, note, actor) {
  const key = REVERSE_MAP[productId];
  return { id: randomBytes(16).toString("hex"), type, productId, productName: PRODUCT_MAP[key]?.name || key, qty: quantity, note, at: new Date().toISOString(), actor };
}

export default async function handler(req, res) {
  try {
    const sql = db();
    await ensureSchema(sql);
    if (req.method === "GET") {
      const admin = await requireAdmin(req, sql);
      if (!admin) return res.status(401).json({ error: "Faça login como CEO para consultar os estoques." });
      return res.status(200).json(publicState(await loadState(sql)));
    }
    if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido." });
    let admin = await requireAdmin(req, sql);
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const internalSecret = String(req.headers["x-uba-order-secret"] || "");
    const expectedSecret = String(process.env.UBA_ORDER_SECRET || "");
    const paidOrder = body.action === "order_paid" && expectedSecret && safeEqual(internalSecret, expectedSecret);
    if (!admin && !paidOrder) return res.status(401).json({ error: "Acesso administrativo necessário." });
    const state = await loadState(sql);
    const actor = admin?.username || "pagamento-confirmado";
    if (body.action === "reserve_seller_stock") {
      const mapped = PRODUCT_MAP[body.productId];
      const amount = int(body.quantity);
      if (!mapped || !amount) return res.status(400).json({ error: "Produto ou quantidade inválida." });
      const item = state.products[mapped.id];
      if (amount > item.sellers) {
        return res.status(400).json({ error: `Há apenas ${item.sellers} unidades deste sabor no estoque dos vendedores.` });
      }
      const coveredToMake = Math.min(amount, item.toMake);
      item.sellers -= amount;
      item.separated += amount;
      item.toMake -= coveredToMake;
      const note = coveredToMake
        ? `Reserva manual pelo CEO; ${coveredToMake} un. abatidas de A Fabricar`
        : "Reserva manual pelo CEO para Revendedores";
      state.history.unshift(movement("seller_reservation", mapped.id, amount, note, actor));
    } else if (body.action === "production") {
      const mapped = PRODUCT_MAP[body.productId];
      const amount = int(body.quantity);
      if (!mapped || !amount) return res.status(400).json({ error: "Produto ou quantidade inválida." });
      const item = state.products[mapped.id];
      const forOrders = Math.min(amount, item.toMake);
      if (forOrders) {
        item.toMake -= forOrders; item.separated += forOrders;
        state.history.unshift(movement("production", mapped.id, forOrders, "Produzido diretamente para pedidos", actor));
      }
      const extra = amount - forOrders;
      if (extra) {
        item.reseller += extra;
        state.history.unshift(movement("production", mapped.id, extra, "Excedente no estoque Revendedores", actor));
      }
    } else if (body.action === "order_paid") {
      const reference = String(body.reference || "Pedido pago").slice(0, 120);
      for (const entry of Array.isArray(body.items) ? body.items : []) {
        const mapped = PRODUCT_MAP[entry.productId];
        const amount = int(entry.quantity);
        if (!mapped || !amount) continue;
        const item = state.products[mapped.id];
        const fromReseller = Math.min(amount, item.reseller);
        item.reseller -= fromReseller; item.separated += fromReseller; item.toMake += amount - fromReseller;
        state.history.unshift(movement("order", mapped.id, amount, reference, actor));
      }
    } else if (body.action === "clear_history") {
      state.history = [];
    } else {
      return res.status(400).json({ error: "Ação de estoque desconhecida." });
    }
    state.history = state.history.slice(0, 200);
    return res.status(200).json(publicState(await saveState(sql, state)));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Não foi possível sincronizar o estoque compartilhado." });
  }
}
