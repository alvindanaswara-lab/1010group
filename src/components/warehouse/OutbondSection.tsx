import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { OutletOrder, OrderItem, ManualOutbondRecord, DEPARTMENTS, InventoryItem } from '../../types';
import { formatRupiah, exportOutletOrderToExcel } from '../../utils/excelExport';
import { exportSuratJalanToPDF } from '../../utils/pdfExport';
import { formatDate } from '../../utils/dateUtils';
import { scrollToTop } from '../../utils/scrollHelper';
import { SuccessSubmitModal, SuccessDetail } from '../common/SuccessSubmitModal';
import {
  downloadPROutletTemplate,
  parsePROutletFile,
  findInventoryItemBySku,
  PRParseResult,
} from '../../utils/prOutletTemplate';
import {
  ArrowUpFromLine,
  Truck,
  PackageMinus,
  FileCheck2,
  FileText,
  Send,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  Clock,
  X,
  PlusCircle,
  FileSpreadsheet,
  AlertCircle,
  Check,
  Eye,
  ChevronUp,
  Search,
  Calendar,
  ArrowUpDown,
  Filter,
  CheckCheck,
  ShieldCheck,
  SlidersHorizontal,
  AlertTriangle,
  ChevronDown,
  Store,
  Building2,
  Upload,
  Download,
  FileUp,
  CheckSquare,
  Square,
  Package,
} from 'lucide-react';

export const OutbondSection: React.FC = () => {
  const {
    outletOrders,
    bulkImportOutletOrders,
    deleteOutletOrder,
    deployOutletOrder,
    generateDeploymentPO,
    approveShipmentToPOTerkirim,
    finalApproveToOutbond,
    updateOrderItem,
    addOrderItem,
    deleteOrderItem,
    manualOutbondRecords,
    addManualOutbond,
    deleteManualOutbond,
    inventory,
    periodicInventories,
    selectedPeriod,
    outlets,
    currentUser,
  } = useApp();

  // Combined Master Inventory list prioritizing active period & current inventory
  const masterInventoryList = useMemo(() => {
    const map = new Map<string, InventoryItem>();
    Object.values(periodicInventories || {}).forEach((list) => {
      if (Array.isArray(list)) {
        list.forEach((it) => {
          if (it && it.sku) map.set(it.sku.trim().toUpperCase(), it);
        });
      }
    });
    const activePeriodList = (periodicInventories && periodicInventories[selectedPeriod]) || [];
    activePeriodList.forEach((it) => {
      if (it && it.sku) map.set(it.sku.trim().toUpperCase(), it);
    });
    inventory.forEach((it) => {
      if (it && it.sku) map.set(it.sku.trim().toUpperCase(), it);
    });
    return Array.from(map.values());
  }, [inventory, periodicInventories, selectedPeriod]);

  const isAdmin = currentUser.position === 'Administrator';
  const isStorageMailer = currentUser.position === 'Storage-Mailer';
  const [activeSubTab, setActiveSubTab] = useState<'deployment' | 'outcoming' | 'report'>('deployment');

  // State untuk konfirmasi hapus Form Outbond / Pesanan (Single & Bulk)
  const [orderToDelete, setOrderToDelete] = useState<OutletOrder | null>(null);
  const [ordersToBulkDelete, setOrdersToBulkDelete] = useState<OutletOrder[]>([]);
  const [showDeleteSelectorModal, setShowDeleteSelectorModal] = useState<boolean>(false);
  const [deleteSelectorSearch, setDeleteSelectorSearch] = useState<string>('');

  // State checkbox untuk memilih form pada Outbond > Deployment
  const [selectedDeployOrderIds, setSelectedDeployOrderIds] = useState<string[]>([]);

  // Upload Form PR State pada Outbond > Deployment
  const [showUploadPRModal, setShowUploadPRModal] = useState<boolean>(false);
  const [isUploadingPR, setIsUploadingPR] = useState<boolean>(false);
  const [uploadPRFile, setUploadPRFile] = useState<File | null>(null);
  const [uploadPRParseResult, setUploadPRParseResult] = useState<PRParseResult | null>(null);
  const [uploadPRError, setUploadPRError] = useState<string | null>(null);
  const [uploadPROverwrite, setUploadPROverwrite] = useState<boolean>(true);
  const [uploadActiveTab, setUploadActiveTab] = useState<'preview' | 'rows'>('preview');
  const fileInputPRRef = useRef<HTMLInputElement>(null);

  // State untuk konfirmasi hapus Manual Outbond Record (Khusus Administrator)
  const [manualRecordToDelete, setManualRecordToDelete] = useState<ManualOutbondRecord | null>(null);

  // Deployment active inspection modal / order (Kelola & Generate PO)
  const [activeDeploymentOrder, setActiveDeploymentOrder] = useState<OutletOrder | null>(null);

  // Review Modal 1: Siap Dikirim -> PO Terkirim
  const [reviewShipmentOrder, setReviewShipmentOrder] = useState<OutletOrder | null>(null);

  // Review Modal 2: PO Terkirim -> Selesai & Masuk Outbond
  const [finalApproveOrder, setFinalApproveOrder] = useState<OutletOrder | null>(null);

  // View Details Modal (Read-only)
  const [viewingDetailsOrder, setViewingDetailsOrder] = useState<OutletOrder | null>(null);

  // Form deployment yang dipilih untuk ditampilkan pada Preview Panel
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  // State untuk list option dropdown menu aksi form
  const [openActionMenuOrderId, setOpenActionMenuOrderId] = useState<string | null>(null);

  // State untuk menyimpan ID form yang baru saja disetujui pengirimannya pada tab Siap Dikirim agar tombol Export to PDF langsung muncul
  const [approvedInSiapDikirimIds, setApprovedInSiapDikirimIds] = useState<string[]>([]);

  // Filter & Search states for Deployment
  const [deployStatusFilter, setDeployStatusFilter] = useState<'all' | 'pending' | 'siap_dikirim' | 'po_terkirim' | 'selesai'>('all');
  const [deploySearchQuery, setDeploySearchQuery] = useState<string>('');
  const [deployDateFilter, setDeployDateFilter] = useState<string>('');
  const [deployDateSortOrder, setDeployDateSortOrder] = useState<'desc' | 'asc'>('desc');

  // Filter & Search states for Report Status
  const [reportSearchQuery, setReportSearchQuery] = useState<string>('');
  const [reportDateFilter, setReportDateFilter] = useState<string>('');
  const [reportDateSortOrder, setReportDateSortOrder] = useState<'desc' | 'asc'>('desc');
  const [expandedReportOrderId, setExpandedReportOrderId] = useState<string | null>(null);

  // Filtered & sorted deployment orders
  const filteredAndSortedDeployOrders = [...outletOrders]
    .filter((ord) => {
      const matchSearch =
        deploySearchQuery === '' ||
        ord.id.toLowerCase().includes(deploySearchQuery.toLowerCase()) ||
        ord.outletName.toLowerCase().includes(deploySearchQuery.toLowerCase()) ||
        ord.department.toLowerCase().includes(deploySearchQuery.toLowerCase()) ||
        ord.status.toLowerCase().includes(deploySearchQuery.toLowerCase());
      const matchDate = deployDateFilter === '' || ord.dateRequested === deployDateFilter;

      const matchStatusTab =
        deployStatusFilter === 'all'
          ? true
          : deployStatusFilter === 'pending'
          ? ord.status === 'Submitted' || ord.status === 'PO Generated' || ord.status === 'Processing Gudang' || ord.status === 'Draft'
          : deployStatusFilter === 'siap_dikirim'
          ? ord.status === 'Siap Dikirim' || (ord.status === 'PO Terkirim' && approvedInSiapDikirimIds.includes(ord.id))
          : deployStatusFilter === 'po_terkirim'
          ? ord.status === 'PO Terkirim'
          : ord.status === 'Selesai' || ord.status === 'Deployed / Dikirim' || ord.status === 'Diterima Lengkap';

      return matchSearch && matchDate && matchStatusTab;
    })
    .sort((a, b) => {
      const timeA = new Date(a.dateRequested).getTime();
      const timeB = new Date(b.dateRequested).getTime();
      return deployDateSortOrder === 'desc' ? timeB - timeA : timeA - timeB;
    });

  const activePreviewDeployOrder =
    filteredAndSortedDeployOrders.find((o) => o.id === expandedOrderId) ||
    filteredAndSortedDeployOrders.find(
      (o) =>
        selectedDeployOrderIds.length > 0 &&
        o.id === selectedDeployOrderIds[selectedDeployOrderIds.length - 1]
    ) ||
    filteredAndSortedDeployOrders.find((o) => selectedDeployOrderIds.includes(o.id)) ||
    filteredAndSortedDeployOrders[0] ||
    null;

  const toggleSelectDeployOrder = (orderId: string) => {
    const isCurrentlySelected = selectedDeployOrderIds.includes(orderId);
    const nextSelected = isCurrentlySelected
      ? selectedDeployOrderIds.filter((id) => id !== orderId)
      : [...selectedDeployOrderIds, orderId];

    setSelectedDeployOrderIds(nextSelected);

    if (!isCurrentlySelected) {
      setExpandedOrderId(orderId);
    } else if (expandedOrderId === orderId && nextSelected.length > 0) {
      setExpandedOrderId(nextSelected[nextSelected.length - 1]);
    }
  };

  const selectAllDeployOrders = () => {
    const allIds = filteredAndSortedDeployOrders.map((o) => o.id);
    setSelectedDeployOrderIds(allIds);
    if (allIds.length > 0 && (!expandedOrderId || !allIds.includes(expandedOrderId))) {
      setExpandedOrderId(allIds[0]);
    }
  };

  const deselectAllDeployOrders = () => {
    setSelectedDeployOrderIds([]);
  };

  // Filtered & sorted report orders
  const filteredAndSortedReportOrders = [...outletOrders]
    .filter((ord) => {
      const matchSearch =
        reportSearchQuery === '' ||
        ord.id.toLowerCase().includes(reportSearchQuery.toLowerCase()) ||
        ord.outletName.toLowerCase().includes(reportSearchQuery.toLowerCase()) ||
        ord.department.toLowerCase().includes(reportSearchQuery.toLowerCase()) ||
        ord.status.toLowerCase().includes(reportSearchQuery.toLowerCase());
      const matchDate = reportDateFilter === '' || ord.dateRequested === reportDateFilter;
      return matchSearch && matchDate;
    })
    .sort((a, b) => {
      const timeA = new Date(a.dateRequested).getTime();
      const timeB = new Date(b.dateRequested).getTime();
      return reportDateSortOrder === 'desc' ? timeB - timeA : timeA - timeB;
    });

  // Modals inside Deployment
  const [showAddItemModal, setShowAddItemModal] = useState<boolean>(false);
  const [selectedInventorySku, setSelectedInventorySku] = useState<string>(inventory[0]?.sku || '');
  const [addQty, setAddQty] = useState<number>(1);

  const [editingItem, setEditingItem] = useState<OrderItem | null>(null);
  const [editQty, setEditQty] = useState<number>(1);

  // Manual Outcoming Goods form state
  const [manualSku, setManualSku] = useState<string>(inventory[0]?.sku || '');
  const [outcomingSearchQuery, setOutcomingSearchQuery] = useState<string>('');
  const [isOutcomingDropdownOpen, setIsOutcomingDropdownOpen] = useState<boolean>(false);
  const outcomingDropdownRef = useRef<HTMLDivElement>(null);

  const [manualDate, setManualDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [manualOutlet, setManualOutlet] = useState<string>(() => outlets[0]?.namaOutlet || 'Resto Senopati');
  const [manualDepartment, setManualDepartment] = useState<string>('Kitchen');
  const [manualQty, setManualQty] = useState<number>(5);
  const [manualDestination, setManualDestination] = useState<string>('Spoilage / Basi / Kerusakan Fisik');
  const [manualNotes, setManualNotes] = useState<string>('');
  const [manualSuccessMsg, setManualSuccessMsg] = useState<string>('');

  // Close outcoming dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (outcomingDropdownRef.current && !outcomingDropdownRef.current.contains(e.target as Node)) {
        setIsOutcomingDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOutcomingItem = inventory.find((i) => i.sku === manualSku) || null;
  const filteredOutcomingSearchItems = inventory.filter((item) => {
    if (!outcomingSearchQuery.trim()) return true;
    const q = outcomingSearchQuery.toLowerCase();
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
    onExportPDF?: () => void;
    exportPDFText?: string;
  }>({
    title: 'Data Telah Berhasil Di-input!',
    message: '',
    details: [],
  });

  // 1. Generate Deployment PO -> Status: 'Siap Dikirim' (Mendukung Pengiriman Sebagian)
  const handleGenerateDeployment = (order: OutletOrder, forceFullShipment: boolean = false) => {
    const totalItems = order.items.length;
    const preparedItems = order.items.filter((it) => (it.qtyPrepared || 0) > 0);

    if (preparedItems.length === 0) {
      alert('Mohon isi kolom "Qty Disiapkan" minimal untuk 1 barang yang siap dikirim, atau klik tombol "Penuhi Semua".');
      return;
    }

    const res = generateDeploymentPO(order.id, order.items, !forceFullShipment);
    if (!res.success) {
      alert(res.message);
      return;
    }

    setActiveDeploymentOrder(null);

    if (res.isPartial) {
      setSuccessModalData({
        title: 'Pengiriman Sebagian (Parsial) Berhasil!',
        message: `Sebagian barang yang sudah disiapkan (${res.shippedCount} jenis barang) telah resmi masuk ke proses '2. Siap Dikirim'. Sisa barang yang belum ada (${res.remainingCount} jenis barang) tetap tinggal di proses '1. Perlu Dikelola' untuk dipenuhi berikutnya saat stok tersedia.`,
        details: [
          { label: 'Nomor Form Dikirim', value: order.id },
          { label: 'Status Pengiriman', value: '2. Siap Dikirim (Sebagian)' },
          { label: 'Nomor Form Sisa (Credit)', value: res.remainingOrderId || '-' },
          { label: 'Status Form Sisa', value: '1. Perlu Dikelola (Menunggu Stok)' },
          { label: 'Outlet Tujuan', value: order.outletName },
          { label: 'Department', value: order.department },
          { label: 'Barang Dikirim Sekarang', value: `${res.shippedCount} jenis barang` },
          { label: 'Barang Sisa di Perlu Dikelola', value: `${res.remainingCount} jenis barang` },
          { label: 'Petugas Pengelola', value: currentUser.username },
        ],
      });
    } else {
      setSuccessModalData({
        title: 'Form PO Berhasil Di-generate!',
        message: `Form PO (${order.id}) telah berhasil dikelola 100% lengkap dan siap dikirim. Silakan tinjau dan setujui pengiriman di proses '2. Siap Dikirim'.`,
        details: [
          { label: 'Nomor Form ID', value: order.id },
          { label: 'Outlet Tujuan', value: order.outletName },
          { label: 'Department', value: order.department },
          { label: 'Total Item Barang', value: `${totalItems} jenis barang (100% Lengkap)` },
          { label: 'Status Baru', value: '2. Siap Dikirim' },
          { label: 'Petugas Pengelola', value: currentUser.username },
        ],
      });
    }
    setShowSuccessModal(true);
    scrollToTop();
  };

  // 2. Persetujuan Pertama: Status 'Siap Dikirim' -> 'PO Terkirim' (Hanya Administrator)
  const handleApproveToPOTerkirim = (order: OutletOrder) => {
    if (!isAdmin) {
      return;
    }
    const res = approveShipmentToPOTerkirim(order.id);
    if (res && !res.success) {
      return;
    }
    setApprovedInSiapDikirimIds((prev) => (prev.includes(order.id) ? prev : [...prev, order.id]));
    setExpandedOrderId(order.id);
    setReviewShipmentOrder(null);

    const approvedOrderSnapshot: OutletOrder = {
      ...order,
      status: 'PO Terkirim',
    };

    setSuccessModalData({
      title: 'Persetujuan Pengiriman Berhasil!',
      message: `Form PO (${order.id}) telah ditinjau dan disetujui oleh Administrator. Status formulir kini resmi berganti menjadi 'PO Terkirim'. Anda dapat langsung mengunduh dokumen Surat Jalan (PDF) di bawah ini atau pada panel Siap Dikirim / PO Terkirim.`,
      details: [
        { label: 'Nomor Form ID', value: order.id },
        { label: 'Outlet Tujuan', value: order.outletName },
        { label: 'Department', value: order.department },
        { label: 'Status Baru', value: 'PO Terkirim (Disetujui Administrator)' },
        { label: 'Ditinjau & Disetujui Oleh', value: `${currentUser.username} (${currentUser.position})` },
        { label: 'Tanggal Persetujuan', value: formatDate(new Date().toISOString().slice(0, 10)) },
      ],
      onExportPDF: () => exportSuratJalanToPDF(approvedOrderSnapshot, masterInventoryList),
      exportPDFText: 'Export to PDF (Surat Jalan)',
    });
    setShowSuccessModal(true);
    scrollToTop();
  };

  // 3. Persetujuan Kedua (Akhir): Status 'PO Terkirim' -> Selesai & Masuk Outbond (Stok Terpotong)
  const handleFinalApproveToOutbond = (order: OutletOrder) => {
    finalApproveToOutbond(order.id);
    setFinalApproveOrder(null);

    setSuccessModalData({
      title: 'Form PO Selesai & Resmi Masuk Outbond!',
      message: `Form PO (${order.id}) telah selesai ditinjau dan disetujui kembali. Seluruh barang telah resmi dicatat sebagai data keluar pada Master Inventory (Outbond)!`,
      details: [
        { label: 'Nomor Form ID', value: order.id },
        { label: 'Outlet Tujuan', value: order.outletName },
        { label: 'Department', value: order.department },
        { label: 'Status Akhir', value: 'Selesai (Outbond)' },
        { label: 'Total Barang Keluar', value: `${order.items.length} jenis barang` },
        { label: 'Total Nilai Outbond', value: formatRupiah(order.totalAmount) },
        { label: 'Penyetuju Akhir', value: currentUser.username },
      ],
    });
    setShowSuccessModal(true);
    scrollToTop();
  };

  const handlePRFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadPRFile(file);
    setIsUploadingPR(true);
    setUploadPRError(null);
    setUploadPRParseResult(null);

    try {
      const result = await parsePROutletFile(file, masterInventoryList);
      setUploadPRParseResult(result);
      if (result.orders.length === 0) {
        setUploadPRError('Tidak ditemukan data form PR yang valid dalam file Excel tersebut.');
      }
    } catch (err: any) {
      setUploadPRError(err.message || 'Gagal memproses file template PR.');
    } finally {
      setIsUploadingPR(false);
    }
  };

  const handleConfirmUploadPR = () => {
    if (!uploadPRParseResult || uploadPRParseResult.orders.length === 0) return;

    bulkImportOutletOrders(uploadPRParseResult.orders, uploadPROverwrite);
    if (uploadPRParseResult.orders[0]?.id) {
      setExpandedOrderId(uploadPRParseResult.orders[0].id);
    }
    setShowUploadPRModal(false);

    const outletNamesList = Array.from(
      new Set(uploadPRParseResult.orders.map((o) => o.outletName))
    ).join(', ');

    const totalItemsCount = uploadPRParseResult.orders.reduce(
      (sum, ord) => sum + ord.items.length,
      0
    );

    const totalAmountSum = uploadPRParseResult.orders.reduce(
      (sum, ord) => sum + ord.totalAmount,
      0
    );

    setSuccessModalData({
      title: 'Form PR Outlet Berhasil Di-upload!',
      message: `Sebanyak ${uploadPRParseResult.orders.length} Formulir PR Outlet berhasil diimpor ke sistem. Form ini otomatis aktif pada Outbond > Deployment dan Purchase Request > PR Outlet.`,
      details: [
        { label: 'Nama File', value: uploadPRParseResult.fileName },
        { label: 'Total Form PR', value: `${uploadPRParseResult.orders.length} formulir` },
        { label: 'Outlet Terkait', value: outletNamesList },
        { label: 'Total Item Barang', value: `${totalItemsCount} item pesanan` },
        { label: 'Total Estimasi Nilai', value: formatRupiah(totalAmountSum) },
        { label: 'Status Dokumen', value: 'Submitted (Aktif di Outbond Deployment & PR)' },
        { label: 'Diunggah Oleh', value: `${currentUser.username} (${currentUser.position})` },
      ],
    });
    setShowSuccessModal(true);
    scrollToTop();
  };

  // Trigger Hapus dari tombol sebaris Upload Form PR
  const handleTriggerToolbarDelete = () => {
    if (selectedDeployOrderIds.length > 0) {
      const selectedOrders = outletOrders.filter((o) => selectedDeployOrderIds.includes(o.id));
      if (selectedOrders.length === 1) {
        setOrderToDelete(selectedOrders[0]);
      } else if (selectedOrders.length > 1) {
        setOrdersToBulkDelete(selectedOrders);
      }
      return;
    }
    if (activePreviewDeployOrder) {
      setOrderToDelete(activePreviewDeployOrder);
    }
  };

  // Handle Konfirmasi Hapus Form Outbond (Single atau Bulk)
  const handleConfirmDeleteOrder = () => {
    if (ordersToBulkDelete.length > 0) {
      const count = ordersToBulkDelete.length;
      const ids = ordersToBulkDelete.map((o) => o.id);
      const outletsList = Array.from(new Set(ordersToBulkDelete.map((o) => o.outletName))).join(', ');

      ids.forEach((id) => deleteOutletOrder(id));
      setSelectedDeployOrderIds((prev) => prev.filter((id) => !ids.includes(id)));
      if (expandedOrderId && ids.includes(expandedOrderId)) setExpandedOrderId(null);
      if (expandedReportOrderId && ids.includes(expandedReportOrderId)) setExpandedReportOrderId(null);
      if (activeDeploymentOrder && ids.includes(activeDeploymentOrder.id)) setActiveDeploymentOrder(null);
      if (reviewShipmentOrder && ids.includes(reviewShipmentOrder.id)) setReviewShipmentOrder(null);
      if (finalApproveOrder && ids.includes(finalApproveOrder.id)) setFinalApproveOrder(null);
      if (viewingDetailsOrder && ids.includes(viewingDetailsOrder.id)) setViewingDetailsOrder(null);

      setOrdersToBulkDelete([]);

      setSuccessModalData({
        title: 'Form Outbond Berhasil Dihapus!',
        message: `Sebanyak ${count} Form Outbond / Deployment yang dipilih telah berhasil dihapus dari sistem.`,
        details: [
          { label: 'Jumlah Form Dihapus', value: `${count} formulir` },
          { label: 'Outlet Terkait', value: outletsList },
          { label: 'Dihapus Oleh', value: `${currentUser.username} (${currentUser.position})` },
          { label: 'Waktu Penghapusan', value: formatDate(new Date().toISOString().slice(0, 10)) },
        ],
      });
      setShowSuccessModal(true);
      scrollToTop();
      return;
    }

    if (!orderToDelete) return;
    const deletedId = orderToDelete.id;
    const deletedOutlet = orderToDelete.outletName;
    const deletedDept = orderToDelete.department;
    const deletedAmount = orderToDelete.totalAmount;
    const deletedItemsCount = orderToDelete.items.length;
    const deletedStatus = orderToDelete.status;

    deleteOutletOrder(orderToDelete.id);
    setSelectedDeployOrderIds((prev) => prev.filter((id) => id !== deletedId));

    // Reset expanded order and any open modal if it references the deleted order
    if (expandedOrderId === deletedId) setExpandedOrderId(null);
    if (expandedReportOrderId === deletedId) setExpandedReportOrderId(null);
    if (activeDeploymentOrder?.id === deletedId) setActiveDeploymentOrder(null);
    if (reviewShipmentOrder?.id === deletedId) setReviewShipmentOrder(null);
    if (finalApproveOrder?.id === deletedId) setFinalApproveOrder(null);
    if (viewingDetailsOrder?.id === deletedId) setViewingDetailsOrder(null);

    setOrderToDelete(null);

    // Success popup modal
    setSuccessModalData({
      title: 'Form Outbond Berhasil Dihapus!',
      message: `Form Outbond / Pengiriman (${deletedId}) dari ${deletedOutlet} (${deletedDept}) telah berhasil dihapus secara permanen dari sistem.`,
      details: [
        { label: 'Nomor Form', value: deletedId },
        { label: 'Outlet & Departemen', value: `${deletedOutlet} • ${deletedDept}` },
        { label: 'Status Saat Dihapus', value: deletedStatus },
        { label: 'Jumlah Item', value: `${deletedItemsCount} jenis barang` },
        { label: 'Total Nilai Form', value: formatRupiah(deletedAmount) },
        { label: 'Dihapus Oleh', value: `${currentUser.username} (${currentUser.position})` },
        { label: 'Waktu Penghapusan', value: formatDate(new Date().toISOString().slice(0, 10)) },
      ],
    });
    setShowSuccessModal(true);
    scrollToTop();
  };

  // Handle Konfirmasi Hapus Manual Outbond (Khusus Administrator)
  const handleConfirmDeleteManualOutbond = () => {
    if (!manualRecordToDelete) return;
    const deleted = manualRecordToDelete;
    deleteManualOutbond(deleted.id);
    setManualRecordToDelete(null);

    setSuccessModalData({
      title: 'Data Outbond Manual Berhasil Dihapus!',
      message: `Catatan pengeluaran barang manual (${deleted.itemName} - ${deleted.qty} ${deleted.unit}) telah berhasil dihapus dari sistem.`,
      details: [
        { label: 'ID Transaksi', value: deleted.id },
        { label: 'Nama Barang', value: `${deleted.itemName} (${deleted.sku})` },
        { label: 'Jumlah Keluar', value: `${deleted.qty} ${deleted.unit}` },
        { label: 'Tujuan Pengeluaran', value: deleted.destination },
        { label: 'Dihapus Oleh', value: `${currentUser.username} (${currentUser.position})` },
      ],
    });
    setShowSuccessModal(true);
    scrollToTop();
  };

  // Handle Add Item to Order in Deployment
  const handleAddOrderItemInDeployment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDeploymentOrder) return;
    const invItem = inventory.find((i) => i.sku === selectedInventorySku);
    if (!invItem) return;

    const unitPrice =
      invItem.priceBudget !== undefined && invItem.priceBudget > 0
        ? invItem.priceBudget
        : invItem.price;
    const newItem: OrderItem = {
      sku: invItem.sku,
      itemName: invItem.itemName,
      category: invItem.category,
      qty: addQty,
      qtyPrepared: activeDeploymentOrder.status === 'PO Terkirim' ? addQty : undefined,
      unit: invItem.unit,
      price: unitPrice,
      subtotal: addQty * unitPrice,
    };

    addOrderItem(activeDeploymentOrder.id, newItem);

    setActiveDeploymentOrder((prev) => {
      if (!prev) return null;
      const existingIdx = prev.items.findIndex((i) => i.sku === newItem.sku);
      const nextItems =
        existingIdx >= 0
          ? prev.items.map((it, idx) =>
              idx === existingIdx
                ? {
                    ...it,
                    qty: it.qty + addQty,
                    qtyPrepared:
                      prev.status === 'PO Terkirim'
                        ? (it.qtyPrepared ?? it.qty) + addQty
                        : it.qtyPrepared,
                    subtotal: (it.qty + addQty) * it.price,
                  }
                : it
            )
          : [...prev.items, newItem];
      return {
        ...prev,
        items: nextItems,
        totalAmount: nextItems.reduce((sum, i) => sum + i.subtotal, 0),
      };
    });

    setShowAddItemModal(false);
    setAddQty(1);
  };

  // Handle Edit Item in Deployment
  const handleSaveEditItemInDeployment = () => {
    if (!activeDeploymentOrder || !editingItem) return;
    updateOrderItem(activeDeploymentOrder.id, {
      ...editingItem,
      qty: editQty,
      subtotal: editQty * editingItem.price,
    });
    setEditingItem(null);
  };

  // Handle Delete Item in Deployment
  const handleDeleteItemInDeployment = (sku: string) => {
    if (!activeDeploymentOrder) return;
    deleteOrderItem(activeDeploymentOrder.id, sku);
    setActiveDeploymentOrder((prev) =>
      prev
        ? {
            ...prev,
            items: prev.items.filter((i) => i.sku !== sku),
            totalAmount: prev.items
              .filter((i) => i.sku !== sku)
              .reduce((sum, i) => sum + i.subtotal, 0),
          }
        : null
    );
  };

  // Handle Perubahan Qty Dipesan secara Bebas (Field Bebas) di Deployment
  const handleDirectUpdateDeploymentQty = (sku: string, newQty: number) => {
    if (!activeDeploymentOrder) return;
    const item = activeDeploymentOrder.items.find((i) => i.sku === sku);
    if (!item) return;
    const safeQty = Math.max(0, newQty);
    const updatedItem: OrderItem = {
      ...item,
      qty: safeQty,
      subtotal: safeQty * item.price,
    };
    updateOrderItem(activeDeploymentOrder.id, updatedItem);
    setActiveDeploymentOrder((prev) =>
      prev
        ? {
            ...prev,
            items: prev.items.map((i) => (i.sku === sku ? updatedItem : i)),
            totalAmount: prev.items
              .map((i) => (i.sku === sku ? updatedItem : i))
              .reduce((sum, i) => sum + i.subtotal, 0),
          }
        : null
    );
  };

  // Handle Perubahan Qty Disiapkan di Deployment
  const handleDirectUpdatePreparedQty = (sku: string, newPreparedQty: number | undefined) => {
    if (!activeDeploymentOrder) return;
    const item = activeDeploymentOrder.items.find((i) => i.sku === sku);
    if (!item) return;
    const safePrepared =
      newPreparedQty === undefined || newPreparedQty === null
        ? undefined
        : Math.max(0, newPreparedQty);
    const updatedItem: OrderItem = {
      ...item,
      qtyPrepared: safePrepared,
    };
    updateOrderItem(activeDeploymentOrder.id, updatedItem);
    setActiveDeploymentOrder((prev) =>
      prev
        ? {
            ...prev,
            items: prev.items.map((i) => (i.sku === sku ? updatedItem : i)),
          }
        : null
    );
  };

  // Helper: Isi seluruh Qty Disiapkan = Qty Dipesan (Otomatis Terpenuhi Semua)
  const handleAutoPrepareAll = () => {
    if (!activeDeploymentOrder) return;
    const updatedItems: OrderItem[] = activeDeploymentOrder.items.map((it) => ({
      ...it,
      qtyPrepared: it.qty,
    }));
    updatedItems.forEach((it) => {
      updateOrderItem(activeDeploymentOrder.id, it);
    });
    setActiveDeploymentOrder((prev) =>
      prev
        ? {
            ...prev,
            items: updatedItems,
          }
        : null
    );
  };

  // Helper: Kosongkan seluruh Qty Disiapkan menjadi kosong (undefined)
  const handleResetAllPrepared = () => {
    if (!activeDeploymentOrder) return;
    const updatedItems: OrderItem[] = activeDeploymentOrder.items.map((it) => ({
      ...it,
      qtyPrepared: undefined,
    }));
    updatedItems.forEach((it) => {
      updateOrderItem(activeDeploymentOrder.id, it);
    });
    setActiveDeploymentOrder((prev) =>
      prev
        ? {
            ...prev,
            items: updatedItems,
          }
        : null
    );
  };

  // Manual Outcoming Goods submit
  const handleManualOutbondSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const item = inventory.find((i) => i.sku === manualSku);
    if (!item) {
      alert('Harap cari dan pilih barang dari Master Inventory terlebih dahulu.');
      return;
    }

    const submittedQty = manualQty;
    const submittedDate = manualDate || new Date().toISOString().slice(0, 10);
    const submittedOutlet = manualOutlet;
    const submittedDept = manualDepartment;
    const submittedReason = manualDestination;
    const submittedNotes = manualNotes;

    const fullDestination = `${submittedOutlet} • ${submittedDept} (${submittedReason})`;

    addManualOutbond({
      sku: item.sku,
      itemName: item.itemName,
      category: item.category,
      qty: submittedQty,
      unit: item.unit,
      outletName: submittedOutlet,
      department: submittedDept,
      destination: fullDestination,
      date: submittedDate,
      dispatchedBy: currentUser.username,
      notes: submittedNotes,
    });

    // Pop-up sukses manual outbond
    setSuccessModalData({
      title: 'Pengeluaran Barang Berhasil Dicatat!',
      message: `Pengeluaran barang manual (${submittedQty} ${item.unit} ${item.itemName}) berhasil dicatat dan memotong stok Outbond di Master Inventory.`,
      details: [
        { label: 'Tanggal Keluar', value: formatDate(submittedDate) },
        { label: 'SKU Barang', value: item.sku },
        { label: 'Nama Barang', value: item.itemName },
        { label: 'Kategori', value: item.category },
        { label: 'Jumlah Keluar', value: `${submittedQty} ${item.unit}` },
        { label: 'Outlet Pengguna', value: submittedOutlet },
        { label: 'Departemen', value: submittedDept },
        { label: 'Alasan / Tujuan', value: submittedReason },
        { label: 'Petugas Pengirim', value: currentUser.username },
        { label: 'Catatan', value: submittedNotes || '-' },
      ],
    });
    setShowSuccessModal(true);

    // Bersihkan formulir
    setManualNotes('');
    scrollToTop();
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <ArrowUpFromLine className="w-6 h-6 text-rose-600" />
            Manajemen Outbond (Pengeluaran Barang & Deployment)
          </h1>
          <p className="text-xs text-slate-500">
            Kirim pesanan bahan baku ke Outlet, kelola pengeluaran barang manual, dan monitor status pengiriman.
          </p>
        </div>

        {/* Sub-tabs (if user is Storage-Mailer, only deployment is shown) */}
        {!isStorageMailer && (
          <div className="flex items-center gap-1.5 bg-slate-200/70 p-1 rounded-xl">
            <button
              onClick={() => setActiveSubTab('deployment')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeSubTab === 'deployment'
                  ? 'bg-white text-rose-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Truck className="w-3.5 h-3.5" />
              Deployment ({outletOrders.length})
            </button>
            <button
              onClick={() => setActiveSubTab('outcoming')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeSubTab === 'outcoming'
                  ? 'bg-white text-rose-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <PackageMinus className="w-3.5 h-3.5" />
              Outcoming Goods
            </button>
            <button
              onClick={() => setActiveSubTab('report')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeSubTab === 'report'
                  ? 'bg-white text-rose-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileCheck2 className="w-3.5 h-3.5" />
              Report Status
            </button>
          </div>
        )}
      </div>

      {/* 1. Subtab: Deployment */}
      {(activeSubTab === 'deployment' || isStorageMailer) && (
        <div className="space-y-4">
          {/* Alur Banner 3-Step */}
          <div className="bg-gradient-to-r from-rose-50 via-amber-50 to-emerald-50 border border-slate-200 rounded-xl p-4 shadow-2xs space-y-2.5">
            <div className="flex items-center gap-2 text-rose-950 font-black text-xs sm:text-sm">
              <Truck className="w-5 h-5 text-rose-600" />
              <span>Alur Generate PO & Pengeluaran Barang (Deployment):</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="bg-white/90 p-3 rounded-xl border border-amber-200 shadow-2xs">
                <div className="flex items-center gap-1.5 font-bold text-amber-900 mb-1">
                  <span className="w-5 h-5 rounded-full bg-amber-600 text-white flex items-center justify-center text-[11px] font-black shrink-0">1</span>
                  Kelola & Generate PO
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Petugas gudang mengelola barang pesanan, lalu klik <strong>Generate PO (Siap Dikirim)</strong>. Status berubah menjadi <strong>'Siap Dikirim'</strong>.
                </p>
              </div>

              <div className="bg-white/90 p-3 rounded-xl border border-blue-200 shadow-2xs">
                <div className="flex items-center gap-1.5 font-bold text-blue-900 mb-1">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[11px] font-black shrink-0">2</span>
                  Tinjau & Setujui Pengiriman
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Form berstatus <strong>'Siap Dikirim'</strong> ditinjau dan disetujui. Setelah disetujui, status resmi berganti menjadi <strong>'PO Terkirim'</strong>.
                </p>
              </div>

              <div className="bg-white/90 p-3 rounded-xl border border-emerald-200 shadow-2xs">
                <div className="flex items-center gap-1.5 font-bold text-emerald-900 mb-1">
                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[11px] font-black shrink-0">3</span>
                  Persetujuan Akhir & Outbond
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Form <strong>'PO Terkirim'</strong> ditinjau & disetujui kembali. Form dinyatakan <strong>Selesai</strong> dan seluruh barang otomatis terpotong masuk ke <strong>Outbond</strong>.
                </p>
              </div>
            </div>
          </div>

          {/* Action Bar: Template PR, Upload Form PR, Hapus (Sebaris), dan Pilih Semua */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Truck className="w-4 h-4 text-rose-600" />
                Daftar Form Deployment (Pengiriman ke Outlet)
              </h2>
              <p className="text-xs text-slate-500">
                Pilih thumbnail form di sebelah kiri untuk melihat rincian dan memproses pengiriman di panel kanan.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Download Template PR */}
              <button
                type="button"
                onClick={() => downloadPROutletTemplate(inventory, outlets)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-bold transition shadow-2xs cursor-pointer"
                title="Download template format Excel Form PR Outlet resmi beserta referensi master barang"
              >
                <Download className="w-3.5 h-3.5 text-emerald-700" />
                <span>Template PR</span>
              </button>

              {/* Upload Form PR */}
              <button
                type="button"
                onClick={() => {
                  setUploadPRFile(null);
                  setUploadPRParseResult(null);
                  setUploadPRError(null);
                  setShowUploadPRModal(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow-2xs cursor-pointer"
                title="Upload file Excel Form PR Outlet yang akan langsung masuk ke Outbond Deployment & PR Outlet"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Form PR</span>
              </button>

              {/* Tombol Hapus sebaris dengan Upload Form PR */}
              <button
                type="button"
                onClick={handleTriggerToolbarDelete}
                disabled={selectedDeployOrderIds.length === 0 && !activePreviewDeployOrder}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-2xs border ${
                  selectedDeployOrderIds.length > 0 || activePreviewDeployOrder
                    ? 'bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border-rose-300 hover:border-rose-600 cursor-pointer'
                    : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                }`}
                title={
                  selectedDeployOrderIds.length > 0
                    ? `Hapus ${selectedDeployOrderIds.length} form deployment yang dicentang`
                    : 'Hapus form deployment yang sedang ditampilkan pada preview panel'
                }
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>
                  {selectedDeployOrderIds.length > 0 ? `Hapus (${selectedDeployOrderIds.length})` : 'Hapus'}
                </span>
              </button>

              <div className="h-5 w-px bg-slate-300 hidden sm:block mx-0.5" />

              <button
                type="button"
                onClick={selectAllDeployOrders}
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Pilih Semua
              </button>
              {selectedDeployOrderIds.length > 0 && (
                <button
                  type="button"
                  onClick={deselectAllDeployOrders}
                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Batal Pilih
                </button>
              )}
            </div>
          </div>

          {/* Quick Filter by Workflow Stage */}
          <div className="flex flex-wrap gap-1.5 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
            <button
              onClick={() => setDeployStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                deployStatusFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Semua ({outletOrders.length})
            </button>
            <button
              onClick={() => setDeployStatusFilter('pending')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                deployStatusFilter === 'pending'
                  ? 'bg-white text-rose-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-rose-600" />
              1. Perlu Dikelola ({outletOrders.filter((o) => o.status === 'Submitted' || o.status === 'PO Generated' || o.status === 'Processing Gudang' || o.status === 'Draft').length})
            </button>
            <button
              onClick={() => setDeployStatusFilter('siap_dikirim')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                deployStatusFilter === 'siap_dikirim'
                  ? 'bg-white text-amber-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-amber-600" />
              2. Siap Dikirim ({outletOrders.filter((o) => o.status === 'Siap Dikirim').length})
            </button>
            <button
              onClick={() => setDeployStatusFilter('po_terkirim')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                deployStatusFilter === 'po_terkirim'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Truck className="w-3.5 h-3.5 text-blue-600" />
              3. PO Terkirim ({outletOrders.filter((o) => o.status === 'PO Terkirim').length})
            </button>
            <button
              onClick={() => setDeployStatusFilter('selesai')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                deployStatusFilter === 'selesai'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
              4. Selesai (Outbond) ({outletOrders.filter((o) => o.status === 'Selesai' || o.status === 'Deployed / Dikirim' || o.status === 'Diterima Lengkap').length})
            </button>
          </div>

          {/* Deployment Split Preview Panel Container */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            {/* Search & Filter Toolbar for Deployment */}
            <div className="p-3 bg-slate-50/90 border-b border-slate-200 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 text-xs">
              {/* Search Bar */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={deploySearchQuery}
                  onChange={(e) => setDeploySearchQuery(e.target.value)}
                  placeholder="Cari Form ID, Outlet Name, Department, atau Status..."
                  className="w-full pl-9 pr-8 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-hidden"
                />
                {deploySearchQuery && (
                  <button
                    onClick={() => setDeploySearchQuery('')}
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
                    value={deployDateFilter}
                    onChange={(e) => setDeployDateFilter(e.target.value)}
                    className="text-xs text-slate-700 bg-transparent outline-hidden font-medium"
                  />
                  {deployDateFilter && (
                    <button
                      onClick={() => setDeployDateFilter('')}
                      className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-semibold ml-1"
                      title="Tampilkan semua tanggal"
                    >
                      Semua
                    </button>
                  )}
                </div>

                {/* Urutkan Tanggal */}
                <button
                  onClick={() => setDeployDateSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg font-semibold transition shadow-2xs cursor-pointer"
                  title="Urutkan berdasarkan tanggal permintaan"
                >
                  <ArrowUpDown className="w-3.5 h-3.5 text-rose-600" />
                  <span>Urutkan: {deployDateSortOrder === 'desc' ? 'Terbaru' : 'Terlama'}</span>
                </button>
              </div>
            </div>

            {openActionMenuOrderId && (
              <div
                className="fixed inset-0 z-30 bg-transparent"
                onClick={() => setOpenActionMenuOrderId(null)}
              />
            )}

            {filteredAndSortedDeployOrders.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <Truck className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                <p className="text-sm font-semibold text-slate-600">
                  {outletOrders.length === 0
                    ? 'Belum ada form pesanan dari Outlet.'
                    : 'Tidak ada form deployment yang sesuai dengan filter tanggal, status, atau pencarian.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[520px]">
                {/* LEFT PANEL: Thumbnail List (Outlet Name, Department & Tanggal sebagai icon kecil) */}
                <div className="lg:col-span-4 border-b lg:border-b-0 lg:border-r border-slate-200 bg-slate-50/60 flex flex-col">
                  <div className="px-3.5 py-2.5 border-b border-slate-200/80 bg-slate-100/70 flex items-center justify-between text-[11px] font-bold text-slate-600">
                    <span>Daftar Form Deployment ({filteredAndSortedDeployOrders.length})</span>
                    {selectedDeployOrderIds.length > 0 && (
                      <span className="text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full text-[10px]">
                        {selectedDeployOrderIds.length} dipilih
                      </span>
                    )}
                  </div>

                  <div className="p-2.5 space-y-2 max-h-[620px] overflow-y-auto flex-1">
                    {filteredAndSortedDeployOrders.map((order) => {
                      const isSelected = selectedDeployOrderIds.includes(order.id);
                      const isActivePreview = activePreviewDeployOrder?.id === order.id;
                      const isMenuOpen = openActionMenuOrderId === order.id;

                      const isSiapDikirim = order.status === 'Siap Dikirim';
                      const isPOTerkirim = order.status === 'PO Terkirim';
                      const isSelesai =
                        order.status === 'Selesai' ||
                        order.status === 'Deployed / Dikirim' ||
                        order.status === 'Diterima Lengkap';
                      const isPendingManage = !isSiapDikirim && !isPOTerkirim && !isSelesai;

                      return (
                        <div
                          key={order.id}
                          onClick={() => setExpandedOrderId(order.id)}
                          className={`group relative rounded-xl p-2.5 border transition cursor-pointer flex items-center gap-2.5 ${
                            isActivePreview
                              ? 'bg-rose-50/90 border-rose-400 shadow-xs ring-1 ring-rose-300'
                              : isSelected
                              ? 'bg-rose-50/40 border-rose-200 hover:border-rose-300'
                              : 'bg-white border-slate-200/90 hover:border-slate-300 hover:bg-slate-50/80'
                          }`}
                        >
                          {/* Checkbox pilih form */}
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="shrink-0 flex items-center"
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectDeployOrder(order.id)}
                              className="w-4 h-4 rounded-md accent-rose-600 cursor-pointer"
                            />
                          </div>

                          {/* Icon Kecil / Thumbnail */}
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border transition ${
                              isActivePreview
                                ? 'bg-rose-600 text-white border-rose-600 shadow-2xs'
                                : isSelesai
                                ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                                : isPOTerkirim
                                ? 'bg-blue-50 text-blue-600 border-blue-200'
                                : isSiapDikirim
                                ? 'bg-amber-50 text-amber-600 border-amber-200'
                                : 'bg-slate-100 text-slate-600 border-slate-200 group-hover:bg-rose-100 group-hover:text-rose-700 group-hover:border-rose-200'
                            }`}
                          >
                            <Store className="w-4 h-4" />
                          </div>

                          {/* Info Singkat: Outlet Name, Department & Tanggal */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <p className="text-xs font-bold text-slate-900 truncate">
                                {order.outletName}
                              </p>
                              <span
                                className={`shrink-0 w-2 h-2 rounded-full ${
                                  isSelesai
                                    ? 'bg-emerald-500'
                                    : isPOTerkirim
                                    ? 'bg-blue-500'
                                    : isSiapDikirim
                                    ? 'bg-amber-500'
                                    : 'bg-rose-500'
                                }`}
                                title={`Status: ${order.status}`}
                              />
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-slate-500 flex-wrap">
                              <span className="px-1.5 py-0.2 rounded bg-slate-200/75 text-slate-700 font-semibold text-[10px]">
                                {order.department}
                              </span>
                              <span>•</span>
                              <span className="inline-flex items-center gap-1 font-medium text-slate-600">
                                <Calendar className="w-3 h-3 text-slate-400" />
                                {formatDate(order.dateRequested)}
                              </span>
                            </div>
                          </div>

                          {/* Pilihan Opsi Form dengan Icon */}
                          <div
                            className="relative shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setExpandedOrderId(order.id);
                                setOpenActionMenuOrderId(isMenuOpen ? null : order.id);
                              }}
                              className={`p-1.5 rounded-lg border transition cursor-pointer flex items-center justify-center ${
                                isMenuOpen
                                  ? 'bg-rose-600 text-white border-rose-600 ring-2 ring-rose-200'
                                  : 'bg-white hover:bg-slate-100 text-slate-600 border-slate-200'
                              }`}
                              title="Pilihan Opsi Form"
                              aria-label="Pilihan Opsi Form"
                              aria-expanded={isMenuOpen}
                            >
                              <SlidersHorizontal className="w-3.5 h-3.5" />
                            </button>

                            {/* Dropdown Menu: List Option dengan Rincian Fungsinya */}
                            {isMenuOpen && (
                              <div
                                className="absolute right-0 top-full mt-1.5 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 py-2.5 z-40 animate-in fade-in zoom-in-95 duration-150 text-left"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="px-3.5 py-1.5 border-b border-slate-100 flex items-center justify-between mb-1.5">
                                  <div className="min-w-0 pr-2">
                                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                                      Opsi Form Deployment
                                    </span>
                                    <div className="text-xs font-bold text-slate-800 truncate">
                                      {order.outletName} • {order.department}
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setOpenActionMenuOrderId(null)}
                                    className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer shrink-0"
                                    title="Tutup menu opsi"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>

                                <div className="px-1.5 space-y-1 max-h-[380px] overflow-y-auto">
                                  {/* Opsi 1: Workflow Action Berdasarkan Status Form */}
                                  {isPendingManage && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenActionMenuOrderId(null);
                                        setActiveDeploymentOrder(order);
                                      }}
                                      className="w-full flex items-start gap-2.5 p-2 rounded-xl hover:bg-rose-50/80 border border-transparent hover:border-rose-200 transition group text-left cursor-pointer"
                                    >
                                      <div className="p-1.5 rounded-lg bg-rose-100 text-rose-700 group-hover:bg-rose-600 group-hover:text-white transition shrink-0 mt-0.5">
                                        <Edit2 className="w-3.5 h-3.5" />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <span className="font-bold text-xs text-slate-900 group-hover:text-rose-700">
                                            Kelola & Generate PO
                                          </span>
                                          <span className="text-[10px] font-bold px-1.5 py-0.2 bg-rose-100 text-rose-800 rounded">
                                            Langkah 1
                                          </span>
                                        </div>
                                        <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                                          Alokasi pemenuhan stok barang pesanan yang disiapkan dan generate dokumen PO pengiriman.
                                        </p>
                                      </div>
                                    </button>
                                  )}

                                  {isSiapDikirim && (
                                    <>
                                      {isAdmin ? (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setOpenActionMenuOrderId(null);
                                            setReviewShipmentOrder(order);
                                          }}
                                          className="w-full flex items-start gap-2.5 p-2 rounded-xl hover:bg-blue-50/80 border border-transparent hover:border-blue-200 transition group text-left cursor-pointer"
                                        >
                                          <div className="p-1.5 rounded-lg bg-blue-100 text-blue-700 group-hover:bg-blue-600 group-hover:text-white transition shrink-0 mt-0.5">
                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                              <span className="font-bold text-xs text-slate-900 group-hover:text-blue-700">
                                                Tinjau & Setujui Pengiriman
                                              </span>
                                              <span className="text-[10px] font-bold px-1.5 py-0.2 bg-blue-100 text-blue-800 rounded">
                                                Admin • Langkah 2
                                              </span>
                                            </div>
                                            <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                                              Validasi fisik barang siap dikirim ke outlet dan perbarui status menjadi 'PO Terkirim'.
                                            </p>
                                          </div>
                                        </button>
                                      ) : (
                                        <div
                                          className="w-full flex items-start gap-2.5 p-2 rounded-xl bg-slate-50 border border-slate-200 text-left opacity-75 cursor-not-allowed"
                                          title="Perintah Setujui Pengiriman hanya bisa dilakukan oleh Administrator"
                                        >
                                          <div className="p-1.5 rounded-lg bg-slate-200 text-slate-500 shrink-0 mt-0.5">
                                            <ShieldCheck className="w-3.5 h-3.5" />
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                              <span className="font-bold text-xs text-slate-500">
                                                Tinjau & Setujui Pengiriman
                                              </span>
                                              <span className="text-[10px] font-bold px-1.5 py-0.2 bg-rose-100 text-rose-800 rounded">
                                                Khusus Administrator
                                              </span>
                                            </div>
                                            <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                                              Perintah Setujui Pengiriman hanya dapat dilakukan oleh Administrator.
                                            </p>
                                          </div>
                                        </div>
                                      )}

                                      <button
                                        type="button"
                                        onClick={() => {
                                          setOpenActionMenuOrderId(null);
                                          setActiveDeploymentOrder(order);
                                        }}
                                        className="w-full flex items-start gap-2.5 p-2 rounded-xl hover:bg-amber-50/80 border border-transparent hover:border-amber-200 transition group text-left cursor-pointer"
                                      >
                                        <div className="p-1.5 rounded-lg bg-amber-100 text-amber-700 group-hover:bg-amber-600 group-hover:text-white transition shrink-0 mt-0.5">
                                          <Edit2 className="w-3.5 h-3.5" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <span className="font-bold text-xs text-slate-900 group-hover:text-amber-800 block">
                                            Ubah Rincian Barang
                                          </span>
                                          <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                                            Koreksi kuantiti barang disiapkan sebelum pengiriman disetujui.
                                          </p>
                                        </div>
                                      </button>
                                    </>
                                  )}

                                  {isPOTerkirim && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setOpenActionMenuOrderId(null);
                                          setActiveDeploymentOrder(order);
                                        }}
                                        className="w-full flex items-start gap-2.5 p-2 rounded-xl hover:bg-amber-50/80 border border-transparent hover:border-amber-200 transition group text-left cursor-pointer"
                                      >
                                        <div className="p-1.5 rounded-lg bg-amber-100 text-amber-700 group-hover:bg-amber-600 group-hover:text-white transition shrink-0 mt-0.5">
                                          <Edit2 className="w-3.5 h-3.5" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className="font-bold text-xs text-slate-900 group-hover:text-amber-800">
                                              Tinjau & Edit Form PO
                                            </span>
                                            <span className="text-[10px] font-bold px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded">
                                              Koreksi PO
                                            </span>
                                          </div>
                                          <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                                            Tinjau dan edit rincian barang, kuantitas dipesan/disiapkan, tambah atau hapus item sebelum masuk ke proses Setujui Akhir Outbond.
                                          </p>
                                        </div>
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => {
                                          setOpenActionMenuOrderId(null);
                                          setFinalApproveOrder(order);
                                        }}
                                        className="w-full flex items-start gap-2.5 p-2 rounded-xl hover:bg-emerald-50/80 border border-transparent hover:border-emerald-200 transition group text-left cursor-pointer"
                                      >
                                        <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white transition shrink-0 mt-0.5">
                                          <CheckCheck className="w-3.5 h-3.5" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className="font-bold text-xs text-slate-900 group-hover:text-emerald-700">
                                              Tinjau & Setujui Akhir (Masuk Outbond)
                                            </span>
                                            <span className="text-[10px] font-bold px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded">
                                              Langkah Final
                                            </span>
                                          </div>
                                          <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                                            Konfirmasi penerimaan outlet dan otomatis memotong saldo stok pada Master Inventory Outbond.
                                          </p>
                                        </div>
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => {
                                          setOpenActionMenuOrderId(null);
                                          setViewingDetailsOrder(order);
                                        }}
                                        className="w-full flex items-start gap-2.5 p-2 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-200 transition group text-left cursor-pointer"
                                      >
                                        <div className="p-1.5 rounded-lg bg-slate-100 text-slate-700 group-hover:bg-slate-700 group-hover:text-white transition shrink-0 mt-0.5">
                                          <Eye className="w-3.5 h-3.5" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <span className="font-bold text-xs text-slate-900 block">
                                            Lihat Rincian & Jejak Audit
                                          </span>
                                          <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                                            Tinjau riwayat persetujuan dan rincian barang form pesanan.
                                          </p>
                                        </div>
                                      </button>
                                    </>
                                  )}

                                  {isSelesai && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenActionMenuOrderId(null);
                                        setViewingDetailsOrder(order);
                                      }}
                                      className="w-full flex items-start gap-2.5 p-2 rounded-xl hover:bg-emerald-50/80 border border-transparent hover:border-emerald-200 transition group text-left cursor-pointer"
                                    >
                                      <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white transition shrink-0 mt-0.5">
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <span className="font-bold text-xs text-slate-900 group-hover:text-emerald-700">
                                            Lihat Rincian Selesai
                                          </span>
                                          <span className="text-[10px] font-bold px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded">
                                            Tuntas
                                          </span>
                                        </div>
                                        <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                                          Buka arsip form tuntas, surat jalan, dan pencatatan stok Outbond.
                                        </p>
                                      </div>
                                    </button>
                                  )}

                                  <div className="border-t border-slate-100 my-1 pt-1" />

                                  {/* Opsi: Tampilkan di Preview Panel */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenActionMenuOrderId(null);
                                      setExpandedOrderId(order.id);
                                    }}
                                    className="w-full flex items-start gap-2.5 p-2 rounded-xl hover:bg-rose-50/70 border border-transparent hover:border-rose-200 transition group text-left cursor-pointer"
                                  >
                                    <div className="p-1.5 rounded-lg bg-rose-50 text-rose-700 group-hover:bg-rose-600 group-hover:text-white transition shrink-0 mt-0.5">
                                      <Eye className="w-3.5 h-3.5" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <span className="font-bold text-xs text-slate-900 group-hover:text-rose-700 block">
                                        Lihat Rincian di Preview Panel
                                      </span>
                                      <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                                        Tampilkan tabel rincian item barang pada panel sebelah kanan.
                                      </p>
                                    </div>
                                  </button>

                                  {/* Opsi: Export PDF Surat Jalan (Muncul Setelah Setujui Pengiriman) */}
                                  {(isPOTerkirim || isSelesai) && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenActionMenuOrderId(null);
                                        exportSuratJalanToPDF(order, masterInventoryList);
                                      }}
                                      className="w-full flex items-start gap-2.5 p-2 rounded-xl hover:bg-rose-50/80 border border-transparent hover:border-rose-200 transition group text-left cursor-pointer"
                                    >
                                      <div className="p-1.5 rounded-lg bg-rose-100 text-rose-700 group-hover:bg-rose-600 group-hover:text-white transition shrink-0 mt-0.5">
                                        <FileText className="w-3.5 h-3.5" />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <span className="font-bold text-xs text-slate-900 group-hover:text-rose-700 block">
                                          Export to PDF (Surat Jalan)
                                        </span>
                                        <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                                          Unduh dokumen resmi Outlet Purchase Requisition Form / Surat Jalan (.pdf).
                                        </p>
                                      </div>
                                    </button>
                                  )}

                                  {/* Opsi: Export Excel Surat Jalan */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenActionMenuOrderId(null);
                                      exportOutletOrderToExcel(order);
                                    }}
                                    className="w-full flex items-start gap-2.5 p-2 rounded-xl hover:bg-emerald-50/70 border border-transparent hover:border-emerald-200 transition group text-left cursor-pointer"
                                  >
                                    <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white transition shrink-0 mt-0.5">
                                      <FileSpreadsheet className="w-3.5 h-3.5" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <span className="font-bold text-xs text-slate-900 group-hover:text-emerald-700 block">
                                        Export Excel (Surat Jalan)
                                      </span>
                                      <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                                        Unduh berkas format Excel (.xlsx) untuk Surat Jalan dan rekap form pesanan.
                                      </p>
                                    </div>
                                  </button>

                                  {/* Opsi: Hapus Form */}
                                  <div className="border-t border-slate-100 my-1 pt-1" />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenActionMenuOrderId(null);
                                      setOrderToDelete(order);
                                    }}
                                    className="w-full flex items-start gap-2.5 p-2 rounded-xl hover:bg-rose-50/80 border border-transparent hover:border-rose-200 transition group text-left cursor-pointer"
                                  >
                                    <div className="p-1.5 rounded-lg bg-rose-100 text-rose-700 group-hover:bg-rose-600 group-hover:text-white transition shrink-0 mt-0.5">
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <span className="font-bold text-xs text-rose-700 block">
                                        Hapus Form Deployment
                                      </span>
                                      <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                                        Hapus dokumen pesanan pengiriman ini secara permanen.
                                      </p>
                                    </div>
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* RIGHT PANEL: Preview Panel Rincian Form Deployment */}
                <div className="lg:col-span-8 bg-white flex flex-col">
                  {activePreviewDeployOrder ? (() => {
                    const isSiapDikirim = activePreviewDeployOrder.status === 'Siap Dikirim';
                    const isPOTerkirim = activePreviewDeployOrder.status === 'PO Terkirim';
                    const isSelesai =
                      activePreviewDeployOrder.status === 'Selesai' ||
                      activePreviewDeployOrder.status === 'Deployed / Dikirim' ||
                      activePreviewDeployOrder.status === 'Diterima Lengkap';
                    const isPendingManage = !isSiapDikirim && !isPOTerkirim && !isSelesai;

                    const total = activePreviewDeployOrder.items.length;
                    const fulfilled = activePreviewDeployOrder.items.filter(
                      (it) => (it.qtyPrepared || 0) >= it.qty
                    ).length;
                    const credit = total - fulfilled;

                    return (
                      <div className="flex flex-col h-full">
                        {/* Header Rincian Form Deployment */}
                        <div className="p-4 sm:p-5 bg-gradient-to-r from-rose-50/70 via-white to-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono font-bold text-xs bg-rose-100 text-rose-900 border border-rose-300 px-2.5 py-0.5 rounded-lg">
                                {activePreviewDeployOrder.id}
                              </span>

                              {/* Dynamic Status Badges */}
                              {isSiapDikirim && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300">
                                  <Clock className="w-3 h-3 text-amber-600" />
                                  Siap Dikirim
                                </span>
                              )}
                              {isPOTerkirim && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-900 border border-blue-300">
                                  <Truck className="w-3 h-3 text-blue-600" />
                                  PO Terkirim
                                </span>
                              )}
                              {isSelesai && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-900 border border-emerald-300">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  Selesai (Outbond)
                                </span>
                              )}
                              {isPendingManage && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-100 text-slate-700 border border-slate-300">
                                  <SlidersHorizontal className="w-3 h-3 text-slate-500" />
                                  {activePreviewDeployOrder.status} (Perlu Dikelola)
                                </span>
                              )}
                              {activePreviewDeployOrder.isBackorder && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-100 text-purple-900 border border-purple-300 shadow-2xs">
                                  <AlertCircle className="w-3 h-3 text-purple-600" />
                                  Sisa Order / Kekurangan (Credit)
                                </span>
                              )}
                              {activePreviewDeployOrder.isPartialShipment && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-sky-100 text-sky-900 border border-sky-300 shadow-2xs">
                                  <Truck className="w-3 h-3 text-sky-600" />
                                  Pengiriman Sebagian (Parsial)
                                </span>
                              )}

                              {/* Fulfillment / Prepared Status Badge */}
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                  credit === 0 && total > 0
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                    : fulfilled > 0
                                    ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                                }`}
                              >
                                {credit === 0 && total > 0 ? (
                                  <>
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                    Disiapkan: {total}/{total} Terpenuhi
                                  </>
                                ) : (
                                  <>
                                    <Clock className="w-3 h-3 text-amber-600" />
                                    Disiapkan: {fulfilled}/{total} ({credit} Credit)
                                  </>
                                )}
                              </span>
                            </div>

                            <div className="flex items-center gap-2.5">
                              <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                                <Store className="w-5 h-5" />
                              </div>
                              <div>
                                <h3 className="text-base font-black text-slate-900 leading-tight">
                                  {activePreviewDeployOrder.outletName}
                                </h3>
                                <div className="flex items-center gap-2 text-xs text-slate-600 mt-0.5 flex-wrap">
                                  <span className="font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                                    {activePreviewDeployOrder.department}
                                  </span>
                                  <span>•</span>
                                  <span className="inline-flex items-center gap-1 font-medium">
                                    <Calendar className="w-3.5 h-3.5 text-rose-600" />
                                    Tgl Permintaan: <strong>{formatDate(activePreviewDeployOrder.dateRequested)}</strong>
                                  </span>
                                  {activePreviewDeployOrder.picName && (
                                    <>
                                      <span>•</span>
                                      <span>PIC: <strong>{activePreviewDeployOrder.picName}</strong></span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Right Header Summary & Actions */}
                          <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0">
                            <div className="text-left sm:text-right">
                              <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block">
                                Total Nilai Form
                              </span>
                              <span className="text-base font-black text-slate-900">
                                {formatRupiah(activePreviewDeployOrder.totalAmount)}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 flex-wrap justify-end">
                              {/* Primary Workflow Button */}
                              {isPendingManage && (
                                <button
                                  type="button"
                                  onClick={() => setActiveDeploymentOrder(activePreviewDeployOrder)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-2xs transition cursor-pointer"
                                  title="Kelola penyiapan barang dan generate PO pengiriman"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                  <span>Kelola & Generate PO</span>
                                </button>
                              )}

                              {isSiapDikirim && (
                                <>
                                  {isAdmin ? (
                                    <button
                                      type="button"
                                      onClick={() => setReviewShipmentOrder(activePreviewDeployOrder)}
                                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-2xs transition cursor-pointer"
                                      title="Tinjau dan setujui pengiriman menjadi PO Terkirim (Khusus Administrator)"
                                    >
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                      <span>Setujui Pengiriman</span>
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      disabled
                                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-400 border border-slate-200 text-xs font-bold cursor-not-allowed"
                                      title="Perintah Setujui Pengiriman hanya bisa dilakukan oleh Administrator"
                                    >
                                      <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                                      <span>Setujui Pengiriman (Khusus Admin)</span>
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => setActiveDeploymentOrder(activePreviewDeployOrder)}
                                    className="p-2 rounded-lg bg-amber-50 hover:bg-amber-600 text-amber-700 hover:text-white border border-amber-200 transition cursor-pointer"
                                    title="Ubah Rincian Barang Disiapkan"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                </>
                              )}

                              {isPOTerkirim && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => exportSuratJalanToPDF(activePreviewDeployOrder, masterInventoryList)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-2xs transition cursor-pointer"
                                    title="Export Surat Jalan / Outlet Purchase Requisition Form ke PDF (.pdf)"
                                  >
                                    <FileText className="w-3.5 h-3.5" />
                                    <span>Export to PDF</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setActiveDeploymentOrder(activePreviewDeployOrder)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-2xs transition cursor-pointer"
                                    title="Tinjau dan edit rincian Form PO sebelum masuk ke proses Setujui Akhir Outbond"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                    <span>Tinjau & Edit Form PO</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setFinalApproveOrder(activePreviewDeployOrder)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-2xs transition cursor-pointer"
                                    title="Tinjau & Setujui Akhir (Masuk Outbond)"
                                  >
                                    <CheckCheck className="w-3.5 h-3.5" />
                                    <span>Setujui Akhir Outbond</span>
                                  </button>
                                </>
                              )}

                              {isSelesai && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => exportSuratJalanToPDF(activePreviewDeployOrder, masterInventoryList)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-2xs transition cursor-pointer"
                                    title="Export Surat Jalan / Outlet Purchase Requisition Form ke PDF (.pdf)"
                                  >
                                    <FileText className="w-3.5 h-3.5" />
                                    <span>Export to PDF</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setViewingDetailsOrder(activePreviewDeployOrder)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-600 text-emerald-800 hover:text-white border border-emerald-200 text-xs font-bold transition cursor-pointer"
                                    title="Lihat Rincian & Jejak Audit Selesai"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                    <span>Rincian Selesai</span>
                                  </button>
                                </>
                              )}

                              {/* Checkbox Toggle Icon */}
                              <button
                                type="button"
                                onClick={() => toggleSelectDeployOrder(activePreviewDeployOrder.id)}
                                className={`p-2 rounded-lg border transition cursor-pointer ${
                                  selectedDeployOrderIds.includes(activePreviewDeployOrder.id)
                                    ? 'bg-rose-600 text-white border-rose-600'
                                    : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                                }`}
                                title={
                                  selectedDeployOrderIds.includes(activePreviewDeployOrder.id)
                                    ? 'Batalkan Pilihan Form Ini'
                                    : 'Pilih / Tandai Form Ini'
                                }
                              >
                                {selectedDeployOrderIds.includes(activePreviewDeployOrder.id) ? (
                                  <CheckSquare className="w-4 h-4" />
                                ) : (
                                  <Square className="w-4 h-4" />
                                )}
                              </button>

                              {/* Export Excel Surat Jalan Icon */}
                              <button
                                type="button"
                                onClick={() => exportOutletOrderToExcel(activePreviewDeployOrder)}
                                className="p-2 rounded-lg bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white border border-emerald-200 transition cursor-pointer"
                                title="Export Excel Surat Jalan (.xlsx)"
                              >
                                <FileSpreadsheet className="w-4 h-4" />
                              </button>

                              {/* Hapus Form Icon */}
                              <button
                                type="button"
                                onClick={() => setOrderToDelete(activePreviewDeployOrder)}
                                className="p-2 rounded-lg bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-200 transition cursor-pointer"
                                title="Hapus Form Deployment"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Tabel Rincian Barang & Status Pemenuhan */}
                        <div className="p-4 flex-1 max-h-[420px] overflow-y-auto overflow-x-auto">
                          <div className="flex items-center justify-between mb-2.5">
                            <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                              <Package className="w-4 h-4 text-rose-600" />
                              Rincian Barang Dipesan & Penyiapan Gudang ({activePreviewDeployOrder.items.length} jenis barang)
                            </h4>
                          </div>

                          <div className="rounded-xl border border-slate-200 max-h-[330px] overflow-y-auto overflow-x-auto">
                            <table className="w-full text-left text-xs">
                              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 sticky top-0 z-10 shadow-2xs">
                                <tr>
                                  <th className="px-3 py-2.5 w-10 text-center bg-slate-50">No</th>
                                  <th className="px-3 py-2.5 bg-slate-50">SKU</th>
                                  <th className="px-3 py-2.5 bg-slate-50">Nama Barang</th>
                                  <th className="px-3 py-2.5 bg-slate-50">Kategori</th>
                                  <th className="px-2 py-2.5 text-center bg-slate-50">Unit</th>
                                  <th className="px-3 py-2.5 text-right bg-slate-50">Qty Dipesan</th>
                                  <th className="px-3 py-2.5 text-right text-rose-700 bg-rose-50">Qty Disiapkan</th>
                                  <th className="px-3 py-2.5 text-center bg-slate-50">Status Pemenuhan</th>
                                  <th className="px-3 py-2.5 text-right bg-slate-50">Harga</th>
                                  <th className="px-3 py-2.5 text-right bg-slate-50">Subtotal</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {activePreviewDeployOrder.items.map((it, idx) => {
                                  const matchedInv = findInventoryItemBySku(
                                    it.sku,
                                    it.itemName,
                                    masterInventoryList
                                  );
                                  const resolvedSku = matchedInv ? matchedInv.sku : it.sku;
                                  const resolvedName = it.itemName || matchedInv?.itemName || it.sku;
                                  const resolvedCategory = matchedInv ? matchedInv.category : it.category;
                                  const resolvedPrice = matchedInv
                                    ? matchedInv.priceBudget !== undefined && matchedInv.priceBudget > 0
                                      ? matchedInv.priceBudget
                                      : matchedInv.price ?? it.price
                                    : it.price;
                                  const resolvedSubtotal = it.qty * resolvedPrice;
                                  const isFulfilled = (it.qtyPrepared || 0) >= it.qty;
                                  const isPartial = (it.qtyPrepared || 0) > 0 && (it.qtyPrepared || 0) < it.qty;
                                  return (
                                    <tr
                                      key={`${activePreviewDeployOrder.id}-${resolvedSku}-${idx}`}
                                      className="hover:bg-slate-50/80"
                                    >
                                      <td className="px-3 py-2.5 text-center text-slate-400 font-semibold">
                                        {idx + 1}
                                      </td>
                                      <td className="px-3 py-2.5 font-mono font-bold text-slate-800">
                                        {resolvedSku}
                                      </td>
                                      <td className="px-3 py-2.5 font-medium text-slate-900">
                                        {resolvedName}
                                      </td>
                                      <td className="px-3 py-2.5 text-slate-600">
                                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-medium">
                                          {resolvedCategory}
                                        </span>
                                      </td>
                                      <td className="px-2 py-2.5 text-center text-slate-600">{it.unit}</td>
                                      <td className="px-3 py-2.5 text-right font-bold text-slate-800">
                                        {it.qty}
                                      </td>
                                      <td className="px-3 py-2.5 text-right font-black text-rose-700 bg-rose-50/30">
                                        {it.qtyPrepared !== undefined && it.qtyPrepared !== null
                                          ? `${it.qtyPrepared} ${it.unit}`
                                          : '-'}
                                      </td>
                                      <td className="px-3 py-2.5 text-center">
                                        {isFulfilled ? (
                                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                            Terpenuhi (Siap Kirim)
                                          </span>
                                        ) : isPartial ? (
                                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                            <AlertTriangle className="w-3 h-3 text-amber-600" />
                                            Kurang {it.qty - (it.qtyPrepared || 0)} {it.unit} (Credit)
                                          </span>
                                        ) : (
                                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                                            <Clock className="w-3 h-3 text-rose-500" />
                                            Belum Disiapkan ({it.qty} {it.unit})
                                          </span>
                                        )}
                                      </td>
                                      <td className="px-3 py-2.5 text-right text-slate-600">
                                        {formatRupiah(resolvedPrice)}
                                      </td>
                                      <td className="px-3 py-2.5 text-right font-bold text-slate-900">
                                        {formatRupiah(resolvedSubtotal)}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                              <tfoot className="bg-slate-50 border-t border-slate-200 font-bold text-xs sticky bottom-0 z-10">
                                <tr>
                                  <td colSpan={9} className="px-3 py-2.5 text-right text-slate-600 bg-slate-50">
                                    Total Nilai Form Deployment:
                                  </td>
                                  <td className="px-3 py-2.5 text-right text-rose-700 font-black bg-slate-50">
                                    {formatRupiah(activePreviewDeployOrder.totalAmount)}
                                  </td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        </div>
                      </div>
                    );
                  })() : (
                    <div className="flex-1 flex flex-col items-center justify-center p-10 text-center text-slate-400">
                      <Store className="w-10 h-10 text-slate-300 mb-2" />
                      <p className="text-sm font-bold text-slate-600">Pilih Form Deployment di Sebelah Kiri</p>
                      <p className="text-xs text-slate-400 mt-1">
                        Klik salah satu thumbnail Outlet Name, Department & Tanggal untuk menampilkan rincian form.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. Subtab: Outcoming Goods (Manual Outbond) */}
      {!isStorageMailer && activeSubTab === 'outcoming' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <h2 className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-2">
              <PackageMinus className="w-4 h-4 text-rose-600" />
              Input Pengeluaran Barang Manual (Outcoming Goods)
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Digunakan untuk pengeluaran barang di luar order outlet resmi (misal: barang rusak/basi, sampling QC, transfer internal). Data langsung masuk dan menambah Outbond di Master Inventory.
            </p>

            {manualSuccessMsg && (
              <div className="mb-4 p-3 bg-emerald-50 text-emerald-800 rounded-lg text-xs font-semibold border border-emerald-200 flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600" />
                {manualSuccessMsg}
              </div>
            )}

            <form onSubmit={handleManualOutbondSubmit} className="space-y-3.5 text-xs">
              {/* Tanggal Barang Keluar */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-rose-600" />
                    Tanggal Barang Keluar *
                  </span>
                  <div className="flex items-center gap-1 text-[10px]">
                    <button
                      type="button"
                      onClick={() => setManualDate(new Date().toISOString().slice(0, 10))}
                      className="px-2 py-0.5 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-600 rounded font-semibold cursor-pointer"
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
                      className="px-2 py-0.5 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-600 rounded font-semibold cursor-pointer"
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
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-800 focus:ring-2 focus:ring-rose-500 outline-hidden"
                />
              </div>

              {/* Field Pencarian Barang dari Master Inventory */}
              <div className="relative" ref={outcomingDropdownRef}>
                <label className="block font-semibold text-slate-700 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Search className="w-3.5 h-3.5 text-rose-600" />
                    Pencarian Barang Master Inventory *
                  </span>
                  {selectedOutcomingItem && (
                    <span className="text-[10px] text-rose-700 font-bold bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                      Terpilih: {selectedOutcomingItem.sku}
                    </span>
                  )}
                </label>

                {/* Input Pencarian Langsung */}
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={outcomingSearchQuery}
                    onFocus={() => setIsOutcomingDropdownOpen(true)}
                    onChange={(e) => {
                      setOutcomingSearchQuery(e.target.value);
                      setIsOutcomingDropdownOpen(true);
                    }}
                    placeholder={
                      selectedOutcomingItem
                        ? `Ganti barang (saat ini: ${selectedOutcomingItem.itemName})...`
                        : "Ketik SKU, Nama Barang, atau Kategori..."
                    }
                    className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-300 rounded-lg font-medium text-xs focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-hidden"
                  />
                  {outcomingSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setOutcomingSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Dropdown Hasil Pencarian Barang */}
                {isOutcomingDropdownOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-300 rounded-xl shadow-xl z-30 max-h-56 overflow-y-auto divide-y divide-slate-100">
                    {filteredOutcomingSearchItems.length === 0 ? (
                      <div className="p-3 text-center text-slate-400 text-xs">
                        Tidak ada barang yang cocok dengan pencarian "{outcomingSearchQuery}".
                      </div>
                    ) : (
                      filteredOutcomingSearchItems.map((it) => (
                        <div
                          key={it.sku}
                          onClick={() => {
                            setManualSku(it.sku);
                            setOutcomingSearchQuery('');
                            setIsOutcomingDropdownOpen(false);
                          }}
                          className={`p-2.5 hover:bg-rose-50 cursor-pointer transition flex items-center justify-between text-xs ${
                            it.sku === manualSku ? 'bg-rose-50/80 font-bold text-rose-900' : 'text-slate-700'
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-[11px] font-bold text-rose-700 bg-rose-100/70 px-1.5 py-0.5 rounded">
                                {it.sku}
                              </span>
                              <span className="font-semibold text-slate-900">{it.itemName}</span>
                            </div>
                            <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-2">
                              <span>Kat: {it.category}</span>
                              <span>•</span>
                              <span>Satuan: {it.unit}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                it.endingInventory <= 0
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              Sisa: {it.endingInventory} {it.unit}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Selected Item Card Preview */}
                {selectedOutcomingItem ? (
                  <div className="mt-2 p-2.5 bg-rose-50/60 border border-rose-200 rounded-xl flex items-center justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs bg-rose-700 text-white px-2 py-0.5 rounded">
                          {selectedOutcomingItem.sku}
                        </span>
                        <span className="font-bold text-slate-900">{selectedOutcomingItem.itemName}</span>
                      </div>
                      <div className="text-[11px] text-slate-600 flex items-center gap-2">
                        <span>Kategori: {selectedOutcomingItem.category}</span>
                        <span>•</span>
                        <span>Satuan: <strong>{selectedOutcomingItem.unit}</strong></span>
                        <span>•</span>
                        <span>
                          Sisa Stok Gudang:{' '}
                          <strong
                            className={
                              selectedOutcomingItem.endingInventory <= 0
                                ? 'text-rose-600 font-black'
                                : 'text-emerald-700'
                            }
                          >
                            {selectedOutcomingItem.endingInventory} {selectedOutcomingItem.unit}
                          </strong>
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsOutcomingDropdownOpen(true)}
                      className="px-2.5 py-1 text-[11px] font-bold bg-white text-rose-800 border border-rose-300 rounded-lg hover:bg-rose-100 transition cursor-pointer shrink-0 shadow-2xs"
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

              {/* Jumlah Keluar */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1 flex items-center justify-between">
                  <span>Jumlah Keluar (Qty) *</span>
                  {selectedOutcomingItem && (
                    <span className="text-[10px] text-slate-500">
                      Sisa stok tersedia: {selectedOutcomingItem.endingInventory} {selectedOutcomingItem.unit}
                    </span>
                  )}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    required
                    value={manualQty}
                    onChange={(e) => setManualQty(Math.max(1, parseInt(e.target.value) || 0))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-sm text-slate-900 focus:ring-2 focus:ring-rose-500 outline-hidden"
                  />
                  {selectedOutcomingItem && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">
                      {selectedOutcomingItem.unit}
                    </span>
                  )}
                </div>
                {selectedOutcomingItem && manualQty > selectedOutcomingItem.endingInventory && (
                  <p className="text-[10px] text-rose-600 mt-1 font-semibold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                    Peringatan: Jumlah keluar ({manualQty}) melebihi stok yang tercatat ({selectedOutcomingItem.endingInventory}).
                  </p>
                )}
              </div>

              {/* Pilihan Outlet dan Department sebagai Sumber / Tujuan Barang Keluar */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Pilihan Outlet */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                    <Store className="w-3.5 h-3.5 text-rose-600" />
                    Pilihan Outlet *
                  </label>
                  <select
                    value={manualOutlet}
                    onChange={(e) => setManualOutlet(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-semibold text-slate-800 focus:ring-2 focus:ring-rose-500 outline-hidden"
                  >
                    {outlets.map((o) => (
                      <option key={o.id} value={o.namaOutlet}>
                        {o.namaOutlet} ({o.location})
                      </option>
                    ))}
                    <option value="Gudang Pusat / Non-Outlet">Gudang Pusat / Non-Outlet (Operasional Pusat)</option>
                  </select>
                </div>

                {/* Pilihan Department */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-rose-600" />
                    Pilihan Department *
                  </label>
                  <select
                    value={manualDepartment}
                    onChange={(e) => setManualDepartment(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-semibold text-slate-800 focus:ring-2 focus:ring-rose-500 outline-hidden"
                  >
                    {DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                    <option value="Floor & Operations">Floor & Operations</option>
                    <option value="Central Warehouse / Chiller">Central Warehouse / Chiller</option>
                  </select>
                </div>
              </div>

              {/* Tujuan / Alasan Pengeluaran */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Tujuan / Alasan Pengeluaran *
                </label>
                <select
                  value={manualDestination}
                  onChange={(e) => setManualDestination(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-medium text-slate-800 focus:ring-2 focus:ring-rose-500 outline-hidden"
                >
                  <option value="Distribusi Langsung Outlet">Distribusi Langsung Outlet (Manual Request)</option>
                  <option value="Spoilage / Basi / Kerusakan Fisik">Spoilage / Basi / Kerusakan Fisik</option>
                  <option value="Sampling QC & Tasting">Sampling QC, R&D & Tasting</option>
                  <option value="Transfer Antar Gudang Satelit">Transfer Antar Gudang Satelit</option>
                  <option value="Internal Event / Staff Meal">Internal Event / Staff Meal Head Office</option>
                  <option value="Koreksi Pengurangan Stok">Koreksi Pengurangan Stok (Adjusment)</option>
                </select>
              </div>

              {/* Catatan Tambahan */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Catatan Tambahan</label>
                <input
                  type="text"
                  value={manualNotes}
                  onChange={(e) => setManualNotes(e.target.value)}
                  placeholder="Keterangan berita acara pembuangan / nomor memo..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 outline-hidden"
                />
              </div>

              <button
                type="submit"
                disabled={!selectedOutcomingItem}
                className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold rounded-xl transition shadow-xs flex items-center justify-center gap-1.5 mt-2 cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                Catat ke Outbond Master Inventory
              </button>
            </form>
          </div>

          {/* Right: History of Manual Outbonds */}
          <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-bold text-slate-900">
                Riwayat Transaksi Pengeluaran Manual
              </h3>
              <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                {manualOutbondRecords.length} Catatan
              </span>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              Daftar pencatatan barang keluar manual terkini dengan rincian outlet, departemen, dan tanggal keluar.
            </p>

            <div className="overflow-x-auto max-h-[460px] overflow-y-auto border border-slate-100 rounded-xl flex-1">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-2.5">Tgl Keluar</th>
                    <th className="px-3 py-2.5">SKU & Barang</th>
                    <th className="px-3 py-2.5 text-right">Qty</th>
                    <th className="px-3 py-2.5">Outlet & Dept</th>
                    <th className="px-3 py-2.5">Alasan / Tujuan</th>
                    <th className="px-3 py-2.5">Petugas</th>
                    {isAdmin && <th className="px-2 py-2.5 text-center w-10">Aksi</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {manualOutbondRecords.length === 0 ? (
                    <tr>
                      <td colSpan={isAdmin ? 7 : 6} className="text-center py-8 text-slate-400">
                        Belum ada riwayat transaksi manual keluar.
                      </td>
                    </tr>
                  ) : (
                    manualOutbondRecords.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2 text-slate-600 font-medium whitespace-nowrap">
                          {formatDate(m.date)}
                        </td>
                        <td className="px-3 py-2">
                          <div className="font-mono font-bold text-slate-800">{m.sku}</div>
                          <div className="font-medium text-slate-900">{m.itemName}</div>
                          <div className="text-[10px] text-slate-400">{m.category}</div>
                        </td>
                        <td className="px-3 py-2 text-right font-bold text-rose-700 whitespace-nowrap">
                          -{m.qty} {m.unit}
                        </td>
                        <td className="px-3 py-2 text-slate-700">
                          {m.outletName ? (
                            <div>
                              <span className="font-semibold text-slate-900">{m.outletName}</span>
                              {m.department && (
                                <span className="block text-[10px] text-slate-500 font-medium">
                                  {m.department}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-500">-</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-slate-600 max-w-[140px] truncate" title={m.destination}>
                          {m.destination}
                        </td>
                        <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{m.dispatchedBy}</td>
                        {isAdmin && (
                          <td className="px-2 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => setManualRecordToDelete(m)}
                              className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-md transition cursor-pointer"
                              title="Hapus data pengeluaran ini (Khusus Administrator)"
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
      {!isStorageMailer && activeSubTab === 'report' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <FileCheck2 className="w-4 h-4 text-rose-600" />
                Laporan Status Pengiriman Barang ke Outlet
              </h2>
              <p className="text-xs text-slate-500">
                Menampilkan status barang apa saja yang belum terkirim ke Outlet secara keseluruhan maupun sebagian.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-[10px] font-bold uppercase text-slate-600">1. Perlu Dikelola</span>
              <div className="text-xl font-black text-slate-900 mt-0.5">
                {outletOrders.filter((o) => o.status === 'Submitted' || o.status === 'Draft' || o.status === 'Processing Gudang' || o.status === 'PO Generated').length} Form
              </div>
            </div>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
              <span className="text-[10px] font-bold uppercase text-amber-700">2. Siap Dikirim</span>
              <div className="text-xl font-black text-amber-900 mt-0.5">
                {outletOrders.filter((o) => o.status === 'Siap Dikirim').length} Form
              </div>
            </div>
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
              <span className="text-[10px] font-bold uppercase text-blue-700">3. PO Terkirim</span>
              <div className="text-xl font-black text-blue-900 mt-0.5">
                {outletOrders.filter((o) => o.status === 'PO Terkirim').length} Form
              </div>
            </div>
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
              <span className="text-[10px] font-bold uppercase text-emerald-700">4. Selesai (Outbond)</span>
              <div className="text-xl font-black text-emerald-900 mt-0.5">
                {outletOrders.filter((o) => o.status === 'Selesai' || o.status === 'Deployed / Dikirim' || o.status === 'Diterima Lengkap').length} Form
              </div>
            </div>
          </div>

          {/* Search & Filter Toolbar for Report */}
          <div className="bg-slate-50/90 border border-slate-200 rounded-xl p-3 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 text-xs">
            {/* Search Bar & Fitur Hapus Form (Sejajar dengan kolom pencarian) */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-1">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={reportSearchQuery}
                  onChange={(e) => setReportSearchQuery(e.target.value)}
                  placeholder="Cari Form ID, Outlet, Department, atau Status..."
                  className="w-full pl-9 pr-8 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-hidden"
                />
                {reportSearchQuery && (
                  <button
                    onClick={() => setReportSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
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
                    if (reportSearchQuery.trim() !== '' && filteredAndSortedReportOrders.length === 1) {
                      setOrderToDelete(filteredAndSortedReportOrders[0]);
                    } else {
                      setDeleteSelectorSearch(reportSearchQuery);
                      setShowDeleteSelectorModal(true);
                    }
                  }}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 hover:text-rose-800 border border-rose-300 rounded-lg font-bold text-xs shadow-2xs transition shrink-0 cursor-pointer"
                  title="Fitur Hapus Form Outbond (Hanya Muncul pada Administrator)"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                  <span>Hapus Form</span>
                  <span className="text-[10px] bg-rose-200/70 text-rose-800 px-1.5 py-0.5 rounded font-semibold ml-0.5">Admin</span>
                </button>
              )}
            </div>

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
                    className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-semibold ml-1"
                    title="Tampilkan semua tanggal"
                  >
                    Semua
                  </button>
                )}
              </div>

              {/* Urutkan Tanggal */}
              <button
                onClick={() => setReportDateSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg font-semibold transition shadow-2xs"
                title="Urutkan berdasarkan tanggal permintaan"
              >
                <ArrowUpDown className="w-3.5 h-3.5 text-rose-600" />
                <span>Urutkan: {reportDateSortOrder === 'desc' ? 'Terbaru' : 'Terlama'}</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2.5">Form ID</th>
                  <th className="px-3 py-2.5">Outlet & Departemen</th>
                  <th className="px-3 py-2.5">Tgl Diminta</th>
                  <th className="px-3 py-2.5 text-center">Status Distribusi</th>
                  <th className="px-3 py-2.5 text-right">Nilai Total</th>
                  <th className="px-3 py-2.5 text-center">Aksi Form</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAndSortedReportOrders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-slate-400 font-medium">
                      {outletOrders.length === 0
                        ? 'Belum ada data laporan pengiriman.'
                        : 'Tidak ada form pengiriman yang sesuai dengan filter tanggal atau pencarian.'}
                    </td>
                  </tr>
                ) : (
                  filteredAndSortedReportOrders.map((ord) => {
                    const isExpanded = expandedReportOrderId === ord.id;

                    return (
                      <React.Fragment key={ord.id}>
                        <tr
                          onClick={() => setExpandedReportOrderId(isExpanded ? null : ord.id)}
                          className={`hover:bg-slate-50 transition cursor-pointer ${
                            isExpanded ? 'bg-rose-50/70 font-medium border-l-4 border-l-rose-600' : ''
                          }`}
                        >
                          <td className="px-3 py-2.5 font-mono font-bold text-slate-800">{ord.id}</td>
                          <td className="px-3 py-2.5 font-semibold text-slate-900">
                            {ord.outletName} • {ord.department}
                          </td>
                          <td className="px-3 py-2.5 text-slate-600 font-medium">{formatDate(ord.dateRequested)}</td>
                          <td className="px-3 py-2.5 text-center">
                            {ord.status === 'Siap Dikirim' ? (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 inline-flex items-center gap-1">
                                <Clock className="w-3 h-3 text-amber-600" />
                                Siap Dikirim
                              </span>
                            ) : ord.status === 'PO Terkirim' ? (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-300 inline-flex items-center gap-1">
                                <Truck className="w-3 h-3 text-blue-600" />
                                PO Terkirim
                              </span>
                            ) : ord.status === 'Selesai' || ord.status === 'Deployed / Dikirim' || ord.status === 'Diterima Lengkap' ? (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 inline-flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                Selesai (Outbond)
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-300 inline-flex items-center gap-1">
                                <SlidersHorizontal className="w-3 h-3 text-slate-500" />
                                {ord.status} (Perlu Dikelola)
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right font-bold text-slate-900">
                            {formatRupiah(ord.totalAmount)}
                          </td>
                          <td className="px-3 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => setExpandedReportOrderId(isExpanded ? null : ord.id)}
                                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition shadow-2xs ${
                                  isExpanded
                                    ? 'bg-rose-600 text-white'
                                    : 'bg-rose-50 text-rose-900 hover:bg-rose-100 border border-rose-200'
                                }`}
                                title={isExpanded ? 'Tutup list barang' : 'Tampilkan list barang form ini'}
                              >
                                {isExpanded ? (
                                  <>
                                    <ChevronUp className="w-3.5 h-3.5" />
                                    Tutup
                                  </>
                                ) : (
                                  <>
                                    <Eye className="w-3.5 h-3.5 text-rose-700" />
                                    List Barang
                                  </>
                                )}
                              </button>

                            </div>
                          </td>
                        </tr>

                        {/* List Barang Tepat di Bawah Form Laporan yang Dipilih */}
                        {isExpanded && (
                          <tr className="bg-rose-50/30 border-b-2 border-rose-400">
                            <td colSpan={6} className="p-3 sm:p-4">
                              <div className="bg-white rounded-xl border-2 border-rose-400 shadow-sm overflow-hidden animate-in fade-in duration-200">
                                <div className="p-3 bg-gradient-to-r from-rose-50 to-orange-50/40 border-b border-rose-200 flex items-center justify-between gap-2">
                                  <h4 className="font-bold text-xs sm:text-sm text-slate-900">
                                    Rincian List Barang Form {ord.id} ({ord.items.length} item)
                                  </h4>
                                  <button
                                    onClick={() => setExpandedReportOrderId(null)}
                                    className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800 font-semibold"
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
                                        <th className="px-3 py-2 text-right">Qty</th>
                                        <th className="px-3 py-2 text-center">Unit</th>
                                        <th className="px-3 py-2 text-right">Harga Satuan</th>
                                        <th className="px-3 py-2 text-right">Subtotal</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                      {ord.items.map((it, idx) => (
                                        <tr key={`${ord.id}-${it.sku}-${idx}`} className="hover:bg-slate-50">
                                          <td className="px-3 py-2 font-mono font-bold text-slate-800">{it.sku}</td>
                                          <td className="px-3 py-2 font-medium text-slate-900">{it.itemName}</td>
                                          <td className="px-3 py-2 text-slate-600">{it.category}</td>
                                          <td className="px-3 py-2 text-right font-bold text-rose-700">{it.qty}</td>
                                          <td className="px-3 py-2 text-center text-slate-600">{it.unit}</td>
                                          <td className="px-3 py-2 text-right text-slate-600">{formatRupiah(it.price)}</td>
                                          <td className="px-3 py-2 text-right font-bold text-slate-900">{formatRupiah(it.subtotal)}</td>
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

      {/* Modal: Full Deployment Manager (Mengisi list barang, hapus barang, tambah barang, dan submit deployment) */}
      {activeDeploymentOrder && (() => {
        const totalItemsCount = activeDeploymentOrder.items.length;
        const fulfilledItemsCount = activeDeploymentOrder.items.filter(
          (it) => (it.qtyPrepared || 0) >= it.qty
        ).length;
        const creditItemsCount = totalItemsCount - fulfilledItemsCount;
        const isAllFulfilled = fulfilledItemsCount === totalItemsCount && totalItemsCount > 0;
        const fulfillmentPct = totalItemsCount > 0 ? Math.round((fulfilledItemsCount / totalItemsCount) * 100) : 0;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-1.5 sm:p-2.5 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-[98vw] max-w-[98vw] h-[96vh] max-h-[96vh] border border-slate-200 px-4 py-3 space-y-2 flex flex-col">
              {/* Header (Compact) */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 shrink-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="w-6 h-6 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                    <Truck className="w-3.5 h-3.5" />
                  </span>
                  <h3 className="font-extrabold text-xs sm:text-sm text-slate-900">
                    {activeDeploymentOrder.status === 'PO Terkirim'
                      ? `Tinjau & Edit Form PO (Sebelum Setujui Akhir Outbond): ${activeDeploymentOrder.id}`
                      : `Kelola Pengiriman Form PO: ${activeDeploymentOrder.id}`}
                  </h3>
                  <span className="text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                    Outlet: <strong className="text-slate-800">{activeDeploymentOrder.outletName}</strong> • Dept: <strong className="text-slate-800">{activeDeploymentOrder.department}</strong> • Tgl: <strong className="text-slate-800">{formatDate(activeDeploymentOrder.dateRequested)}</strong>
                  </span>
                  {activeDeploymentOrder.status === 'PO Terkirim' && (
                    <span className="text-[10px] font-extrabold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full border border-blue-200">
                      Status: PO Terkirim
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setActiveDeploymentOrder(null)}
                  className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-1 rounded-lg transition cursor-pointer"
                  title="Tutup"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Progress & Kesiapan Summary Banner (Compact Supporting Component) */}
              <div className={`px-3 py-1.5 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-2 shrink-0 transition ${
                isAllFulfilled
                  ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                  : 'bg-amber-50/70 border-amber-200 text-amber-950'
              }`}>
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {isAllFulfilled ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  )}
                  <span className="text-[11px] font-medium truncate">
                    <strong className="font-bold mr-1">Kesiapan:</strong>
                    {isAllFulfilled
                      ? `Semua ${totalItemsCount} barang terpenuhi dan siap dikirim lengkap.`
                      : fulfilledItemsCount > 0
                      ? `${fulfilledItemsCount} barang siap dikirim ke '2. Siap Dikirim', sisa ${creditItemsCount} barang tetap di '1. Perlu Dikelola'.`
                      : `Belum ada barang disiapkan. Isi Qty Disiapkan atau klik 'Penuhi Semua'.`}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="w-24 bg-slate-200/80 rounded-full h-1.5 overflow-hidden hidden md:block">
                    <div
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        isAllFulfilled ? 'bg-emerald-500' : 'bg-amber-500'
                      }`}
                      style={{ width: `${fulfillmentPct}%` }}
                    />
                  </div>
                  <span className="px-2 py-0.5 rounded bg-white border border-emerald-200 text-emerald-800 text-[10px] font-bold">
                    ✓ {fulfilledItemsCount} Terpenuhi
                  </span>
                  <span className={`px-2 py-0.5 rounded border text-[10px] font-bold ${
                    creditItemsCount > 0
                      ? 'bg-rose-100 border-rose-300 text-rose-800'
                      : 'bg-white border-slate-200 text-slate-500'
                  }`}>
                    {creditItemsCount > 0 ? `⚠️ ${creditItemsCount} Credit` : '0 Credit'}
                  </span>
                </div>
              </div>

              {/* Sub-actions toolbar (Compact Supporting Component) */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 shrink-0">
                <div className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                  <SlidersHorizontal className="w-3 h-3 text-rose-600" />
                  <span>Daftar Isi List Barang ({totalItemsCount} Jenis Barang):</span>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={handleAutoPrepareAll}
                    className="flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-[11px] font-bold transition shadow-2xs cursor-pointer"
                    title="Otomatis isi seluruh Qty Disiapkan sama dengan Qty Dipesan"
                  >
                    <CheckCheck className="w-3 h-3" />
                    Penuhi Semua (100%)
                  </button>
                  <button
                    type="button"
                    onClick={handleResetAllPrepared}
                    className="flex items-center gap-1 px-2 py-1 bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 rounded-md text-[11px] font-semibold transition cursor-pointer"
                    title="Kosongkan seluruh Qty Disiapkan menjadi 0"
                  >
                    <Clock className="w-3 h-3 text-slate-400" />
                    Kosongkan
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddItemModal(true)}
                    className="flex items-center gap-1 px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-md text-[11px] font-bold transition shadow-2xs cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    Tambah Barang
                  </button>
                </div>
              </div>

              {/* Items Table with Qty Disiapkan column (Compact & High-Density List Barang) */}
              <div className="border border-slate-200 rounded-xl overflow-hidden flex-1 overflow-y-auto min-h-0 shadow-2xs bg-white">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 sticky top-0 z-10 text-[10px] uppercase tracking-wider">
                    <tr>
                      <th className="px-2 py-1.5 w-9 text-center">No</th>
                      <th className="px-2.5 py-1.5">Barang, SKU & Kategori</th>
                      <th className="px-2.5 py-1.5 text-center w-28">Qty Dipesan</th>
                      <th className="px-2.5 py-1.5 text-center w-44 bg-rose-50/80 text-rose-900 border-x border-rose-100">
                        Qty Disiapkan
                      </th>
                      <th className="px-2.5 py-1.5 text-center w-48">Status Pemenuhan</th>
                      <th className="px-2.5 py-1.5 text-right w-28">Subtotal</th>
                      <th className="px-2 py-1.5 text-center w-12">Hapus</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {activeDeploymentOrder.items.map((it, idx) => {
                      const hasPreparedValue = it.qtyPrepared !== undefined && it.qtyPrepared !== null;
                      const preparedVal = hasPreparedValue ? it.qtyPrepared! : 0;
                      const isFulfilled = hasPreparedValue && preparedVal >= it.qty;
                      const isPartial = hasPreparedValue && preparedVal > 0 && preparedVal < it.qty;
                      const creditQty = it.qty - preparedVal;

                      return (
                        <tr
                          key={`${activeDeploymentOrder.id}-${it.sku}-${idx}`}
                          className={`hover:bg-slate-50/90 transition ${
                            isFulfilled ? 'bg-emerald-50/25' : 'bg-white'
                          }`}
                        >
                          <td className="px-2 py-1 text-center text-slate-500 font-mono font-bold text-[11px]">
                            {idx + 1}
                          </td>
                          <td className="px-2.5 py-1">
                            <div className="flex items-center gap-1.5 flex-wrap leading-tight">
                              <span className="bg-slate-100 text-slate-800 px-1.5 py-0.2 rounded font-mono font-bold text-[10px] border border-slate-200 shrink-0">
                                {it.sku}
                              </span>
                              <span className="font-bold text-slate-900 text-xs">
                                {it.itemName}
                              </span>
                              <span className="text-[10px] text-slate-600 px-1.5 py-0.2 bg-slate-50 rounded border border-slate-200/80 font-medium">
                                {it.category}
                              </span>
                              <span className="text-[10px] text-slate-500 font-medium">
                                @ {formatRupiah(it.price)}/{it.unit}
                              </span>
                            </div>
                          </td>

                          {/* Qty Dipesan (Dapat diedit saat tinjau & edit form PO) */}
                          <td className="px-2.5 py-1 text-center whitespace-nowrap">
                            {activeDeploymentOrder.status === 'PO Terkirim' ? (
                              <div className="inline-flex items-center justify-center gap-1">
                                <input
                                  type="number"
                                  min="1"
                                  value={it.qty}
                                  onChange={(e) => {
                                    const parsed = parseInt(e.target.value, 10);
                                    handleDirectUpdateDeploymentQty(
                                      it.sku,
                                      Number.isNaN(parsed) ? 1 : Math.max(1, parsed)
                                    );
                                  }}
                                  className="w-16 px-1.5 py-0.5 text-center font-extrabold rounded text-xs outline-hidden transition border border-slate-300 bg-white text-slate-900 focus:ring-1 focus:ring-blue-500"
                                  title="Ubah Qty Dipesan pada Form PO"
                                />
                                <span className="text-[10px] font-semibold text-slate-500">{it.unit}</span>
                              </div>
                            ) : (
                              <span className="font-extrabold text-slate-900 text-xs">
                                {it.qty} <span className="text-[10px] font-semibold text-slate-500">{it.unit}</span>
                              </span>
                            )}
                          </td>

                          {/* Kolom Qty Disiapkan (Default Kosong Sebelum Diisi) */}
                          <td className="px-2.5 py-1 bg-rose-50/30 border-x border-rose-100">
                            <div className="flex items-center justify-center gap-1.5">
                              <input
                                type="number"
                                min="0"
                                placeholder=""
                                value={it.qtyPrepared === undefined || it.qtyPrepared === null ? '' : it.qtyPrepared}
                                onChange={(e) => {
                                  const raw = e.target.value;
                                  if (raw === '') {
                                    handleDirectUpdatePreparedQty(it.sku, undefined);
                                  } else {
                                    const parsed = parseInt(raw, 10);
                                    handleDirectUpdatePreparedQty(
                                      it.sku,
                                      Number.isNaN(parsed) ? 0 : Math.max(0, parsed)
                                    );
                                  }
                                }}
                                className={`w-16 px-1.5 py-0.5 text-center font-extrabold rounded text-xs outline-hidden transition border ${
                                  isFulfilled
                                    ? 'border-emerald-400 bg-emerald-50 text-emerald-900 focus:ring-1 focus:ring-emerald-500'
                                    : isPartial
                                    ? 'border-amber-400 bg-amber-50 text-amber-900 focus:ring-1 focus:ring-amber-500'
                                    : 'border-slate-300 bg-white text-slate-900 focus:ring-1 focus:ring-rose-500'
                                }`}
                                title="Isi jumlah barang yang telah disiapkan gudang (kosong secara default)"
                              />
                            </div>
                          </td>

                          {/* Status Pemenuhan Barang */}
                          <td className="px-2.5 py-1 text-center whitespace-nowrap">
                            {isFulfilled ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                                Terpenuhi ({preparedVal}/{it.qty} {it.unit})
                              </span>
                            ) : isPartial ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                                Kurang {creditQty} {it.unit} ({preparedVal}/{it.qty})
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                                <Clock className="w-3 h-3 text-rose-500 shrink-0" />
                                Belum Disiapkan (Kurang {it.qty} {it.unit})
                              </span>
                            )}
                          </td>

                          {/* Subtotal */}
                          <td className="px-2.5 py-1 text-right font-bold text-slate-900 text-xs whitespace-nowrap">
                            {formatRupiah(it.subtotal)}
                          </td>

                          {/* Action */}
                          <td className="px-2 py-1 text-center">
                            <button
                              type="button"
                              onClick={() => handleDeleteItemInDeployment(it.sku)}
                              className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition cursor-pointer"
                              title="Hapus barang dari pesanan"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Total and Submit to Outbond (Compact Footer) */}
              <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs text-slate-500 font-medium">Total Nilai Dispatch:</span>
                    <span className="text-sm sm:text-base font-black text-rose-600">
                      {formatRupiah(activeDeploymentOrder.totalAmount)}
                    </span>
                  </div>
                  <div className="h-4 w-px bg-slate-200 hidden sm:block" />
                  <div className="text-xs text-slate-600 hidden sm:block">
                    <span>Kesiapan: </span>
                    <strong className={isAllFulfilled ? 'text-emerald-700' : 'text-amber-700'}>
                      {fulfilledItemsCount}/{totalItemsCount} Terpenuhi
                    </strong>
                    {creditItemsCount > 0 && (
                      <span className="text-rose-600 font-bold ml-1">
                        ({creditItemsCount} Credit)
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => setActiveDeploymentOrder(null)}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                  >
                    Tutup
                  </button>

                  {activeDeploymentOrder.status === 'PO Terkirim' ? (
                    <>
                      <button
                        type="button"
                        onClick={() => exportSuratJalanToPDF(activeDeploymentOrder, masterInventoryList)}
                        className="px-3 py-2 text-xs font-bold bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-200 rounded-lg transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        Export to PDF
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const editedOrder = activeDeploymentOrder;
                          setExpandedOrderId(editedOrder.id);
                          setActiveDeploymentOrder(null);
                          setSuccessModalData({
                            title: 'Perubahan Form PO Berhasil Disimpan!',
                            message: `Rincian Form PO (${editedOrder.id}) pada status 'PO Terkirim' telah berhasil diperbarui. Anda dapat melanjutkan ke proses Setujui Akhir Outbond.`,
                            details: [
                              { label: 'Nomor Form ID', value: editedOrder.id },
                              { label: 'Outlet Tujuan', value: editedOrder.outletName },
                              { label: 'Department', value: editedOrder.department },
                              { label: 'Status Saat Ini', value: 'PO Terkirim (Telah Diedit)' },
                              { label: 'Total Jenis Barang', value: `${editedOrder.items.length} jenis barang` },
                              { label: 'Total Nilai Form', value: formatRupiah(editedOrder.totalAmount) },
                              { label: 'Diedit Oleh', value: currentUser.username },
                            ],
                            onExportPDF: () => exportSuratJalanToPDF(editedOrder, masterInventoryList),
                            exportPDFText: 'Export to PDF (Surat Jalan)',
                          });
                          setShowSuccessModal(true);
                        }}
                        className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Simpan Perubahan Form PO
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const updatedSnapshot = activeDeploymentOrder;
                          setExpandedOrderId(updatedSnapshot.id);
                          setActiveDeploymentOrder(null);
                          setFinalApproveOrder(updatedSnapshot);
                        }}
                        className="px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        Simpan & Lanjut Setujui Akhir Outbond
                      </button>
                    </>
                  ) : (
                    <>
                      {/* Kasus 1: Sebagian barang siap & sebagian belum siap/credit */}
                      {creditItemsCount > 0 && fulfilledItemsCount > 0 && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleGenerateDeployment(activeDeploymentOrder, false)}
                            className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                            title="Kirim barang yang sudah disiapkan ke proses 2. Siap Dikirim. Sisa barang yang belum ada tetap tinggal di 1. Perlu Dikelola"
                          >
                            <Send className="w-3.5 h-3.5" />
                            Kirim Sebagian ({fulfilledItemsCount} Barang Siap)
                          </button>
                          <button
                            type="button"
                            onClick={() => handleGenerateDeployment(activeDeploymentOrder, true)}
                            className="px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 border border-slate-300 rounded-lg transition cursor-pointer"
                            title="Kirim form secara utuh tanpa memisahkan sisa barang"
                          >
                            Kirim Semua (Tanpa Split)
                          </button>
                        </>
                      )}

                      {/* Kasus 2: Semua barang 100% siap */}
                      {isAllFulfilled && (
                        <button
                          type="button"
                          onClick={() => handleGenerateDeployment(activeDeploymentOrder, false)}
                          className="px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                        >
                          <Send className="w-3.5 h-3.5" />
                          Generate PO (Siap Dikirim Lengkap)
                        </button>
                      )}

                      {/* Kasus 3: Belum ada barang yang disiapkan sama sekali */}
                      {fulfilledItemsCount === 0 && (
                        <button
                          type="button"
                          disabled
                          className="px-4 py-2 text-xs font-bold bg-slate-200 text-slate-400 rounded-lg cursor-not-allowed flex items-center gap-1.5"
                          title="Isi Qty Disiapkan minimal 1 barang terlebih dahulu atau klik 'Penuhi Semua'"
                        >
                          <Send className="w-3.5 h-3.5" />
                          Isi Qty Disiapkan Dulu
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal: Tinjau & Setujui Pengiriman (Siap Dikirim -> PO Terkirim) */}
      {reviewShipmentOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-blue-200 p-6 space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                    <Truck className="w-3.5 h-3.5" />
                  </span>
                  <h3 className="font-bold text-sm text-slate-900">
                    Tinjau & Setujui Pengiriman: {reviewShipmentOrder.id}
                  </h3>
                </div>
                <span className="text-[11px] text-slate-500 mt-0.5 block">
                  Outlet: <strong>{reviewShipmentOrder.outletName}</strong> • Dept: <strong>{reviewShipmentOrder.department}</strong> • Tgl Permintaan: <strong>{formatDate(reviewShipmentOrder.dateRequested)}</strong>
                </span>
              </div>
              <button
                onClick={() => setReviewShipmentOrder(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Status & Review Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-900 space-y-1">
              <div className="font-bold flex items-center justify-between gap-1.5 flex-wrap">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-blue-600" />
                  Persetujuan Tahap 1: Konfirmasi Pengiriman (PO Terkirim)
                </span>
                <span className="text-[10px] font-extrabold bg-blue-200/80 text-blue-900 px-2 py-0.5 rounded-full">
                  Otorisasi Khusus Administrator
                </span>
              </div>
              <p className="text-[11px] text-blue-800">
                Form PO ini saat ini berstatus <strong>'Siap Dikirim'</strong>. Tinjau list barang di bawah ini. Ketika disetujui oleh <strong>Administrator</strong>, status form akan berganti menjadi <strong>'PO Terkirim'</strong> dan dokumen Surat Jalan (PDF) siap diunduh.
              </p>
              {!isAdmin && (
                <p className="text-[11px] text-rose-700 font-bold pt-1">
                  * Perhatian: Akun Anda ({currentUser.position}) tidak memiliki akses. Perintah Setujui Pengiriman hanya bisa dilakukan oleh Administrator.
                </p>
              )}
            </div>

            {/* List Barang Preview */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 border rounded-xl border-slate-200 p-3 bg-slate-50/50">
              <div className="text-xs font-bold text-slate-700 mb-2 flex items-center justify-between">
                <span>Rincian Barang Pesanan ({reviewShipmentOrder.items.length} item):</span>
                <span className="text-[11px] text-slate-500 font-normal">Diperiksa oleh: <strong>{currentUser.username} ({currentUser.position})</strong></span>
              </div>
              <div className="space-y-1.5">
                {reviewShipmentOrder.items.map((it, idx) => {
                  const isFulfilled = (it.qtyPrepared || 0) >= it.qty;
                  const isPartial = (it.qtyPrepared || 0) > 0 && (it.qtyPrepared || 0) < it.qty;
                  const creditQty = it.qty - (it.qtyPrepared || 0);

                  return (
                    <div
                      key={`${reviewShipmentOrder.id}-${it.sku}-${idx}`}
                      className="p-2.5 rounded-lg border border-slate-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                    >
                      <div className="flex-1">
                        <div className="font-bold text-slate-900">{it.itemName}</div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          SKU: {it.sku} • {it.category}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 self-end sm:self-auto flex-wrap">
                        <div className="text-right">
                          <span className="text-[10px] text-slate-500 block">Dipesan / Disiapkan:</span>
                          <span className="font-bold text-slate-800 text-xs">
                            {it.qty} {it.unit} / <strong className="text-rose-700">{it.qtyPrepared !== undefined ? it.qtyPrepared : 0} {it.unit}</strong>
                          </span>
                        </div>

                        <div className="min-w-[140px] text-center">
                          {isFulfilled ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Terpenuhi (Siap Kirim)
                            </span>
                          ) : isPartial ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                              <AlertTriangle className="w-3 h-3 text-amber-600" />
                              Kurang {creditQty} {it.unit} (Credit)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                              <Clock className="w-3 h-3 text-rose-500" />
                              Kurang {it.qty} {it.unit} (Credit)
                            </span>
                          )}
                        </div>

                        <div className="text-right min-w-[85px]">
                          <div className="text-[10px] text-slate-500">
                            @ {formatRupiah(it.price)}
                          </div>
                          <div className="font-bold text-slate-900">
                            {formatRupiah(it.subtotal)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer Summary & Approve Button */}
            <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[11px] text-slate-500 block">Total Nilai Pengiriman:</span>
                <span className="text-base font-extrabold text-blue-700">
                  {formatRupiah(reviewShipmentOrder.totalAmount)}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setReviewShipmentOrder(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  disabled={!isAdmin}
                  onClick={() => handleApproveToPOTerkirim(reviewShipmentOrder)}
                  className="px-5 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {isAdmin ? 'Setujui & Ubah ke PO Terkirim' : 'Hanya Administrator'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Tinjau & Setujui Akhir (PO Terkirim -> Selesai & Masuk Outbond) */}
      {finalApproveOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-emerald-200 p-6 space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <ArrowUpFromLine className="w-3.5 h-3.5" />
                  </span>
                  <h3 className="font-bold text-sm text-slate-900">
                    Persetujuan Akhir & Catat ke Outbond: {finalApproveOrder.id}
                  </h3>
                </div>
                <span className="text-[11px] text-slate-500 mt-0.5 block">
                  Outlet: <strong>{finalApproveOrder.outletName}</strong> • Dept: <strong>{finalApproveOrder.department}</strong> • Status Saat Ini: <strong className="text-blue-700">PO Terkirim</strong>
                </span>
              </div>
              <button
                onClick={() => setFinalApproveOrder(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Notice Box Outbond */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-950 space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-emerald-900">
                <CheckCheck className="w-4 h-4 text-emerald-600" />
                Persetujuan Tahap 2 (Final): Selesai & Resmi Masuk Outbond
              </div>
              <p className="text-[11px] text-emerald-800 leading-relaxed">
                Form PO ini telah berstatus <strong>'PO Terkirim'</strong>. Dengan menyetujui tahap akhir ini, formulir dinyatakan <strong>Selesai</strong> dan seluruh kuantitas barang di bawah ini akan <strong>otomatis dipotong dan dicatat resmi sebagai data keluar (Outbond)</strong> pada <strong>Master Inventory</strong>.
              </p>
            </div>

            {/* List Barang Preview */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 border rounded-xl border-slate-200 p-3 bg-slate-50/50">
              <div className="text-xs font-bold text-slate-700 mb-2 flex items-center justify-between">
                <span>Rincian Barang yang Resmi Dikeluarkan ({finalApproveOrder.items.length} item):</span>
                <span className="text-[11px] text-slate-500 font-normal">Penyetuju Akhir: <strong>{currentUser.username}</strong></span>
              </div>
              <div className="space-y-1.5">
                {finalApproveOrder.items.map((it, idx) => {
                  const qtyToOutbond = it.qtyPrepared !== undefined ? it.qtyPrepared : it.qty;
                  const isFulfilled = (it.qtyPrepared || 0) >= it.qty;
                  const isPartial = (it.qtyPrepared || 0) > 0 && (it.qtyPrepared || 0) < it.qty;
                  const creditQty = it.qty - (it.qtyPrepared || 0);

                  return (
                    <div
                      key={`${finalApproveOrder.id}-${it.sku}-${idx}`}
                      className="p-2.5 rounded-lg border border-slate-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                    >
                      <div className="flex-1">
                        <div className="font-bold text-slate-900">{it.itemName}</div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          SKU: {it.sku} • {it.category}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 self-end sm:self-auto flex-wrap">
                        <div className="text-right">
                          <span className="text-[10px] text-slate-500 block">Dipesan / Disiapkan:</span>
                          <span className="font-bold text-slate-800 text-xs">
                            {it.qty} {it.unit} / <strong className="text-rose-700">{it.qtyPrepared !== undefined ? it.qtyPrepared : 0} {it.unit}</strong>
                          </span>
                        </div>

                        <div className="min-w-[140px] text-center">
                          {isFulfilled ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Terpenuhi
                            </span>
                          ) : isPartial ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                              <AlertTriangle className="w-3 h-3 text-amber-600" />
                              Kurang {creditQty} (Credit)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                              <Clock className="w-3 h-3 text-rose-500" />
                              Kurang {it.qty} (Credit)
                            </span>
                          )}
                        </div>

                        <div className="text-right min-w-[90px]">
                          <div className="font-bold text-rose-700 text-xs">
                            -{qtyToOutbond} {it.unit} (Outbond)
                          </div>
                          <div className="text-[10px] text-slate-500">
                            Total: {formatRupiah(it.subtotal)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer Summary & Approve Button */}
            <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[11px] text-slate-500 block">Total Nilai Outbond:</span>
                <span className="text-base font-extrabold text-emerald-700">
                  {formatRupiah(finalApproveOrder.totalAmount)}
                </span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setFinalApproveOrder(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const target = finalApproveOrder;
                    setFinalApproveOrder(null);
                    setActiveDeploymentOrder(target);
                  }}
                  className="px-4 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                  title="Tinjau dan edit form PO terlebih dahulu sebelum Setujui Akhir Outbond"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  Edit Form PO
                </button>
                <button
                  onClick={() => handleFinalApproveToOutbond(finalApproveOrder)}
                  className="px-5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCheck className="w-4 h-4" />
                  Setujui Selesai & Masukkan ke Outbond
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Lihat Rincian Selesai / Sedang Berjalan */}
      {viewingDetailsOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 p-6 space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <FileCheck2 className="w-4 h-4 text-emerald-600" />
                  Rincian Form: {viewingDetailsOrder.id}
                </h3>
                <span className="text-[11px] text-slate-500">
                  Outlet: {viewingDetailsOrder.outletName} • Dept: {viewingDetailsOrder.department} • Status: <strong className="text-emerald-700">{viewingDetailsOrder.status}</strong>
                </span>
              </div>
              <button
                onClick={() => setViewingDetailsOrder(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Audit History Timeline */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1.5">
              <span className="font-bold text-slate-700 block text-[11px] uppercase">Riwayat & Jejak Audit Alur:</span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                <div className="bg-white p-2 rounded-lg border border-slate-200">
                  <span className="text-slate-400 block text-[10px]">1. Generate PO</span>
                  <span className="font-semibold text-slate-800">
                    {viewingDetailsOrder.deploymentGeneratedBy ? `${viewingDetailsOrder.deploymentGeneratedBy}` : 'Tercatat'}
                  </span>
                  <div className="text-slate-400 text-[10px]">Status: Siap Dikirim</div>
                </div>
                <div className="bg-white p-2 rounded-lg border border-slate-200">
                  <span className="text-slate-400 block text-[10px]">2. Persetujuan Kirim</span>
                  <span className="font-semibold text-slate-800">
                    {viewingDetailsOrder.dispatchedBy ? `${viewingDetailsOrder.dispatchedBy}` : '-'}
                  </span>
                  <div className="text-slate-400 text-[10px]">Status: PO Terkirim</div>
                </div>
                <div className="bg-white p-2 rounded-lg border border-slate-200">
                  <span className="text-slate-400 block text-[10px]">3. Persetujuan Outbond</span>
                  <span className="font-semibold text-slate-800">
                    {viewingDetailsOrder.finalApprovedBy ? `${viewingDetailsOrder.finalApprovedBy}` : '-'}
                  </span>
                  <div className="text-slate-400 text-[10px]">Status: Selesai (Outbond)</div>
                </div>
              </div>
            </div>

            {/* Items Table */}
            <div className="flex-1 overflow-y-auto space-y-1.5 border rounded-xl border-slate-200 p-3">
              <table className="w-full text-left text-xs">
                <thead className="text-slate-500 font-bold border-b border-slate-200 text-[11px]">
                  <tr>
                    <th className="pb-2">SKU</th>
                    <th className="pb-2">Nama Barang</th>
                    <th className="pb-2 text-right">Qty Dipesan</th>
                    <th className="pb-2 text-right text-rose-700">Qty Disiapkan</th>
                    <th className="pb-2 text-center">Status Pemenuhan</th>
                    <th className="pb-2 text-right">Harga</th>
                    <th className="pb-2 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {viewingDetailsOrder.items.map((it, idx) => {
                    const isFulfilled = (it.qtyPrepared || 0) >= it.qty;
                    const isPartial = (it.qtyPrepared || 0) > 0 && (it.qtyPrepared || 0) < it.qty;
                    const creditQty = it.qty - (it.qtyPrepared || 0);

                    return (
                      <tr key={`${viewingDetailsOrder.id}-${it.sku}-${idx}`} className="hover:bg-slate-50">
                        <td className="py-2 font-mono font-bold text-slate-800">{it.sku}</td>
                        <td className="py-2 font-medium text-slate-900">{it.itemName}</td>
                        <td className="py-2 text-right font-bold text-slate-900">{it.qty} {it.unit}</td>
                        <td className="py-2 text-right font-black text-rose-700">
                          {it.qtyPrepared !== undefined ? it.qtyPrepared : 0} {it.unit}
                        </td>
                        <td className="py-2 text-center">
                          {isFulfilled ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Terpenuhi
                            </span>
                          ) : isPartial ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                              <AlertTriangle className="w-3 h-3 text-amber-600" />
                              Kurang {creditQty} (Credit)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                              <Clock className="w-3 h-3 text-rose-500" />
                              Kurang {it.qty} (Credit)
                            </span>
                          )}
                        </td>
                        <td className="py-2 text-right text-slate-600">{formatRupiah(it.price)}</td>
                        <td className="py-2 text-right font-bold text-slate-900">{formatRupiah(it.subtotal)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <div>
                <span className="text-[11px] text-slate-500 block">Total Nilai:</span>
                <span className="text-base font-extrabold text-slate-900">
                  {formatRupiah(viewingDetailsOrder.totalAmount)}
                </span>
              </div>
              <div className="flex items-center gap-2">

                <button
                  onClick={() => setViewingDetailsOrder(null)}
                  className="px-5 py-2 text-xs font-bold bg-slate-800 hover:bg-slate-900 text-white rounded-xl shadow-xs transition"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Tambah Barang ke Deployment */}
      {showAddItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <form
            onSubmit={handleAddOrderItemInDeployment}
            className="bg-white rounded-2xl shadow-xl max-w-md w-full border border-slate-200 p-6 space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-900">
                Tambah Barang ke Form Deployment
              </h3>
              <button
                type="button"
                onClick={() => setShowAddItemModal(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Pilih Barang dari Master Inventory
                </label>
                <select
                  value={selectedInventorySku}
                  onChange={(e) => setSelectedInventorySku(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 outline-hidden"
                >
                  {inventory.map((inv) => (
                    <option key={inv.sku} value={inv.sku}>
                      [{inv.sku}] {inv.itemName} ({inv.category}) - {formatRupiah(inv.price)}/{inv.unit}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Jumlah Pesanan (Qty)
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={addQty}
                  onChange={(e) => setAddQty(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold text-sm focus:ring-2 focus:ring-rose-500 outline-hidden"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddItemModal(false)}
                className="px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-xs"
              >
                Tambahkan
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Edit Qty Barang in Deployment */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-900">
                Ubah Qty: {editingItem.itemName}
              </h3>
              <button
                onClick={() => setEditingItem(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Qty ({editingItem.unit}):
                </label>
                <input
                  type="number"
                  min="1"
                  value={editQty}
                  onChange={(e) => setEditQty(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full text-center py-2 border border-slate-300 rounded-lg font-bold text-sm focus:ring-2 focus:ring-rose-500 outline-hidden"
                />
              </div>
              <div className="flex justify-between font-bold text-slate-900">
                <span>Subtotal Baru:</span>
                <span className="text-rose-600">{formatRupiah(editQty * editingItem.price)}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setEditingItem(null)}
                className="px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Batal
              </button>
              <button
                onClick={handleSaveEditItemInDeployment}
                className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-xs"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Pemilih Form Outbond untuk Dihapus (Dibuka dari Toolbar Sejajar Kolom Pencarian) */}
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
                    <h3 className="text-base font-bold text-slate-900">Kelola & Hapus Form Outbond</h3>
                    <span className="text-[10px] font-extrabold bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full border border-rose-200">
                      Khusus Administrator
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Pilih formulir pesanan/pengiriman outbond yang ingin dihapus dari sistem.
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
                  placeholder="Cari Form ID, Outlet, atau Departemen..."
                  className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-hidden font-medium"
                  autoFocus
                />
                {deleteSelectorSearch && (
                  <button
                    onClick={() => setDeleteSelectorSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Form List to Delete */}
            <div className="overflow-y-auto flex-1 divide-y divide-slate-100 border border-slate-200 rounded-xl mb-4">
              {outletOrders
                .filter((ord) => {
                  if (!deleteSelectorSearch.trim()) return true;
                  const query = deleteSelectorSearch.toLowerCase();
                  return (
                    ord.id.toLowerCase().includes(query) ||
                    ord.outletName.toLowerCase().includes(query) ||
                    ord.department.toLowerCase().includes(query) ||
                    ord.status.toLowerCase().includes(query)
                  );
                })
                .map((ord) => (
                  <div
                    key={ord.id}
                    className="p-3.5 hover:bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-xs text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          {ord.id}
                        </span>
                        <span className="font-bold text-xs text-slate-800">
                          {ord.outletName} • {ord.department}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            ord.status === 'Siap Dikirim'
                              ? 'bg-amber-100 text-amber-800'
                              : ord.status === 'PO Terkirim'
                              ? 'bg-blue-100 text-blue-800'
                              : ord.status === 'Selesai' || ord.status === 'Deployed / Dikirim' || ord.status === 'Diterima Lengkap'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {ord.status}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-3">
                        <span>Tgl: {formatDate(ord.dateRequested)}</span>
                        <span>•</span>
                        <span>{ord.items.length} item</span>
                        <span>•</span>
                        <span className="font-semibold text-rose-600">{formatRupiah(ord.totalAmount)}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setShowDeleteSelectorModal(false);
                        setOrderToDelete(ord);
                      }}
                      className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-200 hover:border-rose-600 rounded-lg text-xs font-bold transition shadow-2xs shrink-0 cursor-pointer group"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-600 group-hover:text-white transition" />
                      <span>Hapus Form Ini</span>
                    </button>
                  </div>
                ))}

              {outletOrders.filter((ord) => {
                if (!deleteSelectorSearch.trim()) return true;
                const query = deleteSelectorSearch.toLowerCase();
                return (
                  ord.id.toLowerCase().includes(query) ||
                  ord.outletName.toLowerCase().includes(query) ||
                  ord.department.toLowerCase().includes(query) ||
                  ord.status.toLowerCase().includes(query)
                );
              }).length === 0 && (
                <div className="p-8 text-center text-slate-400">
                  <p className="text-xs font-semibold">Tidak ditemukan form outbond yang sesuai dengan pencarian.</p>
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

      {/* Modal Konfirmasi Hapus Form Outbond (Single atau Bulk) */}
      {(orderToDelete || ordersToBulkDelete.length > 0) && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-100">
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <div className="p-2.5 bg-rose-100 rounded-xl">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  {ordersToBulkDelete.length > 0
                    ? `Hapus ${ordersToBulkDelete.length} Form Deployment?`
                    : 'Hapus Form Outbond?'}
                </h3>
                <p className="text-xs text-slate-500">
                  Tindakan ini akan menghapus form pesanan pengiriman dari Outbond secara permanen
                </p>
              </div>
            </div>

            {ordersToBulkDelete.length > 0 ? (
              <div className="bg-slate-50 rounded-xl p-3.5 mb-4 text-xs space-y-2 border border-slate-200 max-h-48 overflow-y-auto">
                <div className="font-bold text-slate-700 mb-1">
                  Daftar Form yang Akan Dihapus ({ordersToBulkDelete.length} form):
                </div>
                {ordersToBulkDelete.map((ord) => (
                  <div
                    key={ord.id}
                    className="flex items-center justify-between py-1 border-b border-slate-200/70 last:border-0"
                  >
                    <div>
                      <span className="font-mono font-bold text-slate-900 mr-1.5">{ord.id}</span>
                      <span className="font-semibold text-slate-700">
                        {ord.outletName} • {ord.department}
                      </span>
                    </div>
                    <span className="text-slate-500 text-[11px]">{formatDate(ord.dateRequested)}</span>
                  </div>
                ))}
              </div>
            ) : orderToDelete ? (
              <div className="bg-slate-50 rounded-xl p-3.5 mb-4 text-xs space-y-2 border border-slate-200">
                <div className="flex justify-between">
                  <span className="text-slate-500">Nomor Form:</span>
                  <span className="font-mono font-bold text-slate-900">{orderToDelete.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Outlet & Departemen:</span>
                  <span className="font-semibold text-slate-800">
                    {orderToDelete.outletName} • {orderToDelete.department}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Status Alur:</span>
                  <span className="font-bold text-amber-700">{orderToDelete.status}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Tgl Permintaan:</span>
                  <span className="text-slate-700">{formatDate(orderToDelete.dateRequested)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Jumlah Item:</span>
                  <span className="text-slate-700 font-semibold">{orderToDelete.items.length} jenis barang</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Nilai:</span>
                  <span className="font-bold text-rose-600">{formatRupiah(orderToDelete.totalAmount)}</span>
                </div>
              </div>
            ) : null}

            <div className="p-3 bg-rose-50/80 rounded-xl border border-rose-200 text-rose-900 text-[11px] mb-4 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>
                Peringatan: Formulir ini dan seluruh daftar barang di dalamnya akan dihapus dari sistem antrean Outbond. Tindakan ini tidak dapat dibatalkan.
              </span>
            </div>

            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setOrderToDelete(null);
                  setOrdersToBulkDelete([]);
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteOrder}
                className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {ordersToBulkDelete.length > 0
                  ? `Hapus ${ordersToBulkDelete.length} Form Sekarang`
                  : 'Hapus Form Sekarang'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Upload Form PR Outlet (Excel / CSV) */}
      {showUploadPRModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl border border-slate-100 flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900">
                      Upload Form PR Outlet (Excel)
                    </h3>
                    <span className="text-[10px] font-extrabold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200">
                      Auto-Sync Outbond Deployment
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Upload file Excel formulir PR untuk langsung diteruskan ke Outbond Deployment dan PR Outlet.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowUploadPRModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="overflow-y-auto flex-1 py-4 space-y-4">
              {/* Info Notification */}
              <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-bold">Format Template &amp; Alur Integrasi Otomatis:</span>
                  <p className="text-[11px] text-blue-800 leading-relaxed">
                    Format Kolom Template: <strong>TANGGAL(DD/MM/YYYY), NAMA OUTLET, DEPARTMENT, SKU, NAMA BARANG, JUMLAH DIPESAN, SATUAN</strong>.
                  </p>
                  <ul className="text-[11px] list-disc list-inside text-blue-900 font-medium space-y-0.5">
                    <li><strong>Kategori &amp; Harga Otomatis</strong>: Dibaca langsung sesuai kode <strong>SKU</strong> yang dipesan berdasarkan <strong>Master Inventory</strong>.</li>
                    <li><strong>Outbond &gt; Deployment</strong>: Siap dikelola dan dikirimkan oleh tim logistik gudang.</li>
                    <li><strong>Purchase Request &gt; PR Outlet</strong>: Otomatis tersinkronisasi untuk pembuatan PO Pengadaan Pusat.</li>
                  </ul>
                </div>
              </div>

              {/* Upload Zone & Download Template */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* File Drop / Select Area */}
                <div className="md:col-span-2 border-2 border-dashed border-slate-300 hover:border-blue-400 rounded-xl p-5 text-center bg-slate-50/50 hover:bg-blue-50/20 transition flex flex-col items-center justify-center relative cursor-pointer group">
                  <input
                    ref={fileInputPRRef}
                    type="file"
                    accept=".xlsx, .xls, .csv"
                    onChange={handlePRFileChange}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  <div className="p-3 bg-white group-hover:bg-blue-100 rounded-2xl shadow-xs border border-slate-200 text-blue-600 mb-2 transition">
                    <FileUp className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-bold text-slate-800">
                    {uploadPRFile ? uploadPRFile.name : 'Pilih atau Tarik File Excel Form PR (.xlsx, .xls)'}
                  </span>
                  <span className="text-[11px] text-slate-500 mt-0.5">
                    {uploadPRFile
                      ? `Ukuran file: ${(uploadPRFile.size / 1024).toFixed(1)} KB`
                      : 'Mendukung format Excel standar .xlsx dan .xls'}
                  </span>
                </div>

                {/* Download Template Card */}
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 flex flex-col justify-between text-xs space-y-3">
                  <div>
                    <span className="font-bold text-slate-800 flex items-center gap-1.5 mb-1">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                      Template Resmi PR
                    </span>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Format: <strong>TANGGAL(DD/MM/YYYY), NAMA OUTLET, DEPARTMENT, SKU, NAMA BARANG, JUMLAH DIPESAN, SATUAN</strong>. Kategori &amp; Harga otomatis mengikuti SKU Master Inventory.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => downloadPROutletTemplate(masterInventoryList, outlets)}
                    className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs shadow-2xs transition cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Template</span>
                  </button>
                </div>
              </div>

              {/* Parsing Loading State */}
              {isUploadingPR && (
                <div className="p-6 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  <span>Memproses dan memvalidasi file Excel Form PR...</span>
                </div>
              )}

              {/* Error Message */}
              {uploadPRError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2 font-medium">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{uploadPRError}</span>
                </div>
              )}

              {/* Parsed Result Display */}
              {uploadPRParseResult && (
                <div className="space-y-4 pt-2">
                  {/* Metric Summary */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                    <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                      <span className="text-[10px] text-slate-500 font-semibold block">Total Baris File</span>
                      <span className="text-base font-black text-slate-900">{uploadPRParseResult.totalRows}</span>
                    </div>
                    <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-xl">
                      <span className="text-[10px] text-blue-700 font-semibold block">Form PR Terbentuk</span>
                      <span className="text-base font-black text-blue-900">{uploadPRParseResult.orders.length} Form</span>
                    </div>
                    <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl">
                      <span className="text-[10px] text-emerald-700 font-semibold block">Baris Valid</span>
                      <span className="text-base font-black text-emerald-900">{uploadPRParseResult.validRows}</span>
                    </div>
                    <div className={`p-2.5 rounded-xl border ${
                      uploadPRParseResult.invalidRows > 0
                        ? 'bg-rose-50 border-rose-200 text-rose-800'
                        : 'bg-slate-50 border-slate-200 text-slate-700'
                    }`}>
                      <span className="text-[10px] font-semibold block">Baris Invalid / Error</span>
                      <span className="text-base font-black">{uploadPRParseResult.invalidRows}</span>
                    </div>
                  </div>

                  {/* Tabs: Pratinjau Form vs Rincian Baris */}
                  <div className="flex items-center gap-2 border-b border-slate-200 pb-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setUploadActiveTab('preview')}
                      className={`font-bold pb-1 transition cursor-pointer ${
                        uploadActiveTab === 'preview'
                          ? 'text-blue-700 border-b-2 border-blue-600'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Pratinjau Form PR ({uploadPRParseResult.orders.length} Formulir)
                    </button>
                    <button
                      type="button"
                      onClick={() => setUploadActiveTab('rows')}
                      className={`font-bold pb-1 transition cursor-pointer ${
                        uploadActiveTab === 'rows'
                          ? 'text-blue-700 border-b-2 border-blue-600'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Daftar Baris Excel ({uploadPRParseResult.rawRows.length} Baris)
                      {uploadPRParseResult.invalidRows > 0 && (
                        <span className="ml-1.5 bg-rose-600 text-white text-[10px] px-1.5 py-0.2 rounded-full">
                          {uploadPRParseResult.invalidRows} Error
                        </span>
                      )}
                    </button>
                  </div>

                  {/* Tab Content: Preview Form PR */}
                  {uploadActiveTab === 'preview' && (
                    <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
                      {uploadPRParseResult.orders.map((ord) => (
                        <div
                          key={ord.id}
                          className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs space-y-2 hover:border-blue-300 transition"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono font-bold text-xs bg-blue-100 text-blue-900 px-2 py-0.5 rounded">
                                {ord.id}
                              </span>
                              <span className="font-bold text-xs text-slate-900">
                                {ord.outletName} • {ord.department}
                              </span>
                              <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                                {ord.status}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 flex items-center gap-3">
                              <span>Tgl Diminta: <strong>{formatDate(ord.dateRequested)}</strong></span>
                              <span>•</span>
                              <span>Estimasi: <strong className="text-slate-900">{formatRupiah(ord.totalAmount)}</strong></span>
                            </div>
                          </div>

                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-[11px]">
                              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-100">
                                <tr>
                                  <th className="px-2.5 py-1.5">SKU</th>
                                  <th className="px-2.5 py-1.5">Nama Barang</th>
                                  <th className="px-2.5 py-1.5">Kategori (Master)</th>
                                  <th className="px-2.5 py-1.5 text-right">Jumlah Dipesan</th>
                                  <th className="px-2.5 py-1.5 text-right">Harga (Master)</th>
                                  <th className="px-2.5 py-1.5 text-right">Subtotal</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {ord.items.map((it, idx) => (
                                  <tr key={`${ord.id}-${it.sku}-${idx}`} className="hover:bg-slate-50/50">
                                    <td className="px-2.5 py-1.5 font-mono font-bold text-slate-800">{it.sku}</td>
                                    <td className="px-2.5 py-1.5 font-medium text-slate-900">{it.itemName}</td>
                                    <td className="px-2.5 py-1.5 text-slate-500">{it.category}</td>
                                    <td className="px-2.5 py-1.5 text-right font-bold text-blue-700">
                                      {it.qty} {it.unit}
                                    </td>
                                    <td className="px-2.5 py-1.5 text-right text-slate-600">{formatRupiah(it.price)}</td>
                                    <td className="px-2.5 py-1.5 text-right font-semibold text-slate-800">
                                      {formatRupiah(it.subtotal)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Tab Content: Detail Raw Rows */}
                  {uploadActiveTab === 'rows' && (
                    <div className="overflow-x-auto max-h-[360px] overflow-y-auto border border-slate-200 rounded-xl">
                      <table className="w-full text-left text-[11px]">
                        <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 sticky top-0 z-10">
                          <tr>
                            <th className="px-2.5 py-2">Baris</th>
                            <th className="px-2.5 py-2">TANGGAL</th>
                            <th className="px-2.5 py-2">NAMA OUTLET &amp; DEPT</th>
                            <th className="px-2.5 py-2">SKU &amp; NAMA BARANG</th>
                            <th className="px-2.5 py-2">Kategori &amp; Harga (Master)</th>
                            <th className="px-2.5 py-2 text-right">JUMLAH &amp; SATUAN</th>
                            <th className="px-2.5 py-2">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {uploadPRParseResult.rawRows.map((r) => (
                            <tr
                              key={r.rowNumber}
                              className={r.isValid ? 'hover:bg-slate-50' : 'bg-rose-50/60 hover:bg-rose-50'}
                            >
                              <td className="px-2.5 py-1.5 font-mono text-slate-500 font-bold">#{r.rowNumber}</td>
                              <td className="px-2.5 py-1.5 text-slate-700 font-medium">{formatDate(r.dateRequested)}</td>
                              <td className="px-2.5 py-1.5">
                                <span className="font-semibold text-slate-900">{r.outletName}</span>
                                <span className="block text-[10px] text-slate-500">{r.department}</span>
                              </td>
                              <td className="px-2.5 py-1.5">
                                <span className="font-mono font-bold text-slate-800">{r.sku}</span>
                                <span className="block text-slate-700">{r.itemName}</span>
                              </td>
                              <td className="px-2.5 py-1.5">
                                <span className="text-slate-700 font-medium">{r.category}</span>
                                <span className="block text-[10px] text-slate-500">{formatRupiah(r.price)}</span>
                              </td>
                              <td className="px-2.5 py-1.5 text-right font-bold text-slate-800">
                                {r.qty} {r.unit}
                              </td>
                              <td className="px-2.5 py-1.5">
                                {r.isValid ? (
                                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                                    Valid
                                  </span>
                                ) : (
                                  <div>
                                    <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full">
                                      Error
                                    </span>
                                    <span className="block text-[10px] text-rose-700 mt-0.5">
                                      {r.errors.join(', ')}
                                    </span>
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Overwrite Checkbox */}
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="overwriteDeployPRCheckbox"
                      checked={uploadPROverwrite}
                      onChange={(e) => setUploadPROverwrite(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <label htmlFor="overwriteDeployPRCheckbox" className="text-xs text-slate-700 cursor-pointer font-medium">
                      Perbarui / timpa data form PR jika ID form yang sama sudah ada di sistem.
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowUploadPRModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Batal
              </button>

              <button
                type="button"
                onClick={handleConfirmUploadPR}
                disabled={!uploadPRParseResult || uploadPRParseResult.orders.length === 0}
                className="px-5 py-2.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white rounded-xl shadow-xs transition flex items-center gap-2 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>
                  {uploadPRParseResult
                    ? `Terapkan & Simpan ${uploadPRParseResult.orders.length} Form PR`
                    : 'Terapkan Form PR'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus Manual Outbond (Khusus Administrator) */}
      {manualRecordToDelete && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-100">
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <div className="p-2.5 bg-rose-100 rounded-xl">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  Hapus Data Outbond Manual?
                  <span className="text-[10px] font-extrabold bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full border border-rose-200">
                    Administrator
                  </span>
                </h3>
                <p className="text-xs text-slate-500">
                  Hapus catatan riwayat pengeluaran barang manual dari sistem
                </p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-3.5 mb-4 text-xs space-y-2 border border-slate-200">
              <div className="flex justify-between">
                <span className="text-slate-500">ID Transaksi:</span>
                <span className="font-mono font-bold text-slate-900">{manualRecordToDelete.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Nama Barang:</span>
                <span className="font-semibold text-slate-800">
                  {manualRecordToDelete.itemName} ({manualRecordToDelete.sku})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Jumlah Keluar:</span>
                <span className="font-bold text-rose-600">
                  -{manualRecordToDelete.qty} {manualRecordToDelete.unit}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Tujuan:</span>
                <span className="text-slate-700">{manualRecordToDelete.destination}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Petugas:</span>
                <span className="text-slate-700">{manualRecordToDelete.dispatchedBy}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setManualRecordToDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteManualOutbond}
                className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Hapus Data
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
        onExportPDF={successModalData.onExportPDF}
        exportPDFText={successModalData.exportPDFText}
      />
    </div>
  );
};
