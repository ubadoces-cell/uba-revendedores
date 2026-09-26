import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash,scryptSync,verify} from 'node:crypto';
import {db} from './neon-mock.mjs';
import customers from '../api/customer-accounts.js';
import orders from '../api/orders.js';
import access from '../server/test-access.js';
import {database} from '../server/database.js';
import {publicStockReadIdentity} from '../server/stock-read-identity.js';
import {controlesStockSummary} from '../server/controles-stock.js';
const call=async(fn,req)=>{const res={statusCode:200,headers:{},status(n){this.statusCode=n;return this},setHeader(k,v){this.headers[k]=v},json(data){this.body=data;return this}};await fn({method:'GET',headers:{},query:{},...req},res);return res};
try{
 process.env.RESELLER_DATABASE_DATABASE_URL='postgres://isolated.test/db';
 await db.exec(await readFile(new URL('../server/schema.sql',import.meta.url),'utf8'));
 // Change only in-memory test configuration. Never commit a plaintext password.
 const password='synthetic-test-password';access.passwordHash=scryptSync(password,access.salt,64).toString('hex');access.expiresAt=new Date(Date.now()+86400000).toISOString();
 let calls=0;globalThis.fetch=async()=>{calls++;throw Error('External access forbidden in test')};
 assert.equal((await call(customers,{method:'POST',body:{action:'login',login:access.login,password:'wrong'}})).statusCode,401);
 const login=await call(customers,{method:'POST',body:{action:'login',login:access.login,password}});
 assert.equal(login.statusCode,200);assert.equal(login.body.account.isTest,true);
 const cookie=login.headers['Set-Cookie'][0].split(';')[0];
 const current=await call(customers,{query:{scope:'current'},headers:{cookie}});assert.equal(current.body.account.isTest,true);
 const body={isTest:true,customer:{name:'Test',doc:'00000000000'},buyer:{name:'Test',doc:'00000000000'},items:[{productId:'branco',quantity:50}],delivery:{city:'Local test'}};
 // Body flags cannot bypass authentication or payment for regular customers.
 assert.equal((await call(orders,{method:'POST',body})).statusCode,401);
 const testOrder=await call(orders,{method:'POST',headers:{cookie},body});
 assert.equal(testOrder.statusCode,201);assert.equal(testOrder.body.order.isTest,true);assert.equal(testOrder.body.order.paymentStatus,'teste_sem_cobranca');assert.equal(calls,0);
 assert.equal((await db.query('SELECT count(*)::int n FROM reseller_orders')).rows[0].n,0);
 assert.equal((await db.query('SELECT count(*)::int n FROM reseller_test_orders')).rows[0].n,1);
 assert.equal((await call(orders,{headers:{cookie}})).statusCode,401);
 assert.equal((await call(orders,{method:'PATCH',headers:{cookie},body:{id:testOrder.body.order.id,status:'concluido'}})).statusCode,401);
 assert.equal((await db.query("SELECT count(*)::int n FROM information_schema.tables WHERE table_name='shared_stock_state'")).rows[0].n,1);
 assert.equal((await db.query('SELECT count(*)::int n FROM shared_stock_state')).rows[0].n,0);
 await call(customers,{method:'POST',headers:{cookie},body:{action:'logout'}});
 assert.equal((await call(customers,{query:{scope:'current'},headers:{cookie}})).body.account,null);
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
