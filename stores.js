import {randomBytes} from 'node:crypto';
import {basePool,initializeSchema,selectStoreSchema,currentStore} from './db.js';

export const slugPattern=/^[a-z0-9](?:[a-z0-9-]{1,38})[a-z0-9]$/;
export const storePrefix=()=>currentStore()?'/w/'+currentStore().slug:'';
export const publicSignupEnabled=()=>process.env.STOREFRONT_SIGNUP_ENABLED==='1';

export async function findStore(slug){
 if(typeof slug!=='string'||!slugPattern.test(slug))return null;
 return (await basePool.query('SELECT slug,schema_name FROM platform_stores WHERE slug=$1',[slug])).rows[0]??null;
}

export async function listStores(){
 return (await basePool.query('SELECT slug,schema_name FROM platform_stores ORDER BY slug')).rows;
}

export async function createStore(input,{invalid,scrypt}){
 const name=typeof input?.name==='string'?input.name.trim():'';
 const slug=typeof input?.slug==='string'?input.slug.trim().toLowerCase():'';
 const email=typeof input?.email==='string'?input.email.trim().toLowerCase():'';
 const password=input?.password;
 if(!name||name.length>80||!slugPattern.test(slug)||slug==='legacy'||email.length>254||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||typeof password!=='string'||password.length<12||password.length>128){
  invalid('Enter a store name, a 3–40 character store address, a valid email and a password of 12–128 characters.');
 }
 const schema='store_'+randomBytes(16).toString('hex');
 const salt=randomBytes(16).toString('hex');
 const hash=(await scrypt(password,salt,64)).toString('hex');
 const client=await basePool.connect();
 try{
  await client.query('BEGIN');
  const claimed=await client.query('INSERT INTO platform_stores(slug,schema_name) VALUES($1,$2) ON CONFLICT DO NOTHING',[slug,schema]);
  if(!claimed.rowCount)throw Object.assign(Error('This store address is already in use.'),{status:409});
  await client.query('CREATE SCHEMA '+schema);
  await selectStoreSchema(client,schema);
  await initializeSchema(client,false);
  await client.query('INSERT INTO users(id,email,password_hash,salt) VALUES(1,$1,$2,$3)',[email,hash,salt]);
  await client.query("INSERT INTO workspace_settings(id,name,currency) VALUES(1,$1,'EGP')",[name]);
  await client.query('COMMIT');
  return {slug,dashboard:'/w/'+slug+'/',storefront:'/w/'+slug+'/shop'};
 }catch(error){await client.query('ROLLBACK');throw error;}
 finally{client.release();}
}

function routes(){
 try{
  const value=JSON.parse(process.env.STORE_META_ROUTES??'null');
  return value&&typeof value==='object'&&!Array.isArray(value)?value:null;
 }catch{return {};}
}

export const metaRoutesConfigured=()=>Boolean(process.env.STORE_META_ROUTES);
export function metaRoute(channel,account){
 const config=routes();
 const key=channel+':'+account;
 if(!config||!Object.hasOwn(config,key))return null;
 const match=config[key];
 return typeof match?.store==='string'&&(match.store==='legacy'||slugPattern.test(match.store))?match:null;
}

export function hasMetaRoute(slug,channel){
 return Object.entries(routes()??{}).some(([key,value])=>
  (!channel||key.startsWith(channel+':'))&&value?.store===slug);
}

export function hasMetaToken(slug,channel){
 return Object.entries(routes()??{}).some(([key,value])=>
  key.startsWith(channel+':')&&value?.store===slug&&typeof value.token==='string'&&Boolean(value.token));
}
