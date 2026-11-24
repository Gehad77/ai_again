import { pool } from './db.js';
import { isMoney, expenseEntry, isTargetPeriod, stockChange } from './public/business-model.js';

export async function recordSale(client, order, product) {
  const remaining = product.stock - order.quantity;
  await client.query('UPDATE products SET stock=$1 WHERE id=$2', [remaining, product.id]);
  await client.query(
    "INSERT INTO stock_movements(product_id,order_id,delta,stock_after,kind,unit_cost) VALUES($1,$2,$3,$4,'sale',$5)",
    [product.id, order.id, -order.quantity, remaining, order.unit_cost]
  );
}

export async function businessRoutes(req, res, route, {body, invalid, json}) {
  const product = route.match(/^\/api\/products\/(\d{1,10})(\/stock)?$/);
  if (product && Number(product[1]) > 2147483647) invalid('Invalid product.');
  if ((route === '/api/products' && req.method === 'POST') ||
      (product && !product[2] && req.method === 'PATCH')) {
    const p = await body(req);
    if (typeof p?.name !== 'string' || !p.name.trim() || p.name.length > 120 ||
        typeof p.category !== 'string' || !p.category.trim() || p.category.length > 80 ||
        !isMoney(p.price) || (p.unit_cost != null && !isMoney(p.unit_cost))) {
      invalid('Enter a valid name, category, price and unit cost.');
    }
    const fields = [p.name.trim(), p.category.trim(), p.price, p.unit_cost ?? null];
    if (product) {
      const result = await pool.query(
        'UPDATE products SET name=$1,category=$2,price=$3,unit_cost=$4 WHERE id=$5 RETURNING *',
        [...fields, product[1]]
      );
      return json(res, result.rowCount ? 200 : 404, result.rows[0] ?? {error:'Product not found.'});
    }
    if (!Number.isInteger(p.stock) || p.stock < 0 || p.stock > 2147483647) invalid('Enter valid opening stock.');
    const result = await pool.query(`
      WITH added AS (
        INSERT INTO products(id,name,category,price,unit_cost,stock,emoji,color)
        VALUES(nextval('product_ids'),$1,$2,$3,$4,$5,'◇','#e5eee6') RETURNING *
      ), movement AS (
        INSERT INTO stock_movements(product_id,delta,stock_after,kind,unit_cost)
        SELECT id,stock,stock,'opening',unit_cost FROM added WHERE stock>0
      ) SELECT * FROM added`, [...fields, p.stock]);
    return json(res, 201, result.rows[0]);
  }
  if (product?.[2] && req.method === 'POST') {
    const p = await body(req);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const current = (await client.query('SELECT * FROM products WHERE id=$1 FOR UPDATE', [product[1]])).rows[0];
      if (!current) throw Object.assign(Error('Product not found.'), {status:404});
      let movement;
      try { movement = stockChange(current, p); } catch (error) { invalid(error.message); }
      await client.query('UPDATE products SET stock=$1 WHERE id=$2', [movement.stock_after, current.id]);
      const result = await client.query(
        'INSERT INTO stock_movements(product_id,delta,stock_after,kind,note,unit_cost) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',
        [current.id, movement.delta, movement.stock_after, movement.kind, movement.note, movement.unit_cost]
      );
      await client.query('COMMIT');
      return json(res, 201, result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  const expense = route.match(/^\/api\/expenses\/(\d{1,10})$/);
  const expenseId = expense && Number(expense[1]) <= 2147483647 ? Number(expense[1]) : null;
  const editingExpense = expenseId !== null && req.method === 'PATCH';
  if ((route === '/api/expenses' && req.method === 'POST') || editingExpense) {
    const payload = await body(req);
    let entry;
    try { entry = expenseEntry(payload); } catch (error) { invalid(error.message); }
    const fields=[entry.description,entry.amount,entry.date,entry.category,entry.product_id,entry.included_in_product_cost];
    const returning='RETURNING id,description,amount,date::text,category,product_id,included_in_product_cost';
    try {
      const result=editingExpense?
        await pool.query(`UPDATE operating_expenses SET description=$1,amount=$2,date=$3,category=$4,
          product_id=$5,included_in_product_cost=$6 WHERE id=$7 ${returning}`,[...fields,expenseId]):
        await pool.query(`INSERT INTO operating_expenses(description,amount,date,category,product_id,included_in_product_cost)
        VALUES($1,$2,$3,$4,$5,$6) ${returning}`,fields);
      if(!result.rowCount)return json(res,404,{error:'Expense not found.'});
      return json(res,editingExpense?200:201,result.rows[0]);
    } catch (error) {
      if (error.code === '23503') invalid('Choose an existing product.');
      throw error;
    }
  }
  if (expenseId !== null && req.method === 'DELETE') {
    const result = await pool.query('DELETE FROM operating_expenses WHERE id=$1', [expenseId]);
    return json(res, result.rowCount ? 200 : 404, result.rowCount ? {ok:true} : {error:'Expense not found.'});
  }
  if (route === '/api/targets' && req.method === 'PUT') {
    const p = await body(req);
    if (!isTargetPeriod(p?.period) || !isMoney(p.amount) ||
        (p.units !== undefined && (!Number.isInteger(p.units) || p.units < 0 || p.units > 2147483647))) {
      invalid('Enter a valid period, revenue target and whole-number unit target.');
    }
    await pool.query(`INSERT INTO sales_targets(period,amount,units) VALUES($1,$2,COALESCE($3::int,0))
      ON CONFLICT(period) DO UPDATE SET amount=EXCLUDED.amount,units=COALESCE($3::int,sales_targets.units)`,
      [p.period, p.amount, p.units??null]);
    return json(res, 200, {ok:true});
  }
}
