import {aiConfigured,queueHistory,replyChannels,startChatWorker} from './chat-ai.js';
import {socialConfigured,socialWebhook} from './social.js';
import {currencies,defaultSettings,timeZones,validIncomeTaxRate} from './public/business-model.js';
import { adminRecoveryStatus, resetWithAccessCode } from './owner-access-code.js';
import { ownerEmail, recoveryEnabled, recover } from './owner-recovery.js';
import http from 'node:http';
import {businessRoutes,recordSale} from './business.js';
import {customerRoutes} from './customer.js';
import {randomBytes,scrypt as derive,timingSafeEqual,createHash} from 'node:crypto';
import {promisify} from 'node:util';
const scrypt=promisify(derive);
const digest=t=>createHash('sha256').update(t).digest('hex');
async function body(req){let raw='';for await(const c of req){raw+=c;if(raw.length>12000)throw Object.assign(Error('Request too large'),{status:413});}try{return JSON.parse(raw);}catch{throw Object.assign(Error('Invalid JSON'),{status:400});}}
const invalid=message=>{throw Object.assign(Error(message),{status:400});};
import { readFileSync } from 'node:fs';
import {pool,initialize} from './db.js';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.dirname(fileURLToPath(import.meta.url));
await initialize();
const stopChatWorker=process.env.NODE_ENV==='test'?()=>{}:startChatWorker();
const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(data));};
const ownerCookie=token=>`relay_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800${process.env.NODE_ENV==='production'?'; Secure':''}`;
export const server=http.createServer(async(req,res)=>{
 try {
 const url=new URL(req.url,'http://localhost'); const route=url.pathname;
 if(route==='/api/social/webhook')return socialWebhook(req,res,url,json);
 if(route.startsWith('/api/')){
 res.setHeader('Cache-Control','no-store');
 if(!['GET','HEAD'].includes(req.method)&&req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`&&req.headers.origin!==`https://${req.headers.host}`)return json(res,403,{error:'Invalid request origin'});
 if(route.startsWith('/api/shop/')&&process.env.ENABLE_LEGACY_SHOP!=='1')return json(res,410,{error:'Website ordering is closed.'});
 if(/^\/api\/website\/(session|signup|signin|signout|chat)$/.test(route)){
  if(await customerRoutes(req,res,route.replace('/api/website/','/api/shop/'),{pool,body,invalid,json,scrypt,digest,randomBytes,timingSafeEqual,websiteChat:true}))return;
 }
 if(await customerRoutes(req,res,route,{pool,body,invalid,json,scrypt,digest,randomBytes,timingSafeEqual}))return;
 const cookie=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('relay_session='))?.slice(14)||'';
 const signedIn=!!(await pool.query('SELECT token FROM sessions WHERE token=$1 AND expires_at>NOW()',[digest(cookie)])).rowCount;
 const configured=!!(await pool.query('SELECT id FROM users')).rowCount;
 if(route==='/api/auth/session'&&req.method==='GET'){
  const status=await adminRecoveryStatus();
  return json(res,200,{signedIn,configured,recoveryEnabled:recoveryEnabled(),adminRecoveryEnabled:status==='ready',adminRecoveryStatus:status,ownerSetupFromHost:process.env.NODE_ENV==='production'});
 }
 if(route==='/api/auth/recovery/access-code'&&req.method==='POST'){
  const token=await resetWithAccessCode(await body(req),invalid);
  if(!token)return json(res,400,{error:'The hosting recovery code is invalid, disabled, or already used.'});
  res.setHeader('Set-Cookie',ownerCookie(token));
  return json(res,200,{ok:true});
 }
 if(['/api/auth/recovery/request','/api/auth/recovery/reset'].includes(route)&&req.method==='POST'){
  const result=await recover(req,route,body,invalid);
  return result.ok?json(res,200,result):json(res,400,{error:'The code is invalid or expired. Request a new code.'});
 }
 if(['/api/auth/setup','/api/auth/signin'].includes(route)&&req.method==='POST'){
 const p=await body(req);const email=typeof p.email==='string'?p.email.trim().toLowerCase():'';
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||typeof p.password!=='string'||p.password.length<12||p.password.length>128)invalid('Enter a valid email and a password of 12–128 characters.');
 let verifiedHash;
 if(route.endsWith('/setup')){
 const allowed=ownerEmail();
 if(!allowed&&process.env.NODE_ENV==='production')return json(res,503,{error:'Set OWNER_EMAIL in the hosting settings before creating the owner account.'});
 if(allowed&&email!==allowed)return json(res,403,{error:'Use the configured owner email.'});
 if(allowed&&process.env.NODE_ENV==='production')return json(res,403,{error:'Create the first owner from the hosting shell using npm run owner:setup.'});
 const salt=randomBytes(16).toString('hex');const hash=(await scrypt(p.password,salt,64)).toString('hex');
 verifiedHash=hash;
 const result=await pool.query('INSERT INTO users VALUES(1,$1,$2,$3) ON CONFLICT DO NOTHING RETURNING id',[email,hash,salt]);
 if(!result.rowCount)return json(res,409,{error:'Owner account already exists. Please sign in.'});
 }else{
 const user=(await pool.query('SELECT * FROM users WHERE id=1')).rows[0];
 const hash=await scrypt(p.password,user?.salt||'missing-account',64);
 if(!user||user.email!==email||!timingSafeEqual(hash,Buffer.from(user.password_hash,'hex')))return json(res,401,{error:'Email or password is incorrect.'});
 verifiedHash=user.password_hash;
 }
 const token=randomBytes(32).toString('hex');await pool.query("DELETE FROM sessions WHERE expires_at<=NOW()");const session=await pool.query(`INSERT INTO sessions
 SELECT $1,NOW()+INTERVAL '7 days' FROM users WHERE id=1 AND password_hash=$2 FOR SHARE`,[digest(token),verifiedHash]);
 if(!session.rowCount)return json(res,401,{error:'Email or password is incorrect.'});
 res.setHeader('Set-Cookie',ownerCookie(token));return json(res,200,{ok:true});
 }
 if(route==='/api/auth/signout'&&req.method==='POST'){await pool.query('DELETE FROM sessions WHERE token=$1',[digest(cookie)]);res.setHeader('Set-Cookie','relay_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');return json(res,200,{ok:true});}
 if(!signedIn)return json(res,401,{error:'Please sign in.'});
 }
 if(route==='/api/chats/analyze'&&req.method==='POST'){
  if(!aiConfigured())return json(res,503,{error:'Configure AI chat before analyzing conversations.'});
  return json(res,202,{queued:await queueHistory()});
 }
 if(route==='/api/settings/tax'&&req.method==='PUT'){
  const p=await body(req);
  if(!validIncomeTaxRate(p?.rate))invalid('Enter a rate from 0 to 100 with up to two decimal places, or leave it blank.');
  await pool.query(`INSERT INTO workspace_settings(id,income_tax_rate) VALUES(1,$1)
    ON CONFLICT(id) DO UPDATE SET income_tax_rate=EXCLUDED.income_tax_rate`,[p.rate]);
  return json(res,200,{ok:true});
 }
 if(route==='/api/settings'&&req.method==='PUT'){
  const p=await body(req);
  const name=typeof p?.name==='string'?p.name.trim():'';
  if(!name||name.length>80||!['ar','en'].includes(p.language)||!timeZones.has(p.time_zone)||
     !Number.isInteger(p.low_stock_threshold)||p.low_stock_threshold<0||p.low_stock_threshold>2147483647||
     !['month','quarter','year'].includes(p.default_period)||!currencies.has(p.currency))invalid('Check the workspace settings.');
  const client=await pool.connect();
  try{
   await client.query('BEGIN');
   await client.query('INSERT INTO workspace_settings(id) VALUES(1) ON CONFLICT DO NOTHING');
   const existing=(await client.query('SELECT currency FROM workspace_settings WHERE id=1 FOR UPDATE')).rows[0];
   if(existing.currency!==p.currency&&p.confirm!==true){
    await client.query('ROLLBACK');
    return json(res,400,{error:'Confirm the currency change first.'});
   }
   await client.query(`UPDATE workspace_settings SET name=$1,language=$2,time_zone=$3,
     low_stock_threshold=$4,default_period=$5,currency=$6 WHERE id=1`,
     [name,p.language,p.time_zone,p.low_stock_threshold,p.default_period,p.currency]);
   await client.query('COMMIT');
   return json(res,200,{ok:true});
  }catch(error){await client.query('ROLLBACK');throw error;}
  finally{client.release();}
 }
 if(route==='/api/settings/currency'&&req.method==='PUT'){
  const p=await body(req);
  if(!currencies.has(p?.currency)||p.confirm!==true)invalid('Choose a currency and confirm how existing amounts are interpreted.');
  await pool.query(`INSERT INTO workspace_settings(id,currency) VALUES(1,$1)
   ON CONFLICT(id) DO UPDATE SET currency=EXCLUDED.currency`,[p.currency]);
  return json(res,200,{ok:true});
 }
 if(route==='/api/customers'&&req.method==='GET'){
  const {rows}=await pool.query(`SELECT id,name,email,conversation_id,registered_at FROM customers ORDER BY id DESC`);
  return json(res,200,{customers:rows});
 }
 await businessRoutes(req,res,route,{body,invalid,json});
 if(res.writableEnded)return;
 if(route==='/api/orders'&&req.method==='POST'){
 const p=await body(req);
 if(!Number.isSafeInteger(p.product_id)||!Number.isSafeInteger(p.quantity)||p.quantity<1||p.quantity>2147483647||![p.unit_price,p.unit_cost].every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=9999999999.99)||!['WhatsApp','Instagram','Messenger','Website'].includes(p.channel)||!['Paid','Pending','Cancelled','Refunded'].includes(p.status))invalid('Enter valid order details.');
 const c=await pool.connect();try{await c.query('BEGIN');if(p.conversation_id!==undefined&&(!Number.isSafeInteger(p.conversation_id)||!(await c.query('SELECT id FROM conversations WHERE id=$1',[p.conversation_id])).rowCount))invalid('Choose an existing conversation.');const product=(await c.query('SELECT * FROM products WHERE id=$1 FOR UPDATE',[p.product_id])).rows[0];if(!product)invalid('Choose an existing product.');if(p.status==='Paid'){if(product.stock<p.quantity)invalid('Not enough stock for this paid order.');}
 const result=await c.query("INSERT INTO orders(id,product_id,quantity,unit_price,unit_cost,channel,status,date,paid_at) VALUES(nextval('order_ids'),$1,$2,$3,$4,$5,$6,NOW(),CASE WHEN $6='Paid' THEN NOW() END) RETURNING *",[p.product_id,p.quantity,p.unit_price,p.unit_cost,p.channel,p.status]);if(p.status==='Paid')await recordSale(c,result.rows[0],product);if(p.conversation_id!==undefined){await c.query('INSERT INTO conversation_orders VALUES($1,$2,$3)',[result.rows[0].id,p.conversation_id,randomBytes(24).toString('hex')]);await c.query("INSERT INTO messages(conversation_id,role,body) VALUES($1,'agent',$2)",[p.conversation_id,`Order #${result.rows[0].id}: ${p.quantity} × ${product.name}, total ${(p.quantity*p.unit_price).toFixed(2)} ${(await c.query('SELECT currency FROM workspace_settings WHERE id=1')).rows[0]?.currency??'USD'}. Status: ${p.status}.`]);}await c.query('COMMIT');return json(res,201,result.rows[0]);}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
 }
 if(route==='/api/overview' && req.method==='GET'){
  const {rows:[data]}=await pool.query(`SELECT
   COALESCE((SELECT json_agg(c ORDER BY c.id) FROM conversations c), '[]') AS conversations,
   COALESCE((SELECT json_agg(p ORDER BY p.id) FROM products p), '[]') AS products,
   COALESCE((SELECT json_agg(linked ORDER BY linked.id) FROM (
    SELECT o.*,co.conversation_id FROM orders o LEFT JOIN conversation_orders co ON co.order_id=o.id
   ) linked), '[]') AS orders,
   COALESCE((SELECT json_agg(m ORDER BY m.id DESC) FROM stock_movements m), '[]') AS movements,
   COALESCE((SELECT json_agg(e ORDER BY e.date DESC,e.id DESC) FROM operating_expenses e), '[]') AS expenses,
   COALESCE((SELECT json_agg(t) FROM sales_targets t), '[]') AS targets,
   COALESCE((SELECT json_agg(t) FROM product_targets t),'[]') AS "productTargets",
   COALESCE((SELECT currency FROM workspace_settings WHERE id=1),'USD') AS currency,
   (SELECT row_to_json(s) FROM workspace_settings s WHERE id=1) AS settings,
   COALESCE((SELECT json_agg(channels) FROM (
    SELECT t.channel, COUNT(DISTINCT t.conversation_id)::int AS conversations, COUNT(m.id)::int AS messages
    FROM social_threads t LEFT JOIN messages m ON m.conversation_id=t.conversation_id AND m.role='customer'
    GROUP BY t.channel
   ) channels),'[]') AS "socialActivity",
   COALESCE((SELECT json_agg(a) FROM chat_analysis a),'[]') AS "chatAnalysis",
   COALESCE((SELECT json_agg(j) FROM (SELECT conversation_id,state FROM ai_chat_jobs) j),'[]') AS "chatJobs"
   `);
  return json(res,200,{...data,settings:data.settings??defaultSettings,workspace:data.settings?.name??defaultSettings.name,demo:process.env.SEED_DEMO==='1',socialConfigured:socialConfigured(),aiConfigured:aiConfigured(),replyChannels:aiConfigured()?replyChannels():[]});
 }
 if(route.match(/^\/api\/orders\/\d+\/confirm$/)&&req.method==='POST'){
 const id=Number(route.split('/')[3]);const p=await body(req);if(typeof p.unit_cost!=='number'||!Number.isFinite(p.unit_cost)||p.unit_cost<0||p.unit_cost>9999999999.99)invalid('Enter a valid unit cost.');
 const c=await pool.connect();try{await c.query('BEGIN');const order=(await c.query('SELECT * FROM orders WHERE id=$1 FOR UPDATE',[id])).rows[0];if(!order||order.status!=='Pending')invalid('This order is no longer pending.');const product=(await c.query('SELECT * FROM products WHERE id=$1 FOR UPDATE',[order.product_id])).rows[0];if(product.stock<order.quantity)invalid('Not enough stock to confirm payment.');await c.query("UPDATE orders SET status='Paid',unit_cost=$1,paid_at=NOW() WHERE id=$2",[p.unit_cost,id]);await recordSale(c,{...order,unit_cost:p.unit_cost},product);const link=(await c.query('SELECT conversation_id FROM conversation_orders WHERE order_id=$1',[id])).rows[0];if(link){await c.query("INSERT INTO messages(conversation_id,role,body) VALUES($1,'agent',$2)",[link.conversation_id,`Payment confirmed for order #${id}. Thank you!`]);await c.query("UPDATE conversations SET status='Converted' WHERE id=$1",[link.conversation_id]);}await c.query('COMMIT');return json(res,200,{ok:true});}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
 }
 const match=route.match(/^\/api\/conversations\/(\d+)(\/messages)?$/);
 if(match){const id=Number(match[1]);if(!(await pool.query('SELECT id FROM conversations WHERE id=$1',[id])).rowCount)return json(res,404,{error:'Conversation not found'});
 if(req.method==='GET')return json(res,200,(await pool.query('SELECT * FROM messages WHERE conversation_id=$1 ORDER BY id',[id])).rows);
 if(req.method==='POST' && match[2]){let body='';for await (const chunk of req){body+=chunk;if(body.length>12000)return json(res,413,{error:'Message too long'});}let payload;try{payload=JSON.parse(body);}catch{return json(res,400,{error:'Invalid JSON'});}if(typeof payload.body!=='string'||!payload.body.trim()||payload.body.length>4000)return json(res,400,{error:'Enter a message of 1–4000 characters'});await pool.query('INSERT INTO messages(conversation_id,role,body) VALUES($1,$2,$3)',[id,'agent',payload.body.trim()]);return json(res,201,{ok:true});}
 if(req.method==='PATCH'&&!match[2]){let body='';for await(const c of req){body+=c;if(body.length>1000)return json(res,413,{error:'Request too large'});}let p;try{p=JSON.parse(body);}catch{return json(res,400,{error:'Invalid JSON'});}if(!['Needs reply','AI handling','Converted','Inactive'].includes(p.status))return json(res,400,{error:'Invalid status'});await pool.query('UPDATE conversations SET status=$1 WHERE id=$2',[p.status,id]);return json(res,200,{ok:true});}}
 if(route.startsWith('/api/'))return json(res,404,{error:'Not found'});
 if(req.method!=='GET')return json(res,405,{error:'Method not allowed'});
 if(['/shop','/shop/','/shop.html'].includes(route)&&process.env.ENABLE_LEGACY_SHOP!=='1'){
  res.writeHead(410,{'Content-Type':'text/plain; charset=utf-8'});
  return res.end('Website ordering is closed. / الطلبات من الموقع متوقفة.');
 }
 const files={'/guide.js':'guide.js','/chat':'website-chat.html','/chat/':'website-chat.html','/website-chat.js':'website-chat.js','/i18n.js':'i18n.js','/shop':'shop.html','/shop/':'shop.html','/shop.html':'shop.html','/shop.js':'shop.js','/':'index.html','/app.js':'app.js','/style.css':'style.css','/analytics.js':'analytics.js','/business-model.js':'business-model.js','/business-view.js':'business-view.js','/demo.js':'demo.js','/demo-data.json':'demo-data.json'};if(!files[route])return json(res,404,{error:'Not found'});res.writeHead(200,{'Content-Type':route.endsWith('.json')?'application/json':route.endsWith('.js')?'text/javascript':route.endsWith('.css')?'text/css':'text/html'});res.end(readFileSync(path.join(root,'public',files[route])));
 }catch(e){console.error('Request failed:',e.code||e.name);json(res,e.status||500,{error:e.status?e.message:'Something went wrong'});}
});
if(process.env.NODE_ENV!=='test')server.listen(Number(process.env.PORT||3000),'0.0.0.0',()=>console.log('Relay CRM listening on port '+(process.env.PORT||3000)));

export async function close(){stopChatWorker();await new Promise(resolve=>server.close(resolve));await pool.end();}
if(process.env.NODE_ENV!=='test'){for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>close().then(()=>process.exit(0)));}
