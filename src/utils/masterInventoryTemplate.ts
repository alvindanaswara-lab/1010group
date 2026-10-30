import * as XLSX from 'xlsx';
import { InventoryItem, ItemCategory, DepartmentName, ITEM_CATEGORIES } from '../types';
import { formatPeriodLabel, normalizeInventoryItem } from './inventoryUtils';

export interface RawMasterInventoryRow {
  sku: string;
  itemName: string;
  category: string;
  allowedDepartments: string[];
  vendor?: string;
  unit: string;
  priceBudget: number;
  priceActual: number;
  beginningInventory: number;
  inbound: number;
  outbond: number;
  minStock: number;
  isValid: boolean;
  errorMessage?: string;
}

export interface MasterInventoryParseResult {
  fileName: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  items: InventoryItem[];
  rawRows: RawMasterInventoryRow[];
  errors: string[];
}

/**
 * Downloads a pre-formatted Excel template (.xlsx) for Master Inventory import.
 */
export function downloadMasterInventoryTemplate(periodKey: string = '2026-10') {
  const periodLabel = formatPeriodLabel(periodKey);
  const fileName = `Template_Master_Inventory_${periodKey}.xlsx`;

  // Sample data to guide users on formatting
  const sampleData = [
    {
      'SKU *': 'DRY-001',
      'Nama Barang *': 'Beras Premium Ramos 25kg',
      'Kategori *': 'Dry Item',
      'Departemen Pengguna': 'Kitchen, Floor & Operations',
      'Vendor Terkait': 'PT Sumber Beras Abadi',
      'Satuan *': 'Karung',
      'Price Budget (Rp) *': 320000,
      'Price Actual (Rp)': 325000,
      'Beginning Inventory (Stok Awal)': 40,
      'Inbound Usage (Masuk)': 20,
      'Outbond Usage (Keluar)': 15,
      'Minimum Stok': 10,
    },
    {
      'SKU *': 'DRK-001',
      'Nama Barang *': 'Sirup Vanilla Monin 700ml',
      'Kategori *': 'Drinks',
      'Departemen Pengguna': 'Bar',
      'Vendor Terkait': 'PT Makmur Jaya Rasa',
      'Satuan *': 'Botol',
      'Price Budget (Rp) *': 145000,
      'Price Actual (Rp)': 142000,
      'Beginning Inventory (Stok Awal)': 24,
      'Inbound Usage (Masuk)': 12,
      'Outbond Usage (Keluar)': 8,
      'Minimum Stok': 6,
    },
    {
      'SKU *': 'DAI-001',
      'Nama Barang *': 'Fresh Milk Greenfields 1 Liter',
      'Kategori *': 'Dairy & Frozen',
      'Departemen Pengguna': 'Bar, Kitchen, Pastry',
      'Vendor Terkait': 'PT Greenfields Dairy Indonesia',
      'Satuan *': 'Liter',
      'Price Budget (Rp) *': 28500,
      'Price Actual (Rp)': 29000,
      'Beginning Inventory (Stok Awal)': 60,
      'Inbound Usage (Masuk)': 40,
      'Outbond Usage (Keluar)': 35,
      'Minimum Stok': 20,
    },
    {
      'SKU *': 'PKG-001',
      'Nama Barang *': 'Paper Cup Hot 8oz Craft (isi 50)',
      'Kategori *': 'Packaging',
      'Departemen Pengguna': 'Bar, Floor & Operations',
      'Vendor Terkait': 'CV Kemasan Prima Sentosa',
      'Satuan *': 'Pack',
      'Price Budget (Rp) *': 42000,
      'Price Actual (Rp)': 41500,
      'Beginning Inventory (Stok Awal)': 50,
      'Inbound Usage (Masuk)': 30,
      'Outbond Usage (Keluar)': 25,
      'Minimum Stok': 15,
    },
    {
      'SKU *': 'FRZ-001',
      'Nama Barang *': 'French Fries Shoestring McCain 2.5kg',
      'Kategori *': 'Dairy & Frozen',
      'Departemen Pengguna': 'Kitchen',
      'Vendor Terkait': 'PT Sukanda Djaya',
      'Satuan *': 'Pack',
      'Price Budget (Rp) *': 88000,
      'Price Actual (Rp)': 89500,
      'Beginning Inventory (Stok Awal)': 35,
      'Inbound Usage (Masuk)': 20,
      'Outbond Usage (Keluar)': 18,
      'Minimum Stok': 10,
    },
    {
      'SKU *': 'VEG-001',
      'Nama Barang *': 'Bawang Bombay Karungan 10kg',
      'Kategori *': 'Vegetables',
      'Departemen Pengguna': 'Kitchen',
      'Vendor Terkait': 'CV Sayur Segar Cisarua',
      'Satuan *': 'Karung',
      'Price Budget (Rp) *': 180000,
      'Price Actual (Rp)': 175000,
      'Beginning Inventory (Stok Awal)': 15,
      'Inbound Usage (Masuk)': 10,
      'Outbond Usage (Keluar)': 8,
      'Minimum Stok': 5,
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleData);

  // Column width settings
  worksheet['!cols'] = [
    { wch: 14 }, // SKU
    { wch: 38 }, // Nama Barang
    { wch: 18 }, // Kategori
    { wch: 28 }, // Departemen Pengguna
    { wch: 26 }, // Vendor Terkait
    { wch: 12 }, // Satuan
    { wch: 18 }, // Price Budget
    { wch: 18 }, // Price Actual
    { wch: 28 }, // Beginning Inventory
    { wch: 22 }, // Inbound
    { wch: 22 }, // Outbond
    { wch: 14 }, // Min Stok
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Master Inventory');

  // Petunjuk sheet
  const instructionData = [
    { 'PETUNJUK PENGISIAN TEMPLATE MASTER INVENTORY': 'PANDUAN LENGKAP PENGISIAN' },
    { 'PETUNJUK PENGISIAN TEMPLATE MASTER INVENTORY': `1. Template dibuat untuk periode import: ${periodLabel} (${periodKey}).` },
    { 'PETUNJUK PENGISIAN TEMPLATE MASTER INVENTORY': '2. Kolom bertanda (*) WAJIB diisi (SKU, Nama Barang, Kategori, Satuan, Price Budget).' },
    { 'PETUNJUK PENGISIAN TEMPLATE MASTER INVENTORY': '3. SKU harus unik untuk setiap item barang (contoh: DRY-001, DRK-002, PKG-010).' },
    { 'PETUNJUK PENGISIAN TEMPLATE MASTER INVENTORY': `4. Kategori yang valid: ${ITEM_CATEGORIES.join(', ')}.` },
    { 'PETUNJUK PENGISIAN TEMPLATE MASTER INVENTORY': '5. Departemen Pengguna yang valid: Kitchen, Bar, Pastry, Floor & Operations.' },
    { 'PETUNJUK PENGISIAN TEMPLATE MASTER INVENTORY': '6. Harga dan Stok diisi angka tanpa simbol mata uang (contoh: 25000, bukan Rp 25.000).' },
    { 'PETUNJUK PENGISIAN TEMPLATE MASTER INVENTORY': '7. Anda dapat menghapus baris contoh sebelum mengunggah berkas data Anda.' },
    { 'PETUNJUK PENGISIAN TEMPLATE MASTER INVENTORY': '8. Simpan file dalam format .xlsx atau .csv lalu upload melalui tombol "Upload Master Inventory".' },
  ];
  const instructionSheet = XLSX.utils.json_to_sheet(instructionData);
  instructionSheet['!cols'] = [{ wch: 90 }];
  XLSX.utils.book_append_sheet(workbook, instructionSheet, 'Petunjuk Pengisian');

  XLSX.writeFile(workbook, fileName);
}

/**
 * Parses numeric value from cell safely (supports Indonesian thousand separators e.g. "320.000", "Rp 28.500")
 */
export function parseNumber(val: any, fallback: number = 0): number {
  if (val === undefined || val === null || val === '') return fallback;
  if (typeof val === 'number') return isNaN(val) ? fallback : val;
  let str = String(val).trim();
  if (!str) return fallback;

  str = str.replace(/[^0-9.,-]/g, '');
  if (!str) return fallback;

  if (str.includes('.') && str.includes(',')) {
    const lastDot = str.lastIndexOf('.');
    const lastComma = str.lastIndexOf(',');
    if (lastComma > lastDot) {
      // Format ID/EU: 1.250.000,00
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      // Format US: 1,250,000.00
      str = str.replace(/,/g, '');
    }
  } else if (str.includes('.')) {
    const parts = str.split('.');
    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
      str = str.replace(/\./g, '');
    }
  } else if (str.includes(',')) {
    const parts = str.split(',');
    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
      str = str.replace(/,/g, '');
    } else {
      str = str.replace(',', '.');
    }
  }

  const num = parseFloat(str);
  return isNaN(num) ? fallback : num;
}

/**
 * Normalizes category string to valid ItemCategory while preserving custom category names from Master Inventory
 */
export function normalizeCategory(catStr: string): ItemCategory {
  if (!catStr || !catStr.trim()) return 'Dry Item';
  const rawTrimmed = catStr.trim();
  const clean = rawTrimmed.toLowerCase();
  const found = ITEM_CATEGORIES.find((c) => c.toLowerCase() === clean);
  if (found) return found;

  if (clean.includes('frozen') || clean.includes('beku') || clean.includes('dairy') || clean.includes('susu') || clean.includes('keju')) return 'Dairy & Frozen';
  if (clean.includes('fresh') || clean.includes('sayur') || clean.includes('vegetable')) return 'Vegetables';
  if (clean.includes('pack') || clean.includes('kemasan')) return 'Packaging';
  if (clean.includes('bev') || clean.includes('minuman') || clean.includes('drink') || clean.includes('kopi') || clean.includes('coffee') || clean.includes('tea') || clean.includes('teh') || clean.includes('syrup') || clean.includes('sirup')) return 'Drinks';
  if (clean.includes('meat') || clean.includes('daging') || clean.includes('ayam') || clean.includes('poultry') || clean.includes('butcher') || clean.includes('sea') || clean.includes('ikan') || clean.includes('udang')) return 'Butcher';
  if (clean.includes('bake') || clean.includes('roti') || clean.includes('pastry') || clean.includes('cake')) return 'Baked Item';
  if (clean.includes('gas') || clean.includes('lpg')) return 'Gas';
  if (clean.includes('other') || clean.includes('expense') || clean.includes('chem') || clean.includes('sabun') || clean.includes('clean') || clean.includes('biaya')) return 'Other Expense';
  if (clean.includes('dry') || clean.includes('kering') || clean.includes('sembako') || clean.includes('bumbu')) return 'Dry Item';

  return rawTrimmed as ItemCategory;
}

/**
 * Normalizes departments from comma separated string
 */
function parseDepartments(depStr: any): DepartmentName[] {
  if (!depStr) return ['Kitchen'];
  const rawList = String(depStr)
    .split(/[,;/]+/)
    .map((s) => s.trim().toLowerCase());

  const result: DepartmentName[] = [];
  for (const item of rawList) {
    if ((item.includes('bar') || item.includes('beverage')) && !result.includes('Bar')) {
      result.push('Bar');
    } else if (item.includes('pastry') && !result.includes('Pastry')) {
      result.push('Pastry');
    } else if ((item.includes('floor') || item.includes('operation') || item.includes('storage') || item.includes('gudang') || item.includes('service')) && !result.includes('Floor & Operations')) {
      result.push('Floor & Operations');
    } else if ((item.includes('kitchen') || item.includes('dapur') || item.includes('cook')) && !result.includes('Kitchen')) {
      result.push('Kitchen');
    }
  }

  return result.length > 0 ? result : ['Kitchen'];
}

/**
 * Parses an uploaded Master Inventory file (.xlsx, .xls, .csv).
 */
export async function parseMasterInventoryFile(
  file: File,
  targetPeriod: string = '2026-10'
): Promise<MasterInventoryParseResult> {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array' });

  // Look for sheet named 'Master Inventory' or use first sheet
  const sheetName =
    workbook.SheetNames.find(
      (n) => n.toLowerCase().includes('master') || n.toLowerCase().includes('inventory') || n.toLowerCase().includes('barang')
    ) || workbook.SheetNames[0];

  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) {
    throw new Error('Sheet data tidak ditemukan pada file yang diunggah.');
  }

  // Detect header row automatically if there are title rows at the top of the sheet
  const matrix: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
  let headerRowIdx = 0;
  for (let r = 0; r < Math.min(matrix.length, 20); r++) {
    const rowCells = (matrix[r] || []).map((c) => String(c || '').toLowerCase().trim());
    const hasSku = rowCells.some((c) => c.includes('sku') || c.includes('kode'));
    const hasNameOrCat = rowCells.some(
      (c) => c.includes('nama') || c.includes('item') || c.includes('category') || c.includes('kategori')
    );
    if (hasSku && hasNameOrCat) {
      headerRowIdx = r;
      break;
    }
  }

  // Convert to array of objects starting from detected header row
  const rawJson: any[] = XLSX.utils.sheet_to_json(worksheet, {
    range: headerRowIdx,
    defval: '',
  });
  if (!rawJson || rawJson.length === 0) {
    throw new Error('File tidak memiliki data atau baris kosong.');
  }

  const rawRows: RawMasterInventoryRow[] = [];
  const validItems: InventoryItem[] = [];
  const errors: string[] = [];
  const seenSKUs = new Set<string>();

  rawJson.forEach((row, idx) => {
    const keys = Object.keys(row);
    const cleanKeyStr = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

    // Priority-aware key matcher: checks exact match first in match priority order, then substring match
    const getKey = (...matches: string[]) => {
      for (const m of matches) {
        const cleanM = cleanKeyStr(m);
        const exact = keys.find((k) => cleanKeyStr(k) === cleanM);
        if (exact) return exact;
      }
      for (const m of matches) {
        const cleanM = cleanKeyStr(m);
        const partial = keys.find((k) => cleanKeyStr(k).includes(cleanM));
        if (partial) return partial;
      }
      return undefined;
    };

    const skuKey = getKey('sku', 'skubarang', 'kodesku', 'kodebarang', 'itemcode', 'kode');
    const nameKey = getKey('itemname', 'namabarang', 'namaitem', 'nama', 'barang');
    const catKey = getKey('category', 'kategori', 'kategoribarang', 'itemcategory', 'kat');
    const unitKey = getKey('unit', 'satuan', 'uom');
    const budgetKey = getKey(
      'pricebudget',
      'pricebudgetrp',
      'hargabudget',
      'standardprice',
      'budget',
      'hargasatuan',
      'harga',
      'price'
    );
    const actualKey = getKey('priceactual', 'priceactualrp', 'hargaaktual', 'actualprice', 'actual', 'hargabeli');
    const beginKey = getKey('beginningusage', 'beginninginventoryusage', 'beginninginventory', 'stokawal', 'beginning', 'stokbuku');
    const inKey = getKey('inboundusage', 'inbound', 'masuk');
    const outKey = getKey('outbondusage', 'outbond', 'keluar');
    const minKey = getKey('minimumstok', 'minstock', 'safetystock');
    const depKey = getKey('departemenpengguna', 'departemen', 'department', 'allowed');
    const vendorKey = getKey('vendorterkait', 'vendor', 'supplier', 'suplier', 'pemasok', 'namavendor');

    const skuRaw = skuKey ? String(row[skuKey]).trim() : '';
    const nameRaw = nameKey ? String(row[nameKey]).trim() : '';
    const catRaw = catKey ? String(row[catKey]).trim() : 'Dry Item';
    const unitRaw = unitKey ? String(row[unitKey]).trim() : 'Pcs';

    // Skip completely empty rows
    if (!skuRaw && !nameRaw) {
      return;
    }

    const priceBudget = budgetKey ? parseNumber(row[budgetKey], 0) : 0;
    const priceActual = actualKey ? parseNumber(row[actualKey], priceBudget) : priceBudget;
    const beginningInventory = beginKey ? parseNumber(row[beginKey], 0) : 0;
    const inbound = inKey ? parseNumber(row[inKey], 0) : 0;
    const outbond = outKey ? parseNumber(row[outKey], 0) : 0;
    const minStock = minKey ? parseNumber(row[minKey], 10) : 10;
    const allowedDepartments = depKey ? parseDepartments(row[depKey]) : ['Kitchen'];
    const vendor = vendorKey ? String(row[vendorKey]).trim() : '';

    // Validation
    let isValid = true;
    let errorMessage = '';

    if (!skuRaw) {
      isValid = false;
      errorMessage = 'SKU tidak boleh kosong';
    } else if (seenSKUs.has(skuRaw.toUpperCase())) {
      isValid = false;
      errorMessage = `SKU duplikat (${skuRaw}) terdeteksi pada file`;
    } else if (!nameRaw) {
      isValid = false;
      errorMessage = 'Nama Barang tidak boleh kosong';
    } else if (priceBudget <= 0 && priceActual <= 0) {
      isValid = false;
      errorMessage = 'Harga Budget atau Aktual harus lebih dari 0';
    }

    if (isValid) {
      seenSKUs.add(skuRaw.toUpperCase());
    }

    const resolvedBudget = priceBudget > 0 ? priceBudget : priceActual;
    const resolvedActual = priceActual > 0 ? priceActual : priceBudget;

    const rowObj: RawMasterInventoryRow = {
      sku: skuRaw || `BARIS-${idx + 1}`,
      itemName: nameRaw || `Tanpa Nama (Baris ${idx + 1})`,
      category: normalizeCategory(catRaw),
      allowedDepartments,
      vendor,
      unit: unitRaw || 'Pcs',
      priceBudget: resolvedBudget,
      priceActual: resolvedActual,
      beginningInventory,
      inbound,
      outbond,
      minStock,
      isValid,
      errorMessage,
    };

    rawRows.push(rowObj);

    if (isValid) {
      const normalized = normalizeInventoryItem(
        {
          sku: rowObj.sku,
          itemName: rowObj.itemName,
          category: rowObj.category as ItemCategory,
          unit: rowObj.unit,
          price: rowObj.priceBudget,
          priceBudget: rowObj.priceBudget,
          priceActual: rowObj.priceActual,
          beginningInventory: rowObj.beginningInventory,
          inbound: rowObj.inbound,
          outbond: rowObj.outbond,
          stockOpname: 0,
          soValue: 0,
          minStock: rowObj.minStock,
          allowedDepartments: rowObj.allowedDepartments as DepartmentName[],
          vendor: rowObj.vendor,
          period: targetPeriod,
        },
        targetPeriod
      );
      validItems.push(normalized);
    } else {
      errors.push(`Baris ${idx + headerRowIdx + 2}: ${errorMessage}`);
    }
  });

  const validRows = validItems.length;
  const invalidRows = rawRows.length - validRows;

  return {
    fileName: file.name,
    totalRows: rawRows.length,
    validRows,
    invalidRows,
    items: validItems,
    rawRows,
    errors,
  };
}
