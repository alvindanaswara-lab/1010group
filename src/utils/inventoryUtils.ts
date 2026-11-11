import { InventoryItem, ItemCategory } from '../types';

export const MONTH_NAMES_ID = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

/**
 * Returns formatted period label, e.g. "2026-10" -> "Oktober 2026"
 */
export function formatPeriodLabel(periodKey: string): string {
  if (!periodKey || !periodKey.includes('-')) return periodKey || '';
  const [yearStr, monthStr] = periodKey.split('-');
  const monthIdx = parseInt(monthStr, 10) - 1;
  const monthName = MONTH_NAMES_ID[monthIdx] || monthStr;
  return `${monthName} ${yearStr}`;
}

/**
 * Get next period key, e.g. "2026-10" -> "2026-11", "2026-12" -> "2027-01"
 */
export function getNextPeriod(periodKey: string): string {
  const [yearStr, monthStr] = periodKey.split('-');
  let year = parseInt(yearStr, 10);
  let month = parseInt(monthStr, 10);

  month += 1;
  if (month > 12) {
    month = 1;
    year += 1;
  }
  return `${year}-${String(month).padStart(2, '0')}`;
}

/**
 * Get previous period key, e.g. "2026-10" -> "2026-09"
 */
export function getPrevPeriod(periodKey: string): string {
  const [yearStr, monthStr] = periodKey.split('-');
  let year = parseInt(yearStr, 10);
  let month = parseInt(monthStr, 10);

  month -= 1;
  if (month < 1) {
    month = 12;
    year -= 1;
  }
  return `${year}-${String(month).padStart(2, '0')}`;
}

/**
 * Get current year-month string "YYYY-MM", defaults to "2026-10"
 */
export function getCurrentPeriodKey(): string {
  return '2026-10';
}

/**
 * Standard SKU prefix mapping per ItemCategory
 */
export const CATEGORY_SKU_PREFIX: Record<ItemCategory, string> = {
  'Baked Item': 'BAK',
  'Butcher': 'BTC',
  'Dairy & Frozen': 'DAI',
  'Dry Item': 'DRY',
  'Drinks': 'DRK',
  'Gas': 'GAS',
  'Other Expense': 'OTH',
  'Packaging': 'PKG',
  'Vegetables': 'VEG',
};

/**
 * Automatically queues the next sequential SKU number based on the selected category and existing items.
 * Example:
 * If category is 'Dry Item' and existing items have DRY-001, DRY-002, returns 'DRY-003'.
 * If category has no existing items, returns 'DRY-001'.
 */
export function getNextQueuedSKU(
  category: ItemCategory,
  existingItems: { sku: string; category?: string }[] = []
): string {
  const defaultPrefix = CATEGORY_SKU_PREFIX[category] || 'ITEM';

  // Find all items belonging to this category
  const categoryItems = existingItems.filter(
    (it) => it.category?.toLowerCase() === category.toLowerCase()
  );

  // Detect dominant prefix used in this category if items exist
  let prefix = defaultPrefix;
  if (categoryItems.length > 0) {
    const prefixCounts: Record<string, number> = {};
    for (const item of categoryItems) {
      if (!item.sku) continue;
      const match = item.sku.trim().match(/^([A-Za-z]+)[-_]/);
      if (match) {
        const p = match[1].toUpperCase();
        prefixCounts[p] = (prefixCounts[p] || 0) + 1;
      }
    }
    const mostUsed = Object.entries(prefixCounts).sort((a, b) => b[1] - a[1])[0];
    if (mostUsed && mostUsed[1] >= 1) {
      prefix = mostUsed[0];
    }
  }

  // Extract all numeric sequences used with this prefix or within this category
  const numbers: number[] = [];
  const allSkusSet = new Set(existingItems.map((it) => (it.sku || '').toUpperCase().trim()));

  for (const item of existingItems) {
    if (!item.sku) continue;
    const cleanSku = item.sku.trim().toUpperCase();

    // Check if matches `${prefix}-123` or `${prefix}_123` or `${prefix}123`
    const regex = new RegExp(`^${prefix}[-_]?(\\d+)$`, 'i');
    const match = cleanSku.match(regex);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num)) numbers.push(num);
    } else if (item.category?.toLowerCase() === category.toLowerCase()) {
      // Also extract trailing number if item belongs to the same category
      const trailingMatch = cleanSku.match(/(\d+)$/);
      if (trailingMatch) {
        const num = parseInt(trailingMatch[1], 10);
        if (!isNaN(num)) numbers.push(num);
      }
    }
  }

  const maxNum = numbers.length > 0 ? Math.max(...numbers) : 0;
  let nextNum = maxNum + 1;
  let nextSku = `${prefix}-${String(nextNum).padStart(3, '0')}`;

  // Ensure absolutely no collision with any existing SKU
  while (allSkusSet.has(nextSku.toUpperCase())) {
    nextNum++;
    nextSku = `${prefix}-${String(nextNum).padStart(3, '0')}`;
  }

  return nextSku;
}

/**
 * Normalizes an InventoryItem ensuring all 18 column values and formulas are strictly met:
 * 1. SKU
 * 2. ITEM NAME
 * 3. UNIT
 * 4. CATEGORY
 * 5. PRICE BUDGET
 * 6. PRICE ACTUAL
 * 7. BEGINNING INVENTORY USAGE
 * 8. BEGINNING INVENTORY VALUE (qty * PRICE BUDGET)
 * 9. INBOUND USAGE
 * 10. INBOUND VALUE (akumulasi nilai inbound / inbound * PRICE ACTUAL)
 * 11. OUTBOND USAGE
 * 12. OUTBOND VALUE (total outbond value = outbond * PRICE ACTUAL)
 * 13. ENDING INVENTORY USAGE (beginning + inbound - outbond)
 * 14. ENDING INVENTORY VALUE (beginning value + inbound value - outbond value)
 * 15. SO USAGE (Stock Opname count)
 * 16. SO VALUE (qty * PRICE ACTUAL)
 * 17. GAP USAGE (so usage - ending inventory usage)
 * 18. GAP VALUE (ending inventory value - so value)
 */
export function normalizeInventoryItem(
  item: Partial<InventoryItem>,
  period: string = '2026-10'
): InventoryItem {
  const priceBudget = item.priceBudget ?? item.price ?? 25000;
  const inbound = item.inbound ?? 0;

  let priceActual = item.priceActual ?? item.price ?? priceBudget;
  let inboundValue = Math.round(inbound * priceActual);

  if (item.inboundValue !== undefined && inbound > 0 && item.inboundValue > 0) {
    inboundValue = Math.round(item.inboundValue);
    priceActual = Math.round(inboundValue / inbound);
  }

  const beginningInventory = item.beginningInventory ?? 0;
  const beginningValue = Math.round(beginningInventory * priceBudget);

  const outbond = item.outbond ?? 0;
  const outbondValue = Math.round(outbond * priceActual);

  const endingInventory = beginningInventory + inbound - outbond;
  const endingValue = beginningValue + inboundValue - outbondValue;

  const stockOpname = item.stockOpname ?? 0;
  const soValue = Math.round(stockOpname * priceActual);

  // GAP USAGE: SO Usage - Ending Inventory Usage (negative = deficit, positive = surplus)
  const gap = stockOpname - endingInventory;
  // GAP VALUE: Ending Inventory Value - SO Value (as specified: "ending inventory value dikurangi so value")
  const gapValue = endingValue - soValue;

  return {
    sku: item.sku || `SKU-${Date.now().toString().slice(-4)}`,
    itemName: item.itemName || 'Unnamed Item',
    category: (item.category as ItemCategory) || 'Dry Item',
    unit: item.unit || 'Kg',
    price: priceBudget,
    priceBudget,
    priceActual,
    beginningInventory,
    beginningValue,
    inbound,
    inboundValue,
    outbond,
    outbondValue,
    endingInventory,
    endingValue,
    stockOpname,
    soValue,
    gap,
    gapValue,
    minStock: item.minStock ?? item.safetyStock ?? 10,
    safetyStock: item.safetyStock ?? item.minStock ?? 10,
    allowedDepartments: item.allowedDepartments || ['Kitchen'],
    vendor: item.vendor || '',
    period,
  };
}

/**
 * Checks whether an inventory item falls below or at its defined safety stock level.
 */
export function isItemLowStock(item: {
  endingInventory?: number;
  safetyStock?: number;
  minStock?: number;
}): boolean {
  const safetyLevel = item.safetyStock ?? item.minStock ?? 10;
  const currentStock = item.endingInventory ?? 0;
  return currentStock <= safetyLevel;
}

/**
 * Summary Report calculation for Inventory Management (Pergerakan Bulanan):
 * 1. Total Beginning (Usage & Value)
 * 2. Total Inbound (Usage & Value)
 * 3. Total Outbond (Usage & Value)
 * 4. Ending Inventory (Usage & Value)
 * 5. Stock Opname (Usage & Value)
 * 6. Total GAP (Usage & Value: Ending Value - SO Value)
 * 7. GAP Percentage: (Total GAP Value / Ending Inventory Value) * 100%
 * 8. Low Stock Items count (items falling below or at safety stock level)
 */
export interface InventoryManagementReport {
  totalBeginningUsage: number;
  totalBeginningValue: number;
  totalInboundUsage: number;
  totalInboundValue: number;
  totalOutbondUsage: number;
  totalOutbondValue: number;
  endingInventoryUsage: number;
  endingInventoryValue: number;
  stockOpnameUsage: number;
  stockOpnameValue: number;
  totalGapUsage: number;
  totalGapValue: number;
  gapPercentage: number;
  totalItems: number;
  itemsWithVariance: number;
  totalLowStockItems: number;
  totalOutOfStockItems: number;
}

export function calculateInventoryManagementReport(
  items: InventoryItem[]
): InventoryManagementReport {
  let totalBeginningUsage = 0;
  let totalBeginningValue = 0;
  let totalInboundUsage = 0;
  let totalInboundValue = 0;
  let totalOutbondUsage = 0;
  let totalOutbondValue = 0;
  let endingInventoryUsage = 0;
  let endingInventoryValue = 0;
  let stockOpnameUsage = 0;
  let stockOpnameValue = 0;
  let itemsWithVariance = 0;
  let totalLowStockItems = 0;
  let totalOutOfStockItems = 0;

  for (const it of items) {
    const item = normalizeInventoryItem(it);
    totalBeginningUsage += item.beginningInventory;
    totalBeginningValue += item.beginningValue || 0;

    totalInboundUsage += item.inbound;
    totalInboundValue += item.inboundValue || 0;

    totalOutbondUsage += item.outbond;
    totalOutbondValue += item.outbondValue || 0;

    endingInventoryUsage += item.endingInventory;
    endingInventoryValue += item.endingValue || 0;

    stockOpnameUsage += item.stockOpname;
    stockOpnameValue += item.soValue || 0;

    if (item.gap !== 0 || item.gapValue !== 0) {
      itemsWithVariance += 1;
    }

    const safetyLevel = item.safetyStock ?? item.minStock ?? 10;
    if (item.endingInventory <= safetyLevel) {
      totalLowStockItems += 1;
      if (item.endingInventory <= 0) {
        totalOutOfStockItems += 1;
      }
    }
  }

  // GAP Total: Ending Inventory Value - SO Value
  const totalGapValue = endingInventoryValue - stockOpnameValue;
  const totalGapUsage = stockOpnameUsage - endingInventoryUsage;

  const gapPercentage =
    endingInventoryValue > 0
      ? Math.abs((totalGapValue / endingInventoryValue) * 100)
      : 0;

  return {
    totalBeginningUsage,
    totalBeginningValue,
    totalInboundUsage,
    totalInboundValue,
    totalOutbondUsage,
    totalOutbondValue,
    endingInventoryUsage,
    endingInventoryValue,
    stockOpnameUsage,
    stockOpnameValue,
    totalGapUsage,
    totalGapValue,
    gapPercentage,
    totalItems: items.length,
    itemsWithVariance,
    totalLowStockItems,
    totalOutOfStockItems,
  };
}
