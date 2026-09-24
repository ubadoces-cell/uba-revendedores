import {PGlite} from '@electric-sql/pglite';
export const db=new PGlite();
export const statements=[];
export function neon(url) {
  if (!url.includes('isolated.test')) throw new Error('Teste recusou conexao externa');
  return {async query(sql,params=[]){statements.push(sql);return (await db.query(sql,params)).rows;}};
}
