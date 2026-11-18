import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const admin = '10000000-0000-4000-8000-000000000001';
const outlet = '10000000-0000-4000-8000-000000000002';
const buyer = '10000000-0000-4000-8000-000000000003';
const finance = '10000000-0000-4000-8000-000000000004';

async function value(query, params) {
  return (await db.query(query, params)).rows[0].result;
}

const change = (kind, id, version, data) => ({ kind, id, version, data });
const update = (record, data) => change(record.kind, record.id, record.version, data);

async function commit(...changes) {
  return value('select public.warehouse_commit($1::jsonb) as result', [JSON.stringify(changes)]);
}

async function asUser(id) {
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
  await db.exec('set role authenticated');
}

function deliver(action, vendor = null, attempt = null, messageId = null, detail = null) {
  return value('select public.warehouse_vendor_delivery($1,$2,$3,$4,$5,$6) as result',
    ['PO', action, vendor, attempt, messageId, detail]);
}

try {
  await db.exec(`
    create role anon;
    create role authenticated;
    create schema auth;
    create table auth.users(id uuid primary key, email text);
    create function auth.uid() returns uuid stable language sql as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
  `);
  for (const file of ['20261113060000_warehouse_core.sql', '20261118050000_warehouse_costs_and_vendor_delivery.sql']) {
    await db.exec(await readFile(new URL('../supabase/migrations/' + file, import.meta.url), 'utf8'));
  }
  await db.exec(`
    insert into auth.users values
      ('${admin}', 'admin@example.test'), ('${outlet}', 'outlet@example.test'),
      ('${buyer}', 'buyer@example.test'), ('${finance}', 'finance@example.test');
    insert into warehouse_private.profiles values
      ('${admin}', 'admin@example.test', 'Admin', 'Administrator', null, null),
      ('${outlet}', 'outlet@example.test', 'Outlet', 'Outlet', 'Outlet A', 'Kitchen'),
      ('${buyer}', 'buyer@example.test', 'Buyer', 'Purchasing', null, null),
      ('${finance}', 'finance@example.test', 'Finance', 'Cost Control', null, null);
  `);
  const date = await value("select to_char(now() at time zone 'Asia/Jakarta', 'YYYY-MM-DD') as result");
  const period = date.slice(0, 7);
  const nextPeriod = await value("select to_char($1::date + interval '1 month', 'YYYY-MM') as result", [period + '-01']);

  await asUser(admin);
  const stockId = period + ':A';
  const stockData = {
    sku: 'A', period, itemName: 'Item A', unit: 'kg', allowedDepartments: ['Kitchen'], priceBudget: 100000,
    beginningInventory: 10, inbound: 0, outbond: 0, stockOpname: 10, endingInventory: 10,
  };
  let [stock] = await commit(change('stock', stockId, null, stockData));
  assert.equal(stock.data.endingValue, 1000000);

  await asUser(outlet);
  const shipment = {
    id: 'OUT', status: 'Submitted', outletName: 'Outlet A', department: 'Kitchen',
    items: [{ sku: 'A', qty: 10.25, qtyPrepared: 10, price: 120000, subtotal: 1230000 }],
  };
  let [order] = await commit(change('order', shipment.id, null, shipment));
  await assert.rejects(() => deliver('list'), /Akses email vendor ditolak/);

  await asUser(admin);
  [order] = await commit(update(order, { ...order.data, status: 'Siap Dikirim' }));
  [order] = await commit(update(order, { ...order.data, status: 'PO Terkirim' }));
  [order, stock] = await commit(update(order, { ...order.data, status: 'Selesai' }),
    update(stock, { ...stock.data, outbond: 10, endingInventory: 0 }));
  assert.equal(order.data.postedStockCost, 1000000);
  assert.deepEqual(order.data.postedStockCosts, { '1': 1000000 });
  assert.equal(stock.data.endingValue, 0);
  const preReceiptStock = stock;

  const inbound = { id: 'IN', sku: 'A', qty: 10.5, price: 200000, date };
  [, stock] = await commit(change('inbound', inbound.id, null, inbound),
    update(stock, { ...stock.data, inbound: 10.5, inboundValue: 2100000, endingInventory: 10.5 }));
  assert.equal(stock.data.priceActual, 200000);
  assert.equal(stock.data.outbondValue, 1000000);
  assert.equal(stock.data.endingValue, 2100000);
  await assert.rejects(() => commit(update(preReceiptStock, { ...preReceiptStock.data, itemName: 'Stale' })), { code: '40001' });
  [stock] = await commit(update(stock, { ...stock.data, itemName: 'New name', priceBudget: 90000 }));
  assert.equal(stock.data.beginningValue, 1000000);
  assert.equal(stock.data.outbondValue, 1000000);
  assert.equal(stock.data.endingValue, 2100000);
  await assert.rejects(() => commit(update(stock, { ...stock.data, unit: 'g' })), /Satuan SKU/);

  const manual = { id: 'MANUAL', sku: 'A', qty: 2.5, date };
  let manualRecord;
  [manualRecord, stock] = await commit(change('outbound', manual.id, null, manual),
    update(stock, { ...stock.data, outbond: 12.5, endingInventory: 8 }));
  assert.equal(stock.data.outbondValue, 1500000);
  assert.equal(stock.data.endingValue, 1600000);
  [stock] = await commit(update(manualRecord, null), update(stock, { ...stock.data, outbond: 10, endingInventory: 10.5 }));
  assert.equal(stock.data.outbondValue, 1000000);
  assert.equal(stock.data.endingValue, 2100000);

  await asUser(outlet);
  const snapshot = await value('select public.warehouse_snapshot() as result');
  assert.equal(snapshot.find((row) => row.id === shipment.id).data.postedStockCosts, undefined);

  await asUser(admin);
  const nextId = nextPeriod + ':A';
  let [nextStock] = await commit(change('stock', nextId, null, {
    ...stockData, period: nextPeriod, beginningInventory: 8, stockOpname: 8, endingInventory: 8,
  }));
  const count = {
    id: 'SO-' + period, period, conductedDate: date, status: 'Menunggu Review',
    items: [{ sku: 'A', systemStock: 10.5, physicalCount: 10, priceActual: 200000 }],
  };
  let [report] = await commit(change('opname', count.id, null, count));
  await asUser(finance);
  [report] = await commit(update(report, { ...report.data, status: 'Disetujui' }));
  [nextStock, report] = await commit(
    update(nextStock, { ...nextStock.data, beginningInventory: 10, endingInventory: 10 }),
    update(report, { ...report.data, status: 'Finalized (Generated)', nextPeriodGenerated: nextPeriod }));
  assert.equal(nextStock.data.beginningValue, 2000000);
  assert.equal(nextStock.data.endingValue, 2000000);
  assert.equal(report.data.status, 'Finalized (Generated)');

  await asUser(buyer);
  const vendors = ['Alpha', 'Beta'];
  await commit(...vendors.map((name) => change('vendor', name, null, {
    id: name, namaVendor: name, email: name.toLowerCase() + '@example.test',
  })));
  const requested = { ...shipment, id: 'REQUEST', status: 'Submitted' };
  const [request] = await commit(change('order', requested.id, null, requested));
  const items = vendors.map((vendorName) => ({
    sku: 'A', place: 'Outlet A', vendorName, qty: 2.5, price: 100000, total: 250000, unit: 'kg', approvalStatus: 'Pending',
  }));
  let [po] = await commit(change('po', 'PO', null, { id: 'PO', status: 'Draft PO', sourceOrderIds: [request.id], items }),
    update(request, { ...request.data, status: 'PO Generated', poId: 'PO' }));
  [po] = await commit(update(po, { ...po.data, status: 'Vendor Summary' }));
  [po] = await commit(update(po, { ...po.data, status: 'Review Cost Control' }));
  const attempt = '20000000-0000-4000-8000-000000000001';
  const otherAttempt = '20000000-0000-4000-8000-000000000002';
  await assert.rejects(() => deliver('claim', 'Alpha', attempt, null, 'alpha@example.test'), /Rilis PO harus tersimpan/);
  assert.deepEqual(await deliver('list'), []);

  await asUser(finance);
  [po] = await commit(update(po, {
    ...po.data, status: 'Approved by Cost Control', items: items.map((item) => ({ ...item, approvalStatus: 'Approved' })),
    costControlApproval: { status: 'Approved', approvedBy: 'Finance', totalApprovedAmount: 500000 },
  }));
  await asUser(buyer);
  const released = update(po, { ...po.data, status: 'Sent to Receiving' });
  const receipts = items.map((item) => change('receipt', 'R-' + item.vendorName, null, {
    id: 'R-' + item.vendorName, poVendorId: po.id, vendorName: item.vendorName, status: 'Menunggu Kedatangan',
    items: [{ sku: item.sku, unit: item.unit, orderedQty: item.qty, unitPrice: item.price, receivedQty: 0,
      pendingQty: item.qty, totalPrice: 0 }],
  }));
  await assert.rejects(() => commit(released, receipts[0]), /penerimaan per vendor/);
  assert.deepEqual(await deliver('list'), []);
  [po] = await commit(released, ...receipts);
  assert.deepEqual((await deliver('list')).map((job) => [job.vendorName, job.status]), [['Alpha', 'pending'], ['Beta', 'pending']]);
  await assert.rejects(() => deliver('claim', 'Alpha', attempt, null, 'beta@example.test'), /Alamat vendor berubah/);
  const claim = await deliver('claim', 'Alpha', attempt, null, 'alpha@example.test');
  assert.equal(claim.recipient, 'alpha@example.test');
  assert.equal(claim.po.status, 'Sent to Receiving');
  assert.deepEqual(await deliver('claim', 'Alpha', attempt, null, 'alpha@example.test'), claim);
  await assert.rejects(() => deliver('claim', 'Alpha', otherAttempt, null, 'alpha@example.test'), /sudah dikirim atau perlu diperiksa/);
  assert.equal((await deliver('unknown', 'Alpha', attempt, null, 'Mock timeout')).status, 'unknown');
  assert.equal((await deliver('sent', 'Alpha', attempt, 'gmail-test-id', 'PO Alpha')).status, 'sent');
  assert.equal((await deliver('sent', 'Alpha', attempt, 'gmail-test-id', 'PO Alpha')).status, 'sent');
  assert.deepEqual((await deliver('list')).map((job) => [job.vendorName, job.status]), [['Alpha', 'sent'], ['Beta', 'pending']]);

  console.log('Passed PostgreSQL checks for stock valuation, reversals, month close, role checks, PO release and email reservation.');
} finally {
  await db.close();
}
