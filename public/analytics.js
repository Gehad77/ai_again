export function analyze(data,{days=0,channel='All channels',now=new Date()}={}){
 const windowStart=now.getTime()-days*86400000;
 const orders=(data.orders||[]).filter(order=>{
  if(channel!=='All channels'&&order.channel!==channel)return false;
  if(!days)return true;
  const date=new Date(order.status==='Paid'?(order.paid_at??order.date):order.date);
  return date>=windowStart&&date<=now;
 });
 const paid=orders.filter(o=>o.status==='Paid');
 const products=data.products.map(p=>{const sales=paid.filter(o=>o.product_id===p.id);const units=sales.reduce((s,o)=>s+o.quantity,0);const revenue=sales.reduce((s,o)=>s+o.quantity*o.unit_price,0);const cost=sales.reduce((s,o)=>s+o.quantity*o.unit_cost,0);const inquiries=data.conversations.filter(c=>c.product===p.name&&(channel==='All channels'||c.channel===channel));return {...p,units,revenue,profit:revenue-cost,inquiries:inquiries.length,priceConcerns:inquiries.filter(c=>c.intent==='Price concern').length,inactive:inquiries.filter(c=>c.status==='Inactive').length,sellThrough:units+p.stock?100*units/(units+p.stock):0};});
 const revenue=products.reduce((s,p)=>s+p.revenue,0);return {orders,paid,products,revenue,profit:products.reduce((s,p)=>s+p.profit,0),units:products.reduce((s,p)=>s+p.units,0),stock:products.reduce((s,p)=>s+p.stock,0),stockValue:products.reduce((s,p)=>s+p.stock*p.price,0),lowStock:products.filter(p=>p.stock<=(data.settings?.low_stock_threshold??10)),averageOrder:paid.length?revenue/paid.length:0,pending:orders.filter(o=>o.status==='Pending').length,refunded:orders.filter(o=>o.status==='Refunded').length,cancelled:orders.filter(o=>o.status==='Cancelled').length};
}
