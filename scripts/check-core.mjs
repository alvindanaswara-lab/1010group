import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { stripTypeScriptTypes } from 'node:module';
import XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import worker from '../worker/index.mjs';

function load(file, names, dependencies = {}) {
  const code = fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8')
    .replace(/^import .*;$/gm, '').replace(/^export /gm, '');
  return vm.runInNewContext(stripTypeScriptTypes(code, { mode: 'transform' }) +
    '\n;({' + names.join(',') + '})', dependencies);
}

const inventory = load('src/utils/inventoryUtils.ts',
  ['roundMoney', 'roundQuantity', 'jakartaDate', 'getNextPeriod', 'normalizeInventoryItem']);
assert.equal(inventory.jakartaDate(new Date('2026-10-31T18:00:00Z')), '2026-11-01');

const { parseSOFile } = load('src/utils/stockOpnameTemplate.ts', ['parseSOFile'], { XLSX });
const stockItems = [
  { sku: 'A', itemName: 'Item A', endingInventory: 10 },
  { sku: 'B', itemName: 'Item B', endingInventory: 2 },
];
function countFile(rows) {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([['SKU', 'Hasil Fisik SO'], ...rows]), 'Stock Opname');
  return new File([XLSX.write(book, { type: 'buffer', bookType: 'xlsx' })], 'opname.xlsx');
}
const validCounts = await parseSOFile(countFile([['A', '2,375'], ['B', 0]]), stockItems);
assert.equal(validCounts.rows[0].physicalCount, 2.375);
assert.equal(validCounts.rows[1].physicalCount, 0);
assert.equal(validCounts.invalidRows, 0);
const incompleteCounts = await parseSOFile(countFile([['A', ''], ['A', 1.2345]]), stockItems);
assert.equal(incompleteCounts.invalidRows, 2);
assert.equal(incompleteCounts.missingSkus.join(','), 'A,B');

const { calculateReceipt } = load('src/utils/receiving.ts', ['calculateReceipt'], inventory);
const line = { sku: 'A', itemName: 'Item A', orderedQty: 10, receivedQty: 0, pendingQty: 10,
  unitPrice: 100000, totalPrice: 0 };
const first = calculateReceipt({ items: [line] }, [
  { lineId: '0', qtyReceived: 4, unitPrice: 100000 },
]);
const second = calculateReceipt({ items: first.items }, [
  { lineId: '0', qtyReceived: 6, unitPrice: 120000 },
]);
assert.equal(second.items[0].totalPrice, 1120000);
assert.equal(second.items[0].unitPrice, 100000);
assert.throws(() => calculateReceipt({ items: second.items }, [
  { lineId: '0', qtyReceived: 1, unitPrice: 100000 },
]));
const split = calculateReceipt({ items: [line, line] }, [
  { lineId: '0', qtyReceived: 0.25, unitPrice: 100000 },
  { lineId: '1', qtyReceived: 2.5, unitPrice: 120000 },
]);
assert.equal(split.items[0].receivedQty, 0.25);
assert.equal(split.items[1].receivedQty, 2.5);

const approval = load('src/utils/purchaseApproval.ts', ['canApprovePO', 'canReleasePO', 'purchaseTerms', 'revisePO']);
const po = { status: 'Review Cost Control', items: [
  { sku: 'A', qty: 2.5, price: 100000, place: 'Outlet A', vendorName: 'Supplier', approvalStatus: 'Approved' },
] };
assert.ok(approval.canApprovePO(po));
const approved = { ...po, status: 'Approved by Cost Control',
  costControlApproval: { status: 'Approved', terms: approval.purchaseTerms(po) } };
assert.ok(approval.canReleasePO(approved));
const modified = { ...approved, items: [{ ...po.items[0], price: 120000 }] };
assert.equal(approval.canReleasePO(modified), false);
const revised = approval.revisePO(approved, modified);
assert.equal(revised.status, 'Vendor Summary');
assert.equal(revised.items[0].approvalStatus, 'Pending');
assert.equal(revised.costControlApproval, undefined);

const { getPOPDFBase64Attachment, generateVendorPOEmailContent } = load(
  'src/utils/pdfExport.ts', ['getPOPDFBase64Attachment', 'generateVendorPOEmailContent'],
  { jsPDF, autoTable, formatDate: String, formatRupiah: String },
);
const twoVendorPO = {
  id: 'PO-SUPPLIERS', sourceOrderIds: [], status: 'Sent to Receiving', generatedDate: '2026-11-01',
  items: ['Alpha', 'Beta'].map((vendorName) => ({
    sku: 'SKU-' + vendorName, itemName: 'Item ' + vendorName, category: 'Dry', unit: 'kg',
    qty: 2.5, price: 100000, vendorName, approvalStatus: 'Approved',
  })),
};
const vendorPDF = getPOPDFBase64Attachment(twoVendorPO, [], 'Alpha');
const pdfText = Buffer.from(vendorPDF.base64Data, 'base64').toString('latin1');
assert.match(pdfText, /SKU-Alpha/);
assert.doesNotMatch(pdfText, /SKU-Beta/);
assert.doesNotMatch(generateVendorPOEmailContent(twoVendorPO, 'Alpha').body, /SKU-Beta/);
assert.throws(() => getPOPDFBase64Attachment(twoVendorPO, [], 'Gamma'), /Vendor tidak memiliki baris/);

const context = fs.readFileSync(new URL('../src/context/AppContext.tsx', import.meta.url), 'utf8');
const close = context.slice(context.indexOf('  const generateFinalSO ='),
  context.indexOf('  // Helper to get combined Master Inventory'));
const periods = {
  '2026-10': [inventory.normalizeInventoryItem({ sku: 'A', beginningInventory: 10 }, '2026-10')],
  '2026-11': [
    inventory.normalizeInventoryItem({ sku: 'A', beginningInventory: 10, inbound: 8, outbond: 3, inboundValue: 800000 }, '2026-11'),
    inventory.normalizeInventoryItem({ sku: 'B', beginningInventory: 2 }, '2026-11'),
  ],
};
const state = {
  ...inventory, EMPTY_INVENTORY: [],
  currentUser: { position: 'Administrator' },
  stockOpnameReports: [{ id: 'SO-2026-10', period: '2026-10', status: 'Disetujui',
    items: [{ sku: 'A', physicalCount: 9.5, systemStock: 10 }] }],
  periodicInventories: periods,
  setPeriodicInventories: (update) => { state.periodicInventories = update(state.periodicInventories); },
  setStockOpnameReports: (update) => { state.stockOpnameReports = update(state.stockOpnameReports); },
  formatRupiah: String, formatPeriodLabel: String, addAuditLog: () => {},
};
const finalize = vm.runInNewContext(stripTypeScriptTypes(close, { mode: 'transform' }) + '\n;generateFinalSO', state);
assert.ok(finalize('2026-10', 'Admin').success);
const nextMonth = state.periodicInventories['2026-11'];
assert.equal(nextMonth[0].beginningInventory, 9.5);
assert.equal(nextMonth[0].inbound, 8);
assert.equal(nextMonth[0].outbond, 3);
assert.equal(nextMonth[0].endingInventory, 14.5);
assert.equal(nextMonth[1].sku, 'B');
assert.ok(finalize('2026-10', 'Admin').success);
assert.strictEqual(state.periodicInventories['2026-11'], nextMonth);

const changes = load('src/lib/warehouseApi.ts', ['changesBetween']);
const previous = [{ kind: 'order', id: '1', version: 8, data: { x: 1, y: 2 } }];
assert.equal(changes.changesBetween(previous, [{ ...previous[0], data: { y: 2, x: 1 } }]).length, 0);
assert.equal(changes.changesBetween(previous, [{ ...previous[0], data: { x: 2, y: 2 } }])[0].version, 8);

const env = { SUPABASE_URL: 'https://example.invalid', SUPABASE_PUBLISHABLE_KEY: 'public' };
assert.equal((await worker.fetch(new Request('https://warehouse.test/api/records'), env)).status, 401);
assert.equal((await worker.fetch(new Request('https://warehouse.test/api/login', {
  method: 'POST', headers: { Origin: 'https://wrong.test' },
}), env)).status, 403);
const originalFetch = globalThis.fetch;
try {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    if (String(url).includes('grant_type=password')) {
      return Response.json({ access_token: 'test-access', refresh_token: 'test-refresh', expires_in: 3600 });
    }
    if (String(url).endsWith('/warehouse_profile')) {
      return Response.json({ id: 'employee', position: 'Outlet' });
    }
    if (String(url).endsWith('/warehouse_vendor_delivery')) return Response.json([]);
    return Response.json({ code: '40001', message: 'Conflict' }, { status: 400 });
  };
  const login = await worker.fetch(new Request('https://warehouse.test/api/login', {
    method: 'POST', headers: { Origin: 'https://warehouse.test' },
    body: JSON.stringify({ email: 'employee@example.test', password: 'fake-pass' }),
  }), env);
  assert.equal(login.status, 200);
  const cookie = login.headers.get('set-cookie');
  assert.match(cookie, /HttpOnly/);
  assert.equal((await login.json()).user.position, 'Outlet');
  assert.equal(calls[1].init.headers.Authorization, 'Bearer test-access');
  const conflict = await worker.fetch(new Request('https://warehouse.test/api/records', {
    method: 'POST', headers: { Origin: 'https://warehouse.test', Cookie: cookie.split(';')[0] },
    body: JSON.stringify({ changes: [] }),
  }), env);
  assert.equal(conflict.status, 409);
  const delivery = await worker.fetch(new Request('https://warehouse.test/api/vendor-delivery', {
    method: 'POST', headers: { Origin: 'https://warehouse.test', Cookie: cookie.split(';')[0] },
    body: JSON.stringify({ poId: 'PO-SUPPLIERS', action: 'list' }),
  }), env);
  assert.equal(delivery.status, 200);
  assert.deepEqual(JSON.parse(calls.at(-1).init.body), {
    po_key: 'PO-SUPPLIERS', action: 'list', vendor_key: null, attempt: null, gmail_id: null, detail: null,
  });
} finally {
  globalThis.fetch = originalFetch;
}
console.log('Passed client and Worker checks for fractional stock counts and receipts, PO approval, supplier-only PDFs, month close, and authenticated routing.');
