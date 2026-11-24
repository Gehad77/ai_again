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

export const incomeTaxCategory='Income tax';
export const isIncomeTaxCategory=category=>['income tax','ضريبة الدخل','ضريبة دخل'].includes(
 typeof category==='string'?category.trim().replace(/\s+/g,' ').toLowerCase():''
);

export const expenseCategoryName=category=>isIncomeTaxCategory(category)?incomeTaxCategory:(category??'Uncategorized');

export const expenseCategories = Object.freeze([
  'Purchases', 'Materials', 'Manufacturing', 'Marketing', 'Sales', 'Tools & subscriptions',
  'Rent', 'Transportation', 'Shipping', incomeTaxCategory, 'Other taxes', 'Other'
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
  const standard = isIncomeTaxCategory(category)?incomeTaxCategory:expenseCategories.find(name => name.toLowerCase() === category.toLowerCase());
  if(standard===incomeTaxCategory&&(product_id!==null||included_in_product_cost)){
    throw Error('Record income tax as a general expense with no product selected.');
  }
  return {description: description.trim(), amount, date, category: standard ?? category, product_id, included_in_product_cost};
}

export function expenseBreakdown(expenses) {
  const categories = new Map();
  for (const expense of expenses) {
    const name = expenseCategoryName(expense.category);
    const key = name.toLowerCase();
    const row = categories.get(key) ?? {name, total:0, count:0};
    row.total += Math.round(expense.amount * 100);
    row.count++;
    categories.set(key, row);
  }
  return [...categories.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))
    .map(row => ({...row,total:row.total / 100}));
}

export function reviewExpenses(expenses,{query='',category='',product=''}={}){
  const text=query.trim().toLowerCase();
  const matching=expenses.filter(expense=>{
    const name=expenseCategoryName(expense.category);
    return (!text||expense.description.toLowerCase().includes(text))&&
      (!category||name.toLowerCase()===category.toLowerCase())&&
      (!product||(product==='general'?expense.product_id==null:expense.product_id===Number(product)));
  });
  return {
    matching,
    total:matching.reduce((sum,e)=>sum+cents(e.amount),0)/100,
    deducted:matching.reduce((sum,e)=>sum+(e.included_in_product_cost?0:cents(e.amount)),0)/100
  };
}

export const defaultSettings = Object.freeze({
  name:'Olive & Co.', language:null, time_zone:'Africa/Cairo', low_stock_threshold:10, default_period:'month', income_tax_rate:null
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

const cents = amount => Math.round(amount * 100);

function periodEntries(data,period){
  const includes = date => isInPeriod(date, period);
  const timeZone = data.settings?.time_zone;
  return {
    sales:data.orders.filter(o=>o.status==='Paid'&&includes(businessDate(o.paid_at??o.date,timeZone))),
    expenses:(data.expenses??[]).filter(e=>includes(e.date)),
    losses:(data.movements??[]).filter(m=>m.kind==='writeoff'&&includes(businessDate(m.date,timeZone)))
  };
}

export function financials(data, period) {
  const {sales,expenses,losses}=periodEntries(data,period);
  const revenue = sales.reduce((sum, o) => sum + o.quantity * cents(o.unit_price), 0);
  const cogs = sales.reduce((sum, o) => sum + o.quantity * cents(o.unit_cost), 0);
  const recordedExpenses = expenses.reduce((sum, e) => sum + cents(e.amount), 0);
  const includedCosts = expenses.filter(e => e.included_in_product_cost).reduce((sum, e) => sum + cents(e.amount), 0);
  const overhead = recordedExpenses - includedCosts;
  const incomeTaxPayments=expenses.filter(e=>isIncomeTaxCategory(e.category)&&!e.included_in_product_cost);
  const paidIncomeTax=incomeTaxPayments.reduce((sum,e)=>sum+cents(e.amount),0);
  const writeoffs = losses.reduce((sum, m) => sum - m.delta * cents(m.unit_cost), 0);
  return {
    revenue: revenue / 100, cogs: cogs / 100, gross: (revenue - cogs) / 100,
    overhead: overhead / 100, writeoffs: writeoffs / 100,
    recordedExpenses: recordedExpenses / 100, includedCosts: includedCosts / 100, paidIncomeTax:paidIncomeTax/100, incomeTaxPayments,
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


export function productResults(data,period){
  const {sales,expenses,losses}=periodEntries(data,period);
  const rows=new Map(data.products.map(p=>[p.id,{id:p.id,name:p.name,units:0,revenue:0,gross:0,direct:0}]));
  for(const sale of sales){
    const row=rows.get(sale.product_id);
    if(!row)continue;
    const revenue=sale.quantity*cents(sale.unit_price);
    row.revenue+=revenue;
    row.gross+=revenue-sale.quantity*cents(sale.unit_cost);
    row.units+=sale.quantity;
  }
  for(const expense of expenses){
    const row=rows.get(expense.product_id);
    if(row&&!expense.included_in_product_cost)row.direct+=cents(expense.amount);
  }
  for(const loss of losses){
    const row=rows.get(loss.product_id);
    if(row)row.direct-=loss.delta*cents(loss.unit_cost);
  }
  return [...rows.values()].map(row=>({...row,revenue:row.revenue/100,gross:row.gross/100,
    direct:row.direct/100,profit:(row.gross-row.direct)/100}));
}

export function salesPlan(report, target, product){
  const price=product?cents(product.price):report.units>0?cents(report.revenue)/report.units:0;
  const contribution=product?(product.unit_cost==null?0:price-cents(product.unit_cost)):
    report.units>0?cents(report.gross)/report.units:0;
  const spending=cents(report.overhead)+cents(report.writeoffs);
  const revenueRemaining=Math.max(0,cents(target.amount)-cents(report.revenue));
  const coverRemaining=Math.max(0,-cents(report.net));
  const profitRemaining=Math.max(0,1-cents(report.net));
  return {
    revenueRemaining:revenueRemaining/100,
    unitsRemaining:Math.max(0,target.units-report.units),
    unitsForRevenue:revenueRemaining===0?0:price>0?Math.ceil(revenueRemaining/price):null,
    coverRevenue:contribution>0?Math.ceil(spending/contribution)*price/100:null,
    profitRevenue:contribution>0?(Math.floor(spending/contribution)+1)*price/100:null,
    extraUnitsToCover:coverRemaining===0?0:contribution>0?Math.ceil(coverRemaining/contribution):null,
    extraUnitsToProfit:profitRemaining===0?0:contribution>0?Math.ceil(profitRemaining/contribution):null
  };
}


export function validIncomeTaxRate(rate){
  return rate===null||(isMoney(rate)&&rate<=100);
}

export function incomeTaxPlan(report,rate){
  const paid=cents(report.paidIncomeTax);
  const recordedNet=cents(report.net);
  const beforeTax=recordedNet+paid;
  const estimate=rate==null?null:Math.round(Math.max(0,beforeTax)*Math.round(rate*100)/10000);
  const reserve=estimate===null?null:Math.max(0,estimate-paid);
  return {
    beforeTax:beforeTax/100,
    paid:paid/100,
    estimate:estimate===null?null:estimate/100,
    reserve:reserve===null?null:reserve/100,
    afterTax:reserve===null?null:(recordedNet-reserve)/100
  };
}


const csvCell=value=>{
  const content=typeof value==='number'?value.toFixed(2):String(value??'');
  // Keep descriptions and product names from being interpreted as spreadsheet formulas.
  const safe=typeof value!=='number'&&/^(?:[\t\r\n]|\s*[=+@-])/.test(content)?"'"+content:content;
  return '"'+safe.replaceAll('"','""')+'"';
};

export function financeCsv(data,period){
  const report=financials(data,period);
  const {sales,expenses,losses}=periodEntries(data,period);
  const tax=incomeTaxPlan(report,data.settings?.income_tax_rate);
  const timeZone=data.settings?.time_zone;
  const currency=data.currency??'USD';
  const products=new Map(data.products.map(product=>[product.id,product.name]));
  const rows=[['Period','Currency','Type','Date','Reference','Product','Category','Description','Amount',
    'Product cost','Recorded effect','Estimated effect']];
  const add=(type,date,reference,product,category,description,amount,cost,effect,estimated=effect)=>{
    rows.push([period,currency,type,date,reference,product,category,description,amount,cost,effect,estimated]);
  };
  for(const order of sales){
    const revenue=order.quantity*cents(order.unit_price);
    const cost=order.quantity*cents(order.unit_cost);
    add('Paid sale',businessDate(order.paid_at??order.date,timeZone),'Order '+order.id,products.get(order.product_id),
      order.channel,'',revenue/100,cost/100,(revenue-cost)/100);
  }
  for(const expense of expenses){
    const included=expense.included_in_product_cost;
    add(included?'Expense already in product cost':'Expense',expense.date,'Expense '+expense.id,products.get(expense.product_id),
      expenseCategoryName(expense.category),expense.description,expense.amount,'',included?0:-expense.amount);
  }
  for(const loss of losses){
    const cost=-loss.delta*cents(loss.unit_cost)/100;
    add('Inventory write-off',businessDate(loss.date,timeZone),'Movement '+loss.id,products.get(loss.product_id),'',loss.note,cost,'',-cost);
  }
  if(tax.reserve>0)add('Estimated tax reserve','','','','','',tax.reserve,'',0,-tax.reserve);
  add('Total','','','','','',report.revenue,report.cogs,report.net,tax.afterTax??report.net);
  return '\uFEFF'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n')+'\r\n';
}


export function productTargetReport(data,period){
  const sales=new Map(productResults(data,period).map(row=>[row.id,row]));
  const goals=new Map();
  const monthlyTotals=new Map();
  const quarterly=period.includes('-Q');
  for(const target of data.productTargets??[]){
    if(target.period===period)goals.set(target.product_id,target.units);
    else if(quarterly&&!target.period.includes('-Q')&&quarterFor(target.period)===period){
      monthlyTotals.set(target.product_id,(monthlyTotals.get(target.product_id)??0)+target.units);
    }
  }
  const products=data.products.map(product=>{
    const saved=goals.get(product.id);
    const target=saved??monthlyTotals.get(product.id)??0;
    const actual=sales.get(product.id);
    return {...actual,target,saved,fromMonths:target>0&&saved===undefined,
      remaining:target>0?Math.max(0,target-actual.units):null};
  });
  const tracked=products.filter(product=>product.target>0);
  return {
    products,
    target:tracked.reduce((sum,p)=>sum+p.target,0),
    trackedSold:tracked.reduce((sum,p)=>sum+p.units,0),
    remaining:tracked.reduce((sum,p)=>sum+p.remaining,0),
    totalSold:products.reduce((sum,p)=>sum+p.units,0)
  };
}

export function priceScenario({unitCost,extraCost,margin,fixedCosts,sellingPrice,units}){
  if(![unitCost,extraCost,fixedCosts].every(isMoney)||
     (sellingPrice!==null&&(!isMoney(sellingPrice)||sellingPrice===0))||
     !Number.isInteger(units)||units<1||units>1000000)return null;
  const suggested=pricingPlan(unitCost,extraCost,margin,fixedCosts);
  const price=sellingPrice??suggested?.price;
  if(!price)return null;
  const cost=cents(unitCost)+cents(extraCost);
  const priceCents=cents(price);
  const contribution=priceCents-cost;
  const revenue=priceCents*units;
  const variableCosts=cost*units;
  const totalCosts=variableCosts+cents(fixedCosts);
  if(!Number.isSafeInteger(revenue)||!Number.isSafeInteger(totalCosts))return null;
  return {
    suggestedPrice:suggested?.price??null,
    price, unitCost:cost/100, unitProfit:contribution/100,
    margin:contribution/priceCents,
    revenue:revenue/100,
    variableCosts:variableCosts/100,
    totalCosts:totalCosts/100,
    totalProfit:(revenue-totalCosts)/100,
    breakEvenPrice:Math.ceil(totalCosts/units)/100,
    unitsToCoverCosts:contribution>0?Math.ceil(cents(fixedCosts)/contribution):null
  };
}
