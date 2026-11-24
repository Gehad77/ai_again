import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultReportPeriod, expenseBreakdown, financeCsv, financials, incomeTaxPlan, productResults, productTargetReport, salesPlan, priceScenario, pricingPlan, reportMargins } from '../public/business-model.js';

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

test('default reporting periods and paid sales use the workspace time zone',()=>{
 const now=new Date('2026-03-31T22:30:00Z');
 assert.equal(defaultReportPeriod({time_zone:'Africa/Cairo',default_period:'quarter'},now),'2026-Q2');
 assert.equal(defaultReportPeriod({time_zone:'UTC',default_period:'quarter'},now),'2026-Q1');
 const orders=[{quantity:1,unit_price:10,unit_cost:2,status:'Paid',date:now.toISOString()}];
 assert.equal(financials({orders,settings:{time_zone:'Africa/Cairo'}},'2026-04').revenue,10);
 assert.equal(financials({orders,settings:{time_zone:'UTC'}},'2026-04').revenue,0);
});

test('revenue and unit targets are independent and first profit exceeds break-even',()=>{
 const report={overhead:40,writeoffs:0,gross:30,revenue:90,units:3,net:-10};
 const target={amount:150,units:10};
 assert.deepEqual(salesPlan(report,target,{price:30,unit_cost:20}),{
  revenueRemaining:60,unitsRemaining:7,unitsForRevenue:2,
  coverRevenue:120,profitRevenue:150,extraUnitsToCover:1,extraUnitsToProfit:2
 });
 assert.equal(salesPlan(report,target).profitRevenue,150);
 assert.equal(salesPlan({...report,units:0,gross:0},target).unitsForRevenue,null);
});

test('product profit deducts linked expenses once and excludes general expenses',()=>{
 const data={products:[{id:1,name:'Shirt'},{id:2,name:'Cap'}],
  orders:[{product_id:1,status:'Paid',date:'2026-11-02T08:00:00Z',quantity:2,unit_price:30,unit_cost:10}],
  expenses:[{product_id:1,amount:20,date:'2026-11-02',included_in_product_cost:true},
    {product_id:1,amount:5,date:'2026-11-02'},{amount:10,date:'2026-11-02'}],
  movements:[{product_id:1,kind:'writeoff',delta:-1,unit_cost:3,date:'2026-11-02T08:00:00Z'}]};
 assert.deepEqual(productResults(data,'2026-11')[0],{
  id:1,name:'Shirt',units:2,revenue:60,gross:40,direct:8,profit:32
 });
 assert.equal(financials(data,'2026-11').net,22);
});

test('income tax estimate offsets recorded payment without deducting it twice',()=>{
 const expenses=[{category:'Rent',date:'2026-11-01',amount:150},
  {category:'Income tax',date:'2026-11-20',amount:15},
  {category:'Income tax',date:'2026-10-31',amount:20}];
 const orders=[{status:'Paid',date:'2026-11-02T12:00:00Z',quantity:10,unit_price:100,unit_cost:60}];
 const report=financials({orders,expenses},'2026-11');
 assert.deepEqual(incomeTaxPlan(report,20),{beforeTax:250,paid:15,estimate:50,reserve:35,afterTax:200});
 assert.equal(incomeTaxPlan(report,null).estimate,null);
 assert.deepEqual(incomeTaxPlan({net:-105,paidIncomeTax:5},20),
  {beforeTax:-100,paid:5,estimate:0,reserve:0,afterTax:-105});
 assert.deepEqual(incomeTaxPlan({net:180,paidIncomeTax:70},20),
  {beforeTax:250,paid:70,estimate:50,reserve:0,afterTax:180});
});

test('period export reconciles paid sales, expenses, and the remaining tax reserve',()=>{
 const data={currency:'EGP',settings:{income_tax_rate:20},products:[{id:1,name:'Shirt'}],
  orders:[{id:7,status:'Paid',date:'2026-10-28T10:00:00Z',paid_at:'2026-11-22T10:00:00Z',product_id:1,
    quantity:10,unit_price:100,unit_cost:60,channel:'Website'}],
  expenses:[{id:1,category:'Rent',description:'=unsafe',date:'2026-11-01',amount:150},
    {id:2,category:'Income tax',date:'2026-11-20',amount:15}],
  movements:[]};
 const csv=financeCsv(data,'2026-11');
 assert.match(csv,/"Paid sale","2026-11-22","Order 7"/);
 assert.match(csv,/"'=unsafe","150.00","","-150.00","-150.00"/);
 assert.match(csv,/"Estimated tax reserve","","","","","","35.00","","0.00","-35.00"/);
 assert.match(csv,/"Total","","","","","","1000.00","600.00","235.00","200.00"/);
});

test('quarterly product goals use explicit overrides and preserve each remaining target',()=>{
 const order=(product_id,quantity,status='Paid')=>({
  product_id,quantity,status,date:'2026-10-01T12:00:00Z',paid_at:'2026-11-24T12:00:00Z',unit_price:20,unit_cost:10
 });
 const data={
  products:[{id:1,name:'Bag'},{id:2,name:'Flag'},{id:3,name:'Cap'}],
  orders:[order(1,55),order(2,10),order(3,20),order(2,100,'Pending')],
  productTargets:[
   {product_id:1,period:'2026-11',units:80},{product_id:1,period:'2026-Q4',units:50},
   {product_id:2,period:'2026-10',units:15},{product_id:2,period:'2026-12',units:25}
  ]
 };
 const report=productTargetReport(data,'2026-Q4');
 assert.deepEqual([report.target,report.trackedSold,report.totalSold,report.remaining],[90,65,85,30]);
 assert.equal(report.products[1].fromMonths,true);
 assert.equal(report.products[0].target,50);
 assert.equal(productTargetReport(data,'2026-11').products[0].remaining,25);
});

test('independent pricing scenarios estimate profit at a manual or suggested price',()=>{
 const inputs={unitCost:80,extraCost:20,margin:20,fixedCosts:100,units:10};
 assert.deepEqual(priceScenario({...inputs,sellingPrice:150}),{
  suggestedPrice:125,price:150,unitCost:100,unitProfit:50,margin:1/3,totalProfit:400,unitsToCoverCosts:2
 });
 assert.equal(priceScenario({...inputs,sellingPrice:null}).totalProfit,150);
 assert.equal(priceScenario({...inputs,sellingPrice:90}).totalProfit,-200);
 assert.equal(priceScenario({...inputs,sellingPrice:90}).unitsToCoverCosts,null);
 assert.equal(priceScenario({...inputs,sellingPrice:null,unitCost:0,extraCost:0}),null);
});
