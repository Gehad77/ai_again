import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.dirname(fileURLToPath(import.meta.url));
mkdirSync(path.join(root,'data'),{recursive:true});
const db = new DatabaseSync(process.env.DB_PATH || path.join(root,'data/crm.sqlite'));
db.exec(`CREATE TABLE IF NOT EXISTS conversations(id INTEGER PRIMARY KEY, name TEXT, initials TEXT, channel TEXT, product TEXT, status TEXT, intent TEXT, color TEXT); CREATE TABLE IF NOT EXISTS messages(id INTEGER PRIMARY KEY, conversation_id INTEGER, role TEXT, body TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP); CREATE TABLE IF NOT EXISTS products(id INTEGER PRIMARY KEY,name TEXT,category TEXT,price REAL,stock INTEGER,emoji TEXT,color TEXT);`);
if (!db.prepare('SELECT count(*) n FROM conversations').get().n) {
 const insert=db.prepare('INSERT INTO conversations VALUES(?,?,?,?,?,?,?,?)');
 [[1,'Olivia Rhye','OR','WhatsApp','Everyday Tote','Needs reply','High intent','#efe3d2'],[2,'Phoenix Baker','PB','Instagram','Studio Headphones','AI handling','Price concern','#e4e1f6'],[3,'Lana Steiner','LS','Messenger','Ceramic Mug','Needs reply','High intent','#dcece4'],[4,'Demi Wilkinson','DW','WhatsApp','Everyday Tote','Converted','Purchased','#f7e2df'],[5,'Drew Cano','DC','Instagram','Desk Lamp','AI handling','Exploring','#e1eafa'],[6,'Natali Craig','NC','WhatsApp','Studio Headphones','Inactive','Unknown','#f1e4ed']].forEach(r=>insert.run(...r));
 const msg=db.prepare('INSERT INTO messages(conversation_id,role,body) VALUES(?,?,?)');
 msg.run(1,'customer','Hi! I saw your Everyday Tote on Instagram. Does it fit a 13-inch laptop?'); msg.run(1,'assistant','Hi Olivia! Yes, the Everyday Tote comfortably fits a 13-inch laptop, with an inner pocket to keep everything organized. Are you looking for a particular color?'); msg.run(1,'customer','The olive one looks lovely! Is it in stock? And how much is delivery?');
 for(let i=2;i<=6;i++)msg.run(i,'customer',i===2?'I love the headphones, but do you have a more affordable option?':`Hi, I would like to know more about your ${i===3?'Ceramic Mug':i===5?'Desk Lamp':i===4?'Everyday Tote':'Studio Headphones'}.`);
 const p=db.prepare('INSERT INTO products VALUES(?,?,?,?,?,?,?)');
 [[1,'Everyday Tote','Accessories',48,24,'👜','#f0eee3'],[2,'Studio Headphones','Electronics',129,18,'🎧','#ece8f6'],[3,'Ceramic Mug','Home & living',22,56,'☕','#f3e6df'],[4,'Desk Lamp','Home & living',85,7,'💡','#e6eddf']].forEach(r=>p.run(...r));
}
const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(data));};
export const server=http.createServer(async(req,res)=>{
 try {
 const url=new URL(req.url,'http://localhost'); const route=url.pathname;
 if(route==='/api/overview' && req.method==='GET')return json(res,200,{conversations:db.prepare('SELECT * FROM conversations').all(),products:db.prepare('SELECT * FROM products').all(),workspace:'Olive & Co.',demo:true});
 const match=route.match(/^\/api\/conversations\/(\d+)(\/messages)?$/);
 if(match){const id=Number(match[1]);if(!db.prepare('SELECT id FROM conversations WHERE id=?').get(id))return json(res,404,{error:'Conversation not found'});
 if(req.method==='GET')return json(res,200,db.prepare('SELECT * FROM messages WHERE conversation_id=? ORDER BY id').all(id));
 if(req.method==='POST' && match[2]){let body='';for await (const chunk of req){body+=chunk;if(body.length>12000)return json(res,413,{error:'Message too long'});}let payload;try{payload=JSON.parse(body);}catch{return json(res,400,{error:'Invalid JSON'});}if(typeof payload.body!=='string'||!payload.body.trim()||payload.body.length>4000)return json(res,400,{error:'Enter a message of 1–4000 characters'});db.prepare('INSERT INTO messages(conversation_id,role,body) VALUES(?,?,?)').run(id,'agent',payload.body.trim());return json(res,201,{ok:true});}
 if(req.method==='PATCH'&&!match[2]){let body='';for await(const c of req){body+=c;if(body.length>1000)return json(res,413,{error:'Request too large'});}let p;try{p=JSON.parse(body);}catch{return json(res,400,{error:'Invalid JSON'});}if(!['Needs reply','AI handling','Converted','Inactive'].includes(p.status))return json(res,400,{error:'Invalid status'});db.prepare('UPDATE conversations SET status=? WHERE id=?').run(p.status,id);return json(res,200,{ok:true});}}
 if(route.startsWith('/api/'))return json(res,404,{error:'Not found'});
 if(req.method!=='GET')return json(res,405,{error:'Method not allowed'});
 const files={'/':'index.html','/app.js':'app.js','/style.css':'style.css','/demo.js':'demo.js','/demo-data.json':'demo-data.json'};if(!files[route])return json(res,404,{error:'Not found'});res.writeHead(200,{'Content-Type':route.endsWith('.json')?'application/json':route.endsWith('.js')?'text/javascript':route.endsWith('.css')?'text/css':'text/html'});res.end(readFileSync(path.join(root,'public',files[route])));
 }catch(e){console.error(e);json(res,500,{error:'Something went wrong'});}
});
if(process.env.NODE_ENV!=='test')server.listen(Number(process.env.PORT||3000),'0.0.0.0',()=>console.log('Relay CRM listening on port '+(process.env.PORT||3000)));
