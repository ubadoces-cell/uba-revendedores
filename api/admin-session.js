import { createAdminSession, destroyAdminSession } from "../server/admin-auth.js";

export default async function handler(req, res) {
  try {
    res.setHeader("Cache-Control", "no-store");
    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
      const username = String(body.username || "").trim();
      const password = String(body.password || "");
      const session = await createAdminSession(req, res, username, password);
      if (!session) return res.status(401).json({ error: "Login ou senha incorretos." });
      return res.status(200).json({ ok: true, username: session.username });
    }
    if (req.method === "DELETE") {
      await destroyAdminSession(req, res);
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: "Método não permitido." });
  } catch (error) {
    console.error(error);
    return res.status(error.statusCode || 500).json({
      error: error.statusCode ? error.message : "Não foi possível validar o acesso administrativo.",
    });
  }
}
