import { randomBytes } from "node:crypto";
import { requireAdmin } from "../server/admin-auth.js";
import { controlesStock } from "../server/controles-client.js";
import { database } from "../server/database.js";

const ALLOWED_ACTIONS = new Set(["reserve_seller_stock", "production", "clear_history"]);

export default async function handler(req, res) {
  try {
    res.setHeader("Cache-Control", "no-store");
    const sql = database();
    const admin = await requireAdmin(req, sql);
    if (!admin) return res.status(401).json({ error: "Acesso administrativo necessário." });

    if (req.method === "GET") {
      return res.status(200).json(await controlesStock());
    }
    if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido." });

    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    if (!ALLOWED_ACTIONS.has(body.action)) return res.status(400).json({ error: "Ação de estoque desconhecida." });
    const result = await controlesStock({
      method: "POST",
      body: {
        ...body,
        actor: admin.username,
        eventId: `revendedores:${body.action}:${randomBytes(16).toString("hex")}`,
      },
    });
    return res.status(200).json(result);
  } catch (error) {
    console.error(error);
    return res.status(error.statusCode || 500).json({
      error: error.statusCode ? error.message : "Não foi possível sincronizar o estoque com o UBA Controles.",
    });
  }
}
