import { controlesStockSummary } from '../server/controles-stock.js';
import { database } from '../server/database.js';
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if(req.method !== 'GET') return res.status(405).json({error:'Método não permitido.'});
  try {
    const sql=database();
    await sql.query('SELECT 1', []);
    const integration=await controlesStockSummary(sql);
    return res.status(200).json({ok:true,application:'uba-revendedores',database:'dedicated',controlesIntegration:integration.available});
  } catch {
    return res.status(503).json({ok:false,error:'Banco exclusivo indisponível.'});
  }
}
