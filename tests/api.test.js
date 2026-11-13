import {test,after} from 'node:test';
import assert from 'node:assert/strict';
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
after(async()=>{await close();await admin.query(`DROP SCHEMA ${schema} CASCADE`);await admin.end();});
test('workspace returns seeded conversations and inventory',async()=>{const r=await fetch(base+'/api/overview');assert.equal(r.status,200);const d=await r.json();assert.equal(d.conversations.length,6);assert.equal(d.products.length,4);assert.equal(d.demo,true);});
test('reply persists and conversion status updates',async()=>{let r=await fetch(base+'/api/conversations/1/messages',{method:'POST',body:JSON.stringify({body:'Olive is available. Would you like to order?'})});assert.equal(r.status,201);let msgs=await(await fetch(base+'/api/conversations/1')).json();assert.equal(msgs.at(-1).role,'agent');assert.match(msgs.at(-1).body,/Olive/);r=await fetch(base+'/api/conversations/1',{method:'PATCH',body:JSON.stringify({status:'Converted'})});assert.equal(r.status,200);const d=await(await fetch(base+'/api/overview')).json();assert.equal(d.conversations[0].status,'Converted');});
test('rejects invalid payloads and missing conversations',async()=>{for(const body of ['{',JSON.stringify({body:''})]){const r=await fetch(base+'/api/conversations/1/messages',{method:'POST',body});assert.equal(r.status,400);}assert.equal((await fetch(base+'/api/conversations/999')).status,404);assert.equal((await fetch(base+'/api/conversations/1',{method:'PATCH',body:JSON.stringify({status:'nonsense'})})).status,400);});
test('frontend and assets are served',async()=>{for(const path of ['/','/app.js','/style.css'])assert.equal((await fetch(base+path)).status,200);assert.equal((await fetch(base+'/server.js')).status,404);});

test('reinitializing PostgreSQL preserves replies and statuses',async()=>{const {initialize}=await import('../db.js');await initialize();const messages=await(await fetch(base+'/api/conversations/1')).json();assert.equal(messages.at(-1).role,'agent');const overview=await(await fetch(base+'/api/overview')).json();assert.equal(overview.conversations[0].status,'Converted');assert.equal(overview.orders.length,8);assert.equal(typeof overview.products[0].price,'number');});
