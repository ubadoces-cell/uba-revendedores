import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { requireAdmin } from "../server/admin-auth.js";
import { currentCustomer, ensureCustomerSchema, serializeCustomer } from "../server/customer-auth.js";
import { database } from "../server/database.js";

const CUSTOMER_COOKIE = "uba_rev_customer_session";
const MAX_AGE = 60 * 60 * 24 * 30;
const VALID_STATUS = new Set(["pending", "approved", "blocked"]);
const VALID_PURPOSE = new Set(["commerce"]);

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
async function ensureSchema(sql) {
  await ensureCustomerSchema(sql);
  await sql.query(`UPDATE reseller_customer_accounts SET purpose = 'commerce'
    WHERE purpose <> 'commerce'`, []);
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
    const sql = database();
    await ensureSchema(sql);
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});

    if (req.method === "GET" && String(req.query?.scope || "") === "current") {
      const account = await currentCustomer(req, sql);
      if (!account || account.status !== "approved") return res.status(200).json({ account: null });
      return res.status(200).json({ account: serializeCustomer(account) });
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
      return res.status(201).json({ account: serializeCustomer(rows[0]) });
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
      return res.status(200).json({ account: serializeCustomer(account) });
    }

    if (req.method === "POST" && body.action === "logout") {
      const token = cookie(req, CUSTOMER_COOKIE);
      if (token) await sql.query(`DELETE FROM reseller_customer_sessions WHERE token_hash = $1`, [sha256(token)]);
      setCustomerCookie(res, "", 0);
      return res.status(200).json({ ok: true });
    }

    if (req.method === "PATCH" && body.action === "update_profile") {
      const account = await currentCustomer(req, sql);
      if (!account || account.status !== "approved") return res.status(401).json({ error: "Entre na sua conta para salvar os dados." });
      const name = clean(body.name || account.name, 140);
      const email = clean(body.email, 180);
      const phone = clean(body.phone, 60);
      const doc = clean(body.doc, 40);
      const store = clean(body.store, 140);
      const address = body.address && typeof body.address === "object" ? body.address : {};
      if (!name || (!email && !phone) || ![11, 14].includes(digits(doc).length)) {
        return res.status(400).json({ error: "Informe nome, e-mail ou telefone e um CPF/CNPJ válido." });
      }
      if (await duplicateAccount(sql, { email, phone, doc }, account.id)) {
        return res.status(409).json({ error: "Já existe outro cadastro com esses dados." });
      }
      const rows = await sql.query(`UPDATE reseller_customer_accounts SET
        name=$2,email=$3,email_norm=$4,phone=$5,phone_norm=$6,doc=$7,doc_norm=$8,store=$9,
        address_cep=$10,address_city=$11,address_street=$12,address_number=$13,address_complement=$14,updated_at=NOW()
        WHERE id=$1 RETURNING *`, [
        account.id, name, email, normalized(email), phone, digits(phone), doc, digits(doc), store,
        clean(address.cep, 20), clean(address.city, 100), clean(address.street, 180),
        clean(address.number, 30), clean(address.complement, 120),
      ]);
      return res.status(200).json({ account: serializeCustomer(rows[0]) });
    }

    const admin = await requireAdmin(req, sql);
    if (!admin) return res.status(401).json({ error: "Acesso administrativo necessário." });

    if (req.method === "GET") {
      const rows = await sql.query(`SELECT * FROM reseller_customer_accounts ORDER BY created_at DESC`, []);
      return res.status(200).json({ accounts: rows.map(serializeCustomer) });
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
      return res.status(201).json({ account: serializeCustomer(rows[0]) });
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
      return res.status(200).json({ account: serializeCustomer(rows[0]) });
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
    return res.status(error.statusCode || 500).json({
      error: error.statusCode ? error.message : "Não foi possível sincronizar os logins de clientes.",
    });
  }
}
