import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Filter, Upload, ChevronLeft, ChevronRight, Trash2, Tag, Share2, ExternalLink, Eye, MoreHorizontal, ChevronUp, ChevronDown, Sparkles, ShieldCheck, GripVertical, X, Users } from 'lucide-react';
import { getCompaniesPage, getUniqueValues, deleteCompanies, bulkUpdateStatus, bulkAddTags, assignCompaniesToClient, addActivity, updateCompany, getTotalCompanyCount, type SortField, type SortDir } from '../lib/db';
import { formatCurrency, formatNumber } from '../lib/format';
import { useAppStore } from '../store/appStore';
import type { Company, CompanyFilters, CompanyStatus } from '../lib/types';
import { STATUS_LABELS, STATUS_COLORS } from '../lib/types';
import { enrichCompany } from '../lib/aiService';
import { enrichWithApollo } from '../lib/apolloService';
import { qualifyCompany, getScoreLabel } from '../lib/qualificationService';
import Modal from '../components/Modal';

const PAGE_SIZE = 100;

// SortField and SortDir imported from db.ts

interface ColumnDef {
  key: SortField;
  label: string;
  align?: 'left' | 'right' | 'center';
  minWidth: number;
  defaultWidth: number;
  render: (c: Company) => React.ReactNode;
}

export default function Companies() {
  const navigate = useNavigate();
  const { clients, settings, getIntegrationByName, updateIntegration } = useAppStore();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [industries, setIndustries] = useState<string[]>([]);
  const [geographies, setGeographies] = useState<string[]>([]);
  const [sources, setSources] = useState<string[]>([]);
  const [sortField, setSortField] = useState<SortField>('company_name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [enrichProgress, setEnrichProgress] = useState<string | null>(null);
  const [apolloProgress, setApolloProgress] = useState<string | null>(null);
  const [qualifyProgress, setQualifyProgress] = useState<string | null>(null);
  const [filters, setFilters] = useState<CompanyFilters>({
    search: '', industry: '', geography: '', revenueMin: '', revenueMax: '',
    employeesMin: '', employeesMax: '', status: '', tags: [], source: '',
  });

  // Bulk action modals
  const [bulkStatusModal, setBulkStatusModal] = useState(false);
  const [bulkTagModal, setBulkTagModal] = useState(false);
  const [bulkShareModal, setBulkShareModal] = useState(false);
  const [batchMoveModal, setBatchMoveModal] = useState(false);
  const [bulkTagInput, setBulkTagInput] = useState('');
  const [bulkStatusValue, setBulkStatusValue] = useState<CompanyStatus>('reviewed');
  const [bulkClientId, setBulkClientId] = useState('');
  
  // Batch move criteria
  const [batchField, setBatchField] = useState<string>('industry');
  const [batchOperator, setBatchOperator] = useState<string>('equals');
  const [batchValue, setBatchValue] = useState('');
  const [batchTargetClient, setBatchTargetClient] = useState('');
  const [batchPreviewCount, setBatchPreviewCount] = useState<number | null>(null);
  const [batchMoving, setBatchMoving] = useState(false);

  // Column widths (resizable)
  const [colWidths, setColWidths] = useState<Record<string, number>>({});
  const resizingCol = useRef<string | null>(null);
  const resizeStartX = useRef(0);
  const resizeStartW = useRef(0);

  const columns: ColumnDef[] = useMemo(() => [
    { key: 'company_name', label: 'Company Name', align: 'left', minWidth: 140, defaultWidth: 200, render: (c) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Link to={`/companies/${c.id}`} style={{ fontWeight: 600, color: '#0A2540', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          onMouseOver={(e) => (e.currentTarget.style.color = '#635BFF')}
          onMouseOut={(e) => (e.currentTarget.style.color = '#0A2540')}>
          {c.company_name}
        </Link>
        {c.website && (
          <a href={c.website.startsWith('http') ? c.website : `https://${c.website}`} target="_blank" rel="noreferrer"
            style={{ color: '#596880', flexShrink: 0 }}
            onMouseOver={(e) => (e.currentTarget.style.color = '#635BFF')}
            onMouseOut={(e) => (e.currentTarget.style.color = '#596880')}>
            <ExternalLink size={12} />
          </a>
        )}
      </div>
    )},
    { key: 'geography', label: 'St / Country', align: 'left', minWidth: 60, defaultWidth: 90, render: (c) => c.geography || '—' },
    { key: 'year_incorporated', label: 'Year Inc.', align: 'center', minWidth: 60, defaultWidth: 80, render: (c) => c.year_incorporated || '—' },
    { key: 'industry', label: 'NACE / Industry', align: 'left', minWidth: 80, defaultWidth: 120, render: (c) => c.industry || c.nace || '—' },
    { key: 'employees', label: 'Employees', align: 'right', minWidth: 70, defaultWidth: 90, render: (c) => formatNumber(c.employees) },
    { key: 'revenue', label: 'Revenue (USD)', align: 'right', minWidth: 90, defaultWidth: 120, render: (c) => formatCurrency(c.revenue) },
    { key: 'profit_before_tax', label: 'P/L Before Tax', align: 'right', minWidth: 90, defaultWidth: 110, render: (c) => formatCurrency(c.profit_before_tax) },
    { key: 'total_assets', label: 'Total Assets', align: 'right', minWidth: 80, defaultWidth: 110, render: (c) => formatCurrency(c.total_assets) },
    { key: 'equity', label: 'Equity (USD)', align: 'right', minWidth: 80, defaultWidth: 100, render: (c) => formatCurrency(c.equity) },
    { key: 'description', label: 'Description', align: 'left', minWidth: 100, defaultWidth: 200, render: (c) => (
      <span title={c.description || ''} style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {c.description || '—'}
      </span>
    )},
    { key: 'director_name', label: 'Director', align: 'left', minWidth: 80, defaultWidth: 140, render: (c) => c.director_name || '—' },
    { key: 'director_title', label: 'Title', align: 'left', minWidth: 70, defaultWidth: 110, render: (c) => c.director_title || '—' },
    { key: 'qualification_score', label: 'Quality', align: 'center', minWidth: 60, defaultWidth: 75, render: (c) => {
      if (c.qualification_score == null) return '—';
      const { emoji } = getScoreLabel(c.qualification_score);
      return <span style={{ fontWeight: 600 }}>{emoji} {c.qualification_score}</span>;
    }},
  ], []);

  const getWidth = (col: ColumnDef) => colWidths[col.key] || col.defaultWidth;

  // Resize handlers
  const onResizeStart = (colKey: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizingCol.current = colKey;
    resizeStartX.current = e.clientX;
    resizeStartW.current = colWidths[colKey] || columns.find(c => c.key === colKey)!.defaultWidth;
    document.addEventListener('mousemove', onResizeMove);
    document.addEventListener('mouseup', onResizeEnd);
  };

  const onResizeMove = (e: MouseEvent) => {
    if (!resizingCol.current) return;
    const col = columns.find(c => c.key === resizingCol.current)!;
    const delta = e.clientX - resizeStartX.current;
    const newW = Math.max(col.minWidth, resizeStartW.current + delta);
    setColWidths(prev => ({ ...prev, [resizingCol.current!]: newW }));
  };

  const onResizeEnd = () => {
    resizingCol.current = null;
    document.removeEventListener('mousemove', onResizeMove);
    document.removeEventListener('mouseup', onResizeEnd);
  };

  const loadCompanies = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getCompaniesPage(page, PAGE_SIZE, filters, sortField, sortDir);
      setCompanies(result.companies);
      setTotal(result.total);
    } finally {
      setLoading(false);
    }
  }, [page, filters, sortField, sortDir]);

  useEffect(() => { loadCompanies(); }, [loadCompanies]);

  useEffect(() => {
    getUniqueValues('industry').then(setIndustries);
    getUniqueValues('geography').then(setGeographies);
    getUniqueValues('source').then(setSources);
  }, []);

  // Sort happens at DB level — companies are already sorted
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const allSelected = companies.length > 0 && companies.every((c) => selected.has(c.id));

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
    setPage(1); // Reset to page 1 when sort changes
  };

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(companies.map((c) => c.id)));
  };

  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const handleSearch = (search: string) => { setFilters((f) => ({ ...f, search })); setPage(1); };
  const handleFilter = (key: keyof CompanyFilters, value: string) => { setFilters((f) => ({ ...f, [key]: value })); setPage(1); };
  const clearFilters = () => { setFilters({ search: '', industry: '', geography: '', revenueMin: '', revenueMax: '', employeesMin: '', employeesMax: '', status: '', tags: [], source: '' }); setPage(1); };

  const hasActiveFilters = filters.search || filters.industry || filters.geography || filters.status || filters.source || filters.revenueMin || filters.revenueMax || filters.employeesMin || filters.employeesMax;

  // Bulk actions
  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selected.size} companies?`)) return;
    await deleteCompanies(Array.from(selected));
    await addActivity({ type: 'delete', description: `Deleted ${selected.size} companies`, entity_id: '', entity_type: 'company' });
    setSelected(new Set()); loadCompanies();
  };

  const handleBulkStatus = async () => {
    await bulkUpdateStatus(Array.from(selected), bulkStatusValue);
    await addActivity({ type: 'status_change', description: `Changed ${selected.size} companies to ${STATUS_LABELS[bulkStatusValue]}`, entity_id: '', entity_type: 'company' });
    setBulkStatusModal(false); setSelected(new Set()); loadCompanies();
  };

  const handleBulkTag = async () => {
    const tags = bulkTagInput.split(',').map((t) => t.trim()).filter(Boolean);
    if (tags.length === 0) return;
    await bulkAddTags(Array.from(selected), tags);
    await addActivity({ type: 'tag', description: `Tagged ${selected.size} companies with ${tags.join(', ')}`, entity_id: '', entity_type: 'company' });
    setBulkTagModal(false); setBulkTagInput(''); setSelected(new Set()); loadCompanies();
  };

  const handleBulkShare = async () => {
    if (!bulkClientId) return;
    const count = await assignCompaniesToClient(Array.from(selected), bulkClientId);
    const client = clients.find((c) => c.id === bulkClientId);
    await addActivity({ type: 'share', description: `Shared ${count} companies with ${client?.name || 'client'}`, entity_id: bulkClientId, entity_type: 'client' });
    setBulkShareModal(false); setBulkClientId(''); setSelected(new Set()); loadCompanies();
  };

  const handleBulkEnrich = async () => {
    if (!settings.aiApiKey) { alert('Configure your AI API key in Settings first.'); return; }
    const ids = Array.from(selected);
    const toEnrich = companies.filter((c) => ids.includes(c.id));
    for (let i = 0; i < toEnrich.length; i++) {
      setEnrichProgress(`Enriching ${i + 1}/${toEnrich.length}...`);
      try {
        const updates = await enrichCompany(toEnrich[i], { provider: settings.aiProvider as 'openai' | 'anthropic', apiKey: settings.aiApiKey, model: settings.aiModel });
        if (Object.keys(updates).length > 0) await updateCompany({ id: toEnrich[i].id, ...updates });
      } catch (err) { console.error(`Failed to enrich ${toEnrich[i].company_name}:`, err); }
      if (i < toEnrich.length - 1) await new Promise((r) => setTimeout(r, 1000));
    }
    setEnrichProgress(null); setSelected(new Set()); loadCompanies();
  };

  const handleBulkApolloEnrich = async () => {
    const apolloIntegration = getIntegrationByName('apollo');
    const apolloKey = apolloIntegration?.apiKey || settings.apolloApiKey;
    if (!apolloKey) { alert('Configure your Apollo.io API key in Integrations first.'); return; }
    const ids = Array.from(selected);
    const toEnrich = companies.filter(c => ids.includes(c.id) && c.website);
    if (toEnrich.length === 0) { alert('No selected companies have a website/domain for Apollo enrichment.'); return; }
    for (let i = 0; i < toEnrich.length; i++) {
      setApolloProgress(`Apollo enriching ${i + 1}/${toEnrich.length}...`);
      try {
        const { companyData, contacts } = await enrichWithApollo(toEnrich[i], { apiKey: apolloKey });
        const updates: Partial<Company> & { id: string } = { id: toEnrich[i].id, ...companyData };
        if (contacts.length > 0) {
          updates.contacts = [...(toEnrich[i].contacts || []), ...contacts];
          if (!toEnrich[i].director_name && contacts[0]?.name) {
            updates.director_name = contacts[0].name;
            updates.director_title = contacts[0].title;
          }
        }
        await updateCompany(updates);
      } catch (err) { console.error(`Apollo enrich failed for ${toEnrich[i].company_name}:`, err); }
      // Rate limit: 1 per 2 seconds
      if (i < toEnrich.length - 1) await new Promise(r => setTimeout(r, 2000));
    }
    if (apolloIntegration) updateIntegration(apolloIntegration.id, { lastUsed: new Date().toISOString() });
    setApolloProgress(null); setSelected(new Set()); loadCompanies();
  };

  const handleBulkQualify = async () => {
    const ids = Array.from(selected);
    const toQualify = companies.filter((c) => ids.includes(c.id));
    for (let i = 0; i < toQualify.length; i++) {
      setQualifyProgress(`Qualifying ${i + 1}/${toQualify.length}...`);
      const details = qualifyCompany(toQualify[i], settings.qualificationConfig);
      await updateCompany({ id: toQualify[i].id, qualification_score: details.overall_score, qualification_details: details });
    }
    setQualifyProgress(null); setSelected(new Set()); loadCompanies();
  };

  // Batch move by criteria
  const handleBatchPreview = async () => {
    // Count matching companies using a filtered query
    const filterMap: CompanyFilters = { search: '', industry: '', geography: '', revenueMin: '', revenueMax: '', employeesMin: '', employeesMax: '', status: '', tags: [], source: '' };
    if (batchField === 'industry') filterMap.industry = batchValue;
    else if (batchField === 'geography') filterMap.geography = batchValue;
    else if (batchField === 'status') filterMap.status = batchValue;
    else if (batchField === 'revenue_min') filterMap.revenueMin = batchValue;
    else if (batchField === 'revenue_max') filterMap.revenueMax = batchValue;
    else if (batchField === 'employees_min') filterMap.employeesMin = batchValue;
    else if (batchField === 'employees_max') filterMap.employeesMax = batchValue;
    else if (batchField === 'nace') filterMap.search = batchValue;
    else filterMap.search = batchValue;

    const result = await getCompaniesPage(1, 1, filterMap);
    setBatchPreviewCount(result.total);
  };

  const handleBatchMove = async () => {
    if (!batchTargetClient || !batchValue) return;
    setBatchMoving(true);

    const filterMap: CompanyFilters = { search: '', industry: '', geography: '', revenueMin: '', revenueMax: '', employeesMin: '', employeesMax: '', status: '', tags: [], source: '' };
    if (batchField === 'industry') filterMap.industry = batchValue;
    else if (batchField === 'geography') filterMap.geography = batchValue;
    else if (batchField === 'status') filterMap.status = batchValue;
    else if (batchField === 'revenue_min') filterMap.revenueMin = batchValue;
    else if (batchField === 'revenue_max') filterMap.revenueMax = batchValue;
    else if (batchField === 'employees_min') filterMap.employeesMin = batchValue;
    else if (batchField === 'employees_max') filterMap.employeesMax = batchValue;
    else if (batchField === 'nace') filterMap.search = batchValue;
    else filterMap.search = batchValue;

    // Get all matching companies (up to 10K at a time)
    let allIds: string[] = [];
    let pg = 1;
    while (true) {
      const result = await getCompaniesPage(pg, 5000, filterMap);
      allIds.push(...result.companies.map(c => c.id));
      if (allIds.length >= result.total) break;
      pg++;
    }

    if (allIds.length > 0) {
      const count = await assignCompaniesToClient(allIds, batchTargetClient);
      const client = clients.find(c => c.id === batchTargetClient);
      await addActivity({ type: 'share', description: `Batch assigned ${count} companies to ${client?.name || 'client'} (by ${batchField}: ${batchValue})`, entity_id: batchTargetClient, entity_type: 'client' });
    }

    setBatchMoving(false);
    setBatchMoveModal(false);
    setBatchValue('');
    setBatchPreviewCount(null);
    loadCompanies();
  };

  // Styles
  const thStyle = (col: ColumnDef): React.CSSProperties => ({
    width: getWidth(col),
    minWidth: col.minWidth,
    padding: '10px 12px',
    fontSize: 11,
    fontWeight: 700,
    color: sortField === col.key ? '#635BFF' : '#596880',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    textAlign: col.align || 'left',
    cursor: 'pointer',
    userSelect: 'none',
    whiteSpace: 'nowrap',
    position: 'relative',
    borderBottom: sortField === col.key ? '2px solid #635BFF' : '2px solid transparent',
    transition: 'color 0.15s',
    background: '#FAFBFC',
  });

  const tdStyle = (col: ColumnDef): React.CSSProperties => ({
    width: getWidth(col),
    minWidth: col.minWidth,
    maxWidth: getWidth(col),
    padding: '10px 12px',
    fontSize: 13,
    color: '#425466',
    textAlign: col.align || 'left',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    borderBottom: '1px solid #F0F2F5',
  });

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#0A2540', letterSpacing: '-0.02em', margin: 0 }}>Company Database</h1>
          <p style={{ fontSize: 13, color: '#596880', marginTop: 2 }}>{total.toLocaleString()} companies</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-secondary" onClick={() => setBatchMoveModal(true)}>
            <Users size={16} /> Batch Assign
          </button>
          <Link to="/upload" className="btn-primary" style={{ textDecoration: 'none' }}>
            <Upload size={16} /> Upload
          </Link>
        </div>
      </div>

      {/* Search & Filters */}
      <div style={{ background: 'white', border: '1px solid #E3E8EE', borderRadius: 12, padding: 16, marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#596880' }} />
            <input
              className="input-field"
              style={{ paddingLeft: 36 }}
              placeholder="Search by name, industry, NACE, description, director..."
              value={filters.search}
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>
          <button className="btn-secondary" onClick={() => setShowFilters(!showFilters)} style={{ flexShrink: 0 }}>
            <Filter size={16} /> {showFilters ? 'Hide' : 'Filters'}
          </button>
          {hasActiveFilters && (
            <button onClick={clearFilters} style={{ fontSize: 12, color: '#E25950', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
              <X size={14} /> Clear all
            </button>
          )}
        </div>

        {showFilters && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginTop: 12 }}>
            <select className="input-field" value={filters.industry} onChange={(e) => handleFilter('industry', e.target.value)}>
              <option value="">All Industries</option>
              {industries.map((i) => <option key={i} value={i}>{i}</option>)}
            </select>
            <select className="input-field" value={filters.geography} onChange={(e) => handleFilter('geography', e.target.value)}>
              <option value="">All Geographies</option>
              {geographies.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
            <select className="input-field" value={filters.status} onChange={(e) => handleFilter('status', e.target.value)}>
              <option value="">All Statuses</option>
              {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select className="input-field" value={filters.source} onChange={(e) => handleFilter('source', e.target.value)}>
              <option value="">All Sources</option>
              {sources.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <input className="input-field" type="number" placeholder="Min Revenue ($)" value={filters.revenueMin} onChange={(e) => handleFilter('revenueMin', e.target.value)} />
            <input className="input-field" type="number" placeholder="Max Revenue ($)" value={filters.revenueMax} onChange={(e) => handleFilter('revenueMax', e.target.value)} />
            <input className="input-field" type="number" placeholder="Min Employees" value={filters.employeesMin} onChange={(e) => handleFilter('employeesMin', e.target.value)} />
            <input className="input-field" type="number" placeholder="Max Employees" value={filters.employeesMax} onChange={(e) => handleFilter('employeesMax', e.target.value)} />
          </div>
        )}
      </div>

      {/* Bulk Actions Bar */}
      {selected.size > 0 && (
        <div style={{
          background: '#F0EEFF', border: '1px solid rgba(99,91,255,0.3)', borderRadius: 10,
          padding: '10px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#635BFF' }}>{selected.size} selected</span>
          <div style={{ width: 1, height: 20, background: 'rgba(99,91,255,0.2)' }} />
          <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => setBulkTagModal(true)}><Tag size={14} /> Tag</button>
          <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => setBulkStatusModal(true)}><MoreHorizontal size={14} /> Status</button>
          <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => setBulkShareModal(true)}><Share2 size={14} /> Share with Client</button>
          <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }} onClick={handleBulkEnrich} disabled={!!enrichProgress}>
            <Sparkles size={14} /> {enrichProgress || 'Enrich with AI'}
          </button>
          <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }} onClick={handleBulkApolloEnrich} disabled={!!apolloProgress}>
            🚀 {apolloProgress || 'Enrich with Apollo'}
          </button>
          <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }} onClick={handleBulkQualify} disabled={!!qualifyProgress}>
            <ShieldCheck size={14} /> {qualifyProgress || 'Qualify'}
          </button>
          <button className="btn-danger" style={{ padding: '6px 12px', fontSize: 12 }} onClick={handleBulkDelete}><Trash2 size={14} /> Delete</button>
        </div>
      )}

      {/* Table */}
      <div style={{ background: 'white', border: '1px solid #E3E8EE', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: columns.reduce((s, c) => s + getWidth(c), 0) + 120 }}>
            <thead>
              <tr>
                <th style={{ width: 44, padding: '10px 12px', background: '#FAFBFC', borderBottom: '2px solid #E3E8EE' }}>
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} style={{ accentColor: '#635BFF' }} />
                </th>
                {columns.map((col) => (
                  <th key={col.key} style={thStyle(col)} onClick={() => toggleSort(col.key)}>
                    <span>{col.label}</span>
                    {sortField === col.key ? (
                      sortDir === 'asc' ? <ChevronUp size={13} style={{ marginLeft: 4, display: 'inline', verticalAlign: 'middle' }} /> : <ChevronDown size={13} style={{ marginLeft: 4, display: 'inline', verticalAlign: 'middle' }} />
                    ) : (
                      <span style={{ marginLeft: 4, color: '#D1D5DB', fontSize: 10 }}>↕</span>
                    )}
                    {/* Resize handle */}
                    <div
                      onMouseDown={(e) => onResizeStart(col.key, e)}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        position: 'absolute', right: 0, top: 0, bottom: 0, width: 6,
                        cursor: 'col-resize', background: 'transparent',
                      }}
                      onMouseOver={(e) => (e.currentTarget.style.background = '#635BFF33')}
                      onMouseOut={(e) => (e.currentTarget.style.background = 'transparent')}
                    />
                  </th>
                ))}
                <th style={{ width: 80, padding: '10px 12px', fontSize: 11, fontWeight: 700, color: '#596880', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center', background: '#FAFBFC', borderBottom: '2px solid #E3E8EE' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={columns.length + 2} style={{ padding: 48, textAlign: 'center', color: '#596880' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 24, height: 24, border: '3px solid #E3E8EE', borderTopColor: '#635BFF', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                      Loading companies...
                    </div>
                  </td>
                </tr>
              ) : companies.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + 2} style={{ padding: 48, textAlign: 'center', color: '#596880' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                      <Search size={24} color="#D1D5DB" />
                      <p style={{ fontSize: 14, margin: 0 }}>No companies found</p>
                      <p style={{ fontSize: 12, margin: 0, color: '#9CA3AF' }}>Try adjusting your filters or upload more data</p>
                    </div>
                  </td>
                </tr>
              ) : companies.map((c, i) => (
                <tr
                  key={c.id}
                  onClick={() => navigate(`/companies/${c.id}`)}
                  style={{
                    cursor: 'pointer',
                    background: selected.has(c.id) ? '#F0EEFF' : i % 2 === 0 ? '#FFFFFF' : '#FAFBFC',
                    transition: 'background 0.1s',
                  }}
                  onMouseOver={(e) => { if (!selected.has(c.id)) e.currentTarget.style.background = '#F6F9FC'; }}
                  onMouseOut={(e) => { e.currentTarget.style.background = selected.has(c.id) ? '#F0EEFF' : i % 2 === 0 ? '#FFFFFF' : '#FAFBFC'; }}
                >
                  <td style={{ width: 44, padding: '10px 12px', borderBottom: '1px solid #F0F2F5' }} onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleOne(c.id)} style={{ accentColor: '#635BFF' }} />
                  </td>
                  {columns.map((col) => (
                    <td key={col.key} style={tdStyle(col)}>
                      {col.render(c)}
                    </td>
                  ))}
                  <td style={{ width: 80, padding: '10px 12px', textAlign: 'center', borderBottom: '1px solid #F0F2F5' }}>
                    <span className={`badge ${STATUS_COLORS[c.status] || 'badge-gray'}`} style={{ fontSize: 11 }}>
                      {STATUS_LABELS[c.status] || c.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 16px', borderTop: '1px solid #E3E8EE', background: '#FAFBFC',
          }}>
            <span style={{ fontSize: 13, color: '#596880' }}>
              Page <strong>{page}</strong> of {totalPages} · {total.toLocaleString()} companies
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-secondary" style={{ padding: '6px 14px', fontSize: 12 }} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft size={14} /> Prev
              </button>
              <button className="btn-secondary" style={{ padding: '6px 14px', fontSize: 12 }} disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bulk Status Modal */}
      <Modal open={bulkStatusModal} onClose={() => setBulkStatusModal(false)} title="Change Status">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <select className="input-field" value={bulkStatusValue} onChange={(e) => setBulkStatusValue(e.target.value as CompanyStatus)}>
            {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <button className="btn-primary" style={{ width: '100%' }} onClick={handleBulkStatus}>Apply to {selected.size} companies</button>
        </div>
      </Modal>

      {/* Bulk Tag Modal */}
      <Modal open={bulkTagModal} onClose={() => setBulkTagModal(false)} title="Add Tags">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <input className="input-field" placeholder="Tags (comma separated)" value={bulkTagInput} onChange={(e) => setBulkTagInput(e.target.value)} />
          <button className="btn-primary" style={{ width: '100%' }} onClick={handleBulkTag}>Add Tags to {selected.size} companies</button>
        </div>
      </Modal>

      {/* Bulk Share Modal */}
      <Modal open={bulkShareModal} onClose={() => setBulkShareModal(false)} title="Share with Client">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <select className="input-field" value={bulkClientId} onChange={(e) => setBulkClientId(e.target.value)}>
            <option value="">Select client...</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.company})</option>)}
          </select>
          <button className="btn-primary" style={{ width: '100%' }} onClick={handleBulkShare} disabled={!bulkClientId}>Share {selected.size} companies</button>
        </div>
      </Modal>

      {/* Batch Move by Criteria Modal */}
      <Modal open={batchMoveModal} onClose={() => { setBatchMoveModal(false); setBatchPreviewCount(null); setBatchValue(''); }} title="Batch Assign to Client">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ fontSize: 13, color: '#596880', margin: 0 }}>
            Assign companies matching specific criteria to a client — by NACE code, revenue range, geography, industry, or any field.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#596880', marginBottom: 4, display: 'block' }}>Match by</label>
              <select className="input-field" value={batchField} onChange={(e) => { setBatchField(e.target.value); setBatchPreviewCount(null); }}>
                <option value="industry">Industry / NACE</option>
                <option value="geography">State / Country</option>
                <option value="status">Status</option>
                <option value="revenue_min">Revenue above ($)</option>
                <option value="revenue_max">Revenue below ($)</option>
                <option value="employees_min">Employees above</option>
                <option value="employees_max">Employees below</option>
                <option value="nace">NACE code (search)</option>
                <option value="search">Name / keyword</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#596880', marginBottom: 4, display: 'block' }}>Value</label>
              {batchField === 'industry' ? (
                <select className="input-field" value={batchValue} onChange={(e) => { setBatchValue(e.target.value); setBatchPreviewCount(null); }}>
                  <option value="">Select...</option>
                  {industries.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
              ) : batchField === 'geography' ? (
                <select className="input-field" value={batchValue} onChange={(e) => { setBatchValue(e.target.value); setBatchPreviewCount(null); }}>
                  <option value="">Select...</option>
                  {geographies.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              ) : batchField === 'status' ? (
                <select className="input-field" value={batchValue} onChange={(e) => { setBatchValue(e.target.value); setBatchPreviewCount(null); }}>
                  <option value="">Select...</option>
                  {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              ) : (
                <input className="input-field" placeholder={batchField.includes('revenue') || batchField.includes('employee') ? 'Enter number...' : 'Enter value...'} value={batchValue} onChange={(e) => { setBatchValue(e.target.value); setBatchPreviewCount(null); }} />
              )}
            </div>
          </div>

          {batchValue && (
            <button className="btn-secondary" style={{ alignSelf: 'flex-start' }} onClick={handleBatchPreview}>
              Preview matches
            </button>
          )}

          {batchPreviewCount !== null && (
            <div style={{ background: '#F0EEFF', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#635BFF', fontWeight: 600 }}>
              {batchPreviewCount.toLocaleString()} companies match this criteria
            </div>
          )}

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#596880', marginBottom: 4, display: 'block' }}>Assign to Client</label>
            <select className="input-field" value={batchTargetClient} onChange={(e) => setBatchTargetClient(e.target.value)}>
              <option value="">Select client...</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.company})</option>)}
            </select>
          </div>

          <button
            className="btn-primary"
            style={{ width: '100%' }}
            onClick={handleBatchMove}
            disabled={!batchTargetClient || !batchValue || batchMoving}
          >
            {batchMoving ? 'Assigning...' : `Assign${batchPreviewCount !== null ? ` ${batchPreviewCount.toLocaleString()}` : ''} companies to client`}
          </button>
        </div>
      </Modal>

      {/* Spinner animation */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
