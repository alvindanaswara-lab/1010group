import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { User, UserPosition } from '../../types';
import { getDefaultTabForPosition, getRoleDestinationLabel } from '../../utils/authUtils';
import {
  UtensilsCrossed,
  Lock,
  User as UserIcon,
  Eye,
  EyeOff,
  ShieldCheck,
  Building,
  Store,
  Layers,
  Truck,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Sparkles,
  ArrowDownToLine,
  ArrowUpFromLine,
  FileText,
  Building2,
  Calculator,
  Compass,
} from 'lucide-react';

interface LoginScreenProps {
  onLoginSuccess: (user: User) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const { users, login, loginWithGoogle, loginAsUser } = useApp();

  const [activeMode, setActiveMode] = useState<'form' | 'quick'>('form');
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [quickFilter, setQuickFilter] = useState<'all' | 'outlet' | 'warehouse' | 'management'>('all');

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsLoading(true);

    setTimeout(() => {
      const result = login(usernameOrEmail, password);
      setIsLoading(false);
      if (result.success && result.user) {
        onLoginSuccess(result.user);
      } else {
        setErrorMessage(
          result.message || 'Login gagal. Silakan periksa kembali username dan password Anda.'
        );
      }
    }, 300);
  };

  const handleGoogleSignIn = async () => {
    setErrorMessage('');
    setIsLoading(true);
    const result = await loginWithGoogle();
    setIsLoading(false);
    if (result.success && result.user) {
      onLoginSuccess(result.user);
    } else if (result.message) {
      setErrorMessage(result.message);
    }
  };

  const handleSelectQuickUser = (user: User) => {
    loginAsUser(user);
    onLoginSuccess(user);
  };

  const getPositionBadge = (pos: UserPosition) => {
    switch (pos) {
      case 'Administrator':
        return {
          bg: 'bg-purple-100 text-purple-800 border-purple-200',
          icon: ShieldCheck,
          label: 'Admin Global',
        };
      case 'Outlet':
        return {
          bg: 'bg-emerald-100 text-emerald-800 border-emerald-200',
          icon: Store,
          label: 'Outlet Store',
        };
      case 'Storage Inbound':
        return {
          bg: 'bg-blue-100 text-blue-800 border-blue-200',
          icon: ArrowDownToLine,
          label: 'Gudang Inbound',
        };
      case 'Storage Outbond':
        return {
          bg: 'bg-amber-100 text-amber-800 border-amber-200',
          icon: ArrowUpFromLine,
          label: 'Gudang Outbond',
        };
      case 'Storage-Mailer':
        return {
          bg: 'bg-sky-100 text-sky-800 border-sky-200',
          icon: Truck,
          label: 'Logistik Deployment',
        };
      case 'Purchasing':
        return {
          bg: 'bg-indigo-100 text-indigo-800 border-indigo-200',
          icon: Building2,
          label: 'Purchasing & Vendor',
        };
      case 'Cost Control':
        return {
          bg: 'bg-rose-100 text-rose-800 border-rose-200',
          icon: Calculator,
          label: 'Cost Control & Audit',
        };
      default:
        return {
          bg: 'bg-slate-100 text-slate-800 border-slate-200',
          icon: UserIcon,
          label: pos,
        };
    }
  };

  // Filtered users for quick role switcher
  const filteredUsers = users.filter((u) => {
    if (quickFilter === 'all') return true;
    if (quickFilter === 'outlet') return u.position === 'Outlet';
    if (quickFilter === 'warehouse')
      return ['Storage Inbound', 'Storage Outbond', 'Storage-Mailer'].includes(u.position);
    if (quickFilter === 'management')
      return ['Administrator', 'Purchasing', 'Cost Control'].includes(u.position);
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-amber-500 selection:text-white">
      {/* Background ambient lighting */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-amber-600/10 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 -right-40 w-96 h-96 bg-orange-600/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 left-1/3 w-96 h-96 bg-emerald-600/5 rounded-full blur-3xl"></div>
      </div>

      {/* Top Header bar */}
      <header className="relative z-10 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-600 via-orange-500 to-amber-400 flex items-center justify-center text-white shadow-lg shadow-orange-500/20">
            <UtensilsCrossed className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-lg tracking-tight text-white">
                1010<span className="text-amber-500">Group</span>
              </span>
              <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-sm bg-slate-800 text-slate-300 border border-slate-700">
                F&B Enterprise
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              Central Kitchen & Multi-Outlet Supply Chain System
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="hidden sm:inline">Server Operasional:</span>
          <span className="text-slate-200 font-medium">Online & Terenkripsi</span>
        </div>
      </header>

      {/* Main Content: Login Panel */}
      <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 flex items-center justify-center">
        <div className="w-full flex items-center justify-center">
          {/* Authentication Card */}
          <div className="w-full max-w-lg mx-auto">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-xl">

              {/* Error Notice */}
              {errorMessage && (
                <div className="mx-6 mt-6 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-rose-200">Gagal Masuk:</div>
                    <div>{errorMessage}</div>
                  </div>
                </div>
              )}

              {/* Mode 1: Standard Credentials Form */}
              {activeMode === 'form' && (
                <form onSubmit={handleFormSubmit} className="p-6 sm:p-8 space-y-4">
                  <div>
                    <h2 className="text-base font-bold text-white">Masuk ke Portal Operasional</h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Sistem akan langsung membuka laman kerja sesuai peran akun Anda.
                    </p>
                  </div>

                  <div className="space-y-4 pt-1">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        Username atau Email Akun
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                          <UserIcon className="w-4 h-4" />
                        </div>
                        <input
                          type="text"
                          required
                          value={usernameOrEmail}
                          onChange={(e) => setUsernameOrEmail(e.target.value)}
                          placeholder="contoh: admin, chef.senopati, storage.outbond"
                          className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition"
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-semibold text-slate-300">
                          Password / Kata Sandi
                        </label>
                      </div>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                          <Lock className="w-4 h-4" />
                        </div>
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Masukkan password akun..."
                          className="w-full pl-9 pr-10 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300"
                        >
                          {showPassword ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={rememberMe}
                          onChange={(e) => setRememberMe(e.target.checked)}
                          className="rounded border-slate-700 bg-slate-950 text-amber-500 focus:ring-amber-500/20"
                        />
                        <span>Ingat sesi di perangkat ini</span>
                      </label>
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full py-3 px-4 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold rounded-xl text-xs sm:text-sm shadow-lg shadow-orange-600/20 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {isLoading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                          <span>Memverifikasi Sesi...</span>
                        </>
                      ) : (
                        <>
                          <span>Masuk & Beralih ke Laman Sesi</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>

                    <div className="relative py-1 flex items-center justify-center">
                      <div className="border-t border-slate-800 w-full"></div>
                      <span className="bg-slate-900 px-3 text-[10px] uppercase tracking-wider font-bold text-slate-500">
                        atau
                      </span>
                      <div className="border-t border-slate-800 w-full"></div>
                    </div>

                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={handleGoogleSignIn}
                      className="w-full py-2.5 px-4 bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-200 font-semibold rounded-xl text-xs transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      <ShieldCheck className="w-4 h-4 text-amber-500" />
                      <span>Masuk dengan Akun Google</span>
                    </button>
                  </div>
                </form>
              )}

              {/* Mode 2: Quick Role Selector */}
              {activeMode === 'quick' && (
                <div className="p-6 sm:p-8 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h2 className="text-base font-bold text-white">Preset Masuk Cepat (1-Klik)</h2>
                      <p className="text-xs text-slate-400">
                        Pilih peran di bawah untuk langsung beralih ke sesi laman yang bersangkutan.
                      </p>
                    </div>
                  </div>

                  {/* Filter tabs */}
                  <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-xl border border-slate-800 text-xs">
                    {[
                      { id: 'all', label: 'Semua Peran' },
                      { id: 'outlet', label: 'Outlet Cabang' },
                      { id: 'warehouse', label: 'Gudang & Logistik' },
                      { id: 'management', label: 'Manajemen' },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setQuickFilter(tab.id as any)}
                        className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                          quickFilter === tab.id
                            ? 'bg-amber-600 text-white'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* User List Cards */}
                  <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                    {filteredUsers.map((u) => {
                      const badge = getPositionBadge(u.position);
                      const BadgeIcon = badge.icon;
                      const destination = getRoleDestinationLabel(u.position);

                      return (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => handleSelectQuickUser(u)}
                          className="w-full text-left p-3 rounded-xl bg-slate-950/70 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/50 transition cursor-pointer group flex items-center justify-between gap-3 shadow-xs"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-amber-400 group-hover:scale-105 transition shrink-0">
                              <BadgeIcon className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-xs text-white truncate">
                                  {u.username}
                                </span>
                                <span className="text-[10px] px-1.5 py-0.2 rounded-sm bg-slate-800 text-slate-300 border border-slate-700">
                                  {u.position}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-400 truncate mt-0.5">
                                {u.placement || u.outletName || 'Head Office/Warehouse'}
                                {u.department ? ` • Dept: ${u.department}` : ''}
                              </div>
                              <div className="text-[10px] text-amber-400/90 font-medium flex items-center gap-1 mt-0.5">
                                <span>Beralih ke:</span>
                                <strong className="underline underline-offset-2">{destination}</strong>
                              </div>
                            </div>
                          </div>

                          <div className="shrink-0 flex items-center text-slate-500 group-hover:text-amber-400 transition pr-1">
                            <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition" />
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <p className="text-[10px] text-center text-slate-500 pt-1">
                    Klik pada akun mana pun untuk mengaktifkan sesi login dan langsung dialihkan ke laman kerjanya.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-900 bg-slate-950 px-4 sm:px-8 py-4 text-center text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span>1010Group Enterprise Supply Chain Platform</span>
          <span>•</span>
          <span>Versi 2.4</span>
        </div>
        <div className="text-[11px] text-slate-500">
          Semua sesi pengguna dilindungi Role-Based Access Control (RBAC).
        </div>
      </footer>
    </div>
  );
};
