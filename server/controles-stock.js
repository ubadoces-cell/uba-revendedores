import { stockReadAuthorization, stockWriteAuthorization } from './stock-read-identity.js';

function controlesBase(){
 return String(process.env.UBA_CONTROLES_API_URL||'https://uba-controles-okpf-weld.vercel.app').trim().replace(/\/$/,'');
}

// Server-to-server, read-only. Never accepts a database credential from Controles.
export async function controlesStockSummary(sql){
 const base=controlesBase();
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

export async function consumeControlesSellerStock(sql,{operationId,reference,items}){
 const base=controlesBase();
 if(process.env.VERCEL_ENV==='preview')throw Object.assign(new Error('A baixa do estoque Vendedores não roda em Preview.'),{statusCode:409});
 const url=new URL(base);if(url.protocol!=='https:')throw Object.assign(new Error('Integração do Controles exige HTTPS.'),{statusCode:503});
 const body=JSON.stringify({action:'consume_seller_stock',operationId,reference,items});
 const response=await fetch(base+'/api/integrations/stock-allocation',{
  method:'POST',
  headers:{'content-type':'application/json',authorization:await stockWriteAuthorization(sql,body)},
  body,
  signal:AbortSignal.timeout(10000),redirect:'error',cache:'no-store'
 });
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw Object.assign(new Error(data.error||'Não foi possível baixar o estoque dos Vendedores.'),{statusCode:response.status});
 return data;
}
