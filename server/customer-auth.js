import { createHash } from "node:crypto";
import { cookie } from "./admin-auth.js";

export const CUSTOMER_COOKIE = "uba_rev_customer_session";

function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

export async function ensureCustomerSchema(sql) {
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
    address_cep TEXT NOT NULL DEFAULT '',
    address_city TEXT NOT NULL DEFAULT '',
    address_street TEXT NOT NULL DEFAULT '',
    address_number TEXT NOT NULL DEFAULT '',
    address_complement TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`, []);
  await sql.query(`ALTER TABLE reseller_customer_accounts
    ADD COLUMN IF NOT EXISTS address_cep TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS address_city TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS address_street TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS address_number TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS address_complement TEXT NOT NULL DEFAULT ''`, []);
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
}

export async function currentCustomer(req, sql) {
  await ensureCustomerSchema(sql);
  const token = cookie(req, CUSTOMER_COOKIE);
  if (!token) return null;
  const rows = await sql.query(`SELECT a.* FROM reseller_customer_sessions s
    JOIN reseller_customer_accounts a ON a.id=s.account_id
    WHERE s.token_hash=$1 AND s.expires_at>NOW() LIMIT 1`, [sha256(token)]);
  return rows[0] || null;
}

export function serializeCustomer(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email || "",
    phone: row.phone || "",
    doc: row.doc || "",
    store: row.store || "",
    purpose: row.purpose || "commerce",
    status: row.status || "pending",
    address: {
      cep: row.address_cep || "",
      city: row.address_city || "",
      street: row.address_street || "",
      number: row.address_number || "",
      complement: row.address_complement || "",
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
