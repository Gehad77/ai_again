import { stockChange, isDate, isMoney, isTargetPeriod } from './business-model.js';
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
 const overview=d.overview;
 const products=overview.products;
 const movements=overview.movements??=[];
 const expenses=overview.expenses??=[];
 const targets=overview.targets??=[];
 const nextId=items=>items.reduce((max,item)=>Math.max(max,item.id),0)+1;
 const now=()=>new Date().toISOString();
 const record=(product, details)=>movements.unshift({id:nextId(movements),product_id:product.id,date:now(),...details});
 const productRoute=url.match(/^\/api\/products\/(\d+)(\/stock)?$/);
 const product=productRoute&&products.find(p=>p.id===Number(productRoute[1]));
 const payload=()=>JSON.parse(options.body);
 if((url==='/api/products'&&method==='POST')||(productRoute&&!productRoute[2]&&method==='PATCH')){
  const p=payload();
  if(productRoute&&!product)throw Error('Product not found.');
  const fields={name:p.name.trim(),category:p.category.trim(),price:p.price,unit_cost:p.unit_cost??null};
  if(!fields.name||!fields.category||!isMoney(p.price)||(p.unit_cost!=null&&!isMoney(p.unit_cost)))throw Error('Enter a valid name, category, price and unit cost.');
  if(product){Object.assign(product,fields);save();return product;}
  if(!Number.isInteger(p.stock)||p.stock<0||p.stock>2147483647)throw Error('Enter valid opening stock.');
  const added={...fields,id:nextId(products),stock:p.stock,emoji:'◇',color:'#e5eee6'};
  products.push(added);
  if(added.stock)record(added,{kind:'opening',delta:added.stock,stock_after:added.stock,unit_cost:added.unit_cost});
  save();return added;
 }
 if(productRoute?.[2]&&method==='POST'){
  if(!product)throw Error('Product not found.');
  const movement=stockChange(product,payload());
  product.stock=movement.stock_after;
  record(product,movement);
  save();return movements[0];
 }
 if(url==='/api/expenses'&&method==='POST'){
  const p=payload();
  if(!p.description.trim()||!isMoney(p.amount)||!p.amount||!isDate(p.date))throw Error('Enter a description, positive amount and valid date.');
  const expense={...p,description:p.description.trim(),id:nextId(expenses)};
  expenses.unshift(expense);save();return expense;
 }
 if(url.startsWith('/api/expenses/')&&method==='DELETE'){
  overview.expenses=expenses.filter(x=>x.id!==Number(url.split('/').at(-1)));
  save();return {ok:true};
 }
 if(url==='/api/targets'&&method==='PUT'){
  const p=payload();
  if(!isTargetPeriod(p.period)||!isMoney(p.amount))throw Error('Enter a valid period and target amount.');
  overview.targets=[...targets.filter(t=>t.period!==p.period),p];
  save();return {ok:true};
 }
 const confirm=url.match(/^\/api\/orders\/(\d+)\/confirm$/);
 if((url==='/api/orders'||confirm)&&method==='POST'){
  const p=payload();
  const pending=confirm&&overview.orders.find(o=>o.id===Number(confirm[1])&&o.status==='Pending');
  if(confirm&&!pending)throw Error('This order is no longer pending.');
  const order=pending ? {...pending,status:'Paid',unit_cost:p.unit_cost} :
   {...p,id:nextId(overview.orders),date:now()};
  const selected=products.find(x=>x.id===order.product_id);
  if(!selected)throw Error('Choose a product.');
  if(order.status==='Paid'){
   if(selected.stock<order.quantity)throw Error('Not enough stock for this paid order.');
   selected.stock-=order.quantity;
   order.paid_at=now();
   record(selected,{kind:'sale',order_id:order.id,delta:-order.quantity,stock_after:selected.stock,unit_cost:order.unit_cost});
  }
  if(pending)Object.assign(pending,order);else overview.orders.push(order);
  save();return order;
 }
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
