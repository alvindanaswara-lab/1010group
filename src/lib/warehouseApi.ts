import type { User } from '../types';

export interface WarehouseRecord {
  kind: string;
  id: string;
  version: number;
  data: Record<string, unknown>;
}

export interface Change {
  kind: string;
  id: string;
  version: number | null;
  data: Record<string, unknown> | null;
}

export class WarehouseError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export async function api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch('/api/' + path, {
    method, credentials: 'same-origin', cache: 'no-store',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => null);
  if (!response.ok || data === null) {
    throw new WarehouseError(data?.error ?? 'Layanan penyimpanan tidak tersedia.', response.status);
  }
  return data as T;
}

export type SessionUser = { user: User };

export const recordKey = (record: Pick<WarehouseRecord, 'kind' | 'id'>) =>
  JSON.stringify([record.kind, record.id]);

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b)).map(([key, v]) => [key, canonical(v)]));
}

export function changesBetween(
  original: WarehouseRecord[], current: Omit<WarehouseRecord, 'version'>[],
): Change[] {
  const before = new Map(original.map((r) => [recordKey(r), r]));
  const changes: Change[] = [];
  for (const record of current) {
    const key = recordKey(record);
    const old = before.get(key);
    before.delete(key);
    if (!old || JSON.stringify(canonical(old.data)) !== JSON.stringify(canonical(record.data))) {
      changes.push({ ...record, version: old?.version ?? null });
    }
  }
  for (const old of before.values()) {
    changes.push({ kind: old.kind, id: old.id, version: old.version, data: null });
  }
  return changes;
}
