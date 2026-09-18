import { controlesStock } from "../server/controles-client.js";
import { database } from "../server/database.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Método não permitido." });
  const result = { database: false, controles: false };
  try {
    await database().query("SELECT 1 AS ok", []);
    result.database = true;
  } catch (error) {
    console.error(error);
  }
  try {
    await controlesStock();
    result.controles = true;
  } catch (error) {
    console.error(error);
  }
  return res.status(result.database && result.controles ? 200 : 503).json(result);
}
