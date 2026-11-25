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
after(async()=>{
 await close();
 const {rows}=await admin.query(`SELECT schema_name FROM ${schema}.platform_stores`);
 for(const {schema_name} of rows){
  assert.match(schema_name,/^store_[a-f0-9]{32}$/);
  await admin.query('DROP SCHEMA '+schema_name+' CASCADE');
 }
 await admin.query(`DROP SCHEMA ${schema} CASCADE`);
 await admin.end();
});
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
 const {id,income_tax_rate,assistant_notes,...preferences}=saved;
 assert.equal(assistant_notes,'');
 assert.equal(income_tax_rate,null);
 assert.deepEqual(preferences,settings);
});

test('per-product targets are independent, owner-only, and clearable',async()=>{
 const save=(payload,request=fetch)=>request(base+'/api/product-targets',{method:'PUT',body:JSON.stringify(payload)});
 const target={product_id:1,period:'2026-11',units:40};
 assert.equal((await save(target,rawFetch)).status,401);
 assert.equal((await save({...target,units:2.5})).status,400);
 assert.equal((await save(target)).status,200);
 assert.equal((await save({...target,units:50})).status,200);
 assert.equal((await save({...target,product_id:2,units:25})).status,200);
 assert.equal((await save({...target,period:'2026-Q4',units:100})).status,200);
 assert.equal((await save({...target,units:0})).status,200);
 const {productTargets}=await (await fetch(base+'/api/overview')).json();
 assert.deepEqual(productTargets.sort((a,b)=>a.product_id-b.product_id),[
  {product_id:1,period:'2026-Q4',units:100},{product_id:2,period:'2026-11',units:25}
 ]);
});

test('income tax planning rate is owner-only, validated and clearable',async()=>{
 const options=rate=>({method:'PUT',body:JSON.stringify({rate})});
 assert.equal((await rawFetch(base+'/api/settings/tax',options(20))).status,401);
 assert.equal((await fetch(base+'/api/settings/tax',options(120))).status,400);
 assert.equal((await fetch(base+'/api/settings/tax',options(17.253))).status,400);
 assert.equal((await fetch(base+'/api/settings/tax',options(17.25))).status,200);
 assert.equal((await (await fetch(base+'/api/overview')).json()).settings.income_tax_rate,17.25);
 const expense={description:'Tax installment',category:'ضريبة الدخل',amount:15,date:'2026-11-24'};
 assert.equal((await fetch(base+'/api/expenses',{method:'POST',body:JSON.stringify({...expense,included_in_product_cost:true})})).status,400);
 const savedExpense=await fetch(base+'/api/expenses',{method:'POST',body:JSON.stringify(expense)});
 assert.equal(savedExpense.status,201);
 assert.equal((await savedExpense.json()).category,'Income tax');
 assert.equal((await fetch(base+'/api/settings/tax',options(null))).status,200);
 assert.equal((await (await fetch(base+'/api/overview')).json()).settings.income_tax_rate,null);
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

test('unified inbox analyzes all four channels and sends only one configured reply',async()=>{
 const env={
  AI_CHAT_ENABLED:'1',OPENAI_API_KEY:'test-ai-key',
  META_APP_SECRET:'test-signature-key',META_VERIFY_TOKEN:'test-verification-key',META_GRAPH_VERSION:'v23.0',
  META_WHATSAPP_ACCESS_TOKEN:'test-wa-token',META_INSTAGRAM_ACCESS_TOKEN:'test-ig-token',
  META_MESSENGER_ACCESS_TOKEN:'test-fb-token'
 };
 Object.assign(process.env,env);
 const deliveries=[];
 const inputs=[];
 globalThis.fetch=async (url,options)=>{
  const body=JSON.parse(options.body);
  if(url==='https://api.openai.com/v1/responses'){
   const input=JSON.parse(body.input);
   inputs.push(input);
   assert.equal(body.store,false);
   assert(!input.catalog.some(item=>'unit_cost' in item));
   return Response.json({output:[{content:[{type:'output_text',text:JSON.stringify({
    intent:'pricing',stage:'interested',summary:'Asked for a price.',themes:['price'],
    reply:input.replyRequested?'Thanks for your message.':'',
    humanReview:input.replyRequested&&input.messages.some(message=>message.body==='Refund dispute'),
    reviewReason:'Staff should review the refund request.'
   })}]}]});
  }
  assert.match(url,/^https:\/\/graph\.(?:facebook|instagram)\.com\/v23\.0\//);
  deliveries.push({url,body});
  return Response.json({message_id:'accepted'});
 };
 try{
  const request=(path,data,cookie)=>rawFetch(base+'/api/website/'+path,{
   method:data?'POST':'GET',headers:cookie?{cookie}:{},...(data?{body:JSON.stringify(data)}:{})
  });
  assert.equal((await rawFetch(base+'/chat')).status,200);
  assert.equal((await request('chat')).status,401);
  assert.equal((await rawFetch(base+'/api/chats/analyze',{method:'POST'})).status,401);
  const signup=await request('signup',{name:'Website AI customer',email:'ai-buyer@example.com',password:'website-chat-password'});
  assert.equal(signup.status,200);
  const websiteCookie=signup.headers.get('set-cookie').split(';')[0];
  assert.equal((await request('chat',{body:'How much is the product?'},websiteCookie)).status,201);
  assert.equal((await request('chat',{body:'Repeated too soon'},websiteCookie)).status,429);

  const shapes=[
   {object:'whatsapp_business_account',entry:[{changes:[{field:'messages',value:{
    metadata:{phone_number_id:'802'},messages:[{type:'text',id:'wamid.42',from:'902',text:{body:'WhatsApp pricing?'}}]
   }}]}]},
   {object:'instagram',entry:[{id:'803',messaging:[{sender:{id:'903'},message:{mid:'ig-42',text:'Instagram pricing?'}}]}]},
   {object:'page',entry:[{id:'804',messaging:[{sender:{id:'904'},message:{mid:'fb-42',text:'Messenger pricing?'}}]}]}
  ];
  for(const payload of shapes){
   const body=JSON.stringify(payload);
   const signature='sha256='+createHmac('sha256',env.META_APP_SECRET).update(body).digest('hex');
   for(let count=0;count<2;count++){
    const response=await rawFetch(base+'/api/social/webhook',{method:'POST',body,headers:{'x-hub-signature-256':signature}});
    assert.equal(response.status,200);
   }
  }
  assert.equal((await fetch(base+'/api/chats/analyze',{method:'POST'})).status,202);
  const {processChatJob}=await import('../chat-ai.js');
  for(let attempt=0;attempt<30;attempt++){if(!await processChatJob())break;}
  const website=await (await request('chat',null,websiteCookie)).json();
  assert.equal(website.messages.filter(message=>message.body==='Thanks for your message.').length,1);
  assert.equal((await request('products',null,websiteCookie)).status,401);
  assert.equal((await rawFetch(base+'/api/shop/orders',{method:'POST',body:'{}'})).status,410);
  const data=await (await fetch(base+'/api/overview')).json();
  assert.equal(data.aiConfigured,true);
  for(const channel of ['Website','WhatsApp','Instagram','Messenger']){
   const id=data.conversations.find(c=>c.channel===channel&&c.id>=1000).id;
   assert(data.chatAnalysis.some(row=>row.conversation_id===id&&row.intent==='pricing'));
  }
  assert(deliveries.some(entry=>entry.url.includes('/802/')&&entry.body.to==='902'));
  assert(deliveries.some(entry=>entry.url.includes('instagram.com/v23.0/803/')&&entry.body.recipient.id==='903'));
  assert(deliveries.some(entry=>entry.url.includes('/804/')&&entry.body.messaging_type==='RESPONSE'));
  for(const account of ['802','803','804'])assert.equal(deliveries.filter(entry=>entry.url.includes('/'+account+'/')).length,1);
  assert(inputs.some(input=>input.replyRequested===false&&input.messages.some(message=>message.role==='customer')));
  const postMessenger=async (mid,text)=>{
   const body=JSON.stringify({object:'page',entry:[{id:'804',messaging:[{sender:{id:'904'},message:{mid,text}}]}]});
   const signature='sha256='+createHmac('sha256',env.META_APP_SECRET).update(body).digest('hex');
   assert.equal((await rawFetch(base+'/api/social/webhook',{method:'POST',body,headers:{'x-hub-signature-256':signature}})).status,200);
   assert(await processChatJob());
  };
  await postMessenger('pricing-followup','What about the second one?');
  const followup=inputs.at(-1);
  assert.deepEqual(followup.recentMessages,[
   {role:'customer',body:'Messenger pricing?'},
   {role:'assistant',body:'Thanks for your message.'},
   {role:'customer',body:'What about the second one?'}
  ]);
  const thread=data.conversations.find(c=>c.name==='Messenger · 904');
  const sent=()=>deliveries.filter(entry=>entry.url.includes('/804/')).length;
  await postMessenger('refund-case','Refund dispute');
  const {chatAnalysis}=await (await fetch(base+'/api/overview')).json();
  assert.equal(chatAnalysis.find(row=>row.conversation_id===thread.id).human_review,true);
  await postMessenger('followup-held','Still waiting');
  assert.equal(sent(),3);
  const resume=base+'/api/chats/'+thread.id+'/resume-ai';
  assert.equal((await rawFetch(resume,{method:'POST'})).status,401);
  assert.equal((await fetch(resume,{method:'POST'})).status,200);
  assert.equal(await processChatJob(),false);
  await postMessenger('followup-resumed','How much?');
  assert.equal(sent(),4);
 }finally{
  globalThis.fetch=rawFetch;
  for(const key of Object.keys(env))delete process.env[key];
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
 const categorizedExpense=await categorized.json();
 assert.equal(categorizedExpense.category,'Custom supplies');
 const edit={description:'Cotton corrected',amount:9.5,date:'2026-11-23',category:'Materials',
  product_id:id,included_in_product_cost:true};
 const endpoint='/api/expenses/'+categorizedExpense.id;
 assert.equal((await rawFetch(base+endpoint,{method:'PATCH',body:JSON.stringify(edit)})).status,401);
 assert.equal((await send(endpoint,'PATCH',edit)).status,200);
 assert.equal((await send('/api/expenses/2147483647','PATCH',edit)).status,404);
 assert.equal((await send('/api/expenses','POST',{description:'Missing product',amount:1,date:'2026-11-22',
  category:'Shipping',product_id:2147483647})).status,400);
 assert.equal((await send('/api/expenses','POST',{description:'Invalid date',amount:12.5,date:'2026-02-30'})).status, 400);
 for (const period of ['2026-11','2026-Q4']) {
  assert.equal((await send('/api/targets','PUT',{period,amount:50})).status, 200);
 }
 assert.equal((await send('/api/targets','PUT',{period:'2026-Q4',amount:70,units:100})).status,200);
 assert.equal((await send('/api/targets','PUT',{period:'2026-Q4',amount:70,units:1.5})).status,400);
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
 assert.equal(data.targets.find(t=>t.period==='2026-Q4').units,100);
 const cotton=data.expenses.find(e=>e.id===categorizedExpense.id);
 assert.equal(cotton.description,'Cotton corrected');
 assert.equal(cotton.amount,9.5);
 assert.equal(cotton.date,'2026-11-23');
 assert.equal(cotton.product_id,id);
 assert.equal(cotton.included_in_product_cost,true);
 assert.deepEqual(data.targets.map(t=>[t.period,t.amount]).sort(), [['2026-11',50],['2026-Q4',100]]);
 assert.equal((await rawFetch(base+'/api/shop/products')).status,410);
});

test('a product can override the workspace stock alert and restore the default',async()=>{
 const item={name:'Fast-moving stock',category:'Test',price:20,unit_cost:8,stock:8,stock_alert_threshold:12};
 const send=(url,method,body)=>fetch(base+url,{method,body:JSON.stringify(body)});
 assert.equal((await send('/api/products','POST',{...item,stock_alert_threshold:-1})).status,400);
 const created=await send('/api/products','POST',item);
 assert.equal(created.status,201);
 const product=await created.json();
 assert.equal(product.stock_alert_threshold,12);
 const {stock_alert_threshold,...legacy}=item;
 const path='/api/products/'+product.id;
 const preserved=await send(path,'PATCH',{...legacy,name:'Fast-moving stock edited'});
 assert.equal((await preserved.json()).stock_alert_threshold,12);
 const reset=await send(path,'PATCH',{...legacy,stock_alert_threshold:null});
 assert.equal((await reset.json()).stock_alert_threshold,null);
});

test('stock replenishment level and manual cash movements persist with owner access',async()=>{
 const send=(route,method,payload)=>fetch(base+route,{method,body:JSON.stringify(payload)});
 const product={name:'Reorder test item',category:'Stock',price:20,unit_cost:8,stock:6,desired_stock:20};
 assert.equal((await send('/api/products','POST',{...product,desired_stock:2.5})).status,400);
 const created=await send('/api/products','POST',product);
 assert.equal((await created.json()).desired_stock,20);
 const manual={date:'2026-11-24',direction:'in',description:'Owner cash deposit',amount:40};
 assert.equal((await rawFetch(base+'/api/cash-movements',{method:'POST',body:JSON.stringify(manual)})).status,401);
 assert.equal((await send('/api/cash-movements','POST',{...manual,amount:0})).status,400);
 const movement=await send('/api/cash-movements','POST',manual);
 assert.equal(movement.status,201);
 const {id}=await movement.json();
 const data=await (await fetch(base+'/api/overview')).json();
 assert.deepEqual(data.cashMovements.find(row=>row.id===id),{id,...manual});
 assert.equal((await fetch(base+'/api/cash-movements/'+id,{method:'DELETE'})).status,200);
 assert.equal((await (await fetch(base+'/api/overview')).json()).cashMovements.length,0);
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

test('storefront orders, customer sessions, social threads and AI policies stay inside each store',async()=>{
 const request=(path,method='GET',payload,cookie)=>rawFetch(base+path,{
  method,headers:cookie?{cookie}:{},
  ...(payload===undefined?{}:{body:JSON.stringify(payload)})
 });
 const sessionCookie=response=>response.headers.get('set-cookie').split(';')[0];
 const storefrontEnv={
  STOREFRONT_SIGNUP_ENABLED:'1',AI_CHAT_ENABLED:'1',OPENAI_API_KEY:'test-store-openai',
  META_APP_SECRET:'test-store-signature',META_VERIFY_TOKEN:'test-store-verify',META_GRAPH_VERSION:'v23.0',
  STORE_META_ROUTES:JSON.stringify({
   'Messenger:1101':{store:'store-alpha',token:'alpha-token'},
   'Messenger:1102':{store:'store-beta',token:'beta-token'}
  })
 };
 const envBefore=Object.fromEntries(Object.keys(storefrontEnv).map(key=>[key,process.env[key]]));
 Object.assign(process.env,storefrontEnv);
 try{
  assert.equal((await request('/start-store')).status,200);
  const stores=[];
  for(const [slug,name,item,policy] of [
   ['store-alpha','Alpha','Alpha bag','Only Alpha ships to Cairo'],
   ['store-beta','Beta','Beta hat','Only Beta offers store pickup']
  ]){
   const credentials={email:'store-owner@example.com',password:'test-password-'+slug};
   const signup=await request('/api/stores','POST',{slug,name,...credentials});
   assert.equal(signup.status,201);
   const links=await signup.json();
   assert.equal(links.storefront,'/w/'+slug+'/shop');
   assert.equal((await request(links.storefront)).status,200);
   const path='/w/'+slug+'/api';
   const login=await request(path+'/auth/signin','POST',credentials);
   assert.equal(login.status,200);
   assert(login.headers.get('set-cookie').includes('Path=/w/'+slug));
   const owner=sessionCookie(login);
   assert.equal((await request(path+'/settings/assistant','PUT',{notes:policy},owner)).status,200);
   const product=await request(path+'/products','POST',{name:item,category:'Test',public_description:item+' material',price:25,unit_cost:10,stock:6},owner);
   assert.equal(product.status,201);
   assert.equal((await product.json()).id,1000);
   const signupBuyer=await request(path+'/shop/signup','POST',{name:name+' buyer',email:'buyer@example.com',password:'buyer-password-123'});
   assert.equal(signupBuyer.status,200);
   assert(signupBuyer.headers.get('set-cookie').includes('Path=/w/'+slug));
   const buyer=sessionCookie(signupBuyer);
   const publicCatalog=await(await request(path+'/shop/products')).json();
   assert.deepEqual(publicCatalog.products.map(p=>p.name),[item]);
   assert.equal(publicCatalog.products[0].public_description,item+' material');
   assert(!('unit_cost' in publicCatalog.products[0]));
   stores.push({slug,owner,buyer,path,item,policy});
  }
  const [alpha,beta]=stores;
  assert.equal((await request(beta.path+'/overview','GET',undefined,alpha.owner)).status,401);
  assert.equal((await request(beta.path+'/shop/chat','GET',undefined,alpha.buyer)).status,401);
  assert.equal((await request(alpha.path+'/auth/recovery/access-code','POST',{},alpha.owner)).status,403);
  const order=await request(alpha.path+'/shop/orders','POST',{product_id:1000,quantity:2,request_key:'alpha-test-request-123'},alpha.buyer);
  assert.equal(order.status,201);
  const {id}=await order.json();
  let alphaData=await(await request(alpha.path+'/overview','GET',undefined,alpha.owner)).json();
  const betaData=await(await request(beta.path+'/overview','GET',undefined,beta.owner)).json();
  assert.deepEqual([alphaData.orders[0].status,alphaData.products[0].stock,betaData.orders.length],['Pending',6,0]);
  assert.equal((await request(alpha.path+'/orders/'+id+'/confirm','POST',{unit_cost:10},alpha.owner)).status,200);
  alphaData=await(await request(alpha.path+'/overview','GET',undefined,alpha.owner)).json();
  assert.deepEqual([alphaData.orders[0].status,alphaData.products[0].stock],['Paid',4]);

  const body=JSON.stringify({object:'page',entry:[
   {id:'1101',messaging:[{sender:{id:'999'},message:{mid:'tenant-test',text:'Alpha shipping?'}}]},
   {id:'1102',messaging:[{sender:{id:'999'},message:{mid:'tenant-test',text:'Beta pickup?'}}]}
  ]});
  const signature='sha256='+createHmac('sha256',storefrontEnv.META_APP_SECRET).update(body).digest('hex');
  assert.equal((await rawFetch(base+'/api/social/webhook',{method:'POST',body,headers:{'x-hub-signature-256':signature}})).status,200);
  const {inStore}=await import('../db.js');
  const {findStore}=await import('../stores.js');
  const {processChatJob}=await import('../chat-ai.js');
  for(const [index,store] of stores.entries()){
   const inputs=[],deliveries=[];
   globalThis.fetch=async(url,options)=>{
    if(url==='https://api.openai.com/v1/responses'){
     inputs.push(JSON.parse(JSON.parse(options.body).input));
     return Response.json({output:[{content:[{type:'output_text',text:JSON.stringify({
      intent:'delivery',stage:'interested',summary:'Asked about delivery.',themes:['delivery'],
      reply:'Here is the store information.',humanReview:false,reviewReason:''
     })}]}]});
    }
    deliveries.push({url,token:options.headers.Authorization});
    return Response.json({message_id:'sent'});
   };
   await inStore(await findStore(store.slug),async()=>{assert(await processChatJob());});
   assert.deepEqual(inputs.map(input=>input.catalog.map(product=>product.name)),[[store.item]]);
   assert.equal(inputs[0].policies,store.policy);
   assert.equal(inputs[0].catalog[0].public_description,store.item+' material');
   assert.equal(deliveries.length,1);
   assert.equal(deliveries[0].token,index===0?'Bearer alpha-token':'Bearer beta-token');
   assert(deliveries[0].url.includes(index===0?'/1101/':'/1102/'));
   const data=await(await request(store.path+'/overview','GET',undefined,store.owner)).json();
   assert(data.conversations.some(c=>c.channel==='Messenger'));
   assert.equal(data.chatAnalysis.length,1);
  }
 }finally{
  globalThis.fetch=rawFetch;
  for(const [key,value] of Object.entries(envBefore)){
   if(value===undefined)delete process.env[key];
   else process.env[key]=value;
  }
 }
});

test('owner can populate the empty clothing demo store exactly once',async()=>{
 const previous=process.env.STOREFRONT_SIGNUP_ENABLED;
 process.env.STOREFRONT_SIGNUP_ENABLED='1';
 try{
  const credentials={email:'clothing@example.com',password:'clothing-demo-password'};
  const send=(path,data,cookie)=>rawFetch(base+path,{
   method:'POST',body:JSON.stringify(data),headers:cookie?{cookie}:{}
  });
  const store='/w/men-el-chat-demo';
  assert.equal((await send('/api/stores',{name:'Men El Chat Clothing Demo',slug:'men-el-chat-demo',...credentials})).status,201);
  assert.equal((await send(store+'/api/demo/clothing',{})).status,401);
  const login=await send(store+'/api/auth/signin',credentials);
  assert.equal(login.status,200);
  const demoCookie=login.headers.get('set-cookie').split(';')[0];
  const load=()=>send(store+'/api/demo/clothing',{},demoCookie);
  const results=await Promise.all([load(),load()]);
  assert.deepEqual(results.map(r=>r.status).sort(),[201,409]);
  const {products}=await (await rawFetch(base+store+'/api/shop/products')).json();
  assert.equal(products.length,33);
  assert.deepEqual(new Set(products.map(p=>p.category)),new Set(['هودي','تيشرت','بنطلون']));
  assert(products.every(p=>p.public_description.includes('المقاس:')&&p.stock>0&&!('unit_cost' in p)));
  const overview=await (await rawFetch(base+store+'/api/overview',{headers:{cookie:demoCookie}})).json();
  assert.equal(overview.orders.filter(o=>o.status==='Paid').length,3);
  assert.match(overview.settings.assistant_notes,/60 جنيه/);
  const original=await admin.query(`SELECT 1 FROM ${schema}.products WHERE category=$1`,['هودي']);
  assert.equal(original.rowCount,0);
 }finally{
  if(previous===undefined)delete process.env.STOREFRONT_SIGNUP_ENABLED;
  else process.env.STOREFRONT_SIGNUP_ENABLED=previous;
 }
});


test('AI diagnostics require an owner and report the Responses API status',async()=>{
 const previous=Object.fromEntries(['AI_CHAT_ENABLED','OPENAI_API_KEY'].map(key=>[key,process.env[key]]));
 const url=base+'/api/chats/check-ai';
 const request=cookie=>rawFetch(url,{method:'POST',headers:cookie?{cookie}:{}});
 try{
  const unauthenticated=await request();
  assert.equal(unauthenticated.status,401);
  const store='/w/men-el-chat-demo';
  const signIn=await rawFetch(base+store+'/api/auth/signin',{method:'POST',
   body:JSON.stringify({email:'clothing@example.com',password:'clothing-demo-password'})});
  const demoCookie=signIn.headers.get('set-cookie').split(';')[0];
  const check=()=>rawFetch(base+store+'/api/chats/check-ai',{method:'POST',headers:{cookie:demoCookie}});
  process.env.AI_CHAT_ENABLED='0';
  assert.equal((await check()).status,503);
  process.env.AI_CHAT_ENABLED='1';
  process.env.OPENAI_API_KEY='test-diagnostic-key';
  globalThis.fetch=async (url,options)=>{
   assert.equal(url,'https://api.openai.com/v1/responses');
   assert(!JSON.parse(options.body).input.includes('clothing@example.com'));
   return new Response(null,{status:403});
  };
  const rejected=await check();
  assert.equal(rejected.status,502);
  assert.deepEqual(await rejected.json(),{error:'OpenAI Responses HTTP 403'});
  assert.equal((await check()).status,429);
 }finally{
  globalThis.fetch=rawFetch;
  for(const [key,value] of Object.entries(previous)){
   if(value===undefined)delete process.env[key];else process.env[key]=value;
  }
 }
});
