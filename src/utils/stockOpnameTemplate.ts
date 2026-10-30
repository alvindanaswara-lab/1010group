import * as XLSX from 'xlsx';
import { InventoryItem } from '../types';
import { formatPeriodLabel } from './inventoryUtils';

export interface ParsedSORow {
  sku: string;
  itemName: string;
  category: string;
  unit: string;
  systemStock: number;
  physicalCount: number;
  gapUsage: number;
  notes: string;
  isValid: boolean;
  errorMessage?: string;
}

export interface SOParseResult {
  fileName: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  matchedItemsCount: number;
  unmatchedItemsCount: number;
  itemsWithVariance: number;
  rows: ParsedSORow[];
  errors: string[];
}

/**
 * Generates and downloads an Excel template for Stock Opname for the specified period.
 */
export function downloadSOTemplate(items: InventoryItem[], periodKey: string) {
  const periodLabel = formatPeriodLabel(periodKey);
  const fileName = `Template_Stock_Opname_${periodKey}_${periodLabel.replace(/\s+/g, '_')}.xlsx`;

  const templateData = items.map((item, idx) => ({
    No: idx + 1,
    SKU: item.sku,
    'Nama Barang': item.itemName,
    Kategori: item.category,
    Satuan: item.unit,
    'Stok Buku Sistem': item.endingInventory,
    'Hasil Fisik SO': item.endingInventory, // default prefilled with system stock
    'Catatan Fisik': '',
  }));

  const worksheet = XLSX.utils.json_to_sheet(templateData);

  // Set column widths
  worksheet['!cols'] = [
    { wch: 6 }, // No
    { wch: 14 }, // SKU
    { wch: 35 }, // Nama Barang
    { wch: 18 }, // Kategori
    { wch: 10 }, // Satuan
    { wch: 18 }, // Stok Buku Sistem
    { wch: 18 }, // Hasil Fisik SO (To be edited)
    { wch: 30 }, // Catatan Fisik
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Stock Opname');

  // Also add an Instruction sheet
  const instructionData = [
    { Petunjuk: 'PANDUAN PENGISIAN TEMPLATE STOCK OPNAME GUDANG PUSAT' },
    { Petunjuk: `1. Template ini dibuat untuk periode: ${periodLabel} (${periodKey})` },
    { Petunjuk: '2. JANGAN mengubah nilai pada kolom SKU karena digunakan sebagai kode referensi sistem.' },
    { Petunjuk: '3. Masukkan angka hasil hitung fisik riil di lapangan pada kolom "Hasil Fisik SO".' },
    { Petunjuk: '4. Kolom "Catatan Fisik" bersifat opsional untuk mencatat barang rusak, basi, atau kadaluarsa.' },
    { Petunjuk: '5. Simpan file dalam format .xlsx atau .csv lalu upload kembali melalui tombol "Upload Hasil SO".' },
  ];
  const instructionSheet = XLSX.utils.json_to_sheet(instructionData);
  instructionSheet['!cols'] = [{ wch: 80 }];
  XLSX.utils.book_append_sheet(workbook, instructionSheet, 'Petunjuk Pengisian');

  XLSX.writeFile(workbook, fileName);
}

/**
 * Parses an uploaded Stock Opname file (.xlsx, .xls, or .csv)
 */
export async function parseSOFile(
  file: File,
  currentInventory: InventoryItem[]
): Promise<SOParseResult> {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array' });

  // Use the first sheet or sheet named 'Stock Opname'
  const sheetName =
    workbook.SheetNames.find((name) => name.toLowerCase().includes('stock') || name.toLowerCase().includes('opname')) ||
    workbook.SheetNames[0];

  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) {
    throw new Error('Lembar kerja (Sheet) tidak ditemukan pada file yang diupload.');
  }

  // Convert to JSON array of objects
  const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

  if (rawRows.length === 0) {
    throw new Error('File tidak memiliki baris data atau kosong.');
  }

  const inventoryBySku = new Map<string, InventoryItem>();
  const inventoryByName = new Map<string, InventoryItem>();

  currentInventory.forEach((item) => {
    inventoryBySku.set(item.sku.trim().toUpperCase(), item);
    inventoryByName.set(item.itemName.trim().toLowerCase(), item);
  });

  const parsedRows: ParsedSORow[] = [];
  const errors: string[] = [];
  let validRows = 0;
  let invalidRows = 0;
  let itemsWithVariance = 0;
  let matchedItemsCount = 0;
  let unmatchedItemsCount = 0;

  rawRows.forEach((row, idx) => {
    // Find SKU column flexibly
    const rawSku = (
      row['SKU'] ||
      row['sku'] ||
      row['Kode Barang'] ||
      row['Kode SKU'] ||
      row['Kode'] ||
      ''
    )
      .toString()
      .trim();

    // Find Name column flexibly
    const rawName = (
      row['Nama Barang'] ||
      row['Item Name'] ||
      row['Nama'] ||
      row['Barang'] ||
      row['item_name'] ||
      ''
    )
      .toString()
      .trim();

    // Find Physical count column flexibly
    const rawCount =
      row['Hasil Fisik SO'] !== undefined && row['Hasil Fisik SO'] !== ''
        ? row['Hasil Fisik SO']
        : row['Fisik SO'] !== undefined && row['Fisik SO'] !== ''
        ? row['Fisik SO']
        : row['Hasil Fisik'] !== undefined && row['Hasil Fisik'] !== ''
        ? row['Hasil Fisik']
        : row['Fisik'] !== undefined && row['Fisik'] !== ''
        ? row['Fisik']
        : row['SO Count'] !== undefined && row['SO Count'] !== ''
        ? row['SO Count']
        : row['Qty SO'] !== undefined && row['Qty SO'] !== ''
        ? row['Qty SO']
        : row['Physical Count'] !== undefined && row['Physical Count'] !== ''
        ? row['Physical Count']
        : null;

    // Find Notes column flexibly
    const rawNotes = (
      row['Catatan Fisik'] ||
      row['Catatan'] ||
      row['Keterangan'] ||
      row['Notes'] ||
      ''
    )
      .toString()
      .trim();

    // Match item in current inventory
    let matchedItem = rawSku ? inventoryBySku.get(rawSku.toUpperCase()) : undefined;
    if (!matchedItem && rawName) {
      matchedItem = inventoryByName.get(rawName.toLowerCase());
    }

    if (!matchedItem) {
      unmatchedItemsCount += 1;
      invalidRows += 1;
      parsedRows.push({
        sku: rawSku || `Baris-${idx + 2}`,
        itemName: rawName || 'Item tidak terdaftar',
        category: 'Unknown',
        unit: '-',
        systemStock: 0,
        physicalCount: typeof rawCount === 'number' ? rawCount : parseFloat(rawCount) || 0,
        gapUsage: 0,
        notes: rawNotes,
        isValid: false,
        errorMessage: `SKU [${rawSku || rawName}] tidak ditemukan di Master Inventory.`,
      });
      return;
    }

    matchedItemsCount += 1;

    // Validate Physical Count
    let physicalCount = 0;
    let isCountValid = true;
    let errorMsg = '';

    if (rawCount === null || rawCount === '') {
      // Selalu kosongkan (0) jika tidak diisi pada file upload
      physicalCount = 0;
    } else {
      const parsedNum = Number(rawCount);
      if (isNaN(parsedNum) || parsedNum < 0) {
        isCountValid = false;
        errorMsg = `Nilai fisik "${rawCount}" bukan angka valid.`;
        physicalCount = 0;
      } else {
        physicalCount = Math.round(parsedNum);
      }
    }

    const gapUsage = physicalCount - matchedItem.endingInventory;
    if (gapUsage !== 0) {
      itemsWithVariance += 1;
    }

    if (isCountValid) {
      validRows += 1;
    } else {
      invalidRows += 1;
    }

    parsedRows.push({
      sku: matchedItem.sku,
      itemName: matchedItem.itemName,
      category: matchedItem.category,
      unit: matchedItem.unit,
      systemStock: matchedItem.endingInventory,
      physicalCount,
      gapUsage,
      notes: rawNotes,
      isValid: isCountValid,
      errorMessage: errorMsg,
    });
  });

  return {
    fileName: file.name,
    totalRows: rawRows.length,
    validRows,
    invalidRows,
    matchedItemsCount,
    unmatchedItemsCount,
    itemsWithVariance,
    rows: parsedRows,
    errors,
  };
}
