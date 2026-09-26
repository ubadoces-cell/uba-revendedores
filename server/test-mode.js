import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import access from './test-access.js';
export const TEST_COOKIE='uba_rev_test_session';
export const TEST_ACCOUNT={id:'uba-test-customer',name:'Cliente de teste UBA',email:access.login,phone:'',doc:'00000000000',store:'TESTE — não entregar',purpose:'commerce',status:'approved',isTest:true};
const hash=v=>createHash('sha256').update(v).digest('hex');
function token(req){for(const part of String(req.headers.cookie||'').split(';')){const [k,...v]=part.trim().split('=');if(k===TEST_COOKIE)return v.join('=')}return '';}
export function clearTestCookie(){return `${TEST_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;}
async function schema(sql){
 await sql.query(`CREATE TABLE IF NOT EXISTS reseller_test_sessions(token_hash TEXT PRIMARY KEY,expires_at TIMESTAMPTZ NOT NULL)`,[]);
 await sql.query(`CREATE TABLE IF NOT EXISTS reseller_test_orders(id TEXT PRIMARY KEY,code TEXT UNIQUE NOT NULL,status TEXT NOT NULL DEFAULT 'novo',data JSONB NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,[]);
}
export async function loginTest(req,res,sql,body){
 if(String(body.login||'').trim().toLowerCase()!==access.login)return null;
 const received=scryptSync(String(body.password||''),access.salt,64);const expected=Buffer.from(access.passwordHash,'hex');
 if(Date.now()>=Date.parse(access.expiresAt)||!timingSafeEqual(received,expected))return {error:'Login de teste inválido ou expirado.'};
 await schema(sql);const secret=randomBytes(32).toString('hex');
 const expires=new Date(Math.min(Date.now()+86400000,Date.parse(access.expiresAt))).toISOString();
 await sql.query('INSERT INTO reseller_test_sessions(token_hash,expires_at) VALUES($1,$2)',[hash(secret),expires]);
 res.setHeader('Set-Cookie',[`${TEST_COOKIE}=${secret}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=86400`,'uba_rev_customer_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0']);
 return {account:TEST_ACCOUNT};
}
export async function testCustomer(req,sql){
 const value=token(req);if(!value||Date.now()>=Date.parse(access.expiresAt))return null;
 await schema(sql);const rows=await sql.query('SELECT token_hash FROM reseller_test_sessions WHERE token_hash=$1 AND expires_at>NOW()',[hash(value)]);
 return rows[0]?TEST_ACCOUNT:null;
}
export async function logoutTest(req,sql){const value=token(req);if(value){await schema(sql);await sql.query('DELETE FROM reseller_test_sessions WHERE token_hash=$1',[hash(value)]);}}
function serialize(row){return {...row.data,id:row.id,code:row.code,status:row.status,isTest:true,paymentStatus:'teste_sem_cobranca',createdAt:row.created_at,updatedAt:row.updated_at};}
export async function saveTestOrder(sql,calculated,delivery){
 await schema(sql);const id='test_'+randomBytes(16).toString('hex');const code='TESTE-'+randomBytes(6).toString('hex').toUpperCase();
 const data={customer:TEST_ACCOUNT,purpose:'commerce',delivery,items:calculated.items,units:calculated.units,totalCents:calculated.totalCents,paidAt:null};
 const rows=await sql.query('INSERT INTO reseller_test_orders(id,code,data) VALUES($1,$2,$3::jsonb) RETURNING *',[id,code,JSON.stringify(data)]);
 return serialize(rows[0]);
}
export async function listTestOrders(sql){await schema(sql);return (await sql.query('SELECT * FROM reseller_test_orders ORDER BY created_at DESC LIMIT 200',[])).map(serialize);}
export async function updateTestOrder(sql,id,status){await schema(sql);const rows=await sql.query('UPDATE reseller_test_orders SET status=$2,updated_at=NOW() WHERE id=$1 RETURNING *',[id,status]);return rows[0]?serialize(rows[0]):null;}
