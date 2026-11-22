import { businessDate, financials, quarterFor } from './business-model.js';

const money = new Intl.NumberFormat('en-US', {style:'currency', currency:'USD'});
const usd = amount => money.format(amount);
const amountField = 'type="number" min="0" max="9999999999.99" step="0.01"';
const kinds = {opening:'Opening stock', sale:'Paid sale', restock:'Restock', correction:'Correction', writeoff:'Write-off'};
const metric = (label, value, caption = '') => `
  <article class="metric"><div>${label}</div><strong>${value}</strong><small>${caption}</small></article>`;

export function warehouseSummary(data, esc) {
  const stock = data.products.reduce((sum, product) => sum + product.stock, 0);
  const low = data.products.filter(p => p.stock <= 10).sort((a, b) => a.stock - b.stock);
  const month = businessDate().slice(0, 7);
  const summary = financials(data, month);
  const withdrawn = (data.movements ?? []).filter(m => m.delta < 0 && businessDate(m.date).startsWith(month))
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
      ${data.products.map(p => `<tr><td>${esc(p.name)}</td><td>${p.stock}${p.stock <= 10 ? ' <span class="badge amber">Low stock</span>' : ''}</td></tr>`).join('') || '<tr><td colspan="2">No products in the warehouse.</td></tr>'}
      </tbody></table></div>
    </details>
  </section>`;
}

export function businessProfile(data, esc, year, period) {
  const today = businessDate();
  const month = today.slice(0, 7);
  const quarter = quarterFor(today);
  const report = financials(data, period);
  const months = Array.from({length:12}, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
  const quarters = Array.from({length:4}, (_, i) => `${year}-Q${i+1}`);
  const periods = [String(year), ...quarters, ...months];
  const targets = data.targets ?? [];
  const costValue = data.products.reduce((sum, p) => sum + p.stock * (p.unit_cost ?? 0), 0);
  const unknown = data.products.filter(p => p.stock && p.unit_cost == null).length;
  const productName = id => esc(data.products.find(p => p.id === id)?.name ?? 'Unknown product');
  return `
  <div class="heading"><h1>Business profile</h1><p>Manage products, warehouse movements, expenses and sales targets.</p></div>
  <section class="card recent business-card">
    <div class="card-head"><div><h2>Warehouse</h2><p>Recorded stock cost ${usd(costValue)}${unknown ? ` · ${unknown} stocked products need a unit cost` : ''}</p></div>
    <div><button data-create="order">Record sale</button> <button class="primary" data-create="product">Add product</button></div></div>
    <div class="table-wrap"><table><thead><tr><th>Product</th><th>Stock</th><th>Selling price</th><th>Unit cost</th><th>Actions</th></tr></thead><tbody>
    ${data.products.map(p => `<tr><td><b>${esc(p.name)}</b><small>${esc(p.category)}</small></td>
      <td>${p.stock}${p.stock <= 10 ? ' <span class="badge amber">Low stock</span>' : ''}</td>
      <td>${usd(p.price)}</td><td>${p.unit_cost == null ? 'Unset' : usd(p.unit_cost)}</td>
      <td><button data-edit-product="${p.id}">Edit product</button> <button data-stock-product="${p.id}">Adjust stock</button></td></tr>`).join('') || '<tr><td colspan="5">Add your first product to start tracking stock.</td></tr>'}
    </tbody></table></div>
  </section>
  <section class="card recent business-card">
    <div class="card-head"><div><h2>Profit & loss</h2><p>Based on paid sales, recorded expenses and inventory write-offs. USD · Cairo time.</p></div>
    <div class="business-controls"><label>Year <input id="business-year" type="number" min="1000" max="9999" value="${year}"></label>
    <label>Report period <select id="business-period">${periods.map(p => `<option ${p === period ? 'selected' : ''}>${p}</option>`).join('')}</select></label></div></div>
    <div class="metrics">
      ${metric('Sales revenue', usd(report.revenue), `${report.units} paid units`)}
      ${metric('Cost of goods sold', usd(report.cogs))}
      ${metric('Gross profit', usd(report.gross))}
      ${metric('Operating expenses', usd(report.overhead))}
      ${metric('Inventory write-offs', usd(report.writeoffs))}
      ${metric('Net profit / loss', usd(report.net))}
    </div>
    <form id="business-expense" class="business-form">
      <label>Expense description<input name="description" maxlength="160" required></label>
      <label>Amount ($)<input name="amount" ${amountField} required></label>
      <label>Expense date<input name="date" type="date" value="${today}" required></label>
      <button class="primary">Record expense</button><p class="form-error" role="alert"></p>
    </form>
    <div class="table-wrap"><table><thead><tr><th>Expense</th><th>Date</th><th>Amount</th><th>Actions</th></tr></thead><tbody>
      ${report.expenses.map(e => `<tr><td>${esc(e.description)}</td><td>${e.date}</td><td>${usd(e.amount)}</td><td><button data-delete-expense="${e.id}">Delete</button></td></tr>`).join('') || '<tr><td colspan="4">No recorded expenses this period.</td></tr>'}
    </tbody></table></div>
  </section>
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
      <label>Revenue target ($)<input name="amount" ${amountField} required></label>
      <button class="primary">Save target</button><p class="form-error" role="alert"></p>
    </form>
  </section>
  <section class="card recent business-card">
    <div class="card-head"><div><h2>Stock movements</h2><p>Last 50 recorded movements</p></div></div>
    <div class="table-wrap"><table><thead><tr><th>Date</th><th>Product</th><th>Movement</th><th>Units</th><th>Stock after</th><th>Reference</th></tr></thead><tbody>
    ${(data.movements ?? []).slice(0, 50).map(m => `<tr><td>${businessDate(m.date)}</td><td>${productName(m.product_id)}</td>
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
