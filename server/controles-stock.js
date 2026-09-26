import { stockReadAuthorization } from './stock-read-identity.js';
// Server-to-server, read-only. Never accepts a database credential from Controles.
export async function controlesStockSummary(sql){
 const base=String(process.env.UBA_CONTROLES_API_URL||'https://uba-controles-okpf-weld.vercel.app').trim().replace(/\/$/,'');
 if(process.env.VERCEL_ENV==='preview')return {available:false,reason:'preview_isolated'};
 try{
  const url=new URL(base);if(url.protocol!=='https:')throw Error('HTTPS required');
  const response=await fetch(base+'/api/integrations/stock-summary',{headers:{authorization:await stockReadAuthorization(sql)},signal:AbortSignal.timeout(7000),redirect:'error',cache:'no-store'});
  if(!response.ok)throw Error('Stock unavailable');
  const data=await response.json();
  const keys=['chocolate50','branco','caramelo','morango','pistache'];const products={};
  for(const key of keys){const value=data.products?.[key];if(!Number.isSafeInteger(value)||value<0)throw Error('Invalid stock');products[key]=value;}
  return {available:true,products,total:Object.values(products).reduce((a,b)=>a+b,0),updatedAt:data.updatedAt||null,checkedAt:new Date().toISOString()};
 }catch{return {available:false,reason:'unavailable'};}
}
