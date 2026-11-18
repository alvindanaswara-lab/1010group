import type { InboundReceivingRecord } from '../types';
import { roundMoney, roundQuantity } from './inventoryUtils';

export type ReceiptEntry = { lineId: string; qtyReceived: number; unitPrice: number };
type Item = InboundReceivingRecord['items'][number];

export const receiptLineId = (item: Item, index: number) => item.lineId ?? String(index);

export function calculateReceipt(record: InboundReceivingRecord, entries: ReceiptEntry[]) {
  const received = new Map(entries.map((entry) => [entry.lineId, entry]));
  if (received.size !== entries.length) throw new Error('Baris penerimaan duplikat.');
  const movements: { sku: string; quantity: number; unitPrice: number }[] = [];
  const items = record.items.map((item, index) => {
    const lineId = receiptLineId(item, index);
    const entry = received.get(lineId);
    received.delete(lineId);
    if (!entry || entry.qtyReceived === 0) return { ...item, lineId };
    const quantity = roundQuantity(entry.qtyReceived);
    if (!Number.isFinite(quantity) || quantity <= 0 ||
        quantity > roundQuantity(item.orderedQty - item.receivedQty) ||
        !Number.isFinite(entry.unitPrice) || entry.unitPrice < 0) {
      throw new Error('Periksa kuantitas dan harga penerimaan untuk ' + item.itemName + '.');
    }
    const receivedQty = roundQuantity(item.receivedQty + quantity);
    movements.push({ sku: item.sku, quantity, unitPrice: entry.unitPrice });
    return {
      ...item, lineId, receivedQty,
      pendingQty: roundQuantity(item.orderedQty - receivedQty),
      totalPrice: roundMoney((item.receivedQty > 0 ? item.totalPrice : 0) + roundMoney(quantity * entry.unitPrice)),
    };
  });
  if (received.size || !movements.length) throw new Error('Isi minimal satu kuantitas penerimaan yang valid.');
  return { items, movements };
}
