import {DatabaseSync} from 'node:sqlite';
import {pool,initialize} from '../db.js';
const source=process.argv[2];
if(!source)throw Error('Usage: npm run db:import-sqlite -- /absolute/path/to/crm.sqlite');
if(process.env.SEED_DEMO==='1')throw Error('Disable SEED_DEMO before importing existing data.');
const sqlite=new DatabaseSync(source,{readOnly:true});
try{
 await initialize();const c=await pool.connect();
 try{await c.query('BEGIN');
 for(const table of ['conversations','products','messages','orders']){
 const {rows}=await c.query(`SELECT COUNT(*)::int AS n FROM ${table}`);if(rows[0].n)throw Error('Import requires an empty destination database; existing records are preserved.');
 }
 const columns={conversations:['id','name','initials','channel','product','status','intent','color'],products:['id','name','category','price','stock','emoji','color'],messages:['id','conversation_id','role','body','created_at'],orders:['id','product_id','quantity','unit_price','unit_cost','channel','status','date']};
 for(const [table,keys] of Object.entries(columns)){
 const rows=sqlite.prepare(`SELECT * FROM ${table}`).all();
 for(const row of rows)await c.query(`INSERT INTO ${table}(${keys.join(',')}) VALUES(${keys.map((_,i)=>'$'+(i+1)).join(',')})`,keys.map(k=>k==='created_at'?row[k].replace(' ','T')+'Z':row[k]));
 console.log(`Imported ${rows.length} ${table} records.`);
 }
 await c.query("SELECT setval(pg_get_serial_sequence('messages','id'),COALESCE((SELECT MAX(id) FROM messages),1),(SELECT COUNT(*)>0 FROM messages))");await c.query('COMMIT');
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}finally{sqlite.close();await pool.end();}
