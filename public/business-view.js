import { currency, formatMoney, locale, translate } from './i18n.js';
import { businessDate, financials, expenseBreakdown, expenseCategories, pricingPlan, profitGoal, quarterFor, reportMargins } from './business-model.js';

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
    <button data-go="profile">Manage business ↗</button></div>
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
    [hasProduct, 'Add your first product', '#business-warehouse'],
    [hasCost, 'Set a unit cost for at least one product', '#business-warehouse'],
    [data.orders.some(o => o.status === 'Paid'), 'Record your first paid sale', '#business-warehouse'],
    [(data.expenses ?? []).length > 0, 'Record an operating expense', '#expenses'],
    [(data.targets ?? []).some(t => t.amount > 0), 'Set a monthly or quarterly sales target', '#business-target']
  ];
  if(steps.every(([done])=>done))return '';
  return `<section class="card recent business-card"><div class="card-head"><div>
    <h2>Set up your business</h2><p>${steps.filter(([done]) => done).length} of ${steps.length} steps completed</p></div></div>
    <ul class="starter-steps">${steps.map(([done,label,anchor])=>
      `<li>${done?'✓':'○'} <a href="${anchor}" ${anchor==='#expenses'?'data-go="expenses"':''}>${label}</a>${done?' <small>Complete</small>':''}</li>`
    ).join('')}</ul></section>`;
}

function pricingCalculator(products, esc){
  return `<section class="card recent business-card"><div class="card-head"><div>
    <h2>Pricing calculator</h2><p>Estimate a selling price and how many units would cover your planned expenses.</p></div></div>
    <form id="pricing-calculator" class="business-form">
      <label>Product <select name="product"><option value="">Manual estimate</option>
        ${products.map(p => `<option data-user-content value="${p.id}">${esc(p.name)}</option>`).join('')}</select></label>
      <label>Product cost per unit (${currency})<input name="cost" ${amountField} required></label>
      <label>Other cost per unit (${currency})<input name="extra" ${amountField} value="0" required></label>
      <label>Target margin (%)<input name="margin" type="number" step="0.01" min="0.01" max="99.99" value="30" required></label>
      <label>Planned fixed expenses (${currency})<input name="fixed" ${amountField} value="0" required></label>
      <button class="primary">Calculate</button>
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
    clear();
  };
  form.onsubmit = event => {
    event.preventDefault();
    clear();
    const {cost,extra,margin,fixed} = Object.fromEntries(new FormData(form));
    const plan = pricingPlan(Number(cost),Number(extra),Number(margin),Number(fixed));
    if(!plan){
      form.querySelector('.form-error').textContent = 'Enter a positive total unit cost and a margin between 0.01% and 99.99%.';
      return;
    }
    result.innerHTML = metric('Suggested selling price',usd(plan.price),'Rounded up to the nearest cent')+
      metric('Amount left per unit',usd(plan.contribution),'After the unit costs entered above')+
      metric('Units to cover fixed expenses',plan.unitsToCoverCosts.toLocaleString(), 'At the suggested selling price');
  };
}

export function periodControls(year, period){
  const months = Array.from({length:12}, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
  const quarters = Array.from({length:4}, (_, i) => `${year}-Q${i+1}`);
  return `<div class="business-controls"><label>Year <input id="business-year" type="number" min="1000" max="9999" value="${year}"></label>
    <label>Report period <select id="business-period">${[year,...quarters,...months].map(p => `<option ${p === period ? 'selected' : ''}>${p}</option>`).join('')}</select></label></div>`;
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
  return `<div class="heading"><h1>Expenses</h1></div>
  <section class="card recent business-card">
    <div class="card-head"><div><h2>Expense ledger</h2><p>Track spending by category and product.</p></div>${periodControls(year,period)}</div>
    <div class="metrics">
      ${metric('Total recorded spending',usd(report.recordedExpenses))}
      ${metric('Already in product costs',usd(report.includedCosts))}
      ${metric('Expenses deducted separately',usd(report.overhead))}
    </div>
    <form id="business-expense" class="business-form">
      <label>Category<input name="category" list="expense-categories" maxlength="60" placeholder="Choose or type a category" required></label>
      <datalist id="expense-categories">${[...expenseCategories,...categories].map(name=>`<option value="${esc(name)}" label="${esc(translate(name))}"></option>`).join('')}</datalist>
      <label>Expense description<input name="description" maxlength="160" placeholder="e.g. Cotton for T-shirts" required></label>
      <label>Amount (${currency})<input name="amount" ${amountField} required></label>
      <label>Expense date<input name="date" type="date" value="${today}" required></label>
      <label>Related product<select name="product_id"><option value="">General expense</option>
      ${data.products.map(p=>`<option data-user-content value="${p.id}">${esc(p.name)}</option>`).join('')}</select></label>
      <label class="expense-cost-toggle"><input type="checkbox" name="included_in_product_cost" aria-describedby="expense-cost-note"> Already included in product cost</label>
      <button class="primary">Record expense</button>
      <small id="expense-cost-note">Select this if the amount is already accounted for in the product cost used to calculate profit.</small>
      <p class="form-error" role="alert"></p>
    </form>
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
        <td>${e.included_in_product_cost?'Included in product cost':'Deducted separately'}</td><td><button data-delete-expense="${e.id}">Delete</button></td></tr>`).join('') || '<tr><td colspan="7">No recorded expenses this period.</td></tr>'}
      </tbody></table>
    </div>
  </section>
  <section class="card recent business-card">
    <div class="card-head"><div><h2>Profit target calculator</h2><p>Uses the selected period’s recorded expenses and write-offs. Enter zero to calculate break-even.</p></div></div>
    <form id="profit-goal" class="business-form">
      <label>Desired net profit (${currency})<input name="profit" ${amountField} required></label>
      <label>Margin source<select name="product"><option value="">Recorded sales margin</option>
      ${data.products.filter(p=>p.unit_cost!=null&&p.price>p.unit_cost).map(p=>`<option data-user-content value="${p.id}">${esc(p.name)}</option>`).join('')}</select></label>
      <button class="primary">Calculate target</button><p class="form-error" role="alert"></p>
    </form>
    <div class="metrics" id="profit-goal-result" role="status"></div>
  </section>`;
}

export function bindProfitGoal(data,period,useTarget){
  const form=document.querySelector('#profit-goal');
  const result=document.querySelector('#profit-goal-result');
  const error=form.querySelector('[role=alert]');
  form.oninput=()=>{result.innerHTML='';error.textContent='';};
  form.onsubmit=event=>{
    event.preventDefault();
    result.innerHTML='';
    error.textContent='';
    const product=data.products.find(p=>p.id===Number(form.elements.product.value));
    const report=financials(data,period);
    const goal=profitGoal(report,Number(form.elements.profit.value),product);
    if(!goal){
      error.textContent='Select a product with a positive margin or record sales with a positive gross margin.';
      return;
    }
    result.innerHTML=metric('Revenue target',usd(goal.revenue),product?'Assumes all sales are for the selected product':'Estimate at the recorded gross margin')+
      (product?'':metric('Revenue still needed',usd(Math.max(0,goal.revenue-report.revenue))))+
      (goal.units===null?'':metric('Units needed',goal.units.toLocaleString(locale())));
    if(period.length>4&&goal.revenue>0&&goal.revenue<=9999999999.99){
      const button=document.createElement('button');
      button.type='button';
      button.textContent='Use as sales target';
      button.onclick=()=>useTarget(goal.revenue);
      result.append(button);
    }
  };
}

export function businessProfile(data, esc, year, period) {
  const today = businessDate(undefined, data.settings?.time_zone);
  const month = today.slice(0, 7);
  const quarter = quarterFor(today);
  const report = financials(data, period);
  const margins = reportMargins(report);
  const months = Array.from({length:12}, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
  const quarters = Array.from({length:4}, (_, i) => `${year}-Q${i+1}`);
  const targets = data.targets ?? [];
  const costValue = data.products.reduce((sum, p) => sum + p.stock * (p.unit_cost ?? 0), 0);
  const unknown = data.products.filter(p => p.stock && p.unit_cost == null).length;
  const productName = id => esc(data.products.find(p => p.id === id)?.name ?? 'Unknown product');
  return `
  <div class="heading"><h1>Business profile</h1><p>Manage products, warehouse movements, expenses and sales targets.</p></div>
  ${starterTasks(data)}
  <section class="card recent business-card" id="business-warehouse">
    <div class="card-head"><div><h2>Warehouse</h2><p>Recorded stock cost ${usd(costValue)}${unknown ? ` · ${unknown} stocked products need a unit cost` : ''}</p></div>
    <div><button data-create="order">Record sale</button> <button class="primary" data-create="product">Add product</button></div></div>
    <div class="table-wrap"><table><thead><tr><th>Product</th><th>Stock</th><th>Selling price</th><th>Unit cost</th><th>Actions</th></tr></thead><tbody>
    ${data.products.map(p => `<tr><td><b data-user-content>${esc(p.name)}</b><small>${esc(p.category)}</small></td>
      <td>${p.stock}${p.stock <= (data.settings?.low_stock_threshold ?? 10) ? ' <span class="badge amber">Low stock</span>' : ''}</td>
      <td>${usd(p.price)}</td><td>${p.unit_cost == null ? 'Unset' : usd(p.unit_cost)}</td>
      <td><button data-edit-product="${p.id}">Edit product</button> <button data-stock-product="${p.id}">Adjust stock</button></td></tr>`).join('') || '<tr><td colspan="5">Add your first product to start tracking stock.</td></tr>'}
    </tbody></table></div>
  </section>
  <section class="card recent business-card">
    <div class="card-head"><div><h2>Profit & loss</h2><p>Based on paid sales, recorded expenses and inventory write-offs. ${currency} · ${esc(data.settings?.time_zone??'Africa/Cairo')}.</p></div>
    ${periodControls(year,period)}</div>
    <div class="metrics">
      ${metric('Sales revenue', usd(report.revenue), `${report.units} paid units`)}
      ${metric('Cost of goods sold', usd(report.cogs))}
      ${metric('Gross profit', usd(report.gross), 'Gross margin ' + marginLabel(margins.grossMargin))}
      ${metric('Operating expenses', usd(report.overhead))}
      ${metric('Total recorded spending', usd(report.recordedExpenses))}
      ${metric('Inventory write-offs', usd(report.writeoffs))}
      ${metric('Net profit / loss', usd(report.net), 'Net margin ' + marginLabel(margins.netMargin))}
      ${metric('Extra sales to break even',
         margins.revenueToBreakEven === null || (!report.revenue && !report.net) ? '—' : usd(margins.revenueToBreakEven),
         margins.revenueToBreakEven === null ? 'Requires sales with a positive gross margin' : 'Estimate at the same gross margin and expenses')}
    </div>
  </section>

${pricingCalculator(data.products,esc)}
  <section class="card recent business-card">
    <div class="card-head"><div><h2>Sales targets</h2><p>Track paid revenue toward independent monthly and quarterly goals.</p></div></div>
    <div class="metrics">${[...new Set([month, quarter, ...(period.length > 4 ? [period] : [])])].map(p => {
      const target = targets.find(t => t.period === p)?.amount;
      const revenue = financials(data, p).revenue;
      const percent = target ? Math.round(revenue / target * 100) : null;
      return `<article class="metric"><div>${p}</div><strong>${usd(revenue)}</strong>
        ${target ? `<progress max="100" value="${Math.min(100, percent)}" aria-label="${p} sales progress"></progress>
        <small>${percent}% of ${usd(target)} · ${usd(Math.max(0, target - revenue))} remaining</small>` : '<small>No sales target set</small>'}</article>`;
    }).join('')}</div>
    <form id="business-target" class="business-form">
      <label>Target period<select name="period">${[...quarters, ...months].map(p => `<option ${p === (period.length > 4 ? period : month) ? 'selected' : ''}>${p}</option>`).join('')}</select></label>
      <label>Revenue target (${currency})<input name="amount" ${amountField} required></label>
      <button class="primary">Save target</button><p class="form-error" role="alert"></p>
    </form>
  </section>
  <section class="card recent business-card">
    <div class="card-head"><div><h2>Stock movements</h2><p>Last 50 recorded movements</p></div></div>
    <div class="table-wrap"><table><thead><tr><th>Date</th><th>Product</th><th>Movement</th><th>Units</th><th>Stock after</th><th>Reference</th></tr></thead><tbody>
    ${(data.movements ?? []).slice(0, 50).map(m => `<tr><td>${businessDate(m.date,data.settings?.time_zone)}</td><td>${productName(m.product_id)}</td>
      <td>${kinds[m.kind]}</td><td>${m.delta > 0 ? '+' : ''}${m.delta}</td><td>${m.stock_after}</td>
      <td>${m.order_id ? `Order #${m.order_id}` : esc(m.note || '')}</td></tr>`).join('') || '<tr><td colspan="6">New stock movements will appear here.</td></tr>'}
    </tbody></table></div>
  </section>`;
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
