import { controlesStockSummary, consumeControlesSellerStock } from "../server/controles-stock.js";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { database } from "../server/database.js";

const PRODUCT_MAP = {
  chocolate50: { id: "p1", name: "Chocolate 50% cacau" },
  branco: { id: "p2", name: "Chocolate branco" },
  caramelo: { id: "p3", name: "Caramelo" },
  morango: { id: "p4", name: "Morango" },
  pistache: { id: "p5", name: "Pistache" },
};
const REVERSE_MAP = Object.fromEntries(Object.entries(PRODUCT_MAP).map(([key, value]) => [value.id, key]));
const SESSION_COOKIE = "uba_rev_session";

function db() { return database(); }
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
  await sql.query(`ALTER TABLE reseller_orders
    ADD COLUMN IF NOT EXISTS production_allocation JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS customer_note TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS stock_applied BOOLEAN NOT NULL DEFAULT FALSE`, []);
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
  const type = ({ vendedores_para_pedido: "sellers_to_order", producao_pedido: "production", producao_revendedores: "production", ajuste: "adjustment" })[rawType] || rawType;
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
      state.products[productId] = { sellers: int(item.sellers), reseller: int(item.reseller), separated: int(item.separated), toMake: int(item.toMake) };
    }
    state.history = Array.isArray(value.history) ? value.history.map(historyItem).filter(Boolean).slice(0, 200) : [];
  }
  return state;
}
async function loadState(sql) {
  const rows = await sql.query(`SELECT data FROM shared_stock_state WHERE id = 1`, []);
  if (rows[0]) { try { return normalize(JSON.parse(rows[0].data)); } catch {} }
  const state = emptyState();
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
function movement(type, productId, quantity, note, actor, id = randomBytes(16).toString("hex")) {
  const key = REVERSE_MAP[productId];
  return { id, type, productId, productName: PRODUCT_MAP[key]?.name || key, qty: quantity, note, at: new Date().toISOString(), actor };
}
function allocationsForOrder(order, raw) {
  const requested = new Map((Array.isArray(order.items) ? order.items : []).map((item) => [String(item.productId), int(item.quantity)]));
  const result = [];
  for (const entry of Array.isArray(raw) ? raw : []) {
    const productId = String(entry?.productId || "");
    if (!PRODUCT_MAP[productId] || !requested.has(productId)) continue;
    const sellers = int(entry.sellers);
    const reseller = int(entry.reseller);
    const toMake = int(entry.toMake);
    const ordered = requested.get(productId) || 0;
    if (sellers + reseller + toMake !== ordered) throw Object.assign(new Error(`A divisão de ${PRODUCT_MAP[productId].name} precisa somar ${ordered}.`), { statusCode: 400 });
    result.push({ productId, sellers, reseller, toMake, ordered });
  }
  if (result.length !== requested.size) throw Object.assign(new Error("Defina a origem de todos os sabores do pedido."), { statusCode: 400 });
  return result;
}

export default async function handler(req, res) {
  try {
    res.setHeader("Cache-Control", "no-store");
    const sql = db();
    await ensureSchema(sql);
    if (req.method === "GET") {
      const admin = await requireAdmin(req, sql);
      if (!admin) return res.status(401).json({ error: "Faça login como CEO para consultar os estoques." });
      const summary = await controlesStockSummary(sql);
      return res.status(200).json({ ...publicState(await loadState(sql)), controles: summary, controlesIntegration: summary.available });
    }
    if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido." });

    const admin = await requireAdmin(req, sql);
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const internalSecret = String(req.headers["x-uba-order-secret"] || "");
    const expectedSecret = String(process.env.UBA_ORDER_SECRET || "");
    const paidOrder = body.action === "order_paid" && expectedSecret && safeEqual(internalSecret, expectedSecret);
    if (!admin && !paidOrder) return res.status(401).json({ error: "Acesso administrativo necessário." });

    const state = await loadState(sql);
    const actor = admin?.username || "pagamento-confirmado";

    if (body.action === "adjust_reseller_stock") {
      const mapped = PRODUCT_MAP[String(body.productId || "")];
      const amount = int(body.quantity);
      const operation = String(body.operation || "");
      const note = String(body.note || "Ajuste manual").slice(0, 180);
      if (!mapped || !["entrada", "saida", "ajuste"].includes(operation)) return res.status(400).json({ error: "Movimentação inválida." });
      const item = state.products[mapped.id];
      const before = item.reseller;
      if (operation === "entrada") item.reseller += amount;
      if (operation === "saida") {
        if (amount > item.reseller) return res.status(409).json({ error: `Há apenas ${item.reseller} unidades deste sabor no estoque Revendedores.` });
        item.reseller -= amount;
      }
      if (operation === "ajuste") item.reseller = amount;
      const delta = item.reseller - before;
      state.history.unshift(movement("reseller_adjustment", mapped.id, Math.abs(delta), `${operation}: ${note}`, actor));

    } else if (body.action === "allocate_order") {
      const orderId = String(body.orderId || "").slice(0, 100);
      const rows = await sql.query(`SELECT id,code,status,payment_status,items,stock_applied,production_allocation FROM reseller_orders WHERE id=$1 LIMIT 1`, [orderId]);
      const order = rows[0];
      if (!order) return res.status(404).json({ error: "Pedido não encontrado." });
      if (order.stock_applied) return res.status(409).json({ error: "A origem deste pedido já foi confirmada e o estoque já foi movimentado." });
      if (!["pago", "confirmado_asaas"].includes(String(order.payment_status || ""))) return res.status(409).json({ error: "Confirme o pagamento antes de separar a origem do estoque." });
      const allocation = allocationsForOrder(order, body.allocations);
      const summary = await controlesStockSummary(sql);
      const sellerItems = [];
      for (const entry of allocation) {
        const mapped = PRODUCT_MAP[entry.productId];
        const own = state.products[mapped.id];
        if (entry.reseller > own.reseller) return res.status(409).json({ error: `Estoque Revendedores insuficiente para ${mapped.name}. Disponível: ${own.reseller}.` });
        if (entry.sellers > 0) {
          if (!summary.available) return res.status(409).json({ error: "O estoque Vendedores está indisponível para consulta agora." });
          const available = int(summary.products?.[entry.productId]);
          if (entry.sellers > available) return res.status(409).json({ error: `Estoque Vendedores insuficiente para ${mapped.name}. Disponível: ${available}.` });
          sellerItems.push({ productId: entry.productId, quantity: entry.sellers });
        }
      }

      const operationId = `order-allocation-${order.id}`;
      if (sellerItems.length) {
        await consumeControlesSellerStock(sql, { operationId, reference: `Pedido ${order.code} · UBA Revendedores`, items: sellerItems });
      }

      for (const entry of allocation) {
        const mapped = PRODUCT_MAP[entry.productId];
        const item = state.products[mapped.id];
        const ownMarker = `${operationId}:${mapped.id}`;
        if (state.history.some((history) => history.id === ownMarker)) continue;
        item.reseller -= entry.reseller;
        item.separated += entry.reseller + entry.sellers;
        item.toMake += entry.toMake;
        state.history.unshift(movement("order_allocation", mapped.id, entry.ordered, `Pedido ${order.code} · Vendedores ${entry.sellers} · Revendedores ${entry.reseller} · Fabricar ${entry.toMake}`, actor, ownMarker));
      }
      await saveState(sql, state);
      await sql.query(`UPDATE reseller_orders SET production_allocation=$1::jsonb, stock_applied=TRUE, status='em_producao', updated_at=NOW() WHERE id=$2`, [JSON.stringify(allocation), order.id]);
      const refreshed = await controlesStockSummary(sql);
      return res.status(200).json({ ...publicState(state), controles: refreshed, allocation, orderId: order.id });

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
      // O pagamento agora apenas confirma o pedido. A origem física é decidida manualmente na etapa Produção.
      return res.status(200).json(publicState(state));

    } else if (body.action === "clear_history") {
      state.history = [];
    } else {
      return res.status(400).json({ error: "Ação de estoque desconhecida." });
    }

    state.history = state.history.slice(0, 200);
    const saved = await saveState(sql, state);
    const summary = await controlesStockSummary(sql);
    return res.status(200).json({ ...publicState(saved), controles: summary, controlesIntegration: summary.available });
  } catch (error) {
    console.error(error);
    return res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : "Não foi possível atualizar o estoque do portal." });
  }
}
