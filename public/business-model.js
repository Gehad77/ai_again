export const isMoney = n => typeof n === 'number' && Number.isFinite(n) &&
  n >= 0 && n <= 9999999999.99 && Number(n.toFixed(2)) === n;

export function isDate(value) {
  if (typeof value !== 'string' || !/^[1-9]\d{3}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(+date) && date.toISOString().slice(0, 10) === value;
}

export const isTargetPeriod = period => typeof period === 'string' &&
  /^[1-9]\d{3}-(?:0[1-9]|1[0-2]|Q[1-4])$/.test(period);

export function stockChange(product, input) {
  const {kind, delta, note} = input ?? {};
  if (!['restock', 'correction', 'writeoff'].includes(kind) ||
      !Number.isInteger(delta) || !delta ||
      (kind === 'restock' && delta < 0) || (kind === 'writeoff' && delta > 0) ||
      typeof note !== 'string' || !note.trim() || note.length > 160) {
    throw Error('Enter a valid stock change and reason. Use a negative quantity for write-offs.');
  }
  const stock_after = product.stock + delta;
  if (stock_after < 0 || stock_after > 2147483647) throw Error('This adjustment would leave an invalid stock balance.');
  if (kind === 'writeoff' && product.unit_cost == null) throw Error('Set the product unit cost before recording a write-off.');
  return {kind, delta, note: note.trim(), stock_after, unit_cost: product.unit_cost ?? null};
}

export const expenseCategories = Object.freeze([
  'Purchases', 'Materials', 'Manufacturing', 'Marketing', 'Sales', 'Tools & subscriptions',
  'Rent', 'Transportation', 'Shipping', 'Other'
]);

export function expenseEntry(input) {
  const {description, amount, date, product_id = null, included_in_product_cost = false} = input ?? {};
  const category = input?.category === undefined ? 'Uncategorized' :
    typeof input.category === 'string' ? input.category.trim().replace(/\s+/g, ' ') : '';
  if (typeof description !== 'string' || !description.trim() || description.length > 160 ||
      !isMoney(amount) || amount === 0 || !isDate(date) || !category || category.length > 60 ||
      typeof included_in_product_cost !== 'boolean' ||
      (product_id !== null && (!Number.isInteger(product_id) || product_id < 1 || product_id > 2147483647))) {
    throw Error('Enter a category, description, positive amount, and valid date.');
  }
  const standard = expenseCategories.find(name => name.toLowerCase() === category.toLowerCase());
  return {description: description.trim(), amount, date, category: standard ?? category, product_id, included_in_product_cost};
}

export function expenseBreakdown(expenses) {
  const categories = new Map();
  for (const expense of expenses) {
    const name = expense.category ?? 'Uncategorized';
    const key = name.toLowerCase();
    const row = categories.get(key) ?? {name, total:0, count:0};
    row.total += Math.round(expense.amount * 100);
    row.count++;
    categories.set(key, row);
  }
  return [...categories.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))
    .map(row => ({...row,total:row.total / 100}));
}

export const defaultSettings = Object.freeze({
  name:'Olive & Co.', language:null, time_zone:'Africa/Cairo', low_stock_threshold:10, default_period:'month'
});

export const timeZones = new Set(['UTC', ...Intl.supportedValuesOf('timeZone')]);
const calendars = new Map();
export function businessDate(date = new Date(), timeZone = defaultSettings.time_zone) {
  if (!calendars.has(timeZone)) {
    calendars.set(timeZone, new Intl.DateTimeFormat('en-CA', {
      timeZone, year:'numeric', month:'2-digit', day:'2-digit'
    }));
  }
  return calendars.get(timeZone).format(new Date(date));
}

export function defaultReportPeriod(settings = defaultSettings, now = new Date()) {
  const today = businessDate(now, settings.time_zone);
  if (settings.default_period === 'year') return today.slice(0, 4);
  return settings.default_period === 'quarter' ? quarterFor(today) : today.slice(0, 7);
}

export const quarterFor = date => date.slice(0, 4) + '-Q' + Math.ceil(Number(date.slice(5, 7)) / 3);

export const isInPeriod = (date, period) => period.includes('-Q') ? quarterFor(date) === period : date.startsWith(period);

export function financials(data, period) {
  const includes = date => isInPeriod(date, period);
  const sales = data.orders.filter(o => o.status === 'Paid' && includes(businessDate(o.paid_at ?? o.date,data.settings?.time_zone)));
  const expenses = (data.expenses ?? []).filter(e => includes(e.date));
  const losses = (data.movements ?? []).filter(m => m.kind === 'writeoff' && includes(businessDate(m.date,data.settings?.time_zone)));
  const cents = amount => Math.round(amount * 100);
  const revenue = sales.reduce((sum, o) => sum + o.quantity * cents(o.unit_price), 0);
  const cogs = sales.reduce((sum, o) => sum + o.quantity * cents(o.unit_cost), 0);
  const recordedExpenses = expenses.reduce((sum, e) => sum + cents(e.amount), 0);
  const includedCosts = expenses.filter(e => e.included_in_product_cost).reduce((sum, e) => sum + cents(e.amount), 0);
  const overhead = recordedExpenses - includedCosts;
  const writeoffs = losses.reduce((sum, m) => sum - m.delta * cents(m.unit_cost), 0);
  return {
    revenue: revenue / 100, cogs: cogs / 100, gross: (revenue - cogs) / 100,
    overhead: overhead / 100, writeoffs: writeoffs / 100,
    recordedExpenses: recordedExpenses / 100, includedCosts: includedCosts / 100,
    net: (revenue - cogs - overhead - writeoffs) / 100, expenses,
    units: sales.reduce((sum, o) => sum + o.quantity, 0)
  };
}

export function pricingPlan(unitCost, extraCost, margin, fixedCosts) {
  if (![unitCost, extraCost, fixedCosts].every(isMoney) ||
      !Number.isFinite(margin) || margin <= 0 || margin >= 100) return null;
  const cost = Math.round(unitCost * 100) + Math.round(extraCost * 100);
  if (!cost) return null;
  const marginBasisPoints = Math.round(margin * 100);
  if (!marginBasisPoints || marginBasisPoints >= 10000) return null;
  const price = Math.ceil(cost * 10000 / (10000 - marginBasisPoints));
  const contribution = price - cost;
  return {
    price: price / 100,
    contribution: contribution / 100,
    unitsToCoverCosts: Math.ceil(Math.round(fixedCosts * 100) / contribution)
  };
}

export function reportMargins(report) {
  return {
    grossMargin: report.revenue > 0 ? report.gross / report.revenue : null,
    netMargin: report.revenue > 0 ? report.net / report.revenue : null,
    revenueToBreakEven: report.net >= 0 ? 0 : report.gross > 0 && report.revenue > 0
      ? Math.ceil(-report.net * report.revenue / report.gross * 100) / 100 : null
  };
}

export const currencies = new Set(Intl.supportedValuesOf('currency').filter(code =>
  new Intl.NumberFormat('en',{style:'currency',currency:code}).resolvedOptions().maximumFractionDigits<=2
));


export function profitGoal(report, desiredProfit, product) {
  if (!isMoney(desiredProfit)) return null;
  const required = Math.round(report.overhead * 100) + Math.round(report.writeoffs * 100) + Math.round(desiredProfit * 100);
  if (product) {
    if (product.unit_cost == null) return null;
    const price = Math.round(product.price * 100);
    const contribution = price - Math.round(product.unit_cost * 100);
    if (contribution <= 0) return null;
    const units = Math.ceil(required / contribution);
    return {revenue:units * price / 100,units};
  }
  if (report.revenue <= 0 || report.gross <= 0) return null;
  return {revenue:Math.ceil(required * report.revenue / report.gross) / 100,units:null};
}
