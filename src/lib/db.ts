import { openDB } from 'idb';
import type { IDBPDatabase } from 'idb';
import type { Company, ActivityLog, CompanyFilters, CompanyStatus } from './types';

const DB_NAME = 'dealflow-db';
const DB_VERSION = 3;

let dbPromise: Promise<IDBPDatabase> | null = null;

export function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('companies')) {
          const cs = db.createObjectStore('companies', { keyPath: 'id' });
          cs.createIndex('company_name', 'company_name', { unique: false });
          cs.createIndex('status', 'status', { unique: false });
          cs.createIndex('industry', 'industry', { unique: false });
          cs.createIndex('geography', 'geography', { unique: false });
          cs.createIndex('source', 'source', { unique: false });
        }
        if (!db.objectStoreNames.contains('activity_log')) {
          const al = db.createObjectStore('activity_log', { keyPath: 'id' });
          al.createIndex('timestamp', 'timestamp', { unique: false });
          al.createIndex('entity_id', 'entity_id', { unique: false });
        }
      },
    });
  }
  return dbPromise;
}

export async function getTotalCompanyCount(): Promise<number> {
  const db = await getDB();
  return db.count('companies');
}

export type SortField = 'company_name' | 'geography' | 'industry' | 'year_incorporated' | 'nace' | 'employees' | 'revenue' | 'profit_before_tax' | 'total_assets' | 'equity' | 'status' | 'qualification_score' | 'description' | 'director_name' | 'director_title' | 'website';
export type SortDir = 'asc' | 'desc';

export async function getCompaniesPage(
  page: number,
  pageSize: number,
  filters: CompanyFilters,
  sortField: SortField = 'company_name',
  sortDir: SortDir = 'asc'
): Promise<{ companies: Company[]; total: number }> {
  const db = await getDB();
  const tx = db.transaction('companies', 'readonly');
  const store = tx.objectStore('companies');

  // Step 1: Collect ALL matching companies (filter pass)
  const matched: Company[] = [];
  let cursor = await store.openCursor();
  const searchLower = filters.search?.toLowerCase() || '';
  const revMin = filters.revenueMin ? parseFloat(filters.revenueMin) : null;
  const revMax = filters.revenueMax ? parseFloat(filters.revenueMax) : null;
  const empMin = filters.employeesMin ? parseFloat(filters.employeesMin) : null;
  const empMax = filters.employeesMax ? parseFloat(filters.employeesMax) : null;

  while (cursor) {
    const c = cursor.value as Company;
    let match = true;

    if (searchLower && !(
      c.company_name?.toLowerCase().includes(searchLower) ||
      c.industry?.toLowerCase().includes(searchLower) ||
      c.nace?.toLowerCase().includes(searchLower) ||
      c.description?.toLowerCase().includes(searchLower) ||
      c.geography?.toLowerCase().includes(searchLower) ||
      c.director_name?.toLowerCase().includes(searchLower)
    )) match = false;

    if (match && filters.industry && c.industry !== filters.industry) match = false;
    if (match && filters.geography && c.geography !== filters.geography) match = false;
    if (match && filters.status && c.status !== filters.status) match = false;
    if (match && filters.source && c.source !== filters.source) match = false;
    if (match && filters.qualificationStatus && c.qualification_status !== filters.qualificationStatus) match = false;
    if (match && revMin !== null && (c.revenue || 0) < revMin) match = false;
    if (match && revMax !== null && (c.revenue || 0) > revMax) match = false;
    if (match && empMin !== null && (c.employees || 0) < empMin) match = false;
    if (match && empMax !== null && (c.employees || 0) > empMax) match = false;
    if (match && filters.tags?.length > 0 && !filters.tags.some(t => c.tags?.includes(t))) match = false;

    if (match) matched.push(c);
    cursor = await cursor.continue();
  }

  // Step 2: Sort ALL matched results
  const numericFields = new Set(['employees', 'revenue', 'profit_before_tax', 'total_assets', 'equity', 'qualification_score']);
  matched.sort((a, b) => {
    const aRaw = (a as unknown as Record<string, unknown>)[sortField];
    const bRaw = (b as unknown as Record<string, unknown>)[sortField];

    if (numericFields.has(sortField)) {
      const aNum = typeof aRaw === 'number' ? aRaw : parseFloat(String(aRaw || '0')) || 0;
      const bNum = typeof bRaw === 'number' ? bRaw : parseFloat(String(bRaw || '0')) || 0;
      return sortDir === 'asc' ? aNum - bNum : bNum - aNum;
    }

    const aStr = String(aRaw ?? '').toLowerCase();
    const bStr = String(bRaw ?? '').toLowerCase();
    // Push empty strings to the end
    if (!aStr && bStr) return 1;
    if (aStr && !bStr) return -1;
    return sortDir === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
  });

  // Step 3: Paginate from sorted results
  const total = matched.length;
  const skip = (page - 1) * pageSize;
  const companies = matched.slice(skip, skip + pageSize);

  return { companies, total };
}

export async function getCompanyById(id: string): Promise<Company | undefined> {
  const db = await getDB();
  return db.get('companies', id);
}

export async function updateCompany(company: Partial<Company> & { id: string }): Promise<void> {
  const db = await getDB();
  const existing = await db.get('companies', company.id);
  if (existing) {
    await db.put('companies', { ...existing, ...company, updated_at: new Date().toISOString() });
  }
}

export async function deleteCompanies(ids: string[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('companies', 'readwrite');
  for (const id of ids) {
    await tx.store.delete(id);
  }
  await tx.done;
}

export async function bulkInsertCompanies(
  companies: Company[],
  onProgress?: (done: number) => void
): Promise<number> {
  const db = await getDB();
  const chunkSize = 5000;
  let inserted = 0;

  for (let i = 0; i < companies.length; i += chunkSize) {
    const chunk = companies.slice(i, i + chunkSize);
    const tx = db.transaction('companies', 'readwrite');
    for (const c of chunk) {
      await tx.store.put(c);
    }
    await tx.done;
    inserted += chunk.length;
    onProgress?.(inserted);
  }

  return inserted;
}

export async function getUniqueValues(field: keyof Company): Promise<string[]> {
  const db = await getDB();
  const tx = db.transaction('companies', 'readonly');
  const store = tx.objectStore('companies');
  const values = new Set<string>();
  let cursor = await store.openCursor();
  while (cursor) {
    const val = cursor.value[field];
    if (val && typeof val === 'string' && val.trim()) {
      values.add(val.trim());
    }
    cursor = await cursor.continue();
  }
  return Array.from(values).sort();
}

export async function getStatusCounts(): Promise<Record<string, number>> {
  const db = await getDB();
  const tx = db.transaction('companies', 'readonly');
  const store = tx.objectStore('companies');
  const counts: Record<string, number> = {};
  let cursor = await store.openCursor();
  while (cursor) {
    const status = (cursor.value as Company).status || 'new';
    counts[status] = (counts[status] || 0) + 1;
    cursor = await cursor.continue();
  }
  return counts;
}

export async function getCompaniesByIds(ids: string[]): Promise<Company[]> {
  const db = await getDB();
  const results: Company[] = [];
  for (const id of ids) {
    const c = await db.get('companies', id);
    if (c) results.push(c);
  }
  return results;
}

export async function getCompaniesByClientId(clientId: string, page = 1, pageSize = 100): Promise<{ companies: Company[]; total: number }> {
  const db = await getDB();
  const tx = db.transaction('companies', 'readonly');
  const store = tx.objectStore('companies');
  const results: Company[] = [];
  let total = 0;
  const skip = (page - 1) * pageSize;
  let cursor = await store.openCursor();
  while (cursor) {
    const c = cursor.value as Company;
    if (c.client_ids?.includes(clientId)) {
      total++;
      if (total > skip && results.length < pageSize) {
        results.push(c);
      }
    }
    cursor = await cursor.continue();
  }
  return { companies: results, total };
}

export async function assignCompaniesToClient(companyIds: string[], clientId: string): Promise<number> {
  const db = await getDB();
  let count = 0;
  const chunkSize = 1000;
  for (let i = 0; i < companyIds.length; i += chunkSize) {
    const chunk = companyIds.slice(i, i + chunkSize);
    const tx = db.transaction('companies', 'readwrite');
    for (const id of chunk) {
      const c = await tx.store.get(id);
      if (c) {
        const clientIds = c.client_ids || [];
        if (!clientIds.includes(clientId)) {
          clientIds.push(clientId);
          await tx.store.put({ ...c, client_ids: clientIds, updated_at: new Date().toISOString() });
          count++;
        }
      }
    }
    await tx.done;
  }
  return count;
}

export async function removeCompanyFromClient(companyId: string, clientId: string): Promise<void> {
  const db = await getDB();
  const c = await db.get('companies', companyId);
  if (c) {
    c.client_ids = (c.client_ids || []).filter((id: string) => id !== clientId);
    await db.put('companies', c);
  }
}

// Activity log
export async function addActivity(activity: Omit<ActivityLog, 'id' | 'timestamp'>): Promise<void> {
  const db = await getDB();
  await db.put('activity_log', {
    ...activity,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
  });
}

export async function getRecentActivity(limit = 15): Promise<ActivityLog[]> {
  const db = await getDB();
  const tx = db.transaction('activity_log', 'readonly');
  const index = tx.objectStore('activity_log').index('timestamp');
  const results: ActivityLog[] = [];
  let cursor = await index.openCursor(null, 'prev');
  while (cursor && results.length < limit) {
    results.push(cursor.value as ActivityLog);
    cursor = await cursor.continue();
  }
  return results;
}

export async function getActivityByEntity(entityId: string): Promise<ActivityLog[]> {
  const db = await getDB();
  const tx = db.transaction('activity_log', 'readonly');
  const index = tx.objectStore('activity_log').index('entity_id');
  return (await index.getAll(entityId)) as ActivityLog[];
}

export async function clearAllCompanies(): Promise<void> {
  const db = await getDB();
  await db.clear('companies');
}

export async function getAllCompaniesForExport(): Promise<Company[]> {
  const db = await getDB();
  return db.getAll('companies') as Promise<Company[]>;
}

export async function bulkUpdateStatus(ids: string[], status: CompanyStatus): Promise<void> {
  const db = await getDB();
  const chunkSize = 1000;
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const tx = db.transaction('companies', 'readwrite');
    for (const id of chunk) {
      const c = await tx.store.get(id);
      if (c) {
        await tx.store.put({ ...c, status, updated_at: new Date().toISOString() });
      }
    }
    await tx.done;
  }
}

export async function bulkAddTags(ids: string[], newTags: string[]): Promise<void> {
  const db = await getDB();
  const chunkSize = 1000;
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const tx = db.transaction('companies', 'readwrite');
    for (const id of chunk) {
      const c = await tx.store.get(id);
      if (c) {
        const existingTags: string[] = c.tags || [];
        const merged = [...new Set([...existingTags, ...newTags])];
        await tx.store.put({ ...c, tags: merged, updated_at: new Date().toISOString() });
      }
    }
    await tx.done;
  }
}

export async function getIndustryDistribution(): Promise<{ name: string; count: number }[]> {
  const db = await getDB();
  const tx = db.transaction('companies', 'readonly');
  const store = tx.objectStore('companies');
  const dist: Record<string, number> = {};
  let cursor = await store.openCursor();
  while (cursor) {
    const ind = (cursor.value as Company).industry || 'Unknown';
    dist[ind] = (dist[ind] || 0) + 1;
    cursor = await cursor.continue();
  }
  return Object.entries(dist)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);
}

export async function getGeographyDistribution(): Promise<{ name: string; count: number }[]> {
  const db = await getDB();
  const tx = db.transaction('companies', 'readonly');
  const store = tx.objectStore('companies');
  const dist: Record<string, number> = {};
  let cursor = await store.openCursor();
  while (cursor) {
    const geo = (cursor.value as Company).geography || 'Unknown';
    dist[geo] = (dist[geo] || 0) + 1;
    cursor = await cursor.continue();
  }
  return Object.entries(dist)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);
}

export async function getRevenueDistribution(): Promise<{ range: string; count: number }[]> {
  const db = await getDB();
  const tx = db.transaction('companies', 'readonly');
  const store = tx.objectStore('companies');
  const ranges = [
    { label: '<$1M', min: 0, max: 1_000_000 },
    { label: '$1M-$10M', min: 1_000_000, max: 10_000_000 },
    { label: '$10M-$50M', min: 10_000_000, max: 50_000_000 },
    { label: '$50M-$100M', min: 50_000_000, max: 100_000_000 },
    { label: '$100M-$500M', min: 100_000_000, max: 500_000_000 },
    { label: '$500M+', min: 500_000_000, max: Infinity },
  ];
  const counts = new Array(ranges.length).fill(0);
  let cursor = await store.openCursor();
  while (cursor) {
    const rev = (cursor.value as Company).revenue || 0;
    for (let i = 0; i < ranges.length; i++) {
      if (rev >= ranges[i].min && rev < ranges[i].max) {
        counts[i]++;
        break;
      }
    }
    cursor = await cursor.continue();
  }
  return ranges.map((r, i) => ({ range: r.label, count: counts[i] }));
}

/**
 * Stream companies by client ID in batches, calling onBatch for each chunk.
 * Returns total count when done.
 */
export async function streamCompaniesByClientId(
  clientId: string,
  batchSize: number,
  onBatch: (companies: Company[], sent: number, total: number) => void,
  onProgress?: (scanned: number) => void
): Promise<number> {
  const db = await getDB();
  const tx = db.transaction('companies', 'readonly');
  const store = tx.objectStore('companies');
  const batch: Company[] = [];
  let total = 0;
  let sent = 0;
  let scanned = 0;
  let cursor = await store.openCursor();
  while (cursor) {
    scanned++;
    if (onProgress && scanned % 5000 === 0) onProgress(scanned);
    const c = cursor.value as Company;
    if (c.client_ids?.includes(clientId)) {
      total++;
      batch.push(c);
      if (batch.length >= batchSize) {
        sent += batch.length;
        onBatch([...batch], sent, total);
        batch.length = 0;
      }
    }
    cursor = await cursor.continue();
  }
  if (batch.length > 0) {
    sent += batch.length;
    onBatch([...batch], sent, total);
  }
  return total;
}
