import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import type { Company, Director } from './types';

const HEADER_MAP: Record<string, keyof Company> = {
  'company name': 'company_name',
  'company': 'company_name',
  'name': 'company_name',
  'st': 'geography',
  'state': 'geography',
  'geography': 'geography',
  'country': 'geography',
  'year incorp.': 'year_incorporated',
  'year incorporated': 'year_incorporated',
  'year incorp': 'year_incorporated',
  'nace': 'nace',
  'industry': 'industry',
  'sector': 'industry',
  'employees': 'employees',
  'employee count': 'employees',
  'revenue': 'revenue',
  'revenue (usd)': 'revenue',
  'revenue (gbp)': 'revenue',
  'revenue ($)': 'revenue',
  'turnover': 'revenue',
  'p/l before tax': 'profit_before_tax',
  'p/l before tax (usd)': 'profit_before_tax',
  'profit before tax': 'profit_before_tax',
  'pbt': 'profit_before_tax',
  'total assets': 'total_assets',
  'total assets (usd)': 'total_assets',
  'assets': 'total_assets',
  'equity': 'equity',
  'equity (usd)': 'equity',
  'website': 'website',
  'url': 'website',
  'description': 'description',
  'company description': 'description',
  'address': 'address',
  'director name': 'director_name',
  'director': 'director_name',
  'director title': 'director_title',
  'title': 'director_title',
};

function findHeaderRow(rows: unknown[][]): number {
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const row = rows[i];
    if (!row) continue;
    const hasCompanyName = row.some(
      (cell) => typeof cell === 'string' && cell.toLowerCase().includes('company name')
    );
    if (hasCompanyName) return i;
  }
  return 0;
}

function mapHeaders(headerRow: unknown[]): Map<number, keyof Company> {
  const map = new Map<number, keyof Company>();
  for (let i = 0; i < headerRow.length; i++) {
    const h = String(headerRow[i] || '').trim().toLowerCase();
    if (HEADER_MAP[h]) {
      map.set(i, HEADER_MAP[h]);
    }
  }
  return map;
}

function parseNum(val: unknown): number {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const s = String(val).replace(/[,$£€\s]/g, '');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

const KNOWN_COMPANY_FIELDS = new Set([
  'company_name', 'geography', 'industry', 'nace', 'employees', 'revenue',
  'profit_before_tax', 'total_assets', 'equity', 'website', 'description',
  'address', 'director_name', 'director_title', 'year_incorporated',
]);

function rowToCompany(row: unknown[], colMap: Map<number, keyof Company>, source: string): Company | null {
  const obj: Record<string, unknown> = {};
  for (const [idx, field] of colMap) {
    obj[field as string] = row[idx];
  }
  const name = String(obj.company_name || '').trim();
  if (!name) return null;

  const dirName = String(obj.director_name || '').trim();
  const dirTitle = String(obj.director_title || '').trim();
  const directors: Director[] = [];
  if (dirName) directors.push({ name: dirName, title: dirTitle });

  const base: Company = {
    id: crypto.randomUUID(),
    company_name: name,
    geography: String(obj.geography || '').trim(),
    industry: String(obj.industry || obj.nace || '').trim(),
    nace: String(obj.nace || '').trim(),
    employees: parseNum(obj.employees),
    revenue: parseNum(obj.revenue),
    profit_before_tax: parseNum(obj.profit_before_tax),
    total_assets: parseNum(obj.total_assets),
    equity: parseNum(obj.equity),
    website: String(obj.website || '').trim(),
    description: String(obj.description || '').trim(),
    address: String(obj.address || '').trim(),
    director_name: dirName,
    director_title: dirTitle,
    year_incorporated: String(obj.year_incorporated || '').trim(),
    tags: [],
    notes: '',
    status: 'new',
    score: 0,
    source,
    client_ids: [],
    directors,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // Attach any custom fields (keys not in the standard field set)
  for (const [key, val] of Object.entries(obj)) {
    if (!KNOWN_COMPANY_FIELDS.has(key) && val != null && String(val).trim() !== '') {
      base[key] = String(val).trim();
    }
  }

  return base;
}

/** Extract director info from a continuation row (no company name) */
function rowToDirector(row: unknown[], colMap: Map<number, keyof Company>): Director | null {
  const dirNameIdx = [...colMap.entries()].find(([, f]) => f === 'director_name')?.[0];
  const dirTitleIdx = [...colMap.entries()].find(([, f]) => f === 'director_title')?.[0];
  const name = dirNameIdx != null ? String(row[dirNameIdx] || '').trim() : '';
  const title = dirTitleIdx != null ? String(row[dirTitleIdx] || '').trim() : '';
  if (!name) return null;
  return { name, title };
}

export interface ParseResult {
  headers: string[];
  mappedHeaders: Map<number, keyof Company>;
  previewRows: unknown[][];
  allDataRows: unknown[][];
  totalRows: number;
}

export function parseFile(file: File, source: string): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) throw new Error('No data');

        let rows: unknown[][];
        if (file.name.endsWith('.csv')) {
          const result = Papa.parse(data as string, { header: false, skipEmptyLines: true });
          rows = result.data as unknown[][];
        } else {
          const wb = XLSX.read(data, { type: 'array' });
          const sheet = wb.Sheets[wb.SheetNames[0]];
          rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][];
        }

        const headerIdx = findHeaderRow(rows);
        const headerRow = rows[headerIdx] || [];
        const headers = headerRow.map((h) => String(h || '').trim());
        const colMap = mapHeaders(headerRow);
        const dataRows = rows.slice(headerIdx + 1).filter((r) => r.some((c) => c !== '' && c != null));

        resolve({
          headers,
          mappedHeaders: colMap,
          previewRows: dataRows.slice(0, 5),
          allDataRows: dataRows,
          totalRows: dataRows.length,
        });
      } catch (err) {
        reject(err);
      }
    };
    if (file.name.endsWith('.csv')) {
      reader.readAsText(file);
    } else {
      reader.readAsArrayBuffer(file);
    }
  });
}

export function convertRowsToCompanies(
  rows: unknown[][],
  colMap: Map<number, keyof Company>,
  source: string,
  defaultTags: string[] = [],
  defaultStatus: string = 'new'
): Company[] {
  const companies: Company[] = [];
  let currentCompany: Company | null = null;

  // Find the column index for company_name to detect continuation rows
  const nameColIdx = [...colMap.entries()].find(([, f]) => f === 'company_name')?.[0];

  for (const row of rows) {
    const hasCompanyName = nameColIdx != null && row[nameColIdx] != null && String(row[nameColIdx]).trim() !== '';

    if (hasCompanyName) {
      // New company row — save previous company if exists
      if (currentCompany) companies.push(currentCompany);

      const c = rowToCompany(row, colMap, source);
      if (c) {
        c.tags = [...defaultTags];
        c.status = defaultStatus as Company['status'];
        currentCompany = c;
      } else {
        currentCompany = null;
      }
    } else if (currentCompany) {
      // Continuation row — extract additional director
      const dir = rowToDirector(row, colMap);
      if (dir) {
        if (!currentCompany.directors) currentCompany.directors = [];
        currentCompany.directors.push(dir);
      }
    }
  }

  // Don't forget the last company
  if (currentCompany) companies.push(currentCompany);

  return companies;
}

export function getDetectedMappings(headers: string[]): { header: string; field: string }[] {
  return headers.map((h) => {
    const key = h.toLowerCase().trim();
    return {
      header: h,
      field: HEADER_MAP[key] || '',
    };
  });
}
