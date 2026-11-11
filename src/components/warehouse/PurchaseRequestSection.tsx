import React, { useState, useRef, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { OutletOrder, PurchaseOrder, POItem, ITEM_CATEGORIES, ItemCategory, InventoryItem } from '../../types';
import { formatRupiah, exportPOToExcel, exportOutletOrderToExcel } from '../../utils/excelExport';
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
  FileText,
  Layers,
  Sparkles,
  CheckSquare,
  Square,
  FileCheck,
  Send,
  Plus,
  Trash2,
  Edit2,
  FileSpreadsheet,
  Clock,
  ArrowRight,
  X,
  PlusCircle,
  AlertCircle,
  Check,
  ChevronDown,
  ChevronUp,
  Eye,
  Package,
  Search,
  Calendar,
  ArrowUpDown,
  Filter,
  Upload,
  Download,
  FileUp,
  AlertTriangle,
  CheckCircle2,
  Store,
  Building2,
  SlidersHorizontal,
  Ban,
} from 'lucide-react';

export const PurchaseRequestSection: React.FC = () => {
  const {
    outletOrders,
    createOutletOrder,
    bulkImportOutletOrders,
    generatePO,
    purchaseOrders,
    updatePO,
    deletePO,
    submitPOToPurchasing,
    deleteOutletOrder,
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

  const [activeSubTab, setActiveSubTab] = useState<'pr-outlet' | 'purchase-order'>('pr-outlet');
  // Form PO yang dipilih untuk menampilkan list barangnya (tampilan awal cukup tampilkan form)
  const [selectedPOId, setSelectedPOId] = useState<string | null>(null);
  // Form PR Outlet yang dipilih untuk menampilkan list barangnya tepat di bawah form
  const [expandedPROrderId, setExpandedPROrderId] = useState<string | null>(null);

  // State dropdown menu opsi aksi form PR Outlet & PO
  const [openActionMenuPROrderId, setOpenActionMenuPROrderId] = useState<string | null>(null);
  const [openActionMenuPOId, setOpenActionMenuPOId] = useState<string | null>(null);

  // State untuk konfirmasi hapus Form PR Outlet (single atau bulk)
  const [orderToDelete, setOrderToDelete] = useState<OutletOrder | null>(null);
  const [ordersToBulkDelete, setOrdersToBulkDelete] = useState<OutletOrder[]>([]);

  // Filter & Search states for PR Outlet
  const [prSearchQuery, setPrSearchQuery] = useState<string>('');
  const [prDateFilter, setPrDateFilter] = useState<string>('');
  const [prDateSortOrder, setPrDateSortOrder] = useState<'desc' | 'asc'>('desc');

  // Filter & Search states for Purchase Order
  const [poSearchQuery, setPoSearchQuery] = useState<string>('');
  const [poStatusFilter, setPoStatusFilter] = useState<string>('All');
  const [poDateFilter, setPoDateFilter] = useState<string>('');
  const [poDateSortOrder, setPoDateSortOrder] = useState<'desc' | 'asc'>('desc');

  // Filter & Search states for Items inside a selected Purchase Order
  const [poItemSearchQuery, setPoItemSearchQuery] = useState<string>('');
  const [poItemCategoryFilter, setPoItemCategoryFilter] = useState<string>('All');
  const [poItemPlaceFilter, setPoItemPlaceFilter] = useState<string>('All');

  // Checkmarked orders for "Generate PO"
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [generateMsg, setGenerateMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Active PO editor modal
  const [activeEditingPO, setActiveEditingPO] = useState<PurchaseOrder | null>(null);

  // Modals for Add PO Item
  const [showAddPOItemModal, setShowAddPOItemModal] = useState(false);
  const [targetPOForAddItem, setTargetPOForAddItem] = useState<PurchaseOrder | null>(null);
  const [newItemSku, setNewItemSku] = useState(inventory[0]?.sku || '');
  const [addItemSearchQuery, setAddItemSearchQuery] = useState('');
  const [isAddItemDropdownOpen, setIsAddItemDropdownOpen] = useState(false);
  const [newItemCategory, setNewItemCategory] = useState<ItemCategory>(
    inventory[0]?.category || 'Dry Item'
  );
  const [newItemUnit, setNewItemUnit] = useState(inventory[0]?.unit || 'Kg');
  const [newItemQty, setNewItemQty] = useState(10);
  const [newItemReason, setNewItemReason] = useState('');

  const [editingPOItem, setEditingPOItem] = useState<POItem | null>(null);
  const [editItemQty, setEditItemQty] = useState(1);
  const [editItemPrice, setEditItemPrice] = useState(0);

  // Filtered and sorted PR Outlet orders
  const filteredAndSortedPROrders = [...outletOrders]
    .filter((ord) => {
      const matchSearch =
        prSearchQuery === '' ||
        ord.id.toLowerCase().includes(prSearchQuery.toLowerCase()) ||
        ord.outletName.toLowerCase().includes(prSearchQuery.toLowerCase()) ||
        ord.department.toLowerCase().includes(prSearchQuery.toLowerCase()) ||
        ord.status.toLowerCase().includes(prSearchQuery.toLowerCase());
      const matchDate = prDateFilter === '' || ord.dateRequested === prDateFilter;
      return matchSearch && matchDate;
    })
    .sort((a, b) => {
      const timeA = new Date(a.dateRequested).getTime();
      const timeB = new Date(b.dateRequested).getTime();
      return prDateSortOrder === 'desc' ? timeB - timeA : timeA - timeB;
    });

  // Filtered and sorted Purchase Orders
  const filteredAndSortedPOs = [...purchaseOrders]
    .filter((po) => {
      const q = poSearchQuery.toLowerCase().trim();
      const matchSearch =
        q === '' ||
        po.id.toLowerCase().includes(q) ||
        po.status.toLowerCase().includes(q) ||
        po.items.some(
          (it) =>
            it.itemName.toLowerCase().includes(q) ||
            it.sku.toLowerCase().includes(q) ||
            it.category.toLowerCase().includes(q) ||
            (it.place && it.place.toLowerCase().includes(q))
        );
      const matchStatus = poStatusFilter === 'All' || po.status === poStatusFilter;
      const matchDate = poDateFilter === '' || po.generatedDate === poDateFilter;
      return matchSearch && matchStatus && matchDate;
    })
    .sort((a, b) => {
      const timeA = new Date(a.generatedDate).getTime();
      const timeB = new Date(b.generatedDate).getTime();
      return poDateSortOrder === 'desc' ? timeB - timeA : timeA - timeB;
    });

  const selectedPO = purchaseOrders.find((p) => p.id === selectedPOId) || null;
  const activePreviewPROrder =
    filteredAndSortedPROrders.find((o) => o.id === expandedPROrderId) ||
    filteredAndSortedPROrders.find(
      (o) =>
        selectedOrderIds.length > 0 &&
        o.id === selectedOrderIds[selectedOrderIds.length - 1]
    ) ||
    filteredAndSortedPROrders.find((o) => selectedOrderIds.includes(o.id)) ||
    filteredAndSortedPROrders[0] ||
    null;

  const toggleSelectOrder = (orderId: string) => {
    const isCurrentlySelected = selectedOrderIds.includes(orderId);
    const nextSelected = isCurrentlySelected
      ? selectedOrderIds.filter((id) => id !== orderId)
      : [...selectedOrderIds, orderId];

    setSelectedOrderIds(nextSelected);

    if (!isCurrentlySelected) {
      setExpandedPROrderId(orderId);
    } else if (expandedPROrderId === orderId && nextSelected.length > 0) {
      setExpandedPROrderId(nextSelected[nextSelected.length - 1]);
    }
  };

  const selectAllEligibleOrders = () => {
    const eligible = filteredAndSortedPROrders
      .filter(
        (o) =>
          o.status !== 'PO Generated' &&
          o.status !== 'Deployed / Dikirim' &&
          o.status !== 'Siap Dikirim' &&
          o.status !== 'PO Terkirim' &&
          o.status !== 'Selesai'
      )
      .map((o) => o.id);
    setSelectedOrderIds(eligible);
    if (eligible.length > 0 && (!expandedPROrderId || !eligible.includes(expandedPROrderId))) {
      setExpandedPROrderId(eligible[0]);
    }
  };

  // Upload Form PR State
  const [showUploadPRModal, setShowUploadPRModal] = useState<boolean>(false);
  const [isUploadingPR, setIsUploadingPR] = useState<boolean>(false);
  const [uploadPRFile, setUploadPRFile] = useState<File | null>(null);
  const [uploadPRParseResult, setUploadPRParseResult] = useState<PRParseResult | null>(null);
  const [uploadPRError, setUploadPRError] = useState<string | null>(null);
  const [uploadPROverwrite, setUploadPROverwrite] = useState<boolean>(true);
  const [uploadActiveTab, setUploadActiveTab] = useState<'preview' | 'rows'>('preview');
  const fileInputPRRef = useRef<HTMLInputElement>(null);

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
      setExpandedPROrderId(uploadPRParseResult.orders[0].id);
    }

    setShowUploadPRModal(false);

    // Show success modal
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
      message: `Sebanyak ${uploadPRParseResult.orders.length} Formulir PR Outlet berhasil diimpor ke sistem. Form ini otomatis aktif pada tab PR Outlet dan langsung diteruskan ke laman Outbond > Deployment.`,
      details: [
        { label: 'Nama File', value: uploadPRParseResult.fileName },
        { label: 'Total Form PR', value: `${uploadPRParseResult.orders.length} formulir` },
        { label: 'Outlet Terkait', value: outletNamesList },
        { label: 'Total Item Barang', value: `${totalItemsCount} item pesanan` },
        { label: 'Total Estimasi Nilai', value: formatRupiah(totalAmountSum) },
        { label: 'Status Dokumen', value: 'Submitted (Aktif di PR & Outbond Deployment)' },
        { label: 'Diunggah Oleh', value: `${currentUser.username} (${currentUser.position})` },
      ],
    });
    setShowSuccessModal(true);
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

  const deselectAllOrders = () => {
    setSelectedOrderIds([]);
  };

  // Execute Generate PO
  const handleGeneratePO = () => {
    if (selectedOrderIds.length === 0) {
      setGenerateMsg({
        type: 'error',
        text: 'Tandai (checklist) setidaknya satu form order outlet untuk digabungkan menjadi PO.',
      });
      return;
    }

    const count = selectedOrderIds.length;
    const res = generatePO(selectedOrderIds);
    if (res.success) {
      setSelectedOrderIds([]);
      setActiveSubTab('purchase-order');

      // Pop-up sukses generate PO
      setSuccessModalData({
        title: 'Data Telah Berhasil Di-input!',
        message: `${res.message} Formulir PO telah siap dan dapat dikelola atau disubmit ke Purchasing.`,
        details: [
          { label: 'Jumlah Order Digabung', value: `${count} formulir outlet` },
          { label: 'Tujuan Tab', value: 'Purchase Order (PO)' },
          { label: 'Status', value: 'Draft PO Dibuat' },
          { label: 'Tindakan Lanjutan', value: 'Buka tab Purchase Order lalu klik "Submit to Purchasing"' },
        ],
      });
      setShowSuccessModal(true);
      scrollToTop();
    } else {
      setGenerateMsg({ type: 'error', text: res.message });
    }
  };

  // Trigger Hapus dari tombol sebaris Upload Form PR
  const handleTriggerToolbarDelete = () => {
    if (selectedOrderIds.length > 0) {
      const selectedOrders = outletOrders.filter((o) => selectedOrderIds.includes(o.id));
      if (selectedOrders.length === 1) {
        setOrderToDelete(selectedOrders[0]);
      } else if (selectedOrders.length > 1) {
        setOrdersToBulkDelete(selectedOrders);
      }
      return;
    }
    if (activePreviewPROrder) {
      setOrderToDelete(activePreviewPROrder);
    }
  };

  // Handle Konfirmasi Hapus Form PR Outlet (Single atau Bulk)
  const handleConfirmDeleteOrder = () => {
    if (ordersToBulkDelete.length > 0) {
      const count = ordersToBulkDelete.length;
      const ids = ordersToBulkDelete.map((o) => o.id);
      const outletsList = Array.from(new Set(ordersToBulkDelete.map((o) => o.outletName))).join(', ');

      ids.forEach((id) => deleteOutletOrder(id));
      setSelectedOrderIds((prev) => prev.filter((id) => !ids.includes(id)));
      if (expandedPROrderId && ids.includes(expandedPROrderId)) {
        setExpandedPROrderId(null);
      }
      setOrdersToBulkDelete([]);

      setSuccessModalData({
        title: 'Form PR Outlet Berhasil Dihapus!',
        message: `Sebanyak ${count} Form PR Outlet yang dipilih telah berhasil dihapus dari sistem.`,
        details: [
          { label: 'Jumlah Form Dihapus', value: `${count} formulir` },
          { label: 'Outlet Terkait', value: outletsList },
          { label: 'Status', value: 'Dihapus dari sistem' },
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

    deleteOutletOrder(orderToDelete.id);
    setSelectedOrderIds((prev) => prev.filter((id) => id !== deletedId));
    if (expandedPROrderId === deletedId) {
      setExpandedPROrderId(null);
    }
    setOrderToDelete(null);

    setSuccessModalData({
      title: 'Form PR Outlet Berhasil Dihapus!',
      message: `Form PR Outlet (${deletedId}) dari ${deletedOutlet} (${deletedDept}) telah berhasil dihapus dari sistem.`,
      details: [
        { label: 'Nomor Form', value: deletedId },
        { label: 'Outlet', value: deletedOutlet },
        { label: 'Departemen', value: deletedDept },
        { label: 'Status', value: 'Dihapus dari sistem' },
      ],
    });
    setShowSuccessModal(true);
    scrollToTop();
  };

  // Selected item & filtered search items for Add PO Item modal
  const selectedAddInventoryItem =
    masterInventoryList.find((i) => i.sku === newItemSku) ||
    inventory.find((i) => i.sku === newItemSku) ||
    null;

  const filteredAddSearchItems = (masterInventoryList.length > 0 ? masterInventoryList : inventory).filter(
    (item) => {
      if (!addItemSearchQuery.trim()) return true;
      const q = addItemSearchQuery.toLowerCase();
      return (
        item.sku.toLowerCase().includes(q) ||
        item.itemName.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
      );
    }
  );

  const handleSelectAddPOItem = (item: InventoryItem) => {
    setNewItemSku(item.sku);
    setNewItemCategory(item.category);
    setNewItemUnit(item.unit);
    setAddItemSearchQuery('');
    setIsAddItemDropdownOpen(false);
  };

  // PO Item Operations: Add, Edit, Delete
  const handleOpenAddPOItemModal = (po: PurchaseOrder) => {
    setTargetPOForAddItem(po);
    const defaultItem =
      masterInventoryList.find((i) => i.sku === newItemSku) ||
      inventory.find((i) => i.sku === newItemSku) ||
      masterInventoryList[0] ||
      inventory[0];
    if (defaultItem) {
      setNewItemSku(defaultItem.sku);
      setNewItemCategory(defaultItem.category);
      setNewItemUnit(defaultItem.unit);
    }
    setAddItemSearchQuery('');
    setIsAddItemDropdownOpen(false);
    setNewItemQty(1);
    setNewItemReason('');
    setShowAddPOItemModal(true);
  };

  const handleAddPOItem = (e: React.FormEvent) => {
    e.preventDefault();
    const targetPO =
      (targetPOForAddItem && purchaseOrders.find((p) => p.id === targetPOForAddItem.id)) ||
      activeEditingPO ||
      (selectedPOId ? purchaseOrders.find((p) => p.id === selectedPOId) || null : null);
    if (!targetPO) return;
    const inv =
      masterInventoryList.find((i) => i.sku === newItemSku) ||
      inventory.find((i) => i.sku === newItemSku) ||
      masterInventoryList[0] ||
      inventory[0];
    if (!inv) return;

    const reasonText = newItemReason.trim();
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
      place: reasonText ? `Alasan: ${reasonText}` : '-',
      status: 'Pending',
    };

    const updatedPO: PurchaseOrder = {
      ...targetPO,
      items: [...targetPO.items, newItem],
      totalAmount: targetPO.totalAmount + newItem.total,
    };

    updatePO(updatedPO);
    if (activeEditingPO && activeEditingPO.id === updatedPO.id) {
      setActiveEditingPO(updatedPO);
    }
    setTargetPOForAddItem(null);
    setShowAddPOItemModal(false);

    // Pop-up sukses tambah item ke PO
    setSuccessModalData({
      title: 'Item Berhasil Ditambahkan ke PO!',
      message: `Item [${newItem.sku}] ${newItem.itemName} berhasil ditambahkan ke PO ${targetPO.id}.`,
      details: [
        { label: 'Nomor PO', value: targetPO.id },
        { label: 'Item Ditambahkan', value: `${newItem.itemName} (${newItem.sku})` },
        { label: 'Kategori', value: newItem.category },
        { label: 'Qty & Unit', value: `${newItem.qty} ${newItem.unit}` },
        { label: 'Alasan Penambahan', value: reasonText || '-' },
      ],
    });
    setShowSuccessModal(true);

    // Reset input
    setNewItemQty(1);
    setNewItemReason('');
    setAddItemSearchQuery('');
    setIsAddItemDropdownOpen(false);
    scrollToTop();
  };

  const handleSaveEditPOItem = () => {
    if (!activeEditingPO || !editingPOItem) return;

    const newItems = activeEditingPO.items.map((it) => {
      if (it.sku === editingPOItem.sku && it.place === editingPOItem.place) {
        return {
          ...it,
          qty: editItemQty,
          price: editItemPrice,
          total: editItemQty * editItemPrice,
        };
      }
      return it;
    });

    const newTotal = newItems.reduce((acc, it) => acc + it.total, 0);
    const updatedPO: PurchaseOrder = {
      ...activeEditingPO,
      items: newItems,
      totalAmount: newTotal,
    };

    updatePO(updatedPO);
    setActiveEditingPO(updatedPO);
    setEditingPOItem(null);

    // Pop-up sukses edit item PO
    setSuccessModalData({
      title: 'Data Telah Berhasil Di-input!',
      message: `Perubahan item [${editingPOItem.sku}] ${editingPOItem.itemName} berhasil disimpan pada PO ${activeEditingPO.id}.`,
      details: [
        { label: 'Nomor PO', value: activeEditingPO.id },
        { label: 'Item Diubah', value: editingPOItem.itemName },
        { label: 'Qty Baru', value: `${editItemQty} ${editingPOItem.unit}` },
      ],
    });
    setShowSuccessModal(true);
    scrollToTop();
  };

  const handleDeletePOItem = (sku: string, place: string, poId?: string) => {
    const targetId = poId || activeEditingPO?.id || selectedPOId;
    if (!targetId) return;
    const targetPO = purchaseOrders.find((p) => p.id === targetId);
    if (!targetPO) return;

    const newItems = targetPO.items.filter(
      (it) => !(it.sku === sku && it.place === place)
    );
    const newTotal = newItems.reduce((acc, it) => acc + it.total, 0);
    const updatedPO: PurchaseOrder = {
      ...targetPO,
      items: newItems,
      totalAmount: newTotal,
    };
    updatePO(updatedPO);
    if (activeEditingPO && activeEditingPO.id === targetId) {
      setActiveEditingPO(updatedPO);
    }
  };

  // Helper: Pecah 1 item PO yang ter-merge menjadi baris-baris item per outlet
  const splitMergedPOItem = (it: POItem): POItem[] => {
    if (it.outletBreakdowns && it.outletBreakdowns.length > 1) {
      return it.outletBreakdowns.map((bd) => {
        const unitStr = bd.unit || it.unit;
        return {
          ...it,
          qty: bd.qty,
          unit: unitStr,
          total: bd.qty * it.price,
          place: `${bd.outletName} (${bd.qty} ${unitStr})`,
          isMerged: false,
          outletBreakdowns: [bd],
          outletBreakdownText: `${bd.outletName}: ${bd.qty} ${unitStr}`,
        };
      });
    }

    // Fallback: parse dari outletBreakdownText atau place jika format "Outlet A: 10 Kg, Outlet B: 5 Kg"
    const rawText =
      it.outletBreakdownText ||
      (it.place.includes(':') ? it.place.replace(/^Digabung\s*\([^)]*\)\s*:\s*/i, '') : '');
    if (rawText && rawText.includes(',')) {
      const parts = rawText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (parts.length > 1) {
        return parts.map((part) => {
          const [outletPart, qtyPart] = part.split(':').map((s) => s.trim());
          const parsedQty = qtyPart ? parseInt(qtyPart, 10) || it.qty : it.qty;
          const oName = outletPart || 'Outlet';
          return {
            ...it,
            qty: parsedQty,
            total: parsedQty * it.price,
            place: `${oName} (${parsedQty} ${it.unit})`,
            isMerged: false,
            outletBreakdowns: [
              {
                outletName: oName,
                department: 'Kitchen',
                qty: parsedQty,
                unit: it.unit,
              },
            ],
            outletBreakdownText: `${oName}: ${parsedQty} ${it.unit}`,
          };
        });
      }
    }

    return [{ ...it, isMerged: false }];
  };

  // Lepas Merge untuk 1 item tertentu pada PO
  const handleUnmergePOItem = (poId: string, sku: string, place: string) => {
    const targetPO = purchaseOrders.find((p) => p.id === poId);
    if (!targetPO) return;

    let targetItem: POItem | null = null;
    let splitRowsCount = 0;

    const newItems: POItem[] = [];
    targetPO.items.forEach((it) => {
      if (it.sku === sku && it.place === place) {
        targetItem = it;
        const splitItems = splitMergedPOItem(it);
        splitRowsCount = splitItems.length;
        newItems.push(...splitItems);
      } else {
        newItems.push(it);
      }
    });

    if (!targetItem) return;

    const newTotal = newItems.reduce((acc, it) => acc + it.total, 0);
    const updatedPO: PurchaseOrder = {
      ...targetPO,
      items: newItems,
      totalAmount: newTotal,
    };

    updatePO(updatedPO);
    if (activeEditingPO && activeEditingPO.id === poId) {
      setActiveEditingPO(updatedPO);
    }

    const unmergedItem = targetItem as POItem;
    setSuccessModalData({
      title: 'Merge Multi-Outlet Berhasil Dilepas!',
      message: `Item [${unmergedItem.sku}] ${unmergedItem.itemName} pada PO ${targetPO.id} telah dipisahkan menjadi ${splitRowsCount} baris alokasi outlet masing-masing.`,
      details: [
        { label: 'Nomor PO', value: targetPO.id },
        { label: 'Barang', value: `[${unmergedItem.sku}] ${unmergedItem.itemName}` },
        { label: 'Hasil Pemisahan', value: `${splitRowsCount} baris per-outlet` },
      ],
    });
    setShowSuccessModal(true);
  };

  // Lepas Semua Merge Multi-Outlet dalam 1 dokumen PO
  const handleUnmergeAllPOItems = (poId: string) => {
    const targetPO = purchaseOrders.find((p) => p.id === poId);
    if (!targetPO) return;

    let unmergedCount = 0;
    let resultingRows = 0;

    const newItems: POItem[] = [];
    targetPO.items.forEach((it) => {
      const isItemMerged =
        it.isMerged || (it.outletBreakdowns && it.outletBreakdowns.length > 1);
      if (isItemMerged) {
        unmergedCount += 1;
        const splitItems = splitMergedPOItem(it);
        resultingRows += splitItems.length;
        newItems.push(...splitItems);
      } else {
        newItems.push(it);
      }
    });

    if (unmergedCount === 0) return;

    const newTotal = newItems.reduce((acc, it) => acc + it.total, 0);
    const updatedPO: PurchaseOrder = {
      ...targetPO,
      items: newItems,
      totalAmount: newTotal,
    };

    updatePO(updatedPO);
    if (activeEditingPO && activeEditingPO.id === poId) {
      setActiveEditingPO(updatedPO);
    }

    setSuccessModalData({
      title: 'Seluruh Merge Multi-Outlet Berhasil Dilepas!',
      message: `Sebanyak ${unmergedCount} item gabungan pada PO ${targetPO.id} telah dipisahkan menjadi ${resultingRows} baris alokasi per masing-masing outlet.`,
      details: [
        { label: 'Nomor PO', value: targetPO.id },
        { label: 'Item Merge Dilepas', value: `${unmergedCount} SKU gabungan` },
        { label: 'Total Baris Setelah Dilepas', value: `${newItems.length} baris item` },
      ],
    });
    setShowSuccessModal(true);
  };

  // Handle Perubahan Bebas Qty PO (Field Bebas)
  const handleDirectUpdatePOItemQty = (poId: string, sku: string, place: string, newQty: number) => {
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
    const totalAmount = updatedItems.reduce((acc, it) => acc + it.total, 0);
    const updatedPO: PurchaseOrder = {
      ...targetPO,
      items: updatedItems,
      totalAmount,
    };
    updatePO(updatedPO);
    if (activeEditingPO && activeEditingPO.id === poId) {
      setActiveEditingPO(updatedPO);
    }
  };

  // Handle Perubahan Bebas Harga PO (Field Bebas)
  const handleDirectUpdatePOItemPrice = (poId: string, sku: string, place: string, newPrice: number) => {
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
    const totalAmount = updatedItems.reduce((acc, it) => acc + it.total, 0);
    const updatedPO: PurchaseOrder = {
      ...targetPO,
      items: updatedItems,
      totalAmount,
    };
    updatePO(updatedPO);
    if (activeEditingPO && activeEditingPO.id === poId) {
      setActiveEditingPO(updatedPO);
    }
  };

  // Submit PO to Purchasing
  const handleSubmitPOToPurchasing = (poId: string) => {
    submitPOToPurchasing(poId);
    if (activeEditingPO && activeEditingPO.id === poId) {
      setActiveEditingPO({
        ...activeEditingPO,
        status: 'Submitted to Purchasing',
      });
    }

    // Pop-up sukses submit PO ke Purchasing
    setSuccessModalData({
      title: 'PO Berhasil Disubmit ke Purchasing!',
      message: `Purchase Order (${poId}) berhasil diteruskan ke tim Purchasing. Form ini selanjutnya akan dikelola (penugasan vendor) pada menu Purchasing & Vendor dan diajukan ke Cost Control untuk approval.`,
      details: [
        { label: 'Nomor PO', value: poId },
        { label: 'Status Baru', value: 'Submitted to Purchasing' },
        { label: 'Tujuan Alur', value: 'Purchasing & Vendor -> Cost Control' },
        { label: 'Tindakan Lanjutan', value: 'Buka menu Purchasing & Vendor untuk kelola item & ajukan ke Cost Control' },
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
            <FileText className="w-6 h-6 text-amber-600" />
            Purchase Request & Purchase Order (Gudang Pusat)
          </h1>
          <p className="text-xs text-slate-500">
            Kompilasi permintaan order outlet, gabungkan menjadi PO gabungan, dan teruskan ke Purchasing untuk diajukan ke Cost Control.
          </p>
        </div>

        {/* Sub-tabs */}
        <div className="flex items-center gap-1.5 bg-slate-200/70 p-1 rounded-xl">
          <button
            onClick={() => setActiveSubTab('pr-outlet')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeSubTab === 'pr-outlet'
                ? 'bg-white text-amber-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            PR Outlet ({outletOrders.length})
          </button>
          <button
            onClick={() => setActiveSubTab('purchase-order')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeSubTab === 'purchase-order'
                ? 'bg-white text-amber-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileCheck className="w-3.5 h-3.5" />
            Purchase Order ({purchaseOrders.length})
          </button>
        </div>
      </div>

      {/* Messages */}
      {generateMsg && (
        <div
          className={`p-3.5 rounded-xl text-xs font-medium flex items-center justify-between ${
            generateMsg.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {generateMsg.type === 'success' ? (
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span>{generateMsg.text}</span>
          </div>
          <button onClick={() => setGenerateMsg(null)} className="p-1 hover:opacity-75">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 1. Subtab: PR Outlet */}
      {activeSubTab === 'pr-outlet' && (
        <div className="space-y-4">
          {/* Action Bar for Generate PO */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600" />
                Daftar PR Outlet (Urutan Tanggal Terkini)
              </h2>
              <p className="text-xs text-slate-500">
                Pilih thumbnail form di sebelah kiri untuk melihat rincian di panel kanan, atau tandai form untuk <strong>"Generate PO"</strong>.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Download Template PR */}
              <button
                type="button"
                onClick={() => downloadPROutletTemplate(masterInventoryList, outlets)}
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
                title="Upload file Excel Form PR Outlet yang akan otomatis masuk ke PR Outlet & Outbond Deployment"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Form PR</span>
              </button>

              {/* Tombol Hapus sebaris dengan Upload Form PR */}
              <button
                type="button"
                onClick={handleTriggerToolbarDelete}
                disabled={selectedOrderIds.length === 0 && !activePreviewPROrder}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-2xs border ${
                  selectedOrderIds.length > 0 || activePreviewPROrder
                    ? 'bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border-rose-300 hover:border-rose-600 cursor-pointer'
                    : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                }`}
                title={
                  selectedOrderIds.length > 0
                    ? `Hapus ${selectedOrderIds.length} form PR yang dicentang`
                    : 'Hapus form PR yang sedang ditampilkan pada preview panel'
                }
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>
                  {selectedOrderIds.length > 0 ? `Hapus (${selectedOrderIds.length})` : 'Hapus'}
                </span>
              </button>

              <div className="h-5 w-px bg-slate-300 hidden sm:block mx-0.5" />

              <button
                onClick={selectAllEligibleOrders}
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Pilih Semua
              </button>
              {selectedOrderIds.length > 0 && (
                <button
                  onClick={deselectAllOrders}
                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Batal Pilih
                </button>
              )}
              <button
                onClick={handleGeneratePO}
                disabled={selectedOrderIds.length === 0}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition shadow-xs ${
                  selectedOrderIds.length > 0
                    ? 'bg-amber-600 hover:bg-amber-700 text-white cursor-pointer'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                <Sparkles className="w-4 h-4" />
                Generate PO ({selectedOrderIds.length} Form Terpilih)
              </button>
            </div>
          </div>

          {/* PR Outlet Split Preview Panel Container */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            {/* Search & Filter Toolbar */}
            <div className="p-3 bg-slate-50/90 border-b border-slate-200 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 text-xs">
              {/* Search Bar */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={prSearchQuery}
                  onChange={(e) => setPrSearchQuery(e.target.value)}
                  placeholder="Cari Form ID, Outlet Name, Department, atau Status..."
                  className="w-full pl-9 pr-8 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-hidden"
                />
                {prSearchQuery && (
                  <button
                    onClick={() => setPrSearchQuery('')}
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
                    value={prDateFilter}
                    onChange={(e) => setPrDateFilter(e.target.value)}
                    className="text-xs text-slate-700 bg-transparent outline-hidden font-medium"
                  />
                  {prDateFilter && (
                    <button
                      onClick={() => setPrDateFilter('')}
                      className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-semibold ml-1"
                      title="Tampilkan semua tanggal"
                    >
                      Semua
                    </button>
                  )}
                </div>

                {/* Urutkan Tanggal */}
                <button
                  onClick={() => setPrDateSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg font-semibold transition shadow-2xs cursor-pointer"
                  title="Urutkan berdasarkan tanggal permintaan"
                >
                  <ArrowUpDown className="w-3.5 h-3.5 text-amber-600" />
                  <span>Urutkan: {prDateSortOrder === 'desc' ? 'Terbaru' : 'Terlama'}</span>
                </button>
              </div>
            </div>

            {openActionMenuPROrderId && (
              <div
                className="fixed inset-0 z-30 bg-transparent"
                onClick={() => setOpenActionMenuPROrderId(null)}
              />
            )}

            {filteredAndSortedPROrders.length === 0 ? (
              <div className="text-center py-12 px-4 text-slate-400 text-xs">
                <Store className="w-9 h-9 mx-auto text-slate-300 mb-2" />
                <p className="font-semibold text-slate-600 text-sm">
                  {outletOrders.length === 0
                    ? 'Belum ada order dari outlet.'
                    : 'Tidak ada form PR Outlet yang sesuai dengan filter atau kata kunci pencarian.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[500px]">
                {/* LEFT PANEL: Thumbnail List (Outlet Name, Department & Tanggal sebagai icon kecil) */}
                <div className="lg:col-span-4 border-b lg:border-b-0 lg:border-r border-slate-200 bg-slate-50/60 flex flex-col">
                  <div className="px-3.5 py-2.5 border-b border-slate-200/80 bg-slate-100/70 flex items-center justify-between text-[11px] font-bold text-slate-600">
                    <span>Daftar Form PR ({filteredAndSortedPROrders.length})</span>
                    {selectedOrderIds.length > 0 && (
                      <span className="text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full text-[10px]">
                        {selectedOrderIds.length} dipilih
                      </span>
                    )}
                  </div>

                  <div className="p-2.5 space-y-2 max-h-[600px] overflow-y-auto flex-1">
                    {filteredAndSortedPROrders.map((ord) => {
                      const isSelected = selectedOrderIds.includes(ord.id);
                      const isAlreadyGenerated = !!ord.poId || ord.status === 'PO Generated';
                      const isActivePreview = activePreviewPROrder?.id === ord.id;
                      const isMenuOpen = openActionMenuPROrderId === ord.id;

                      return (
                        <div
                          key={ord.id}
                          onClick={() => setExpandedPROrderId(ord.id)}
                          className={`group relative rounded-xl p-2.5 border transition cursor-pointer flex items-center gap-2.5 ${
                            isActivePreview
                              ? 'bg-amber-50/90 border-amber-400 shadow-xs ring-1 ring-amber-300'
                              : isSelected
                              ? 'bg-amber-50/40 border-amber-200 hover:border-amber-300'
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
                              onChange={() => toggleSelectOrder(ord.id)}
                              className="w-4 h-4 rounded-md accent-amber-600 cursor-pointer"
                            />
                          </div>

                          {/* Icon Kecil / Thumbnail */}
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border transition ${
                              isActivePreview
                                ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                                : isAlreadyGenerated
                                ? 'bg-purple-50 text-purple-600 border-purple-200'
                                : 'bg-slate-100 text-slate-600 border-slate-200 group-hover:bg-amber-100 group-hover:text-amber-700 group-hover:border-amber-200'
                            }`}
                          >
                            <Store className="w-4 h-4" />
                          </div>

                          {/* Info Singkat: Outlet Name, Department & Tanggal */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <p className="text-xs font-bold text-slate-900 truncate">
                                {ord.outletName}
                              </p>
                              {isAlreadyGenerated && (
                                <span
                                  className="shrink-0 w-2 h-2 rounded-full bg-purple-500"
                                  title={`Sudah di-generate (${ord.poId || 'PO'})`}
                                />
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-slate-500 flex-wrap">
                              <span className="px-1.5 py-0.2 rounded bg-slate-200/75 text-slate-700 font-semibold text-[10px]">
                                {ord.department}
                              </span>
                              <span>•</span>
                              <span className="inline-flex items-center gap-1 font-medium text-slate-600">
                                <Calendar className="w-3 h-3 text-slate-400" />
                                {formatDate(ord.dateRequested)}
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
                                setExpandedPROrderId(ord.id);
                                setOpenActionMenuPROrderId(isMenuOpen ? null : ord.id);
                              }}
                              className={`p-1.5 rounded-lg border transition cursor-pointer flex items-center justify-center ${
                                isMenuOpen
                                  ? 'bg-amber-600 text-white border-amber-600 ring-2 ring-amber-200'
                                  : 'bg-white hover:bg-slate-100 text-slate-600 border-slate-200'
                              }`}
                              title="Pilihan Opsi Form"
                              aria-label="Pilihan Opsi Form"
                              aria-expanded={isMenuOpen}
                            >
                              <SlidersHorizontal className="w-3.5 h-3.5" />
                            </button>

                            {isMenuOpen && (
                              <div
                                className="absolute right-0 top-full mt-1.5 w-72 bg-white rounded-2xl shadow-2xl border border-slate-200 py-2.5 z-40 animate-in fade-in zoom-in-95 duration-150 text-left"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="px-3.5 py-1.5 border-b border-slate-100 flex items-center justify-between mb-1.5">
                                  <div className="min-w-0 pr-2">
                                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                                      Opsi Form PR Outlet
                                    </span>
                                    <div className="text-xs font-bold text-slate-800 truncate">
                                      {ord.outletName} • {ord.department}
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setOpenActionMenuPROrderId(null)}
                                    className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer shrink-0"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>

                                <div className="px-1.5 space-y-1">
                                  {/* Opsi 1: Tampilkan di Preview Panel */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenActionMenuPROrderId(null);
                                      setExpandedPROrderId(ord.id);
                                    }}
                                    className="w-full flex items-start gap-2.5 p-2 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-200 transition group text-left cursor-pointer"
                                  >
                                    <div className="p-1.5 rounded-lg bg-slate-100 text-slate-700 group-hover:bg-amber-600 group-hover:text-white transition shrink-0 mt-0.5">
                                      <Eye className="w-3.5 h-3.5" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <span className="font-bold text-xs text-slate-900 group-hover:text-amber-700 block">
                                        Lihat Rincian di Preview Panel
                                      </span>
                                      <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                                        Tampilkan daftar SKU, item, dan kuantitas order pada panel kanan.
                                      </p>
                                    </div>
                                  </button>

                                  {/* Opsi 2: Tandai / Pilih untuk Generate PO */}
                                  {!isAlreadyGenerated && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenActionMenuPROrderId(null);
                                        toggleSelectOrder(ord.id);
                                      }}
                                      className="w-full flex items-start gap-2.5 p-2 rounded-xl hover:bg-purple-50/80 border border-transparent hover:border-purple-200 transition group text-left cursor-pointer"
                                    >
                                      <div className="p-1.5 rounded-lg bg-purple-100 text-purple-700 group-hover:bg-purple-600 group-hover:text-white transition shrink-0 mt-0.5">
                                        <FileCheck className="w-3.5 h-3.5" />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <span className="font-bold text-xs text-slate-900 group-hover:text-purple-700 block">
                                          {isSelected ? 'Batalkan Centang Pilihan' : 'Pilih untuk Generate PO'}
                                        </span>
                                        <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                                          Masukkan form PR Outlet ini ke antrean penerbitan Purchase Order.
                                        </p>
                                      </div>
                                    </button>
                                  )}

                                  {/* Opsi 3: Export Excel PR Outlet */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenActionMenuPROrderId(null);
                                      exportOutletOrderToExcel(ord);
                                    }}
                                    className="w-full flex items-start gap-2.5 p-2 rounded-xl hover:bg-emerald-50/80 border border-transparent hover:border-emerald-200 transition group text-left cursor-pointer"
                                  >
                                    <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white transition shrink-0 mt-0.5">
                                      <FileSpreadsheet className="w-3.5 h-3.5" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <span className="font-bold text-xs text-slate-900 group-hover:text-emerald-700 block">
                                        Export Excel Form PR (.xlsx)
                                      </span>
                                      <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                                        Unduh formulir permintaan outlet dalam format spreadsheet.
                                      </p>
                                    </div>
                                  </button>

                                  {/* Opsi 4: Hapus Form PR */}
                                  <div className="border-t border-slate-100 my-1 pt-1" />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenActionMenuPROrderId(null);
                                      setOrderToDelete(ord);
                                    }}
                                    className="w-full flex items-start gap-2.5 p-2 rounded-xl hover:bg-rose-50/80 border border-transparent hover:border-rose-200 transition group text-left cursor-pointer"
                                  >
                                    <div className="p-1.5 rounded-lg bg-rose-100 text-rose-700 group-hover:bg-rose-600 group-hover:text-white transition shrink-0 mt-0.5">
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <span className="font-bold text-xs text-rose-700 block">
                                        Hapus Form PR Outlet
                                      </span>
                                      <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                                        Hapus dokumen pesanan outlet ini secara permanen.
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

                {/* RIGHT PANEL: Preview Panel Rincian Form PR */}
                <div className="lg:col-span-8 bg-white flex flex-col">
                  {activePreviewPROrder ? (
                    <div className="flex flex-col h-full">
                      {/* Header Rincian Form */}
                      <div className="p-4 sm:p-5 bg-gradient-to-r from-amber-50/70 via-white to-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-bold text-xs bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-0.5 rounded-lg">
                              {activePreviewPROrder.id}
                            </span>
                            {!!activePreviewPROrder.poId || activePreviewPROrder.status === 'PO Generated' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                                Sudah di-generate ({activePreviewPROrder.poId || 'PO'})
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                Belum di-generate
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2.5">
                            <div className="w-10 h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                              <Store className="w-5 h-5" />
                            </div>
                            <div>
                              <h3 className="text-base font-black text-slate-900 leading-tight">
                                {activePreviewPROrder.outletName}
                              </h3>
                              <div className="flex items-center gap-2 text-xs text-slate-600 mt-0.5 flex-wrap">
                                <span className="font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                                  {activePreviewPROrder.department}
                                </span>
                                <span>•</span>
                                <span className="inline-flex items-center gap-1 font-medium">
                                  <Calendar className="w-3.5 h-3.5 text-amber-600" />
                                  Tgl Diminta: <strong>{formatDate(activePreviewPROrder.dateRequested)}</strong>
                                </span>
                                {activePreviewPROrder.picName && (
                                  <>
                                    <span>•</span>
                                    <span>PIC: <strong>{activePreviewPROrder.picName}</strong></span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Right Header Summary & Icon Actions */}
                        <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0">
                          <div className="text-left sm:text-right">
                            <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block">
                              Total Nilai Form PR
                            </span>
                            <span className="text-base font-black text-slate-900">
                              {formatRupiah(activePreviewPROrder.totalAmount)}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {!(!!activePreviewPROrder.poId || activePreviewPROrder.status === 'PO Generated') && (
                              <button
                                type="button"
                                onClick={() => toggleSelectOrder(activePreviewPROrder.id)}
                                className={`p-2 rounded-lg border transition cursor-pointer ${
                                  selectedOrderIds.includes(activePreviewPROrder.id)
                                    ? 'bg-amber-600 text-white border-amber-600'
                                    : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                                }`}
                                title={
                                  selectedOrderIds.includes(activePreviewPROrder.id)
                                    ? 'Batalkan Pilihan Generate PO'
                                    : 'Pilih Form Ini untuk Generate PO'
                                }
                              >
                                {selectedOrderIds.includes(activePreviewPROrder.id) ? (
                                  <CheckSquare className="w-4 h-4" />
                                ) : (
                                  <Square className="w-4 h-4" />
                                )}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => exportOutletOrderToExcel(activePreviewPROrder)}
                              className="p-2 rounded-lg bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white border border-emerald-200 transition cursor-pointer"
                              title="Export Excel Form PR (.xlsx)"
                            >
                              <FileSpreadsheet className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setOrderToDelete(activePreviewPROrder)}
                              className="p-2 rounded-lg bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-200 transition cursor-pointer"
                              title="Hapus Form PR Outlet"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Tabel Rincian Barang */}
                      <div className="p-4 flex-1 overflow-x-auto">
                        <div className="flex items-center justify-between mb-2.5">
                          <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                            <Package className="w-4 h-4 text-amber-600" />
                            Rincian Barang Dipesan ({activePreviewPROrder.items.length} jenis barang)
                          </h4>
                          {activePreviewPROrder.notes && (
                            <span className="text-[11px] text-slate-500 italic">
                              Catatan: "{activePreviewPROrder.notes}"
                            </span>
                          )}
                        </div>

                        <div className="rounded-xl border border-slate-200 overflow-hidden">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                              <tr>
                                <th className="px-3 py-2.5 w-10 text-center">No</th>
                                <th className="px-3 py-2.5">SKU</th>
                                <th className="px-3 py-2.5">Nama Barang</th>
                                <th className="px-3 py-2.5">Kategori</th>
                                <th className="px-3 py-2.5 text-right">Qty</th>
                                <th className="px-3 py-2.5 text-center">Satuan</th>
                                <th className="px-3 py-2.5 text-right">Harga</th>
                                <th className="px-3 py-2.5 text-right">Subtotal</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {activePreviewPROrder.items.map((it, idx) => {
                                const matchedInv = findInventoryItemBySku(
                                  it.sku,
                                  it.itemName,
                                  masterInventoryList
                                );
                                const resolvedCategory = matchedInv ? matchedInv.category : it.category;
                                const resolvedPrice = matchedInv
                                  ? matchedInv.priceBudget !== undefined && matchedInv.priceBudget > 0
                                    ? matchedInv.priceBudget
                                    : matchedInv.price ?? it.price
                                  : it.price;
                                const resolvedSubtotal = it.qty * resolvedPrice;

                                return (
                                  <tr
                                    key={`${activePreviewPROrder.id}-${it.sku}-${idx}`}
                                    className="hover:bg-slate-50/80"
                                  >
                                    <td className="px-3 py-2.5 text-center text-slate-400 font-semibold">
                                      {idx + 1}
                                    </td>
                                    <td className="px-3 py-2.5 font-mono font-bold text-slate-800">
                                      {matchedInv ? matchedInv.sku : it.sku}
                                    </td>
                                    <td className="px-3 py-2.5 font-medium text-slate-900">
                                      {it.itemName || matchedInv?.itemName}
                                    </td>
                                    <td className="px-3 py-2.5 text-slate-600">
                                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-medium">
                                        {resolvedCategory}
                                      </span>
                                    </td>
                                    <td className="px-3 py-2.5 text-right font-bold text-slate-900">
                                      {it.qty}
                                    </td>
                                    <td className="px-3 py-2.5 text-center text-slate-600">
                                      {it.unit || matchedInv?.unit}
                                    </td>
                                    <td className="px-3 py-2.5 text-right text-slate-600 font-medium">
                                      {formatRupiah(resolvedPrice)}
                                    </td>
                                    <td className="px-3 py-2.5 text-right font-bold text-slate-900">
                                      {formatRupiah(resolvedSubtotal)}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                            <tfoot className="bg-slate-50/90 border-t border-slate-200 font-bold text-slate-900">
                              <tr>
                                <td colSpan={4} className="px-3 py-2.5 text-right text-slate-600">
                                  Total Keseluruhan ({activePreviewPROrder.items.length} Item):
                                </td>
                                <td className="px-3 py-2.5 text-right text-amber-700">
                                  {activePreviewPROrder.items.reduce((s, i) => s + i.qty, 0)}
                                </td>
                                <td colSpan={2} />
                                <td className="px-3 py-2.5 text-right text-amber-700">
                                  {formatRupiah(
                                    activePreviewPROrder.items.reduce((s, it) => {
                                      const matchedInv = findInventoryItemBySku(
                                        it.sku,
                                        it.itemName,
                                        masterInventoryList
                                      );
                                      const resolvedPrice = matchedInv
                                        ? matchedInv.priceBudget !== undefined && matchedInv.priceBudget > 0
                                          ? matchedInv.priceBudget
                                          : matchedInv.price ?? it.price
                                        : it.price;
                                      return s + it.qty * resolvedPrice;
                                    }, 0)
                                  )}
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
                      <Eye className="w-8 h-8 text-slate-300 mb-2" />
                      <p className="text-xs font-semibold text-slate-600">
                        Pilih form PR di sebelah kiri untuk menampilkan rinciannya.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. Subtab: Purchase Order */}
      {activeSubTab === 'purchase-order' && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-900 flex items-start gap-2.5">
            <FileCheck className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <span className="font-bold">Daftar PO yang Berhasil Digenerate:</span>
              <p className="text-[11px] text-amber-800 mt-0.5">
                Setiap form PO memiliki penamaan <strong>PO-[Generated Date]</strong>. Form ini menggabungkan pesanan dari berbagai outlet. Anda dapat mencari item, memfilter kategori, mengubah kuantitas, serta <strong>Tambah</strong> atau <strong>Hapus</strong> item sebelum disubmit dengan tombol <strong>"Submit to Purchasing"</strong> ke laman <strong>Purchasing & Vendor</strong>.
              </p>
            </div>
          </div>

          {/* Table of PO Forms */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <FileCheck className="w-4 h-4 text-amber-600" />
                  Daftar Form Purchase Order ({purchaseOrders.length} Formulir)
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Klik pada baris form atau pilih opsi untuk menampilkan rincian barang, menambah item baru, atau menghapus item.
                </p>
              </div>
            </div>

            {/* Search & Filter Toolbar for PO */}
            <div className="p-3 bg-slate-50/90 border-b border-slate-200 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 text-xs">
              {/* Search Bar */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={poSearchQuery}
                  onChange={(e) => setPoSearchQuery(e.target.value)}
                  placeholder="Cari Nomor Form PO, Status, SKU, Nama Barang, atau Outlet..."
                  className="w-full pl-9 pr-8 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-hidden"
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
                {/* Filter Status PO */}
                <div className="flex items-center gap-1.5 bg-white border border-slate-300 px-2.5 py-1.5 rounded-lg shadow-2xs">
                  <Filter className="w-3.5 h-3.5 text-amber-600" />
                  <select
                    value={poStatusFilter}
                    onChange={(e) => setPoStatusFilter(e.target.value)}
                    className="text-xs text-slate-700 bg-transparent outline-hidden font-semibold cursor-pointer"
                  >
                    <option value="All">Semua Status PO</option>
                    <option value="Draft PO">Draft PO</option>
                    <option value="Submitted to Purchasing">Submitted to Purchasing</option>
                    <option value="Review Cost Control">Review Cost Control</option>
                    <option value="Approved by Cost Control">Approved by Cost Control</option>
                  </select>
                </div>

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
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg font-semibold transition shadow-2xs cursor-pointer"
                  title="Urutkan berdasarkan tanggal generate PO"
                >
                  <ArrowUpDown className="w-3.5 h-3.5 text-amber-600" />
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
                    : 'Tidak ada Purchase Order yang cocok dengan filter atau pencarian.'}
                </p>
                {purchaseOrders.length === 0 && (
                  <p className="text-xs text-slate-400 mt-1">
                    Kembali ke tab <strong>PR Outlet</strong> dan centang form order outlet untuk generate PO.
                  </p>
                )}
              </div>
            ) : (
              <>
                {openActionMenuPOId && (
                  <div
                    className="fixed inset-0 z-30 bg-transparent"
                    onClick={() => setOpenActionMenuPOId(null)}
                  />
                )}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100/70 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3">Nomor Form PO</th>
                        <th className="px-4 py-3">Tgl Generate</th>
                        <th className="px-4 py-3 text-center">Jumlah Item</th>
                        <th className="px-4 py-3 text-center">Status</th>
                        <th className="px-4 py-3 text-center">Aksi Form PO</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredAndSortedPOs.map((po) => {
                        const isSelected = selectedPOId === po.id;
                        const isSubmittedToPurchasing = po.status !== 'Draft PO';
                        const isMenuOpen = openActionMenuPOId === po.id;

                        // Unique places for item filter inside this PO
                        const uniquePlaces = Array.from(
                          new Set(po.items.map((it) => it.place).filter(Boolean))
                        );

                        // Filtered items inside this PO
                        const filteredPOItems = po.items.filter((it) => {
                          const q = poItemSearchQuery.toLowerCase().trim();
                          const matchSearch =
                            q === '' ||
                            it.sku.toLowerCase().includes(q) ||
                            it.itemName.toLowerCase().includes(q) ||
                            it.category.toLowerCase().includes(q) ||
                            (it.place && it.place.toLowerCase().includes(q));
                          const matchCategory =
                            poItemCategoryFilter === 'All' || it.category === poItemCategoryFilter;
                          const matchPlace =
                            poItemPlaceFilter === 'All' || it.place === poItemPlaceFilter;
                          return matchSearch && matchCategory && matchPlace;
                        });

                        // Rejected items inside this PO
                        const rejectedPOItems = po.items.filter(
                          (it) => it.status === 'Rejected' || it.approvalStatus === 'Rejected'
                        );

                        return (
                          <React.Fragment key={po.id}>
                            <tr
                              onClick={() => setSelectedPOId(isSelected ? null : po.id)}
                              className={`hover:bg-amber-50/50 transition cursor-pointer ${
                                isSelected ? 'bg-amber-100/60 font-medium border-l-4 border-l-amber-600' : ''
                              }`}
                            >
                              <td className="px-4 py-3 font-mono font-bold text-slate-900">
                                <div className="flex flex-col gap-1">
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-100 text-amber-900 border border-amber-200 font-bold w-fit">
                                    {po.id}
                                  </span>
                                  {rejectedPOItems.length > 0 && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 border border-rose-300 text-[10px] font-sans font-bold w-fit">
                                      <Ban className="w-3 h-3 text-rose-600 shrink-0" />
                                      {rejectedPOItems.length} Barang Ditolak Purchasing
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-slate-700 font-medium">
                                {formatDate(po.generatedDate)}
                              </td>
                              <td className="px-4 py-3 text-center font-bold text-slate-800">
                                <div className="flex flex-col items-center gap-1">
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 text-[11px]">
                                    <Package className="w-3 h-3 text-amber-600" />
                                    {po.items.length} Item
                                  </span>
                                  {rejectedPOItems.length > 0 && (
                                    <span className="text-[10px] font-bold text-rose-700">
                                      ({rejectedPOItems.length} Ditolak)
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <div className="flex flex-col items-center gap-1">
                                  <span
                                    className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                      po.status === 'Draft PO'
                                        ? 'bg-slate-100 text-slate-800 border border-slate-300'
                                        : po.status === 'Submitted to Purchasing'
                                        ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                        : po.status === 'Review Cost Control'
                                        ? 'bg-purple-100 text-purple-900 border border-purple-300'
                                        : po.status === 'Approved by Cost Control'
                                        ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                        : 'bg-indigo-100 text-indigo-900 border border-indigo-200'
                                    }`}
                                  >
                                    {po.status}
                                  </span>
                                  {rejectedPOItems.length > 0 && (
                                    <span className="text-[10px] text-rose-700 font-semibold max-w-[200px] truncate" title={rejectedPOItems.map((r) => `${r.itemName}: ${r.rejectionReason || 'Ditolak Purchasing'}`).join(' | ')}>
                                      Ket: {rejectedPOItems.map((r) => `${r.itemName} (${r.rejectionReason || 'Ditolak Purchasing'})`).join(', ')}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-center relative" onClick={(e) => e.stopPropagation()}>
                                <div className="relative inline-block text-left">
                                  <button
                                    type="button"
                                    onClick={() => setOpenActionMenuPOId(isMenuOpen ? null : po.id)}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-2xs border cursor-pointer ${
                                      isMenuOpen
                                        ? 'bg-amber-600 text-white border-amber-600 ring-2 ring-amber-200'
                                        : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-300'
                                    }`}
                                    title="Buka opsi pilihan fungsi form PO ini"
                                    aria-expanded={isMenuOpen}
                                  >
                                    <SlidersHorizontal className={`w-3.5 h-3.5 ${isMenuOpen ? 'text-white' : 'text-amber-600'}`} />
                                    <span>Pilihan Opsi Form</span>
                                    <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isMenuOpen ? 'rotate-180 text-white' : 'text-slate-400'}`} />
                                  </button>

                                  {isMenuOpen && (
                                    <div
                                      className="absolute right-0 top-full mt-1.5 w-80 sm:w-88 bg-white rounded-2xl shadow-2xl border border-slate-200 py-2.5 z-40 animate-in fade-in zoom-in-95 duration-150 text-left"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <div className="px-3.5 py-1.5 border-b border-slate-100 flex items-center justify-between mb-1.5">
                                        <div>
                                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                                            List Opsi Form PO
                                          </span>
                                          <div className="text-xs font-bold text-slate-800">
                                            {po.id} • {formatDate(po.generatedDate)}
                                          </div>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => setOpenActionMenuPOId(null)}
                                          className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                                        >
                                          <X className="w-3.5 h-3.5" />
                                        </button>
                                      </div>

                                      <div className="px-1.5 space-y-1 max-h-[380px] overflow-y-auto">
                                        {/* Opsi 1: Lihat / Tutup List Barang Form PO */}
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setOpenActionMenuPOId(null);
                                            setSelectedPOId(isSelected ? null : po.id);
                                          }}
                                          className="w-full flex items-start gap-2.5 p-2 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-200 transition group text-left cursor-pointer"
                                        >
                                          <div className="p-1.5 rounded-lg bg-slate-100 text-slate-700 group-hover:bg-amber-600 group-hover:text-white transition shrink-0 mt-0.5">
                                            {isSelected ? <ChevronUp className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <span className="font-bold text-xs text-slate-900 group-hover:text-amber-700 block">
                                              {isSelected ? 'Tutup Rincian List Barang' : 'Lihat Rincian List Barang'}
                                            </span>
                                            <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                                              Fungsi: {isSelected ? 'Sembunyikan tabel rincian item.' : 'Tampilkan daftar rincian SKU, nama barang, kategori, dan kuantitas PO.'}
                                            </p>
                                          </div>
                                        </button>

                                        {/* Opsi 2: Tambah Item ke PO */}
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setOpenActionMenuPOId(null);
                                            setSelectedPOId(po.id);
                                            handleOpenAddPOItemModal(po);
                                          }}
                                          className="w-full flex items-start gap-2.5 p-2 rounded-xl hover:bg-amber-50/80 border border-transparent hover:border-amber-200 transition group text-left cursor-pointer"
                                        >
                                          <div className="p-1.5 rounded-lg bg-amber-100 text-amber-700 group-hover:bg-amber-600 group-hover:text-white transition shrink-0 mt-0.5">
                                            <Plus className="w-3.5 h-3.5" />
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <span className="font-bold text-xs text-slate-900 group-hover:text-amber-700 block">
                                              Tambah Item ke Form PO
                                            </span>
                                            <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                                              Fungsi: Tambahkan barang baru dari Master Inventory ke dalam dokumen PO ini.
                                            </p>
                                          </div>
                                        </button>

                                        {/* Opsi Tambahan: Lepas Semua Merge Multi-Outlet */}
                                        {po.items.some(
                                          (it) =>
                                            it.isMerged ||
                                            (it.outletBreakdowns && it.outletBreakdowns.length > 1)
                                        ) && (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setOpenActionMenuPOId(null);
                                              setSelectedPOId(po.id);
                                              handleUnmergeAllPOItems(po.id);
                                            }}
                                            className="w-full flex items-start gap-2.5 p-2 rounded-xl hover:bg-indigo-50/80 border border-transparent hover:border-indigo-200 transition group text-left cursor-pointer"
                                          >
                                            <div className="p-1.5 rounded-lg bg-indigo-100 text-indigo-700 group-hover:bg-indigo-600 group-hover:text-white transition shrink-0 mt-0.5">
                                              <Layers className="w-3.5 h-3.5" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                              <span className="font-bold text-xs text-slate-900 group-hover:text-indigo-700 block">
                                                Lepas Merge Multi-Outlet
                                              </span>
                                              <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                                                Fungsi: Pisahkan seluruh item gabungan multi-outlet menjadi baris terpisah per masing-masing outlet.
                                              </p>
                                            </div>
                                          </button>
                                        )}

                                        {/* Opsi 3: Submit PO ke Tim Purchasing */}
                                        {!isSubmittedToPurchasing ? (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setOpenActionMenuPOId(null);
                                              handleSubmitPOToPurchasing(po.id);
                                            }}
                                            className="w-full flex items-start gap-2.5 p-2 rounded-xl hover:bg-amber-50/80 border border-transparent hover:border-amber-200 transition group text-left cursor-pointer"
                                          >
                                            <div className="p-1.5 rounded-lg bg-amber-100 text-amber-700 group-hover:bg-amber-600 group-hover:text-white transition shrink-0 mt-0.5">
                                              <Send className="w-3.5 h-3.5" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                              <div className="flex items-center gap-1.5">
                                                <span className="font-bold text-xs text-slate-900 group-hover:text-amber-700">
                                                  Submit PO ke Tim Purchasing
                                                </span>
                                                <span className="text-[10px] font-bold px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded">
                                                  Workflow
                                                </span>
                                              </div>
                                              <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                                                Fungsi: Kirim dokumen PO ini ke tim Purchasing untuk negosiasi vendor dan persetujuan.
                                              </p>
                                            </div>
                                          </button>
                                        ) : (
                                          <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200/80 flex items-center gap-2 text-xs text-amber-800 font-semibold">
                                            <Check className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                            <span>PO sudah disubmit ke tim Purchasing.</span>
                                          </div>
                                        )}

                                        {/* Opsi 4: Export Dokumen Excel */}
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setOpenActionMenuPOId(null);
                                            exportPOToExcel(po);
                                          }}
                                          className="w-full flex items-start gap-2.5 p-2 rounded-xl hover:bg-emerald-50/80 border border-transparent hover:border-emerald-200 transition group text-left cursor-pointer"
                                        >
                                          <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white transition shrink-0 mt-0.5">
                                            <FileSpreadsheet className="w-3.5 h-3.5" />
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <span className="font-bold text-xs text-slate-900 group-hover:text-emerald-700 block">
                                              Export Dokumen PO ke Excel (.xlsx)
                                            </span>
                                            <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                                              Fungsi: Unduh formulir Purchase Order dalam file spreadsheet resmi.
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
                            <tr className="bg-amber-50/30 border-b-2 border-amber-400">
                              <td colSpan={5} className="p-3 sm:p-4">
                                <div className="bg-white rounded-xl border-2 border-amber-400 shadow-sm overflow-hidden animate-in fade-in duration-200">
                                  {/* Subheader rincian */}
                                  <div className="p-3.5 bg-gradient-to-r from-amber-50 to-orange-50/40 border-b border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div>
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-mono font-extrabold text-xs bg-amber-600 text-white px-2.5 py-1 rounded-lg shadow-2xs">
                                          {po.id}
                                        </span>
                                        <h4 className="font-bold text-sm text-slate-900">
                                          Rincian List Barang Form {po.id}
                                        </h4>
                                        <span
                                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                            po.status === 'Draft PO'
                                              ? 'bg-slate-200 text-slate-800'
                                              : po.status === 'Submitted to Purchasing'
                                              ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                              : po.status === 'Review Cost Control'
                                              ? 'bg-purple-100 text-purple-900 border border-purple-300'
                                              : po.status === 'Approved by Cost Control'
                                              ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                              : 'bg-indigo-100 text-indigo-900 border border-indigo-200'
                                          }`}
                                        >
                                          {po.status}
                                        </span>
                                      </div>
                                      <div className="text-[11px] text-slate-600 mt-1 flex flex-wrap gap-2">
                                        <span>Tgl Generate: <strong>{formatDate(po.generatedDate)}</strong></span>
                                        <span>•</span>
                                        <span>Total Item: <strong>{po.items.length} Barang</strong></span>
                                        <span>•</span>
                                        <span className="text-amber-700 font-semibold">Qty merupakan field bebas</span>
                                      </div>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-1.5 self-start sm:self-auto">
                                      {po.items.some(
                                        (it) =>
                                          it.isMerged ||
                                          (it.outletBreakdowns && it.outletBreakdowns.length > 1)
                                      ) && (
                                        <button
                                          type="button"
                                          onClick={() => handleUnmergeAllPOItems(po.id)}
                                          className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer"
                                          title="Pisahkan semua item gabungan multi-outlet menjadi baris per-outlet"
                                        >
                                          <Layers className="w-3.5 h-3.5" />
                                          Lepas Merge Multi-Outlet
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => handleOpenAddPOItemModal(po)}
                                        className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer"
                                        title="Tambah item barang baru ke PO ini"
                                      >
                                        <Plus className="w-3.5 h-3.5" />
                                        Tambah Item
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => exportPOToExcel(po)}
                                        className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold shadow-2xs cursor-pointer"
                                        title="Export PO ke Excel"
                                      >
                                        <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                                        Excel
                                      </button>
                                      {!isSubmittedToPurchasing ? (
                                        <button
                                          type="button"
                                          onClick={() => handleSubmitPOToPurchasing(po.id)}
                                          className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer"
                                          title="Submit to Purchasing"
                                        >
                                          <Send className="w-3.5 h-3.5" />
                                          Submit to Purchasing
                                        </button>
                                      ) : (
                                        <span
                                          className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-bold"
                                          title="PO telah disubmit ke Purchasing"
                                        >
                                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                                          Tersubmit ke Purchasing
                                        </span>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => setSelectedPOId(null)}
                                        className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition cursor-pointer"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                        Tutup List
                                      </button>
                                    </div>
                                  </div>

                                  {/* Keterangan Barang Ditolak oleh Purchasing */}
                                  {rejectedPOItems.length > 0 && (
                                    <div className="mx-3.5 mt-3 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 space-y-1.5">
                                      <div className="font-bold flex items-center gap-1.5 text-rose-800">
                                        <Ban className="w-4 h-4 text-rose-600 shrink-0" />
                                        <span>
                                          Keterangan Penolakan Barang dari Purchasing ({rejectedPOItems.length} Barang Ditolak):
                                        </span>
                                      </div>
                                      <div className="space-y-1 pl-5">
                                        {rejectedPOItems.map((rej, rIdx) => (
                                          <div
                                            key={`${rej.sku}-${rIdx}`}
                                            className="flex flex-wrap items-center gap-1.5 text-[11px] bg-white/90 px-2.5 py-1 rounded-lg border border-rose-200"
                                          >
                                            <span className="font-mono font-bold text-rose-800">[{rej.sku}]</span>
                                            <span className="font-bold text-slate-900">{rej.itemName}</span>
                                            <span className="text-slate-500">({rej.qty} {rej.unit} • {rej.place || '-'})</span>
                                            <span className="text-rose-700 font-semibold">
                                              — Alasan Ditolak: "{rej.rejectionReason || 'Stok vendor kosong / ditolak oleh Purchasing'}"
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Search & Filter Toolbar for Items inside Selected PO */}
                                  <div
                                    className="p-3 bg-slate-50 border-b border-slate-200 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2.5 text-xs"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {/* Search Item Input */}
                                    <div className="relative flex-1">
                                      <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                      <input
                                        type="text"
                                        value={poItemSearchQuery}
                                        onChange={(e) => setPoItemSearchQuery(e.target.value)}
                                        placeholder="Cari SKU, Nama Barang, Kategori, atau Alokasi Outlet..."
                                        className="w-full pl-8 pr-8 py-1.5 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-hidden"
                                      />
                                      {poItemSearchQuery && (
                                        <button
                                          type="button"
                                          onClick={() => setPoItemSearchQuery('')}
                                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                        >
                                          <X className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </div>

                                    {/* Filter Category & Place */}
                                    <div className="flex flex-wrap items-center gap-2">
                                      <div className="flex items-center gap-1.5 bg-white border border-slate-300 px-2.5 py-1.5 rounded-lg shadow-2xs">
                                        <Filter className="w-3.5 h-3.5 text-amber-600" />
                                        <select
                                          value={poItemCategoryFilter}
                                          onChange={(e) => setPoItemCategoryFilter(e.target.value)}
                                          className="text-xs text-slate-700 bg-transparent outline-hidden font-semibold cursor-pointer"
                                        >
                                          <option value="All">Semua Kategori</option>
                                          {ITEM_CATEGORIES.map((cat) => (
                                            <option key={cat} value={cat}>
                                              {cat}
                                            </option>
                                          ))}
                                        </select>
                                      </div>

                                      <div className="flex items-center gap-1.5 bg-white border border-slate-300 px-2.5 py-1.5 rounded-lg shadow-2xs">
                                        <Store className="w-3.5 h-3.5 text-slate-500" />
                                        <select
                                          value={poItemPlaceFilter}
                                          onChange={(e) => setPoItemPlaceFilter(e.target.value)}
                                          className="text-xs text-slate-700 bg-transparent outline-hidden font-semibold cursor-pointer max-w-[180px] truncate"
                                        >
                                          <option value="All">Semua Alokasi Outlet</option>
                                          {uniquePlaces.map((pl) => (
                                            <option key={pl} value={pl}>
                                              {pl}
                                            </option>
                                          ))}
                                        </select>
                                      </div>

                                      {(poItemSearchQuery ||
                                        poItemCategoryFilter !== 'All' ||
                                        poItemPlaceFilter !== 'All') && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setPoItemSearchQuery('');
                                            setPoItemCategoryFilter('All');
                                            setPoItemPlaceFilter('All');
                                          }}
                                          className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-[11px] font-bold transition cursor-pointer"
                                        >
                                          Reset Filter
                                        </button>
                                      )}
                                    </div>
                                  </div>

                                  {/* PO Items Table (Tanpa Harga Satuan & Total, dengan Tombol Hapus Item) */}
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs">
                                      <thead className="bg-slate-100/70 text-slate-600 font-bold border-b border-slate-200">
                                        <tr>
                                          <th className="px-3 py-2.5">SKU</th>
                                          <th className="px-3 py-2.5">Item Name</th>
                                          <th className="px-3 py-2.5">Category</th>
                                          <th className="px-3 py-2.5 text-center min-w-[105px]">Qty (Field Bebas)</th>
                                          <th className="px-3 py-2.5 text-center">Unit</th>
                                          <th className="px-3 py-2.5">Alokasi Outlet & Keterangan Order</th>
                                          <th className="px-3 py-2.5 text-center">Aksi</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100">
                                        {filteredPOItems.length === 0 ? (
                                          <tr>
                                            <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                                              {po.items.length === 0
                                                ? 'Belum ada item pada PO ini. Klik tombol "Tambah Item" untuk menambahkan barang.'
                                                : 'Tidak ada item yang sesuai dengan pencarian atau filter kategori/outlet.'}
                                            </td>
                                          </tr>
                                        ) : (
                                          filteredPOItems.map((it, idx) => {
                                            const isItemRejected =
                                              it.status === 'Rejected' || it.approvalStatus === 'Rejected';
                                            return (
                                              <tr
                                                key={`${it.sku}-${idx}`}
                                                className={`hover:bg-slate-50 ${
                                                  isItemRejected ? 'bg-rose-50/60' : ''
                                                }`}
                                              >
                                                <td className="px-3 py-2 font-mono font-bold text-slate-800">
                                                  {it.sku}
                                                </td>
                                                <td className="px-3 py-2 font-medium text-slate-900">
                                                  <div className="flex flex-col gap-1">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                      <span className={isItemRejected ? 'line-through text-rose-700 font-semibold' : ''}>
                                                        {it.itemName}
                                                      </span>
                                                      {it.isMerged && (
                                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-700 border border-indigo-200 shadow-2xs">
                                                          <Layers className="w-3 h-3 text-indigo-600" />
                                                          Merge Multi-Outlet
                                                        </span>
                                                      )}
                                                      {isItemRejected && (
                                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300 shadow-2xs">
                                                          <Ban className="w-3 h-3 text-rose-600" />
                                                          Ditolak Purchasing
                                                        </span>
                                                      )}
                                                    </div>
                                                    {isItemRejected && (
                                                      <div className="text-[11px] font-semibold text-rose-700 bg-rose-100/70 border border-rose-200 px-2 py-0.5 rounded-md w-fit">
                                                        Keterangan Penolakan: "{it.rejectionReason || 'Stok vendor kosong / ditolak oleh Purchasing'}"
                                                      </div>
                                                    )}
                                                  </div>
                                                </td>
                                                <td className="px-3 py-2 text-slate-600">{it.category}</td>

                                                {/* Qty (Field Bebas) */}
                                                <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                                                  {isSubmittedToPurchasing || isItemRejected ? (
                                                    <span className={`font-bold text-slate-900 ${it.isMerged ? 'text-indigo-700 font-black' : ''} ${isItemRejected ? 'line-through text-rose-700' : ''}`}>
                                                      {it.qty}
                                                    </span>
                                                  ) : (
                                                    <div className="flex items-center justify-center">
                                                      <input
                                                        type="number"
                                                        min="0"
                                                        value={it.qty === 0 ? '' : it.qty}
                                                        onChange={(e) => {
                                                          const val = e.target.value === '' ? 0 : Math.max(0, parseInt(e.target.value) || 0);
                                                          handleDirectUpdatePOItemQty(po.id, it.sku, it.place, val);
                                                        }}
                                                        placeholder="0"
                                                        className="w-20 px-2 py-1 text-center font-bold text-slate-900 bg-white border border-slate-300 hover:border-amber-400 focus:border-amber-600 focus:ring-2 focus:ring-amber-100 rounded-lg text-xs outline-hidden shadow-2xs transition"
                                                        title="Ubah Qty bebas langsung di tabel"
                                                      />
                                                    </div>
                                                  )}
                                                </td>

                                                <td className="px-3 py-2 text-center text-slate-600 font-medium">{it.unit}</td>

                                                <td className="px-3 py-2 text-slate-700">
                                                  {it.isMerged || (it.outletBreakdowns && it.outletBreakdowns.length > 1) ? (
                                                    <div className="space-y-1 py-0.5">
                                                      <div className="flex items-center justify-between gap-2 flex-wrap">
                                                        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                                                          Rincian Pesanan ({it.outletBreakdowns?.length || 2} Outlet):
                                                        </span>
                                                        <button
                                                          type="button"
                                                          onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleUnmergePOItem(po.id, it.sku, it.place);
                                                          }}
                                                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs transition cursor-pointer"
                                                          title="Lepas merge item ini menjadi baris terpisah per masing-masing outlet"
                                                        >
                                                          <Layers className="w-2.5 h-2.5" />
                                                          <span>Lepas Merge</span>
                                                        </button>
                                                      </div>
                                                      <div className="flex flex-col gap-1 text-[11px]">
                                                        {it.outletBreakdowns?.map((bd, bIdx) => (
                                                          <div
                                                            key={bIdx}
                                                            className="flex items-center gap-1.5 bg-slate-50 px-2 py-0.5 rounded border border-slate-200"
                                                          >
                                                            <span className="font-semibold text-slate-900">{bd.outletName}</span>:
                                                            <span className="font-bold text-indigo-700">{bd.qty} {bd.unit}</span>
                                                          </div>
                                                        )) || (
                                                          <span className="text-slate-700 font-medium">{it.place}</span>
                                                        )}
                                                      </div>
                                                    </div>
                                                  ) : (
                                                    <div>
                                                      <span className="font-medium text-slate-800">{it.place}</span>
                                                      {it.outletBreakdownText && it.place !== it.outletBreakdownText && (
                                                        <span className="block text-[11px] text-slate-500">
                                                          {it.outletBreakdownText}
                                                        </span>
                                                      )}
                                                    </div>
                                                  )}
                                                  {isItemRejected && (
                                                    <div className="mt-1 text-[11px] font-bold text-rose-700 flex items-center gap-1">
                                                      <Ban className="w-3 h-3 text-rose-600 shrink-0" />
                                                      <span>Ditolak Purchasing: {it.rejectionReason || 'Stok vendor kosong'}</span>
                                                    </div>
                                                  )}
                                                </td>
                                                <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                                                  <div className="inline-flex items-center justify-center gap-1.5 flex-wrap">
                                                    {(it.isMerged || (it.outletBreakdowns && it.outletBreakdowns.length > 1)) && (
                                                      <button
                                                        type="button"
                                                        onClick={() => handleUnmergePOItem(po.id, it.sku, it.place)}
                                                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-[11px] font-bold transition cursor-pointer"
                                                        title="Lepas merge multi-outlet untuk item ini"
                                                      >
                                                        <Layers className="w-3.5 h-3.5" />
                                                        <span>Lepas Merge</span>
                                                      </button>
                                                    )}
                                                    <button
                                                      type="button"
                                                      onClick={() => handleDeletePOItem(it.sku, it.place, po.id)}
                                                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-[11px] font-bold transition cursor-pointer"
                                                      title="Hapus item ini dari PO"
                                                    >
                                                      <Trash2 className="w-3.5 h-3.5" />
                                                      <span>Hapus</span>
                                                    </button>
                                                  </div>
                                                </td>
                                              </tr>
                                            );
                                          })
                                        )}
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

      {/* Modal: Tambah Item ke PO */}
      {showAddPOItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <form
            onSubmit={handleAddPOItem}
            className="bg-white rounded-2xl shadow-xl max-w-md w-full border border-slate-200 p-6 space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-sm text-slate-900">Tambah Barang ke PO</h3>
                {(targetPOForAddItem || selectedPO) && (
                  <span className="text-[11px] text-slate-500">
                    Formulir: <strong>{targetPOForAddItem?.id || selectedPO?.id}</strong>
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAddPOItemModal(false);
                  setTargetPOForAddItem(null);
                }}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {/* Field Pencarian Barang */}
              <div className="relative">
                <label className="block font-semibold text-slate-700 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Search className="w-3.5 h-3.5 text-amber-600" />
                    Pencarian Barang
                  </span>
                  {selectedAddInventoryItem && (
                    <span className="text-[10px] text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                      Terpilih: {selectedAddInventoryItem.sku}
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
                      selectedAddInventoryItem
                        ? `Cari barang lain (saat ini: [${selectedAddInventoryItem.sku}] ${selectedAddInventoryItem.itemName})...`
                        : 'Ketik SKU, Nama Barang, atau Kategori...'
                    }
                    className="w-full pl-9 pr-8 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-hidden"
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

                {/* Dropdown Hasil Pencarian Barang */}
                {isAddItemDropdownOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-300 rounded-xl shadow-xl z-30 max-h-48 overflow-y-auto divide-y divide-slate-100">
                    {filteredAddSearchItems.length === 0 ? (
                      <div className="p-3 text-center text-slate-400 text-xs">
                        Tidak ada barang yang cocok dengan "{addItemSearchQuery}".
                      </div>
                    ) : (
                      filteredAddSearchItems.map((inv) => (
                        <div
                          key={inv.sku}
                          onClick={() => handleSelectAddPOItem(inv)}
                          className={`p-2.5 hover:bg-amber-50 cursor-pointer transition flex items-center justify-between text-xs ${
                            inv.sku === newItemSku
                              ? 'bg-amber-50/80 font-bold text-amber-900'
                              : 'text-slate-700'
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-[11px] font-bold text-amber-700 bg-amber-100/70 px-1.5 py-0.5 rounded">
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
                            <Check className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Info Barang Terpilih */}
                {selectedAddInventoryItem && (
                  <div className="mt-2 p-2.5 bg-amber-50/60 border border-amber-200 rounded-xl flex items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-[11px] bg-amber-600 text-white px-1.5 py-0.5 rounded">
                          {selectedAddInventoryItem.sku}
                        </span>
                        <span className="font-bold text-slate-900">
                          {selectedAddInventoryItem.itemName}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-600 mt-0.5">
                        Kategori: <strong>{newItemCategory}</strong> • Unit: <strong>{newItemUnit}</strong>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsAddItemDropdownOpen((prev) => !prev)}
                      className="px-2 py-1 text-[11px] font-bold bg-white text-amber-800 border border-amber-300 rounded-lg hover:bg-amber-100 transition cursor-pointer shrink-0"
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
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 font-medium text-slate-800 focus:ring-2 focus:ring-amber-500 outline-hidden"
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
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 font-semibold text-slate-800 focus:ring-2 focus:ring-amber-500 outline-hidden"
                  />
                </div>
              </div>

              {/* Jumlah (Qty) */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Jumlah (Qty)</label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    required
                    value={newItemQty}
                    onChange={(e) => setNewItemQty(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold text-sm focus:ring-2 focus:ring-amber-500 outline-hidden"
                  />
                  {newItemUnit && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500 pointer-events-none">
                      {newItemUnit}
                    </span>
                  )}
                </div>
              </div>

              {/* Kolom Alasan Penambahan Barang */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Alasan Penambahan Barang
                </label>
                <input
                  type="text"
                  required
                  value={newItemReason}
                  onChange={(e) => setNewItemReason(e.target.value)}
                  placeholder="Masukkan alasan penambahan barang..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-800 focus:ring-2 focus:ring-amber-500 outline-hidden"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowAddPOItemModal(false);
                  setTargetPOForAddItem(null);
                  setIsAddItemDropdownOpen(false);
                }}
                className="px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-xs cursor-pointer"
              >
                Tambahkan
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Edit Qty & Harga Item PO */}
      {editingPOItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-900">
                Ubah Item: {editingPOItem.itemName}
              </h3>
              <button
                onClick={() => setEditingPOItem(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Qty ({editingPOItem.unit})
                </label>
                <input
                  type="number"
                  min="1"
                  value={editItemQty}
                  onChange={(e) => setEditItemQty(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full text-center py-2 border border-slate-300 rounded-lg font-bold text-sm focus:ring-2 focus:ring-amber-500 outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Harga Satuan (IDR)
                </label>
                <input
                  type="number"
                  min="0"
                  value={editItemPrice}
                  onChange={(e) => setEditItemPrice(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full text-right py-2 border border-slate-300 rounded-lg font-bold text-sm focus:ring-2 focus:ring-amber-500 outline-hidden"
                />
              </div>

              <div className="flex justify-between font-bold text-slate-900 pt-1">
                <span>Total Baru:</span>
                <span className="text-amber-600">{formatRupiah(editItemQty * editItemPrice)}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setEditingPOItem(null)}
                className="px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Batal
              </button>
              <button
                onClick={handleSaveEditPOItem}
                className="px-4 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-xs"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus Form PR Outlet (Single atau Bulk) */}
      {(orderToDelete || ordersToBulkDelete.length > 0) && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-100">
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <div className="p-2.5 bg-rose-100 rounded-xl">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {ordersToBulkDelete.length > 0
                    ? `Hapus ${ordersToBulkDelete.length} Form PR Outlet?`
                    : 'Hapus Form PR Outlet?'}
                </h3>
                <p className="text-xs text-slate-500">
                  Tindakan ini akan menghapus form pesanan dari sistem
                </p>
              </div>
            </div>

            {ordersToBulkDelete.length > 0 ? (
              <div className="bg-slate-50 rounded-xl p-3.5 mb-4 text-xs space-y-2 border border-slate-200 max-h-48 overflow-y-auto">
                <div className="flex justify-between font-semibold text-slate-700 pb-1 border-b border-slate-200">
                  <span>Daftar Form Terpilih:</span>
                  <span className="text-rose-600">{ordersToBulkDelete.length} Form</span>
                </div>
                {ordersToBulkDelete.map((ord) => (
                  <div key={ord.id} className="flex items-center justify-between py-1 border-b border-slate-100 last:border-0">
                    <div>
                      <span className="font-bold text-slate-900 block">{ord.outletName} • {ord.department}</span>
                      <span className="text-[10px] text-slate-500 font-mono">{ord.id}</span>
                    </div>
                    <span className="font-semibold text-slate-700">{formatDate(ord.dateRequested)}</span>
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
                  <span className="text-slate-500">Outlet &amp; Dept:</span>
                  <span className="font-semibold text-slate-800">{orderToDelete.outletName} • {orderToDelete.department}</span>
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

            <div className="flex justify-end gap-2.5">
              <button
                onClick={() => {
                  setOrderToDelete(null);
                  setOrdersToBulkDelete([]);
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmDeleteOrder}
                className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {ordersToBulkDelete.length > 0
                  ? `Ya, Hapus ${ordersToBulkDelete.length} Form`
                  : 'Ya, Hapus Form'}
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
                    Upload file Excel formulir PR untuk langsung diteruskan ke PR Outlet dan Outbond Deployment.
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
                    <li><strong>Kolom Kategori Otomatis</strong>: Terisi sesuai kode <strong>SKU</strong> yang terisi pada <strong>Master Inventory (Category)</strong>.</li>
                    <li><strong>Kolom Harga Otomatis</strong>: Terisi sesuai kode <strong>SKU</strong> yang terisi pada <strong>Master Inventory (Price Budget)</strong>.</li>
                    <li><strong>Purchase Request &gt; PR Outlet &amp; Outbond Deployment</strong>: Form PR langsung aktif untuk proses Generate PO dan pengiriman logistik.</li>
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
                      Format: <strong>TANGGAL(DD/MM/YYYY), NAMA OUTLET, DEPARTMENT, SKU, NAMA BARANG, JUMLAH DIPESAN, SATUAN</strong>. Kategori &amp; Harga (Price Budget) otomatis mengikuti SKU Master Inventory.
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

                          {/* Table of items inside this PR */}
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-[11px]">
                              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-100">
                                <tr>
                                  <th className="px-2.5 py-1.5">SKU</th>
                                  <th className="px-2.5 py-1.5">Nama Barang</th>
                                  <th className="px-2.5 py-1.5">Kategori (Master: Category)</th>
                                  <th className="px-2.5 py-1.5 text-right">Jumlah Dipesan</th>
                                  <th className="px-2.5 py-1.5 text-right">Harga (Master: Price Budget)</th>
                                  <th className="px-2.5 py-1.5 text-right">Subtotal</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {ord.items.map((it, idx) => (
                                  <tr key={`${it.sku}-${idx}`} className="hover:bg-slate-50/50">
                                    <td className="px-2.5 py-1.5 font-mono font-bold text-slate-800">{it.sku}</td>
                                    <td className="px-2.5 py-1.5 font-medium text-slate-900">{it.itemName}</td>
                                    <td className="px-2.5 py-1.5">
                                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold text-[10px]">
                                        {it.category}
                                      </span>
                                    </td>
                                    <td className="px-2.5 py-1.5 text-right font-bold text-blue-700">
                                      {it.qty} {it.unit}
                                    </td>
                                    <td className="px-2.5 py-1.5 text-right font-semibold text-slate-700">
                                      {formatRupiah(it.price)}
                                    </td>
                                    <td className="px-2.5 py-1.5 text-right font-bold text-slate-900">
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
                            <th className="px-2.5 py-2">Kategori (Category)</th>
                            <th className="px-2.5 py-2 text-right">Harga (Price Budget)</th>
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
                                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-semibold text-[10px]">
                                  {r.category}
                                </span>
                              </td>
                              <td className="px-2.5 py-1.5 text-right font-semibold text-slate-800">
                                {formatRupiah(r.price)}
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
                      id="overwritePRCheckbox"
                      checked={uploadPROverwrite}
                      onChange={(e) => setUploadPROverwrite(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <label htmlFor="overwritePRCheckbox" className="text-xs text-slate-700 cursor-pointer font-medium">
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
