const storageKey='relay-crm-demo-v1';
let data;
async function load(){
 if(data)return data;
 try{const saved=localStorage.getItem(storageKey);if(saved)data=JSON.parse(saved);}catch{}
 if(!data){const r=await fetch(new URL('./demo-data.json',import.meta.url));if(!r.ok)throw Error('Unable to load preview data');data=await r.json();}
 if(!data.overview.orders){const fresh=await(await fetch(new URL('./demo-data.json',import.meta.url))).json();data.overview.orders=fresh.overview.orders;}
 return data;
}
function save(){try{localStorage.setItem(storageKey,JSON.stringify(data));}catch{throw Error('Browser storage unavailable. Changes last for this visit only.');}}
export async function demoApi(url,options={}){
 const d=await load();const method=options.method||'GET';
 if(url==='/api/auth/signout'){sessionStorage.removeItem('relay-demo-session');return {ok:true};}
 if(url==='/api/products'&&method==='POST'){const p=JSON.parse(options.body);p.id=Math.max(0,...d.overview.products.map(p=>p.id))+1;p.emoji='◇';p.color='#e5eee6';d.overview.products.push(p);save();return p;}
 if(url==='/api/orders'&&method==='POST'){const p=JSON.parse(options.body);const product=d.overview.products.find(x=>x.id===p.product_id);if(!product)throw Error('Choose a product.');if(p.status==='Paid'&&product.stock<p.quantity)throw Error('Not enough stock for this paid order.');if(p.status==='Paid')product.stock-=p.quantity;p.id=Math.max(0,...d.overview.orders.map(o=>o.id))+1;p.date=new Date().toISOString();d.overview.orders.push(p);save();return p;}
 if(url==='/api/overview')return structuredClone(d.overview);
 const match=url.match(/^\/api\/conversations\/(\d+)(\/messages)?$/);
 if(!match)throw Error('Not available in preview');
 const c=d.overview.conversations.find(c=>c.id===Number(match[1]));if(!c)throw Error('Conversation not found');
 if(method==='GET')return structuredClone(d.messages[match[1]]||[]);
 const body=JSON.parse(options.body||'{}');
 if(method==='POST'&&match[2]){
  if(typeof body.body!=='string'||!body.body.trim()||body.body.length>4000)throw Error('Enter a message of 1–4000 characters');
  d.messages[match[1]].push({id:Date.now(),role:'agent',body:body.body.trim(),created_at:new Date().toISOString()});save();return {ok:true};
 }
 if(method==='PATCH'&&['Needs reply','AI handling','Converted','Inactive'].includes(body.status)){c.status=body.status;save();return {ok:true};}
 throw Error('Invalid preview request');
}
