import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { OUTLETS, DEPARTMENTS } from '../../data/mockData';
import { DepartmentName, ItemCategory, ITEM_CATEGORIES, OrderItem, OutletOrder } from '../../types';
import { formatRupiah, exportOutletOrderToExcel } from '../../utils/excelExport';
import { formatDate } from '../../utils/dateUtils';
import { scrollToTop } from '../../utils/scrollHelper';
import { SuccessSubmitModal, SuccessDetail } from '../common/SuccessSubmitModal';
import {
  UtensilsCrossed,
  Plus,
  Trash2,
  FileSpreadsheet,
  Save,
  Send,
  AlertCircle,
  Search,
  Filter,
  Check,
  Edit2,
  X,
  Package,
  Layers,
  ArrowLeft,
  Info,
} from 'lucide-react';

interface OutletOrderFormProps {
  initialOrderToEdit?: OutletOrder | null;
  onBackToDashboard: () => void;
  prefill?: { outletName: string; department: DepartmentName } | null;
}

export const OutletOrderForm: React.FC<OutletOrderFormProps> = ({
  initialOrderToEdit,
  onBackToDashboard,
  prefill,
}) => {
  const {
    currentUser,
    inventory,
    createOutletOrder,
    updateOutletOrder,
    deleteOutletOrder,
    outlets,
  } = useApp();

  // Mode: creating new order or editing existing
  const isEditingExisting = !!initialOrderToEdit;

  // Step 1: Form Header
  // User must fill 'Outlet Name', 'Department', 'Date Requested'
  const [outletName, setOutletName] = useState<string>(
    initialOrderToEdit?.outletName ||
      currentUser.outletName ||
      prefill?.outletName ||
      outlets[0]?.namaOutlet ||
      OUTLETS[0]
  );

  const [department, setDepartment] = useState<DepartmentName>(
    initialOrderToEdit?.department ||
      currentUser.department ||
      prefill?.department ||
      'Kitchen'
  );

  const [dateRequested, setDateRequested] = useState<string>(
    initialOrderToEdit?.dateRequested ||
      new Date().toISOString().slice(0, 10)
  );

  const [orderNotes, setOrderNotes] = useState<string>(
    initialOrderToEdit?.notes || ''
  );

  // Cart / Items in the Form
  const [formItems, setFormItems] = useState<OrderItem[]>(
    initialOrderToEdit ? [...initialOrderToEdit.items] : []
  );

  // Step 2 & 3: Catalog browser filters
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Notification / Alert message
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Modal for editing an item within the form ("Ubah Pesanan")
  const [editingItem, setEditingItem] = useState<OrderItem | null>(null);
  const [editQty, setEditQty] = useState<number>(1);
  const [editNotes, setEditNotes] = useState<string>('');

  // Modal for adding a new item manually ("Tambah Pesanan")
  const [showAddModal, setShowAddModal] = useState<boolean>(false);

  // Top ref for scrolling to top after submit
  const topRef = useRef<HTMLDivElement>(null);

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

  // Dynamic calculated Form ID with DD/MM/YYYY
  const calculatedFormId = `${formatDate(dateRequested)}-${outletName}-${department}`;

  // Filter inventory based on selected department (only items permitted for this department to avoid duplicate/wrong department orders)
  const availableInventory = inventory.filter((item) =>
    item.allowedDepartments.includes(department)
  );

  // Categories available for this department
  const departmentCategories = Array.from(
    new Set(availableInventory.map((i) => i.category))
  );

  // Filtered catalog based on category and search
  const filteredCatalog = availableInventory.filter((item) => {
    const matchesCategory =
      selectedCategory === 'All' || item.category === selectedCategory;
    const matchesSearch =
      item.itemName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Calculate Grand Total
  const totalAmount = formItems.reduce((acc, it) => acc + it.subtotal, 0);

  // Handle direct field qty changes for items
  const handleSetItemQty = (item: (typeof inventory)[0], qty: number) => {
    if (qty <= 0) {
      setFormItems((prev) => prev.filter((i) => i.sku !== item.sku));
      return;
    }

    setFormItems((prev) => {
      const existingIdx = prev.findIndex((i) => i.sku === item.sku);
      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx] = {
          ...updated[existingIdx],
          qty,
          subtotal: qty * updated[existingIdx].price,
        };
        return updated;
      } else {
        const newItem: OrderItem = {
          sku: item.sku,
          itemName: item.itemName,
          category: item.category,
          qty,
          unit: item.unit,
          price: item.price,
          subtotal: qty * item.price,
        };
        return [...prev, newItem];
      }
    });
  };

  // Handle adding item to form
  const handleAddItemToForm = (item: (typeof inventory)[0], qty: number = 1) => {
    if (qty <= 0) return;

    setFormItems((prev) => {
      const existingIdx = prev.findIndex((i) => i.sku === item.sku);
      if (existingIdx >= 0) {
        const updated = [...prev];
        const newQty = updated[existingIdx].qty + qty;
        updated[existingIdx] = {
          ...updated[existingIdx],
          qty: newQty,
          subtotal: newQty * updated[existingIdx].price,
        };
        return updated;
      } else {
        const newItem: OrderItem = {
          sku: item.sku,
          itemName: item.itemName,
          category: item.category,
          qty,
          unit: item.unit,
          price: item.price,
          subtotal: qty * item.price,
        };
        return [...prev, newItem];
      }
    });

    setMessage({
      type: 'success',
      text: `${item.itemName} (${qty} ${item.unit}) ditambahkan ke formulir order.`,
    });
  };

  // Handle removing item from form ("Hapus Pesanan")
  const handleRemoveItem = (sku: string) => {
    setFormItems((prev) => prev.filter((i) => i.sku !== sku));
    setMessage({
      type: 'info',
      text: `Item dengan SKU ${sku} telah dihapus dari formulir.`,
    });
  };

  // Handle opening edit modal ("Ubah Pesanan")
  const handleOpenEditItem = (item: OrderItem) => {
    setEditingItem(item);
    setEditQty(item.qty);
    setEditNotes(item.notes || '');
  };

  const handleSaveEditItem = () => {
    if (!editingItem) return;
    if (editQty <= 0) {
      handleRemoveItem(editingItem.sku);
      setEditingItem(null);
      return;
    }

    setFormItems((prev) =>
      prev.map((i) =>
        i.sku === editingItem.sku
          ? {
              ...i,
              qty: editQty,
              subtotal: editQty * i.price,
              notes: editNotes,
            }
          : i
      )
    );

    setEditingItem(null);
    setMessage({
      type: 'success',
      text: `Pesanan ${editingItem.itemName} berhasil diubah.`,
    });
  };

  // Submit / Save Form
  const handleSubmitOrder = (status: 'Submitted' | 'Draft' = 'Submitted') => {
    if (!outletName || !department || !dateRequested) {
      setMessage({
        type: 'error',
        text: 'Harap lengkapi Outlet Name, Department, dan Date Requested terlebih dahulu!',
      });
      return;
    }

    if (formItems.length === 0) {
      setMessage({
        type: 'error',
        text: 'Daftar barang pesanan tidak boleh kosong! Tambahkan minimal 1 item.',
      });
      return;
    }

    const targetOrderId = isEditingExisting && initialOrderToEdit ? initialOrderToEdit.id : calculatedFormId;
    const formattedDate = formatDate(dateRequested);
    const totalItemsCount = formItems.reduce((acc, it) => acc + it.qty, 0);
    const totalTypesCount = formItems.length;
    const currentTotalRupiah = formatRupiah(totalAmount);
    const submittedOutlet = outletName;
    const submittedDept = department;

    if (isEditingExisting && initialOrderToEdit) {
      const updatedOrder: OutletOrder = {
        ...initialOrderToEdit,
        outletName,
        department,
        dateRequested,
        notes: orderNotes,
        items: formItems,
        totalAmount,
        status: initialOrderToEdit.status === 'Draft' ? status : initialOrderToEdit.status,
        updatedAt: new Date().toISOString(),
      };
      updateOutletOrder(updatedOrder);
    } else {
      const res = createOutletOrder({
        id: calculatedFormId,
        outletName,
        department,
        dateRequested,
        notes: orderNotes,
        items: formItems,
        status,
        totalAmount,
      });

      if (!res.success) {
        setMessage({ type: 'error', text: res.message });
        return;
      }
    }

    // 1. Tampilkan Pop-up Data Telah Berhasil Di-input
    setSuccessModalData({
      title: 'Data Telah Berhasil Di-input!',
      message: status === 'Draft'
        ? `Draft pesanan (${targetOrderId}) telah berhasil disimpan ke dalam sistem.`
        : `Formulir pemesanan barang ke gudang (${targetOrderId}) telah berhasil dikirimkan ke pihak gudang!`,
      details: [
        { label: 'Nomor Form ID', value: targetOrderId },
        { label: 'Outlet Name', value: submittedOutlet },
        { label: 'Department', value: submittedDept },
        { label: 'Tanggal Diminta', value: formattedDate },
        { label: 'Jumlah Item', value: `${totalTypesCount} jenis barang (${totalItemsCount} total qty)` },
        { label: 'Total Nilai Estimasi', value: currentTotalRupiah },
        { label: 'Status Form', value: status === 'Draft' ? 'Draft' : 'Submitted (Diteruskan ke Gudang)' },
      ],
    });
    setShowSuccessModal(true);

    // 2. Bersihkan formulir (form yang telah bersih)
    setFormItems([]);
    setOrderNotes('');
    setSearchQuery('');
    setSelectedCategory('All');
    setDateRequested(new Date().toISOString().slice(0, 10));
    setMessage({
      type: 'success',
      text: 'Data telah berhasil di-input! Form telah dibersihkan dan siap untuk pemesanan baru.',
    });

    // 3. Tampilan kembali ke atas
    scrollToTop();
    if (topRef.current) {
      topRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleCloseSuccessModal = () => {
    setShowSuccessModal(false);
    scrollToTop();
    if (isEditingExisting) {
      onBackToDashboard();
    }
  };

  // Export current state to Excel
  const handleExportCurrent = () => {
    const currentOrderData: OutletOrder = {
      id: isEditingExisting ? initialOrderToEdit!.id : calculatedFormId,
      outletName,
      department,
      dateRequested,
      status: isEditingExisting ? initialOrderToEdit!.status : 'Submitted',
      items: formItems,
      totalAmount,
      notes: orderNotes,
      createdAt: initialOrderToEdit?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    exportOutletOrderToExcel(currentOrderData);
  };

  // Delete entire order form
  const handleDeleteEntireOrder = () => {
    if (initialOrderToEdit) {
      if (confirm(`Apakah Anda yakin ingin menghapus seluruh form ${initialOrderToEdit.id}?`)) {
        deleteOutletOrder(initialOrderToEdit.id);
        onBackToDashboard();
      }
    } else {
      setFormItems([]);
      setMessage({ type: 'info', text: 'Daftar item telah dikosongkan.' });
    }
  };

  return (
    <div ref={topRef} className="space-y-6">
      {/* Top Header Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToDashboard}
            className="p-2 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-600 transition shadow-xs"
            title="Kembali ke Dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <UtensilsCrossed className="w-6 h-6 text-amber-600" />
              {isEditingExisting ? 'Ubah & Kelola Form Pesanan' : 'Form Pemesanan Barang ke Gudang'}
            </h1>
            <p className="text-xs text-slate-500">
              Format Nama Form:{' '}
              <span className="font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                {calculatedFormId}
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {formItems.length > 0 && (
            <button
              onClick={handleExportCurrent}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs"
              title="Export form ini ke format Excel"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Export Excel
            </button>
          )}

          {isEditingExisting && (
            <button
              onClick={handleDeleteEntireOrder}
              className="flex items-center gap-1.5 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl text-xs font-bold transition"
            >
              <Trash2 className="w-4 h-4" />
              Hapus Form
            </button>
          )}
        </div>
      </div>

      {/* Alert banner */}
      {message && (
        <div
          className={`p-3.5 rounded-xl text-xs font-medium flex items-center justify-between transition ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : message.type === 'error'
              ? 'bg-red-50 text-red-800 border border-red-200'
              : 'bg-blue-50 text-blue-800 border border-blue-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 shrink-0" />
            <span>{message.text}</span>
          </div>
          <button onClick={() => setMessage(null)} className="p-1 hover:opacity-75">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Step 1: Form Identifier Parameters (Required before browsing items) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
          <span className="w-6 h-6 rounded-full bg-amber-600 text-white text-xs font-bold flex items-center justify-center">
            1
          </span>
          <h2 className="text-sm font-bold text-slate-900">
            Identitas Form Pesanan (Wajib Diisi Terlebih Dahulu)
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Outlet Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Outlet Name <span className="text-red-500">*</span>
            </label>
            <select
              value={outletName}
              disabled={isEditingExisting || (!!currentUser.outletName && currentUser.position === 'Outlet')}
              onChange={(e) => setOutletName(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium focus:bg-white focus:ring-2 focus:ring-amber-500 outline-hidden"
            >
              {outlets.map((o) => (
                <option key={o.id} value={o.namaOutlet}>
                  {o.namaOutlet}
                </option>
              ))}
            </select>
          </div>

          {/* Department */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Department <span className="text-red-500">*</span>
            </label>
            <select
              value={department}
              disabled={isEditingExisting || (!!currentUser.department && currentUser.position === 'Outlet')}
              onChange={(e) => {
                setDepartment(e.target.value as DepartmentName);
                setSelectedCategory('All');
              }}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium focus:bg-white focus:ring-2 focus:ring-amber-500 outline-hidden"
            >
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <span className="text-[10px] text-slate-400 mt-1 block">
              Menampilkan hanya barang yang diotorisasi untuk {department}
            </span>
          </div>

          {/* Date Requested */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700">
                Date Requested <span className="text-red-500">*</span>
              </label>
              <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                {formatDate(dateRequested)}
              </span>
            </div>
            <input
              type="date"
              value={dateRequested}
              disabled={isEditingExisting}
              onChange={(e) => setDateRequested(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium focus:bg-white focus:ring-2 focus:ring-amber-500 outline-hidden"
            />
          </div>
        </div>

        {/* Optional Notes */}
        <div className="mt-3 pt-3 border-t border-slate-100">
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Catatan Tambahan untuk Gudang Pusat (Opsional)
          </label>
          <input
            type="text"
            value={orderNotes}
            onChange={(e) => setOrderNotes(e.target.value)}
            placeholder="Contoh: Tolak jika expired < 3 bulan, kirim sebelum pukul 10:00 pagi."
            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs focus:bg-white focus:ring-2 focus:ring-amber-500 outline-hidden"
          />
        </div>
      </div>

      {/* Main Two-Column Layout: Left = Catalog Browser, Right = Active Form & Cart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Dynamic Catalog List (Integrated with Department Stock) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-amber-600 text-white text-xs font-bold flex items-center justify-center">
                  2
                </span>
                <h2 className="text-sm font-bold text-slate-900">
                  Daftar Barang Pesanan ({department})
                </h2>
              </div>
              <span className="text-xs text-slate-500 font-medium">
                {filteredCatalog.length} Barang Tersedia
              </span>
            </div>

            {/* Category Pills & Search */}
            <div className="space-y-3 mb-4">
              {/* Search */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari SKU atau Nama Barang..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-amber-500 outline-hidden"
                />
              </div>

              {/* Dynamic Category Filter based on Department */}
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setSelectedCategory('All')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                    selectedCategory === 'All'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Semua Kategori
                </button>
                {departmentCategories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                      selectedCategory === cat
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Catalog Table */}
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 z-10">
                  <tr>
                    <th className="px-3 py-2.5">SKU</th>
                    <th className="px-3 py-2.5">Item Name</th>
                    <th className="px-3 py-2.5">Category</th>
                    <th className="px-3 py-2.5 text-center">Unit</th>
                    <th className="px-3 py-2.5 text-right">Price</th>
                    <th className="px-3 py-2.5 text-center min-w-[140px]">Qty Pesanan (Field)</th>
                    <th className="px-3 py-2.5 text-right min-w-[105px]">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCatalog.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-slate-400">
                        Tidak ada barang yang cocok dengan filter.
                      </td>
                    </tr>
                  ) : (
                    filteredCatalog.map((item) => {
                      const itemInForm = formItems.find((i) => i.sku === item.sku);
                      const currentQty = itemInForm?.qty || 0;
                      return (
                        <tr
                          key={item.sku}
                          className={`hover:bg-slate-50 transition ${
                            currentQty > 0 ? 'bg-amber-50/50 border-l-4 border-l-amber-500 font-medium' : ''
                          }`}
                        >
                          <td className="px-3 py-2.5 font-mono font-bold text-slate-800">
                            {item.sku}
                          </td>
                          <td className="px-3 py-2.5 font-medium text-slate-900">
                            {item.itemName}
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                              {item.category}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-center text-slate-600">
                            {item.unit}
                          </td>
                          <td className="px-3 py-2.5 text-right font-medium text-slate-800">
                            {formatRupiah(item.price)}
                          </td>

                          {/* Field Input Qty Pesanan */}
                          <td className="px-3 py-2.5 text-center">
                            <div className="inline-flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
                              <button
                                type="button"
                                onClick={() => handleSetItemQty(item, Math.max(0, currentQty - 1))}
                                disabled={currentQty <= 0}
                                className={`w-6 h-6 rounded-lg font-bold text-xs flex items-center justify-center transition ${
                                  currentQty > 0
                                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer'
                                    : 'bg-slate-50 text-slate-300 cursor-not-allowed'
                                }`}
                                title="Kurangi 1"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                min="0"
                                value={currentQty > 0 ? currentQty : ''}
                                placeholder="0"
                                onChange={(e) => {
                                  const val = parseInt(e.target.value) || 0;
                                  handleSetItemQty(item, Math.max(0, val));
                                }}
                                className={`w-14 text-center py-1 px-1 font-bold text-xs rounded-md border focus:outline-hidden transition ${
                                  currentQty > 0
                                    ? 'bg-amber-50 border-amber-400 text-amber-900 font-extrabold ring-1 ring-amber-400/40'
                                    : 'bg-white border-slate-200 text-slate-400 focus:border-amber-500'
                                }`}
                              />
                              <button
                                type="button"
                                onClick={() => handleSetItemQty(item, currentQty + 1)}
                                className="w-6 h-6 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs flex items-center justify-center transition shadow-2xs cursor-pointer"
                                title="Tambah 1"
                              >
                                +
                              </button>
                            </div>
                          </td>

                          {/* Subtotal real-time */}
                          <td className="px-3 py-2.5 text-right font-extrabold text-xs">
                            {currentQty > 0 ? (
                              <span className="text-amber-700 font-black">
                                {formatRupiah(currentQty * item.price)}
                              </span>
                            ) : (
                              <span className="text-slate-300 font-normal">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column: Active Order Form View & Management ("Ubah Pesanan", "Tambah Pesanan", "Hapus Pesanan") */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col h-full justify-between">
            <div>
              {/* Form Card Header */}
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-amber-600 text-white text-xs font-bold flex items-center justify-center">
                    3
                  </span>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">
                      Rincian Form Pesanan
                    </h2>
                    <span className="text-[10px] text-slate-400">
                      {formItems.length} jenis item terdaftar
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => setShowAddModal(true)}
                  className="flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
                  title="Tambah Pesanan secara manual"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Tambah Pesanan
                </button>
              </div>

              {/* Form ID Stamp */}
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 mb-4 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Form ID:</span>
                  <span className="font-mono font-bold text-amber-700">
                    {calculatedFormId}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Outlet:</span>
                  <span className="font-semibold text-slate-800">{outletName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Department:</span>
                  <span className="font-semibold text-slate-800">{department}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Tanggal:</span>
                  <span className="font-semibold text-slate-800">{formatDate(dateRequested)}</span>
                </div>
              </div>

              {/* Items List inside Form */}
              <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                {formItems.length === 0 ? (
                  <div className="text-center py-10 px-4 border-2 border-dashed border-slate-200 rounded-xl text-slate-400">
                    <Package className="w-8 h-8 mx-auto text-slate-300 mb-1" />
                    <p className="text-xs font-medium">
                      Belum ada barang di form pesanan ini.
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Isi jumlah kuantiti pada kolom Field Qty di daftar barang sebelah kiri untuk menambahkan pesanan.
                    </p>
                  </div>
                ) : (
                  formItems.map((item) => (
                    <div
                      key={item.sku}
                      className="p-3 rounded-xl border border-slate-200 bg-white hover:border-amber-300 transition shadow-2xs flex items-center justify-between gap-2"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-[11px] text-slate-500">
                            {item.sku}
                          </span>
                          <span className="text-xs font-bold text-slate-900 truncate">
                            {item.itemName}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                          <span>{item.category}</span>
                          <span>•</span>
                          <span>
                            {item.qty} {item.unit} @ {formatRupiah(item.price)}
                          </span>
                        </div>
                        {item.notes && (
                          <p className="text-[10px] text-amber-700 italic mt-0.5 truncate">
                            Catatan: {item.notes}
                          </p>
                        )}
                      </div>

                      <div className="text-right">
                        <div className="text-xs font-extrabold text-slate-900">
                          {formatRupiah(item.subtotal)}
                        </div>
                        {/* Action buttons: Ubah Pesanan & Hapus Pesanan */}
                        <div className="flex items-center justify-end gap-1 mt-1">
                          <button
                            onClick={() => handleOpenEditItem(item)}
                            className="p-1 text-slate-500 hover:text-amber-600 hover:bg-slate-100 rounded-md transition"
                            title="Ubah Pesanan (Qty / Catatan)"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleRemoveItem(item.sku)}
                            className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md transition"
                            title="Hapus Pesanan ini"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Total and Form Actions */}
            <div className="mt-4 pt-4 border-t border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600">
                  Total Nilai Pesanan:
                </span>
                <span className="text-base font-extrabold text-amber-600">
                  {formatRupiah(totalAmount)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleSubmitOrder('Draft')}
                  className="w-full py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition flex items-center justify-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  Simpan Draft
                </button>
                <button
                  onClick={() => handleSubmitOrder('Submitted')}
                  className="w-full py-2.5 px-3 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs transition shadow-md shadow-amber-600/20 flex items-center justify-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  Kirim ke Gudang
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal: Ubah Pesanan Item */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-amber-600" />
                Ubah Pesanan: {editingItem.itemName}
              </h3>
              <button
                onClick={() => setEditingItem(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1 bg-slate-50 px-3 rounded-lg border border-slate-100">
                <span className="text-slate-500">SKU / Kategori:</span>
                <span className="font-semibold text-slate-800">
                  {editingItem.sku} • {editingItem.category}
                </span>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Jumlah Pesanan (Qty dalam {editingItem.unit}):
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditQty(Math.max(1, editQty - 1))}
                    className="w-9 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 font-bold text-slate-700 text-sm flex items-center justify-center"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="1"
                    value={editQty}
                    onChange={(e) => setEditQty(Math.max(0, parseInt(e.target.value) || 0))}
                    className="flex-1 text-center py-2 border border-slate-300 rounded-lg font-bold text-sm focus:ring-2 focus:ring-amber-500 outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setEditQty(editQty + 1)}
                    className="w-9 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 font-bold text-slate-700 text-sm flex items-center justify-center"
                  >
                    +
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Catatan untuk Item Ini (Opsional):
                </label>
                <input
                  type="text"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Misal: Potongan slice tipis 2mm..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-hidden"
                />
              </div>

              <div className="pt-2 flex justify-between font-bold text-slate-900 border-t border-slate-100">
                <span>Subtotal Baru:</span>
                <span className="text-amber-600 font-extrabold text-sm">
                  {formatRupiah(editQty * editingItem.price)}
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveEditItem}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white transition shadow-xs"
              >
                Simpan Perubahan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Tambah Pesanan (Manual item selection) */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full border border-slate-200 p-6 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <Plus className="w-4 h-4 text-amber-600" />
                Tambah Pesanan ke Form ({department})
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Pilih item tambahan yang ingin dimasukkan ke formulir pesanan {department}.
            </p>

            <div className="overflow-y-auto space-y-2 flex-1 pr-1">
              {availableInventory.map((item) => {
                const currentQtyInForm = formItems.find((i) => i.sku === item.sku)?.qty || 0;
                return (
                  <div
                    key={item.sku}
                    className="p-3 rounded-xl border border-slate-200 flex items-center justify-between hover:bg-slate-50"
                  >
                    <div>
                      <div className="font-bold text-xs text-slate-900">{item.itemName}</div>
                      <div className="text-[11px] text-slate-500">
                        {item.sku} • {item.category} • {formatRupiah(item.price)}/{item.unit}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right mr-1">
                        <span className="text-[10px] text-slate-400 block">Subtotal:</span>
                        <span className="text-xs font-bold text-slate-800">
                          {currentQtyInForm > 0 ? formatRupiah(currentQtyInForm * item.price) : '-'}
                        </span>
                      </div>
                      <div className="inline-flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
                        <button
                          type="button"
                          onClick={() => handleSetItemQty(item, Math.max(0, currentQtyInForm - 1))}
                          disabled={currentQtyInForm <= 0}
                          className={`w-6 h-6 rounded-lg font-bold text-xs flex items-center justify-center transition ${
                            currentQtyInForm > 0
                              ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer'
                              : 'bg-slate-50 text-slate-300 cursor-not-allowed'
                          }`}
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min="0"
                          value={currentQtyInForm > 0 ? currentQtyInForm : ''}
                          placeholder="0"
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 0;
                            handleSetItemQty(item, Math.max(0, val));
                          }}
                          className={`w-12 text-center py-0.5 px-1 font-bold text-xs rounded-md border focus:outline-hidden ${
                            currentQtyInForm > 0
                              ? 'bg-amber-50 border-amber-400 text-amber-900 font-extrabold ring-1 ring-amber-400/40'
                              : 'bg-white border-slate-200 text-slate-400'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => handleSetItemQty(item, currentQtyInForm + 1)}
                          className="w-6 h-6 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs flex items-center justify-center transition shadow-2xs cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
              >
                Selesai
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pop-up Modal Sukses Submit Form */}
      <SuccessSubmitModal
        isOpen={showSuccessModal}
        onClose={handleCloseSuccessModal}
        title={successModalData.title}
        message={successModalData.message}
        details={successModalData.details}
        buttonText={isEditingExisting ? 'Selesai & Kembali ke Dashboard' : 'Tutup & Buat Pesanan Baru'}
      />
    </div>
  );
};
