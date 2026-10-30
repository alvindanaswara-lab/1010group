import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { DepartmentName, ITEM_CATEGORIES, OutletOrder, UserPosition } from '../../types';
import { formatRupiah, exportPOToExcel, exportOutletOrderToExcel } from '../../utils/excelExport';
import { exportPOToPDF } from '../../utils/pdfExport';
import { formatDate } from '../../utils/dateUtils';
import { formatPeriodLabel, isItemLowStock } from '../../utils/inventoryUtils';
import { OutletDashboard } from '../outlet/OutletDashboard';
import {
  Layers,
  ArrowDownToLine,
  FileText,
  Building2,
  Calculator,
  ShieldCheck,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  AlertCircle,
  Truck,
  Package,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  Download,
} from 'lucide-react';

interface RoleDashboardProps {
  onNavigateTab: (tabId: string) => void;
  onNavigateToOrderForm: (prefill?: { outletName: string; department: DepartmentName }) => void;
  onViewOrderDetails: (order: OutletOrder) => void;
}

type DashboardSectionId =
  | 'inventory-report'
  | 'inbound-report'
  | 'outbound-report'
  | 'pr-status'
  | 'po-vendor-status';

const ROLE_CONFIGS: Record<
  UserPosition,
  {
    title: string;
    subtitle: string;
    badge: string;
    gradient: string;
    sections: DashboardSectionId[];
  }
> = {
  Administrator: {
    title: 'Dashboard Administrator',
    subtitle:
      'Pusat kendali eksekutif: Report Inventory Management, Penerimaan Inbound, Pengiriman ke Outlet, Status Purchase Request, dan Status PO Vendor.',
    badge: 'Executive Overview • 5 Modul',
    gradient: 'from-slate-900 via-purple-950 to-slate-900',
    sections: ['inventory-report', 'inbound-report', 'outbound-report', 'pr-status', 'po-vendor-status'],
  },
  Outlet: {
    title: 'Dashboard Outlet',
    subtitle: 'Pusat kontrol pemesanan barang harian 4 departemen per outlet.',
    badge: 'Pusat Kontrol Outlet',
    gradient: 'from-amber-900 via-stone-800 to-amber-950',
    sections: [],
  },
  'Storage Inbound': {
    title: 'Dashboard Storage - Inbound',
    subtitle: 'Monitoring Report Inventory Management dan Report Penerimaan Barang / Inbound.',
    badge: 'Storage Inbound & Inventory',
    gradient: 'from-blue-950 via-slate-900 to-indigo-950',
    sections: ['inventory-report', 'inbound-report'],
  },
  'Storage-Mailer': {
    title: 'Dashboard Storage - Mailer',
    subtitle: 'Monitoring khusus Report Pengiriman Barang ke Outlet (Deployment & Distribusi).',
    badge: 'Storage Mailer • Distribusi Outlet',
    gradient: 'from-sky-950 via-slate-900 to-cyan-950',
    sections: ['outbound-report'],
  },
  'Storage Outbond': {
    title: 'Dashboard Storage - Outbond',
    subtitle: 'Monitoring Report Inventory Management dan Report Pengiriman Barang ke Outlet.',
    badge: 'Storage Outbond & Inventory',
    gradient: 'from-amber-950 via-stone-900 to-orange-950',
    sections: ['inventory-report', 'outbound-report'],
  },
  Purchasing: {
    title: 'Dashboard Purchasing',
    subtitle:
      'Monitoring Report Penerimaan Barang / Inbound, Status Form Purchase Request, dan Status Form PO Vendor.',
    badge: 'Procurement, PR & Vendor',
    gradient: 'from-indigo-950 via-slate-900 to-violet-950',
    sections: ['inbound-report', 'pr-status', 'po-vendor-status'],
  },
  'Cost Control': {
    title: 'Dashboard Cost Control',
    subtitle:
      'Monitoring Report Inventory Management, Status Form Purchase Request, dan Status Form PO Vendor.',
    badge: 'Cost Audit, Inventory & Approval',
    gradient: 'from-rose-950 via-slate-900 to-stone-950',
    sections: ['inventory-report', 'pr-status', 'po-vendor-status'],
  },
};

const SECTION_LABELS: Record<DashboardSectionId, { label: string; icon: React.FC<{ className?: string }> }> = {
  'inventory-report': { label: 'Report Inventory Management', icon: Layers },
  'inbound-report': { label: 'Report Penerimaan Barang / Inbound', icon: ArrowDownToLine },
  'outbound-report': { label: 'Report Pengiriman Barang ke Outlet', icon: Truck },
  'pr-status': { label: 'Status Form Purchase Request', icon: FileText },
  'po-vendor-status': { label: 'Status Form PO Vendor', icon: Building2 },
};

export const RoleDashboard: React.FC<RoleDashboardProps> = ({
  onNavigateTab,
  onNavigateToOrderForm,
  onViewOrderDetails,
}) => {
  const {
    currentUser,
    inventory,
    selectedPeriod,
    receivingRecords,
    manualInboundRecords,
    outletOrders,
    purchaseOrders,
    outlets,
    vendors,
    canAccess,
  } = useApp();

  const [previewRole, setPreviewRole] = useState<UserPosition | null>(null);
  const effectivePosition: UserPosition =
    currentUser.position === 'Administrator' && previewRole ? previewRole : currentUser.position;

  const [activeSectionFilter, setActiveSectionFilter] = useState<DashboardSectionId | 'all'>('all');

  // Filter states
  const [invSearch, setInvSearch] = useState('');
  const [invCategoryFilter, setInvCategoryFilter] = useState('all');
  const [invStatusFilter, setInvStatusFilter] = useState<'all' | 'low' | 'safe'>('all');

  const [inboundSearch, setInboundSearch] = useState('');
  const [inboundStatusFilter, setInboundStatusFilter] = useState('all');
  const [expandedInboundId, setExpandedInboundId] = useState<string | null>(null);

  const [outboundSearch, setOutboundSearch] = useState('');
  const [outboundOutletFilter, setOutboundOutletFilter] = useState('all');
  const [outboundStageFilter, setOutboundStageFilter] = useState('all');
  const [expandedOutboundId, setExpandedOutboundId] = useState<string | null>(null);

  const [prSearch, setPrSearch] = useState('');
  const [prStageFilter, setPrStageFilter] = useState<'all' | 'pending' | 'merged'>('all');
  const [expandedPRId, setExpandedPRId] = useState<string | null>(null);

  const [poSearch, setPoSearch] = useState('');
  const [poStageFilter, setPoStageFilter] = useState('all');
  const [expandedPOId, setExpandedPOId] = useState<string | null>(null);

  const invStats = useMemo(() => {
    const lowStock = inventory.filter((i) => isItemLowStock(i)).length;
    const begVal = inventory.reduce(
      (s, i) => s + (i.beginningValue ?? i.beginningInventory * (i.priceBudget || i.price || 0)),
      0
    );
    const inVal = inventory.reduce(
      (s, i) => s + (i.inboundValue ?? i.inbound * (i.priceActual || i.price || 0)),
      0
    );
    const outVal = inventory.reduce(
      (s, i) => s + (i.outbondValue ?? i.outbond * (i.priceBudget || i.price || 0)),
      0
    );
    const endVal = inventory.reduce(
      (s, i) => s + (i.endingValue ?? i.endingInventory * (i.priceBudget || i.price || 0)),
      0
    );
    return { totalSku: inventory.length, lowStock, begVal, inVal, outVal, endVal };
  }, [inventory]);

  const filteredInventory = useMemo(
    () =>
      inventory.filter((it) => {
        const matchQ =
          !invSearch ||
          it.sku.toLowerCase().includes(invSearch.toLowerCase()) ||
          it.itemName.toLowerCase().includes(invSearch.toLowerCase());
        const matchCat = invCategoryFilter === 'all' || it.category === invCategoryFilter;
        const low = isItemLowStock(it);
        const matchSt =
          invStatusFilter === 'all' ||
          (invStatusFilter === 'low' && low) ||
          (invStatusFilter === 'safe' && !low);
        return matchQ && matchCat && matchSt;
      }),
    [inventory, invSearch, invCategoryFilter, invStatusFilter]
  );

  const inboundStats = useMemo(() => {
    const waiting = receivingRecords.filter((r) => r.status === 'Menunggu Kedatangan').length;
    const partial = receivingRecords.filter((r) => r.status === 'Diterima Sebagian').length;
    const done = receivingRecords.filter((r) => r.status === 'Diterima Keseluruhan').length;
    const rcvVal = receivingRecords.reduce(
      (s, r) => s + r.items.reduce((a, i) => a + i.receivedQty * (i.unitPrice || 0), 0),
      0
    );
    return { total: receivingRecords.length, waiting, partial, done, rcvVal, manual: manualInboundRecords.length };
  }, [receivingRecords, manualInboundRecords]);

  const filteredInbound = useMemo(
    () =>
      receivingRecords.filter((r) => {
        const matchQ =
          !inboundSearch ||
          r.id.toLowerCase().includes(inboundSearch.toLowerCase()) ||
          r.poVendorId.toLowerCase().includes(inboundSearch.toLowerCase()) ||
          r.vendorName.toLowerCase().includes(inboundSearch.toLowerCase());
        const matchSt = inboundStatusFilter === 'all' || r.status === inboundStatusFilter;
        return matchQ && matchSt;
      }),
    [receivingRecords, inboundSearch, inboundStatusFilter]
  );

  const outboundStats = useMemo(() => {
    const waiting = outletOrders.filter((o) =>
      ['Submitted', 'Draft', 'PO Generated', 'Processing Gudang'].includes(o.status)
    ).length;
    const ready = outletOrders.filter((o) => o.status === 'Siap Dikirim').length;
    const transit = outletOrders.filter((o) => o.status === 'PO Terkirim').length;
    const done = outletOrders.filter((o) =>
      ['Selesai', 'Deployed / Dikirim', 'Diterima Lengkap', 'Diterima Sebagian'].includes(o.status)
    ).length;
    const totalVal = outletOrders.reduce((s, o) => s + o.totalAmount, 0);
    return { total: outletOrders.length, waiting, ready, transit, done, totalVal };
  }, [outletOrders]);

  const filteredOutbound = useMemo(
    () =>
      outletOrders.filter((o) => {
        const matchQ =
          !outboundSearch ||
          o.id.toLowerCase().includes(outboundSearch.toLowerCase()) ||
          o.outletName.toLowerCase().includes(outboundSearch.toLowerCase()) ||
          o.department.toLowerCase().includes(outboundSearch.toLowerCase());
        const matchOut = outboundOutletFilter === 'all' || o.outletName === outboundOutletFilter;
        let matchSt = true;
        if (outboundStageFilter === 'waiting')
          matchSt = ['Submitted', 'Draft', 'PO Generated', 'Processing Gudang'].includes(o.status);
        else if (outboundStageFilter === 'ready') matchSt = o.status === 'Siap Dikirim';
        else if (outboundStageFilter === 'transit') matchSt = o.status === 'PO Terkirim';
        else if (outboundStageFilter === 'done')
          matchSt = ['Selesai', 'Deployed / Dikirim', 'Diterima Lengkap', 'Diterima Sebagian'].includes(o.status);
        return matchQ && matchOut && matchSt;
      }),
    [outletOrders, outboundSearch, outboundOutletFilter, outboundStageFilter]
  );

  const prStats = useMemo(() => {
    const pending = outletOrders.filter((o) => !o.poId && o.status !== 'PO Generated').length;
    const merged = outletOrders.filter((o) => !!o.poId || o.status === 'PO Generated').length;
    const totalVal = outletOrders.reduce((s, o) => s + o.totalAmount, 0);
    return { total: outletOrders.length, pending, merged, totalVal };
  }, [outletOrders]);

  const filteredPR = useMemo(
    () =>
      outletOrders.filter((o) => {
        const matchQ =
          !prSearch ||
          o.id.toLowerCase().includes(prSearch.toLowerCase()) ||
          o.outletName.toLowerCase().includes(prSearch.toLowerCase()) ||
          (o.poId || '').toLowerCase().includes(prSearch.toLowerCase());
        const isMerged = !!o.poId || o.status === 'PO Generated';
        const matchSt =
          prStageFilter === 'all' ||
          (prStageFilter === 'pending' && !isMerged) ||
          (prStageFilter === 'merged' && isMerged);
        return matchQ && matchSt;
      }),
    [outletOrders, prSearch, prStageFilter]
  );

  const poStats = useMemo(() => {
    const purchasing = purchaseOrders.filter((p) =>
      ['Draft PO', 'Submitted to Purchasing', 'Vendor Summary'].includes(p.status)
    ).length;
    const reviewCC = purchaseOrders.filter((p) => p.status === 'Review Cost Control').length;
    const approvedCC = purchaseOrders.filter((p) => p.status === 'Approved by Cost Control').length;
    const rejectedCC = purchaseOrders.filter((p) => p.status === 'Rejected by Cost Control').length;
    const released = purchaseOrders.filter((p) =>
      ['Submitted to Vendor', 'Approved by Vendor', 'Sent to Receiving', 'Completed'].includes(p.status)
    ).length;
    const totalVal = purchaseOrders.reduce((s, p) => s + p.totalAmount, 0);
    return { total: purchaseOrders.length, purchasing, reviewCC, approvedCC, rejectedCC, released, totalVal };
  }, [purchaseOrders]);

  const filteredPO = useMemo(
    () =>
      purchaseOrders.filter((po) => {
        const vNames = po.items.map((i) => i.vendorName || '').join(' ');
        const matchQ =
          !poSearch ||
          po.id.toLowerCase().includes(poSearch.toLowerCase()) ||
          po.status.toLowerCase().includes(poSearch.toLowerCase()) ||
          vNames.toLowerCase().includes(poSearch.toLowerCase());
        let matchSt = true;
        if (poStageFilter === 'purchasing')
          matchSt = ['Draft PO', 'Submitted to Purchasing', 'Vendor Summary'].includes(po.status);
        else if (poStageFilter === 'cost-control') matchSt = po.status === 'Review Cost Control';
        else if (poStageFilter === 'approved') matchSt = po.status === 'Approved by Cost Control';
        else if (poStageFilter === 'rejected') matchSt = po.status === 'Rejected by Cost Control';
        else if (poStageFilter === 'released')
          matchSt = ['Submitted to Vendor', 'Approved by Vendor', 'Sent to Receiving', 'Completed'].includes(po.status);
        return matchQ && matchSt;
      }),
    [purchaseOrders, poSearch, poStageFilter]
  );

  if (effectivePosition === 'Outlet') {
    return (
      <div className="space-y-4">
        {currentUser.position === 'Administrator' && (
          <div className="bg-slate-900 text-white px-4 py-2.5 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              <span>
                Mode Pratinjau Kategori Dashboard: <strong>Outlet</strong>
              </span>
            </div>
            <button
              type="button"
              onClick={() => setPreviewRole(null)}
              className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold transition cursor-pointer"
            >
              Kembali ke Dashboard Administrator
            </button>
          </div>
        )}
        <OutletDashboard
          onNavigateToOrderForm={onNavigateToOrderForm}
          onViewOrderDetails={onViewOrderDetails}
        />
      </div>
    );
  }

  const config = ROLE_CONFIGS[effectivePosition] || ROLE_CONFIGS.Administrator;
  const visibleSections =
    activeSectionFilter === 'all'
      ? config.sections
      : config.sections.includes(activeSectionFilter)
      ? [activeSectionFilter]
      : config.sections;

  return (
    <div className="space-y-6">
      {/* Top Role Banner */}
      <div className={`bg-gradient-to-r ${config.gradient} rounded-2xl text-white p-6 shadow-md`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 text-[11px] font-bold rounded-md bg-white/15 text-amber-300 border border-white/20">
                {config.badge}
              </span>
              <span className="text-slate-300 text-xs">
                User: <strong className="text-white">{currentUser.username}</strong> ({effectivePosition})
              </span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white">{config.title}</h1>
            <p className="text-xs text-slate-300 mt-1 max-w-3xl">{config.subtitle}</p>
          </div>

          {currentUser.position === 'Administrator' && (
            <div className="bg-white/10 backdrop-blur-md p-3 rounded-xl border border-white/20 shrink-0">
              <label className="block text-[10px] text-amber-200 font-bold uppercase mb-1">
                Pratinjau Dashboard Kategori User:
              </label>
              <select
                value={effectivePosition}
                onChange={(e) => {
                  setPreviewRole(e.target.value as UserPosition);
                  setActiveSectionFilter('all');
                }}
                className="bg-slate-900/90 text-white text-xs font-semibold rounded-lg px-3 py-1.5 border border-amber-400/40 outline-hidden cursor-pointer"
              >
                <option value="Administrator">Dashboard Administrator (5 Modul)</option>
                <option value="Outlet">Dashboard Outlet (Sesuai Eksisting)</option>
                <option value="Storage Inbound">Dashboard Storage-Inbound (2 Modul)</option>
                <option value="Storage-Mailer">Dashboard Storage-Mailer (1 Modul)</option>
                <option value="Storage Outbond">Dashboard Storage-Outbond (2 Modul)</option>
                <option value="Purchasing">Dashboard Purchasing (3 Modul)</option>
                <option value="Cost Control">Dashboard Cost Control (3 Modul)</option>
              </select>
            </div>
          )}
        </div>

        <div className="mt-5 pt-4 border-t border-white/15 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold text-slate-300 mr-1">
            Modul Aktif ({config.sections.length}):
          </span>
          {config.sections.length > 1 && (
            <button
              type="button"
              onClick={() => setActiveSectionFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeSectionFilter === 'all'
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              Semua ({config.sections.length})
            </button>
          )}
          {config.sections.map((secId) => {
            const meta = SECTION_LABELS[secId];
            const Icon = meta.icon;
            const isSel = activeSectionFilter === secId;
            return (
              <button
                key={secId}
                type="button"
                onClick={() =>
                  setActiveSectionFilter(isSel && config.sections.length > 1 ? 'all' : secId)
                }
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  isSel ? 'bg-amber-500 text-slate-950' : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{meta.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 1. REPORT INVENTORY MANAGEMENT */}
      {visibleSections.includes('inventory-report') && (
        <section className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-6 py-4 bg-emerald-50/60 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-extrabold text-slate-900">Report Inventory Management</h2>
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-800">
                    {formatPeriodLabel(selectedPeriod)}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Ringkasan saldo persediaan gudang pusat, nilai Inbound/Outbond, dan peringatan stok kritis.
                </p>
              </div>
            </div>
            {canAccess('Master Inventory') && (
              <button
                type="button"
                onClick={() => onNavigateTab('master-inventory')}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition cursor-pointer self-start sm:self-auto"
              >
                <span>Master Inventory</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 bg-slate-50/50 border-b border-slate-100 text-xs">
            <div className="p-3 rounded-xl bg-white border border-slate-200">
              <div className="text-[10px] font-bold uppercase text-slate-400">Total SKU</div>
              <div className="text-base font-black text-slate-900 mt-0.5">{invStats.totalSku} SKU</div>
            </div>
            <div className="p-3 rounded-xl bg-white border border-slate-200">
              <div className="text-[10px] font-bold uppercase text-slate-400">Saldo Awal</div>
              <div className="text-xs font-black text-slate-900 mt-1">{formatRupiah(invStats.begVal)}</div>
            </div>
            <div className="p-3 rounded-xl bg-white border border-slate-200">
              <div className="text-[10px] font-bold uppercase text-blue-600">Nilai Inbound</div>
              <div className="text-xs font-black text-blue-700 mt-1">{formatRupiah(invStats.inVal)}</div>
            </div>
            <div className="p-3 rounded-xl bg-white border border-slate-200">
              <div className="text-[10px] font-bold uppercase text-amber-600">Nilai Outbond</div>
              <div className="text-xs font-black text-amber-700 mt-1">{formatRupiah(invStats.outVal)}</div>
            </div>
            <div className="p-3 rounded-xl bg-white border border-slate-200">
              <div className="text-[10px] font-bold uppercase text-emerald-600">Nilai Ending</div>
              <div className="text-xs font-black text-emerald-700 mt-1">{formatRupiah(invStats.endVal)}</div>
            </div>
            <button
              type="button"
              onClick={() => setInvStatusFilter(invStatusFilter === 'low' ? 'all' : 'low')}
              className={`text-left p-3 rounded-xl border transition cursor-pointer ${
                invStatusFilter === 'low' ? 'bg-rose-50 border-rose-400' : 'bg-white border-rose-200'
              }`}
            >
              <div className="text-[10px] font-bold uppercase text-rose-600 flex items-center justify-between">
                <span>Low Stock</span>
                <AlertTriangle className="w-3.5 h-3.5" />
              </div>
              <div className="text-base font-black text-rose-700 mt-0.5">{invStats.lowStock} Item</div>
            </button>
          </div>

          <div className="p-3 border-b border-slate-200 flex flex-col sm:flex-row gap-2 text-xs">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={invSearch}
                onChange={(e) => setInvSearch(e.target.value)}
                placeholder="Cari SKU atau Nama Barang..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs outline-hidden"
              />
            </div>
            <select
              value={invCategoryFilter}
              onChange={(e) => setInvCategoryFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold"
            >
              <option value="all">Semua Kategori</option>
              {ITEM_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              value={invStatusFilter}
              onChange={(e) => setInvStatusFilter(e.target.value as any)}
              className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold"
            >
              <option value="all">Semua Status Stok</option>
              <option value="low">Low Stock ({invStats.lowStock})</option>
              <option value="safe">Stok Aman</option>
            </select>
          </div>

          <div className="overflow-x-auto max-h-80">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-600 uppercase font-bold sticky top-0 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2.5">SKU</th>
                  <th className="px-4 py-2.5">Nama Barang</th>
                  <th className="px-4 py-2.5">Kategori</th>
                  <th className="px-4 py-2.5 text-right">Saldo Awal</th>
                  <th className="px-4 py-2.5 text-right">Inbound</th>
                  <th className="px-4 py-2.5 text-right">Outbond</th>
                  <th className="px-4 py-2.5 text-right">Ending Stok</th>
                  <th className="px-4 py-2.5 text-right">Nilai Ending</th>
                  <th className="px-4 py-2.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInventory.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-6 text-center text-slate-400">
                      Tidak ada item inventori yang sesuai filter.
                    </td>
                  </tr>
                ) : (
                  filteredInventory.slice(0, 20).map((it) => {
                    const low = isItemLowStock(it);
                    const endVal = it.endingValue ?? it.endingInventory * (it.priceBudget || it.price || 0);
                    return (
                      <tr key={it.sku} className="hover:bg-slate-50">
                        <td className="px-4 py-2 font-mono font-bold text-slate-800">{it.sku}</td>
                        <td className="px-4 py-2 font-semibold text-slate-900">{it.itemName}</td>
                        <td className="px-4 py-2 text-slate-600">{it.category}</td>
                        <td className="px-4 py-2 text-right">{it.beginningInventory} {it.unit}</td>
                        <td className="px-4 py-2 text-right font-semibold text-blue-700">+{it.inbound}</td>
                        <td className="px-4 py-2 text-right font-semibold text-amber-700">-{it.outbond}</td>
                        <td className="px-4 py-2 text-right font-bold text-slate-900">
                          {it.endingInventory} {it.unit}
                        </td>
                        <td className="px-4 py-2 text-right font-bold text-emerald-700">
                          {formatRupiah(endVal)}
                        </td>
                        <td className="px-4 py-2 text-center">
                          {low ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                              Low Stock
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              Aman
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* 2. REPORT PENERIMAAN BARANG / INBOUND */}
      {visibleSections.includes('inbound-report') && (
        <section className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-6 py-4 bg-blue-50/60 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center">
                <ArrowDownToLine className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-slate-900">
                  Report Penerimaan Barang / Inbound
                </h2>
                <p className="text-xs text-slate-500">
                  Monitoring penerimaan barang masuk dari PO Vendor (Released to Vendor) serta Manual Inbound.
                </p>
              </div>
            </div>
            {canAccess('Inbound') && (
              <button
                type="button"
                onClick={() => onNavigateTab('inbound')}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition cursor-pointer self-start sm:self-auto"
              >
                <span>Modul Inbound</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="p-4 grid grid-cols-2 sm:grid-cols-5 gap-3 bg-slate-50/50 border-b border-slate-100 text-xs">
            <button
              type="button"
              onClick={() => setInboundStatusFilter('all')}
              className="text-left p-3 rounded-xl bg-white border border-slate-200 cursor-pointer"
            >
              <div className="text-[10px] font-bold uppercase text-slate-400">Total Form Inbound</div>
              <div className="text-base font-black text-slate-900 mt-0.5">{inboundStats.total} Form</div>
            </button>
            <button
              type="button"
              onClick={() => setInboundStatusFilter('Menunggu Kedatangan')}
              className="text-left p-3 rounded-xl bg-white border border-amber-200 cursor-pointer"
            >
              <div className="text-[10px] font-bold uppercase text-amber-600">Menunggu Kedatangan</div>
              <div className="text-base font-black text-amber-700 mt-0.5">{inboundStats.waiting} Form</div>
            </button>
            <button
              type="button"
              onClick={() => setInboundStatusFilter('Diterima Sebagian')}
              className="text-left p-3 rounded-xl bg-white border border-sky-200 cursor-pointer"
            >
              <div className="text-[10px] font-bold uppercase text-sky-600">Diterima Sebagian</div>
              <div className="text-base font-black text-sky-700 mt-0.5">{inboundStats.partial} Form</div>
            </button>
            <button
              type="button"
              onClick={() => setInboundStatusFilter('Diterima Keseluruhan')}
              className="text-left p-3 rounded-xl bg-white border border-emerald-200 cursor-pointer"
            >
              <div className="text-[10px] font-bold uppercase text-emerald-600">Diterima Lengkap</div>
              <div className="text-base font-black text-emerald-700 mt-0.5">{inboundStats.done} Form</div>
            </button>
            <div className="p-3 rounded-xl bg-white border border-slate-200">
              <div className="text-[10px] font-bold uppercase text-blue-600">Nilai Diterima</div>
              <div className="text-xs font-black text-blue-700 mt-1">{formatRupiah(inboundStats.rcvVal)}</div>
            </div>
          </div>

          <div className="p-3 border-b border-slate-200 flex flex-col sm:flex-row gap-2 text-xs">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={inboundSearch}
                onChange={(e) => setInboundSearch(e.target.value)}
                placeholder="Cari ID Receiving, Nomor PO Vendor, atau Nama Vendor..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs outline-hidden"
              />
            </div>
            <select
              value={inboundStatusFilter}
              onChange={(e) => setInboundStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold"
            >
              <option value="all">Semua Status Penerimaan</option>
              <option value="Menunggu Kedatangan">Menunggu Kedatangan</option>
              <option value="Diterima Sebagian">Diterima Sebagian</option>
              <option value="Diterima Keseluruhan">Diterima Keseluruhan</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-600 uppercase font-bold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2.5">ID Receiving</th>
                  <th className="px-4 py-2.5">No. PO Vendor</th>
                  <th className="px-4 py-2.5">Vendor</th>
                  <th className="px-4 py-2.5">Tanggal</th>
                  <th className="px-4 py-2.5 text-center">Progress Qty</th>
                  <th className="px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInbound.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                      Belum ada data penerimaan barang (Inbound) yang sesuai filter.
                    </td>
                  </tr>
                ) : (
                  filteredInbound.map((rec) => {
                    const isExp = expandedInboundId === rec.id;
                    const ordQty = rec.items.reduce((s, i) => s + i.orderedQty, 0);
                    const rcvQty = rec.items.reduce((s, i) => s + i.receivedQty, 0);
                    return (
                      <React.Fragment key={rec.id}>
                        <tr
                          onClick={() => setExpandedInboundId(isExp ? null : rec.id)}
                          className="hover:bg-blue-50/40 cursor-pointer"
                        >
                          <td className="px-4 py-2.5 font-mono font-bold text-blue-900 flex items-center gap-1">
                            {isExp ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            {rec.id}
                          </td>
                          <td className="px-4 py-2.5 font-mono">{rec.poVendorId}</td>
                          <td className="px-4 py-2.5 font-bold text-slate-900">{rec.vendorName}</td>
                          <td className="px-4 py-2.5 text-slate-600">{formatDate(rec.receiveDate)}</td>
                          <td className="px-4 py-2.5 text-center font-bold">
                            {rcvQty} / {ordQty} ({rec.items.length} SKU)
                          </td>
                          <td className="px-4 py-2.5">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                rec.status === 'Diterima Keseluruhan'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : rec.status === 'Diterima Sebagian'
                                  ? 'bg-sky-100 text-sky-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {rec.status}
                            </span>
                          </td>
                        </tr>
                        {isExp && (
                          <tr className="bg-blue-50/20">
                            <td colSpan={6} className="p-3">
                              <div className="bg-white rounded-xl border border-blue-200 p-3">
                                <table className="w-full text-left text-xs">
                                  <thead className="bg-slate-50 border-b">
                                    <tr>
                                      <th className="px-2 py-1">SKU</th>
                                      <th className="px-2 py-1">Nama Barang</th>
                                      <th className="px-2 py-1 text-center">Qty PO</th>
                                      <th className="px-2 py-1 text-center">Qty Diterima</th>
                                      <th className="px-2 py-1 text-center">Pending</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {rec.items.map((it) => (
                                      <tr key={it.sku}>
                                        <td className="px-2 py-1 font-mono font-bold">{it.sku}</td>
                                        <td className="px-2 py-1">{it.itemName}</td>
                                        <td className="px-2 py-1 text-center">{it.orderedQty} {it.unit}</td>
                                        <td className="px-2 py-1 text-center font-bold text-emerald-700">
                                          {it.receivedQty} {it.unit}
                                        </td>
                                        <td className="px-2 py-1 text-center font-bold text-amber-700">
                                          {it.pendingQty} {it.unit}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
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
        </section>
      )}

      {/* 3. REPORT PENGIRIMAN BARANG KE OUTLET */}
      {visibleSections.includes('outbound-report') && (
        <section className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-6 py-4 bg-amber-50/60 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-slate-900">
                  Report Pengiriman Barang ke Outlet
                </h2>
                <p className="text-xs text-slate-500">
                  Laporan distribusi dan pengiriman barang dari Gudang Pusat ke jaringan outlet & departemen.
                </p>
              </div>
            </div>
            {(canAccess('Outbond') || canAccess('Deployment')) && (
              <button
                type="button"
                onClick={() => onNavigateTab('outbond')}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition cursor-pointer self-start sm:self-auto"
              >
                <span>Modul Outbond</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="p-4 grid grid-cols-2 sm:grid-cols-5 gap-3 bg-slate-50/50 border-b border-slate-100 text-xs">
            <button
              type="button"
              onClick={() => setOutboundStageFilter('all')}
              className="text-left p-3 rounded-xl bg-white border border-slate-200 cursor-pointer"
            >
              <div className="text-[10px] font-bold uppercase text-slate-400">Total Form Kirim</div>
              <div className="text-base font-black text-slate-900 mt-0.5">{outboundStats.total} Form</div>
            </button>
            <button
              type="button"
              onClick={() => setOutboundStageFilter('waiting')}
              className="text-left p-3 rounded-xl bg-white border border-indigo-200 cursor-pointer"
            >
              <div className="text-[10px] font-bold uppercase text-indigo-600">Diproses Gudang</div>
              <div className="text-base font-black text-indigo-700 mt-0.5">{outboundStats.waiting} Form</div>
            </button>
            <button
              type="button"
              onClick={() => setOutboundStageFilter('ready')}
              className="text-left p-3 rounded-xl bg-white border border-amber-200 cursor-pointer"
            >
              <div className="text-[10px] font-bold uppercase text-amber-600">Siap Dikirim</div>
              <div className="text-base font-black text-amber-700 mt-0.5">{outboundStats.ready} Form</div>
            </button>
            <button
              type="button"
              onClick={() => setOutboundStageFilter('transit')}
              className="text-left p-3 rounded-xl bg-white border border-sky-200 cursor-pointer"
            >
              <div className="text-[10px] font-bold uppercase text-sky-600">PO Terkirim</div>
              <div className="text-base font-black text-sky-700 mt-0.5">{outboundStats.transit} Form</div>
            </button>
            <button
              type="button"
              onClick={() => setOutboundStageFilter('done')}
              className="text-left p-3 rounded-xl bg-white border border-emerald-200 cursor-pointer"
            >
              <div className="text-[10px] font-bold uppercase text-emerald-600">Selesai (Outbond)</div>
              <div className="text-base font-black text-emerald-700 mt-0.5">{outboundStats.done} Form</div>
            </button>
          </div>

          <div className="p-3 border-b border-slate-200 flex flex-col sm:flex-row gap-2 text-xs">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={outboundSearch}
                onChange={(e) => setOutboundSearch(e.target.value)}
                placeholder="Cari Form ID, Outlet Tujuan, atau Departemen..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs outline-hidden"
              />
            </div>
            <select
              value={outboundOutletFilter}
              onChange={(e) => setOutboundOutletFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold"
            >
              <option value="all">Semua Outlet</option>
              {outlets.map((o) => (
                <option key={o.id} value={o.namaOutlet}>
                  {o.namaOutlet}
                </option>
              ))}
            </select>
            <select
              value={outboundStageFilter}
              onChange={(e) => setOutboundStageFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold"
            >
              <option value="all">Semua Status Pengiriman</option>
              <option value="waiting">Diproses Gudang</option>
              <option value="ready">Siap Dikirim</option>
              <option value="transit">Dalam Pengiriman (PO Terkirim)</option>
              <option value="done">Selesai Dikirim (Outbond)</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-600 uppercase font-bold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2.5">Form ID</th>
                  <th className="px-4 py-2.5">Outlet Tujuan</th>
                  <th className="px-4 py-2.5">Departemen</th>
                  <th className="px-4 py-2.5">Tanggal</th>
                  <th className="px-4 py-2.5 text-center">Item</th>
                  <th className="px-4 py-2.5 text-right">Total Nilai</th>
                  <th className="px-4 py-2.5">Status Pengiriman</th>
                  <th className="px-4 py-2.5 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOutbound.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-6 text-center text-slate-400">
                      Belum ada laporan pengiriman barang ke outlet yang sesuai filter.
                    </td>
                  </tr>
                ) : (
                  filteredOutbound.map((ord) => {
                    const isExp = expandedOutboundId === ord.id;
                    return (
                      <React.Fragment key={ord.id}>
                        <tr
                          onClick={() => setExpandedOutboundId(isExp ? null : ord.id)}
                          className="hover:bg-amber-50/40 cursor-pointer"
                        >
                          <td className="px-4 py-2.5 font-mono font-bold text-slate-900 flex items-center gap-1">
                            {isExp ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            {ord.id}
                          </td>
                          <td className="px-4 py-2.5 font-bold text-slate-900">{ord.outletName}</td>
                          <td className="px-4 py-2.5">{ord.department}</td>
                          <td className="px-4 py-2.5 text-slate-600">{formatDate(ord.dateRequested)}</td>
                          <td className="px-4 py-2.5 text-center font-bold">{ord.items.length} SKU</td>
                          <td className="px-4 py-2.5 text-right font-bold">{formatRupiah(ord.totalAmount)}</td>
                          <td className="px-4 py-2.5">
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
                              {ord.status}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => exportOutletOrderToExcel(ord)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-emerald-50 text-emerald-700 font-bold text-[11px] border border-emerald-200 cursor-pointer"
                            >
                              <FileSpreadsheet className="w-3 h-3" /> Excel
                            </button>
                          </td>
                        </tr>
                        {isExp && (
                          <tr className="bg-amber-50/20">
                            <td colSpan={8} className="p-3">
                              <div className="bg-white rounded-xl border border-amber-200 p-3">
                                <table className="w-full text-left text-xs">
                                  <thead className="bg-slate-50 border-b">
                                    <tr>
                                      <th className="px-2 py-1">SKU</th>
                                      <th className="px-2 py-1">Nama Barang</th>
                                      <th className="px-2 py-1 text-center">Qty Dipesan</th>
                                      <th className="px-2 py-1 text-center">Qty Dikirim</th>
                                      <th className="px-2 py-1 text-right">Subtotal</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {ord.items.map((it) => {
                                      const shipped = it.qtyPrepared !== undefined ? it.qtyPrepared : it.qty;
                                      return (
                                        <tr key={it.sku}>
                                          <td className="px-2 py-1 font-mono font-bold">{it.sku}</td>
                                          <td className="px-2 py-1">{it.itemName}</td>
                                          <td className="px-2 py-1 text-center">{it.qty} {it.unit}</td>
                                          <td className="px-2 py-1 text-center font-bold text-emerald-700">
                                            {shipped} {it.unit}
                                          </td>
                                          <td className="px-2 py-1 text-right font-bold">
                                            {formatRupiah(shipped * it.price)}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
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
        </section>
      )}

      {/* 4. STATUS FORM PURCHASE REQUEST */}
      {visibleSections.includes('pr-status') && (
        <section className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-6 py-4 bg-indigo-50/60 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-slate-900">
                  Status Form Purchase Request (PR)
                </h2>
                <p className="text-xs text-slate-500">
                  Pemantauan status form Purchase Request dari outlet hingga digabungkan ke Purchase Order.
                </p>
              </div>
            </div>
            {canAccess('Purchase Request') && (
              <button
                type="button"
                onClick={() => onNavigateTab('purchase-request')}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition cursor-pointer self-start sm:self-auto"
              >
                <span>Purchase Request</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50/50 border-b border-slate-100 text-xs">
            <button
              type="button"
              onClick={() => setPrStageFilter('all')}
              className="text-left p-3 rounded-xl bg-white border border-slate-200 cursor-pointer"
            >
              <div className="text-[10px] font-bold uppercase text-slate-400">Total Form PR</div>
              <div className="text-base font-black text-slate-900 mt-0.5">{prStats.total} Form</div>
            </button>
            <button
              type="button"
              onClick={() => setPrStageFilter('pending')}
              className="text-left p-3 rounded-xl bg-white border border-amber-200 cursor-pointer"
            >
              <div className="text-[10px] font-bold uppercase text-amber-600">Menunggu Generate PO</div>
              <div className="text-base font-black text-amber-700 mt-0.5">{prStats.pending} Form</div>
            </button>
            <button
              type="button"
              onClick={() => setPrStageFilter('merged')}
              className="text-left p-3 rounded-xl bg-white border border-emerald-200 cursor-pointer"
            >
              <div className="text-[10px] font-bold uppercase text-emerald-600">Sudah Masuk PO</div>
              <div className="text-base font-black text-emerald-700 mt-0.5">{prStats.merged} Form</div>
            </button>
            <div className="p-3 rounded-xl bg-white border border-slate-200">
              <div className="text-[10px] font-bold uppercase text-indigo-600">Total Nilai PR</div>
              <div className="text-xs font-black text-indigo-700 mt-1">{formatRupiah(prStats.totalVal)}</div>
            </div>
          </div>

          <div className="p-3 border-b border-slate-200 flex flex-col sm:flex-row gap-2 text-xs">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={prSearch}
                onChange={(e) => setPrSearch(e.target.value)}
                placeholder="Cari Form PR ID, Outlet, atau Ref PO..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs outline-hidden"
              />
            </div>
            <select
              value={prStageFilter}
              onChange={(e) => setPrStageFilter(e.target.value as any)}
              className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold"
            >
              <option value="all">Semua Status PR</option>
              <option value="pending">Menunggu Generate PO ({prStats.pending})</option>
              <option value="merged">Sudah Masuk PO ({prStats.merged})</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-600 uppercase font-bold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2.5">Form PR ID</th>
                  <th className="px-4 py-2.5">Outlet</th>
                  <th className="px-4 py-2.5">Departemen</th>
                  <th className="px-4 py-2.5">Tanggal</th>
                  <th className="px-4 py-2.5 text-right">Total Nilai</th>
                  <th className="px-4 py-2.5">Ref. PO</th>
                  <th className="px-4 py-2.5">Status PR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPR.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-slate-400">
                      Belum ada form Purchase Request yang sesuai filter.
                    </td>
                  </tr>
                ) : (
                  filteredPR.map((pr) => {
                    const isExp = expandedPRId === pr.id;
                    const merged = !!pr.poId || pr.status === 'PO Generated';
                    return (
                      <React.Fragment key={pr.id}>
                        <tr
                          onClick={() => setExpandedPRId(isExp ? null : pr.id)}
                          className="hover:bg-indigo-50/40 cursor-pointer"
                        >
                          <td className="px-4 py-2.5 font-mono font-bold text-slate-900 flex items-center gap-1">
                            {isExp ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            {pr.id}
                          </td>
                          <td className="px-4 py-2.5 font-bold">{pr.outletName}</td>
                          <td className="px-4 py-2.5">{pr.department}</td>
                          <td className="px-4 py-2.5 text-slate-600">{formatDate(pr.dateRequested)}</td>
                          <td className="px-4 py-2.5 text-right font-bold">{formatRupiah(pr.totalAmount)}</td>
                          <td className="px-4 py-2.5 font-mono font-bold text-indigo-700">{pr.poId || '-'}</td>
                          <td className="px-4 py-2.5">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                merged
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {merged ? `Masuk PO (${pr.status})` : `${pr.status} (Menunggu PO)`}
                            </span>
                          </td>
                        </tr>
                        {isExp && (
                          <tr className="bg-indigo-50/20">
                            <td colSpan={7} className="p-3">
                              <div className="bg-white rounded-xl border border-indigo-200 p-3">
                                <table className="w-full text-left text-xs">
                                  <thead className="bg-slate-50 border-b">
                                    <tr>
                                      <th className="px-2 py-1">SKU</th>
                                      <th className="px-2 py-1">Nama Barang</th>
                                      <th className="px-2 py-1 text-center">Qty</th>
                                      <th className="px-2 py-1 text-right">Harga</th>
                                      <th className="px-2 py-1 text-right">Subtotal</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {pr.items.map((it) => (
                                      <tr key={it.sku}>
                                        <td className="px-2 py-1 font-mono font-bold">{it.sku}</td>
                                        <td className="px-2 py-1">{it.itemName}</td>
                                        <td className="px-2 py-1 text-center font-bold">{it.qty} {it.unit}</td>
                                        <td className="px-2 py-1 text-right">{formatRupiah(it.price)}</td>
                                        <td className="px-2 py-1 text-right font-bold">{formatRupiah(it.subtotal)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
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
        </section>
      )}

      {/* 5. STATUS FORM PO VENDOR */}
      {visibleSections.includes('po-vendor-status') && (
        <section className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-6 py-4 bg-rose-50/60 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-slate-900">Status Form PO Vendor</h2>
                <p className="text-xs text-slate-500">
                  Monitoring alur form PO Vendor: Penugasan Vendor, Review Cost Control, Persetujuan, hingga Release ke Vendor & Inbound.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {canAccess('Vendor') && (
                <button
                  type="button"
                  onClick={() => onNavigateTab('vendor')}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition cursor-pointer"
                >
                  <span>Purchasing & Vendor</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              )}
              {canAccess('Cost Control') && (
                <button
                  type="button"
                  onClick={() => onNavigateTab('cost-control')}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition cursor-pointer"
                >
                  <Calculator className="w-3.5 h-3.5" />
                  <span>Cost Control</span>
                </button>
              )}
            </div>
          </div>

          <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 bg-slate-50/50 border-b border-slate-100 text-xs">
            <button
              type="button"
              onClick={() => setPoStageFilter('all')}
              className="text-left p-3 rounded-xl bg-white border border-slate-200 cursor-pointer"
            >
              <div className="text-[10px] font-bold uppercase text-slate-400">Total PO Vendor</div>
              <div className="text-base font-black text-slate-900 mt-0.5">{poStats.total} Form</div>
            </button>
            <button
              type="button"
              onClick={() => setPoStageFilter('purchasing')}
              className="text-left p-3 rounded-xl bg-white border border-indigo-200 cursor-pointer"
            >
              <div className="text-[10px] font-bold uppercase text-indigo-600">Purchasing / Summary</div>
              <div className="text-base font-black text-indigo-700 mt-0.5">{poStats.purchasing} Form</div>
            </button>
            <button
              type="button"
              onClick={() => setPoStageFilter('cost-control')}
              className="text-left p-3 rounded-xl bg-white border border-amber-200 cursor-pointer"
            >
              <div className="text-[10px] font-bold uppercase text-amber-600">Review Cost Control</div>
              <div className="text-base font-black text-amber-700 mt-0.5">{poStats.reviewCC} Form</div>
            </button>
            <button
              type="button"
              onClick={() => setPoStageFilter('approved')}
              className="text-left p-3 rounded-xl bg-white border border-emerald-200 cursor-pointer"
            >
              <div className="text-[10px] font-bold uppercase text-emerald-600">Disetujui CC</div>
              <div className="text-base font-black text-emerald-700 mt-0.5">{poStats.approvedCC} Form</div>
            </button>
            <button
              type="button"
              onClick={() => setPoStageFilter('rejected')}
              className="text-left p-3 rounded-xl bg-white border border-rose-200 cursor-pointer"
            >
              <div className="text-[10px] font-bold uppercase text-rose-600">Ditolak CC</div>
              <div className="text-base font-black text-rose-700 mt-0.5">{poStats.rejectedCC} Form</div>
            </button>
            <button
              type="button"
              onClick={() => setPoStageFilter('released')}
              className="text-left p-3 rounded-xl bg-white border border-blue-200 cursor-pointer"
            >
              <div className="text-[10px] font-bold uppercase text-blue-600">Released ke Vendor</div>
              <div className="text-base font-black text-blue-700 mt-0.5">{poStats.released} Form</div>
            </button>
          </div>

          <div className="p-3 border-b border-slate-200 flex flex-col sm:flex-row gap-2 text-xs">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={poSearch}
                onChange={(e) => setPoSearch(e.target.value)}
                placeholder="Cari Nomor PO, Nama Vendor, atau Status..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs outline-hidden"
              />
            </div>
            <select
              value={poStageFilter}
              onChange={(e) => setPoStageFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold"
            >
              <option value="all">Semua Tahap PO Vendor</option>
              <option value="purchasing">Tahap Purchasing / Vendor Summary</option>
              <option value="cost-control">Review Cost Control</option>
              <option value="approved">Disetujui Cost Control</option>
              <option value="rejected">Ditolak Cost Control</option>
              <option value="released">Released ke Vendor / Inbound</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-600 uppercase font-bold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2.5">Nomor PO</th>
                  <th className="px-4 py-2.5">Tanggal</th>
                  <th className="px-4 py-2.5">Vendor Terkait</th>
                  <th className="px-4 py-2.5 text-center">Item</th>
                  <th className="px-4 py-2.5 text-right">Total Nilai PO</th>
                  <th className="px-4 py-2.5">Status Form PO</th>
                  <th className="px-4 py-2.5 text-center">Ekspor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPO.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-slate-400">
                      Belum ada form PO Vendor yang sesuai filter.
                    </td>
                  </tr>
                ) : (
                  filteredPO.map((po) => {
                    const isExp = expandedPOId === po.id;
                    const vList = Array.from(new Set(po.items.map((i) => i.vendorName).filter(Boolean)));
                    return (
                      <React.Fragment key={po.id}>
                        <tr
                          onClick={() => setExpandedPOId(isExp ? null : po.id)}
                          className="hover:bg-rose-50/40 cursor-pointer"
                        >
                          <td className="px-4 py-2.5 font-mono font-bold text-slate-900 flex items-center gap-1">
                            {isExp ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            {po.id}
                          </td>
                          <td className="px-4 py-2.5 text-slate-600">{formatDate(po.generatedDate)}</td>
                          <td className="px-4 py-2.5 font-semibold text-slate-800">
                            {vList.length > 0 ? vList.join(', ') : <span className="text-slate-400 italic">Belum ditugaskan</span>}
                          </td>
                          <td className="px-4 py-2.5 text-center font-bold">{po.items.length} SKU</td>
                          <td className="px-4 py-2.5 text-right font-bold">{formatRupiah(po.totalAmount)}</td>
                          <td className="px-4 py-2.5">
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800">
                              {po.status}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => exportPOToPDF(po, vendors)}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded bg-rose-50 text-rose-700 font-bold text-[11px] border border-rose-200 cursor-pointer"
                              >
                                <Download className="w-3 h-3" /> PDF
                              </button>
                              <button
                                type="button"
                                onClick={() => exportPOToExcel(po)}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded bg-emerald-50 text-emerald-700 font-bold text-[11px] border border-emerald-200 cursor-pointer"
                              >
                                <FileSpreadsheet className="w-3 h-3" /> Excel
                              </button>
                            </div>
                          </td>
                        </tr>
                        {isExp && (
                          <tr className="bg-rose-50/20">
                            <td colSpan={7} className="p-3">
                              <div className="bg-white rounded-xl border border-rose-200 p-3">
                                <table className="w-full text-left text-xs">
                                  <thead className="bg-slate-50 border-b">
                                    <tr>
                                      <th className="px-2 py-1">SKU</th>
                                      <th className="px-2 py-1">Nama Barang</th>
                                      <th className="px-2 py-1">Vendor</th>
                                      <th className="px-2 py-1 text-center">Qty</th>
                                      <th className="px-2 py-1 text-right">Harga</th>
                                      <th className="px-2 py-1 text-right">Total</th>
                                      <th className="px-2 py-1 text-center">Status CC</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {po.items.map((it, idx) => (
                                      <tr key={`${it.sku}-${idx}`}>
                                        <td className="px-2 py-1 font-mono font-bold">{it.sku}</td>
                                        <td className="px-2 py-1">{it.itemName}</td>
                                        <td className="px-2 py-1 font-semibold">{it.vendorName || '-'}</td>
                                        <td className="px-2 py-1 text-center font-bold">{it.qty} {it.unit}</td>
                                        <td className="px-2 py-1 text-right">{formatRupiah(it.price)}</td>
                                        <td className="px-2 py-1 text-right font-bold">{formatRupiah(it.total)}</td>
                                        <td className="px-2 py-1 text-center">{it.approvalStatus || 'Pending'}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
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
        </section>
      )}
    </div>
  );
};
