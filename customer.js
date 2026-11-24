import {storePrefix} from './stores.js';
import {queueChat} from './chat-ai.js';
// Customer endpoints are isolated from the owner's session and workspace APIs.
export async function customerRoutes(req,res,route,h){
 if(!route.startsWith('/api/shop/'))return false;
 const {pool,body,invalid,json,scrypt,digest,randomBytes,timingSafeEqual,websiteChat}=h;
 const reply=(status,data)=>{json(res,status,data);return true;};
 const path=storePrefix()||'/';
 const cookieName=storePrefix()?'relay_store_customer':'relay_customer';
 const prefix=cookieName+'=';
 const cookie=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(prefix))?.slice(prefix.length)||'';
 const customer=(await pool.query('SELECT c.id,c.name,c.conversation_id FROM customer_sessions s JOIN customers c ON c.id=s.customer_id WHERE s.token=$1 AND s.expires_at>NOW()',[digest(cookie)])).rows[0];
 if(route==='/api/shop/session'&&req.method==='GET')return reply(200,{customer:customer||null});
 if(route==='/api/shop/products'&&req.method==='GET')return reply(200,{products:(await pool.query('SELECT id,name,category,price,stock,emoji FROM products ORDER BY id')).rows});
 if(['/api/shop/signup','/api/shop/signin'].includes(route)&&req.method==='POST'){
 const p=await body(req);const email=typeof p.email==='string'?p.email.trim().toLowerCase():'';
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||typeof p.password!=='string'||p.password.length<12||p.password.length>128)invalid('Use a valid email and a password of 12–128 characters.');
 let id;
 if(route.endsWith('signup')){
 if(typeof p.name!=='string'||!p.name.trim()||p.name.length>80)invalid('Enter your name (up to 80 characters).');
 const salt=randomBytes(16).toString('hex');const hash=(await scrypt(p.password,salt,64)).toString('hex');const c=await pool.connect();
 try{await c.query('BEGIN');const conv=(await c.query("INSERT INTO conversations VALUES(nextval('conversation_ids'),$1,$2,'Website','Browsing catalog','Needs reply','New customer','#e5eee6') RETURNING id",[p.name.trim(),p.name.trim().split(/\s+/).map(x=>Array.from(x)[0]).slice(0,2).join('').toUpperCase()])).rows[0];
 id=(await c.query('INSERT INTO customers(name,email,password_hash,salt,conversation_id) VALUES($1,$2,$3,$4,$5) RETURNING id',[p.name.trim(),email,hash,salt,conv.id])).rows[0].id;
 await c.query("INSERT INTO messages(conversation_id,role,body) VALUES($1,'assistant',$2)",[conv.id,websiteChat?'Welcome! Send us a message and we’ll help you.':'Welcome! Choose a product below to request an order, or send us a message. Your order will await payment confirmation from the store.']);await c.query('COMMIT');
 }catch(e){await c.query('ROLLBACK');if(e.code==='23505')return reply(409,{error:'An account with this email already exists. Please sign in.'});throw e;}finally{c.release();}
 }else{const user=(await pool.query('SELECT * FROM customers WHERE email=$1',[email])).rows[0];const hash=await scrypt(p.password,user?.salt||'missing-customer',64);if(!user||!timingSafeEqual(hash,Buffer.from(user.password_hash,'hex')))return reply(401,{error:'Email or password is incorrect.'});id=user.id;}
 const token=randomBytes(32).toString('hex');await pool.query('DELETE FROM customer_sessions WHERE expires_at<=NOW()');await pool.query("INSERT INTO customer_sessions VALUES($1,$2,NOW()+INTERVAL '7 days')",[digest(token),id]);res.setHeader('Set-Cookie',`${cookieName}=${token}; HttpOnly; SameSite=Strict; Path=${path}; Max-Age=604800${process.env.NODE_ENV==='production'?'; Secure':''}`);return reply(200,{ok:true});
 }
 if(route==='/api/shop/signout'&&req.method==='POST'){await pool.query('DELETE FROM customer_sessions WHERE token=$1',[digest(cookie)]);res.setHeader('Set-Cookie',`${cookieName}=; HttpOnly; SameSite=Strict; Path=${path}; Max-Age=0`);return reply(200,{ok:true});}
 if(!customer)return reply(401,{error:'Sign in to chat and place an order.'});
 if(route==='/api/shop/chat'&&req.method==='GET')return reply(200,{messages:(await pool.query('SELECT id,role,body,created_at FROM messages WHERE conversation_id=$1 ORDER BY id',[customer.conversation_id])).rows,orders:(await pool.query('SELECT o.id,o.quantity,o.unit_price,o.status,p.name FROM conversation_orders co JOIN orders o ON o.id=co.order_id JOIN products p ON p.id=o.product_id WHERE co.conversation_id=$1 ORDER BY o.id',[customer.conversation_id])).rows});
 if(route==='/api/shop/chat'&&req.method==='POST'){
 const p=await body(req);if(typeof p.body!=='string'||!p.body.trim()||p.body.length>4000)invalid('Enter a message of 1–4000 characters.');const c=await pool.connect();try{await c.query('BEGIN');if(websiteChat){
  await c.query('SELECT id FROM customers WHERE id=$1 FOR UPDATE',[customer.id]);
  const recent=await c.query("SELECT 1 FROM messages WHERE conversation_id=$1 AND role='customer' AND created_at>NOW()-INTERVAL '3 seconds' LIMIT 1",[customer.conversation_id]);
  if(recent.rowCount){await c.query('ROLLBACK');return reply(429,{error:'Please wait a few seconds before sending another message.'});}
 }
 const message=await c.query("INSERT INTO messages(conversation_id,role,body) VALUES($1,'customer',$2) RETURNING id",[customer.conversation_id,p.body.trim()]);
 await queueChat(c,customer.conversation_id,message.rows[0].id);
 await c.query("UPDATE conversations SET status='Needs reply' WHERE id=$1",[customer.conversation_id]);await c.query('COMMIT');}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}return reply(201,{ok:true});
 }
 if(route==='/api/shop/orders'&&req.method==='POST'){
 const p=await body(req);if(!Number.isSafeInteger(p.product_id)||!Number.isSafeInteger(p.quantity)||p.quantity<1||p.quantity>2147483647||typeof p.request_key!=='string'||!/^[a-zA-Z0-9-]{16,80}$/.test(p.request_key))invalid('Choose a product and a valid quantity.');
 const key=`${customer.id}:${p.request_key}`;const c=await pool.connect();try{await c.query('BEGIN');await c.query('SELECT id FROM customers WHERE id=$1 FOR UPDATE',[customer.id]);const existing=(await c.query('SELECT order_id FROM conversation_orders WHERE request_key=$1',[key])).rows[0];if(existing){await c.query('COMMIT');return reply(200,{id:existing.order_id});}
 const product=(await c.query('SELECT * FROM products WHERE id=$1 FOR UPDATE',[p.product_id])).rows[0];if(!product||product.stock<p.quantity)invalid('This quantity is not available. Choose fewer items.');
 const order=(await c.query("INSERT INTO orders VALUES(nextval('order_ids'),$1,$2,$3,0,'Website','Pending',NOW()) RETURNING id",[product.id,p.quantity,product.price])).rows[0];await c.query('INSERT INTO conversation_orders VALUES($1,$2,$3)',[order.id,customer.conversation_id,key]);
 const {rows:[settings]}=await c.query('SELECT currency FROM workspace_settings WHERE id=1');
 await c.query("INSERT INTO messages(conversation_id,role,body) VALUES($1,'customer',$2),($1,'assistant',$3)",[customer.conversation_id,`I'd like to order ${p.quantity} × ${product.name}.`,`Order #${order.id}: ${p.quantity} × ${product.name}, total ${(product.price*p.quantity).toFixed(2)} ${settings?.currency??'USD'}. Pending payment confirmation. The store will reply here; stock is not reserved yet.`]);await c.query("UPDATE conversations SET product=$1,status='Needs reply',intent='High intent' WHERE id=$2",[product.name,customer.conversation_id]);await c.query('COMMIT');return reply(201,{id:order.id});
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
 }
 return reply(404,{error:'Not found'});
}
