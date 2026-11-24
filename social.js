import {createHmac, timingSafeEqual} from 'node:crypto';
import {pool} from './db.js';

export const socialConfigured=()=>Boolean(process.env.META_APP_SECRET&&process.env.META_VERIFY_TOKEN);
const items=value=>Array.isArray(value)?value:[];
const id=value=>typeof value==='string'&&/^[A-Za-z0-9_:.=-]{1,300}$/.test(value);

function messages(payload){
 const result=[];
 for(const entry of items(payload?.entry)){
  if(payload.object==='whatsapp_business_account'){
   for(const change of items(entry?.changes)){
    if(change?.field!=='messages')continue;
    const account=change.value?.metadata?.phone_number_id;
    for(const message of items(change.value?.messages)){
     if(message?.type==='text')result.push(['WhatsApp',account,message.from,message.id,message.text?.body]);
    }
   }
  }else if(payload.object==='page'||payload.object==='instagram'){
   const channel=payload.object==='page'?'Messenger':'Instagram';
   for(const event of items(entry?.messaging)){
    if(event?.message?.is_echo||!event?.message)continue;
    result.push([channel,entry.id,event.sender?.id,event.message.mid,event.message.text]);
   }
  }
 }
 return result.filter(([,account,sender,mid,text])=>[account,sender,mid].every(id)&&typeof text==='string'&&text.trim());
}

export async function socialWebhook(req,res,url,json){
 if(!socialConfigured())return json(res,503,{error:'Meta webhooks are not configured.'});
 if(req.method==='GET'){
  const token=url.searchParams.get('hub.verify_token')??'';
  const expected=process.env.META_VERIFY_TOKEN;
  const challenge=url.searchParams.get('hub.challenge')??'';
  if(url.searchParams.get('hub.mode')!=='subscribe'||token!==expected||!/^\d{1,64}$/.test(challenge))return json(res,403,{error:'Verification failed.'});
  res.writeHead(200,{'Content-Type':'text/plain'});
  return res.end(challenge);
 }
 if(req.method!=='POST')return json(res,405,{error:'Method not allowed.'});
 const chunks=[];
 let size=0;
 for await(const chunk of req){
  size+=chunk.length;
  if(size>1048576)return json(res,413,{error:'Payload too large.'});
  chunks.push(chunk);
 }
 const raw=Buffer.concat(chunks);
 const signature=req.headers['x-hub-signature-256'];
 const expected=createHmac('sha256',process.env.META_APP_SECRET).update(raw).digest();
 if(typeof signature!=='string'||!/^sha256=[a-f0-9]{64}$/.test(signature)||
    !timingSafeEqual(expected,Buffer.from(signature.slice(7),'hex')))return json(res,403,{error:'Invalid signature.'});
 let payload;
 try{payload=JSON.parse(raw);}catch{return json(res,400,{error:'Invalid JSON.'});}
 const events=messages(payload);
 if(!events.length)return json(res,200,{ok:true});
 const client=await pool.connect();
 try{
  await client.query('BEGIN');
  // Serialize deliveries so simultaneous first messages share one conversation.
  await client.query('LOCK TABLE social_threads IN SHARE ROW EXCLUSIVE MODE');
  for(const [channel,account,sender,mid,text] of events){
   const seen=await client.query('INSERT INTO social_deliveries VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[channel,account,mid]);
   if(!seen.rowCount)continue;
   let thread=(await client.query('SELECT conversation_id FROM social_threads WHERE channel=$1 AND account=$2 AND sender=$3',[channel,account,sender])).rows[0];
   if(!thread){
    const created=await client.query(`INSERT INTO conversations VALUES(nextval('conversation_ids'),$1,$2,$3,'','Needs reply','New message','#e5eee6') RETURNING id`,
      [channel+' · '+sender.slice(-12),channel.slice(0,2).toUpperCase(),channel]);
    thread={conversation_id:created.rows[0].id};
    await client.query('INSERT INTO social_threads VALUES($1,$2,$3,$4)',[channel,account,sender,thread.conversation_id]);
   }
   await client.query("INSERT INTO messages(conversation_id,role,body) VALUES($1,'customer',$2)",[thread.conversation_id,text.replaceAll('\u0000','').slice(0,4000)]);
   await client.query("UPDATE conversations SET status='Needs reply' WHERE id=$1",[thread.conversation_id]);
  }
  await client.query('COMMIT');
  return json(res,200,{ok:true});
 }catch(error){await client.query('ROLLBACK');throw error;}
 finally{client.release();}
}
