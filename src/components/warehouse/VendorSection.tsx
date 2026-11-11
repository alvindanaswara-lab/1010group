import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { Vendor, PurchaseOrder, POItem, ITEM_CATEGORIES, ItemCategory } from '../../types';
import { formatRupiah, exportPOToExcel } from '../../utils/excelExport';
import {
  exportPOToPDF,
  getPOPDFBase64Attachment,
  generateVendorPOEmailContent,
} from '../../utils/pdfExport';
import {
  initAuth,
  googleSignIn,
  getAccessToken,
  logoutGoogle,
  sendGmailMessage,
  createGmailDraft,
  listGmailMessages,
  trashGmailMessage,
  GmailMessageSummary,
} from '../../utils/gmailService';
import { formatDate } from '../../utils/dateUtils';
import { scrollToTop } from '../../utils/scrollHelper';
import { SuccessSubmitModal, SuccessDetail } from '../common/SuccessSubmitModal';
import {
  Building2,
  FileCheck,
  Plus,
  Trash2,
  Edit2,
  Ban,
  Send,
  Phone,
  Mail,
  MapPin,
  UserCheck,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  X,
  Search,
  Check,
  FileSpreadsheet,
  Calendar,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  Eye,
  Calculator,
  Clock,
  SlidersHorizontal,
  Layers,
  CheckSquare,
  Square,
  Filter,
  ArrowRight,
  Edit3,
  Save,
  XCircle,
  AlertTriangle,
  DollarSign,
  FileText,
  Download,
  Lock,
  Truck,
  Paperclip,
  ExternalLink,
  RefreshCw,
  Inbox,
  LogOut,
} from 'lucide-react';

export const VendorSection: React.FC = () => {
  const {
    purchaseOrders,
    vendors,
    addVendor,
    updateVendor,
    deleteVendor,
    assignVendorToPOItem,
    rejectPOItem,
    submitPOVendorToReceiving,
    batchReleasePOToVendor,
    recordVendorEmailSent,
    submitPOToCostControl,
    submitPOToVendorSummary,
    batchSubmitPOToCostControl,
    updatePOItemPayment,
    updateVendorSummaryItem,
    updatePO,
    inventory,
  } = useApp();

  const [activeSubTab, setActiveSubTab] = useState<
    'po-vendor' | 'vendor-summary' | 'list-vendor' | 'gmail-vendor'
  >('po-vendor');

  // State dropdown menu opsi aksi form PO Vendor & List Vendor
  const [openActionMenuPOVendorId, setOpenActionMenuPOVendorId] = useState<string | null>(null);
  const [openActionMenuVendorId, setOpenActionMenuVendorId] = useState<string | null>(null);

  // Filter & Search states for PO Vendor (Kelola & Penugasan)
  const [poSearchQuery, setPoSearchQuery] = useState<string>('');
  const [poDateFilter, setPoDateFilter] = useState<string>('');
  const [poDateSortOrder, setPoDateSortOrder] = useState<'desc' | 'asc'>('desc');

  // Selection & filter states for Vendor Summary
  const [selectedPOsForCostControl, setSelectedPOsForCostControl] = useState<string[]>([]);
  const [summaryPaymentFilter, setSummaryPaymentFilter] = useState<'all' | 'Tempo' | 'Cash'>('all');
  const [summarySearchQuery, setSummarySearchQuery] = useState<string>('');
  const [summaryDateFilter, setSummaryDateFilter] = useState<string>('');
  const [summaryDateSortOrder, setSummaryDateSortOrder] = useState<'desc' | 'asc'>('desc');
  const [expandedSummaryPOIds, setExpandedSummaryPOIds] = useState<string[]>([]);

  // Filter for List Vendor
  const [vendorCategoryFilter, setVendorCategoryFilter] = useState<'all' | 'Tempo' | 'Cash'>('all');

  // Currently expanded/selected PO form for displaying items underneath
  const [selectedPOId, setSelectedPOId] = useState<string | null>(null);

  const activePO = purchaseOrders.find((p) => p.id === selectedPOId);

  // Filtered & sorted PO Vendor list
  const filteredAndSortedPOs = [...purchaseOrders]
    .filter((po) => {
      const matchSearch =
        poSearchQuery === '' ||
        po.id.toLowerCase().includes(poSearchQuery.toLowerCase()) ||
        po.status.toLowerCase().includes(poSearchQuery.toLowerCase());
      const matchDate = poDateFilter === '' || po.generatedDate === poDateFilter;
      return matchSearch && matchDate;
    })
    .sort((a, b) => {
      const timeA = new Date(a.generatedDate).getTime();
      const timeB = new Date(b.generatedDate).getTime();
      return poDateSortOrder === 'desc' ? timeB - timeA : timeA - timeB;
    });

  // Rejection modal
  const [rejectingItem, setRejectingItem] = useState<POItem | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');

  // Edit item modal inside PO Vendor
  const [editingItem, setEditingItem] = useState<POItem | null>(null);
  const [editQty, setEditQty] = useState<number>(1);
  const [editPrice, setEditPrice] = useState<number>(0);

  // Add item modal inside PO Vendor
  const [showAddItemModal, setShowAddItemModal] = useState<boolean>(false);
  const [newItemSku, setNewItemSku] = useState<string>(inventory[0]?.sku || '');
  const [addItemSearchQuery, setAddItemSearchQuery] = useState<string>('');
  const [isAddItemDropdownOpen, setIsAddItemDropdownOpen] = useState<boolean>(false);
  const [newItemCategory, setNewItemCategory] = useState<ItemCategory>(
    inventory[0]?.category || 'Dry Item'
  );
  const [newItemUnit, setNewItemUnit] = useState<string>(inventory[0]?.unit || 'Kg');
  const [newItemReason, setNewItemReason] = useState<string>('');
  const [newItemQty, setNewItemQty] = useState<number>(10);
  const [newItemVendor, setNewItemVendor] = useState<string>(vendors[0]?.namaVendor || '');

  // Vendor Management Modal (Add/Edit)
  const [showVendorModal, setShowVendorModal] = useState<boolean>(false);
  const [isEditingVendor, setIsEditingVendor] = useState<boolean>(false);
  const [vendorFormData, setVendorFormData] = useState<Partial<Vendor>>({
    namaVendor: '',
    address: '',
    telephone: '',
    email: '',
    paymentCategory: 'Tempo',
    topTerm: 'TOP 14 Hari',
    cashType: 'Cash / COD',
    paymentType: 'TOP 14 Hari',
    pic: '',
    minimumOrder: 0,
    totalPurchase: 0,
    categories: ['Dry Item'],
  });

  const [submitMsg, setSubmitMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Handle Assign Vendor to Item (auto fills payment method and term from vendor)
  const handleVendorChangeForItem = (sku: string, vendorName: string, place?: string) => {
    if (!activePO) return;
    const matchedVendor = vendors.find((v) => v.namaVendor === vendorName);
    const paymentMethod =
      matchedVendor?.paymentCategory ||
      (matchedVendor?.paymentType?.startsWith('TOP') ? 'Tempo' : 'Cash');
    const paymentTerm =
      paymentMethod === 'Tempo'
        ? matchedVendor?.topTerm || matchedVendor?.paymentType || 'TOP 30 Hari'
        : matchedVendor?.cashType || matchedVendor?.paymentType || 'Cash / COD';

    assignVendorToPOItem(activePO.id, sku, vendorName, paymentMethod, paymentTerm, place);
  };

  // Quick Assign All to a Single Vendor
  const handleAssignAllToVendor = (vendorName: string) => {
    if (!activePO) return;
    const matchedVendor = vendors.find((v) => v.namaVendor === vendorName);
    const paymentMethod =
      matchedVendor?.paymentCategory ||
      (matchedVendor?.paymentType?.startsWith('TOP') ? 'Tempo' : 'Cash');
    const paymentTerm =
      paymentMethod === 'Tempo'
        ? matchedVendor?.topTerm || matchedVendor?.paymentType || 'TOP 30 Hari'
        : matchedVendor?.cashType || matchedVendor?.paymentType || 'Cash / COD';

    activePO.items.forEach((it) => {
      assignVendorToPOItem(activePO.id, it.sku, vendorName, paymentMethod, paymentTerm, it.place);
    });
  };

  // Submit PO ke Vendor Summary setelah penugasan vendor selesai
  const handleSubmitToVendorSummary = (poId: string) => {
    const targetPO = purchaseOrders.find((p) => p.id === poId);
    if (!targetPO) return;

    const unassignedItems = targetPO.items.filter(
      (it) => it.status !== 'Rejected' && (!it.vendorName || it.vendorName.trim() === '')
    );
    if (unassignedItems.length > 0) {
      setSubmitMsg({
        type: 'error',
        text: `Masih ada ${unassignedItems.length} barang aktif yang belum ditentukan vendornya. Silakan pilih vendor untuk semua barang (atau tolak barang) sebelum submit ke Vendor Summary.`,
      });
      return;
    }

    const res = submitPOToVendorSummary(poId);
    if (res.success) {
      setSuccessModalData({
        title: 'Form PO Berhasil Masuk ke Vendor Summary!',
        message: `Form PO (${poId}) telah berhasil disubmit ke proses 'Vendor Summary'. Data kini telah dipisahkan berdasarkan Tipe Pembayaran (Tempo & Cash) > Vendor > List Barang dan siap diajukan ke Cost Control.`,
        details: [
          { label: 'Nomor PO', value: poId },
          { label: 'Jumlah Item', value: `${targetPO.items.length} item barang` },
          { label: 'Total Pengajuan', value: formatRupiah(targetPO.totalAmount) },
          { label: 'Status Baru', value: 'Vendor Summary' },
          { label: 'Alur Selanjutnya', value: 'Buka tab Vendor Summary untuk memilih dan mengajukan form ke Cost Control' },
        ],
      });
      setShowSuccessModal(true);
      setActiveSubTab('vendor-summary');
      setSelectedPOId(null);
      scrollToTop();
    } else {
      setSubmitMsg({ type: 'error', text: res.message });
    }
  };

  // Toggle selection form PO for Cost Control in Vendor Summary
  const handleToggleSelectPOForCostControl = (poId: string) => {
    setSelectedPOsForCostControl((prev) =>
      prev.includes(poId) ? prev.filter((id) => id !== poId) : [...prev, poId]
    );
  };

  // Select / Deselect All POs in Vendor Summary
  const handleSelectAllVendorSummaryPOs = (poIds: string[]) => {
    const allSelected = poIds.length > 0 && poIds.every((id) => selectedPOsForCostControl.includes(id));
    if (allSelected) {
      setSelectedPOsForCostControl((prev) => prev.filter((id) => !poIds.includes(id)));
    } else {
      setSelectedPOsForCostControl((prev) => Array.from(new Set([...prev, ...poIds])));
    }
  };

  // Toggle open/close single PO form card in Vendor Summary when the form is clicked
  const handleToggleCollapseSummaryPO = (poId: string) => {
    setExpandedSummaryPOIds((prev) =>
      prev.includes(poId) ? prev.filter((id) => id !== poId) : [...prev, poId]
    );
  };

  // Vendor Summary Item Editing state
  const [editingSummaryItem, setEditingSummaryItem] = useState<{
    poId: string;
    sku: string;
    place?: string;
    itemName: string;
    unit: string;
    currentVendorName: string;
    vendorName: string;
    qty: number;
    price: number;
    isRejected?: boolean;
    rejectionReason?: string;
  } | null>(null);

  // Inline row edit state in Vendor Summary
  const [inlineSummaryEditKey, setInlineSummaryEditKey] = useState<string | null>(null);
  const [inlineSummaryValues, setInlineSummaryValues] = useState<{
    qty: number;
    price: number;
    vendorName: string;
  }>({
    qty: 1,
    price: 0,
    vendorName: '',
  });

  const handleStartInlineEdit = (poId: string, item: POItem) => {
    const key = `${poId}__${item.sku}__${item.place || ''}`;
    setInlineSummaryEditKey(key);
    setInlineSummaryValues({
      qty: item.qty,
      price: item.price,
      vendorName: item.vendorName || vendors[0]?.namaVendor || '',
    });
  };

  const handleCancelInlineEdit = () => {
    setInlineSummaryEditKey(null);
  };

  const handleSaveInlineEdit = (poId: string, item: POItem) => {
    if (inlineSummaryValues.qty <= 0) {
      alert('Kuantitas (Qty) harus lebih dari 0.');
      return;
    }
    if (inlineSummaryValues.price < 0) {
      alert('Harga satuan tidak boleh negatif.');
      return;
    }
    if (!inlineSummaryValues.vendorName) {
      alert('Pilih vendor mitra yang valid.');
      return;
    }

    const res = updateVendorSummaryItem(poId, item.sku, item.place, {
      qty: Number(inlineSummaryValues.qty),
      price: Number(inlineSummaryValues.price),
      vendorName: inlineSummaryValues.vendorName,
    });

    if (res.success) {
      setSuccessModalData({
        title: 'Item Vendor Summary Berhasil Diperbarui!',
        message: `Kuantitas, harga, dan vendor untuk item "${item.itemName}" berhasil diperbarui. Status penolakan telah dibersihkan dan siap ditinjau kembali.`,
        details: [
          { label: 'Nomor PO', value: poId },
          { label: 'Nama Barang', value: item.itemName },
          { label: 'Qty Baru', value: `${inlineSummaryValues.qty} ${item.unit}` },
          { label: 'Harga Satuan Baru', value: formatRupiah(inlineSummaryValues.price) },
          { label: 'Subtotal Baru', value: formatRupiah(inlineSummaryValues.qty * inlineSummaryValues.price) },
          { label: 'Vendor Baru', value: inlineSummaryValues.vendorName },
        ],
      });
      setShowSuccessModal(true);
      setInlineSummaryEditKey(null);
    } else {
      alert(res.message);
    }
  };

  const handleOpenEditModal = (poId: string, item: POItem) => {
    const isRejected = item.approvalStatus === 'Rejected' || item.status === 'Rejected';
    setEditingSummaryItem({
      poId,
      sku: item.sku,
      place: item.place,
      itemName: item.itemName,
      unit: item.unit,
      currentVendorName: item.vendorName || vendors[0]?.namaVendor || '',
      vendorName: item.vendorName || vendors[0]?.namaVendor || '',
      qty: item.qty,
      price: item.price,
      isRejected,
      rejectionReason: item.rejectionReason,
    });
  };

  const handleSaveModalEdit = () => {
    if (!editingSummaryItem) return;
    if (editingSummaryItem.qty <= 0) {
      alert('Kuantitas (Qty) harus lebih dari 0.');
      return;
    }
    if (editingSummaryItem.price < 0) {
      alert('Harga satuan tidak boleh negatif.');
      return;
    }
    if (!editingSummaryItem.vendorName) {
      alert('Pilih vendor mitra yang valid.');
      return;
    }

    const res = updateVendorSummaryItem(
      editingSummaryItem.poId,
      editingSummaryItem.sku,
      editingSummaryItem.place,
      {
        qty: Number(editingSummaryItem.qty),
        price: Number(editingSummaryItem.price),
        vendorName: editingSummaryItem.vendorName,
      }
    );

    if (res.success) {
      setSuccessModalData({
        title: 'Item Vendor Summary Berhasil Diperbarui!',
        message: `Kuantitas, harga, dan vendor untuk item "${editingSummaryItem.itemName}" berhasil diperbarui. Status penolakan telah dibersihkan dan siap ditinjau kembali oleh Cost Control.`,
        details: [
          { label: 'Nomor PO', value: editingSummaryItem.poId },
          { label: 'Nama Barang', value: editingSummaryItem.itemName },
          { label: 'Qty Baru', value: `${editingSummaryItem.qty} ${editingSummaryItem.unit}` },
          { label: 'Harga Satuan Baru', value: formatRupiah(editingSummaryItem.price) },
          { label: 'Subtotal Baru', value: formatRupiah(editingSummaryItem.qty * editingSummaryItem.price) },
          { label: 'Vendor Baru', value: editingSummaryItem.vendorName },
        ],
      });
      setShowSuccessModal(true);
      setEditingSummaryItem(null);
    } else {
      alert(res.message);
    }
  };

  // Batch Submit selected POs from Vendor Summary to Cost Control
  const handleBatchSubmitToCostControl = (poIdsToSubmit: string[]) => {
    if (poIdsToSubmit.length === 0) {
      setSubmitMsg({
        type: 'error',
        text: 'Pilih setidaknya satu form PO untuk diajukan ke Cost Control.',
      });
      return;
    }

    // Check if any selected PO has items with rejected status
    const posWithRejected = purchaseOrders
      .filter((p) => poIdsToSubmit.includes(p.id))
      .filter((p) => p.items.some((it) => it.approvalStatus === 'Rejected' || it.status === 'Rejected'));

    if (posWithRejected.length > 0) {
      const poIds = posWithRejected.map((p) => p.id).join(', ');
      alert(
        `Form ${poIds} masih memiliki item yang berstatus Tidak Disetujui (Ditolak oleh Cost Control). Silakan gunakan tombol Ubah pada baris barang untuk menyesuaikan Qty, Harga, atau pilih Vendor lain terlebih dahulu sebelum mengajukan ulang ke Cost Control.`
      );
      return;
    }

    const res = batchSubmitPOToCostControl(poIdsToSubmit);
    if (res.success) {
      setSuccessModalData({
        title: 'Form PO Berhasil Diajukan ke Cost Control!',
        message: `${poIdsToSubmit.length} Form PO telah diajukan ke Cost Control untuk ditinjau dan disetujui.`,
        details: [
          { label: 'Jumlah Form PO', value: `${poIdsToSubmit.length} formulir` },
          { label: 'Nomor PO Terpilih', value: poIdsToSubmit.join(', ') },
          { label: 'Status Baru', value: 'Review Cost Control' },
          { label: 'Tujuan', value: 'Laman Cost Control' },
        ],
      });
      setShowSuccessModal(true);
      setSelectedPOsForCostControl([]);
      scrollToTop();
    } else {
      setSubmitMsg({ type: 'error', text: res.message });
    }
  };

  // Handle Reject item
  const handleConfirmReject = () => {
    if (!activePO || !rejectingItem) return;
    rejectPOItem(
      activePO.id,
      rejectingItem.sku,
      rejectReason.trim() || 'Stok vendor kosong / ditolak oleh Purchasing',
      rejectingItem.place
    );
    setRejectingItem(null);
    setRejectReason('');
  };

  // Handle Perubahan Qty secara Bebas (Field Bebas)
  const handleItemQtyChange = (poId: string, sku: string, place: string, newQty: number) => {
    const targetPO = purchaseOrders.find((p) => p.id === poId);
    if (!targetPO) return;
    const safeQty = Math.max(0, newQty);
    const updatedItems = targetPO.items.map((it) => {
      if (it.sku === sku && it.place === place) {
        return {
          ...it,
          qty: safeQty,
          total: safeQty * it.price,
        };
      }
      return it;
    });
    const totalAmount = updatedItems.reduce(
      (acc, it) => acc + (it.status === 'Rejected' ? 0 : it.total),
      0
    );
    updatePO({
      ...targetPO,
      items: updatedItems,
      totalAmount,
    });
  };

  // Handle Perubahan Harga Satuan secara Bebas (Field Bebas)
  const handleItemPriceChange = (poId: string, sku: string, place: string, newPrice: number) => {
    const targetPO = purchaseOrders.find((p) => p.id === poId);
    if (!targetPO) return;
    const safePrice = Math.max(0, newPrice);
    const updatedItems = targetPO.items.map((it) => {
      if (it.sku === sku && it.place === place) {
        return {
          ...it,
          price: safePrice,
          total: it.qty * safePrice,
        };
      }
      return it;
    });
    const totalAmount = updatedItems.reduce(
      (acc, it) => acc + (it.status === 'Rejected' ? 0 : it.total),
      0
    );
    updatePO({
      ...targetPO,
      items: updatedItems,
      totalAmount,
    });
  };

  // Handle Edit item modal (opsional / pelengkap)
  const handleSaveEditItem = () => {
    if (!activePO || !editingItem) return;
    const updatedItems = activePO.items.map((it) => {
      if (it.sku === editingItem.sku && it.place === editingItem.place) {
        return {
          ...it,
          qty: editQty,
          price: editPrice,
          total: editQty * editPrice,
        };
      }
      return it;
    });

    updatePO({
      ...activePO,
      items: updatedItems,
      totalAmount: updatedItems.reduce((acc, it) => acc + it.total, 0),
    });
    setEditingItem(null);

    // Pop-up sukses ubah barang PO Vendor
    setSuccessModalData({
      title: 'Data Telah Berhasil Di-input!',
      message: `Perubahan data barang [${editingItem.sku}] ${editingItem.itemName} berhasil disimpan.`,
      details: [
        { label: 'Nomor PO', value: activePO.id },
        { label: 'Item', value: editingItem.itemName },
        { label: 'Qty Baru', value: `${editQty} ${editingItem.unit}` },
        { label: 'Total Baru', value: formatRupiah(editQty * editPrice) },
      ],
    });
    setShowSuccessModal(true);
    scrollToTop();
  };

  const selectedAddVendorInventoryItem = inventory.find((i) => i.sku === newItemSku) || null;
  const filteredAddVendorSearchItems = inventory.filter((item) => {
    if (!addItemSearchQuery.trim()) return true;
    const q = addItemSearchQuery.toLowerCase();
    return (
      item.sku.toLowerCase().includes(q) ||
      item.itemName.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q)
    );
  });

  const handleSelectAddVendorItem = (item: (typeof inventory)[0]) => {
    setNewItemSku(item.sku);
    setNewItemCategory(item.category);
    setNewItemUnit(item.unit);
    setAddItemSearchQuery('');
    setIsAddItemDropdownOpen(false);
  };

  // Handle Add Item to PO Vendor
  const handleAddItemToPOVendor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePO) return;
    const inv = inventory.find((i) => i.sku === newItemSku) || inventory[0];
    if (!inv) return;

    const reasonNote = newItemReason.trim()
      ? `Alasan Penambahan: ${newItemReason.trim()}`
      : 'Direct Warehouse Vendor Order';
    const budgetPrice =
      inv.priceBudget !== undefined && inv.priceBudget > 0
        ? inv.priceBudget
        : inv.price ?? 0;

    const newItem: POItem = {
      sku: inv.sku,
      itemName: inv.itemName,
      category: newItemCategory || inv.category,
      qty: newItemQty,
      unit: newItemUnit.trim() || inv.unit,
      price: budgetPrice,
      total: newItemQty * budgetPrice,
      place: reasonNote,
      vendorName: newItemVendor,
      status: 'Approved',
    };

    updatePO({
      ...activePO,
      items: [...activePO.items, newItem],
      totalAmount: activePO.totalAmount + newItem.total,
    });

    setShowAddItemModal(false);

    // Pop-up sukses tambah item PO Vendor
    setSuccessModalData({
      title: 'Data Telah Berhasil Di-input!',
      message: `Item [${newItem.sku}] ${newItem.itemName} berhasil ditambahkan langsung ke PO Vendor ${activePO.id}.`,
      details: [
        { label: 'Nomor PO', value: activePO.id },
        { label: 'Item', value: `${newItem.itemName} (${newItem.sku})` },
        { label: 'Kategori', value: newItem.category },
        { label: 'Vendor', value: newItemVendor || '-' },
        { label: 'Qty & Unit', value: `${newItem.qty} ${newItem.unit}` },
        { label: 'Alasan Penambahan', value: newItemReason.trim() || '-' },
        { label: 'Total', value: formatRupiah(newItem.total) },
      ],
    });
    setShowSuccessModal(true);

    // Bersihkan form input tambah item
    setNewItemQty(10);
    setNewItemReason('');
    setAddItemSearchQuery('');
    setIsAddItemDropdownOpen(false);
    setNewItemSku(inventory[0]?.sku || '');
    scrollToTop();
  };

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

  // Ajukan Form PO ke Cost Control untuk review & approval
  const handleTriggerSubmitToCostControl = (targetPO: PurchaseOrder) => {
    const hasAnyVendor = targetPO.items.some((it) => it.vendorName && it.vendorName.trim() !== '');
    if (!hasAnyVendor) {
      setSubmitMsg({
        type: 'error',
        text: 'Harap tentukan Nama Vendor / Supplier untuk barang terlebih dahulu sebelum mengajukan ke Cost Control.',
      });
      return;
    }

    const res = submitPOToCostControl(targetPO.id);
    if (res.success) {
      setSubmitMsg({ type: 'success', text: res.message });
      setSuccessModalData({
        title: 'Form PO Berhasil Diajukan ke Cost Control!',
        message: `Form PO (${targetPO.id}) telah berhasil diajukan dan masuk ke laman Cost Control untuk ditinjau serta disetujui total nilai pembeliannya. Setelah disetujui, tombol Submit to Vendor akan aktif.`,
        details: [
          { label: 'Nomor PO', value: targetPO.id },
          { label: 'Jumlah Item', value: `${targetPO.items.length} jenis barang` },
          { label: 'Total Pengajuan', value: formatRupiah(targetPO.totalAmount) },
          { label: 'Status Baru', value: 'Menunggu Approval Cost Control' },
          { label: 'Tujuan', value: 'Laman Cost Control' },
        ],
      });
      setShowSuccessModal(true);
      scrollToTop();
    } else {
      setSubmitMsg({ type: 'error', text: res.message });
    }
  };

  // State untuk Modal Release to Vendor & Masuk ke Inbound
  const [releasingPOIds, setReleasingPOIds] = useState<string[] | null>(null);
  const [releaseAutoDownloadPDF, setReleaseAutoDownloadPDF] = useState<boolean>(false);

  // State untuk Modal Kirim Email PO ke Alamat Email Vendor
  const [emailModalPO, setEmailModalPO] = useState<PurchaseOrder | null>(null);
  const [emailTargetVendor, setEmailTargetVendor] = useState<string>('ALL');
  const [emailRecipient, setEmailRecipient] = useState<string>('');
  const [emailCc, setEmailCc] = useState<string>('purchasing@1010group.com, costcontrol@1010group.com');
  const [emailSubject, setEmailSubject] = useState<string>('');
  const [emailBody, setEmailBody] = useState<string>('');
  const [attachPDFInEmail, setAttachPDFInEmail] = useState<boolean>(true);

  // Helper Export PO to PDF (.pdf)
  const handleExportPDF = (po: PurchaseOrder, specificVendorName?: string) => {
    const fileName = exportPOToPDF(po, vendors, specificVendorName);
    setSubmitMsg({
      type: 'success',
      text: `Dokumen PDF Purchase Order "${fileName}" berhasil diunduh!`,
    });
  };

  // Helper Populate Email Modal Fields
  const populateEmailModalFields = (po: PurchaseOrder, vendorSelection: string) => {
    const approvedItems = po.items.filter(
      (it) => it.status !== 'Rejected' && it.approvalStatus !== 'Rejected'
    );
    const uniqueVendorNames = Array.from(
      new Set(approvedItems.map((it) => it.vendorName || 'Vendor Umum'))
    );

    if (vendorSelection === 'ALL' && uniqueVendorNames.length > 1) {
      const emailList = uniqueVendorNames
        .map((vName) => vendors.find((v) => v.namaVendor === vName)?.email)
        .filter((em): em is string => Boolean(em && em.trim() !== ''));

      const firstVendorObj = vendors.find((v) => v.namaVendor === uniqueVendorNames[0]);
      const baseContent = generateVendorPOEmailContent(
        po,
        uniqueVendorNames.join(', '),
        firstVendorObj
      );

      setEmailTargetVendor('ALL');
      setEmailRecipient(emailList.join(', ') || 'order@mitravendor.co.id');
      setEmailSubject(
        `[OFFICIAL PO] Release Purchase Order #${po.id} (${uniqueVendorNames.length} Mitra Vendor) - ${formatDate(po.generatedDate)}`
      );
      setEmailBody(baseContent.body);
    } else {
      const targetName =
        vendorSelection === 'ALL' ? uniqueVendorNames[0] || 'Vendor Umum' : vendorSelection;
      const vendorObj = vendors.find((v) => v.namaVendor === targetName);
      const content = generateVendorPOEmailContent(po, targetName, vendorObj);

      setEmailTargetVendor(targetName);
      setEmailRecipient(content.email || 'sales@mitravendor.co.id');
      setEmailSubject(content.subject);
      setEmailBody(content.body);
    }
  };

  // Open Email Modal
  const handleOpenEmailModal = (po: PurchaseOrder, specificVendorName?: string) => {
    const approvedItems = po.items.filter(
      (it) => it.status !== 'Rejected' && it.approvalStatus !== 'Rejected'
    );
    const uniqueVendorNames = Array.from(
      new Set(approvedItems.map((it) => it.vendorName || 'Vendor Umum'))
    );
    const initialTarget =
      specificVendorName || (uniqueVendorNames.length === 1 ? uniqueVendorNames[0] : 'ALL');

    setEmailModalPO(po);
    setAttachPDFInEmail(true);
    setConfirmGmailAction(null);
    setGmailErrorMsg(null);
    populateEmailModalFields(po, initialTarget);
  };

  // State Integrasi Gmail (OAuth & API)
  const [needsGmailAuth, setNeedsGmailAuth] = useState<boolean>(true);
  const [gmailToken, setGmailToken] = useState<string | null>(null);
  const [gmailUserEmail, setGmailUserEmail] = useState<string | null>(null);
  const [isLoggingInGmail, setIsLoggingInGmail] = useState<boolean>(false);
  const [isSendingGmail, setIsSendingGmail] = useState<boolean>(false);
  const [gmailErrorMsg, setGmailErrorMsg] = useState<string | null>(null);
  const [confirmGmailAction, setConfirmGmailAction] = useState<null | {
    type: 'send' | 'draft';
    alsoReleaseToInbound?: boolean;
  }>(null);

  // State Kotak Masuk & Pesan Terkirim Gmail Vendor
  const [gmailMessages, setGmailMessages] = useState<GmailMessageSummary[]>([]);
  const [isLoadingGmailMessages, setIsLoadingGmailMessages] = useState<boolean>(false);
  const [gmailSearchQuery, setGmailSearchQuery] = useState<string>('Purchase Order OR PO-');
  const [selectedGmailMessage, setSelectedGmailMessage] = useState<GmailMessageSummary | null>(null);
  const [confirmTrashMessage, setConfirmTrashMessage] = useState<GmailMessageSummary | null>(null);

  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setNeedsGmailAuth(false);
        setGmailToken(token);
        setGmailUserEmail(user.email);
      },
      () => {
        setNeedsGmailAuth(true);
        setGmailToken(null);
        setGmailUserEmail(null);
      }
    );
    return () => unsubscribe();
  }, []);

  const handleLoadGmailMessages = async (customQuery?: string) => {
    const token = await getAccessToken();
    if (!token) {
      setNeedsGmailAuth(true);
      return;
    }
    setIsLoadingGmailMessages(true);
    setGmailErrorMsg(null);
    try {
      const q = customQuery !== undefined ? customQuery : gmailSearchQuery;
      const msgs = await listGmailMessages(q, 12);
      setGmailMessages(msgs);
    } catch (err: any) {
      if (err?.message === 'UNAUTHENTICATED') {
        setNeedsGmailAuth(true);
      } else {
        setGmailErrorMsg(err?.message || 'Gagal memuat daftar email dari Gmail.');
      }
    } finally {
      setIsLoadingGmailMessages(false);
    }
  };

  const handleGoogleSignInClick = async () => {
    setIsLoggingInGmail(true);
    setGmailErrorMsg(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setGmailToken(result.accessToken);
        setGmailUserEmail(result.user.email);
        setNeedsGmailAuth(false);
        setSubmitMsg({
          type: 'success',
          text: `Berhasil terhubung ke akun Gmail: ${result.user.email}`,
        });
        if (activeSubTab === 'gmail-vendor') {
          const msgs = await listGmailMessages(gmailSearchQuery, 12);
          setGmailMessages(msgs);
        }
      }
    } catch (err: any) {
      setGmailErrorMsg(err?.message || 'Login Google / Gmail dibatalkan atau gagal.');
    } finally {
      setIsLoggingInGmail(false);
    }
  };

  const handleGoogleSignOutClick = async () => {
    await logoutGoogle();
    setNeedsGmailAuth(true);
    setGmailToken(null);
    setGmailUserEmail(null);
    setGmailMessages([]);
    setSelectedGmailMessage(null);
  };

  // Explicit confirmation trigger before executing mutating Gmail API call
  const handleRequestGmailAction = (
    type: 'send' | 'draft',
    alsoReleaseToInbound?: boolean
  ) => {
    if (!emailModalPO) return;
    if (!emailRecipient.trim()) {
      setGmailErrorMsg('Harap isi alamat email tujuan vendor terlebih dahulu.');
      return;
    }
    setGmailErrorMsg(null);
    setConfirmGmailAction({ type, alsoReleaseToInbound });
  };

  // Execute Send or Draft via Gmail API after user confirms
  const handleExecuteConfirmedGmailAction = async () => {
    if (!emailModalPO || !confirmGmailAction) return;
    const token = await getAccessToken();
    if (!token) {
      setNeedsGmailAuth(true);
      setConfirmGmailAction(null);
      setGmailErrorMsg('Sesi Gmail belum aktif. Silakan klik "Sign in with Google" terlebih dahulu.');
      return;
    }

    setIsSendingGmail(true);
    setGmailErrorMsg(null);

    try {
      const po = emailModalPO;
      const specificVendor = emailTargetVendor === 'ALL' ? undefined : emailTargetVendor;

      let attachmentObj:
        | { fileName: string; mimeType: string; base64Data: string }
        | undefined;
      let downloadedPdfName = '';

      if (attachPDFInEmail) {
        const pdfAttachment = getPOPDFBase64Attachment(po, vendors, specificVendor);
        downloadedPdfName = pdfAttachment.fileName;
        if (pdfAttachment.base64Data) {
          attachmentObj = {
            fileName: pdfAttachment.fileName,
            mimeType: 'application/pdf',
            base64Data: pdfAttachment.base64Data,
          };
        }
        exportPOToPDF(po, vendors, specificVendor);
      }

      if (confirmGmailAction.type === 'draft') {
        const draftRes = await createGmailDraft({
          to: emailRecipient,
          cc: emailCc,
          subject: emailSubject,
          body: emailBody,
          attachment: attachmentObj,
        });
        setConfirmGmailAction(null);
        setEmailModalPO(null);
        setSuccessModalData({
          title: 'Draf Email PO Berhasil Disimpan di Gmail!',
          message: `Draf email Purchase Order (${po.id}) telah berhasil disimpan ke akun Gmail Anda (${gmailUserEmail || 'Gmail'}).`,
          details: [
            { label: 'ID Draf Gmail', value: draftRes.id },
            { label: 'Nomor Form PO', value: po.id },
            { label: 'Tujuan (To)', value: emailRecipient },
            { label: 'Subjek Email', value: emailSubject },
            {
              label: 'Lampiran PDF',
              value: attachPDFInEmail ? `${downloadedPdfName} (Terlampir)` : 'Tanpa Lampiran',
            },
          ],
        });
        setShowSuccessModal(true);
        scrollToTop();
        return;
      }

      // Send real email via Gmail API
      const sendRes = await sendGmailMessage({
        to: emailRecipient,
        cc: emailCc,
        subject: emailSubject,
        body: emailBody,
        attachment: attachmentObj,
      });

      const approvedItems = po.items.filter(
        (it) => it.status !== 'Rejected' && it.approvalStatus !== 'Rejected'
      );
      const uniqueVendorNames = Array.from(
        new Set(approvedItems.map((it) => it.vendorName || 'Vendor Umum'))
      );

      const entriesToRecord =
        emailTargetVendor === 'ALL'
          ? uniqueVendorNames.map((vName) => {
              const vObj = vendors.find((v) => v.namaVendor === vName);
              return {
                vendorName: vName,
                email: vObj?.email || emailRecipient,
                subject: emailSubject,
              };
            })
          : [
              {
                vendorName: emailTargetVendor,
                email: emailRecipient,
                subject: emailSubject,
              },
            ];

      recordVendorEmailSent(po.id, entriesToRecord);

      let releaseResultMsg = '';
      let receivingIdsCreated: string[] = [];
      if (confirmGmailAction.alsoReleaseToInbound && po.status === 'Approved by Cost Control') {
        const relRes = submitPOVendorToReceiving(po.id);
        if (relRes.success) {
          releaseResultMsg =
            ' Sekaligus berhasil di-Release to Vendor dan masuk ke laman Inbound (Penerimaan Barang Masuk).';
          receivingIdsCreated = relRes.receivingIds || [];
        }
      }

      setConfirmGmailAction(null);
      setEmailModalPO(null);

      const details: SuccessDetail[] = [
        { label: 'Metode Pengiriman', value: `Gmail API Resmi (${gmailUserEmail || 'Google Account'})` },
        { label: 'Gmail Message ID', value: sendRes.id },
        { label: 'Nomor Form PO', value: po.id },
        {
          label: 'Mitra Vendor Tujuan',
          value: emailTargetVendor === 'ALL' ? uniqueVendorNames.join(', ') : emailTargetVendor,
        },
        { label: 'Alamat Email Vendor', value: emailRecipient },
        { label: 'Subjek Email', value: emailSubject },
        {
          label: 'Lampiran PDF PO',
          value: attachPDFInEmail
            ? `${downloadedPdfName} (Terlampir di Gmail & Diunduh)`
            : 'Tanpa Lampiran PDF',
        },
      ];

      if (receivingIdsCreated.length > 0) {
        details.push({
          label: 'Dokumen Inbound (Receiving)',
          value: receivingIdsCreated.join(', '),
        });
        details.push({
          label: 'Status Form PO',
          value: 'Released to Vendor & Masuk ke Inbound',
        });
      }

      setSuccessModalData({
        title: confirmGmailAction.alsoReleaseToInbound
          ? 'Email Terkirim via Gmail & Form Masuk ke Inbound!'
          : 'Email Purchase Order Terkirim via Gmail!',
        message: `Dokumen Purchase Order (${po.id}) berhasil dikirim langsung melalui akun Gmail Anda ke alamat email vendor (${emailRecipient}).${releaseResultMsg}`,
        details,
      });
      setShowSuccessModal(true);
      scrollToTop();
    } catch (err: any) {
      if (err?.message === 'UNAUTHENTICATED') {
        setNeedsGmailAuth(true);
      }
      setGmailErrorMsg(err?.message || 'Gagal mengirim email melalui Gmail API.');
    } finally {
      setIsSendingGmail(false);
    }
  };

  const handleConfirmTrashGmailMessage = async () => {
    if (!confirmTrashMessage) return;
    try {
      await trashGmailMessage(confirmTrashMessage.id);
      setGmailMessages((prev) => prev.filter((m) => m.id !== confirmTrashMessage.id));
      if (selectedGmailMessage?.id === confirmTrashMessage.id) {
        setSelectedGmailMessage(null);
      }
      setSubmitMsg({
        type: 'success',
        text: `Pesan email "${confirmTrashMessage.subject}" berhasil dipindahkan ke Trash Gmail.`,
      });
    } catch (err: any) {
      setGmailErrorMsg(err?.message || 'Gagal menghapus pesan email.');
    } finally {
      setConfirmTrashMessage(null);
    }
  };

  const renderGoogleSignInButton = (label = 'Sign in with Google') => (
    <button
      type="button"
      onClick={handleGoogleSignInClick}
      disabled={isLoggingInGmail}
      className="gsi-material-button inline-flex items-center gap-2.5 px-4 py-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded-full text-xs font-bold shadow-xs transition cursor-pointer disabled:opacity-60"
    >
      <div className="gsi-material-button-state"></div>
      <div className="gsi-material-button-content-wrapper flex items-center gap-2.5">
        <div className="gsi-material-button-icon w-4 h-4 shrink-0">
          <svg
            version="1.1"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 48 48"
            xmlnsXlink="http://www.w3.org/1999/xlink"
            className="block w-4 h-4"
          >
            <path
              fill="#EA4335"
              d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
            ></path>
            <path
              fill="#4285F4"
              d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
            ></path>
            <path
              fill="#FBBC05"
              d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
            ></path>
            <path
              fill="#34A853"
              d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
            ></path>
            <path fill="none" d="M0 0h48v48H0z"></path>
          </svg>
        </div>
        <span className="gsi-material-button-contents">
          {isLoggingInGmail ? 'Menghubungkan Google...' : label}
        </span>
        <span className="hidden">Sign in with Google</span>
      </div>
    </button>
  );

  // Handle Send Email to Vendor (Fallback / Mailto Client)
  const handleSendVendorEmail = (options?: {
    openMailClient?: boolean;
    alsoReleaseToInbound?: boolean;
  }) => {
    if (!emailModalPO) return;
    if (!emailRecipient.trim()) {
      setSubmitMsg({
        type: 'error',
        text: 'Harap isi alamat email tujuan vendor terlebih dahulu.',
      });
      return;
    }

    const po = emailModalPO;
    const approvedItems = po.items.filter(
      (it) => it.status !== 'Rejected' && it.approvalStatus !== 'Rejected'
    );
    const uniqueVendorNames = Array.from(
      new Set(approvedItems.map((it) => it.vendorName || 'Vendor Umum'))
    );

    const entriesToRecord =
      emailTargetVendor === 'ALL'
        ? uniqueVendorNames.map((vName) => {
            const vObj = vendors.find((v) => v.namaVendor === vName);
            return {
              vendorName: vName,
              email: vObj?.email || emailRecipient,
              subject: emailSubject,
            };
          })
        : [
            {
              vendorName: emailTargetVendor,
              email: emailRecipient,
              subject: emailSubject,
            },
          ];

    recordVendorEmailSent(po.id, entriesToRecord);

    let downloadedPdfName = '';
    if (attachPDFInEmail) {
      downloadedPdfName = exportPOToPDF(
        po,
        vendors,
        emailTargetVendor === 'ALL' ? undefined : emailTargetVendor
      );
    }

    if (options?.openMailClient) {
      const mailtoUrl = `mailto:${encodeURIComponent(emailRecipient.trim())}?cc=${encodeURIComponent(
        emailCc.trim()
      )}&subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
      const link = document.createElement('a');
      link.href = mailtoUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    let releaseResultMsg = '';
    let receivingIdsCreated: string[] = [];
    if (options?.alsoReleaseToInbound && po.status === 'Approved by Cost Control') {
      const relRes = submitPOVendorToReceiving(po.id);
      if (relRes.success) {
        releaseResultMsg = ' Sekaligus berhasil di-Release to Vendor dan masuk ke laman Inbound (Penerimaan Barang Masuk).';
        receivingIdsCreated = relRes.receivingIds || [];
      }
    }

    setEmailModalPO(null);

    const details: SuccessDetail[] = [
      { label: 'Nomor Form PO', value: po.id },
      {
        label: 'Mitra Vendor Tujuan',
        value: emailTargetVendor === 'ALL' ? uniqueVendorNames.join(', ') : emailTargetVendor,
      },
      { label: 'Alamat Email Vendor', value: emailRecipient },
      { label: 'Subjek Email', value: emailSubject },
      {
        label: 'Lampiran PDF PO',
        value: attachPDFInEmail ? `${downloadedPdfName} (Terlampir & Diunduh)` : 'Tanpa Lampiran PDF',
      },
    ];

    if (receivingIdsCreated.length > 0) {
      details.push({
        label: 'Dokumen Inbound (Receiving)',
        value: receivingIdsCreated.join(', '),
      });
      details.push({
        label: 'Status Form PO',
        value: 'Released to Vendor & Masuk ke Inbound',
      });
    }

    setSuccessModalData({
      title: options?.alsoReleaseToInbound
        ? 'Email PO Terkirim & Form Masuk ke Inbound!'
        : 'Email Purchase Order Berhasil Dikirim ke Vendor!',
      message: `Dokumen Purchase Order (${po.id}) berhasil dikirimkan ke alamat email vendor (${emailRecipient}).${releaseResultMsg}`,
      details,
    });
    setShowSuccessModal(true);
    scrollToTop();
  };

  // Trigger Release to Vendor Modal (Single or Batch)
  const handleOpenReleaseModal = (poIds: string[]) => {
    const validPOs = purchaseOrders.filter(
      (p) => poIds.includes(p.id) && p.status === 'Approved by Cost Control'
    );
    if (validPOs.length === 0) {
      setSubmitMsg({
        type: 'error',
        text: 'Form PO belum mendapat persetujuan Cost Control. Pastikan semua item dan form PO telah di-approve oleh Cost Control sebelum melakukan Release to Vendor.',
      });
      return;
    }
    setReleasingPOIds(validPOs.map((p) => p.id));
  };

  // Confirm Release to Vendor & Send to Inbound Receiving
  const handleConfirmReleaseToVendor = () => {
    if (!releasingPOIds || releasingPOIds.length === 0) return;

    const targetPOs = purchaseOrders.filter((p) => releasingPOIds.includes(p.id));
    if (releaseAutoDownloadPDF) {
      targetPOs.forEach((po) => {
        exportPOToPDF(po, vendors);
      });
    }

    const res = batchReleasePOToVendor(releasingPOIds);
    setReleasingPOIds(null);

    if (res.success) {
      setSubmitMsg({ type: 'success', text: res.message });

      const allVendors = Array.from(
        new Set(
          targetPOs.flatMap((p) =>
            p.items
              .filter((it) => it.status !== 'Rejected' && it.approvalStatus !== 'Rejected')
              .map((it) => it.vendorName || 'Vendor Umum')
          )
        )
      );
      const totalVal = targetPOs.reduce((acc, p) => acc + p.totalAmount, 0);

      setSuccessModalData({
        title: 'Release to Vendor Berhasil! Masuk ke Inbound',
        message: `${res.message} Barang kini tercatat pada menu Inbound > Receiving dengan status "Menunggu Kedatangan" untuk proses penerimaan barang masuk.`,
        details: [
          { label: 'Form PO Di-release', value: releasingPOIds.join(', ') },
          { label: 'Dokumen Inbound Dibuat', value: `${res.receivingIds.join(', ')} (${res.receivingCount} Form Receiving)` },
          { label: 'Mitra Vendor Terkait', value: allVendors.join(', ') },
          { label: 'Total Nilai PO', value: formatRupiah(totalVal) },
          { label: 'Status Alur', value: 'Released to Vendor → Masuk Inbound (Penerimaan Barang Masuk)' },
        ],
      });
      setShowSuccessModal(true);
      scrollToTop();
    } else {
      setSubmitMsg({ type: 'error', text: res.message });
    }
  };

  // Submit / Release to Vendor & Inbound Receiving (Hanya setelah disetujui Cost Control)
  const handleSubmitToReceiving = (poIdToSubmit?: string) => {
    const targetId = poIdToSubmit || activePO?.id;
    if (!targetId) return;
    handleOpenReleaseModal([targetId]);
  };

  // Vendor CRUD
  const handleOpenAddVendor = () => {
    setIsEditingVendor(false);
    setVendorFormData({
      namaVendor: '',
      address: '',
      telephone: '',
      email: '',
      paymentCategory: 'Tempo',
      topTerm: 'TOP 14 Hari',
      cashType: 'Cash / COD',
      paymentType: 'TOP 14 Hari',
      pic: '',
      minimumOrder: 0,
      totalPurchase: 0,
      categories: ['Dry Item'],
    });
    setShowVendorModal(true);
  };

  const handleOpenEditVendor = (v: Vendor) => {
    setIsEditingVendor(true);
    const cat = v.paymentCategory || (v.paymentType?.startsWith('TOP') ? 'Tempo' : 'Cash');
    setVendorFormData({
      ...v,
      paymentCategory: cat,
      topTerm: v.topTerm || (cat === 'Tempo' ? v.paymentType : 'TOP 14 Hari'),
      cashType: v.cashType || (cat === 'Cash' ? v.paymentType : 'Cash / COD'),
      paymentType: v.paymentType || (cat === 'Tempo' ? 'TOP 14 Hari' : 'Cash / COD'),
      minimumOrder: v.minimumOrder ?? 0,
    });
    setShowVendorModal(true);
  };

  const handleSaveVendorForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorFormData.namaVendor || !vendorFormData.pic) return;

    const category = vendorFormData.paymentCategory || 'Tempo';
    const topTerm = vendorFormData.topTerm || 'TOP 14 Hari';
    const cashType = vendorFormData.cashType || 'Cash / COD';
    const paymentType = category === 'Tempo' ? topTerm : cashType;
    const minOrder = Math.max(0, Number(vendorFormData.minimumOrder) || 0);

    const completeVendor: Partial<Vendor> = {
      ...vendorFormData,
      paymentCategory: category,
      topTerm: category === 'Tempo' ? topTerm : undefined,
      cashType: category === 'Cash' ? cashType : undefined,
      paymentType,
      minimumOrder: minOrder,
    };

    const nama = completeVendor.namaVendor || '';
    const pic = completeVendor.pic || '';
    const telp = completeVendor.telephone || '-';
    const isEdit = isEditingVendor;

    if (isEditingVendor) {
      updateVendor(completeVendor as Vendor);
    } else {
      addVendor(completeVendor as Omit<Vendor, 'id'>);
    }

    setShowVendorModal(false);

    // Pop-up sukses simpan vendor
    setSuccessModalData({
      title: 'Data Telah Berhasil Di-input!',
      message: isEdit
        ? `Data Vendor ${nama} berhasil diperbarui.`
        : `Vendor baru ${nama} berhasil didaftarkan ke sistem.`,
      details: [
        { label: 'Nama Vendor', value: nama },
        { label: 'Nama PIC', value: pic },
        { label: 'No. Telepon', value: telp },
        { label: 'Kategori Pembayaran', value: category },
        { label: 'Termin / Detail', value: paymentType },
        { label: 'Nilai Minimum Order', value: formatRupiah(minOrder) },
        { label: 'Aksi', value: isEdit ? 'Update Data' : 'Pendaftaran Baru' },
      ],
    });
    setShowSuccessModal(true);
    scrollToTop();
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <Building2 className="w-6 h-6 text-indigo-600" />
            Purchasing & Vendor
          </h1>
          <p className="text-xs text-slate-500">
            Penugasan vendor tiap item pesanan, penyesuaian qty/harga, pengajuan ke Cost Control, submit to vendor, dan kelola direktori vendor.
          </p>
        </div>

        {/* Subtabs */}
        <div className="flex items-center gap-1.5 bg-slate-200/70 p-1 rounded-xl">
          <button
            onClick={() => setActiveSubTab('po-vendor')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'po-vendor'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileCheck className="w-3.5 h-3.5" />
            <span>Kelola & Penugasan Vendor</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-100 text-indigo-800 font-bold">
              {purchaseOrders.filter((p) => p.status === 'Draft PO' || p.status === 'Submitted to Purchasing').length}
            </span>
          </button>

          <button
            onClick={() => setActiveSubTab('vendor-summary')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'vendor-summary'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Vendor Summary</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-100 text-amber-900 font-bold">
              {purchaseOrders.filter((p) => p.status === 'Vendor Summary').length}
            </span>
          </button>

          <button
            onClick={() => setActiveSubTab('list-vendor')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'list-vendor'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>List Vendor</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-700 font-bold">
              {vendors.length}
            </span>
          </button>

          <button
            onClick={() => {
              setActiveSubTab('gmail-vendor');
              if (!needsGmailAuth && gmailToken && gmailMessages.length === 0) {
                handleLoadGmailMessages();
              }
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'gmail-vendor'
                ? 'bg-white text-rose-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Mail className="w-3.5 h-3.5 text-rose-600" />
            <span>Gmail Vendor</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                !needsGmailAuth && gmailToken
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-rose-100 text-rose-800'
              }`}
            >
              {!needsGmailAuth && gmailToken ? 'Connected' : 'OAuth'}
            </span>
          </button>
        </div>
      </div>

      {submitMsg && (
        <div
          className={`p-3.5 rounded-xl text-xs font-medium flex items-center justify-between ${
            submitMsg.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {submitMsg.type === 'success' ? (
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span>{submitMsg.text}</span>
          </div>
          <button onClick={() => setSubmitMsg(null)} className="p-1 hover:opacity-75">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 1. Subtab: PO Vendor */}
      {activeSubTab === 'po-vendor' && (
        <div className="space-y-4">
          {/* Info Banner */}
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3.5 text-xs text-indigo-900 flex items-start gap-2.5">
            <Building2 className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0" />
            <div>
              <span className="font-bold">Alur Penugasan Vendor & PO Supplier:</span>
              <p className="text-[11px] text-indigo-800 mt-0.5">
                Pilih formulir PO untuk menampilkan dan mengelola rincian barang di bawahnya. Anda dapat menentukan vendor mitra per barang, mengubah qty/harga, menolak barang, lalu meneruskan PO ke <strong>Receiving (Inbound)</strong>.
              </p>
            </div>
          </div>

          {/* Table of PO Forms */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <FileCheck className="w-4 h-4 text-indigo-600" />
                  Daftar Form PO Vendor ({purchaseOrders.length} Formulir)
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Tampilan awal daftar form PO. Klik pada baris form atau tombol <strong>"Kelola & List Barang"</strong> untuk menampilkan rincian barang.
                </p>
              </div>
            </div>

            {/* Search & Filter Toolbar for PO Vendor */}
            <div className="p-3 bg-slate-50/90 border-b border-slate-200 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 text-xs">
              {/* Search Bar */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={poSearchQuery}
                  onChange={(e) => setPoSearchQuery(e.target.value)}
                  placeholder="Cari Nomor Form PO atau Status..."
                  className="w-full pl-9 pr-8 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden"
                />
                {poSearchQuery && (
                  <button
                    onClick={() => setPoSearchQuery('')}
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
                    value={poDateFilter}
                    onChange={(e) => setPoDateFilter(e.target.value)}
                    className="text-xs text-slate-700 bg-transparent outline-hidden font-medium"
                  />
                  {poDateFilter && (
                    <button
                      onClick={() => setPoDateFilter('')}
                      className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-semibold ml-1"
                      title="Tampilkan semua tanggal"
                    >
                      Semua
                    </button>
                  )}
                </div>

                {/* Urutkan Tanggal */}
                <button
                  onClick={() => setPoDateSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg font-semibold transition shadow-2xs"
                  title="Urutkan berdasarkan tanggal generate PO"
                >
                  <ArrowUpDown className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Urutkan: {poDateSortOrder === 'desc' ? 'Terbaru' : 'Terlama'}</span>
                </button>
              </div>
            </div>

            {filteredAndSortedPOs.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <FileCheck className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                <p className="text-sm font-semibold">
                  {purchaseOrders.length === 0
                    ? 'Belum ada Purchase Order yang digenerate.'
                    : 'Tidak ada Purchase Order yang cocok dengan filter tanggal atau pencarian.'}
                </p>
              </div>
            ) : (
              <>
                {openActionMenuPOVendorId && (
                  <div
                    className="fixed inset-0 z-30 bg-transparent"
                    onClick={() => setOpenActionMenuPOVendorId(null)}
                  />
                )}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100/70 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3">Nomor Form PO</th>
                        <th className="px-4 py-3">Tgl Generate</th>
                        <th className="px-4 py-3 text-right">Total Nilai (IDR)</th>
                        <th className="px-4 py-3 text-center">Status</th>
                        <th className="px-4 py-3 text-center">Aksi Form PO</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredAndSortedPOs.map((po) => {
                        const isSelected = selectedPOId === po.id;
                        const isSentToReceiving = po.status === 'Sent to Receiving';
                        const isMenuOpen = openActionMenuPOVendorId === po.id;

                        return (
                          <React.Fragment key={po.id}>
                            <tr
                              onClick={() => setSelectedPOId(isSelected ? null : po.id)}
                              className={`hover:bg-indigo-50/50 transition cursor-pointer ${
                                isSelected ? 'bg-indigo-50/80 font-medium border-l-4 border-l-indigo-600' : ''
                              }`}
                            >
                              <td className="px-4 py-3 font-mono font-bold text-slate-900">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-100 text-indigo-900 border border-indigo-200 font-bold">
                                  {po.id}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-slate-700 font-medium">
                                {formatDate(po.generatedDate)}
                              </td>
                              <td className="px-4 py-3 text-right font-extrabold text-indigo-800">
                                {formatRupiah(po.totalAmount)}
                              </td>
                              <td className="px-4 py-3 text-center">
                                {po.status === 'Submitted to Purchasing' && (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                    <Clock className="w-3 h-3 text-amber-600" />
                                    Masuk dari PR (Siap Diajukan CC)
                                  </span>
                                )}
                                {po.status === 'Draft PO' && (
                                  <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-300">
                                    Draft PO (Isi Vendor)
                                  </span>
                                )}
                                {po.status === 'Review Cost Control' && (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                    <Clock className="w-3 h-3 text-amber-600 animate-pulse" />
                                    Review Cost Control
                                  </span>
                                )}
                                {po.status === 'Approved by Cost Control' && (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                    Disetujui Cost Control
                                  </span>
                                )}
                                {po.status === 'Rejected by Cost Control' && (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800 border border-red-300">
                                    <Ban className="w-3 h-3 text-red-600" />
                                    Revisi Cost Control
                                  </span>
                                )}
                                {(po.status === 'Sent to Receiving' || po.status === 'Submitted to Vendor' || po.status === 'Completed') && (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-300">
                                    <Check className="w-3 h-3 text-blue-600" />
                                    Terkirim ke Vendor
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-center relative" onClick={(e) => e.stopPropagation()}>
                                <div className="relative inline-block text-left">
                                  <button
                                    type="button"
                                    onClick={() => setOpenActionMenuPOVendorId(isMenuOpen ? null : po.id)}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-2xs border cursor-pointer ${
                                      isMenuOpen
                                        ? 'bg-indigo-600 text-white border-indigo-600 ring-2 ring-indigo-200'
                                        : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-300'
                                    }`}
                                    title="Buka opsi pilihan fungsi form PO Vendor ini"
                                    aria-expanded={isMenuOpen}
                                  >
                                    <SlidersHorizontal className={`w-3.5 h-3.5 ${isMenuOpen ? 'text-white' : 'text-indigo-600'}`} />
                                    <span>Pilihan Opsi Form</span>
                                    <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isMenuOpen ? 'rotate-180 text-white' : 'text-slate-400'}`} />
                                  </button>

                                  {isMenuOpen && (
                                    <div
                                      className="absolute right-0 top-full mt-1.5 w-80 sm:w-92 bg-white rounded-2xl shadow-2xl border border-slate-200 py-2.5 z-40 animate-in fade-in zoom-in-95 duration-150 text-left"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <div className="px-3.5 py-1.5 border-b border-slate-100 flex items-center justify-between mb-1.5">
                                        <div>
                                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                                            List Opsi Form PO Vendor
                                          </span>
                                          <div className="text-xs font-bold text-slate-800">
                                            {po.id} • {formatDate(po.generatedDate)}
                                          </div>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => setOpenActionMenuPOVendorId(null)}
                                          className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                                        >
                                          <X className="w-3.5 h-3.5" />
                                        </button>
                                      </div>

                                      <div className="px-1.5 space-y-1 max-h-[380px] overflow-y-auto">
                                        {/* Opsi 1: Kelola & Lihat List Barang PO */}
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setOpenActionMenuPOVendorId(null);
                                            setSelectedPOId(isSelected ? null : po.id);
                                          }}
                                          className="w-full flex items-start gap-2.5 p-2 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-200 transition group text-left cursor-pointer"
                                        >
                                          <div className="p-1.5 rounded-lg bg-slate-100 text-slate-700 group-hover:bg-indigo-600 group-hover:text-white transition shrink-0 mt-0.5">
                                            {isSelected ? <ChevronUp className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <span className="font-bold text-xs text-slate-900 group-hover:text-indigo-700 block">
                                              {isSelected ? 'Tutup Rincian List Barang' : 'Kelola & Lihat List Barang'}
                                            </span>
                                            <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                                              Fungsi: {isSelected ? 'Sembunyikan tabel rincian item form PO.' : 'Buka tabel rincian untuk alokasi vendor, edit harga deal, atau tolak barang.'}
                                            </p>
                                          </div>
                                        </button>

                                        {/* Opsi 2: Ajukan ke Cost Control (jika Draft / Submitted / Rejected) */}
                                        {(po.status === 'Draft PO' || po.status === 'Submitted to Purchasing' || po.status === 'Rejected by Cost Control') && (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setOpenActionMenuPOVendorId(null);
                                              handleTriggerSubmitToCostControl(po);
                                            }}
                                            className="w-full flex items-start gap-2.5 p-2 rounded-xl hover:bg-rose-50/80 border border-transparent hover:border-rose-200 transition group text-left cursor-pointer"
                                          >
                                            <div className="p-1.5 rounded-lg bg-rose-100 text-rose-700 group-hover:bg-rose-600 group-hover:text-white transition shrink-0 mt-0.5">
                                              <Calculator className="w-3.5 h-3.5" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                              <div className="flex items-center gap-1.5">
                                                <span className="font-bold text-xs text-slate-900 group-hover:text-rose-700">
                                                  Ajukan Form ke Cost Control
                                                </span>
                                                <span className="text-[10px] font-bold px-1.5 py-0.2 bg-rose-100 text-rose-800 rounded">
                                                  Approval CC
                                                </span>
                                              </div>
                                              <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                                                Fungsi: Ajukan total nilai PO ke tim Cost Control untuk diverifikasi dan disetujui.
                                              </p>
                                            </div>
                                          </button>
                                        )}

                                        {/* Opsi 3: Release to Vendor & Inbound (jika Approved CC) */}
                                        {po.status === 'Approved by Cost Control' && (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setOpenActionMenuPOVendorId(null);
                                              handleSubmitToReceiving(po.id);
                                            }}
                                            className="w-full flex items-start gap-2.5 p-2 rounded-xl hover:bg-emerald-50/80 border border-transparent hover:border-emerald-200 transition group text-left cursor-pointer"
                                          >
                                            <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white transition shrink-0 mt-0.5">
                                              <Truck className="w-3.5 h-3.5" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                              <div className="flex items-center gap-1.5">
                                                <span className="font-bold text-xs text-slate-900 group-hover:text-emerald-700">
                                                  Release to Vendor (Masuk Inbound)
                                                </span>
                                                <span className="text-[10px] font-bold px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded">
                                                  Release PO
                                                </span>
                                              </div>
                                              <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                                                Fungsi: Release pesanan ke vendor dan otomatis masukkan form ke Inbound sebagai penerimaan barang masuk.
                                              </p>
                                            </div>
                                          </button>
                                        )}

                                        {/* Status Menunggu Cost Control */}
                                        {po.status === 'Review Cost Control' && (
                                          <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200/80 flex items-center gap-2.5 text-xs text-amber-800 font-semibold">
                                            <Clock className="w-4 h-4 text-amber-600 animate-pulse shrink-0" />
                                            <div>
                                              <span className="font-bold block">Sedang Ditinjau Cost Control</span>
                                              <span className="text-[11px] text-slate-500 font-normal">
                                                Menunggu approval Cost Control sebelum dapat dilakukan Release to Vendor.
                                              </span>
                                            </div>
                                          </div>
                                        )}

                                        {/* Status Terkirim ke Vendor */}
                                        {(po.status === 'Sent to Receiving' || po.status === 'Submitted to Vendor' || po.status === 'Completed') && (
                                          <div className="p-2.5 bg-blue-50 rounded-xl border border-blue-200/80 flex items-center gap-2.5 text-xs text-blue-800 font-semibold">
                                            <Check className="w-4 h-4 text-blue-600 shrink-0" />
                                            <div>
                                              <span className="font-bold block">Released to Vendor &amp; Masuk Inbound</span>
                                              <span className="text-[11px] text-slate-500 font-normal">
                                                Form pesanan sudah di-release ke vendor dan masuk ke Inbound sebagai penerimaan barang masuk.
                                              </span>
                                            </div>
                                          </div>
                                        )}

                                        {/* Opsi 4: Export Dokumen PO ke PDF (.pdf) */}
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setOpenActionMenuPOVendorId(null);
                                            handleExportPDF(po);
                                          }}
                                          className="w-full flex items-start gap-2.5 p-2 rounded-xl hover:bg-rose-50/80 border border-transparent hover:border-rose-200 transition group text-left cursor-pointer"
                                        >
                                          <div className="p-1.5 rounded-lg bg-rose-100 text-rose-700 group-hover:bg-rose-600 group-hover:text-white transition shrink-0 mt-0.5">
                                            <FileText className="w-3.5 h-3.5" />
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <span className="font-bold text-xs text-slate-900 group-hover:text-rose-700 block">
                                              Export PO ke PDF (.pdf)
                                            </span>
                                            <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                                              Fungsi: Unduh dokumen resmi Purchase Order dalam format PDF siap cetak / kirim.
                                            </p>
                                          </div>
                                        </button>

                                        {/* Opsi 5: Kirim Email PO ke Alamat Email Vendor */}
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setOpenActionMenuPOVendorId(null);
                                            handleOpenEmailModal(po);
                                          }}
                                          className="w-full flex items-start gap-2.5 p-2 rounded-xl hover:bg-indigo-50/80 border border-transparent hover:border-indigo-200 transition group text-left cursor-pointer"
                                        >
                                          <div className="p-1.5 rounded-lg bg-indigo-100 text-indigo-700 group-hover:bg-indigo-600 group-hover:text-white transition shrink-0 mt-0.5">
                                            <Mail className="w-3.5 h-3.5" />
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <span className="font-bold text-xs text-slate-900 group-hover:text-indigo-700 block">
                                              Email PO ke Alamat Email Vendor
                                            </span>
                                            <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                                              Fungsi: Kirim dokumen Purchase Order beserta lampiran PDF ke alamat email resmi vendor.
                                            </p>
                                          </div>
                                        </button>

                                        {/* Opsi 6: Export Dokumen PO ke Excel */}
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setOpenActionMenuPOVendorId(null);
                                            exportPOToExcel(po);
                                          }}
                                          className="w-full flex items-start gap-2.5 p-2 rounded-xl hover:bg-emerald-50/80 border border-transparent hover:border-emerald-200 transition group text-left cursor-pointer"
                                        >
                                          <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white transition shrink-0 mt-0.5">
                                            <FileSpreadsheet className="w-3.5 h-3.5" />
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <span className="font-bold text-xs text-slate-900 group-hover:text-emerald-700 block">
                                              Export PO Vendor ke Excel (.xlsx)
                                            </span>
                                            <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                                              Fungsi: Unduh formulir Purchase Order vendor dalam format berkas spreadsheet resmi.
                                            </p>
                                          </div>
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>

                          {/* Tampilan List Barang Tepat di Bawah Form PO yang Dipilih */}
                          {isSelected && (
                            <tr className="bg-indigo-50/30 border-b-2 border-indigo-400">
                              <td colSpan={5} className="p-3 sm:p-4">
                                <div className="bg-white rounded-xl border-2 border-indigo-400 shadow-sm overflow-hidden animate-in fade-in duration-200">
                                  {/* Sub-header & Action Buttons */}
                                  <div className="p-4 bg-gradient-to-r from-indigo-50 to-slate-50 border-b border-indigo-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <span className="font-mono font-bold text-xs bg-indigo-600 text-white px-2 py-0.5 rounded-md">
                                          {po.id}
                                        </span>
                                        <h4 className="font-bold text-sm text-slate-900">
                                          Kelola &amp; Penugasan Vendor ({po.items.length} item)
                                        </h4>
                                      </div>
                                      <p className="text-[11px] text-slate-500 mt-1">
                                        Pilih vendor untuk setiap item. <strong>Qty &amp; Harga Satuan merupakan field bebas</strong> yang dapat langsung diedit pada kolom tabel di bawah.
                                      </p>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2">
                                      {/* Quick assign */}
                                      <div className="flex items-center gap-1 text-xs">
                                        <span className="text-[11px] text-slate-500 font-semibold">Tugaskan Semua:</span>
                                        <select
                                          onChange={(e) => {
                                            if (e.target.value) handleAssignAllToVendor(e.target.value);
                                          }}
                                          defaultValue=""
                                          className="text-xs bg-white border border-slate-300 rounded-lg px-2 py-1 font-semibold"
                                        >
                                          <option value="" disabled>-- Pilih Vendor --</option>
                                          {vendors.map((v) => (
                                            <option key={v.id} value={v.namaVendor}>
                                              {v.namaVendor}
                                            </option>
                                          ))}
                                        </select>
                                      </div>

                                      <button
                                        onClick={() => setShowAddItemModal(true)}
                                        className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold cursor-pointer"
                                      >
                                        <Plus className="w-3.5 h-3.5" />
                                        Tambah Barang
                                      </button>

                                      <button
                                        onClick={() => handleExportPDF(po)}
                                        className="flex items-center gap-1 px-3 py-1.5 bg-white border border-rose-200 hover:bg-rose-50 text-rose-700 rounded-lg text-xs font-bold shadow-2xs transition cursor-pointer"
                                        title="Export Dokumen PO ke PDF (.pdf)"
                                      >
                                        <FileText className="w-3.5 h-3.5 text-rose-600" />
                                        Export PDF
                                      </button>

                                      <button
                                        onClick={() => handleOpenEmailModal(po)}
                                        className="flex items-center gap-1 px-3 py-1.5 bg-white border border-indigo-200 hover:bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold shadow-2xs transition cursor-pointer"
                                        title="Kirim Email PO ke Alamat Email Vendor"
                                      >
                                        <Mail className="w-3.5 h-3.5 text-indigo-600" />
                                        Email Vendor
                                      </button>

                                      <button
                                        onClick={() => exportPOToExcel(po)}
                                        className="flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold shadow-2xs cursor-pointer"
                                        title="Export Excel"
                                      >
                                        <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                                        Excel
                                      </button>

                                      {po.status === 'Approved by Cost Control' && (
                                        <button
                                          onClick={() => handleSubmitToReceiving(po.id)}
                                          className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-extrabold shadow-sm transition cursor-pointer"
                                          title="Release form PO ke Vendor & otomatis masuk ke Inbound sebagai penerimaan barang masuk"
                                        >
                                          <Truck className="w-3.5 h-3.5" />
                                          Release to Vendor
                                        </button>
                                      )}

                                      {po.status === 'Review Cost Control' && (
                                        <button
                                          disabled
                                          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 border border-amber-300 text-amber-800 rounded-lg text-xs font-bold cursor-not-allowed"
                                          title="Form sedang ditinjau di Cost Control. Tombol Release to Vendor akan aktif setelah Cost Control approve."
                                        >
                                          <Clock className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                                          Menunggu Approval Cost Control
                                        </button>
                                      )}

                                      {(po.status === 'Draft PO' || po.status === 'Submitted to Purchasing' || po.status === 'Rejected by Cost Control') && (
                                        <button
                                          onClick={() => handleSubmitToVendorSummary(po.id)}
                                          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"
                                          title="Submit form ke proses Vendor Summary setelah penugasan vendor selesai"
                                        >
                                          <Layers className="w-3.5 h-3.5" />
                                          Submit ke Vendor Summary
                                        </button>
                                      )}

                                      {po.status === 'Vendor Summary' && (
                                        <button
                                          onClick={() => {
                                            setActiveSubTab('vendor-summary');
                                            setSelectedPOId(null);
                                          }}
                                          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"
                                          title="Buka form ini pada tab Vendor Summary untuk diajukan ke Cost Control"
                                        >
                                          <Layers className="w-3.5 h-3.5" />
                                          Buka di Vendor Summary
                                        </button>
                                      )}

                                      {isSentToReceiving && (
                                        <span className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-800 border border-blue-200 rounded-lg text-xs font-bold">
                                          <Check className="w-3.5 h-3.5 text-blue-600" />
                                          Released to Vendor (Inbound)
                                        </span>
                                      )}

                                      <button
                                        onClick={() => setSelectedPOId(null)}
                                        className="p-1.5 text-slate-400 hover:text-slate-700 ml-1"
                                        title="Tutup rincian list barang"
                                      >
                                        <X className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </div>

                                  {/* Status Banner Alur Cost Control & PO Vendor */}
                                  {(po.status === 'Draft PO' || po.status === 'Submitted to Purchasing') && (
                                    <div className="mx-4 mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                                      <div className="flex items-center gap-2">
                                        <Building2 className="w-4 h-4 text-amber-600 shrink-0" />
                                        <span>
                                          <strong>Alur Penugasan Vendor:</strong> Form PO ini diterima dari Purchase Request. Tentukan <strong>Nama Vendor / Supplier</strong> dan <strong>Tipe Pembayaran (Tempo atau Cash)</strong> untuk barang di bawah. Setelah terisi, klik <strong>"Submit ke Vendor Summary"</strong> agar form diproses ke tahap Vendor Summary (dipisah per Tipe Pembayaran &amp; Vendor) sebelum diajukan ke Cost Control.
                                        </span>
                                      </div>
                                      <button
                                        onClick={() => handleSubmitToVendorSummary(po.id)}
                                        className="shrink-0 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs shadow-xs transition flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
                                      >
                                        <Layers className="w-3.5 h-3.5" />
                                        Submit ke Vendor Summary
                                      </button>
                                    </div>
                                  )}

                                  {po.status === 'Vendor Summary' && (
                                    <div className="mx-4 mt-3 p-3 bg-purple-50 border border-purple-200 rounded-xl text-xs text-purple-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                                      <div className="flex items-center gap-2">
                                        <Layers className="w-4 h-4 text-purple-600 shrink-0" />
                                        <span>
                                          <strong>Status Vendor Summary:</strong> Form PO ini telah selesai penugasan vendor dan berada di tahap <strong>Vendor Summary</strong> (Tipe Pembayaran &gt; Vendor &gt; List Barang). Buka tab <strong>Vendor Summary</strong> untuk memilih dan mengajukan form ini ke Cost Control.
                                        </span>
                                      </div>
                                      <button
                                        onClick={() => {
                                          setActiveSubTab('vendor-summary');
                                          setSelectedPOId(null);
                                        }}
                                        className="shrink-0 px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold text-xs shadow-xs transition flex items-center gap-1 self-start sm:self-auto cursor-pointer"
                                      >
                                        <ArrowRight className="w-3.5 h-3.5" />
                                        Buka Tab Vendor Summary
                                      </button>
                                    </div>
                                  )}

                                  {po.status === 'Review Cost Control' && (
                                    <div className="mx-4 mt-3 p-3 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 flex items-center gap-2.5">
                                      <Clock className="w-4 h-4 text-amber-600 shrink-0 animate-pulse" />
                                      <div>
                                        <span className="font-bold">Form Telah Masuk ke Laman Cost Control:</span> Form PO ini sedang dalam proses peninjauan oleh pihak Cost Control. Fungsi <strong>"Release to Vendor"</strong> akan aktif secara otomatis setelah semua item dan form mendapat persetujuan Cost Control.
                                      </div>
                                    </div>
                                  )}

                                  {po.status === 'Approved by Cost Control' && (
                                    <div className="mx-4 mt-3 p-3.5 bg-emerald-50 border-2 border-emerald-300 rounded-xl text-xs text-emerald-950 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                                      <div className="flex items-start gap-2.5">
                                        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                                        <div>
                                          <span className="font-extrabold text-emerald-900 block">
                                            Telah Mendapat Persetujuan Cost Control — Siap Release to Vendor!
                                          </span>
                                          <span className="text-emerald-800">
                                            Total pengajuan pembelian ({formatRupiah(po.totalAmount)}) telah disetujui oleh Cost Control. Anda dapat mengunduh dokumen <strong>PDF</strong>, mengirim <strong>Email ke Vendor</strong>, dan melakukan <strong>Release to Vendor</strong> agar form masuk ke <strong>Inbound</strong> sebagai penerimaan barang masuk.
                                          </span>
                                        </div>
                                      </div>
                                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                                        <button
                                          onClick={() => handleExportPDF(po)}
                                          className="px-3 py-1.5 bg-white hover:bg-rose-50 text-rose-700 border border-rose-300 rounded-lg font-bold text-xs shadow-2xs transition flex items-center gap-1.5 cursor-pointer"
                                        >
                                          <FileText className="w-3.5 h-3.5 text-rose-600" />
                                          Export to PDF
                                        </button>
                                        <button
                                          onClick={() => handleOpenEmailModal(po)}
                                          className="px-3 py-1.5 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-300 rounded-lg font-bold text-xs shadow-2xs transition flex items-center gap-1.5 cursor-pointer"
                                        >
                                          <Mail className="w-3.5 h-3.5 text-indigo-600" />
                                          Email ke Vendor
                                        </button>
                                        <button
                                          onClick={() => handleSubmitToReceiving(po.id)}
                                          className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-extrabold text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                                        >
                                          <Truck className="w-3.5 h-3.5" />
                                          Release to Vendor (Masuk Inbound)
                                        </button>
                                      </div>
                                    </div>
                                  )}

                                  {isSentToReceiving && (
                                    <div className="mx-4 mt-3 p-3.5 bg-blue-50 border border-blue-300 rounded-xl text-xs text-blue-950 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                                      <div className="flex items-start gap-2.5">
                                        <Truck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                                        <div>
                                          <span className="font-extrabold text-blue-900 block">
                                            Form Telah Di-Release ke Vendor &amp; Masuk ke Inbound (Penerimaan Barang Masuk)
                                          </span>
                                          <span className="text-blue-800">
                                            Dokumen PO ini telah diteruskan ke mitra vendor dan tercatat otomatis pada modul <strong>Inbound &gt; Penerimaan Barang Masuk (Receiving)</strong>.
                                          </span>
                                        </div>
                                      </div>
                                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                                        <button
                                          onClick={() => handleExportPDF(po)}
                                          className="px-3 py-1.5 bg-white hover:bg-rose-50 text-rose-700 border border-rose-300 rounded-lg font-bold text-xs shadow-2xs transition flex items-center gap-1.5 cursor-pointer"
                                        >
                                          <FileText className="w-3.5 h-3.5 text-rose-600" />
                                          Export to PDF
                                        </button>
                                        <button
                                          onClick={() => handleOpenEmailModal(po)}
                                          className="px-3 py-1.5 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-300 rounded-lg font-bold text-xs shadow-2xs transition flex items-center gap-1.5 cursor-pointer"
                                        >
                                          <Mail className="w-3.5 h-3.5 text-indigo-600" />
                                          Email ke Vendor
                                        </button>
                                      </div>
                                    </div>
                                  )}

                                  {po.status === 'Rejected by Cost Control' && (
                                    <div className="mx-4 mt-3 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                                      <div className="flex items-center gap-2">
                                        <Ban className="w-4 h-4 text-red-600 shrink-0" />
                                        <div>
                                          <span className="font-bold">Permintaan Revisi dari Cost Control:</span> {po.costControlApproval?.notes || 'Harap periksa kembali harga dan kuantitas.'}
                                        </div>
                                      </div>
                                      <button
                                        onClick={() => handleTriggerSubmitToCostControl(po)}
                                        className="shrink-0 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs shadow-xs transition flex items-center gap-1 self-start sm:self-auto cursor-pointer"
                                      >
                                        <Calculator className="w-3.5 h-3.5" />
                                        Ajukan Ulang ke Cost Control
                                      </button>
                                    </div>
                                  )}

                                  {/* Items Table */}
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs">
                                      <thead className="bg-slate-100/70 text-slate-600 font-bold border-b border-slate-200">
                                        <tr>
                                          <th className="px-3 py-2.5">SKU</th>
                                          <th className="px-3 py-2.5">Item Name</th>
                                          <th className="px-3 py-2.5">Category</th>
                                          <th className="px-3 py-2.5 min-w-[170px]">Alokasi Outlet</th>
                                          <th className="px-3 py-2.5 text-center min-w-[105px]">Qty (Field Bebas)</th>
                                          <th className="px-3 py-2.5 text-center">Unit</th>
                                          <th className="px-3 py-2.5 text-right min-w-[145px]">Harga Satuan (Field Bebas)</th>
                                          <th className="px-3 py-2.5 text-right">Total</th>
                                          <th className="px-3 py-2.5 min-w-[200px]">Nama Vendor / Supplier</th>
                                          <th className="px-3 py-2.5 text-center min-w-[130px]">Tipe Pembayaran</th>
                                          <th className="px-3 py-2.5 text-center">Aksi</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100">
                                        {po.items.map((it, idx) => {
                                          const isRejected = it.status === 'Rejected';
                                          const isLocked = isRejected || po.status === 'Sent to Receiving';

                                          return (
                                            <tr
                                              key={`${it.sku}-${idx}`}
                                              className={`hover:bg-slate-50 transition ${
                                                isRejected ? 'bg-red-50/60 opacity-75' : ''
                                              }`}
                                            >
                                              <td className="px-3 py-2 font-mono font-bold text-slate-800">
                                                {it.sku}
                                              </td>
                                              <td className="px-3 py-2 font-medium text-slate-900">
                                                <div className="flex flex-col gap-0.5">
                                                  <span className={isRejected ? 'line-through text-red-700' : ''}>
                                                    {it.itemName}
                                                  </span>
                                                  {isRejected && (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-700 bg-red-100 border border-red-200 px-1.5 py-0.5 rounded w-fit">
                                                      <Ban className="w-2.5 h-2.5 shrink-0" />
                                                      Ditolak Purchasing: {it.rejectionReason || 'Stok vendor kosong'}
                                                    </span>
                                                  )}
                                                </div>
                                              </td>
                                              <td className="px-3 py-2 text-slate-600">{it.category}</td>

                                              {/* Alokasi Outlet */}
                                              <td className="px-3 py-2 text-slate-700">
                                                {it.isMerged || (it.outletBreakdowns && it.outletBreakdowns.length > 1) ? (
                                                  <div className="space-y-1 py-0.5">
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                                                      Merge ({it.outletBreakdowns?.length || 2} Outlet)
                                                    </span>
                                                    <div className="flex flex-col gap-0.5 text-[11px]">
                                                      {it.outletBreakdowns?.map((bd, bIdx) => (
                                                        <div
                                                          key={bIdx}
                                                          className="flex items-center gap-1 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200"
                                                        >
                                                          <span className="font-semibold text-slate-800">{bd.outletName}</span>:
                                                          <span className="font-bold text-indigo-700">{bd.qty} {bd.unit}</span>
                                                        </div>
                                                      )) || (
                                                        <span className="text-slate-700 font-medium">{it.place || '-'}</span>
                                                      )}
                                                    </div>
                                                  </div>
                                                ) : (
                                                  <div>
                                                    <span className="font-semibold text-slate-800">{it.place || '-'}</span>
                                                    {it.outletBreakdownText && it.place !== it.outletBreakdownText && (
                                                      <span className="block text-[10px] text-slate-500">
                                                        {it.outletBreakdownText}
                                                      </span>
                                                    )}
                                                  </div>
                                                )}
                                              </td>

                                              {/* Qty (Field Bebas) */}
                                              <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                                                {isLocked ? (
                                                  <span className="font-bold text-slate-800">{it.qty}</span>
                                                ) : (
                                                  <div className="flex items-center justify-center">
                                                    <input
                                                      type="number"
                                                      min="0"
                                                      value={it.qty === 0 ? '' : it.qty}
                                                      onChange={(e) => {
                                                        const val = e.target.value === '' ? 0 : Math.max(0, parseInt(e.target.value) || 0);
                                                        handleItemQtyChange(po.id, it.sku, it.place, val);
                                                      }}
                                                      placeholder="0"
                                                      className="w-20 px-2 py-1 text-center font-bold text-slate-900 bg-white border border-slate-300 hover:border-indigo-400 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 rounded-lg text-xs outline-hidden shadow-2xs transition"
                                                      title="Ubah Qty bebas langsung di tabel"
                                                    />
                                                  </div>
                                                )}
                                              </td>

                                              <td className="px-3 py-2 text-center text-slate-600 font-medium">{it.unit}</td>

                                              {/* Harga Satuan (Field Bebas) */}
                                              <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                                                {isLocked ? (
                                                  <span className="text-slate-600 font-medium">{formatRupiah(it.price)}</span>
                                                ) : (
                                                  <div className="relative inline-block w-32">
                                                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold pointer-events-none">
                                                      Rp
                                                    </span>
                                                    <input
                                                      type="number"
                                                      min="0"
                                                      step="500"
                                                      value={it.price === 0 ? '' : it.price}
                                                      onChange={(e) => {
                                                        const val = e.target.value === '' ? 0 : Math.max(0, parseInt(e.target.value) || 0);
                                                        handleItemPriceChange(po.id, it.sku, it.place, val);
                                                      }}
                                                      placeholder="0"
                                                      className="w-full pl-8 pr-2 py-1 text-right font-bold text-slate-900 bg-white border border-slate-300 hover:border-indigo-400 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 rounded-lg text-xs outline-hidden shadow-2xs transition"
                                                      title="Ubah Harga Satuan bebas langsung di tabel"
                                                    />
                                                  </div>
                                                )}
                                              </td>

                                              {/* Total (Dihitung Otomatis) */}
                                              <td className="px-3 py-2 text-right font-black text-slate-900">
                                                {formatRupiah(it.qty * it.price)}
                                              </td>

                                              {/* Vendor Assignment Selector */}
                                              <td className="px-3 py-2">
                                                <select
                                                  value={it.vendorName || ''}
                                                  disabled={isRejected || po.status === 'Sent to Receiving'}
                                                  onChange={(e) => handleVendorChangeForItem(it.sku, e.target.value, it.place)}
                                                  className="w-full px-2 py-1 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-indigo-500 outline-hidden"
                                                >
                                                  <option value="">-- Pilih Vendor / Supplier --</option>
                                                  {vendors.map((v) => (
                                                    <option key={v.id} value={v.namaVendor}>
                                                      {v.namaVendor} ({v.paymentCategory || (v.paymentType?.startsWith('TOP') ? 'Tempo' : 'Cash')}: {v.paymentType})
                                                    </option>
                                                  ))}
                                                </select>
                                              </td>

                                              {/* Tipe Pembayaran (Tempo atau Cash) */}
                                              <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                                                <div className="flex flex-col items-center gap-1">
                                                  <div className="inline-flex rounded-lg p-0.5 bg-slate-100 border border-slate-200 shadow-2xs">
                                                    <button
                                                      type="button"
                                                      disabled={isLocked}
                                                      onClick={() => {
                                                        const matchedV = vendors.find((v) => v.namaVendor === it.vendorName);
                                                        const top = matchedV?.topTerm || matchedV?.paymentType || 'TOP 30 Hari';
                                                        updatePOItemPayment(po.id, it.sku, it.place, 'Tempo', top);
                                                      }}
                                                      className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition cursor-pointer ${
                                                        it.paymentMethod === 'Tempo' || (!it.paymentMethod && (!it.vendorName || !it.paymentTerm?.includes('Cash')))
                                                          ? 'bg-indigo-600 text-white shadow-2xs'
                                                          : 'text-slate-600 hover:text-slate-900'
                                                      }`}
                                                      title="Pilih Tipe Pembayaran Tempo"
                                                    >
                                                      Tempo
                                                    </button>
                                                    <button
                                                      type="button"
                                                      disabled={isLocked}
                                                      onClick={() => {
                                                        const matchedV = vendors.find((v) => v.namaVendor === it.vendorName);
                                                        const cash = matchedV?.cashType || 'Cash / COD';
                                                        updatePOItemPayment(po.id, it.sku, it.place, 'Cash', cash);
                                                      }}
                                                      className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition cursor-pointer ${
                                                        it.paymentMethod === 'Cash' || it.paymentTerm?.includes('Cash')
                                                          ? 'bg-emerald-600 text-white shadow-2xs'
                                                          : 'text-slate-600 hover:text-slate-900'
                                                      }`}
                                                      title="Pilih Tipe Pembayaran Cash"
                                                    >
                                                      Cash
                                                    </button>
                                                  </div>
                                                  <span className="text-[10px] font-semibold text-slate-500">
                                                    {it.paymentMethod === 'Cash' || it.paymentTerm?.includes('Cash')
                                                      ? (it.paymentTerm || 'Cash / COD')
                                                      : (it.paymentTerm || 'TOP 30 Hari')}
                                                  </span>
                                                </div>
                                              </td>

                                              {/* Action Buttons: Tolak Barang */}
                                              <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                                                <div className="flex items-center justify-center gap-1">
                                                  {!isRejected ? (
                                                    <button
                                                      type="button"
                                                      onClick={() => setRejectingItem(it)}
                                                      className="inline-flex items-center gap-1 px-2 py-1 text-red-600 hover:text-white bg-red-50 hover:bg-red-600 border border-red-200 rounded-lg text-[11px] font-bold transition cursor-pointer"
                                                      title="Tolak Barang"
                                                    >
                                                      <Ban className="w-3.5 h-3.5" />
                                                      <span>Tolak</span>
                                                    </button>
                                                  ) : (
                                                    <button
                                                      type="button"
                                                      onClick={() => handleVendorChangeForItem(it.sku, it.vendorName || vendors[0]?.namaVendor || '', it.place)}
                                                      className="inline-flex items-center gap-1 px-2 py-1 text-emerald-700 hover:text-white bg-emerald-50 hover:bg-emerald-600 border border-emerald-200 rounded-lg text-[11px] font-bold transition cursor-pointer"
                                                      title="Batalkan Tolak Barang"
                                                    >
                                                      <Check className="w-3.5 h-3.5" />
                                                      <span>Batalkan Tolak</span>
                                                    </button>
                                                  )}
                                                </div>
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
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
            </>
          )}
          </div>
        </div>
      )}

      {/* 2. Subtab: Vendor Summary */}
      {activeSubTab === 'vendor-summary' && (() => {
        const summaryPOs = purchaseOrders
          .filter((po) => {
            const matchStatus =
              po.status === 'Vendor Summary' ||
              po.status === 'Review Cost Control' ||
              po.status === 'Approved by Cost Control' ||
              po.status === 'Sent to Receiving';

            const matchSearch =
              summarySearchQuery === '' ||
              po.id.toLowerCase().includes(summarySearchQuery.toLowerCase()) ||
              po.items.some(
                (it) =>
                  it.itemName.toLowerCase().includes(summarySearchQuery.toLowerCase()) ||
                  it.sku.toLowerCase().includes(summarySearchQuery.toLowerCase()) ||
                  (it.vendorName && it.vendorName.toLowerCase().includes(summarySearchQuery.toLowerCase()))
              );

            const matchDate =
              summaryDateFilter === '' || po.generatedDate === summaryDateFilter;

            return matchStatus && matchSearch && matchDate;
          })
          .sort((a, b) => {
            const timeA = new Date(a.generatedDate).getTime();
            const timeB = new Date(b.generatedDate).getTime();
            return summaryDateSortOrder === 'desc' ? timeB - timeA : timeA - timeB;
          });

        const pendingSubmissionPOs = summaryPOs.filter((po) => po.status === 'Vendor Summary');

        const selectableIds = pendingSubmissionPOs.map((p) => p.id);
        const isAllSelected =
          selectableIds.length > 0 && selectableIds.every((id) => selectedPOsForCostControl.includes(id));

        const todayDateStr = new Date().toISOString().split('T')[0];

        return (
          <div className="space-y-4">
            {/* Filter & Toolbar */}
            <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs space-y-3 text-xs">
              {/* Row 1: Search & Filter Tanggal */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
                {/* Search Input */}
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={summarySearchQuery}
                    onChange={(e) => setSummarySearchQuery(e.target.value)}
                    placeholder="Cari nomor PO, nama vendor, atau item barang..."
                    className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-hidden"
                  />
                  {summarySearchQuery && (
                    <button
                      onClick={() => setSummarySearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Filter Tanggal */}
                <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                  <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-slate-700">
                    <Calendar className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                    <span className="text-[11px] font-bold text-slate-500">Tgl:</span>
                    <input
                      type="date"
                      value={summaryDateFilter}
                      onChange={(e) => setSummaryDateFilter(e.target.value)}
                      className="bg-transparent text-xs font-semibold text-slate-800 outline-hidden cursor-pointer"
                      title="Filter PO berdasarkan tanggal"
                    />
                    {summaryDateFilter && (
                      <button
                        type="button"
                        onClick={() => setSummaryDateFilter('')}
                        className="text-slate-400 hover:text-slate-600 p-0.5"
                        title="Hapus filter tanggal"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Tombol Cepat: Hari Ini */}
                  <button
                    type="button"
                    onClick={() =>
                      setSummaryDateFilter(summaryDateFilter === todayDateStr ? '' : todayDateStr)
                    }
                    className={`px-2.5 py-1.5 rounded-lg font-bold text-xs transition border cursor-pointer ${
                      summaryDateFilter === todayDateStr
                        ? 'bg-purple-600 text-white border-purple-600 shadow-2xs'
                        : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                    title="Filter PO yang dibuat hari ini"
                  >
                    Hari Ini
                  </button>

                  {/* Tombol Urutan Tanggal */}
                  <button
                    type="button"
                    onClick={() =>
                      setSummaryDateSortOrder(summaryDateSortOrder === 'desc' ? 'asc' : 'desc')
                    }
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-lg font-bold text-xs transition cursor-pointer"
                    title={`Urutkan: ${summaryDateSortOrder === 'desc' ? 'Terbaru ke Terlama' : 'Terlama ke Terbaru'}`}
                  >
                    <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
                    <span>{summaryDateSortOrder === 'desc' ? 'Terbaru' : 'Terlama'}</span>
                  </button>
                </div>
              </div>

              {/* Row 2: Tipe Pembayaran, Select All, dan Buka/Tutup Semua Form */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                {/* Payment Filter Pills */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-bold text-slate-500 mr-0.5">Filter Tipe:</span>
                  <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setSummaryPaymentFilter('all')}
                      className={`px-2.5 py-1 rounded-md font-bold text-[11px] transition cursor-pointer ${
                        summaryPaymentFilter === 'all'
                          ? 'bg-white text-purple-700 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Semua Tipe
                    </button>
                    <button
                      type="button"
                      onClick={() => setSummaryPaymentFilter('Tempo')}
                      className={`px-2.5 py-1 rounded-md font-bold text-[11px] transition flex items-center gap-1 cursor-pointer ${
                        summaryPaymentFilter === 'Tempo'
                          ? 'bg-indigo-600 text-white shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <CreditCard className="w-3 h-3" />
                      Tempo
                    </button>
                    <button
                      type="button"
                      onClick={() => setSummaryPaymentFilter('Cash')}
                      className={`px-2.5 py-1 rounded-md font-bold text-[11px] transition flex items-center gap-1 cursor-pointer ${
                        summaryPaymentFilter === 'Cash'
                          ? 'bg-emerald-600 text-white shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <DollarSign className="w-3 h-3" />
                      Cash
                    </button>
                  </div>
                </div>

                {/* Right actions: Select All */}
                <div className="flex flex-wrap items-center gap-2">
                  {selectableIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => handleSelectAllVendorSummaryPOs(selectableIds)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-xs transition cursor-pointer"
                    >
                      {isAllSelected ? (
                        <CheckSquare className="w-4 h-4 text-purple-600" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400" />
                      )}
                      <span>{isAllSelected ? 'Batal Pilih Semua' : `Pilih Semua (${selectableIds.length})`}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* List Form PO di Vendor Summary */}
            {summaryPOs.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400 shadow-xs">
                <Layers className="w-12 h-12 mx-auto text-slate-300 mb-2" />
                <h4 className="font-bold text-slate-700 text-sm">Belum Ada Form di Vendor Summary</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  Selesaikan pengisian nama vendor pada tab <strong>"Kelola &amp; Penugasan Vendor"</strong>, lalu klik tombol <strong>"Submit ke Vendor Summary"</strong> pada form yang bersangkutan.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveSubTab('po-vendor')}
                  className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                >
                  <FileCheck className="w-4 h-4" />
                  Ke Kelola &amp; Penugasan Vendor
                </button>
              </div>
            ) : (
              <div className="space-y-5">
                {summaryPOs.map((po) => {
                  const isChecked = selectedPOsForCostControl.includes(po.id);
                  const isPendingCC = po.status === 'Vendor Summary';
                  const isApprovedCC = po.status === 'Approved by Cost Control';
                  const isReleasedToInbound = po.status === 'Sent to Receiving';
                  const isCollapsed = !expandedSummaryPOIds.includes(po.id);

                  // Group items by Payment Method: Tempo vs Cash
                  const tempoItems = po.items.filter(
                    (it) => it.paymentMethod === 'Tempo' || (!it.paymentMethod && !it.paymentTerm?.includes('Cash'))
                  );
                  const cashItems = po.items.filter(
                    (it) => it.paymentMethod === 'Cash' || it.paymentTerm?.includes('Cash')
                  );

                  // Grouping within Tempo by Vendor
                  const tempoVendorsMap = new Map<string, POItem[]>();
                  tempoItems.forEach((it) => {
                    const vName = it.vendorName || 'Vendor Umum (Tempo)';
                    if (!tempoVendorsMap.has(vName)) tempoVendorsMap.set(vName, []);
                    tempoVendorsMap.get(vName)!.push(it);
                  });

                  // Grouping within Cash by Vendor
                  const cashVendorsMap = new Map<string, POItem[]>();
                  cashItems.forEach((it) => {
                    const vName = it.vendorName || 'Vendor Umum (Cash)';
                    if (!cashVendorsMap.has(vName)) cashVendorsMap.set(vName, []);
                    cashVendorsMap.get(vName)!.push(it);
                  });

                  const tempoTotal = tempoItems.reduce((acc, it) => acc + it.total, 0);
                  const cashTotal = cashItems.reduce((acc, it) => acc + it.total, 0);

                  const showTempo = summaryPaymentFilter === 'all' || summaryPaymentFilter === 'Tempo';
                  const showCash = summaryPaymentFilter === 'all' || summaryPaymentFilter === 'Cash';

                  const rejectedItemsInPO = po.items.filter(
                    (it) => it.approvalStatus === 'Rejected' || it.status === 'Rejected'
                  );
                  const hasRejectedInPO = rejectedItemsInPO.length > 0;
                  const emailedCount = po.emailedVendors?.length || 0;

                  return (
                    <div
                      key={po.id}
                      className={`bg-white rounded-2xl border transition shadow-sm overflow-hidden ${
                        isChecked
                          ? 'border-purple-500 ring-2 ring-purple-100'
                          : hasRejectedInPO
                          ? 'border-red-300 ring-1 ring-red-100'
                          : isApprovedCC
                          ? 'border-emerald-300 ring-1 ring-emerald-50'
                          : isReleasedToInbound
                          ? 'border-blue-300'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {/* Top Form Header with Select Checkbox (Klik form untuk membuka/menutup) */}
                      <div
                        onClick={() => handleToggleCollapseSummaryPO(po.id)}
                        className="p-4 bg-gradient-to-r from-slate-50 via-purple-50/40 to-slate-50 hover:from-purple-50/60 hover:to-purple-50/30 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3 cursor-pointer select-none transition"
                        title={isCollapsed ? 'Klik form untuk membuka rincian isi PO' : 'Klik form untuk menutup rincian isi PO'}
                      >
                        <div className="flex items-start gap-3">
                          {isPendingCC && (
                            <label
                              onClick={(e) => e.stopPropagation()}
                              className="mt-1 flex items-center cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleToggleSelectPOForCostControl(po.id)}
                                className="w-4 h-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500 cursor-pointer"
                              />
                            </label>
                          )}
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono font-extrabold text-xs px-2.5 py-1 rounded-md bg-purple-600 text-white shadow-2xs">
                                {po.id}
                              </span>
                              <span className="text-xs text-slate-600 font-medium">
                                Tgl: <strong>{formatDate(po.generatedDate)}</strong>
                              </span>
                              <span className="text-[11px] text-slate-500 font-medium">
                                • {po.sourceOrderIds.length} Form PR
                              </span>
                              {hasRejectedInPO && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-900 border border-red-300 animate-pulse">
                                  <AlertCircle className="w-3 h-3 text-red-600" />
                                  {rejectedItemsInPO.length} Item Tidak Disetujui Cost Control
                                </span>
                              )}
                              {po.status === 'Vendor Summary' && !hasRejectedInPO && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                  <Clock className="w-3 h-3 text-amber-600" />
                                  Siap Diajukan ke Cost Control
                                </span>
                              )}
                              {po.status === 'Review Cost Control' && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                  <Clock className="w-3 h-3 text-amber-600 animate-pulse" />
                                  Sedang Ditinjau Cost Control
                                </span>
                              )}
                              {isApprovedCC && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  Disetujui Cost Control — Siap Release to Vendor
                                </span>
                              )}
                              {isReleasedToInbound && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-900 border border-blue-300">
                                  <Truck className="w-3 h-3 text-blue-600" />
                                  Released to Vendor (Masuk Inbound)
                                </span>
                              )}
                              {emailedCount > 0 && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
                                  <Mail className="w-3 h-3 text-indigo-600" />
                                  Email Terkirim ({emailedCount})
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 mt-1">
                              {po.notes || 'Pengajuan pengadaan bahan baku/barang outlet.'}
                            </p>
                          </div>
                        </div>

                        {/* Total Amount & Action Buttons (Export PDF, Email Vendor, Release to Vendor) */}
                        <div className="flex flex-wrap items-center gap-2 self-end lg:self-auto">
                          <div className="text-right mr-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                              Total Pengajuan PO
                            </span>
                            <span className="text-base font-black text-purple-900">
                              {formatRupiah(po.totalAmount)}
                            </span>
                            <span className="text-[10px] text-slate-500 block">
                              {po.items.length} item barang
                            </span>
                          </div>

                          {/* Tombol Export to PDF */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleExportPDF(po);
                            }}
                            className="px-3 py-2 bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition shadow-2xs flex items-center gap-1.5 cursor-pointer"
                            title="Export dan unduh dokumen Purchase Order ini dalam format PDF (.pdf)"
                          >
                            <FileText className="w-3.5 h-3.5 text-rose-600" />
                            <span>Export PDF</span>
                          </button>

                          {/* Tombol Email ke Alamat Email Vendor */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEmailModal(po);
                            }}
                            className="px-3 py-2 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition shadow-2xs flex items-center gap-1.5 cursor-pointer"
                            title="Kirim Purchase Order ini ke alamat email vendor beserta lampiran PDF"
                          >
                            <Mail className="w-3.5 h-3.5 text-indigo-600" />
                            <span>Email Vendor</span>
                          </button>

                          {isPendingCC && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleBatchSubmitToCostControl([po.id]);
                              }}
                              className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer"
                              title="Ajukan form PO ini ke Cost Control"
                            >
                              <Calculator className="w-3.5 h-3.5" />
                              <span>Ajukan ke Cost Control</span>
                            </button>
                          )}

                          {isApprovedCC && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenReleaseModal([po.id]);
                              }}
                              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold transition shadow-sm flex items-center gap-1.5 cursor-pointer"
                              title="Release form PO ke Vendor & otomatis masukkan ke Inbound sebagai penerimaan barang masuk"
                            >
                              <Truck className="w-3.5 h-3.5" />
                              <span>Release to Vendor</span>
                            </button>
                          )}

                          {isReleasedToInbound && (
                            <span
                              className="px-3 py-2 bg-blue-50 text-blue-800 border border-blue-200 rounded-xl text-xs font-bold flex items-center gap-1.5"
                              title="Form ini sudah di-release ke vendor dan masuk ke Inbound sebagai penerimaan barang masuk"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                              <span>Masuk Inbound</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Mini Preview saat form tertutup (Klik untuk membuka form) */}
                      {isCollapsed && (
                        <div
                          onClick={() => handleToggleCollapseSummaryPO(po.id)}
                          className="px-4 py-2.5 bg-purple-50/40 hover:bg-purple-50/80 border-t border-purple-100 flex flex-wrap items-center justify-between text-xs text-slate-600 gap-2 cursor-pointer select-none transition animate-in fade-in duration-150"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            {tempoItems.length > 0 && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                                <CreditCard className="w-3 h-3" />
                                Tempo: {tempoVendorsMap.size} Vendor ({tempoItems.length} item) • {formatRupiah(tempoTotal)}
                              </span>
                            )}
                            {cashItems.length > 0 && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                <DollarSign className="w-3 h-3" />
                                Cash: {cashVendorsMap.size} Vendor ({cashItems.length} item) • {formatRupiah(cashTotal)}
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Card Content: Pemisahan Berdasarkan Tipe Pembayaran (Tempo & Cash) > Vendor > List Barang */}
                      {!isCollapsed && (
                        <div className="p-4 space-y-6 animate-in fade-in duration-150">
                          {/* Banner Release to Vendor / Inbound Status inside PO Card */}
                          {isApprovedCC && (
                            <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs text-emerald-950">
                              <div className="flex items-start gap-2.5">
                                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                                <div>
                                  <span className="font-extrabold text-emerald-900 block">
                                    Disetujui Cost Control ({po.costControlApproval?.approvedBy || 'Cost Control PIC'}) — Siap Release to Vendor
                                  </span>
                                  <span className="text-emerald-800">
                                    Semua item pada form ini telah disetujui. Klik <strong>"Release to Vendor"</strong> untuk meneruskan pesanan ke mitra vendor dan otomatis membuat dokumen penerimaan barang masuk di <strong>Inbound &gt; Receiving</strong>. Anda juga dapat mengunduh <strong>PDF</strong> atau mengirim <strong>Email ke Vendor</strong> per mitra di bawah.
                                  </span>
                                </div>
                              </div>
                              <div className="flex flex-wrap items-center gap-2 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleExportPDF(po)}
                                  className="px-3 py-1.5 bg-white hover:bg-rose-50 text-rose-700 border border-rose-300 rounded-lg font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                                >
                                  <Download className="w-3.5 h-3.5 text-rose-600" />
                                  <span>Download PDF PO</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenEmailModal(po)}
                                  className="px-3 py-1.5 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-300 rounded-lg font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                                >
                                  <Mail className="w-3.5 h-3.5 text-indigo-600" />
                                  <span>Email ke Vendor</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenReleaseModal([po.id])}
                                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-extrabold text-xs shadow-xs flex items-center gap-1.5 cursor-pointer"
                                >
                                  <Truck className="w-3.5 h-3.5" />
                                  <span>Release to Vendor (Masuk Inbound)</span>
                                </button>
                              </div>
                            </div>
                          )}

                          {isReleasedToInbound && (
                            <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs text-blue-950">
                              <div className="flex items-start gap-2.5">
                                <Truck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                                <div>
                                  <span className="font-extrabold text-blue-900 block">
                                    Telah Dilakukan Release to Vendor &amp; Masuk ke Inbound (Penerimaan Barang Masuk)
                                  </span>
                                  <span className="text-blue-800">
                                    Form ini telah di-release oleh <strong>{po.releasedToVendorBy || 'Purchasing'}</strong> dan otomatis masuk ke menu <strong>Inbound &gt; Penerimaan Barang Masuk (Receiving)</strong> dengan status <em>"Menunggu Kedatangan"</em>.
                                  </span>
                                </div>
                              </div>
                              <div className="flex flex-wrap items-center gap-2 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleExportPDF(po)}
                                  className="px-3 py-1.5 bg-white hover:bg-rose-50 text-rose-700 border border-rose-300 rounded-lg font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                                >
                                  <Download className="w-3.5 h-3.5 text-rose-600" />
                                  <span>Export to PDF</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenEmailModal(po)}
                                  className="px-3 py-1.5 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-300 rounded-lg font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                                >
                                  <Mail className="w-3.5 h-3.5 text-indigo-600" />
                                  <span>Email ke Vendor</span>
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Alert Banner if any items were rejected */}
                          {hasRejectedInPO && (
                            <div className="p-3.5 bg-red-50 border-2 border-red-300 rounded-xl flex items-start gap-3 text-xs text-red-950 animate-in fade-in duration-150">
                              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                              <div className="space-y-1">
                                <div className="font-extrabold text-sm text-red-900 flex items-center gap-2">
                                  <span>Perhatian: Terdapat {rejectedItemsInPO.length} Item Tidak Disetujui Cost Control</span>
                                </div>
                                <p className="text-red-800 leading-relaxed">
                                  Cost Control menolak beberapa item pada formulir ini. Silakan gunakan tombol <strong>"Ubah"</strong> pada baris barang untuk merevisi <strong>Qty</strong>, <strong>Harga</strong>, atau <strong>Select Vendor</strong> lain.
                                </p>
                                <p className="text-[11px] text-red-700 font-semibold">
                                  Setelah item selesai diperbarui, status penolakan akan dibersihkan secara otomatis dan siap diajukan kembali ke Cost Control.
                                </p>
                              </div>
                            </div>
                          )}

                          {/* 1. PEMBAYARAN TEMPO */}
                          {showTempo && tempoItems.length > 0 && (
                            <div className="space-y-3 border-2 border-indigo-200/80 rounded-xl p-3.5 bg-indigo-50/20">
                              {/* Section Header Tempo */}
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-indigo-200">
                                <div className="flex items-center gap-2">
                                  <div className="p-1.5 rounded-lg bg-indigo-600 text-white shadow-2xs">
                                    <CreditCard className="w-4 h-4" />
                                  </div>
                                  <div>
                                    <h4 className="text-xs font-extrabold text-indigo-950 uppercase tracking-wide">
                                      Tipe Pembayaran: TEMPO (Term of Payment)
                                    </h4>
                                    <span className="text-[11px] text-indigo-700 font-medium">
                                      {tempoVendorsMap.size} Vendor Mitra • {tempoItems.length} Item Barang
                                    </span>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Subtotal Tempo</span>
                                  <span className="text-sm font-black text-indigo-800">{formatRupiah(tempoTotal)}</span>
                                </div>
                              </div>

                              {/* Grouping by Vendor inside Tempo */}
                              <div className="space-y-3 pt-1">
                                {Array.from(tempoVendorsMap.entries()).map(([vendorName, vItems]) => {
                                  const matchedVendor = vendors.find((v) => v.namaVendor === vendorName);
                                  const topLabel =
                                    vItems[0]?.paymentTerm || matchedVendor?.topTerm || matchedVendor?.paymentType || 'TOP 30 Hari';
                                  const vendorSubtotal = vItems.reduce((acc, it) => acc + it.total, 0);
                                  const isVendorEmailed = po.emailedVendors?.some(
                                    (e) => e.vendorName === vendorName
                                  );

                                  return (
                                    <div
                                      key={vendorName}
                                      className="bg-white rounded-xl border border-indigo-100 shadow-2xs overflow-hidden"
                                    >
                                      {/* Vendor Header */}
                                      <div className="px-3.5 py-2.5 bg-indigo-50/60 border-b border-indigo-100 flex flex-col md:flex-row md:items-center justify-between gap-2">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <Building2 className="w-4 h-4 text-indigo-600 shrink-0" />
                                          <span className="font-bold text-xs text-slate-900">{vendorName}</span>
                                          <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-indigo-100 text-indigo-800 border border-indigo-200">
                                            {topLabel}
                                          </span>
                                          {matchedVendor?.email && (
                                            <span className="inline-flex items-center gap-1 text-[11px] text-slate-600 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                                              <Mail className="w-3 h-3 text-indigo-500" />
                                              <span>{matchedVendor.email}</span>
                                            </span>
                                          )}
                                          {isVendorEmailed && (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                              <Check className="w-2.5 h-2.5 text-emerald-600" />
                                              <span>Email PO Terkirim</span>
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2 self-end md:self-auto">
                                          <button
                                            type="button"
                                            onClick={() => handleExportPDF(po, vendorName)}
                                            className="px-2.5 py-1 bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 rounded-lg text-[11px] font-bold transition flex items-center gap-1 shadow-2xs cursor-pointer"
                                            title={`Export PDF khusus untuk ${vendorName}`}
                                          >
                                            <FileText className="w-3 h-3 text-rose-600" />
                                            <span>PDF Vendor</span>
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleOpenEmailModal(po, vendorName)}
                                            className="px-2.5 py-1 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-[11px] font-bold transition flex items-center gap-1 shadow-2xs cursor-pointer"
                                            title={`Kirim Email PO ke ${matchedVendor?.email || vendorName}`}
                                          >
                                            <Mail className="w-3 h-3 text-indigo-600" />
                                            <span>Email ke Vendor</span>
                                          </button>
                                          <div className="text-right text-xs pl-1">
                                            <span className="text-slate-500 font-medium mr-1.5">{vItems.length} barang:</span>
                                            <span className="font-extrabold text-indigo-900">{formatRupiah(vendorSubtotal)}</span>
                                          </div>
                                        </div>
                                      </div>

                                      {/* List Barang Table */}
                                      <div className="overflow-x-auto">
                                        <table className="w-full text-left text-xs">
                                          <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-100">
                                            <tr>
                                              <th className="px-3 py-2 text-center">No</th>
                                              <th className="px-3 py-2">SKU</th>
                                              <th className="px-3 py-2">Nama Barang</th>
                                              <th className="px-3 py-2">Kategori</th>
                                              <th className="px-3 py-2 text-center">Qty</th>
                                              <th className="px-3 py-2 text-center">Satuan</th>
                                              <th className="px-3 py-2 text-right">Harga Satuan</th>
                                              <th className="px-3 py-2 text-right">Subtotal</th>
                                              <th className="px-3 py-2">Vendor / Pilihan Vendor</th>
                                              <th className="px-3 py-2 text-center">Status Item</th>
                                              <th className="px-3 py-2 text-center">Aksi</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-slate-100">
                                            {vItems.map((it, idx) => {
                                              const itemKey = `${po.id}__${it.sku}__${it.place || ''}`;
                                              const isEditing = inlineSummaryEditKey === itemKey;
                                              const isRejected = it.approvalStatus === 'Rejected' || it.status === 'Rejected';
                                              const isApproved = it.approvalStatus === 'Approved';

                                              return (
                                                <tr
                                                  key={`${it.sku}-${idx}`}
                                                  className={`transition ${
                                                    isEditing
                                                      ? 'bg-purple-50/80 ring-1 ring-purple-300'
                                                      : isRejected
                                                      ? 'bg-red-50/50 hover:bg-red-50/80'
                                                      : 'hover:bg-slate-50/60'
                                                  }`}
                                                >
                                                  <td className="px-3 py-2 text-slate-400 font-mono text-center">{idx + 1}</td>
                                                  <td className="px-3 py-2 font-mono font-bold text-slate-800">{it.sku}</td>
                                                  <td className="px-3 py-2">
                                                    <div className="font-semibold text-slate-900">{it.itemName}</div>
                                                    {it.place && (
                                                      <div className="text-[10px] text-slate-500 font-medium">{it.place}</div>
                                                    )}
                                                  </td>
                                                  <td className="px-3 py-2 text-slate-600">{it.category}</td>

                                                  {/* Qty Column (Editable) */}
                                                  <td className="px-3 py-2 text-center">
                                                    {isEditing ? (
                                                      <input
                                                        type="number"
                                                        min={1}
                                                        value={inlineSummaryValues.qty}
                                                        onChange={(e) =>
                                                          setInlineSummaryValues((prev) => ({
                                                            ...prev,
                                                            qty: Math.max(1, parseInt(e.target.value) || 1),
                                                          }))
                                                        }
                                                        className="w-16 px-1.5 py-1 text-center font-extrabold text-xs bg-white border-2 border-purple-500 rounded-md shadow-2xs focus:ring-2 focus:ring-purple-400 outline-hidden"
                                                      />
                                                    ) : (
                                                      <span className="font-bold text-slate-800">{it.qty}</span>
                                                    )}
                                                  </td>

                                                  {/* Satuan */}
                                                  <td className="px-3 py-2 text-center text-slate-600 font-medium">{it.unit}</td>

                                                  {/* Harga Satuan Column (Editable) */}
                                                  <td className="px-3 py-2 text-right">
                                                    {isEditing ? (
                                                      <div className="flex items-center justify-end">
                                                        <div className="relative">
                                                          <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">
                                                            Rp
                                                          </span>
                                                          <input
                                                            type="number"
                                                            min={0}
                                                            step={500}
                                                            value={inlineSummaryValues.price}
                                                            onChange={(e) =>
                                                              setInlineSummaryValues((prev) => ({
                                                                ...prev,
                                                                price: Math.max(0, parseInt(e.target.value) || 0),
                                                              }))
                                                            }
                                                            className="w-24 pl-6 pr-1.5 py-1 text-right font-extrabold text-xs bg-white border-2 border-purple-500 rounded-md shadow-2xs focus:ring-2 focus:ring-purple-400 outline-hidden"
                                                          />
                                                        </div>
                                                      </div>
                                                    ) : (
                                                      <span className="font-medium text-slate-700">{formatRupiah(it.price)}</span>
                                                    )}
                                                  </td>

                                                  {/* Subtotal */}
                                                  <td className="px-3 py-2 text-right">
                                                    {isEditing ? (
                                                      <span className="font-black text-purple-900">
                                                        {formatRupiah(inlineSummaryValues.qty * inlineSummaryValues.price)}
                                                      </span>
                                                    ) : (
                                                      <span className="font-black text-indigo-900">{formatRupiah(it.total)}</span>
                                                    )}
                                                  </td>

                                                  {/* Vendor & Termin / Select Vendor to change */}
                                                  <td className="px-3 py-2">
                                                    {isEditing ? (
                                                      <div className="space-y-1 min-w-[170px]">
                                                        <select
                                                          value={inlineSummaryValues.vendorName}
                                                          onChange={(e) =>
                                                            setInlineSummaryValues((prev) => ({
                                                              ...prev,
                                                              vendorName: e.target.value,
                                                            }))
                                                          }
                                                          className="w-full px-2 py-1 bg-white border-2 border-purple-500 rounded-md text-xs font-bold text-slate-800 shadow-2xs focus:ring-2 focus:ring-purple-400 outline-hidden"
                                                        >
                                                          {vendors.map((v) => {
                                                            const cat =
                                                              v.paymentCategory ||
                                                              (v.paymentType?.startsWith('TOP') ? 'Tempo' : 'Cash');
                                                            const term =
                                                              cat === 'Tempo'
                                                                ? v.topTerm || v.paymentType
                                                                : v.cashType || v.paymentType;
                                                            return (
                                                              <option key={v.id} value={v.namaVendor}>
                                                                {v.namaVendor} ({cat} - {term})
                                                              </option>
                                                            );
                                                          })}
                                                        </select>
                                                        {(() => {
                                                          const selectedV = vendors.find(
                                                            (v) => v.namaVendor === inlineSummaryValues.vendorName
                                                          );
                                                          if (!selectedV) return null;
                                                          const isVTempo =
                                                            selectedV.paymentCategory === 'Tempo' ||
                                                            (!selectedV.paymentCategory &&
                                                              selectedV.paymentType?.startsWith('TOP'));
                                                          return (
                                                            <span
                                                              className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                                                                isVTempo
                                                                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                                                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                              }`}
                                                            >
                                                              {isVTempo ? (
                                                                <CreditCard className="w-2.5 h-2.5" />
                                                              ) : (
                                                                <DollarSign className="w-2.5 h-2.5" />
                                                              )}
                                                              <span>
                                                                {isVTempo
                                                                  ? `Tempo: ${selectedV.topTerm || 'TOP 30'}`
                                                                  : `Cash: ${selectedV.cashType || 'Cash'}`}
                                                              </span>
                                                            </span>
                                                          );
                                                        })()}
                                                      </div>
                                                    ) : (
                                                      <div className="space-y-0.5">
                                                        <span className="font-bold text-slate-800 text-[11px] block">
                                                          {it.vendorName || vendorName}
                                                        </span>
                                                        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                                          {it.paymentTerm || topLabel}
                                                        </span>
                                                      </div>
                                                    )}
                                                  </td>

                                                  {/* Status Item Column */}
                                                  <td className="px-3 py-2 text-center">
                                                    {isEditing ? (
                                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-300">
                                                        <Edit3 className="w-3 h-3 text-purple-600" />
                                                        <span>Mode Ubah</span>
                                                      </span>
                                                    ) : isRejected ? (
                                                      <div className="flex flex-col items-center gap-0.5">
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-red-100 text-red-900 border border-red-300 shadow-2xs">
                                                          <XCircle className="w-3 h-3 text-red-600 shrink-0" />
                                                          <span>Tidak Disetujui</span>
                                                        </span>
                                                        {it.rejectionReason && (
                                                          <span
                                                            className="text-[10px] text-red-600 italic max-w-[130px] leading-tight block text-center"
                                                            title={it.rejectionReason}
                                                          >
                                                            "{it.rejectionReason}"
                                                          </span>
                                                        )}
                                                      </div>
                                                    ) : isApproved ? (
                                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                                        <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                                                        <span>Disetujui CC</span>
                                                      </span>
                                                    ) : (
                                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                                                        <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                                                        <span>Menunggu Review</span>
                                                      </span>
                                                    )}
                                                  </td>

                                                  {/* Aksi Column */}
                                                  <td className="px-3 py-2 text-center">
                                                    {isEditing ? (
                                                      <div className="flex items-center justify-center gap-1">
                                                        <button
                                                          type="button"
                                                          onClick={() => handleSaveInlineEdit(po.id, it)}
                                                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-bold transition flex items-center gap-1 shadow-2xs cursor-pointer"
                                                          title="Simpan Perubahan Qty, Harga, & Vendor"
                                                        >
                                                          <Check className="w-3.5 h-3.5" />
                                                          <span>Simpan</span>
                                                        </button>
                                                        <button
                                                          type="button"
                                                          onClick={handleCancelInlineEdit}
                                                          className="p-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-md text-xs font-semibold transition cursor-pointer"
                                                          title="Batal"
                                                        >
                                                          <X className="w-3.5 h-3.5" />
                                                        </button>
                                                      </div>
                                                    ) : (
                                                      <div className="flex items-center justify-center gap-1">
                                                        <button
                                                          type="button"
                                                          onClick={() => handleStartInlineEdit(po.id, it)}
                                                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition shadow-2xs cursor-pointer ${
                                                            isRejected
                                                              ? 'bg-rose-600 hover:bg-rose-700 text-white animate-pulse'
                                                              : 'bg-white hover:bg-purple-50 text-purple-700 border border-purple-300'
                                                          }`}
                                                          title="Ubah Qty, Harga, atau pindahkan ke vendor lain"
                                                        >
                                                          <Edit3 className="w-3 h-3" />
                                                          <span>{isRejected ? 'Ubah Item' : 'Ubah'}</span>
                                                        </button>
                                                        <button
                                                          type="button"
                                                          onClick={() => handleOpenEditModal(po.id, it)}
                                                          className="p-1 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-md transition"
                                                          title="Buka form edit lengkap"
                                                        >
                                                          <Eye className="w-3.5 h-3.5" />
                                                        </button>
                                                      </div>
                                                    )}
                                                  </td>
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

                        {/* 2. PEMBAYARAN CASH */}
                        {showCash && cashItems.length > 0 && (
                          <div className="space-y-3 border-2 border-emerald-200/80 rounded-xl p-3.5 bg-emerald-50/20">
                            {/* Section Header Cash */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-emerald-200">
                              <div className="flex items-center gap-2">
                                <div className="p-1.5 rounded-lg bg-emerald-600 text-white shadow-2xs">
                                  <DollarSign className="w-4 h-4" />
                                </div>
                                <div>
                                  <h4 className="text-xs font-extrabold text-emerald-950 uppercase tracking-wide">
                                    Tipe Pembayaran: CASH (Tunai / COD / Transfer)
                                  </h4>
                                  <span className="text-[11px] text-emerald-700 font-medium">
                                    {cashVendorsMap.size} Vendor Mitra • {cashItems.length} Item Barang
                                  </span>
                                </div>
                              </div>
                              <div className="text-right">
                                <span className="text-[10px] font-bold text-slate-400 block uppercase">Subtotal Cash</span>
                                <span className="text-sm font-black text-emerald-800">{formatRupiah(cashTotal)}</span>
                              </div>
                            </div>

                            {/* Grouping by Vendor inside Cash */}
                            <div className="space-y-3 pt-1">
                              {Array.from(cashVendorsMap.entries()).map(([vendorName, vItems]) => {
                                const matchedVendor = vendors.find((v) => v.namaVendor === vendorName);
                                const cashLabel = vItems[0]?.paymentTerm || matchedVendor?.cashType || matchedVendor?.paymentType || 'Cash / COD';
                                const vendorSubtotal = vItems.reduce((acc, it) => acc + it.total, 0);
                                const isVendorEmailed = po.emailedVendors?.some(
                                  (e) => e.vendorName === vendorName
                                );

                                return (
                                  <div
                                    key={vendorName}
                                    className="bg-white rounded-xl border border-emerald-100 shadow-2xs overflow-hidden"
                                  >
                                    {/* Vendor Header */}
                                    <div className="px-3.5 py-2.5 bg-emerald-50/60 border-b border-emerald-100 flex flex-col md:flex-row md:items-center justify-between gap-2">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <Building2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                        <span className="font-bold text-xs text-slate-900">{vendorName}</span>
                                        <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                          {cashLabel}
                                        </span>
                                        {matchedVendor?.email && (
                                          <span className="inline-flex items-center gap-1 text-[11px] text-slate-600 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                                            <Mail className="w-3 h-3 text-emerald-600" />
                                            <span>{matchedVendor.email}</span>
                                          </span>
                                        )}
                                        {isVendorEmailed && (
                                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                            <Check className="w-2.5 h-2.5 text-emerald-600" />
                                            <span>Email PO Terkirim</span>
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex flex-wrap items-center gap-2 self-end md:self-auto">
                                        <button
                                          type="button"
                                          onClick={() => handleExportPDF(po, vendorName)}
                                          className="px-2.5 py-1 bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 rounded-lg text-[11px] font-bold transition flex items-center gap-1 shadow-2xs cursor-pointer"
                                          title={`Export PDF khusus untuk ${vendorName}`}
                                        >
                                          <FileText className="w-3 h-3 text-rose-600" />
                                          <span>PDF Vendor</span>
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleOpenEmailModal(po, vendorName)}
                                          className="px-2.5 py-1 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-[11px] font-bold transition flex items-center gap-1 shadow-2xs cursor-pointer"
                                          title={`Kirim Email PO ke ${matchedVendor?.email || vendorName}`}
                                        >
                                          <Mail className="w-3 h-3 text-indigo-600" />
                                          <span>Email ke Vendor</span>
                                        </button>
                                        <div className="text-right text-xs pl-1">
                                          <span className="text-slate-500 font-medium mr-1.5">{vItems.length} barang:</span>
                                          <span className="font-extrabold text-emerald-900">{formatRupiah(vendorSubtotal)}</span>
                                        </div>
                                      </div>
                                    </div>

                                    {/* List Barang Table */}
                                    <div className="overflow-x-auto">
                                      <table className="w-full text-left text-xs">
                                        <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-100">
                                          <tr>
                                            <th className="px-3 py-2 text-center">No</th>
                                            <th className="px-3 py-2">SKU</th>
                                            <th className="px-3 py-2">Nama Barang</th>
                                            <th className="px-3 py-2">Kategori</th>
                                            <th className="px-3 py-2 text-center">Qty</th>
                                            <th className="px-3 py-2 text-center">Satuan</th>
                                            <th className="px-3 py-2 text-right">Harga Satuan</th>
                                            <th className="px-3 py-2 text-right">Subtotal</th>
                                            <th className="px-3 py-2">Vendor / Pilihan Vendor</th>
                                            <th className="px-3 py-2 text-center">Status Item</th>
                                            <th className="px-3 py-2 text-center">Aksi</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                          {vItems.map((it, idx) => {
                                            const itemKey = `${po.id}__${it.sku}__${it.place || ''}`;
                                            const isEditing = inlineSummaryEditKey === itemKey;
                                            const isRejected = it.approvalStatus === 'Rejected' || it.status === 'Rejected';
                                            const isApproved = it.approvalStatus === 'Approved';

                                            return (
                                              <tr
                                                key={`${it.sku}-${idx}`}
                                                className={`transition ${
                                                  isEditing
                                                    ? 'bg-emerald-50/80 ring-1 ring-emerald-300'
                                                    : isRejected
                                                    ? 'bg-red-50/50 hover:bg-red-50/80'
                                                    : 'hover:bg-slate-50/60'
                                                }`}
                                              >
                                                <td className="px-3 py-2 text-slate-400 font-mono text-center">{idx + 1}</td>
                                                <td className="px-3 py-2 font-mono font-bold text-slate-800">{it.sku}</td>
                                                <td className="px-3 py-2">
                                                  <div className="font-semibold text-slate-900">{it.itemName}</div>
                                                  {it.place && (
                                                    <div className="text-[10px] text-slate-500 font-medium">{it.place}</div>
                                                  )}
                                                </td>
                                                <td className="px-3 py-2 text-slate-600">{it.category}</td>

                                                {/* Qty Column (Editable) */}
                                                <td className="px-3 py-2 text-center">
                                                  {isEditing ? (
                                                    <input
                                                      type="number"
                                                      min={1}
                                                      value={inlineSummaryValues.qty}
                                                      onChange={(e) =>
                                                        setInlineSummaryValues((prev) => ({
                                                          ...prev,
                                                          qty: Math.max(1, parseInt(e.target.value) || 1),
                                                        }))
                                                      }
                                                      className="w-16 px-1.5 py-1 text-center font-extrabold text-xs bg-white border-2 border-emerald-500 rounded-md shadow-2xs focus:ring-2 focus:ring-emerald-400 outline-hidden"
                                                    />
                                                  ) : (
                                                    <span className="font-bold text-slate-800">{it.qty}</span>
                                                  )}
                                                </td>

                                                {/* Satuan */}
                                                <td className="px-3 py-2 text-center text-slate-600 font-medium">{it.unit}</td>

                                                {/* Harga Satuan Column (Editable) */}
                                                <td className="px-3 py-2 text-right">
                                                  {isEditing ? (
                                                    <div className="flex items-center justify-end">
                                                      <div className="relative">
                                                        <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">
                                                          Rp
                                                        </span>
                                                        <input
                                                          type="number"
                                                          min={0}
                                                          step={500}
                                                          value={inlineSummaryValues.price}
                                                          onChange={(e) =>
                                                            setInlineSummaryValues((prev) => ({
                                                              ...prev,
                                                              price: Math.max(0, parseInt(e.target.value) || 0),
                                                            }))
                                                          }
                                                          className="w-24 pl-6 pr-1.5 py-1 text-right font-extrabold text-xs bg-white border-2 border-emerald-500 rounded-md shadow-2xs focus:ring-2 focus:ring-emerald-400 outline-hidden"
                                                        />
                                                      </div>
                                                    </div>
                                                  ) : (
                                                    <span className="font-medium text-slate-700">{formatRupiah(it.price)}</span>
                                                  )}
                                                </td>

                                                {/* Subtotal */}
                                                <td className="px-3 py-2 text-right">
                                                  {isEditing ? (
                                                    <span className="font-black text-emerald-900">
                                                      {formatRupiah(inlineSummaryValues.qty * inlineSummaryValues.price)}
                                                    </span>
                                                  ) : (
                                                    <span className="font-black text-emerald-900">{formatRupiah(it.total)}</span>
                                                  )}
                                                </td>

                                                {/* Vendor & Termin / Select Vendor to change */}
                                                <td className="px-3 py-2">
                                                  {isEditing ? (
                                                    <div className="space-y-1 min-w-[170px]">
                                                      <select
                                                        value={inlineSummaryValues.vendorName}
                                                        onChange={(e) =>
                                                          setInlineSummaryValues((prev) => ({
                                                            ...prev,
                                                            vendorName: e.target.value,
                                                          }))
                                                        }
                                                        className="w-full px-2 py-1 bg-white border-2 border-emerald-500 rounded-md text-xs font-bold text-slate-800 shadow-2xs focus:ring-2 focus:ring-emerald-400 outline-hidden"
                                                      >
                                                        {vendors.map((v) => {
                                                          const cat =
                                                            v.paymentCategory ||
                                                            (v.paymentType?.startsWith('TOP') ? 'Tempo' : 'Cash');
                                                          const term =
                                                            cat === 'Tempo'
                                                              ? v.topTerm || v.paymentType
                                                              : v.cashType || v.paymentType;
                                                          return (
                                                            <option key={v.id} value={v.namaVendor}>
                                                              {v.namaVendor} ({cat} - {term})
                                                            </option>
                                                          );
                                                        })}
                                                      </select>
                                                      {(() => {
                                                        const selectedV = vendors.find(
                                                          (v) => v.namaVendor === inlineSummaryValues.vendorName
                                                        );
                                                        if (!selectedV) return null;
                                                        const isVTempo =
                                                          selectedV.paymentCategory === 'Tempo' ||
                                                          (!selectedV.paymentCategory &&
                                                            selectedV.paymentType?.startsWith('TOP'));
                                                        return (
                                                          <span
                                                            className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                                                              isVTempo
                                                                ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                                                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                            }`}
                                                          >
                                                            {isVTempo ? (
                                                              <CreditCard className="w-2.5 h-2.5" />
                                                            ) : (
                                                              <DollarSign className="w-2.5 h-2.5" />
                                                            )}
                                                            <span>
                                                              {isVTempo
                                                                ? `Tempo: ${selectedV.topTerm || 'TOP 30'}`
                                                                : `Cash: ${selectedV.cashType || 'Cash'}`}
                                                            </span>
                                                          </span>
                                                        );
                                                      })()}
                                                    </div>
                                                  ) : (
                                                    <div className="space-y-0.5">
                                                      <span className="font-bold text-slate-800 text-[11px] block">
                                                        {it.vendorName || vendorName}
                                                      </span>
                                                      <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                        {it.paymentTerm || cashLabel}
                                                      </span>
                                                    </div>
                                                  )}
                                                </td>

                                                {/* Status Item Column */}
                                                <td className="px-3 py-2 text-center">
                                                  {isEditing ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                                      <Edit3 className="w-3 h-3 text-emerald-600" />
                                                      <span>Mode Ubah</span>
                                                    </span>
                                                  ) : isRejected ? (
                                                    <div className="flex flex-col items-center gap-0.5">
                                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-red-100 text-red-900 border border-red-300 shadow-2xs">
                                                        <XCircle className="w-3 h-3 text-red-600 shrink-0" />
                                                        <span>Tidak Disetujui</span>
                                                      </span>
                                                      {it.rejectionReason && (
                                                        <span
                                                          className="text-[10px] text-red-600 italic max-w-[130px] leading-tight block text-center"
                                                          title={it.rejectionReason}
                                                        >
                                                          "{it.rejectionReason}"
                                                        </span>
                                                      )}
                                                    </div>
                                                  ) : isApproved ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                                      <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                                                      <span>Disetujui CC</span>
                                                    </span>
                                                  ) : (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                                                      <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                                                      <span>Menunggu Review</span>
                                                    </span>
                                                  )}
                                                </td>

                                                {/* Aksi Column */}
                                                <td className="px-3 py-2 text-center">
                                                  {isEditing ? (
                                                    <div className="flex items-center justify-center gap-1">
                                                      <button
                                                        type="button"
                                                        onClick={() => handleSaveInlineEdit(po.id, it)}
                                                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-bold transition flex items-center gap-1 shadow-2xs cursor-pointer"
                                                        title="Simpan Perubahan Qty, Harga, & Vendor"
                                                      >
                                                        <Check className="w-3.5 h-3.5" />
                                                        <span>Simpan</span>
                                                      </button>
                                                      <button
                                                        type="button"
                                                        onClick={handleCancelInlineEdit}
                                                        className="p-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-md text-xs font-semibold transition cursor-pointer"
                                                        title="Batal"
                                                      >
                                                        <X className="w-3.5 h-3.5" />
                                                      </button>
                                                    </div>
                                                  ) : (
                                                    <div className="flex items-center justify-center gap-1">
                                                      <button
                                                        type="button"
                                                        onClick={() => handleStartInlineEdit(po.id, it)}
                                                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition shadow-2xs cursor-pointer ${
                                                          isRejected
                                                            ? 'bg-rose-600 hover:bg-rose-700 text-white animate-pulse'
                                                            : 'bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-300'
                                                        }`}
                                                        title="Ubah Qty, Harga, atau pindahkan ke vendor lain"
                                                      >
                                                        <Edit3 className="w-3 h-3" />
                                                        <span>{isRejected ? 'Ubah Item' : 'Ubah'}</span>
                                                      </button>
                                                      <button
                                                        type="button"
                                                        onClick={() => handleOpenEditModal(po.id, it)}
                                                        className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-md transition"
                                                        title="Buka form edit lengkap"
                                                      >
                                                        <Eye className="w-3.5 h-3.5" />
                                                      </button>
                                                    </div>
                                                  )}
                                                </td>
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
                      </div>
                    )}
                  </div>
                );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* 3. Subtab: List Vendor */}
      {activeSubTab === 'list-vendor' && (() => {
        const displayedVendors = vendors.filter((v) => {
          const isTempo = v.paymentCategory === 'Tempo' || (!v.paymentCategory && v.paymentType?.startsWith('TOP'));
          if (vendorCategoryFilter === 'Tempo') return isTempo;
          if (vendorCategoryFilter === 'Cash') return !isTempo;
          return true;
        });

        const tempoCount = vendors.filter((v) => v.paymentCategory === 'Tempo' || (!v.paymentCategory && v.paymentType?.startsWith('TOP'))).length;
        const cashCount = vendors.filter((v) => v.paymentCategory === 'Cash' || (!v.paymentCategory && !v.paymentType?.startsWith('TOP'))).length;

        return (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-indigo-600" />
                Direktori Data Mitra Vendor &amp; Supplier
              </h2>
              <p className="text-xs text-slate-500">
                Pemisahan profil rekanan berdasarkan kategori Tempo (dengan TOP) dan Cash (Tunai/COD).
              </p>
            </div>

            <button
              onClick={handleOpenAddVendor}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-xs self-start sm:self-auto cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Tambah Vendor Baru
            </button>
          </div>

          {/* Filter Pills Tempo vs Cash untuk List Vendor */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Filter Mitra:</span>
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
              <button
                type="button"
                onClick={() => setVendorCategoryFilter('all')}
                className={`px-3 py-1.5 rounded-md font-bold text-xs transition cursor-pointer ${
                  vendorCategoryFilter === 'all'
                    ? 'bg-white text-indigo-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Semua Vendor ({vendors.length})
              </button>
              <button
                type="button"
                onClick={() => setVendorCategoryFilter('Tempo')}
                className={`px-3 py-1.5 rounded-md font-bold text-xs transition flex items-center gap-1.5 cursor-pointer ${
                  vendorCategoryFilter === 'Tempo'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Vendor Tempo ({tempoCount})</span>
              </button>
              <button
                type="button"
                onClick={() => setVendorCategoryFilter('Cash')}
                className={`px-3 py-1.5 rounded-md font-bold text-xs transition flex items-center gap-1.5 cursor-pointer ${
                  vendorCategoryFilter === 'Cash'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <DollarSign className="w-3.5 h-3.5" />
                <span>Vendor Cash ({cashCount})</span>
              </button>
            </div>
          </div>

          {openActionMenuVendorId && (
            <div
              className="fixed inset-0 z-30 bg-transparent"
              onClick={() => setOpenActionMenuVendorId(null)}
            />
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayedVendors.map((vendor) => {
              const isTempo = vendor.paymentCategory === 'Tempo' || (!vendor.paymentCategory && vendor.paymentType?.startsWith('TOP'));
              return (
              <div
                key={vendor.id}
                className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between hover:shadow-md transition relative"
              >
                <div>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <span className="text-[10px] font-mono font-bold text-slate-400">
                        {vendor.id}
                      </span>
                      <h3 className="font-bold text-sm text-slate-900 leading-tight">
                        {vendor.namaVendor}
                      </h3>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 ${
                        isTempo
                          ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}
                    >
                      {isTempo ? <CreditCard className="w-3 h-3 text-indigo-600" /> : <DollarSign className="w-3 h-3 text-emerald-600" />}
                      <span>{isTempo ? 'Tempo' : 'Cash'}: {vendor.paymentType}</span>
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-600 my-3">
                    <div className="flex items-start gap-2">
                      <UserCheck className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                      <span>PIC: <strong>{vendor.pic}</strong></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{vendor.telephone}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{vendor.email}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                      <span className="line-clamp-2 text-[11px] text-slate-500">
                        {vendor.address}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="grid grid-cols-2 gap-3 flex-1">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Nilai Minimum Order:</span>
                      <span className="text-xs font-extrabold text-amber-700 font-mono">
                        {formatRupiah(vendor.minimumOrder ?? 0)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Total Pembelian:</span>
                      <span className="text-xs font-black text-slate-900 font-mono">
                        {formatRupiah(vendor.totalPurchase)}
                      </span>
                    </div>
                  </div>

                  {/* Opsi Pilihan Aksi Vendor */}
                  <div className="relative" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => setOpenActionMenuVendorId(openActionMenuVendorId === vendor.id ? null : vendor.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-2xs border cursor-pointer ${
                        openActionMenuVendorId === vendor.id
                          ? 'bg-indigo-600 text-white border-indigo-600 ring-2 ring-indigo-200'
                          : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-300'
                      }`}
                      title="Buka opsi pilihan aksi vendor ini"
                      aria-expanded={openActionMenuVendorId === vendor.id}
                    >
                      <SlidersHorizontal className={`w-3.5 h-3.5 ${openActionMenuVendorId === vendor.id ? 'text-white' : 'text-indigo-600'}`} />
                      <span>Pilihan Opsi</span>
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${openActionMenuVendorId === vendor.id ? 'rotate-180 text-white' : 'text-slate-400'}`} />
                    </button>

                    {openActionMenuVendorId === vendor.id && (
                      <div
                        className="absolute right-0 bottom-full mb-1.5 w-72 sm:w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 py-2.5 z-40 animate-in fade-in zoom-in-95 duration-150 text-left"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="px-3.5 py-1.5 border-b border-slate-100 flex items-center justify-between mb-1.5">
                          <div>
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                              Opsi Mitra Vendor
                            </span>
                            <div className="text-xs font-bold text-slate-800">
                              {vendor.namaVendor}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setOpenActionMenuVendorId(null)}
                            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="px-1.5 space-y-1">
                          {/* Opsi 1: Ubah Data Vendor */}
                          <button
                            type="button"
                            onClick={() => {
                              setOpenActionMenuVendorId(null);
                              handleOpenEditVendor(vendor);
                            }}
                            className="w-full flex items-start gap-2.5 p-2 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-200 transition group text-left cursor-pointer"
                          >
                            <div className="p-1.5 rounded-lg bg-indigo-100 text-indigo-700 group-hover:bg-indigo-600 group-hover:text-white transition shrink-0 mt-0.5">
                              <Edit2 className="w-3.5 h-3.5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="font-bold text-xs text-slate-900 group-hover:text-indigo-700 block">
                                Ubah Data & Profil Vendor
                              </span>
                              <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                                Fungsi: Edit informasi kontak PIC, nomor telepon, alamat, dan termin pembayaran.
                              </p>
                            </div>
                          </button>

                          {/* Opsi 2: Hubungi Vendor */}
                          {vendor.telephone && (
                            <a
                              href={`tel:${vendor.telephone}`}
                              onClick={() => setOpenActionMenuVendorId(null)}
                              className="w-full flex items-start gap-2.5 p-2 rounded-xl hover:bg-emerald-50/80 border border-transparent hover:border-emerald-200 transition group text-left cursor-pointer"
                            >
                              <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white transition shrink-0 mt-0.5">
                                <Phone className="w-3.5 h-3.5" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <span className="font-bold text-xs text-slate-900 group-hover:text-emerald-700 block">
                                  Hubungi PIC: {vendor.telephone}
                                </span>
                                <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                                  Fungsi: Telepon langsung kontak representatif supplier.
                                </p>
                              </div>
                            </a>
                          )}

                          {/* Opsi 3: Email Vendor */}
                          {vendor.email && (
                            <a
                              href={`mailto:${vendor.email}`}
                              onClick={() => setOpenActionMenuVendorId(null)}
                              className="w-full flex items-start gap-2.5 p-2 rounded-xl hover:bg-blue-50/80 border border-transparent hover:border-blue-200 transition group text-left cursor-pointer"
                            >
                              <div className="p-1.5 rounded-lg bg-blue-100 text-blue-700 group-hover:bg-blue-600 group-hover:text-white transition shrink-0 mt-0.5">
                                <Mail className="w-3.5 h-3.5" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <span className="font-bold text-xs text-slate-900 group-hover:text-blue-700 block truncate">
                                  Kirim Email: {vendor.email}
                                </span>
                                <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                                  Fungsi: Kirim surat penawaran harga atau PO resmi via email.
                                </p>
                              </div>
                            </a>
                          )}

                          {/* Opsi 4: Hapus Vendor */}
                          <div className="border-t border-slate-100 my-1 pt-1" />
                          <button
                            type="button"
                            onClick={() => {
                              setOpenActionMenuVendorId(null);
                              if (confirm(`Hapus data mitra vendor ${vendor.namaVendor}?`)) {
                                deleteVendor(vendor.id);
                              }
                            }}
                            className="w-full flex items-start gap-2.5 p-2 rounded-xl hover:bg-rose-50/80 border border-transparent hover:border-rose-200 transition group text-left cursor-pointer"
                          >
                            <div className="p-1.5 rounded-lg bg-rose-100 text-rose-700 group-hover:bg-rose-600 group-hover:text-white transition shrink-0 mt-0.5">
                              <Trash2 className="w-3.5 h-3.5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="font-bold text-xs text-rose-700 block">
                                Hapus Mitra Vendor
                              </span>
                              <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                                Fungsi: Hapus data rekanan ini dari daftar direktori vendor gudang.
                              </p>
                            </div>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          </div>
        </div>
        );
      })()}

      {/* 4. Subtab: Integrasi Gmail Vendor */}
      {activeSubTab === 'gmail-vendor' && (
        <div className="space-y-4">
          {/* Top Gmail Connection Bar */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl border border-rose-200 shrink-0 mt-0.5">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm font-extrabold text-slate-900">
                    Integrasi Google Workspace Gmail — Korespondensi &amp; PO Mitra Vendor
                  </h2>
                  {!needsGmailAuth && gmailToken ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      Terhubung: {gmailUserEmail}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                      <AlertCircle className="w-3 h-3 text-amber-600" />
                      Belum Terhubung ke Akun Google
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Kirim dokumen resmi Purchase Order (.pdf) langsung melalui akun Gmail Anda dan pantau email masuk/terkirim dari mitra vendor.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {needsGmailAuth || !gmailToken ? (
                renderGoogleSignInButton('Sign in with Google')
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => handleLoadGmailMessages()}
                    disabled={isLoadingGmailMessages}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${isLoadingGmailMessages ? 'animate-spin text-indigo-600' : ''}`}
                    />
                    <span>Muat Ulang Email</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleGoogleSignOutClick}
                    className="px-3 py-2 bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Putuskan Akun</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {gmailErrorMsg && (
            <div className="p-3.5 bg-red-50 border border-red-200 text-red-900 rounded-xl text-xs flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{gmailErrorMsg}</span>
              </div>
              <button
                type="button"
                onClick={() => setGmailErrorMsg(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {needsGmailAuth || !gmailToken ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center space-y-4 shadow-xs">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto">
                <Mail className="w-6 h-6" />
              </div>
              <div className="max-w-md mx-auto space-y-1">
                <h3 className="text-sm font-extrabold text-slate-900">
                  Hubungkan Akun Gmail Anda untuk Mengirim &amp; Membaca Email PO Vendor
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Dengan izin Anda, aplikasi dapat mengirim email Purchase Order beserta lampiran PDF resmi langsung ke alamat email vendor serta menampilkan riwayat email terkait pengadaan.
                </p>
              </div>
              <div className="flex justify-center pt-1">
                {renderGoogleSignInButton('Sign in with Google')}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Left Column: Search & Message List */}
              <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
                <div className="p-3 bg-slate-50 border-b border-slate-200 space-y-2">
                  <div className="flex items-center gap-1.5">
                    <div className="relative flex-1">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={gmailSearchQuery}
                        onChange={(e) => setGmailSearchQuery(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleLoadGmailMessages(gmailSearchQuery);
                        }}
                        placeholder="Cari subjek PO, email vendor..."
                        className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 outline-hidden"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleLoadGmailMessages(gmailSearchQuery)}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold cursor-pointer"
                    >
                      Cari
                    </button>
                  </div>

                  {/* Quick Filter Buttons */}
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                    <button
                      type="button"
                      onClick={() => {
                        const q = 'Purchase Order OR PO-';
                        setGmailSearchQuery(q);
                        handleLoadGmailMessages(q);
                      }}
                      className="px-2 py-0.5 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 font-semibold cursor-pointer"
                    >
                      Email PO
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const q = 'in:sent';
                        setGmailSearchQuery(q);
                        handleLoadGmailMessages(q);
                      }}
                      className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer"
                    >
                      Terkirim (Sent)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const q = 'in:inbox';
                        setGmailSearchQuery(q);
                        handleLoadGmailMessages(q);
                      }}
                      className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer"
                    >
                      Kotak Masuk (Inbox)
                    </button>
                  </div>
                </div>

                <div className="divide-y divide-slate-100 max-h-[480px] overflow-y-auto">
                  {isLoadingGmailMessages ? (
                    <div className="p-8 text-center text-xs text-slate-500">
                      Memuat pesan dari Gmail...
                    </div>
                  ) : gmailMessages.length === 0 ? (
                    <div className="p-8 text-center space-y-2 text-xs text-slate-400">
                      <Inbox className="w-8 h-8 mx-auto text-slate-300" />
                      <p className="font-semibold text-slate-600">Tidak ada pesan ditemukan</p>
                      <button
                        type="button"
                        onClick={() => handleLoadGmailMessages('')}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-xs cursor-pointer"
                      >
                        Tampilkan Semua Email Terbaru
                      </button>
                    </div>
                  ) : (
                    gmailMessages.map((msg) => {
                      const isActive = selectedGmailMessage?.id === msg.id;
                      return (
                        <div
                          key={msg.id}
                          onClick={() => setSelectedGmailMessage(msg)}
                          className={`p-3 cursor-pointer transition hover:bg-slate-50 ${
                            isActive ? 'bg-indigo-50/70 border-l-4 border-indigo-600' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-xs text-slate-900 truncate">
                              {msg.subject}
                            </span>
                            <span className="text-[10px] text-slate-400 shrink-0">
                              {msg.date ? msg.date.slice(0, 16) : ''}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-600 truncate mt-0.5">
                            Dari: {msg.from}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate">
                            Ke: {msg.to}
                          </div>
                          <p className="text-[11px] text-slate-400 line-clamp-2 mt-1">
                            {msg.snippet}
                          </p>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Right Column: Message Content Viewer */}
              <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 shadow-xs p-5 flex flex-col justify-between min-h-[380px]">
                {selectedGmailMessage ? (
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-200">
                      <div>
                        <h3 className="font-extrabold text-sm text-slate-900">
                          {selectedGmailMessage.subject}
                        </h3>
                        <div className="text-xs text-slate-600 mt-1 space-y-0.5">
                          <div>
                            <strong>Dari:</strong> {selectedGmailMessage.from}
                          </div>
                          <div>
                            <strong>Kepada:</strong> {selectedGmailMessage.to}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            <strong>Tanggal:</strong> {selectedGmailMessage.date}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setConfirmTrashMessage(selectedGmailMessage)}
                        className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold flex items-center gap-1 shrink-0 cursor-pointer"
                        title="Pindahkan pesan email ini ke Trash Gmail"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Hapus ke Trash</span>
                      </button>
                    </div>

                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 whitespace-pre-wrap max-h-[340px] overflow-y-auto leading-relaxed">
                      {selectedGmailMessage.bodyText || selectedGmailMessage.snippet}
                    </div>
                  </div>
                ) : (
                  <div className="my-auto text-center text-slate-400 space-y-2 py-12">
                    <Mail className="w-10 h-10 mx-auto text-slate-300" />
                    <p className="text-xs font-semibold text-slate-600">
                      Pilih pesan email di sebelah kiri untuk membaca isi surat pesanan / balasan vendor
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal Konfirmasi Hapus Pesan Gmail ke Trash (Mandatory Confirmation Dialog) */}
      {confirmTrashMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full border border-slate-200 p-5 space-y-4 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-extrabold text-sm text-rose-700 flex items-center gap-2">
                <Trash2 className="w-4 h-4" />
                Konfirmasi Pindahkan Email ke Trash Gmail?
              </h3>
              <button type="button" onClick={() => setConfirmTrashMessage(null)}>
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <p className="text-slate-700 leading-relaxed">
              Apakah Anda yakin ingin memindahkan pesan email berikut ke <strong>Trash</strong> pada akun Gmail Anda ({gmailUserEmail})?
            </p>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
              <div>
                <strong>Subjek:</strong> {confirmTrashMessage.subject}
              </div>
              <div>
                <strong>Dari:</strong> {confirmTrashMessage.from}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmTrashMessage(null)}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmTrashGmailMessage}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold cursor-pointer"
              >
                Ya, Pindahkan ke Trash
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Tolak Barang */}
      {rejectingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-sm text-red-600 flex items-center gap-2">
                <Ban className="w-4 h-4" />
                Tolak Barang: {rejectingItem.itemName}
              </h3>
              <button onClick={() => setRejectingItem(null)}>
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            <div className="text-xs space-y-2">
              <p className="text-slate-600">
                Item ini tidak akan dimasukkan ke alur pemesanan ke vendor.
              </p>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Alasan Penolakan:
                </label>
                <input
                  type="text"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Misal: Stok kosong di vendor / harga melonjak drastis..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-hidden"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setRejectingItem(null)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmReject}
                className="px-4 py-1.5 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-xs"
              >
                Konfirmasi Tolak
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Ubah Qty & Harga Item di PO Vendor */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-900">
                Ubah Item: {editingItem.itemName}
              </h3>
              <button onClick={() => setEditingItem(null)}>
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Jumlah (Qty dalam {editingItem.unit}):
                </label>
                <input
                  type="number"
                  min="1"
                  value={editQty}
                  onChange={(e) => setEditQty(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full text-center py-2 border border-slate-300 rounded-lg font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Harga Satuan (IDR):
                </label>
                <input
                  type="number"
                  min="0"
                  value={editPrice}
                  onChange={(e) => setEditPrice(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full text-right py-2 border border-slate-300 rounded-lg font-bold"
                />
              </div>

              <div className="flex justify-between font-bold text-slate-900 pt-1">
                <span>Total Baru:</span>
                <span className="text-indigo-600">{formatRupiah(editQty * editPrice)}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setEditingItem(null)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Batal
              </button>
              <button
                onClick={handleSaveEditItem}
                className="px-4 py-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Tambah Barang ke PO Vendor */}
      {showAddItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <form
            onSubmit={handleAddItemToPOVendor}
            className="bg-white rounded-2xl shadow-xl max-w-md w-full border border-slate-200 p-6 space-y-4"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-900">
                Tambah Barang ke PO Vendor
              </h3>
              <button type="button" onClick={() => setShowAddItemModal(false)}>
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {/* Field Pencarian Barang */}
              <div className="relative">
                <label className="block font-semibold text-slate-700 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Search className="w-3.5 h-3.5 text-indigo-600" />
                    Pencarian Barang
                  </span>
                  {selectedAddVendorInventoryItem && (
                    <span className="text-[10px] text-indigo-700 font-bold bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                      Terpilih: {selectedAddVendorInventoryItem.sku}
                    </span>
                  )}
                </label>

                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={addItemSearchQuery}
                    onFocus={() => setIsAddItemDropdownOpen(true)}
                    onChange={(e) => {
                      setAddItemSearchQuery(e.target.value);
                      setIsAddItemDropdownOpen(true);
                    }}
                    placeholder={
                      selectedAddVendorInventoryItem
                        ? `Cari barang lain (saat ini: [${selectedAddVendorInventoryItem.sku}] ${selectedAddVendorInventoryItem.itemName})...`
                        : 'Ketik SKU, Nama Barang, atau Kategori...'
                    }
                    className="w-full pl-9 pr-8 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-hidden"
                  />
                  {addItemSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setAddItemSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {isAddItemDropdownOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-300 rounded-xl shadow-xl z-30 max-h-48 overflow-y-auto divide-y divide-slate-100">
                    {filteredAddVendorSearchItems.length === 0 ? (
                      <div className="p-3 text-center text-slate-400 text-xs">
                        Tidak ada barang yang cocok dengan "{addItemSearchQuery}".
                      </div>
                    ) : (
                      filteredAddVendorSearchItems.map((inv) => (
                        <div
                          key={inv.sku}
                          onClick={() => handleSelectAddVendorItem(inv)}
                          className={`p-2.5 hover:bg-indigo-50 cursor-pointer transition flex items-center justify-between text-xs ${
                            inv.sku === newItemSku
                              ? 'bg-indigo-50/80 font-bold text-indigo-900'
                              : 'text-slate-700'
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-[11px] font-bold text-indigo-700 bg-indigo-100/70 px-1.5 py-0.5 rounded">
                                {inv.sku}
                              </span>
                              <span className="font-semibold text-slate-900">{inv.itemName}</span>
                            </div>
                            <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-2">
                              <span>Kategori: {inv.category}</span>
                              <span>•</span>
                              <span>Unit: {inv.unit}</span>
                            </div>
                          </div>
                          {inv.sku === newItemSku && (
                            <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}

                {selectedAddVendorInventoryItem && (
                  <div className="mt-2 p-2.5 bg-indigo-50/60 border border-indigo-200 rounded-xl flex items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-[11px] bg-indigo-600 text-white px-1.5 py-0.5 rounded">
                          {selectedAddVendorInventoryItem.sku}
                        </span>
                        <span className="font-bold text-slate-900">
                          {selectedAddVendorInventoryItem.itemName}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-600 mt-0.5">
                        Kategori: <strong>{newItemCategory}</strong> • Unit: <strong>{newItemUnit}</strong>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsAddItemDropdownOpen((prev) => !prev)}
                      className="px-2 py-1 text-[11px] font-bold bg-white text-indigo-800 border border-indigo-300 rounded-lg hover:bg-indigo-100 transition cursor-pointer shrink-0"
                    >
                      {isAddItemDropdownOpen ? 'Tutup' : 'Ganti'}
                    </button>
                  </div>
                )}
              </div>

              {/* Kategori & Unit */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Kategori</label>
                  <select
                    value={newItemCategory}
                    onChange={(e) => setNewItemCategory(e.target.value as ItemCategory)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-hidden"
                  >
                    {ITEM_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Unit</label>
                  <input
                    type="text"
                    required
                    value={newItemUnit}
                    onChange={(e) => setNewItemUnit(e.target.value)}
                    placeholder="Contoh: Kg, Pack, Pcs, Liter"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Qty</label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    required
                    value={newItemQty}
                    onChange={(e) => setNewItemQty(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold focus:ring-2 focus:ring-indigo-500 outline-hidden"
                  />
                  {newItemUnit && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500 pointer-events-none">
                      {newItemUnit}
                    </span>
                  )}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Tugaskan Vendor Langsung
                </label>
                <select
                  value={newItemVendor}
                  onChange={(e) => setNewItemVendor(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold focus:ring-2 focus:ring-indigo-500 outline-hidden"
                >
                  {vendors.map((v) => (
                    <option key={v.id} value={v.namaVendor}>
                      {v.namaVendor}
                    </option>
                  ))}
                </select>
              </div>

              {/* Kolom Alasan Penambahan Barang */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Alasan Penambahan Barang
                </label>
                <textarea
                  rows={2}
                  value={newItemReason}
                  onChange={(e) => setNewItemReason(e.target.value)}
                  placeholder="Masukkan alasan penambahan barang ke PO..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-hidden"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowAddItemModal(false);
                  setIsAddItemDropdownOpen(false);
                }}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs cursor-pointer"
              >
                Tambahkan
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Tambah/Ubah Data Vendor */}
      {showVendorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <form
            onSubmit={handleSaveVendorForm}
            className="bg-white rounded-2xl shadow-xl max-w-lg w-full border border-slate-200 p-6 space-y-4 max-h-[85vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-900">
                {isEditingVendor ? 'Ubah Data Vendor' : 'Tambah Vendor Baru'}
              </h3>
              <button type="button" onClick={() => setShowVendorModal(false)}>
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nama Vendor / Perusahaan
                </label>
                <input
                  type="text"
                  required
                  value={vendorFormData.namaVendor || ''}
                  onChange={(e) =>
                    setVendorFormData({ ...vendorFormData, namaVendor: e.target.value })
                  }
                  placeholder="e.g. PT Sumber Boga Prima"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Nama PIC (Kontak Person)
                  </label>
                  <input
                    type="text"
                    required
                    value={vendorFormData.pic || ''}
                    onChange={(e) =>
                      setVendorFormData({ ...vendorFormData, pic: e.target.value })
                    }
                    placeholder="Budi (0812-xxxx)"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block font-semibold text-slate-700">
                    Kategori Pembayaran <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setVendorFormData({
                          ...vendorFormData,
                          paymentCategory: 'Tempo',
                          paymentType: vendorFormData.topTerm || 'TOP 14 Hari',
                        })
                      }
                      className={`p-2.5 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                        vendorFormData.paymentCategory === 'Tempo'
                          ? 'bg-indigo-50 border-indigo-500 text-indigo-700 ring-2 ring-indigo-200'
                          : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <CreditCard className="w-4 h-4 text-indigo-600" />
                      <span>Tempo (Kredit)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setVendorFormData({
                          ...vendorFormData,
                          paymentCategory: 'Cash',
                          paymentType: vendorFormData.cashType || 'Cash / COD',
                        })
                      }
                      className={`p-2.5 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                        vendorFormData.paymentCategory === 'Cash'
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-700 ring-2 ring-emerald-200'
                          : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <DollarSign className="w-4 h-4 text-emerald-600" />
                      <span>Cash (Tunai)</span>
                    </button>
                  </div>

                  {/* Pilihan TOP (Term of Payment) - Hanya tampil jika Tempo terpilih */}
                  {vendorFormData.paymentCategory === 'Tempo' ? (
                    <div className="mt-2.5 p-3 bg-indigo-50/60 rounded-xl border border-indigo-200 space-y-1.5 animate-in fade-in duration-150">
                      <div className="flex items-center justify-between">
                        <label className="block font-bold text-xs text-indigo-900">
                          Pilihan TOP (Term of Payment)
                        </label>
                        <span className="text-[10px] font-bold text-indigo-600 bg-white px-2 py-0.5 rounded-full border border-indigo-200">
                          Jatuh Tempo Invoice
                        </span>
                      </div>
                      <select
                        value={vendorFormData.topTerm || vendorFormData.paymentType || 'TOP 14 Hari'}
                        onChange={(e) =>
                          setVendorFormData({
                            ...vendorFormData,
                            topTerm: e.target.value,
                            paymentType: e.target.value as any,
                          })
                        }
                        className="w-full px-3 py-2 bg-white border border-indigo-300 rounded-lg text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-hidden"
                      >
                        <option value="TOP 7 Hari">TOP 7 Hari (1 Minggu)</option>
                        <option value="TOP 14 Hari">TOP 14 Hari (2 Minggu)</option>
                        <option value="TOP 21 Hari">TOP 21 Hari (3 Minggu)</option>
                        <option value="TOP 30 Hari">TOP 30 Hari (1 Bulan)</option>
                        <option value="TOP 45 Hari">TOP 45 Hari (1.5 Bulan)</option>
                        <option value="TOP 60 Hari">TOP 60 Hari (2 Bulan)</option>
                        <option value="TOP 90 Hari">TOP 90 Hari (3 Bulan)</option>
                      </select>
                      <p className="text-[10px] text-indigo-600">
                        Tagihan vendor dibayarkan bertahap sesuai rentang hari termin TOP yang disepakati.
                      </p>
                    </div>
                  ) : (
                    <div className="mt-2.5 p-3 bg-emerald-50/60 rounded-xl border border-emerald-200 space-y-1.5 animate-in fade-in duration-150">
                      <div className="flex items-center justify-between">
                        <label className="block font-bold text-xs text-emerald-900">
                          Metode Pembayaran Cash
                        </label>
                        <span className="text-[10px] font-bold text-emerald-600 bg-white px-2 py-0.5 rounded-full border border-emerald-200">
                          Tunai / Langsung
                        </span>
                      </div>
                      <select
                        value={vendorFormData.cashType || vendorFormData.paymentType || 'Cash / COD'}
                        onChange={(e) =>
                          setVendorFormData({
                            ...vendorFormData,
                            cashType: e.target.value,
                            paymentType: e.target.value as any,
                          })
                        }
                        className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-lg text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-hidden"
                      >
                        <option value="Cash / COD">Cash on Delivery (COD saat barang sampai)</option>
                        <option value="Cash Before Delivery">Cash Before Delivery (CBD sebelum kirim)</option>
                        <option value="Bank Transfer">Bank Transfer (Langsung Hari H)</option>
                        <option value="Tunai Kasir">Tunai Kasir / Bon Gudang</option>
                      </select>
                      <p className="text-[10px] text-emerald-600">
                        Pembayaran tunai langsung tanpa jatuh tempo kredit invoice.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Nomor Telepon
                  </label>
                  <input
                    type="text"
                    value={vendorFormData.telephone || ''}
                    onChange={(e) =>
                      setVendorFormData({ ...vendorFormData, telephone: e.target.value })
                    }
                    placeholder="021-xxxx"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    E-mail
                  </label>
                  <input
                    type="email"
                    value={vendorFormData.email || ''}
                    onChange={(e) =>
                      setVendorFormData({ ...vendorFormData, email: e.target.value })
                    }
                    placeholder="sales@vendor.com"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1 flex items-center justify-between">
                  <span>Nilai Minimum Order (Rp)</span>
                  <span className="text-[10px] font-mono font-bold text-amber-700">
                    {formatRupiah(Number(vendorFormData.minimumOrder) || 0)}
                  </span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="50000"
                  value={vendorFormData.minimumOrder ?? 0}
                  onChange={(e) =>
                    setVendorFormData({
                      ...vendorFormData,
                      minimumOrder: Math.max(0, parseInt(e.target.value, 10) || 0),
                    })
                  }
                  placeholder="Contoh: 500000"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-hidden"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Batas nilai minimum pemesanan (MOQ / Minimum Order Value) untuk mitra vendor ini. Isi 0 jika tanpa minimum order.
                </span>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Alamat Lengkap
                </label>
                <textarea
                  rows={2}
                  value={vendorFormData.address || ''}
                  onChange={(e) =>
                    setVendorFormData({ ...vendorFormData, address: e.target.value })
                  }
                  placeholder="Jl..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowVendorModal(false)}
                className="px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs"
              >
                Simpan Vendor
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Ubah Item Vendor Summary (Qty, Harga, Select Vendor) */}
      {editingSummaryItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-4 bg-gradient-to-r from-purple-50 via-slate-50 to-indigo-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-xs">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900">
                    Ubah Item Formulir PO {editingSummaryItem.poId}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Sesuaikan Qty, Harga Satuan, atau Ubah Rekanan Vendor
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingSummaryItem(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Alert jika item ditolak oleh Cost Control */}
              {editingSummaryItem.isRejected && (
                <div className="p-3.5 bg-red-50 border-2 border-red-300 rounded-xl flex items-start gap-3 text-xs text-red-950">
                  <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="font-extrabold text-sm text-red-900">
                      Item Tidak Disetujui Cost Control
                    </div>
                    {editingSummaryItem.rejectionReason && (
                      <p className="text-red-800 font-medium">
                        Alasan penolakan: <span className="italic font-bold">"{editingSummaryItem.rejectionReason}"</span>
                      </p>
                    )}
                    <p className="text-[11px] text-red-700 leading-relaxed">
                      Silakan sesuaikan kuantitas (Qty), negosiasikan harga satuan, atau pindahkan pengadaan item ini ke vendor mitra lain di bawah.
                    </p>
                  </div>
                </div>
              )}

              {/* Item Info Box */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">SKU Barang:</span>
                  <span className="font-mono font-bold text-slate-800">{editingSummaryItem.sku}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Nama Barang:</span>
                  <span className="font-bold text-slate-900">{editingSummaryItem.itemName}</span>
                </div>
                {editingSummaryItem.place && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Lokasi / Outlet:</span>
                    <span className="font-semibold text-slate-700">{editingSummaryItem.place}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Satuan:</span>
                  <span className="font-semibold text-slate-700">{editingSummaryItem.unit}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Vendor Asal:</span>
                  <span className="font-semibold text-slate-600">{editingSummaryItem.currentVendorName || '-'}</span>
                </div>
              </div>

              {/* Input: Qty & Satuan */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Kuantitas (Qty):
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    value={editingSummaryItem.qty}
                    onChange={(e) =>
                      setEditingSummaryItem((prev) =>
                        prev ? { ...prev, qty: Math.max(1, parseInt(e.target.value) || 1) } : null
                      )
                    }
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-extrabold text-slate-900 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-hidden"
                  />
                  <span className="px-3 py-2 bg-slate-100 border border-slate-300 rounded-xl text-xs font-bold text-slate-600 shrink-0">
                    {editingSummaryItem.unit}
                  </span>
                </div>
              </div>

              {/* Input: Harga Satuan */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Harga Satuan (Rp):
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    Rp
                  </span>
                  <input
                    type="number"
                    min={0}
                    step={500}
                    value={editingSummaryItem.price}
                    onChange={(e) =>
                      setEditingSummaryItem((prev) =>
                        prev ? { ...prev, price: Math.max(0, parseInt(e.target.value) || 0) } : null
                      )
                    }
                    className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-extrabold text-slate-900 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-hidden"
                  />
                </div>
              </div>

              {/* Select: Ubah ke Vendor Lain */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Pilih Vendor Mitra (Ubah ke Vendor Lain):
                </label>
                <select
                  value={editingSummaryItem.vendorName}
                  onChange={(e) =>
                    setEditingSummaryItem((prev) =>
                      prev ? { ...prev, vendorName: e.target.value } : null
                    )
                  }
                  className="w-full px-3 py-2 bg-white border-2 border-purple-500 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-purple-400 outline-hidden"
                >
                  {vendors.map((v) => {
                    const cat =
                      v.paymentCategory || (v.paymentType?.startsWith('TOP') ? 'Tempo' : 'Cash');
                    const term =
                      cat === 'Tempo'
                        ? v.topTerm || v.paymentType
                        : v.cashType || v.paymentType;
                    return (
                      <option key={v.id} value={v.namaVendor}>
                        {v.namaVendor} • [{cat}] {term}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Dynamic Live Subtotal & Vendor Terms Preview Card */}
              {(() => {
                const selectedVendorObj = vendors.find(
                  (v) => v.namaVendor === editingSummaryItem.vendorName
                );
                const isTempo =
                  selectedVendorObj?.paymentCategory === 'Tempo' ||
                  (!selectedVendorObj?.paymentCategory &&
                    selectedVendorObj?.paymentType?.startsWith('TOP'));
                const terms = isTempo
                  ? selectedVendorObj?.topTerm || selectedVendorObj?.paymentType || 'TOP 30 Hari'
                  : selectedVendorObj?.cashType || selectedVendorObj?.paymentType || 'Cash / COD';
                const subtotal = editingSummaryItem.qty * editingSummaryItem.price;

                return (
                  <div className="p-3.5 bg-purple-50/70 border border-purple-200 rounded-xl space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600 font-semibold">Subtotal Item Baru:</span>
                      <span className="text-sm font-black text-purple-900">
                        {formatRupiah(subtotal)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-purple-200/60">
                      <span className="text-slate-600 font-medium">Metode & Termin Rekanan:</span>
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md border ${
                          isTempo
                            ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}
                      >
                        {isTempo ? (
                          <CreditCard className="w-3 h-3 text-indigo-600" />
                        ) : (
                          <DollarSign className="w-3 h-3 text-emerald-600" />
                        )}
                        <span>{isTempo ? `Tempo: ${terms}` : `Cash: ${terms}`}</span>
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingSummaryItem(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200 transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveModalEdit}
                className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-extrabold transition shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Simpan Perubahan Item</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Konfirmasi Release to Vendor & Masuk ke Inbound (Penerimaan Barang Masuk) */}
      {releasingPOIds && releasingPOIds.length > 0 && (() => {
        const targetPOs = purchaseOrders.filter((p) => releasingPOIds.includes(p.id));
        const totalReleaseAmount = targetPOs.reduce((acc, p) => acc + p.totalAmount, 0);
        const totalReleaseItems = targetPOs.reduce(
          (acc, p) =>
            acc +
            p.items.filter((it) => it.status !== 'Rejected' && it.approvalStatus !== 'Rejected').length,
          0
        );
        const involvedVendors = Array.from(
          new Set(
            targetPOs.flatMap((p) =>
              p.items
                .filter((it) => it.status !== 'Rejected' && it.approvalStatus !== 'Rejected')
                .map((it) => it.vendorName || 'Vendor Umum')
            )
          )
        );

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
              {/* Header */}
              <div className="p-4 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-white/15 rounded-xl">
                    <Truck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm">
                      Konfirmasi Release to Vendor &amp; Masuk ke Inbound
                    </h3>
                    <p className="text-[11px] text-emerald-100">
                      Form PO yang telah disetujui Cost Control akan diteruskan ke vendor &amp; modul Inbound (Penerimaan Barang Masuk)
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setReleasingPOIds(null)}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <div className="p-5 space-y-4 overflow-y-auto text-xs">
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-emerald-950">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <span className="font-extrabold block text-emerald-900">
                      Otorisasi Cost Control Terverifikasi ({targetPOs.length} Form PO)
                    </span>
                    <p className="text-emerald-800 leading-relaxed">
                      Saat Anda menekan <strong>"Release to Vendor &amp; Masuk ke Inbound"</strong>, sistem secara otomatis membuat dokumen <strong>Penerimaan Barang Masuk (Inbound Receiving)</strong> per mitra vendor dengan status <em>"Menunggu Kedatangan"</em> pada menu <strong>Inbound</strong>.
                    </p>
                  </div>
                </div>

                {/* Summary Metrics */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">
                      Jumlah Form PO
                    </span>
                    <span className="text-sm font-black text-slate-900">
                      {targetPOs.length} Form ({totalReleaseItems} Item)
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">
                      Total Mitra Vendor
                    </span>
                    <span className="text-sm font-black text-indigo-900">
                      {involvedVendors.length} Vendor Tujuan
                    </span>
                  </div>
                  <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl">
                    <span className="text-[10px] font-bold uppercase text-emerald-700 block">
                      Total Nilai Release PO
                    </span>
                    <span className="text-sm font-black text-emerald-900">
                      {formatRupiah(totalReleaseAmount)}
                    </span>
                  </div>
                </div>

                {/* Daftar Form PO yang Akan Di-release */}
                <div className="space-y-2">
                  <label className="block font-bold text-slate-700">
                    Rincian Form PO &amp; Mitra Vendor Tujuan:
                  </label>
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {targetPOs.map((po) => {
                      const poVendors = Array.from(
                        new Set(
                          po.items
                            .filter((it) => it.status !== 'Rejected' && it.approvalStatus !== 'Rejected')
                            .map((it) => it.vendorName || 'Vendor Umum')
                        )
                      );
                      return (
                        <div
                          key={po.id}
                          className="p-3 bg-white border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-emerald-600 text-white">
                                {po.id}
                              </span>
                              <span className="font-bold text-slate-900">
                                {formatRupiah(po.totalAmount)}
                              </span>
                              <span className="text-[11px] text-slate-500">
                                ({po.items.length} item)
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-600">
                              <span className="font-semibold text-slate-500">Mitra Vendor:</span>
                              {poVendors.map((vName) => {
                                const vObj = vendors.find((v) => v.namaVendor === vName);
                                return (
                                  <span
                                    key={vName}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200 font-medium"
                                  >
                                    <Building2 className="w-3 h-3 text-indigo-600" />
                                    <span>{vName}</span>
                                    {vObj?.email && (
                                      <span className="text-slate-500">({vObj.email})</span>
                                    )}
                                  </span>
                                );
                              })}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleExportPDF(po)}
                              className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                              title="Unduh PDF PO"
                            >
                              <FileText className="w-3 h-3 text-rose-600" />
                              <span>Export PDF</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setReleasingPOIds(null);
                                handleOpenEmailModal(po);
                              }}
                              className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                              title="Kirim Email ke Vendor"
                            >
                              <Mail className="w-3 h-3 text-indigo-600" />
                              <span>Email Vendor</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Option to auto-download PDF on release */}
                <label className="flex items-center gap-2.5 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100/80 transition">
                  <input
                    type="checkbox"
                    checked={releaseAutoDownloadPDF}
                    onChange={(e) => setReleaseAutoDownloadPDF(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                  />
                  <div>
                    <span className="font-bold text-slate-800 block">
                      Unduh Otomatis Dokumen PDF Purchase Order (.pdf) Saat Release
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Jika dicentang, berkas PDF resmi untuk setiap form PO akan otomatis diunduh ke perangkat Anda bersamaan saat Release ke Inbound.
                    </span>
                  </div>
                </label>
              </div>

              {/* Footer */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReleasingPOIds(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200 transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReleaseToVendor}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold transition shadow-sm flex items-center gap-1.5 cursor-pointer"
                >
                  <Truck className="w-4 h-4" />
                  <span>Release to Vendor &amp; Masukkan ke Inbound ({targetPOs.length} Form)</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal: Kirim Email Purchase Order ke Alamat Email Vendor */}
      {emailModalPO && (() => {
        const approvedItems = emailModalPO.items.filter(
          (it) => it.status !== 'Rejected' && it.approvalStatus !== 'Rejected'
        );
        const uniqueVendorNames = Array.from(
          new Set(approvedItems.map((it) => it.vendorName || 'Vendor Umum'))
        );

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[92vh]">
              {/* Header */}
              <div className="p-4 bg-gradient-to-r from-indigo-600 to-purple-700 text-white flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-white/15 rounded-xl">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm">
                      Kirim Email Purchase Order (#{emailModalPO.id}) ke Vendor
                    </h3>
                    <p className="text-[11px] text-indigo-100">
                      Kirim rincian pesanan beserta dokumen PDF PO langsung ke alamat email resmi mitra vendor
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEmailModalPO(null)}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <div className="p-5 space-y-3.5 overflow-y-auto text-xs">
                {/* Status Koneksi Google Workspace Gmail */}
                <div
                  className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
                    !needsGmailAuth && gmailToken
                      ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                      : 'bg-slate-50 border-slate-200 text-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Mail
                      className={`w-4 h-4 shrink-0 ${
                        !needsGmailAuth && gmailToken ? 'text-emerald-600' : 'text-slate-500'
                      }`}
                    />
                    <div>
                      <span className="font-bold block">
                        {!needsGmailAuth && gmailToken
                          ? `Terhubung dengan Gmail (${gmailUserEmail})`
                          : 'Hubungkan Akun Gmail untuk Pengiriman Langsung (OAuth)'}
                      </span>
                      <span className="text-[11px] text-slate-600">
                        {!needsGmailAuth && gmailToken
                          ? 'Email PO beserta lampiran PDF akan dikirim langsung melalui akun Gmail Anda.'
                          : 'Masuk dengan akun Google Anda untuk mengirim email PO beserta lampiran PDF otomatis via Gmail API.'}
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0">
                    {needsGmailAuth || !gmailToken ? (
                      renderGoogleSignInButton('Sign in with Google')
                    ) : (
                      <button
                        type="button"
                        onClick={handleGoogleSignOutClick}
                        className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-[11px] font-semibold cursor-pointer"
                      >
                        Ganti Akun
                      </button>
                    )}
                  </div>
                </div>

                {gmailErrorMsg && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-900 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                    <span>{gmailErrorMsg}</span>
                  </div>
                )}

                {/* Explicit User Confirmation Dialog before Sending/Drafting via Gmail API */}
                {confirmGmailAction && (
                  <div className="p-4 bg-amber-50 border-2 border-amber-400 rounded-xl space-y-3 animate-in zoom-in-95 duration-150">
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <h4 className="font-extrabold text-xs text-amber-950">
                          {confirmGmailAction.type === 'draft'
                            ? 'Konfirmasi Simpan Draf Email ke Akun Gmail Anda?'
                            : 'Konfirmasi Kirim Email Purchase Order melalui Akun Gmail Anda?'}
                        </h4>
                        <p className="text-[11px] text-amber-900 leading-relaxed">
                          Tindakan ini akan {confirmGmailAction.type === 'draft' ? 'menyimpan draf email pada' : 'mengirimkan email resmi atas nama'} akun Gmail Anda (<strong>{gmailUserEmail}</strong>) dengan rincian berikut:
                        </p>
                      </div>
                    </div>

                    <div className="p-3 bg-white border border-amber-200 rounded-lg space-y-1 text-[11px] text-slate-700">
                      <div>
                        <strong>Penerima (To):</strong> {emailRecipient}
                      </div>
                      {emailCc && (
                        <div>
                          <strong>CC:</strong> {emailCc}
                        </div>
                      )}
                      <div>
                        <strong>Subjek:</strong> {emailSubject}
                      </div>
                      <div>
                        <strong>Lampiran PDF:</strong>{' '}
                        {attachPDFInEmail ? `Dokumen Resmi PO (${emailModalPO.id}.pdf)` : 'Tanpa Lampiran'}
                      </div>
                      {confirmGmailAction.alsoReleaseToInbound && (
                        <div className="text-emerald-700 font-bold pt-1">
                          • Sekaligus melakukan Release to Vendor &amp; memasukkan form ke Inbound (Receiving)
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        disabled={isSendingGmail}
                        onClick={() => setConfirmGmailAction(null)}
                        className="px-3.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg font-bold text-xs cursor-pointer"
                      >
                        Batal
                      </button>
                      <button
                        type="button"
                        disabled={isSendingGmail}
                        onClick={handleExecuteConfirmedGmailAction}
                        className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-extrabold text-xs shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>
                          {isSendingGmail
                            ? 'Memproses via Gmail...'
                            : confirmGmailAction.type === 'draft'
                            ? 'Ya, Simpan Draf di Gmail'
                            : 'Ya, Konfirmasi & Kirim via Gmail'}
                        </span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Pilih Mitra Vendor Tujuan */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Pilih Mitra Vendor Tujuan
                    </label>
                    <select
                      value={emailTargetVendor}
                      onChange={(e) => populateEmailModalFields(emailModalPO, e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-hidden"
                    >
                      {uniqueVendorNames.length > 1 && (
                        <option value="ALL">
                          Semua Vendor pada Form PO ({uniqueVendorNames.length} Vendor)
                        </option>
                      )}
                      {uniqueVendorNames.map((vName) => {
                        const vObj = vendors.find((v) => v.namaVendor === vName);
                        return (
                          <option key={vName} value={vName}>
                            {vName} {vObj?.email ? `(${vObj.email})` : ''}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Alamat Email Vendor (To) <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={emailRecipient}
                        onChange={(e) => setEmailRecipient(e.target.value)}
                        placeholder="contoh: order@vendor.co.id"
                        className="w-full pl-8 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-hidden"
                      />
                    </div>
                  </div>
                </div>

                {/* CC & Subjek Email */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      CC Email Internal
                    </label>
                    <input
                      type="text"
                      value={emailCc}
                      onChange={(e) => setEmailCc(e.target.value)}
                      placeholder="purchasing@1010group.com"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Subjek Email Purchase Order
                    </label>
                    <input
                      type="text"
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-hidden"
                    />
                  </div>
                </div>

                {/* Isi Pesan Email */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Isi Surat Pesanan / Body Email
                  </label>
                  <textarea
                    rows={8}
                    value={emailBody}
                    onChange={(e) => setEmailBody(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-800 leading-relaxed focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-hidden"
                  />
                </div>

                {/* Lampiran PDF */}
                <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={attachPDFInEmail}
                      onChange={(e) => setAttachPDFInEmail(e.target.checked)}
                      className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                    />
                    <div className="flex items-center gap-2">
                      <Paperclip className="w-4 h-4 text-indigo-600 shrink-0" />
                      <div>
                        <span className="font-bold text-indigo-950 block">
                          Lampirkan Berkas PDF Purchase Order (.pdf) pada Email Gmail &amp; Unduh
                        </span>
                        <span className="text-[11px] text-indigo-700">
                          Melampirkan dokumen PDF PO resmi secara langsung pada pengiriman Gmail API
                        </span>
                      </div>
                    </div>
                  </label>

                  <button
                    type="button"
                    onClick={() =>
                      handleExportPDF(
                        emailModalPO,
                        emailTargetVendor === 'ALL' ? undefined : emailTargetVendor
                      )
                    }
                    className="px-3 py-1.5 bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 rounded-lg font-bold text-[11px] flex items-center gap-1 shrink-0 self-start sm:self-auto cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-rose-600" />
                    <span>Pratinjau / Unduh PDF</span>
                  </button>
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleSendVendorEmail({ openMailClient: true })}
                    className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                    title="Buka aplikasi email default (Outlook/Mailto)"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Buka Mailto</span>
                  </button>

                  {!needsGmailAuth && gmailToken && (
                    <button
                      type="button"
                      onClick={() => handleRequestGmailAction('draft', false)}
                      className="px-3 py-2 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                      title="Simpan sebagai Draf di akun Gmail Anda"
                    >
                      <Save className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Simpan Draf Gmail</span>
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEmailModalPO(null)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200 transition cursor-pointer"
                  >
                    Batal
                  </button>

                  {!needsGmailAuth && gmailToken ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handleRequestGmailAction('send', false)}
                        className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-extrabold transition shadow-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Kirim via Gmail API</span>
                      </button>

                      {emailModalPO.status === 'Approved by Cost Control' && (
                        <button
                          type="button"
                          onClick={() => handleRequestGmailAction('send', true)}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold transition shadow-sm flex items-center gap-1.5 cursor-pointer"
                          title="Kirim Email PO via Gmail API sekaligus Release form ke Inbound sebagai penerimaan barang masuk"
                        >
                          <Truck className="w-3.5 h-3.5" />
                          <span>Kirim Gmail &amp; Release ke Inbound</span>
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => handleSendVendorEmail({ openMailClient: false })}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-extrabold transition shadow-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Catat &amp; Kirim Email</span>
                      </button>

                      {emailModalPO.status === 'Approved by Cost Control' && (
                        <button
                          type="button"
                          onClick={() =>
                            handleSendVendorEmail({
                              openMailClient: false,
                              alsoReleaseToInbound: true,
                            })
                          }
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold transition shadow-sm flex items-center gap-1.5 cursor-pointer"
                          title="Kirim Email PO ke Vendor sekaligus Release form ke Inbound sebagai penerimaan barang masuk"
                        >
                          <Truck className="w-3.5 h-3.5" />
                          <span>Kirim &amp; Release ke Inbound</span>
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
