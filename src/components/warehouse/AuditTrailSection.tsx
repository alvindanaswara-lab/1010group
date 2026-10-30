import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import {
  AuditActionCategory,
  AuditDepartmentScope,
  AuditLogEntry,
  AuditModuleName,
  AuditSeverity,
} from '../../types';
import { formatDate } from '../../utils/dateUtils';
import { exportAuditTrailToPDF } from '../../utils/pdfExport';
import {
  ShieldCheck,
  Search,
  Filter,
  FileDown,
  Calendar,
  ArrowUpDown,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Info,
  Clock,
  UserCheck,
  Building2,
  Layers,
  FileText,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  X,
  PlusCircle,
  ListFilter,
  Activity,
} from 'lucide-react';

const DEPARTMENT_FILTERS: { label: string; value: string }[] = [
  { label: 'Semua Departemen', value: 'all' },
  { label: 'Kitchen', value: 'Kitchen' },
  { label: 'Bar', value: 'Bar' },
  { label: 'Pastry', value: 'Pastry' },
  { label: 'Floor & Operations', value: 'Floor & Operations' },
  { label: 'Central Warehouse', value: 'Central Warehouse' },
  { label: 'Purchasing & Finance', value: 'Purchasing & Finance' },
];

const MODULE_FILTERS: { label: string; value: string }[] = [
  { label: 'Semua Modul', value: 'all' },
  { label: 'Cost Control', value: 'Cost Control' },
  { label: 'Purchasing & Vendor', value: 'Purchasing & Vendor' },
  { label: 'Inbound', value: 'Inbound' },
  { label: 'Outbond', value: 'Outbond' },
  { label: 'Master Inventory', value: 'Master Inventory' },
  { label: 'Order Outlet', value: 'Order Outlet' },
  { label: 'Purchase Request', value: 'Purchase Request' },
];

export const AuditTrailSection: React.FC = () => {
  const { auditLogs, addAuditLog, currentUser, outlets } = useApp();

  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [moduleFilter, setModuleFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [viewMode, setViewMode] = useState<'table' | 'timeline'>('table');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  // Modal state for adding manual audit/compliance note
  const [showAddNoteModal, setShowAddNoteModal] = useState<boolean>(false);
  const [noteCategory, setNoteCategory] = useState<AuditActionCategory>('Stock Adjustment');
  const [noteModule, setNoteModule] = useState<AuditModuleName>('Master Inventory');
  const [noteDepartment, setNoteDepartment] = useState<AuditDepartmentScope>('Kitchen');
  const [noteOutlet, setNoteOutlet] = useState<string>('');
  const [noteAction, setNoteAction] = useState<string>('');
  const [noteRefId, setNoteRefId] = useState<string>('');
  const [noteDescription, setNoteDescription] = useState<string>('');
  const [noteSeverity, setNoteSeverity] = useState<AuditSeverity>('Info');
  const [noteField, setNoteField] = useState<string>('');
  const [noteBefore, setNoteBefore] = useState<string>('');
  const [noteAfter, setNoteAfter] = useState<string>('');

  // Filtered and sorted logs
  const filteredLogs = useMemo(() => {
    return auditLogs
      .filter((log) => {
        if (categoryFilter !== 'all' && log.category !== categoryFilter) return false;
        if (departmentFilter !== 'all' && log.department !== departmentFilter && log.department !== 'All Departments') {
          return false;
        }
        if (moduleFilter !== 'all' && log.module !== moduleFilter) return false;
        if (severityFilter !== 'all' && log.severity !== severityFilter) return false;
        if (dateFilter && log.timestamp.slice(0, 10) !== dateFilter) return false;

        if (searchQuery.trim() !== '') {
          const q = searchQuery.toLowerCase();
          const matchAction = log.action.toLowerCase().includes(q);
          const matchDesc = log.description.toLowerCase().includes(q);
          const matchActor = log.actorName.toLowerCase().includes(q);
          const matchRole = log.actorRole.toLowerCase().includes(q);
          const matchRef = (log.referenceId || '').toLowerCase().includes(q);
          const matchDept = log.department.toLowerCase().includes(q);
          const matchOutlet = (log.outletName || '').toLowerCase().includes(q);
          const matchId = log.id.toLowerCase().includes(q);
          if (
            !matchAction &&
            !matchDesc &&
            !matchActor &&
            !matchRole &&
            !matchRef &&
            !matchDept &&
            !matchOutlet &&
            !matchId
          ) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => {
        const tA = new Date(a.timestamp).getTime();
        const tB = new Date(b.timestamp).getTime();
        return sortOrder === 'desc' ? tB - tA : tA - tB;
      });
  }, [
    auditLogs,
    categoryFilter,
    departmentFilter,
    moduleFilter,
    severityFilter,
    dateFilter,
    searchQuery,
    sortOrder,
  ]);

  // Counts for KPI cards
  const countAll = auditLogs.length;
  const countApprovals = auditLogs.filter((l) => l.category === 'Order Approval').length;
  const countStockAdjustments = auditLogs.filter((l) => l.category === 'Stock Adjustment').length;
  const countOrderLifecycle = auditLogs.filter((l) => l.category === 'Order Lifecycle').length;

  const getSeverityBadge = (severity: AuditSeverity) => {
    switch (severity) {
      case 'Success':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Approved / Verified
          </span>
        );
      case 'Warning':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
            <AlertTriangle className="w-3 h-3 text-amber-600" />
            Adjustment / Review
          </span>
        );
      case 'Critical':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
            <AlertCircle className="w-3 h-3 text-rose-600" />
            Rejected / Rollback
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
            <Info className="w-3 h-3 text-blue-600" />
            Recorded
          </span>
        );
    }
  };

  const getCategoryBadge = (category: AuditActionCategory) => {
    switch (category) {
      case 'Order Approval':
        return 'bg-purple-50 text-purple-800 border-purple-200';
      case 'Stock Adjustment':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'Order Lifecycle':
        return 'bg-indigo-50 text-indigo-800 border-indigo-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const getDepartmentBadge = (dept: AuditDepartmentScope) => {
    switch (dept) {
      case 'Kitchen':
        return 'bg-orange-50 text-orange-800 border-orange-200';
      case 'Bar':
        return 'bg-sky-50 text-sky-800 border-sky-200';
      case 'Pastry':
        return 'bg-pink-50 text-pink-800 border-pink-200';
      case 'Floor & Operations':
        return 'bg-teal-50 text-teal-800 border-teal-200';
      case 'Central Warehouse':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'Purchasing & Finance':
        return 'bg-indigo-50 text-indigo-800 border-indigo-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-300';
    }
  };

  const handleAddManualAuditNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteAction.trim() || !noteDescription.trim()) return;

    const changes =
      noteField.trim() !== ''
        ? [
            {
              field: noteField.trim(),
              before: noteBefore.trim() || '-',
              after: noteAfter.trim() || '-',
            },
          ]
        : undefined;

    addAuditLog({
      module: noteModule,
      category: noteCategory,
      action: noteAction.trim(),
      referenceId: noteRefId.trim() || undefined,
      department: noteDepartment,
      outletName: noteOutlet || undefined,
      description: noteDescription.trim(),
      severity: noteSeverity,
      changes,
    });

    setNoteAction('');
    setNoteRefId('');
    setNoteDescription('');
    setNoteField('');
    setNoteBefore('');
    setNoteAfter('');
    setShowAddNoteModal(false);
  };

  const formatTimestamp = (iso: string) => {
    const dt = new Date(iso);
    const datePart = formatDate(iso.slice(0, 10));
    const timePart = dt.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    return { datePart, timePart };
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Header */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-slate-900 text-amber-400 flex items-center justify-center shadow-sm shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-extrabold text-slate-900">
                  Audit Trail & Log Aktivitas Operasional
                </h1>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                  Cross-Department Accountability
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Rekam jejak otomatis untuk setiap persetujuan order (Cost Control & Purchasing), penyesuaian stok fisik (Stock Opname, Inbound, Outbond), serta aktivitas lintas departemen (Kitchen, Bar, Pastry, Floor & Operations).
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Toggle View Mode */}
            <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-white text-slate-900 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tabel Detail
              </button>
              <button
                type="button"
                onClick={() => setViewMode('timeline')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  viewMode === 'timeline'
                    ? 'bg-white text-slate-900 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Timeline Kronologis
              </button>
            </div>

            {/* Add Manual Audit Note */}
            <button
              type="button"
              onClick={() => setShowAddNoteModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs shadow-2xs transition cursor-pointer"
              title="Catat berita acara atau log audit manual"
            >
              <PlusCircle className="w-3.5 h-3.5 text-amber-600" />
              <span>Catat Log Audit</span>
            </button>

            {/* Export PDF Report */}
            <button
              type="button"
              onClick={() =>
                exportAuditTrailToPDF(filteredLogs, {
                  categoryFilter,
                  departmentFilter,
                  moduleFilter,
                  searchQuery,
                })
              }
              disabled={filteredLogs.length === 0}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xs shadow-xs transition cursor-pointer disabled:cursor-not-allowed"
              title="Unduh Laporan Audit Trail ke PDF"
            >
              <FileDown className="w-3.5 h-3.5 text-amber-400" />
              <span>Export Audit PDF ({filteredLogs.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Category Summary Filter Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div
          role="button"
          tabIndex={0}
          onClick={() => setCategoryFilter('all')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setCategoryFilter('all');
            }
          }}
          className={`p-4 rounded-2xl border transition cursor-pointer select-none ${
            categoryFilter === 'all'
              ? 'bg-slate-900 text-white border-slate-900 ring-2 ring-slate-900/20 shadow-sm'
              : 'bg-white text-slate-900 border-slate-200 hover:border-slate-300 hover:bg-slate-50/70'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span
              className={`text-[10px] font-extrabold uppercase tracking-wider ${
                categoryFilter === 'all' ? 'text-amber-400' : 'text-slate-500'
              }`}
            >
              Semua Aktivitas Audit
            </span>
            <Activity
              className={`w-4 h-4 ${categoryFilter === 'all' ? 'text-amber-400' : 'text-slate-400'}`}
            />
          </div>
          <div className="text-2xl font-black mt-1">{countAll} Log</div>
          <p
            className={`text-[11px] mt-1 ${
              categoryFilter === 'all' ? 'text-slate-300' : 'text-slate-500'
            }`}
          >
            Seluruh aktivitas lintas departemen
          </p>
        </div>

        <div
          role="button"
          tabIndex={0}
          onClick={() =>
            setCategoryFilter((prev) => (prev === 'Order Approval' ? 'all' : 'Order Approval'))
          }
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setCategoryFilter((prev) => (prev === 'Order Approval' ? 'all' : 'Order Approval'));
            }
          }}
          className={`p-4 rounded-2xl border transition cursor-pointer select-none ${
            categoryFilter === 'Order Approval'
              ? 'bg-purple-100 border-purple-500 ring-2 ring-purple-500/30 shadow-sm'
              : 'bg-purple-50/60 border-purple-200 hover:bg-purple-100/60'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-800">
              Order Approvals & Otorisasi
            </span>
            {categoryFilter === 'Order Approval' ? (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-purple-700 text-white">
                <Filter className="w-2.5 h-2.5" />
                Aktif
              </span>
            ) : (
              <CheckCircle2 className="w-4 h-4 text-purple-600" />
            )}
          </div>
          <div className="text-2xl font-black text-purple-950 mt-1">{countApprovals} Log</div>
          <p className="text-[11px] text-purple-700 mt-1">
            Approve/Reject Cost Control, Release PO & Dispatch
          </p>
        </div>

        <div
          role="button"
          tabIndex={0}
          onClick={() =>
            setCategoryFilter((prev) => (prev === 'Stock Adjustment' ? 'all' : 'Stock Adjustment'))
          }
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setCategoryFilter((prev) =>
                prev === 'Stock Adjustment' ? 'all' : 'Stock Adjustment'
              );
            }
          }}
          className={`p-4 rounded-2xl border transition cursor-pointer select-none ${
            categoryFilter === 'Stock Adjustment'
              ? 'bg-emerald-100 border-emerald-500 ring-2 ring-emerald-500/30 shadow-sm'
              : 'bg-emerald-50/60 border-emerald-200 hover:bg-emerald-100/60'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800">
              Stock Adjustments & Opname
            </span>
            {categoryFilter === 'Stock Adjustment' ? (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-700 text-white">
                <Filter className="w-2.5 h-2.5" />
                Aktif
              </span>
            ) : (
              <Layers className="w-4 h-4 text-emerald-600" />
            )}
          </div>
          <div className="text-2xl font-black text-emerald-950 mt-1">
            {countStockAdjustments} Log
          </div>
          <p className="text-[11px] text-emerald-700 mt-1">
            Stock Opname, Penerimaan Inbound & Potong Stok Outbond
          </p>
        </div>

        <div
          role="button"
          tabIndex={0}
          onClick={() =>
            setCategoryFilter((prev) => (prev === 'Order Lifecycle' ? 'all' : 'Order Lifecycle'))
          }
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setCategoryFilter((prev) => (prev === 'Order Lifecycle' ? 'all' : 'Order Lifecycle'));
            }
          }}
          className={`p-4 rounded-2xl border transition cursor-pointer select-none ${
            categoryFilter === 'Order Lifecycle'
              ? 'bg-indigo-100 border-indigo-500 ring-2 ring-indigo-500/30 shadow-sm'
              : 'bg-indigo-50/60 border-indigo-200 hover:bg-indigo-100/60'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-800">
              Siklus Order & Pengadaan
            </span>
            {categoryFilter === 'Order Lifecycle' ? (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-indigo-700 text-white">
                <Filter className="w-2.5 h-2.5" />
                Aktif
              </span>
            ) : (
              <FileText className="w-4 h-4 text-indigo-600" />
            )}
          </div>
          <div className="text-2xl font-black text-indigo-950 mt-1">{countOrderLifecycle} Log</div>
          <p className="text-[11px] text-indigo-700 mt-1">
            Pengajuan PR Outlet, Konsolidasi & Alokasi PO Vendor
          </p>
        </div>
      </div>

      {/* Main Content Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
        {/* Department Filter Pills */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold text-slate-500 mr-1 flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
              Filter Departemen:
            </span>
            {DEPARTMENT_FILTERS.map((dept) => {
              const isActive = departmentFilter === dept.value;
              return (
                <button
                  key={dept.value}
                  type="button"
                  onClick={() => setDepartmentFilter(dept.value)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer border ${
                    isActive
                      ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  {dept.label}
                </button>
              );
            })}
          </div>

          {(categoryFilter !== 'all' ||
            departmentFilter !== 'all' ||
            moduleFilter !== 'all' ||
            severityFilter !== 'all' ||
            dateFilter !== '' ||
            searchQuery.trim() !== '') && (
            <button
              type="button"
              onClick={() => {
                setCategoryFilter('all');
                setDepartmentFilter('all');
                setModuleFilter('all');
                setSeverityFilter('all');
                setDateFilter('');
                setSearchQuery('');
              }}
              className="text-xs font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1 shrink-0 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              Reset Semua Filter
            </button>
          )}
        </div>

        {/* Search & Advanced Filter Toolbar */}
        <div className="bg-slate-50/90 border border-slate-200 rounded-xl p-3 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 text-xs">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari ID Dokumen/PO/SKU, Nama User, Departemen, Outlet, atau Rincian Aktivitas..."
              className="w-full pl-9 pr-8 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-slate-900 focus:border-slate-900 outline-hidden font-medium"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Module Filter */}
            <div className="flex items-center gap-1.5 bg-white border border-slate-300 px-2.5 py-1.5 rounded-lg shadow-2xs">
              <ListFilter className="w-3.5 h-3.5 text-slate-500" />
              <select
                value={moduleFilter}
                onChange={(e) => setModuleFilter(e.target.value)}
                className="text-xs text-slate-700 bg-transparent outline-hidden font-semibold cursor-pointer"
              >
                {MODULE_FILTERS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Severity Filter */}
            <div className="flex items-center gap-1.5 bg-white border border-slate-300 px-2.5 py-1.5 rounded-lg shadow-2xs">
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="text-xs text-slate-700 bg-transparent outline-hidden font-semibold cursor-pointer"
              >
                <option value="all">Semua Status Log</option>
                <option value="Success">Approved / Verified</option>
                <option value="Warning">Adjustment / Review</option>
                <option value="Critical">Rejected / Rollback</option>
                <option value="Info">Recorded / Info</option>
              </select>
            </div>

            {/* Date Filter */}
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
                  type="button"
                  onClick={() => setDateFilter('')}
                  className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-semibold ml-1 cursor-pointer"
                >
                  Semua
                </button>
              )}
            </div>

            {/* Sort Order */}
            <button
              type="button"
              onClick={() => setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg font-semibold transition shadow-2xs cursor-pointer"
            >
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-700" />
              <span>{sortOrder === 'desc' ? 'Terbaru' : 'Terlama'}</span>
            </button>
          </div>
        </div>

        {/* View Mode 1: Table View */}
        {viewMode === 'table' ? (
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2.5">Waktu & ID Audit</th>
                  <th className="px-3 py-2.5">Pelaksana (User & Role)</th>
                  <th className="px-3 py-2.5">Departemen / Unit</th>
                  <th className="px-3 py-2.5">Modul & Kategori</th>
                  <th className="px-3 py-2.5">Aktivitas & Referensi</th>
                  <th className="px-3 py-2.5">Status Akuntabilitas</th>
                  <th className="px-3 py-2.5 text-center">Rincian Perubahan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-slate-400 font-medium">
                      Tidak ada catatan Audit Trail yang sesuai dengan filter saat ini.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log: AuditLogEntry) => {
                    const isExpanded = expandedLogId === log.id;
                    const { datePart, timePart } = formatTimestamp(log.timestamp);
                    const hasChanges = log.changes && log.changes.length > 0;

                    return (
                      <React.Fragment key={log.id}>
                        <tr
                          onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                          className={`hover:bg-slate-50/90 transition cursor-pointer ${
                            isExpanded
                              ? 'bg-amber-50/40 border-l-4 border-l-slate-900'
                              : ''
                          }`}
                        >
                          <td className="px-3 py-3 whitespace-nowrap">
                            <div className="font-bold text-slate-900 flex items-center gap-1">
                              <Clock className="w-3 h-3 text-slate-400" />
                              {datePart}
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono">
                              {timePart} • {log.id}
                            </div>
                          </td>

                          <td className="px-3 py-3">
                            <div className="font-bold text-slate-900 flex items-center gap-1.5">
                              <UserCheck className="w-3.5 h-3.5 text-slate-500" />
                              {log.actorName}
                            </div>
                            <span className="inline-block mt-0.5 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                              {log.actorRole}
                            </span>
                          </td>

                          <td className="px-3 py-3">
                            <span
                              className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-md border ${getDepartmentBadge(
                                log.department
                              )}`}
                            >
                              {log.department}
                            </span>
                            {log.outletName && (
                              <div className="text-[11px] text-slate-600 font-medium mt-1">
                                {log.outletName}
                              </div>
                            )}
                          </td>

                          <td className="px-3 py-3">
                            <div className="font-bold text-slate-800">{log.module}</div>
                            <span
                              className={`inline-block mt-0.5 text-[10px] font-bold px-2 py-0.5 rounded-md border ${getCategoryBadge(
                                log.category
                              )}`}
                            >
                              {log.category}
                            </span>
                          </td>

                          <td className="px-3 py-3 max-w-md">
                            <div className="font-bold text-slate-900">{log.action}</div>
                            {log.referenceId && (
                              <span className="inline-block my-0.5 font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-300">
                                Ref: {log.referenceId}
                              </span>
                            )}
                            <p className="text-[11px] text-slate-600 line-clamp-2 mt-0.5 leading-relaxed">
                              {log.description}
                            </p>
                          </td>

                          <td className="px-3 py-3 whitespace-nowrap">
                            {getSeverityBadge(log.severity)}
                          </td>

                          <td className="px-3 py-3 text-center whitespace-nowrap">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedLogId(isExpanded ? null : log.id);
                              }}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                                isExpanded
                                  ? 'bg-slate-900 text-white border-slate-900'
                                  : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                              }`}
                            >
                              <span>
                                {hasChanges
                                  ? `${log.changes!.length} Perubahan`
                                  : 'Detail'}
                              </span>
                              {isExpanded ? (
                                <ChevronUp className="w-3 h-3" />
                              ) : (
                                <ChevronDown className="w-3 h-3" />
                              )}
                            </button>
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr className="bg-slate-50/80 border-b border-slate-200">
                            <td colSpan={7} className="p-4">
                              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                                  <div>
                                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                                      Rincian Jejak Audit & Akuntabilitas
                                    </span>
                                    <h4 className="text-xs font-bold text-slate-900 mt-0.5">
                                      {log.action} {log.referenceId ? `• [${log.referenceId}]` : ''}
                                    </h4>
                                  </div>
                                  <div className="text-[11px] text-slate-500 font-mono">
                                    ID Log: {log.id} • {datePart} {timePart}
                                  </div>
                                </div>

                                <p className="text-xs text-slate-700 leading-relaxed">
                                  {log.description}
                                </p>

                                {hasChanges && (
                                  <div className="space-y-1.5">
                                    <div className="text-[11px] font-bold text-slate-700">
                                      Perbandingan Data Sebelum & Sesudah (Before / After):
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                      {log.changes!.map((chg, i) => (
                                        <div
                                          key={i}
                                          className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between gap-2 text-xs"
                                        >
                                          <span className="font-bold text-slate-700">
                                            {chg.field}:
                                          </span>
                                          <div className="flex items-center gap-1.5 font-mono text-[11px]">
                                            {chg.before !== undefined && (
                                              <>
                                                <span className="px-1.5 py-0.5 rounded bg-slate-200/80 text-slate-700 line-through">
                                                  {chg.before}
                                                </span>
                                                <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                                              </>
                                            )}
                                            <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-900 font-bold">
                                              {chg.after ?? '-'}
                                            </span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
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
        ) : (
          /* View Mode 2: Chronological Timeline View */
          <div className="space-y-3 pl-2">
            {filteredLogs.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-xs font-medium">
                Tidak ada catatan Audit Trail yang sesuai dengan filter saat ini.
              </div>
            ) : (
              filteredLogs.map((log) => {
                const { datePart, timePart } = formatTimestamp(log.timestamp);
                return (
                  <div
                    key={log.id}
                    className="relative pl-6 pb-3 border-l-2 border-slate-200 last:border-l-transparent"
                  >
                    <div className="w-3 h-3 rounded-full bg-slate-900 border-2 border-amber-400 absolute -left-[7px] top-1.5" />
                    <div className="bg-slate-50/70 hover:bg-white rounded-xl border border-slate-200 p-3.5 transition shadow-2xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-xs text-slate-900">{log.action}</span>
                          {log.referenceId && (
                            <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-white text-slate-800 border border-slate-300">
                              {log.referenceId}
                            </span>
                          )}
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getDepartmentBadge(
                              log.department
                            )}`}
                          >
                            {log.department}
                            {log.outletName ? ` • ${log.outletName}` : ''}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getCategoryBadge(
                              log.category
                            )}`}
                          >
                            {log.module} ({log.category})
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {getSeverityBadge(log.severity)}
                          <span className="text-[11px] text-slate-500 font-mono">
                            {datePart} {timePart}
                          </span>
                        </div>
                      </div>

                      <p className="text-xs text-slate-700 mt-2 leading-relaxed">
                        {log.description}
                      </p>

                      {log.changes && log.changes.length > 0 && (
                        <div className="mt-2.5 flex flex-wrap gap-2">
                          {log.changes.map((chg, idx) => (
                            <div
                              key={idx}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[11px]"
                            >
                              <span className="font-semibold text-slate-600">{chg.field}:</span>
                              {chg.before !== undefined && (
                                <>
                                  <span className="text-slate-500 line-through">{chg.before}</span>
                                  <ArrowRight className="w-3 h-3 text-slate-400" />
                                </>
                              )}
                              <span className="font-bold text-emerald-700">{chg.after}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="mt-2 pt-2 border-t border-slate-200/70 flex items-center justify-between text-[11px] text-slate-500">
                        <span>
                          Pelaksana: <strong className="text-slate-800">{log.actorName}</strong> ({log.actorRole})
                        </span>
                        <span className="font-mono">{log.id}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Modal: Catat Log Audit / Berita Acara Manual */}
      {showAddNoteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-amber-600" />
                  Catat Berita Acara / Log Audit Operasional
                </h3>
                <p className="text-[11px] text-slate-500">
                  Dicatat oleh: <strong>{currentUser.username}</strong> ({currentUser.position})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddNoteModal(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddManualAuditNote} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Kategori Audit</label>
                  <select
                    value={noteCategory}
                    onChange={(e) => setNoteCategory(e.target.value as AuditActionCategory)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white font-semibold"
                  >
                    <option value="Stock Adjustment">Stock Adjustment (Stok/Opname)</option>
                    <option value="Order Approval">Order Approval (Otorisasi PO/Order)</option>
                    <option value="Order Lifecycle">Order Lifecycle (Siklus Order)</option>
                    <option value="Master Data & System">Master Data & System</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Modul Terkait</label>
                  <select
                    value={noteModule}
                    onChange={(e) => setNoteModule(e.target.value as AuditModuleName)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white font-semibold"
                  >
                    <option value="Master Inventory">Master Inventory</option>
                    <option value="Cost Control">Cost Control</option>
                    <option value="Purchasing & Vendor">Purchasing & Vendor</option>
                    <option value="Inbound">Inbound</option>
                    <option value="Outbond">Outbond</option>
                    <option value="Order Outlet">Order Outlet</option>
                    <option value="Purchase Request">Purchase Request</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Departemen</label>
                  <select
                    value={noteDepartment}
                    onChange={(e) => setNoteDepartment(e.target.value as AuditDepartmentScope)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white font-semibold"
                  >
                    <option value="Kitchen">Kitchen</option>
                    <option value="Bar">Bar</option>
                    <option value="Pastry">Pastry</option>
                    <option value="Floor & Operations">Floor & Operations</option>
                    <option value="Central Warehouse">Central Warehouse</option>
                    <option value="Purchasing & Finance">Purchasing & Finance</option>
                    <option value="All Departments">All Departments</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Outlet (Opsional)
                  </label>
                  <select
                    value={noteOutlet}
                    onChange={(e) => setNoteOutlet(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white font-semibold"
                  >
                    <option value="">Gudang Pusat / Semua Outlet</option>
                    {outlets.map((o) => (
                      <option key={o.id} value={o.namaOutlet}>
                        {o.namaOutlet}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Judul Aktivitas / Operasi *
                  </label>
                  <input
                    type="text"
                    required
                    value={noteAction}
                    onChange={(e) => setNoteAction(e.target.value)}
                    placeholder="Contoh: Koreksi Fisik Stok Daging"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    ID Referensi (PO / SKU / Form)
                  </label>
                  <input
                    type="text"
                    value={noteRefId}
                    onChange={(e) => setNoteRefId(e.target.value)}
                    placeholder="Contoh: BTC-001 atau PO-20261021-001"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Keterangan / Alasan Akuntabilitas *
                </label>
                <textarea
                  rows={2}
                  required
                  value={noteDescription}
                  onChange={(e) => setNoteDescription(e.target.value)}
                  placeholder="Jelaskan rincian persetujuan atau alasan penyesuaian stok..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="font-bold text-slate-700 text-[11px]">
                  Data Perubahan Sebelum & Sesudah (Opsional)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    value={noteField}
                    onChange={(e) => setNoteField(e.target.value)}
                    placeholder="Nama Field (mis. Stok Fisik)"
                    className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
                  />
                  <input
                    type="text"
                    value={noteBefore}
                    onChange={(e) => setNoteBefore(e.target.value)}
                    placeholder="Nilai Sebelum (mis. 10 Kg)"
                    className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
                  />
                  <input
                    type="text"
                    value={noteAfter}
                    onChange={(e) => setNoteAfter(e.target.value)}
                    placeholder="Nilai Sesudah (mis. 8 Kg)"
                    className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-700">Tingkat Status:</span>
                  <select
                    value={noteSeverity}
                    onChange={(e) => setNoteSeverity(e.target.value as AuditSeverity)}
                    className="px-2.5 py-1 border border-slate-300 rounded-lg bg-white font-semibold"
                  >
                    <option value="Info">Recorded (Info)</option>
                    <option value="Success">Approved / Verified</option>
                    <option value="Warning">Adjustment / Warning</option>
                    <option value="Critical">Critical / Reject</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddNoteModal(false)}
                    className="px-3.5 py-2 rounded-xl border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold cursor-pointer"
                  >
                    Simpan ke Audit Trail
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
