import { User, UserPosition } from '../types';

export function getDefaultTabForPosition(position: UserPosition): string {
  switch (position) {
    case 'Outlet':
      return 'dashboard-outlet';
    case 'Administrator':
    case 'Storage-Mailer':
    case 'Storage Inbound':
    case 'Storage Outbond':
    case 'Purchasing':
    case 'Cost Control':
      return 'dashboard';
    default:
      return 'dashboard-outlet';
  }
}

export function getRoleDestinationLabel(position: UserPosition): string {
  switch (position) {
    case 'Administrator':
      return 'Dashboard Administrator & Kontrol Sistem';
    case 'Outlet':
      return 'Dashboard Outlet & Order Barang';
    case 'Storage-Mailer':
      return 'Dashboard Storage-Mailer & Pengiriman Outlet';
    case 'Storage Inbound':
      return 'Dashboard Storage-Inbound & Penerimaan Gudang';
    case 'Storage Outbond':
      return 'Dashboard Storage-Outbond & Distribusi Outlet';
    case 'Purchasing':
      return 'Dashboard Purchasing, PR & PO Vendor';
    case 'Cost Control':
      return 'Dashboard Cost Control & Verifikasi PO';
    default:
      return 'Dashboard Outlet';
  }
}
