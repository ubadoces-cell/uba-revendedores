import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { database } from "./database.js";

export const ADMIN_COOKIE = "uba_rev_session";
const MAX_AGE = 60 * 60 * 24 * 30;

function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  return a.length === b.length && timingSafeEqual(a, b);
}

export function cookie(req, name) {
  for (const part of String(req.headers.cookie || "").split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return "";
}

export async function ensureAdminSchema(sql) {
  await sql.query(`CREATE TABLE IF NOT EXISTS reseller_admin_sessions (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`, []);
}

export async function createAdminSession(req, res, username, password) {
  const expectedUser = String(process.env.RESELLER_ADMIN_USERNAME || "").trim();
  const expectedPassword = String(process.env.RESELLER_ADMIN_PASSWORD || "");
  if (!expectedUser || !expectedPassword) {
    throw Object.assign(new Error("Credenciais administrativas do UBA Revendedores não configuradas."), { statusCode: 503 });
  }
  if (!safeEqual(username.toLowerCase(), expectedUser.toLowerCase()) || !safeEqual(password, expectedPassword)) {
    return null;
  }
  const sql = database();
  await ensureAdminSchema(sql);
  const token = randomBytes(32).toString("hex");
  await sql.query(`INSERT INTO reseller_admin_sessions (id, username, token_hash, expires_at)
    VALUES ($1,$2,$3,NOW() + INTERVAL '30 days')`,
    [`admin_session_${randomBytes(16).toString("hex")}`, expectedUser, sha256(token)]);
  res.setHeader("Set-Cookie", `${ADMIN_COOKIE}=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${MAX_AGE}`);
  return { username: expectedUser };
}

export async function requireAdmin(req, sql = database()) {
  await ensureAdminSchema(sql);
  const token = cookie(req, ADMIN_COOKIE);
  if (!token) return null;
  const rows = await sql.query(`SELECT id, username FROM reseller_admin_sessions
    WHERE token_hash=$1 AND expires_at>NOW() LIMIT 1`, [sha256(token)]);
  return rows[0] || null;
}

export async function destroyAdminSession(req, res) {
  const sql = database();
  await ensureAdminSchema(sql);
  const token = cookie(req, ADMIN_COOKIE);
  if (token) await sql.query(`DELETE FROM reseller_admin_sessions WHERE token_hash=$1`, [sha256(token)]);
  res.setHeader("Set-Cookie", `${ADMIN_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`);
}
