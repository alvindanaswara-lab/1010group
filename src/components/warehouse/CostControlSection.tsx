import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { PurchaseOrder, POItem } from '../../types';
import { formatRupiah, exportPOToExcel } from '../../utils/excelExport';
import { formatDate } from '../../utils/dateUtils';
import { scrollToTop } from '../../utils/scrollHelper';
import { SuccessSubmitModal, SuccessDetail } from '../common/SuccessSubmitModal';
import {
  Calculator,
  FileCheck2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Search,
  Calendar,
  ArrowUpDown,
  X,
  ChevronUp,
  Eye,
  FileSpreadsheet,
  Check,
  ShieldCheck,
  Ban,
  Building2,
  DollarSign,
  AlertCircle,
  TrendingUp,
  CreditCard,
  CheckSquare,
  Square,
  Layers,
  Filter,
  Lock,
  ArrowLeftRight,
} from 'lucide-react';

export const CostControlSection: React.FC = () => {
  const {
    purchaseOrders,
    vendors,
    approvePOCostControl,
    rejectPOCostControl,
    returnPOToVendorSummary,
    setItemApprovalStatus,
    batchSetItemApprovalStatus,
    currentUser,
  } = useApp();

  // Search & Filter states
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [dateSortOrder, setDateSortOrder] = useState<'desc' | 'asc'>('desc');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  // Currently expanded PO for reviewing details
  const [selectedPOId, setSelectedPOId] = useState<string | null>(null);

  // Selected item keys inside each expanded PO: Record<poId, string[]>
  const [selectedItemKeysByPO, setSelectedItemKeysByPO] = useState<Record<string, string[]>>({});

  // Payment view filter inside expanded PO: Record<poId, 'all' | 'Tempo' | 'Cash'>
  const [poPaymentFilter, setPoPaymentFilter] = useState<Record<string, 'all' | 'Tempo' | 'Cash'>>({});

  // Approval modal & state
  const [approvingPO, setApprovingPO] = useState<PurchaseOrder | null>(null);
  const [approvalNotes, setApprovalNotes] = useState<string>('');

  // Rejection modal & state
  const [rejectingPO, setRejectingPO] = useState<PurchaseOrder | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');

  // Inline approval note input
  const [inlineNotes, setInlineNotes] = useState<Record<string, string>>({});

  // Success Pop-up Modal state
  const [showSuccessModal, setShowSuccessModal] = useState<boolean>(false);
  const [successModalData, setSuccessModalData] = useState<{
    title: string;
    message: string;
    details: SuccessDetail[];
  }>({
    title: 'Pengajuan Berhasil Disetujui!',
    message: '',
    details: [],
  });

  // Filtered & sorted PO list
  const filteredAndSortedPOs = [...purchaseOrders]
    .filter((po) => {
      // Search query filter
      const matchSearch =
        searchQuery === '' ||
        po.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        po.status.toLowerCase().includes(searchQuery.toLowerCase()) ||
        po.items.some(
          (it) =>
            it.itemName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            it.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (it.vendorName && it.vendorName.toLowerCase().includes(searchQuery.toLowerCase()))
        );

      // Date filter
      const matchDate = dateFilter === '' || po.generatedDate === dateFilter;

      // Status filter
      let matchStatus = true;
      if (statusFilter === 'pending') {
        matchStatus = po.status === 'Review Cost Control';
      } else if (statusFilter === 'approved') {
        matchStatus =
          po.status === 'Approved by Cost Control' ||
          po.status === 'Submitted to Vendor' ||
          po.status === 'Sent to Receiving' ||
          po.status === 'Completed';
      } else if (statusFilter === 'rejected') {
        matchStatus = po.status === 'Rejected by Cost Control';
      }

      return matchSearch && matchDate && matchStatus;
    })
    .sort((a, b) => {
      const timeA = new Date(a.generatedDate).getTime();
      const timeB = new Date(b.generatedDate).getTime();
      return dateSortOrder === 'desc' ? timeB - timeA : timeA - timeB;
    });

  // Summary Metrics
  const pendingCount = purchaseOrders.filter((p) => p.status === 'Review Cost Control').length;
  const approvedPOs = purchaseOrders.filter(
    (p) =>
      p.status === 'Approved by Cost Control' ||
      p.status === 'Submitted to Vendor' ||
      p.status === 'Sent to Receiving' ||
      p.status === 'Completed'
  );
  const approvedCount = approvedPOs.length;
  const totalApprovedValue = approvedPOs.reduce((acc, p) => acc + p.totalAmount, 0);

  // Handle Confirm Approval
  const handleConfirmApproval = () => {
    if (!approvingPO) return;
    const poId = approvingPO.id;

    const rejectedItems = approvingPO.items.filter(
      (it) => it.approvalStatus === 'Rejected' || it.status === 'Rejected'
    );
    if (rejectedItems.length > 0) {
      alert(
        `Tidak dapat menyetujui form PO: Masih terdapat ${rejectedItems.length} item yang tidak disetujui (Rejected). Sesuai alur Cost Control, proses approve tidak bisa dilakukan sampai semua item disetujui.`
      );
      return;
    }

    const unapprovedItems = approvingPO.items.filter((it) => it.approvalStatus !== 'Approved');
    if (unapprovedItems.length > 0) {
      alert(
        `Tidak dapat menyetujui form PO: Masih ada ${unapprovedItems.length} item yang belum disetujui. Semua item harus disetujui terlebih dahulu.`
      );
      return;
    }

    const totalVal = formatRupiah(approvingPO.totalAmount);
    const totalItems = approvingPO.items.length;
    const notesToSave = approvalNotes || inlineNotes[poId] || 'Total pengajuan pembelian telah diverifikasi dan disetujui.';

    const res = approvePOCostControl(poId, notesToSave);
    if (res.success) {
      setSuccessModalData({
        title: 'Pengajuan Pembelian Berhasil Disetujui!',
        message: `Total pengajuan pembelian form ${poId} telah resmi disetujui oleh Cost Control (${currentUser.username}). Form PO Vendor kini telah terbuka untuk dilakukan submit to vendor.`,
        details: [
          { label: 'Nomor PO', value: poId },
          { label: 'Total Nominal', value: totalVal },
          { label: 'Jumlah Item', value: `${totalItems} jenis barang` },
          { label: 'Approver', value: `${currentUser.username} (${currentUser.position})` },
          { label: 'Status Baru', value: 'Approved by Cost Control (Siap Submit to Vendor)' },
        ],
      });
      setShowSuccessModal(true);
      setApprovingPO(null);
      setApprovalNotes('');
      scrollToTop();
    } else {
      alert(res.message);
    }
  };

  // Handle Confirm Rejection
  const handleConfirmRejection = () => {
    if (!rejectingPO) return;
    const poId = rejectingPO.id;
    const reason = rejectionReason || 'Harga satuan atau kuantitas memerlukan review ulang oleh purchasing.';

    const res = rejectPOCostControl(poId, reason);
    if (res.success) {
      setSuccessModalData({
        title: 'Pengajuan Dikembalikan / Diminta Revisi',
        message: `Form ${poId} telah ditandai ditolak / diminta revisi. Tim Purchasing akan melihat catatan untuk penyesuaian.`,
        details: [
          { label: 'Nomor PO', value: poId },
          { label: 'Alasan Revisi', value: reason },
          { label: 'Reviewer', value: `${currentUser.username} (${currentUser.position})` },
        ],
      });
      setShowSuccessModal(true);
      setRejectingPO(null);
      setRejectionReason('');
      scrollToTop();
    }
  };

  // Helper item key
  const getItemKey = (it: POItem) => `${it.sku}__${it.place || ''}`;

  // Toggle single item selection checkbox
  const handleToggleSelectItem = (poId: string, itemKey: string) => {
    setSelectedItemKeysByPO((prev) => {
      const current = prev[poId] || [];
      const updated = current.includes(itemKey)
        ? current.filter((k) => k !== itemKey)
        : [...current, itemKey];
      return { ...prev, [poId]: updated };
    });
  };

  // Select / Deselect multiple items in PO
  const handleSelectMultipleItems = (poId: string, targetKeys: string[]) => {
    setSelectedItemKeysByPO((prev) => {
      const current = prev[poId] || [];
      const isAllTargetSelected = targetKeys.length > 0 && targetKeys.every((k) => current.includes(k));
      if (isAllTargetSelected) {
        return {
          ...prev,
          [poId]: current.filter((k) => !targetKeys.includes(k)),
        };
      } else {
        const merged = Array.from(new Set([...current, ...targetKeys]));
        return { ...prev, [poId]: merged };
      }
    });
  };

  // Batch decision for selected items
  const handleBatchItemDecision = (
    po: PurchaseOrder,
    status: 'Approved' | 'Rejected',
    targetKeys?: string[]
  ) => {
    const keys = targetKeys || selectedItemKeysByPO[po.id] || [];
    if (keys.length === 0) return;

    const updates = keys.map((k) => {
      const [sku, place] = k.split('__');
      return {
        poId: po.id,
        sku,
        place: place || undefined,
        status,
        reason: status === 'Rejected' ? 'Ditolak oleh Cost Control' : undefined,
      };
    });

    batchSetItemApprovalStatus(updates);
  };

  // Single item decision
  const handleSingleItemDecision = (
    poId: string,
    sku: string,
    place: string | undefined,
    status: 'Approved' | 'Rejected'
  ) => {
    setItemApprovalStatus(poId, sku, place, status);
  };

  const getStatusBadge = (status: PurchaseOrder['status']) => {
    switch (status) {
      case 'Review Cost Control':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
            <Clock className="w-3 h-3 text-amber-600 animate-pulse" />
            Menunggu Review Cost Control
          </span>
        );
      case 'Approved by Cost Control':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Disetujui Cost Control
          </span>
        );
      case 'Rejected by Cost Control':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-100 text-red-800 border border-red-300">
            <Ban className="w-3 h-3 text-red-600" />
            Ditolak / Perlu Revisi
          </span>
        );
      case 'Sent to Receiving':
      case 'Submitted to Vendor':
      case 'Completed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-300">
            <Check className="w-3 h-3 text-blue-600" />
            Disetujui & Terkirim ke Vendor
          </span>
        );
      case 'Submitted to Purchasing':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-300">
            <Clock className="w-3 h-3 text-amber-600" />
            Di Purchasing (Belum Diajukan ke CC)
          </span>
        );
      case 'Draft PO':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-300">
            Draft PO (Belum Diajukan)
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <Calculator className="w-6 h-6 text-rose-600" />
            Cost Control - Review & Approval PO Vendor
          </h1>
          <p className="text-xs text-slate-500">
            Tinjau rincian draft purchase order yang diajukan dari PO Vendor, evaluasi kewajaran total pengajuan, dan berikan persetujuan resmi sebelum form dapat disubmit ke vendor.
          </p>
        </div>

        {/* Quick status indicator */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-900">
            <ShieldCheck className="w-4 h-4 text-rose-600" />
            <span>Otoritas Persetujuan: <strong>Cost Control</strong></span>
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Pending Review */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Menunggu Approval</p>
            <p className="text-2xl font-black text-amber-600 mt-1">{pendingCount} PO</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Memerlukan review total pengajuan</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        {/* Total Approved */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total PO Disetujui</p>
            <p className="text-2xl font-black text-emerald-600 mt-1">{approvedCount} PO</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Siap / telah diproses ke vendor</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        {/* Total Approved Value */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Nominal Disetujui</p>
            <p className="text-lg font-black text-indigo-700 mt-1 truncate max-w-[170px]" title={formatRupiah(totalApprovedValue)}>
              {formatRupiah(totalApprovedValue)}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">Akumulasi biaya pembelian disetujui</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-700">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        {/* Total PO Forms */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Form PO</p>
            <p className="text-2xl font-black text-slate-800 mt-1">{purchaseOrders.length} Form</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Dari seluruh divisi & periode</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
            <FileCheck2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Table Header Bar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <FileCheck2 className="w-4 h-4 text-rose-600" />
              Daftar Draft PO untuk Review & Persetujuan
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Klik pada baris atau tombol <strong>"Review Rincian Draft PO"</strong> untuk melihat rincian barang, harga, dan menyetujui total pengajuan pembelian.
            </p>
          </div>

          {/* Quick status filter buttons */}
          <div className="flex items-center gap-1 bg-slate-200/70 p-1 rounded-xl text-xs">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 rounded-lg font-bold transition ${
                statusFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Semua ({purchaseOrders.length})
            </button>
            <button
              onClick={() => setStatusFilter('pending')}
              className={`px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1 ${
                statusFilter === 'pending'
                  ? 'bg-amber-500 text-white shadow-2xs'
                  : 'text-amber-800 hover:text-amber-900'
              }`}
            >
              <Clock className="w-3 h-3" />
              Menunggu Approval ({pendingCount})
            </button>
            <button
              onClick={() => setStatusFilter('approved')}
              className={`px-2.5 py-1 rounded-lg font-bold transition ${
                statusFilter === 'approved' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-emerald-800 hover:text-emerald-900'
              }`}
            >
              Disetujui ({approvedCount})
            </button>
            <button
              onClick={() => setStatusFilter('rejected')}
              className={`px-2.5 py-1 rounded-lg font-bold transition ${
                statusFilter === 'rejected' ? 'bg-red-600 text-white shadow-2xs' : 'text-red-700 hover:text-red-900'
              }`}
            >
              Ditolak
            </button>
          </div>
        </div>

        {/* Filter & Search Toolbar */}
        <div className="p-3 bg-slate-50/90 border-b border-slate-200 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 text-xs">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari Nomor Form PO, Nama Vendor, SKU, atau Nama Barang..."
              className="w-full pl-9 pr-8 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-hidden"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Filter Tanggal */}
            <div className="flex items-center gap-1.5 bg-white border border-slate-300 px-2.5 py-1.5 rounded-lg shadow-2xs">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="text-xs text-slate-700 bg-transparent outline-hidden font-medium"
              />
              {dateFilter && (
                <button
                  onClick={() => setDateFilter('')}
                  className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-semibold ml-1"
                  title="Tampilkan semua tanggal"
                >
                  Semua
                </button>
              )}
            </div>

            {/* Urutkan Tanggal */}
            <button
              onClick={() => setDateSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg font-semibold transition shadow-2xs"
            >
              <ArrowUpDown className="w-3.5 h-3.5 text-rose-600" />
              <span>Urutkan: {dateSortOrder === 'desc' ? 'Terbaru' : 'Terlama'}</span>
            </button>
          </div>
        </div>

        {/* PO List Table */}
        {filteredAndSortedPOs.length === 0 ? (
          <div className="p-10 text-center text-slate-400">
            <Calculator className="w-12 h-12 mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-semibold text-slate-600">
              Tidak ada data Purchase Order yang cocok dengan filter.
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Saat PO Vendor mengisi vendor dan mengklik "Ajukan ke Cost Control", form akan muncul di sini untuk ditinjau.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/70 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Nomor Form PO</th>
                  <th className="px-4 py-3">Tgl Generate / Pengajuan</th>
                  <th className="px-4 py-3">Vendor Ditugaskan</th>
                  <th className="px-4 py-3 text-center">Total Item</th>
                  <th className="px-4 py-3 text-right">Total Nilai Pengajuan (IDR)</th>
                  <th className="px-4 py-3 text-center">Status Cost Control</th>
                  <th className="px-4 py-3 text-center">Aksi Review</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAndSortedPOs.map((po) => {
                  const isSelected = selectedPOId === po.id;
                  const isPending = po.status === 'Review Cost Control';
                  const isApproved =
                    po.status === 'Approved by Cost Control' ||
                    po.status === 'Submitted to Vendor' ||
                    po.status === 'Sent to Receiving' ||
                    po.status === 'Completed';

                  // Distinct vendors
                  const vendorsList = Array.from(
                    new Set(po.items.map((i) => i.vendorName).filter(Boolean))
                  );

                  return (
                    <React.Fragment key={po.id}>
                      <tr
                        onClick={() => setSelectedPOId(isSelected ? null : po.id)}
                        className={`hover:bg-rose-50/40 transition cursor-pointer ${
                          isSelected ? 'bg-rose-50/70 font-medium border-l-4 border-l-rose-600' : ''
                        }`}
                      >
                        {/* PO ID */}
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 text-slate-900 border border-slate-300 font-mono font-bold">
                            {po.id}
                          </span>
                        </td>

                        {/* Date */}
                        <td className="px-4 py-3 text-slate-700 font-medium">
                          <div>{formatDate(po.generatedDate)}</div>
                          {po.submittedToCostControlBy && (
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              Diajukan: {po.submittedToCostControlBy}
                            </div>
                          )}
                        </td>

                        {/* Vendor Name */}
                        <td className="px-4 py-3">
                          {vendorsList.length > 0 ? (
                            <div className="flex flex-col gap-1 max-w-[220px]">
                              {vendorsList.slice(0, 2).map((v, i) => (
                                <span
                                  key={i}
                                  className="text-[11px] font-semibold text-slate-800 truncate"
                                  title={v as string}
                                >
                                  • {v}
                                </span>
                              ))}
                              {vendorsList.length > 2 && (
                                <span className="text-[10px] text-indigo-600 font-semibold">
                                  +{vendorsList.length - 2} vendor lainnya
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">Belum ada vendor</span>
                          )}
                        </td>

                        {/* Total Items */}
                        <td className="px-4 py-3 text-center">
                          <span className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md text-[11px]">
                            {po.items.length} item
                          </span>
                        </td>

                        {/* Total Amount */}
                        <td className="px-4 py-3 text-right font-black text-rose-700 text-sm">
                          {formatRupiah(po.totalAmount)}
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3 text-center">
                          {getStatusBadge(po.status)}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => setSelectedPOId(isSelected ? null : po.id)}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-2xs ${
                                isSelected
                                  ? 'bg-rose-600 text-white'
                                  : isPending
                                  ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-300'
                                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                              }`}
                              title={isSelected ? 'Tutup review draft PO' : 'Buka dan review draft PO ini'}
                            >
                              {isSelected ? (
                                <>
                                  <ChevronUp className="w-3.5 h-3.5" />
                                  Tutup Review
                                </>
                              ) : (
                                <>
                                  <Eye className="w-3.5 h-3.5 text-rose-600" />
                                  Review Rincian Draft PO
                                </>
                              )}
                            </button>

                            {/* Export Excel */}
                            <button
                              onClick={() => exportPOToExcel(po)}
                              className="p-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-md transition"
                              title="Export PO ke Excel"
                            >
                              <FileSpreadsheet className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded Review Panel Underneath the Form */}
                      {isSelected && (
                        <tr className="bg-rose-50/30 border-b-2 border-rose-400">
                          <td colSpan={7} className="p-3 sm:p-5">
                            <div className="bg-white rounded-xl border-2 border-rose-400 shadow-md overflow-hidden animate-in fade-in duration-200 space-y-4">
                              {/* Top Banner of Expanded Review */}
                              <div className="p-4 bg-gradient-to-r from-rose-50 via-slate-50 to-amber-50 border-b border-rose-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono font-bold text-xs bg-rose-600 text-white px-2.5 py-0.5 rounded-md">
                                      {po.id}
                                    </span>
                                    <h4 className="font-bold text-base text-slate-900">
                                      Review Draft Purchase Order & Persetujuan Pembelian
                                    </h4>
                                  </div>
                                  <p className="text-[11px] text-slate-600 mt-1">
                                    Verifikasi rincian barang, kuantitas, harga satuan, dan vendor mitra. Pastikan total pengajuan pembelian sesuai anggaran sebelum disetujui.
                                  </p>
                                </div>

                                {/* Right Side: Total Pengajuan Card */}
                                <div className="bg-white border-2 border-rose-500 rounded-xl px-4 py-2 text-right shadow-xs">
                                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                    Total Pengajuan Pembelian
                                  </div>
                                  <div className="text-xl font-black text-rose-700">
                                    {formatRupiah(po.totalAmount)}
                                  </div>
                                  <div className="text-[10px] text-slate-500 font-medium">
                                    {po.items.length} item barang
                                  </div>
                                </div>
                              </div>

                              {/* Info Metadata Grid */}
                              <div className="px-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                                <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-lg">
                                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Tanggal Generate PO</span>
                                  <span className="font-semibold text-slate-800">{formatDate(po.generatedDate)}</span>
                                </div>
                                <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-lg">
                                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Diajukan Oleh</span>
                                  <span className="font-semibold text-slate-800">
                                    {po.submittedToCostControlBy || 'Purchasing Team'}
                                  </span>
                                </div>
                                <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-lg">
                                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Sumber Pesanan</span>
                                  <span className="font-semibold text-slate-800 truncate block" title={po.sourceOrderIds.join(', ')}>
                                    {po.sourceOrderIds.length} Form PR Outlet
                                  </span>
                                </div>
                                <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-lg">
                                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Status Terkini</span>
                                  <div className="mt-0.5">{getStatusBadge(po.status)}</div>
                                </div>
                              </div>

                              {/* Items Breakdown: Tipe Pembayaran (Tempo & Cash) > Vendor > List Barang */}
                              {(() => {
                                const activePaymentFilter = poPaymentFilter[po.id] || 'all';
                                const selectedKeys = selectedItemKeysByPO[po.id] || [];

                                // Tempo items
                                const tempoItems = po.items.filter(
                                  (it) => it.paymentMethod === 'Tempo' || (!it.paymentMethod && !it.paymentTerm?.includes('Cash'))
                                );
                                // Cash items
                                const cashItems = po.items.filter(
                                  (it) => it.paymentMethod === 'Cash' || it.paymentTerm?.includes('Cash')
                                );

                                // Grouping within Tempo by vendor
                                const tempoVendorsMap = new Map<string, POItem[]>();
                                tempoItems.forEach((it) => {
                                  const vName = it.vendorName || 'Vendor Umum (Tempo)';
                                  if (!tempoVendorsMap.has(vName)) tempoVendorsMap.set(vName, []);
                                  tempoVendorsMap.get(vName)!.push(it);
                                });

                                // Grouping within Cash by vendor
                                const cashVendorsMap = new Map<string, POItem[]>();
                                cashItems.forEach((it) => {
                                  const vName = it.vendorName || 'Vendor Umum (Cash)';
                                  if (!cashVendorsMap.has(vName)) cashVendorsMap.set(vName, []);
                                  cashVendorsMap.get(vName)!.push(it);
                                });

                                const tempoTotal = tempoItems.reduce((acc, it) => acc + (it.qty * it.price), 0);
                                const cashTotal = cashItems.reduce((acc, it) => acc + (it.qty * it.price), 0);

                                const visibleItems = activePaymentFilter === 'Tempo'
                                  ? tempoItems
                                  : activePaymentFilter === 'Cash'
                                  ? cashItems
                                  : po.items;

                                const visibleKeys = visibleItems.map(getItemKey);
                                const isAllVisibleSelected = visibleKeys.length > 0 && visibleKeys.every((k) => selectedKeys.includes(k));

                                const approvedItems = po.items.filter((it) => it.approvalStatus === 'Approved' || (!it.approvalStatus && it.status !== 'Rejected' && po.status === 'Approved by Cost Control'));
                                const rejectedItems = po.items.filter((it) => it.approvalStatus === 'Rejected' || it.status === 'Rejected');
                                const pendingDecisionItems = po.items.filter((it) => it.approvalStatus !== 'Approved' && it.approvalStatus !== 'Rejected' && it.status !== 'Rejected');

                                const approvedTotal = approvedItems.reduce((acc, it) => acc + (it.qty * it.price), 0);
                                const rejectedTotal = rejectedItems.reduce((acc, it) => acc + (it.qty * it.price), 0);

                                const showTempo = activePaymentFilter === 'all' || activePaymentFilter === 'Tempo';
                                const showCash = activePaymentFilter === 'all' || activePaymentFilter === 'Cash';

                                return (
                                  <div className="px-4 space-y-4">
                                    {/* Toolbar: Filter Tipe Pembayaran & Batch Selection */}
                                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                                      {/* Filter Tipe Pembayaran (Tempo / Cash) */}
                                      <div className="flex flex-wrap items-center gap-1.5">
                                        <span className="font-bold text-slate-500 mr-1 flex items-center gap-1">
                                          <Filter className="w-3.5 h-3.5" />
                                          Filter Tipe:
                                        </span>
                                        <div className="inline-flex bg-white p-0.5 rounded-lg border border-slate-200 shadow-2xs">
                                          <button
                                            type="button"
                                            onClick={() => setPoPaymentFilter((prev) => ({ ...prev, [po.id]: 'all' }))}
                                            className={`px-3 py-1 rounded-md font-bold text-xs transition cursor-pointer ${
                                              activePaymentFilter === 'all'
                                                ? 'bg-rose-600 text-white shadow-2xs'
                                                : 'text-slate-600 hover:text-slate-900'
                                            }`}
                                          >
                                            Semua Barang ({po.items.length})
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => setPoPaymentFilter((prev) => ({ ...prev, [po.id]: 'Tempo' }))}
                                            className={`px-3 py-1 rounded-md font-bold text-xs transition flex items-center gap-1.5 cursor-pointer ${
                                              activePaymentFilter === 'Tempo'
                                                ? 'bg-indigo-600 text-white shadow-2xs'
                                                : 'text-slate-600 hover:text-slate-900'
                                            }`}
                                          >
                                            <CreditCard className="w-3.5 h-3.5" />
                                            <span>Tempo ({tempoItems.length} item • {tempoVendorsMap.size} vendor)</span>
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => setPoPaymentFilter((prev) => ({ ...prev, [po.id]: 'Cash' }))}
                                            className={`px-3 py-1 rounded-md font-bold text-xs transition flex items-center gap-1.5 cursor-pointer ${
                                              activePaymentFilter === 'Cash'
                                                ? 'bg-emerald-600 text-white shadow-2xs'
                                                : 'text-slate-600 hover:text-slate-900'
                                            }`}
                                          >
                                            <DollarSign className="w-3.5 h-3.5" />
                                            <span>Cash ({cashItems.length} item • {cashVendorsMap.size} vendor)</span>
                                          </button>
                                        </div>
                                      </div>

                                      {/* Batch Selection & Action Buttons */}
                                      {isPending && (
                                        <div className="flex flex-wrap items-center gap-2">
                                          {visibleKeys.length > 0 && (
                                            <button
                                              type="button"
                                              onClick={() => handleSelectMultipleItems(po.id, visibleKeys)}
                                              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 rounded-lg font-bold border border-slate-200 transition cursor-pointer"
                                            >
                                              {isAllVisibleSelected ? (
                                                <CheckSquare className="w-4 h-4 text-rose-600" />
                                              ) : (
                                                <Square className="w-4 h-4 text-slate-400" />
                                              )}
                                              <span>{isAllVisibleSelected ? 'Batal Pilih Semua' : `Pilih Semua (${visibleKeys.length})`}</span>
                                            </button>
                                          )}

                                          {selectedKeys.length > 0 && (
                                            <div className="flex items-center gap-1.5 animate-in fade-in duration-150">
                                              <span className="text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-1 rounded-md border border-rose-200">
                                                {selectedKeys.length} Terpilih
                                              </span>
                                              <button
                                                type="button"
                                                onClick={() => handleBatchItemDecision(po, 'Approved', selectedKeys)}
                                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold transition flex items-center gap-1 shadow-2xs cursor-pointer"
                                                title="Setujui semua item terpilih"
                                              >
                                                <Check className="w-3.5 h-3.5" />
                                                <span>Setujui ({selectedKeys.length})</span>
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => handleBatchItemDecision(po, 'Rejected', selectedKeys)}
                                                className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold transition flex items-center gap-1 shadow-2xs cursor-pointer"
                                                title="Tolak / tidak setujui semua item terpilih"
                                              >
                                                <Ban className="w-3.5 h-3.5" />
                                                <span>Tolak ({selectedKeys.length})</span>
                                              </button>
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>

                                    {/* 1. PEMISAHAN BAGIAN TEMPO */}
                                    {showTempo && tempoItems.length > 0 && (
                                      <div className="space-y-3 border-2 border-indigo-200/90 rounded-xl p-3.5 bg-indigo-50/20">
                                        {/* Header Bagian Tempo */}
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-indigo-200">
                                          <div className="flex items-center gap-2">
                                            <div className="p-1.5 rounded-lg bg-indigo-600 text-white shadow-2xs">
                                              <CreditCard className="w-4 h-4" />
                                            </div>
                                            <div>
                                              <h5 className="font-extrabold text-xs text-indigo-950 uppercase tracking-wide">
                                                Tipe Pembayaran: TEMPO (Term of Payment)
                                              </h5>
                                              <p className="text-[11px] text-indigo-700 font-medium">
                                                {tempoVendorsMap.size} Mitra Vendor • {tempoItems.length} Jenis Barang
                                              </p>
                                            </div>
                                          </div>
                                          <div className="text-right">
                                            <span className="text-[10px] font-bold text-slate-400 block uppercase">Subtotal Tempo</span>
                                            <span className="text-sm font-black text-indigo-900">{formatRupiah(tempoTotal)}</span>
                                          </div>
                                        </div>

                                        {/* Loop Group Vendor di bawah Tempo */}
                                        <div className="space-y-3 pt-1">
                                          {Array.from(tempoVendorsMap.entries()).map(([vendorName, vItems]) => {
                                            const matchedV = vendors.find((v) => v.namaVendor === vendorName);
                                            const topLabel = vItems[0]?.paymentTerm || matchedV?.topTerm || matchedV?.paymentType || 'TOP 14 Hari';
                                            const vendorSubtotal = vItems.reduce((acc, it) => acc + (it.qty * it.price), 0);
                                            const vendorItemKeys = vItems.map(getItemKey);
                                            const isAllVendorSelected = vendorItemKeys.length > 0 && vendorItemKeys.every((k) => selectedKeys.includes(k));

                                            return (
                                              <div
                                                key={vendorName}
                                                className="bg-white rounded-xl border border-indigo-200 shadow-2xs overflow-hidden"
                                              >
                                                {/* Header Vendor Mitra */}
                                                <div className="px-3.5 py-2.5 bg-indigo-50/70 border-b border-indigo-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                                  <div className="flex items-center gap-2">
                                                    {isPending && (
                                                      <input
                                                        type="checkbox"
                                                        checked={isAllVendorSelected}
                                                        onChange={() => handleSelectMultipleItems(po.id, vendorItemKeys)}
                                                        className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                                                        title="Pilih seluruh barang pada vendor ini"
                                                      />
                                                    )}
                                                    <Building2 className="w-4 h-4 text-indigo-600 shrink-0" />
                                                    <span className="font-extrabold text-xs text-slate-900">{vendorName}</span>
                                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-300">
                                                      {topLabel}
                                                    </span>
                                                  </div>

                                                  <div className="flex items-center gap-3">
                                                    <div className="text-right text-xs">
                                                      <span className="text-slate-500 mr-1.5">{vItems.length} barang:</span>
                                                      <span className="font-extrabold text-indigo-900">{formatRupiah(vendorSubtotal)}</span>
                                                    </div>

                                                    {isPending && (
                                                      <div className="flex items-center gap-1">
                                                        <button
                                                          type="button"
                                                          onClick={() => handleBatchItemDecision(po, 'Approved', vendorItemKeys)}
                                                          className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 transition cursor-pointer"
                                                          title="Setujui semua barang vendor ini"
                                                        >
                                                          ✓ Setujui Vendor
                                                        </button>
                                                        <button
                                                          type="button"
                                                          onClick={() => handleBatchItemDecision(po, 'Rejected', vendorItemKeys)}
                                                          className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-red-50 hover:bg-red-100 text-red-700 border border-red-300 transition cursor-pointer"
                                                          title="Tolak semua barang vendor ini"
                                                        >
                                                          ✕ Tolak Vendor
                                                        </button>
                                                      </div>
                                                    )}
                                                  </div>
                                                </div>

                                                {/* List Barang Table */}
                                                <div className="overflow-x-auto">
                                                  <table className="w-full text-left text-xs">
                                                    <thead className="bg-slate-100/70 text-slate-600 font-bold border-b border-slate-200">
                                                      <tr>
                                                        {isPending && <th className="px-3 py-2 text-center w-9">Pilih</th>}
                                                        <th className="px-3 py-2">SKU</th>
                                                        <th className="px-3 py-2">Nama Barang &amp; Kategori</th>
                                                        <th className="px-3 py-2 text-center">Qty</th>
                                                        <th className="px-3 py-2 text-center">Satuan</th>
                                                        <th className="px-3 py-2 text-right">Harga Satuan</th>
                                                        <th className="px-3 py-2 text-right">Subtotal</th>
                                                        <th className="px-3 py-2 text-center">Status Keputusan</th>
                                                        {isPending && <th className="px-3 py-2 text-center">Aksi Keputusan</th>}
                                                      </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100">
                                                      {vItems.map((it) => {
                                                        const itemKey = getItemKey(it);
                                                        const isChecked = selectedKeys.includes(itemKey);
                                                        const isItemApproved = it.approvalStatus === 'Approved';
                                                        const isItemRejected = it.approvalStatus === 'Rejected' || it.status === 'Rejected';

                                                        return (
                                                          <tr
                                                            key={itemKey}
                                                            className={`hover:bg-slate-50/80 transition ${
                                                              isItemRejected
                                                                ? 'bg-red-50/40 text-slate-400'
                                                                : isItemApproved
                                                                ? 'bg-emerald-50/30'
                                                                : ''
                                                            }`}
                                                          >
                                                            {isPending && (
                                                              <td className="px-3 py-2 text-center">
                                                                <input
                                                                  type="checkbox"
                                                                  checked={isChecked}
                                                                  onChange={() => handleToggleSelectItem(po.id, itemKey)}
                                                                  className="w-4 h-4 text-rose-600 rounded border-slate-300 focus:ring-rose-500 cursor-pointer"
                                                                />
                                                              </td>
                                                            )}
                                                            <td className="px-3 py-2 font-mono font-bold text-slate-800">
                                                              {it.sku}
                                                            </td>
                                                            <td className="px-3 py-2">
                                                              <div className="font-bold text-slate-900">{it.itemName}</div>
                                                              <div className="text-[10px] text-slate-400">{it.category}</div>
                                                            </td>
                                                            <td className="px-3 py-2 text-center font-bold text-slate-800">
                                                              {it.qty}
                                                            </td>
                                                            <td className="px-3 py-2 text-center text-slate-600">
                                                              {it.unit}
                                                            </td>
                                                            <td className="px-3 py-2 text-right text-slate-700">
                                                              {formatRupiah(it.price)}
                                                            </td>
                                                            <td className="px-3 py-2 text-right font-black text-slate-900">
                                                              {formatRupiah(it.qty * it.price)}
                                                            </td>
                                                            <td className="px-3 py-2 text-center">
                                                              {isItemApproved ? (
                                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                                                  <Check className="w-3 h-3 text-emerald-600" />
                                                                  Disetujui
                                                                </span>
                                                              ) : isItemRejected ? (
                                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-red-100 text-red-800 border border-red-300">
                                                                  <Ban className="w-3 h-3 text-red-600" />
                                                                  Tidak Disetujui
                                                                </span>
                                                              ) : (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300">
                                                                  <Clock className="w-3 h-3 text-amber-600" />
                                                                  Menunggu Review
                                                                </span>
                                                              )}
                                                            </td>
                                                            {isPending && (
                                                              <td className="px-3 py-2 text-center">
                                                                <div className="inline-flex items-center gap-1">
                                                                  <button
                                                                    type="button"
                                                                    onClick={() => handleSingleItemDecision(po.id, it.sku, it.place, 'Approved')}
                                                                    className={`px-2 py-1 rounded-md text-[11px] font-bold transition flex items-center gap-1 cursor-pointer ${
                                                                      isItemApproved
                                                                        ? 'bg-emerald-600 text-white shadow-2xs'
                                                                        : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300'
                                                                    }`}
                                                                    title="Setujui item ini"
                                                                  >
                                                                    <Check className="w-3 h-3" />
                                                                    <span>Setujui</span>
                                                                  </button>
                                                                  <button
                                                                    type="button"
                                                                    onClick={() => handleSingleItemDecision(po.id, it.sku, it.place, 'Rejected')}
                                                                    className={`px-2 py-1 rounded-md text-[11px] font-bold transition flex items-center gap-1 cursor-pointer ${
                                                                      isItemRejected
                                                                        ? 'bg-red-600 text-white shadow-2xs'
                                                                        : 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-300'
                                                                    }`}
                                                                    title="Tolak item ini"
                                                                  >
                                                                    <Ban className="w-3 h-3" />
                                                                    <span>Tidak Disetujui</span>
                                                                  </button>
                                                                </div>
                                                              </td>
                                                            )}
                                                          </tr>
                                                        );
                                                      })}
                                                    </tbody>
                                                  </table>
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    )}

                                    {/* 2. PEMISAHAN BAGIAN CASH */}
                                    {showCash && cashItems.length > 0 && (
                                      <div className="space-y-3 border-2 border-emerald-200/90 rounded-xl p-3.5 bg-emerald-50/20">
                                        {/* Header Bagian Cash */}
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-emerald-200">
                                          <div className="flex items-center gap-2">
                                            <div className="p-1.5 rounded-lg bg-emerald-600 text-white shadow-2xs">
                                              <DollarSign className="w-4 h-4" />
                                            </div>
                                            <div>
                                              <h5 className="font-extrabold text-xs text-emerald-950 uppercase tracking-wide">
                                                Tipe Pembayaran: CASH (Tunai / COD)
                                              </h5>
                                              <p className="text-[11px] text-emerald-700 font-medium">
                                                {cashVendorsMap.size} Mitra Vendor • {cashItems.length} Jenis Barang
                                              </p>
                                            </div>
                                          </div>
                                          <div className="text-right">
                                            <span className="text-[10px] font-bold text-slate-400 block uppercase">Subtotal Cash</span>
                                            <span className="text-sm font-black text-emerald-900">{formatRupiah(cashTotal)}</span>
                                          </div>
                                        </div>

                                        {/* Loop Group Vendor di bawah Cash */}
                                        <div className="space-y-3 pt-1">
                                          {Array.from(cashVendorsMap.entries()).map(([vendorName, vItems]) => {
                                            const matchedV = vendors.find((v) => v.namaVendor === vendorName);
                                            const cashLabel = vItems[0]?.paymentTerm || matchedV?.cashType || matchedV?.paymentType || 'Cash / COD';
                                            const vendorSubtotal = vItems.reduce((acc, it) => acc + (it.qty * it.price), 0);
                                            const vendorItemKeys = vItems.map(getItemKey);
                                            const isAllVendorSelected = vendorItemKeys.length > 0 && vendorItemKeys.every((k) => selectedKeys.includes(k));

                                            return (
                                              <div
                                                key={vendorName}
                                                className="bg-white rounded-xl border border-emerald-200 shadow-2xs overflow-hidden"
                                              >
                                                {/* Header Vendor Mitra */}
                                                <div className="px-3.5 py-2.5 bg-emerald-50/70 border-b border-emerald-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                                  <div className="flex items-center gap-2">
                                                    {isPending && (
                                                      <input
                                                        type="checkbox"
                                                        checked={isAllVendorSelected}
                                                        onChange={() => handleSelectMultipleItems(po.id, vendorItemKeys)}
                                                        className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                                                        title="Pilih seluruh barang pada vendor ini"
                                                      />
                                                    )}
                                                    <Building2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                                    <span className="font-extrabold text-xs text-slate-900">{vendorName}</span>
                                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                                      {cashLabel}
                                                    </span>
                                                  </div>

                                                  <div className="flex items-center gap-3">
                                                    <div className="text-right text-xs">
                                                      <span className="text-slate-500 mr-1.5">{vItems.length} barang:</span>
                                                      <span className="font-extrabold text-emerald-900">{formatRupiah(vendorSubtotal)}</span>
                                                    </div>

                                                    {isPending && (
                                                      <div className="flex items-center gap-1">
                                                        <button
                                                          type="button"
                                                          onClick={() => handleBatchItemDecision(po, 'Approved', vendorItemKeys)}
                                                          className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 transition cursor-pointer"
                                                          title="Setujui semua barang vendor ini"
                                                        >
                                                          ✓ Setujui Vendor
                                                        </button>
                                                        <button
                                                          type="button"
                                                          onClick={() => handleBatchItemDecision(po, 'Rejected', vendorItemKeys)}
                                                          className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-red-50 hover:bg-red-100 text-red-700 border border-red-300 transition cursor-pointer"
                                                          title="Tolak semua barang vendor ini"
                                                        >
                                                          ✕ Tolak Vendor
                                                        </button>
                                                      </div>
                                                    )}
                                                  </div>
                                                </div>

                                                {/* List Barang Table */}
                                                <div className="overflow-x-auto">
                                                  <table className="w-full text-left text-xs">
                                                    <thead className="bg-slate-100/70 text-slate-600 font-bold border-b border-slate-200">
                                                      <tr>
                                                        {isPending && <th className="px-3 py-2 text-center w-9">Pilih</th>}
                                                        <th className="px-3 py-2">SKU</th>
                                                        <th className="px-3 py-2">Nama Barang &amp; Kategori</th>
                                                        <th className="px-3 py-2 text-center">Qty</th>
                                                        <th className="px-3 py-2 text-center">Satuan</th>
                                                        <th className="px-3 py-2 text-right">Harga Satuan</th>
                                                        <th className="px-3 py-2 text-right">Subtotal</th>
                                                        <th className="px-3 py-2 text-center">Status Keputusan</th>
                                                        {isPending && <th className="px-3 py-2 text-center">Aksi Keputusan</th>}
                                                      </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100">
                                                      {vItems.map((it) => {
                                                        const itemKey = getItemKey(it);
                                                        const isChecked = selectedKeys.includes(itemKey);
                                                        const isItemApproved = it.approvalStatus === 'Approved';
                                                        const isItemRejected = it.approvalStatus === 'Rejected' || it.status === 'Rejected';

                                                        return (
                                                          <tr
                                                            key={itemKey}
                                                            className={`hover:bg-slate-50/80 transition ${
                                                              isItemRejected
                                                                ? 'bg-red-50/40 text-slate-400'
                                                                : isItemApproved
                                                                ? 'bg-emerald-50/30'
                                                                : ''
                                                            }`}
                                                          >
                                                            {isPending && (
                                                              <td className="px-3 py-2 text-center">
                                                                <input
                                                                  type="checkbox"
                                                                  checked={isChecked}
                                                                  onChange={() => handleToggleSelectItem(po.id, itemKey)}
                                                                  className="w-4 h-4 text-rose-600 rounded border-slate-300 focus:ring-rose-500 cursor-pointer"
                                                                />
                                                              </td>
                                                            )}
                                                            <td className="px-3 py-2 font-mono font-bold text-slate-800">
                                                              {it.sku}
                                                            </td>
                                                            <td className="px-3 py-2">
                                                              <div className="font-bold text-slate-900">{it.itemName}</div>
                                                              <div className="text-[10px] text-slate-400">{it.category}</div>
                                                            </td>
                                                            <td className="px-3 py-2 text-center font-bold text-slate-800">
                                                              {it.qty}
                                                            </td>
                                                            <td className="px-3 py-2 text-center text-slate-600">
                                                              {it.unit}
                                                            </td>
                                                            <td className="px-3 py-2 text-right text-slate-700">
                                                              {formatRupiah(it.price)}
                                                            </td>
                                                            <td className="px-3 py-2 text-right font-black text-slate-900">
                                                              {formatRupiah(it.qty * it.price)}
                                                            </td>
                                                            <td className="px-3 py-2 text-center">
                                                              {isItemApproved ? (
                                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                                                  <Check className="w-3 h-3 text-emerald-600" />
                                                                  Disetujui
                                                                </span>
                                                              ) : isItemRejected ? (
                                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-red-100 text-red-800 border border-red-300">
                                                                  <Ban className="w-3 h-3 text-red-600" />
                                                                  Tidak Disetujui
                                                                </span>
                                                              ) : (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300">
                                                                  <Clock className="w-3 h-3 text-amber-600" />
                                                                  Menunggu Review
                                                                </span>
                                                              )}
                                                            </td>
                                                            {isPending && (
                                                              <td className="px-3 py-2 text-center">
                                                                <div className="inline-flex items-center gap-1">
                                                                  <button
                                                                    type="button"
                                                                    onClick={() => handleSingleItemDecision(po.id, it.sku, it.place, 'Approved')}
                                                                    className={`px-2 py-1 rounded-md text-[11px] font-bold transition flex items-center gap-1 cursor-pointer ${
                                                                      isItemApproved
                                                                        ? 'bg-emerald-600 text-white shadow-2xs'
                                                                        : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300'
                                                                    }`}
                                                                    title="Setujui item ini"
                                                                  >
                                                                    <Check className="w-3 h-3" />
                                                                    <span>Setujui</span>
                                                                  </button>
                                                                  <button
                                                                    type="button"
                                                                    onClick={() => handleSingleItemDecision(po.id, it.sku, it.place, 'Rejected')}
                                                                    className={`px-2 py-1 rounded-md text-[11px] font-bold transition flex items-center gap-1 cursor-pointer ${
                                                                      isItemRejected
                                                                        ? 'bg-red-600 text-white shadow-2xs'
                                                                        : 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-300'
                                                                    }`}
                                                                    title="Tolak item ini"
                                                                  >
                                                                    <Ban className="w-3 h-3" />
                                                                    <span>Tidak Disetujui</span>
                                                                  </button>
                                                                </div>
                                                              </td>
                                                            )}
                                                          </tr>
                                                        );
                                                      })}
                                                    </tbody>
                                                  </table>
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    )}

                                    {/* Ringkasan Rekap Keputusan Item */}
                                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                                      <div className="flex flex-wrap items-center gap-4">
                                        <div className="flex items-center gap-2">
                                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                                          <span className="text-slate-600">Disetujui:</span>
                                          <strong className="text-emerald-700">
                                            {approvedItems.length} item ({formatRupiah(approvedTotal)})
                                          </strong>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
                                          <span className="text-slate-600">Tidak Disetujui / Ditolak:</span>
                                          <strong className="text-red-700">
                                            {rejectedItems.length} item ({formatRupiah(rejectedTotal)})
                                          </strong>
                                        </div>
                                        {pendingDecisionItems.length > 0 && (
                                          <div className="flex items-center gap-2">
                                            <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                                            <span className="text-slate-600">Menunggu:</span>
                                            <strong className="text-amber-700">
                                              {pendingDecisionItems.length} item
                                            </strong>
                                          </div>
                                        )}
                                      </div>

                                      <div className="text-right">
                                        <span className="text-slate-500 mr-1.5 font-medium">Total Keseluruhan PO:</span>
                                        <span className="text-sm font-black text-slate-900">{formatRupiah(po.totalAmount)}</span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })()}

                              {/* Cost Control Decision & Approval Card */}
                              <div className="p-4 bg-slate-50 border-t border-slate-200">
                                {(() => {
                                  const rejectedItemsInPO = po.items.filter(
                                    (it) => it.approvalStatus === 'Rejected' || it.status === 'Rejected'
                                  );
                                  const hasRejectedInPO = rejectedItemsInPO.length > 0;
                                  const unapprovedItemsInPO = po.items.filter((it) => it.approvalStatus !== 'Approved');
                                  const allItemsApprovedInPO =
                                    po.items.length > 0 && po.items.every((it) => it.approvalStatus === 'Approved');

                                  return isPending ? (
                                    <div className="space-y-3">
                                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                                        <div>
                                          <h5 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                                            <ShieldCheck className="w-4 h-4 text-rose-600" />
                                            Form Persetujuan Cost Control (Otorisasi Total Pembelian)
                                          </h5>
                                          <p className="text-[11px] text-slate-500 mt-0.5">
                                            Sesuai ketentuan, <strong>jika terdapat item yang tidak disetujui, maka proses approve total tidak dapat dilakukan sampai semua item disetujui</strong>.
                                          </p>
                                        </div>
                                      </div>

                                      {/* Alert if any item is rejected */}
                                      {hasRejectedInPO && (
                                        <div className="bg-red-50 border-2 border-red-300 rounded-xl p-3.5 flex items-start gap-3 text-xs text-red-950 animate-in fade-in duration-150">
                                          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                                          <div className="space-y-1">
                                            <div className="font-extrabold text-sm text-red-900 flex items-center gap-2">
                                              <span>Proses Approve Dikunci</span>
                                              <span className="px-2 py-0.5 rounded-full text-[10px] bg-red-200 text-red-900 border border-red-300 font-bold">
                                                {rejectedItemsInPO.length} Item Tidak Disetujui
                                              </span>
                                            </div>
                                            <p className="text-red-800 leading-relaxed">
                                              Terdapat item yang berstatus <strong>Tidak Disetujui</strong> pada formulir ini. Tombol Approve Total dinonaktifkan sampai seluruh item disetujui atau diperbaiki oleh tim Purchasing di <strong>Vendor Summary</strong>.
                                            </p>
                                            <p className="text-[11px] text-red-700 font-semibold">
                                              Silakan klik tombol <strong>"Kembalikan ke Vendor Summary untuk Revisi"</strong> di bawah agar Purchasing dapat menyesuaikan Qty, Harga, atau memindahkan item ke vendor lain.
                                            </p>
                                          </div>
                                        </div>
                                      )}

                                      {/* Helper banner if items are still pending approval (not rejected) */}
                                      {!hasRejectedInPO && !allItemsApprovedInPO && (
                                        <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-950">
                                          <div className="flex items-center gap-2">
                                            <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                                            <span>
                                              Masih terdapat <strong>{unapprovedItemsInPO.length} item</strong> yang belum disetujui. Seluruh item harus disetujui terlebih dahulu untuk membuka tombol Approve Total.
                                            </span>
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const updates = po.items.map((it) => ({
                                                poId: po.id,
                                                sku: it.sku,
                                                place: it.place,
                                                status: 'Approved' as const,
                                              }));
                                              batchSetItemApprovalStatus(updates);
                                            }}
                                            className="shrink-0 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition shadow-2xs cursor-pointer flex items-center gap-1.5"
                                          >
                                            <CheckSquare className="w-3.5 h-3.5" />
                                            <span>Setujui Semua Item ({po.items.length})</span>
                                          </button>
                                        </div>
                                      )}

                                      {/* Optional Notes */}
                                      <div>
                                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                          Catatan / Keterangan Persetujuan Cost Control (Opsional):
                                        </label>
                                        <input
                                          type="text"
                                          value={inlineNotes[po.id] || ''}
                                          onChange={(e) =>
                                            setInlineNotes((prev) => ({ ...prev, [po.id]: e.target.value }))
                                          }
                                          placeholder="Contoh: Total pengajuan telah diverifikasi sesuai harga kontrak vendor & budget departemen..."
                                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-hidden"
                                        />
                                      </div>

                                      {/* Action Buttons */}
                                      <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                                        <button
                                          onClick={() => {
                                            setRejectingPO(po);
                                            setRejectionReason(
                                              hasRejectedInPO
                                                ? `Terdapat ${rejectedItemsInPO.length} item tidak disetujui oleh Cost Control. Mohon tim Purchasing lakukan revisi Qty, Harga, atau pilih vendor lain di Vendor Summary.`
                                                : ''
                                            );
                                          }}
                                          className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                                            hasRejectedInPO
                                              ? 'bg-red-600 hover:bg-red-700 text-white shadow-xs'
                                              : 'border border-red-300 hover:bg-red-50 text-red-700'
                                          }`}
                                        >
                                          {hasRejectedInPO ? (
                                            <ArrowLeftRight className="w-3.5 h-3.5" />
                                          ) : (
                                            <Ban className="w-3.5 h-3.5" />
                                          )}
                                          <span>
                                            {hasRejectedInPO
                                              ? `Kembalikan ke Vendor Summary untuk Revisi (${rejectedItemsInPO.length} Item Ditolak)`
                                              : 'Minta Revisi / Tolak Form'}
                                          </span>
                                        </button>

                                        <button
                                          disabled={hasRejectedInPO || !allItemsApprovedInPO}
                                          onClick={() => {
                                            if (hasRejectedInPO || !allItemsApprovedInPO) return;
                                            setApprovingPO(po);
                                            setApprovalNotes(inlineNotes[po.id] || '');
                                          }}
                                          className={`px-5 py-2.5 rounded-lg text-xs font-extrabold shadow-sm transition flex items-center gap-2 ${
                                            hasRejectedInPO || !allItemsApprovedInPO
                                              ? 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300'
                                              : 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer'
                                          }`}
                                          title={
                                            hasRejectedInPO
                                              ? `Approval dikunci: Terdapat ${rejectedItemsInPO.length} item tidak disetujui.`
                                              : !allItemsApprovedInPO
                                              ? `Belum semua item disetujui (${unapprovedItemsInPO.length} item pending).`
                                              : 'Setujui total pengajuan pembelian'
                                          }
                                        >
                                          {hasRejectedInPO ? (
                                            <Lock className="w-4 h-4 text-slate-400" />
                                          ) : (
                                            <CheckCircle2 className="w-4 h-4" />
                                          )}
                                          <span>Approve Total Pengajuan Pembelian ({formatRupiah(po.totalAmount)})</span>
                                        </button>
                                      </div>
                                    </div>
                                  ) : isApproved ? (
                                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-emerald-900">
                                    <div className="flex items-start gap-2.5">
                                      <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
                                      <div>
                                        <div className="font-bold text-sm">
                                          Form PO Ini Telah Disetujui oleh Cost Control
                                        </div>
                                        <p className="text-[11px] text-emerald-800 mt-0.5">
                                          Disetujui oleh <strong>{po.costControlApproval?.approvedBy || 'Cost Control PIC'}</strong> pada{' '}
                                          {po.costControlApproval?.approvedAt
                                            ? formatDate(po.costControlApproval.approvedAt.slice(0, 10))
                                            : formatDate(po.generatedDate)}
                                          . {po.costControlApproval?.notes && `Catatan: "${po.costControlApproval.notes}".`}
                                        </p>
                                        <p className="text-[11px] text-emerald-700 font-semibold mt-1">
                                          Status: Form PO Vendor sekarang telah disetujui dan siap untuk dilakukan <strong>Release to Vendor (Masuk ke Inbound)</strong>, <strong>Export to PDF</strong>, serta <strong>Email ke Alamat Email Vendor</strong> pada laman Purchasing &amp; Vendor.
                                        </p>
                                      </div>
                                    </div>

                                    <div className="shrink-0">
                                      <span className="px-3 py-1 bg-white border border-emerald-300 rounded-lg text-emerald-800 font-bold text-xs inline-flex items-center gap-1.5 shadow-2xs">
                                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                                        Approved ({formatRupiah(po.totalAmount)})
                                      </span>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-red-900">
                                    <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
                                    <div>
                                      <div className="font-bold text-sm">Pengajuan Telah Ditolak / Memerlukan Revisi</div>
                                      <p className="text-[11px] text-red-800 mt-0.5">
                                        Alasan:{' '}
                                        {po.costControlApproval?.notes || 'Koreksi harga / kuantitas barang oleh Purchasing.'}
                                      </p>
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Konfirmasi Approval Total Pengajuan Pembelian */}
      {approvingPO && (() => {
        const rejectedItems = approvingPO.items.filter(
          (it) => it.approvalStatus === 'Rejected' || it.status === 'Rejected'
        );
        const hasRejected = rejectedItems.length > 0;
        const unapprovedItems = approvingPO.items.filter((it) => it.approvalStatus !== 'Approved');
        const notAllApproved = unapprovedItems.length > 0;

        return (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200">
              <div className="flex items-center gap-3 text-emerald-600 mb-4">
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    hasRejected ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'
                  }`}
                >
                  {hasRejected ? <Lock className="w-7 h-7" /> : <CheckCircle2 className="w-7 h-7" />}
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    {hasRejected ? 'Approval Form PO Dikunci' : 'Konfirmasi Approval Pembelian'}
                  </h3>
                  <p className="text-xs text-slate-500">Persetujuan Otoritas Cost Control</p>
                </div>
              </div>

              {hasRejected ? (
                <div className="mb-4 p-3.5 bg-red-50 border border-red-300 rounded-xl text-xs text-red-900 space-y-2">
                  <div className="font-bold flex items-center gap-1.5 text-red-800">
                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                    <span>Terdapat {rejectedItems.length} Item Tidak Disetujui</span>
                  </div>
                  <p className="text-red-700 leading-relaxed">
                    Sesuai aturan alur Cost Control, <strong>jika terdapat salah satu item yang tidak disetujui, maka proses approve tidak bisa dilakukan sampai semua item disetujui</strong>.
                  </p>
                  <p className="text-slate-600">
                    Kembalikan pengajuan ke tim Purchasing agar dapat merevisi Qty, Harga, atau mengganti Vendor di Vendor Summary.
                  </p>
                </div>
              ) : notAllApproved ? (
                <div className="mb-4 p-3.5 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900">
                  <p className="font-bold">
                    Terdapat {unapprovedItems.length} item yang belum disetujui. Semua item harus berstatus disetujui sebelum otorisasi total diproses.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-slate-600 leading-relaxed">
                  Apakah Anda yakin ingin menyetujui total pengajuan pembelian untuk form{' '}
                  <strong className="text-slate-900 font-mono">{approvingPO.id}</strong>?
                </p>
              )}

              <div className="my-4 p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Nomor PO:</span>
                  <span className="font-mono font-bold text-slate-800">{approvingPO.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Jumlah Item:</span>
                  <span className="font-semibold text-slate-800">{approvingPO.items.length} Barang</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Nominal Pembelian:</span>
                  <span className="font-black text-emerald-700 text-sm">{formatRupiah(approvingPO.totalAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Approver:</span>
                  <span className="font-semibold text-slate-800">
                    {currentUser.username} ({currentUser.position})
                  </span>
                </div>
              </div>

              {!hasRejected && !notAllApproved && (
                <div className="mb-4">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Catatan Persetujuan:
                  </label>
                  <textarea
                    value={approvalNotes}
                    onChange={(e) => setApprovalNotes(e.target.value)}
                    rows={2}
                    placeholder="Catatan tambahan untuk tim Purchasing & Vendor..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs outline-hidden focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setApprovingPO(null)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  {hasRejected ? 'Tutup' : 'Batal'}
                </button>
                {hasRejected ? (
                  <button
                    type="button"
                    onClick={() => {
                      const poToReject = approvingPO;
                      setApprovingPO(null);
                      setRejectingPO(poToReject);
                      setRejectionReason(
                        `Terdapat ${rejectedItems.length} item tidak disetujui. Mohon tim Purchasing lakukan revisi Qty, Harga, atau ubah Vendor pada Vendor Summary.`
                      );
                    }}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <ArrowLeftRight className="w-3.5 h-3.5" />
                    <span>Kembalikan ke Vendor Summary</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={notAllApproved}
                    onClick={handleConfirmApproval}
                    className={`px-5 py-2 rounded-lg text-xs font-extrabold text-white shadow-md transition flex items-center gap-1.5 ${
                      notAllApproved
                        ? 'bg-slate-300 cursor-not-allowed'
                        : 'bg-emerald-600 hover:bg-emerald-700 cursor-pointer'
                    }`}
                  >
                    <Check className="w-4 h-4" />
                    Ya, Setujui Pengajuan Ini
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal Konfirmasi Penolakan / Minta Revisi */}
      {rejectingPO && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center">
                <Ban className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Minta Revisi / Tolak Pengajuan
                </h3>
                <p className="text-xs text-slate-500">Kembalikan ke Purchasing untuk Koreksi</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 mb-3">
              Masukkan alasan penolakan atau instruksi revisi untuk form{' '}
              <strong className="font-mono text-slate-900">{rejectingPO.id}</strong>:
            </p>

            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={3}
              placeholder="Contoh: Harga satuan daging melebihi pagu anggaran; tolong negosiasi ulang dengan vendor..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs outline-hidden focus:ring-2 focus:ring-red-500 mb-4"
            />

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setRejectingPO(null)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmRejection}
                className="px-4 py-2 rounded-lg text-xs font-bold bg-red-600 hover:bg-red-700 text-white shadow-md transition"
              >
                Kirim Permintaan Revisi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pop-up Modal Sukses */}
      <SuccessSubmitModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        title={successModalData.title}
        message={successModalData.message}
        details={successModalData.details}
      />
    </div>
  );
};
