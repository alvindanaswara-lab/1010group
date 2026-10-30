import * as XLSX from 'xlsx';
import { InventoryItem, OutletData, DepartmentName, ItemCategory, OrderItem, OutletOrder } from '../types';
import { formatDate, getTodayFormatted } from './dateUtils';
import { parseNumber, normalizeCategory } from './masterInventoryTemplate';

export interface RawPRRow {
  rowNumber: number;
  outletName: string;
  department: string;
  dateRequested: string;
  picName: string;
  sku: string;
  itemName: string;
  category: ItemCategory;
  qty: number;
  unit: string;
  price: number;
  itemNotes: string;
  formNotes: string;
  matchedFromMaster?: boolean;
  isValid: boolean;
  errors: string[];
}

export interface PRParseResult {
  fileName: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  orders: Omit<OutletOrder, 'createdAt' | 'updatedAt'>[];
  rawRows: RawPRRow[];
  errors: string[];
  warnings: string[];
}

/**
 * Finds the matching Master Inventory item by SKU (with flexible normalization) or fallback by Item Name.
 * Ensures Category is read from Master Inventory (Category) and Price is read from Master Inventory (Price Budget).
 */
export function findInventoryItemBySku(
  rawSku: string,
  rawItemName: string,
  inventory: InventoryItem[]
): InventoryItem | undefined {
  if (!inventory || inventory.length === 0) return undefined;

  const skuClean = String(rawSku || '').trim();
  const skuUpper = skuClean.toUpperCase();

  if (skuUpper) {
    // 1. Exact case-insensitive SKU match
    const exactMatch = inventory.find((i) => i.sku.trim().toUpperCase() === skuUpper);
    if (exactMatch) return exactMatch;

    // 2. Alphanumeric normalized SKU match (ignores spaces, dashes, underscores, dots, slashes)
    const normStr = (s: string) => s.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const targetNorm = normStr(skuUpper);
    if (targetNorm) {
      const normMatch = inventory.find((i) => normStr(i.sku) === targetNorm);
      if (normMatch) return normMatch;
    }

    // 3. Prefix + integer sequence match (e.g. "DRY-1" or "DRY-01" matches "DRY-001")
    const prefixNumMatch = skuUpper.match(/^([A-Z]+)[^A-Z0-9]*0*(\d+)$/);
    if (prefixNumMatch) {
      const targetPrefix = prefixNumMatch[1];
      const targetNum = parseInt(prefixNumMatch[2], 10);
      const seqMatch = inventory.find((i) => {
        const m = i.sku.trim().toUpperCase().match(/^([A-Z]+)[^A-Z0-9]*0*(\d+)$/);
        return m && m[1] === targetPrefix && parseInt(m[2], 10) === targetNum;
      });
      if (seqMatch) return seqMatch;
    }
  }

  // 4. Fallback by exact Item Name match if SKU was slightly different
  const nameClean = String(rawItemName || '').trim().toLowerCase();
  if (nameClean) {
    const nameMatch = inventory.find((i) => i.itemName.trim().toLowerCase() === nameClean);
    if (nameMatch) return nameMatch;
  }

  return undefined;
}

/**
 * Normalizes user-inputted department name to canonical DepartmentName
 */
export function normalizeDepartment(val: string): DepartmentName | null {
  if (!val) return null;
  const clean = val.trim().toLowerCase();
  if (clean.includes('kitchen') || clean.includes('dapur')) return 'Kitchen';
  if (clean.includes('bar') || clean.includes('beverage') || clean.includes('minum')) return 'Bar';
  if (clean.includes('pastry') || clean.includes('bakery') || clean.includes('roti')) return 'Pastry';
  if (clean.includes('floor') || clean.includes('oper') || clean.includes('service') || clean.includes('depan')) {
    return 'Floor & Operations';
  }
  return null;
}

/**
 * Parses and formats date (including DD/MM/YYYY) into internal standard YYYY-MM-DD
 */
export function parseExcelDate(val: any): string {
  if (val === undefined || val === null || String(val).trim() === '') {
    return new Date().toISOString().slice(0, 10);
  }

  if (val instanceof Date && !isNaN(val.getTime())) {
    return val.toISOString().slice(0, 10);
  }

  // If it's an Excel numeric serial date (either number or numeric string e.g. 46323)
  const numVal = typeof val === 'number' ? val : Number(String(val).trim());
  if (!isNaN(numVal) && numVal > 20000 && numVal < 80000 && /^\d+(\.\d+)?$/.test(String(val).trim())) {
    const dateObj = new Date(Math.round((numVal - 25569) * 86400 * 1000));
    if (!isNaN(dateObj.getTime())) {
      return dateObj.toISOString().slice(0, 10);
    }
  }

  const str = String(val).trim();

  // If already YYYY-MM-DD or YYYY/MM/DD
  const ymdMatch = str.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (ymdMatch) {
    const y = ymdMatch[1];
    const m = ymdMatch[2].padStart(2, '0');
    const d = ymdMatch[3].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // If DD/MM/YYYY, D/M/YYYY, DD-MM-YYYY, DD.MM.YYYY, or DD/MM/YY
  const partsDmy = str.split(/[\/.\-]/);
  if (partsDmy.length === 3) {
    if (partsDmy[0].length <= 2 && partsDmy[1].length <= 2 && (partsDmy[2].length === 4 || partsDmy[2].length === 2)) {
      const d = partsDmy[0].padStart(2, '0');
      const m = partsDmy[1].padStart(2, '0');
      const y = partsDmy[2].length === 2 ? `20${partsDmy[2]}` : partsDmy[2];
      return `${y}-${m}-${d}`;
    }
  }

  // Fallback try standard Date parse
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return new Date().toISOString().slice(0, 10);
}

/**
 * Downloads a pre-formatted Excel template (.xlsx) for Form PR Outlet.
 * Format Kolom: TANGGAL(DD/MM/YYYY), NAMA OUTLET, DEPARTMENT, SKU, NAMA BARANG, JUMLAH DIPESAN, SATUAN
 */
export function downloadPROutletTemplate(inventory: InventoryItem[] = [], outlets: OutletData[] = []) {
  const fileName = `Template_Form_PR_Outlet.xlsx`;
  const todayDmy = getTodayFormatted();

  // Sample data following exact requested columns:
  // TANGGAL(DD/MM/YYYY), NAMA OUTLET, DEPARTMENT, SKU, NAMA BARANG, JUMLAH DIPESAN, SATUAN
  const sampleData = [
    {
      'TANGGAL(DD/MM/YYYY)': todayDmy,
      'NAMA OUTLET': outlets[0]?.namaOutlet || 'Resto Senopati',
      'DEPARTMENT': 'Kitchen',
      'SKU': inventory[0]?.sku || 'DRY-001',
      'NAMA BARANG': inventory[0]?.itemName || 'Beras Premium Ramos 25kg',
      'JUMLAH DIPESAN': 5,
      'SATUAN': inventory[0]?.unit || 'Karung',
    },
    {
      'TANGGAL(DD/MM/YYYY)': todayDmy,
      'NAMA OUTLET': outlets[0]?.namaOutlet || 'Resto Senopati',
      'DEPARTMENT': 'Kitchen',
      'SKU': inventory[1]?.sku || 'DAI-001',
      'NAMA BARANG': inventory[1]?.itemName || 'Fresh Milk Greenfields 1 Liter',
      'JUMLAH DIPESAN': 12,
      'SATUAN': inventory[1]?.unit || 'Liter',
    },
    {
      'TANGGAL(DD/MM/YYYY)': todayDmy,
      'NAMA OUTLET': outlets[1]?.namaOutlet || outlets[0]?.namaOutlet || 'Cafe Menteng',
      'DEPARTMENT': 'Bar',
      'SKU': inventory[2]?.sku || 'DRK-001',
      'NAMA BARANG': inventory[2]?.itemName || 'Sirup Vanilla Monin 700ml',
      'JUMLAH DIPESAN': 4,
      'SATUAN': inventory[2]?.unit || 'Botol',
    },
  ];

  const workbook = XLSX.utils.book_new();

  // Sheet 1: Form PR Outlet
  const wsPR = XLSX.utils.json_to_sheet(sampleData);
  wsPR['!cols'] = [
    { wch: 22 }, // TANGGAL(DD/MM/YYYY)
    { wch: 24 }, // NAMA OUTLET
    { wch: 20 }, // DEPARTMENT
    { wch: 16 }, // SKU
    { wch: 34 }, // NAMA BARANG
    { wch: 18 }, // JUMLAH DIPESAN
    { wch: 14 }, // SATUAN
  ];
  XLSX.utils.book_append_sheet(workbook, wsPR, 'Form_PR_Outlet');

  // Sheet 2: Daftar Barang Master Inventory
  const inventoryRefData = inventory.map((item, idx) => ({
    No: idx + 1,
    'SKU': item.sku,
    'Item Name': item.itemName,
    'Category (Master Inventory)': item.category,
    'Unit': item.unit,
    'Price Budget (Master Inventory)': item.priceBudget ?? item.price ?? 0,
    'Stok Gudang Saat Ini': item.endingInventory,
    'Vendor Terkait': item.vendor || '-',
  }));

  const wsInv = XLSX.utils.json_to_sheet(
    inventoryRefData.length > 0
      ? inventoryRefData
      : [
          {
            No: 1,
            'SKU': 'DRY-001',
            'Item Name': 'Beras Ramos 25kg',
            'Category (Master Inventory)': 'Dry Item',
            'Unit': 'Karung',
            'Price Budget (Master Inventory)': 320000,
            'Stok Gudang Saat Ini': 50,
            'Vendor Terkait': 'PT Sumber Pangan',
          },
        ]
  );
  wsInv['!cols'] = [
    { wch: 6 },
    { wch: 16 },
    { wch: 34 },
    { wch: 26 },
    { wch: 12 },
    { wch: 28 },
    { wch: 20 },
    { wch: 28 },
  ];
  XLSX.utils.book_append_sheet(workbook, wsInv, 'Referensi_Master_Barang');

  // Sheet 3: Referensi Outlet & Departemen
  const outletDeptData = outlets.map((o, idx) => ({
    No: idx + 1,
    'Nama Outlet Valid': o.namaOutlet,
    'Lokasi': o.location,
    'Departemen yang Tersedia': o.department.join(', '),
  }));

  const wsOutlet = XLSX.utils.json_to_sheet(
    outletDeptData.length > 0
      ? outletDeptData
      : [
          {
            No: 1,
            'Nama Outlet Valid': 'Resto Senopati',
            'Lokasi': 'Jakarta Selatan',
            'Departemen yang Tersedia': 'Kitchen, Bar, Pastry, Floor & Operations',
          },
        ]
  );
  wsOutlet['!cols'] = [{ wch: 6 }, { wch: 24 }, { wch: 20 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(workbook, wsOutlet, 'Referensi_Outlet_Dept');

  // Sheet 4: Petunjuk Pengisian
  const instructions = [
    {
      'Petunjuk Pengisian Form PR Outlet':
        '1. Format kolom wajib pada sheet Form_PR_Outlet: TANGGAL(DD/MM/YYYY), NAMA OUTLET, DEPARTMENT, SKU, NAMA BARANG, JUMLAH DIPESAN, SATUAN.',
    },
    {
      'Petunjuk Pengisian Form PR Outlet':
        '2. Baris yang memiliki TANGGAL, NAMA OUTLET, dan DEPARTMENT yang sama akan otomatis digabung menjadi 1 formulir Form PR.',
    },
    {
      'Petunjuk Pengisian Form PR Outlet':
        '3. Kolom Kategori otomatis terisi sesuai kode SKU pada Master Inventory (Category), dan Harga otomatis terisi sesuai kode SKU pada Master Inventory (Price Budget).',
    },
    {
      'Petunjuk Pengisian Form PR Outlet':
        '4. Format TANGGAL(DD/MM/YYYY) contoh: 29/10/2026. DEPARTMENT yang valid: Kitchen, Bar, Pastry, Floor & Operations.',
    },
    {
      'Petunjuk Pengisian Form PR Outlet':
        '5. Jika NAMA BARANG atau SATUAN dikosongkan, sistem juga akan otomatis melengkapinya dari Master Inventory berdasarkan kode SKU.',
    },
    {
      'Petunjuk Pengisian Form PR Outlet':
        '6. Setelah form PR berhasil di-upload, form tersebut akan langsung masuk dan aktif di laman Purchase Request > PR Outlet dan Outbond > Deployment.',
    },
  ];
  const wsGuide = XLSX.utils.json_to_sheet(instructions);
  wsGuide['!cols'] = [{ wch: 110 }];
  XLSX.utils.book_append_sheet(workbook, wsGuide, 'Petunjuk_Pengisian');

  // Download trigger
  XLSX.writeFile(workbook, fileName);
}

/**
 * Parses an uploaded Excel/CSV file containing Form PR Outlet.
 * Automatically populates Category from Master Inventory (Category) and Price from Master Inventory (Price Budget) based on SKU.
 */
export async function parsePROutletFile(
  file: File,
  inventory: InventoryItem[]
): Promise<PRParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        // Find sheet: prefer 'Form_PR_Outlet', then any sheet containing 'pr'/'form' (excluding reference sheets), or first sheet
        const sheetName =
          workbook.SheetNames.find((s) => s.toLowerCase() === 'form_pr_outlet') ||
          workbook.SheetNames.find(
            (s) =>
              (s.toLowerCase().includes('pr') || s.toLowerCase().includes('form')) &&
              !s.toLowerCase().includes('referensi') &&
              !s.toLowerCase().includes('petunjuk')
          ) ||
          workbook.SheetNames[0];

        const worksheet = workbook.Sheets[sheetName];
        if (!worksheet) {
          throw new Error('Lembar kerja (sheet) tidak ditemukan dalam file Excel.');
        }

        // Detect header row automatically if there are title rows at the top of the sheet
        const matrix: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
        let headerRowIdx = 0;
        for (let r = 0; r < Math.min(matrix.length, 20); r++) {
          const rowCells = (matrix[r] || []).map((c) => String(c || '').toLowerCase().trim());
          const hasSku = rowCells.some((c) => c.includes('sku') || c.includes('kode'));
          const hasOutletOrQty = rowCells.some(
            (c) =>
              c.includes('outlet') ||
              c.includes('department') ||
              c.includes('departemen') ||
              c.includes('jumlah') ||
              c.includes('qty')
          );
          if (hasSku && hasOutletOrQty) {
            headerRowIdx = r;
            break;
          }
        }

        // Convert to array of objects starting from detected header row
        const rawJson: any[] = XLSX.utils.sheet_to_json(worksheet, {
          range: headerRowIdx,
          defval: '',
        });

        if (rawJson.length === 0) {
          throw new Error('File Excel tidak memiliki baris data apapun.');
        }

        const rawRows: RawPRRow[] = [];
        const errors: string[] = [];
        const warnings: string[] = [];

        // Carry-forward state for merged cells in Excel (TANGGAL, NAMA OUTLET, DEPARTMENT)
        let lastDateStr = '';
        let lastOutletName = '';
        let lastDeptStr = '';

        rawJson.forEach((row, idx) => {
          const rowNum = idx + headerRowIdx + 2; // Excel row number
          const rowErrors: string[] = [];

          // Priority-aware helper to extract field: checks exact column header match first, then substring match
          const getVal = (keys: string[]): string => {
            const rowKeys = Object.keys(row);
            const cleanHeader = (h: string) =>
              h
                .replace(/[*_]/g, '')
                .replace(/\s+/g, ' ')
                .trim()
                .toLowerCase();

            // Pass 1: Exact header match
            for (const k of keys) {
              const targetK = k.toLowerCase().trim();
              for (const rowKey of rowKeys) {
                if (cleanHeader(rowKey) === targetK) {
                  const val = row[rowKey];
                  if (val !== undefined && val !== null && String(val).trim() !== '') {
                    return String(val).trim();
                  }
                }
              }
            }

            // Pass 2: Substring header match
            for (const k of keys) {
              const targetK = k.toLowerCase().trim();
              for (const rowKey of rowKeys) {
                if (cleanHeader(rowKey).includes(targetK)) {
                  const val = row[rowKey];
                  if (val !== undefined && val !== null && String(val).trim() !== '') {
                    return String(val).trim();
                  }
                }
              }
            }
            return '';
          };

          const rawDateCell = getVal(['tanggal(dd/mm/yyyy)', 'tanggal diminta', 'tanggal', 'date requested', 'date']);
          const rawOutletCell = getVal(['nama outlet', 'outlet name', 'outlet']);
          const rawDeptCell = getVal(['department', 'departemen', 'dept']);
          const rawSku = getVal(['sku', 'sku barang', 'kode sku', 'kode barang', 'item code', 'kode']);
          let rawItemName = getVal(['nama barang', 'item name', 'nama item', 'deskripsi barang', 'uraian barang']);
          const rawQtyStr = getVal(['jumlah dipesan', 'qty dipesan', 'qty', 'jumlah', 'kuantitas']);
          let rawUnit = getVal(['satuan', 'unit', 'uom']);
          const rawCategoryCell = getVal(['kategori', 'category', 'kategori barang']);
          const rawPriceCell = getVal(['harga satuan', 'price budget', 'harga', 'price']);
          const picName = getVal(['nama pic pemesan', 'pic pemesan', 'pic name', 'pic']);
          const itemNotes = getVal(['catatan barang', 'catatan item', 'keterangan barang']);
          const formNotes = getVal(['catatan form pr', 'catatan form', 'catatan pesanan', 'notes']);

          // Skip completely empty rows
          if (!rawOutletCell && !rawDeptCell && !rawSku && !rawItemName && !rawQtyStr) {
            return;
          }

          // Carry forward TANGGAL, NAMA OUTLET, and DEPARTMENT when cells are merged or left blank for subsequent items of the same form
          if (rawDateCell) lastDateStr = rawDateCell;
          if (rawOutletCell) lastOutletName = rawOutletCell;
          if (rawDeptCell) lastDeptStr = rawDeptCell;

          const rawDate = rawDateCell || lastDateStr;
          const outletName = rawOutletCell || lastOutletName;
          const rawDept = rawDeptCell || lastDeptStr;

          // Check required fields
          if (!outletName) {
            rowErrors.push('NAMA OUTLET wajib diisi');
          }

          const department = normalizeDepartment(rawDept);
          if (!department) {
            rowErrors.push(
              `DEPARTMENT "${rawDept || '-'}" tidak valid (Gunakan: Kitchen, Bar, Pastry, Floor & Operations)`
            );
          }

          if (!rawSku) {
            rowErrors.push('SKU wajib diisi');
          }

          const parsedQty = parseNumber(rawQtyStr, 0);
          if (parsedQty <= 0) {
            rowErrors.push(`JUMLAH DIPESAN harus lebih besar dari 0 (saat ini: ${rawQtyStr || 0})`);
          }

          // Match SKU against Master Inventory
          const matchedInv = findInventoryItemBySku(rawSku, rawItemName, inventory);

          let finalSku = rawSku.trim().toUpperCase();
          let category: ItemCategory = rawCategoryCell ? normalizeCategory(rawCategoryCell) : 'Dry Item';
          let finalPrice = rawPriceCell ? parseNumber(rawPriceCell, 0) : 0;
          let matchedFromMaster = false;

          if (matchedInv) {
            matchedFromMaster = true;
            finalSku = matchedInv.sku;
            // Kolom kategori otomatis terisi sesuai kode SKU pada Master Inventory (Category)
            category = matchedInv.category;
            // Kolom harga otomatis terisi sesuai kode SKU pada Master Inventory (Price Budget)
            finalPrice =
              matchedInv.priceBudget !== undefined && matchedInv.priceBudget > 0
                ? matchedInv.priceBudget
                : matchedInv.price ?? 0;
            if (!rawItemName) rawItemName = matchedInv.itemName;
            if (!rawUnit) rawUnit = matchedInv.unit;
          } else {
            if (!rawItemName) {
              rowErrors.push(`SKU "${rawSku}" tidak ditemukan di Master Inventory dan NAMA BARANG kosong.`);
            } else {
              warnings.push(
                `Baris ${rowNum}: SKU "${rawSku}" belum terdaftar di Master Inventory saat ini.`
              );
            }
          }

          const dateRequested = parseExcelDate(rawDate);

          const isValid = rowErrors.length === 0;
          if (!isValid) {
            errors.push(`Baris ${rowNum}: ${rowErrors.join(', ')}`);
          }

          rawRows.push({
            rowNumber: rowNum,
            outletName: outletName || 'Outlet Tidak Diketahui',
            department: department || 'Kitchen',
            dateRequested,
            picName: picName || '',
            sku: finalSku,
            itemName: rawItemName || finalSku,
            category,
            qty: parsedQty,
            unit: rawUnit || 'Pcs',
            price: finalPrice,
            itemNotes,
            formNotes,
            matchedFromMaster,
            isValid,
            errors: rowErrors,
          });
        });

        // Group valid rows into Form PR Orders
        const validRowsList = rawRows.filter((r) => r.isValid);
        const orderMap = new Map<string, {
          outletName: string;
          department: DepartmentName;
          dateRequested: string;
          picName: string;
          formNotes: string;
          items: OrderItem[];
        }>();

        validRowsList.forEach((r) => {
          const groupKey = `${r.outletName.trim().toLowerCase()}||${r.department}||${r.dateRequested}`;

          if (!orderMap.has(groupKey)) {
            orderMap.set(groupKey, {
              outletName: r.outletName,
              department: r.department as DepartmentName,
              dateRequested: r.dateRequested,
              picName: r.picName,
              formNotes: r.formNotes,
              items: [],
            });
          }

          const group = orderMap.get(groupKey)!;
          if (!group.picName && r.picName) group.picName = r.picName;
          if (!group.formNotes && r.formNotes) group.formNotes = r.formNotes;

          const subtotal = r.qty * r.price;

          group.items.push({
            sku: r.sku,
            itemName: r.itemName,
            category: r.category,
            qty: r.qty,
            qtyPrepared: undefined, // default prepared qty is empty before being filled
            unit: r.unit,
            price: r.price,
            subtotal,
            notes: r.itemNotes || undefined,
          });
        });

        const orders: Omit<OutletOrder, 'createdAt' | 'updatedAt'>[] = [];

        orderMap.forEach((group) => {
          const formattedDate = formatDate(group.dateRequested);
          const generatedId = `${formattedDate}-${group.outletName}-${group.department}`;
          const totalAmount = group.items.reduce((s, it) => s + it.subtotal, 0);

          orders.push({
            id: generatedId,
            outletName: group.outletName,
            picName: group.picName || undefined,
            department: group.department,
            status: 'Submitted', // Ready for PR Outlet and Outbond Deployment!
            dateRequested: group.dateRequested,
            items: group.items,
            totalAmount,
            notes: group.formNotes || undefined,
          });
        });

        resolve({
          fileName: file.name,
          totalRows: rawRows.length,
          validRows: validRowsList.length,
          invalidRows: rawRows.length - validRowsList.length,
          orders,
          rawRows,
          errors,
          warnings,
        });
      } catch (err: any) {
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    };

    reader.onerror = () => {
      reject(new Error('Gagal membaca file template PR.'));
    };

    reader.readAsArrayBuffer(file);
  });
}
