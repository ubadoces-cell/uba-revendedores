import { generateKeyPairSync, createHash, sign, randomBytes } from 'node:crypto';

export const STOCK_READ_SCOPE='uba-revendedores:controles-stock-read:v1';
export const STOCK_WRITE_SCOPE='uba-revendedores:controles-stock-write:v1';

async function identity(sql){
 await sql.query(`CREATE TABLE IF NOT EXISTS reseller_integration_identity(id TEXT PRIMARY KEY,public_key TEXT NOT NULL,private_key TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,[]);
 const existing=await sql.query('SELECT public_key,private_key FROM reseller_integration_identity WHERE id=$1',['controles-stock-read']);
 if(existing[0])return existing[0];
 const pair=generateKeyPairSync('ed25519',{publicKeyEncoding:{type:'spki',format:'pem'},privateKeyEncoding:{type:'pkcs8',format:'pem'}});
 await sql.query('INSERT INTO reseller_integration_identity(id,public_key,private_key) VALUES($1,$2,$3) ON CONFLICT(id) DO NOTHING',['controles-stock-read',pair.publicKey,pair.privateKey]);
 return (await sql.query('SELECT public_key,private_key FROM reseller_integration_identity WHERE id=$1',['controles-stock-read']))[0];
}

export async function publicStockReadIdentity(sql){
 const key=await identity(sql);
 return {publicKey:key.public_key,keyId:createHash('sha256').update(key.public_key).digest('hex'),scope:STOCK_READ_SCOPE};
}

function authorization(key,scope,bodyText=''){
 const timestamp=Date.now().toString();
 const nonce=randomBytes(16).toString('hex');
 const bodyHash=bodyText?createHash('sha256').update(bodyText).digest('hex'):'';
 const message=bodyText?`${scope}\n${timestamp}\n${nonce}\n${bodyHash}`:`${scope}\n${timestamp}\n${nonce}`;
 const signature=sign(null,Buffer.from(message),key.private_key).toString('base64url');
 return `UBA-Ed25519 ${timestamp}.${nonce}.${signature}`;
}

export async function stockReadAuthorization(sql){
 const key=await identity(sql);
 return authorization(key,STOCK_READ_SCOPE);
}

export async function stockWriteAuthorization(sql,bodyText){
 const key=await identity(sql);
 return authorization(key,STOCK_WRITE_SCOPE,String(bodyText||''));
}
