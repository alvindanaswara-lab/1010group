import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { User, UserPosition } from '../types';
import { getDefaultTabForPosition } from '../utils/authUtils';
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
    setCurrentUser,
    users,
    canAccess,
    resetAllData,
    outletOrders,
    receivingRecords,
    purchaseOrders,
    logout,
  } = useApp();
  const [showUserModal, setShowUserModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

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

  const handleQuickSwitch = (u: User) => {
    setCurrentUser(u);
    setShowUserModal(false);
    const targetTab = getDefaultTabForPosition(u.position);
    setActiveTab(targetTab);
  };

  const handleManualLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    const matched = users.find(
      (u) =>
        u.username.toLowerCase() === loginUsername.trim().toLowerCase() &&
        (u.password === loginPassword || !u.password)
    );
    if (matched) {
      handleQuickSwitch(matched);
      setLoginUsername('');
      setLoginPassword('');
    } else {
      setLoginError('Username atau password tidak cocok! (Password default: password123)');
    }
  };

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
                onClick={() => setShowUserModal(true)}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:border-amber-400 bg-slate-50 hover:bg-white text-slate-700 transition cursor-pointer text-xs font-medium shadow-xs"
                title="Ganti Pengguna / Role"
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
      {showUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-amber-400" />
                  Simulasi Login & Ganti Pengguna
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  Setiap posisi memiliki hak akses spesifik sesuai aturan sistem F&B 1010Group.
                </p>
              </div>
              <button
                onClick={() => setShowUserModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-700/50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              {/* Quick Switch Profiles (All users only visible to Administrator; non-admin only sees their own active account) */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    {currentUser.position === 'Administrator'
                      ? 'Pilih Cepat Akun Demo (Preset Otentikasi)'
                      : 'Informasi Akun Saya (Sedang Login)'}
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      setShowUserModal(false);
                      setActiveTab('system-setting');
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-[11px] font-bold transition cursor-pointer"
                  >
                    <Settings className="w-3 h-3 text-amber-600" />
                    <span>Ubah Data Pribadi & Password</span>
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {(currentUser.position === 'Administrator'
                    ? users
                    : users.filter((u) => u.id === currentUser.id)
                  ).map((u) => {
                    const isSelected = u.id === currentUser.id;
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => handleQuickSwitch(u)}
                        className={`p-3 rounded-xl border text-left flex items-start justify-between transition cursor-pointer ${
                          isSelected
                            ? 'border-amber-500 bg-amber-50/50 ring-2 ring-amber-500/20'
                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex-1 min-w-0 pr-2">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-xs text-slate-900 truncate">
                              {u.username}
                            </span>
                            {isSelected && (
                              <span className="text-[10px] bg-amber-600 text-white px-1.5 py-0.2 rounded-full font-bold">
                                Aktif
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 truncate mt-0.5">{u.email}</p>
                          {u.outletName && (
                            <p className="text-[10px] text-emerald-600 font-medium truncate mt-0.5">
                              {u.outletName} • {u.department}
                            </p>
                          )}
                        </div>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${getPositionBadgeColor(
                            u.position
                          )}`}
                        >
                          {u.position}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Position Access Rule Summary */}
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-[11px] text-slate-600 space-y-1">
                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                  Matriks Hak Akses Posisi:
                </div>
                <ul className="list-disc list-inside space-y-0.5 pl-1 text-[11px]">
                  <li><strong>Administrator:</strong> Akses penuh semua fitur & fungsi.</li>
                  <li><strong>Outlet:</strong> Dashboard & Order barang ke gudang saja.</li>
                  <li><strong>Storage-Mailer:</strong> Fitur Deployment saja.</li>
                  <li><strong>Storage Inbound:</strong> Master Inventory, Inbound, & Purchase Request.</li>
                  <li><strong>Storage Outbond:</strong> Master Inventory, Outbond, & Purchase Request.</li>
                  <li><strong>Purchasing:</strong> Purchase Request, Vendor, & Inbound.</li>
                  <li><strong>Cost Control:</strong> Master Inventory & Purchase Request.</li>
                </ul>
              </div>

              {/* Login with username/password */}
              <form onSubmit={handleManualLogin} className="pt-2 border-t border-slate-100 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Atau Masuk dengan Kredensial
                </h4>
                {loginError && (
                  <p className="text-xs text-red-600 bg-red-50 p-2 rounded-lg border border-red-200">
                    {loginError}
                  </p>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Username
                    </label>
                    <input
                      type="text"
                      value={loginUsername}
                      onChange={(e) => setLoginUsername(e.target.value)}
                      placeholder="e.g. admin atau chef.senopati"
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-500 outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Password
                    </label>
                    <input
                      type="password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="password123"
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-500 outline-hidden"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowUserModal(false);
                      logout();
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-lg font-semibold transition cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Keluar dari Sesi</span>
                  </button>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowUserModal(false)}
                      className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition"
                    >
                      Login
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
