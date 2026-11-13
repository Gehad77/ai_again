import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {analyze} from '../public/analytics.js';
const data=JSON.parse(readFileSync(new URL('../public/demo-data.json',import.meta.url))).overview;
test('paid sales reconcile to ledger and inventory remains independent',()=>{const a=analyze(data);assert.equal(a.units,17);assert.equal(a.revenue,933);assert.equal(a.profit,417);assert.equal(a.stock,105);assert.equal(a.paid.length,5);assert.equal(a.pending,1);assert.equal(a.refunded,1);assert.equal(a.cancelled,1);assert.deepEqual(a.lowStock.map(p=>p.name),['Desk Lamp']);assert.equal(a.products[0].units,6);const changed=structuredClone(data);changed.conversations[0].status='Converted';assert.equal(analyze(changed).revenue,a.revenue);});
test('period and channel filters affect sales but not current stock',()=>{const a=analyze(data,{days:7,channel:'WhatsApp',now:new Date('2026-11-13T12:00:00Z')});assert.equal(a.units,7);assert.equal(a.revenue,447);assert.equal(a.stock,105);assert.equal(a.products[0].inquiries,2);assert.equal(a.products[1].inquiries,1);});
test('empty sales have zero averages and no invalid numbers',()=>{const a=analyze({...data,orders:[]});assert.equal(a.averageOrder,0);assert.equal(a.revenue,0);assert.equal(a.stock,105);});
