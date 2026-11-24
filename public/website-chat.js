import { language, localize, setLanguage, translate } from './i18n.js';

const workspacePath=location.pathname.match(/^\/w\/[^/]+/)?.[0]??'';
const root=document.querySelector('#website-chat');
let timer;
let customer;
const escape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

async function request(path,payload){
 const response=await fetch(workspacePath+'/api/website/'+path,payload===undefined?undefined:{
  method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)
 });
 const data=await response.json();
 if(!response.ok)throw Error(data.error??'Unable to connect');
 return data;
}

function auth(signup){
 clearInterval(timer);
 root.innerHTML=`<section class="card auth-card"><h1>${signup?'Start a chat':'Sign in to chat'}</h1>
 <p>Messages are stored and may be processed by an AI assistant.</p>
 <form>${signup?'<label>Name<input name="name" autocomplete="name" maxlength="80" required></label>':''}
 <label>Email<input name="email" type="email" autocomplete="username" maxlength="254" required></label>
 <label>Password<input name="password" type="password" autocomplete="${signup?'new-password':'current-password'}" minlength="12" maxlength="128" required></label>
 <p class="form-error" role="alert"></p><button class="primary">${signup?'Create chat account':'Sign in'}</button></form>
 <button id="chat-account-mode" type="button">${signup?'Already registered? Sign in':'Create chat account'}</button></section>`;
 root.querySelector('#chat-account-mode').onclick=()=>auth(!signup);
 const form=root.querySelector('form');
 form.onsubmit=async event=>{
  event.preventDefault();
  const button=form.querySelector('button');
  button.disabled=true;
  try{await request(signup?'signup':'signin',Object.fromEntries(new FormData(form)));await boot();}
  catch(error){form.querySelector('[role=alert]').textContent=translate(error.message);}
  finally{button.disabled=false;}
 };
 localize(root);
}

async function chat(){
 root.innerHTML=`<header class="shop-header"><h1>Chat with the store</h1><button id="leave-chat" type="button">Sign out</button></header>
 <section class="card shop-chat">
 <div class="messages" id="website-messages" aria-live="polite"></div>
 <form id="customer-reply"><label for="website-text">Your message</label>
 <textarea id="website-text" name="body" maxlength="4000" required></textarea>
 <p class="form-error" role="alert"></p><button class="primary">Send message</button></form></section>`;
 let previous='';
 const messages=root.querySelector('#website-messages');
 const form=root.querySelector('form');
 async function refresh(){
  try{
   const data=await request('chat');
   if(!messages.isConnected)return;
   const current=JSON.stringify(data.messages);
   if(current===previous)return;
   previous=current;
   messages.innerHTML=data.messages.map(message=>`<div class="bubble ${message.role==='customer'?'outgoing':'incoming'}">
    <small>${message.role==='customer'?'You':message.role==='assistant'?'AI assistant':'Store team'}</small>
    <div dir="auto" data-user-content>${escape(message.body)}</div></div>`).join('');
   localize(messages);
   messages.scrollTop=messages.scrollHeight;
  }catch(error){form.querySelector('[role=alert]').textContent=translate(error.message);}
 }
 root.querySelector('#leave-chat').onclick=async()=>{
  try{await request('signout',{});customer=null;auth(false);}
  catch(error){form.querySelector('[role=alert]').textContent=translate(error.message);}
 };
 form.onsubmit=async event=>{
  event.preventDefault();
  const button=form.querySelector('button');
  button.disabled=true;
  try{await request('chat',{body:form.elements.body.value});form.reset();form.querySelector('[role=alert]').textContent='';await refresh();}
  catch(error){form.querySelector('[role=alert]').textContent=translate(error.message);}
  finally{button.disabled=false;}
 };
 localize(root);
 clearInterval(timer);
 await refresh();
 timer=setInterval(refresh,4000);
}

async function boot(){
 try{
  customer=(await request('session')).customer;
  if(customer)await chat();else auth(false);
 }catch{root.innerHTML='<h1>Unable to connect</h1>';localize(root);}
}
setLanguage(language);
await boot();
