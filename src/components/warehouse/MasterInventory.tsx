import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import {
  ITEM_CATEGORIES,
  ItemCategory,
  InventoryItem,
  DepartmentName,
  StockOpnameReport,
} from '../../types';
import { formatRupiah, exportMasterInventoryToExcel } from '../../utils/excelExport';
import { scrollToTop } from '../../utils/scrollHelper';
import { SuccessSubmitModal, SuccessDetail } from '../common/SuccessSubmitModal';
import {
  formatPeriodLabel,
  MONTH_NAMES_ID,
  calculateInventoryManagementReport,
  getNextPeriod,
  getPrevPeriod,
  normalizeInventoryItem,
  getNextQueuedSKU,
  CATEGORY_SKU_PREFIX,
  isItemLowStock,
} from '../../utils/inventoryUtils';
import {
  downloadSOTemplate,
  parseSOFile,
  SOParseResult,
} from '../../utils/stockOpnameTemplate';
import {
  downloadMasterInventoryTemplate,
  parseMasterInventoryFile,
  MasterInventoryParseResult,
} from '../../utils/masterInventoryTemplate';
import {
  Layers,
  Search,
  Filter,
  FileSpreadsheet,
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  AlertTriangle,
  RefreshCw,
  Info,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  CheckCircle2,
  Clock,
  TrendingDown,
  TrendingUp,
  BarChart3,
  ShieldCheck,
  ArrowRight,
  CheckCheck,
  Sparkles,
  Upload,
  Download,
  FileUp,
  FileCheck,
  FileText,
} from 'lucide-react';


export const MasterInventory: React.FC = () => {
  const {
    inventory,
    selectedPeriod,
    setSelectedPeriod,
    periodicInventories,
    stockOpnameReports,
    startStockOpname,
    approveStockOpnameReport,
    rejectStockOpnameReport,
    generateFinalSO,
    addInventoryItem,
    updateInventoryItem,
    deleteInventoryItem,
    clearMasterInventory,
    bulkImportMasterInventory,
    currentUser,
    vendors,
  } = useApp();

  // Active view tab
  const [activeTab, setActiveTab] = useState<'table' | 'movement' | 'stockOpname'>('table');

  // Search & category filter
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [filterLowStockOnly, setFilterLowStockOnly] = useState<boolean>(false);

  // Period Selector states
  const [currentYear, currentMonthStr] = selectedPeriod.split('-');
  const currentMonthNum = parseInt(currentMonthStr, 10);

  const availableYears = [2025, 2026, 2027, 2028];

  const handlePeriodChange = (year: string, monthNum: number) => {
    const formattedMonth = String(monthNum).padStart(2, '0');
    const newPeriodKey = `${year}-${formattedMonth}`;
    setSelectedPeriod(newPeriodKey);
  };

  const handlePrevPeriod = () => {
    setSelectedPeriod(getPrevPeriod(selectedPeriod));
  };

  const handleNextPeriod = () => {
    setSelectedPeriod(getNextPeriod(selectedPeriod));
  };

  const handleCurrentMonth = () => {
    setSelectedPeriod('2026-10');
  };

  // Find active period's SO report
  const activePeriodSOReport = useMemo(() => {
    return stockOpnameReports.find((r) => r.period === selectedPeriod);
  }, [stockOpnameReports, selectedPeriod]);

  // Normalized inventory items for active period
  const activeItems = useMemo(() => {
    const rawList = periodicInventories[selectedPeriod] || inventory;
    return rawList.map((item) => normalizeInventoryItem(item, selectedPeriod));
  }, [periodicInventories, selectedPeriod, inventory]);

  // Filtered items for table
  const filteredItems = useMemo(() => {
    return activeItems.filter((item) => {
      const matchesCat = selectedCategory === 'All' || item.category === selectedCategory;
      const matchesSearch =
        item.itemName.toLowerCase().includes(search.toLowerCase()) ||
        item.sku.toLowerCase().includes(search.toLowerCase());
      const matchesLowStock = !filterLowStockOnly || isItemLowStock(item);
      return matchesCat && matchesSearch && matchesLowStock;
    });
  }, [activeItems, selectedCategory, search, filterLowStockOnly]);

  // Inventory Management (Movement Report) calculations
  const movementReport = useMemo(() => {
    return calculateInventoryManagementReport(activeItems);
  }, [activeItems]);

  // Modal: Create/Edit Master Item
  const [showItemModal, setShowItemModal] = useState(false);
  const [modalItemData, setModalItemData] = useState<Partial<InventoryItem>>({
    sku: '',
    itemName: '',
    category: 'Dry Item',
    unit: 'Kg',
    priceBudget: 25000,
    priceActual: 25000,
    beginningInventory: 0,
    inbound: 0,
    outbond: 0,
    stockOpname: 0,
    minStock: 10,
    allowedDepartments: ['Kitchen'],
  });
  const [isEditingExisting, setIsEditingExisting] = useState(false);

  // Modal: Start SO (Physical Count entry)
  const [showStartSOModal, setShowStartSOModal] = useState(false);
  const [soFormDate, setSoFormDate] = useState<string>('2026-10-31');
  const [soFormChecker, setSoFormChecker] = useState<string>(currentUser.username || 'storage.checker');
  const [soFormSupervisor, setSoFormSupervisor] = useState<string>('Admin Warehouse');
  const [soFormNotes, setSoFormNotes] = useState<string>('');
  const [soCounts, setSoCounts] = useState<Record<string, { count: number; notes: string }>>({});
  const [soSearch, setSoSearch] = useState<string>('');
  const [soCategoryFilter, setSoCategoryFilter] = useState<string>('All');

  // Modal: Review Report SO
  const [showReviewSOModal, setShowReviewSOModal] = useState(false);
  const [selectedReportToReview, setSelectedReportToReview] = useState<StockOpnameReport | null>(null);

  // Modal: Generate Final SO
  const [showGenerateFinalModal, setShowGenerateFinalModal] = useState(false);

  // Modal: Upload SO via Template
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadParseResult, setUploadParseResult] = useState<SOParseResult | null>(null);
  const [isParsingUpload, setIsParsingUpload] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Modal: Upload Master Inventory via Template
  const [showUploadMasterModal, setShowUploadMasterModal] = useState(false);
  const [uploadedMasterFile, setUploadedMasterFile] = useState<File | null>(null);
  const [uploadMasterParseResult, setUploadMasterParseResult] = useState<MasterInventoryParseResult | null>(null);
  const [isParsingMasterUpload, setIsParsingMasterUpload] = useState(false);
  const [uploadMasterError, setUploadMasterError] = useState<string | null>(null);
  const [uploadImportMode, setUploadImportMode] = useState<'replace' | 'append'>('replace');

  // Modal: Clear All Items from Master Inventory
  const [showClearConfirmModal, setShowClearConfirmModal] = useState(false);
  const [clearScope, setClearScope] = useState<'current' | 'all'>('current');
  const [itemToDelete, setItemToDelete] = useState<InventoryItem | null>(null);

  // Success Pop-up Modal state
  const [showSuccessModal, setShowSuccessModal] = useState<boolean>(false);
  const [successModalData, setSuccessModalData] = useState<{
    title: string;
    message: string;
    details: SuccessDetail[];
  }>({
    title: 'Berhasil!',
    message: '',
    details: [],
  });

  // Handler: Open Start SO Modal
  const handleOpenStartSO = () => {
    const initialCounts: Record<string, { count: number; notes: string }> = {};
    activeItems.forEach((it) => {
      // If report already exists in draft or existing so count, use that, else default to endingInventory
      const existingReportItem = activePeriodSOReport?.items.find((item) => item.sku === it.sku);
      initialCounts[it.sku] = {
        count: existingReportItem ? existingReportItem.physicalCount : it.endingInventory,
        notes: existingReportItem ? existingReportItem.notes || '' : '',
      };
    });
    setSoCounts(initialCounts);
    setSoFormDate(`${selectedPeriod}-28`);
    setSoFormChecker(currentUser.username || 'Petugas Gudang');
    setSoFormNotes(activePeriodSOReport?.notes || `Pencatatan hitung fisik akhir bulan ${formatPeriodLabel(selectedPeriod)}`);
    setShowStartSOModal(true);
  };

  // Helper: Autofill physical count from system ending stock
  const handleAutofillSOWithSystem = () => {
    setSoCounts((prev) => {
      const updated = { ...prev };
      activeItems.forEach((it) => {
        updated[it.sku] = {
          count: it.endingInventory,
          notes: 'Sesuai saldo buku',
        };
      });
      return updated;
    });
  };

  // Helper: Reset physical count to zero
  const handleResetSOToZero = () => {
    setSoCounts((prev) => {
      const updated = { ...prev };
      activeItems.forEach((it) => {
        updated[it.sku] = {
          count: 0,
          notes: '',
        };
      });
      return updated;
    });
  };

  // Handler: Submit / Save SO Form
  const handleSubmitSOForm = (submitForReview: boolean) => {
    const itemsPayload = activeItems.map((it) => {
      const data = soCounts[it.sku] || { count: it.endingInventory, notes: '' };
      return {
        sku: it.sku,
        physicalCount: Number(data.count) || 0,
        notes: data.notes || '',
      };
    });

    const res = startStockOpname({
      period: selectedPeriod,
      conductedDate: soFormDate,
      checkerName: soFormChecker,
      supervisorName: soFormSupervisor,
      items: itemsPayload,
      notes: soFormNotes,
      submitForReview,
    });

    setShowStartSOModal(false);

    setSuccessModalData({
      title: submitForReview ? 'Report SO Berhasil Diajukan!' : 'Draft SO Berhasil Disimpan!',
      message: res.message,
      details: [
        { label: 'Periode', value: formatPeriodLabel(selectedPeriod) },
        { label: 'Tanggal SO', value: soFormDate },
        { label: 'Petugas Checker', value: soFormChecker },
        { label: 'Status', value: submitForReview ? 'Menunggu Review' : 'Draft' },
        { label: 'Total Item Dihitung', value: `${activeItems.length} Item` },
      ],
    });
    setShowSuccessModal(true);
    scrollToTop();
  };

  // Handlers for Uploading SO Results via Template
  const processUploadedFile = async (file: File) => {
    setIsParsingUpload(true);
    setUploadError(null);
    setUploadedFile(file);
    try {
      const result = await parseSOFile(file, activeItems);
      setUploadParseResult(result);
    } catch (err: any) {
      setUploadError(err.message || 'Gagal memproses file template SO.');
      setUploadParseResult(null);
    } finally {
      setIsParsingUpload(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processUploadedFile(file);
  };

  const handleDropFile = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    await processUploadedFile(file);
  };

  const handleApplyUploadToStartSO = () => {
    if (!uploadParseResult) return;
    const newCounts: Record<string, { count: number; notes: string }> = {};
    activeItems.forEach((it) => {
      newCounts[it.sku] = {
        count: 0,
        notes: '',
      };
    });
    uploadParseResult.rows.forEach((r) => {
      if (r.isValid) {
        newCounts[r.sku] = {
          count: r.physicalCount,
          notes: r.notes || '',
        };
      }
    });
    setSoCounts(newCounts);
    setShowUploadModal(false);
    setShowStartSOModal(true);
  };

  const handleDirectSubmitFromUpload = (submitForReview: boolean) => {
    if (!uploadParseResult) return;
    const itemsPayload = activeItems.map((it) => {
      const match = uploadParseResult.rows.find((r) => r.sku === it.sku);
      return {
        sku: it.sku,
        physicalCount: match ? match.physicalCount : 0,
        notes: match?.notes || '',
      };
    });

    const res = startStockOpname({
      period: selectedPeriod,
      conductedDate: new Date().toISOString().slice(0, 10),
      checkerName: currentUser.username || 'Petugas Upload SO',
      supervisorName: 'Admin Warehouse',
      items: itemsPayload,
      notes: `Diimport dari template file: ${uploadParseResult.fileName}`,
      submitForReview,
    });

    setShowUploadModal(false);
    setUploadParseResult(null);
    setUploadedFile(null);

    setSuccessModalData({
      title: submitForReview ? 'Hasil SO Berhasil Diupload & Diajukan!' : 'Draft SO dari File Berhasil Disimpan!',
      message: res.message,
      details: [
        { label: 'File Sumber', value: uploadParseResult.fileName },
        { label: 'Periode', value: formatPeriodLabel(selectedPeriod) },
        { label: 'Item Cocok', value: `${uploadParseResult.matchedItemsCount} Item` },
        { label: 'Item Selisih Fisik', value: `${uploadParseResult.itemsWithVariance} Item` },
        { label: 'Status Laporan', value: submitForReview ? 'Menunggu Review' : 'Draft' },
      ],
    });
    setShowSuccessModal(true);
    scrollToTop();
  };

  // Handlers for Master Inventory Upload via Template
  const processUploadedMasterFile = async (file: File) => {
    setIsParsingMasterUpload(true);
    setUploadMasterError(null);
    setUploadedMasterFile(file);
    try {
      const result = await parseMasterInventoryFile(file, selectedPeriod);
      setUploadMasterParseResult(result);
    } catch (err: any) {
      setUploadMasterError(err.message || 'Gagal memproses file template Master Inventory.');
      setUploadMasterParseResult(null);
    } finally {
      setIsParsingMasterUpload(false);
    }
  };

  const handleMasterFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processUploadedMasterFile(file);
  };

  const handleMasterDropFile = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    await processUploadedMasterFile(file);
  };

  const handleApplyMasterInventoryUpload = () => {
    if (!uploadMasterParseResult || uploadMasterParseResult.validRows === 0) return;
    const res = bulkImportMasterInventory(
      uploadMasterParseResult.items,
      uploadImportMode === 'replace',
      selectedPeriod
    );
    setShowUploadMasterModal(false);
    setUploadedMasterFile(null);
    setUploadMasterParseResult(null);

    setSuccessModalData({
      title: 'Import Master Inventory Berhasil!',
      message: res.message,
      details: [
        { label: 'File Template', value: uploadMasterParseResult.fileName },
        { label: 'Mode Import', value: uploadImportMode === 'replace' ? 'Ganti Seluruh Data (Replace All)' : 'Tambah / Update (Append)' },
        { label: 'Total Item Diimpor', value: `${uploadMasterParseResult.validRows} item` },
        { label: 'Periode Aktif', value: formatPeriodLabel(selectedPeriod) },
      ],
    });
    setShowSuccessModal(true);
    scrollToTop();
  };

  const handleExecuteClearInventory = () => {
    const res = clearMasterInventory({ allPeriods: clearScope === 'all' });
    setShowClearConfirmModal(false);
    setSuccessModalData({
      title: 'Master Inventory Dikosongkan',
      message: res.message,
      details: [
        { label: 'Cakupan', value: clearScope === 'all' ? 'Seluruh Periode' : `Periode ${formatPeriodLabel(selectedPeriod)}` },
        { label: 'Status Data', value: '0 Item (List Kosong)' },
      ],
    });
    setShowSuccessModal(true);
    scrollToTop();
  };

  const handleExecuteDeleteItem = (item: InventoryItem) => {
    deleteInventoryItem(item.sku);
    setItemToDelete(null);
    setSuccessModalData({
      title: 'Barang Berhasil Dihapus',
      message: `Item ${item.itemName} (${item.sku}) telah dihapus dari Master Inventory.`,
      details: [
        { label: 'SKU', value: item.sku },
        { label: 'Nama Barang', value: item.itemName },
        { label: 'Periode', value: formatPeriodLabel(selectedPeriod) },
      ],
    });
    setShowSuccessModal(true);
  };


  // Handler: Approve Report SO
  const handleApproveSO = (report: StockOpnameReport) => {
    const res = approveStockOpnameReport(report.id, currentUser.username || 'Cost Control');
    setShowReviewSOModal(false);

    setSuccessModalData({
      title: 'Report SO Telah Disetujui!',
      message: res.message,
      details: [
        { label: 'No Report SO', value: report.id },
        { label: 'Periode', value: report.periodLabel },
        { label: 'Status Baru', value: 'Disetujui (Approved)' },
        { label: 'Disetujui Oleh', value: currentUser.username || 'Cost Control' },
        { label: 'Total Fisik Tercatat', value: `${report.totalPhysicalUsage} Unit` },
        { label: 'Total Nilai Fisik SO', value: formatRupiah(report.totalPhysicalValue) },
        { label: 'Selisih GAP Value', value: formatRupiah(report.totalGapValue) },
      ],
    });
    setShowSuccessModal(true);
    scrollToTop();
  };

  // Handler: Reject / Revision Report SO
  const handleRejectSO = (report: StockOpnameReport) => {
    const res = rejectStockOpnameReport(report.id, 'Perlu cek fisik ulang pada item yang memiliki selisih');
    setShowReviewSOModal(false);

    setSuccessModalData({
      title: 'Report SO Dikembalikan ke Draft',
      message: res.message,
      details: [
        { label: 'No Report SO', value: report.id },
        { label: 'Periode', value: report.periodLabel },
        { label: 'Status Baru', value: 'Draft (Revisi)' },
      ],
    });
    setShowSuccessModal(true);
    scrollToTop();
  };

  // Handler: Generate Final SO
  const handleConfirmGenerateFinalSO = () => {
    const res = generateFinalSO(selectedPeriod, currentUser.username || 'Admin');
    setShowGenerateFinalModal(false);

    if (res.success) {
      setSuccessModalData({
        title: 'Generate Final SO Berhasil!',
        message: res.message,
        details: [
          { label: 'Periode SO Ditutup', value: formatPeriodLabel(selectedPeriod) },
          { label: 'Periode Baru Dibuat', value: formatPeriodLabel(res.nextPeriod) },
          { label: 'Penetapan Saldo', value: 'Hasil Fisik SO -> Saldo Awal (Beginning)' },
          { label: 'Eksekutor', value: currentUser.username || 'Admin' },
        ],
      });
      setShowSuccessModal(true);
      scrollToTop();
    } else {
      alert(res.message);
    }
  };

  // Modal: Save Master Item
  const handleSaveModalItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalItemData.sku || !modalItemData.itemName) return;

    const savedSku = modalItemData.sku;
    const savedName = modalItemData.itemName;
    const savedCategory = modalItemData.category || 'Dry Item';
    const savedUnit = modalItemData.unit || 'Kg';
    const budget = Number(modalItemData.priceBudget) || 0;
    const actual = Number(modalItemData.priceActual) || budget;
    const isEdit = isEditingExisting;

    const normalized = normalizeInventoryItem({
      ...modalItemData,
      priceBudget: budget,
      priceActual: actual,
      price: budget,
    }, selectedPeriod);

    if (isEditingExisting) {
      updateInventoryItem(normalized);
    } else {
      addInventoryItem(normalized);
    }

    setShowItemModal(false);
    setModalItemData({});

    setSuccessModalData({
      title: 'Data Master Item Berhasil Disimpan!',
      message: isEdit
        ? `Perubahan data item [${savedSku}] ${savedName} berhasil disimpan.`
        : `Item baru [${savedSku}] ${savedName} berhasil ditambahkan ke Master Inventory.`,
      details: [
        { label: 'SKU Item', value: savedSku },
        { label: 'Nama Barang', value: savedName },
        { label: 'Kategori', value: savedCategory },
        { label: 'Satuan', value: savedUnit },
        { label: 'Price Budget', value: formatRupiah(budget) },
        { label: 'Price Actual', value: formatRupiah(actual) },
      ],
    });
    setShowSuccessModal(true);
    scrollToTop();
  };

  const handleOpenCreateModal = () => {
    setIsEditingExisting(false);
    const initialCategory: ItemCategory =
      selectedCategory !== 'All' ? (selectedCategory as ItemCategory) : 'Dry Item';
    const queuedSku = getNextQueuedSKU(initialCategory, activeItems);

    setModalItemData({
      sku: queuedSku,
      itemName: '',
      category: initialCategory,
      unit: 'Kg',
      priceBudget: 25000,
      priceActual: 25000,
      price: 25000,
      beginningInventory: 0,
      inbound: 0,
      outbond: 0,
      stockOpname: 0,
      minStock: 10,
      safetyStock: 10,
      allowedDepartments: ['Kitchen'],
      vendor: '',
    });
    setShowItemModal(true);
  };

  const handleOpenEditModal = (item: InventoryItem) => {
    setIsEditingExisting(true);
    setModalItemData({
      ...item,
      priceBudget: item.priceBudget ?? item.price,
      priceActual: item.priceActual ?? item.price,
      minStock: item.minStock ?? item.safetyStock ?? 10,
      safetyStock: item.safetyStock ?? item.minStock ?? 10,
      vendor: item.vendor || '',
      allowedDepartments: item.allowedDepartments || ['Kitchen'],
    });
    setShowItemModal(true);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Top Header & Periodic Selector */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="p-2 bg-amber-100 rounded-xl text-amber-700">
                <Layers className="w-5 h-5" />
              </span>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">
                Master Inventory Gudang Pusat
              </h1>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                Periode: {formatPeriodLabel(selectedPeriod)}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Sistem manajemen stok terpusat: Beginning, Inbound, Outbond, Ending, Stock Opname, dan GAP audit berkala.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* 1. Upload Master Inventory via Template */}
            <button
              onClick={() => {
                setUploadedMasterFile(null);
                setUploadMasterParseResult(null);
                setUploadMasterError(null);
                setUploadImportMode('replace');
                setShowUploadMasterModal(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
              title="Upload berkas template Excel (.xlsx / .csv) untuk Master Inventory"
            >
              <Upload className="w-4 h-4" />
              <span>Upload Master Inventory</span>
            </button>

            {/* 2. Download Template Master Inventory */}
            <button
              onClick={() => downloadMasterInventoryTemplate(selectedPeriod)}
              className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
              title="Download Template Excel Master Inventory (.xlsx) lengkap dengan petunjuk pengisian & contoh data"
            >
              <Download className="w-4 h-4 text-rose-600" />
              <span>Template Master</span>
            </button>

            {/* 3. Export Excel Laporan */}
            <button
              onClick={() => exportMasterInventoryToExcel(activeItems, formatPeriodLabel(selectedPeriod))}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
              title="Download Excel Laporan 18 Kolom Lengkap"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Export Excel</span>
            </button>

            {/* 4. Kosongkan / Hapus Semua Data */}
            <button
              onClick={() => {
                setClearScope('current');
                setShowClearConfirmModal(true);
              }}
              className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer"
              title="Kosongkan seluruh list data barang Master Inventory"
            >
              <Trash2 className="w-4 h-4 text-rose-600" />
              <span>Hapus Semua Data</span>
            </button>

            {/* 5. Tambah Item Manual (Admin) */}
            {currentUser.position === 'Administrator' && (
              <button
                onClick={handleOpenCreateModal}
                className="flex items-center gap-1.5 px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                title="Tambah satu item barang secara manual"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Item Manual</span>
              </button>
            )}

            {/* Stock Opname Shortcut */}
            <button
              onClick={handleOpenStartSO}
              className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
              title="Mulai pencatatan hitung fisik Stock Opname akhir bulan"
            >
              <ClipboardCheck className="w-4 h-4" />
              <span>Start SO</span>
            </button>
          </div>
        </div>

        {/* Periodic Bar: Month & Year Picker */}
        <div className="bg-slate-50/90 rounded-xl p-3 border border-slate-200 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-slate-700 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-amber-600" />
              Pilih Periode:
            </span>

            {/* Month Dropdown */}
            <select
              value={currentMonthNum}
              onChange={(e) => handlePeriodChange(currentYear, parseInt(e.target.value, 10))}
              className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-amber-500 outline-hidden"
            >
              {MONTH_NAMES_ID.map((mName, idx) => (
                <option key={mName} value={idx + 1}>
                  {mName}
                </option>
              ))}
            </select>

            {/* Year Dropdown */}
            <select
              value={currentYear}
              onChange={(e) => handlePeriodChange(e.target.value, currentMonthNum)}
              className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-amber-500 outline-hidden"
            >
              {availableYears.map((yr) => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>

            {/* Quick Prev / Next Buttons */}
            <div className="flex items-center gap-1">
              <button
                onClick={handlePrevPeriod}
                className="p-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-600 transition"
                title="Bulan Sebelumnya"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleCurrentMonth}
                className="px-2.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-700 font-semibold transition"
                title="Kembali ke Bulan Sekarang"
              >
                Bulan Ini
              </button>
              <button
                onClick={handleNextPeriod}
                className="p-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-600 transition"
                title="Bulan Berikutnya"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Status SO Periode Aktif */}
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-medium">Status SO Bulan Ini:</span>
            {activePeriodSOReport ? (
              <span
                className={`px-2.5 py-1 rounded-full text-[11px] font-bold border flex items-center gap-1 ${
                  activePeriodSOReport.status === 'Disetujui' || activePeriodSOReport.status === 'Finalized (Generated)'
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                    : activePeriodSOReport.status === 'Menunggu Review'
                    ? 'bg-amber-100 text-amber-800 border-amber-200'
                    : 'bg-slate-100 text-slate-700 border-slate-300'
                }`}
              >
                {activePeriodSOReport.status === 'Disetujui' || activePeriodSOReport.status === 'Finalized (Generated)' ? (
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                ) : (
                  <Clock className="w-3 h-3 text-amber-600" />
                )}
                {activePeriodSOReport.status}
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                Belum Ada SO
              </span>
            )}

            {/* Quick action for SO */}
            {activePeriodSOReport?.status === 'Menunggu Review' && (
              <button
                onClick={() => {
                  setSelectedReportToReview(activePeriodSOReport);
                  setShowReviewSOModal(true);
                }}
                className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-bold text-[11px] shadow-2xs transition"
              >
                Tinjau Report SO
              </button>
            )}

            {activePeriodSOReport?.status === 'Disetujui' && (
              <button
                onClick={() => setShowGenerateFinalModal(true)}
                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[11px] shadow-2xs transition flex items-center gap-1"
                title="Jadikan hasil SO sebagai Beginning Stock bulan berikutnya"
              >
                <Sparkles className="w-3 h-3" />
                Generate Final SO
              </button>
            )}
          </div>
        </div>

        {/* View Tabs Navigation */}
        <div className="flex border-b border-slate-200 gap-2">
          <button
            onClick={() => setActiveTab('table')}
            className={`pb-2.5 px-3 text-xs font-bold transition flex items-center gap-1.5 border-b-2 cursor-pointer ${
              activeTab === 'table'
                ? 'border-amber-600 text-amber-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Table Inventory (18 Kolom)</span>
            <span className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded-full font-semibold">
              {filteredItems.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('movement')}
            className={`pb-2.5 px-3 text-xs font-bold transition flex items-center gap-1.5 border-b-2 cursor-pointer ${
              activeTab === 'movement'
                ? 'border-amber-600 text-amber-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Inventory Management (Report Pergerakan)</span>
          </button>

          <button
            onClick={() => setActiveTab('stockOpname')}
            className={`pb-2.5 px-3 text-xs font-bold transition flex items-center gap-1.5 border-b-2 cursor-pointer ${
              activeTab === 'stockOpname'
                ? 'border-amber-600 text-amber-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ClipboardCheck className="w-4 h-4" />
            <span>Stock Opname & Report SO</span>
            {stockOpnameReports.length > 0 && (
              <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.2 rounded-full font-bold">
                {stockOpnameReports.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* INVENTORY MANAGEMENT: 7 Total Pergerakan Barang Bulanan Report Cards */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-extrabold uppercase text-slate-500 tracking-wider flex items-center gap-1.5">
            <BarChart3 className="w-3.5 h-3.5 text-amber-600" />
            Report Pergerakan Barang Bulanan (Inventory Management) - {formatPeriodLabel(selectedPeriod)}
          </h2>
          <span className="text-[11px] text-slate-400">
            Dihitung otomatis dari mutasi barang selama satu bulan
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5 text-xs">
          {/* 1. Total Beginning */}
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-1">
            <span className="text-[10px] font-bold uppercase text-slate-400 block truncate">
              Total Beginning
            </span>
            <div className="text-sm font-black text-slate-900 truncate">
              {formatRupiah(movementReport.totalBeginningValue)}
            </div>
            <div className="text-[11px] text-slate-500 font-mono">
              {movementReport.totalBeginningUsage.toLocaleString()} Unit
            </div>
          </div>

          {/* 2. Total Inbound */}
          <div className="bg-white p-3 rounded-xl border border-emerald-200 bg-emerald-50/20 shadow-2xs space-y-1">
            <span className="text-[10px] font-bold uppercase text-emerald-700 block truncate">
              Total Inbound
            </span>
            <div className="text-sm font-black text-emerald-700 truncate">
              +{formatRupiah(movementReport.totalInboundValue)}
            </div>
            <div className="text-[11px] text-emerald-600 font-mono font-bold">
              +{movementReport.totalInboundUsage.toLocaleString()} Unit
            </div>
          </div>

          {/* 3. Total Outbond */}
          <div className="bg-white p-3 rounded-xl border border-rose-200 bg-rose-50/20 shadow-2xs space-y-1">
            <span className="text-[10px] font-bold uppercase text-rose-700 block truncate">
              Total Outbond
            </span>
            <div className="text-sm font-black text-rose-700 truncate">
              -{formatRupiah(movementReport.totalOutbondValue)}
            </div>
            <div className="text-[11px] text-rose-600 font-mono font-bold">
              -{movementReport.totalOutbondUsage.toLocaleString()} Unit
            </div>
          </div>

          {/* 4. Ending Inventory */}
          <div className="bg-white p-3 rounded-xl border border-amber-200 bg-amber-50/20 shadow-2xs space-y-1">
            <span className="text-[10px] font-bold uppercase text-amber-800 block truncate">
              Ending Inventory
            </span>
            <div className="text-sm font-black text-amber-900 truncate">
              {formatRupiah(movementReport.endingInventoryValue)}
            </div>
            <div className="text-[11px] text-amber-700 font-mono font-black">
              {movementReport.endingInventoryUsage.toLocaleString()} Unit
            </div>
          </div>

          {/* 5. Stock Opname */}
          <div className="bg-white p-3 rounded-xl border border-blue-200 bg-blue-50/20 shadow-2xs space-y-1">
            <span className="text-[10px] font-bold uppercase text-blue-700 block truncate">
              Stock Opname
            </span>
            <div className="text-sm font-black text-blue-800 truncate">
              {formatRupiah(movementReport.stockOpnameValue)}
            </div>
            <div className="text-[11px] text-blue-700 font-mono font-bold">
              {movementReport.stockOpnameUsage.toLocaleString()} Unit
            </div>
          </div>

          {/* 6. Total GAP */}
          <div
            className={`p-3 rounded-xl border shadow-2xs space-y-1 ${
              movementReport.totalGapValue !== 0
                ? 'bg-red-50/40 border-red-200'
                : 'bg-emerald-50/40 border-emerald-200'
            }`}
          >
            <span
              className={`text-[10px] font-bold uppercase block truncate ${
                movementReport.totalGapValue !== 0 ? 'text-red-700' : 'text-emerald-700'
              }`}
            >
              Total GAP
            </span>
            <div
              className={`text-sm font-black truncate ${
                movementReport.totalGapValue !== 0 ? 'text-red-700' : 'text-emerald-700'
              }`}
            >
              {formatRupiah(movementReport.totalGapValue)}
            </div>
            <div
              className={`text-[11px] font-mono font-bold ${
                movementReport.totalGapUsage < 0
                  ? 'text-red-600'
                  : movementReport.totalGapUsage > 0
                  ? 'text-blue-600'
                  : 'text-emerald-600'
              }`}
            >
              {movementReport.totalGapUsage > 0 ? `+${movementReport.totalGapUsage}` : movementReport.totalGapUsage} Unit
            </div>
          </div>

          {/* 7. GAP Percentage */}
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-1">
            <span className="text-[10px] font-bold uppercase text-slate-400 block truncate">
              GAP Percentage
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className={`text-base font-black ${
                  movementReport.gapPercentage === 0
                    ? 'text-emerald-600'
                    : movementReport.gapPercentage <= 3
                    ? 'text-amber-600'
                    : 'text-red-600'
                }`}
              >
                {movementReport.gapPercentage.toFixed(2)}%
              </span>
            </div>
            <div className="text-[10px] font-semibold text-slate-500">
              {movementReport.gapPercentage === 0
                ? '100% Akurat'
                : movementReport.gapPercentage <= 3
                ? 'Toleransi Wajar'
                : 'Perlu Audit'}
            </div>
          </div>

          {/* 8. Low Stock Alert Dashboard Card */}
          <div
            onClick={() => setFilterLowStockOnly((prev) => !prev)}
            className={`p-3 rounded-xl border shadow-2xs space-y-1 cursor-pointer transition select-none hover:shadow-md ${
              filterLowStockOnly
                ? 'ring-2 ring-red-500 bg-red-100/70 border-red-300'
                : movementReport.totalLowStockItems > 0
                ? 'bg-red-50/50 border-red-200 hover:bg-red-50'
                : 'bg-emerald-50/30 border-emerald-200 hover:bg-emerald-50/60'
            }`}
            title="Klik untuk memfilter barang yang stoknya di bawah safety stock level"
          >
            <div className="flex items-center justify-between">
              <span
                className={`text-[10px] font-bold uppercase block truncate ${
                  movementReport.totalLowStockItems > 0 ? 'text-red-700' : 'text-emerald-700'
                }`}
              >
                Low Stock Alert
              </span>
              {movementReport.totalLowStockItems > 0 ? (
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping inline-block" />
              ) : (
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
              )}
            </div>
            <div
              className={`text-sm font-black truncate flex items-center gap-1.5 ${
                movementReport.totalLowStockItems > 0 ? 'text-red-700' : 'text-emerald-700'
              }`}
            >
              <AlertTriangle
                className={`w-3.5 h-3.5 shrink-0 ${
                  movementReport.totalLowStockItems > 0 ? 'text-red-600' : 'text-emerald-600'
                }`}
              />
              <span>{movementReport.totalLowStockItems} Barang</span>
            </div>
            <div className="text-[10px] text-slate-500 font-semibold truncate">
              {movementReport.totalLowStockItems > 0
                ? filterLowStockOnly
                  ? '✓ Sedang Difilter'
                  : 'Di Bawah Safety Stock'
                : 'Semua Stok Aman'}
            </div>
          </div>
        </div>
      </div>

      {/* TAB 1: TABLE INVENTORY (18 Kolom Lengkap) */}
      {activeTab === 'table' && (
        <div className="space-y-4">
          {/* Search & Category Filter Toolbar */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 text-xs">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari SKU atau Nama Barang..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-amber-500 outline-hidden"
              />
            </div>

            {/* Category & Low Stock Filter Pills */}
            <div className="flex flex-wrap items-center gap-1 w-full md:w-auto overflow-x-auto">
              <button
                onClick={() => {
                  setSelectedCategory('All');
                  setFilterLowStockOnly(false);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                  selectedCategory === 'All' && !filterLowStockOnly
                    ? 'bg-amber-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Semua
              </button>
              {ITEM_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
                    selectedCategory === cat && !filterLowStockOnly
                      ? 'bg-amber-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}

              <span className="w-px h-5 bg-slate-200 mx-1 hidden sm:inline-block" />

              {/* Low Stock Quick Filter Pill */}
              <button
                onClick={() => setFilterLowStockOnly((prev) => !prev)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                  filterLowStockOnly
                    ? 'bg-red-600 text-white shadow-2xs ring-2 ring-red-400'
                    : movementReport.totalLowStockItems > 0
                    ? 'bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
                title="Filter hanya menampilkan item dengan stok di bawah safety stock level"
              >
                <AlertTriangle className={`w-3.5 h-3.5 ${filterLowStockOnly ? 'text-white' : 'text-amber-700'}`} />
                <span>Low Stock</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                    filterLowStockOnly ? 'bg-white/25 text-white' : 'bg-amber-200 text-amber-950'
                  }`}
                >
                  {movementReport.totalLowStockItems}
                </span>
              </button>
            </div>
          </div>

          {/* Low Stock Alert Notification Banner */}
          {movementReport.totalLowStockItems > 0 && (
            <div
              className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs transition ${
                filterLowStockOnly
                  ? 'bg-red-50/90 border-red-300 text-red-950'
                  : 'bg-amber-50/90 border-amber-300 text-amber-950'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    filterLowStockOnly
                      ? 'bg-red-100 text-red-700 border border-red-200'
                      : 'bg-amber-100 text-amber-700 border border-amber-200'
                  }`}
                >
                  <AlertTriangle className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <div className="font-extrabold text-sm flex items-center gap-2 flex-wrap">
                    <span>
                      Low Stock Alert: {movementReport.totalLowStockItems} Barang Di Bawah Safety Stock Level
                    </span>
                    {movementReport.totalOutOfStockItems > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-red-200 text-red-900 border border-red-300">
                        {movementReport.totalOutOfStockItems} Stok Habis (0 Unit)
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Barang yang disorot memiliki sisa stok gudang (Ending Inventory) yang telah mencapai atau jatuh di bawah batas minimum (Safety Stock Level). Segera ajukan Purchase Request untuk pengadaan ulang.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setFilterLowStockOnly((prev) => !prev)}
                className={`px-3.5 py-2 rounded-xl font-bold text-xs transition flex items-center gap-1.5 cursor-pointer shrink-0 shadow-xs ${
                  filterLowStockOnly
                    ? 'bg-slate-800 hover:bg-slate-900 text-white'
                    : 'bg-amber-600 hover:bg-amber-700 text-white'
                }`}
              >
                <Filter className="w-3.5 h-3.5" />
                <span>{filterLowStockOnly ? 'Tampilkan Semua Barang' : 'Filter Barang Low Stock'}</span>
              </button>
            </div>
          )}

          {/* 18-Column Structured Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto max-h-[72vh]">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-slate-800 text-white font-bold sticky top-0 z-20 text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="px-3 py-3 text-center border-r border-slate-700">No</th>
                    <th className="px-3 py-3 border-r border-slate-700">SKU</th>
                    <th className="px-3 py-3 border-r border-slate-700 min-w-[200px]">Item Name</th>
                    <th className="px-2 py-3 text-center border-r border-slate-700">Unit</th>
                    <th className="px-3 py-3 border-r border-slate-700">Category</th>
                    <th className="px-3 py-3 border-r border-slate-700 min-w-[150px]">Departemen Pengguna</th>
                    <th className="px-3 py-3 border-r border-slate-700 min-w-[160px]">Vendor Terkait</th>
                    <th className="px-3 py-3 text-right bg-slate-700/80 border-r border-slate-700">Price Budget</th>
                    <th className="px-3 py-3 text-right bg-slate-700/80 border-r border-slate-700">Price Actual</th>
                    <th className="px-2.5 py-3 text-right bg-slate-900 border-r border-slate-700">Beginning Usage</th>
                    <th className="px-3 py-3 text-right bg-slate-900 border-r border-slate-700">Beginning Value</th>
                    <th className="px-2.5 py-3 text-right bg-emerald-900/80 border-r border-emerald-800 text-emerald-200">Inbound Usage</th>
                    <th className="px-3 py-3 text-right bg-emerald-900/80 border-r border-emerald-800 text-emerald-200">Inbound Value</th>
                    <th className="px-2.5 py-3 text-right bg-rose-900/80 border-r border-rose-800 text-rose-200">Outbond Usage</th>
                    <th className="px-3 py-3 text-right bg-rose-900/80 border-r border-rose-800 text-rose-200">Outbond Value</th>
                    <th className="px-2.5 py-3 text-right bg-amber-900/90 border-r border-amber-800 text-amber-200">Ending Usage</th>
                    <th className="px-3 py-3 text-right bg-amber-900/90 border-r border-amber-800 text-amber-200">Ending Value</th>
                    <th className="px-2.5 py-3 text-right bg-blue-900/80 border-r border-blue-800 text-blue-200">SO Usage</th>
                    <th className="px-3 py-3 text-right bg-blue-900/80 border-r border-blue-800 text-blue-200">SO Value</th>
                    <th className="px-2.5 py-3 text-center border-r border-slate-700">GAP Usage</th>
                    <th className="px-3 py-3 text-right border-r border-slate-700">GAP Value</th>
                    {currentUser.position === 'Administrator' && (
                      <th className="px-2.5 py-3 text-center">Aksi</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={22} className="py-16 px-4 text-center">
                        <div className="max-w-md mx-auto space-y-3">
                          <div className="w-14 h-14 mx-auto bg-amber-50 rounded-2xl flex items-center justify-center border border-amber-200 text-amber-600 shadow-2xs">
                            <Layers className="w-7 h-7" />
                          </div>
                          <div>
                            <h3 className="font-bold text-base text-slate-800">
                              {activeItems.length === 0
                                ? 'Master Inventory Masih Kosong'
                                : filterLowStockOnly
                                ? 'Tidak Ada Barang Low Stock'
                                : 'Tidak Ada Barang yang Cocok'}
                            </h3>
                            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                              {activeItems.length === 0
                                ? `Belum ada list data barang untuk periode ${formatPeriodLabel(selectedPeriod)}. Anda dapat mengisi data dengan mengunggah template Excel atau menambah item secara manual.`
                                : filterLowStockOnly
                                ? 'Semua barang pada periode ini memiliki stok di atas batas safety stock level.'
                                : `Tidak ditemukan barang dengan kata kunci "${search}" atau kategori "${selectedCategory}".`}
                            </p>
                          </div>
                          {activeItems.length === 0 && (
                            <div className="flex items-center justify-center gap-2 pt-2 flex-wrap">
                              <button
                                onClick={() => downloadMasterInventoryTemplate(selectedPeriod)}
                                className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer flex items-center gap-1.5"
                              >
                                <Download className="w-4 h-4 text-rose-600" />
                                <span>Download Template</span>
                              </button>
                              <button
                                onClick={() => {
                                  setUploadedMasterFile(null);
                                  setUploadMasterParseResult(null);
                                  setUploadMasterError(null);
                                  setUploadImportMode('replace');
                                  setShowUploadMasterModal(true);
                                }}
                                className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer flex items-center gap-1.5"
                              >
                                <Upload className="w-4 h-4" />
                                <span>Upload Master Inventory</span>
                              </button>
                              {currentUser.position === 'Administrator' && (
                                <button
                                  onClick={handleOpenCreateModal}
                                  className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer flex items-center gap-1.5"
                                >
                                  <Plus className="w-4 h-4" />
                                  <span>Tambah Manual</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item, idx) => {
                      const isLow = isItemLowStock(item);
                      const isOutOfStock = item.endingInventory <= 0;
                      const safetyStockLevel = item.safetyStock ?? item.minStock ?? 10;

                      return (
                        <tr
                          key={item.sku}
                          className={`transition text-xs ${
                            isOutOfStock
                              ? 'bg-red-50/70 hover:bg-red-100/70 border-l-4 border-l-red-500'
                              : isLow
                              ? 'bg-amber-50/60 hover:bg-amber-100/60 border-l-4 border-l-amber-500'
                              : 'hover:bg-amber-50/30'
                          }`}
                        >
                          <td className="px-3 py-2 text-center text-slate-400 text-[11px] border-r border-slate-100">
                            {idx + 1}
                          </td>
                          <td className="px-3 py-2 font-mono font-bold text-slate-900 border-r border-slate-100">
                            {item.sku}
                          </td>
                          <td className="px-3 py-2 font-semibold text-slate-800 border-r border-slate-100">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span>{item.itemName}</span>
                              {isLow && (
                                <span
                                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-black border tracking-wider ${
                                    isOutOfStock
                                      ? 'bg-red-100 text-red-800 border-red-300 animate-pulse'
                                      : 'bg-amber-100 text-amber-900 border-amber-300'
                                  }`}
                                  title={`Stok saat ini (${item.endingInventory} ${item.unit}) berada di bawah Safety Stock (${safetyStockLevel} ${item.unit})`}
                                >
                                  <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
                                  {isOutOfStock ? 'STOK HABIS' : 'LOW STOCK'}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-2 py-2 text-center text-slate-600 border-r border-slate-100">
                            {item.unit}
                          </td>
                          <td className="px-3 py-2 border-r border-slate-100">
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                              {item.category}
                            </span>
                          </td>

                          {/* Departemen Pengguna */}
                          <td className="px-3 py-2 border-r border-slate-100">
                            <div className="flex flex-wrap gap-1 max-w-[200px]">
                              {item.allowedDepartments && item.allowedDepartments.length > 0 ? (
                                item.allowedDepartments.map((dept) => (
                                  <span
                                    key={dept}
                                    className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-800 border border-amber-200"
                                  >
                                    {dept}
                                  </span>
                                ))
                              ) : (
                                <span className="text-[11px] text-slate-400 italic">Semua Dept</span>
                              )}
                            </div>
                          </td>

                          {/* Vendor Terkait */}
                          <td className="px-3 py-2 border-r border-slate-100">
                            {item.vendor ? (
                              <span className="font-semibold text-slate-800 text-xs">
                                {item.vendor}
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-400 italic">-</span>
                            )}
                          </td>

                          <td className="px-3 py-2 text-right font-mono text-slate-700 border-r border-slate-100 bg-slate-50/50">
                            {formatRupiah(item.priceBudget || item.price)}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-slate-700 border-r border-slate-100 bg-slate-50/50">
                            {formatRupiah(item.priceActual || item.price)}
                          </td>

                          {/* Beginning */}
                          <td className="px-2.5 py-2 text-right font-mono text-slate-800 border-r border-slate-100 bg-slate-50/30 font-semibold">
                            {item.beginningInventory}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-slate-800 border-r border-slate-100 bg-slate-50/30">
                            {formatRupiah(item.beginningValue || 0)}
                          </td>

                          {/* Inbound */}
                          <td className="px-2.5 py-2 text-right font-mono font-bold text-emerald-700 border-r border-slate-100 bg-emerald-50/20">
                            {item.inbound}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-emerald-800 border-r border-slate-100 bg-emerald-50/20">
                            {formatRupiah(item.inboundValue || 0)}
                          </td>

                          {/* Outbond */}
                          <td className="px-2.5 py-2 text-right font-mono font-bold text-rose-700 border-r border-slate-100 bg-rose-50/20">
                            {item.outbond}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-rose-800 border-r border-slate-100 bg-rose-50/20">
                            {formatRupiah(item.outbondValue || 0)}
                          </td>

                          {/* Ending Inventory */}
                          <td
                            className={`px-2.5 py-2 text-right font-mono font-black border-r border-slate-100 ${
                              isOutOfStock
                                ? 'bg-red-100 text-red-900'
                                : isLow
                                ? 'bg-amber-100/80 text-amber-950'
                                : 'bg-amber-50/30 text-amber-900'
                            }`}
                          >
                            <div className="flex flex-col items-end">
                              <span className={`text-xs ${isOutOfStock ? 'text-red-700 font-black' : isLow ? 'text-amber-900 font-black' : 'text-slate-900'}`}>
                                {item.endingInventory}
                              </span>
                              <span
                                className={`text-[9px] font-sans font-semibold ${
                                  isLow ? 'text-amber-800 font-bold' : 'text-slate-400'
                                }`}
                                title="Batas Minimum / Safety Stock"
                              >
                                Safety: {safetyStockLevel}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-amber-950 border-r border-slate-100 bg-amber-50/30">
                            {formatRupiah(item.endingValue || 0)}
                          </td>

                          {/* SO (Stock Opname) */}
                          <td className="px-2.5 py-2 text-right font-mono font-bold text-blue-700 border-r border-slate-100 bg-blue-50/20">
                            {item.stockOpname}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-blue-800 border-r border-slate-100 bg-blue-50/20">
                            {formatRupiah(item.soValue || 0)}
                          </td>

                          {/* GAP Usage (SO - Ending) */}
                          <td className="px-2.5 py-2 text-center border-r border-slate-100">
                            <span
                              className={`px-2 py-0.5 rounded-full font-mono font-extrabold text-[10px] ${
                                item.gap < 0
                                  ? 'bg-red-100 text-red-700 border border-red-200'
                                  : item.gap > 0
                                  ? 'bg-blue-100 text-blue-700 border border-blue-200'
                                  : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                              }`}
                            >
                              {item.gap > 0 ? `+${item.gap}` : item.gap}
                            </span>
                          </td>

                          {/* GAP Value (Ending Value - SO Value) */}
                          <td className="px-3 py-2 text-right font-mono font-bold border-r border-slate-100">
                            <span
                              className={
                                (item.gapValue || 0) > 0
                                  ? 'text-red-600'
                                  : (item.gapValue || 0) < 0
                                  ? 'text-blue-600'
                                  : 'text-emerald-600'
                              }
                            >
                              {formatRupiah(item.gapValue || 0)}
                            </span>
                          </td>

                          {/* Action */}
                          {currentUser.position === 'Administrator' && (
                            <td className="px-2.5 py-2 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => handleOpenEditModal(item)}
                                  className="p-1 text-slate-400 hover:text-amber-600 hover:bg-slate-100 rounded-md transition"
                                  title="Ubah Item Master (Budget / Actual Price)"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => setItemToDelete(item)}
                                  className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition"
                                  title="Hapus Item ini dari Master Inventory"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>

                {/* Table Footer / Grand Total Summary */}
                {filteredItems.length > 0 && (
                  <tfoot className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-300 text-xs">
                    <tr>
                      <td colSpan={5} className="px-3 py-3 text-right uppercase tracking-wider text-[11px]">
                        Total Summary ({filteredItems.length} Barang):
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-[11px] text-slate-600">-</td>
                      <td className="px-3 py-3 text-right font-mono text-[11px] text-slate-600">-</td>
                      <td className="px-2.5 py-3 text-right font-mono text-slate-900">
                        {movementReport.totalBeginningUsage}
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-slate-900">
                        {formatRupiah(movementReport.totalBeginningValue)}
                      </td>
                      <td className="px-2.5 py-3 text-right font-mono text-emerald-700">
                        +{movementReport.totalInboundUsage}
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-emerald-700">
                        {formatRupiah(movementReport.totalInboundValue)}
                      </td>
                      <td className="px-2.5 py-3 text-right font-mono text-rose-700">
                        -{movementReport.totalOutbondUsage}
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-rose-700">
                        {formatRupiah(movementReport.totalOutbondValue)}
                      </td>
                      <td className="px-2.5 py-3 text-right font-mono text-amber-900">
                        {movementReport.endingInventoryUsage}
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-amber-900">
                        {formatRupiah(movementReport.endingInventoryValue)}
                      </td>
                      <td className="px-2.5 py-3 text-right font-mono text-blue-700">
                        {movementReport.stockOpnameUsage}
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-blue-700">
                        {formatRupiah(movementReport.stockOpnameValue)}
                      </td>
                      <td className="px-2.5 py-3 text-center font-mono">
                        {movementReport.totalGapUsage > 0 ? `+${movementReport.totalGapUsage}` : movementReport.totalGapUsage}
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-slate-900">
                        {formatRupiah(movementReport.totalGapValue)}
                      </td>
                      {currentUser.position === 'Administrator' && <td />}
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: INVENTORY MANAGEMENT (Detail Report Pergerakan) */}
      {activeTab === 'movement' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-amber-600" />
                  Laporan Evaluasi Pergerakan Barang Bulanan
                </h3>
                <p className="text-xs text-slate-500">
                  Ringkasan evaluasi akuntansi inventaris untuk periode {formatPeriodLabel(selectedPeriod)}
                </p>
              </div>
              <button
                onClick={() => exportMasterInventoryToExcel(activeItems, formatPeriodLabel(selectedPeriod))}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition shadow-2xs"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Export XLS
              </button>
            </div>

            {/* Breakdown Per Kategori Barang */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase text-slate-600">
                Mutasi Nilai Stok per Kategori Barang ({formatPeriodLabel(selectedPeriod)})
              </h4>
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-700 uppercase font-bold text-[11px] border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2.5">Kategori</th>
                      <th className="px-3 py-2.5 text-center">Jumlah SKU</th>
                      <th className="px-3 py-2.5 text-right">Beginning Value</th>
                      <th className="px-3 py-2.5 text-right text-emerald-700">Inbound Value</th>
                      <th className="px-3 py-2.5 text-right text-rose-700">Outbond Value</th>
                      <th className="px-3 py-2.5 text-right text-amber-800">Ending Value</th>
                      <th className="px-3 py-2.5 text-right text-blue-700">SO Value</th>
                      <th className="px-3 py-2.5 text-right">Selisih GAP Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {ITEM_CATEGORIES.map((cat) => {
                      const catItems = activeItems.filter((i) => i.category === cat);
                      if (catItems.length === 0) return null;
                      const begVal = catItems.reduce((acc, i) => acc + (i.beginningValue || 0), 0);
                      const inVal = catItems.reduce((acc, i) => acc + (i.inboundValue || 0), 0);
                      const outVal = catItems.reduce((acc, i) => acc + (i.outbondValue || 0), 0);
                      const endVal = catItems.reduce((acc, i) => acc + (i.endingValue || 0), 0);
                      const soVal = catItems.reduce((acc, i) => acc + (i.soValue || 0), 0);
                      const gapVal = endVal - soVal;

                      return (
                        <tr key={cat} className="hover:bg-slate-50/60">
                          <td className="px-3 py-2 font-bold text-slate-900">{cat}</td>
                          <td className="px-3 py-2 text-center text-slate-600">{catItems.length} Item</td>
                          <td className="px-3 py-2 text-right font-mono text-slate-700">{formatRupiah(begVal)}</td>
                          <td className="px-3 py-2 text-right font-mono text-emerald-700 font-bold">+{formatRupiah(inVal)}</td>
                          <td className="px-3 py-2 text-right font-mono text-rose-700 font-bold">-{formatRupiah(outVal)}</td>
                          <td className="px-3 py-2 text-right font-mono text-amber-900 font-bold">{formatRupiah(endVal)}</td>
                          <td className="px-3 py-2 text-right font-mono text-blue-700">{formatRupiah(soVal)}</td>
                          <td className="px-3 py-2 text-right font-mono font-bold">
                            <span className={gapVal > 0 ? 'text-red-600' : gapVal < 0 ? 'text-blue-600' : 'text-emerald-600'}>
                              {formatRupiah(gapVal)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Audit & Compliance Insights */}
            <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-4 text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold text-amber-900">
                <Info className="w-4 h-4 text-amber-600" />
                Catatan Evaluasi Audit Inventaris:
              </div>
              <ul className="list-disc list-inside text-amber-800 space-y-1">
                <li>
                  Total Ending Inventory buku saat ini bernilai <strong>{formatRupiah(movementReport.endingInventoryValue)}</strong> ({movementReport.endingInventoryUsage.toLocaleString()} Unit).
                </li>
                <li>
                  Hasil perhitungan fisik Stock Opname adalah <strong>{formatRupiah(movementReport.stockOpnameValue)}</strong> ({movementReport.stockOpnameUsage.toLocaleString()} Unit).
                </li>
                <li>
                  Selisih GAP sebesar <strong>{formatRupiah(movementReport.totalGapValue)}</strong> dengan rasio selisih <strong>{movementReport.gapPercentage.toFixed(2)}%</strong>.
                </li>
                <li>
                  Terdapat <strong>{movementReport.itemsWithVariance} barang</strong> yang tercatat memiliki selisih antara saldo buku dan hasil hitung fisik.
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: STOCK OPNAME & REPORT SO */}
      {activeTab === 'stockOpname' && (
        <div className="space-y-4">
          {/* Card Action Start SO */}
          <div className="bg-gradient-to-r from-blue-900 to-indigo-900 rounded-2xl p-5 text-white shadow-md flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-white/10 rounded-xl text-blue-200">
                  <ClipboardCheck className="w-5 h-5" />
                </span>
                <h3 className="text-base font-bold text-white">
                  Stock Opname Akhir Bulan ({formatPeriodLabel(selectedPeriod)})
                </h3>
              </div>
              <p className="text-xs text-blue-150">
                Fungsi untuk menghitung dan mencatat fisik seluruh list barang gudang pada akhir bulan. Hasil SO akan menghasilkan dokumen Report SO yang ditinjau dan disetujui.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => downloadSOTemplate(activeItems, selectedPeriod)}
                className="px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl transition shadow-xs flex items-center gap-1.5 cursor-pointer border border-white/20"
                title="Download Template Excel (.xlsx) untuk Stock Opname"
              >
                <Download className="w-4 h-4 text-blue-200" />
                <span>Download Template SO</span>
              </button>

              <button
                onClick={() => {
                  setUploadedFile(null);
                  setUploadParseResult(null);
                  setUploadError(null);
                  setShowUploadModal(true);
                }}
                className="px-4 py-2.5 bg-indigo-500 hover:bg-indigo-400 text-white font-bold text-xs rounded-xl transition shadow-xs flex items-center gap-1.5 cursor-pointer"
                title="Upload hasil pencatatan fisik SO dari file template"
              >
                <Upload className="w-4 h-4" />
                <span>Upload Hasil SO</span>
              </button>

              <button
                onClick={handleOpenStartSO}
                className="px-4 py-2.5 bg-blue-500 hover:bg-blue-400 text-white font-bold text-xs rounded-xl transition shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <ClipboardCheck className="w-4 h-4" />
                <span>Start SO Bulan Ini</span>
              </button>

              {activePeriodSOReport && activePeriodSOReport.status === 'Disetujui' && (
                <button
                  onClick={() => setShowGenerateFinalModal(true)}
                  className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-xs rounded-xl transition shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Generate Final SO</span>
                </button>
              )}
            </div>
          </div>

          {/* List of Report SO */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <CheckCheck className="w-4 h-4 text-emerald-600" />
                Daftar Dokumen Report SO per Periode
              </h3>
              <span className="text-xs text-slate-500">
                Total {stockOpnameReports.length} Laporan Tersimpan
              </span>
            </div>

            {stockOpnameReports.length === 0 ? (
              <div className="text-center py-10 text-slate-400 space-y-2">
                <ClipboardCheck className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-xs">Belum ada dokumen Report SO yang dibuat.</p>
                <button
                  onClick={handleOpenStartSO}
                  className="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg shadow-xs hover:bg-blue-700 transition"
                >
                  Mulai Start SO Sekarang
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {stockOpnameReports.map((report) => {
                  const isCurrent = report.period === selectedPeriod;
                  return (
                    <div
                      key={report.id}
                      className={`rounded-xl border p-4 transition space-y-3 ${
                        isCurrent
                          ? 'border-blue-400 bg-blue-50/20 ring-1 ring-blue-300'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-xs text-slate-900">{report.id}</span>
                            {isCurrent && (
                              <span className="text-[10px] bg-blue-600 text-white font-extrabold px-1.5 py-0.2 rounded">
                                Periode Aktif
                              </span>
                            )}
                          </div>
                          <h4 className="text-sm font-black text-slate-900 mt-0.5">{report.periodLabel}</h4>
                          <span className="text-[11px] text-slate-400">Tanggal: {report.conductedDate}</span>
                        </div>

                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            report.status === 'Disetujui' || report.status === 'Finalized (Generated)'
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                              : report.status === 'Menunggu Review'
                              ? 'bg-amber-100 text-amber-800 border-amber-200'
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          {report.status}
                        </span>
                      </div>

                      <div className="bg-slate-50 rounded-lg p-2.5 space-y-1 text-xs border border-slate-100">
                        <div className="flex justify-between text-slate-600">
                          <span>Total Item:</span>
                          <span className="font-semibold text-slate-800">{report.items.length} Item</span>
                        </div>
                        <div className="flex justify-between text-slate-600">
                          <span>Nilai Fisik SO:</span>
                          <span className="font-bold text-blue-700">{formatRupiah(report.totalPhysicalValue)}</span>
                        </div>
                        <div className="flex justify-between text-slate-600">
                          <span>Total Selisih GAP:</span>
                          <span
                            className={`font-bold ${
                              report.totalGapValue !== 0 ? 'text-red-600' : 'text-emerald-600'
                            }`}
                          >
                            {formatRupiah(report.totalGapValue)} ({report.gapPercentage.toFixed(2)}%)
                          </span>
                        </div>
                        <div className="flex justify-between text-slate-500 text-[11px] pt-1 border-t border-slate-200">
                          <span>Checker:</span>
                          <span className="font-medium text-slate-700">{report.checkerName}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 pt-1">
                        <button
                          onClick={() => {
                            setSelectedReportToReview(report);
                            setShowReviewSOModal(true);
                          }}
                          className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition text-center shadow-2xs"
                        >
                          Buka Report SO
                        </button>

                        {report.status === 'Disetujui' && (
                          <button
                            onClick={() => {
                              setSelectedPeriod(report.period);
                              setShowGenerateFinalModal(true);
                            }}
                            className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition shadow-2xs"
                            title="Generate Final SO ke bulan berikutnya"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: START SO (PENCATATAN HITUNG FISIK AKHIR BULAN) */}
      {showStartSOModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-2 bg-blue-100 rounded-lg text-blue-700">
                    <ClipboardCheck className="w-4 h-4" />
                  </span>
                  <h3 className="font-bold text-sm text-slate-900">
                    Pencatatan Fisik Stock Opname (Start SO) - {formatPeriodLabel(selectedPeriod)}
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Catat hitung fisik keseluruhan list barang pada akhir bulan untuk menghasilkan dokumen Report SO.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowStartSOModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Subheader Details */}
            <div className="p-4 bg-white border-b border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block text-slate-500 font-semibold mb-1">Tanggal Pelaksanaan SO:</label>
                <input
                  type="date"
                  value={soFormDate}
                  onChange={(e) => setSoFormDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-500 font-semibold mb-1">Nama Petugas Checker:</label>
                <input
                  type="text"
                  value={soFormChecker}
                  onChange={(e) => setSoFormChecker(e.target.value)}
                  placeholder="Nama checker fisik..."
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden"
                />
              </div>
              <div>
                <label className="block text-slate-500 font-semibold mb-1">Supervisor / Saksi:</label>
                <input
                  type="text"
                  value={soFormSupervisor}
                  onChange={(e) => setSoFormSupervisor(e.target.value)}
                  placeholder="Nama supervisor..."
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden"
                />
              </div>
            </div>

            {/* Search & Quick Helpers */}
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 flex-1">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={soSearch}
                    onChange={(e) => setSoSearch(e.target.value)}
                    placeholder="Filter barang..."
                    className="w-full pl-8 pr-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs outline-hidden"
                  />
                </div>
                <select
                  value={soCategoryFilter}
                  onChange={(e) => setSoCategoryFilter(e.target.value)}
                  className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs"
                >
                  <option value="All">Semua Kategori</option>
                  {ITEM_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => downloadSOTemplate(activeItems, selectedPeriod)}
                  className="px-2.5 py-1 bg-white hover:bg-slate-100 text-blue-700 border border-blue-200 rounded-lg font-semibold transition flex items-center gap-1 cursor-pointer"
                  title="Download template Excel untuk diisi di spreadsheet"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Template SO</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowStartSOModal(false);
                    setUploadedFile(null);
                    setUploadParseResult(null);
                    setUploadError(null);
                    setShowUploadModal(true);
                  }}
                  className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg font-semibold transition flex items-center gap-1 cursor-pointer"
                  title="Upload template Excel yang telah diisi"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload File</span>
                </button>
                <button
                  type="button"
                  onClick={handleAutofillSOWithSystem}
                  className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg font-semibold transition cursor-pointer"
                  title="Isi fisik sesuai saldo sistem untuk percepat input"
                >
                  Isi Sesuai Stok Buku
                </button>
                <button
                  type="button"
                  onClick={handleResetSOToZero}
                  className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg font-semibold transition cursor-pointer"
                >
                  Reset 0
                </button>
              </div>
            </div>

            {/* Item Table to Count Physical Stock */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead className="bg-slate-800 text-white font-bold text-[11px] sticky top-0">
                    <tr>
                      <th className="px-3 py-2">SKU</th>
                      <th className="px-3 py-2">Nama Barang</th>
                      <th className="px-2 py-2 text-center">Unit</th>
                      <th className="px-3 py-2 text-right">Stok Sistem (Buku)</th>
                      <th className="px-3 py-2 text-center bg-blue-900 w-32">Hasil Fisik (SO)</th>
                      <th className="px-3 py-2 text-center">Selisih (GAP)</th>
                      <th className="px-3 py-2">Catatan Kondisi Fisik</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {activeItems
                      .filter((it) => {
                        const mCat = soCategoryFilter === 'All' || it.category === soCategoryFilter;
                        const mS = it.itemName.toLowerCase().includes(soSearch.toLowerCase()) || it.sku.toLowerCase().includes(soSearch.toLowerCase());
                        return mCat && mS;
                      })
                      .map((item) => {
                        const data = soCounts[item.sku] || { count: item.endingInventory, notes: '' };
                        const countVal = Number(data.count) || 0;
                        const gapVal = countVal - item.endingInventory;

                        return (
                          <tr key={item.sku} className="hover:bg-slate-50">
                            <td className="px-3 py-2 font-mono font-bold text-slate-900">{item.sku}</td>
                            <td className="px-3 py-2 font-semibold text-slate-800">{item.itemName}</td>
                            <td className="px-2 py-2 text-center text-slate-500">{item.unit}</td>
                            <td className="px-3 py-2 text-right font-mono font-bold text-amber-900 bg-amber-50/30">
                              {item.endingInventory}
                            </td>

                            {/* Input Fisik */}
                            <td className="px-3 py-1.5 text-center bg-blue-50/40">
                              <input
                                type="number"
                                min="0"
                                value={data.count}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value, 10);
                                  setSoCounts((prev) => ({
                                    ...prev,
                                    [item.sku]: {
                                      ...prev[item.sku],
                                      count: isNaN(val) ? 0 : val,
                                    },
                                  }));
                                }}
                                className="w-24 px-2 py-1 text-center font-mono font-bold border border-blue-400 bg-white rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden"
                              />
                            </td>

                            {/* GAP Badge */}
                            <td className="px-3 py-2 text-center">
                              <span
                                className={`px-2 py-0.5 rounded-full font-mono font-extrabold text-[10px] ${
                                  gapVal < 0
                                    ? 'bg-red-100 text-red-700 border border-red-200'
                                    : gapVal > 0
                                    ? 'bg-blue-100 text-blue-700 border border-blue-200'
                                    : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                }`}
                              >
                                {gapVal > 0 ? `+${gapVal}` : gapVal}
                              </span>
                            </td>

                            {/* Notes */}
                            <td className="px-3 py-1.5">
                              <input
                                type="text"
                                value={data.notes}
                                onChange={(e) => {
                                  setSoCounts((prev) => ({
                                    ...prev,
                                    [item.sku]: {
                                      ...prev[item.sku],
                                      notes: e.target.value,
                                    },
                                  }));
                                }}
                                placeholder="Misal: kondisi baik / ada rusak..."
                                className="w-full px-2 py-1 text-xs border border-slate-200 rounded-lg outline-hidden"
                              />
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="text-slate-500">
                Pencatatan hitung fisik untuk seluruh barang ({activeItems.length} SKU).
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowStartSOModal(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition"
                >
                  Batal
                </button>

                <button
                  type="button"
                  onClick={() => handleSubmitSOForm(false)}
                  className="px-4 py-2 font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-xl transition"
                >
                  Simpan Draft
                </button>

                <button
                  type="button"
                  onClick={() => handleSubmitSOForm(true)}
                  className="px-5 py-2 font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs transition flex items-center gap-1.5"
                >
                  <ClipboardCheck className="w-4 h-4" />
                  <span>Ajukan Report SO</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: TINJAU / REVIEW REPORT SO */}
      {showReviewSOModal && selectedReportToReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-2 bg-emerald-100 rounded-lg text-emerald-700">
                    <CheckCheck className="w-4 h-4" />
                  </span>
                  <h3 className="font-bold text-sm text-slate-900">
                    Dokumen Report SO: {selectedReportToReview.id} ({selectedReportToReview.periodLabel})
                  </h3>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                      selectedReportToReview.status === 'Disetujui' || selectedReportToReview.status === 'Finalized (Generated)'
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                        : selectedReportToReview.status === 'Menunggu Review'
                        ? 'bg-amber-100 text-amber-800 border-amber-200'
                        : 'bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    {selectedReportToReview.status}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tinjau kebenaran fisik stok sebelum disetujui. Setelah disetujui, hasil SO akan aktif di Table Inventory.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowReviewSOModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Info Summary Grid */}
            <div className="p-4 bg-white border-b border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Nilai Buku Sistem</span>
                <span className="font-extrabold text-slate-900 text-sm">
                  {formatRupiah(selectedReportToReview.totalSystemValue)}
                </span>
                <div className="text-[10px] text-slate-500">
                  {selectedReportToReview.totalSystemUsage} Unit
                </div>
              </div>

              <div className="bg-blue-50/50 p-2.5 rounded-xl border border-blue-200">
                <span className="text-[10px] uppercase font-bold text-blue-700 block">Hasil Fisik SO</span>
                <span className="font-extrabold text-blue-800 text-sm">
                  {formatRupiah(selectedReportToReview.totalPhysicalValue)}
                </span>
                <div className="text-[10px] text-blue-600">
                  {selectedReportToReview.totalPhysicalUsage} Unit
                </div>
              </div>

              <div
                className={`p-2.5 rounded-xl border ${
                  selectedReportToReview.totalGapValue !== 0
                    ? 'bg-red-50/50 border-red-200 text-red-700'
                    : 'bg-emerald-50/50 border-emerald-200 text-emerald-700'
                }`}
              >
                <span className="text-[10px] uppercase font-bold block">Total Selisih GAP</span>
                <span className="font-extrabold text-sm block">
                  {formatRupiah(selectedReportToReview.totalGapValue)}
                </span>
                <div className="text-[10px] font-semibold">
                  {selectedReportToReview.gapPercentage.toFixed(2)}% dari Nilai Buku
                </div>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Pelaksana SO</span>
                <span className="font-bold text-slate-800 block truncate">
                  {selectedReportToReview.checkerName}
                </span>
                <div className="text-[10px] text-slate-500">
                  Saksi: {selectedReportToReview.supervisorName || '-'}
                </div>
              </div>
            </div>

            {/* Variance Items Table */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700">Rincian Fisik & Selisih per Barang:</span>
                <span className="text-slate-400">Total {selectedReportToReview.items.length} Item Terhitung</span>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead className="bg-slate-800 text-white font-bold text-[11px] sticky top-0">
                    <tr>
                      <th className="px-3 py-2">SKU</th>
                      <th className="px-3 py-2">Nama Barang</th>
                      <th className="px-2 py-2 text-center">Unit</th>
                      <th className="px-3 py-2 text-right">Stok Sistem</th>
                      <th className="px-3 py-2 text-right bg-blue-900 text-blue-200">Fisik SO</th>
                      <th className="px-3 py-2 text-center">Selisih Fisik</th>
                      <th className="px-3 py-2 text-right">Nilai Selisih (GAP Value)</th>
                      <th className="px-3 py-2">Catatan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {selectedReportToReview.items.map((it) => {
                      return (
                        <tr key={it.sku} className="hover:bg-slate-50">
                          <td className="px-3 py-2 font-mono font-bold text-slate-900">{it.sku}</td>
                          <td className="px-3 py-2 font-semibold text-slate-800">{it.itemName}</td>
                          <td className="px-2 py-2 text-center text-slate-500">{it.unit}</td>
                          <td className="px-3 py-2 text-right font-mono text-slate-700">{it.systemStock}</td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-blue-700 bg-blue-50/20">
                            {it.physicalCount}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full font-mono font-extrabold text-[10px] ${
                                it.gapUsage < 0
                                  ? 'bg-red-100 text-red-700 border border-red-200'
                                  : it.gapUsage > 0
                                  ? 'bg-blue-100 text-blue-700 border border-blue-200'
                                  : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                              }`}
                            >
                              {it.gapUsage > 0 ? `+${it.gapUsage}` : it.gapUsage}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-bold">
                            <span
                              className={
                                it.gapValue > 0
                                  ? 'text-red-600'
                                  : it.gapValue < 0
                                  ? 'text-blue-600'
                                  : 'text-emerald-600'
                              }
                            >
                              {formatRupiah(it.gapValue)}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-slate-500">{it.notes || '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="text-slate-500">
                Persetujuan akan memutakhirkan kolom SO USAGE & SO VALUE pada Table Inventory.
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowReviewSOModal(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition"
                >
                  Tutup
                </button>

                {selectedReportToReview.status === 'Menunggu Review' && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleRejectSO(selectedReportToReview)}
                      className="px-4 py-2 font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition cursor-pointer"
                    >
                      Minta Hitung Ulang
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApproveSO(selectedReportToReview)}
                      className="px-5 py-2 font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Setujui Report SO</span>
                    </button>
                  </>
                )}

                {selectedReportToReview.status === 'Disetujui' && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowReviewSOModal(false);
                      setShowGenerateFinalModal(true);
                    }}
                    className="px-5 py-2 font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition flex items-center gap-1.5"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Lanjut Generate Final SO</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: GENERATE FINAL SO */}
      {showGenerateFinalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 p-5 space-y-4">
            <div className="flex items-center gap-3 text-emerald-600 pb-3 border-b border-slate-100">
              <div className="p-2.5 bg-emerald-100 rounded-xl">
                <Sparkles className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Generate Final SO Akhir Bulan
                </h3>
                <p className="text-xs text-slate-500">
                  Periode Asal: {formatPeriodLabel(selectedPeriod)}
                </p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-3.5 space-y-2 text-xs border border-slate-200">
              <div className="flex justify-between">
                <span className="text-slate-500">Periode Tujuan (Bulan Berikutnya):</span>
                <span className="font-bold text-slate-900 font-mono">
                  {formatPeriodLabel(getNextPeriod(selectedPeriod))}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Total Item Diproses:</span>
                <span className="font-semibold text-slate-800">{activeItems.length} SKU</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Nilai Fisik SO yang Ditetapkan:</span>
                <span className="font-bold text-emerald-700">
                  {formatRupiah(movementReport.stockOpnameValue)}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 pt-1 border-t border-slate-200">
                Fungsi ini akan mengubah hasil fisik SO akhir bulan <strong>{formatPeriodLabel(selectedPeriod)}</strong> menjadi <strong>Stock Beginning</strong> di bulan berikutnya (<strong>{formatPeriodLabel(getNextPeriod(selectedPeriod))}</strong>). Inbound & Outbond bulan berikutnya akan dimulai dari 0.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowGenerateFinalModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmGenerateFinalSO}
                className="px-5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCheck className="w-4 h-4" />
                <span>Konfirmasi Generate Final SO</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: TAMBAH / UBAH MASTER ITEM */}
      {showItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <form
            onSubmit={handleSaveModalItem}
            className="bg-white rounded-2xl shadow-xl max-w-lg w-full border border-slate-200 p-6 space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-900">
                {isEditingExisting ? 'Ubah Data Master Item' : 'Tambah Item Baru ke Master Inventory'}
              </h3>
              <button
                type="button"
                onClick={() => setShowItemModal(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Category (Kategori Barang) *
                </label>
                <select
                  value={modalItemData.category}
                  onChange={(e) => {
                    const newCategory = e.target.value as ItemCategory;
                    if (!isEditingExisting) {
                      const nextSku = getNextQueuedSKU(newCategory, activeItems);
                      setModalItemData({
                        ...modalItemData,
                        category: newCategory,
                        sku: nextSku,
                      });
                    } else {
                      setModalItemData({ ...modalItemData, category: newCategory });
                    }
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-hidden bg-white font-medium"
                >
                  {ITEM_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat} ({CATEGORY_SKU_PREFIX[cat] || 'SKU'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-semibold text-slate-700">SKU Code *</label>
                  {!isEditingExisting && (
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded flex items-center gap-1">
                      Auto Queue
                    </span>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={modalItemData.sku || ''}
                    disabled={isEditingExisting}
                    onChange={(e) => setModalItemData({ ...modalItemData, sku: e.target.value })}
                    placeholder="e.g. DRY-001"
                    className="w-full pl-3 pr-8 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-hidden font-mono font-bold text-slate-900 disabled:bg-slate-100 disabled:text-slate-500"
                  />
                  {!isEditingExisting && (
                    <button
                      type="button"
                      onClick={() => {
                        const targetCat = (modalItemData.category || 'Dry Item') as ItemCategory;
                        const next = getNextQueuedSKU(targetCat, activeItems);
                        setModalItemData({ ...modalItemData, sku: next });
                      }}
                      title="Hitung ulang antrean nomor SKU terakhir"
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-amber-600 hover:bg-slate-100 rounded transition cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                {!isEditingExisting && (
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    Antrean otomatis dari nomor terakhir kategori {modalItemData.category}
                  </span>
                )}
              </div>

              <div className="col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">Nama Barang</label>
                <input
                  type="text"
                  required
                  value={modalItemData.itemName || ''}
                  onChange={(e) => setModalItemData({ ...modalItemData, itemName: e.target.value })}
                  placeholder="e.g. Daging Sapi Tenderloin Cut 1kg"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Satuan (Unit)</label>
                <input
                  type="text"
                  required
                  value={modalItemData.unit || ''}
                  onChange={(e) => setModalItemData({ ...modalItemData, unit: e.target.value })}
                  placeholder="Kg / Pack / Pcs / Botol"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Safety Stock Level (Batas Minimum Stok)
                </label>
                <input
                  type="number"
                  min="0"
                  value={modalItemData.safetyStock ?? modalItemData.minStock ?? 10}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10) || 0;
                    setModalItemData({ ...modalItemData, minStock: val, safetyStock: val });
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-hidden font-mono"
                  placeholder="10"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Batas peringatan Low Stock Alert jika stok akhir berada di bawah atau sama dengan nilai ini.
                </span>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Price Budget (IDR)
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={modalItemData.priceBudget || ''}
                  onChange={(e) =>
                    setModalItemData({
                      ...modalItemData,
                      priceBudget: parseInt(e.target.value, 10) || 0,
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-hidden font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Price Actual (IDR)
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={modalItemData.priceActual || ''}
                  onChange={(e) =>
                    setModalItemData({
                      ...modalItemData,
                      priceActual: parseInt(e.target.value, 10) || 0,
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-hidden font-mono"
                />
              </div>

              <div className="col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">Vendor Terkait</label>
                <input
                  type="text"
                  list="vendor-list-options"
                  value={modalItemData.vendor || ''}
                  onChange={(e) => setModalItemData({ ...modalItemData, vendor: e.target.value })}
                  placeholder="Pilih atau ketik nama vendor..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-hidden"
                />
                <datalist id="vendor-list-options">
                  {vendors.map((v) => (
                    <option key={v.id} value={v.namaVendor} />
                  ))}
                </datalist>
              </div>

              <div className="col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">
                  Departemen Pengguna
                </label>
                <div className="flex flex-wrap gap-2 pt-0.5">
                  {(['Kitchen', 'Bar', 'Pastry', 'Floor & Operations'] as DepartmentName[]).map((dept) => {
                    const isChecked = (modalItemData.allowedDepartments || []).includes(dept);
                    return (
                      <label
                        key={dept}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition ${
                          isChecked
                            ? 'bg-amber-100 border-amber-300 text-amber-900'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            const current = modalItemData.allowedDepartments || [];
                            const updated = e.target.checked
                              ? [...current, dept]
                              : current.filter((d) => d !== dept);
                            setModalItemData({
                              ...modalItemData,
                              allowedDepartments: updated.length > 0 ? updated : [dept],
                            });
                          }}
                          className="rounded text-amber-600 focus:ring-amber-500"
                        />
                        <span>{dept}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowItemModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-xs transition cursor-pointer"
              >
                {isEditingExisting ? 'Simpan Perubahan' : 'Tambah Item'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: UPLOAD HASIL SO MELALUI TEMPLATE */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-2 bg-indigo-100 rounded-lg text-indigo-700">
                    <FileUp className="w-5 h-5" />
                  </span>
                  <h3 className="font-bold text-sm text-slate-900">
                    Upload Hasil Stock Opname melalui Template
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                    Periode: {formatPeriodLabel(selectedPeriod)}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Import hasil hitung fisik di lapangan secara instan menggunakan file template Excel (.xlsx) atau CSV.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 text-xs">
              {/* Step 1: Download Template Helper Box */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-indigo-200 rounded-xl p-3.5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Download className="w-4 h-4 text-indigo-600" />
                    Belum memiliki template Stock Opname bulan ini?
                  </div>
                  <p className="text-[11px] text-slate-600">
                    Download template resmi yang telah terisi data SKU, nama barang, dan saldo buku periode {formatPeriodLabel(selectedPeriod)}.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => downloadSOTemplate(activeItems, selectedPeriod)}
                  className="px-3.5 py-2 bg-white hover:bg-slate-50 text-indigo-700 border border-indigo-300 rounded-xl font-bold transition shadow-2xs whitespace-nowrap flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Template (.xlsx)</span>
                </button>
              </div>

              {/* Step 2: Dropzone / File Picker */}
              {!uploadParseResult && (
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDropFile}
                  className="border-2 border-dashed border-indigo-300 hover:border-indigo-500 bg-indigo-50/20 hover:bg-indigo-50/40 rounded-2xl p-6 sm:p-8 text-center transition cursor-pointer space-y-3"
                  onClick={() => {
                    const input = document.getElementById('so-file-input') as HTMLInputElement;
                    input?.click();
                  }}
                >
                  <input
                    id="so-file-input"
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">
                      Pilih atau Tarik File Hasil SO ke Sini
                    </h4>
                    <p className="text-xs text-slate-500 mt-1">
                      Mendukung format Microsoft Excel (<strong>.xlsx</strong>, <strong>.xls</strong>) atau <strong>.csv</strong>
                    </p>
                  </div>
                  <button
                    type="button"
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <FileUp className="w-4 h-4" />
                    <span>Pilih File dari Komputer</span>
                  </button>
                </div>
              )}

              {/* Loading State */}
              {isParsingUpload && (
                <div className="p-8 text-center space-y-2">
                  <RefreshCw className="w-6 h-6 text-indigo-600 animate-spin mx-auto" />
                  <p className="font-semibold text-slate-700">Membaca dan memvalidasi file template...</p>
                </div>
              )}

              {/* Error Message */}
              {uploadError && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl space-y-2 text-red-700">
                  <div className="flex items-center gap-2 font-bold">
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                    Terjadi Kesalahan saat Membaca File:
                  </div>
                  <p className="text-xs">{uploadError}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setUploadError(null);
                      setUploadedFile(null);
                      setUploadParseResult(null);
                    }}
                    className="text-xs font-bold underline hover:text-red-900 cursor-pointer"
                  >
                    Coba upload file lain
                  </button>
                </div>
              )}

              {/* Parsed Result & Preview */}
              {uploadParseResult && (
                <div className="space-y-3 animate-in fade-in duration-150">
                  {/* File Info Bar */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <FileCheck className="w-4 h-4 text-emerald-600" />
                      <span className="font-bold text-slate-800">{uploadParseResult.fileName}</span>
                      <span className="text-slate-400">({uploadParseResult.totalRows} baris data)</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setUploadedFile(null);
                        setUploadParseResult(null);
                        setUploadError(null);
                      }}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
                    >
                      Ganti File
                    </button>
                  </div>

                  {/* Summary Metric Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Baris</span>
                      <span className="text-base font-black text-slate-900">{uploadParseResult.totalRows}</span>
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-emerald-200 bg-emerald-50/20">
                      <span className="text-[10px] uppercase font-bold text-emerald-700 block">Item Cocok</span>
                      <span className="text-base font-black text-emerald-800">
                        {uploadParseResult.matchedItemsCount} / {activeItems.length}
                      </span>
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-amber-200 bg-amber-50/20">
                      <span className="text-[10px] uppercase font-bold text-amber-700 block">Ada Selisih (GAP)</span>
                      <span className="text-base font-black text-amber-800">{uploadParseResult.itemsWithVariance} Item</span>
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Status Validasi</span>
                      <span className="text-xs font-black text-emerald-600 flex items-center gap-1 mt-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {uploadParseResult.validRows} Valid
                      </span>
                    </div>
                  </div>

                  {/* Unmatched Warning if Any */}
                  {uploadParseResult.unmatchedItemsCount > 0 && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>
                        Terdapat {uploadParseResult.unmatchedItemsCount} item pada file yang tidak cocok dengan SKU Master Inventory aktif.
                      </span>
                    </div>
                  )}

                  {/* Preview Table */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                      <span>Preview Hasil Validasi Data File:</span>
                      <span className="text-slate-400">Menampilkan {uploadParseResult.rows.length} barang</span>
                    </div>

                    <div className="overflow-x-auto max-h-56 rounded-xl border border-slate-200">
                      <table className="w-full text-left text-xs whitespace-nowrap">
                        <thead className="bg-slate-800 text-white font-bold text-[11px] sticky top-0">
                          <tr>
                            <th className="px-3 py-2">SKU</th>
                            <th className="px-3 py-2">Nama Barang</th>
                            <th className="px-2 py-2 text-center">Unit</th>
                            <th className="px-3 py-2 text-right">Stok Sistem</th>
                            <th className="px-3 py-2 text-right bg-blue-900 text-blue-200">Fisik (File)</th>
                            <th className="px-3 py-2 text-center">Selisih (GAP)</th>
                            <th className="px-3 py-2">Catatan Fisik</th>
                            <th className="px-2.5 py-2 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium">
                          {uploadParseResult.rows.map((row, idx) => {
                            return (
                              <tr
                                key={idx}
                                className={`hover:bg-slate-50 ${!row.isValid ? 'bg-red-50/50' : ''}`}
                              >
                                <td className="px-3 py-1.5 font-mono font-bold text-slate-900">{row.sku}</td>
                                <td className="px-3 py-1.5 font-semibold text-slate-800">{row.itemName}</td>
                                <td className="px-2 py-1.5 text-center text-slate-500">{row.unit}</td>
                                <td className="px-3 py-1.5 text-right font-mono text-slate-700">{row.systemStock}</td>
                                <td className="px-3 py-1.5 text-right font-mono font-bold text-blue-700 bg-blue-50/30">
                                  {row.physicalCount}
                                </td>
                                <td className="px-3 py-1.5 text-center">
                                  <span
                                    className={`px-2 py-0.5 rounded-full font-mono font-extrabold text-[10px] ${
                                      row.gapUsage < 0
                                        ? 'bg-red-100 text-red-700 border border-red-200'
                                        : row.gapUsage > 0
                                        ? 'bg-blue-100 text-blue-700 border border-blue-200'
                                        : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                    }`}
                                  >
                                    {row.gapUsage > 0 ? `+${row.gapUsage}` : row.gapUsage}
                                  </span>
                                </td>
                                <td className="px-3 py-1.5 text-slate-500">{row.notes || '-'}</td>
                                <td className="px-2.5 py-1.5 text-center">
                                  {row.isValid ? (
                                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                                      Valid
                                    </span>
                                  ) : (
                                    <span
                                      className="text-[10px] font-bold text-red-700 bg-red-100 px-1.5 py-0.5 rounded"
                                      title={row.errorMessage}
                                    >
                                      Error
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="text-slate-500">
                Pilih opsi penerapan data hasil upload ke sistem.
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition cursor-pointer"
                >
                  Batal
                </button>

                {uploadParseResult && (
                  <>
                    <button
                      type="button"
                      onClick={handleApplyUploadToStartSO}
                      className="px-4 py-2 font-bold text-indigo-700 bg-white border border-indigo-300 hover:bg-indigo-50 rounded-xl transition shadow-2xs cursor-pointer flex items-center gap-1.5"
                      title="Buka form Start SO dengan kuantitas yang telah diisi dari file untuk diperiksa lebih lanjut"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Terapkan ke Start SO</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDirectSubmitFromUpload(true)}
                      className="px-5 py-2 font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                      title="Langsung buat dokumen Report SO dan ajukan untuk peninjauan"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Langsung Ajukan Report SO</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: UPLOAD MASTER INVENTORY DARI TEMPLATE */}
      {showUploadMasterModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-4xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-6">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-rose-700 via-rose-800 to-amber-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="p-2.5 bg-white/10 rounded-xl">
                  <Upload className="w-5 h-5 text-white" />
                </span>
                <div>
                  <h3 className="font-extrabold text-base sm:text-lg">
                    Upload Master Inventory dari Template
                  </h3>
                  <p className="text-xs text-rose-100 mt-0.5">
                    Import data barang massal ke Master Inventory untuk periode {formatPeriodLabel(selectedPeriod)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowUploadMasterModal(false)}
                className="p-1.5 text-white/70 hover:text-white rounded-xl hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-5 max-h-[72vh] overflow-y-auto text-xs">
              {/* Petunjuk & Download Template Banner */}
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <Info className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-slate-800 block">
                      Belum memiliki template Excel Master Inventory?
                    </span>
                    <span className="text-[11px] text-slate-600">
                      Gunakan template resmi berformat .xlsx dengan kolom standar: SKU, Nama Barang, Kategori, Satuan, Price Budget, Price Actual, dan Stok Awal.
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => downloadMasterInventoryTemplate(selectedPeriod)}
                  className="px-3.5 py-2 bg-white hover:bg-slate-50 text-rose-700 border border-rose-300 font-bold rounded-xl shadow-2xs transition shrink-0 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Template Excel</span>
                </button>
              </div>

              {/* Import Mode Selector */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                <span className="font-bold text-xs text-slate-800 block">
                  Pilih Mode Import Data:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label
                    className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition ${
                      uploadImportMode === 'replace'
                        ? 'bg-rose-50/80 border-rose-400 ring-1 ring-rose-400'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="uploadImportMode"
                      value="replace"
                      checked={uploadImportMode === 'replace'}
                      onChange={() => setUploadImportMode('replace')}
                      className="mt-0.5 text-rose-600 focus:ring-rose-500"
                    />
                    <div>
                      <span className="font-bold text-slate-900 block">
                        Ganti Seluruh Data (Replace All)
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Menghapus seluruh list barang lama pada periode ini dan menggantinya penuh dengan data dari template.
                      </span>
                    </div>
                  </label>

                  <label
                    className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition ${
                      uploadImportMode === 'append'
                        ? 'bg-rose-50/80 border-rose-400 ring-1 ring-rose-400'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="uploadImportMode"
                      value="append"
                      checked={uploadImportMode === 'append'}
                      onChange={() => setUploadImportMode('append')}
                      className="mt-0.5 text-rose-600 focus:ring-rose-500"
                    />
                    <div>
                      <span className="font-bold text-slate-900 block">
                        Tambah / Update (Append/Merge)
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Memperbarui item dengan SKU yang sama dan menambahkan item SKU baru tanpa menghapus data sebelumnya.
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Upload Dropzone */}
              {!uploadedMasterFile ? (
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleMasterDropFile}
                  className="border-2 border-dashed border-slate-300 hover:border-rose-500 hover:bg-rose-50/20 rounded-2xl p-8 text-center transition cursor-pointer flex flex-col items-center justify-center gap-2"
                >
                  <div className="w-12 h-12 rounded-2xl bg-rose-100 flex items-center justify-center text-rose-600 mb-1">
                    <FileUp className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-sm text-slate-800">
                    Pilih Berkas atau Tarik File ke Sini
                  </h4>
                  <p className="text-xs text-slate-500 max-w-sm">
                    Mendukung berkas spreadsheet format <strong>.xlsx</strong>, <strong>.xls</strong>, atau <strong>.csv</strong>
                  </p>
                  <label className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-xs transition cursor-pointer">
                    <Upload className="w-4 h-4" />
                    <span>Pilih Berkas File</span>
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleMasterFileChange}
                      className="hidden"
                    />
                  </label>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* File Info Bar */}
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <FileSpreadsheet className="w-5 h-5 text-emerald-600 shrink-0" />
                      <div>
                        <span className="font-bold text-slate-800 block text-xs">
                          {uploadedMasterFile.name}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          Ukuran: {(uploadedMasterFile.size / 1024).toFixed(1)} KB
                        </span>
                      </div>
                    </div>
                    <label className="text-xs font-bold text-rose-600 hover:text-rose-700 hover:underline cursor-pointer">
                      Ganti File
                      <input
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        onChange={handleMasterFileChange}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {isParsingMasterUpload && (
                    <div className="p-6 text-center text-slate-500 flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-rose-600" />
                      <span>Sedang memproses dan memvalidasi file...</span>
                    </div>
                  )}

                  {uploadMasterError && (
                    <div className="p-3.5 bg-red-50 border border-red-200 text-red-800 rounded-xl flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold block">Gagal Memproses File</span>
                        <span className="text-xs">{uploadMasterError}</span>
                      </div>
                    </div>
                  )}

                  {uploadMasterParseResult && (
                    <div className="space-y-4">
                      {/* Summary Badges */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                          <span className="text-[10px] font-bold text-slate-400 block uppercase">
                            Total Baris
                          </span>
                          <span className="text-lg font-black text-slate-800">
                            {uploadMasterParseResult.totalRows}
                          </span>
                        </div>
                        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                          <span className="text-[10px] font-bold text-emerald-600 block uppercase">
                            Baris Valid
                          </span>
                          <span className="text-lg font-black text-emerald-700">
                            {uploadMasterParseResult.validRows}
                          </span>
                        </div>
                        <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                          <span className="text-[10px] font-bold text-red-600 block uppercase">
                            Baris Error
                          </span>
                          <span className="text-lg font-black text-red-700">
                            {uploadMasterParseResult.invalidRows}
                          </span>
                        </div>
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                          <span className="text-[10px] font-bold text-amber-700 block uppercase">
                            Mode Import
                          </span>
                          <span className="text-xs font-black text-amber-800 block mt-1">
                            {uploadImportMode === 'replace' ? 'Ganti Semua' : 'Tambah/Update'}
                          </span>
                        </div>
                      </div>

                      {/* Error List */}
                      {uploadMasterParseResult.errors.length > 0 && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 space-y-1">
                          <span className="font-bold text-xs flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                            Peringatan Baris Tidak Valid:
                          </span>
                          <ul className="list-disc list-inside text-[11px] max-h-24 overflow-y-auto space-y-0.5">
                            {uploadMasterParseResult.errors.slice(0, 5).map((err, idx) => (
                              <li key={idx}>{err}</li>
                            ))}
                            {uploadMasterParseResult.errors.length > 5 && (
                              <li className="text-slate-500 italic">
                                ... dan {uploadMasterParseResult.errors.length - 5} baris error lainnya
                              </li>
                            )}
                          </ul>
                        </div>
                      )}

                      {/* Preview Table */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-bold text-xs text-slate-700">
                            Preview Data yang Akan Diimpor (Menampilkan {Math.min(uploadMasterParseResult.rawRows.length, 6)} dari {uploadMasterParseResult.totalRows} baris):
                          </span>
                        </div>
                        <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-48 overflow-y-auto">
                          <table className="w-full text-left text-[11px]">
                            <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 border-b border-slate-200">
                              <tr>
                                <th className="px-3 py-2">SKU</th>
                                <th className="px-3 py-2">Nama Barang</th>
                                <th className="px-3 py-2">Kategori</th>
                                <th className="px-3 py-2">Departemen</th>
                                <th className="px-3 py-2">Vendor Terkait</th>
                                <th className="px-2 py-2 text-center">Satuan</th>
                                <th className="px-3 py-2 text-right">Price Budget</th>
                                <th className="px-3 py-2 text-right">Price Actual</th>
                                <th className="px-2 py-2 text-right">Stok Awal</th>
                                <th className="px-2 py-2 text-center">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {uploadMasterParseResult.rawRows.slice(0, 8).map((r, idx) => (
                                <tr
                                  key={idx}
                                  className={r.isValid ? 'hover:bg-slate-50' : 'bg-red-50/50'}
                                >
                                  <td className="px-3 py-1.5 font-mono font-bold text-slate-900">
                                    {r.sku}
                                  </td>
                                  <td className="px-3 py-1.5 font-medium text-slate-800">
                                    {r.itemName}
                                  </td>
                                  <td className="px-3 py-1.5 text-slate-600">{r.category}</td>
                                  <td className="px-3 py-1.5 text-slate-600">
                                    {r.allowedDepartments && r.allowedDepartments.length > 0
                                      ? r.allowedDepartments.join(', ')
                                      : 'Kitchen'}
                                  </td>
                                  <td className="px-3 py-1.5 text-slate-700 font-medium">
                                    {r.vendor || '-'}
                                  </td>
                                  <td className="px-2 py-1.5 text-center text-slate-600">{r.unit}</td>
                                  <td className="px-3 py-1.5 text-right font-mono text-slate-700">
                                    {formatRupiah(r.priceBudget)}
                                  </td>
                                  <td className="px-3 py-1.5 text-right font-mono text-slate-700">
                                    {formatRupiah(r.priceActual)}
                                  </td>
                                  <td className="px-2 py-1.5 text-right font-mono font-bold text-slate-900">
                                    {r.beginningInventory}
                                  </td>
                                  <td className="px-2 py-1.5 text-center">
                                    {r.isValid ? (
                                      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded font-bold">
                                        <Check className="w-3 h-3" /> Valid
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 text-[10px] text-red-700 bg-red-100 px-1.5 py-0.2 rounded font-bold" title={r.errorMessage}>
                                        <X className="w-3 h-3" /> Error
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <span className="text-slate-500">
                {uploadMasterParseResult && uploadMasterParseResult.validRows > 0
                  ? `Siap mengimpor ${uploadMasterParseResult.validRows} barang ke Master Inventory.`
                  : 'Pilih file template untuk melanjutkan import.'}
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowUploadMasterModal(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition cursor-pointer"
                >
                  Batal
                </button>

                {uploadMasterParseResult && uploadMasterParseResult.validRows > 0 && (
                  <button
                    type="button"
                    onClick={handleApplyMasterInventoryUpload}
                    className="px-5 py-2 font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Terapkan ke Master Inventory ({uploadMasterParseResult.validRows} Item)</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 7: KONFIRMASI HAPUS / KOSONGKAN SELURUH DATA MASTER INVENTORY */}
      {showClearConfirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 bg-rose-50 border-b border-rose-200 flex items-start gap-3">
              <div className="p-2.5 bg-rose-100 rounded-xl text-rose-700 shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-rose-900">
                  Kosongkan Data Master Inventory
                </h3>
                <p className="text-xs text-rose-700 mt-1 leading-relaxed">
                  Tindakan ini akan menghapus seluruh data barang pada Master Inventory. Pastikan Anda telah mengunduh backup (Export Excel) jika diperlukan.
                </p>
              </div>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <span className="font-bold text-slate-800 block">
                Pilih Cakupan Penghapusan:
              </span>
              <div className="space-y-2">
                <label
                  className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition ${
                    clearScope === 'current'
                      ? 'bg-rose-50/80 border-rose-400 ring-1 ring-rose-400'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="clearScope"
                    value="current"
                    checked={clearScope === 'current'}
                    onChange={() => setClearScope('current')}
                    className="mt-0.5 text-rose-600 focus:ring-rose-500"
                  />
                  <div>
                    <span className="font-bold text-slate-900 block">
                      Hanya Periode Ini ({formatPeriodLabel(selectedPeriod)})
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Menghapus {activeItems.length} barang pada periode aktif. Periode lain tetap tersimpan.
                    </span>
                  </div>
                </label>

                <label
                  className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition ${
                    clearScope === 'all'
                      ? 'bg-rose-50/80 border-rose-400 ring-1 ring-rose-400'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="clearScope"
                    value="all"
                    checked={clearScope === 'all'}
                    onChange={() => setClearScope('all')}
                    className="mt-0.5 text-rose-600 focus:ring-rose-500"
                  />
                  <div>
                    <span className="font-bold text-slate-900 block">
                      Seluruh Periode (Kosongkan Total)
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Menghapus data barang pada seluruh periode bulan & tahun.
                    </span>
                  </div>
                </label>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setShowClearConfirmModal(false)}
                className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleExecuteClearInventory}
                className="px-5 py-2 font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Ya, Hapus & Kosongkan</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 8: KONFIRMASI HAPUS 1 ITEM BARANG */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 bg-rose-50 border-b border-rose-200 flex items-start gap-3">
              <div className="p-2 bg-rose-100 rounded-xl text-rose-700 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-rose-900">
                  Hapus Item Barang?
                </h3>
                <p className="text-xs text-rose-700 mt-0.5">
                  Apakah Anda yakin ingin menghapus barang ini dari Master Inventory?
                </p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 m-4 rounded-xl border border-slate-200 text-xs space-y-1">
              <div>
                <span className="text-slate-400 font-bold block text-[10px] uppercase">SKU</span>
                <span className="font-mono font-bold text-slate-900">{itemToDelete.sku}</span>
              </div>
              <div>
                <span className="text-slate-400 font-bold block text-[10px] uppercase">Nama Barang</span>
                <span className="font-semibold text-slate-900">{itemToDelete.itemName}</span>
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-slate-500">Kategori: {itemToDelete.category}</span>
                <span className="text-slate-500">Satuan: {itemToDelete.unit}</span>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                className="px-3.5 py-1.5 font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => handleExecuteDeleteItem(itemToDelete)}
                className="px-4 py-1.5 font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hapus Item</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUCCESS SUBMIT POPUP MODAL */}
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
