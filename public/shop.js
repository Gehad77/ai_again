import {language,localize,setCurrency,setLanguage,formatMoney} from './i18n.js';
const workspacePath=location.pathname.match(/^\/w\/[^/]+/)?.[0]??'';
const root=document.querySelector('#shop');
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=formatMoney;
let storeName='Relay';
async function api(path,options){const r=await fetch(workspacePath+'/api/shop/'+path,options);const d=await r.json();if(!r.ok)throw Error(d.error||'Request failed');return d;}
const post=(path,data)=>api(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
let customer,products=[],timer,lastMessages='';
function auth(signup=true){clearInterval(timer);root.innerHTML=`<section class="card auth-card"><a class="brand" href="./shop" data-user-content>${esc(storeName)}</a><div class="eyebrow">SHOP & CHAT</div><h1>${signup?'Let’s start a conversation.':'Welcome back.'}</h1><p>${signup?'Create a customer account to chat with the store and request an order.':'Sign in to see your chat and orders.'}</p><form id="customer-auth">${signup?'<label>Your name<input name="name" autocomplete="name" maxlength="80" required></label>':''}<label>Email<input name="email" type="email" autocomplete="username" maxlength="254" required></label><label>Password<input name="password" type="password" autocomplete="${signup?'new-password':'current-password'}" minlength="12" maxlength="128" required></label><small>12–128 characters</small><p class="form-error" role="alert"></p><button class="primary">${signup?'Create customer account':'Sign in'}</button></form><a href="./shop?account=${signup?'signin':'signup'}">${signup?'Already have an account? Sign in':'New customer? Create an account'}</a><p><a href="./">Store owner? Open dashboard</a></p></section>`;
 document.querySelector('form').onsubmit=async e=>{e.preventDefault();const form=e.currentTarget,button=form.querySelector('button');button.disabled=true;try{await post(signup?'signup':'signin',Object.fromEntries(new FormData(form)));history.replaceState(null,'',location.pathname);await boot();}catch(e){form.querySelector('[role=alert]').textContent=e.message;}finally{button.disabled=false;}};
}
async function refresh(){const d=await api('chat');const catalog=await api('products');products=catalog.products;for(const p of products){const stock=document.querySelector(`[data-stock="${p.id}"]`);if(stock)stock.textContent=`${p.stock} available`;const f=document.querySelector(`[data-product="${p.id}"]`);if(f){f.quantity.max=p.stock;f.quantity.disabled=!p.stock;f.querySelector('button').disabled=!p.stock;f.querySelector('button').textContent=p.stock?'Request order in chat':'Out of stock';}}if(!document.querySelector('#customer-messages'))return;const serialized=JSON.stringify(d);if(serialized===lastMessages)return;lastMessages=serialized;const messages=document.querySelector('#customer-messages');messages.innerHTML=d.messages.map(m=>`<div class="bubble ${m.role==='customer'?'outgoing':'incoming'}"><small>${m.role==='customer'?'You':m.role==='agent'?'Store team':'AI assistant'}</small><div dir="auto" data-user-content>${esc(m.body)}</div></div>`).join('');messages.scrollTop=messages.scrollHeight;document.querySelector('#customer-orders').innerHTML=d.orders.length?`<h3>Your orders</h3>${d.orders.map(o=>`<p><b>#${o.id}</b> · ${esc(o.name)} × ${o.quantity} · ${money(o.quantity*o.unit_price)} <span class="badge ${o.status==='Paid'?'green':'amber'}">${esc(o.status)}</span></p>`).join('')}`:'Your orders will appear here.';}
function show(){lastMessages='';root.innerHTML=`<header class="shop-header"><a class="brand" href="./shop" data-user-content>${esc(storeName)}</a><div>Hello, ${esc(customer.name)} <a class="new-customer-link" href="./shop?account=signup">Create another customer account</a> <button id="customer-signout">Sign out</button></div></header><div class="heading"><div class="eyebrow">YOUR NEXT FIND STARTS WITH A CONVERSATION</div><h1>Browse. Ask. Order.</h1><p>Choose a product to request an order in your chat. Our team replies here.</p></div><div class="shop-layout"><section class="card shop-chat"><div class="card-head"><h2>Chat with the store</h2><span class="badge green">Website chat</span></div><div id="customer-messages" class="messages" aria-live="polite" aria-label="Chat messages"></div><form id="customer-reply"><label for="chat-body">Your message</label><textarea id="chat-body" name="body" maxlength="4000" placeholder="Ask about a product, delivery, or your order…" required></textarea><p class="form-error" role="alert"></p><button class="primary">Send message ↗</button></form><div id="customer-orders" class="shop-orders"></div></section><section><h2>Available products</h2><div class="shop-products">${products.map(p=>`<article class="card shop-product"><div class="shop-product-icon">${esc(p.emoji)}</div><h3>${esc(p.name)}</h3><p>${esc(p.category)} · ${money(p.price)}</p><small data-stock="${p.id}">${p.stock} available</small><form data-product="${p.id}"><label>Quantity<input name="quantity" type="number" min="1" max="${p.stock}" value="1" required ${!p.stock?'disabled':''}></label><button class="primary" ${!p.stock?'disabled':''}>${p.stock?'Request order in chat':'Out of stock'}</button><p class="form-error" role="alert"></p></form></article>`).join('')||'<p>No products yet. Send the store a message to ask about availability.</p>'}</div><p class="notice">Orders start as pending. No payment is collected here, and stock is not reserved until the store confirms payment.</p></section></div>`;
 document.querySelector('#customer-signout').onclick=async()=>{try{await post('signout',{});location.replace('./shop?account=signin');}catch(e){document.querySelector('#customer-reply [role=alert]').textContent=e.message;}};
 document.querySelector('#customer-reply').onsubmit=async e=>{e.preventDefault();const f=e.currentTarget,b=f.querySelector('button');b.disabled=true;try{await post('chat',{body:f.body.value});f.reset();f.querySelector('[role=alert]').textContent='';await refresh();}catch(e){f.querySelector('[role=alert]').textContent=e.message;}finally{b.disabled=false;}};
 document.querySelectorAll('[data-product]').forEach(form=>{let requestKey=crypto.randomUUID();form.onsubmit=async e=>{e.preventDefault();const b=form.querySelector('button');b.disabled=true;try{const quantity=Number(form.quantity.value);if(!confirm(`Request ${quantity} × ${products.find(p=>p.id===Number(form.dataset.product)).name}? The store will confirm payment separately.`))return;await post('orders',{product_id:Number(form.dataset.product),quantity,request_key:requestKey});requestKey=crypto.randomUUID();form.querySelector('[role=alert]').textContent='Order sent to your chat.';form.querySelector('[role=alert]').classList.add('form-success');await refresh();document.querySelector('#customer-messages').scrollIntoView({behavior:'smooth',block:'nearest'});}catch(e){form.querySelector('[role=alert]').textContent=e.message;}finally{b.disabled=false;}};});
 refresh().catch(showError);clearInterval(timer);timer=setInterval(()=>refresh().catch(showError),5000);
}
function showError(e){const target=document.querySelector('#customer-reply [role=alert]');if(target)target.textContent=e.message;}
function publicStore(){
 root.innerHTML=`<header class="shop-header"><h1 data-user-content>${esc(storeName)}</h1>
 <div><a href="./shop?account=signin">Sign in</a> · <a href="./shop?account=signup">Create customer account</a></div></header>
 <h2>Available products</h2><div class="shop-products">
 ${products.map(p=>`<article class="card shop-product">
 <h3 data-user-content>${esc(p.name)}</h3><p data-user-content>${esc(p.category)}</p><p>${money(p.price)}</p>
 ${p.stock?'<a href="./shop?account=signup">Sign up to order or chat</a>':'<span class="badge">Out of stock</span>'}
 </article>`).join('')||'<p>No products yet.</p>'}</div>`;
}
async function boot(){try{if(location.hostname.endsWith('github.io')){root.innerHTML='<section class="card auth-card"><h1>Customer chat</h1><p>Customer accounts and live chat are available on our store website.</p><a class="primary" href="https://ai-again.onrender.com/shop">Open store chat ↗</a></section>';return;}if(workspacePath){
 const response=await fetch(workspacePath+'/api/store');
 const settings=await response.json();
 if(!response.ok)throw Error(settings.error);
 storeName=settings.name;
 setCurrency(settings.currency);
 setLanguage(settings.language??language);
 document.title=storeName+' · Relay';
 products=(await api('products')).products;
 }else setLanguage(language);
 customer=(await api('session')).customer;const account=new URLSearchParams(location.search).get('account');
 if(!customer)return workspacePath&&!account?publicStore():auth(account!=='signin');
 if(account==='signup')return switchCustomer();
 products=(await api('products')).products;show();}catch(e){root.innerHTML=`<section class="card auth-card"><h1>Unable to connect</h1><p>${esc(e.message)}</p><button onclick="location.reload()">Try again</button></section>`;}}
function switchCustomer(){
 clearInterval(timer);
 root.innerHTML=`<section class="card auth-card"><h1>Create another customer account</h1>
 <p>You’re signed in as ${esc(customer.name)}. Sign out to register with another email.</p>
 <button id="switch-customer" class="primary">Sign out and create account</button>
 <p><a href="./shop">Return to my chat</a></p><p class="form-error" role="alert"></p></section>`;
 const button=document.querySelector('#switch-customer');
 button.onclick=async()=>{
  button.disabled=true;
  try{await post('signout',{});customer=null;auth();}
  catch(error){document.querySelector('[role=alert]').textContent=error.message;button.disabled=false;}
 };
}
new MutationObserver(records=>{
 for(const record of records)for(const node of record.addedNodes)localize(node);
}).observe(root,{childList:true,subtree:true});
await boot();
