import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { OUTLETS, DEPARTMENTS } from '../../data/mockData';
import { DepartmentName, OutletOrder, InventoryItem } from '../../types';
import { formatRupiah, exportOutletOrderToExcel } from '../../utils/excelExport';
import { formatDate } from '../../utils/dateUtils';
import {
  UtensilsCrossed,
  Coffee,
  CakeSlice,
  Sparkles,
  PlusCircle,
  FileSpreadsheet,
  Clock,
  CheckCircle2,
  AlertCircle,
  Truck,
  Building,
  TrendingUp,
  PackageCheck,
  Eye,
  ArrowRight,
  ChevronUp,
  X,
  Edit2,
  Trash2,
  Search,
  ArrowUpDown,
  Calendar,
  Filter,
  AlertTriangle,
} from 'lucide-react';
import { isItemLowStock } from '../../utils/inventoryUtils';

interface OutletDashboardProps {
  onNavigateToOrderForm: (prefill?: { outletName: string; department: DepartmentName }) => void;
  onViewOrderDetails: (order: OutletOrder) => void;
}

export const OutletDashboard: React.FC<OutletDashboardProps> = ({
  onNavigateToOrderForm,
  onViewOrderDetails,
}) => {
  const { currentUser, outletOrders, outlets, deleteOutletOrder, updateOrderItem, inventory } = useApp();

  // State untuk konfirmasi hapus Form PR Outlet
  const [orderToDelete, setOrderToDelete] = useState<OutletOrder | null>(null);

  // If currentUser has outletName, lock or default to that
  const [selectedOutlet, setSelectedOutlet] = useState<string>(
    currentUser.outletName || outlets[0]?.namaOutlet || OUTLETS[0]
  );

  const [dateFilter, setDateFilter] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );

  // Form order yang dipilih untuk menampilkan list barang di bawah baris form
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  // Filter & Search states for Riwayat Form Pesanan
  const [orderSearchQuery, setOrderSearchQuery] = useState<string>('');
  const [historyDateFilter, setHistoryDateFilter] = useState<string>('');
  const [dateSortOrder, setDateSortOrder] = useState<'desc' | 'asc'>('desc');

  // Total items currently low on stock in Central Warehouse
  const lowStockItems = useMemo(
    () => (inventory || []).filter((item) => isItemLowStock(item)),
    [inventory]
  );

  // Department icon and color mapping
  const deptMeta: Record<
    DepartmentName,
    { icon: any; color: string; bg: string; border: string; desc: string }
  > = {
    Kitchen: {
      icon: UtensilsCrossed,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      desc: 'Daging, Sayuran, Bahan Kering, Dairy, & Gas Elpiji',
    },
    Bar: {
      icon: Coffee,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      desc: 'Biji Kopi, Sirup, Minuman Kaleng, Susu, & Cup PET',
    },
    Pastry: {
      icon: CakeSlice,
      color: 'text-rose-600',
      bg: 'bg-rose-50',
      border: 'border-rose-200',
      desc: 'Frozen Dough, Butter, Matcha, Roti, & Tepung',
    },
    'Floor & Operations': {
      icon: Sparkles,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      desc: 'Packaging, Paper Bowl, Sanitasi, Plastik & Gas',
    },
  };

  // Filter orders for the selected outlet
  const outletAllOrders = outletOrders.filter(
    (o) => o.outletName === selectedOutlet
  );

  // Filtered and sorted orders based on search, date filter, and sort order
  const filteredAndSortedOrders = [...outletAllOrders]
    .filter((o) => {
      const matchSearch =
        orderSearchQuery === '' ||
        o.id.toLowerCase().includes(orderSearchQuery.toLowerCase()) ||
        o.department.toLowerCase().includes(orderSearchQuery.toLowerCase()) ||
        o.status.toLowerCase().includes(orderSearchQuery.toLowerCase());
      const matchDate =
        historyDateFilter === '' || o.dateRequested === historyDateFilter;
      return matchSearch && matchDate;
    })
    .sort((a, b) => {
      const timeA = new Date(a.dateRequested).getTime();
      const timeB = new Date(b.dateRequested).getTime();
      return dateSortOrder === 'desc' ? timeB - timeA : timeA - timeB;
    });

  // Filter orders for selected date
  const outletTodayOrders = outletAllOrders.filter(
    (o) => o.dateRequested === dateFilter
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Submitted':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
            <Clock className="w-3 h-3" /> Submitted (Menunggu Gudang)
          </span>
        );
      case 'Processing Gudang':
      case 'PO Generated':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            <TrendingUp className="w-3 h-3" /> Diproses Gudang
          </span>
        );
      case 'Siap Dikirim':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
            <Clock className="w-3 h-3" /> Siap Dikirim
          </span>
        );
      case 'PO Terkirim':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-300">
            <Truck className="w-3 h-3" /> PO Terkirim
          </span>
        );
      case 'Selesai':
      case 'Deployed / Dikirim':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" /> Selesai (Outbond)
          </span>
        );
      case 'Diterima Lengkap':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" /> Diterima Lengkap
          </span>
        );
      case 'Draft':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            <AlertCircle className="w-3 h-3" /> Draft
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Control */}
      <div className="bg-gradient-to-r from-amber-900 via-stone-800 to-amber-950 rounded-2xl text-white p-6 shadow-md relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 opacity-10 flex items-center pr-10 pointer-events-none">
          <UtensilsCrossed className="w-64 h-64 text-white" />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 text-[11px] font-bold rounded-md bg-amber-500/30 text-amber-300 border border-amber-400/30">
                Pusat Kontrol Outlet
              </span>
              <span className="text-slate-400 text-xs">F&B Multi-Department Dispatch</span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white">
              Status Pemesanan Barang Outlet
            </h1>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl">
              Monitor status pesanan harian 4 departemen per outlet. Pesanan terisolasi antar departemen untuk mencegah duplikasi pemesanan ke Gudang Pusat.
            </p>
          </div>

          {/* Outlet & Date Pickers */}
          <div className="flex flex-wrap items-center gap-2.5 bg-white/10 backdrop-blur-md p-2 rounded-xl border border-white/20">
            <div>
              <label className="block text-[10px] text-amber-200 font-semibold mb-0.5">
                Pilih Resto / Outlet:
              </label>
              <select
                value={selectedOutlet}
                onChange={(e) => setSelectedOutlet(e.target.value)}
                disabled={!!currentUser.outletName && currentUser.position === 'Outlet'}
                className="bg-stone-900/90 text-white text-xs font-semibold rounded-lg px-3 py-1.5 border border-amber-500/40 focus:outline-hidden focus:ring-1 focus:ring-amber-400"
              >
                {outlets.map((out) => (
                  <option key={out.id} value={out.namaOutlet} className="bg-stone-900 text-white">
                    {out.namaOutlet}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between gap-2 mb-0.5">
                <label className="block text-[10px] text-amber-200 font-semibold">
                  Tanggal Permintaan:
                </label>
                <span className="text-[10px] font-bold text-amber-300">
                  {formatDate(dateFilter)}
                </span>
              </div>
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="bg-stone-900/90 text-white text-xs font-semibold rounded-lg px-2.5 py-1.5 border border-amber-500/40 focus:outline-hidden focus:ring-1 focus:ring-amber-400"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Central Warehouse Low Stock Alert Summary Card */}
      {lowStockItems.length > 0 && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 border border-amber-300 text-amber-700 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="font-extrabold text-sm text-slate-900 flex items-center gap-2 flex-wrap">
                <span>Stok Gudang Pusat Kritis ({lowStockItems.length} Barang Low Stock)</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-200 text-amber-900">
                  Di Bawah Safety Stock
                </span>
              </div>
              <p className="text-slate-600 mt-0.5 text-xs">
                {lowStockItems.slice(0, 3).map((it: InventoryItem) => it.itemName).join(', ')}
                {lowStockItems.length > 3 ? ` dan ${lowStockItems.length - 3} item lainnya` : ''} berada di bawah batas minimum stok gudang pusat.
              </p>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <span className="text-xs font-bold text-amber-900 bg-white/90 px-3 py-1.5 rounded-lg border border-amber-200 shadow-2xs inline-block">
              {lowStockItems.length} Total Low Stock
            </span>
          </div>
        </div>
      )}

      {/* 4 Department Centralized Grid Cards */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Building className="w-5 h-5 text-amber-600" />
              Status 4 Departemen di {selectedOutlet} ({formatDate(dateFilter)})
            </h2>
            <p className="text-xs text-slate-500">
              Setiap departemen memiliki katalog & kuota barang terpisah tanpa resiko overlap.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {DEPARTMENTS.map((dept) => {
            const meta = deptMeta[dept];
            const Icon = meta.icon;
            // Look for existing order for today
            const currentOrder = outletTodayOrders.find((o) => o.department === dept);

            return (
              <div
                key={dept}
                className={`bg-white rounded-xl border ${meta.border} p-5 shadow-xs flex flex-col justify-between hover:shadow-md transition`}
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-9 h-9 rounded-xl ${meta.bg} ${meta.color} flex items-center justify-center`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-slate-900 leading-tight">
                          {dept}
                        </h3>
                        <span className="text-[10px] text-slate-400 block">Departemen {dept}</span>
                      </div>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-500 mb-4 line-clamp-2">
                    {meta.desc}
                  </p>

                  {/* Status Box */}
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 mb-4">
                    <div className="text-[10px] uppercase font-bold text-slate-400 mb-1">
                      Status Order Hari Ini:
                    </div>
                    {currentOrder ? (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          {getStatusBadge(currentOrder.status)}
                        </div>
                        <div className="text-xs font-semibold text-slate-800 pt-1 flex items-center justify-between">
                          <span>{currentOrder.items.length} Item Dipesan</span>
                          <span className="text-amber-600 font-bold">
                            {formatRupiah(currentOrder.totalAmount)}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">
                          ID: {currentOrder.id}
                        </div>
                      </div>
                    ) : (
                      <div className="py-2 text-center">
                        <span className="text-xs text-slate-400 font-medium">
                          Belum ada pesanan untuk tanggal ini
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  {currentOrder ? (
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        onClick={() => onViewOrderDetails(currentOrder)}
                        className="flex items-center justify-center gap-1 py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition"
                      >
                        <Eye className="w-3.5 h-3.5" /> Detail
                      </button>
                      <button
                        onClick={() => exportOutletOrderToExcel(currentOrder)}
                        className="flex items-center justify-center gap-1 py-1.5 px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-lg transition"
                        title="Ekspor ke Excel"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() =>
                        onNavigateToOrderForm({
                          outletName: selectedOutlet,
                          department: dept,
                        })
                      }
                      className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg shadow-xs transition"
                    >
                      <PlusCircle className="w-3.5 h-3.5" /> Buat Pesanan {dept}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Orders Table for this Outlet */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-600" />
              Riwayat Form Pesanan {selectedOutlet}
            </h3>
            <p className="text-xs text-slate-500">
              Format Penamaan Form Standar: [Date Requested]-[Outlet Name]-[Department]
            </p>
          </div>

          <button
            onClick={() =>
              onNavigateToOrderForm({
                outletName: selectedOutlet,
                department: 'Kitchen',
              })
            }
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition self-start sm:self-auto"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            Buat Form Pemesanan Baru
          </button>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="p-3 bg-slate-50/90 border-b border-slate-200 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 text-xs">
          {/* Search Bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={orderSearchQuery}
              onChange={(e) => setOrderSearchQuery(e.target.value)}
              placeholder="Cari Form ID, Departemen, atau Status..."
              className="w-full pl-9 pr-8 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-hidden"
            />
            {orderSearchQuery && (
              <button
                onClick={() => setOrderSearchQuery('')}
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
                value={historyDateFilter}
                onChange={(e) => setHistoryDateFilter(e.target.value)}
                className="text-xs text-slate-700 bg-transparent outline-hidden font-medium"
              />
              {historyDateFilter && (
                <button
                  onClick={() => setHistoryDateFilter('')}
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
              title="Urutkan berdasarkan tanggal permintaan"
            >
              <ArrowUpDown className="w-3.5 h-3.5 text-amber-600" />
              <span>Urutkan: {dateSortOrder === 'desc' ? 'Terbaru' : 'Terlama'}</span>
            </button>
          </div>
        </div>

        {filteredAndSortedOrders.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            <PackageCheck className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-medium">
              {outletAllOrders.length === 0
                ? 'Belum ada form pesanan untuk outlet ini.'
                : 'Tidak ada form pesanan yang sesuai dengan filter tanggal atau kata kunci pencarian.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Form ID (Standar Format)</th>
                  <th className="px-4 py-3">Departemen</th>
                  <th className="px-4 py-3">Tgl Diminta</th>
                  <th className="px-4 py-3 text-right">Total Nilai</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-center">Aksi Form</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAndSortedOrders.map((order) => {
                  const isExpanded = expandedOrderId === order.id;

                  return (
                    <React.Fragment key={order.id}>
                      <tr
                        onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                        className={`hover:bg-slate-50/80 transition cursor-pointer ${
                          isExpanded ? 'bg-amber-50/80 font-medium border-l-4 border-l-amber-600' : ''
                        }`}
                      >
                        <td className="px-4 py-3 font-semibold text-slate-900">
                          {order.id}
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded-md font-semibold text-[11px] bg-slate-100 text-slate-700">
                            {order.department}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600 font-medium">{formatDate(order.dateRequested)}</td>
                        <td className="px-4 py-3 text-right font-bold text-slate-900">
                          {formatRupiah(order.totalAmount)}
                        </td>
                        <td className="px-4 py-3">{getStatusBadge(order.status)}</td>
                        <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition shadow-2xs ${
                                isExpanded
                                    ? 'bg-amber-600 text-white'
                                    : 'bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-200'
                              }`}
                              title={isExpanded ? 'Tutup rincian list barang' : 'Tampilkan list barang form ini'}
                            >
                              {isExpanded ? (
                                <>
                                  <ChevronUp className="w-3.5 h-3.5" />
                                  Tutup
                                </>
                              ) : (
                                <>
                                  <Eye className="w-3.5 h-3.5 text-amber-700" />
                                  List Barang
                                </>
                              )}
                            </button>
                            <button
                              onClick={() => onViewOrderDetails(order)}
                              className="p-1.5 text-slate-600 hover:text-amber-600 hover:bg-slate-100 rounded-md transition"
                              title="Ubah / Kelola Pesanan"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => exportOutletOrderToExcel(order)}
                              className="p-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-md transition"
                              title="Ekspor ke Excel"
                            >
                              <FileSpreadsheet className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setOrderToDelete(order)}
                              className="p-1.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-md transition"
                              title="Hapus Form Pesanan"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Tampilan List Barang Tepat di Bawah Form Order yang Dipilih */}
                      {isExpanded && (
                        <tr className="bg-amber-50/30 border-b-2 border-amber-400">
                          <td colSpan={6} className="p-3 sm:p-4">
                            <div className="bg-white rounded-xl border-2 border-amber-400 shadow-sm overflow-hidden animate-in fade-in duration-200">
                              <div className="p-3 bg-gradient-to-r from-amber-50 to-orange-50/40 border-b border-amber-200 flex items-center justify-between gap-2">
                                <h4 className="font-bold text-xs sm:text-sm text-slate-900">
                                  Rincian List Barang Form {order.id} ({order.items.length} item)
                                </h4>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => onViewOrderDetails(order)}
                                    className="flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-100 hover:bg-amber-200 px-2.5 py-1 rounded-lg border border-amber-300 transition"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                    Ubah / Kelola Form
                                  </button>
                                  <button
                                    onClick={() => setExpandedOrderId(null)}
                                    className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800 font-semibold"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                    Tutup List
                                  </button>
                                </div>
                              </div>
                              <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                  <thead className="bg-slate-100/70 text-slate-600 font-bold border-b border-slate-200">
                                    <tr>
                                      <th className="px-3 py-2">SKU</th>
                                      <th className="px-3 py-2">Nama Barang</th>
                                      <th className="px-3 py-2">Kategori</th>
                                      <th className="px-3 py-2 text-center min-w-[90px]">Qty (Field Bebas)</th>
                                      <th className="px-3 py-2 text-center">Unit</th>
                                      <th className="px-3 py-2 text-right min-w-[130px]">Harga (Field Bebas)</th>
                                      <th className="px-3 py-2 text-right">Subtotal</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {order.items.map((it) => {
                                      const isOrderEditable = order.status === 'Submitted' || order.status === 'Draft';

                                      return (
                                        <tr key={it.sku} className="hover:bg-slate-50">
                                          <td className="px-3 py-2 font-mono font-bold text-slate-800">{it.sku}</td>
                                          <td className="px-3 py-2 font-medium text-slate-900">{it.itemName}</td>
                                          <td className="px-3 py-2 text-slate-600">{it.category}</td>

                                          {/* Qty Field Bebas */}
                                          <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                                            {isOrderEditable ? (
                                              <div className="flex items-center justify-center">
                                                <input
                                                  type="number"
                                                  min="0"
                                                  value={it.qty === 0 ? '' : it.qty}
                                                  onChange={(e) => {
                                                    const val = e.target.value === '' ? 0 : Math.max(0, parseInt(e.target.value) || 0);
                                                    updateOrderItem(order.id, {
                                                      ...it,
                                                      qty: val,
                                                      subtotal: val * it.price,
                                                    });
                                                  }}
                                                  className="w-16 px-2 py-1 text-center font-bold text-slate-900 bg-white border border-slate-300 hover:border-amber-400 focus:border-amber-600 focus:ring-2 focus:ring-amber-100 rounded-lg text-xs outline-hidden shadow-2xs transition"
                                                  title="Ubah Qty bebas"
                                                />
                                              </div>
                                            ) : (
                                              <span className="font-bold text-slate-900">{it.qty}</span>
                                            )}
                                          </td>

                                          <td className="px-3 py-2 text-center text-slate-600">{it.unit}</td>

                                          {/* Harga Satuan Field Bebas */}
                                          <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                                            {isOrderEditable ? (
                                              <div className="relative inline-block w-28">
                                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold pointer-events-none">Rp</span>
                                                <input
                                                  type="number"
                                                  min="0"
                                                  step="500"
                                                  value={it.price === 0 ? '' : it.price}
                                                  onChange={(e) => {
                                                    const val = e.target.value === '' ? 0 : Math.max(0, parseInt(e.target.value) || 0);
                                                    updateOrderItem(order.id, {
                                                      ...it,
                                                      price: val,
                                                      subtotal: it.qty * val,
                                                    });
                                                  }}
                                                  className="w-full pl-7 pr-2 py-1 text-right font-bold text-slate-900 bg-white border border-slate-300 hover:border-amber-400 focus:border-amber-600 focus:ring-2 focus:ring-amber-100 rounded-lg text-xs outline-hidden shadow-2xs transition"
                                                  title="Ubah Harga bebas"
                                                />
                                              </div>
                                            ) : (
                                              <span className="text-slate-600">{formatRupiah(it.price)}</span>
                                            )}
                                          </td>

                                          <td className="px-3 py-2 text-right font-bold text-slate-900">{formatRupiah(it.qty * it.price)}</td>
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
        )}
      </div>

      {/* Modal Konfirmasi Hapus Form Pesanan */}
      {orderToDelete && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-100">
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <div className="p-2.5 bg-rose-100 rounded-xl">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Hapus Form Pesanan?
                </h3>
                <p className="text-xs text-slate-500">
                  Tindakan ini akan menghapus form pesanan dari sistem
                </p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-3.5 mb-4 text-xs space-y-2 border border-slate-200">
              <div className="flex justify-between">
                <span className="text-slate-500">Nomor Form:</span>
                <span className="font-mono font-bold text-slate-900">{orderToDelete.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Departemen:</span>
                <span className="font-semibold text-slate-800">{orderToDelete.department}</span>
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

            <div className="flex justify-end gap-2.5">
              <button
                onClick={() => setOrderToDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  deleteOutletOrder(orderToDelete.id);
                  if (expandedOrderId === orderToDelete.id) {
                    setExpandedOrderId(null);
                  }
                  setOrderToDelete(null);
                }}
                className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Ya, Hapus Form
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
