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

const calendar = new Intl.DateTimeFormat('en-CA', {
  timeZone:'Africa/Cairo', year:'numeric', month:'2-digit', day:'2-digit'
});
export const businessDate = (date = new Date()) => calendar.format(new Date(date));
export const quarterFor = date => date.slice(0, 4) + '-Q' + Math.ceil(Number(date.slice(5, 7)) / 3);

export const isInPeriod = (date, period) => period.includes('-Q') ? quarterFor(date) === period : date.startsWith(period);

export function financials(data, period) {
  const includes = date => isInPeriod(date, period);
  const sales = data.orders.filter(o => o.status === 'Paid' && includes(businessDate(o.paid_at ?? o.date)));
  const expenses = (data.expenses ?? []).filter(e => includes(e.date));
  const losses = (data.movements ?? []).filter(m => m.kind === 'writeoff' && includes(businessDate(m.date)));
  const cents = amount => Math.round(amount * 100);
  const revenue = sales.reduce((sum, o) => sum + o.quantity * cents(o.unit_price), 0);
  const cogs = sales.reduce((sum, o) => sum + o.quantity * cents(o.unit_cost), 0);
  const overhead = expenses.reduce((sum, e) => sum + cents(e.amount), 0);
  const writeoffs = losses.reduce((sum, m) => sum - m.delta * cents(m.unit_cost), 0);
  return {
    revenue: revenue / 100, cogs: cogs / 100, gross: (revenue - cogs) / 100,
    overhead: overhead / 100, writeoffs: writeoffs / 100,
    net: (revenue - cogs - overhead - writeoffs) / 100, expenses,
    units: sales.reduce((sum, o) => sum + o.quantity, 0)
  };
}
