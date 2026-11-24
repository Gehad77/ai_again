import { test } from 'node:test';
import assert from 'node:assert/strict';
import { expenseBreakdown, financials, pricingPlan, reportMargins } from '../public/business-model.js';

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

test('pricing rounds up to maintain the target margin and calculates whole break-even units', () => {
  assert.deepEqual(pricingPlan(8, 2, 30, 100), {
    price:14.29, contribution:4.29, unitsToCoverCosts:24
  });
  assert.equal(pricingPlan(0, 0, 30, 100), null);
  assert.equal(pricingPlan(8, 2, 100, 100), null);
});

test('break-even sales estimate uses the recorded gross margin and current deficit', () => {
  assert.deepEqual(reportMargins({revenue:200,gross:50,net:-20}), {
    grossMargin:0.25,netMargin:-0.1,revenueToBreakEven:80
  });
  assert.equal(reportMargins({revenue:0,gross:0,net:-20}).revenueToBreakEven,null);
  assert.equal(reportMargins({revenue:100,gross:40,net:20}).revenueToBreakEven,0);
});

test('expense reporting groups custom categories and deducts production costs only once', () => {
  const expenses = [
    {category:'Materials',amount:20,date:'2026-11-02',included_in_product_cost:true},
    {category:'Shipping',amount:8.25,date:'2026-11-02'},
    {category:'shipping',amount:1.75,date:'2026-11-03'},
    {amount:5,date:'2026-11-04'},
    {category:'Rent',amount:200,date:'2026-10-30'}
  ];
  const sale = {quantity:2,unit_price:40,unit_cost:10,status:'Paid',date:'2026-11-05T12:00:00Z'};
  const report = financials({orders:[sale],expenses},'2026-11');
  assert.equal(report.recordedExpenses,35);
  assert.equal(report.includedCosts,20);
  assert.equal(report.overhead,15);
  assert.equal(report.net,45);
  assert.deepEqual(expenseBreakdown(report.expenses),[
    {name:'Materials',count:1,total:20},
    {name:'Shipping',count:2,total:10},
    {name:'Uncategorized',count:1,total:5}
  ]);
});
