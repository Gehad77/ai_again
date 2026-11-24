import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import pg from 'pg';
if(!process.env.DATABASE_URL)throw Error('API tests require a running PostgreSQL database and DATABASE_URL.');
const admin=new pg.Pool({connectionString:process.env.DATABASE_URL});
const schema='test_'+Date.now()+'_'+Math.floor(Math.random()*100000);
await admin.query(`CREATE SCHEMA ${schema}`);
const testUrl=new URL(process.env.DATABASE_URL);testUrl.searchParams.set('options',`-c search_path=${schema}`);
process.env.DATABASE_URL=testUrl.toString();process.env.NODE_ENV='test';process.env.SEED_DEMO='1';
const {server,close}=await import('../server.js');
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`;
const rawFetch=globalThis.fetch;
assert.equal((await rawFetch(base+'/api/overview')).status,401);
const setup=await rawFetch(base+'/api/auth/setup',{method:'POST',body:JSON.stringify({email:'owner@example.com',password:'test-password-12345'})});
assert.equal(setup.status,200);
const cookie=setup.headers.get('set-cookie').split(';')[0];
const fetch=(url,options={})=>rawFetch(url,{...options,headers:{...options.headers,cookie}});
after(async()=>{await close();await admin.query(`DROP SCHEMA ${schema} CASCADE`);await admin.end();});
test('workspace returns seeded conversations and inventory',async()=>{const r=await fetch(base+'/api/overview');assert.equal(r.status,200);const d=await r.json();assert.equal(d.conversations.length,6);assert.equal(d.products.length,4);assert.equal(d.demo,true);});
test('reply persists and conversion status updates',async()=>{let r=await fetch(base+'/api/conversations/1/messages',{method:'POST',body:JSON.stringify({body:'Olive is available. Would you like to order?'})});assert.equal(r.status,201);let msgs=await(await fetch(base+'/api/conversations/1')).json();assert.equal(msgs.at(-1).role,'agent');assert.match(msgs.at(-1).body,/Olive/);r=await fetch(base+'/api/conversations/1',{method:'PATCH',body:JSON.stringify({status:'Converted'})});assert.equal(r.status,200);const d=await(await fetch(base+'/api/overview')).json();assert.equal(d.conversations[0].status,'Converted');});
test('rejects invalid payloads and missing conversations',async()=>{for(const body of ['{',JSON.stringify({body:''})]){const r=await fetch(base+'/api/conversations/1/messages',{method:'POST',body});assert.equal(r.status,400);}assert.equal((await fetch(base+'/api/conversations/999')).status,404);assert.equal((await fetch(base+'/api/conversations/1',{method:'PATCH',body:JSON.stringify({status:'nonsense'})})).status,400);});
test('frontend and assets are served',async()=>{for(const path of ['/','/app.js','/style.css','/business-model.js','/business-view.js'])assert.equal((await fetch(base+path)).status,200);assert.equal((await fetch(base+'/server.js')).status,404);});

test('reinitializing PostgreSQL preserves replies and statuses',async()=>{const {initialize}=await import('../db.js');await initialize();const messages=await(await fetch(base+'/api/conversations/1')).json();assert.equal(messages.at(-1).role,'agent');const overview=await(await fetch(base+'/api/overview')).json();assert.equal(overview.conversations[0].status,'Converted');assert.equal(overview.orders.length,8);assert.equal(typeof overview.products[0].price,'number');});

test('owner access, product creation and transactional order stock',async()=>{
 assert.equal((await rawFetch(base+'/api/products',{method:'POST',body:'{}'})).status,401);
 assert.equal((await rawFetch(base+'/api/auth/signin',{method:'POST',body:JSON.stringify({email:'owner@example.com',password:'wrong-password-123'})})).status,401);
 const login=await rawFetch(base+'/api/auth/signin',{method:'POST',body:JSON.stringify({email:'owner@example.com',password:'test-password-12345'})});assert.equal(login.status,200);
 assert.equal((await fetch(base+'/api/auth/setup',{method:'POST',body:JSON.stringify({email:'other@example.com',password:'test-password-12345'})})).status,409);
 assert.equal((await fetch(base+'/api/products',{method:'POST',body:JSON.stringify({name:'Invalid',category:'Test',price:-1,stock:2})})).status,400);
 const r=await fetch(base+'/api/products',{method:'POST',body:JSON.stringify({name:'New tote',category:'Bags',price:25,stock:3})});assert.equal(r.status,201);const p=await r.json();
 const order={product_id:p.id,quantity:2,unit_price:25,unit_cost:10,channel:'WhatsApp',status:'Paid'};
 assert.equal((await fetch(base+'/api/orders',{method:'POST',body:JSON.stringify(order)})).status,201);
 assert.equal((await fetch(base+'/api/orders',{method:'POST',body:JSON.stringify(order)})).status,400);
 order.status='Pending';assert.equal((await fetch(base+'/api/orders',{method:'POST',body:JSON.stringify(order)})).status,201);
 const overview=await(await fetch(base+'/api/overview')).json();assert.equal(overview.products.find(x=>x.id===p.id).stock,1);assert.equal(overview.orders.filter(x=>x.product_id===p.id).length,2);
 assert.equal((await fetch(base+'/api/products',{method:'POST',headers:{Origin:'https://evil.example'},body:'{}'})).status,403);
 const logout=await rawFetch(base+'/api/auth/signout',{method:'POST',headers:{cookie:login.headers.get('set-cookie').split(';')[0]}});assert.equal(logout.status,200);
 assert.equal((await rawFetch(base+'/api/overview',{headers:{cookie:login.headers.get('set-cookie').split(';')[0]}})).status,401);
});

test('website ordering is closed by default and owner currency persists', async()=>{
 assert.equal((await rawFetch(base+'/shop')).status,410);
 assert.equal((await rawFetch(base+'/api/shop/signup',{method:'POST',body:'{}'})).status,410);
 const options={method:'PUT',body:JSON.stringify({currency:'EGP',confirm:true})};
 assert.equal((await rawFetch(base+'/api/settings/currency',options)).status,401);
 assert.equal((await fetch(base+'/api/settings/currency',options)).status,200);
 assert.equal((await (await fetch(base+'/api/overview')).json()).currency,'EGP');
});

test('workspace preferences save centrally and preserve the currency confirmation',async()=>{
 const settings={name:'Cotton Works',language:'ar',currency:'EGP',time_zone:'Asia/Riyadh',
  low_stock_threshold:4,default_period:'quarter'};
 const save=(p,request=fetch)=>request(base+'/api/settings',{method:'PUT',body:JSON.stringify(p)});
 assert.equal((await save(settings,rawFetch)).status,401);
 assert.equal((await save({...settings,currency:'USD'})).status,400);
 assert.equal((await save(settings)).status,200);
 const {workspace,settings:saved}=await (await fetch(base+'/api/overview')).json();
 assert.equal(workspace,'Cotton Works');
 const {id,...preferences}=saved;
 assert.deepEqual(preferences,settings);
});

test('signed social text reaches the inbox once per message',async()=>{
 process.env.META_APP_SECRET='test-meta-secret';
 process.env.META_VERIFY_TOKEN='test-verify-token';
 const endpoint=base+'/api/social/webhook';
 const body=JSON.stringify({object:'page',entry:[{id:'123',messaging:[
  {sender:{id:'456'},message:{mid:'message-1',text:'مرحبا'}},
  {sender:{id:'456'},message:{mid:'message-2',text:'How much?'}},
  {sender:{id:'456'},message:{mid:'echo',text:'Do not import',is_echo:true}}
 ]}]});
 try{
  const verify=await rawFetch(endpoint+'?hub.mode=subscribe&hub.challenge=42&hub.verify_token=test-verify-token');
  assert.equal(await verify.text(),'42');
  assert.equal((await rawFetch(endpoint,{method:'POST',body})).status,403);
  const signature='sha256='+createHmac('sha256',process.env.META_APP_SECRET).update(body).digest('hex');
  const post=()=>rawFetch(endpoint,{method:'POST',body,headers:{'x-hub-signature-256':signature}});
  assert.deepEqual((await Promise.all([post(),post()])).map(r=>r.status),[200,200]);
  const data=await (await fetch(base+'/api/overview')).json();
  assert.deepEqual(data.socialActivity,[{channel:'Messenger',conversations:1,messages:2}]);
  const thread=data.conversations.find(c=>c.name==='Messenger · 456');
  assert.deepEqual((await (await fetch(base+'/api/conversations/'+thread.id)).json()).map(m=>m.body),['مرحبا','How much?']);
 }finally{
  delete process.env.META_APP_SECRET;
  delete process.env.META_VERIFY_TOKEN;
 }
});

test('customer chat orders are private, priced by server, and confirmed once',async t=>{
 process.env.ENABLE_LEGACY_SHOP='1';
 t.after(()=>{delete process.env.ENABLE_LEGACY_SHOP;});
 const request=(path,data,cookie)=>rawFetch(base+'/api/shop/'+path,{method:data?'POST':'GET',headers:cookie?{cookie}:{},...(data?{body:JSON.stringify(data)}:{})});
 assert.equal((await request('chat')).status,401);
 const signup=await request('signup',{name:'Alex Buyer',email:'buyer@example.com',password:'customer-password-123'});assert.equal(signup.status,200);const buyerCookie=signup.headers.get('set-cookie').split(';')[0];
 assert.equal((await rawFetch(base+'/api/overview',{headers:{cookie:buyerCookie}})).status,401);
 const signup2=await request('signup',{name:'Other Buyer',email:'other-buyer@example.com',password:'customer-password-123'});const otherCookie=signup2.headers.get('set-cookie').split(';')[0];
 const login=await request('signin',{email:'buyer@example.com',password:'customer-password-123'});assert.equal(login.status,200);
 assert.equal((await request('chat',{body:'Can I order this product?'},buyerCookie)).status,201);
 const prod=await(await fetch(base+'/api/products',{method:'POST',body:JSON.stringify({name:'Chat product',category:'Test',price:12.5,stock:4})})).json();
 const payload={product_id:prod.id,quantity:2,unit_price:0.01,status:'Paid',request_key:'customer-order-request-123'};
 const r=await request('orders',payload,buyerCookie);assert.equal(r.status,201);const {id}=await r.json();
 assert.equal((await request('orders',payload,buyerCookie)).status,200);
 const chat=await(await request('chat',null,buyerCookie)).json();assert.equal(chat.orders.length,1);assert.equal(chat.orders[0].unit_price,12.5);assert.equal(chat.orders[0].status,'Pending');assert(chat.messages.some(m=>m.body.includes('Can I order')));
 const otherChat=await(await request('chat',null,otherCookie)).json();assert.equal(otherChat.orders.length,0);assert(!otherChat.messages.some(m=>m.body.includes('Can I order')));
 let overview=await(await fetch(base+'/api/overview')).json();const conv=overview.orders.find(o=>o.id===id).conversation_id;assert.equal(overview.products.find(p=>p.id===prod.id).stock,4);
 await fetch(base+`/api/conversations/${conv}/messages`,{method:'POST',body:JSON.stringify({body:'We have your order!'})});assert((await(await request('chat',null,buyerCookie)).json()).messages.some(m=>m.body==='We have your order!'));
 assert.equal((await rawFetch(base+`/api/orders/${id}/confirm`,{method:'POST',headers:{cookie:buyerCookie},body:JSON.stringify({unit_cost:5})})).status,401);
 assert.equal((await fetch(base+`/api/orders/${id}/confirm`,{method:'POST',body:JSON.stringify({unit_cost:5})})).status,200);
 assert.equal((await fetch(base+`/api/orders/${id}/confirm`,{method:'POST',body:JSON.stringify({unit_cost:5})})).status,400);
 overview=await(await fetch(base+'/api/overview')).json();assert.equal(overview.products.find(p=>p.id===prod.id).stock,2);assert.equal(overview.orders.find(o=>o.id===id).status,'Paid');assert.equal(overview.movements.filter(m=>m.order_id===id).length,1);
 assert.equal((await request('orders',{...payload,quantity:9,request_key:'customer-order-request-456'},buyerCookie)).status,400);
 assert.equal((await request('signout',{},buyerCookie)).status,200);assert.equal((await request('chat',null,buyerCookie)).status,401);
});

test('warehouse adjustments, paid sales, and business settings persist together', async () => {
 const send = (path, method, data) => fetch(base + path, {method, body: JSON.stringify(data)});
 const created = await send('/api/products', 'POST', {name:'Warehouse item',category:'Test',stock:4,price:20,unit_cost:7});
 assert.equal(created.status, 201);
 const {id} = await created.json();
 const path = '/api/products/' + id;
 assert.equal((await send(path, 'PATCH', {name:'Updated item',category:'Test',price:25,unit_cost:8})).status, 200);
 const writeoff = {kind:'writeoff', delta:-3, note:'Damaged'};
 const competing = await Promise.all([send(path+'/stock','POST',writeoff),send(path+'/stock','POST',writeoff)]);
 assert.deepEqual(competing.map(r=>r.status).sort(), [201,400]);
 assert.equal((await send(path+'/stock','POST',{kind:'restock',delta:4,note:'Shipment'})).status, 201);
 const sale = await send('/api/orders', 'POST', {product_id:id,quantity:2,unit_price:25,unit_cost:8,channel:'Website',status:'Paid'});
 assert.equal(sale.status, 201);
 const order = await sale.json();
 const expense = await send('/api/expenses','POST',{description:'Warehouse rent',amount:12.5,date:'2026-11-22'});
 assert.equal(expense.status, 201);
 const categorized = await send('/api/expenses','POST',{description:'Cotton',amount:6.5,date:'2026-11-22',
  category:'  Custom  supplies ',product_id:id,included_in_product_cost:true});
 assert.equal(categorized.status,201);
 assert.equal((await categorized.json()).category,'Custom supplies');
 assert.equal((await send('/api/expenses','POST',{description:'Missing product',amount:1,date:'2026-11-22',
  category:'Shipping',product_id:2147483647})).status,400);
 assert.equal((await send('/api/expenses','POST',{description:'Invalid date',amount:12.5,date:'2026-02-30'})).status, 400);
 for (const period of ['2026-11','2026-Q4']) {
  assert.equal((await send('/api/targets','PUT',{period,amount:50})).status, 200);
 }
 assert.equal((await send('/api/targets','PUT',{period:'2026-Q4',amount:100})).status, 200);
 const data = await (await fetch(base+'/api/overview')).json();
 assert.equal(data.products.find(p=>p.id===id).stock, 3);
 assert(order.paid_at);
 const movements = data.movements.filter(m=>m.product_id===id);
 assert.deepEqual(movements.map(m=>[m.kind,m.delta,m.stock_after]), [
  ['sale',-2,3],['restock',4,5],['writeoff',-3,1],['opening',4,4]
 ]);
 assert.equal(movements[0].order_id, order.id);
 assert.equal(movements[2].unit_cost, 8);
 assert.equal(data.expenses.find(e=>e.description==='Warehouse rent').date, '2026-11-22');
 assert.equal(data.expenses.find(e=>e.description==='Warehouse rent').category,'Uncategorized');
 const cotton=data.expenses.find(e=>e.description==='Cotton');
 assert.equal(cotton.product_id,id);
 assert.equal(cotton.included_in_product_cost,true);
 assert.deepEqual(data.targets.map(t=>[t.period,t.amount]).sort(), [['2026-11',50],['2026-Q4',100]]);
 assert.equal((await rawFetch(base+'/api/shop/products')).status,410);
});

test('registered customer accounts are visible only to the owner', async t => {
 process.env.ENABLE_LEGACY_SHOP='1';
 t.after(()=>{delete process.env.ENABLE_LEGACY_SHOP;});
 const endpoint = base + '/api/customers';
 assert.equal((await rawFetch(endpoint)).status,401);
 const signup = await rawFetch(base+'/api/shop/signup',{method:'POST',body:JSON.stringify({
  name:'Registered customer',email:'directory@example.com',password:'customer-password-123'
 })});
 assert.equal(signup.status,200);
 const customerCookie=signup.headers.get('set-cookie').split(';')[0];
 assert.equal((await rawFetch(endpoint,{headers:{cookie:customerCookie}})).status,401);
 const {customers}=await (await fetch(endpoint)).json();
 const account=customers.find(entry=>entry.email==='directory@example.com');
 assert.equal(account.name,'Registered customer');
 assert(account.registered_at);
 assert(!('password_hash' in account));
});

test('OTP recovery sends only to the owner, expires attempts, and revokes sessions', async () => {
 process.env.RESEND_API_KEY='test-only-mail-key';
 process.env.RECOVERY_FROM_EMAIL='Relay <test@example.com>';
 const mails=[];
 globalThis.fetch=async (url,options)=>{
  assert.equal(url,'https://api.resend.com/emails');
  mails.push(JSON.parse(options.body));
  return new Response(null,{status:200});
 };
 const owner='owner@example.com';
 const send=(action,data)=>rawFetch(base+'/api/auth/recovery/'+action,{method:'POST',body:JSON.stringify(data)});
 try{
  assert.equal((await send('request',{email:'other@example.com'})).status,200);
  assert.equal(mails.length,0);
  assert.equal((await send('request',{email:owner})).status,200);
  assert.equal((await send('request',{email:owner})).status,200);
  assert.equal(mails.length,1);
  assert.deepEqual(mails[0].to,[owner]);
  const code=mails[0].text.match(/\b\d{8}\b/)[0];
  const wrong=code==='00000000'?'99999999':'00000000';
  const password='updated-test-owner-password';
  for(let i=0;i<5;i++)assert.equal((await send('reset',{email:owner,code:wrong,password})).status,400);
  assert.equal((await send('reset',{email:owner,code,password})).status,400);
  const {pool}=await import('../db.js');
  await pool.query("UPDATE owner_recovery SET attempts=0,next_request=NOW(),expires_at=NOW()-INTERVAL '1 minute'");
  assert.equal((await send('reset',{email:owner,code,password})).status,400);
  assert.equal((await send('request',{email:owner})).status,200);
  const next=mails[1].text.match(/\b\d{8}\b/)[0];
  assert.equal((await send('reset',{email:owner,code:next,password})).status,200);
  assert.equal((await send('reset',{email:owner,code:next,password})).status,400);
  assert.equal((await fetch(base+'/api/overview')).status,401);
  const signin=async password=>rawFetch(base+'/api/auth/signin',{method:'POST',body:JSON.stringify({email:owner,password})});
  assert.equal((await signin('test-password-12345')).status,401);
  assert.equal((await signin(password)).status,200);
 }finally{
  globalThis.fetch=rawFetch;
  delete process.env.RESEND_API_KEY;
  delete process.env.RECOVERY_FROM_EMAIL;
 }
});

test('hosting recovery changes the existing owner once and preserves business data', async () => {
 const endpoint=base+'/api/auth/recovery/access-code';
 const recover=async (accessCode,password)=>rawFetch(endpoint,{method:'POST',body:JSON.stringify({accessCode,password})});
 const password='owner-new-password-123';
 const accessCode='test-only-recovery-code-abcdefghijklmnopqrstuvwxyz123';
 assert.equal((await recover(accessCode,password)).status,400);
 const sessionStatus=async()=> (await (await rawFetch(base+'/api/auth/session')).json()).adminRecoveryStatus;
 assert.equal(await sessionStatus(),'missing_settings');
 process.env.OWNER_EMAIL='restored@example.com';
 process.env.OWNER_ACCESS_CODE=accessCode;
 try{
  process.env.OWNER_ACCESS_CODE='short';
  assert.equal(await sessionStatus(),'invalid_code');
  process.env.OWNER_ACCESS_CODE=accessCode;
  assert.equal(await sessionStatus(),'ready');
  assert.equal((await recover(accessCode+'wrong',password)).status,400);
  const attempts=await Promise.all([recover(accessCode,password),recover(accessCode,password)]);
  assert.deepEqual(attempts.map(result=>result.status).sort(),[200,400]);
  assert.equal(await sessionStatus(),'used_code');
  const recoveryCookie=attempts.find(result=>result.ok).headers.get('set-cookie').split(';')[0];
  assert.equal((await rawFetch(base+'/api/overview',{headers:{cookie:recoveryCookie}})).status,200);
  const login=await rawFetch(base+'/api/auth/signin',{method:'POST',body:JSON.stringify({email:'restored@example.com',password})});
  assert.equal(login.status,200);
  const oldLogin=await rawFetch(base+'/api/auth/signin',{method:'POST',body:JSON.stringify({
   email:'owner@example.com',password:'updated-test-owner-password'
  })});
  assert.equal(oldLogin.status,401);
  const cookie=login.headers.get('set-cookie').split(';')[0];
  const directory=await rawFetch(base+'/api/customers',{headers:{cookie}});
  assert((await directory.json()).customers.some(customer=>customer.email==='directory@example.com'));
  const overview=await rawFetch(base+'/api/overview',{headers:{cookie}});
  assert((await overview.json()).products.some(product=>product.name==='Warehouse item'||product.name==='Updated item'));
 }finally{
  delete process.env.OWNER_EMAIL;
  delete process.env.OWNER_ACCESS_CODE;
 }
});
