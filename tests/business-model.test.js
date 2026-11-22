import { test } from 'node:test';
import assert from 'node:assert/strict';
import { financials } from '../public/business-model.js';

test('financial reports use Cairo payment dates and count costs and expenses once', () => {
  const sale = {quantity:2, unit_price:10, unit_cost:3, status:'Paid', date:'2026-06-30T18:00:00Z'};
  const data = {
    orders: [
      sale,
      {...sale, paid_at:'2026-06-30T22:00:00Z'},
      {...sale, status:'Pending'},
      {...sale, status:'Refunded'}
    ],
    expenses:[{date:'2026-07-01', amount:15}],
    movements:[{kind:'writeoff', delta:-2, unit_cost:3, date:'2026-06-30T23:00:00Z'}]
  };
  assert.equal(financials(data, '2026-Q2').net, 14);
  assert.equal(financials(data, '2026-Q3').net, -7);
  assert.equal(financials(data, '2026-07').net, -7);
  assert.equal(financials(data, '2026').net, 7);
});
