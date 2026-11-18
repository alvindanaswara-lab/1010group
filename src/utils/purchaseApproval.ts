import type { PurchaseOrder } from '../types';

export function purchaseTerms(po: PurchaseOrder): string {
  return JSON.stringify(po.items.map((i) => [
    i.sku, i.place, i.qty, i.price, i.unit, i.vendorName ?? '',
    i.paymentMethod ?? '', i.paymentTerm ?? '', i.outletBreakdowns ?? [],
  ]));
}

export function canApprovePO(po: PurchaseOrder): boolean {
  return po.status === 'Review Cost Control' && po.items.length > 0 && po.items.every((i) =>
    i.approvalStatus === 'Approved' && i.status !== 'Rejected' &&
    !!i.vendorName?.trim() && Number.isFinite(i.qty) && i.qty > 0 &&
    Number.isFinite(i.price) && i.price >= 0,
  );
}

export function canReleasePO(po: PurchaseOrder): boolean {
  return po.status === 'Approved by Cost Control' && po.costControlApproval?.status === 'Approved' &&
    po.costControlApproval.terms === purchaseTerms(po) &&
    canApprovePO({ ...po, status: 'Review Cost Control' });
}

export function revisePO(previous: PurchaseOrder, next: PurchaseOrder): PurchaseOrder {
  if (purchaseTerms(previous) === purchaseTerms(next)) return next;
  if (['Submitted to Vendor', 'Approved by Vendor', 'Sent to Receiving', 'Completed'].includes(previous.status)) {
    return previous;
  }
  return {
    ...next,
    status: ['Review Cost Control', 'Approved by Cost Control', 'Rejected by Cost Control'].includes(previous.status)
      ? 'Vendor Summary' : next.status,
    costControlApproval: undefined,
    items: next.items.map((i) => ({ ...i, approvalStatus: 'Pending' })),
  };
}
