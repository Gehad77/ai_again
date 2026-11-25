import { contextGuide, guidePage } from './guide.js';
import { currency, formatMoney, language, localize, locale, setCurrency, setLanguage, translate } from './i18n.js';
import { businessDate, currencies, defaultReportPeriod, expenseCategoryName, financeCsv, financials, isIncomeTaxCategory, isInPeriod, isLowStock, reviewExpenses, stockAlertThreshold, timeZones } from './business-model.js';
import { bindPricingCalculator, bindSalesTargets, bindWarehouseFilters, businessProfile, cashPage, expensePage, pricingPage, stockDialog, taxPage, todayActions, warehousePage, warehouseSummary } from './business-view.js';
import { analyze } from './analytics.js';
const workspacePath=location.pathname.match(/^\/w\/[^/]+/)?.[0]??'';
const staticSite=location.hostname.endsWith('github.io');
const icons={overview:'◫',inbox:'▤',customers:'♧',products:'◇',profile:'▧',expenses:'▤',orders:'▤',cash:'↔',pricing:'≈',warehouse:'▧',analytics:'▥',integrations:'⌘',insights:'▥',taxes:'◇',guide:'?',settings:'⚙'};
let state={page:location.hash==='#expenses'||location.hash==='#business-expense'?'expenses':['#settings','#taxes','#guide','#pricing','#warehouse','#cash','#orders'].includes(location.hash)?location.hash.slice(1):location.hash==='#business-warehouse'?'warehouse':['#profile','#business-target'].includes(location.hash)?'profile':'overview',filter:'All channels',search:'',selected:1,data:null,businessYear:businessDate().slice(0,4),businessPeriod:businessDate().slice(0,7)};
const $=s=>document.querySelector(s);const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const api=async(url,options)=>{const r=await fetch(workspacePath+url,options);const d=await r.json();if(!r.ok)throw Error(d.error);return d;};
const toast=t=>{$('#toast').textContent=translate(t);$('#toast').classList.add('show');setTimeout(()=>$('#toast').classList.remove('show'),3000);};
const channel=c=>`<span class="channel ${c.toLowerCase()}">${c==='WhatsApp'?'◉':c==='Instagram'?'◎':'ϟ'}</span>`;
const badge=s=>`<span class="badge ${s==='High intent'||s==='Converted'||s==='Purchased'?'green':s==='Needs reply'||s==='Price concern'?'amber':'gray'}">${esc(s)}</span>`;
const filtered=()=>state.data.conversations.filter(c=>(state.filter==='All channels'||c.channel===state.filter)&&`${c.name} ${c.product}`.toLowerCase().includes(state.search.toLowerCase()));
function table(){return `<div class="table-wrap"><table><thead><tr><th>Customer</th><th>Channel</th><th>Product interest</th><th>Buying signal</th><th>Status</th><th></th></tr></thead><tbody>${filtered().map(c=>`<tr data-chat="${c.id}" tabindex="0"><td><div class="person"><span class="avatar" style="background:${c.color}">${esc(c.initials)}</span><span><b data-user-content>${esc(c.name)}</b><small></small></span></div></td><td>${channel(c.channel)} ${c.channel}</td><td>${esc(c.product)}</td><td>${badge(c.intent)}</td><td><span class="dot ${c.status==='AI handling'?'purple':''}"></span>${c.status}</td><td>↗</td></tr>`).join('')||'<tr><td colspan="6">No conversations match your search.</td></tr>'}</tbody></table></div>`;}
function filters(){return `<div class="filters"><div class="tabs">${['All channels','WhatsApp','Instagram','Messenger','Website'].map(x=>`<button class="${state.filter===x?'active':''}" data-filter="${x}">${x==='All channels'?'':channel(x)}${x}</button>`).join('')}</div><input id="search" placeholder="⌕ Search conversations" value="${esc(state.search)}" aria-label="Search conversations"></div>`;}
function overview(){return `<div class="heading"><h1>Business overview</h1></div><div class="top-actions">${state.data.products.length?'<button class="primary" data-create="order">Record sale</button>':''}<button ${state.data.products.length?'':'class="primary"'} data-create="product">+ Add product</button><button data-go="expenses" data-jump="business-expense">Record expense</button><button data-go="inbox">View inbox ↗</button><button id="export">↗ Export report</button></div>${todayActions(state.data)}<div class="metrics">${[['Total conversations',String(state.data.conversations.length),'Social and account history','↗','mint'],['Interested customers',String(state.data.conversations.filter(c=>c.intent==='High intent').length),'Customers showing high buying intent','♧','lavender'],['Paid orders',String((state.data.orders||[]).filter(o=>o.status==='Paid').length),'Confirmed order records','▣','peach'],['Needs your attention',String(state.data.conversations.filter(c=>c.status==='Needs reply').length),'Conversations waiting for a reply','◷','yellow']].map(([label,n,sub,icon,color])=>`<article class="metric"><div>${label}<span class="metric-icon ${color}">${icon}</span></div><strong>${n}</strong><small>${sub}</small></article>`).join('')}</div>${warehouseSummary(state.data,esc)}<section class="card recent"><div class="card-head"><div><h2>Recent conversations</h2></div><button data-go="inbox">View inbox ↗</button></div>${filters()}${table()}</section>`;}
function products(){return `<div class="heading"><div class="eyebrow">YOUR CATALOG</div><h1>Product catalog</h1><p></p></div><button class="primary create-action" data-create="product">+ Add product</button><div class="product-grid">${state.data.products.map(p=>`<article class="card product"><div class="product-art" style="background:${p.color}">${p.emoji}</div><small>${esc(p.category)}</small><h2>${esc(p.name)}</h2><div class="product-bottom"><strong>$${p.price.toFixed(2)}</strong>${badge(p.stock<10?'Low stock':p.stock+' in stock')}</div><p>${state.data.conversations.filter(c=>c.product===p.name).length} customer inquiries · ${(state.data.orders||[]).filter(o=>o.product_id===p.id&&o.status==='Paid').reduce((s,o)=>s+o.quantity,0)} units sold</p><button data-edit-product="${p.id}">Edit product</button></article>`).join('')}</div>`;}
function customers(){return `<div class="heading"><div class="eyebrow">PEOPLE, NOT JUST LEADS</div><h1>Meet your customers.</h1><p>Website customer accounts and conversation activity.</p></div><section class="card recent" id="customer-accounts"></section><section class="card">${filters()}${table()}</section>`;}
const money=formatMoney;
function analytics(){const a=analyze(state.data,{days:state.analyticsDays||0,channel:state.analyticsChannel||'All channels'});const total=a.orders.length;return `<div class="heading"><div class="eyebrow">SALES & INVENTORY INTELLIGENCE</div><h1>Know what sells. Know what’s left.</h1><p>Sales totals use paid orders only. Stock shows current inventory across all channels.</p></div><button class="primary create-action" data-go="inbox">Create orders from inbox ↗</button><div class="analytics-toolbar"><div><label>Sales period <select id="analytics-period"><option value="0">All time</option><option value="7" ${state.analyticsDays===7?'selected':''}>Last 7 days</option><option value="30" ${state.analyticsDays===30?'selected':''}>Last 30 days</option></select></label><label>Channel <select id="analytics-channel">${['All channels','WhatsApp','Instagram','Messenger','Website'].map(c=>`<option ${c===state.analyticsChannel?'selected':''}>${c}</option>`).join('')}</select></label></div><button id="analytics-export">Download product report ↓</button></div><div class="metrics">${[['Units sold',a.units,'Paid quantities in the selected period'],['Products left',a.stock,'Current units available in the store'],['Sales revenue',money(a.revenue),'Paid item totals · excludes tax and shipping'],['Gross profit',money(a.profit),'Revenue minus recorded product costs'],['Paid orders',a.paid.length,'Order records, not chat status'],['Average order',money(a.averageOrder),'Paid revenue divided by paid orders'],['Stock retail value',money(a.stockValue),'Current stock × catalog selling price'],['Low-stock products',a.lowStock.length,'At or below the configured stock threshold']].map(([label,n,sub])=>`<article class="metric"><div>${label}</div><strong>${n}</strong><small>${sub}</small></article>`).join('')}</div><section class="card recent"><div class="card-head"><div><h2>Product performance & stock</h2><p>Inquiries cover all conversation history for the selected channel; sales follow the selected period.</p></div></div><div class="table-wrap"><table><thead><tr><th>Product</th><th>Price</th><th>Stock left</th><th>Units sold</th><th>Revenue</th><th>Gross profit</th><th>Inquiries</th><th>Inactive chats</th><th>Price concerns</th></tr></thead><tbody>${a.products.map(p=>`<tr><td><b>${esc(p.name)}</b><small>${esc(p.category)}</small></td><td>${money(p.price)}</td><td>${badge(p.stock+' left')}${isLowStock(p,state.data.settings)?' <span class="badge amber">Restock</span>':''}</td><td>${p.units}</td><td>${money(p.revenue)}</td><td>${money(p.profit)}</td><td>${p.inquiries}</td><td>${p.inactive}</td><td>${p.priceConcerns}</td></tr>`).join('')}</tbody></table></div></section><div class="chart-grid analytics-section"><section class="card"><div class="card-head"><div><h2>Sales by channel</h2><p>Paid order revenue in your selected filters</p></div></div>${['WhatsApp','Instagram','Messenger','Website'].map(c=>{const os=a.paid.filter(o=>o.channel===c);const r=os.reduce((s,o)=>s+o.quantity*o.unit_price,0);return `<div class="demand"><span>${channel(c)}${c}<small>${os.length} paid orders</small></span><div><i style="width:${a.revenue?r/a.revenue*100:0}%"></i></div><b>${money(r)}</b></div>`;}).join('')}</section><section class="card"><div class="card-head"><div><h2>Inventory watchlist</h2><p>Current inventory · all channels</p></div></div>${a.lowStock.length?a.lowStock.map(p=>`<div class="stock-alert"><span class="insight-icon peach">!</span><div><b>${esc(p.name)}</b><p>${p.stock} units left. Review stock before your next promotion.</p></div>${badge('Low stock')}</div>`).join(''):'<p class="stock-alert">All products are above the low-stock threshold.</p>'}<div class="insight-foot">Retail stock value is not inventory cost or realized revenue.</div></section></div><div class="analytics-grid">${[['Pending orders',a.pending,'Awaiting payment; excluded from sales.'],['Refunded orders',a.refunded,'Excluded from paid totals; refund cash flow is not modeled.'],['Cancelled orders',a.cancelled,'Excluded from sales and revenue.']].map(([t,n,d])=>`<article class="card analytics-card"><h2>${t}</h2><strong>${n}</strong><p>${d}</p></article>`).join('')}</div><section class="card recent analytics-section"><div class="card-head"><div><h2>Order ledger <span class="count">${total}</span></h2><p>Trace every sales total back to an order record.</p></div></div><div class="table-wrap"><table><thead><tr><th>Order</th><th>Date</th><th>Product</th><th>Channel</th><th>Quantity</th><th>Item total</th><th>Status</th></tr></thead><tbody>${a.orders.map(o=>`<tr><td>#RL-${String(o.id).padStart(4,'0')}</td><td>${esc(businessDate(o.paid_at??o.date,state.data.settings?.time_zone))}</td><td>${esc(state.data.products.find(p=>p.id===o.product_id)?.name||'Unknown product')}</td><td>${channel(o.channel)}${o.channel}</td><td>${o.quantity}</td><td>${money(o.quantity*o.unit_price)}</td><td>${badge(o.status)}</td></tr>`).join('')||'<tr><td colspan="7">No orders in the selected period and channel.</td></tr>'}</tbody></table></div></section><div class="notice">Changing a chat to “Converted” does not create an order or reduce stock. Gross profit excludes operating expenses. Inactive chats have an unknown outcome, not a confirmed lost sale.</div>`;}
function integrations(){
 const {socialConfigured, socialActivity=[],aiConfigured,replyChannels=[]}=state.data;
 return `<div class="heading"><h1>Social accounts</h1><p>Text messages appear in the inbox after the Meta account is connected.</p></div>
 <div class="analytics-grid">${['WhatsApp','Instagram','Messenger'].map(c=>{
 const activity=socialActivity.find(row=>row.channel===c);
 return `<article class="card integration">${channel(c)}<h2>${c}</h2>
 ${badge(!socialConfigured?'Setup required':activity?'Receiving messages':'Waiting for first message')} ${badge(replyChannels.includes(c)?'AI replies enabled':'AI replies disabled')}
 <dl><dt>Text messages</dt><dd>${activity?.messages??0}</dd><dt>Conversation threads</dt><dd>${activity?.conversations??0}</dd></dl></article>`;
 }).join('')}<article class="card integration"><h2>Website</h2>${badge(aiConfigured?'AI replies enabled':'AI replies disabled')}
 <dl><dt>Conversation threads</dt><dd>${state.data.conversations.filter(c=>c.channel==='Website').length}</dd></dl>
 <a href="${workspacePath?workspacePath+'/shop':'/chat'}" target="_blank" rel="noopener">Open website chat ↗</a><div class="dialog-actions"><button type="button" id="check-ai">Test AI connection</button></div><p id="check-ai-status" role="status"></p></article></div>
 <section class="card settings"><h2>Webhook address</h2>
 <div class="webhook-address"><code id="webhook-address" dir="ltr" data-user-content>${esc(location.origin)}/api/social/webhook</code>
 <button id="copy-webhook" type="button">Copy address</button></div>
 <p>${socialConfigured?'Subscribe your WhatsApp Business, Instagram or Messenger account in the Meta app settings.':'Configure META_APP_SECRET and META_VERIFY_TOKEN on the hosting service to enable the webhook.'}</p></section>`;
}
function settings(){
 const prefs=state.data.settings;
 const names=new Intl.DisplayNames([locale()],{type:'currency'});
 const options=[...currencies].sort((a,b)=>names.of(a).localeCompare(names.of(b),locale()));
 return `<div class="heading"><h1>Settings</h1></div><section class="card settings"><h2>Workspace preferences</h2>
 <form id="workspace-form" class="business-form">
 <label>Business name<input name="name" value="${esc(prefs.name)}" maxlength="80" required></label>
 <label>Language<select name="language"><option value="en" ${language==='en'?'selected':''}>English</option><option value="ar" ${language==='ar'?'selected':''}>العربية</option></select></label>
 <label>Currency <select name="currency">${options.map(code=>`<option value="${code}" ${currency===code?'selected':''}>${esc(names.of(code))} (${code})</option>`).join('')}</select></label>
 <label>Report time zone<select name="time_zone">${[...timeZones].map(zone=>`<option ${zone===prefs.time_zone?'selected':''}>${zone}</option>`).join('')}</select></label>
 <label>Default report period<select name="default_period">${[['month','Monthly'],['quarter','Quarterly'],['year','Yearly']].map(([id,label])=>`<option value="${id}" ${id===prefs.default_period?'selected':''}>${label}</option>`).join('')}</select></label>
 <label>Low-stock alert threshold<input name="low_stock_threshold" type="number" value="${prefs.low_stock_threshold}" min="0" max="2147483647" step="1" required></label>
 <p id="currency-change-note" hidden><label><span><input name="confirm" type="checkbox"> I confirm the currency applies to existing records.</span></label>
 <small>Existing amounts retain their numbers and are shown in the selected currency. No exchange-rate conversion is applied.</small></p>
 <button class="primary">Save settings</button><p role="alert" class="form-error"></p></form></section>
 ${workspacePath==='/w/men-el-chat-demo'&&!state.data.products.length?'<section class="card recent settings"><h2>Clothing store demo</h2><p>Load sample products, inventory, paid orders, expenses, and targets in Egyptian pounds.</p><button type="button" class="primary" id="load-clothing-demo">Load clothing demo</button><p class="form-error" role="alert"></p></section>':''}
 <section class="card recent settings"><h2>Assistant information</h2>
 <p>Add shipping, payments, returns and approved answers for this store. Use public business information only.</p>
 <form id="assistant-settings" class="business-form"><label>Store policies<textarea name="notes" maxlength="5000" rows="6">${esc(prefs.assistant_notes??'')}</textarea></label>
 <button type="submit" class="primary">Save assistant information</button><p class="form-error" role="alert"></p></form></section>`;
}
const chatChannels=['WhatsApp','Instagram','Messenger','Website'];
const allChatChannels=['All channels',...chatChannels];
const analysisTerms={
 buying:'Buying',pricing:'Pricing',availability:'Availability',delivery:'Delivery',support:'Support',other:'Other',
 new:'New',interested:'Interested',ready:'Ready to buy'
};
const analysisLabel=value=>analysisTerms[value]??value;

function chatAnalysisCard(id,channel){
 const analysis=state.data.chatAnalysis?.find(row=>row.conversation_id===id);
 const job=state.data.chatJobs?.find(row=>row.conversation_id===id);
 const status=!state.data.aiConfigured?'AI chat is off. Check AI_CHAT_ENABLED and OPENAI_API_KEY on the hosting service.':
  job?.state==='failed'?'AI could not complete this reply. Check the hosting logs for the provider error.':
  !state.data.replyChannels?.includes(channel)?'AI replies are unavailable on this channel. Check the connection under Social accounts.':
  ['pending','working'].includes(job?.state)?'Analysis queued':'';
 return `<section class="chat-analysis"><h2>Conversation analysis</h2>
 ${status?`<p>${status}</p>`:''}
 ${analysis?.human_review?`<div class="notice"><strong>Human review required</strong>
 <p data-user-content dir="auto">${esc(analysis.review_reason)}</p>
 ${channel==='Website'?`<form id="human-chat-reply" class="business-form">
 <label>Your reply<textarea name="body" maxlength="4000" required></textarea></label>
 <button type="submit">Send reply</button><p class="form-error" role="alert"></p></form>`:
 '<p>Reply to the customer in the original channel before resuming AI.</p>'}
 <button type="button" id="resume-chat-ai" data-conversation="${id}">Resume AI for new messages</button></div>`:''}
 ${analysis?`<div class="analysis-tags">${badge(analysisLabel(analysis.intent))}${badge(analysisLabel(analysis.stage))}</div>
 <p data-user-content dir="auto">${esc(analysis.summary)}</p>
 ${analysis.themes?.length?`<ul>${analysis.themes.map(theme=>`<li data-user-content dir="auto">${esc(theme)}</li>`).join('')}</ul>`:''}`:'<p>No analysis yet.</p>'}</section>`;
}

function ordersPage(){
 const customers=new Map(state.data.conversations.map(c=>[c.id,c.name]));
 const productsById=new Map(state.data.products.map(p=>[p.id,p.name]));
 const orders=[...state.data.orders].sort((a,b)=>b.id-a.id);
 return `<div class="heading"><h1>Orders</h1><p>Review orders from the storefront and connected conversations.</p></div>
 <div class="top-actions">
 ${workspacePath?`<a href="${workspacePath}/shop" target="_blank" rel="noopener">Open storefront ↗</a>`:''}
 ${state.data.products.length?'<button class="primary" data-create="order">Record sale</button>':''}
 </div>
 <section class="card"><div class="table-wrap"><table><thead><tr><th>Order</th><th>Product</th><th>Customer</th><th>Channel</th><th>Quantity</th><th>Amount</th><th>Status</th><th>Actions</th></tr></thead><tbody>
 ${orders.map(order=>`<tr><td>#${order.id}</td><td data-user-content>${esc(productsById.get(order.product_id)??'—')}</td>
 <td data-user-content>${esc(customers.get(order.conversation_id)??'—')}</td><td>${esc(order.channel)}</td><td>${order.quantity}</td>
 <td>${money(order.unit_price*order.quantity)}</td><td>${badge(order.status)}</td><td>
 ${order.status==='Pending'?`<button type="button" data-confirm-order="${order.id}">Confirm payment</button>`:''}
 ${order.conversation_id?`<button type="button" data-chat="${order.conversation_id}">Open chat</button>`:''}
 </td></tr>`).join('')||'<tr><td colspan="8">No orders yet.</td></tr>'}
 </tbody></table></div></section>`;
}

function customerAnalytics(){
 const rows=state.data.chatAnalysis??[];
 const counts=new Map();
 const topics=new Map();
 for(const row of rows){
  counts.set(row.intent,(counts.get(row.intent)??0)+1);
  const unique=new Set((row.themes??[]).map(theme=>theme.trim().toLowerCase()).filter(Boolean));
  for(const topic of unique)topics.set(topic,(topics.get(topic)??0)+1);
 }
 const topTopics=[...topics].sort((a,b)=>b[1]-a[1]).slice(0,8);
 const byId=new Map(state.data.conversations.map(c=>[c.id,c]));
 return `<div class="heading"><h1>Customer insights</h1><p>Buyer intent and customer needs across the inbox.</p></div>
 <div class="top-actions"><button id="analyze-history" class="primary" ${state.data.aiConfigured?'':'disabled'}>Analyze existing conversations</button>
 <button id="refresh-insights">Refresh insights</button></div>
 ${state.data.aiConfigured?'':'<p class="notice">Configure the AI provider to analyze conversations.</p>'}
 <div class="metrics">${[['Analyzed chats',rows.length],['Ready to buy',rows.filter(row=>row.stage==='ready').length],...counts]
 .map(([label,value])=>`<article class="metric"><div>${esc(analysisLabel(label))}</div><strong>${value}</strong></article>`).join('')}</div>
 ${topTopics.length?`<section class="card recent"><div class="card-head"><h2>Common topics</h2></div>
 <ul class="chat-analysis">${topTopics.map(([topic,count])=>`<li><span data-user-content dir="auto">${esc(topic)}</span> · ${count}</li>`).join('')}</ul></section>`:''}
 <section class="card"><div class="table-wrap"><table><thead><tr><th>Customer</th><th>Channel</th><th>Buyer intent</th><th>Stage</th><th>Summary</th><th></th></tr></thead><tbody>
 ${[...rows].sort((a,b)=>b.updated_at.localeCompare(a.updated_at)).map(row=>{
 const c=byId.get(row.conversation_id);
 if(!c)return '';
 return `<tr><td data-user-content>${esc(c.name)}</td><td>${esc(c.channel)}</td><td>${esc(analysisLabel(row.intent))}</td>
 <td>${esc(analysisLabel(row.stage))}</td><td class="insight-summary" data-user-content dir="auto">${esc(row.summary)}</td>
 <td><button data-chat="${c.id}">Open chat</button></td></tr>`;
 }).join('')||'<tr><td colspan="6">No conversations have been analyzed yet.</td></tr>'}
 </tbody></table></div></section>`;
}

async function inbox(){
 const selectedChannel=state.inboxChannel??'All channels';
 const conversations=state.data.conversations.filter(c=>selectedChannel==='All channels'||c.channel===selectedChannel);
 const c=conversations.find(x=>x.id===state.selected)||conversations[0];
 const shell=`<div class="heading"><h1>Social and website inbox</h1><p>Incoming text messages from connected accounts.</p></div>
 <div class="top-actions"><label>Channel <select id="inbox-channel">${allChatChannels.map(name=>`<option value="${name}" ${name===selectedChannel?'selected':''}>${name}</option>`).join('')}</select></label>
 <button id="refresh-inbox">Refresh inbox</button>
 ${c?'<button class="primary" data-create="order">+ Create order from chat</button>':'<button data-go="integrations">Social accounts</button>'}</div>`;
 const bindControls=()=>{
  $('#inbox-channel').onchange=e=>{state.inboxChannel=e.target.value;void inbox().catch(e=>toast(e.message));};
  $('#refresh-inbox').onclick=()=>refreshInbox(true);
 };
 if(!c){
  $('#page').innerHTML=shell+'<p class="notice">No conversations for this channel.</p>';
  addContextGuide('inbox');
  bindControls();
  return;
 }
 state.selected=c.id;
 const messages=await api(`/api/conversations/${c.id}`);
 if(state.page!=='inbox'||state.selected!==c.id||(state.inboxChannel??'All channels')!==selectedChannel)return;
 $('#page').innerHTML=shell+`<div class="inbox-layout card">
 <aside class="threads" aria-labelledby="threads-title"><h2 id="threads-title">Conversations</h2><div class="thread-list">
 ${conversations.map(x=>`<button data-chat="${x.id}" class="thread ${x.id===c.id?'selected':''}" ${x.id===c.id?'aria-current="true"':''}>
 <span class="avatar" style="background:${x.color}">${esc(x.initials)}</span><span><b data-user-content>${esc(x.name)}</b>
 <small><span>${esc(x.channel)}</span> · <span>${esc(x.status)}</span></small></span></button>`).join('')}</div></aside>
 <div class="chat"><div class="chat-head"><div class="person"><span class="avatar" style="background:${c.color}">${esc(c.initials)}</span>
 <div><b data-user-content>${esc(c.name)}</b><small><span>${esc(c.channel)}</span>${c.product?` · <span data-user-content>${esc(c.product)}</span>`:''}</small></div></div>
 <select id="status" aria-label="Conversation status">${['Needs reply','AI handling','Converted','Inactive'].map(s=>`<option value="${s}" ${s===c.status?'selected':''}>${s}</option>`).join('')}</select></div>
 <div class="messages" aria-label="Conversation"><div class="chat-date">CONVERSATION</div>
 ${messages.map(m=>`<div class="bubble ${m.role==='customer'?'incoming':'outgoing'}">
 <small>${m.role==='customer'?esc(c.name):m.role==='agent'?'You':'AI assistant'}</small>
 <div data-user-content dir="auto">${esc(m.body)}</div></div>`).join('')}</div>
 ${chatAnalysisCard(c.id,c.channel)}
 <div class="inbox-orders">${(state.data.orders??[]).filter(o=>o.conversation_id===c.id).map(o=>`<div>Order #${o.id} · ${o.quantity} · ${money(o.quantity*o.unit_price)} · ${esc(o.status)}
 ${o.status==='Pending'?`<button data-confirm-order="${o.id}" class="primary">Confirm payment</button>`:''}</div>`).join('')}</div></div></div>`;
 if(state.focusThread===c.id){$('.threads [aria-current="true"]').focus({preventScroll:true});state.focusThread=null;}
 addContextGuide('inbox');
 bindControls();
 const humanReply=$('#human-chat-reply');
 if(humanReply)humanReply.onsubmit=async event=>{
  event.preventDefault();
  const button=humanReply.querySelector('button');
  button.disabled=true;
  try{
   await api('/api/conversations/'+c.id+'/messages',{method:'POST',body:JSON.stringify({body:humanReply.elements.body.value})});
   await refreshInbox(true);
   toast('Reply sent');
  }catch(error){humanReply.querySelector('[role=alert]').textContent=error.message;button.disabled=false;}
 };
 const resume=$('#resume-chat-ai');
 if(resume)resume.onclick=async()=>{
  resume.disabled=true;
  try{
   await api('/api/chats/'+resume.dataset.conversation+'/resume-ai',{method:'POST'});
   await refreshInbox(true);
   toast('AI resumed for new messages');
  }catch(error){toast(error.message);resume.disabled=false;}
 };
 $('#status').onchange=async e=>{
  try{await api(`/api/conversations/${c.id}`,{method:'PATCH',body:JSON.stringify({status:e.target.value})});state.data=await api('/api/overview');toast('Conversation updated');}
  catch(e){toast(e.message);}
 };
}
let refreshingInbox=false;
async function refreshInbox(manual=false){
 if(refreshingInbox||state.page!=='inbox'||!state.data)return;
 refreshingInbox=true;
 try{
  const next=await api('/api/overview');
  if(state.page!=='inbox'||!state.data)return;
  const tracked=data=>JSON.stringify([data.conversations,data.orders,data.chatJobs,data.chatAnalysis]);
  if(manual||tracked(next)!==tracked(state.data)){
   state.data=next;
   const active=document.activeElement;
   if(active?.matches('.thread'))state.focusThread=Number(active.dataset.chat);
   await inbox();
  }
 }catch(error){if(manual)toast(error.message);}
 finally{refreshingInbox=false;}
}
const navigationGroups = [
 ['Dashboard', ['overview']],
 ['Store operations', ['products','orders','warehouse','pricing','profile','expenses','cash','taxes','analytics']],
 ['Customer channels', ['inbox','customers','insights','integrations']],
 ['Workspace administration', ['settings','guide']]
];

function navigation(){
 const labels={profile:'Business profile',integrations:'Social accounts',insights:'Customer insights',guide:'Business guide',pricing:'Product pricing',cash:'Cash flow'};
 return navigationGroups.map(([label,pages])=>`<section class="nav-group">
 ${pages[0]==='overview'?'':`<h2>${label}</h2>`}
 ${pages.map(page=>`<button type="button" data-go="${page}" class="nav-item ${state.page===page?'active':''}"
 ${state.page===page?'aria-current="page"':''}><span aria-hidden="true">${icons[page]}</span>${labels[page]??page[0].toUpperCase()+page.slice(1)}</button>`).join('')}
 </section>`).join('');
}

function render(){
 setCurrency(state.data.currency);
 document.title=state.data.workspace+' · Relay';
 $('#app').innerHTML=`
 <aside class="sidebar" id="workspace-sidebar">
  <div class="sidebar-heading">
   <a class="brand" href="./" aria-label="Relay home"><span class="brand-icon">r</span>relay<span class="brand-period">.</span></a>
   <button id="nav-toggle" type="button" aria-controls="workspace-nav" aria-expanded="false">Menu</button>
  </div>
  <div class="workspace"><span class="store-icon" aria-hidden="true">▧</span><b data-user-content>${esc(state.data.workspace)}</b></div>
  <nav id="workspace-nav" aria-label="Workspace navigation">${navigation()}</nav>
 </aside>
 <div class="main">
  <header><div class="page-path"><span class="breadcrumb" data-user-content>${esc(state.data.workspace)}</span><span class="slash">/</span>${state.page[0].toUpperCase()+state.page.slice(1)}</div>
   <div class="header-right">${workspacePath?`<a href="${workspacePath}/shop" target="_blank" rel="noopener">Open storefront ↗</a>`:'<a href="/start-store">Create a store</a>'}<button id="signout">Sign out</button></div></header>
  <main id="page">${state.page==='overview'?overview():state.page==='products'?products():state.page==='orders'?ordersPage():state.page==='profile'?businessProfile(state.data,esc,state.businessYear,state.businessPeriod):state.page==='expenses'?expensePage(state.data,esc,state.businessYear,state.businessPeriod):state.page==='customers'?customers():state.page==='analytics'?analytics():state.page==='integrations'?integrations():state.page==='insights'?customerAnalytics():state.page==='settings'?settings():state.page==='cash'?cashPage(state.data,esc,state.businessYear,state.businessPeriod):state.page==='pricing'?pricingPage(state.data,esc):state.page==='warehouse'?warehousePage(state.data,esc):state.page==='taxes'?taxPage(state.data,esc,state.businessYear,state.businessPeriod):state.page==='guide'?guidePage():''}</main>
 </div>`;
 if(state.page==='inbox')inbox().catch(e=>toast(e.message));
 else addContextGuide(state.page);
 bind();
}
function addContextGuide(page){
 $('#page .heading')?.insertAdjacentHTML('afterend',contextGuide(page));
}

function bind(){
const analyzeHistory=$('#analyze-history');
if(analyzeHistory)analyzeHistory.onclick=async()=>{
 analyzeHistory.disabled=true;
 try{
  await api('/api/chats/analyze',{method:'POST'});
  await refreshBusiness('Analysis queued');
 }catch(error){toast(error.message);analyzeHistory.disabled=false;}
};
const refreshInsights=$('#refresh-insights');
if(refreshInsights)refreshInsights.onclick=()=>refreshBusiness('Insights refreshed');
const navToggle=$('#nav-toggle');
navToggle.onclick=()=>{navToggle.setAttribute('aria-expanded',String(navToggle.getAttribute('aria-expanded')!=='true'));};
const checkAi=$('#check-ai');
if(checkAi)checkAi.onclick=async()=>{
 const status=$('#check-ai-status');
 checkAi.disabled=true;
 status.textContent=translate('Checking OpenAI…');
 try{
  await api('/api/chats/check-ai',{method:'POST'});
  status.textContent=translate('OpenAI returned a test reply.');
 }catch(error){status.textContent=translate(error.message);}
 finally{checkAi.disabled=false;}
};
const copyWebhook=$('#copy-webhook');
if(copyWebhook)copyWebhook.onclick=async()=>{
 const code=$('#webhook-address');
 try{
  await navigator.clipboard.writeText(code.textContent);
  toast('Address copied');
 }catch{
  const selection=window.getSelection();
  const range=document.createRange();
  range.selectNodeContents(code);
  selection.removeAllRanges();
  selection.addRange(range);
  toast('Address selected. Copy it to your clipboard.');
 }
};
$('#workspace-sidebar').onkeydown=event=>{
 if(event.key==='Escape'&&navToggle.getAttribute('aria-expanded')==='true'){
  navToggle.setAttribute('aria-expanded','false');
  navToggle.focus();
 }
};
if(['profile','expenses'].includes(state.page))bindBusinessProfile();
if(state.page==='pricing')bindPricingCalculator(state.data);
if(state.page==='warehouse')bindWarehouseFilters(state.data,esc,state.warehouseFilters??={});
if(state.page==='cash')bindCashFlow();
if(state.page==='taxes'){
 bindReportControls();
 $('[data-download-finance]').onclick=()=>downloadFinanceReport();
 const form=$('#income-tax-form');
 form.onsubmit=async event=>{
  event.preventDefault();
  const button=form.querySelector('button[type=submit]');
  button.disabled=true;
  const raw=form.elements.rate.value;
  try{
   await api('/api/settings/tax',{method:'PUT',body:JSON.stringify({rate:raw===''?null:Number(raw)})});
   await refreshBusiness('Tax rate saved');
  }catch(error){form.querySelector('[role=alert]').textContent=error.message;button.disabled=false;}
 };
}
if(state.page==='customers')loadCustomerAccounts();
if(state.page==='settings'){
 const demo=$('#load-clothing-demo');
 if(demo)demo.onclick=async()=>{
  demo.disabled=true;
  try{
   await api('/api/demo/clothing',{method:'POST',body:'{}'});
   await refreshBusiness('Clothing demo loaded');
  }catch(error){demo.nextElementSibling.textContent=error.message;demo.disabled=false;}
 };
 const assistant=$('#assistant-settings');
 assistant.onsubmit=async event=>{
  event.preventDefault();
  const button=assistant.querySelector('button');
  button.disabled=true;
  try{
   await api('/api/settings/assistant',{method:'PUT',body:JSON.stringify({notes:assistant.elements.notes.value})});
   await refreshBusiness('Assistant information saved');
  }catch(error){assistant.querySelector('[role=alert]').textContent=error.message;button.disabled=false;}
 };
 const form=$('#workspace-form');
 form.elements.currency.onchange=()=>{
  const changed=form.elements.currency.value!==currency;
  $('#currency-change-note').hidden=!changed;
  form.elements.confirm.required=changed;
  if(!changed)form.elements.confirm.checked=false;
 };
 form.onsubmit=async event=>{
  event.preventDefault();
  const button=form.querySelector('button');
  button.disabled=true;
  const fields=Object.fromEntries(new FormData(form));
  fields.low_stock_threshold=Number(fields.low_stock_threshold);
  fields.confirm=form.elements.confirm.checked;
  try{
   await api('/api/settings',{method:'PUT',body:JSON.stringify(fields)});
  }catch(error){form.querySelector('[role=alert]').textContent=error.message;button.disabled=false;return;}
  setLanguage(fields.language);
  if(state.data.settings.default_period!==fields.default_period||state.data.settings.time_zone!==fields.time_zone){
   state.businessPeriod=defaultReportPeriod(fields);
   state.businessYear=state.businessPeriod.slice(0,4);
  }
  await refreshBusiness('Settings saved');
 };
}
$('#signout').onclick=async()=>{try{await api('/api/auth/signout',{method:'POST'});state.data=null;await boot();}catch(e){toast(e.message);}};
if($('#analytics-period'))$('#analytics-period').onchange=e=>{state.analyticsDays=Number(e.target.value);render();};
if($('#analytics-channel'))$('#analytics-channel').onchange=e=>{state.analyticsChannel=e.target.value;render();};
if($('#analytics-export'))$('#analytics-export').onclick=()=>{const a=analyze(state.data,{days:state.analyticsDays||0,channel:state.analyticsChannel||'All channels'});const rows=[['Product','Price','Stock left','Units sold','Revenue','Gross profit','Inquiries','Inactive chats','Price concerns'],...a.products.map(p=>[p.name,p.price,p.stock,p.units,p.revenue,p.profit,p.inquiries,p.inactive,p.priceConcerns])];const csv=rows.map(r=>r.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\n');const link=document.createElement('a');link.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));link.download='relay-product-analysis.csv';link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);};
const s=$('#search');if(s)s.oninput=e=>{state.search=e.target.value;const pos=e.target.selectionStart;render();$('#search').focus();$('#search').setSelectionRange(pos,pos);};if($('#export'))$('#export').onclick=()=>{const csv=['Customer,Channel,Product,Status',...state.data.conversations.map(c=>[c.name,c.channel,c.product,c.status].map(v=>'"'+v.replaceAll('"','""')+'"').join(','))].join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='relay-conversations.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);};}
function focusPage(){
 const heading=$('#page h1');
 if(!heading)return;
 heading.tabIndex=-1;
 heading.focus({preventScroll:true});
 window.scrollTo(0,0);
}
function jumpToSection(id){
 const target=document.getElementById(id);
 if(!target)return;
 target.scrollIntoView({block:'start'});
 target.tabIndex=-1;
 target.focus({preventScroll:true});
}
document.addEventListener('click',e=>{const jump=e.target.closest('[data-section]');if(jump)jumpToSection(jump.dataset.section);const confirmOrder=e.target.closest('[data-confirm-order]');if(confirmOrder)confirmPayment(Number(confirmOrder.dataset.confirmOrder));const create=e.target.closest('[data-create]');if(create)openCreate(create.dataset.create);
const edit=e.target.closest('[data-edit-product]');
if(edit)openCreate('product',state.data.products.find(p=>p.id===Number(edit.dataset.editProduct)));
const stock=e.target.closest('[data-stock-product]');
if(stock)openStock(state.data.products.find(p=>p.id===Number(stock.dataset.stockProduct)));
const restock=e.target.closest('[data-restock-product]');
if(restock)openStock(state.data.products.find(p=>p.id===Number(restock.dataset.restockProduct)),Number(restock.dataset.restockUnits));const go=e.target.closest('[data-go]');const chat=e.target.closest('[data-chat]');const f=e.target.closest('[data-filter]');const connect=e.target.closest('.connect');if(go){e.preventDefault();state.page=go.dataset.go;
if(go.hasAttribute('data-stock-attention'))state.warehouseFilters={...state.warehouseFilters,low:true,query:''};
if(go.hasAttribute('data-open-needs-reply')){
 state.inboxChannel='All channels';
 state.selected=state.data.conversations.find(c=>c.status==='Needs reply')?.id;
}
if(go.hasAttribute('data-month-target')){
 state.businessPeriod=businessDate(undefined,state.data.settings?.time_zone).slice(0,7);
 state.businessYear=state.businessPeriod.slice(0,4);
}history.replaceState(null,'',location.pathname+location.search+(['profile','expenses','settings','taxes','guide','warehouse','pricing','cash','orders'].includes(state.page)?'#'+state.page:''));state.search='';state.filter='All channels';render();if(go.dataset.expenseCategory){
 const category=$('#business-expense').elements.category;
 category.value=go.dataset.expenseCategory;
 category.dispatchEvent(new Event('input'));
}if(go.dataset.jump)jumpToSection(go.dataset.jump);else focusPage();}if(chat){if(!chat.matches('.thread'))state.inboxChannel='All channels';state.page='inbox';if(location.hash==='#profile')history.replaceState(null,'',location.pathname+location.search);state.selected=Number(chat.dataset.chat);state.focusThread=chat.matches('.thread')?state.selected:null;render();}if(f){state.filter=f.dataset.filter;render();}if(connect)toast(`${connect.dataset.channel} requires Meta credentials and webhook setup. No account is connected yet.`);});
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.matches('tr[data-chat]'))e.target.click();});

async function loadCustomerAccounts(){
 const section=$('#customer-accounts');
 const heading='<div class="card-head"><div><h2>Registered customer accounts</h2></div></div>';
 section.innerHTML=heading+'<p class="stock-alert" role="status">Loading accounts…</p>';
 try{
  const accounts=(await api('/api/customers')).customers;
  section.innerHTML=heading+`<div class="table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Registered</th><th>Chat</th></tr></thead><tbody>${
   accounts.map(a=>`<tr><td data-user-content>${esc(a.name)}</td><td data-user-content>${esc(a.email)}</td><td>${a.registered_at?businessDate(a.registered_at,state.data.settings?.time_zone):'Unavailable'}</td><td><button data-account-chat="${a.conversation_id}">Open chat</button></td></tr>`).join('')||
   `<tr><td colspan="4">No website customers have registered yet.</td></tr>`
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

function hostingRecovery(session){
 const instructions={
  missing_settings:'Add OWNER_EMAIL and OWNER_ACCESS_CODE to the Render service and deploy the saved settings.',
  invalid_email:'Set OWNER_EMAIL to a valid email address in Render, then save and deploy.',
  invalid_code:'Set OWNER_ACCESS_CODE to a new code of 32–128 English letters, digits, underscores, or hyphens in Render, then save and deploy.',
  used_code:'This code was used. Sign in with the password you saved, or generate a fresh code in Render and deploy.'
 };
 const notice=instructions[session.adminRecoveryStatus]??'';
 $('#app').innerHTML=`<main class="auth-shell"><section class="card auth-card"><h1>${session.configured?'Reset owner access':'Set up owner access'}</h1>
 <p>Enter the one-time code you set in the hosting environment, then choose a new password.</p>
 ${notice?`<p class="notice" role="status">${notice}</p>`: ''}
 <form id="hosting-recovery"><label>Hosting recovery code<input name="accessCode" type="password" autocomplete="off" minlength="32" maxlength="128" required></label>
 <label>New password<input name="password" type="password" autocomplete="new-password" minlength="12" maxlength="128" required></label>
 <p class="form-error" role="alert"></p><button class="primary" ${notice?'disabled':''}>Save password and open dashboard</button></form>
 <a href="./">Back to owner sign-in</a>
 ${session.recoveryEnabled&&session.configured?'<a href="./?recover=email">Get a code by email</a>':''}</section></main>`;
 $('#hosting-recovery').onsubmit=async event=>{
  event.preventDefault();
  const form=event.currentTarget;
  const button=form.querySelector('button');
  button.disabled=true;
  try{
   await api('/api/auth/recovery/access-code',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(form)))});
  }catch(error){
   form.querySelector('[role="alert"]').textContent=error.message;
   button.disabled=false;
   return;
  }
  history.replaceState(null,'',location.pathname+location.hash);
  await boot();
 };
}

function recoveryAuth(enabled){
 $('#app').innerHTML=`<main class="auth-shell"><section class="card auth-card"><h1>Reset owner password</h1>
 <p>${enabled?'Request an 8-digit code using the email linked to the owner account.':'Email recovery is unavailable until the hosting administrator configures it.'}</p>
 ${enabled?`<form id="recovery-form"><label>Owner email<input name="email" type="email" maxlength="254" required></label>
 <div id="recovery-code" hidden><label>Verification code<input name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{8}" minlength="8" maxlength="8"></label>
 <label>New password<input name="password" type="password" autocomplete="new-password" minlength="12" maxlength="128"></label></div>
 <p class="form-error" role="alert"></p><p role="status"></p><button class="primary">Send code</button>
 <button type="button" id="resend-code" hidden>Request a new code</button></form>`:''}
 <a href="./?recover=hosting">Use a hosting recovery code</a> <a href="./">Back to owner sign-in</a></section></main>`;
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
    history.replaceState(null,'',location.pathname);
    auth(true);
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

function auth(configured, ownerSetupFromHost){
 if(!configured&&ownerSetupFromHost){
  $('#app').innerHTML='<main class="auth-shell"><section class="card auth-card"><a class="brand" href="./">relay.</a><h1>Owner setup required</h1><p>Set an owner password using your one-time hosting code.</p><a href="./?recover=hosting">Set up owner access</a></section></main>';
  return;
 }
 $('#app').innerHTML=`<main class="auth-shell"><section class="card auth-card"><a class="brand" href="./">relay.</a><div class="eyebrow">YOUR SALES, CONNECTED</div><h1>${configured?'Welcome back.':'Create your owner account.'}</h1><p>${configured?'Sign in to manage products, orders, and conversations.':'The first account owns this shared workspace.'}</p>${`<form id="auth-form"><label>Email<input name="email" type="email" autocomplete="username" maxlength="254" required></label><label>Password<input name="password" type="password" autocomplete="${configured?'current-password':'new-password'}" minlength="12" maxlength="128" required></label><small>Use 12–128 characters.</small><p class="form-error" role="alert"></p><button class="primary">${configured?'Sign in':'Create account'}</button></form><p id="auth-notice" role="status"></p>${workspacePath?'<p><a href="./shop">Open storefront ↗</a></p>':'<p><a href="/start-store">Create a store</a></p>'}${configured?'<a href="./?recover=hosting">Forgot password?</a>':''}`}</section></main>`;
 $('#auth-form').onsubmit=async e=>{e.preventDefault();const form=e.currentTarget;const button=form.querySelector('button');button.disabled=true;try{await api(configured?'/api/auth/signin':'/api/auth/setup',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(form)))});await boot();}catch(error){form.querySelector('.form-error').textContent=error.message;}finally{button.disabled=false;}};
}
function openCreate(kind, existing){
 const product=kind==='product';
 const field=(label,name,type='text',extra='')=>`<label>${label}<input name="${name}" type="${type}" ${extra} required></label>`;
 const dialog=document.createElement('dialog');dialog.className='entry-dialog';
 dialog.innerHTML=`<form><div class="dialog-heading"><h2>${product?(existing?'Edit product':'Add product'):'Create order'}</h2><button type="button" id="close-dialog" aria-label="Close">×</button></div><p>${product?'Grow your catalog with a new product.':'Paid orders reduce available stock and record sales revenue.'}</p><div class="form-grid">${product?field('Product name','name','text','maxlength="120"')+field('Category','category','text','maxlength="80"')+field('Selling price ('+currency+')','price','number','min="0" max="9999999999.99" step="0.01"')+`<label>Public product description<textarea name="public_description" maxlength="1000" rows="3"></textarea><small>Describe materials, sizes, colors, and uses. Customers and the AI assistant can see this.</small></label><label>Unit cost (${currency})<input name="unit_cost" type="number" min="0" max="9999999999.99" step="0.01"></label><label>Product stock alert threshold<input name="stock_alert_threshold" type="number" min="0" max="2147483647" step="1" placeholder="${stockAlertThreshold({},state.data.settings)}"><small>Leave blank to use the workspace threshold.</small></label><label>Desired stock<input name="desired_stock" type="number" min="0" max="2147483647" step="1"><small>Used to suggest restock quantities.</small></label>`+(existing?'':field('Stock quantity','stock','number','min="0" max="2147483647" step="1"')):`<label>Product<select name="product_id" required><option value="">Choose a product</option>${state.data.products.map(p=>`<option value="${p.id}">${esc(p.name)} (${p.stock} in stock)</option>`).join('')}</select></label>`+field('Quantity','quantity','number','min="1" max="2147483647" step="1" value="1"')+field('Unit selling price ('+currency+')','unit_price','number','min="0" max="9999999999.99" step="0.01"')+field('Unit cost ('+currency+')','unit_cost','number','min="0" max="9999999999.99" step="0.01"')+`<label>Channel<select name="channel">${['WhatsApp','Instagram','Messenger','Website'].map(x=>`<option ${state.page==='inbox'&&state.data.conversations.find(c=>c.id===state.selected)?.channel===x?'selected':''}>${x}</option>`).join('')}</select></label><label>Status<select name="status">${(state.page==='inbox'?['Paid','Pending','Cancelled','Refunded']:['Paid']).map(x=>`<option>${x}</option>`).join('')}</select></label>`}</div><p class="form-error" role="alert"></p><div class="dialog-actions"><button type="button" id="cancel-dialog">Cancel</button><button class="primary" ${!product&&!state.data.products.length?'disabled':''}>${product?'Save product':'Save order'}</button></div></form>`;
 if(existing)for(const name of ['name','category','price','unit_cost','stock_alert_threshold','desired_stock','public_description']){
  dialog.querySelector(`[name="${name}"]`).value=existing[name]??'';
 }
 if(!product)dialog.querySelector('[name="product_id"]').onchange=e=>{
  const selected=state.data.products.find(p=>p.id===Number(e.target.value));
  dialog.querySelector('[name="unit_price"]').value=selected?.price??'';
  dialog.querySelector('[name="unit_cost"]').value=selected?.unit_cost??'';
 };
 submitDialog(dialog, payload=>{
  const numbers=product?['price','stock','unit_cost','stock_alert_threshold','desired_stock']:['product_id','quantity','unit_price','unit_cost'];
  for(const key of numbers)if(key in payload)payload[key]=payload[key]===''?null:Number(payload[key]);
  if(!product&&state.page==='inbox')payload.conversation_id=state.selected;
  return api(existing?`/api/products/${existing.id}`:product?'/api/products':'/api/orders',{
   method:existing?'PATCH':'POST',body:JSON.stringify(payload)
  });
 }, product?'Product saved':'Order created');
}

function openStock(product, suggestedUnits){
 const dialog=document.createElement('dialog');
 dialog.className='entry-dialog';
 dialog.innerHTML=stockDialog(product,esc);
 if(suggestedUnits)dialog.querySelector('[name="delta"]').value=suggestedUnits;
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

function bindReportControls(){
 $('#business-year').onchange=e=>{
  if(!e.target.value||!e.target.checkValidity())return;
  state.businessYear=e.target.value;
  state.businessPeriod=e.target.value;
  render();
 };
 $('#business-period').onchange=e=>{state.businessPeriod=e.target.value;render();};
}

function bindCashFlow(){
 bindReportControls();
 const form=$('#cash-movement-form');
 form.onsubmit=async event=>{
  event.preventDefault();
  const button=form.querySelector('button');
  button.disabled=true;
  const entry=Object.fromEntries(new FormData(form));
  entry.amount=Number(entry.amount);
  try{
   await api('/api/cash-movements',{method:'POST',body:JSON.stringify(entry)});
   if(!isInPeriod(entry.date,state.businessPeriod)){
    state.businessYear=entry.date.slice(0,4);
    state.businessPeriod=entry.date.slice(0,7);
   }
  }catch(error){form.querySelector('[role=alert]').textContent=error.message;button.disabled=false;return;}
  await refreshBusiness('Cash movement saved');
 };
 document.querySelectorAll('[data-delete-cash]').forEach(button=>{
  button.onclick=async()=>{
   if(!confirm(translate('Delete this cash movement?')))return;
   button.disabled=true;
   try{await api('/api/cash-movements/'+button.dataset.deleteCash,{method:'DELETE'});}
   catch(error){toast(error.message);button.disabled=false;return;}
   await refreshBusiness('Cash movement deleted');
  };
 });
}

function bindBusinessProfile(){
 bindSalesTargets(state.data,state.estimateProduct,id=>{state.estimateProduct=id;});
 bindReportControls();
 const target=$('#business-target');
 const expenseForm=$('#business-expense');
 bindProductGoals();

 if(expenseForm){bindExpenseEditing(expenseForm);bindExpenseFilters();}
 $('[data-download-finance]').onclick=()=>downloadFinanceReport();

 target.elements.period.onchange=()=>{
  state.businessPeriod=target.elements.period.value;
  render();
 };
 for(const [form, url, method, message] of [
  [target,'/api/targets','PUT','Target saved'],
  [expenseForm,'/api/expenses','POST','Expense recorded']
 ]){
  if(!form)continue;
  form.onsubmit=async e=>{
   e.preventDefault();
   const button=form.querySelector('button');
   button.disabled=true;
   const payload=Object.fromEntries(new FormData(form));
   payload.amount=Number(payload.amount);
   if(form===target){
    payload.units=Number(payload.units);
    delete payload.estimate_product;
   }else{
    payload.product_id=payload.product_id?Number(payload.product_id):null;
    payload.included_in_product_cost=form.elements.included_in_product_cost.checked;
   }
   const editing=form===expenseForm?form.dataset.expenseId:null;
   try{await api(editing?url+'/'+editing:url,{method:editing?'PATCH':method,body:JSON.stringify(payload)});}
   catch(error){form.querySelector('.form-error').textContent=error.message;button.disabled=false;return;}
   if(form===target)state.businessPeriod=payload.period;
   else if(!isInPeriod(payload.date,state.businessPeriod)){state.businessYear=payload.date.slice(0,4);state.businessPeriod=payload.date.slice(0,7);}
   await refreshBusiness(editing?'Expense updated':message);
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

function bindProductGoals(){
 const form=$('#product-target-form');
 if(!form)return;
 const select=form.elements.product_id;
 const period=form.elements.period;
 if([...select.options].some(option=>option.value===state.goalProduct))select.value=state.goalProduct;
 const sync=()=>{
  state.goalProduct=select.value;
  form.elements.units.value=(state.data.productTargets??[]).find(goal=>
   goal.period===period.value&&goal.product_id===Number(select.value))?.units??0;
  form.querySelector('[role=alert]').textContent='';
 };
 select.onchange=sync;
 sync();
 period.onchange=()=>{
  state.businessPeriod=period.value;
  render();
  jumpToSection('product-targets');
 };
 form.onsubmit=async event=>{
  event.preventDefault();
  const button=form.querySelector('button');
  button.disabled=true;
  try{
   await api('/api/product-targets',{method:'PUT',body:JSON.stringify({
    product_id:Number(select.value),period:period.value,units:Number(form.elements.units.value)
   })});
   await refreshBusiness('Product target saved');
  }catch(error){form.querySelector('[role=alert]').textContent=error.message;button.disabled=false;}
 };
}

function bindExpenseEditing(form){
 const title=$('#add-expense-title');
 const save=form.querySelector('[type=submit]');
 const cancel=$('#cancel-expense-edit');
 const error=form.querySelector('.form-error');
 const category=form.elements.category;
 const product=form.elements.product_id;
 const included=form.elements.included_in_product_cost;
 const syncTaxFields=()=>{
  const tax=isIncomeTaxCategory(category.value);
  if(tax){product.value='';included.checked=false;}
  product.disabled=tax;
  included.disabled=tax;
  $('#expense-tax-note').hidden=!tax;
  $('#expense-cost-note').hidden=tax;
 };
 category.oninput=syncTaxFields;
 category.onchange=syncTaxFields;
 cancel.onclick=()=>{
  delete form.dataset.expenseId;
  form.reset();
  syncTaxFields();
  title.textContent='Record expense';
  save.textContent='Record expense';
  cancel.hidden=true;
  error.textContent='';
  form.elements.category.focus();
 };
 document.querySelectorAll('[data-edit-expense]').forEach(button=>{
  button.onclick=()=>{
   const entry=state.data.expenses.find(item=>item.id===Number(button.dataset.editExpense));
   form.dataset.expenseId=entry.id;
   for(const name of ['description','amount','date','category','product_id']){
    form.elements[name].value=name==='category'?expenseCategoryName(entry[name]):entry[name]??'';
   }
   included.checked=Boolean(entry.included_in_product_cost);
   syncTaxFields();
   title.textContent='Edit expense';
   save.textContent='Save expense';
   cancel.hidden=false;
   error.textContent='';
   jumpToSection(form.id);
   form.elements.description.focus({preventScroll:true});
  };
 });
}

function bindExpenseFilters(){
 const form=$('#expense-filters');
 const entries=financials(state.data,state.businessPeriod).expenses;
 const rows=[...document.querySelectorAll('[data-expense-row]')];
 const summary=$('#expense-filter-summary');
 const empty=$('#no-matching-expenses');
 for(const [key,value] of Object.entries(state.expenseFilters??{})){
  const field=form.elements[key];
  if(field&&(!field.options||[...field.options].some(option=>option.value===value)))field.value=value;
 }
 const update=()=>{
  state.expenseFilters=Object.fromEntries(new FormData(form));
  const result=reviewExpenses(entries,state.expenseFilters);
  const visible=new Set(result.matching.map(item=>item.id));
  for(const row of rows)row.hidden=!visible.has(Number(row.dataset.expenseRow));
  empty.hidden=visible.size>0;
  summary.textContent=[
   translate('Matching entries')+' '+new Intl.NumberFormat(locale()).format(visible.size),
   translate('Filtered spending')+' '+formatMoney(result.total),
   translate('Deducted from profit')+' '+formatMoney(result.deducted)
  ].join(' · ');
 };
 form.oninput=update;
 form.onchange=update;
 form.onsubmit=event=>event.preventDefault();
 $('#clear-expense-filters').onclick=()=>{
  form.reset();
  update();
  form.elements.query.focus();
 };
 update();
}

function downloadFinanceReport(){
 const period=state.businessPeriod;
 const url=URL.createObjectURL(new Blob([financeCsv(state.data,period)],{type:'text/csv;charset=utf-8'}));
 const link=document.createElement('a');
 link.href=url;
 link.download='relay-finance-'+period+'.csv';
 link.click();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}

async function confirmPayment(id){const value=prompt('Confirm only after receiving payment. Enter unit cost for profit reporting:',state.data.products.find(p=>p.id===state.data.orders.find(o=>o.id===id)?.product_id)?.unit_cost??'');if(value===null||!value.trim())return;const unit_cost=Number(value);if(!Number.isFinite(unit_cost)||unit_cost<0)return toast('Enter a valid unit cost.');try{await api(`/api/orders/${id}/confirm`,{method:'POST',body:JSON.stringify({unit_cost})});if(state.page==='inbox'){state.data=await api('/api/overview');await inbox();toast('Payment confirmed and stock updated');}else await refreshBusiness('Payment confirmed and stock updated');}catch(e){toast(e.message);}}
async function boot(){
 try{
  if(staticSite){
   $('#app').innerHTML='<main class="auth-shell"><section class="card auth-card"><h1>Relay</h1><a href="https://ai-again.onrender.com/">Open live dashboard</a></section></main>';
   return;
  }
  const session=await api('/api/auth/session');
  const recovery=new URLSearchParams(location.search).get('recover');
  if(recovery==='hosting')return hostingRecovery(session);
  if(recovery==='email')return recoveryAuth(session.recoveryEnabled);
  if(!session.signedIn)return auth(session.configured,session.ownerSetupFromHost);
  state.data=await api('/api/overview');
  if(state.data.settings.language)setLanguage(state.data.settings.language);
  state.businessPeriod=defaultReportPeriod(state.data.settings);
  state.businessYear=state.businessPeriod.slice(0,4);
  render();
 }catch(e){$('#app').innerHTML='<main><h1>Unable to load your workspace</h1><p>Check that the backend is running, then refresh.</p></main>';}
}
setLanguage(language);
new MutationObserver(records=>{
 for(const record of records)for(const node of record.addedNodes)localize(node);
}).observe(document.body,{childList:true,subtree:true});
await boot();

setInterval(()=>{if(!document.hidden&&state.page==='inbox'&&!document.activeElement?.matches('select,textarea,input'))void refreshInbox();},8000);
