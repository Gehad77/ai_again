import http from 'node:http';
import { readFileSync } from 'node:fs';
import {pool,initialize} from './db.js';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.dirname(fileURLToPath(import.meta.url));
await initialize();
const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(data));};
export const server=http.createServer(async(req,res)=>{
 try {
 const url=new URL(req.url,'http://localhost'); const route=url.pathname;
 if(route==='/api/overview' && req.method==='GET')return json(res,200,{conversations:(await pool.query('SELECT * FROM conversations ORDER BY id')).rows,products:(await pool.query('SELECT * FROM products ORDER BY id')).rows,orders:(await pool.query('SELECT * FROM orders ORDER BY id')).rows,workspace:'Olive & Co.',demo:process.env.SEED_DEMO==='1'});
 const match=route.match(/^\/api\/conversations\/(\d+)(\/messages)?$/);
 if(match){const id=Number(match[1]);if(!(await pool.query('SELECT id FROM conversations WHERE id=$1',[id])).rowCount)return json(res,404,{error:'Conversation not found'});
 if(req.method==='GET')return json(res,200,(await pool.query('SELECT * FROM messages WHERE conversation_id=$1 ORDER BY id',[id])).rows);
 if(req.method==='POST' && match[2]){let body='';for await (const chunk of req){body+=chunk;if(body.length>12000)return json(res,413,{error:'Message too long'});}let payload;try{payload=JSON.parse(body);}catch{return json(res,400,{error:'Invalid JSON'});}if(typeof payload.body!=='string'||!payload.body.trim()||payload.body.length>4000)return json(res,400,{error:'Enter a message of 1–4000 characters'});await pool.query('INSERT INTO messages(conversation_id,role,body) VALUES($1,$2,$3)',[id,'agent',payload.body.trim()]);return json(res,201,{ok:true});}
 if(req.method==='PATCH'&&!match[2]){let body='';for await(const c of req){body+=c;if(body.length>1000)return json(res,413,{error:'Request too large'});}let p;try{p=JSON.parse(body);}catch{return json(res,400,{error:'Invalid JSON'});}if(!['Needs reply','AI handling','Converted','Inactive'].includes(p.status))return json(res,400,{error:'Invalid status'});await pool.query('UPDATE conversations SET status=$1 WHERE id=$2',[p.status,id]);return json(res,200,{ok:true});}}
 if(route.startsWith('/api/'))return json(res,404,{error:'Not found'});
 if(req.method!=='GET')return json(res,405,{error:'Method not allowed'});
 const files={'/':'index.html','/app.js':'app.js','/style.css':'style.css','/analytics.js':'analytics.js','/demo.js':'demo.js','/demo-data.json':'demo-data.json'};if(!files[route])return json(res,404,{error:'Not found'});res.writeHead(200,{'Content-Type':route.endsWith('.json')?'application/json':route.endsWith('.js')?'text/javascript':route.endsWith('.css')?'text/css':'text/html'});res.end(readFileSync(path.join(root,'public',files[route])));
 }catch(e){console.error('Request failed:',e.code||e.name);json(res,500,{error:'Something went wrong'});}
});
if(process.env.NODE_ENV!=='test')server.listen(Number(process.env.PORT||3000),'0.0.0.0',()=>console.log('Relay CRM listening on port '+(process.env.PORT||3000)));

export async function close(){await new Promise(resolve=>server.close(resolve));await pool.end();}
if(process.env.NODE_ENV!=='test'){for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>close().then(()=>process.exit(0)));}
