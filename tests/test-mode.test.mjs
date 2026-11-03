import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash,scryptSync,verify} from 'node:crypto';
import {db} from './neon-mock.mjs';
import customers from '../api/customer-accounts.js';
import orders from '../api/orders.js';
import resellerTables from '../api/reseller-tables.js';
import access from '../server/test-access.js';
import {database} from '../server/database.js';
import {publicStockReadIdentity} from '../server/stock-read-identity.js';
import {controlesStockSummary} from '../server/controles-stock.js';
const call=async(fn,req)=>{const res={statusCode:200,headers:{},status(n){this.statusCode=n;return this},setHeader(k,v){this.headers[k]=v},json(data){this.body=data;return this}};await fn({method:'GET',headers:{},query:{},...req},res);return res};
try{
 process.env.RESELLER_DATABASE_DATABASE_URL='postgres://isolated.test/db';
 await db.exec(await readFile(new URL('../server/schema.sql',import.meta.url),'utf8'));

 // Regression: browser delivery list, checkout summary and promotional copy must agree.
 const deliverySource=await readFile(new URL('../delivery-fees.js',import.meta.url),'utf8');
 const pixSource=await readFile(new URL('../orders-sync.js',import.meta.url),'utf8');
 const webSource=await readFile(new URL('../index.html',import.meta.url),'utf8');
 assert.equal((deliverySource.match(/, 499\]/g)||[]).length,16,'all served neighborhoods should cost R$ 4,99');
 assert.equal((pixSource.match(/:499\b/g)||[]).length,16,'Pix delivery fees must be consistent');
 assert.equal((webSource.match(/R\$ 4,99/g)||[]).length,2,'banner and advantages must show R$ 4,99');
 // Change only in-memory test configuration. Never commit a plaintext password.
 const password='synthetic-test-password';access.passwordHash=scryptSync(password,access.salt,64).toString('hex');access.expiresAt=new Date(Date.now()+86400000).toISOString();
 let calls=0;globalThis.fetch=async()=>{calls++;throw Error('External access forbidden in test')};
 assert.equal((await call(resellerTables,{method:'GET'})).statusCode,403);
 assert.equal((await call(customers,{method:'POST',body:{action:'login',login:access.login,password:'wrong'}})).statusCode,401);
 const login=await call(customers,{method:'POST',body:{action:'login',login:access.login,password}});
 assert.equal(login.statusCode,200);assert.equal(login.body.account.isTest,true);
 const cookie=login.headers['Set-Cookie'][0].split(';')[0];
 const current=await call(customers,{query:{scope:'current'},headers:{cookie}});assert.equal(current.body.account.isTest,true);
 assert.equal((await call(resellerTables,{method:'GET',headers:{cookie}})).statusCode,403);
 const adminToken='synthetic-ceo-session-for-test';
 const adminCookie='uba_rev_session='+adminToken;
 const adminHash=createHash('sha256').update(adminToken).digest('hex');
 await db.query("INSERT INTO accounts(id,username,password_hash,password_salt,role,active) VALUES($1,$2,$3,$4,'admin',1)",['synthetic-ceo','synthetic-owner','unused','unused']);
 await db.query("INSERT INTO sessions(id,account_id,token_hash,expires_at) VALUES($1,$2,$3,$4)",['synthetic-session','synthetic-ceo',adminHash,new Date(Date.now()+86400000).toISOString()]);
 const tables=await call(resellerTables,{method:'GET',headers:{cookie:adminCookie}});
 assert.equal(tables.statusCode,200);assert.equal(tables.headers["Cache-Control"],"private, no-store, max-age=0");
 assert.equal(tables.body.minimumUnits,25);
 assert.equal(tables.body.deliveryFeeCents,499);
 assert.equal(tables.body.products.length,10);
 assert.deepEqual(tables.body.tiers.map(t=>t.min),[25,100,200,400]);
 assert.equal(tables.body.products.filter(p=>p.available).length,7);
 assert.equal(tables.body.products.find(p=>p.id==='chocolate50').resellerCents[0],460);
 assert.equal(tables.body.products.find(p=>p.id==='branco_beijinho').resellerCents[0],544);
 assert.equal(tables.body.products.find(p=>p.id==='pistache').available,false);
 assert.equal((await call(resellerTables,{method:'POST',headers:{cookie}})).statusCode,405);
 const body={isTest:true,customer:{name:'Test',doc:'00000000000'},buyer:{name:'Test',doc:'00000000000'},items:[{productId:'branco',quantity:25}],delivery:{city:'Local test',neighborhood:'Centro'}};
 // Reject orders below 25 units even for authenticated test users.
 const underMinimum=await call(orders,{method:'POST',headers:{cookie},body:{...body,items:[{productId:'branco',quantity:24}]}});
 assert.equal(underMinimum.statusCode,400);assert.match(underMinimum.body.error,/25 unidades/);
 // Body flags cannot bypass authentication or payment for regular customers.
 assert.equal((await call(orders,{method:'POST',body})).statusCode,401);
 const testOrder=await call(orders,{method:'POST',headers:{cookie},body});
 assert.equal(testOrder.statusCode,201);assert.equal(testOrder.body.order.isTest,true);assert.equal(testOrder.body.order.delivery.deliveryFeeCents,499);assert.equal(testOrder.body.order.paymentStatus,'teste_sem_cobranca');assert.equal(calls,0);
 const prices={chocolate50:460,branco:510,branco_beijinho:544,branco_chocolate:510,chocolate50_chocolate:493,chocolate50_beijinho:526,chocolate50_branco:526};
 for(const [productId,priceCents] of Object.entries(prices)){
   const response=await call(orders,{method:'POST',headers:{cookie},body:{...body,items:[{productId,quantity:25}]}});
   assert.equal(response.statusCode,201,productId+' should be orderable');
   assert.equal(response.body.order.units,25);
   assert.equal(response.body.order.totalCents,25*priceCents+499,'wrong price for '+productId);
 }
 for(const [quantity,cents] of [[100,455],[200,420],[400,385]]){
   const response=await call(orders,{method:'POST',headers:{cookie},body:{...body,items:[{productId:'chocolate50',quantity}]}});
   assert.equal(response.statusCode,201);
   assert.equal(response.body.order.totalCents,quantity*cents+499,'wrong tier '+quantity);
 }
 const mix=await call(orders,{method:'POST',headers:{cookie},body:{...body,items:[{productId:'branco',quantity:15},{productId:'chocolate50',quantity:10}]}});
 assert.equal(mix.statusCode,201);
 assert.equal(mix.body.order.totalCents,15*510+10*460+499,'mixed flavors must share total-quantity tier');
 for(const productId of ['pistache','caramelo','morango']){
   const unavailable=await call(orders,{method:'POST',headers:{cookie},body:{...body,items:[{productId,quantity:25}]}});
   assert.equal(unavailable.statusCode,400);
   assert.match(unavailable.body.error,/indisponíveis/);
 }
 assert.equal((await db.query('SELECT count(*)::int n FROM reseller_orders')).rows[0].n,0);
 assert.equal((await db.query('SELECT count(*)::int n FROM reseller_test_orders')).rows[0].n,12);
 assert.equal((await call(orders,{headers:{cookie}})).statusCode,401);
 assert.equal((await call(orders,{method:'PATCH',headers:{cookie},body:{id:testOrder.body.order.id,status:'concluido'}})).statusCode,401);
 assert.equal((await db.query("SELECT count(*)::int n FROM information_schema.tables WHERE table_name='shared_stock_state'")).rows[0].n,1);
 assert.equal((await db.query('SELECT count(*)::int n FROM shared_stock_state')).rows[0].n,0);
 await call(customers,{method:'POST',headers:{cookie},body:{action:'logout'}});
 assert.equal((await call(customers,{query:{scope:'current'},headers:{cookie}})).body.account,null);
 assert.equal((await call(resellerTables,{method:'GET',headers:{cookie}})).statusCode,403);
 assert.equal((await call(orders,{method:'POST',headers:{cookie},body})).statusCode,401);
 process.env.VERCEL_ENV='preview';
 assert.deepEqual(await controlesStockSummary(database()),{available:false,reason:'preview_isolated'});
 process.env.VERCEL_ENV='production';
 const publicIdentity=await publicStockReadIdentity(database());
 assert.ok(!('privateKey' in publicIdentity));
 process.env.UBA_CONTROLES_API_URL='https://controls.example.invalid';process.env.UBA_STOCK_READ_TOKEN='synthetic-read-token';
 globalThis.fetch=async(url,opts)=>{const [timestamp,nonce,signature]=opts.headers.authorization.replace('UBA-Ed25519 ','').split('.');assert.ok(verify(null,Buffer.from(`${publicIdentity.scope}\n${timestamp}\n${nonce}`),publicIdentity.publicKey,Buffer.from(signature,'base64url')));assert.ok(!opts.method||opts.method==='GET');return {ok:true,json:async()=>({products:{chocolate50:12,branco:3,caramelo:4,morango:5,pistache:6},updatedAt:'2026-09-26T00:00:00Z'})}};
 assert.equal((await controlesStockSummary(database())).total,30);
 globalThis.fetch=async()=>{throw Error('offline')};assert.deepEqual(await controlesStockSummary(database()),{available:false,reason:'unavailable'});
 console.log('PASS: authenticated expiring test login; durable separate orders; no charge/network/stock mutation; forged test flag rejected; no admin access; logout revokes session; read-only stock proxy and unavailable state.');
}finally{await db.close();}
