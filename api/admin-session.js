import { createHash, randomBytes } from "node:crypto";
import { neon } from "@neondatabase/serverless";

const COOKIE = "uba_rev_session";
const MAX_AGE = 60 * 60 * 24 * 30;
function sha256(value) { return createHash("sha256").update(value).digest("hex"); }
async function passwordHash(password, salt) {
  let value = `${salt}:${password}`;
  for (let round = 0; round < 128; round += 1) value = sha256(`${salt}:${value}`);
  return value;
}
function cookie(req) {
  for (const part of String(req.headers.cookie || "").split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === COOKIE) return decodeURIComponent(rest.join("="));
  }
  return "";
}
function client() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) throw new Error("DATABASE_URL não configurada.");
  return neon(url);
}
export default async function handler(req, res) {
  try {
    const sql = client();
    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
      const username = String(body.username || "").trim();
      const password = String(body.password || "");
      const rows = await sql.query(`SELECT id, username, password_hash, password_salt FROM accounts
        WHERE LOWER(username) = LOWER($1) AND role = 'admin' AND active = 1 LIMIT 1`, [username]);
      const account = rows[0];
      if (!account || (await passwordHash(password, account.password_salt)) !== account.password_hash) {
        return res.status(401).json({ error: "Login ou senha incorretos." });
      }
      const token = randomBytes(32).toString("hex");
      const expires = new Date(Date.now() + MAX_AGE * 1000).toISOString();
      await sql.query(`INSERT INTO sessions (id, account_id, token_hash, expires_at) VALUES ($1, $2, $3, $4)`,
        [`rev_${randomBytes(16).toString("hex")}`, account.id, sha256(token), expires]);
      res.setHeader("Set-Cookie", `${COOKIE}=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${MAX_AGE}`);
      return res.status(200).json({ ok: true, username: account.username });
    }
    if (req.method === "DELETE") {
      const token = cookie(req);
      if (token) await sql.query(`DELETE FROM sessions WHERE token_hash = $1`, [sha256(token)]);
      res.setHeader("Set-Cookie", `${COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`);
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: "Método não permitido." });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Não foi possível validar o acesso administrativo." });
  }
}
