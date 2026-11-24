import {taxGuide} from './guide.js';
import { currency, formatMoney, locale, translate } from './i18n.js';
import { businessDate, financials, incomeTaxPlan, expenseBreakdown, expenseCategories, priceScenario, productResults, productTargetReport, quarterFor, reportMargins, salesPlan } from './business-model.js';

const usd = formatMoney;
const percentage = () => new Intl.NumberFormat(locale(), {style:'percent', maximumFractionDigits:1});
const marginLabel = margin => margin === null ? '—' : percentage().format(margin);
const amountField = 'type="number" min="0" max="9999999999.99" step="0.01"';
const kinds = {opening:'Opening stock', sale:'Paid sale', restock:'Restock', correction:'Correction', writeoff:'Write-off'};
const metric = (label, value, caption = '') => `
  <article class="metric"><div>${label}</div><strong>${value}</strong><small>${caption}</small></article>`;

export function warehouseSummary(data, esc) {
  const stock = data.products.reduce((sum, product) => sum + product.stock, 0);
  const low = data.products.filter(p => p.stock <= (data.settings?.low_stock_threshold ?? 10)).sort((a, b) => a.stock - b.stock);
  const month = businessDate(undefined, data.settings?.time_zone).slice(0, 7);
  const summary = financials(data, month);
  const withdrawn = (data.movements ?? []).filter(m => m.delta < 0 && businessDate(m.date,data.settings?.time_zone).startsWith(month))
    .reduce((sum, movement) => sum - movement.delta, 0);
  return `<section class="recent">
    <div class="card-head"><div><h2>Warehouse & sales</h2><p>Current stock and activity this month</p></div>
    <button data-go="warehouse">Open warehouse ↗</button></div>
    <div class="metrics">
      ${metric('Units in stock', stock)}
      ${metric('Units withdrawn', withdrawn, 'Recorded warehouse movements')}
      ${metric('Low-stock products', low.length, low.length ? esc(low.slice(0, 3).map(p => `${p.name} (${p.stock})`).join(', ')) : '')}
      ${metric('Net profit / loss', usd(summary.net))}
    </div>
    <details class="card warehouse-detail"><summary>View stock by product</summary>
      <div class="table-wrap"><table><thead><tr><th>Product</th><th>Available units</th></tr></thead><tbody>
      ${data.products.map(p => `<tr><td data-user-content>${esc(p.name)}</td><td>${p.stock}${p.stock <= (data.settings?.low_stock_threshold ?? 10) ? ' <span class="badge amber">Low stock</span>' : ''}</td></tr>`).join('') || '<tr><td colspan="2">No products in the warehouse.</td></tr>'}
      </tbody></table></div>
    </details>
  </section>`;
}

function starterTasks(data){
  const hasCost = data.products.some(p => p.unit_cost != null);
  const hasProduct = data.products.length > 0;
  const steps = [
    [hasProduct, 'Add your first product', '#warehouse'],
    [hasCost, 'Set a unit cost for at least one product', '#warehouse'],
    [data.orders.some(o => o.status === 'Paid'), 'Record your first paid sale', '#warehouse'],
    [(data.expenses ?? []).length > 0, 'Record an operating expense', '#expenses'],
    [(data.targets ?? []).some(t => t.amount > 0 || t.units > 0), 'Set a monthly or quarterly sales target', '#business-target']
  ];
  if(steps.every(([done])=>done))return '';
  return `<section class="card recent business-card"><div class="card-head"><div>
    <h2>Set up your business</h2><p>${steps.filter(([done]) => done).length} of ${steps.length} steps completed</p></div></div>
    <ul class="starter-steps">${steps.map(([done,label,anchor])=>
      `<li>${done?'✓':'○'} <a href="${anchor}" ${['#expenses','#warehouse'].includes(anchor)?`data-go="${anchor.slice(1)}"`:''}>${label}</a>${done?' <small>Complete</small>':''}</li>`
    ).join('')}</ul></section>`;
}

export function pricingPage(data, esc){
  return `<div class="heading"><h1>Product pricing</h1><p>Compare estimates before setting a price in your catalog.</p></div><section class="card recent business-card"><div class="card-head"><div>
    <h2>Pricing calculator</h2><p>Estimate a selling price and how many units would cover your planned expenses.</p></div></div>
    <form id="pricing-calculator" class="business-form">
      <label>Product <select name="product"><option value="">Manual estimate</option>
        ${data.products.map(p => `<option data-user-content value="${p.id}">${esc(p.name)}</option>`).join('')}</select></label>
      <label>Product cost per unit (${currency})<input name="cost" ${amountField} required></label>
      <label>Other cost per unit (${currency})<input name="extra" ${amountField} value="0" required></label>
      <label>Target margin (%)<input name="margin" type="number" step="0.01" min="0.01" max="99.99" value="30" required></label>
      <label>Planned fixed expenses (${currency})<input name="fixed" ${amountField} value="0" required></label>
      <label>Proposed selling price (${currency})<input name="selling_price" ${amountField} placeholder="Leave blank to use the suggested price"></label>
      <label>Expected units sold<input name="units" type="number" min="1" max="1000000" step="1" value="1" required></label>
      <button class="primary">Calculate</button>
      <small>Estimates only. Prices, orders and financial reports are not updated.</small>
      <p class="form-error" role="alert"></p>
    </form>
    <div id="pricing-result" class="metrics" role="status"></div>
  </section>`;
}

export function bindPricingCalculator(data){
  const form = document.querySelector('#pricing-calculator');
  const result = document.querySelector('#pricing-result');
  const clear = () => {
    result.innerHTML = '';
    form.querySelector('.form-error').textContent = '';
  };
  form.oninput = clear;
  form.elements.product.onchange = () => {
    const product = data.products.find(p => p.id === Number(form.elements.product.value));
    form.elements.cost.value = product?.unit_cost ?? '';
    form.elements.selling_price.value = product?.price>0?product.price:'';
    clear();
  };
  form.onsubmit = event => {
    event.preventDefault();
    clear();
    const {cost,extra,margin,fixed,selling_price,units} = Object.fromEntries(new FormData(form));
    const plan=priceScenario({unitCost:Number(cost),extraCost:Number(extra),margin:Number(margin),fixedCosts:Number(fixed),
      sellingPrice:selling_price===''?null:Number(selling_price),units:Number(units)});
    if(!plan){
      form.querySelector('.form-error').textContent = 'Enter a selling price greater than zero or a positive cost to calculate a suggested price.';
      return;
    }
    result.innerHTML=[
      metric('Total cost per unit',usd(plan.unitCost)),
      metric('Suggested selling price',plan.suggestedPrice===null?'—':usd(plan.suggestedPrice),'Based on the target margin'),
      metric('Selling price used',usd(plan.price)),
      metric('Expected result per unit',usd(plan.unitProfit),'Before fixed expenses and tax'),
      metric('Margin at this price',marginLabel(plan.margin)),
      metric('Expected profit or loss',usd(plan.totalProfit),'For the expected units, after fixed expenses and before tax'),
      metric('Units to cover fixed expenses',plan.unitsToCoverCosts===null?'—':plan.unitsToCoverCosts.toLocaleString(locale()))
    ].join('');

  };
}

export function periodControls(year, period){
  const months = Array.from({length:12}, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
  const quarters = Array.from({length:4}, (_, i) => `${year}-Q${i+1}`);
  return `<div class="business-controls"><label>Year <input id="business-year" type="number" min="1000" max="9999" value="${year}"></label>
    <label>Report period <select id="business-period">${[year,...quarters,...months].map(p => `<option ${p === period ? 'selected' : ''}>${p}</option>`).join('')}</select></label></div>`;
}

export function taxPage(data,esc,year,period){
 const rate=data.settings?.income_tax_rate??null;
 const report=financials(data,period);
 const plan=incomeTaxPlan(report,rate);
 const amount=value=>value===null?'—':usd(value);
 return `<div class="heading finance-heading"><div><h1>Taxes</h1><p>Plan the income tax reserve for the selected period.</p></div><div class="report-toolbar">${periodControls(year,period)}<button type="button" data-download-finance>Download period report</button></div></div>
 <div class="page-actions"><button type="button" data-section="guide-taxes">How taxes are calculated</button><button type="button" data-section="tax-payments">Tax payments</button></div>
 <section class="card recent business-card">
 <div class="card-head"><div><h2>Income tax estimate</h2><p>Use a rate appropriate for your business. This is a planning estimate, not a tax filing calculation.</p></div></div>
 <form id="income-tax-form" class="business-form">
 <label>Income tax rate (%)<input name="rate" type="number" min="0" max="100" step="0.01" value="${rate??''}"></label>
 <button type="submit" class="primary">Save tax rate</button>
 <button type="button" data-go="expenses" data-jump="business-expense" data-expense-category="Income tax">Record a tax payment</button>
 <small>Leave the rate blank to turn off estimates.</small><p class="form-error" role="alert"></p>
 </form>
 <div class="metrics">
 ${metric('Profit before income tax',usd(plan.beforeTax))}
 ${metric('Estimated income tax',amount(plan.estimate))}
 ${metric('Recorded income tax payments',usd(plan.paid))}
 ${metric('Remaining tax reserve',amount(plan.reserve))}
 ${metric('Estimated result after income tax',amount(plan.afterTax))}
 </div>
 ${rate===null?'<p class="tax-note">Save a rate to see the estimated tax and reserve.</p>':''}
 </section>
 <section class="card recent business-card" id="tax-payments">
 <div class="card-head"><div><h2>Tax payments</h2><p>Only income tax payments dated within the selected period are included here.</p></div></div>
 <div class="table-wrap"><table><thead><tr><th>Date</th><th>Expense description</th><th>Amount</th></tr></thead><tbody>
 ${report.incomeTaxPayments.map(entry=>`<tr><td>${entry.date}</td><td data-user-content>${esc(entry.description)}</td><td>${usd(entry.amount)}</td></tr>`).join('')||'<tr><td colspan="3">No income tax payments recorded in this period.</td></tr>'}
 </tbody></table></div></section>
 ${taxGuide()}`;
}

export function expensePage(data, esc, year, period){
  const today=businessDate(undefined,data.settings?.time_zone);
  const report=financials(data,period);
  const productName=id=>esc(data.products.find(p=>p.id===id)?.name??'Unknown product');
  const byProduct=new Map();
  for(const expense of report.expenses){
    const key=expense.product_id??null;
    byProduct.set(key,(byProduct.get(key)??0)+Math.round(expense.amount*100));
  }
  const categories = expenseBreakdown((data.expenses ?? [])).map(row => row.name)
    .filter(name => name !== 'Uncategorized' && !expenseCategories.includes(name));
  const breakdown = expenseBreakdown(report.expenses);
  return `<div class="heading finance-heading"><div><h1>Expenses</h1><p>Track spending by category and product.</p></div>${periodControls(year,period)}</div>
  <div class="metrics finance-summary">
      ${metric('Total recorded spending',usd(report.recordedExpenses))}
      ${metric('Paid sales',usd(report.revenue))}
      ${metric(report.net<0?'Current net loss':'Current net result',usd(Math.abs(report.net)))}
  </div>
  <div class="page-actions" aria-label="Expense page sections">
    <button class="primary" type="button" data-section="business-expense">Record expense</button>
    <button type="button" data-download-finance>Download period report</button>
    <button type="button" data-section="business-target">Sales targets</button>
    <button type="button" data-section="product-targets">Product targets</button>
    <button type="button" data-section="product-profit">Profit by product</button>
    <button type="button" data-section="expense-breakdown">Spending breakdown</button>
  </div>
  <section class="card recent business-card" aria-labelledby="add-expense-title">
    <div class="card-head"><div><h2 id="add-expense-title">Record expense</h2></div></div>
    <form id="business-expense" class="business-form">
      <label>Category<input name="category" list="expense-categories" maxlength="60" placeholder="Choose or type a category" required></label>
      <datalist id="expense-categories">${[...expenseCategories,...categories].map(name=>`<option value="${esc(name)}" label="${esc(translate(name))}"></option>`).join('')}</datalist>
      <label>Expense description<input name="description" maxlength="160" placeholder="e.g. Cotton for T-shirts" required></label>
      <label>Amount (${currency})<input name="amount" ${amountField} required></label>
      <label>Expense date<input name="date" type="date" value="${today}" required></label>
      <label>Related product<select name="product_id"><option value="">General expense</option>
      ${data.products.map(p=>`<option data-user-content value="${p.id}">${esc(p.name)}</option>`).join('')}</select></label>
      <label class="expense-cost-toggle"><input type="checkbox" name="included_in_product_cost" aria-describedby="expense-cost-note"> Already included in product cost</label>
      <button class="primary" type="submit">Record expense</button><button type="button" id="cancel-expense-edit" hidden>Cancel edit</button>
      <small id="expense-cost-note">Select this if the amount is already accounted for in the product cost used to calculate profit.</small>
      <p class="form-error" role="alert"></p>
    </form>
  </section>
  ${salesTargets(data,esc,year,period)}
  ${productGoals(data,esc,year,period)}
  ${productProfit(data,esc,period)}
  <section class="card recent business-card" id="expense-breakdown">
    <div class="card-head"><div><h2>Spending breakdown</h2></div></div>
    <div class="metrics">${metric('Already in product costs',usd(report.includedCosts))}
    ${metric('Expenses deducted separately',usd(report.overhead))}</div>
    <div class="table-wrap">
      <table><caption>Spending by category</caption><thead><tr><th>Category</th><th>Entries</th><th>Total spent</th></tr></thead><tbody>
      ${breakdown.map(row=>`<tr><td>${esc(row.name)}</td><td>${row.count}</td><td>${usd(row.total)}</td></tr>`).join('') || '<tr><td colspan="3">No recorded expenses this period.</td></tr>'}
      </tbody></table>
    </div>
    <div class="table-wrap">
      <table><caption>Spending by product</caption><thead><tr><th>Product</th><th>Total spent</th></tr></thead><tbody>
      ${[...byProduct].sort((a,b)=>b[1]-a[1]).map(([id,total])=>`<tr><td>${id?productName(id):'General expense'}</td><td>${usd(total/100)}</td></tr>`).join('')||'<tr><td colspan="2">No recorded expenses this period.</td></tr>'}
      </tbody></table>
    </div>
    <div class="table-wrap">
      <table><caption>Expense entries</caption><thead><tr><th>Expense</th><th>Category</th><th>Product</th><th>Date</th><th>Amount</th><th>Profit treatment</th><th>Actions</th></tr></thead><tbody>
      ${report.expenses.map(e => `<tr><td data-user-content>${esc(e.description)}</td><td>${esc(e.category ?? 'Uncategorized')}</td>
        <td>${e.product_id?productName(e.product_id):'—'}</td><td>${e.date}</td><td>${usd(e.amount)}</td>
        <td>${e.included_in_product_cost?'Included in product cost':'Deducted separately'}</td><td><div class="expense-actions"><button type="button" data-edit-expense="${e.id}">Edit</button><button type="button" data-delete-expense="${e.id}">Delete</button></div></td></tr>`).join('') || '<tr><td colspan="7">No recorded expenses this period.</td></tr>'}
      </tbody></table>
    </div>
  </section>`;
}

function salesTargets(data,esc,year,period){
  const month=businessDate(undefined,data.settings?.time_zone).slice(5,7);
  const selected=period.length>4?period:`${year}-${month}`;
  const months=Array.from({length:12},(_,i)=>`${year}-${String(i+1).padStart(2,'0')}`);
  const quarters=Array.from({length:4},(_,i)=>`${year}-Q${i+1}`);
  const target=(data.targets??[]).find(t=>t.period===selected);
  const products=data.products.filter(p=>p.price>0);
  const report=financials(data,selected);
  return `<section class="card recent business-card">
    <div class="card-head"><div><h2>Sales targets</h2><p>Set a revenue goal and a unit goal for the same period.</p></div><button type="button" data-section="product-targets">Product targets</button></div>
    <form id="business-target" class="business-form">
      <label>Target period<select name="period">${[...months,...quarters].map(p=>`<option ${p===selected?'selected':''}>${p}</option>`).join('')}</select></label>
      <label>Revenue target (${currency})<input name="amount" ${amountField} value="${target?.amount??0}" required></label>
      <label>Units target<input name="units" type="number" min="0" max="2147483647" step="1" value="${target?.units??0}" required></label>
      <label>Estimate using<select name="estimate_product"><option value="">Average recorded sale</option>
        ${products.map(p=>`<option data-user-content value="${p.id}" ${!report.units&&products.length===1?'selected':''}>${esc(p.name)}</option>`).join('')}</select></label>
      <button class="primary">Save targets</button><small>Enter zero to clear a target.</small><p class="form-error" role="alert"></p>
    </form>
    <div id="sales-goal-result" aria-live="polite"></div>
  </section>`;
}

export function bindSalesTargets(data, selectedProduct, selectProduct){
  const form=document.querySelector('#business-target');
  const result=document.querySelector('#sales-goal-result');
  const report=financials(data,form.elements.period.value);
  const estimate=form.elements.estimate_product;
  if([...estimate.options].some(option=>option.value===selectedProduct))estimate.value=selectedProduct;
  estimate.onchange=()=>selectProduct(estimate.value);
  const displayMoney=value=>value===null?'—':usd(value);
  const displayUnits=value=>value===null?'—':value.toLocaleString(locale());
  const update=()=>{
    const target={amount:Number(form.elements.amount.value),units:Number(form.elements.units.value)};
    const product=data.products.find(p=>p.id===Number(form.elements.estimate_product.value));
    const plan=salesPlan(report,target,product);
    const basis=product?'At the selected product price and unit cost':'At the average recorded price and margin';
    result.innerHTML=`<div class="target-panel">
      <h3>Progress toward your targets</h3>
      <div class="metrics">${[
        metric('Paid sales',usd(report.revenue)),
        metric('Units sold',displayUnits(report.units)),
        metric('Revenue still needed',target.amount>0?usd(plan.revenueRemaining):'—'),
        metric('Units left for unit target',target.units>0?displayUnits(plan.unitsRemaining):'—'),
        metric('Extra units for revenue target',target.amount>0?displayUnits(plan.unitsForRevenue):'—',basis)
      ].join('')}</div>
      <h3>Covering costs and making a profit</h3><div class="target-tax-note"><p>These estimates use recorded costs. Check the Taxes section for any additional reserve.</p><button type="button" data-go="taxes">Open tax planning</button></div>
      <div class="metrics">${[
        metric('Total sales to cover expenses',displayMoney(plan.coverRevenue),basis),
        metric('Total sales to start making a profit',displayMoney(plan.profitRevenue),basis),
        metric('Extra units to break even',displayUnits(plan.extraUnitsToCover)),
        metric('Extra units to start making a profit',displayUnits(plan.extraUnitsToProfit)),
        metric(report.net<0?'Current net loss':report.net>0?'Current net profit':'Current net result',usd(Math.abs(report.net)))
      ].join('')}</div>
      ${plan.coverRevenue===null?'<p class="notice">Select a product with a price and a positive unit margin, or record profitable sales, to estimate break-even.</p>':''}
    </div>`;
  };
  form.oninput=()=>{if(form.checkValidity())update();};
  update();
}

function productGoals(data,esc,year,period){
  const currentMonth=businessDate(undefined,data.settings?.time_zone).slice(5,7);
  const selected=period.length>4?period:`${year}-${currentMonth}`;
  const quarter=selected.includes('-Q')?selected:quarterFor(selected);
  const months=Array.from({length:12},(_,i)=>`${year}-${String(i+1).padStart(2,'0')}`);
  const quarters=Array.from({length:4},(_,i)=>`${year}-Q${i+1}`);
  const report=productTargetReport(data,selected);
  const quarterReport=selected===quarter?report:productTargetReport(data,quarter);
  const count=units=>units.toLocaleString(locale());
  const percent=(numerator,denominator)=>denominator?marginLabel(numerator/denominator):'—';
  const prices=new Map(data.products.map(product=>[product.id,Math.round(product.price*100)]));
  const estimatedRevenue=quarterReport.products.reduce((sum,row)=>sum+row.target*prices.get(row.id),0)/100;
  const quarterFinance=financials(data,quarter);
  return `<section class="card recent business-card" id="product-targets">
    <div class="card-head"><div><h2>Product targets</h2><p>Set a separate unit goal for each product.</p></div></div>
    ${data.products.length?`<form id="product-target-form" class="business-form">
      <label>Target period<select name="period">${[...months,...quarters].map(p=>`<option ${p===selected?'selected':''}>${p}</option>`).join('')}</select></label>
      <label>Product<select name="product_id">${data.products.map(p=>`<option data-user-content value="${p.id}">${esc(p.name)}</option>`).join('')}</select></label>
      <label>Units target<input name="units" type="number" min="0" max="2147483647" step="1" required></label>
      <button type="submit" class="primary">Save product target</button><small>Enter zero to clear a target.</small><p class="form-error" role="alert"></p>
    </form>`:'<p class="tax-note">Add a product to set its target.</p>'}
    <div class="table-wrap"><table><caption>${selected}</caption><thead><tr>
      <th>Product</th><th>Units target</th><th>Units sold</th><th>Remaining units</th><th>Target achieved</th>
    </tr></thead><tbody>${report.products.map(row=>`<tr>
     <td data-user-content>${esc(row.name)}</td><td>${row.target?count(row.target):'—'}${row.fromMonths?'<small>From monthly targets</small>':''}</td>
     <td>${count(row.units)}</td><td>${row.remaining===null?'—':count(row.remaining)}</td>
     <td>${percent(row.units,row.target)}</td></tr>`).join('')||'<tr><td colspan="5">No products yet.</td></tr>'}</tbody></table></div>
    <div class="target-panel"><h3>Quarterly product summary <bdi>${quarter}</bdi></h3>
     <div class="metrics">
      ${metric('Combined product target',count(quarterReport.target))}
      ${metric('Total units sold',count(quarterReport.totalSold))}
      ${metric('Units sold for products with targets',count(quarterReport.trackedSold))}
      ${metric('Total remaining across product targets',count(quarterReport.remaining))}
      ${metric('Combined target achieved',percent(quarterReport.trackedSold,quarterReport.target))}
      ${metric('Estimated target revenue',usd(estimatedRevenue),'At current product prices')}
      ${metric('Quarterly gross margin',percent(quarterFinance.gross,quarterFinance.revenue))}
     </div>
     <p class="tax-note">For each product, an explicit quarterly target takes priority. Otherwise, the quarter adds its saved monthly targets.</p>
    </div>
  </section>`;
}

function productProfit(data,esc,period){
  const rows=productResults(data,period);
  const report=financials(data,period);
  const productProfitTotal=rows.reduce((sum,row)=>sum+Math.round(row.profit*100),0)/100;
  return `<section class="card recent business-card" id="product-profit">
    <div class="card-head"><div><h2>Profit by product</h2>
    <p>Product results deduct recorded unit costs and linked expenses. General expenses are deducted in the business net result.</p></div></div>
    <div class="metrics">${metric('Gross profit from all products',usd(report.gross),'Gross margin '+marginLabel(report.revenue?report.gross/report.revenue:null))}
    ${metric('Products after linked costs',usd(productProfitTotal),'Margin after linked costs '+marginLabel(report.revenue?productProfitTotal/report.revenue:null))}
    ${metric('Total recorded spending',usd(report.recordedExpenses))}
    ${metric(report.net<0?'Current net loss':report.net>0?'Current net profit':'Current net result',usd(Math.abs(report.net)))}</div>
    <div class="table-wrap"><table><thead><tr><th>Product</th><th>Units sold</th><th>Sales revenue</th><th>Gross profit</th><th>Linked costs</th><th>Profit after linked costs</th><th>Margin after linked costs</th></tr></thead><tbody>
      ${rows.map(row=>`<tr><td data-user-content>${esc(row.name)}</td><td>${row.units}</td><td>${usd(row.revenue)}</td><td>${usd(row.gross)}</td><td>${usd(row.direct)}</td><td>${usd(row.profit)}</td><td>${marginLabel(row.revenue?row.profit/row.revenue:null)}</td></tr>`).join('')||'<tr><td colspan="7">No products yet.</td></tr>'}
    </tbody></table></div>
  </section>`;
}

export function businessProfile(data, esc, year, period) {
  const report = financials(data, period);
  const margins = reportMargins(report);
  return `
  <div class="heading"><h1>Business profile</h1><p>Manage products, warehouse movements, expenses and sales targets.</p></div>
  ${starterTasks(data)}
  <div class="page-actions"><button type="button" data-go="warehouse">Open warehouse ↗</button>
  <button type="button" data-go="pricing">Product pricing</button></div>
  <section class="card recent business-card">
    <div class="card-head"><div><h2>Profit & loss</h2><p>Based on paid sales, recorded expenses and inventory write-offs. ${currency} · ${esc(data.settings?.time_zone??'Africa/Cairo')}.</p></div>
    <div class="report-toolbar">${periodControls(year,period)}<button type="button" data-download-finance>Download period report</button></div></div>
    <div class="metrics">
      ${metric('Sales revenue', usd(report.revenue), `${report.units} paid units`)}
      ${metric('Cost of goods sold', usd(report.cogs))}
      ${metric('Gross profit', usd(report.gross), 'Gross margin ' + marginLabel(margins.grossMargin))}
      ${metric('Operating expenses', usd(report.overhead-report.paidIncomeTax))}
      ${report.paidIncomeTax?metric('Recorded income tax payments',usd(report.paidIncomeTax)):''}
      ${data.settings?.income_tax_rate!=null?metric('Estimated result after income tax',usd(incomeTaxPlan(report,data.settings.income_tax_rate).afterTax), 'Includes the remaining tax reserve'):''}
      ${metric('Total recorded spending', usd(report.recordedExpenses))}
      ${metric('Inventory write-offs', usd(report.writeoffs))}
      ${metric('Net profit / loss', usd(report.net), 'Net margin ' + marginLabel(margins.netMargin))}
      ${metric('Extra sales to break even',
         margins.revenueToBreakEven === null || (!report.revenue && !report.net) ? '—' : usd(margins.revenueToBreakEven),
         margins.revenueToBreakEven === null ? 'Requires sales with a positive gross margin' : 'Estimate at the same gross margin and expenses')}
    </div>
  </section>


  ${salesTargets(data,esc,year,period)}
  ${productGoals(data,esc,year,period)}
  ${productProfit(data,esc,period)}
  `;
}

export function warehousePage(data,esc){
  const costValue = data.products.reduce((sum, p) => sum + p.stock * (p.unit_cost ?? 0), 0);
  const unknown = data.products.filter(p => p.stock && p.unit_cost == null).length;
  const units=data.products.reduce((sum,p)=>sum+p.stock,0);
  const threshold=data.settings?.low_stock_threshold??10;
  const month=businessDate(undefined,data.settings?.time_zone).slice(0,7);
  const moves=data.movements??[];
  const withdrawn=moves.reduce((sum,move)=>move.delta<0&&businessDate(move.date,data.settings?.time_zone).startsWith(month)?sum-move.delta:sum,0);
  return `<div class="heading"><h1>Warehouse</h1><p>Check stock, add or remove units, and review movement history.</p></div>
  <div class="metrics">
   ${metric('Units in stock',units.toLocaleString(locale()))}
   ${metric('Stock value at cost',usd(costValue),unknown?'Includes products with a saved unit cost':'')}
   ${metric('Low-stock products',data.products.filter(p=>p.stock<=threshold).length)}
   ${metric('Units withdrawn',withdrawn.toLocaleString(locale()),'Current month')}
  </div>
  <div class="page-actions"><button type="button" data-section="warehouse-stock">Stock by product</button>
  <button type="button" data-section="warehouse-movements">Stock movements</button></div>
  <section class="card recent business-card" id="warehouse-stock">
    <div class="card-head"><div><h2>Stock by product</h2></div>
    <div>${data.products.length?'<button data-create="order">Record sale</button>':''} <button class="primary" data-create="product">Add product</button></div></div>
    <div class="table-wrap"><table><thead><tr><th>Product</th><th>Stock</th><th>Selling price</th><th>Unit cost</th><th>Actions</th></tr></thead><tbody>
    ${data.products.map(p => `<tr><td><b data-user-content>${esc(p.name)}</b><small>${esc(p.category)}</small></td>
      <td>${p.stock}${p.stock <= (data.settings?.low_stock_threshold ?? 10) ? ' <span class="badge amber">Low stock</span>' : ''}</td>
      <td>${usd(p.price)}</td><td>${p.unit_cost == null ? 'Unset' : usd(p.unit_cost)}</td>
      <td><button data-edit-product="${p.id}">Edit product</button> <button data-stock-product="${p.id}">Adjust stock</button></td></tr>`).join('') || '<tr><td colspan="5">Add your first product to start tracking stock.</td></tr>'}
    </tbody></table></div>
  </section>
  <section class="card recent business-card" id="warehouse-movements">
    <div class="card-head"><div><h2>Stock movements</h2><p>Last 50 matching movements</p></div></div>
    <div class="business-form">
      <label>Product<select id="warehouse-product"><option value="">All products</option>${data.products.map(p=>`<option data-user-content value="${p.id}">${esc(p.name)}</option>`).join('')}</select></label>
      <label>Movement<select id="warehouse-kind"><option value="">All movements</option>${Object.entries(kinds).map(([key,label])=>`<option value="${key}">${label}</option>`).join('')}</select></label>
    </div>
    <div class="table-wrap"><table><thead><tr><th>Date</th><th>Product</th><th>Movement</th><th>Units</th><th>Stock after</th><th>Reference</th></tr></thead><tbody id="warehouse-movement-rows">${movementRows(data,esc)}</tbody></table></div>
  </section>`;
}

function movementRows(data,esc,product='',kind=''){
 const names=new Map(data.products.map(p=>[p.id,p.name]));
 return (data.movements??[]).filter(move=>
  (!product||move.product_id===Number(product))&&(!kind||move.kind===kind)
 ).slice(0,50).map(move=>`<tr><td>${businessDate(move.date,data.settings?.time_zone)}</td>
  <td data-user-content>${esc(names.get(move.product_id)??'Unknown product')}</td>
  <td>${kinds[move.kind]}</td><td>${move.delta>0?'+':''}${move.delta}</td><td>${move.stock_after}</td>
  <td>${move.order_id?`Order #${move.order_id}`:esc(move.note||'')}</td></tr>`).join('')||
  '<tr><td colspan="6">No stock movements match these filters.</td></tr>';
}

export function bindWarehouseFilters(data,esc){
 const product=document.querySelector('#warehouse-product');
 const kind=document.querySelector('#warehouse-kind');
 const update=()=>{
  document.querySelector('#warehouse-movement-rows').innerHTML=movementRows(data,esc,product.value,kind.value);
 };
 product.onchange=update;
 kind.onchange=update;
}

export function stockDialog(product, esc) {
  return `<form><div class="dialog-heading"><h2>Adjust stock</h2>
    <button type="button" id="close-dialog" aria-label="Close">×</button></div>
    <p>${esc(product.name)} · ${product.stock} units available</p>
    <div class="form-grid">
      <label>Movement<select name="kind"><option value="restock">Restock</option>
        <option value="correction">Count correction</option><option value="writeoff">Damage or loss</option></select></label>
      <label>Quantity change<input name="delta" type="number" min="-2147483647" max="2147483647" step="1" required></label>
      <label>Reason<input name="note" required maxlength="160"></label>
    </div>
    <p>Use a negative quantity to remove stock. Damage or loss reduces net profit at the saved unit cost.</p>
    <p class="form-error" role="alert"></p><div class="dialog-actions">
      <button type="button" id="cancel-dialog">Cancel</button><button class="primary">Record movement</button></div>
  </form>`;
}
