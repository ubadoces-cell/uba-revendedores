import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { neon } from "@neondatabase/serverless";

const ADMIN_COOKIE = "uba_rev_session";
const CUSTOMER_COOKIE = "uba_rev_customer_session";
const MAX_AGE = 60 * 60 * 24 * 30;
const VALID_STATUS = new Set(["pending", "approved", "blocked"]);
const VALID_PURPOSE = new Set(["commerce"]);

function db() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) throw new Error("DATABASE_URL não configurada.");
  return neon(url);
}
function clean(value, max = 180) { return String(value || "").trim().slice(0, max); }
function normalized(value) { return clean(value).toLowerCase().replace(/\s+/g, ""); }
function digits(value) { return String(value || "").replace(/\D/g, ""); }
function sha256(value) { return createHash("sha256").update(value).digest("hex"); }
function cookie(req, name) {
  for (const part of String(req.headers.cookie || "").split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return "";
}
function passwordHash(password, salt) {
  return scryptSync(String(password), salt, 64).toString("hex");
}
function passwordMatches(password, salt, expected) {
  const actual = Buffer.from(passwordHash(password, salt), "hex");
  const target = Buffer.from(String(expected || ""), "hex");
  return actual.length === target.length && timingSafeEqual(actual, target);
}
function setCustomerCookie(res, token, maxAge = MAX_AGE) {
  res.setHeader("Set-Cookie", `${CUSTOMER_COOKIE}=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`);
}
function serialize(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email || "",
    phone: row.phone || "",
    doc: row.doc || "",
    store: row.store || "",
    purpose: row.purpose || "commerce",
    status: row.status || "pending",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
async function ensureSchema(sql) {
  await sql.query(`CREATE TABLE IF NOT EXISTS reseller_customer_accounts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL DEFAULT '',
    email_norm TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    phone_norm TEXT NOT NULL DEFAULT '',
    doc TEXT NOT NULL DEFAULT '',
    doc_norm TEXT NOT NULL DEFAULT '',
    store TEXT NOT NULL DEFAULT '',
    purpose TEXT NOT NULL DEFAULT 'commerce',
    status TEXT NOT NULL DEFAULT 'pending',
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`, []);
  await sql.query(`CREATE UNIQUE INDEX IF NOT EXISTS reseller_customer_email_unique
    ON reseller_customer_accounts(email_norm) WHERE email_norm <> ''`, []);
  await sql.query(`CREATE UNIQUE INDEX IF NOT EXISTS reseller_customer_phone_unique
    ON reseller_customer_accounts(phone_norm) WHERE phone_norm <> ''`, []);
  await sql.query(`CREATE UNIQUE INDEX IF NOT EXISTS reseller_customer_doc_unique
    ON reseller_customer_accounts(doc_norm) WHERE doc_norm <> ''`, []);
  await sql.query(`CREATE TABLE IF NOT EXISTS reseller_customer_sessions (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES reseller_customer_accounts(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`, []);
  await sql.query(`UPDATE reseller_customer_accounts SET purpose = 'commerce'
    WHERE purpose <> 'commerce'`, []);
}
async function requireAdmin(req, sql) {
  const token = cookie(req, ADMIN_COOKIE);
  if (!token) return null;
  const rows = await sql.query(`SELECT a.id, a.username FROM sessions s JOIN accounts a ON a.id = s.account_id
    WHERE s.token_hash = $1 AND s.expires_at > $2 AND a.active = 1 AND a.role = 'admin' LIMIT 1`,
    [sha256(token), new Date().toISOString()]);
  return rows[0] || null;
}
async function currentCustomer(req, sql) {
  const token = cookie(req, CUSTOMER_COOKIE);
  if (!token) return null;
  const rows = await sql.query(`SELECT a.* FROM reseller_customer_sessions s
    JOIN reseller_customer_accounts a ON a.id = s.account_id
    WHERE s.token_hash = $1 AND s.expires_at > NOW() LIMIT 1`, [sha256(token)]);
  return rows[0] || null;
}
async function duplicateAccount(sql, { email, phone, doc }, exceptId = "") {
  const rows = await sql.query(`SELECT id FROM reseller_customer_accounts
    WHERE id <> $1 AND (($2 <> '' AND email_norm = $2) OR ($3 <> '' AND phone_norm = $3) OR ($4 <> '' AND doc_norm = $4))
    LIMIT 1`, [exceptId, normalized(email), digits(phone), digits(doc)]);
  return Boolean(rows[0]);
}

export default async function handler(req, res) {
  try {
    res.setHeader("Cache-Control", "no-store");
    const sql = db();
    await ensureSchema(sql);
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});

    if (req.method === "GET" && String(req.query?.scope || "") === "current") {
      const account = await currentCustomer(req, sql);
      if (!account || account.status !== "approved") return res.status(200).json({ account: null });
      return res.status(200).json({ account: serialize(account) });
    }

    if (req.method === "POST" && body.action === "register") {
      const name = clean(body.name, 140);
      const email = clean(body.email, 180);
      const phone = clean(body.phone, 60);
      const doc = clean(body.doc, 40);
      const store = clean(body.store, 140);
      const purpose = VALID_PURPOSE.has(body.purpose) ? body.purpose : "commerce";
      const password = String(body.password || "");
      if (!name || (!email && !phone) || ![11, 14].includes(digits(doc).length) || password.length < 6) {
        return res.status(400).json({ error: "Preencha nome, e-mail ou telefone, CPF/CNPJ e uma senha com pelo menos 6 caracteres." });
      }
      if (await duplicateAccount(sql, { email, phone, doc })) {
        return res.status(409).json({ error: "Já existe um cadastro com esse e-mail, telefone ou documento." });
      }
      const salt = randomBytes(16).toString("hex");
      const id = `customer_${randomBytes(16).toString("hex")}`;
      const rows = await sql.query(`INSERT INTO reseller_customer_accounts
        (id, name, email, email_norm, phone, phone_norm, doc, doc_norm, store, purpose, status, password_hash, password_salt)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'pending',$11,$12) RETURNING *`,
        [id, name, email, normalized(email), phone, digits(phone), doc, digits(doc), store, purpose, passwordHash(password, salt), salt]);
      return res.status(201).json({ account: serialize(rows[0]) });
    }

    if (req.method === "POST" && body.action === "login") {
      const login = normalized(body.login);
      const password = String(body.password || "");
      if (!login || !password) return res.status(400).json({ error: "Digite seu e-mail/telefone e senha." });
      const rows = await sql.query(`SELECT * FROM reseller_customer_accounts
        WHERE email_norm = $1 OR phone_norm = $2 LIMIT 1`, [login, digits(body.login)]);
      const account = rows[0];
      if (!account || !passwordMatches(password, account.password_salt, account.password_hash)) {
        return res.status(401).json({ error: "Login ou senha incorretos." });
      }
      if (account.status === "pending") return res.status(403).json({ error: "Seu cadastro existe, mas ainda está aguardando aprovação da UBA." });
      if (account.status === "blocked") return res.status(403).json({ error: "Este login está bloqueado/desativado. Fale com a UBA para liberar o acesso." });
      const token = randomBytes(32).toString("hex");
      await sql.query(`INSERT INTO reseller_customer_sessions (id, account_id, token_hash, expires_at)
        VALUES ($1,$2,$3,NOW() + INTERVAL '30 days')`, [`cs_${randomBytes(16).toString("hex")}`, account.id, sha256(token)]);
      setCustomerCookie(res, token);
      return res.status(200).json({ account: serialize(account) });
    }

    if (req.method === "POST" && body.action === "logout") {
      const token = cookie(req, CUSTOMER_COOKIE);
      if (token) await sql.query(`DELETE FROM reseller_customer_sessions WHERE token_hash = $1`, [sha256(token)]);
      setCustomerCookie(res, "", 0);
      return res.status(200).json({ ok: true });
    }

    const admin = await requireAdmin(req, sql);
    if (!admin) return res.status(401).json({ error: "Acesso administrativo necessário." });

    if (req.method === "GET") {
      const rows = await sql.query(`SELECT * FROM reseller_customer_accounts ORDER BY created_at DESC`, []);
      return res.status(200).json({ accounts: rows.map(serialize) });
    }

    if (req.method === "POST" && body.action === "create") {
      const name = clean(body.name, 140);
      const email = clean(body.email, 180);
      const phone = clean(body.phone, 60);
      const doc = clean(body.doc, 40);
      const store = clean(body.store, 140);
      const purpose = VALID_PURPOSE.has(body.purpose) ? body.purpose : "commerce";
      const status = VALID_STATUS.has(body.status) ? body.status : "approved";
      const password = String(body.password || "");
      if (!name || (!email && !phone) || password.length < 6) {
        return res.status(400).json({ error: "Informe nome, contato e uma senha com pelo menos 6 caracteres." });
      }
      if (await duplicateAccount(sql, { email, phone, doc })) return res.status(409).json({ error: "Já existe outro login com esses dados." });
      const salt = randomBytes(16).toString("hex");
      const id = `customer_${randomBytes(16).toString("hex")}`;
      const rows = await sql.query(`INSERT INTO reseller_customer_accounts
        (id,name,email,email_norm,phone,phone_norm,doc,doc_norm,store,purpose,status,password_hash,password_salt)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
        [id,name,email,normalized(email),phone,digits(phone),doc,digits(doc),store,purpose,status,passwordHash(password,salt),salt]);
      return res.status(201).json({ account: serialize(rows[0]) });
    }

    if (req.method === "PATCH") {
      const id = clean(body.id, 100);
      const name = clean(body.name, 140);
      const email = clean(body.email, 180);
      const phone = clean(body.phone, 60);
      const doc = clean(body.doc, 40);
      const store = clean(body.store, 140);
      const purpose = VALID_PURPOSE.has(body.purpose) ? body.purpose : "commerce";
      const status = VALID_STATUS.has(body.status) ? body.status : "pending";
      const password = String(body.password || "");
      if (!id || !name || (!email && !phone)) return res.status(400).json({ error: "Dados do login incompletos." });
      if (password && password.length < 6) return res.status(400).json({ error: "A nova senha precisa ter pelo menos 6 caracteres." });
      if (await duplicateAccount(sql, { email, phone, doc }, id)) return res.status(409).json({ error: "Já existe outro login com esses dados." });
      let rows;
      if (password) {
        const salt = randomBytes(16).toString("hex");
        rows = await sql.query(`UPDATE reseller_customer_accounts SET name=$2,email=$3,email_norm=$4,phone=$5,phone_norm=$6,
          doc=$7,doc_norm=$8,store=$9,purpose=$10,status=$11,password_hash=$12,password_salt=$13,updated_at=NOW()
          WHERE id=$1 RETURNING *`, [id,name,email,normalized(email),phone,digits(phone),doc,digits(doc),store,purpose,status,passwordHash(password,salt),salt]);
      } else {
        rows = await sql.query(`UPDATE reseller_customer_accounts SET name=$2,email=$3,email_norm=$4,phone=$5,phone_norm=$6,
          doc=$7,doc_norm=$8,store=$9,purpose=$10,status=$11,updated_at=NOW() WHERE id=$1 RETURNING *`,
          [id,name,email,normalized(email),phone,digits(phone),doc,digits(doc),store,purpose,status]);
      }
      if (!rows[0]) return res.status(404).json({ error: "Login não encontrado." });
      if (status !== "approved") await sql.query(`DELETE FROM reseller_customer_sessions WHERE account_id = $1`, [id]);
      return res.status(200).json({ account: serialize(rows[0]) });
    }

    if (req.method === "DELETE") {
      const id = clean(req.query?.id, 100);
      if (!id) return res.status(400).json({ error: "Login inválido." });
      await sql.query(`DELETE FROM reseller_customer_accounts WHERE id = $1`, [id]);
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: "Método não permitido." });
  } catch (error) {
    console.error(error);
    if (String(error?.code) === "23505") return res.status(409).json({ error: "Já existe um cadastro com esses dados." });
    return res.status(500).json({ error: "Não foi possível sincronizar os logins de clientes." });
  }
}
