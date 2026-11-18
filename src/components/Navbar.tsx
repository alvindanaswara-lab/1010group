import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { UserPosition } from '../types';
import {
  UtensilsCrossed,
  Layers,
  Truck,
  ArrowDownToLine,
  ArrowUpFromLine,
  FileText,
  Building2,
  Settings,
  UserCheck,
  ChevronDown,
  LogOut,
  ShieldCheck,
  Store,
  RefreshCw,
  Bell,
  Menu,
  X,
  Calculator,
} from 'lucide-react';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab }) => {
  const {
    currentUser,
    canAccess,
    resetAllData,
    outletOrders,
    receivingRecords,
    purchaseOrders,
    logout,
  } = useApp();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Pending counts
  const pendingOutletOrders = outletOrders.filter(
    (o) => o.status === 'Submitted' || o.status === 'Draft'
  ).length;
  const pendingReceiving = receivingRecords.filter(
    (r) => r.status === 'Menunggu Kedatangan' || r.status === 'Diterima Sebagian'
  ).length;
  const pendingCostControl = purchaseOrders.filter(
    (p) => p.status === 'Review Cost Control'
  ).length;

  const allNavItems = [
    {
      id: 'dashboard',
      label: `Dashboard ${currentUser.position}`,
      icon: Layers,
      permissionCheck: () => currentUser.position !== 'Outlet',
    },
    {
      id: 'dashboard-outlet',
      label: 'Dashboard Outlet',
      icon: Store,
      permissionCheck: () => canAccess('Dashboard Outlet') || currentUser.position === 'Outlet',
    },
    {
      id: 'order-outlet',
      label: 'Order Barang',
      icon: UtensilsCrossed,
      permissionCheck: () => canAccess('Order Outlet') || currentUser.position === 'Outlet',
      badge: currentUser.position === 'Outlet' ? undefined : pendingOutletOrders,
    },
    {
      id: 'master-inventory',
      label: 'Master Inventory',
      icon: Layers,
      permissionCheck: () => canAccess('Master Inventory'),
    },
    {
      id: 'inbound',
      label: 'Inbound',
      icon: ArrowDownToLine,
      permissionCheck: () => canAccess('Inbound'),
      badge: pendingReceiving > 0 ? pendingReceiving : undefined,
    },
    {
      id: 'outbond',
      label: 'Outbond',
      icon: ArrowUpFromLine,
      permissionCheck: () => canAccess('Outbond') || canAccess('Deployment'),
    },
    {
      id: 'purchase-request',
      label: 'Purchase Request',
      icon: FileText,
      permissionCheck: () => canAccess('Purchase Request'),
    },
    {
      id: 'vendor',
      label: 'Purchasing & Vendor',
      icon: Building2,
      permissionCheck: () => canAccess('Vendor'),
    },
    {
      id: 'cost-control',
      label: 'Cost Control',
      icon: Calculator,
      permissionCheck: () => canAccess('Cost Control') || currentUser.position === 'Cost Control',
      badge: pendingCostControl > 0 ? pendingCostControl : undefined,
    },
    {
      id: 'audit-trail',
      label: 'Audit Trail',
      icon: ShieldCheck,
      permissionCheck: () => canAccess('Audit Trail'),
    },
    {
      id: 'system-setting',
      label: 'System & Setting',
      icon: Settings,
      permissionCheck: () => canAccess('System & Setting'),
    },
  ];

  const visibleNavItems = allNavItems.filter((item) => item.permissionCheck());

  const getPositionBadgeColor = (pos: UserPosition) => {
    switch (pos) {
      case 'Administrator':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'Outlet':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'Storage Inbound':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Storage Outbond':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'Storage-Mailer':
        return 'bg-sky-100 text-sky-800 border-sky-200';
      case 'Purchasing':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'Cost Control':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-xs">
        {/* Top Info Bar */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 via-orange-500 to-amber-400 flex items-center justify-center text-white shadow-md shadow-orange-500/20">
                <UtensilsCrossed className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-xl tracking-tight text-slate-900">
                    1010<span className="text-amber-600">Group</span>
                  </span>
                  <span className="hidden sm:inline-block text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                    F&B Supply System
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 hidden sm:block">
                  Central Kitchen & Multi-Outlet Supply Chain
                </p>
              </div>
            </div>

            {/* Right: Active Role & User Switcher */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Quick switch button */}
              <button
                onClick={() => setActiveTab('system-setting')}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:border-amber-400 bg-slate-50 hover:bg-white text-slate-700 transition cursor-pointer text-xs font-medium shadow-xs"
                title="Profil pengguna"
              >
                <div className="w-7 h-7 rounded-lg bg-amber-500 text-white flex items-center justify-center font-bold text-xs uppercase">
                  {currentUser.username.slice(0, 2)}
                </div>
                <div className="text-left hidden md:block">
                  <div className="text-xs font-semibold text-slate-900 leading-tight">
                    {currentUser.username}
                  </div>
                  <div className="text-[10px] text-slate-500 leading-tight">
                    {currentUser.position}
                    {currentUser.department ? ` • ${currentUser.department}` : ''}
                  </div>
                </div>
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${getPositionBadgeColor(
                    currentUser.position
                  )}`}
                >
                  {currentUser.position}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {/* Options Symbol Trigger Button (left of Keluar button) */}
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="group relative flex items-center justify-center p-2 bg-slate-900 hover:bg-amber-600 text-white rounded-xl shadow-xs border border-slate-700/80 transition-all duration-200 cursor-pointer"
                title="Menu Opsi Navigasi"
              >
                {mobileMenuOpen ? (
                  <X className="w-4 h-4 text-white transition-transform duration-200" />
                ) : (
                  <Menu className="w-4 h-4 text-amber-400 group-hover:text-white transition-transform duration-200" />
                )}
                {visibleNavItems.some((item) => item.badge && item.badge > 0) && !mobileMenuOpen && (
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center shadow-xs ring-2 ring-white">
                    {visibleNavItems.reduce((sum, item) => sum + (item.badge || 0), 0)}
                  </span>
                )}
              </button>

              {/* Logout button */}
              <button
                type="button"
                onClick={logout}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-200 hover:border-rose-300 bg-rose-50/70 hover:bg-rose-100 text-rose-700 transition cursor-pointer text-xs font-semibold shadow-xs"
                title="Keluar Sesi & Kembali ke Tampilan Login"
              >
                <LogOut className="w-3.5 h-3.5 text-rose-600" />
                <span className="hidden sm:inline">Keluar</span>
              </button>
            </div>
          </div>
        </div>

        {/* Slide-out Navigation Drawer (Right Side) */}
        <div>
          {/* Backdrop & Side Options Drawer */}
          {mobileMenuOpen && (
            <div className="fixed inset-0 z-40 flex justify-end">
              <div
                className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs transition-opacity"
                onClick={() => setMobileMenuOpen(false)}
              />
              <aside className="relative z-50 ml-auto w-72 max-w-[82vw] bg-white h-full shadow-2xl border-l border-slate-200 flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-200">
                <div>
                  <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Menu Opsi Sistem</h3>
                      <p className="text-[11px] text-slate-500">Pilih modul kerja aktif</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setMobileMenuOpen(false)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <nav className="p-3 space-y-1">
                    {visibleNavItems.map((item) => {
                      const Icon = item.icon;
                      const isActive = activeTab === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            setActiveTab(item.id);
                            setMobileMenuOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-3.5 py-2.5 text-xs sm:text-sm font-semibold rounded-xl transition cursor-pointer ${
                            isActive
                              ? 'bg-amber-600 text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <Icon className="w-4 h-4 shrink-0" />
                            <span>{item.label}</span>
                          </div>
                          {item.badge !== undefined && item.badge > 0 && (
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                isActive
                                  ? 'bg-white text-amber-700'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {item.badge}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </nav>
                </div>
                <div className="p-4 border-t border-slate-100 bg-slate-50/50 text-[11px] text-slate-500 space-y-2">
                  <div>
                    Aktif sebagai <span className="font-semibold text-slate-700">{currentUser.username}</span> ({currentUser.position})
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('system-setting');
                      setMobileMenuOpen(false);
                    }}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-amber-50 text-slate-700 hover:text-amber-800 border border-slate-200 hover:border-amber-300 font-bold text-[11px] transition cursor-pointer"
                  >
                    <Settings className="w-3.5 h-3.5 text-amber-600" />
                    <span>Ubah Data User Pribadi</span>
                  </button>
                </div>
              </aside>
            </div>
          )}
        </div>
      </header>

      {/* User Login & Switch Modal */}

    </>
  );
};
