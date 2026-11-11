import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { InboundReceivingRecord, ItemCategory, ITEM_CATEGORIES, ManualInboundRecord } from '../../types';
import { formatRupiah } from '../../utils/excelExport';
import { exportInboundReportToPDF } from '../../utils/pdfExport';
import { formatDate } from '../../utils/dateUtils';
import { scrollToTop } from '../../utils/scrollHelper';
import { SuccessSubmitModal, SuccessDetail } from '../common/SuccessSubmitModal';
import {
  ArrowDownToLine,
  Truck,
  CheckCircle2,
  Clock,
  PlusCircle,
  PackagePlus,
  FileCheck2,
  FileDown,
  Search,
  Check,
  AlertCircle,
  X,
  FileText,
  Eye,
  ChevronUp,
  ChevronDown,
  SlidersHorizontal,
  Calendar,
  ArrowUpDown,
  Filter,
  Trash2,
  AlertTriangle,
  Building2,
  DollarSign,
  Tag,
  Package,
} from 'lucide-react';

export const InboundSection: React.FC = () => {
  const {
    receivingRecords,
    receiveGoods,
    deleteReceivingRecord,
    manualInboundRecords,
    addManualInbound,
    deleteManualInbound,
    inventory,
    vendors,
    currentUser,
  } = useApp();

  const isAdmin = currentUser.position === 'Administrator';
  const [activeSubTab, setActiveSubTab] = useState<'receiving' | 'incoming' | 'report'>('receiving');

  // State dropdown menu opsi aksi form inbound
  const [openActionMenuRecordId, setOpenActionMenuRecordId] = useState<string | null>(null);
  const [openActionMenuReportId, setOpenActionMenuReportId] = useState<string | null>(null);

  // State untuk konfirmasi hapus Form Inbound / Receiving (Khusus Administrator)
  const [recordToDelete, setRecordToDelete] = useState<InboundReceivingRecord | null>(null);
  const [showDeleteSelectorModal, setShowDeleteSelectorModal] = useState<boolean>(false);
  const [deleteSelectorSearch, setDeleteSelectorSearch] = useState<string>('');

  // State untuk konfirmasi hapus Manual Inbound Record (Khusus Administrator)
  const [manualRecordToDelete, setManualRecordToDelete] = useState<ManualInboundRecord | null>(null);

  // Receive Goods Modal State
  const [selectedReceivingRecord, setSelectedReceivingRecord] = useState<InboundReceivingRecord | null>(null);
  const [receivedQtyMap, setReceivedQtyMap] = useState<Record<string, number>>({});
  const [receivedPriceMap, setReceivedPriceMap] = useState<Record<string, number>>({});
  const [receiveNotes, setReceiveNotes] = useState<string>('');

  // Form Inbound/Receiving yang dipilih untuk menampilkan list barang
  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);

  // Filter & Search states for Receiving PO
  const [recvSearchQuery, setRecvSearchQuery] = useState<string>('');
  const [recvDateFilter, setRecvDateFilter] = useState<string>('');
  const [recvDateSortOrder, setRecvDateSortOrder] = useState<'desc' | 'asc'>('desc');

  // Filter & Search states for Report Status
  const [reportSearchQuery, setReportSearchQuery] = useState<string>('');
  const [reportDateFilter, setReportDateFilter] = useState<string>('');
  const [reportDateSortOrder, setReportDateSortOrder] = useState<'desc' | 'asc'>('desc');
  const [reportStatusFilter, setReportStatusFilter] = useState<
    'all' | 'Diterima Keseluruhan' | 'Diterima Sebagian' | 'Menunggu Kedatangan'
  >('all');
  const [expandedReportRecordId, setExpandedReportRecordId] = useState<string | null>(null);

  // Filtered & sorted receiving records
  const filteredAndSortedReceivingRecords = [...receivingRecords]
    .filter((r) => {
      const matchSearch =
        recvSearchQuery === '' ||
        r.id.toLowerCase().includes(recvSearchQuery.toLowerCase()) ||
        r.vendorName.toLowerCase().includes(recvSearchQuery.toLowerCase()) ||
        r.poVendorId.toLowerCase().includes(recvSearchQuery.toLowerCase()) ||
        r.doNumber.toLowerCase().includes(recvSearchQuery.toLowerCase()) ||
        r.status.toLowerCase().includes(recvSearchQuery.toLowerCase());
      const matchDate = recvDateFilter === '' || r.receiveDate === recvDateFilter;
      return matchSearch && matchDate;
    })
    .sort((a, b) => {
      const timeA = new Date(a.receiveDate).getTime();
      const timeB = new Date(b.receiveDate).getTime();
      return recvDateSortOrder === 'desc' ? timeB - timeA : timeA - timeB;
    });

  // Filtered & sorted report records
  const filteredAndSortedReportRecords = [...receivingRecords]
    .filter((r) => {
      const matchSearch =
        reportSearchQuery === '' ||
        r.id.toLowerCase().includes(reportSearchQuery.toLowerCase()) ||
        r.vendorName.toLowerCase().includes(reportSearchQuery.toLowerCase()) ||
        r.poVendorId.toLowerCase().includes(reportSearchQuery.toLowerCase()) ||
        r.doNumber.toLowerCase().includes(reportSearchQuery.toLowerCase()) ||
        r.status.toLowerCase().includes(reportSearchQuery.toLowerCase());
      const matchDate = reportDateFilter === '' || r.receiveDate === reportDateFilter;
      const matchStatus = reportStatusFilter === 'all' || r.status === reportStatusFilter;
      return matchSearch && matchDate && matchStatus;
    })
    .sort((a, b) => {
      const timeA = new Date(a.receiveDate).getTime();
      const timeB = new Date(b.receiveDate).getTime();
      return reportDateSortOrder === 'desc' ? timeB - timeA : timeA - timeB;
    });

  // Manual Incoming Goods Form State
  const [manualSku, setManualSku] = useState<string>(inventory[0]?.sku || '');
  const [itemSearchQuery, setItemSearchQuery] = useState<string>('');
  const [isItemDropdownOpen, setIsItemDropdownOpen] = useState<boolean>(false);
  const searchDropdownRef = useRef<HTMLDivElement>(null);

  const [manualQty, setManualQty] = useState<number | ''>(10);
  const [manualPrice, setManualPrice] = useState<number | ''>(0);
  const [manualIncludePPN, setManualIncludePPN] = useState<boolean>(false);
  const [manualPPNRate, setManualPPNRate] = useState<number>(11);
  const [manualDate, setManualDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [manualSourceType, setManualSourceType] = useState<'vendor' | 'other'>('vendor');
  const [manualVendorName, setManualVendorName] = useState<string>(() => vendors[0]?.namaVendor || '');
  const [manualOtherSource, setManualOtherSource] = useState<string>('Pembelian Langsung Pasar / Petty Cash');
  const [manualCustomSource, setManualCustomSource] = useState<string>('');
  const [manualNotes, setManualNotes] = useState<string>('');
  const [manualSuccessMsg, setManualSuccessMsg] = useState<string>('');

  // Close search dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchDropdownRef.current && !searchDropdownRef.current.contains(e.target as Node)) {
        setIsItemDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Update selected item default price when SKU changes
  const selectedInventoryItem = inventory.find((i) => i.sku === manualSku) || null;

  const handleSelectItem = (item: (typeof inventory)[0]) => {
    setManualSku(item.sku);
    setItemSearchQuery('');
    setIsItemDropdownOpen(false);
    if (item.priceBudget && item.priceBudget > 0) {
      setManualPrice(item.priceBudget);
    }
    // If item has a registered vendor, auto-suggest it
    if (item.vendor) {
      const matchVendor = vendors.find(
        (v) => v.namaVendor.toLowerCase() === item.vendor?.toLowerCase()
      );
      if (matchVendor) {
        setManualSourceType('vendor');
        setManualVendorName(matchVendor.namaVendor);
      }
    }
  };

  // Filter inventory items based on search query
  const filteredSearchItems = inventory.filter((item) => {
    if (!itemSearchQuery.trim()) return true;
    const q = itemSearchQuery.toLowerCase();
    return (
      item.sku.toLowerCase().includes(q) ||
      item.itemName.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q)
    );
  });

  // Success Pop-up Modal state
  const [showSuccessModal, setShowSuccessModal] = useState<boolean>(false);
  const [successModalData, setSuccessModalData] = useState<{
    title: string;
    message: string;
    details: SuccessDetail[];
  }>({
    title: 'Data Telah Berhasil Di-input!',
    message: '',
    details: [],
  });

  // Open Receive Goods Modal
  const handleOpenReceiveModal = (record: InboundReceivingRecord) => {
    setSelectedReceivingRecord(record);
    const initialMap: Record<string, number> = {};
    const initialPriceMap: Record<string, number> = {};
    record.items.forEach((it) => {
      initialMap[it.sku] = it.pendingQty; // Default to receiving remaining pending qty
      const invItem = inventory.find((inv) => inv.sku === it.sku);
      initialPriceMap[it.sku] =
        it.unitPrice !== undefined && it.unitPrice > 0
          ? it.unitPrice
          : invItem?.priceBudget ?? invItem?.price ?? 0;
    });
    setReceivedQtyMap(initialMap);
    setReceivedPriceMap(initialPriceMap);
    setReceiveNotes('');
  };

  // Submit Receive Goods
  const handleSubmitReceive = () => {
    if (!selectedReceivingRecord) return;

    const payload = selectedReceivingRecord.items.map((it) => ({
      sku: it.sku,
      qtyReceived: receivedQtyMap[it.sku] || 0,
      unitPrice: receivedPriceMap[it.sku] ?? it.unitPrice,
    }));

    const poVendorId = selectedReceivingRecord.poVendorId;
    const doNumber = selectedReceivingRecord.doNumber;
    const vendorName = selectedReceivingRecord.vendorName;
    const totalRecvQty = payload.reduce((acc, it) => acc + it.qtyReceived, 0);

    receiveGoods(selectedReceivingRecord.id, payload, receiveNotes);
    setSelectedReceivingRecord(null);

    // Pop-up sukses
    setSuccessModalData({
      title: 'Data Telah Berhasil Di-input!',
      message: `Penerimaan barang dari PO ${poVendorId} (${vendorName}) telah berhasil diproses ke Inbound Gudang dan harga masuk telah diakumulasi ke Harga Actual Master Inventory.`,
      details: [
        { label: 'Nomor PO Vendor', value: poVendorId },
        { label: 'No. Surat Jalan (DO)', value: doNumber },
        { label: 'Vendor', value: vendorName },
        { label: 'Total Unit Diterima', value: `${totalRecvQty} item` },
        { label: 'Penerima', value: currentUser.username },
        { label: 'Catatan', value: receiveNotes || '-' },
      ],
    });
    setShowSuccessModal(true);
    scrollToTop();
  };

  // Submit Manual Incoming Goods
  const handleManualInboundSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const item = inventory.find((i) => i.sku === manualSku);
    if (!item) {
      alert('Harap cari dan pilih barang dari Master Inventory terlebih dahulu.');
      return;
    }

    if (manualQty === '' || Number(manualQty) <= 0) {
      alert('Jumlah Masuk (Qty) tidak boleh kosong dan harus lebih dari 0.');
      return;
    }

    if (manualPrice === '' || Number(manualPrice) < 0) {
      alert('Harga Masuk / Satuan (Rp) tidak boleh kosong.');
      return;
    }

    const finalSource =
      manualSourceType === 'vendor'
        ? `Vendor: ${manualVendorName || 'Supplier Luar'}`
        : manualOtherSource === 'Lainnya (Input Manual)'
        ? manualCustomSource || 'Manual Non-Vendor'
        : manualOtherSource;

    const submittedQty = Number(manualQty);
    const basePrice = Number(manualPrice);
    const ppnRate = manualIncludePPN ? Math.max(0, Number(manualPPNRate) || 0) : 0;
    const ppnPerUnit = manualIncludePPN ? Math.round(basePrice * (ppnRate / 100)) : 0;
    const submittedPrice = basePrice + ppnPerUnit;
    const totalPPN = ppnPerUnit * submittedQty;
    const submittedTotalPrice = submittedPrice * submittedQty;
    const submittedDate = manualDate || new Date().toISOString().slice(0, 10);

    addManualInbound({
      sku: item.sku,
      itemName: item.itemName,
      category: item.category,
      qty: submittedQty,
      unit: item.unit,
      price: submittedPrice,
      priceBeforePPN: basePrice,
      includePPN: manualIncludePPN,
      ppnPercentage: manualIncludePPN ? ppnRate : undefined,
      ppnAmount: manualIncludePPN ? totalPPN : undefined,
      totalPrice: submittedTotalPrice,
      vendorName: manualSourceType === 'vendor' ? manualVendorName : undefined,
      source: finalSource,
      date: submittedDate,
      receivedBy: currentUser.username,
      notes: manualNotes,
    });

    // Pop-up sukses
    setSuccessModalData({
      title: 'Barang Masuk Berhasil Dicatat!',
      message: `Barang masuk (${submittedQty} ${item.unit} ${item.itemName}) berhasil dicatat${
        manualIncludePPN ? ` (termasuk PPN ${ppnRate}%)` : ''
      } dan menambah stok serta akumulasi Harga Actual di Master Inventory.`,
      details: [
        { label: 'Tanggal Masuk', value: formatDate(submittedDate) },
        { label: 'SKU Barang', value: item.sku },
        { label: 'Nama Barang', value: item.itemName },
        { label: 'Kategori', value: item.category },
        { label: 'Jumlah Masuk', value: `${submittedQty} ${item.unit}` },
        ...(manualIncludePPN
          ? [
              { label: 'Harga Dasar / Unit', value: formatRupiah(basePrice) },
              { label: `PPN (${ppnRate}%)`, value: `${formatRupiah(ppnPerUnit)} / unit (Total PPN: ${formatRupiah(totalPPN)})` },
              { label: 'Harga Satuan + PPN', value: formatRupiah(submittedPrice) },
            ]
          : [{ label: 'Harga Satuan', value: formatRupiah(submittedPrice) }]),
        { label: 'Total Nilai Masuk', value: formatRupiah(submittedTotalPrice) },
        { label: 'Sumber / Vendor', value: finalSource },
        { label: 'Petugas Penerima', value: currentUser.username },
        { label: 'Catatan', value: manualNotes || '-' },
      ],
    });
    setShowSuccessModal(true);

    // Bersihkan formulir
    setManualNotes('');
    setManualCustomSource('');
    scrollToTop();
  };

  // Handle confirm delete receiving record
  const handleConfirmDeleteReceivingRecord = () => {
    if (!recordToDelete) return;
    const deletedId = recordToDelete.id;
    const deletedVendor = recordToDelete.vendorName;
    const deletedPO = recordToDelete.poVendorId;

    deleteReceivingRecord(deletedId);
    setRecordToDelete(null);

    setSuccessModalData({
      title: 'Form Inbound Berhasil Dihapus!',
      message: `Dokumen receiving ${deletedId} (${deletedVendor} - PO ${deletedPO}) telah dihapus dari sistem.`,
      details: [
        { label: 'ID Dokumen', value: deletedId },
        { label: 'Vendor', value: deletedVendor },
        { label: 'Ref PO', value: deletedPO },
        { label: 'Dihapus Oleh', value: `${currentUser.username} (${currentUser.position})` },
      ],
    });
    setShowSuccessModal(true);
  };

  // Handle confirm delete manual inbound record
  const handleConfirmDeleteManualInbound = () => {
    if (!manualRecordToDelete) return;
    const id = manualRecordToDelete.id;
    const sku = manualRecordToDelete.sku;
    const itemName = manualRecordToDelete.itemName;

    deleteManualInbound(id);
    setManualRecordToDelete(null);

    setSuccessModalData({
      title: 'Transaksi Masuk Berhasil Dihapus!',
      message: `Pencatatan barang masuk manual ${itemName} (${sku}) berhasil dihapus dan saldo Inbound disesuaikan kembali.`,
      details: [
        { label: 'ID Transaksi', value: id },
        { label: 'Barang', value: `${sku} - ${itemName}` },
        { label: 'Dihapus Oleh', value: `${currentUser.username} (${currentUser.position})` },
      ],
    });
    setShowSuccessModal(true);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <ArrowDownToLine className="w-6 h-6 text-emerald-600" />
            Manajemen Inbound (Penerimaan Barang Gudang)
          </h1>
          <p className="text-xs text-slate-500">
            Terima pesanan vendor dari Purchasing, input manual barang masuk, dan pantau status penerimaan.
          </p>
        </div>

        {/* Sub-tabs */}
        <div className="flex items-center gap-1.5 bg-slate-200/70 p-1 rounded-xl">
          <button
            onClick={() => setActiveSubTab('receiving')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeSubTab === 'receiving'
                ? 'bg-white text-emerald-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            Receiving ({receivingRecords.length})
          </button>
          <button
            onClick={() => setActiveSubTab('incoming')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeSubTab === 'incoming'
                ? 'bg-white text-emerald-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <PackagePlus className="w-3.5 h-3.5" />
            Incoming Goods
          </button>
          <button
            onClick={() => setActiveSubTab('report')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeSubTab === 'report'
                ? 'bg-white text-emerald-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileCheck2 className="w-3.5 h-3.5" />
            Report Status
          </button>
        </div>
      </div>

      {/* 1. Subtab: Receiving */}
      {activeSubTab === 'receiving' && (
        <div className="space-y-4">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 text-xs text-emerald-900 flex items-start gap-2.5">
            <Truck className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
            <div>
              <span className="font-bold">Daftar PO Vendor yang Dipesan Pihak Purchasing:</span>
              <p className="text-[11px] text-emerald-800 mt-0.5">
                Ketika vendor mengantarkan pesanan fisik ke gudang pusat, klik tombol <strong>"Terima Barang"</strong>. Barang yang diterima akan otomatis tercatat dan menambah jumlah <strong>Inbound</strong> pada <strong>Master Inventory</strong>.
              </p>
            </div>
          </div>

          {/* Search & Filter Toolbar for Receiving */}
          <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 text-xs">
            {/* Search Bar */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={recvSearchQuery}
                onChange={(e) => setRecvSearchQuery(e.target.value)}
                placeholder="Cari ID Dokumen, Vendor, Ref PO, DO/SJ, atau Status..."
                className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-hidden font-medium"
              />
              {recvSearchQuery && (
                <button
                  onClick={() => setRecvSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Fitur Hapus Form (Hanya Muncul pada User Administrator - Sejajar dengan Kolom Pencarian) */}
            {isAdmin && (
              <button
                type="button"
                onClick={() => {
                  if (recvSearchQuery.trim() !== '' && filteredAndSortedReceivingRecords.length === 1) {
                    setRecordToDelete(filteredAndSortedReceivingRecords[0]);
                  } else {
                    setDeleteSelectorSearch(recvSearchQuery);
                    setShowDeleteSelectorModal(true);
                  }
                }}
                className="flex items-center justify-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 hover:text-rose-800 border border-rose-300 rounded-lg font-bold text-xs shadow-2xs transition shrink-0 cursor-pointer"
                title="Fitur Hapus Form Inbound (Hanya Muncul pada Administrator)"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                <span>Hapus Form</span>
                <span className="text-[10px] bg-rose-200/70 text-rose-800 px-1.5 py-0.5 rounded font-semibold ml-0.5">Admin</span>
              </button>
            )}

            <div className="flex flex-wrap items-center gap-2">
              {/* Filter Tanggal */}
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 px-2.5 py-1.5 rounded-lg shadow-2xs">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <input
                  type="date"
                  value={recvDateFilter}
                  onChange={(e) => setRecvDateFilter(e.target.value)}
                  className="text-xs text-slate-700 bg-transparent outline-hidden font-medium"
                />
                {recvDateFilter && (
                  <button
                    onClick={() => setRecvDateFilter('')}
                    className="text-[10px] bg-slate-200 hover:bg-slate-300 text-slate-700 px-1.5 py-0.5 rounded font-semibold ml-1 cursor-pointer"
                    title="Tampilkan semua tanggal"
                  >
                    Semua
                  </button>
                )}
              </div>

              {/* Urutkan Tanggal */}
              <button
                onClick={() => setRecvDateSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg font-semibold transition shadow-2xs cursor-pointer"
                title="Urutkan berdasarkan tanggal penerimaan"
              >
                <ArrowUpDown className="w-3.5 h-3.5 text-emerald-600" />
                <span>Urutkan: {recvDateSortOrder === 'desc' ? 'Terbaru' : 'Terlama'}</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {filteredAndSortedReceivingRecords.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400">
                <Truck className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                <p className="text-sm font-semibold">
                  {receivingRecords.length === 0
                    ? 'Belum ada PO Vendor yang diteruskan ke Receiving.'
                    : 'Tidak ada dokumen receiving yang sesuai dengan filter tanggal atau pencarian.'}
                </p>
                {receivingRecords.length === 0 && (
                  <p className="text-xs text-slate-400 mt-1">
                    Pihak Purchasing dapat meneruskan pesanan vendor dari menu <strong>Purchasing & Vendor -&gt; PO Vendor</strong>.
                  </p>
                )}
              </div>
            ) : (
              <>
                {openActionMenuRecordId && (
                  <div
                    className="fixed inset-0 z-30 bg-transparent"
                    onClick={() => setOpenActionMenuRecordId(null)}
                  />
                )}
                {filteredAndSortedReceivingRecords.map((record) => {
                  const isExpanded = expandedRecordId === record.id;
                  const isMenuOpen = openActionMenuRecordId === record.id;

                  return (
                    <div
                      key={record.id}
                      className={`bg-white rounded-xl border transition shadow-xs overflow-visible ${
                        isExpanded ? 'border-emerald-400 ring-1 ring-emerald-400' : 'border-slate-200'
                      }`}
                    >
                      <div
                        onClick={() => setExpandedRecordId(isExpanded ? null : record.id)}
                        className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-slate-100/70 transition rounded-t-xl"
                      >
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-bold text-xs bg-slate-200 text-slate-800 px-2 py-0.5 rounded-md">
                              {record.id}
                            </span>
                            <span className="font-extrabold text-sm text-slate-900">
                              {record.vendorName}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                record.status === 'Diterima Keseluruhan'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : record.status === 'Diterima Sebagian'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-blue-100 text-blue-800'
                              }`}
                            >
                              {record.status}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-1 flex flex-wrap gap-3">
                            <span>Ref PO: <strong>{record.poVendorId}</strong></span>
                            <span>DO/SJ: <strong>{record.doNumber}</strong></span>
                            <span>Tgl: <strong>{formatDate(record.receiveDate)}</strong></span>
                            <span>Jumlah: <strong>{record.items.length} item</strong></span>
                            {record.receivedBy && <span>Petugas: {record.receivedBy}</span>}
                          </div>
                        </div>

                        {/* Opsi Pilihan Aksi Form Inbound */}
                        <div className="relative self-start sm:self-auto" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => setOpenActionMenuRecordId(isMenuOpen ? null : record.id)}
                            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition shadow-2xs border cursor-pointer ${
                              isMenuOpen
                                ? 'bg-emerald-600 text-white border-emerald-600 ring-2 ring-emerald-200'
                                : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-300'
                            }`}
                            title="Buka list opsi fungsi untuk form penerimaan ini"
                            aria-expanded={isMenuOpen}
                          >
                            <SlidersHorizontal className={`w-3.5 h-3.5 ${isMenuOpen ? 'text-white' : 'text-emerald-600'}`} />
                            <span>Pilihan Opsi Form</span>
                            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isMenuOpen ? 'rotate-180 text-white' : 'text-slate-400'}`} />
                          </button>

                          {/* Dropdown Menu: List Opsi dengan Rincian Fungsinya */}
                          {isMenuOpen && (
                            <div
                              className="absolute right-0 top-full mt-1.5 w-80 sm:w-92 bg-white rounded-2xl shadow-2xl border border-slate-200 py-2.5 z-40 animate-in fade-in zoom-in-95 duration-150 text-left"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="px-3.5 py-1.5 border-b border-slate-100 flex items-center justify-between mb-1.5">
                                <div>
                                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                                    List Opsi & Fungsi Form Inbound
                                  </span>
                                  <div className="text-xs font-bold text-slate-800">
                                    {record.id} • {record.vendorName}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setOpenActionMenuRecordId(null)}
                                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                                  title="Tutup menu opsi"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              <div className="px-1.5 space-y-1 max-h-[380px] overflow-y-auto">
                                {/* Opsi 1: Terima Barang Inbound */}
                                {record.status !== 'Diterima Keseluruhan' ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenActionMenuRecordId(null);
                                      handleOpenReceiveModal(record);
                                    }}
                                    className="w-full flex items-start gap-3 p-2.5 rounded-xl hover:bg-emerald-50/80 border border-transparent hover:border-emerald-200 transition group text-left cursor-pointer"
                                  >
                                    <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white transition shrink-0 mt-0.5">
                                      <CheckCircle2 className="w-4 h-4" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="font-bold text-xs text-slate-900 group-hover:text-emerald-700">
                                          Proses Terima Barang Gudang
                                        </span>
                                        <span className="text-[10px] font-bold px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded">
                                          Inbound Action
                                        </span>
                                      </div>
                                      <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                                        Fungsi: Catat jumlah barang aktual yang diterima di gudang, nomor Surat Jalan (DO), dan update stok Master Inventory.
                                      </p>
                                    </div>
                                  </button>
                                ) : (
                                  <div className="p-2.5 bg-emerald-50/60 rounded-xl border border-emerald-200/60 flex items-center gap-2.5 text-xs text-emerald-800 font-semibold">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                    <span>Seluruh item pada form ini telah selesai diterima di gudang.</span>
                                  </div>
                                )}

                                {/* Opsi 2: Buka / Tutup List Barang Form */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenActionMenuRecordId(null);
                                    setExpandedRecordId(isExpanded ? null : record.id);
                                  }}
                                  className="w-full flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-200 transition group text-left cursor-pointer"
                                >
                                  <div className="p-2 rounded-lg bg-slate-100 text-slate-700 group-hover:bg-emerald-600 group-hover:text-white transition shrink-0 mt-0.5">
                                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-bold text-xs text-slate-900 group-hover:text-emerald-700">
                                        {isExpanded ? 'Tutup Rincian List Barang' : 'Lihat Rincian List Barang'}
                                      </span>
                                    </div>
                                    <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                                      Fungsi: {isExpanded ? 'Sembunyikan tabel rincian item barang pada form penerimaan ini.' : 'Tampilkan tabel rincian SKU, nama barang, jumlah pesan & terima langsung di bawah form.'}
                                    </p>
                                  </div>
                                </button>

                                {/* Opsi 3: Hapus Form Inbound (Khusus Administrator) */}
                                {isAdmin && (
                                  <>
                                    <div className="border-t border-slate-100 my-1 pt-1" />
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenActionMenuRecordId(null);
                                        setRecordToDelete(record);
                                      }}
                                      className="w-full flex items-start gap-3 p-2.5 rounded-xl hover:bg-rose-50/80 border border-transparent hover:border-rose-200 transition group text-left cursor-pointer"
                                    >
                                      <div className="p-2 rounded-lg bg-rose-100 text-rose-700 group-hover:bg-rose-600 group-hover:text-white transition shrink-0 mt-0.5">
                                        <Trash2 className="w-4 h-4" />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <span className="font-bold text-xs text-rose-700">
                                            Hapus Form Inbound
                                          </span>
                                          <span className="text-[10px] font-bold px-1.5 py-0.2 bg-rose-100 text-rose-800 rounded">
                                            Khusus Admin
                                          </span>
                                        </div>
                                        <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                                          Fungsi: Hapus formulir penerimaan barang ini secara permanen dari database gudang.
                                        </p>
                                      </div>
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                    {/* Tampilan List Barang Tepat di Bawah Form yang Dipilih */}
                    {isExpanded && (
                      <div className="overflow-x-auto border-t border-slate-100 animate-in fade-in duration-200">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-100/60 text-slate-600 font-bold border-b border-slate-200">
                            <tr>
                              <th className="px-4 py-2.5">SKU</th>
                              <th className="px-4 py-2.5">Nama Barang</th>
                              <th className="px-4 py-2.5">Kategori</th>
                              <th className="px-4 py-2.5 text-center">Unit</th>
                              <th className="px-4 py-2.5 text-right">Dipesan</th>
                              <th className="px-4 py-2.5 text-right text-emerald-700">Diterima</th>
                              <th className="px-4 py-2.5 text-right text-amber-700">Sisa Pending</th>
                              <th className="px-4 py-2.5 text-right">Total Nilai</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {record.items.map((it) => (
                              <tr key={it.sku} className="hover:bg-slate-50">
                                <td className="px-4 py-2 font-mono font-bold text-slate-800">
                                  {it.sku}
                                </td>
                                <td className="px-4 py-2 font-medium text-slate-900">
                                  {it.itemName}
                                </td>
                                <td className="px-4 py-2 text-slate-600">{it.category}</td>
                                <td className="px-4 py-2 text-center text-slate-600">{it.unit}</td>
                                <td className="px-4 py-2 text-right font-medium">{it.orderedQty}</td>
                                <td className="px-4 py-2 text-right font-bold text-emerald-600">
                                  {it.receivedQty}
                                </td>
                                <td className="px-4 py-2 text-right font-bold text-amber-600">
                                  {it.pendingQty}
                                </td>
                                <td className="px-4 py-2 text-right font-medium text-slate-800">
                                  {formatRupiah(it.totalPrice)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
          </div>
        </div>
      )}

      {/* 2. Subtab: Incoming Goods (Manual Goods In) */}
      {activeSubTab === 'incoming' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <h2 className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-2">
              <PackagePlus className="w-4 h-4 text-emerald-600" />
              Input Barang Masuk Manual (Incoming Goods)
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Mencatat barang masuk di luar alur PO vendor (misal: pengiriman vendor langsung, pembelian pasar, retur outlet). Data langsung menambah Inbound di Master Inventory.
            </p>

            {manualSuccessMsg && (
              <div className="mb-4 p-3 bg-emerald-50 text-emerald-800 rounded-lg text-xs font-semibold border border-emerald-200 flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600" />
                {manualSuccessMsg}
              </div>
            )}

            <form onSubmit={handleManualInboundSubmit} className="space-y-3.5 text-xs">
              {/* Tanggal Barang Masuk */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                    Tanggal Barang Masuk *
                  </span>
                  <div className="flex items-center gap-1 text-[10px]">
                    <button
                      type="button"
                      onClick={() => setManualDate(new Date().toISOString().slice(0, 10))}
                      className="px-2 py-0.5 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-600 rounded font-semibold cursor-pointer"
                    >
                      Hari Ini
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const d = new Date();
                        d.setDate(d.getDate() - 1);
                        setManualDate(d.toISOString().slice(0, 10));
                      }}
                      className="px-2 py-0.5 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-600 rounded font-semibold cursor-pointer"
                    >
                      Kemarin
                    </button>
                  </div>
                </label>
                <input
                  type="date"
                  required
                  value={manualDate}
                  onChange={(e) => setManualDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-hidden"
                />
              </div>

              {/* Field Pencarian Barang dari Master Inventory */}
              <div className="relative" ref={searchDropdownRef}>
                <label className="block font-semibold text-slate-700 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Search className="w-3.5 h-3.5 text-emerald-600" />
                    Pencarian Barang Master Inventory *
                  </span>
                  {selectedInventoryItem && (
                    <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      Terpilih: {selectedInventoryItem.sku}
                    </span>
                  )}
                </label>

                {/* Input Pencarian Langsung */}
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={itemSearchQuery}
                    onFocus={() => setIsItemDropdownOpen(true)}
                    onChange={(e) => {
                      setItemSearchQuery(e.target.value);
                      setIsItemDropdownOpen(true);
                    }}
                    placeholder={
                      selectedInventoryItem
                        ? `Ganti barang (saat ini: ${selectedInventoryItem.itemName})...`
                        : "Ketik SKU, Nama Barang, atau Kategori..."
                    }
                    className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-300 rounded-lg font-medium text-xs focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-hidden"
                  />
                  {itemSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setItemSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Dropdown Hasil Pencarian Barang */}
                {isItemDropdownOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-300 rounded-xl shadow-xl z-30 max-h-56 overflow-y-auto divide-y divide-slate-100">
                    {filteredSearchItems.length === 0 ? (
                      <div className="p-3 text-center text-slate-400 text-xs">
                        Tidak ada barang yang cocok dengan pencarian "{itemSearchQuery}".
                      </div>
                    ) : (
                      filteredSearchItems.map((it) => (
                        <div
                          key={it.sku}
                          onClick={() => handleSelectItem(it)}
                          className={`p-2.5 hover:bg-emerald-50 cursor-pointer transition flex items-center justify-between text-xs ${
                            it.sku === manualSku ? 'bg-emerald-50/80 font-bold text-emerald-900' : 'text-slate-700'
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-[11px] font-bold text-emerald-700 bg-emerald-100/70 px-1.5 py-0.5 rounded">
                                {it.sku}
                              </span>
                              <span className="font-semibold text-slate-900">{it.itemName}</span>
                            </div>
                            <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-2">
                              <span>Kat: {it.category}</span>
                              <span>•</span>
                              <span>Satuan: {it.unit}</span>
                              {it.priceBudget !== undefined && it.priceBudget > 0 && (
                                <>
                                  <span>•</span>
                                  <span>Harga Budget: {formatRupiah(it.priceBudget)}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">
                              Stok: {it.endingInventory}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Selected Item Card Preview */}
                {selectedInventoryItem ? (
                  <div className="mt-2 p-2.5 bg-emerald-50/60 border border-emerald-200 rounded-xl flex items-center justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs bg-emerald-700 text-white px-2 py-0.5 rounded">
                          {selectedInventoryItem.sku}
                        </span>
                        <span className="font-bold text-slate-900">{selectedInventoryItem.itemName}</span>
                      </div>
                      <div className="text-[11px] text-slate-600 flex items-center gap-2">
                        <span>Kategori: {selectedInventoryItem.category}</span>
                        <span>•</span>
                        <span>Satuan: <strong>{selectedInventoryItem.unit}</strong></span>
                        <span>•</span>
                        <span>Sisa Stok: <strong>{selectedInventoryItem.endingInventory}</strong></span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsItemDropdownOpen(true)}
                      className="px-2.5 py-1 text-[11px] font-bold bg-white text-emerald-800 border border-emerald-300 rounded-lg hover:bg-emerald-100 transition cursor-pointer shrink-0 shadow-2xs"
                    >
                      Pilih Lainnya
                    </button>
                  </div>
                ) : (
                  <p className="text-[11px] text-amber-700 mt-1 font-semibold">
                    * Harap cari dan pilih salah satu barang dari Master Inventory di atas.
                  </p>
                )}
              </div>

              {/* Grid: Qty & Input Harga */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Jumlah Masuk */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Jumlah Masuk (Qty) *
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      required
                      value={manualQty}
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (raw === '') {
                          setManualQty('');
                        } else {
                          const parsed = parseInt(raw, 10);
                          setManualQty(isNaN(parsed) ? '' : Math.max(0, parsed));
                        }
                      }}
                      placeholder="Masukkan Qty..."
                      className={`w-full px-3 py-2 bg-slate-50 border rounded-lg font-bold text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-hidden ${
                        manualQty === '' || Number(manualQty) <= 0
                          ? 'border-amber-400 bg-amber-50/30'
                          : 'border-slate-300'
                      }`}
                    />
                    {selectedInventoryItem && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">
                        {selectedInventoryItem.unit}
                      </span>
                    )}
                  </div>
                  {(manualQty === '' || Number(manualQty) <= 0) && (
                    <span className="text-[10px] text-amber-700 font-semibold mt-0.5 block">
                      * Nilai Qty wajib diisi (&gt; 0) untuk melanjutkan.
                    </span>
                  )}
                </div>

                {/* Input Harga */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1 flex items-center justify-between">
                    <span>Harga Masuk / Satuan (Rp) *</span>
                    {selectedInventoryItem?.priceBudget ? (
                      <button
                        type="button"
                        onClick={() => setManualPrice(selectedInventoryItem.priceBudget || 0)}
                        className="text-[10px] text-emerald-700 underline font-semibold cursor-pointer"
                        title="Gunakan harga budget dari Master Inventory"
                      >
                        Acuan Budget: {formatRupiah(selectedInventoryItem.priceBudget)}
                      </button>
                    ) : null}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      step="500"
                      required
                      value={manualPrice}
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (raw === '') {
                          setManualPrice('');
                        } else {
                          const parsed = parseInt(raw, 10);
                          setManualPrice(isNaN(parsed) ? '' : Math.max(0, parsed));
                        }
                      }}
                      placeholder="Masukkan harga..."
                      className={`w-full px-3 py-2 bg-slate-50 border rounded-lg font-bold text-sm text-emerald-800 focus:ring-2 focus:ring-emerald-500 outline-hidden ${
                        manualPrice === '' ? 'border-amber-400 bg-amber-50/30' : 'border-slate-300'
                      }`}
                    />
                  </div>
                  {manualPrice === '' ? (
                    <span className="text-[10px] text-amber-700 font-semibold mt-0.5 block">
                      * Nilai harga wajib diisi untuk melanjutkan.
                    </span>
                  ) : (
                    (() => {
                      const numQty = manualQty === '' ? 0 : Number(manualQty);
                      const numPrice = Number(manualPrice) || 0;
                      const ppnUnit = manualIncludePPN
                        ? Math.round(numPrice * (Math.max(0, Number(manualPPNRate) || 0) / 100))
                        : 0;
                      const finalUnit = numPrice + ppnUnit;
                      return (
                        <div className="text-[10px] text-slate-500 mt-0.5 flex justify-between font-medium">
                          <span>
                            {formatRupiah(finalUnit)} / unit
                            {manualIncludePPN ? ` (inc. PPN)` : ''}
                          </span>
                          <span className="font-bold text-emerald-700">
                            Total: {formatRupiah(finalUnit * numQty)}
                          </span>
                        </div>
                      );
                    })()
                  )}
                  {selectedInventoryItem &&
                    (selectedInventoryItem.priceBudget || selectedInventoryItem.price) > 0 &&
                    manualPrice !== '' &&
                    Number(manualPrice) > 0 &&
                    (() => {
                      const refBudget = selectedInventoryItem.priceBudget || selectedInventoryItem.price;
                      const numPrice = Number(manualPrice) || 0;
                      const ppnUnit = manualIncludePPN
                        ? Math.round(numPrice * (Math.max(0, Number(manualPPNRate) || 0) / 100))
                        : 0;
                      const effectivePrice = numPrice + ppnUnit;
                      const diffPct = ((effectivePrice - refBudget) / refBudget) * 100;
                      const isOverMargin = diffPct > 15;
                      const isUnderMargin = diffPct < -15;
                      return (
                        <div
                          className={`mt-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-bold flex items-center justify-between ${
                            isOverMargin
                              ? 'bg-rose-50 text-rose-800 border-rose-200'
                              : isUnderMargin
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          }`}
                        >
                          <span className="flex items-center gap-1">
                            {(isOverMargin || isUnderMargin) && <AlertTriangle className="w-3 h-3 shrink-0" />}
                            {isOverMargin
                              ? 'Anomali Margin Atas (> +15% Budget)'
                              : isUnderMargin
                              ? 'Anomali Margin Bawah (< -15% Budget)'
                              : 'Normal (Dalam Rentang Budget)'}
                          </span>
                          <span className="font-mono">
                            {diffPct > 0 ? `+${diffPct.toFixed(1)}%` : `${diffPct.toFixed(1)}%`}
                          </span>
                        </div>
                      );
                    })()}
                </div>
              </div>

              {/* Pilihan Tambah PPN pada Incoming Goods */}
              <div
                className={`p-3 rounded-xl border transition ${
                  manualIncludePPN
                    ? 'bg-emerald-50/70 border-emerald-300'
                    : 'bg-slate-50/70 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={manualIncludePPN}
                      onChange={(e) => setManualIncludePPN(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                    <span className="font-bold text-slate-800 text-xs">
                      Tambahkan PPN pada Harga Barang Masuk
                    </span>
                  </label>

                  {manualIncludePPN && (
                    <div className="flex items-center gap-1.5">
                      {[11, 12].map((rate) => (
                        <button
                          key={rate}
                          type="button"
                          onClick={() => setManualPPNRate(rate)}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${
                            manualPPNRate === rate
                              ? 'bg-emerald-600 text-white'
                              : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-100'
                          }`}
                        >
                          PPN {rate}%
                        </button>
                      ))}
                      <div className="flex items-center gap-1 bg-white border border-emerald-300 rounded px-1.5 py-0.5">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.5"
                          value={manualPPNRate}
                          onChange={(e) => setManualPPNRate(Math.max(0, parseFloat(e.target.value) || 0))}
                          className="w-10 text-right font-mono font-bold text-[11px] text-emerald-800 outline-hidden"
                        />
                        <span className="text-[10px] font-bold text-slate-500">%</span>
                      </div>
                    </div>
                  )}
                </div>

                {manualIncludePPN && manualPrice !== '' && manualQty !== '' && Number(manualQty) > 0 && (() => {
                  const baseP = Number(manualPrice) || 0;
                  const q = Number(manualQty) || 0;
                  const rate = Math.max(0, Number(manualPPNRate) || 0);
                  const ppnPerItem = Math.round(baseP * (rate / 100));
                  const unitWithPPN = baseP + ppnPerItem;
                  const totalPPN = ppnPerItem * q;
                  const grandTotal = unitWithPPN * q;
                  return (
                    <div className="mt-2 pt-2 border-t border-emerald-200/80 grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
                      <div>
                        <span className="text-slate-500 block text-[10px]">Harga Dasar / Unit:</span>
                        <span className="font-mono font-semibold text-slate-700">{formatRupiah(baseP)}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px]">PPN ({rate}%) / Unit:</span>
                        <span className="font-mono font-bold text-amber-700">+{formatRupiah(ppnPerItem)}</span>
                      </div>
                      <div className="col-span-2 sm:col-span-1">
                        <span className="text-slate-500 block text-[10px]">Harga + PPN (Masuk Actual):</span>
                        <span className="font-mono font-extrabold text-emerald-800">{formatRupiah(unitWithPPN)}</span>
                      </div>
                      <div className="col-span-2 sm:col-span-3 flex items-center justify-between bg-white/80 px-2.5 py-1 rounded-lg border border-emerald-200">
                        <span className="text-[10px] font-semibold text-slate-600">
                          Total PPN ({q} {selectedInventoryItem?.unit || 'unit'}): <strong>{formatRupiah(totalPPN)}</strong>
                        </span>
                        <span className="text-[11px] font-extrabold text-emerald-900 font-mono">
                          Grand Total: {formatRupiah(grandTotal)}
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Pilihan Sumber / Vendor Masuk */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                  Sumber Barang Masuk (Pilihan Vendor / Non-Vendor) *
                </label>
                
                {/* Mode Selector: Vendor Terdaftar vs Non-Vendor */}
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => setManualSourceType('vendor')}
                    className={`py-1.5 px-3 rounded-lg text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                      manualSourceType === 'vendor'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                        : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    Vendor / Supplier
                  </button>
                  <button
                    type="button"
                    onClick={() => setManualSourceType('other')}
                    className={`py-1.5 px-3 rounded-lg text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                      manualSourceType === 'other'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                        : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    <Package className="w-3.5 h-3.5" />
                    Non-Vendor / Lainnya
                  </button>
                </div>

                {manualSourceType === 'vendor' ? (
                  <div>
                    <select
                      value={manualVendorName}
                      onChange={(e) => setManualVendorName(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-hidden"
                    >
                      {vendors.length === 0 ? (
                        <option value="">Belum ada vendor terdaftar</option>
                      ) : (
                        vendors.map((v) => (
                          <option key={v.id} value={v.namaVendor}>
                            {v.namaVendor} • [{v.categories.join(', ')}] • {v.paymentType}
                          </option>
                        ))
                      )}
                    </select>
                    <p className="text-[10px] text-slate-500 mt-1">
                      Pilihan vendor diambil dari data resmi pada Master Vendor Purchasing.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <select
                      value={manualOtherSource}
                      onChange={(e) => setManualOtherSource(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-hidden"
                    >
                      <option value="Pembelian Langsung Pasar / Petty Cash">Pembelian Langsung Pasar / Petty Cash</option>
                      <option value="Retur Barang dari Outlet">Retur Barang dari Outlet</option>
                      <option value="Koreksi Selisih Stok (Adjusment)">Koreksi Selisih Stok (Adjusment)</option>
                      <option value="Sample / Free Goods Supplier">Sample / Free Goods Supplier</option>
                      <option value="Transfer Antar Gudang">Transfer Antar Gudang</option>
                      <option value="Lainnya (Input Manual)">Lainnya (Input Manual)</option>
                    </select>

                    {manualOtherSource === 'Lainnya (Input Manual)' && (
                      <input
                        type="text"
                        required
                        value={manualCustomSource}
                        onChange={(e) => setManualCustomSource(e.target.value)}
                        placeholder="Ketik nama sumber atau pengirim barang..."
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-hidden font-medium"
                      />
                    )}
                  </div>
                )}
              </div>

              {/* Catatan Tambahan */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Catatan Tambahan / No. Bon / Memo
                </label>
                <input
                  type="text"
                  value={manualNotes}
                  onChange={(e) => setManualNotes(e.target.value)}
                  placeholder="Keterangan nota / faktur / kondisi barang..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-hidden"
                />
              </div>

              <button
                type="submit"
                disabled={
                  !selectedInventoryItem ||
                  manualQty === '' ||
                  Number(manualQty) <= 0 ||
                  manualPrice === '' ||
                  Number(manualPrice) < 0
                }
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold rounded-xl transition shadow-xs flex items-center justify-center gap-1.5 mt-2 cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                Tambah ke Inbound Master Inventory
              </button>
            </form>
          </div>

          {/* Right: History of Manual Inbounds */}
          <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-bold text-slate-900">
                Riwayat Transaksi Masuk Manual
              </h3>
              <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                {manualInboundRecords.length} Catatan
              </span>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              Daftar pencatatan barang masuk manual terkini dengan rincian harga, vendor, dan tanggal masuk.
            </p>

            <div className="overflow-x-auto max-h-[460px] overflow-y-auto border border-slate-100 rounded-xl flex-1">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-2.5">Tgl Masuk</th>
                    <th className="px-3 py-2.5">SKU & Barang</th>
                    <th className="px-3 py-2.5 text-right">Qty</th>
                    <th className="px-3 py-2.5 text-right">Harga Satuan</th>
                    <th className="px-3 py-2.5 text-right">Total Nilai</th>
                    <th className="px-3 py-2.5">Sumber / Vendor</th>
                    <th className="px-3 py-2.5">Petugas</th>
                    {isAdmin && <th className="px-2 py-2.5 text-center w-10">Aksi</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {manualInboundRecords.length === 0 ? (
                    <tr>
                      <td colSpan={isAdmin ? 8 : 7} className="text-center py-8 text-slate-400">
                        Belum ada riwayat transaksi manual masuk.
                      </td>
                    </tr>
                  ) : (
                    manualInboundRecords.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2 text-slate-600 font-medium whitespace-nowrap">
                          {formatDate(m.date)}
                        </td>
                        <td className="px-3 py-2">
                          <div className="font-mono font-bold text-slate-800">{m.sku}</div>
                          <div className="font-medium text-slate-900">{m.itemName}</div>
                          <div className="text-[10px] text-slate-400">{m.category}</div>
                        </td>
                        <td className="px-3 py-2 text-right font-bold text-emerald-700 whitespace-nowrap">
                          +{m.qty} {m.unit}
                        </td>
                        <td className="px-3 py-2 text-right text-slate-700 font-medium whitespace-nowrap">
                          <div>{m.price ? formatRupiah(m.price) : '-'}</div>
                          {m.includePPN && (
                            <span className="inline-block text-[9px] font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded border border-emerald-200">
                              Termasuk PPN {m.ppnPercentage ?? 11}%
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right font-bold text-emerald-800 whitespace-nowrap">
                          {m.totalPrice ? formatRupiah(m.totalPrice) : m.price ? formatRupiah(m.price * m.qty) : '-'}
                        </td>
                        <td className="px-3 py-2 text-slate-600 max-w-[140px] truncate" title={m.source}>
                          {m.source}
                        </td>
                        <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{m.receivedBy}</td>
                        {isAdmin && (
                          <td className="px-2 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => setManualRecordToDelete(m)}
                              className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-md transition cursor-pointer"
                              title="Hapus data barang masuk manual ini (Khusus Administrator)"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 3. Subtab: Report Status */}
      {activeSubTab === 'report' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <FileCheck2 className="w-4 h-4 text-emerald-600" />
                Laporan Status Penerimaan Barang (Receiving Inbound)
              </h2>
              <p className="text-xs text-slate-500">
                Menampilkan rekapitulasi status barang yang sudah diterima baik secara keseluruhan maupun sebagian.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                exportInboundReportToPDF(filteredAndSortedReportRecords, {
                  statusFilter: reportStatusFilter,
                  dateFilter: reportDateFilter,
                  searchQuery: reportSearchQuery,
                });
              }}
              disabled={filteredAndSortedReportRecords.length === 0}
              className="flex items-center justify-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl font-bold text-xs shadow-xs transition shrink-0 cursor-pointer disabled:cursor-not-allowed"
              title="Export laporan status penerimaan barang sesuai filter saat ini ke format PDF"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>
                Export Report PDF
                {reportStatusFilter !== 'all' ? ` (${reportStatusFilter})` : ''}
              </span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div
              role="button"
              tabIndex={0}
              onClick={() =>
                setReportStatusFilter((prev) =>
                  prev === 'Diterima Keseluruhan' ? 'all' : 'Diterima Keseluruhan'
                )
              }
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setReportStatusFilter((prev) =>
                    prev === 'Diterima Keseluruhan' ? 'all' : 'Diterima Keseluruhan'
                  );
                }
              }}
              className={`p-3 rounded-xl border transition cursor-pointer select-none ${
                reportStatusFilter === 'Diterima Keseluruhan'
                  ? 'bg-emerald-100 border-emerald-500 ring-2 ring-emerald-500/30 shadow-xs'
                  : 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100/70 hover:border-emerald-300'
              }`}
              title="Klik untuk memfilter status Diterima Keseluruhan (klik kembali untuk menampilkan semua)"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase text-emerald-700">Diterima Keseluruhan</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const targetRecords = receivingRecords.filter(
                        (r) => r.status === 'Diterima Keseluruhan'
                      );
                      exportInboundReportToPDF(targetRecords, {
                        statusFilter: 'Diterima Keseluruhan',
                        dateFilter: reportDateFilter,
                        searchQuery: reportSearchQuery,
                      });
                    }}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-white/90 hover:bg-emerald-700 text-emerald-800 hover:text-white border border-emerald-300 transition shadow-2xs cursor-pointer"
                    title="Export PDF khusus laporan status Diterima Keseluruhan"
                  >
                    <FileDown className="w-2.5 h-2.5" />
                    <span>Export PDF</span>
                  </button>
                  {reportStatusFilter === 'Diterima Keseluruhan' ? (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-600 text-white">
                      <Filter className="w-2.5 h-2.5" />
                      Aktif
                    </span>
                  ) : (
                    <Filter className="w-3 h-3 text-emerald-600/60" />
                  )}
                </div>
              </div>
              <div className="text-xl font-black text-emerald-900 mt-0.5">
                {receivingRecords.filter((r) => r.status === 'Diterima Keseluruhan').length} Vendor PO
              </div>
            </div>
            <div
              role="button"
              tabIndex={0}
              onClick={() =>
                setReportStatusFilter((prev) =>
                  prev === 'Diterima Sebagian' ? 'all' : 'Diterima Sebagian'
                )
              }
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setReportStatusFilter((prev) =>
                    prev === 'Diterima Sebagian' ? 'all' : 'Diterima Sebagian'
                  );
                }
              }}
              className={`p-3 rounded-xl border transition cursor-pointer select-none ${
                reportStatusFilter === 'Diterima Sebagian'
                  ? 'bg-amber-100 border-amber-500 ring-2 ring-amber-500/30 shadow-xs'
                  : 'bg-amber-50 border-amber-200 hover:bg-amber-100/70 hover:border-amber-300'
              }`}
              title="Klik untuk memfilter status Diterima Sebagian (klik kembali untuk menampilkan semua)"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase text-amber-700">Diterima Sebagian</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const targetRecords = receivingRecords.filter(
                        (r) => r.status === 'Diterima Sebagian'
                      );
                      exportInboundReportToPDF(targetRecords, {
                        statusFilter: 'Diterima Sebagian',
                        dateFilter: reportDateFilter,
                        searchQuery: reportSearchQuery,
                      });
                    }}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-white/90 hover:bg-amber-700 text-amber-800 hover:text-white border border-amber-300 transition shadow-2xs cursor-pointer"
                    title="Export PDF khusus laporan status Diterima Sebagian"
                  >
                    <FileDown className="w-2.5 h-2.5" />
                    <span>Export PDF</span>
                  </button>
                  {reportStatusFilter === 'Diterima Sebagian' ? (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-600 text-white">
                      <Filter className="w-2.5 h-2.5" />
                      Aktif
                    </span>
                  ) : (
                    <Filter className="w-3 h-3 text-amber-600/60" />
                  )}
                </div>
              </div>
              <div className="text-xl font-black text-amber-900 mt-0.5">
                {receivingRecords.filter((r) => r.status === 'Diterima Sebagian').length} Vendor PO
              </div>
            </div>
            <div
              role="button"
              tabIndex={0}
              onClick={() =>
                setReportStatusFilter((prev) =>
                  prev === 'Menunggu Kedatangan' ? 'all' : 'Menunggu Kedatangan'
                )
              }
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setReportStatusFilter((prev) =>
                    prev === 'Menunggu Kedatangan' ? 'all' : 'Menunggu Kedatangan'
                  );
                }
              }}
              className={`p-3 rounded-xl border transition cursor-pointer select-none ${
                reportStatusFilter === 'Menunggu Kedatangan'
                  ? 'bg-blue-100 border-blue-500 ring-2 ring-blue-500/30 shadow-xs'
                  : 'bg-blue-50 border-blue-200 hover:bg-blue-100/70 hover:border-blue-300'
              }`}
              title="Klik untuk memfilter status Menunggu Kedatangan (klik kembali untuk menampilkan semua)"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase text-blue-700">Menunggu Kedatangan</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const targetRecords = receivingRecords.filter(
                        (r) => r.status === 'Menunggu Kedatangan'
                      );
                      exportInboundReportToPDF(targetRecords, {
                        statusFilter: 'Menunggu Kedatangan',
                        dateFilter: reportDateFilter,
                        searchQuery: reportSearchQuery,
                      });
                    }}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-white/90 hover:bg-blue-700 text-blue-800 hover:text-white border border-blue-300 transition shadow-2xs cursor-pointer"
                    title="Export PDF khusus laporan status Menunggu Kedatangan"
                  >
                    <FileDown className="w-2.5 h-2.5" />
                    <span>Export PDF</span>
                  </button>
                  {reportStatusFilter === 'Menunggu Kedatangan' ? (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-blue-600 text-white">
                      <Filter className="w-2.5 h-2.5" />
                      Aktif
                    </span>
                  ) : (
                    <Filter className="w-3 h-3 text-blue-600/60" />
                  )}
                </div>
              </div>
              <div className="text-xl font-black text-blue-900 mt-0.5">
                {receivingRecords.filter((r) => r.status === 'Menunggu Kedatangan').length} Vendor PO
              </div>
            </div>
          </div>

          {/* Search & Filter Toolbar for Report */}
          <div className="bg-slate-50/90 border border-slate-200 rounded-xl p-3 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 text-xs">
            {/* Search Bar */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={reportSearchQuery}
                onChange={(e) => setReportSearchQuery(e.target.value)}
                placeholder="Cari ID Dokumen, Vendor, Ref PO, atau Status..."
                className="w-full pl-9 pr-8 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-hidden font-medium"
              />
              {reportSearchQuery && (
                <button
                  onClick={() => setReportSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Fitur Hapus Form (Hanya Muncul pada User Administrator - Sejajar dengan Kolom Pencarian) */}
            {isAdmin && (
              <button
                type="button"
                onClick={() => {
                  if (reportSearchQuery.trim() !== '' && filteredAndSortedReportRecords.length === 1) {
                    setRecordToDelete(filteredAndSortedReportRecords[0]);
                  } else {
                    setDeleteSelectorSearch(reportSearchQuery);
                    setShowDeleteSelectorModal(true);
                  }
                }}
                className="flex items-center justify-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 hover:text-rose-800 border border-rose-300 rounded-lg font-bold text-xs shadow-2xs transition shrink-0 cursor-pointer"
                title="Fitur Hapus Form Inbound (Hanya Muncul pada Administrator)"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                <span>Hapus Form</span>
                <span className="text-[10px] bg-rose-200/70 text-rose-800 px-1.5 py-0.5 rounded font-semibold ml-0.5">Admin</span>
              </button>
            )}

            <div className="flex flex-wrap items-center gap-2">
              {/* Filter Tanggal */}
              <div className="flex items-center gap-1.5 bg-white border border-slate-300 px-2.5 py-1.5 rounded-lg shadow-2xs">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <input
                  type="date"
                  value={reportDateFilter}
                  onChange={(e) => setReportDateFilter(e.target.value)}
                  className="text-xs text-slate-700 bg-transparent outline-hidden font-medium"
                />
                {reportDateFilter && (
                  <button
                    onClick={() => setReportDateFilter('')}
                    className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-semibold ml-1 cursor-pointer"
                    title="Tampilkan semua tanggal"
                  >
                    Semua
                  </button>
                )}
              </div>

              {/* Urutkan Tanggal */}
              <button
                onClick={() => setReportDateSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg font-semibold transition shadow-2xs cursor-pointer"
                title="Urutkan berdasarkan tanggal penerimaan"
              >
                <ArrowUpDown className="w-3.5 h-3.5 text-emerald-600" />
                <span>Urutkan: {reportDateSortOrder === 'desc' ? 'Terbaru' : 'Terlama'}</span>
              </button>
            </div>
          </div>

          {openActionMenuReportId && (
            <div
              className="fixed inset-0 z-30 bg-transparent"
              onClick={() => setOpenActionMenuReportId(null)}
            />
          )}

          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2.5">ID Dokumen</th>
                  <th className="px-3 py-2.5">Vendor</th>
                  <th className="px-3 py-2.5">Ref PO & DO/SJ</th>
                  <th className="px-3 py-2.5">Tgl Penerimaan</th>
                  <th className="px-3 py-2.5 text-center">Realisasi Penerimaan</th>
                  <th className="px-3 py-2.5 text-center">Status</th>
                  <th className="px-3 py-2.5">Penerima</th>
                  <th className="px-3 py-2.5 text-center">Aksi Form</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAndSortedReportRecords.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-slate-400 font-medium">
                      {receivingRecords.length === 0
                        ? 'Belum ada data laporan penerimaan.'
                        : 'Tidak ada dokumen yang sesuai dengan filter tanggal atau pencarian.'}
                    </td>
                  </tr>
                ) : (
                  filteredAndSortedReportRecords.map((r) => {
                    const isExpanded = expandedReportRecordId === r.id;
                    const totalOrdered = r.items.reduce((s, it) => s + it.orderedQty, 0);
                    const totalRec = r.items.reduce((s, it) => s + it.receivedQty, 0);
                    const pct = Math.round((totalRec / (totalOrdered || 1)) * 100);

                    return (
                      <React.Fragment key={r.id}>
                        <tr
                          onClick={() => setExpandedReportRecordId(isExpanded ? null : r.id)}
                          className={`hover:bg-slate-50 transition cursor-pointer ${
                            isExpanded ? 'bg-emerald-50/70 font-medium border-l-4 border-l-emerald-600' : ''
                          }`}
                        >
                          <td className="px-3 py-2.5 font-mono font-bold text-slate-800">{r.id}</td>
                          <td className="px-3 py-2.5 font-semibold text-slate-900">{r.vendorName}</td>
                          <td className="px-3 py-2.5 text-slate-600">
                            <span className="font-semibold text-slate-800">{r.poVendorId}</span>
                            {r.doNumber && <span className="block text-[11px] text-slate-400">DO: {r.doNumber}</span>}
                          </td>
                          <td className="px-3 py-2.5 text-slate-600 font-medium">{formatDate(r.receiveDate)}</td>
                          <td className="px-3 py-2.5 text-center">
                            <div className="w-28 mx-auto">
                              <div className="flex justify-between text-[10px] font-bold mb-1">
                                <span>{pct}%</span>
                                <span>{totalRec}/{totalOrdered}</span>
                              </div>
                              <div className="w-full bg-slate-200 rounded-full h-1.5">
                                <div
                                  className={`h-1.5 rounded-full ${
                                    pct === 100 ? 'bg-emerald-600' : 'bg-amber-500'
                                  }`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                r.status === 'Diterima Keseluruhan'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : r.status === 'Diterima Sebagian'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-blue-100 text-blue-800'
                              }`}
                            >
                              {r.status}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-slate-600">{r.receivedBy || '-'}</td>
                          <td className="px-3 py-2.5 text-center relative" onClick={(e) => e.stopPropagation()}>
                            <div className="relative inline-block text-left">
                              <button
                                type="button"
                                onClick={() => setOpenActionMenuReportId(openActionMenuReportId === r.id ? null : r.id)}
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition shadow-2xs border cursor-pointer ${
                                  openActionMenuReportId === r.id
                                    ? 'bg-emerald-600 text-white border-emerald-600'
                                    : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-300'
                                }`}
                                title="Buka list opsi fungsi form laporan ini"
                                aria-expanded={openActionMenuReportId === r.id}
                              >
                                <SlidersHorizontal className={`w-3 h-3 ${openActionMenuReportId === r.id ? 'text-white' : 'text-emerald-600'}`} />
                                <span>Pilihan Opsi</span>
                                <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${openActionMenuReportId === r.id ? 'rotate-180 text-white' : 'text-slate-400'}`} />
                              </button>

                              {openActionMenuReportId === r.id && (
                                <div
                                  className="absolute right-0 top-full mt-1.5 w-76 bg-white rounded-2xl shadow-2xl border border-slate-200 py-2 z-40 animate-in fade-in zoom-in-95 duration-150 text-left"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <div className="px-3 py-1.5 border-b border-slate-100 flex items-center justify-between mb-1">
                                    <div>
                                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                                        Opsi Form Inbound
                                      </span>
                                      <div className="text-xs font-bold text-slate-800">
                                        {r.id} • {r.vendorName}
                                      </div>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => setOpenActionMenuReportId(null)}
                                      className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>

                                  <div className="px-1.5 space-y-1">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenActionMenuReportId(null);
                                        setExpandedReportRecordId(isExpanded ? null : r.id);
                                      }}
                                      className="w-full flex items-start gap-2.5 p-2 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-200 transition group text-left cursor-pointer"
                                    >
                                      <div className="p-1.5 rounded-lg bg-slate-100 text-slate-700 group-hover:bg-emerald-600 group-hover:text-white transition shrink-0 mt-0.5">
                                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <span className="font-bold text-xs text-slate-900 group-hover:text-emerald-700 block">
                                          {isExpanded ? 'Tutup Rincian List Barang' : 'Lihat Rincian List Barang'}
                                        </span>
                                        <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                                          Fungsi: {isExpanded ? 'Sembunyikan tabel rincian item.' : 'Tampilkan rincian SKU, qty pesan & terima langsung di bawah baris.'}
                                        </p>
                                      </div>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenActionMenuReportId(null);
                                        exportInboundReportToPDF([r], {
                                          statusFilter: r.status,
                                          singleRecordTitle: `${r.id}_${r.vendorName}`,
                                        });
                                      }}
                                      className="w-full flex items-start gap-2.5 p-2 rounded-xl hover:bg-emerald-50/80 border border-transparent hover:border-emerald-200 transition group text-left cursor-pointer"
                                    >
                                      <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white transition shrink-0 mt-0.5">
                                        <FileDown className="w-3.5 h-3.5" />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <span className="font-bold text-xs text-slate-900 group-hover:text-emerald-700 block">
                                          Export to PDF (Report Dokumen)
                                        </span>
                                        <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                                          Fungsi: Unduh laporan resmi penerimaan barang dokumen {r.id} dalam format PDF.
                                        </p>
                                      </div>
                                    </button>

                                    {isAdmin && (
                                      <>
                                        <div className="border-t border-slate-100 my-1 pt-1" />
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setOpenActionMenuReportId(null);
                                            setRecordToDelete(r);
                                          }}
                                          className="w-full flex items-start gap-2.5 p-2 rounded-xl hover:bg-rose-50/80 border border-transparent hover:border-rose-200 transition group text-left cursor-pointer"
                                        >
                                          <div className="p-1.5 rounded-lg bg-rose-100 text-rose-700 group-hover:bg-rose-600 group-hover:text-white transition shrink-0 mt-0.5">
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5">
                                              <span className="font-bold text-xs text-rose-700">
                                                Hapus Form Inbound
                                              </span>
                                              <span className="text-[9px] font-bold px-1.5 py-0.2 bg-rose-100 text-rose-800 rounded">
                                                Admin
                                              </span>
                                            </div>
                                            <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                                              Fungsi: Hapus formulir ini secara permanen dari database gudang.
                                            </p>
                                          </div>
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* List Barang Tepat di Bawah Form Laporan yang Dipilih */}
                        {isExpanded && (
                          <tr className="bg-emerald-50/30 border-b-2 border-emerald-400">
                            <td colSpan={8} className="p-3 sm:p-4">
                              <div className="bg-white rounded-xl border-2 border-emerald-400 shadow-sm overflow-hidden animate-in fade-in duration-200">
                                <div className="p-3 bg-gradient-to-r from-emerald-50 to-teal-50/40 border-b border-emerald-200 flex items-center justify-between gap-2">
                                  <h4 className="font-bold text-xs sm:text-sm text-slate-900">
                                    Rincian List Barang Dokumen {r.id} ({r.items.length} item)
                                  </h4>
                                  <button
                                    onClick={() => setExpandedReportRecordId(null)}
                                    className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800 font-semibold cursor-pointer"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                    Tutup List
                                  </button>
                                </div>
                                <div className="overflow-x-auto">
                                  <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-100/70 text-slate-600 font-bold border-b border-slate-200">
                                      <tr>
                                        <th className="px-3 py-2">SKU</th>
                                        <th className="px-3 py-2">Nama Barang</th>
                                        <th className="px-3 py-2">Kategori</th>
                                        <th className="px-3 py-2 text-center">Unit</th>
                                        <th className="px-3 py-2 text-right">Dipesan</th>
                                        <th className="px-3 py-2 text-right text-emerald-700">Diterima</th>
                                        <th className="px-3 py-2 text-right text-amber-700">Sisa Pending</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                      {r.items.map((it) => (
                                        <tr key={it.sku} className="hover:bg-slate-50">
                                          <td className="px-3 py-2 font-mono font-bold text-slate-800">{it.sku}</td>
                                          <td className="px-3 py-2 font-medium text-slate-900">{it.itemName}</td>
                                          <td className="px-3 py-2 text-slate-600">{it.category}</td>
                                          <td className="px-3 py-2 text-center text-slate-600">{it.unit}</td>
                                          <td className="px-3 py-2 text-right font-semibold text-slate-700">{it.orderedQty}</td>
                                          <td className="px-3 py-2 text-right font-bold text-emerald-700">{it.receivedQty}</td>
                                          <td className="px-3 py-2 text-right font-bold text-amber-700">{it.pendingQty}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Terima Barang dari Vendor */}
      {selectedReceivingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl max-w-xl w-full border border-slate-200 p-6 space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Penerimaan Fisik Barang: {selectedReceivingRecord.vendorName}
                </h3>
                <span className="text-[11px] text-slate-500">
                  ID: {selectedReceivingRecord.id} • PO Ref: {selectedReceivingRecord.poVendorId}
                </span>
              </div>
              <button
                onClick={() => setSelectedReceivingRecord(null)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Masukkan jumlah fisik dan harga satuan barang masuk sesuai Surat Jalan / Faktur. Harga yang di-input pada Inbound akan diakumulasi dan di-average otomatis pada <strong>Harga Actual</strong> di Master Inventory.
            </p>

            <div className="space-y-3 overflow-y-auto flex-1 pr-1">
              {selectedReceivingRecord.items.map((it) => {
                const invItem = inventory.find((inv) => inv.sku === it.sku);
                const budgetPrice = invItem?.priceBudget ?? invItem?.price ?? it.unitPrice ?? 0;
                const currentInputPrice = receivedPriceMap[it.sku] ?? it.unitPrice ?? budgetPrice;
                const diffPct = budgetPrice > 0 ? ((currentInputPrice - budgetPrice) / budgetPrice) * 100 : 0;
                const isOverMargin = budgetPrice > 0 && diffPct > 15;
                const isUnderMargin = budgetPrice > 0 && diffPct < -15;

                return (
                  <div
                    key={it.sku}
                    className={`p-3 rounded-xl border space-y-2 text-xs ${
                      isOverMargin
                        ? 'border-rose-300 bg-rose-50/40'
                        : isUnderMargin
                        ? 'border-amber-300 bg-amber-50/40'
                        : 'border-slate-200 bg-slate-50/50'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex-1">
                        <div className="font-bold text-slate-900">{it.itemName}</div>
                        <div className="text-[11px] text-slate-500">
                          SKU: {it.sku} • Dipesan: {it.orderedQty} {it.unit} (Sudah masuk: {it.receivedQty})
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                          <span>Acuan Budget: <strong>{formatRupiah(budgetPrice)}</strong></span>
                          {invItem?.priceActual !== undefined && invItem.priceActual > 0 && (
                            <span>• Actual Saat Ini: <strong>{formatRupiah(invItem.priceActual)}</strong></span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="w-28">
                          <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                            Qty Diterima:
                          </label>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min="0"
                              max={it.pendingQty}
                              value={receivedQtyMap[it.sku] ?? it.pendingQty}
                              onChange={(e) =>
                                setReceivedQtyMap({
                                  ...receivedQtyMap,
                                  [it.sku]: Math.max(0, parseInt(e.target.value) || 0),
                                })
                              }
                              className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg font-bold text-center text-xs focus:ring-2 focus:ring-emerald-500 outline-hidden"
                            />
                            <span className="text-slate-500 text-[11px]">{it.unit}</span>
                          </div>
                        </div>

                        <div className="w-36">
                          <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                            Harga Masuk / Unit (Rp):
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="500"
                            value={currentInputPrice}
                            onChange={(e) =>
                              setReceivedPriceMap({
                                ...receivedPriceMap,
                                [it.sku]: Math.max(0, parseInt(e.target.value) || 0),
                              })
                            }
                            className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg font-bold text-right text-xs text-emerald-800 focus:ring-2 focus:ring-emerald-500 outline-hidden"
                          />
                        </div>
                      </div>
                    </div>

                    {(isOverMargin || isUnderMargin) && (
                      <div
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center justify-between ${
                          isOverMargin
                            ? 'bg-rose-100/80 text-rose-800 border border-rose-200'
                            : 'bg-amber-100/80 text-amber-800 border border-amber-200'
                        }`}
                      >
                        <span className="flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 shrink-0" />
                          {isOverMargin
                            ? `Anomali Margin Atas: Harga input di atas Harga Budget (${formatRupiah(budgetPrice)})`
                            : `Anomali Margin Bawah: Harga input jauh di bawah Harga Budget (${formatRupiah(budgetPrice)})`}
                        </span>
                        <span className="font-mono">
                          {diffPct > 0 ? `+${diffPct.toFixed(1)}%` : `${diffPct.toFixed(1)}%`}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Catatan Penerimaan / No. Surat Jalan (Opsional)
                </label>
                <input
                  type="text"
                  value={receiveNotes}
                  onChange={(e) => setReceiveNotes(e.target.value)}
                  placeholder="Contoh: DO-8891, barang diterima kondisi segar, chiller oke."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 outline-hidden"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setSelectedReceivingRecord(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleSubmitReceive}
                className="px-5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition cursor-pointer"
              >
                Konfirmasi Terima & Masukkan ke Inbound
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Pemilih Form Inbound untuk Dihapus (Dibuka dari Toolbar Sejajar Kolom Pencarian) */}
      {showDeleteSelectorModal && isAdmin && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-5 shadow-2xl border border-slate-100 flex flex-col max-h-[85vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-rose-100 rounded-xl text-rose-600">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900">Kelola & Hapus Form Inbound</h3>
                    <span className="text-[10px] font-extrabold bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full border border-rose-200">
                      Khusus Administrator
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Pilih formulir penerimaan inbound yang ingin dihapus dari sistem.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDeleteSelectorModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filter Search inside Modal */}
            <div className="pt-4 pb-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={deleteSelectorSearch}
                  onChange={(e) => setDeleteSelectorSearch(e.target.value)}
                  placeholder="Cari ID Dokumen, Vendor, atau Ref PO..."
                  className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-hidden font-medium"
                  autoFocus
                />
                {deleteSelectorSearch && (
                  <button
                    onClick={() => setDeleteSelectorSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Form List to Delete */}
            <div className="overflow-y-auto flex-1 divide-y divide-slate-100 border border-slate-200 rounded-xl mb-4">
              {receivingRecords
                .filter((rec) => {
                  if (!deleteSelectorSearch.trim()) return true;
                  const query = deleteSelectorSearch.toLowerCase();
                  return (
                    rec.id.toLowerCase().includes(query) ||
                    rec.vendorName.toLowerCase().includes(query) ||
                    rec.poVendorId.toLowerCase().includes(query) ||
                    rec.doNumber.toLowerCase().includes(query) ||
                    rec.status.toLowerCase().includes(query)
                  );
                })
                .map((rec) => (
                  <div
                    key={rec.id}
                    className="p-3.5 hover:bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-xs text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          {rec.id}
                        </span>
                        <span className="font-bold text-xs text-slate-800">
                          {rec.vendorName}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            rec.status === 'Diterima Keseluruhan'
                              ? 'bg-emerald-100 text-emerald-800'
                              : rec.status === 'Diterima Sebagian'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {rec.status}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-3">
                        <span>Ref PO: <strong>{rec.poVendorId}</strong></span>
                        <span>•</span>
                        <span>DO/SJ: {rec.doNumber || '-'}</span>
                        <span>•</span>
                        <span>Tgl: {formatDate(rec.receiveDate)}</span>
                        <span>•</span>
                        <span>{rec.items.length} item</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setShowDeleteSelectorModal(false);
                        setRecordToDelete(rec);
                      }}
                      className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-200 hover:border-rose-600 rounded-lg text-xs font-bold transition shadow-2xs shrink-0 cursor-pointer group"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-600 group-hover:text-white transition" />
                      <span>Hapus Form Ini</span>
                    </button>
                  </div>
                ))}

              {receivingRecords.filter((rec) => {
                if (!deleteSelectorSearch.trim()) return true;
                const query = deleteSelectorSearch.toLowerCase();
                return (
                  rec.id.toLowerCase().includes(query) ||
                  rec.vendorName.toLowerCase().includes(query) ||
                  rec.poVendorId.toLowerCase().includes(query) ||
                  rec.doNumber.toLowerCase().includes(query)
                );
              }).length === 0 && (
                <div className="p-8 text-center text-slate-400">
                  <p className="text-xs font-semibold">
                    {receivingRecords.length === 0
                      ? 'Belum ada dokumen form receiving di sistem.'
                      : 'Tidak ditemukan form inbound yang sesuai dengan pencarian.'}
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowDeleteSelectorModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus Form Inbound (Khusus Administrator) */}
      {recordToDelete && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-100">
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <div className="p-2.5 bg-rose-100 rounded-xl">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  Hapus Form Inbound?
                  <span className="text-[10px] font-extrabold bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full border border-rose-200">
                    Administrator
                  </span>
                </h3>
                <p className="text-xs text-slate-500">
                  Tindakan ini akan menghapus form penerimaan barang dari Inbound secara permanen.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-3.5 mb-4 text-xs space-y-2 border border-slate-200">
              <div className="flex justify-between">
                <span className="text-slate-500">ID Dokumen:</span>
                <span className="font-mono font-bold text-slate-900">{recordToDelete.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Vendor:</span>
                <span className="font-bold text-slate-900">{recordToDelete.vendorName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Ref PO Vendor:</span>
                <span className="font-semibold text-slate-800">{recordToDelete.poVendorId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">No. Surat Jalan (DO):</span>
                <span className="font-medium text-slate-800">{recordToDelete.doNumber || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Tgl Penerimaan:</span>
                <span className="font-medium text-slate-800">{formatDate(recordToDelete.receiveDate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Jumlah Item:</span>
                <span className="font-semibold text-slate-800">{recordToDelete.items.length} item</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Status Dokumen:</span>
                <span className="font-bold text-slate-800">{recordToDelete.status}</span>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 text-xs text-amber-900 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-[11px] leading-relaxed">
                <strong>Catatan Penting:</strong> Menghapus form ini akan membatalkan status penerimaan fisik terkait, dan jika ada barang yang telah diterima, stok Inbound di Master Inventory akan disesuaikan otomatis kembali.
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRecordToDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteReceivingRecord}
                className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Ya, Hapus Form Secara Permanen</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus Manual Inbound Record (Khusus Administrator) */}
      {manualRecordToDelete && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-100">
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <div className="p-2.5 bg-rose-100 rounded-xl">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  Hapus Transaksi Masuk Manual?
                  <span className="text-[10px] font-extrabold bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full border border-rose-200">
                    Administrator
                  </span>
                </h3>
                <p className="text-xs text-slate-500">
                  Data ini akan dihapus dan stok Inbound di Master Inventory akan disesuaikan otomatis.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-3.5 mb-4 text-xs space-y-2 border border-slate-200">
              <div className="flex justify-between">
                <span className="text-slate-500">Barang:</span>
                <span className="font-bold text-slate-900">
                  [{manualRecordToDelete.sku}] {manualRecordToDelete.itemName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Qty Masuk:</span>
                <span className="font-bold text-emerald-700">
                  +{manualRecordToDelete.qty} {manualRecordToDelete.unit}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Tanggal Masuk:</span>
                <span className="font-medium text-slate-800">{formatDate(manualRecordToDelete.date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Sumber / Vendor:</span>
                <span className="font-medium text-slate-800">{manualRecordToDelete.source}</span>
              </div>
              {manualRecordToDelete.price && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Harga Satuan:</span>
                  <span className="font-medium text-slate-800">{formatRupiah(manualRecordToDelete.price)}</span>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setManualRecordToDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteManualInbound}
                className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Ya, Hapus Data Ini</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pop-up Modal Sukses Submit */}
      <SuccessSubmitModal
        isOpen={showSuccessModal}
        onClose={() => {
          setShowSuccessModal(false);
          scrollToTop();
        }}
        title={successModalData.title}
        message={successModalData.message}
        details={successModalData.details}
      />
    </div>
  );
};
