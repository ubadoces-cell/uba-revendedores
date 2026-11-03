import { database } from "../server/database.js";
import { requireAdmin } from "./customer-accounts.js";
import { PRODUCTS, PRICING } from "./orders.js";

// Preços à vista do cardápio UBA DOCES de 08/10/2026, em centavos.
// As faixas de revenda vêm da mesma tabela validada pelo checkout.
const RETAIL_CENTS = Object.freeze({
  chocolate50: 700,
  branco: 750,
  branco_beijinho: 800,
  branco_chocolate: 750,
  chocolate50_chocolate: 750,
  chocolate50_beijinho: 800,
  chocolate50_branco: 800,
  pistache: 850,
  caramelo: 800,
  morango: 750,
});

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  if (req.method !== "GET") return res.status(405).json({ error: "Método não permitido." });

  try {
    const sql = database();
    // Apenas a sessão administrativa verificada no servidor pode consultar a tabela.
    // Login de comprador/revendedor, mesmo aprovado, nunca libera este endpoint.
    const admin = await requireAdmin(req, sql);
    if (!admin) {
      return res.status(403).json({ error: "Tabela reservada ao administrador UBA DOCES." });
    }

    const tiers = PRICING.commerce;
    const products = Object.entries(PRODUCTS).map(([id, product]) => ({
      id,
      name: product.name,
      available: product.active !== false,
      retailCents: RETAIL_CENTS[id],
      resellerCents: tiers.map((tier) => tier[id]),
    }));

    return res.status(200).json({
      minimumUnits: 25,
      mixFlavors: true,
      deliveryLocation: "Limoeiro do Norte — bairros atendidos",
      deliveryFeeCents: 499,
      tiers: tiers.map((tier) => ({ min: tier.min, max: tier.max })),
      products,
    });
  } catch {
    return res.status(500).json({ error: "Não foi possível consultar a tabela no momento." });
  }
}
