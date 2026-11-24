import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {analyze} from '../public/analytics.js';
const data=JSON.parse(readFileSync(new URL('../public/demo-data.json',import.meta.url))).overview;
test('paid sales reconcile to ledger and inventory remains independent',()=>{const a=analyze(data);assert.equal(a.units,17);assert.equal(a.revenue,933);assert.equal(a.profit,417);assert.equal(a.stock,105);assert.equal(a.paid.length,5);assert.equal(a.pending,1);assert.equal(a.refunded,1);assert.equal(a.cancelled,1);assert.deepEqual(a.lowStock.map(p=>p.name),['Desk Lamp']);assert.equal(a.products[0].units,6);const changed=structuredClone(data);changed.conversations[0].status='Converted';assert.equal(analyze(changed).revenue,a.revenue);});
test('period and channel filters affect sales but not current stock',()=>{const a=analyze(data,{days:7,channel:'WhatsApp',now:new Date('2026-11-13T12:00:00Z')});assert.equal(a.units,7);assert.equal(a.revenue,447);assert.equal(a.stock,105);assert.equal(a.products[0].inquiries,2);assert.equal(a.products[1].inquiries,1);});
test('empty sales have zero averages and no invalid numbers',()=>{const a=analyze({...data,orders:[]});assert.equal(a.averageOrder,0);assert.equal(a.revenue,0);assert.equal(a.stock,105);});

test('a paid order uses payment date for sales-period analytics',()=>{
  const data={products:[{id:1,name:'Shirt',price:100,stock:4}],conversations:[],
    orders:[{product_id:1,quantity:2,unit_price:100,unit_cost:60,status:'Paid',channel:'Website',
      date:'2026-10-28T10:00:00Z',paid_at:'2026-11-22T10:00:00Z'}]};
  const report=analyze(data,{days:7,now:new Date('2026-11-24T10:00:00Z')});
  assert.equal(report.revenue,200);
  assert.equal(report.profit,80);
});

test('low-stock analytics applies per-product alerts with workspace fallback',()=>{
 const common={price:20,stock:8};
 const report=analyze({products:[
  {...common,id:1,stock_alert_threshold:12},
  {...common,id:2,stock_alert_threshold:0},
  {...common,id:3,stock_alert_threshold:null},
  {...common,id:4,stock:0,stock_alert_threshold:0}
 ],conversations:[],orders:[],settings:{low_stock_threshold:10}});
 assert.deepEqual(report.lowStock.map(product=>product.id),[1,3,4]);
});
