import { timingSafeEqual } from "node:crypto";

function config() {
  const baseUrl = String(process.env.UBA_CONTROLES_API_URL || "").trim().replace(/\/$/, "");
  const secret = String(process.env.UBA_INTEGRATION_SECRET || "").trim();
  if (!baseUrl || !secret) {
    throw Object.assign(new Error("Integração com o UBA Controles não configurada."), { statusCode: 503 });
  }
  return { baseUrl, secret };
}

export function safeEqual(left, right) {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function controlesStock(options = {}) {
  const { baseUrl, secret } = config();
  const response = await fetch(`${baseUrl}/api/integrations/revendedores/stock`, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      "X-UBA-Integration-Secret": secret,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw Object.assign(new Error(data.error || "UBA Controles indisponível para sincronização."), { statusCode: response.status });
  }
  return data;
}
