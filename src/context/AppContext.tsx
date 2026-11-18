import React, { createContext, useContext, useState, useEffect, useRef, useMemo } from 'react';
import {
  AuditActionCategory,
  AuditChangeItem,
  AuditDepartmentScope,
  AuditLogEntry,
  AuditModuleName,
  AuditSeverity,
  DepartmentName,
  InboundReceivingRecord,
  InventoryItem,
  ManualInboundRecord,
  ManualOutbondRecord,
  OrderItem,
  OutletData,
  OutletOrder,
  PaymentMethodType,
  PurchaseOrder,
  StockOpnameReport,
  StockOpnameItem,
  User,
  Vendor,
} from '../types';
import { formatDate } from '../utils/dateUtils';
import { formatRupiah } from '../utils/excelExport';
import {
  formatPeriodLabel,
  getCurrentPeriodKey,
  getNextPeriod,
  normalizeInventoryItem,
} from '../utils/inventoryUtils';
import { findInventoryItemBySku } from '../utils/prOutletTemplate';
import { api, changesBetween, recordKey, WarehouseError } from '../lib/warehouseApi';
import type { WarehouseRecord, SessionUser } from '../lib/warehouseApi';
import { jakartaDate, roundMoney, roundQuantity } from '../utils/inventoryUtils';
import { calculateReceipt, type ReceiptEntry } from '../utils/receiving';
import { canApprovePO, canReleasePO, purchaseTerms, revisePO } from '../utils/purchaseApproval';

interface AppContextType {
  outlets: OutletData[];
  addOutlet: (outlet: Omit<OutletData, 'id'>) => void;
  updateOutlet: (outlet: OutletData) => void;
  deleteOutlet: (id: string) => void;

  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; message?: string; user?: User }>;
  logout: () => void;

  currentUser: User;
  users: User[];
  addUser: (user: Omit<User, 'id'>) => Promise<void>;
  updateUser: (user: User) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;

  confirmPendingSave: () => Promise<void>;
  inventory: InventoryItem[];
  updateStockOpname: (sku: string, opnameQty: number) => void;
  addInventoryItem: (item: InventoryItem) => void;
  updateInventoryItem: (item: InventoryItem) => void;
  deleteInventoryItem: (sku: string) => void;
  clearMasterInventory: (options?: { allPeriods?: boolean }) => { success: boolean; message: string };
  bulkImportMasterInventory: (
    items: InventoryItem[],
    replaceAll: boolean,
    targetPeriod?: string
  ) => { success: boolean; count: number; message: string };

  // Periodic Inventory & Stock Opname
  selectedPeriod: string;
  setSelectedPeriod: (period: string) => void;
  periodicInventories: Record<string, InventoryItem[]>;
  stockOpnameReports: StockOpnameReport[];
  startStockOpname: (data: {
    period: string;
    conductedDate: string;
    checkerName: string;
    supervisorName?: string;
    items: { sku: string; physicalCount: number; notes?: string }[];
    notes?: string;
    submitForReview?: boolean;
  }) => { success: boolean; reportId: string; message: string };
  approveStockOpnameReport: (reportId: string, reviewerName: string) => { success: boolean; message: string };
  rejectStockOpnameReport: (reportId: string, reason?: string) => { success: boolean; message: string };
  generateFinalSO: (period: string, actorName: string) => { success: boolean; nextPeriod: string; message: string };


  outletOrders: OutletOrder[];
  createOutletOrder: (order: Omit<OutletOrder, 'createdAt' | 'updatedAt'>) => { success: boolean; message: string; orderId?: string };
  bulkImportOutletOrders: (
    newOrders: Omit<OutletOrder, 'createdAt' | 'updatedAt'>[],
    overwriteExisting?: boolean
  ) => { success: boolean; count: number; message: string };
  updateOutletOrder: (order: OutletOrder) => void;
  deleteOutletOrder: (id: string) => void;
  updateOrderItem: (orderId: string, item: OrderItem) => void;
  addOrderItem: (orderId: string, item: OrderItem) => void;
  deleteOrderItem: (orderId: string, sku: string) => void;

  purchaseOrders: PurchaseOrder[];
  generatePO: (sourceOrderIds: string[]) => { success: boolean; poId?: string; message: string };
  updatePO: (po: PurchaseOrder) => void;
  deletePO: (id: string) => void;
  submitPOToPurchasing: (poId: string) => void;
  submitPOToVendorSummary: (poId: string) => { success: boolean; message: string };
  submitPOToVendor: (poId: string) => void;
  submitPOToCostControl: (poId: string, notes?: string) => { success: boolean; message: string };
  batchSubmitPOToCostControl: (poIds: string[], notes?: string) => { success: boolean; count: number; message: string };
  approvePOCostControl: (poId: string, approvalNotes?: string) => { success: boolean; message: string };
  rejectPOCostControl: (poId: string, reason: string) => { success: boolean; message: string };
  returnPOToVendorSummary: (poId: string, notes?: string) => { success: boolean; message: string };
  updateVendorSummaryItem: (
    poId: string,
    sku: string,
    place: string | undefined,
    updates: {
      qty?: number;
      price?: number;
      vendorName?: string;
    }
  ) => { success: boolean; message: string };

  vendors: Vendor[];
  addVendor: (vendor: Omit<Vendor, 'id'>) => void;
  updateVendor: (vendor: Vendor) => void;
  deleteVendor: (id: string) => void;
  assignVendorToPOItem: (
    poId: string,
    sku: string,
    vendorName: string,
    paymentMethod?: PaymentMethodType,
    paymentTerm?: string,
    place?: string
  ) => void;
  updatePOItemPayment: (
    poId: string,
    sku: string,
    place: string | undefined,
    paymentMethod: PaymentMethodType,
    paymentTerm?: string
  ) => void;
  setItemApprovalStatus: (
    poId: string,
    sku: string,
    place: string | undefined,
    status: 'Approved' | 'Rejected',
    reason?: string
  ) => void;
  batchSetItemApprovalStatus: (
    updates: { poId: string; sku: string; place?: string; status: 'Approved' | 'Rejected'; reason?: string }[]
  ) => void;
  rejectPOItem: (poId: string, sku: string, reason: string, place?: string) => void;
  submitPOVendorToReceiving: (poId: string) => {
    success: boolean;
    message: string;
    receivingCount?: number;
    receivingIds?: string[];
  };
  batchReleasePOToVendor: (poIds: string[]) => {
    success: boolean;
    count: number;
    receivingCount: number;
    receivingIds: string[];
    message: string;
  };

  receivingRecords: InboundReceivingRecord[];
  receiveGoods: (
    recordId: string,
    receivedItems: ReceiptEntry[],
    notes?: string
  ) => { success: boolean; message: string };
  deleteReceivingRecord: (id: string) => void;

  manualInboundRecords: ManualInboundRecord[];
  addManualInbound: (record: Omit<ManualInboundRecord, 'id' | 'date'> & { date?: string }) => { success: boolean; message: string };
  deleteManualInbound: (id: string) => void;

  manualOutbondRecords: ManualOutbondRecord[];
  addManualOutbond: (record: Omit<ManualOutbondRecord, 'id' | 'date'> & { date?: string }) => { success: boolean; message: string };
  deleteManualOutbond: (id: string) => void;

  deployOutletOrder: (
    orderId: string,
    shippedItems?: { sku: string; qtyShipped: number }[]
  ) => void;
  generateDeploymentPO: (
    orderId: string,
    updatedItems?: OrderItem[],
    allowPartialShipment?: boolean
  ) => {
    success: boolean;
    message: string;
    isPartial?: boolean;
    shippedCount?: number;
    remainingCount?: number;
    remainingOrderId?: string;
  };
  approveShipmentToPOTerkirim: (orderId: string) => { success: boolean; message: string };
  finalApproveToOutbond: (orderId: string) => { success: boolean; message: string };

  auditLogs: AuditLogEntry[];
  addAuditLog: (entry: {
    module: AuditModuleName;
    category: AuditActionCategory;
    action: string;
    description: string;
    referenceId?: string;
    department?: AuditDepartmentScope;
    outletName?: string;
    severity?: AuditSeverity;
    changes?: AuditChangeItem[];
  }) => void;
  clearAuditLogs: () => void;

  canAccess: (feature: string) => boolean;
  resetAllData: () => void;
  clearAllForms: () => void;
  resetInventoryBalances: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const signedOutUser: User = {
  id: '', email: '', username: '', position: 'Outlet', access: [],
};
const EMPTY_INVENTORY: InventoryItem[] = [];

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<User | null>(null);
  const currentUser = session ?? signedOutUser;
  const isAuthenticated = session !== null;
  const [loadingSession, setLoadingSession] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [outlets, setOutlets] = useState<OutletData[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedPeriod, setSelectedPeriodState] = useState(getCurrentPeriodKey);
  const [periodicInventories, setPeriodicInventories] = useState<Record<string, InventoryItem[]>>({});
  const inventory = periodicInventories[selectedPeriod] ?? EMPTY_INVENTORY;
  const setInventory = (update: React.SetStateAction<InventoryItem[]>) => {
    setPeriodicInventories((previous) => ({
      ...previous,
      [selectedPeriod]: typeof update === 'function' ? update(previous[selectedPeriod] ?? EMPTY_INVENTORY) : update,
    }));
  };
  const [stockOpnameReports, setStockOpnameReports] = useState<StockOpnameReport[]>([]);
  const [outletOrders, setOutletOrders] = useState<OutletOrder[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [receivingRecords, setReceivingRecords] = useState<InboundReceivingRecord[]>([]);
  const [manualInboundRecords, setManualInboundRecords] = useState<ManualInboundRecord[]>([]);
  const [manualOutbondRecords, setManualOutbondRecords] = useState<ManualOutbondRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const baseline = useRef<WarehouseRecord[]>([]);
  const currentRecords = useMemo(() => {
    const rows = <T extends { id: string }>(kind: string, items: T[]) =>
      items.map((data) => ({ kind, id: data.id, data: { ...data } as Record<string, unknown> }));
    return [
      ...rows('outlet', outlets),
      ...rows('order', outletOrders),
      ...rows('po', purchaseOrders),
      ...rows('vendor', vendors),
      ...rows('receipt', receivingRecords),
      ...rows('inbound', manualInboundRecords),
      ...rows('outbound', manualOutbondRecords),
      ...rows('opname', stockOpnameReports),
      ...rows('audit', auditLogs),
      ...Object.entries(periodicInventories).flatMap(([period, items]) => items.map((item) => ({
        kind: 'stock',
        id: period + ':' + item.sku,
        data: { ...item, period } as Record<string, unknown>,
      }))),
    ];
  }, [outlets, outletOrders, purchaseOrders, vendors, receivingRecords, manualInboundRecords,
    manualOutbondRecords, stockOpnameReports, auditLogs, periodicInventories]);
  const latestRecords = useRef(currentRecords);
  latestRecords.current = currentRecords;
  const inFlight = useRef(false);
  const changes = loaded && isAuthenticated ? changesBetween(baseline.current, currentRecords) : [];
  const [saveRequest, setSaveRequest] = useState(0);
  const saveWaiters = useRef<{ resolve: () => void; reject: (error: Error) => void }[]>([]);
  const confirmPendingSave = () => new Promise<void>((resolve, reject) => {
    saveWaiters.current.push({ resolve, reject });
    setSaveRequest((request) => request + 1);
  });

  useEffect(() => {
    if (!saveWaiters.current.length) return;
    if (saveError || !loaded || !isAuthenticated) {
      const error = new Error(saveError || 'Sesi tidak tersedia.');
      saveWaiters.current.splice(0).forEach(({ reject }) => reject(error));
    } else if (!saving && !inFlight.current && changes.length === 0) {
      saveWaiters.current.splice(0).forEach(({ resolve }) => resolve());
    }
  }, [saveRequest, saving, changes.length, saveError, loaded, isAuthenticated]);


  const hydrate = (records: WarehouseRecord[]) => {
    baseline.current = records;
    const rows = <T,>(kind: string) => records.filter((r) => r.kind === kind).map((r) => r.data as T);
    const periods: Record<string, InventoryItem[]> = {};
    for (const item of rows<InventoryItem>('stock')) {
      const period = item.period!;
      (periods[period] ??= []).push(item);
    }
    setOutlets(rows<OutletData>('outlet'));
    setOutletOrders(rows<OutletOrder>('order').sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    setPurchaseOrders(rows<PurchaseOrder>('po').sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    setVendors(rows<Vendor>('vendor'));
    setReceivingRecords(rows<InboundReceivingRecord>('receipt'));
    setManualInboundRecords(rows<ManualInboundRecord>('inbound').sort((a, b) => b.date.localeCompare(a.date)));
    setManualOutbondRecords(rows<ManualOutbondRecord>('outbound').sort((a, b) => b.date.localeCompare(a.date)));
    setStockOpnameReports(rows<StockOpnameReport>('opname').sort((a, b) => b.period.localeCompare(a.period)));
    setAuditLogs(rows<AuditLogEntry>('audit').sort((a, b) => b.timestamp.localeCompare(a.timestamp)));
    setPeriodicInventories(periods);
  };

  const loadRecords = async () => {
    const [records, directory] = await Promise.all([
      api<WarehouseRecord[]>('records'), api<User[]>('users'),
    ]);
    hydrate(records);
    setUsers(directory);
    setLoaded(true);
    setSaveError('');
  };

  useEffect(() => {
    // Remove credentials left behind by the demo version; operational data stays available for backup.
    for (const key of ['1010group_users_v1', '1010group_curr_user_v1']) localStorage.removeItem(key);
    sessionStorage.removeItem('1010group_auth_session_v1');
    api<SessionUser>('session').then(({ user }) => setSession(user)).catch((error: unknown) => {
      if (!(error instanceof WarehouseError) || error.status !== 401) {
        setSaveError(error instanceof Error ? error.message : 'Sesi tidak dapat dimuat.');
      }
    }).finally(() => setLoadingSession(false));
  }, []);

  useEffect(() => {
    if (!session) return;
    loadRecords().catch((error: Error) => setSaveError(error.message));
  }, [session?.id]);

  useEffect(() => {
    if (!loaded || !isAuthenticated || saving || saveError || !changes.length || inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    api<WarehouseRecord[]>('records', 'POST', { changes }).then((saved) => {
      const next = new Map(baseline.current.map((row) => [recordKey(row), row]));
      for (const change of changes) next.delete(recordKey(change));
      for (const row of saved) next.set(recordKey(row), row);
      const records = [...next.values()];
      const currentUserRows = new Map(latestRecords.current.map((record) => [recordKey(record), record]));
      const submittedRows = new Map(changes.map((record) => [recordKey(record), record]));
      const canonicalRows = new Map(records.map((record) => [recordKey(record), record]));
      for (const change of changesBetween(baseline.current, latestRecords.current)) {
        const key = recordKey(change);
        const savedChange = submittedRows.get(key);
        if (savedChange && JSON.stringify(savedChange.data) === JSON.stringify(change.data)) continue;
        if (!change.data) canonicalRows.delete(key);
        else canonicalRows.set(key, { ...currentUserRows.get(key)!, version: next.get(key)?.version ?? 0 });
      }
      hydrate([...canonicalRows.values()]);
      baseline.current = records;
    }).catch((error: Error) => {
      setSaveError(error instanceof WarehouseError && error.status === 409
        ? 'Data berubah di perangkat lain. Muat ulang data server dan ulangi perubahan.'
        : error.message);
    }).finally(() => {
      inFlight.current = false;
      setSaving(false);
    });
  }, [currentRecords, loaded, isAuthenticated, saving, saveError]);

  useEffect(() => {
    if (!loaded || !isAuthenticated || saveError) return;
    const refresh = async () => {
      if (inFlight.current || changesBetween(baseline.current, latestRecords.current).length) return;
      const snapshot = latestRecords.current;
      try {
        const records = await api<WarehouseRecord[]>('records');
        if (snapshot === latestRecords.current && !inFlight.current &&
            !changesBetween(baseline.current, latestRecords.current).length) hydrate(records);
      } catch (error) {
        if (error instanceof WarehouseError && [401, 403].includes(error.status)) {
          setSaveError('Akses sesi berakhir. Silakan keluar lalu masuk kembali.');
        }
      }
    };
    const timer = window.setInterval(refresh, 12000);
    return () => window.clearInterval(timer);
  }, [loaded, isAuthenticated, saveError]);

  useEffect(() => {
    if (!saving && !changes.length) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [saving, changes.length]);

  const resolveDefaultDepartment = (): AuditDepartmentScope => {
    if (currentUser.department) return currentUser.department;
    if (
      currentUser.position === 'Storage Inbound' ||
      currentUser.position === 'Storage Outbond' ||
      currentUser.position === 'Storage-Mailer'
    ) {
      return 'Central Warehouse';
    }
    if (currentUser.position === 'Purchasing' || currentUser.position === 'Cost Control') {
      return 'Purchasing & Finance';
    }
    return 'All Departments';
  };

  const addAuditLog = (entry: {
    module: AuditModuleName;
    category: AuditActionCategory;
    action: string;
    description: string;
    referenceId?: string;
    department?: AuditDepartmentScope;
    outletName?: string;
    severity?: AuditSeverity;
    changes?: AuditChangeItem[];
  }) => {
    const now = new Date();
    const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randSuffix = crypto.randomUUID();
    const newEntry: AuditLogEntry = {
      id: `AUD-${datePart}-${randSuffix}`,
      timestamp: now.toISOString(),
      actorName: currentUser.username,
      actorRole: currentUser.position,
      department: entry.department || resolveDefaultDepartment(),
      outletName: entry.outletName || currentUser.outletName,
      module: entry.module,
      category: entry.category,
      action: entry.action,
      referenceId: entry.referenceId,
      description: entry.description,
      severity: entry.severity || 'Info',
      changes: entry.changes,
    };
    setAuditLogs((prev) => [newEntry, ...prev]);
  };

  const clearAuditLogs = () => window.alert('Riwayat audit tersimpan dan tidak dapat dihapus.');

  // Permission access checker
  const canAccess = (feature: string): boolean => {
    if (feature === 'Audit Trail' || feature === 'Dashboard' || feature === 'System & Setting') return true;
    if (currentUser.position === 'Administrator') return true;

    switch (currentUser.position) {
      case 'Outlet':
        return ['Dashboard Outlet', 'Order Outlet', 'Audit Trail'].includes(feature);
      case 'Storage-Mailer':
        return ['Deployment', 'Audit Trail'].includes(feature);
      case 'Storage Inbound':
        return ['Master Inventory', 'Inbound', 'Purchase Request', 'Audit Trail'].includes(feature);
      case 'Storage Outbond':
        return ['Master Inventory', 'Outbond', 'Purchase Request', 'Audit Trail'].includes(feature);
      case 'Purchasing':
        return ['Purchase Request', 'Vendor', 'Inbound', 'Cost Control', 'Audit Trail'].includes(feature);
      case 'Cost Control':
        return ['Cost Control', 'Master Inventory', 'Purchase Request', 'Vendor', 'Audit Trail'].includes(feature);
      default:
        return false;
    }
  };

  // Authentication & Session
  const login = async (email: string, password: string) => {
    try {
      const { user } = await api<SessionUser>('login', 'POST', { email: email.trim(), password });
      setSaveError('');
      setSession(user);
      return { success: true, user };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : 'Gagal masuk.' };
    }
  };

  const logout = async () => {
    if (inFlight.current) return;
    try {
      await api('logout', 'POST');
      setLoaded(false);
      setSession(null);
      setUsers([]);
      hydrate([]);
      setSaveError('');
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Gagal keluar.');
    }
  };

  const addOutlet = (outletData: Omit<OutletData, 'id'>) => {
    const id = 'OUT-' + crypto.randomUUID();
    const newOutlet: OutletData = { ...outletData, id };
    setOutlets((prev) => [...prev, newOutlet]);
  };

  const updateOutlet = (updated: OutletData) => {
    setOutlets((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
  };

  const deleteOutlet = (id: string) => {
    setOutlets((prev) => prev.filter((o) => o.id !== id));
  };

  // User Control
  const addUser = async (user: Omit<User, 'id'>) => {
    const result = await api<SessionUser>('users', 'POST', user);
    setUsers((previous) => [...previous, result.user]);
  };

  const updateUser = async (user: User) => {
    const result = await api<SessionUser>('users', 'PUT', user);
    setUsers((previous) => previous.map((u) => u.id === result.user.id ? result.user : u));
    if (currentUser.id === result.user.id) setSession(result.user);
  };

  const deleteUser = async (id: string) => {
    await api('users', 'DELETE', { id });
    setUsers((previous) => previous.filter((u) => u.id !== id));
  };

  const setSelectedPeriod = (newPeriod: string) => setSelectedPeriodState(newPeriod);

  // Inventory Management
  const updateStockOpname = (sku: string, opnameQty: number) => {
    const existingItem = inventory.find((i) => i.sku === sku);
    const oldSO = existingItem?.stockOpname ?? existingItem?.endingInventory ?? 0;

    setInventory((prev) => {
      const updated = prev.map((item) => {
        if (item.sku === sku) {
          return normalizeInventoryItem(
            {
              ...item,
              stockOpname: opnameQty,
            soValue: undefined,
            },
            selectedPeriod
          );
        }
        return item;
      });
      return updated;
    });

    if (existingItem && oldSO !== opnameQty) {
      addAuditLog({
        module: 'Master Inventory',
        category: 'Stock Adjustment',
        action: 'Penyesuaian Kuantitas Stock Opname',
        referenceId: sku,
        department: existingItem.allowedDepartments?.[0] || 'Central Warehouse',
        severity: Math.abs(opnameQty - existingItem.endingInventory) > 0 ? 'Warning' : 'Info',
        description: `Mengubah kuantitas fisik Stock Opname untuk ${existingItem.itemName} (${sku}) pada periode ${formatPeriodLabel(selectedPeriod)}.`,
        changes: [
          {
            field: `SO Usage (${sku})`,
            before: `${oldSO} ${existingItem.unit}`,
            after: `${opnameQty} ${existingItem.unit}`,
          },
          {
            field: 'Gap terhadap Stok Sistem',
            before: `${oldSO - existingItem.endingInventory} ${existingItem.unit}`,
            after: `${opnameQty - existingItem.endingInventory} ${existingItem.unit}`,
          },
        ],
      });
    }
  };

  const addInventoryItem = (item: InventoryItem) => {
    const normalized = normalizeInventoryItem(item, selectedPeriod);
    setInventory((prev) => {
      const updated = [...prev, normalized];
      return updated;
    });
  };

  const updateInventoryItem = (updated: InventoryItem) => {
    const normalized = normalizeInventoryItem(updated, selectedPeriod);
    setInventory((prev) => {
      const list = prev.map((item) => (item.sku === updated.sku ? normalized : item));
      return list;
    });
  };

  const deleteInventoryItem = (sku: string) => {
    setInventory((prev) => {
      const list = prev.filter((item) => item.sku !== sku);
      return list;
    });
  };

  const clearMasterInventory = (options?: { allPeriods?: boolean }) => {
    const rows = options?.allPeriods ? Object.values(periodicInventories).flat() : inventory;
    if (currentUser.position !== 'Administrator' || rows.some((item) => item.inbound || item.outbond)
        || stockOpnameReports.some((report) => options?.allPeriods || report.period === selectedPeriod)) {
      return { success: false, message: 'Data dengan transaksi atau stock opname harus dipertahankan.' };
    }
    if (options?.allPeriods) {
      setPeriodicInventories({
        [selectedPeriod]: [],
      });
      setStockOpnameReports([]);
      return {
        success: true,
        message: 'Seluruh data list barang pada Master Inventory di semua periode berhasil dihapus dan dikosongkan.',
      };
    }

    setPeriodicInventories((prev) => ({
      ...prev,
      [selectedPeriod]: [],
    }));
    return {
      success: true,
      message: `Seluruh data list barang periode ${formatPeriodLabel(selectedPeriod)} berhasil dihapus dan dikosongkan.`,
    };
  };

  const bulkImportMasterInventory = (
    newItems: InventoryItem[],
    replaceAll: boolean,
    targetPeriod?: string
  ) => {
    const period = targetPeriod || selectedPeriod;
    const normalizedNewItems = newItems.map((it) =>
      normalizeInventoryItem(
        {
          ...it,
          stockOpname: 0,
          soValue: 0,
        },
        period
      )
    );

    const existingRows = periodicInventories[period] ?? EMPTY_INVENTORY;
    const bySku = new Map(existingRows.map((item) => [item.sku.toUpperCase(), item]));
    const importedSkus = new Set(normalizedNewItems.map((item) => item.sku.toUpperCase()));
    const hasActivity = (item: InventoryItem) => !!(item.inbound || item.outbond);
    if (currentUser.position !== 'Administrator' || stockOpnameReports.some((report) =>
      report.period === period && ['Disetujui', 'Finalized (Generated)'].includes(report.status))) {
      return { success: false, count: 0, message: 'Import hanya oleh administrator pada periode terbuka.' };
    }
    if (replaceAll && existingRows.some((item) => hasActivity(item) && !importedSkus.has(item.sku.toUpperCase()))) {
      return { success: false, count: 0, message: 'Import tidak boleh menghapus SKU yang sudah memiliki transaksi.' };
    }
    const safeItems = normalizedNewItems.map((item) => {
      const existing = bySku.get(item.sku.toUpperCase());
      return existing && (hasActivity(existing) || existing.beginningInventory > 0) ? normalizeInventoryItem({
        ...item, sku: existing.sku, unit: existing.unit, priceActual: existing.priceActual,
        beginningInventory: existing.beginningInventory, beginningValue: existing.beginningValue,
        inbound: existing.inbound, inboundValue: existing.inboundValue, outbond: existing.outbond,
        outbondValue: existing.outbondValue, stockOpname: existing.stockOpname, soValue: existing.soValue,
      }, period) : item;
    });
    let finalItems: InventoryItem[] = [];
    if (replaceAll) {
      finalItems = safeItems;
    } else {
      const existing = periodicInventories[period] ?? EMPTY_INVENTORY;
      const itemMap = new Map<string, InventoryItem>();
      existing.forEach((item) => itemMap.set(item.sku.toUpperCase(), item));
      safeItems.forEach((item) => itemMap.set(item.sku.toUpperCase(), item));
      finalItems = Array.from(itemMap.values());
    }

    setPeriodicInventories((prev) => ({
      ...prev,
      [period]: finalItems,
    }));


    return {
      success: true,
      count: normalizedNewItems.length,
      message: replaceAll
        ? `Berhasil mengimpor ${normalizedNewItems.length} barang ke Master Inventory (mode Ganti Seluruh Data).`
        : `Berhasil menambahkan / memperbarui ${normalizedNewItems.length} barang ke Master Inventory. Total barang saat ini: ${finalItems.length}.`,
    };
  };

  // Helper to adjust inventory counters (used by Inbound & Outbond)
  // Harga yang di-input pada Inbound akan diakumulasi ke inboundValue dan di-average pada priceActual
  const adjustInventoryBalance = (
    sku: string,
    deltaInbound: number,
    deltaOutbond: number,
    inboundUnitPrice: number | undefined,
    period: string
  ) => {
    setPeriodicInventories((previous) => {
      const prev = previous[period] ?? EMPTY_INVENTORY;
      const updated = prev.map((item) => {
        if (item.sku === sku) {
          const oldInbound = item.inbound || 0;
          const oldPriceActual = item.priceActual ?? item.priceBudget ?? item.price ?? 0;
          const oldInboundValue =
            item.inboundValue !== undefined && oldInbound > 0
              ? item.inboundValue
              : Math.round(oldInbound * oldPriceActual);

          const newInbound = roundQuantity(Math.max(0, oldInbound + deltaInbound));
          const newOutbond = roundQuantity(Math.max(0, (item.outbond || 0) + deltaOutbond));

          let newPriceActual = oldPriceActual;
          let newInboundValue = oldInboundValue;

          if (deltaInbound !== 0) {
            const txUnitPrice =
              inboundUnitPrice !== undefined && inboundUnitPrice >= 0
                ? inboundUnitPrice
                : oldPriceActual;
            if (newInbound > 0) {
              newInboundValue = Math.max(0, roundMoney(oldInboundValue + Math.sign(deltaInbound) * roundMoney(Math.abs(deltaInbound) * txUnitPrice)));
              newPriceActual = Math.round(newInboundValue / newInbound);
            } else {
              newInboundValue = 0;
              newPriceActual = item.priceBudget ?? oldPriceActual;
            }
          }

          return normalizeInventoryItem(
            {
              ...item,
              inbound: newInbound,
              inboundValue: newInboundValue,
              priceActual: newPriceActual,
              outbond: newOutbond,
            },
            period
          );
        }
        return item;
      });
      return { ...previous, [period]: updated };
    });
  };

  // Stock Opname: Start SO
  const startStockOpname = (data: {
    period: string;
    conductedDate: string;
    checkerName: string;
    supervisorName?: string;
    items: { sku: string; physicalCount: number; notes?: string }[];
    notes?: string;
    submitForReview?: boolean;
  }) => {
    const existing = stockOpnameReports.find((report) => report.period === data.period);
    if (existing && existing.status !== 'Draft') {
      return { success: false, reportId: existing.id, message: 'Report SO sedang ditinjau atau sudah disetujui.' };
    }
    const currentPeriodItems = periodicInventories[data.period] ?? EMPTY_INVENTORY;
    if (!currentPeriodItems.length || data.conductedDate.slice(0, 7) !== data.period ||
        (data.submitForReview && currentPeriodItems.some((item) => !data.items.some((count) =>
          count.sku === item.sku && Number.isFinite(count.physicalCount) && count.physicalCount >= 0)))) {
      return { success: false, reportId: '', message: 'Periksa tanggal periode dan lengkapi hitungan fisik.' };
    }
    const periodLabel = formatPeriodLabel(data.period);
    const reportId = `SO-${data.period}`;

    let totalSystemUsage = 0;
    let totalSystemValue = 0;
    let totalPhysicalUsage = 0;
    let totalPhysicalValue = 0;

    const opnameItems: StockOpnameItem[] = currentPeriodItems.map((invItem) => {
      const match = data.items.find((i) => i.sku === invItem.sku);
      const count = match !== undefined ? match.physicalCount : invItem.endingInventory;
      const physicalVal = roundMoney(count * (invItem.priceActual ?? invItem.priceBudget ?? 0));
      const sysStock = invItem.endingInventory;
      const sysVal = invItem.endingValue ?? roundMoney(sysStock * (invItem.priceBudget ?? 0));
      const gapQty = count - sysStock;
      const gapVal = sysVal - physicalVal;

      totalSystemUsage += sysStock;
      totalSystemValue += sysVal;
      totalPhysicalUsage += count;
      totalPhysicalValue += physicalVal;

      return {
        sku: invItem.sku,
        itemName: invItem.itemName,
        category: invItem.category,
        unit: invItem.unit,
        priceBudget: invItem.priceBudget ?? invItem.price ?? 0,
        priceActual: invItem.priceActual ?? invItem.price ?? 0,
        systemStock: sysStock,
        systemValue: sysVal,
        physicalCount: count,
        physicalValue: physicalVal,
        gapUsage: gapQty,
        gapValue: gapVal,
        notes: match?.notes || '',
      };
    });

    const totalGapVal = totalSystemValue - totalPhysicalValue;
    const gapPct = totalSystemValue > 0 ? Math.abs((totalGapVal / totalSystemValue) * 100) : 0;

    const newReport: StockOpnameReport = {
      id: reportId,
      period: data.period,
      periodLabel,
      conductedDate: data.conductedDate,
      checkerName: data.checkerName,
      supervisorName: data.supervisorName || 'Storage Lead',
      status: data.submitForReview ? 'Menunggu Review' : 'Draft',
      items: opnameItems,
      totalSystemUsage,
      totalSystemValue,
      totalPhysicalUsage,
      totalPhysicalValue,
      totalGapValue: totalGapVal,
      gapPercentage: gapPct,
      notes: data.notes || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setStockOpnameReports((prev) => {
      const filtered = prev.filter((r) => r.period !== data.period);
      return [newReport, ...filtered];
    });

    addAuditLog({
      module: 'Master Inventory',
      category: 'Stock Adjustment',
      action: data.submitForReview ? 'Pengajuan Report Stock Opname' : 'Simpan Draft Stock Opname',
      referenceId: reportId,
      department: 'Central Warehouse',
      severity: data.submitForReview ? 'Warning' : 'Info',
      description: `${data.submitForReview ? 'Mengajukan' : 'Menyimpan draft'} laporan hasil hitung fisik Stock Opname periode ${periodLabel} (${opnameItems.length} SKU, Pemeriksa: ${data.checkerName}).`,
      changes: [
        { field: 'Status Laporan SO', before: 'Belum Ada / Draft', after: newReport.status },
        { field: 'Total Nilai Fisik SO', before: formatRupiah(totalSystemValue), after: formatRupiah(totalPhysicalValue) },
      ],
    });

    return {
      success: true,
      reportId,
      message: data.submitForReview
        ? `Report SO untuk periode ${periodLabel} berhasil diajukan dan siap ditinjau!`
        : `Draft SO untuk periode ${periodLabel} berhasil disimpan.`,
    };
  };

  // Stock Opname: Approve Report SO
  const approveStockOpnameReport = (reportId: string, reviewerName: string) => {
    const report = stockOpnameReports.find((r) => r.id === reportId);
    if (!report || report.status !== 'Menunggu Review' ||
        !['Administrator', 'Cost Control'].includes(currentUser.position)) {
      return { success: false, message: 'Report SO belum diajukan atau Anda tidak berwenang.' };
    }

    const approvedReport: StockOpnameReport = {
      ...report,
      status: 'Disetujui',
      approvedAt: new Date().toISOString(),
      approvedBy: reviewerName,
      updatedAt: new Date().toISOString(),
    };

    setStockOpnameReports((prev) =>
      prev.map((r) => (r.id === reportId ? approvedReport : r))
    );

    // Commit physical counts directly to Table Inventory for that period!
    const targetPeriod = report.period;
    const currentItems = periodicInventories[targetPeriod] || inventory;
    const updatedInventory = currentItems.map((invItem) => {
      const match = report.items.find((item) => item.sku === invItem.sku);
      if (match) {
        return normalizeInventoryItem(
          {
            ...invItem,
            stockOpname: match.physicalCount,
            soValue: match.physicalValue,
            gap: match.gapUsage,
            gapValue: match.gapValue,
          },
          targetPeriod
        );
      }
      return invItem;
    });

    setPeriodicInventories((prev) => ({
      ...prev,
      [targetPeriod]: updatedInventory,
    }));


    addAuditLog({
      module: 'Master Inventory',
      category: 'Stock Adjustment',
      action: 'Persetujuan Report Stock Opname (Approve SO)',
      referenceId: reportId,
      department: 'Central Warehouse',
      severity: 'Success',
      description: `Menyetujui Report Stock Opname periode ${report.periodLabel} oleh ${reviewerName} dan memperbarui saldo fisik pada Master Inventory.`,
      changes: [
        { field: 'Status Report SO', before: report.status, after: 'Disetujui' },
        { field: 'Total Nilai Fisik Disetujui', before: formatRupiah(report.totalSystemValue), after: formatRupiah(report.totalPhysicalValue) },
      ],
    });

    return {
      success: true,
      message: `Report SO untuk periode ${report.periodLabel} telah disetujui! Hasil SO kini aktif pada Table Inventory.`,
    };
  };

  // Stock Opname: Reject / Revision Report SO
  const rejectStockOpnameReport = (reportId: string, reason?: string) => {
    const report = stockOpnameReports.find((r) => r.id === reportId);
    if (!report || !['Menunggu Review', 'Disetujui'].includes(report.status) ||
        !['Administrator', 'Cost Control'].includes(currentUser.position)) {
      return { success: false, message: 'Report SO belum diajukan atau Anda tidak berwenang.' };
    }

    setStockOpnameReports((prev) =>
      prev.map((r) =>
        r.id === reportId
          ? {
              ...r,
              status: 'Draft',
              approvedBy: undefined,
              approvedAt: undefined,
              notes: reason ? `${r.notes ? r.notes + ' | ' : ''}Revisi: ${reason}` : r.notes,
              updatedAt: new Date().toISOString(),
            }
          : r
      )
    );

    addAuditLog({
      module: 'Master Inventory',
      category: 'Stock Adjustment',
      action: 'Permintaan Revisi Report Stock Opname',
      referenceId: reportId,
      department: 'Central Warehouse',
      severity: 'Warning',
      description: `Mengembalikan Report Stock Opname periode ${report.periodLabel} ke status Draft untuk revisi hitung fisik.${reason ? ` Alasan: ${reason}` : ''}`,
      changes: [
        { field: 'Status Report SO', before: report.status, after: 'Draft (Revisi)' },
      ],
    });

    return {
      success: true,
      message: `Report SO periode ${report.periodLabel} dikembalikan ke status Draft untuk revisi hitung fisik.`,
    };
  };

  // Stock Opname: Generate Final SO
  const generateFinalSO = (period: string, actorName: string) => {
    const report = stockOpnameReports.find((r) => r.period === period);
    if (!report) {
      return {
        success: false,
        nextPeriod: '',
        message: `Belum ada data SO untuk periode ${formatPeriodLabel(period)}.`,
      };
    }
    if (!['Administrator', 'Cost Control'].includes(currentUser.position)) {
      return { success: false, nextPeriod: '', message: 'Anda tidak berwenang menutup periode.' };
    }
    if (report.status === 'Finalized (Generated)') {
      return { success: true, nextPeriod: getNextPeriod(period), message: 'Periode sudah ditutup.' };
    }
    if (report.status !== 'Disetujui') {
      return {
        success: false,
        nextPeriod: '',
        message: `Report SO periode ${report.periodLabel} harus disetujui terlebih dahulu sebelum Generate Final SO.`,
      };
    }

    const nextPeriod = getNextPeriod(period);
    const nextPeriodLabel = formatPeriodLabel(nextPeriod);

    // Current period items with approved SO counts
    const currentItems = periodicInventories[period] ?? EMPTY_INVENTORY;
    if (!currentItems.length || currentItems.length !== report.items.length || currentItems.some((item) => {
      const line = report.items.find((count) => count.sku === item.sku);
      return !line || roundQuantity(item.endingInventory) !== roundQuantity(line.systemStock);
    })) {
      return { success: false, nextPeriod: '', message: 'Saldo berubah sejak penghitungan fisik. Tinjau koreksi sebelum tutup buku.' };
    }

    // Generate next period inventory where Beginning Stock = current month's Stock Opname!
    const nextMonthItems: InventoryItem[] = currentItems.map((curr) => {
      const soMatch = report.items.find((i) => i.sku === curr.sku);
      const newBeginningQty = soMatch !== undefined ? soMatch.physicalCount : curr.stockOpname;
      const newBeginningVal = roundMoney(newBeginningQty * (curr.priceActual ?? curr.priceBudget ?? curr.price ?? 0));

      return normalizeInventoryItem(
        {
          sku: curr.sku,
          itemName: curr.itemName,
          category: curr.category,
          unit: curr.unit,
          priceBudget: curr.priceBudget,
          priceActual: curr.priceActual,
          price: curr.price,
          beginningInventory: newBeginningQty,
          beginningValue: newBeginningVal,
          inbound: 0,
          inboundValue: 0,
          outbond: 0,
          outbondValue: 0,
          endingInventory: newBeginningQty,
          endingValue: newBeginningVal,
          stockOpname: newBeginningQty,
          soValue: newBeginningVal,
          gap: 0,
          gapValue: 0,
          minStock: curr.minStock,
          allowedDepartments: curr.allowedDepartments,
          period: nextPeriod,
        },
        nextPeriod
      );
    });

    // Save into periodicInventories[nextPeriod]
    setPeriodicInventories((prev) => {
      const nextBySku = new Map((prev[nextPeriod] ?? []).map((item) => [item.sku, item]));
      for (const opening of nextMonthItems) {
        const existing = nextBySku.get(opening.sku);
        nextBySku.set(opening.sku, existing ? normalizeInventoryItem({
          ...existing,
          beginningInventory: opening.beginningInventory,
          beginningValue: opening.beginningValue,
        }, nextPeriod) : opening);
      }
      return { ...prev, [nextPeriod]: [...nextBySku.values()] };
    });

    // Mark current SO report as Finalized
    setStockOpnameReports((prev) =>
      prev.map((r) =>
        r.period === period
          ? {
              ...r,
              status: 'Finalized (Generated)',
              finalizedAt: new Date().toISOString(),
              finalizedBy: actorName,
              nextPeriodGenerated: nextPeriod,
              updatedAt: new Date().toISOString(),
            }
          : r
      )
    );

    addAuditLog({
      module: 'Master Inventory',
      category: 'Stock Adjustment',
      action: 'Finalisasi SO & Rollover Saldo Awal Periode Baru',
      referenceId: report.id,
      department: 'All Departments',
      severity: 'Success',
      description: `Menetapkan hasil Stock Opname bulan ${report.periodLabel} sebagai Beginning Inventory untuk periode baru ${nextPeriodLabel} oleh ${actorName}.`,
      changes: [
        { field: 'Status Report SO', before: 'Disetujui', after: 'Finalized (Generated)' },
        { field: 'Periode Baru Terbentuk', before: report.periodLabel, after: nextPeriodLabel },
      ],
    });

    return {
      success: true,
      nextPeriod,
      message: `Final SO berhasil di-generate! Saldo hasil Stock Opname bulan ${report.periodLabel} telah resmi ditetapkan sebagai Stock Beginning untuk periode ${nextPeriodLabel}.`,
    };
  };


  // Helper to get combined Master Inventory items across active and stored periods
  const getCombinedMasterInventory = (): InventoryItem[] => {
    const map = new Map<string, InventoryItem>();
    Object.values(periodicInventories).forEach((list) => {
      if (Array.isArray(list)) {
        list.forEach((it) => {
          if (it && it.sku) map.set(it.sku.trim().toUpperCase(), it);
        });
      }
    });
    const activePeriodList = periodicInventories[selectedPeriod] || [];
    activePeriodList.forEach((it) => {
      if (it && it.sku) map.set(it.sku.trim().toUpperCase(), it);
    });
    inventory.forEach((it) => {
      if (it && it.sku) map.set(it.sku.trim().toUpperCase(), it);
    });
    return Array.from(map.values());
  };

  // Outlet Orders
  const createOutletOrder = (orderData: Omit<OutletOrder, 'createdAt' | 'updatedAt'>) => {
    // ID format: 'Date Requested'-'Outlet Name'-'Department' with DD/MM/YYYY
    const formattedDate = formatDate(orderData.dateRequested);
    const generatedId = orderData.id || `${formattedDate}-${orderData.outletName}-${orderData.department}`;

    const existingIndex = outletOrders.findIndex((o) => o.id === generatedId);
    if (existingIndex >= 0) {
      return {
        success: false,
        message: `Form pesanan untuk ${orderData.outletName} (${orderData.department}) pada tanggal ${formattedDate} sudah pernah dibuat (${generatedId}). Silakan ubah form yang sudah ada.`,
      };
    }

    const masterList = getCombinedMasterInventory();
    const syncedItems: OrderItem[] = orderData.items.map((item) => {
      const matched = findInventoryItemBySku(item.sku, item.itemName, masterList);
      if (matched) {
        const masterPriceBudget =
          matched.priceBudget !== undefined && matched.priceBudget > 0
            ? matched.priceBudget
            : matched.price ?? item.price;
        return {
          ...item,
          sku: matched.sku,
          itemName: item.itemName || matched.itemName,
          unit: item.unit || matched.unit,
          category: matched.category,
          price: masterPriceBudget,
          subtotal: item.qty * masterPriceBudget,
          qtyPrepared: undefined,
        };
      }
      return {
        ...item,
        subtotal: item.qty * item.price,
        qtyPrepared: undefined,
      };
    });

    const now = new Date().toISOString();
    const totalAmount = syncedItems.reduce((sum, item) => sum + item.subtotal, 0);

    const newOrder: OutletOrder = {
      ...orderData,
      id: generatedId,
      items: syncedItems,
      totalAmount,
      createdAt: now,
      updatedAt: now,
    };

    setOutletOrders((prev) => [newOrder, ...prev]);

    addAuditLog({
      module: 'Order Outlet',
      category: 'Order Lifecycle',
      action: 'Pembuatan Form Order Outlet (PR)',
      referenceId: generatedId,
      department: orderData.department,
      outletName: orderData.outletName,
      severity: 'Info',
      description: `Membuat form pesanan barang (${generatedId}) untuk ${orderData.outletName} - Departemen ${orderData.department} (${syncedItems.length} jenis barang, Total: ${formatRupiah(totalAmount)}).`,
      changes: [
        { field: 'Status Order', before: '-', after: orderData.status },
        { field: 'Nilai Pesanan', before: 'Rp 0', after: formatRupiah(totalAmount) },
      ],
    });

    return { success: true, message: 'Form pesanan outlet berhasil dibuat!', orderId: generatedId };
  };

  const bulkImportOutletOrders = (
    newOrders: Omit<OutletOrder, 'createdAt' | 'updatedAt'>[],
    overwriteExisting: boolean = true
  ): { success: boolean; count: number; message: string } => {
    const now = new Date().toISOString();
    const masterList = getCombinedMasterInventory();
    let importedCount = 0;

    setOutletOrders((prev) => {
      let updated = [...prev];
      newOrders.forEach((orderData) => {
        const formattedDate = formatDate(orderData.dateRequested);
        const generatedId = orderData.id || `${formattedDate}-${orderData.outletName}-${orderData.department}`;

        const syncedItems: OrderItem[] = orderData.items.map((item) => {
          const matched = findInventoryItemBySku(item.sku, item.itemName, masterList);
          if (matched) {
            const masterPriceBudget =
              matched.priceBudget !== undefined && matched.priceBudget > 0
                ? matched.priceBudget
                : matched.price ?? item.price;
            return {
              ...item,
              sku: matched.sku,
              itemName: item.itemName || matched.itemName,
              unit: item.unit || matched.unit,
              category: matched.category,
              price: masterPriceBudget,
              subtotal: item.qty * masterPriceBudget,
              qtyPrepared: undefined,
            };
          }
          return {
            ...item,
            subtotal: item.qty * item.price,
            qtyPrepared: undefined,
          };
        });

        const totalAmount = syncedItems.reduce((sum, item) => sum + item.subtotal, 0);

        const newOrder: OutletOrder = {
          ...orderData,
          id: generatedId,
          items: syncedItems,
          totalAmount,
          createdAt: now,
          updatedAt: now,
        };

        const existingIdx = updated.findIndex((o) => o.id === generatedId);
        if (existingIdx >= 0) {
          if (overwriteExisting) {
            updated[existingIdx] = newOrder;
            importedCount++;
          } else {
            let suffix = 2;
            let uniqueId = `${generatedId}-${suffix}`;
            while (updated.some((o) => o.id === uniqueId)) {
              suffix++;
              uniqueId = `${generatedId}-${suffix}`;
            }
            updated.unshift({
              ...newOrder,
              id: uniqueId,
            });
            importedCount++;
          }
        } else {
          updated.unshift(newOrder);
          importedCount++;
        }
      });
      return updated;
    });

    return {
      success: true,
      count: importedCount,
      message: `Berhasil mengimpor ${importedCount} Form PR Outlet ke sistem! Form sekarang aktif di Purchase Request dan Outbond Deployment.`,
    };
  };

  const updateOutletOrder = (updatedOrder: OutletOrder) => {
    const totalAmount = updatedOrder.items.reduce((sum, item) => sum + item.subtotal, 0);
    const updatedWithTotal = {
      ...updatedOrder,
      totalAmount,
      updatedAt: new Date().toISOString(),
    };
    setOutletOrders((prev) =>
      prev.map((ord) => (ord.id === updatedOrder.id ? updatedWithTotal : ord))
    );
  };

  const deleteOutletOrder = (id: string) => {
    setOutletOrders((prev) => prev.filter((ord) => ord.id !== id));
  };

  const updateOrderItem = (orderId: string, updatedItem: OrderItem) => {
    setOutletOrders((prev) =>
      prev.map((ord) => {
        if (ord.id === orderId) {
          const newItems = ord.items.map((it) =>
            it.sku === updatedItem.sku
              ? { ...updatedItem, subtotal: updatedItem.qty * updatedItem.price }
              : it
          );
          const totalAmount = newItems.reduce((sum, i) => sum + i.subtotal, 0);
          return {
            ...ord,
            items: newItems,
            totalAmount,
            updatedAt: new Date().toISOString(),
          };
        }
        return ord;
      })
    );
  };

  const addOrderItem = (orderId: string, newItem: OrderItem) => {
    setOutletOrders((prev) =>
      prev.map((ord) => {
        if (ord.id === orderId) {
          const exists = ord.items.some((it) => it.sku === newItem.sku);
          let newItems: OrderItem[];
          if (exists) {
            newItems = ord.items.map((it) =>
              it.sku === newItem.sku
                ? {
                    ...it,
                    qty: roundQuantity(it.qty + newItem.qty),
                    subtotal: (it.qty + newItem.qty) * it.price,
                  }
                : it
            );
          } else {
            newItems = [
              ...ord.items,
              { ...newItem, subtotal: newItem.qty * newItem.price },
            ];
          }
          const totalAmount = newItems.reduce((sum, i) => sum + i.subtotal, 0);
          return {
            ...ord,
            items: newItems,
            totalAmount,
            updatedAt: new Date().toISOString(),
          };
        }
        return ord;
      })
    );
  };

  const deleteOrderItem = (orderId: string, sku: string) => {
    setOutletOrders((prev) =>
      prev.map((ord) => {
        if (ord.id === orderId) {
          const newItems = ord.items.filter((it) => it.sku !== sku);
          const totalAmount = newItems.reduce((sum, i) => sum + i.subtotal, 0);
          return {
            ...ord,
            items: newItems,
            totalAmount,
            updatedAt: new Date().toISOString(),
          };
        }
        return ord;
      })
    );
  };

  // Purchase Request -> Generate PO
  const generatePO = (sourceOrderIds: string[]) => {
    if (sourceOrderIds.length === 0) {
      return { success: false, message: 'Pilih setidaknya 1 form order outlet untuk digenerate.' };
    }

    const selectedOrders = outletOrders.filter((o) => sourceOrderIds.includes(o.id) && o.status === 'Submitted' && !o.poId);
    if (selectedOrders.length !== new Set(sourceOrderIds).size) {
      return { success: false, message: 'Form order tidak ditemukan.' };
    }

    const todayStr = jakartaDate().replace(/-/g, '');
    const poNumber = `PO-${todayStr}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

    // Merge items by SKU across all selected orders.
    // Jika item dipesan lebih dari 1 outlet, item tersebut ditotal dan di-merge dengan rincian pemesanan masing-masing outlet.
    interface ItemAccumulator {
      sku: string;
      itemName: string;
      category: any;
      unit: string;
      price: number;
      totalQty: number;
      breakdowns: {
        outletName: string;
        department: DepartmentName;
        picName?: string;
        qty: number;
        unit: string;
        orderId?: string;
      }[];
    }

    const itemsMap = new Map<string, ItemAccumulator>();

    selectedOrders.forEach((order) => {
      order.items.forEach((item) => {
        if (!itemsMap.has(item.sku)) {
          const matchedInv = inventory.find((inv) => inv.sku === item.sku);
          const budgetPrice =
            matchedInv?.priceBudget !== undefined && matchedInv.priceBudget > 0
              ? matchedInv.priceBudget
              : matchedInv?.price ?? item.price;
          itemsMap.set(item.sku, {
            sku: item.sku,
            itemName: item.itemName,
            category: item.category,
            unit: item.unit,
            price: budgetPrice,
            totalQty: 0,
            breakdowns: [],
          });
        }

        const entry = itemsMap.get(item.sku)!;
        entry.totalQty = roundQuantity(entry.totalQty + item.qty);

        // Cari apakah outlet & department ini sudah tercatat dalam breakdown
        const existingBd = entry.breakdowns.find(
          (b) => b.outletName === order.outletName && b.department === order.department
        );
        if (existingBd) {
          existingBd.qty = roundQuantity(existingBd.qty + item.qty);
        } else {
          entry.breakdowns.push({
            outletName: order.outletName,
            department: order.department,
            picName: order.picName,
            qty: item.qty,
            unit: item.unit,
            orderId: order.id,
          });
        }
      });
    });

    let mergedItemCount = 0;

    const poItems = Array.from(itemsMap.values()).map((entry) => {
      // Konsolidasi total qty per outlet (hanya outlet & kuantitas, tanpa PIC)
      const outletTotalsMap = new Map<string, number>();
      entry.breakdowns.forEach((b) => {
        outletTotalsMap.set(b.outletName, roundQuantity((outletTotalsMap.get(b.outletName) || 0) + b.qty));
      });

      const distinctOutlets = Array.from(outletTotalsMap.keys());
      const isMultipleOutlets = distinctOutlets.length > 1;

      if (isMultipleOutlets) {
        mergedItemCount += 1;
      }

      const consolidatedBreakdowns = Array.from(outletTotalsMap.entries()).map(([oName, oQty]) => ({
        outletName: oName,
        department: entry.breakdowns.find((b) => b.outletName === oName)?.department || ('Kitchen' as DepartmentName),
        qty: oQty,
        unit: entry.unit,
      }));

      // Keterangan berapa banyak yang diorder oleh Outlet tersebut (hanya outlet & kuantitas, tanpa PIC)
      // Contoh: "Resto Senopati: 20 Kg, Resto Menteng: 15 Kg"
      const breakdownText = consolidatedBreakdowns
        .map((b) => `${b.outletName}: ${b.qty} ${b.unit}`)
        .join(', ');

      const placeStr = isMultipleOutlets
        ? `Digabung (${distinctOutlets.length} Outlet): ${breakdownText}`
        : `${distinctOutlets[0] || entry.breakdowns[0]?.outletName} (${entry.totalQty} ${entry.unit})`;

      return {
        sku: entry.sku,
        itemName: entry.itemName,
        category: entry.category,
        qty: entry.totalQty,
        unit: entry.unit,
        price: entry.price,
        total: entry.totalQty * entry.price,
        place: placeStr,
        isMerged: isMultipleOutlets,
        outletBreakdowns: entry.breakdowns,
        outletBreakdownText: breakdownText,
        vendorName: '',
        status: 'Pending' as const,
      };
    });

    const totalAmount = poItems.reduce((s, it) => s + it.total, 0);

    const newPO: PurchaseOrder = {
      id: poNumber,
      generatedDate: jakartaDate(),
      sourceOrderIds,
      items: poItems,
      totalAmount,
      status: 'Draft PO',
      createdAt: new Date().toISOString(),
      notes: `Digenerate otomatis dari ${sourceOrderIds.length} form pesanan outlet.${
        mergedItemCount > 0
          ? ` Terdapat ${mergedItemCount} item yang dipesan lebih dari 1 outlet dan telah digabung (merge & total).`
          : ''
      }`,
    };

    setPurchaseOrders((prev) => [newPO, ...prev]);

    // Update status in outletOrders to 'PO Generated'
    setOutletOrders((prev) =>
      prev.map((o) =>
        sourceOrderIds.includes(o.id)
          ? { ...o, status: 'PO Generated', poId: poNumber, updatedAt: new Date().toISOString() }
          : o
      )
    );

    addAuditLog({
      module: 'Purchase Request',
      category: 'Order Lifecycle',
      action: 'Konsolidasi & Generate Purchase Order',
      referenceId: poNumber,
      department: 'Purchasing & Finance',
      severity: 'Info',
      description: `Menggabungkan ${sourceOrderIds.length} form pesanan outlet menjadi dokumen Purchase Order ${poNumber} (${poItems.length} item, senilai ${formatRupiah(totalAmount)}).`,
      changes: [
        { field: 'Dokumen PO Baru', before: `${sourceOrderIds.length} Form PR Outlet`, after: poNumber },
        { field: 'Total Nilai PO', before: '-', after: formatRupiah(totalAmount) },
      ],
    });

    return {
      success: true,
      poId: poNumber,
      message: `Berhasil generate ${poNumber} dengan ${poItems.length} item ringkasan (${mergedItemCount} item digabung dari multi-outlet).`,
    };
  };

  const updatePO = (po: PurchaseOrder) => {
    const totalAmount = po.items.reduce((s, it) => s + it.total, 0);
    setPurchaseOrders((prev) =>
      prev.map((p) => (p.id === po.id ? revisePO(p, { ...po, totalAmount }) : p))
    );
  };

  const deletePO = (id: string) => {
    const po = purchaseOrders.find((item) => item.id === id);
    if (!po || !['Draft PO', 'Submitted to Purchasing', 'Vendor Summary'].includes(po.status)) return;
    setPurchaseOrders((prev) => prev.filter((p) => p.id !== id));
    setOutletOrders((previous) => previous.map((order) => order.poId === id && order.status === 'PO Generated'
      ? { ...order, poId: undefined, status: 'Submitted', updatedAt: new Date().toISOString() }
      : order));
  };

  const submitPOToPurchasing = (poId: string) => {
    setPurchaseOrders((prev) =>
      prev.map((p) =>
        p.id === poId
          ? {
              ...p,
              status: 'Submitted to Purchasing' as const,
              updatedAt: new Date().toISOString(),
            }
          : p
      )
    );
  };

  const submitPOToVendor = (poId: string) => { submitPOVendorToReceiving(poId); };

  const submitPOToVendorSummary = (poId: string) => {
    const po = purchaseOrders.find((p) => p.id === poId);
    if (!po) return { success: false, message: 'PO tidak ditemukan.' };

    const hasAnyVendor = po.items.length > 0 && po.items.every((it) => it.vendorName?.trim());
    if (!hasAnyVendor) {
      return {
        success: false,
        message: 'Harap tentukan Nama Vendor / Supplier untuk setidaknya satu barang sebelum submit ke Vendor Summary.',
      };
    }

    setPurchaseOrders((prev) =>
      prev.map((p) => {
        if (p.id === poId) {
          const updatedItems = p.items.map((it) => {
            let pm = it.paymentMethod;
            let pt = it.paymentTerm;
            if (!pm && it.vendorName) {
              const matchedV = vendors.find((v) => v.namaVendor === it.vendorName);
              pm = matchedV?.paymentCategory || (matchedV?.paymentType?.startsWith('TOP') ? 'Tempo' : 'Cash');
              pt = pm === 'Tempo' ? (matchedV?.topTerm || matchedV?.paymentType || 'TOP 30 Hari') : (matchedV?.cashType || matchedV?.paymentType || 'Cash / COD');
            }
            return {
              ...it,
              paymentMethod: pm || 'Tempo',
              paymentTerm: pt || 'TOP 30 Hari',
              approvalStatus: it.approvalStatus || 'Pending',
            };
          });

          return {
            ...p,
            status: 'Vendor Summary' as const,
            items: updatedItems,
            updatedAt: new Date().toISOString(),
          };
        }
        return p;
      })
    );

    return {
      success: true,
      message: `Form PO ${poId} berhasil disubmit ke proses Vendor Summary! Data telah dipisahkan berdasarkan Tipe Pembayaran (Tempo & Cash) > Vendor > List Barang.`,
    };
  };

  const batchSubmitPOToCostControl = (poIds: string[], notes?: string) => {
    const ready = purchaseOrders.filter((po) => poIds.includes(po.id) && po.status === 'Vendor Summary' &&
      po.items.length > 0 && po.items.every((item) => item.vendorName?.trim()));
    if (!ready.length || ready.length !== new Set(poIds).size) {
      return { success: false, count: 0, message: 'Lengkapi vendor pada setiap baris sebelum mengirim ke Finance.' };
    }

    setPurchaseOrders((prev) =>
      prev.map((p) => {
        if (poIds.includes(p.id)) {
          return {
            ...p,
            status: 'Review Cost Control' as const,
            costControlApproval: undefined,
            items: p.items.map((line) => ({ ...line, approvalStatus: 'Pending' as const })),
            submittedToCostControlAt: new Date().toISOString(),
            submittedToCostControlBy: currentUser.username,
            notes: notes || p.notes,
          };
        }
        return p;
      })
    );

    return {
      success: true,
      count: poIds.length,
      message: `${poIds.length} Form PO terpilih berhasil diajukan ke Cost Control untuk ditinjau dan disetujui!`,
    };
  };

  const submitPOToCostControl = (poId: string, notes?: string) => {
    const po = purchaseOrders.find((p) => p.id === poId);
    if (!po) return { success: false, message: 'PO tidak ditemukan.' };

    const hasAnyVendor = po.status === 'Vendor Summary' && po.items.length > 0 && po.items.every((it) => it.vendorName?.trim());
    if (!hasAnyVendor) {
      return {
        success: false,
        message: 'Harap tentukan Nama Vendor / Supplier untuk setiap barang sebelum mengajukan ke Cost Control.',
      };
    }

    setPurchaseOrders((prev) =>
      prev.map((p) =>
        p.id === poId
          ? {
              ...p,
              status: 'Review Cost Control' as const,
              costControlApproval: undefined,
              items: p.items.map((line) => ({ ...line, approvalStatus: 'Pending' as const })),
              submittedToCostControlAt: new Date().toISOString(),
              submittedToCostControlBy: currentUser.username,
              notes: notes || p.notes,
            }
          : p
      )
    );

    return {
      success: true,
      message: `Form PO ${poId} berhasil diajukan ke laman Cost Control untuk ditinjau & disetujui.`,
    };
  };

  const approvePOCostControl = (poId: string, approvalNotes?: string) => {
    const po = purchaseOrders.find((p) => p.id === poId);
    if (!po || po.status !== 'Review Cost Control' ||
        !['Administrator', 'Cost Control'].includes(currentUser.position)) {
      return { success: false, message: 'PO harus dalam review Finance dan Anda harus berwenang.' };
    }

    const rejectedItems = po.items.filter((it) => it.approvalStatus === 'Rejected' || it.status === 'Rejected');
    if (rejectedItems.length > 0) {
      return {
        success: false,
        message: `Proses approve tidak dapat dilakukan karena terdapat ${rejectedItems.length} item yang tidak disetujui (Rejected). Semua item harus disetujui terlebih dahulu sebelum form PO dapat di-approve.`,
      };
    }

    const unapprovedItems = po.items.filter((it) => it.approvalStatus !== 'Approved');
    if (unapprovedItems.length > 0) {
      return {
        success: false,
        message: `Proses approve tidak dapat dilakukan karena masih ada ${unapprovedItems.length} item yang belum disetujui oleh Cost Control. Semua item harus disetujui terlebih dahulu.`,
      };
    }

    if (!canApprovePO(po)) {
      return { success: false, message: 'Lengkapi vendor, harga, dan persetujuan seluruh baris.' };
    }
    const approvedItems = po.items.filter((it) => it.approvalStatus === 'Approved');
    const totalApproved = approvedItems.reduce((acc, it) => acc + (it.qty * it.price), 0);

    setPurchaseOrders((prev) =>
      prev.map((p) =>
        p.id === poId
          ? {
              ...p,
              status: 'Approved by Cost Control' as const,
              items: p.items.map((it) => ({
                ...it,
                approvalStatus: 'Approved' as const,
                status: 'Approved' as const,
              })),
              costControlApproval: {
                approvedBy: currentUser.username,
                approvedAt: new Date().toISOString(),
                totalApprovedAmount: totalApproved,
                terms: purchaseTerms(po),
                notes: approvalNotes || 'Total pengajuan pembelian telah disetujui oleh Cost Control.',
                status: 'Approved',
              },
            }
          : p
      )
    );

    addAuditLog({
      module: 'Cost Control',
      category: 'Order Approval',
      action: 'Persetujuan Purchase Order (Approved by Cost Control)',
      referenceId: poId,
      department: 'Purchasing & Finance',
      severity: 'Success',
      description: `Menyetujui penuh pengajuan pembelian ${poId} (${approvedItems.length} item disetujui dengan nilai total ${formatRupiah(totalApproved)}).`,
      changes: [
        { field: 'Status Otorisasi PO', before: po.status, after: 'Approved by Cost Control' },
        { field: 'Nilai Disetujui', before: formatRupiah(po.totalAmount), after: formatRupiah(totalApproved) },
      ],
    });

    return {
      success: true,
      message: `Form pengajuan pembelian ${poId} berhasil disetujui oleh Cost Control (${approvedItems.length} item disetujui, senilai ${formatRupiah(totalApproved)})! Form PO Vendor sekarang dapat disubmit ke vendor.`,
    };
  };

  const rejectPOCostControl = (poId: string, reason: string) => {
    const po = purchaseOrders.find((p) => p.id === poId);
    if (!po || po.status !== 'Review Cost Control' ||
        !['Administrator', 'Cost Control'].includes(currentUser.position)) {
      return { success: false, message: 'PO harus dalam review Finance dan Anda harus berwenang.' };
    }

    // Count rejected items
    const rejectedCount = po.items.filter((it) => it.approvalStatus === 'Rejected' || it.status === 'Rejected').length;

    setPurchaseOrders((prev) =>
      prev.map((p) =>
        p.id === poId
          ? {
              ...p,
              status: 'Vendor Summary' as const, // Return to Vendor Summary so Purchasing can revise
              items: p.items.map((it) => {
                if (it.approvalStatus === 'Rejected' || it.status === 'Rejected') {
                  return {
                    ...it,
                    approvalStatus: 'Rejected' as const,
                    status: 'Rejected' as const,
                    rejectionReason: it.rejectionReason || reason || 'Ditolak oleh Cost Control',
                  };
                }
                return it;
              }),
              costControlApproval: {
                approvedBy: currentUser.username,
                approvedAt: new Date().toISOString(),
                totalApprovedAmount: 0,
                notes: reason || `Pengajuan dikembalikan ke Vendor Summary untuk revisi (${rejectedCount > 0 ? `${rejectedCount} item ditolak` : 'revisi total'}).`,
                status: 'Rejected',
              },
            }
          : p
      )
    );

    addAuditLog({
      module: 'Cost Control',
      category: 'Order Approval',
      action: 'Penolakan / Pengembalian PO oleh Cost Control',
      referenceId: poId,
      department: 'Purchasing & Finance',
      severity: 'Critical',
      description: `Mengembalikan form ${poId} ke Vendor Summary untuk direvisi oleh Purchasing (${rejectedCount} item ditolak). Catatan: ${reason || 'Perlu revisi harga/kuantitas'}.`,
      changes: [
        { field: 'Status Otorisasi PO', before: po.status, after: 'Vendor Summary (Perlu Revisi)' },
        { field: 'Jumlah Item Ditolak', before: '0 Item', after: `${rejectedCount} Item` },
      ],
    });

    return {
      success: true,
      message: `Form PO ${poId} telah dikembalikan ke laman Vendor Summary. Tim Purchasing dapat mengubah Qty, Harga, atau memilih Vendor lain untuk item yang tidak disetujui.`,
    };
  };

  const returnPOToVendorSummary = (poId: string, notes?: string) => {
    const po = purchaseOrders.find((p) => p.id === poId);
    if (!po || po.status !== 'Review Cost Control' ||
        !['Administrator', 'Cost Control'].includes(currentUser.position)) {
      return { success: false, message: 'PO harus dalam review Finance dan Anda harus berwenang.' };
    }

    const rejectedCount = po.items.filter((it) => it.approvalStatus === 'Rejected' || it.status === 'Rejected').length;

    setPurchaseOrders((prev) =>
      prev.map((p) =>
        p.id === poId
          ? {
              ...p,
              status: 'Vendor Summary' as const,
              notes: notes || p.notes || `Dikembalikan oleh Cost Control (${rejectedCount} item tidak disetujui untuk direvisi).`,
            }
          : p
      )
    );

    addAuditLog({
      module: 'Cost Control',
      category: 'Order Approval',
      action: 'Pengembalian Form PO ke Vendor Summary',
      referenceId: poId,
      department: 'Purchasing & Finance',
      severity: 'Warning',
      description: `Mengembalikan form ${poId} ke Vendor Summary untuk penyesuaian ulang oleh tim Purchasing (${rejectedCount} item tidak disetujui).`,
      changes: [
        { field: 'Status PO', before: po.status, after: 'Vendor Summary' },
      ],
    });

    return {
      success: true,
      message: `Form ${poId} berhasil dikembalikan ke Vendor Summary. Item yang tidak disetujui dapat diubah oleh tim Purchasing.`,
    };
  };

  const updateVendorSummaryItem = (
    poId: string,
    sku: string,
    place: string | undefined,
    updates: {
      qty?: number;
      price?: number;
      vendorName?: string;
    }
  ) => {
    let updatedItemName = '';
    setPurchaseOrders((prev) =>
      prev.map((po) => {
        if (po.id !== poId) return po;

        let hasChanges = false;
        const items = po.items.map((it) => {
          if (it.sku === sku && (!place || it.place === place)) {
            hasChanges = true;
            updatedItemName = it.itemName;
            const newQty = updates.qty !== undefined && updates.qty > 0 ? updates.qty : it.qty;
            const newPrice = updates.price !== undefined && updates.price >= 0 ? updates.price : it.price;
            const newTotal = newQty * newPrice;

            let newVendorName = it.vendorName;
            let newPaymentMethod = it.paymentMethod;
            let newPaymentTerm = it.paymentTerm;

            if (updates.vendorName && updates.vendorName !== it.vendorName) {
              newVendorName = updates.vendorName;
              const matchedVendor = vendors.find((v) => v.namaVendor === updates.vendorName);
              newPaymentMethod =
                matchedVendor?.paymentCategory ||
                (matchedVendor?.paymentType?.startsWith('TOP') ? 'Tempo' : 'Cash') ||
                'Tempo';
              newPaymentTerm =
                newPaymentMethod === 'Tempo'
                  ? matchedVendor?.topTerm || matchedVendor?.paymentType || 'TOP 30 Hari'
                  : matchedVendor?.cashType || matchedVendor?.paymentType || 'Cash / COD';
            }

            return {
              ...it,
              qty: newQty,
              price: newPrice,
              total: newTotal,
              vendorName: newVendorName,
              paymentMethod: newPaymentMethod,
              paymentTerm: newPaymentTerm,
              // Reset status from Rejected to Pending so it can be re-evaluated
              approvalStatus: 'Pending' as const,
              status: 'Approved' as const,
              rejectionReason: undefined,
            };
          }
          return it;
        });

        if (!hasChanges) return po;

        const totalAmount = items.reduce((acc, it) => acc + it.total, 0);

        // If the PO status was Rejected by Cost Control, transition back to Vendor Summary
        const newStatus = po.status === 'Rejected by Cost Control' ? 'Vendor Summary' : po.status;

        return revisePO(po, { ...po, items, totalAmount, status: newStatus });
      })
    );

    return {
      success: true,
      message: `Item ${updatedItemName || sku} berhasil diperbarui. Status penolakan telah dibersihkan dan siap ditinjau kembali.`,
    };
  };

  // Vendor Management
  const addVendor = (vendorData: Omit<Vendor, 'id'>) => {
    const id = 'VND-' + crypto.randomUUID();
    setVendors((prev) => [...prev, { ...vendorData, id }]);
  };

  const updateVendor = (updated: Vendor) => {
    setVendors((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));
  };

  const deleteVendor = (id: string) => {
    setVendors((prev) => prev.filter((v) => v.id !== id));
  };

  const assignVendorToPOItem = (
    poId: string,
    sku: string,
    vendorName: string,
    paymentMethod?: PaymentMethodType,
    paymentTerm?: string,
    place?: string
  ) => {
    const matchedVendor = vendors.find((v) => v.namaVendor === vendorName);
    const resolvedMethod =
      paymentMethod ||
      matchedVendor?.paymentCategory ||
      (matchedVendor?.paymentType?.startsWith('TOP') ? 'Tempo' : 'Cash');
    const resolvedTerm =
      paymentTerm ||
      (resolvedMethod === 'Tempo'
        ? matchedVendor?.topTerm || matchedVendor?.paymentType || 'TOP 30 Hari'
        : matchedVendor?.cashType || matchedVendor?.paymentType || 'Cash / COD');

    setPurchaseOrders((prev) =>
      prev.map((po) => {
        if (po.id === poId) {
          const items = po.items.map((it) => {
            if (it.sku === sku && (!place || it.place === place)) {
              return {
                ...it,
                vendorName,
                paymentMethod: resolvedMethod,
                paymentTerm: resolvedTerm,
                status: 'Approved' as const,
                approvalStatus: it.approvalStatus === 'Rejected' ? 'Pending' : (it.approvalStatus || 'Pending'),
                rejectionReason: undefined,
              };
            }
            return it;
          });
          const totalAmount = items.reduce(
            (acc, it) => acc + (it.status === 'Rejected' ? 0 : it.total),
            0
          );
          return revisePO(po, { ...po, items, totalAmount });
        }
        return po;
      })
    );
  };

  const updatePOItemPayment = (
    poId: string,
    sku: string,
    place: string | undefined,
    paymentMethod: PaymentMethodType,
    paymentTerm?: string
  ) => {
    setPurchaseOrders((prev) =>
      prev.map((po) => {
        if (po.id === poId) {
          const items = po.items.map((it) => {
            if (it.sku === sku && (!place || it.place === place)) {
              return {
                ...it,
                paymentMethod,
                paymentTerm:
                  paymentTerm !== undefined
                    ? paymentTerm
                    : paymentMethod === 'Tempo'
                    ? 'TOP 30 Hari'
                    : 'Cash / COD',
              };
            }
            return it;
          });
          return revisePO(po, { ...po, items });
        }
        return po;
      })
    );
  };

  const setItemApprovalStatus = (
    poId: string,
    sku: string,
    place: string | undefined,
    status: 'Approved' | 'Rejected',
    reason?: string
  ) => {
    if (!['Administrator', 'Cost Control'].includes(currentUser.position)) return;
    setPurchaseOrders((prev) =>
      prev.map((po) => {
        if (po.id === poId && po.status === 'Review Cost Control') {
          const items = po.items.map((it) => {
            if (it.sku === sku && (!place || it.place === place)) {
              return {
                ...it,
                approvalStatus: status,
                status: status,
                rejectionReason: status === 'Rejected' ? reason || 'Ditolak oleh Cost Control' : undefined,
              };
            }
            return it;
          });
          return { ...po, items };
        }
        return po;
      })
    );
  };

  const batchSetItemApprovalStatus = (
    updates: { poId: string; sku: string; place?: string; status: 'Approved' | 'Rejected'; reason?: string }[]
  ) => {
    if (updates.length === 0) return;

    if (!['Administrator', 'Cost Control'].includes(currentUser.position)) return;
    setPurchaseOrders((prev) =>
      prev.map((po) => {
        if (po.status !== 'Review Cost Control') return po;
        const poUpdates = updates.filter((u) => u.poId === po.id);
        if (poUpdates.length === 0) return po;

        const items = po.items.map((it) => {
          const matched = poUpdates.find((u) => u.sku === it.sku && (!u.place || u.place === it.place));
          if (matched) {
            return {
              ...it,
              approvalStatus: matched.status,
              status: matched.status,
              rejectionReason: matched.status === 'Rejected' ? matched.reason || 'Ditolak oleh Cost Control' : undefined,
            };
          }
          return it;
        });

        return { ...po, items };
      })
    );
  };

  const rejectPOItem = (poId: string, sku: string, reason: string, place?: string) => {
    setPurchaseOrders((prev) =>
      prev.map((po) => {
        if (po.id === poId) {
          const items = po.items.map((it) =>
            it.sku === sku && (!place || it.place === place)
              ? { ...it, status: 'Rejected' as const, rejectionReason: reason || 'Ditolak oleh Purchasing' }
              : it
          );
          const totalAmount = items.reduce(
            (acc, it) => acc + (it.status === 'Rejected' ? 0 : it.total),
            0
          );
          return revisePO(po, { ...po, items, totalAmount });
        }
        return po;
      })
    );
  };

  const submitPOVendorToReceiving = (poId: string) => {
    const po = purchaseOrders.find((p) => p.id === poId);
    if (!po) return { success: false, message: 'PO tidak ditemukan.' };

    if (po.status === 'Sent to Receiving') {
      return {
        success: false,
        message: `Form PO ${po.id} sudah dilakukan Release to Vendor dan telah masuk ke Inbound Receiving.`,
      };
    }

    if (!canReleasePO(po)) {
      return {
        success: false,
        message: 'Form PO belum disetujui oleh Cost Control. Form harus mendapatkan persetujuan (approval) Cost Control terlebih dahulu sebelum dapat dilakukan Release to Vendor.',
      };
    }

    const approvedItems = po.items.filter(
      (it) => it.status !== 'Rejected' && it.approvalStatus === 'Approved'
    );
    if (approvedItems.length === 0) {
      return { success: false, message: 'Tidak ada item yang disetujui untuk dikirim ke Receiving.' };
    }

    // Group items by vendor
    const itemsByVendor = new Map<string, typeof approvedItems>();
    approvedItems.forEach((it) => {
      const vName = it.vendorName || 'Vendor Umum';
      if (!itemsByVendor.has(vName)) itemsByVendor.set(vName, []);
      itemsByVendor.get(vName)!.push(it);
    });

    const newReceivingRecords: InboundReceivingRecord[] = [];
    const nowDateStr = jakartaDate();
    const nowIso = new Date().toISOString();

    itemsByVendor.forEach((items, vendorName) => {
      const recordId = `RCV-${po.id.replace('PO-', '')}-${String(receivingRecords.length + newReceivingRecords.length + 1).padStart(2, '0')}`;
      newReceivingRecords.push({
        id: recordId,
        poVendorId: po.id,
        vendorName,
        receiveDate: nowDateStr,
        doNumber: `DO-PENDING-${recordId}`,
        status: 'Menunggu Kedatangan',
        receivedBy: currentUser.username,
        notes: `Release to Vendor dari ${po.id} (Telah Disetujui Cost Control)`,
        items: items.map((i, index) => ({
          lineId: String(index),
          sku: i.sku,
          itemName: i.itemName,
          category: i.category,
          unit: i.unit,
          orderedQty: i.qty,
          receivedQty: 0,
          pendingQty: i.qty,
          unitPrice: i.price,
          totalPrice: 0,
        })),
      });
    });

    setReceivingRecords((prev) => [...newReceivingRecords, ...prev]);

    // Update PO status to Sent to Receiving (Released to Vendor)
    setPurchaseOrders((prev) =>
      prev.map((p) =>
        p.id === poId
          ? {
              ...p,
              status: 'Sent to Receiving',
              releasedToVendorAt: nowIso,
              releasedToVendorBy: currentUser.username,
            }
          : p
      )
    );

    // Update vendor total purchase metric
    setVendors((prev) =>
      prev.map((v) => {
        const vItems = approvedItems.filter((it) => it.vendorName === v.namaVendor);
        if (vItems.length > 0) {
          const sum = vItems.reduce((acc, it) => acc + it.total, 0);
          return { ...v, totalPurchase: v.totalPurchase + sum };
        }
        return v;
      })
    );

    addAuditLog({
      module: 'Purchasing & Vendor',
      category: 'Order Approval',
      action: 'Release PO ke Mitra Vendor & Inbound Receiving',
      referenceId: po.id,
      department: 'Purchasing & Finance',
      severity: 'Success',
      description: `Melakukan Release to Vendor untuk ${po.id} dan menerbitkan ${newReceivingRecords.length} dokumen penerimaan barang masuk (${newReceivingRecords.map((r) => r.id).join(', ')}) ke laman Inbound.`,
      changes: [
        { field: 'Status PO', before: po.status, after: 'Sent to Receiving' },
        { field: 'Dokumen Inbound Terbit', before: '0 Dokumen', after: newReceivingRecords.map((r) => r.id).join(', ') },
      ],
    });

    return {
      success: true,
      receivingCount: newReceivingRecords.length,
      receivingIds: newReceivingRecords.map((r) => r.id),
      message: `Form PO ${po.id} berhasil di-Release to Vendor! Sebanyak ${newReceivingRecords.length} dokumen penerimaan barang (${newReceivingRecords.map((r) => r.id).join(', ')}) telah otomatis masuk ke laman Inbound (Penerimaan Barang Masuk).`,
    };
  };

  const batchReleasePOToVendor = (poIds: string[]) => {
    const targetPOs = purchaseOrders.filter(
      (p) => poIds.includes(p.id) && canReleasePO(p)
    );

    if (targetPOs.length === 0) {
      return {
        success: false,
        count: 0,
        receivingCount: 0,
        receivingIds: [],
        message: 'Tidak ada form PO berstatus Disetujui Cost Control yang siap untuk dilakukan Release to Vendor.',
      };
    }

    const newReceivingRecords: InboundReceivingRecord[] = [];
    const nowDateStr = jakartaDate();
    const nowIso = new Date().toISOString();
    const vendorPurchaseDelta = new Map<string, number>();

    targetPOs.forEach((po) => {
      const approvedItems = po.items.filter(
        (it) => it.status !== 'Rejected' && it.approvalStatus === 'Approved'
      );
      const itemsByVendor = new Map<string, typeof approvedItems>();
      approvedItems.forEach((it) => {
        const vName = it.vendorName || 'Vendor Umum';
        if (!itemsByVendor.has(vName)) itemsByVendor.set(vName, []);
        itemsByVendor.get(vName)!.push(it);

        vendorPurchaseDelta.set(vName, (vendorPurchaseDelta.get(vName) || 0) + it.total);
      });

      itemsByVendor.forEach((items, vendorName) => {
        const recordId = `RCV-${po.id.replace('PO-', '')}-${String(
          receivingRecords.length + newReceivingRecords.length + 1
        ).padStart(2, '0')}`;
        newReceivingRecords.push({
          id: recordId,
          poVendorId: po.id,
          vendorName,
          receiveDate: nowDateStr,
          doNumber: `DO-PENDING-${recordId}`,
          status: 'Menunggu Kedatangan',
          receivedBy: currentUser.username,
          notes: `Release to Vendor dari ${po.id} (Telah Disetujui Cost Control)`,
          items: items.map((i, index) => ({
          lineId: String(index),
            sku: i.sku,
            itemName: i.itemName,
            category: i.category,
            unit: i.unit,
            orderedQty: i.qty,
            receivedQty: 0,
            pendingQty: i.qty,
            unitPrice: i.price,
            totalPrice: 0,
          })),
        });
      });
    });

    const releasedIds = targetPOs.map((p) => p.id);

    setReceivingRecords((prev) => [...newReceivingRecords, ...prev]);

    setPurchaseOrders((prev) =>
      prev.map((p) =>
        releasedIds.includes(p.id)
          ? {
              ...p,
              status: 'Sent to Receiving',
              releasedToVendorAt: nowIso,
              releasedToVendorBy: currentUser.username,
            }
          : p
      )
    );

    setVendors((prev) =>
      prev.map((v) => {
        const delta = vendorPurchaseDelta.get(v.namaVendor);
        if (delta && delta > 0) {
          return { ...v, totalPurchase: v.totalPurchase + delta };
        }
        return v;
      })
    );

    addAuditLog({
      module: 'Purchasing & Vendor',
      category: 'Order Approval',
      action: 'Batch Release PO ke Mitra Vendor & Inbound',
      referenceId: releasedIds.join(', '),
      department: 'Purchasing & Finance',
      severity: 'Success',
      description: `Melakukan Release to Vendor secara massal untuk ${targetPOs.length} Form PO (${releasedIds.join(', ')}) dan menerbitkan ${newReceivingRecords.length} dokumen Inbound.`,
      changes: [
        { field: 'Form PO Dirilis', before: 'Approved by Cost Control', after: `${releasedIds.join(', ')} -> Sent to Receiving` },
        { field: 'Dokumen Inbound', before: '0', after: `${newReceivingRecords.length} Dokumen Receiving` },
      ],
    });

    return {
      success: true,
      count: targetPOs.length,
      receivingCount: newReceivingRecords.length,
      receivingIds: newReceivingRecords.map((r) => r.id),
      message: `Berhasil melakukan Release to Vendor untuk ${targetPOs.length} Form PO (${releasedIds.join(', ')})! Sebanyak ${newReceivingRecords.length} dokumen penerimaan telah masuk ke Inbound.`,
    };
  };

  // Inbound: Receive Goods ("Terima Barang")
  const receiveGoods = (recordId: string, entries: ReceiptEntry[], notes?: string) => {
    const record = receivingRecords.find((r) => r.id === recordId);
    if (!record) return { success: false, message: 'Dokumen penerimaan tidak ditemukan.' };
    try {
      if (!['Administrator', 'Storage Inbound'].includes(currentUser.position)) {
        throw new Error('Akses penerimaan ditolak.');
      }
      const { items, movements } = calculateReceipt(record, entries);
      const date = jakartaDate();
      const period = date.slice(0, 7);
      if (stockOpnameReports.some((report) => report.period === period &&
          ['Disetujui', 'Finalized (Generated)'].includes(report.status))) {
        throw new Error('Periode stok ditutup untuk penerimaan.');
      }
      if (movements.some((movement) => !periodicInventories[period]?.some((item) => item.sku === movement.sku))) {
        throw new Error('Tambahkan seluruh SKU ke Master Inventory pada periode transaksi.');
      }
      movements.forEach((movement) => adjustInventoryBalance(
        movement.sku, movement.quantity, 0, movement.unitPrice, period,
      ));
      setReceivingRecords((previous) => previous.map((item) => item.id === recordId ? {
        ...item, items, receiveDate: date,
        status: items.every((line) => line.pendingQty === 0) ? 'Diterima Keseluruhan' : 'Diterima Sebagian',
        receivedBy: currentUser.username, notes: notes || item.notes,
      } : item));
      addAuditLog({
        module: 'Inbound', category: 'Stock Adjustment', action: 'Penerimaan Fisik Barang',
        referenceId: recordId, description: 'Penerimaan terhadap ' + record.poVendorId,
        changes: movements.map((movement) => ({
          field: movement.sku,
          after: '+' + movement.quantity + ' @ ' + formatRupiah(movement.unitPrice),
        })),
      });
      return { success: true, message: 'Penerimaan tercatat.' };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : 'Penerimaan gagal.' };
    }
  };

  const deleteReceivingRecord = (id: string) => {
    const record = receivingRecords.find((r) => r.id === id);
    if (!record) return;
    window.alert('Dokumen penerimaan PO dipertahankan. Gunakan koreksi stok untuk penyesuaian.');
  };

  // Inbound: Manual Incoming Goods
  const addManualInbound = (recordData: Omit<ManualInboundRecord, 'id' | 'date'> & { date?: string }) => {
    const id = 'INC-' + crypto.randomUUID();
    const period = (recordData.date || jakartaDate()).slice(0, 7);
    if (!Number.isFinite(recordData.qty) || recordData.qty <= 0 ||
        !periodicInventories[period]?.some((item) => item.sku === recordData.sku) ||
        stockOpnameReports.some((report) => report.period === period &&
          ['Disetujui', 'Finalized (Generated)'].includes(report.status))) {
      return { success: false, message: 'Periksa kuantitas, SKU, dan periode transaksi.' };
    }
    const newRecord: ManualInboundRecord = {
      ...recordData,
      id,
      date: recordData.date || jakartaDate(),
      totalPrice: recordData.price !== undefined ? recordData.price * recordData.qty : undefined,
    };

    setManualInboundRecords((prev) => [newRecord, ...prev]);

    // Live update Master Inventory inbound balance and accumulate/average priceActual
    adjustInventoryBalance(recordData.sku, recordData.qty, 0, recordData.price, newRecord.date.slice(0, 7));

    addAuditLog({
      module: 'Inbound',
      category: 'Stock Adjustment',
      action: 'Penambahan Stok Barang Masuk Manual (Incoming)',
      referenceId: recordData.sku,
      department: 'Central Warehouse',
      severity: 'Info',
      description: `Mencatat pemasukan barang manual ${recordData.itemName} (${recordData.sku}) sebanyak +${recordData.qty} ${recordData.unit} dari sumber: ${recordData.source}.`,
      changes: [
        { field: `Inbound (${recordData.sku})`, before: 'Stok Sebelumnya', after: `+${recordData.qty} ${recordData.unit}` },
      ],
    });
    return { success: true, message: '' };
  };

  const deleteManualInbound = (id: string) => {
    const targetRec = manualInboundRecords.find((r) => r.id === id);
    if (!targetRec) return;
    const record = targetRec;
    adjustInventoryBalance(record.sku, -record.qty, 0, record.price, record.date.slice(0, 7));
    setManualInboundRecords((prev) => prev.filter((entry) => entry.id !== id));

    if (targetRec) {
      addAuditLog({
        module: 'Inbound',
        category: 'Stock Adjustment',
        action: 'Hapus Transaksi Barang Masuk Manual',
        referenceId: targetRec.sku,
        department: 'Central Warehouse',
        severity: 'Warning',
        description: `Menghapus catatan barang masuk manual ${targetRec.itemName} (${targetRec.sku}) dan membatalkan penambahan stok sebesar -${targetRec.qty} ${targetRec.unit}.`,
      });
    }
  };

  // Outbond: Manual Outcoming Goods
  const addManualOutbond = (recordData: Omit<ManualOutbondRecord, 'id' | 'date'> & { date?: string }) => {
    const id = 'OUT-' + crypto.randomUUID();
    const period = (recordData.date || jakartaDate()).slice(0, 7);
    const item = periodicInventories[period]?.find((row) => row.sku === recordData.sku);
    if (!Number.isFinite(recordData.qty) || recordData.qty <= 0 || !item ||
        recordData.qty > item.endingInventory ||
        stockOpnameReports.some((report) => report.period === period &&
          ['Disetujui', 'Finalized (Generated)'].includes(report.status))) {
      return { success: false, message: 'Periksa kuantitas, saldo stok, dan periode transaksi.' };
    }
    const newRecord: ManualOutbondRecord = {
      ...recordData,
      id,
      date: recordData.date || jakartaDate(),
    };

    setManualOutbondRecords((prev) => [newRecord, ...prev]);

    // Live update Master Inventory outbond balance
    adjustInventoryBalance(recordData.sku, 0, recordData.qty, undefined, newRecord.date.slice(0, 7));

    addAuditLog({
      module: 'Outbond',
      category: 'Stock Adjustment',
      action: 'Pengeluaran Stok Barang Manual (Outbond)',
      referenceId: recordData.sku,
      department: (recordData.department as AuditDepartmentScope) || 'Central Warehouse',
      outletName: recordData.outletName,
      severity: 'Warning',
      description: `Mencatat pengeluaran stok manual ${recordData.itemName} (${recordData.sku}) sebesar -${recordData.qty} ${recordData.unit} untuk tujuan: ${recordData.destination}.`,
      changes: [
        { field: `Outbond (${recordData.sku})`, before: 'Stok Sebelumnya', after: `-${recordData.qty} ${recordData.unit} (${recordData.destination})` },
      ],
    });
    return { success: true, message: '' };
  };

  const deleteManualOutbond = (id: string) => {
    const targetRec = manualOutbondRecords.find((r) => r.id === id);
    if (!targetRec) return;
    const record = targetRec;
    adjustInventoryBalance(record.sku, 0, -record.qty, undefined, record.date.slice(0, 7));
    setManualOutbondRecords((prev) => prev.filter((entry) => entry.id !== id));

    if (targetRec) {
      addAuditLog({
        module: 'Outbond',
        category: 'Stock Adjustment',
        action: 'Hapus Transaksi Pengeluaran Manual',
        referenceId: targetRec.sku,
        department: 'Central Warehouse',
        severity: 'Warning',
        description: `Menghapus transaksi pengeluaran manual ${targetRec.itemName} (${targetRec.sku}) dan mengembalikan stok sebesar +${targetRec.qty} ${targetRec.unit}.`,
      });
    }
  };

  // Outbond: Deploy Outlet Order
  const deployOutletOrder = (
    orderId: string,
    shippedItems?: { sku: string; qtyShipped: number }[]
  ) => {
    finalApproveToOutbond(orderId);
  };

  // 1. Deployment: Kelola & Generate PO -> Status menjadi 'Siap Dikirim' (Mendukung Pengiriman Sebagian/Parsial)
  const generateDeploymentPO = (
    orderId: string,
    updatedItems?: OrderItem[],
    allowPartialShipment: boolean = true
  ) => {
    const order = outletOrders.find((o) => o.id === orderId);
    if (!order) return { success: false, message: 'Form PO tidak ditemukan.' };

    const itemsToSave = updatedItems || order.items;
    if (itemsToSave.some((item) => !Number.isFinite(item.qty) || item.qty <= 0 ||
        !Number.isFinite(item.qtyPrepared ?? 0) || (item.qtyPrepared ?? 0) < 0 ||
        (item.qtyPrepared ?? 0) > item.qty)) {
      return { success: false, message: 'Kuantitas disiapkan harus antara nol dan kuantitas pesanan.' };
    }

    // Filter barang yang telah disiapkan (qtyPrepared > 0)
    const preparedItems = itemsToSave.filter((it) => (it.qtyPrepared || 0) > 0);

    if (preparedItems.length === 0) {
      return {
        success: false,
        message:
          'Belum ada barang yang disiapkan (Qty Disiapkan masih 0). Harap isi minimal 1 barang atau klik "Penuhi Semua".',
      };
    }

    // Hitung barang sisa / kekurangan (it.qty - qtyPrepared > 0)
    const remainingItems = itemsToSave
      .filter((it) => roundQuantity(it.qty - (it.qtyPrepared || 0)) > 0)
      .map((it) => {
        const remainingQty = roundQuantity(it.qty - (it.qtyPrepared || 0));
        return {
          ...it,
          qty: remainingQty,
          qtyPrepared: undefined,
          subtotal: remainingQty * it.price,
        };
      });

    const isPartial = allowPartialShipment && remainingItems.length > 0;

    if (isPartial) {
      // 1. Barang yang siap dikirim pada pengiriman ini (masuk ke Siap Dikirim)
      const itemsToShip: OrderItem[] = preparedItems.map((it) => ({
        ...it,
        qty: it.qtyPrepared!,
        qtyPrepared: it.qtyPrepared!,
        subtotal: it.qtyPrepared! * it.price,
      }));

      const shippedTotalAmount = itemsToShip.reduce((sum, it) => sum + it.subtotal, 0);
      const remainingTotalAmount = remainingItems.reduce((sum, it) => sum + it.subtotal, 0);

      // Helper penomoran form sisa/backorder yang dijamin unik
      const getBackorderId = (baseId: string): string => {
        const cleanBase = baseId.includes('-SISA') ? baseId.split('-SISA')[0] : baseId;
        let candidate = `${cleanBase}-SISA`;
        let counter = 2;
        while (outletOrders.some((o) => o.id === candidate)) {
          candidate = `${cleanBase}-SISA-${counter}`;
          counter++;
        }
        return candidate;
      };

      const remainingOrderId = getBackorderId(order.id);

      // 2. Form sisa pesanan yang tetap tinggal di proses '1. Perlu Dikelola'
      const remainingOrder: OutletOrder = {
        id: remainingOrderId,
        outletName: order.outletName,
        picName: order.picName,
        department: order.department,
        dateRequested: order.dateRequested,
        items: remainingItems,
        status: 'Processing Gudang', // Tetap di proses 1. Perlu Dikelola
        totalAmount: remainingTotalAmount,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        notes: `Sisa / Kekurangan (Credit) dari Form ${order.id}. Menunggu stok barang siap dipenuhi.`,
        isBackorder: true,
        parentOrderId: order.id,
      };

      setOutletOrders((prev) => {
        const updated = prev.map((o) =>
          o.id === orderId
            ? {
                ...o,
                items: itemsToShip,
                totalAmount: shippedTotalAmount,
                status: 'Siap Dikirim' as const,
                isPartialShipment: true,
                deploymentGeneratedAt: new Date().toISOString(),
                deploymentGeneratedBy: currentUser.username,
                updatedAt: new Date().toISOString(),
                notes:
                  (o.notes ? o.notes + ' • ' : '') +
                  `Pengiriman Sebagian (${itemsToShip.length} jenis barang disiapkan, ${remainingItems.length} jenis barang menjadi sisa credit).`,
              }
            : o
        );
        return [remainingOrder, ...updated];
      });

      return {
        success: true,
        isPartial: true,
        shippedCount: itemsToShip.length,
        remainingCount: remainingItems.length,
        remainingOrderId,
        message: `Pengiriman sebagian berhasil di-generate! ${itemsToShip.length} jenis barang resmi masuk ke '2. Siap Dikirim'. Sisa ${remainingItems.length} jenis barang yang belum ada tetap tinggal di '1. Perlu Dikelola' dengan Form ID ${remainingOrderId}.`,
      };
    } else {
      // Seluruh barang 100% siap dikirim
      const itemsToShip: OrderItem[] = itemsToSave.map((it) => ({
        ...it,
        qty: it.qty,
        qtyPrepared: it.qtyPrepared !== undefined ? it.qtyPrepared : it.qty,
        subtotal: it.qty * it.price,
      }));

      const totalAmount = itemsToShip.reduce((sum, it) => sum + it.subtotal, 0);

      setOutletOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? {
                ...o,
                items: itemsToShip,
                totalAmount,
                status: 'Siap Dikirim' as const,
                deploymentGeneratedAt: new Date().toISOString(),
                deploymentGeneratedBy: currentUser.username,
                updatedAt: new Date().toISOString(),
              }
            : o
        )
      );

      return {
        success: true,
        isPartial: false,
        shippedCount: itemsToShip.length,
        remainingCount: 0,
        message: `Form PO (${orderId}) berhasil dikelola 100% lengkap dan masuk ke status 'Siap Dikirim'.`,
      };
    }
  };

  // 2. Deployment: Tinjau & Setujui dari 'Siap Dikirim' -> Status menjadi 'PO Terkirim' (Hanya Administrator)
  const approveShipmentToPOTerkirim = (orderId: string) => {
    if (currentUser.position !== 'Administrator') {
      return {
        success: false,
        message: 'Akses ditolak: Perintah Setujui Pengiriman hanya dapat dilakukan oleh Administrator.',
      };
    }

    const order = outletOrders.find((o) => o.id === orderId);
    if (!order) return { success: false, message: 'Form PO tidak ditemukan.' };

    setOutletOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? {
              ...o,
              status: 'PO Terkirim',
              dispatchedAt: new Date().toISOString(),
              dispatchedBy: currentUser.username,
              updatedAt: new Date().toISOString(),
            }
          : o
      )
    );

    addAuditLog({
      module: 'Outbond',
      category: 'Order Approval',
      action: 'Persetujuan Pengiriman Barang ke Outlet (PO Terkirim)',
      referenceId: orderId,
      department: order.department,
      outletName: order.outletName,
      severity: 'Info',
      description: `Menyetujui keberangkatan pengiriman barang untuk ${order.outletName} - Departemen ${order.department} (${orderId}).`,
      changes: [
        { field: 'Status Distribusi', before: order.status, after: 'PO Terkirim' },
      ],
    });

    return {
      success: true,
      message: `Form PO (${orderId}) telah ditinjau dan disetujui. Status kini menjadi 'PO Terkirim'.`,
    };
  };

  // 3. Deployment: Tinjau & Setujui Kembali dari 'PO Terkirim' -> Status menjadi Selesai & Masuk ke Outbond (Stok Terpotong)
  const finalApproveToOutbond = (orderId: string) => {
    const order = outletOrders.find((o) => o.id === orderId);
    if (!order) return { success: false, message: 'Form PO tidak ditemukan.' };

    if (order.status !== 'PO Terkirim') {
      return { success: false, message: 'Pengiriman belum disetujui atau sudah selesai.' };
    }
    const period = getCurrentPeriodKey();
    const stock = periodicInventories[period] ?? EMPTY_INVENTORY;
    if (stockOpnameReports.some((report) => report.period === period &&
        ['Disetujui', 'Finalized (Generated)'].includes(report.status))) {
      return { success: false, message: 'Periode stok ditutup untuk pengiriman.' };
    }
    const itemsToShip = order.items.map((it) => ({
      sku: it.sku,
      qtyShipped: it.qtyPrepared !== undefined ? it.qtyPrepared : it.qty,
    }));

    const totals = new Map<string, number>();
    for (const item of itemsToShip) {
      totals.set(item.sku, roundQuantity((totals.get(item.sku) ?? 0) + item.qtyShipped));
    }
    if (![...totals.values()].some((qty) => qty > 0) || itemsToShip.some((item) => !Number.isFinite(item.qtyShipped) || item.qtyShipped < 0) ||
        [...totals].some(([sku, qty]) => qty > (stock.find((item) => item.sku === sku)?.endingInventory ?? 0))) {
      return { success: false, message: 'Stok tersedia tidak mencukupi untuk pengiriman.' };
    }
    // Potong stok dan catat ke Master Inventory pada kolom Outbond
    itemsToShip.forEach((s) => {
      adjustInventoryBalance(s.sku, 0, s.qtyShipped, undefined, period);
    });

    setOutletOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? {
              ...o,
              status: 'Selesai',
              deployedItems: itemsToShip,
              finalApprovedAt: new Date().toISOString(),
              finalApprovedBy: currentUser.username,
              updatedAt: new Date().toISOString(),
            }
          : o
      )
    );

    addAuditLog({
      module: 'Outbond',
      category: 'Stock Adjustment',
      action: 'Otorisasi Akhir Outbond & Pemotongan Stok Gudang',
      referenceId: orderId,
      department: order.department,
      outletName: order.outletName,
      severity: 'Success',
      description: `Menyelesaikan pengiriman Outbond untuk ${order.outletName} (${order.department}) dan memotong stok gudang pusat untuk ${itemsToShip.length} jenis barang.`,
      changes: [
        { field: 'Status Order Outlet', before: order.status, after: 'Selesai (Outbond)' },
        {
          field: 'Pemotongan Stok Gudang',
          before: 'Stok Gudang Pusat',
          after: itemsToShip.map((s) => `${s.sku}: -${s.qtyShipped}`).join(', '),
        },
      ],
    });

    return {
      success: true,
      message: `Form PO (${orderId}) telah disetujui akhir dan selesai. Seluruh barang resmi dicatat sebagai data masuk untuk Outbond!`,
    };
  };

  const resetInventoryBalances = () => window.alert('Gunakan koreksi stok untuk mengubah saldo.');
  const clearAllForms = () => window.alert('Dokumen operasional tersimpan sebagai riwayat.');
  const resetAllData = () => window.alert('Reset data bersama tidak tersedia.');

  if (loadingSession || (isAuthenticated && !loaded && !saveError)) {
    return <div role="status" className="p-8 text-center">Memuat data gudang…</div>;
  }

  return (
    <AppContext.Provider
      value={{
        isAuthenticated,
        login,
        logout,
        confirmPendingSave,

        outlets,
        addOutlet,
        updateOutlet,
        deleteOutlet,

        currentUser,
        users,
        addUser,
        updateUser,
        deleteUser,

        inventory,
        updateStockOpname,
        addInventoryItem,
        updateInventoryItem,
        deleteInventoryItem,
        clearMasterInventory,
        bulkImportMasterInventory,

        selectedPeriod,
        setSelectedPeriod,
        periodicInventories,
        stockOpnameReports,
        startStockOpname,
        approveStockOpnameReport,
        rejectStockOpnameReport,
        generateFinalSO,


        outletOrders,
        createOutletOrder,
        bulkImportOutletOrders,
        updateOutletOrder,
        deleteOutletOrder,
        updateOrderItem,
        addOrderItem,
        deleteOrderItem,

        purchaseOrders,
        generatePO,
        updatePO,
        deletePO,
        submitPOToPurchasing,
        submitPOToVendorSummary,
        submitPOToVendor,
        submitPOToCostControl,
        batchSubmitPOToCostControl,
        approvePOCostControl,
        rejectPOCostControl,
        returnPOToVendorSummary,
        updateVendorSummaryItem,

        vendors,
        addVendor,
        updateVendor,
        deleteVendor,
        assignVendorToPOItem,
        updatePOItemPayment,
        setItemApprovalStatus,
        batchSetItemApprovalStatus,
        rejectPOItem,
        submitPOVendorToReceiving,
        batchReleasePOToVendor,

        receivingRecords,
        receiveGoods,
        deleteReceivingRecord,

        manualInboundRecords,
        addManualInbound,
        deleteManualInbound,

        manualOutbondRecords,
        addManualOutbond,
        deleteManualOutbond,

        deployOutletOrder,
        generateDeploymentPO,
        approveShipmentToPOTerkirim,
        finalApproveToOutbond,

        auditLogs,
        addAuditLog,
        clearAuditLogs,

        canAccess,
        resetAllData,
        clearAllForms,
        resetInventoryBalances,
      }}
    >
      {children}
      {isAuthenticated && (saving || changes.length > 0 || saveError) && (
        <div className="fixed inset-0 z-[9999] grid place-items-center bg-black/40" role="status">
          <div className="max-w-md rounded-xl bg-white p-6 shadow-xl">
            {saveError ? (
              <>
                <p className="font-semibold text-red-700">{saveError}</p>
                <p className="mt-2 text-sm">Perubahan yang belum dikonfirmasi tidak tercatat sebagai transaksi selesai.</p>
                <div className="mt-4 flex flex-wrap gap-3">
                  {loaded && <button className="rounded bg-slate-100 px-3 py-2" onClick={() => setSaveError('')}>Coba Simpan Lagi</button>}
                  <button className="rounded bg-slate-100 px-3 py-2" onClick={() => {
                    if (!loaded || window.confirm('Buang perubahan belum tersimpan dan muat data server?')) {
                      loadRecords().catch((error: Error) => setSaveError(error.message));
                    }
                  }}>Muat Data Server</button>
                  <button className="rounded bg-slate-100 px-3 py-2" onClick={logout}>Keluar</button>
                </div>
              </>
            ) : <p>Menyimpan ke database…</p>}
          </div>
        </div>
      )}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
