export type ItemCategory =
  | 'Baked Item'
  | 'Butcher'
  | 'Dairy & Frozen'
  | 'Dry Item'
  | 'Drinks'
  | 'Gas'
  | 'Other Expense'
  | 'Packaging'
  | 'Vegetables';

export const ITEM_CATEGORIES: ItemCategory[] = [
  'Baked Item',
  'Butcher',
  'Dairy & Frozen',
  'Dry Item',
  'Drinks',
  'Gas',
  'Other Expense',
  'Packaging',
  'Vegetables',
];

export type DepartmentName = 'Kitchen' | 'Bar' | 'Pastry' | 'Floor & Operations';

export const DEPARTMENTS: DepartmentName[] = [
  'Kitchen',
  'Bar',
  'Pastry',
  'Floor & Operations',
];

export interface OutletData {
  id: string;
  namaOutlet: string;
  department: DepartmentName[]; // List of active departments in this outlet
  location: string;
}

export type UserPosition =
  | 'Administrator'
  | 'Outlet'
  | 'Storage-Mailer'
  | 'Storage Inbound'
  | 'Storage Outbond'
  | 'Purchasing'
  | 'Cost Control';

export interface User {
  id: string;
  username: string;
  position: UserPosition;
  access: string[];
  email: string;
  password?: string;
  outletName?: string;
  department?: DepartmentName;
  placement?: string; // Penempatan User: 'Head Office/Warehouse' atau nama outlet
}

export interface InventoryItem {
  sku: string;
  itemName: string;
  category: ItemCategory;
  unit: string; // kg, pack, pcs, roll, tabung, botol, liter, etc.
  price: number; // backward compatibility (defaults to priceBudget)
  priceBudget?: number; // PRICE BUDGET
  priceActual?: number; // PRICE ACTUAL
  beginningInventory: number; // BEGINNING INVENTORY USAGE
  beginningValue?: number; // BEGINNING INVENTORY VALUE (qty * priceBudget)
  inbound: number; // INBOUND USAGE
  inboundValue?: number; // INBOUND VALUE (total inbound value)
  outbond: number; // OUTBOND USAGE
  outbondValue?: number; // OUTBOND VALUE (total outbond value)
  endingInventory: number; // ENDING INVENTORY USAGE
  endingValue?: number; // ENDING INVENTORY VALUE (beginning value + inbound value - outbond value)
  stockOpname: number; // SO USAGE
  soValue?: number; // SO VALUE (qty * priceActual)
  gap: number; // GAP USAGE (stockOpname - endingInventory)
  gapValue?: number; // GAP VALUE (endingValue - soValue)
  minStock?: number;
  safetyStock?: number; // Defined safety stock level for Low Stock Alerts
  allowedDepartments: DepartmentName[]; // dedicated items per department to prevent duplicate/wrong orders
  vendor?: string; // Vendor terkait
  period?: string; // YYYY-MM
}

export type StockOpnameStatus = 'Draft' | 'Menunggu Review' | 'Disetujui' | 'Finalized (Generated)';

export interface StockOpnameItem {
  sku: string;
  itemName: string;
  category: ItemCategory;
  unit: string;
  priceBudget: number;
  priceActual: number;
  systemStock: number; // Ending inventory usage tercatat di sistem
  systemValue: number; // Ending inventory value tercatat di sistem
  physicalCount: number; // Hasil hitung fisik (SO USAGE)
  physicalValue: number; // physicalCount * priceActual (SO VALUE)
  gapUsage: number; // physicalCount - systemStock
  gapValue: number; // systemValue - physicalValue
  notes?: string;
}

export interface StockOpnameReport {
  id: string; // e.g. "SO-2026-10"
  period: string; // "2026-10"
  periodLabel: string; // "Oktober 2026"
  conductedDate: string; // YYYY-MM-DD
  checkerName: string;
  supervisorName?: string;
  status: StockOpnameStatus;
  items: StockOpnameItem[];
  totalSystemUsage: number;
  totalSystemValue: number;
  totalPhysicalUsage: number;
  totalPhysicalValue: number;
  totalGapValue: number;
  gapPercentage: number;
  notes?: string;
  approvedAt?: string;
  approvedBy?: string;
  finalizedAt?: string;
  finalizedBy?: string;
  nextPeriodGenerated?: string;
  createdAt: string;
  updatedAt: string;
}


export interface OrderItem {
  sku: string;
  itemName: string;
  category: ItemCategory;
  qty: number; // Qty Dipesan
  qtyPrepared?: number; // Qty Disiapkan Gudang
  unit: string;
  price: number;
  subtotal: number;
  notes?: string;
}

export type OrderStatus =
  | 'Draft'
  | 'Submitted'
  | 'PO Generated'
  | 'Processing Gudang'
  | 'Siap Dikirim'
  | 'PO Terkirim'
  | 'Selesai'
  | 'Deployed / Dikirim'
  | 'Diterima Sebagian'
  | 'Diterima Lengkap'
  | 'Cancelled';

export interface OutletOrder {
  id: string; // Form ID e.g., "12/10/2026-Resto Senopati-Kitchen"
  outletName: string;
  picName?: string; // Nama PIC pemesan
  department: DepartmentName;
  dateRequested: string; // YYYY-MM-DD
  items: OrderItem[];
  status: OrderStatus;
  totalAmount: number;
  poId?: string;
  createdAt: string;
  updatedAt: string;
  notes?: string;
  deployedItems?: { sku: string; qtyShipped: number }[];
  deploymentGeneratedAt?: string;
  deploymentGeneratedBy?: string;
  dispatchedAt?: string;
  dispatchedBy?: string;
  finalApprovedAt?: string;
  finalApprovedBy?: string;
  isBackorder?: boolean; // True jika merupakan sisa order/credit dari pengiriman sebagian
  parentOrderId?: string; // Form ID pesanan asal
  isPartialShipment?: boolean; // True jika pengiriman ini adalah pengiriman sebagian/parsial
}

export interface POOutletBreakdown {
  outletName: string;
  department: DepartmentName;
  picName?: string;
  qty: number;
  unit: string;
  orderId?: string;
}

export type PaymentMethodType = 'Tempo' | 'Cash';
export type VendorTOP = 'TOP 7 Hari' | 'TOP 14 Hari' | 'TOP 30 Hari' | 'TOP 45 Hari' | 'TOP 60 Hari' | 'TOP 90 Hari';
export type VendorCashType = 'Cash / COD' | 'Bank Transfer (Cash)' | 'Tunai';

export interface POItem {
  sku: string;
  itemName: string;
  category: ItemCategory;
  qty: number;
  unit: string;
  price: number;
  total: number;
  place: string; // e.g. "Resto Senopati - Kitchen" or "Digabung (2 Outlet)"
  isMerged?: boolean; // True jika item dipesan lebih dari 1 outlet dan digabungkan
  outletBreakdowns?: POOutletBreakdown[]; // Rincian kuantitas per outlet pemesan
  outletBreakdownText?: string; // Teks keterangan ringkas e.g. "Resto Senopati: 20 Kg, Resto Menteng: 15 Kg"
  vendorName?: string;
  paymentMethod?: PaymentMethodType; // 'Tempo' | 'Cash'
  paymentTerm?: string; // e.g. 'TOP 30 Hari' or 'Cash / COD'
  status?: 'Pending' | 'Approved' | 'Rejected';
  approvalStatus?: 'Approved' | 'Rejected' | 'Pending'; // Cost Control approval status
  rejectionReason?: string;
}

export type PurchaseOrderStatus =
  | 'Draft PO'
  | 'Submitted to Purchasing'
  | 'Vendor Summary'
  | 'Review Cost Control'
  | 'Approved by Cost Control'
  | 'Rejected by Cost Control'
  | 'Submitted to Vendor'
  | 'Approved by Vendor'
  | 'Sent to Receiving'
  | 'Completed';

export interface CostControlApproval {
  approvedBy: string;
  approvedAt: string;
  totalApprovedAmount: number;
  notes?: string;
  status: 'Approved' | 'Rejected';
}

export interface PurchaseOrder {
  id: string; // Format e.g., "PO-20261012-001"
  generatedDate: string;
  sourceOrderIds: string[]; // Order IDs merged into this PO
  items: POItem[];
  totalAmount: number;
  status: PurchaseOrderStatus;
  createdAt: string;
  notes?: string;
  submittedToCostControlAt?: string;
  submittedToCostControlBy?: string;
  costControlApproval?: CostControlApproval;
  releasedToVendorAt?: string;
  releasedToVendorBy?: string;
  emailedVendors?: {
    vendorName: string;
    email: string;
    sentAt: string;
    sentBy?: string;
    subject?: string;
  }[];
}

export interface Vendor {
  id: string;
  namaVendor: string;
  address: string;
  telephone: string;
  email: string;
  paymentCategory?: 'Tempo' | 'Cash'; // Pisahkan pilihan Tempo dan Cash
  topTerm?: VendorTOP | string; // Pilihan TOP setelah opsi Tempo terpilih
  cashType?: VendorCashType | string; // Pilihan opsi Cash
  paymentType: string; // e.g. 'TOP 30 Hari' | 'Cash / COD'
  pic: string;
  minimumOrder?: number; // Nilai Minimum Order (Rp)
  totalPurchase: number;
  categories: ItemCategory[];
}

export interface InboundReceivingRecord {
  id: string;
  poVendorId: string;
  vendorName: string;
  receiveDate: string;
  doNumber: string; // Surat Jalan / Delivery Order
  items: {
    sku: string;
    itemName: string;
    category: ItemCategory;
    unit: string;
    orderedQty: number;
    receivedQty: number;
    pendingQty: number;
    unitPrice: number;
    totalPrice: number;
  }[];
  status: 'Diterima Keseluruhan' | 'Diterima Sebagian' | 'Menunggu Kedatangan';
  receivedBy: string;
  notes?: string;
}

export interface ManualInboundRecord {
  id: string;
  date: string;
  sku: string;
  itemName: string;
  category: ItemCategory;
  qty: number;
  unit: string;
  price?: number;
  priceBeforePPN?: number;
  includePPN?: boolean;
  ppnPercentage?: number;
  ppnAmount?: number;
  totalPrice?: number;
  vendorName?: string;
  source: string; // e.g., "Vendor: PT Berkah Pangan", "Pembelian Langsung Pasar", "Retur Outlet", "Koreksi Stok"
  receivedBy: string;
  notes?: string;
}

export interface ManualOutbondRecord {
  id: string;
  date: string;
  sku: string;
  itemName: string;
  category: ItemCategory;
  qty: number;
  unit: string;
  outletName?: string;
  department?: string;
  destination: string; // e.g., "Spoilage / Basi", "Sampling QC", "Transfer Antar Gudang"
  dispatchedBy: string;
  notes?: string;
}

export type AuditActionCategory =
  | 'Order Approval'
  | 'Stock Adjustment'
  | 'Order Lifecycle'
  | 'Master Data & System';

export type AuditModuleName =
  | 'Order Outlet'
  | 'Purchase Request'
  | 'Purchasing & Vendor'
  | 'Cost Control'
  | 'Inbound'
  | 'Outbond'
  | 'Master Inventory'
  | 'System & Setting';

export type AuditSeverity = 'Info' | 'Success' | 'Warning' | 'Critical';

export type AuditDepartmentScope =
  | DepartmentName
  | 'All Departments'
  | 'Central Warehouse'
  | 'Purchasing & Finance';

export interface AuditChangeItem {
  field: string;
  before?: string | number;
  after?: string | number;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actorName: string;
  actorRole: UserPosition;
  department: AuditDepartmentScope;
  outletName?: string;
  module: AuditModuleName;
  category: AuditActionCategory;
  action: string;
  referenceId?: string;
  description: string;
  severity: AuditSeverity;
  changes?: AuditChangeItem[];
  metadata?: Record<string, string | number>;
}

