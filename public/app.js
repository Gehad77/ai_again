import { businessDate, isInPeriod } from './business-model.js';
import { businessProfile, stockDialog, warehouseSummary } from './business-view.js';
import { analyze } from './analytics.js';
import { demoApi } from './demo.js';
const preview=location.hostname.endsWith('github.io')||new URLSearchParams(location.search).has('demo');
const icons={overview:'◫',inbox:'▤',customers:'♧',products:'◇',profile:'▧',analytics:'▥',integrations:'⌘',settings:'⚙'};
let state={page:location.hash==='#profile'?'profile':'overview',filter:'All channels',search:'',selected:1,data:null,businessYear:businessDate().slice(0,4),businessPeriod:businessDate().slice(0,7)};
const $=s=>document.querySelector(s);const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const api=async(url,options)=>{if(location.hostname.endsWith('github.io')||new URLSearchParams(location.search).has('demo'))return demoApi(url,options);const r=await fetch(url,options);const d=await r.json();if(!r.ok)throw Error(d.error);return d;};
const toast=t=>{$('#toast').textContent=t;$('#toast').classList.add('show');setTimeout(()=>$('#toast').classList.remove('show'),3000);};
const channel=c=>`<span class="channel ${c.toLowerCase()}">${c==='WhatsApp'?'◉':c==='Instagram'?'◎':'ϟ'}</span>`;
const badge=s=>`<span class="badge ${s==='High intent'||s==='Converted'||s==='Purchased'?'green':s==='Needs reply'||s==='Price concern'?'amber':'gray'}">${esc(s)}</span>`;
const filtered=()=>state.data.conversations.filter(c=>(state.filter==='All channels'||c.channel===state.filter)&&`${c.name} ${c.product}`.toLowerCase().includes(state.search.toLowerCase()));
function table(){return `<div class="table-wrap"><table><thead><tr><th>Customer</th><th>Channel</th><th>Product interest</th><th>Buying signal</th><th>Status</th><th></th></tr></thead><tbody>${filtered().map(c=>`<tr data-chat="${c.id}" tabindex="0"><td><div class="person"><span class="avatar" style="background:${c.color}">${esc(c.initials)}</span><span><b>${esc(c.name)}</b><small>Sample customer</small></span></div></td><td>${channel(c.channel)} ${c.channel}</td><td>${esc(c.product)}</td><td>${badge(c.intent)}</td><td><span class="dot ${c.status==='AI handling'?'purple':''}"></span>${c.status}</td><td>↗</td></tr>`).join('')||'<tr><td colspan="6">No conversations match your search.</td></tr>'}</tbody></table></div>`;}
function filters(){return `<div class="filters"><div class="tabs">${['All channels','WhatsApp','Instagram','Messenger','Website'].map(x=>`<button class="${state.filter===x?'active':''}" data-filter="${x}">${x==='All channels'?'':channel(x)}${x}</button>`).join('')}</div><input id="search" placeholder="⌕ Search conversations" value="${esc(state.search)}" aria-label="Search conversations"></div>`;}
function overview(){return `<div class="heading"><div class="eyebrow">YOUR BUSINESS AT A GLANCE</div><h1>A little clarity. A lot of growth<span class="green-text">.</span></h1><p>Here’s what’s happening with your customers today.</p></div><div class="top-actions"><span class="live-dot"></span> Live overview <button data-create="product">+ Add product</button><a href="./shop" target="_blank" rel="noopener">Open customer chat ↗</a><button id="export">↗ Export report</button></div><div class="demo-strip"><span>✧ <b>Your next chapter in sales starts here.</b> Explore your workspace with sample data.</span><span class="demo-tag">DEMO WORKSPACE</span></div><div class="metrics">${[['Total conversations',String(state.data.conversations.length),'Across 3 connected channel previews','↗','mint'],['Interested customers',String(state.data.conversations.filter(c=>c.intent==='High intent').length),'Customers showing high buying intent','♧','lavender'],['Paid orders',String((state.data.orders||[]).filter(o=>o.status==='Paid').length),'Confirmed sample order records','▣','peach'],['Needs your attention',String(state.data.conversations.filter(c=>c.status==='Needs reply').length),'Conversations waiting for a reply','◷','yellow']].map(([label,n,sub,icon,color])=>`<article class="metric"><div>${label}<span class="metric-icon ${color}">${icon}</span></div><strong>${n}</strong><small>${sub}</small></article>`).join('')}</div>${warehouseSummary(state.data,esc)}<div class="chart-grid"><section class="card"><div class="card-head"><div><h2>Conversations by channel</h2><p>A closer look at where your customers connect.</p></div><span class="subtle">Sample activity · 7 days</span></div><div class="legend"><span><i style="background:#21654e"></i>WhatsApp</span><span><i style="background:#a69bce"></i>Instagram</span><span><i style="background:#e5c9a8"></i>Messenger</span></div><div class="chart"><div class="y-axis"><span>40</span><span>30</span><span>20</span><span>10</span><span>0</span></div><div class="bars">${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((d,i)=>`<div class="bar-group"><div class="bar-stack"><i style="height:${[42,62,53,77,61,88,72][i]}%;background:#21654e"></i><i style="height:${[30,42,36,52,45,61,48][i]}%;background:#a69bce"></i><i style="height:${[17,25,20,32,28,37,29][i]}%;background:#e5c9a8"></i></div><span>${d}</span></div>`).join('')}</div></div></section><section class="card insight"><div class="card-head"><div><h2>✧ Sales intelligence</h2><p>Turn conversations into your next move.</p></div><span class="ai-label">AI PREVIEW</span></div><div class="insight-item"><span class="insight-icon mint">↗</span><div><b>A product worth watching</b><p>Everyday Tote has 2 customer conversations. Check the inbox to understand their needs.</p><button data-go="products">View product interest ↗</button></div></div><div class="insight-item"><span class="insight-icon peach">◇</span><div><b>Price is part of the conversation</b><p>Phoenix asked for a more affordable option. A thoughtful recommendation could help.</p><button data-chat="2">Open conversation ↗</button></div></div><div class="insight-foot">ⓘ Sample insights · Review messages before acting</div></section></div><section class="card recent"><div class="card-head"><div><h2>Recent conversations <span class="count">6</span></h2><p>Every conversation is a chance to connect.</p></div><button data-go="inbox">View inbox ↗</button></div>${filters()}${table()}</section>`;}
function products(){return `<div class="heading"><div class="eyebrow">YOUR CATALOG</div><h1>Good products. Great conversations.</h1><p>The source of truth for your sales assistant. Sample inventory.</p></div><button class="primary create-action" data-create="product">+ Add product</button><div class="product-grid">${state.data.products.map(p=>`<article class="card product"><div class="product-art" style="background:${p.color}">${p.emoji}</div><small>${esc(p.category)}</small><h2>${esc(p.name)}</h2><div class="product-bottom"><strong>$${p.price.toFixed(2)}</strong>${badge(p.stock<10?'Low stock':p.stock+' in stock')}</div><p>${state.data.conversations.filter(c=>c.product===p.name).length} customer inquiries · ${(state.data.orders||[]).filter(o=>o.product_id===p.id&&o.status==='Paid').reduce((s,o)=>s+o.quantity,0)} units sold</p></article>`).join('')}</div>`;}
function customers(){return `<div class="heading"><div class="eyebrow">PEOPLE, NOT JUST LEADS</div><h1>Meet your customers.</h1><p>Website customer accounts and conversation activity.</p></div><section class="card recent" id="customer-accounts"></section><section class="card">${filters()}${table()}</section>`;}
const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n);
function analytics(){const a=analyze(state.data,{days:state.analyticsDays||0,channel:state.analyticsChannel||'All channels'});const total=a.orders.length;return `<div class="heading"><div class="eyebrow">SALES & INVENTORY INTELLIGENCE</div><h1>Know what sells. Know what’s left.</h1><p>Sample order records · Sales totals use paid orders only. Stock shows current inventory across all channels.</p></div><button class="primary create-action" data-go="inbox">Create orders from inbox ↗</button><div class="analytics-toolbar"><div><label>Sales period <select id="analytics-period"><option value="0">All time</option><option value="7" ${state.analyticsDays===7?'selected':''}>Last 7 days</option><option value="30" ${state.analyticsDays===30?'selected':''}>Last 30 days</option></select></label><label>Channel <select id="analytics-channel">${['All channels','WhatsApp','Instagram','Messenger','Website'].map(c=>`<option ${c===state.analyticsChannel?'selected':''}>${c}</option>`).join('')}</select></label></div><button id="analytics-export">Download product report ↓</button></div><div class="metrics">${[['Units sold',a.units,'Paid quantities in the selected period'],['Products left',a.stock,'Current units available in the store'],['Sales revenue',money(a.revenue),'Paid item totals · excludes tax and shipping'],['Gross profit',money(a.profit),'Revenue minus recorded product costs'],['Paid orders',a.paid.length,'Order records, not chat status'],['Average order',money(a.averageOrder),'Paid revenue divided by paid orders'],['Stock retail value',money(a.stockValue),'Current stock × catalog selling price'],['Low-stock products',a.lowStock.length,'10 units or fewer remaining']].map(([label,n,sub])=>`<article class="metric"><div>${label}</div><strong>${n}</strong><small>${sub}</small></article>`).join('')}</div><section class="card recent"><div class="card-head"><div><h2>Product performance & stock</h2><p>Inquiries cover all conversation history for the selected channel; sales follow the selected period.</p></div></div><div class="table-wrap"><table><thead><tr><th>Product</th><th>Price</th><th>Stock left</th><th>Units sold</th><th>Revenue</th><th>Gross profit</th><th>Inquiries</th><th>Inactive chats</th><th>Price concerns</th></tr></thead><tbody>${a.products.map(p=>`<tr><td><b>${esc(p.name)}</b><small>${esc(p.category)}</small></td><td>${money(p.price)}</td><td>${badge(p.stock+' left')}${p.stock<=10?' <span class="badge amber">Restock</span>':''}</td><td>${p.units}</td><td>${money(p.revenue)}</td><td>${money(p.profit)}</td><td>${p.inquiries}</td><td>${p.inactive}</td><td>${p.priceConcerns}</td></tr>`).join('')}</tbody></table></div></section><div class="chart-grid analytics-section"><section class="card"><div class="card-head"><div><h2>Sales by channel</h2><p>Paid order revenue in your selected filters</p></div></div>${['WhatsApp','Instagram','Messenger','Website'].map(c=>{const os=a.paid.filter(o=>o.channel===c);const r=os.reduce((s,o)=>s+o.quantity*o.unit_price,0);return `<div class="demand"><span>${channel(c)}${c}<small>${os.length} paid orders</small></span><div><i style="width:${a.revenue?r/a.revenue*100:0}%"></i></div><b>${money(r)}</b></div>`;}).join('')}</section><section class="card"><div class="card-head"><div><h2>Inventory watchlist</h2><p>Current inventory · all channels</p></div></div>${a.lowStock.length?a.lowStock.map(p=>`<div class="stock-alert"><span class="insight-icon peach">!</span><div><b>${esc(p.name)}</b><p>${p.stock} units left. Review stock before your next promotion.</p></div>${badge('Low stock')}</div>`).join(''):'<p class="stock-alert">All products are above the low-stock threshold.</p>'}<div class="insight-foot">Retail stock value is not inventory cost or realized revenue.</div></section></div><div class="analytics-grid">${[['Pending orders',a.pending,'Awaiting payment; excluded from sales.'],['Refunded orders',a.refunded,'Excluded from paid totals; refund cash flow is not modeled.'],['Cancelled orders',a.cancelled,'Excluded from sales and revenue.']].map(([t,n,d])=>`<article class="card analytics-card"><h2>${t}</h2><strong>${n}</strong><p>${d}</p></article>`).join('')}</div><section class="card recent analytics-section"><div class="card-head"><div><h2>Order ledger <span class="count">${total}</span></h2><p>Trace every sales total back to an order record.</p></div></div><div class="table-wrap"><table><thead><tr><th>Order</th><th>Date</th><th>Product</th><th>Channel</th><th>Quantity</th><th>Item total</th><th>Status</th></tr></thead><tbody>${a.orders.map(o=>`<tr><td>#RL-${String(o.id).padStart(4,'0')}</td><td>${esc(o.date.slice(0,10))}</td><td>${esc(state.data.products.find(p=>p.id===o.product_id)?.name||'Unknown product')}</td><td>${channel(o.channel)}${o.channel}</td><td>${o.quantity}</td><td>${money(o.quantity*o.unit_price)}</td><td>${badge(o.status)}</td></tr>`).join('')||'<tr><td colspan="7">No orders in the selected period and channel.</td></tr>'}</tbody></table></div></section><div class="notice">Sample analytics, not live store data. Changing a chat to “Converted” does not create an order or reduce stock. Gross profit excludes operating expenses. Inactive chats have an unknown outcome, not a confirmed lost sale.</div>`;}
function integrations(){return `<div class="heading"><div class="eyebrow">EVERY CHANNEL. ONE CONVERSATION.</div><h1>Meet customers where they are.</h1><p>Connect your business accounts using Meta’s official APIs.</p></div><div class="analytics-grid">${['WhatsApp','Instagram','Messenger'].map(c=>`<article class="card integration">${channel(c)}<h2>${c}</h2><p>${c==='WhatsApp'?'Connect a WhatsApp Business number.':c==='Instagram'?'Connect a professional Instagram account.':'Connect your Facebook business Page.'}</p>${badge('Not connected')}<button class="primary connect" data-channel="${c}">Set up ${c} ↗</button></article>`).join('')}</div><div class="notice">ⓘ This prototype uses sample messages. Live messaging requires Meta app credentials, webhooks, account authorization, and applicable app review.</div>`;}
async function inbox(){const c=state.data.conversations.find(x=>x.id===state.selected)||state.data.conversations[0];if(!c){$('#page').innerHTML='<div class="heading"><h1>Your inbox is ready.</h1><p>Share the customer chat link to start receiving messages and orders.</p><a href="./shop" target="_blank" rel="noopener">Open customer chat ↗</a><button id="refresh-inbox">Refresh inbox</button></div>';$('#refresh-inbox').onclick=async()=>{state.data=await api('/api/overview');await inbox();};return;}state.selected=c.id;const messages=await api(`/api/conversations/${c.id}`);if(state.page!=='inbox')return;$('#page').innerHTML=`<div class="heading"><div class="eyebrow">YOUR SHARED INBOX</div><h1>Make every conversation count.</h1><p>Website customers can chat and request orders here. Replies to website chats are visible to that customer.</p></div><div class="top-actions"><a href="./shop" target="_blank" rel="noopener">Open customer chat ↗</a><button id="refresh-inbox">Refresh inbox</button><button class="primary" data-create="order">+ Create order from chat</button></div><div class="inbox-layout card"><aside class="threads">${state.data.conversations.map(x=>`<button data-chat="${x.id}" class="thread ${x.id===c.id?'selected':''}"><span class="avatar" style="background:${x.color}">${esc(x.initials)}</span><span><b>${esc(x.name)}</b><small>${x.channel} · ${x.status}</small></span></button>`).join('')}</aside><div class="chat"><div class="chat-head"><div class="person"><span class="avatar" style="background:${c.color}">${esc(c.initials)}</span><div><b>${esc(c.name)}</b><small>${esc(c.channel)} · ${esc(c.product)}</small></div></div><select id="status" aria-label="Conversation status">${['Needs reply','AI handling','Converted','Inactive'].map(s=>`<option ${s===c.status?'selected':''}>${s}</option>`).join('')}</select></div><div class="messages"> <div class="chat-date">CONVERSATION</div>${messages.map(m=>`<div class="bubble ${m.role==='customer'?'incoming':'outgoing'}"><small>${m.role==='customer'?esc(c.name):m.role==='agent'?'You':c.channel==='Website'?'Order assistant · automated':'AI assistant · sample'}</small>${esc(m.body)}</div>`).join('')}</div><div class="inbox-orders">${(state.data.orders||[]).filter(o=>o.conversation_id===c.id).map(o=>`<div>Order #${o.id} · ${o.quantity} items · ${money(o.quantity*o.unit_price)} · ${esc(o.status)} ${o.status==='Pending'?`<button data-confirm-order="${o.id}" class="primary">Confirm payment</button>`:''}</div>`).join('')}</div><form id="reply"><textarea aria-label="Your reply" placeholder="Write a thoughtful reply…" maxlength="4000" required></textarea><div><span>${c.channel==='Website'?'Replies appear in the customer’s website chat':'Sample conversation · No Meta message is sent'}</span><button class="primary">Send reply ↗</button></div></form></div></div>`;$('#refresh-inbox').onclick=async()=>{try{state.data=await api('/api/overview');await inbox();}catch(e){toast(e.message);}};$('#reply').onsubmit=async e=>{e.preventDefault();try{await api(`/api/conversations/${c.id}/messages`,{method:'POST',body:JSON.stringify({body:$('#reply textarea').value})});await inbox();}catch(e){toast(e.message);}};$('#status').onchange=async e=>{try{await api(`/api/conversations/${c.id}`,{method:'PATCH',body:JSON.stringify({status:e.target.value})});state.data=await api('/api/overview');toast('Conversation updated');}catch(e){toast(e.message);}};}
function render(){ $('#app').innerHTML=`<aside class="sidebar"><a class="brand" href="./" aria-label="Relay home"><span class="brand-icon">r</span>relay<span class="brand-period">.</span></a><button class="workspace" id="workspace"><span class="store-icon">▧</span><span><b>Olive & Co.</b><small>Demo workspace</small></span><span>⌄</span></button><div class="nav-label">WORKSPACE</div><nav>${Object.entries(icons).filter(([k])=>k!=='settings').map(([k,v])=>`<button data-go="${k}" class="nav-item ${state.page===k?'active':''}"><span>${v}</span>${k[0].toUpperCase()+k.slice(1)}${k==='inbox'?'<i>2</i>':''}${k==='analytics'?'<em>AI</em>':''}</button>`).join('')}</nav><div class="sidebar-bottom"><div class="upgrade"><span>✧</span><b>A little more possibility.</b><p>Explore AI-powered selling for your business.</p><button id="plans">Explore plans ↗</button></div><button data-go="settings" class="nav-item">⚙ <span>Settings</span></button><div class="profile"><span class="avatar">JD</span><div><button data-go="profile">Business profile</button><small>Workspace owner</small></div><span>⌄</span></div></div></aside><div class="main"><header><div><span class="breadcrumb">Workspace</span><span class="slash">/</span>${state.page[0].toUpperCase()+state.page.slice(1)}</div><div class="header-right"><a href="./shop" target="_blank" rel="noopener">Customer chat ↗</a><button id="signout">Sign out</button><span class="demo-tag">${preview?'DEMO':'WORKSPACE'}</span><button id="notifications" aria-label="Notifications">♧</button><span class="avatar mini">JD</span></div></header><main id="page">${state.page==='overview'?overview():state.page==='products'?products():state.page==='profile'?businessProfile(state.data,esc,state.businessYear,state.businessPeriod):state.page==='customers'?customers():state.page==='analytics'?analytics():state.page==='integrations'?integrations():state.page==='settings'?`<div class="heading"><div class="eyebrow">WORKSPACE SETTINGS</div><h1>A space for your business.</h1><p>Business configuration preview</p></div><section class="card settings"><h2>Olive & Co.</h2><p>Currency: USD</p><p>AI mode: Sample replies only</p><p>Owner: Jamie Davis (demo)</p><div class="notice">This is a single-workspace prototype. Owner sign-in is enabled on the backend. This is a shared workspace; tenant isolation, billing, and production AI are not enabled.</div></section>`:''}</main><footer>Made for meaningful conversations.<span>Relay CRM · Demo workspace</span></footer></div>`;if(state.page==='inbox')inbox().catch(e=>toast(e.message));bind();}
function bind(){
if(state.page==='profile')bindBusinessProfile();
if(state.page==='customers')loadCustomerAccounts();
$('#signout').onclick=async()=>{try{await api('/api/auth/signout',{method:'POST'});state.data=null;await boot();}catch(e){toast(e.message);}};
if($('#analytics-period'))$('#analytics-period').onchange=e=>{state.analyticsDays=Number(e.target.value);render();};
if($('#analytics-channel'))$('#analytics-channel').onchange=e=>{state.analyticsChannel=e.target.value;render();};
if($('#analytics-export'))$('#analytics-export').onclick=()=>{const a=analyze(state.data,{days:state.analyticsDays||0,channel:state.analyticsChannel||'All channels'});const rows=[['Product','Price','Stock left','Units sold','Revenue','Gross profit','Inquiries','Inactive chats','Price concerns'],...a.products.map(p=>[p.name,p.price,p.stock,p.units,p.revenue,p.profit,p.inquiries,p.inactive,p.priceConcerns])];const csv=rows.map(r=>r.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\n');const link=document.createElement('a');link.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));link.download='relay-product-analysis.csv';link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);};
const s=$('#search');if(s)s.oninput=e=>{state.search=e.target.value;const pos=e.target.selectionStart;render();$('#search').focus();$('#search').setSelectionRange(pos,pos);};$('#notifications').onclick=()=>toast('You have 2 sample conversations waiting for a reply.');$('#workspace').onclick=()=>toast('You are viewing the Olive & Co. demo workspace.');$('#plans').onclick=()=>toast('Subscription plans will be available in a future release.');if($('#export'))$('#export').onclick=()=>{const csv=['Customer,Channel,Product,Status',...state.data.conversations.map(c=>[c.name,c.channel,c.product,c.status].map(v=>'"'+v.replaceAll('"','""')+'"').join(','))].join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='relay-conversations.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);};}
document.addEventListener('click',e=>{const confirmOrder=e.target.closest('[data-confirm-order]');if(confirmOrder)confirmPayment(Number(confirmOrder.dataset.confirmOrder));const create=e.target.closest('[data-create]');if(create)openCreate(create.dataset.create);
const edit=e.target.closest('[data-edit-product]');
if(edit)openCreate('product',state.data.products.find(p=>p.id===Number(edit.dataset.editProduct)));
const stock=e.target.closest('[data-stock-product]');
if(stock)openStock(state.data.products.find(p=>p.id===Number(stock.dataset.stockProduct)));const go=e.target.closest('[data-go]');const chat=e.target.closest('[data-chat]');const f=e.target.closest('[data-filter]');const connect=e.target.closest('.connect');if(go){state.page=go.dataset.go;history.replaceState(null,'',location.pathname+location.search+(state.page==='profile'?'#profile':''));state.search='';state.filter='All channels';render();}if(chat){state.page='inbox';if(location.hash==='#profile')history.replaceState(null,'',location.pathname+location.search);state.selected=Number(chat.dataset.chat);render();}if(f){state.filter=f.dataset.filter;render();}if(connect)toast(`${connect.dataset.channel} requires Meta credentials and webhook setup. No account is connected yet.`);});
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.matches('tr[data-chat]'))e.target.click();});

async function loadCustomerAccounts(){
 const section=$('#customer-accounts');
 const heading='<div class="card-head"><div><h2>Registered customer accounts</h2></div></div>';
 section.innerHTML=heading+'<p class="stock-alert" role="status">Loading accounts…</p>';
 try{
  const accounts=preview?[]:(await api('/api/customers')).customers;
  section.innerHTML=heading+`<div class="table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Registered</th><th>Chat</th></tr></thead><tbody>${
   accounts.map(a=>`<tr><td>${esc(a.name)}</td><td>${esc(a.email)}</td><td>${a.registered_at?businessDate(a.registered_at):'Unavailable'}</td><td><button data-account-chat="${a.conversation_id}">Open chat</button></td></tr>`).join('')||
   `<tr><td colspan="4">${preview?'Registered accounts are available in the live owner dashboard.':'No website customers have registered yet.'}</td></tr>`
  }</tbody></table></div>`;
  for(const button of section.querySelectorAll('[data-account-chat]')){
   button.onclick=async()=>{
    button.disabled=true;
    try{
     const data=await api('/api/overview');
     if(!section.isConnected)return;
     state.data=data;
     state.page='inbox';
     state.selected=Number(button.dataset.accountChat);
     render();
    }catch(error){toast(error.message);button.disabled=false;}
   };
  }
 }catch(error){section.innerHTML=heading+`<p class="stock-alert" role="alert">${esc(error.message)}</p>`;}
}

function recoveryAuth(configured, enabled){
 $('#app').innerHTML=`<main class="auth-shell"><section class="card auth-card"><h1>Reset owner password</h1>
 <p>${enabled?'Request an 8-digit code using the email linked to the owner account.':'Email recovery is unavailable until the hosting administrator configures it.'}</p>
 ${enabled?`<form id="recovery-form"><label>Owner email<input name="email" type="email" maxlength="254" required></label>
 <div id="recovery-code" hidden><label>Verification code<input name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{8}" minlength="8" maxlength="8"></label>
 <label>New password<input name="password" type="password" autocomplete="new-password" minlength="12" maxlength="128"></label></div>
 <p class="form-error" role="alert"></p><p role="status"></p><button class="primary">Send code</button>
 <button type="button" id="resend-code" hidden>Request a new code</button></form>`:''}
 <button type="button" id="recovery-back">Back to owner sign-in</button></section></main>`;
 $('#recovery-back').onclick=()=>auth(configured,enabled);
 if(!enabled)return;
 const form=$('#recovery-form');
 const primary=form.querySelector('.primary');
 const resend=$('#resend-code');
 const feedback=form.querySelector('[role="status"]');
 const errorField=form.querySelector('.form-error');
 const send=async reset=>{
  primary.disabled=true;
  resend.disabled=true;
  errorField.textContent='';
  feedback.textContent='';
  try{
   const payload=Object.fromEntries(new FormData(form));
   await api('/api/auth/recovery/'+(reset?'reset':'request'),{
    method:'POST',body:JSON.stringify(reset?payload:{email:payload.email})
   });
   if(reset){
    auth(true,enabled);
    $('#auth-notice').textContent='Password reset. Sign in with your new password.';
    return;
   }
   feedback.textContent='If this email is registered, check your inbox and spam folder for the code.';
   $('#recovery-code').hidden=false;
   form.elements.email.readOnly=true;
   form.elements.code.required=true;
   form.elements.password.required=true;
   form.elements.code.focus();
   primary.textContent='Reset password';
   resend.hidden=false;
  }catch(error){errorField.textContent=error.message;}
  finally{primary.disabled=false;resend.disabled=false;}
 };
 form.onsubmit=e=>{e.preventDefault();send(!$('#recovery-code').hidden);};
 resend.onclick=()=>send(false);
}

function auth(configured, recoveryEnabled, ownerSetupFromHost){
 if(!configured&&ownerSetupFromHost){
  $('#app').innerHTML='<main class="auth-shell"><section class="card auth-card"><a class="brand" href="./">relay.</a><h1>Owner setup required</h1><p>The hosting administrator needs to create the owner from the hosting shell. Website customers can register in the shop.</p><a href="./shop?account=signup">Create a customer account</a></section></main>';
  return;
 }
 $('#app').innerHTML=`<main class="auth-shell"><section class="card auth-card"><a class="brand" href="./">relay.</a><div class="eyebrow">YOUR SALES, CONNECTED</div><h1>${preview?'Explore your workspace':configured?'Welcome back.':'Create your owner account.'}</h1><p>${preview?'This preview stores changes in this browser. It does not provide account security.':configured?'Sign in to manage products, orders, and conversations.':'The first account owns this shared workspace.'}</p>${preview?'<button class="primary" id="enter-demo">Enter demo workspace ↗</button>':`<form id="auth-form"><label>Email<input name="email" type="email" autocomplete="username" maxlength="254" required></label><label>Password<input name="password" type="password" autocomplete="${configured?'current-password':'new-password'}" minlength="12" maxlength="128" required></label><small>Use 12–128 characters.</small><p class="form-error" role="alert"></p><button class="primary">${configured?'Sign in':'Create account'}</button></form><p id="auth-notice" role="status"></p>${configured?'<button type="button" id="forgot-password">Forgot password?</button>':''}`}</section></main>`;
 if(preview){$('#enter-demo').onclick=async()=>{sessionStorage.setItem('relay-demo-session','1');await boot();};return;}
 if(configured)$('#forgot-password').onclick=()=>recoveryAuth(configured,recoveryEnabled);
 $('#auth-form').onsubmit=async e=>{e.preventDefault();const form=e.currentTarget;const button=form.querySelector('button');button.disabled=true;try{await api(configured?'/api/auth/signin':'/api/auth/setup',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(form)))});await boot();}catch(error){form.querySelector('.form-error').textContent=error.message;}finally{button.disabled=false;}};
}
function openCreate(kind, existing){
 const product=kind==='product';
 const field=(label,name,type='text',extra='')=>`<label>${label}<input name="${name}" type="${type}" ${extra} required></label>`;
 const dialog=document.createElement('dialog');dialog.className='entry-dialog';
 dialog.innerHTML=`<form><div class="dialog-heading"><h2>${product?(existing?'Edit product':'Add product'):'Create order'}</h2><button type="button" id="close-dialog" aria-label="Close">×</button></div><p>${product?'Grow your catalog with a new product.':'Paid orders reduce available stock and record sales revenue.'}</p><div class="form-grid">${product?field('Product name','name','text','maxlength="120"')+field('Category','category','text','maxlength="80"')+field('Selling price ($)','price','number','min="0" max="9999999999.99" step="0.01"')+`<label>Unit cost ($)<input name="unit_cost" type="number" min="0" max="9999999999.99" step="0.01"></label>`+(existing?'':field('Stock quantity','stock','number','min="0" max="2147483647" step="1"')):`<label>Product<select name="product_id" required><option value="">Choose a product</option>${state.data.products.map(p=>`<option value="${p.id}">${esc(p.name)} (${p.stock} in stock)</option>`).join('')}</select></label>`+field('Quantity','quantity','number','min="1" max="2147483647" step="1" value="1"')+field('Unit selling price ($)','unit_price','number','min="0" max="9999999999.99" step="0.01"')+field('Unit cost ($)','unit_cost','number','min="0" max="9999999999.99" step="0.01"')+`<label>Channel<select name="channel">${['WhatsApp','Instagram','Messenger','Website'].map(x=>`<option ${state.page==='inbox'&&state.data.conversations.find(c=>c.id===state.selected)?.channel===x?'selected':''}>${x}</option>`).join('')}</select></label><label>Status<select name="status">${(state.page==='inbox'?['Paid','Pending','Cancelled','Refunded']:['Paid']).map(x=>`<option>${x}</option>`).join('')}</select></label>`}</div><p class="form-error" role="alert"></p><div class="dialog-actions"><button type="button" id="cancel-dialog">Cancel</button><button class="primary" ${!product&&!state.data.products.length?'disabled':''}>${product?'Save product':'Save order'}</button></div></form>`;
 if(existing)for(const name of ['name','category','price','unit_cost']){
  dialog.querySelector(`[name="${name}"]`).value=existing[name]??'';
 }
 if(!product)dialog.querySelector('[name="product_id"]').onchange=e=>{
  const selected=state.data.products.find(p=>p.id===Number(e.target.value));
  dialog.querySelector('[name="unit_price"]').value=selected?.price??'';
  dialog.querySelector('[name="unit_cost"]').value=selected?.unit_cost??'';
 };
 submitDialog(dialog, payload=>{
  const numbers=product?['price','stock','unit_cost']:['product_id','quantity','unit_price','unit_cost'];
  for(const key of numbers)if(key in payload)payload[key]=payload[key]===''?null:Number(payload[key]);
  if(!product&&state.page==='inbox')payload.conversation_id=state.selected;
  return api(existing?`/api/products/${existing.id}`:product?'/api/products':'/api/orders',{
   method:existing?'PATCH':'POST',body:JSON.stringify(payload)
  });
 }, product?'Product saved':'Order created');
}

function openStock(product){
 const dialog=document.createElement('dialog');
 dialog.className='entry-dialog';
 dialog.innerHTML=stockDialog(product,esc);
 submitDialog(dialog,payload=>api(`/api/products/${product.id}/stock`,{
  method:'POST',body:JSON.stringify({...payload,delta:Number(payload.delta)})
 }), 'Stock updated');
}

function submitDialog(dialog, save, message){
 document.body.append(dialog);
 const close=()=>{dialog.close();dialog.remove();};
 dialog.querySelector('#close-dialog').onclick=close;
 dialog.querySelector('#cancel-dialog').onclick=close;
 dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
 dialog.querySelector('form').onsubmit=async e=>{
  e.preventDefault();
  const form=e.currentTarget;
  const button=form.querySelector('button.primary');
  button.disabled=true;
  try{await save(Object.fromEntries(new FormData(form)));close();}
  catch(error){form.querySelector('.form-error').textContent=error.message;button.disabled=false;return;}
  await refreshBusiness(message);
 };
 dialog.showModal();
}

async function refreshBusiness(message){
 try{state.data=await api('/api/overview');render();toast(message);}
 catch(error){toast('Saved. Refresh the workspace to see the update.');}
}

function bindBusinessProfile(){
 $('#business-year').onchange=e=>{
  if(!e.target.value||!e.target.checkValidity())return;
  state.businessYear=e.target.value;
  state.businessPeriod=e.target.value;
  render();
 };
 $('#business-period').onchange=e=>{state.businessPeriod=e.target.value;render();};
 const target=$('#business-target');
 const syncAmount=()=>{target.elements.amount.value=state.data.targets?.find(t=>t.period===target.elements.period.value)?.amount??'';};
 target.elements.period.onchange=syncAmount;
 syncAmount();
 for(const [form, url, method, message] of [
  [target,'/api/targets','PUT','Target saved'],
  [$('#business-expense'),'/api/expenses','POST','Expense recorded']
 ]){
  form.onsubmit=async e=>{
   e.preventDefault();
   const button=form.querySelector('button');
   button.disabled=true;
   const payload=Object.fromEntries(new FormData(form));
   payload.amount=Number(payload.amount);
   try{await api(url,{method,body:JSON.stringify(payload)});}
   catch(error){form.querySelector('.form-error').textContent=error.message;button.disabled=false;return;}
   if(form===target)state.businessPeriod=payload.period;
   else if(!isInPeriod(payload.date,state.businessPeriod)){state.businessYear=payload.date.slice(0,4);state.businessPeriod=payload.date.slice(0,7);}
   await refreshBusiness(message);
  };
 }
 document.querySelectorAll('[data-delete-expense]').forEach(button=>{
  button.onclick=async()=>{
   if(!confirm('Delete this expense from the financial report?'))return;
   button.disabled=true;
   try{await api(`/api/expenses/${button.dataset.deleteExpense}`,{method:'DELETE'});}
   catch(error){toast(error.message);button.disabled=false;return;}
   await refreshBusiness('Expense deleted');
  };
 });
}

async function confirmPayment(id){const value=prompt('Confirm only after receiving payment. Enter unit cost ($) for profit reporting:',state.data.products.find(p=>p.id===state.data.orders.find(o=>o.id===id)?.product_id)?.unit_cost??'');if(value===null||!value.trim())return;const unit_cost=Number(value);if(!Number.isFinite(unit_cost)||unit_cost<0)return toast('Enter a valid unit cost.');try{await api(`/api/orders/${id}/confirm`,{method:'POST',body:JSON.stringify({unit_cost})});state.data=await api('/api/overview');await inbox();toast('Payment confirmed and stock updated');}catch(e){toast(e.message);}}
async function boot(){try{if(preview&&!sessionStorage.getItem('relay-demo-session'))return auth(true);if(!preview){const session=await api('/api/auth/session');if(!session.signedIn)return auth(session.configured,session.recoveryEnabled,session.ownerSetupFromHost);}state.data=await api('/api/overview');render();}catch(e){$('#app').innerHTML='<main><h1>Unable to load your workspace</h1><p>Check that the backend is running, then refresh.</p></main>';}}
await boot();
