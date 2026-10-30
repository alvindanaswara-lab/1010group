import { InventoryItem, OutletOrder, PurchaseOrder } from '../types';
import { formatDate } from './dateUtils';

export function formatRupiah(num: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(num);
}

/**
 * Downloads a string as an Excel file (.xls)
 */
function downloadExcelFile(htmlContent: string, fileName: string) {
  const fullHtml = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <!--[if gte mso 9]>
      <xml>
        <x:ExcelWorkbook>
          <x:ExcelWorksheets>
            <x:ExcelWorksheet>
              <x:Name>Sheet1</x:Name>
              <x:WorksheetOptions>
                <x:DisplayGridlines/>
              </x:WorksheetOptions>
            </x:ExcelWorksheet>
          </x:ExcelWorksheets>
        </x:ExcelWorkbook>
      </xml>
      <![endif]-->
      <meta http-equiv="content-type" content="text/plain; charset=UTF-8"/>
      <style>
        body { font-family: Calibri, sans-serif; }
        table { border-collapse: collapse; width: 100%; }
        th { background-color: #1e3a8a; color: #ffffff; border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; }
        td { border: 1px solid #e2e8f0; padding: 6px 10px; font-size: 13px; }
        .num { text-align: right; }
        .center { text-align: center; }
        .header-box { background-color: #f8fafc; font-weight: bold; }
        .title { font-size: 18px; font-weight: bold; color: #0f172a; margin-bottom: 12px; }
        .total-row { background-color: #f1f5f9; font-weight: bold; }
      </style>
    </head>
    <body>
      ${htmlContent}
    </body>
    </html>
  `;

  const blob = new Blob([fullHtml], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName.endsWith('.xls') ? fileName : `${fileName}.xls`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export Outlet Order Form
 * Form name format: [Date Requested]-[Outlet Name]-[Department]
 */
export function exportOutletOrderToExcel(order: OutletOrder) {
  const fileName = `${order.id}`.replace(/[\/\\?%*:|"<>]/g, '-');

  const tableRows = order.items
    .map((item, idx) => {
      const isFulfilled = (item.qtyPrepared || 0) >= item.qty;
      const isPartial = (item.qtyPrepared || 0) > 0 && (item.qtyPrepared || 0) < item.qty;
      const statusText = isFulfilled
        ? 'Terpenuhi (Siap Kirim)'
        : isPartial
        ? `Kurang ${item.qty - (item.qtyPrepared || 0)} (Credit)`
        : `Kurang ${item.qty} (Credit)`;

      return `
    <tr>
      <td class="center">${idx + 1}</td>
      <td><strong>${item.sku}</strong></td>
      <td>${item.itemName}</td>
      <td>${item.category}</td>
      <td class="num">${item.qty}</td>
      <td class="num" style="background-color: #fff1f2; font-weight: bold; color: #be123c;">${item.qtyPrepared !== undefined ? item.qtyPrepared : 0}</td>
      <td class="center" style="font-weight: bold;">${statusText}</td>
      <td class="center">${item.unit}</td>
      <td class="num">${formatRupiah(item.price)}</td>
      <td class="num"><strong>${formatRupiah(item.subtotal)}</strong></td>
      <td>${item.notes || '-'}</td>
    </tr>
  `;
    })
    .join('');

  const html = `
    <div class="title">FORM PEMESANAN BARANG OUTLET KE GUDANG PUSAT</div>
    <table>
      <tr><td class="header-box" width="180">Form ID</td><td><strong>${order.id}</strong></td></tr>
      <tr><td class="header-box">Outlet Name</td><td>${order.outletName}</td></tr>
      <tr><td class="header-box">Nama PIC</td><td>${order.picName || '-'}</td></tr>
      <tr><td class="header-box">Department</td><td>${order.department}</td></tr>
      <tr><td class="header-box">Date Requested</td><td><strong>${formatDate(order.dateRequested)}</strong></td></tr>
      <tr><td class="header-box">Status Pesanan</td><td>${order.status}</td></tr>
      <tr><td class="header-box">Catatan</td><td>${order.notes || '-'}</td></tr>
    </table>
    <br/>
    <table>
      <thead>
        <tr>
          <th width="40" class="center">No</th>
          <th width="100">SKU</th>
          <th width="240">Item Name</th>
          <th width="120">Category</th>
          <th width="80" class="num">Qty Dipesan</th>
          <th width="90" class="num" style="background-color: #fee2e2;">Qty Disiapkan</th>
          <th width="140" class="center">Status Pemenuhan</th>
          <th width="70" class="center">Unit</th>
          <th width="110" class="num">Price (IDR)</th>
          <th width="120" class="num">Subtotal (IDR)</th>
          <th width="140">Catatan</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows}
        <tr class="total-row">
          <td colspan="9" style="text-align: right; padding: 10px;"><strong>TOTAL PESANAN:</strong></td>
          <td class="num" style="padding: 10px;"><strong>${formatRupiah(order.totalAmount)}</strong></td>
          <td></td>
        </tr>
      </tbody>
    </table>
    <br/>
    <p style="font-size: 11px; color: #64748b;">Dicetak secara otomatis dari 1010Group F&B System pada ${formatDate(new Date())} ${new Date().toLocaleTimeString('id-ID')}</p>
  `;

  downloadExcelFile(html, fileName);
}

/**
 * Export Purchase Order Form (PO-Generated Date)
 */
export function exportPOToExcel(po: PurchaseOrder) {
  const fileName = `${po.id}`.replace(/[\/\\?%*:|"<>]/g, '-');

  const rows = po.items
    .map(
      (it, idx) => `
    <tr>
      <td class="center">${idx + 1}</td>
      <td><strong>${it.sku}</strong></td>
      <td>${it.itemName}</td>
      <td>${it.category}</td>
      <td class="num"><strong>${it.qty}</strong></td>
      <td class="center">${it.unit}</td>
      <td class="num">${formatRupiah(it.price)}</td>
      <td class="num"><strong>${formatRupiah(it.total)}</strong></td>
      <td>${it.isMerged ? `<strong>[DIGABUNG]</strong> ${it.outletBreakdownText || it.place}` : it.place}</td>
      <td>${it.vendorName || 'Belum Ditugaskan'}</td>
      <td>${it.status || 'Pending'}</td>
    </tr>
  `
    )
    .join('');

  const html = `
    <div class="title">PURCHASE ORDER (PO GUDANG PUSAT)</div>
    <table>
      <tr><td class="header-box" width="180">Nomor PO</td><td><strong>${po.id}</strong></td></tr>
      <tr><td class="header-box">Tanggal Generate</td><td><strong>${formatDate(po.generatedDate)}</strong></td></tr>
      <tr><td class="header-box">Status</td><td>${po.status}</td></tr>
      <tr><td class="header-box">Sumber PR Outlet</td><td>${po.sourceOrderIds.join(', ')}</td></tr>
      <tr><td class="header-box">Catatan</td><td>${po.notes || '-'}</td></tr>
    </table>
    <br/>
    <table>
      <thead>
        <tr>
          <th width="40" class="center">No</th>
          <th width="100">SKU</th>
          <th width="240">Item Name</th>
          <th width="130">Category</th>
          <th width="70" class="num">Qty</th>
          <th width="70" class="center">Unit</th>
          <th width="110" class="num">Price (IDR)</th>
          <th width="120" class="num">Total (IDR)</th>
          <th width="260">Alokasi Outlet (Breakdown Pemesanan)</th>
          <th width="180">Vendor Ditugaskan</th>
          <th width="90">Status</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
        <tr class="total-row">
          <td colspan="7" style="text-align: right; padding: 10px;"><strong>GRAND TOTAL PO:</strong></td>
          <td class="num" style="padding: 10px;"><strong>${formatRupiah(po.totalAmount)}</strong></td>
          <td colspan="3"></td>
        </tr>
      </tbody>
    </table>
  `;

  downloadExcelFile(html, fileName);
}

/**
 * Export Master Inventory Table
 */
export function exportMasterInventoryToExcel(items: InventoryItem[], periodLabel?: string) {
  const fileName = `Master_Inventory_${periodLabel ? periodLabel.replace(/\s+/g, '_') : new Date().toISOString().slice(0, 10)}`;

  const rows = items
    .map(
      (item, idx) => {
        const pb = item.priceBudget ?? item.price ?? 0;
        const pa = item.priceActual ?? item.price ?? 0;
        const begUsage = item.beginningInventory ?? 0;
        const begVal = item.beginningValue ?? (begUsage * pb);
        const inUsage = item.inbound ?? 0;
        const inVal = item.inboundValue ?? (inUsage * pa);
        const outUsage = item.outbond ?? 0;
        const outVal = item.outbondValue ?? (outUsage * pb);
        const endUsage = item.endingInventory ?? (begUsage + inUsage - outUsage);
        const endVal = item.endingValue ?? (begVal + inVal - outVal);
        const soUsage = item.stockOpname ?? endUsage;
        const soVal = item.soValue ?? (soUsage * pa);
        const gapUsage = item.gap ?? (soUsage - endUsage);
        const gapVal = item.gapValue ?? (endVal - soVal);

        return `
    <tr>
      <td class="center">${idx + 1}</td>
      <td><strong>${item.sku}</strong></td>
      <td>${item.itemName}</td>
      <td class="center">${item.unit}</td>
      <td>${item.category}</td>
      <td>${(item.allowedDepartments || []).join(', ') || '-'}</td>
      <td>${item.vendor || '-'}</td>
      <td class="num">${formatRupiah(pb)}</td>
      <td class="num">${formatRupiah(pa)}</td>
      <td class="num">${begUsage}</td>
      <td class="num">${formatRupiah(begVal)}</td>
      <td class="num" style="color: #166534;">${inUsage}</td>
      <td class="num" style="color: #166534;">${formatRupiah(inVal)}</td>
      <td class="num" style="color: #991b1b;">${outUsage}</td>
      <td class="num" style="color: #991b1b;">${formatRupiah(outVal)}</td>
      <td class="num"><strong>${endUsage}</strong></td>
      <td class="num"><strong>${formatRupiah(endVal)}</strong></td>
      <td class="num" style="color: #1e40af;">${soUsage}</td>
      <td class="num" style="color: #1e40af;">${formatRupiah(soVal)}</td>
      <td class="num" style="font-weight: bold; color: ${gapUsage < 0 ? '#dc2626' : gapUsage > 0 ? '#2563eb' : '#16a34a'};">${gapUsage > 0 ? `+${gapUsage}` : gapUsage}</td>
      <td class="num" style="font-weight: bold; color: ${gapVal > 0 ? '#dc2626' : gapVal < 0 ? '#2563eb' : '#16a34a'};">${formatRupiah(gapVal)}</td>
    </tr>
  `;
      }
    )
    .join('');

  const html = `
    <div class="title">LAPORAN MASTER INVENTORY & PERGERAKAN STOK GUDANG PUSAT</div>
    <p>Periode: <strong>${periodLabel || 'Oktober 2026'}</strong> | Tanggal Ekspor: ${new Date().toLocaleString('id-ID')}</p>
    <table>
      <thead>
        <tr>
          <th width="40" class="center">No</th>
          <th width="90">SKU</th>
          <th width="220">ITEM NAME</th>
          <th width="60" class="center">UNIT</th>
          <th width="120">CATEGORY</th>
          <th width="150">DEPARTEMEN PENGGUNA</th>
          <th width="160">VENDOR TERKAIT</th>
          <th width="110" class="num">PRICE BUDGET</th>
          <th width="110" class="num">PRICE ACTUAL</th>
          <th width="80" class="num">BEGINNING INVENTORY USAGE</th>
          <th width="120" class="num">BEGINNING INVENTORY VALUE</th>
          <th width="70" class="num">INBOUND USAGE</th>
          <th width="120" class="num">INBOUND VALUE</th>
          <th width="70" class="num">OUTBOND USAGE</th>
          <th width="120" class="num">OUTBOND VALUE</th>
          <th width="80" class="num">ENDING INVENTORY USAGE</th>
          <th width="120" class="num">ENDING INVENTORY VALUE</th>
          <th width="80" class="num">SO USAGE</th>
          <th width="120" class="num">SO VALUE</th>
          <th width="70" class="num">GAP USAGE</th>
          <th width="120" class="num">GAP VALUE</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;

  downloadExcelFile(html, fileName);
}

