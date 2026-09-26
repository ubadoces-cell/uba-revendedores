import {database} from '../server/database.js';
import {publicStockReadIdentity} from '../server/stock-read-identity.js';
// Only a PUBLIC verification key. Private material never leaves the dedicated DB.
export default async function handler(req,res){
 if(req.method!=='GET')return res.status(405).json({error:'Método não permitido.'});
 try{res.setHeader('Cache-Control','public,max-age=300');return res.status(200).json(await publicStockReadIdentity(database()));}
 catch{return res.status(503).json({error:'Identidade de integração indisponível.'});}
}
