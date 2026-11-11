import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { User, UserPosition, DEPARTMENTS, DepartmentName, ITEM_CATEGORIES, OutletData } from '../../types';
import { DEPARTMENT_CATEGORY_MAP } from '../../data/mockData';
import { scrollToTop } from '../../utils/scrollHelper';
import { SuccessSubmitModal, SuccessDetail } from '../common/SuccessSubmitModal';
import {
  Settings,
  Users,
  ShieldCheck,
  Plus,
  Trash2,
  Edit2,
  Lock,
  Mail,
  UserCheck,
  RotateCcw,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  X,
  Key,
  Store,
  MapPin,
  Building,
  Search,
  Eye,
  EyeOff,
  Save,
} from 'lucide-react';

export const SystemSettingSection: React.FC = () => {
  const {
    outlets,
    addOutlet,
    updateOutlet,
    deleteOutlet,
    users,
    addUser,
    updateUser,
    deleteUser,
    currentUser,
    setCurrentUser,
    resetAllData,
    clearAllForms,
    clearMasterInventory,
    resetInventoryBalances,
    inventory,
    addAuditLog,
  } = useApp();

  const isAdmin = currentUser.position === 'Administrator';
  const visibleUsers = isAdmin ? users : users.filter((u) => u.id === currentUser.id);

  const [activeSubTab, setActiveSubTab] = useState<'outlet-control' | 'user-control' | 'inventory-control'>('user-control');

  // Personal Profile State (for the currently logged-in user to edit their own personal data)
  const [personalForm, setPersonalForm] = useState<{
    username: string;
    email: string;
    password: string;
    placement: string;
    outletName: string;
    department: DepartmentName;
  }>({
    username: currentUser.username || '',
    email: currentUser.email || '',
    password: currentUser.password || 'password123',
    placement:
      currentUser.placement ||
      (currentUser.position !== 'Outlet'
        ? 'Head Office/Warehouse'
        : currentUser.outletName || outlets[0]?.namaOutlet || 'Resto Senopati'),
    outletName: currentUser.outletName || outlets[0]?.namaOutlet || 'Resto Senopati',
    department: currentUser.department || 'Kitchen',
  });

  const [showPersonalPassword, setShowPersonalPassword] = useState<boolean>(true);
  const [isChangingPersonalPassword, setIsChangingPersonalPassword] = useState<boolean>(false);
  const [personalNewPassword, setPersonalNewPassword] = useState<string>('');
  const [personalConfirmPassword, setPersonalConfirmPassword] = useState<string>('');
  const [personalPasswordError, setPersonalPasswordError] = useState<string>('');

  // Sync personal form whenever currentUser changes
  useEffect(() => {
    setPersonalForm({
      username: currentUser.username || '',
      email: currentUser.email || '',
      password: currentUser.password || 'password123',
      placement:
        currentUser.placement ||
        (currentUser.position !== 'Outlet'
          ? 'Head Office/Warehouse'
          : currentUser.outletName || outlets[0]?.namaOutlet || 'Resto Senopati'),
      outletName: currentUser.outletName || outlets[0]?.namaOutlet || 'Resto Senopati',
      department: currentUser.department || 'Kitchen',
    });
    setIsChangingPersonalPassword(false);
    setPersonalNewPassword('');
    setPersonalConfirmPassword('');
    setPersonalPasswordError('');
  }, [currentUser, outlets]);

  // Ensure non-admin stays on user-control tab
  useEffect(() => {
    if (!isAdmin && activeSubTab !== 'user-control') {
      setActiveSubTab('user-control');
    }
  }, [isAdmin, activeSubTab]);

  // Visibility toggle for password column in User Control table
  const [visibleTablePasswords, setVisibleTablePasswords] = useState<Record<string, boolean>>({});
  const toggleTablePasswordVisibility = (userId: string) => {
    setVisibleTablePasswords((prev) => ({
      ...prev,
      [userId]: prev[userId] === undefined ? false : !prev[userId],
    }));
  };
  const isTablePasswordVisible = (userId: string) => {
    // Default to true so pre-filled password is immediately clear, with toggle to hide/show
    return visibleTablePasswords[userId] !== undefined ? visibleTablePasswords[userId] : true;
  };

  // Dedicated Change Password Modal state (triggered from table or profile)
  const [changePasswordTargetUser, setChangePasswordTargetUser] = useState<User | null>(null);
  const [cpCurrentPasswordVisible, setCpCurrentPasswordVisible] = useState<boolean>(true);
  const [cpNewPassword, setCpNewPassword] = useState<string>('');
  const [cpConfirmPassword, setCpConfirmPassword] = useState<string>('');
  const [cpShowNewPassword, setCpShowNewPassword] = useState<boolean>(true);
  const [cpError, setCpError] = useState<string>('');

  // Outlet Control state
  const [outletSearch, setOutletSearch] = useState('');
  const [showOutletModal, setShowOutletModal] = useState(false);
  const [isEditingOutlet, setIsEditingOutlet] = useState(false);
  const [outletFormData, setOutletFormData] = useState<Partial<OutletData>>({
    namaOutlet: '',
    department: ['Kitchen', 'Bar', 'Pastry', 'Floor & Operations'],
    location: '',
  });

  // User Control form modal
  const [showUserModal, setShowUserModal] = useState<boolean>(false);
  const [isEditingUser, setIsEditingUser] = useState<boolean>(false);
  const [showModalPassword, setShowModalPassword] = useState<boolean>(true);
  const [isChangingModalPassword, setIsChangingModalPassword] = useState<boolean>(false);
  const [modalNewPassword, setModalNewPassword] = useState<string>('');
  const [modalConfirmPassword, setModalConfirmPassword] = useState<string>('');
  const [modalPasswordError, setModalPasswordError] = useState<string>('');

  const [userFormData, setUserFormData] = useState<Partial<User>>({
    username: '',
    position: 'Outlet',
    email: '',
    password: 'password123',
    access: ['Order Outlet'],
    outletName: outlets[0]?.namaOutlet || 'Resto Senopati',
    department: 'Kitchen',
  });

  const POSITIONS: UserPosition[] = [
    'Administrator',
    'Outlet',
    'Storage-Mailer',
    'Storage Inbound',
    'Storage Outbond',
    'Purchasing',
    'Cost Control',
  ];

  const getPositionAccessList = (pos: UserPosition): string[] => {
    switch (pos) {
      case 'Administrator':
        return [
          'Master Inventory',
          'Inbound',
          'Outbond',
          'Purchase Request',
          'Vendor',
          'Cost Control',
          'System & Setting',
          'Dashboard Outlet',
          'Order Outlet',
          'Deployment',
        ];
      case 'Outlet':
        return ['Dashboard Outlet', 'Order Outlet'];
      case 'Storage-Mailer':
        return ['Deployment'];
      case 'Storage Inbound':
        return ['Master Inventory', 'Inbound', 'Purchase Request'];
      case 'Storage Outbond':
        return ['Master Inventory', 'Outbond', 'Purchase Request'];
      case 'Purchasing':
        return ['Purchase Request', 'Vendor', 'Inbound', 'Cost Control'];
      case 'Cost Control':
        return ['Cost Control', 'Master Inventory', 'Purchase Request', 'Vendor'];
      default:
        return [];
    }
  };

  // Outlet Handlers
  const handleOpenAddOutlet = () => {
    setIsEditingOutlet(false);
    setOutletFormData({
      namaOutlet: '',
      department: ['Kitchen', 'Bar', 'Pastry', 'Floor & Operations'],
      location: '',
    });
    setShowOutletModal(true);
  };

  const handleOpenEditOutlet = (outlet: OutletData) => {
    setIsEditingOutlet(true);
    setOutletFormData({
      id: outlet.id,
      namaOutlet: outlet.namaOutlet,
      department: [...outlet.department],
      location: outlet.location,
    });
    setShowOutletModal(true);
  };

  const handleToggleDepartment = (dept: DepartmentName) => {
    const current = outletFormData.department || [];
    if (current.includes(dept)) {
      if (current.length > 1) {
        setOutletFormData({
          ...outletFormData,
          department: current.filter((d) => d !== dept),
        });
      }
    } else {
      setOutletFormData({
        ...outletFormData,
        department: [...current, dept],
      });
    }
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

  const handleSaveOutletForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!outletFormData.namaOutlet?.trim() || !outletFormData.location?.trim()) return;

    const nama = outletFormData.namaOutlet.trim();
    const loc = outletFormData.location.trim();
    const depts = (outletFormData.department || ['Kitchen']).join(', ');
    const isEdit = isEditingOutlet && !!outletFormData.id;

    if (isEditingOutlet && outletFormData.id) {
      updateOutlet({
        id: outletFormData.id,
        namaOutlet: nama,
        department: outletFormData.department || ['Kitchen'],
        location: loc,
      });
    } else {
      addOutlet({
        namaOutlet: nama,
        department: outletFormData.department || ['Kitchen'],
        location: loc,
      });
    }

    setShowOutletModal(false);

    // Pop-up sukses simpan outlet
    setSuccessModalData({
      title: 'Data Telah Berhasil Di-input!',
      message: isEdit
        ? `Data Outlet ${nama} berhasil diperbarui.`
        : `Outlet baru ${nama} berhasil didaftarkan ke sistem.`,
      details: [
        { label: 'Nama Outlet', value: nama },
        { label: 'Lokasi', value: loc },
        { label: 'Departemen Aktif', value: depts },
        { label: 'Aksi', value: isEdit ? 'Update Outlet' : 'Outlet Baru' },
      ],
    });
    setShowSuccessModal(true);
    scrollToTop();
  };

  const handleDeleteOutlet = (outlet: OutletData) => {
    if (confirm(`Apakah Anda yakin ingin menghapus outlet "${outlet.namaOutlet}"?`)) {
      deleteOutlet(outlet.id);
    }
  };

  const filteredOutlets = outlets.filter((o) => {
    const q = outletSearch.toLowerCase();
    return (
      o.namaOutlet.toLowerCase().includes(q) ||
      o.location.toLowerCase().includes(q) ||
      o.department.some((d) => d.toLowerCase().includes(q))
    );
  });

  // Save Personal User Profile Handler (for logged-in user)
  const handleSavePersonalProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setPersonalPasswordError('');

    const trimmedUsername = personalForm.username.trim();
    const trimmedEmail = personalForm.email.trim();
    if (!trimmedUsername || !trimmedEmail) return;

    let finalPassword = personalForm.password.trim() || currentUser.password || 'password123';
    if (isChangingPersonalPassword) {
      if (!personalNewPassword.trim()) {
        setPersonalPasswordError('Password baru tidak boleh kosong.');
        return;
      }
      if (personalConfirmPassword && personalNewPassword !== personalConfirmPassword) {
        setPersonalPasswordError('Konfirmasi password baru tidak cocok.');
        return;
      }
      finalPassword = personalNewPassword.trim();
    }

    const isOutletRole = currentUser.position === 'Outlet';
    const finalPlacement = isOutletRole
      ? personalForm.outletName || outlets[0]?.namaOutlet || 'Resto Senopati'
      : 'Head Office/Warehouse';
    const finalOutletName = isOutletRole ? finalPlacement : undefined;
    const finalDept = isOutletRole ? personalForm.department || 'Kitchen' : undefined;

    const updatedUser: User = {
      ...currentUser,
      username: trimmedUsername,
      email: trimmedEmail,
      password: finalPassword,
      placement: finalPlacement,
      outletName: finalOutletName,
      department: finalDept,
    };

    updateUser(updatedUser);

    addAuditLog({
      module: 'System & Setting',
      category: 'Master Data & System',
      action: 'Perbarui Data User Pribadi',
      referenceId: updatedUser.id,
      description: `User ${updatedUser.username} (${updatedUser.position}) memperbarui data profil pribadinya${
        isChangingPersonalPassword ? ' beserta password akun' : ''
      }.`,
      severity: 'Info',
    });

    setIsChangingPersonalPassword(false);
    setPersonalNewPassword('');
    setPersonalConfirmPassword('');

    setSuccessModalData({
      title: 'Data Pribadi Berhasil Diperbarui!',
      message: `Data akun pribadi Anda (${updatedUser.username}) telah berhasil disimpan.`,
      details: [
        { label: 'User ID', value: updatedUser.id },
        { label: 'Username', value: updatedUser.username },
        { label: 'Jabatan / Posisi', value: updatedUser.position },
        { label: 'Email', value: updatedUser.email },
        { label: 'Penempatan', value: finalPlacement },
        { label: 'Departemen', value: finalDept || '-' },
        { label: 'Status Password', value: isChangingPersonalPassword ? 'Password Diperbarui' : 'Tersimpan' },
      ],
    });
    setShowSuccessModal(true);
    scrollToTop();
  };

  // Dedicated Change Password Modal Handlers
  const handleOpenChangePasswordModal = (u: User) => {
    setChangePasswordTargetUser(u);
    setCpCurrentPasswordVisible(true);
    setCpNewPassword('');
    setCpConfirmPassword('');
    setCpShowNewPassword(true);
    setCpError('');
  };

  const handleSaveChangePasswordModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!changePasswordTargetUser) return;
    setCpError('');

    const trimmedNew = cpNewPassword.trim();
    if (!trimmedNew) {
      setCpError('Harap isi password baru.');
      return;
    }
    if (cpConfirmPassword.trim() && trimmedNew !== cpConfirmPassword.trim()) {
      setCpError('Konfirmasi password baru tidak sesuai.');
      return;
    }

    const updated: User = {
      ...changePasswordTargetUser,
      password: trimmedNew,
    };

    updateUser(updated);

    addAuditLog({
      module: 'System & Setting',
      category: 'Master Data & System',
      action: 'Ganti Password User',
      referenceId: updated.id,
      description: `Password untuk akun ${updated.username} (${updated.id}) berhasil diperbarui oleh ${currentUser.username}.`,
      severity: 'Info',
    });

    setChangePasswordTargetUser(null);

    setSuccessModalData({
      title: 'Password Berhasil Diperbarui!',
      message: `Password untuk pengguna ${updated.username} telah berhasil diganti.`,
      details: [
        { label: 'User ID', value: updated.id },
        { label: 'Username', value: updated.username },
        { label: 'Position', value: updated.position },
        { label: 'Password Baru', value: trimmedNew },
      ],
    });
    setShowSuccessModal(true);
    scrollToTop();
  };

  // User Control Modal Handlers
  const handlePositionSelect = (pos: UserPosition) => {
    const isOutlet = pos === 'Outlet';
    const newPlacement = isOutlet
      ? (userFormData.placement && userFormData.placement !== 'Head Office/Warehouse'
          ? userFormData.placement
          : outlets[0]?.namaOutlet || 'Resto Senopati')
      : 'Head Office/Warehouse';

    setUserFormData({
      ...userFormData,
      position: pos,
      access: getPositionAccessList(pos),
      placement: newPlacement,
      outletName: isOutlet ? (userFormData.outletName || outlets[0]?.namaOutlet || 'Resto Senopati') : undefined,
      department: isOutlet ? (userFormData.department || 'Kitchen') : undefined,
    });
  };

  const handlePlacementSelect = (placementVal: string) => {
    const isNonOutlet = placementVal === 'Head Office/Warehouse';
    if (isNonOutlet) {
      setUserFormData({
        ...userFormData,
        placement: 'Head Office/Warehouse',
        outletName: undefined,
        department: undefined,
        position: userFormData.position === 'Outlet' ? 'Administrator' : userFormData.position,
        access: userFormData.position === 'Outlet' ? getPositionAccessList('Administrator') : userFormData.access,
      });
    } else {
      setUserFormData({
        ...userFormData,
        placement: placementVal,
        outletName: placementVal,
        department: userFormData.department || 'Kitchen',
        position: 'Outlet',
        access: getPositionAccessList('Outlet'),
      });
    }
  };

  const handleOpenAddUser = () => {
    setIsEditingUser(false);
    setShowModalPassword(true);
    setIsChangingModalPassword(false);
    setModalNewPassword('');
    setModalConfirmPassword('');
    setModalPasswordError('');
    setUserFormData({
      username: '',
      position: 'Outlet',
      email: '',
      password: 'password123',
      access: getPositionAccessList('Outlet'),
      placement: outlets[0]?.namaOutlet || 'Resto Senopati',
      outletName: outlets[0]?.namaOutlet || 'Resto Senopati',
      department: 'Kitchen',
    });
    setShowUserModal(true);
  };

  const handleOpenEditUser = (u: User) => {
    setIsEditingUser(true);
    setShowModalPassword(true);
    setIsChangingModalPassword(false);
    setModalNewPassword('');
    setModalConfirmPassword('');
    setModalPasswordError('');
    const initialPlacement =
      u.placement ||
      (u.position !== 'Outlet' ? 'Head Office/Warehouse' : u.outletName || outlets[0]?.namaOutlet || 'Resto Senopati');
    setUserFormData({
      ...u,
      password: u.password && u.password.trim() !== '' ? u.password : 'password123',
      placement: initialPlacement,
    });
    setShowUserModal(true);
  };

  const handleSaveUserForm = (e: React.FormEvent) => {
    e.preventDefault();
    setModalPasswordError('');
    if (!userFormData.username || !userFormData.email) return;

    const uname = userFormData.username.trim();
    const pos = userFormData.position || 'Outlet';
    const email = userFormData.email.trim();
    const isNonOutlet = pos !== 'Outlet' || userFormData.placement === 'Head Office/Warehouse';
    const finalPlacement = isNonOutlet
      ? 'Head Office/Warehouse'
      : (userFormData.placement || userFormData.outletName || outlets[0]?.namaOutlet || 'Resto Senopati');
    const finalOutletName = isNonOutlet ? undefined : finalPlacement;
    const finalDept = isNonOutlet ? undefined : (userFormData.department || 'Kitchen');
    const isEdit = isEditingUser;

    const existingUser = isEdit ? users.find((u) => u.id === (userFormData as User).id) : null;
    let finalPassword = userFormData.password?.trim()
      ? userFormData.password.trim()
      : (existingUser?.password || 'password123');

    if (isChangingModalPassword) {
      if (!modalNewPassword.trim()) {
        setModalPasswordError('Password baru tidak boleh kosong.');
        return;
      }
      if (modalConfirmPassword.trim() && modalNewPassword.trim() !== modalConfirmPassword.trim()) {
        setModalPasswordError('Konfirmasi password baru tidak sesuai.');
        return;
      }
      finalPassword = modalNewPassword.trim();
    }

    const payload: User = {
      ...(userFormData as User),
      username: uname,
      email: email,
      position: pos,
      placement: finalPlacement,
      outletName: finalOutletName,
      department: finalDept,
      password: finalPassword,
    };

    if (isEditingUser) {
      updateUser(payload);
    } else {
      addUser(payload as Omit<User, 'id'>);
    }

    setShowUserModal(false);

    // Pop-up sukses simpan user
    setSuccessModalData({
      title: 'Data Telah Berhasil Di-input!',
      message: isEdit
        ? `Akun pengguna ${uname} berhasil diperbarui.`
        : `Pengguna baru ${uname} berhasil didaftarkan ke sistem.`,
      details: [
        { label: 'Username', value: uname },
        { label: 'Jabatan / Posisi', value: pos },
        { label: 'Penempatan User', value: finalPlacement },
        { label: 'Departemen', value: finalDept || '-' },
        { label: 'Email', value: email },
        { label: 'Password', value: finalPassword },
        { label: 'Aksi', value: isEdit ? 'Update User' : 'User Baru' },
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
            <Settings className="w-6 h-6 text-slate-800" />
            System & Setting (Pusat Kontrol Outlet, Akses & Profil User)
          </h1>
          <p className="text-xs text-slate-500">
            Kelola data user pribadi yang sedang login, pengaturan password, hak akses pengguna (RBAC), dan konfigurasi sistem.
          </p>
        </div>

        {/* Sub-tabs */}
        <div className="flex items-center gap-1.5 bg-slate-200/70 p-1 rounded-xl">
          {isAdmin && (
            <button
              onClick={() => setActiveSubTab('outlet-control')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeSubTab === 'outlet-control'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Store className="w-3.5 h-3.5 text-amber-600" />
              Data Outlet ({outlets.length})
            </button>
          )}
          <button
            onClick={() => setActiveSubTab('user-control')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'user-control'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-emerald-600" />
            User Control ({visibleUsers.length})
          </button>
          {isAdmin && (
            <button
              onClick={() => setActiveSubTab('inventory-control')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeSubTab === 'inventory-control'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              Inventory Control
            </button>
          )}
        </div>
      </div>

      {/* 1. Subtab: Data Outlet */}
      {isAdmin && activeSubTab === 'outlet-control' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Store className="w-4 h-4 text-amber-600" />
                Manajemen Data Outlet Resto
              </h2>
              <p className="text-xs text-slate-500">
                Berfungsi untuk mengubah, menambahkan, dan menghapus data dari nama Outlet yang ada (Nama Outlet, Department, Location).
              </p>
            </div>

            <button
              onClick={handleOpenAddOutlet}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition shadow-xs self-start sm:self-auto cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Tambah Outlet Baru
            </button>
          </div>

          {/* Search bar */}
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={outletSearch}
                onChange={(e) => setOutletSearch(e.target.value)}
                placeholder="Cari Nama Outlet atau Lokasi..."
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:bg-white focus:ring-2 focus:ring-amber-500 outline-hidden"
              />
            </div>
          </div>

          {/* Outlets Grid Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredOutlets.length === 0 ? (
              <div className="col-span-full bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400">
                <Store className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                <p className="text-sm font-semibold">Tidak ada outlet yang cocok dengan pencarian.</p>
              </div>
            ) : (
              filteredOutlets.map((outlet) => (
                <div
                  key={outlet.id}
                  className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between hover:shadow-md transition"
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xs">
                          <Store className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-[10px] font-mono font-bold text-slate-400">
                            {outlet.id}
                          </span>
                          <h3 className="font-bold text-sm text-slate-900 leading-tight">
                            {outlet.namaOutlet}
                          </h3>
                        </div>
                      </div>
                    </div>

                    {/* Location */}
                    <div className="my-3 text-xs text-slate-600 flex items-start gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      <MapPin className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">
                          Location (Alamat Cabang):
                        </span>
                        <span className="text-slate-700 leading-relaxed font-medium">
                          {outlet.location}
                        </span>
                      </div>
                    </div>

                    {/* Department list */}
                    <div className="space-y-1.5 my-3">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        Departemen Aktif ({outlet.department.length}):
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {outlet.department.map((dept) => (
                          <span
                            key={dept}
                            className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200"
                          >
                            {dept}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400 font-medium">
                      Status: <strong className="text-emerald-600">Aktif Beroperasi</strong>
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEditOutlet(outlet)}
                        className="flex items-center gap-1 px-2.5 py-1 text-slate-600 hover:text-amber-700 hover:bg-amber-50 rounded-lg text-xs font-bold transition cursor-pointer"
                        title="Ubah Data Outlet"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        Ubah
                      </button>
                      {outlets.length > 1 && (
                        <button
                          onClick={() => handleDeleteOutlet(outlet)}
                          className="flex items-center gap-1 px-2.5 py-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg text-xs font-bold transition cursor-pointer"
                          title="Hapus Outlet"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Hapus
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 2. Subtab: User Control */}
      {activeSubTab === 'user-control' && (
        <div className="space-y-5">
          {/* BAGIAN 1: PENGATURAN DATA USER PRIBADI (USER YANG SEDANG LOGIN) */}
          <div className="bg-white rounded-2xl border border-amber-200 shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 bg-gradient-to-r from-amber-50 via-orange-50/60 to-white border-b border-amber-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-600 text-white flex items-center justify-center font-black text-xs uppercase shadow-2xs shrink-0">
                  {currentUser.username.slice(0, 2)}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-sm font-black text-slate-900">
                      Data User Pribadi Saya (Akun Sedang Login)
                    </h2>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-600 text-white">
                      {currentUser.id} • {currentUser.position}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">
                    Anda dapat mengubah data profil pribadi Anda (Username, Email, Penempatan/Departemen, serta mengganti Password) secara langsung di bawah ini.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleOpenEditUser(currentUser)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-amber-50 text-amber-900 border border-amber-300 text-xs font-bold transition shadow-2xs self-start sm:self-auto cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5 text-amber-600" />
                <span>Buka di Form Modal</span>
              </button>
            </div>

            <form onSubmit={handleSavePersonalProfile} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Username Pribadi */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Username Saya <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={personalForm.username}
                    onChange={(e) =>
                      setPersonalForm({ ...personalForm, username: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 outline-hidden"
                  />
                </div>

                {/* Email Pribadi */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5 text-slate-500" />
                    Email Pribadi <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={personalForm.email}
                    onChange={(e) =>
                      setPersonalForm({ ...personalForm, email: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-medium text-slate-800 focus:ring-2 focus:ring-amber-500 outline-hidden"
                  />
                </div>

                {/* Penempatan / Cabang & Departemen */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-amber-600" />
                    Penempatan & Departemen
                  </label>
                  {currentUser.position === 'Outlet' ? (
                    <div className="grid grid-cols-2 gap-1.5">
                      <select
                        value={personalForm.outletName}
                        onChange={(e) =>
                          setPersonalForm({
                            ...personalForm,
                            outletName: e.target.value,
                            placement: e.target.value,
                          })
                        }
                        className="w-full px-2 py-2 bg-white border border-slate-300 rounded-xl font-semibold text-slate-800 focus:ring-2 focus:ring-amber-500 outline-hidden"
                      >
                        {outlets.map((o) => (
                          <option key={o.id} value={o.namaOutlet}>
                            {o.namaOutlet}
                          </option>
                        ))}
                      </select>
                      <select
                        value={personalForm.department}
                        onChange={(e) =>
                          setPersonalForm({
                            ...personalForm,
                            department: e.target.value as DepartmentName,
                          })
                        }
                        className="w-full px-2 py-2 bg-white border border-slate-300 rounded-xl font-semibold text-slate-800 focus:ring-2 focus:ring-amber-500 outline-hidden"
                      >
                        {DEPARTMENTS.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl font-bold text-slate-700 flex items-center gap-1.5">
                      <Building className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="truncate">Head Office/Warehouse ({currentUser.position})</span>
                    </div>
                  )}
                </div>

                {/* Field Password Saat Ini (Sudah Terisi) + Pilihan Ganti Password */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-slate-700 flex items-center gap-1">
                      <Key className="w-3.5 h-3.5 text-amber-600" />
                      Password Saat Ini
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setIsChangingPersonalPassword(!isChangingPersonalPassword);
                        setPersonalPasswordError('');
                      }}
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-lg border transition cursor-pointer flex items-center gap-1 ${
                        isChangingPersonalPassword
                          ? 'bg-amber-600 text-white border-amber-600'
                          : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-300'
                      }`}
                    >
                      <Lock className="w-3 h-3" />
                      <span>{isChangingPersonalPassword ? 'Batal Ganti' : 'Ganti Password'}</span>
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showPersonalPassword ? 'text' : 'password'}
                      value={personalForm.password}
                      onChange={(e) =>
                        setPersonalForm({ ...personalForm, password: e.target.value })
                      }
                      className="w-full pl-3 pr-9 py-2 bg-slate-50 focus:bg-white border border-slate-300 rounded-xl font-mono font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 outline-hidden"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPersonalPassword(!showPersonalPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                      title={showPersonalPassword ? 'Sembunyikan Password' : 'Tampilkan Password'}
                    >
                      {showPersonalPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Panel Pilihan Ganti Password Pribadi */}
              {isChangingPersonalPassword && (
                <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-amber-950 flex items-center gap-1.5">
                      <Key className="w-4 h-4 text-amber-600" />
                      <span>Formulir Ganti Password Akun Pribadi ({currentUser.username})</span>
                    </div>
                    <span className="text-[11px] text-amber-800">
                      Password lama: <strong className="font-mono">{currentUser.password || 'password123'}</strong>
                    </span>
                  </div>

                  {personalPasswordError && (
                    <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 font-semibold text-xs">
                      {personalPasswordError}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Password Baru <span className="text-red-500">*</span>
                      </label>
                      <input
                        type={showPersonalPassword ? 'text' : 'password'}
                        value={personalNewPassword}
                        onChange={(e) => setPersonalNewPassword(e.target.value)}
                        placeholder="Masukkan password baru..."
                        className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl font-mono font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 outline-hidden"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Konfirmasi Password Baru
                      </label>
                      <input
                        type={showPersonalPassword ? 'text' : 'password'}
                        value={personalConfirmPassword}
                        onChange={(e) => setPersonalConfirmPassword(e.target.value)}
                        placeholder="Ulangi password baru..."
                        className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl font-mono font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 outline-hidden"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-slate-100 flex-wrap gap-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] text-slate-500 font-semibold">Hak Akses Aktif:</span>
                  {currentUser.access.map((acc) => (
                    <span
                      key={acc}
                      className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200"
                    >
                      {acc}
                    </span>
                  ))}
                </div>

                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Simpan Perubahan Data Pribadi</span>
                </button>
              </div>
            </form>
          </div>

          {/* BAGIAN 2: TABEL DAFTAR PENGGUNA & MATRIKS HAK AKSES (USER CONTROL) */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                {isAdmin
                  ? 'Daftar Pengguna & Matriks Hak Akses (RBAC)'
                  : 'Data Akun Pribadi & Hak Akses Saya'}
              </h2>
              <p className="text-xs text-slate-500">
                {isAdmin
                  ? 'Pengaturan seluruh akun pengguna sistem: Username, Position, Access, Email, dan Field Password yang sudah terisi beserta pilihan Ganti Password.'
                  : 'Rincian akun Anda yang sedang login beserta pengaturan password dan hak akses.'}
              </p>
            </div>

            {isAdmin && (
              <button
                onClick={handleOpenAddUser}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition shadow-xs self-start sm:self-auto cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Tambah User Baru
              </button>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2.5">User ID</th>
                    <th className="px-3 py-2.5">Username</th>
                    <th className="px-3 py-2.5">Position</th>
                    <th className="px-3 py-2.5">Email</th>
                    <th className="px-3 py-2.5">Password & Pilihan Ganti</th>
                    <th className="px-3 py-2.5">Penempatan & Dept</th>
                    <th className="px-3 py-2.5">Hak Akses Sistem</th>
                    <th className="px-3 py-2.5 text-center">Status / Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleUsers.map((u) => {
                    const isCurrent = u.id === currentUser.id;
                    const canManageThisUser = isAdmin || isCurrent;
                    const isNonOutletUser = u.position !== 'Outlet' || u.placement === 'Head Office/Warehouse';
                    const filledPassword = u.password && u.password.trim() !== '' ? u.password : 'password123';
                    const showPwd = isTablePasswordVisible(u.id);

                    return (
                      <tr
                        key={u.id}
                        className={`hover:bg-slate-50 transition ${
                          isCurrent ? 'bg-amber-50/40' : ''
                        }`}
                      >
                        <td className="px-3 py-2.5 font-mono font-bold text-slate-800">
                          {u.id}
                        </td>
                        <td className="px-3 py-2.5 font-extrabold text-slate-900">
                          <div className="flex items-center gap-1.5">
                            <span>{u.username}</span>
                            {isCurrent && (
                              <span className="text-[10px] bg-amber-600 text-white px-1.5 py-0.2 rounded-full font-bold">
                                Aktif (Anda)
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="px-2 py-0.5 rounded-md font-bold text-[10px] bg-slate-100 text-slate-800 border border-slate-200">
                            {u.position}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-slate-600">{u.email}</td>

                        {/* Field Password yang sudah terisi + Pilihan Ganti Password */}
                        <td className="px-3 py-2.5">
                          {canManageThisUser ? (
                            <div className="flex items-center gap-1.5">
                              <div className="relative w-32">
                                <input
                                  type={showPwd ? 'text' : 'password'}
                                  readOnly
                                  value={filledPassword}
                                  className="w-full pl-2.5 pr-7 py-1 bg-slate-50 border border-slate-300 rounded-lg font-mono text-[11px] font-bold text-slate-800 outline-hidden"
                                  title="Password saat ini (sudah terisi)"
                                />
                                <button
                                  type="button"
                                  onClick={() => toggleTablePasswordVisibility(u.id)}
                                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                                  title={showPwd ? 'Sembunyikan Password' : 'Lihat Password'}
                                >
                                  {showPwd ? (
                                    <EyeOff className="w-3.5 h-3.5" />
                                  ) : (
                                    <Eye className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleOpenChangePasswordModal(u)}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-50 hover:bg-amber-600 text-amber-800 hover:text-white border border-amber-300 text-[10px] font-bold transition cursor-pointer shrink-0"
                                title={`Ganti Password untuk ${u.username}`}
                              >
                                <Key className="w-3 h-3" />
                                <span>Ganti Password</span>
                              </button>
                            </div>
                          ) : (
                            <span className="font-mono text-slate-400 text-[11px] select-none">
                              ••••••••
                            </span>
                          )}
                        </td>

                        <td className="px-3 py-2.5 text-slate-700">
                          {isNonOutletUser ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold text-[11px] bg-slate-100 text-slate-700 border border-slate-200">
                              <Building className="w-3.5 h-3.5 text-slate-500" />
                              Head Office/Warehouse
                            </span>
                          ) : (
                            <div className="flex flex-col">
                              <span className="font-extrabold text-slate-900 flex items-center gap-1 text-xs">
                                <Store className="w-3.5 h-3.5 text-amber-600" />
                                {u.placement || u.outletName}
                              </span>
                              {u.department && (
                                <span className="text-[10px] text-amber-800 font-semibold mt-0.5">
                                  Departemen: <strong>{u.department}</strong>
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {u.access.map((acc) => (
                              <span
                                key={acc}
                                className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200"
                              >
                                {acc}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {!isCurrent && isAdmin && (
                              <button
                                onClick={() => setCurrentUser(u)}
                                className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 text-[10px] font-bold rounded-md transition cursor-pointer"
                                title="Beralih peran ke user ini"
                              >
                                Switch
                              </button>
                            )}
                            {canManageThisUser && (
                              <button
                                onClick={() => handleOpenEditUser(u)}
                                className="inline-flex items-center gap-1 px-2 py-1 text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-md text-[10px] font-bold transition cursor-pointer"
                                title={isCurrent ? 'Ubah Data Pribadi Saya' : 'Ubah User'}
                              >
                                <Edit2 className="w-3 h-3" />
                                <span>{isCurrent ? 'Ubah Data Saya' : 'Ubah'}</span>
                              </button>
                            )}
                            {isAdmin && users.length > 1 && !isCurrent && (
                              <button
                                onClick={() => {
                                  if (confirm(`Hapus pengguna ${u.username}?`)) {
                                    deleteUser(u.id);
                                  }
                                }}
                                className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md cursor-pointer"
                                title="Hapus User"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
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
        </div>
      )}

      {/* 3. Subtab: Inventory Control */}
      {isAdmin && activeSubTab === 'inventory-control' && (
        <div className="space-y-6">
          {/* Isolation & Category Mapping Grid */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <h3 className="font-bold text-sm text-slate-900 mb-1">
              Pemetaan Departemen & Kategori Barang Terisolasi
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Setiap departemen memiliki batasan kategori pesanan agar tidak terjadi duplikasi atau kekeliruan antar divisi dalam 1 outlet resto.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {DEPARTMENTS.map((dept) => {
                const cats = DEPARTMENT_CATEGORY_MAP[dept] || [];
                return (
                  <div key={dept} className="p-4 rounded-xl border border-slate-200 bg-slate-50/60">
                    <h4 className="font-bold text-xs text-slate-900 flex items-center justify-between pb-2 border-b border-slate-200">
                      <span>Departemen {dept}</span>
                      <span className="text-[10px] bg-slate-200 px-1.5 py-0.2 rounded-md font-bold">
                        {cats.length} Kategori
                      </span>
                    </h4>
                    <ul className="mt-2.5 space-y-1.5">
                      {cats.map((c) => (
                        <li key={c} className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>{c}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 9 Standard Categories Matrix */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <h3 className="font-bold text-sm text-slate-900 mb-1">
              9 Kategori Bahan Baku F&B Terdaftar
            </h3>
            <p className="text-xs text-slate-500 mb-3">
              Kategori yang telah dikonfigurasikan di database sentral:
            </p>

            <div className="flex flex-wrap gap-2">
              {ITEM_CATEGORIES.map((cat) => {
                const count = inventory.filter((i) => i.category === cat).length;
                return (
                  <div
                    key={cat}
                    className="px-3 py-2 rounded-xl border border-slate-200 bg-white shadow-2xs text-xs flex items-center gap-2"
                  >
                    <span className="font-bold text-slate-900">{cat}</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800">
                      {count} SKU
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Clear Form Data & Emergency Reset */}
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-amber-200 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-sm text-amber-900 flex items-center gap-2">
                  <Trash2 className="w-4 h-4 text-amber-600" />
                  Hapus Semua Data Form Transaksi
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Mengosongkan seluruh formulir dan riwayat transaksi pada <strong>Inbound</strong>, <strong>Outbond</strong>, <strong>Purchase Request</strong>, <strong>Purchasing &amp; Vendor</strong>, dan <strong>Cost Control</strong> tanpa menghapus Master Inventory &amp; Data Outlet.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  clearAllForms();
                  setSuccessModalData({
                    title: 'Seluruh Data Form Transaksi Dikosongkan!',
                    message:
                      'Seluruh formulir dan riwayat transaksi pada Inbound, Outbond, Purchase Request, Purchasing & Vendor, dan Cost Control telah dikosongkan.',
                    details: [
                      { label: 'Inbound & Outbond', value: 'Kosong (0 Form)' },
                      { label: 'Purchase Request & PO', value: 'Kosong (0 Form)' },
                      { label: 'Cost Control', value: 'Kosong (0 Form)' },
                      { label: 'Data Outlet & User', value: 'Tetap Tersimpan' },
                    ],
                  });
                  setShowSuccessModal(true);
                  scrollToTop();
                }}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1.5 self-start sm:self-auto shrink-0 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Hapus Data Form
              </button>
            </div>

            <div className="bg-white rounded-xl border border-rose-200 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-sm text-rose-900 flex items-center gap-2">
                  <Trash2 className="w-4 h-4 text-rose-600" />
                  Kosongkan Seluruh Data Master Inventory
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Menghapus dan mengosongkan seluruh daftar item barang pada <strong>Master Inventory</strong> di semua periode tanpa menghapus Data Outlet &amp; User.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  clearMasterInventory({ allPeriods: true });
                  setSuccessModalData({
                    title: 'Master Inventory Berhasil Dikosongkan!',
                    message:
                      'Seluruh data barang pada Master Inventory di semua periode telah dikosongkan.',
                    details: [
                      { label: 'Total SKU Master Inventory', value: '0 SKU (Kosong)' },
                      { label: 'Data Outlet & User', value: 'Tetap Tersimpan' },
                    ],
                  });
                  setShowSuccessModal(true);
                  scrollToTop();
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1.5 self-start sm:self-auto shrink-0 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Kosongkan Master Inventory
              </button>
            </div>

            <div className="bg-white rounded-xl border border-indigo-200 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-sm text-indigo-900 flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-indigo-600" />
                  Reset Stok Master Inventory
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Mengatur ulang seluruh item di Master Inventory menjadi <strong>Inbound: 0</strong> dan <strong>Outbond: 0</strong>.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  resetInventoryBalances();
                  setSuccessModalData({
                    title: 'Saldo Stok Master Inventory Direset!',
                    message:
                      'Seluruh mutasi Inbound dan Outbond pada Master Inventory telah direset menjadi 0.',
                    details: [
                      { label: 'Inbound & Outbond', value: '0' },
                    ],
                  });
                  setShowSuccessModal(true);
                  scrollToTop();
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1.5 self-start sm:self-auto shrink-0 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset Master Inventory
              </button>
            </div>

            <div className="bg-white rounded-xl border border-red-200 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-sm text-red-900 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  Reset Database ke Standar Awal
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Mengembalikan pengaturan database dan master data ke kondisi awal (kosong).
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  resetAllData();
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1.5 self-start sm:self-auto shrink-0 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset Database
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Tambah / Ubah Data Outlet */}
      {showOutletModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <form
            onSubmit={handleSaveOutletForm}
            className="bg-white rounded-2xl shadow-xl max-w-lg w-full border border-slate-200 p-6 space-y-4"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <Store className="w-4 h-4 text-amber-600" />
                {isEditingOutlet ? 'Ubah Data Outlet' : 'Tambah Outlet Baru'}
              </h3>
              <button type="button" onClick={() => setShowOutletModal(false)}>
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nama Outlet <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={outletFormData.namaOutlet || ''}
                  onChange={(e) =>
                    setOutletFormData({ ...outletFormData, namaOutlet: e.target.value })
                  }
                  placeholder="Contoh: Resto Kelapa Gading"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-hidden font-medium"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">
                  Department Terdaftar di Outlet Ini: <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {DEPARTMENTS.map((dept) => {
                    const checked = outletFormData.department?.includes(dept);
                    return (
                      <label
                        key={dept}
                        className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer text-xs transition ${
                          checked
                            ? 'bg-amber-50 border-amber-300 text-amber-900 font-bold'
                            : 'border-slate-200 text-slate-600'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => handleToggleDepartment(dept)}
                          className="accent-amber-600"
                        />
                        <span>{dept}</span>
                      </label>
                    );
                  })}
                </div>
                <span className="text-[10px] text-slate-400 block mt-1">
                  Pilih departemen yang aktif melakukan pemesanan bahan baku untuk outlet ini.
                </span>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Location (Alamat & Wilayah) <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={2}
                  required
                  value={outletFormData.location || ''}
                  onChange={(e) =>
                    setOutletFormData({ ...outletFormData, location: e.target.value })
                  }
                  placeholder="Contoh: Mall Kelapa Gading 3 Lt. 2 No. 24, Jakarta Utara"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-hidden"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowOutletModal(false)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-xs transition"
              >
                {isEditingOutlet ? 'Simpan Perubahan' : 'Tambah Outlet'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Ganti Password Cepat */}
      {changePasswordTargetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <form
            onSubmit={handleSaveChangePasswordModal}
            className="bg-white rounded-2xl shadow-xl max-w-md w-full border border-slate-200 p-6 space-y-4"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <Key className="w-4 h-4 text-amber-600" />
                Ganti Password Pengguna
              </h3>
              <button
                type="button"
                onClick={() => setChangePasswordTargetUser(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block">
                  Akun Pengguna
                </span>
                <span className="font-extrabold text-slate-900">
                  {changePasswordTargetUser.username}
                </span>
                <span className="text-slate-500 ml-1.5">({changePasswordTargetUser.email})</span>
              </div>
              <span className="px-2 py-0.5 rounded-md font-bold text-[10px] bg-amber-100 text-amber-900 border border-amber-200">
                {changePasswordTargetUser.position}
              </span>
            </div>

            {cpError && (
              <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
                {cpError}
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Password Saat Ini (Sudah Terisi)
                </label>
                <div className="relative">
                  <input
                    type={cpCurrentPasswordVisible ? 'text' : 'password'}
                    readOnly
                    value={changePasswordTargetUser.password || 'password123'}
                    className="w-full pl-3 pr-9 py-2 bg-slate-100 border border-slate-300 rounded-lg font-mono font-bold text-slate-700 outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setCpCurrentPasswordVisible(!cpCurrentPasswordVisible)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    {cpCurrentPasswordVisible ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Password Baru <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={cpShowNewPassword ? 'text' : 'password'}
                    required
                    value={cpNewPassword}
                    onChange={(e) => setCpNewPassword(e.target.value)}
                    placeholder="Masukkan password baru..."
                    className="w-full pl-3 pr-9 py-2 bg-white border border-slate-300 rounded-lg font-mono font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setCpShowNewPassword(!cpShowNewPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    {cpShowNewPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Konfirmasi Password Baru
                </label>
                <input
                  type={cpShowNewPassword ? 'text' : 'password'}
                  value={cpConfirmPassword}
                  onChange={(e) => setCpConfirmPassword(e.target.value)}
                  placeholder="Ketik ulang password baru..."
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 outline-hidden"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setChangePasswordTargetUser(null)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-xs transition cursor-pointer"
              >
                Simpan Password Baru
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Tambah/Ubah User Control */}
      {showUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <form
            onSubmit={handleSaveUserForm}
            className="bg-white rounded-2xl shadow-xl max-w-lg w-full border border-slate-200 p-6 space-y-4 max-h-[85vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-900">
                {isEditingUser ? 'Ubah Pengguna Sistem' : 'Tambah Pengguna Baru'}
              </h3>
              <button type="button" onClick={() => setShowUserModal(false)}>
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Username</label>
                <input
                  type="text"
                  required
                  value={userFormData.username || ''}
                  onChange={(e) =>
                    setUserFormData({ ...userFormData, username: e.target.value })
                  }
                  placeholder="e.g. chef.menteng"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 outline-hidden font-medium"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Position (Jabatan & Otoritas)
                </label>
                <select
                  value={userFormData.position || 'Outlet'}
                  disabled={!isAdmin}
                  onChange={(e) => handlePositionSelect(e.target.value as UserPosition)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 outline-hidden font-semibold disabled:bg-slate-100 disabled:text-slate-500"
                >
                  {POSITIONS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              {/* Field Pilihan Penempatan User */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-700" />
                      Pilihan Penempatan User <span className="text-red-500">*</span>
                    </span>
                    <span className="text-[10px] font-normal text-slate-500">
                      Non-outlet otomatis di Head Office/Warehouse
                    </span>
                  </label>
                  <select
                    value={
                      userFormData.position !== 'Outlet'
                        ? 'Head Office/Warehouse'
                        : userFormData.placement || userFormData.outletName || outlets[0]?.namaOutlet || 'Resto Senopati'
                    }
                    disabled={!isAdmin && userFormData.position !== 'Outlet'}
                    onChange={(e) => handlePlacementSelect(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-slate-900 outline-hidden disabled:bg-slate-100"
                  >
                    {isAdmin && (
                      <option value="Head Office/Warehouse">
                        🏢 Non-Outlet (Head Office/Warehouse)
                      </option>
                    )}
                    {!isAdmin && userFormData.position !== 'Outlet' && (
                      <option value="Head Office/Warehouse">
                        🏢 Non-Outlet (Head Office/Warehouse)
                      </option>
                    )}
                    <optgroup label="Pilihan Cabang Outlet">
                      {outlets.map((o) => (
                        <option key={o.id} value={o.namaOutlet}>
                          🏪 Outlet: {o.namaOutlet}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                {/* Info Penempatan & Pilihan Departemen */}
                {userFormData.position !== 'Outlet' || userFormData.placement === 'Head Office/Warehouse' ? (
                  <div className="flex items-center gap-2 p-2.5 bg-slate-100 rounded-lg text-slate-700 text-[11px] border border-slate-200">
                    <Building className="w-4 h-4 text-slate-500 shrink-0" />
                    <span>
                      User berposisi <strong>{userFormData.position || 'Non-Outlet'}</strong>, penempatan otomatis diset di <strong>Head Office/Warehouse</strong>.
                    </span>
                  </div>
                ) : (
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Departemen Outlet <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={userFormData.department || 'Kitchen'}
                      onChange={(e) =>
                        setUserFormData({
                          ...userFormData,
                          department: e.target.value as DepartmentName,
                        })
                      }
                      className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-slate-900 outline-hidden"
                    >
                      {DEPARTMENTS.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] text-slate-500 mt-1">
                      Departemen operasional di cabang {userFormData.placement || userFormData.outletName}.
                    </p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={userFormData.email || ''}
                    onChange={(e) =>
                      setUserFormData({ ...userFormData, email: e.target.value })
                    }
                    placeholder="user@1010group.id"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 outline-hidden"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold text-slate-700 flex items-center gap-1">
                      <Key className="w-3.5 h-3.5 text-amber-600" />
                      Password (Sudah Terisi)
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setIsChangingModalPassword(!isChangingModalPassword);
                        setModalPasswordError('');
                      }}
                      className={`text-[10px] font-bold px-2 py-0.5 rounded border transition cursor-pointer ${
                        isChangingModalPassword
                          ? 'bg-amber-600 text-white border-amber-600'
                          : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-300'
                      }`}
                    >
                      {isChangingModalPassword ? 'Batal Ganti' : 'Ganti Password'}
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showModalPassword ? 'text' : 'password'}
                      value={userFormData.password || ''}
                      onChange={(e) =>
                        setUserFormData({ ...userFormData, password: e.target.value })
                      }
                      className="w-full pl-3 pr-9 py-2 border border-slate-300 rounded-lg font-mono font-bold text-slate-900 focus:ring-2 focus:ring-slate-900 outline-hidden"
                    />
                    <button
                      type="button"
                      onClick={() => setShowModalPassword(!showModalPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                      title={showModalPassword ? 'Sembunyikan Password' : 'Tampilkan Password'}
                    >
                      {showModalPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Pilihan Ganti Password di dalam Modal User */}
              {isChangingModalPassword && (
                <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200 space-y-2.5">
                  <div className="font-bold text-amber-950 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-amber-600" />
                    <span>Ganti Password Baru</span>
                  </div>

                  {modalPasswordError && (
                    <div className="p-2 rounded-lg bg-red-50 border border-red-200 text-red-700 font-semibold text-[11px]">
                      {modalPasswordError}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Password Baru <span className="text-red-500">*</span>
                      </label>
                      <input
                        type={showModalPassword ? 'text' : 'password'}
                        value={modalNewPassword}
                        onChange={(e) => setModalNewPassword(e.target.value)}
                        placeholder="Password baru..."
                        className="w-full px-3 py-1.5 bg-white border border-amber-300 rounded-lg font-mono font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 outline-hidden"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Konfirmasi Password Baru
                      </label>
                      <input
                        type={showModalPassword ? 'text' : 'password'}
                        value={modalConfirmPassword}
                        onChange={(e) => setModalConfirmPassword(e.target.value)}
                        placeholder="Ulangi password baru..."
                        className="w-full px-3 py-1.5 bg-white border border-amber-300 rounded-lg font-mono font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 outline-hidden"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Hak Akses Terkonfigurasi Otomatis (Access Matrix):
                </label>
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-wrap gap-1.5">
                  {userFormData.access?.map((acc) => (
                    <span
                      key={acc}
                      className="px-2 py-0.5 rounded text-[10px] font-bold bg-white text-slate-700 border border-slate-200"
                    >
                      {acc}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowUserModal(false)}
                className="px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-xs cursor-pointer"
              >
                Simpan User
              </button>
            </div>
          </form>
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
