// Run this file's contents in the console of the original app, on each browser holding work.
// It downloads operational records only. Reconcile exports before importing opening balances.
(() => {
  const keys = [
    'outlets_v1', 'periodic_inv_v11_empty', 'so_reports_v11_empty', 'orders_v11_empty',
    'po_v11_empty', 'vendors_v11_empty', 'rcv_v11_empty', 'man_in_v11_empty',
    'man_out_v11_empty', 'audit_logs_v11_empty',
  ];
  const records = {};
  for (const key of keys) {
    const value = localStorage.getItem('1010group_' + key);
    if (value !== null) records[key] = JSON.parse(value);
  }
  const file = new Blob([JSON.stringify(records, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(file);
  const download = document.createElement('a');
  download.href = url;
  download.download = 'warehouse-legacy-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json';
  download.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
})();
