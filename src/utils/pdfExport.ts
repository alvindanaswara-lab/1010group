import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AuditLogEntry, InboundReceivingRecord, InventoryItem, OutletOrder, PurchaseOrder, Vendor } from '../types';
import { formatDate } from './dateUtils';
import { formatRupiah } from './excelExport';
import { findInventoryItemBySku } from './prOutletTemplate';

/**
 * Export Purchase Order to PDF (.pdf)
 * Supports exporting either the full PO form or a specific Vendor's PO document.
 */
function buildPOPDFDocument(
  po: PurchaseOrder,
  vendors: Vendor[],
  specificVendorName?: string
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const approvedItems = po.items.filter(
    (it) => it.status !== 'Rejected' && it.approvalStatus !== 'Rejected'
  );

  const filteredItems = specificVendorName
    ? approvedItems.filter((it) => (it.vendorName || 'Vendor Umum') === specificVendorName)
    : approvedItems;

  const targetVendor = specificVendorName
    ? vendors.find((v) => v.namaVendor === specificVendorName)
    : undefined;

  // Header Banner
  doc.setFillColor(30, 41, 59); // slate-800
  doc.rect(0, 0, pageWidth, 32, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('1010GROUP F&B MANAGEMENT', 14, 13);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text('Divisi Purchasing, Cost Control & Gudang Pusat (Central Warehouse)', 14, 19);
  doc.text('Dokumen Resmi Purchase Order (PO) Rekanan Mitra', 14, 24);

  // Right Header Badge
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('PURCHASE ORDER', pageWidth - 14, 13, { align: 'right' });
  doc.setFontSize(9);
  doc.setTextColor(167, 243, 208); // emerald-200
  doc.text(`#${po.id}`, pageWidth - 14, 19, { align: 'right' });
  doc.setTextColor(226, 232, 240);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`Tanggal PO: ${formatDate(po.generatedDate)}`, pageWidth - 14, 24, { align: 'right' });

  let currentY = 40;

  // Box 1: Informasi Dokumen PO & Otorisasi Cost Control
  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, currentY, pageWidth - 28, 28, 2, 2, 'FD');

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('INFORMASI DOKUMEN PO', 18, currentY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  doc.text(`Nomor PO: ${po.id}`, 18, currentY + 12);
  doc.text(`Tanggal Generate: ${formatDate(po.generatedDate)}`, 18, currentY + 17);
  doc.text(
    `Ref PR Outlet: ${po.sourceOrderIds.length > 0 ? po.sourceOrderIds.join(', ') : 'Direct PO'}`,
    18,
    currentY + 22
  );

  // Right column in Info Box: Cost Control Approval Status
  const rightColX = pageWidth / 2 + 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('OTORISASI COST CONTROL & RELEASE', rightColX, currentY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const ccApprover = po.costControlApproval?.approvedBy || 'Cost Control PIC';
  const ccDate = po.costControlApproval?.approvedAt
    ? formatDate(po.costControlApproval.approvedAt.slice(0, 10))
    : formatDate(po.generatedDate);
  const statusLabel =
    po.status === 'Sent to Receiving'
      ? 'RELEASED TO VENDOR & INBOUND'
      : po.status === 'Approved by Cost Control'
      ? 'APPROVED BY COST CONTROL'
      : po.status.toUpperCase();

  doc.setTextColor(5, 150, 105); // emerald-600
  doc.setFont('helvetica', 'bold');
  doc.text(`Status: ${statusLabel}`, rightColX, currentY + 12);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  doc.text(`Disetujui Oleh: ${ccApprover} (${ccDate})`, rightColX, currentY + 17);
  doc.text(
    `Catatan: ${(po.costControlApproval?.notes || po.notes || 'Telah diverifikasi').slice(0, 48)}`,
    rightColX,
    currentY + 22
  );

  currentY += 33;

  // Box 2: Informasi Vendor (Jika ekspor spesifik per Vendor, atau ringkasan mitra)
  if (specificVendorName) {
    doc.setDrawColor(199, 210, 254);
    doc.setFillColor(238, 242, 255); // indigo-50
    doc.roundedRect(14, currentY, pageWidth - 28, 26, 2, 2, 'FD');

    doc.setTextColor(49, 46, 129);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text('KEPADA YTH. MITRA VENDOR / SUPPLIER:', 18, currentY + 6);

    doc.setFontSize(9.5);
    doc.text(specificVendorName, 18, currentY + 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);
    doc.text(`Alamat: ${targetVendor?.address || 'Alamat terdaftar di sistem'}`, 18, currentY + 17);
    doc.text(`PIC: ${targetVendor?.pic || '-'} | Telp: ${targetVendor?.telephone || '-'}`, 18, currentY + 22);

    const paymentCat =
      filteredItems[0]?.paymentMethod ||
      targetVendor?.paymentCategory ||
      (targetVendor?.paymentType?.startsWith('TOP') ? 'Tempo' : 'Cash');
    const paymentTerm =
      filteredItems[0]?.paymentTerm ||
      targetVendor?.topTerm ||
      targetVendor?.cashType ||
      targetVendor?.paymentType ||
      'TOP 30 Hari';

    doc.setFont('helvetica', 'bold');
    doc.text(`Email Vendor: ${targetVendor?.email || '-'}`, rightColX, currentY + 12);
    doc.text(`Metode Pembayaran: ${paymentCat} (${paymentTerm})`, rightColX, currentY + 17);
    doc.setFont('helvetica', 'normal');
    doc.text(`Tujuan Pengiriman: Gudang Pusat (Inbound Receiving)`, rightColX, currentY + 22);

    currentY += 31;
  } else {
    // Summary of Vendors in this PO
    const uniqueVendors = Array.from(
      new Set(filteredItems.map((i) => i.vendorName || 'Vendor Umum'))
    );
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text(
      `Daftar Pesanan Pembelian Barang (${filteredItems.length} Item • ${uniqueVendors.length} Mitra Vendor)`,
      14,
      currentY + 4
    );
    currentY += 7;
  }

  // Table of Items
  const grandTotal = filteredItems.reduce((acc, it) => acc + it.qty * it.price, 0);

  if (specificVendorName) {
    autoTable(doc, {
      startY: currentY,
      head: [
        [
          'No',
          'SKU',
          'Nama Barang',
          'Kategori',
          'Qty',
          'Satuan',
          'Harga Satuan',
          'Subtotal (IDR)',
        ],
      ],
      body: filteredItems.map((it, idx) => [
        String(idx + 1),
        it.sku,
        it.itemName,
        it.category,
        String(it.qty),
        it.unit,
        formatRupiah(it.price),
        formatRupiah(it.qty * it.price),
      ]),
      foot: [
        [
          {
            content: `TOTAL PEMBELIAN (${specificVendorName})`,
            colSpan: 7,
            styles: { halign: 'right', fontStyle: 'bold' },
          },
          {
            content: formatRupiah(grandTotal),
            styles: { halign: 'right', fontStyle: 'bold' },
          },
        ],
      ],
      styles: {
        fontSize: 8,
        cellPadding: 2.5,
      },
      headStyles: {
        fillColor: [67, 56, 202], // indigo-700
        textColor: 255,
        fontStyle: 'bold',
      },
      footStyles: {
        fillColor: [241, 245, 249],
        textColor: [15, 23, 42],
        fontStyle: 'bold',
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 10 },
        1: { cellWidth: 22 },
        4: { halign: 'center', cellWidth: 14 },
        5: { halign: 'center', cellWidth: 16 },
        6: { halign: 'right', cellWidth: 28 },
        7: { halign: 'right', cellWidth: 32 },
      },
    });
  } else {
    autoTable(doc, {
      startY: currentY,
      head: [
        [
          'No',
          'SKU',
          'Nama Barang',
          'Vendor Mitra',
          'Pembayaran',
          'Qty',
          'Satuan',
          'Harga Satuan',
          'Subtotal',
        ],
      ],
      body: filteredItems.map((it, idx) => {
        const pm = it.paymentMethod || (it.paymentTerm?.includes('Cash') ? 'Cash' : 'Tempo');
        const pt = it.paymentTerm || (pm === 'Cash' ? 'Cash' : 'TOP 30');
        return [
          String(idx + 1),
          it.sku,
          it.itemName,
          it.vendorName || 'Vendor Umum',
          `${pm} (${pt})`,
          String(it.qty),
          it.unit,
          formatRupiah(it.price),
          formatRupiah(it.qty * it.price),
        ];
      }),
      foot: [
        [
          {
            content: 'GRAND TOTAL PURCHASE ORDER',
            colSpan: 8,
            styles: { halign: 'right', fontStyle: 'bold' },
          },
          {
            content: formatRupiah(grandTotal),
            styles: { halign: 'right', fontStyle: 'bold' },
          },
        ],
      ],
      styles: {
        fontSize: 7.5,
        cellPadding: 2.2,
      },
      headStyles: {
        fillColor: [79, 70, 229], // indigo-600
        textColor: 255,
        fontStyle: 'bold',
      },
      footStyles: {
        fillColor: [241, 245, 249],
        textColor: [15, 23, 42],
        fontStyle: 'bold',
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 9 },
        1: { cellWidth: 19 },
        5: { halign: 'center', cellWidth: 12 },
        6: { halign: 'center', cellWidth: 14 },
        7: { halign: 'right', cellWidth: 25 },
        8: { halign: 'right', cellWidth: 28 },
      },
    });
  }

  // Get finalY after table
  const finalY = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY || currentY + 60;

  let sigY = finalY + 14;
  if (sigY > 245) {
    doc.addPage();
    sigY = 25;
  }

  // Notes & Delivery Instructions
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);
  doc.text('Instruksi Pengiriman & Penerimaan Barang (Inbound Gudang):', 14, sigY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(
    '1. Harap sertakan Surat Jalan (Delivery Order) dan referensi Nomor PO saat pengiriman barang ke Gudang Pusat (Inbound).',
    14,
    sigY + 5
  );
  doc.text(
    '2. Barang yang dikirim wajib sesuai dengan spesifikasi, kuantitas (Qty), dan harga satuan yang telah disetujui Cost Control.',
    14,
    sigY + 9.5
  );

  // Signatures
  const boxY = sigY + 16;
  const colW = (pageWidth - 28) / 3;

  doc.setDrawColor(203, 213, 225);
  doc.rect(14, boxY, colW - 4, 24);
  doc.rect(14 + colW + 2, boxY, colW - 4, 24);
  doc.rect(14 + colW * 2 + 4, boxY, colW - 4, 24);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(30, 41, 59);
  doc.text('Dibuat Oleh (Purchasing)', 14 + (colW - 4) / 2, boxY + 5, { align: 'center' });
  doc.text('Disetujui Oleh (Cost Control)', 14 + colW + 2 + (colW - 4) / 2, boxY + 5, {
    align: 'center',
  });
  doc.text('Dikonfirmasi (Mitra Vendor)', 14 + colW * 2 + 4 + (colW - 4) / 2, boxY + 5, {
    align: 'center',
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('Divisi Purchasing', 14 + (colW - 4) / 2, boxY + 21, { align: 'center' });
  doc.text(ccApprover, 14 + colW + 2 + (colW - 4) / 2, boxY + 21, { align: 'center' });
  doc.text(specificVendorName || 'Perwakilan Vendor', 14 + colW * 2 + 4 + (colW - 4) / 2, boxY + 21, {
    align: 'center',
  });

  // Footer timestamp
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Dicetak otomatis dari 1010Group F&B System pada ${formatDate(new Date())} ${new Date().toLocaleTimeString('id-ID')}`,
    14,
    287
  );

  const safeVendorSuffix = specificVendorName
    ? `_${specificVendorName.replace(/[^a-zA-Z0-9]/g, '_')}`
    : '_Lengkap';
  const fileName = `${po.id}${safeVendorSuffix}.pdf`;
  return { doc, fileName };
}

export function exportPOToPDF(
  po: PurchaseOrder,
  vendors: Vendor[],
  specificVendorName?: string
): string {
  const { doc, fileName } = buildPOPDFDocument(po, vendors, specificVendorName);
  doc.save(fileName);
  return fileName;
}

export function getPOPDFBase64Attachment(
  po: PurchaseOrder,
  vendors: Vendor[],
  specificVendorName?: string
): { fileName: string; base64Data: string } {
  const { doc, fileName } = buildPOPDFDocument(po, vendors, specificVendorName);
  const dataUri = doc.output('datauristring');
  const base64Data = dataUri.includes('base64,') ? dataUri.split('base64,')[1] : '';
  return { fileName, base64Data };
}

/**
 * Helper to generate formal Email Subject & Body for a Vendor PO
 */
export function generateVendorPOEmailContent(
  po: PurchaseOrder,
  vendorName: string,
  vendorObj?: Vendor
) {
  const vendorItems = po.items.filter(
    (it) =>
      (it.vendorName || 'Vendor Umum') === vendorName &&
      it.status !== 'Rejected' &&
      it.approvalStatus !== 'Rejected'
  );
  const itemsToUse = vendorItems.length > 0 ? vendorItems : po.items;
  const subtotal = itemsToUse.reduce((acc, it) => acc + it.qty * it.price, 0);

  const paymentMethod =
    itemsToUse[0]?.paymentMethod ||
    vendorObj?.paymentCategory ||
    (vendorObj?.paymentType?.startsWith('TOP') ? 'Tempo' : 'Cash');
  const paymentTerm =
    itemsToUse[0]?.paymentTerm ||
    vendorObj?.topTerm ||
    vendorObj?.cashType ||
    vendorObj?.paymentType ||
    'TOP 30 Hari';

  const subject = `[OFFICIAL PO] Release Purchase Order #${po.id} - ${vendorName} (${formatDate(po.generatedDate)})`;

  const itemLines = itemsToUse
    .map(
      (it, idx) =>
        `${idx + 1}. [${it.sku}] ${it.itemName} — Qty: ${it.qty} ${it.unit} @ ${formatRupiah(it.price)} = ${formatRupiah(it.qty * it.price)}`
    )
    .join('\n');

  const body = `Kepada Yth.
${vendorName}
Up. ${vendorObj?.pic || 'Tim Sales / Order Processing'}
Di Tempat

Dengan hormat,

Berikut kami kirimkan rilis resmi Purchase Order (PO) dari Divisi Purchasing 1010Group F&B yang telah disetujui oleh Cost Control dengan rincian sebagai berikut:

• Nomor PO         : ${po.id}
• Tanggal PO       : ${formatDate(po.generatedDate)}
• Mitra Vendor     : ${vendorName}
• Tipe Pembayaran  : ${paymentMethod} (${paymentTerm})
• Status Otorisasi : Disetujui Cost Control (${po.costControlApproval?.approvedBy || 'Cost Control'})

RINCIAN PESANAN BARANG:
-------------------------------------------------------------------------
${itemLines}
-------------------------------------------------------------------------
TOTAL NILAI PESANAN : ${formatRupiah(subtotal)}

Mohon agar pesanan tersebut dapat diproses dan dikirimkan ke Gudang Pusat (Bagian Inbound / Receiving) dengan menyertakan Surat Jalan (Delivery Order) serta mencantumkan Nomor Referensi PO (${po.id}).

Dokumen resmi Purchase Order dalam format PDF (${po.id}_${vendorName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf) turut dilampirkan bersama pengiriman ini.

Terima kasih atas kerja sama yang baik.

Hormat kami,
Divisi Purchasing & Procurement
1010Group F&B Management`;

  return {
    email: vendorObj?.email || '',
    subject,
    body,
    subtotal,
    itemCount: itemsToUse.length,
    paymentMethod,
    paymentTerm,
  };
}

/**
 * Export Laporan Status Penerimaan Barang (Receiving Inbound) ke PDF (.pdf)
 * Mendukung ekspor rekapitulasi laporan terfilter (Semua Status / Diterima Keseluruhan / Diterima Sebagian / Menunggu Kedatangan)
 * maupun ekspor laporan spesifik satu dokumen Inbound.
 */
export function exportInboundReportToPDF(
  records: InboundReceivingRecord[],
  options?: {
    statusFilter?: string;
    dateFilter?: string;
    searchQuery?: string;
    singleRecordTitle?: string;
  }
): string {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const statusLabel =
    !options?.statusFilter || options.statusFilter === 'all'
      ? 'Semua Status Penerimaan'
      : options.statusFilter;

  // Header Banner
  doc.setFillColor(6, 95, 70); // emerald-800
  doc.rect(0, 0, pageWidth, 30, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('1010GROUP F&B MANAGEMENT', 14, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text('Divisi Gudang Pusat (Central Warehouse) & Penerimaan Barang (Inbound Receiving)', 14, 18);
  doc.text(
    options?.singleRecordTitle
      ? `Laporan Dokumen Penerimaan Barang: ${options.singleRecordTitle}`
      : 'Laporan Resmi Rekapitulasi Status Penerimaan Barang (Receiving Inbound)',
    14,
    23.5
  );

  // Right Header Badge
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('INBOUND RECEIVING REPORT', pageWidth - 14, 12, { align: 'right' });
  doc.setFontSize(9);
  doc.setTextColor(167, 243, 208); // emerald-200
  doc.text(`Kategori Filter: ${statusLabel.toUpperCase()}`, pageWidth - 14, 18, { align: 'right' });
  doc.setTextColor(226, 232, 240);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`Tanggal Cetak: ${formatDate(new Date())} ${new Date().toLocaleTimeString('id-ID')}`, pageWidth - 14, 23.5, {
    align: 'right',
  });

  let currentY = 36;

  // Summary metrics calculation
  const countFull = records.filter((r) => r.status === 'Diterima Keseluruhan').length;
  const countPartial = records.filter((r) => r.status === 'Diterima Sebagian').length;
  const countWaiting = records.filter((r) => r.status === 'Menunggu Kedatangan').length;

  let totalOrderedQty = 0;
  let totalReceivedQty = 0;
  let totalPendingQty = 0;
  let totalOrderedValue = 0;
  let totalReceivedValue = 0;

  records.forEach((r) => {
    r.items.forEach((it) => {
      totalOrderedQty += it.orderedQty;
      totalReceivedQty += it.receivedQty;
      totalPendingQty += it.pendingQty;
      totalOrderedValue += it.orderedQty * (it.unitPrice || 0);
      totalReceivedValue += it.receivedQty * (it.unitPrice || 0);
    });
  });

  // Box Ringkasan Laporan
  doc.setDrawColor(167, 243, 208);
  doc.setFillColor(236, 253, 245); // emerald-50
  doc.roundedRect(14, currentY, pageWidth - 28, 24, 2, 2, 'FD');

  doc.setTextColor(6, 78, 59);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('PARAMETER & FILTER LAPORAN', 18, currentY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);
  doc.text(`Filter Status: ${statusLabel}`, 18, currentY + 11.5);
  doc.text(
    `Filter Tanggal: ${options?.dateFilter ? formatDate(options.dateFilter) : 'Semua Tanggal'}`,
    18,
    currentY + 16.5
  );
  doc.text(
    `Kata Kunci Pencarian: ${options?.searchQuery?.trim() ? options.searchQuery.trim() : '-'}`,
    18,
    currentY + 21.5
  );

  const midColX = pageWidth * 0.36;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(6, 78, 59);
  doc.text('REKAPITULASI STATUS DOKUMEN PO', midColX, currentY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);
  doc.text(`Total Dokumen Ditampilkan: ${records.length} Dokumen PO`, midColX, currentY + 11.5);
  doc.text(
    `Diterima Keseluruhan: ${countFull} PO  |  Diterima Sebagian: ${countPartial} PO`,
    midColX,
    currentY + 16.5
  );
  doc.text(`Menunggu Kedatangan: ${countWaiting} PO`, midColX, currentY + 21.5);

  const rightColX = pageWidth * 0.69;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(6, 78, 59);
  doc.text('REALISASI KUANTITAS & NILAI BARANG', rightColX, currentY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);
  doc.text(
    `Qty Dipesan: ${totalOrderedQty}  |  Diterima: ${totalReceivedQty}  |  Pending: ${totalPendingQty}`,
    rightColX,
    currentY + 11.5
  );
  doc.text(`Estimasi Nilai PO: ${formatRupiah(totalOrderedValue)}`, rightColX, currentY + 16.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(5, 150, 105);
  doc.text(`Nilai Realisasi Diterima: ${formatRupiah(totalReceivedValue)}`, rightColX, currentY + 21.5);

  currentY += 29;

  // Section 1 Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text(
    `1. Tabel Rekapitulasi Dokumen Penerimaan Barang (${records.length} Dokumen)`,
    14,
    currentY
  );

  currentY += 3;

  // Table 1: Summary of Receiving Documents
  autoTable(doc, {
    startY: currentY,
    head: [
      [
        'No',
        'ID Dokumen',
        'Mitra Vendor',
        'Ref PO & No. DO/SJ',
        'Tgl Penerimaan',
        'Jml SKU',
        'Realisasi Qty',
        'Persentase',
        'Status Penerimaan',
        'Penerima',
        'Nilai Diterima',
      ],
    ],
    body: records.map((r, idx) => {
      const ordQty = r.items.reduce((s, it) => s + it.orderedQty, 0);
      const recQty = r.items.reduce((s, it) => s + it.receivedQty, 0);
      const recVal = r.items.reduce((s, it) => s + it.receivedQty * (it.unitPrice || 0), 0);
      const pct = Math.round((recQty / (ordQty || 1)) * 100);
      return [
        String(idx + 1),
        r.id,
        r.vendorName,
        `${r.poVendorId}${r.doNumber ? ` (DO: ${r.doNumber})` : ''}`,
        formatDate(r.receiveDate),
        `${r.items.length} Item`,
        `${recQty} / ${ordQty}`,
        `${pct}%`,
        r.status,
        r.receivedBy || '-',
        formatRupiah(recVal),
      ];
    }),
    foot: [
      [
        {
          content: 'TOTAL KESELURUHAN DOKUMEN LAPORAN INBOUND',
          colSpan: 6,
          styles: { halign: 'right', fontStyle: 'bold' },
        },
        {
          content: `${totalReceivedQty} / ${totalOrderedQty}`,
          styles: { halign: 'center', fontStyle: 'bold' },
        },
        {
          content: `${Math.round((totalReceivedQty / (totalOrderedQty || 1)) * 100)}%`,
          styles: { halign: 'center', fontStyle: 'bold' },
        },
        {
          content: `${records.length} Dokumen`,
          colSpan: 2,
          styles: { halign: 'center', fontStyle: 'bold' },
        },
        {
          content: formatRupiah(totalReceivedValue),
          styles: { halign: 'right', fontStyle: 'bold' },
        },
      ],
    ],
    styles: {
      fontSize: 7.5,
      cellPadding: 2,
    },
    headStyles: {
      fillColor: [5, 150, 105], // emerald-600
      textColor: 255,
      fontStyle: 'bold',
    },
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 9 },
      1: { cellWidth: 26 },
      4: { halign: 'center', cellWidth: 24 },
      5: { halign: 'center', cellWidth: 16 },
      6: { halign: 'center', cellWidth: 22 },
      7: { halign: 'center', cellWidth: 18 },
      8: { halign: 'center', cellWidth: 34 },
      10: { halign: 'right', cellWidth: 28 },
    },
  });

  // Table 2: Detailed Item Breakdown across the exported documents
  const afterSummaryY =
    ((doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ||
      currentY + 40) + 9;

  let detailStartY = afterSummaryY;
  if (detailStartY > pageHeight - 45) {
    doc.addPage();
    detailStartY = 20;
  }

  const flattenedItems: {
    docId: string;
    poVendorId: string;
    vendorName: string;
    receiveDate: string;
    status: string;
    sku: string;
    itemName: string;
    category: string;
    unit: string;
    orderedQty: number;
    receivedQty: number;
    pendingQty: number;
    unitPrice: number;
    receivedVal: number;
  }[] = [];

  records.forEach((r) => {
    r.items.forEach((it) => {
      flattenedItems.push({
        docId: r.id,
        poVendorId: r.poVendorId,
        vendorName: r.vendorName,
        receiveDate: r.receiveDate,
        status: r.status,
        sku: it.sku,
        itemName: it.itemName,
        category: it.category,
        unit: it.unit,
        orderedQty: it.orderedQty,
        receivedQty: it.receivedQty,
        pendingQty: it.pendingQty,
        unitPrice: it.unitPrice || 0,
        receivedVal: it.receivedQty * (it.unitPrice || 0),
      });
    });
  });

  if (flattenedItems.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text(
      `2. Rincian Item Barang per Dokumen Penerimaan (${flattenedItems.length} Baris Item)`,
      14,
      detailStartY
    );

    autoTable(doc, {
      startY: detailStartY + 3,
      head: [
        [
          'No',
          'ID Dokumen & PO',
          'Mitra Vendor',
          'SKU',
          'Nama Barang',
          'Kategori',
          'Unit',
          'Dipesan',
          'Diterima',
          'Sisa Pending',
          'Harga Satuan',
          'Nilai Diterima',
        ],
      ],
      body: flattenedItems.map((row, idx) => [
        String(idx + 1),
        `${row.docId} (${row.poVendorId})`,
        row.vendorName,
        row.sku,
        row.itemName,
        row.category,
        row.unit,
        String(row.orderedQty),
        String(row.receivedQty),
        String(row.pendingQty),
        formatRupiah(row.unitPrice),
        formatRupiah(row.receivedVal),
      ]),
      foot: [
        [
          {
            content: 'TOTAL RINCIAN ITEM PENERIMAAN BARANG',
            colSpan: 7,
            styles: { halign: 'right', fontStyle: 'bold' },
          },
          {
            content: String(totalOrderedQty),
            styles: { halign: 'center', fontStyle: 'bold' },
          },
          {
            content: String(totalReceivedQty),
            styles: { halign: 'center', fontStyle: 'bold' },
          },
          {
            content: String(totalPendingQty),
            styles: { halign: 'center', fontStyle: 'bold' },
          },
          {
            content: '-',
            styles: { halign: 'center', fontStyle: 'bold' },
          },
          {
            content: formatRupiah(totalReceivedValue),
            styles: { halign: 'right', fontStyle: 'bold' },
          },
        ],
      ],
      styles: {
        fontSize: 7,
        cellPadding: 1.8,
      },
      headStyles: {
        fillColor: [30, 41, 59], // slate-800
        textColor: 255,
        fontStyle: 'bold',
      },
      footStyles: {
        fillColor: [241, 245, 249],
        textColor: [15, 23, 42],
        fontStyle: 'bold',
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 8 },
        3: { cellWidth: 18 },
        6: { halign: 'center', cellWidth: 14 },
        7: { halign: 'center', cellWidth: 16 },
        8: { halign: 'center', cellWidth: 16 },
        9: { halign: 'center', cellWidth: 18 },
        10: { halign: 'right', cellWidth: 24 },
        11: { halign: 'right', cellWidth: 26 },
      },
    });
  }

  const finalY =
    (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ||
    detailStartY + 40;

  let sigY = finalY + 10;
  if (sigY > pageHeight - 36) {
    doc.addPage();
    sigY = 20;
  }

  // Signature Blocks
  const colW = (pageWidth - 28) / 3;
  doc.setDrawColor(203, 213, 225);
  doc.rect(14, sigY, colW - 4, 22);
  doc.rect(14 + colW + 2, sigY, colW - 4, 22);
  doc.rect(14 + colW * 2 + 4, sigY, colW - 4, 22);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(30, 41, 59);
  doc.text('Dibuat Oleh (Admin Receiving / Inbound)', 14 + (colW - 4) / 2, sigY + 5, {
    align: 'center',
  });
  doc.text('Diperiksa Oleh (Kepala Gudang Pusat)', 14 + colW + 2 + (colW - 4) / 2, sigY + 5, {
    align: 'center',
  });
  doc.text(
    'Mengetahui (Purchasing & Cost Control)',
    14 + colW * 2 + 4 + (colW - 4) / 2,
    sigY + 5,
    { align: 'center' }
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('Divisi Inbound Gudang', 14 + (colW - 4) / 2, sigY + 19, { align: 'center' });
  doc.text('Logistik & Inventory', 14 + colW + 2 + (colW - 4) / 2, sigY + 19, {
    align: 'center',
  });
  doc.text('1010Group F&B Management', 14 + colW * 2 + 4 + (colW - 4) / 2, sigY + 19, {
    align: 'center',
  });

  const safeSuffix = options?.singleRecordTitle
    ? `_${options.singleRecordTitle.replace(/[^a-zA-Z0-9]/g, '_')}`
    : statusLabel === 'Semua Status Penerimaan'
    ? '_Semua_Status'
    : `_${statusLabel.replace(/[^a-zA-Z0-9]/g, '_')}`;
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const fileName = `Laporan_Inbound_Receiving${safeSuffix}_${dateStr}.pdf`;

  doc.save(fileName);
  return fileName;
}

/**
 * Export Laporan Audit Trail & Log Aktivitas Lintas Departemen ke PDF (.pdf)
 */
export function exportAuditTrailToPDF(
  logs: AuditLogEntry[],
  options?: {
    categoryFilter?: string;
    departmentFilter?: string;
    moduleFilter?: string;
    searchQuery?: string;
  }
): string {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Header Banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 30, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('1010GROUP F&B MANAGEMENT', 14, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text('Sistem Audit Internal, Kepatuhan Operasional & Akuntabilitas Lintas Departemen', 14, 18);
  doc.text(
    'Laporan Resmi Audit Trail: Persetujuan Order, Penyesuaian Stok & Aktivitas Sistem',
    14,
    23.5
  );

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('AUDIT TRAIL & ACTIVITY LOG', pageWidth - 14, 12, { align: 'right' });
  doc.setFontSize(8.5);
  doc.setTextColor(253, 224, 71); // amber-300
  doc.text(`Total Rekaman Log: ${logs.length} Aktivitas`, pageWidth - 14, 18, { align: 'right' });
  doc.setTextColor(226, 232, 240);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(
    `Dicetak: ${formatDate(new Date())} ${new Date().toLocaleTimeString('id-ID')}`,
    pageWidth - 14,
    23.5,
    { align: 'right' }
  );

  let currentY = 36;

  const countApprovals = logs.filter((l) => l.category === 'Order Approval').length;
  const countStock = logs.filter((l) => l.category === 'Stock Adjustment').length;
  const countLifecycle = logs.filter((l) => l.category === 'Order Lifecycle').length;
  const countSystem = logs.filter((l) => l.category === 'Master Data & System').length;

  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, currentY, pageWidth - 28, 22, 2, 2, 'FD');

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('FILTER & CAKUPAN AUDIT', 18, currentY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  doc.text(
    `Kategori: ${options?.categoryFilter && options.categoryFilter !== 'all' ? options.categoryFilter : 'Semua Kategori'}`,
    18,
    currentY + 11.5
  );
  doc.text(
    `Departemen: ${options?.departmentFilter && options.departmentFilter !== 'all' ? options.departmentFilter : 'Semua Departemen'}  |  Modul: ${options?.moduleFilter && options.moduleFilter !== 'all' ? options.moduleFilter : 'Semua Modul'}`,
    18,
    currentY + 17
  );

  const rightColX = pageWidth * 0.54;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('RINGKASAN KATEGORI AKTIVITAS', rightColX, currentY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  doc.text(
    `Order Approval (Persetujuan): ${countApprovals}  |  Stock Adjustment (Stok/SO): ${countStock}`,
    rightColX,
    currentY + 11.5
  );
  doc.text(
    `Order Lifecycle (Siklus Order): ${countLifecycle}  |  Master Data & System: ${countSystem}`,
    rightColX,
    currentY + 17
  );

  currentY += 27;

  autoTable(doc, {
    startY: currentY,
    head: [
      [
        'No',
        'Waktu (Timestamp)',
        'Pelaksana (Role)',
        'Departemen / Unit',
        'Modul & Kategori',
        'Aktivitas & Ref ID',
        'Rincian Aktivitas & Perubahan Data (Before -> After)',
      ],
    ],
    body: logs.map((log, idx) => {
      const dt = new Date(log.timestamp);
      const timeFormatted = `${formatDate(log.timestamp.slice(0, 10))} ${dt.toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
      })}`;
      const changeText =
        log.changes && log.changes.length > 0
          ? '\n' +
            log.changes
              .map(
                (c) =>
                  `• ${c.field}: ${c.before !== undefined ? `${c.before} -> ` : ''}${c.after ?? '-'}`
              )
              .join('\n')
          : '';
      return [
        String(idx + 1),
        timeFormatted,
        `${log.actorName}\n(${log.actorRole})`,
        `${log.department}${log.outletName ? `\n[${log.outletName}]` : ''}`,
        `${log.module}\n[${log.category}]`,
        `${log.action}${log.referenceId ? `\nRef: ${log.referenceId}` : ''}`,
        `${log.description}${changeText}`,
      ];
    }),
    styles: {
      fontSize: 7.5,
      cellPadding: 2,
    },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: 255,
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 9 },
      1: { cellWidth: 26 },
      2: { cellWidth: 30 },
      3: { cellWidth: 34 },
      4: { cellWidth: 34 },
      5: { cellWidth: 42 },
    },
  });

  const finalY =
    (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ||
    currentY + 40;

  let sigY = finalY + 10;
  if (sigY > pageHeight - 34) {
    doc.addPage();
    sigY = 20;
  }

  const colW = (pageWidth - 28) / 3;
  doc.setDrawColor(203, 213, 225);
  doc.rect(14, sigY, colW - 4, 20);
  doc.rect(14 + colW + 2, sigY, colW - 4, 20);
  doc.rect(14 + colW * 2 + 4, sigY, colW - 4, 20);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(30, 41, 59);
  doc.text('Diekspor Oleh (Sistem Audit)', 14 + (colW - 4) / 2, sigY + 5, { align: 'center' });
  doc.text('Diperiksa Oleh (Cost Control / Audit)', 14 + colW + 2 + (colW - 4) / 2, sigY + 5, {
    align: 'center',
  });
  doc.text('Disetujui Oleh (Manajemen 1010Group)', 14 + colW * 2 + 4 + (colW - 4) / 2, sigY + 5, {
    align: 'center',
  });

  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const fileName = `Laporan_Audit_Trail_1010Group_${dateStr}.pdf`;
  doc.save(fileName);
  return fileName;
}

/**
 * Export Surat Jalan / Outlet Purchase Requisition Form to PDF (.pdf)
 * Format sesuai dokumen referensi (/public/assets/aistudio/Surat_Jalan_6b4c4d4b.pdf):
 * - Judul: Outlet Purchase Requisition Form / PT. Sepuluh Sepuluh
 * - Form ID: DD/MM/YYYY-OUTLET-Department (atau order.id)
 * - Tabel Info Form (Outlet Name, Nama PIC, Department, Date Requested, Status Pesanan, Catatan)
 * - Tabel Rincian Barang 8 Kolom (No, SKU, Item Name, Category, Qty Dipesan, Qty Disiapkan [highlight pink/merah], Unit, Catatan)
 * - Kolom Tanda Tangan: Received by, Delivered by, Checked by, dengan garis tanda tangan di bawahnya
 */
export function exportSuratJalanToPDF(
  order: OutletOrder,
  masterInventory?: InventoryItem[]
): string {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const leftMargin = 18;
  const rightMargin = 18;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Title Block
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13.5);
  doc.setTextColor(0, 0, 0);
  doc.text('Outlet Purchase Requisition Form', leftMargin, 28);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text('PT. Sepuluh Sepuluh', leftMargin, 34);

  // Format Form ID line above metadata grid (matching reference PDF)
  const formattedDateReq = formatDate(order.dateRequested);
  const displayFormId =
    order.id && order.id.includes('/')
      ? order.id
      : `${formattedDateReq}-${order.outletName}-${order.department}`;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(0, 0, 0);
  doc.text('Form ID', leftMargin + 0.5, 38.5);
  doc.text(displayFormId, leftMargin + 21.5, 38.5);

  const statusText =
    order.status === 'Siap Dikirim' ? 'PO Terkirim' : order.status || 'PO Terkirim';

  // Top-left Metadata Table (Outlet Name .. Catatan)
  autoTable(doc, {
    startY: 40,
    margin: { left: leftMargin },
    tableWidth: 42.5,
    theme: 'grid',
    body: [
      ['Outlet Name', order.outletName],
      ['Nama PIC', order.picName || '-'],
      ['Department', order.department],
      ['Date Requested', formattedDateReq],
      ['Status Pesanan', statusText],
      ['Catatan', order.notes || ''],
    ],
    styles: {
      font: 'helvetica',
      fontSize: 7.2,
      cellPadding: { top: 1.2, right: 1.5, bottom: 1.2, left: 1.5 },
      lineColor: [209, 213, 219],
      lineWidth: 0.25,
      textColor: [0, 0, 0],
      valign: 'middle',
      fillColor: [255, 255, 255],
    },
    columnStyles: {
      0: {
        cellWidth: 21,
        fontStyle: 'bold',
        textColor: [0, 0, 0],
      },
      1: {
        cellWidth: 21.5,
        textColor: [0, 0, 0],
      },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 1 && data.row.index === 3) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.halign = 'right';
      }
    },
  });

  const afterMetaY =
    ((doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY || 68) + 5;

  // Prepare Items Rows (8 columns matching Surat_Jalan_6b4c4d4b.pdf)
  const itemRows = order.items.map((item, idx) => {
    const matchedInv =
      masterInventory && masterInventory.length > 0
        ? findInventoryItemBySku(item.sku, item.itemName, masterInventory)
        : undefined;
    const resolvedSku = matchedInv ? matchedInv.sku : item.sku;
    const resolvedName = item.itemName || matchedInv?.itemName || item.sku;
    const resolvedCategory = matchedInv ? matchedInv.category : item.category;
    const qtyPreparedVal =
      item.qtyPrepared !== undefined && item.qtyPrepared !== null ? item.qtyPrepared : item.qty;

    return [
      String(idx + 1),
      resolvedSku,
      resolvedName,
      resolvedCategory,
      String(item.qty),
      String(qtyPreparedVal),
      item.unit,
      item.notes || '-',
    ];
  });

  // Items Table (No, SKU, Item Name, Category, Qty Dipesan, Qty Disiapkan, Unit, Catatan)
  autoTable(doc, {
    startY: afterMetaY,
    margin: { left: leftMargin, right: rightMargin },
    theme: 'grid',
    head: [
      [
        'No',
        'SKU',
        'Item Name',
        'Category',
        'Qty Dipesan',
        'Qty Disiapkan',
        'Unit',
        'Catatan',
      ],
    ],
    body: itemRows,
    styles: {
      font: 'helvetica',
      fontSize: 7.2,
      cellPadding: { top: 1.4, right: 1.8, bottom: 1.4, left: 1.8 },
      lineColor: [209, 213, 219],
      lineWidth: 0.25,
      textColor: [0, 0, 0],
      valign: 'middle',
      fillColor: [255, 255, 255],
    },
    headStyles: {
      fillColor: [243, 244, 246],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      halign: 'center',
      lineColor: [209, 213, 219],
      lineWidth: 0.25,
    },
    columnStyles: {
      0: { cellWidth: 16, halign: 'center' },
      1: { cellWidth: 18, halign: 'left', fontStyle: 'bold' },
      2: { cellWidth: 62, halign: 'left' },
      3: { cellWidth: 20, halign: 'left' },
      4: { cellWidth: 15, halign: 'right' },
      5: {
        cellWidth: 16,
        halign: 'right',
        fontStyle: 'bold',
        textColor: [156, 0, 6],
        fillColor: [252, 228, 230],
      },
      6: { cellWidth: 9, halign: 'center' },
      7: { cellWidth: 18, halign: 'left' },
    },
    didParseCell: (data) => {
      if (data.section === 'head' && data.column.index === 5) {
        data.cell.styles.fillColor = [248, 203, 208];
        data.cell.styles.textColor = [0, 0, 0];
      }
    },
  });

  const afterItemsY =
    (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ||
    afterMetaY + 40;

  let sigLabelY = afterItemsY + 11;
  if (sigLabelY + 26 > pageHeight - 14) {
    doc.addPage();
    sigLabelY = 25;
  }

  const sigLineY = sigLabelY + 19;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(0, 0, 0);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.45);

  // Left: Received by,
  const leftLineStart = leftMargin;
  const leftLineEnd = leftMargin + 37;
  doc.text('Received by,', (leftLineStart + leftLineEnd) / 2, sigLabelY, { align: 'center' });
  doc.line(leftLineStart, sigLineY, leftLineEnd, sigLineY);

  // Middle-Right: Delivered by,
  const midLineStart = leftMargin + 95;
  const midLineEnd = leftMargin + 123;
  doc.text('Delivered by,', (midLineStart + midLineEnd) / 2, sigLabelY, { align: 'center' });
  doc.line(midLineStart, sigLineY, midLineEnd, sigLineY);

  // Far-Right: Checked by,
  const rightLineEnd = pageWidth - rightMargin;
  const rightLineStart = rightLineEnd - 30;
  doc.text('Checked by,', (rightLineStart + rightLineEnd) / 2, sigLabelY, { align: 'center' });
  doc.line(rightLineStart, sigLineY, rightLineEnd, sigLineY);

  const safeOrderId = `${order.id}`.replace(/[\/\\?%*:|"<>]/g, '-');
  const fileName = `Surat_Jalan_${safeOrderId}.pdf`;
  doc.save(fileName);
  return fileName;
}




