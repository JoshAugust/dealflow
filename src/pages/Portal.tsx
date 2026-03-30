import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Download, Search, KeyRound, Building2, Copy, Check, Eye, EyeOff,
  TrendingUp, Users, BarChart3, Clock, ChevronUp, ChevronDown,
  FileJson, FileSpreadsheet, FileText, Filter, X,
} from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { getCompaniesByClientId, streamCompaniesByClientId } from '../lib/db';
import { formatCurrency, formatNumber, formatDate, formatRelativeTime } from '../lib/format';
import type { Company, CompanyStatus } from '../lib/types';
import { STATUS_LABELS, STATUS_COLORS } from '../lib/types';
import PortalNav from '../components/PortalNav';
import CompanyModal from '../components/CompanyModal';
import * as XLSX from 'xlsx';

type PortalTab = 'dashboard' | 'companies' | 'export' | 'api';
type SortDir = 'asc' | 'desc';

export default function Portal() {
  const [searchParams] = useSearchParams();
  const apiKey = searchParams.get('key') || '';
  const exportTarget = searchParams.get('export') || '';
  const syncMode = searchParams.get('mode') === 'sync';
  const { clients } = useAppStore();
  const [keyInput, setKeyInput] = useState(apiKey);
  const [client, setClient] = useState<typeof clients[0] | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [total, setTotal] = useState(0);
  const [authenticated, setAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState<PortalTab>('dashboard');

  // Companies tab state
  const [search, setSearch] = useState('');
  const [filterIndustry, setFilterIndustry] = useState('');
  const [filterGeo, setFilterGeo] = useState('');
  const [revenueMin, setRevenueMin] = useState('');
  const [revenueMax, setRevenueMax] = useState('');
  const [employeesMin, setEmployeesMin] = useState('');
  const [employeesMax, setEmployeesMax] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [sortField, setSortField] = useState<string>('company_name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [exportSent, setExportSent] = useState(false);
  const [exportError, setExportError] = useState('');

  // API tab state
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);

  // Auto-authenticate when key is in URL — retry when clients load from persist
  useEffect(() => {
    if (apiKey && !authenticated) authenticate(apiKey);
  }, [apiKey, clients]);

  // Sync mode: stream companies to client in batches
  const [syncStatus, setSyncStatus] = useState<string>('');
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncTotal, setSyncTotal] = useState(0);
  const [syncScanned, setSyncScanned] = useState(0);
  const [syncDone, setSyncDone] = useState(false);

  useEffect(() => {
    if (!syncMode || !authenticated || !client) return;
    
    // Support both window.opener (popup) and BroadcastChannel (new tab)
    const channel = new BroadcastChannel('dealflow-sync');
    
    const sendMessage = (msg: Record<string, unknown>) => {
      // Try window.opener first (popup mode)
      if (window.opener) {
        try { window.opener.postMessage(msg, '*'); } catch { /* ignore */ }
      }
      // Always also send via BroadcastChannel (works across tabs)
      try { channel.postMessage(msg); } catch { /* ignore */ }
    };
    
    let cancelled = false;
    
    (async () => {
      setSyncStatus('Scanning database...');
      
      const totalSent = await streamCompaniesByClientId(
        client.id,
        500, // batch size
        (batch, sent, found) => {
          if (cancelled) return;
          sendMessage({ 
            type: 'dealflow-batch', 
            companies: batch, 
            sent, 
            total: found,
            done: false 
          });
          setSyncProgress(sent);
          setSyncTotal(found);
          setSyncStatus(`Sent ${sent} of ${found} companies...`);
        },
        (scanned) => {
          if (cancelled) return;
          setSyncScanned(scanned);
          setSyncStatus(`Scanning... ${scanned.toLocaleString()} rows checked`);
        }
      );
      
      if (cancelled) return;
      
      // Send completion signal
      sendMessage({ 
        type: 'dealflow-batch', 
        companies: [], 
        sent: totalSent, 
        total: totalSent,
        done: true 
      });
      
      setSyncDone(true);
      setSyncStatus(`Done! Sent ${totalSent.toLocaleString()} companies.`);
      setTimeout(() => { try { channel.close(); window.close(); } catch {} }, 3000);
    })();
    
    return () => { cancelled = true; };
  }, [syncMode, authenticated, client]);

  // Legacy: non-sync export popup
  useEffect(() => {
    const shouldAutoSend = exportTarget === 'dealscope' && !syncMode && authenticated && companies.length > 0 && window.opener;
    if (shouldAutoSend) {
      const timer = setTimeout(() => {
        window.opener!.postMessage({ type: 'dealflow-companies', companies }, '*');
        setExportSent(true);
        setTimeout(() => { try { window.close(); } catch {} }, 2000);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [exportTarget, syncMode, authenticated, companies]);

  const authenticate = async (key: string) => {
    const found = clients.find((c) => c.apiKey === key);
    if (!found) {
      // Don't alert in export mode — clients may not be loaded yet
      if (exportTarget !== 'dealscope') alert('Invalid API key');
      return;
    }
    setClient(found);
    setAuthenticated(true);
    const result = await getCompaniesByClientId(found.id, 1, 100000);
    setCompanies(result.companies);
    setTotal(result.total);
  };

  // Unique filter values
  const industries = useMemo(() => [...new Set(companies.map(c => c.industry).filter(Boolean))].sort(), [companies]);
  const geographies = useMemo(() => [...new Set(companies.map(c => c.geography).filter(Boolean))].sort(), [companies]);

  // Filtered + sorted companies
  const filtered = useMemo(() => {
    let result = companies;
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(c =>
        c.company_name?.toLowerCase().includes(s) ||
        c.industry?.toLowerCase().includes(s) ||
        c.geography?.toLowerCase().includes(s) ||
        c.description?.toLowerCase().includes(s) ||
        c.director_name?.toLowerCase().includes(s)
      );
    }
    if (filterIndustry) result = result.filter(c => c.industry === filterIndustry);
    if (filterGeo) result = result.filter(c => c.geography === filterGeo);
    if (revenueMin) result = result.filter(c => (c.revenue || 0) >= parseFloat(revenueMin));
    if (revenueMax) result = result.filter(c => (c.revenue || 0) <= parseFloat(revenueMax));
    if (employeesMin) result = result.filter(c => (c.employees || 0) >= parseFloat(employeesMin));
    if (employeesMax) result = result.filter(c => (c.employees || 0) <= parseFloat(employeesMax));

    // Sort
    const numericFields = new Set(['employees', 'revenue', 'profit_before_tax', 'total_assets', 'equity']);
    result = [...result].sort((a, b) => {
      const aVal = (a as unknown as Record<string, unknown>)[sortField];
      const bVal = (b as unknown as Record<string, unknown>)[sortField];
      if (numericFields.has(sortField)) {
        const an = (typeof aVal === 'number' ? aVal : 0);
        const bn = (typeof bVal === 'number' ? bVal : 0);
        return sortDir === 'asc' ? an - bn : bn - an;
      }
      const as = String(aVal ?? '').toLowerCase();
      const bs = String(bVal ?? '').toLowerCase();
      if (!as && bs) return 1;
      if (as && !bs) return -1;
      return sortDir === 'asc' ? as.localeCompare(bs) : bs.localeCompare(as);
    });
    return result;
  }, [companies, search, filterIndustry, filterGeo, revenueMin, revenueMax, employeesMin, employeesMax, sortField, sortDir]);

  const hasFilters = search || filterIndustry || filterGeo || revenueMin || revenueMax || employeesMin || employeesMax;

  const clearFilters = () => {
    setSearch(''); setFilterIndustry(''); setFilterGeo('');
    setRevenueMin(''); setRevenueMax(''); setEmployeesMin(''); setEmployeesMax('');
  };

  const toggleSort = (field: string) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  // Stats for dashboard
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    companies.forEach(c => { counts[c.status] = (counts[c.status] || 0) + 1; });
    return counts;
  }, [companies]);

  const industryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    companies.forEach(c => { const ind = c.industry || 'Unknown'; counts[ind] = (counts[ind] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [companies]);

  // Export
  const exportData = (format: 'csv' | 'xlsx' | 'json') => {
    const data = filtered.map(c => ({
      'Company Name': c.company_name,
      'State/Country': c.geography,
      'Year Incorporated': c.year_incorporated,
      'NACE/Industry': c.industry || c.nace,
      Employees: c.employees,
      Revenue: c.revenue,
      'P/L Before Tax': c.profit_before_tax,
      'Total Assets': c.total_assets,
      Equity: c.equity,
      Website: c.website,
      Description: c.description,
      'Director Name': c.director_name,
      'Director Title': c.director_title,
    }));

    if (format === 'json') {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url;
      a.download = `dealflow-${client?.company || 'export'}.json`; a.click();
      URL.revokeObjectURL(url);
    } else {
      const ws = XLSX.utils.json_to_sheet(data);
      if (format === 'xlsx') {
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Companies');
        XLSX.writeFile(wb, `dealflow-${client?.company || 'export'}.xlsx`);
      } else {
        const csv = XLSX.utils.sheet_to_csv(ws);
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url;
        a.download = `dealflow-${client?.company || 'export'}.csv`; a.click();
        URL.revokeObjectURL(url);
      }
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const maskedKey = apiKey ? apiKey.slice(0, 8) + '•'.repeat(Math.max(0, apiKey.length - 12)) + apiKey.slice(-4) : '';

  // --- SYNC MODE: Show minimal UI while syncing ---
  if (syncMode && !authenticated) {
    return (
      <div style={{ minHeight: '100vh', background: '#F6F9FC', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, system-ui, sans-serif' }}>
        <div style={{
          width: 420, background: 'white', borderRadius: 16, padding: '48px 32px',
          border: '1px solid #E3E8EE', boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
          textAlign: 'center',
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16, margin: '0 auto 20px',
            background: 'linear-gradient(135deg, #635BFF, #A259FF)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontSize: 24, fontWeight: 800,
          }}>D</div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0A2540', margin: '0 0 8px' }}>Syncing companies...</h1>
          <p style={{ fontSize: 14, color: '#596880' }}>Authenticating and loading companies...</p>
          <div style={{ marginTop: 24 }}>
            <div style={{ width: 32, height: 32, border: '3px solid #E3E8EE', borderTopColor: '#635BFF', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }} />
          </div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  if (syncMode && authenticated) {
    const progressPct = syncTotal > 0 ? Math.round((syncProgress / syncTotal) * 100) : 0;
    return (
      <div style={{ minHeight: '100vh', background: '#F6F9FC', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, system-ui, sans-serif' }}>
        <div style={{
          width: 480, background: 'white', borderRadius: 16, padding: '48px 32px',
          border: '1px solid #E3E8EE', boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>{syncDone ? '✅' : '🔄'}</div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0A2540', margin: '0 0 8px' }}>
            {syncDone ? 'Sync Complete!' : 'Syncing Companies'}
          </h1>
          <p style={{ fontSize: 14, color: '#596880', margin: '0 0 20px' }}>
            {syncStatus}
          </p>
          
          {/* Progress bar */}
          <div style={{ 
            width: '100%', height: 12, background: '#E3E8EE', borderRadius: 6, 
            overflow: 'hidden', margin: '0 0 12px' 
          }}>
            <div style={{ 
              width: syncDone ? '100%' : syncTotal > 0 ? `${progressPct}%` : '0%',
              height: '100%', 
              background: syncDone ? '#059669' : 'linear-gradient(90deg, #635BFF, #A259FF)',
              borderRadius: 6,
              transition: 'width 0.3s ease',
            }} />
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#596880' }}>
            <span>{syncProgress.toLocaleString()} sent</span>
            <span>{syncTotal > 0 ? `${syncTotal.toLocaleString()} found` : `${syncScanned.toLocaleString()} scanned`}</span>
          </div>
          
          {syncDone && (
            <p style={{ fontSize: 13, color: '#059669', marginTop: 16, fontWeight: 600 }}>
              {syncTotal.toLocaleString()} companies synced successfully. This window will close automatically.
            </p>
          )}
          
          {!syncDone && (
            <div style={{ marginTop: 20 }}>
              <div style={{ width: 24, height: 24, border: '3px solid #E3E8EE', borderTopColor: '#635BFF', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }} />
            </div>
          )}
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  // --- AUTH SCREEN ---
  if (!authenticated) {
    return (
      <div style={{ minHeight: '100vh', background: '#F6F9FC', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, system-ui, sans-serif' }}>
        <div style={{
          width: 420, background: 'white', borderRadius: 16, padding: 0,
          border: '1px solid #E3E8EE', boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
          overflow: 'hidden',
        }}>
          <div style={{ height: 4, background: 'linear-gradient(90deg, #635BFF 0%, #A259FF 50%, #635BFF 100%)' }} />
          <div style={{ padding: '40px 32px', textAlign: 'center' }}>
            <div style={{
              width: 56, height: 56, borderRadius: 16, margin: '0 auto 20px',
              background: 'linear-gradient(135deg, #635BFF, #A259FF)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontSize: 24, fontWeight: 800,
            }}>D</div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0A2540', margin: 0 }}>DealFlow Client Portal</h1>
            <p style={{ fontSize: 14, color: '#596880', marginTop: 8 }}>Enter your API key to access your companies</p>
            <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <KeyRound size={16} style={{ color: '#596880', flexShrink: 0 }} />
                <input
                  className="input-field"
                  style={{ flex: 1 }}
                  placeholder="Paste your API key..."
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && authenticate(keyInput)}
                />
              </div>
              <button className="btn-primary" style={{ width: '100%' }} onClick={() => authenticate(keyInput)}>
                Access Portal
              </button>
            </div>
            <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 20 }}>Powered by DealFlow</p>
          </div>
        </div>
      </div>
    );
  }

  // --- DASHBOARD TAB ---
  const renderDashboard = () => (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: '#0A2540', margin: 0 }}>
          Welcome, {client?.name} 👋
        </h1>
        <p style={{ fontSize: 14, color: '#596880', marginTop: 4 }}>
          Here's an overview of your shared companies from {client?.company || 'DealFlow'}
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
        {[
          { label: 'Total Companies', value: total.toLocaleString(), icon: Building2, color: '#635BFF' },
          { label: 'Industries', value: industries.length.toString(), icon: BarChart3, color: '#A259FF' },
          { label: 'Geographies', value: geographies.length.toString(), icon: TrendingUp, color: '#0EA5E9' },
          { label: 'With Contacts', value: companies.filter(c => c.director_name || (c.contacts && c.contacts.length > 0)).length.toString(), icon: Users, color: '#10B981' },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} style={{
              background: 'white', borderRadius: 12, padding: '20px 20px',
              border: '1px solid #E3E8EE', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ fontSize: 12, color: '#596880', margin: 0, fontWeight: 500 }}>{stat.label}</p>
                  <p style={{ fontSize: 28, fontWeight: 800, color: '#0A2540', margin: '4px 0 0', letterSpacing: '-0.02em' }}>{stat.value}</p>
                </div>
                <div style={{
                  width: 44, height: 44, borderRadius: 12,
                  background: stat.color + '10', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon size={22} color={stat.color} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* By Status */}
        <div style={{
          background: 'white', borderRadius: 12, padding: 24,
          border: '1px solid #E3E8EE', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: '#0A2540', margin: '0 0 16px' }}>By Status</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {Object.entries(statusCounts).sort((a, b) => b[1] - a[1]).map(([status, count]) => (
              <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className={`badge ${STATUS_COLORS[status as CompanyStatus] || 'badge-gray'}`} style={{ fontSize: 11, minWidth: 80, textAlign: 'center' }}>
                  {STATUS_LABELS[status as CompanyStatus] || status}
                </span>
                <div style={{ flex: 1, height: 8, background: '#F6F9FC', borderRadius: 4 }}>
                  <div style={{
                    width: `${(count / total) * 100}%`, height: '100%',
                    background: '#635BFF', borderRadius: 4, minWidth: 4,
                  }} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#0A2540', minWidth: 30, textAlign: 'right' }}>{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* By Industry */}
        <div style={{
          background: 'white', borderRadius: 12, padding: 24,
          border: '1px solid #E3E8EE', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: '#0A2540', margin: '0 0 16px' }}>Top Industries</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {industryCounts.map(([industry, count]) => (
              <div key={industry} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 13, color: '#0A2540', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{industry}</span>
                <div style={{ width: 120, height: 8, background: '#F6F9FC', borderRadius: 4, flexShrink: 0 }}>
                  <div style={{
                    width: `${(count / (industryCounts[0]?.[1] || 1)) * 100}%`, height: '100%',
                    background: '#A259FF', borderRadius: 4, minWidth: 4,
                  }} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#0A2540', minWidth: 30, textAlign: 'right' }}>{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div style={{
        background: 'white', borderRadius: 12, padding: 24, marginTop: 24,
        border: '1px solid #E3E8EE', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: '#0A2540', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Clock size={16} /> Recently Shared
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {companies.slice(0, 5).map(c => (
            <div key={c.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 14px', background: '#F6F9FC', borderRadius: 8,
            }}>
              <div>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#0A2540' }}>{c.company_name}</span>
                <span style={{ fontSize: 12, color: '#596880', marginLeft: 12 }}>{c.industry || '—'}</span>
              </div>
              <span style={{ fontSize: 12, color: '#596880' }}>{c.updated_at ? formatRelativeTime(c.updated_at) : '—'}</span>
            </div>
          ))}
          {companies.length === 0 && (
            <p style={{ fontSize: 13, color: '#596880', textAlign: 'center', padding: 20 }}>No companies shared yet</p>
          )}
        </div>
      </div>
    </div>
  );

  // --- COMPANIES TAB ---
  const companyColumns = [
    { key: 'company_name', label: 'Company Name', align: 'left' as const, width: 200 },
    { key: 'geography', label: 'St / Country', align: 'left' as const, width: 90 },
    { key: 'year_incorporated', label: 'Year Inc.', align: 'center' as const, width: 80 },
    { key: 'industry', label: 'NACE / Industry', align: 'left' as const, width: 130 },
    { key: 'employees', label: 'Employees', align: 'right' as const, width: 90 },
    { key: 'revenue', label: 'Revenue', align: 'right' as const, width: 110 },
    { key: 'profit_before_tax', label: 'P/L', align: 'right' as const, width: 100 },
    { key: 'total_assets', label: 'Assets', align: 'right' as const, width: 100 },
    { key: 'equity', label: 'Equity', align: 'right' as const, width: 100 },
    { key: 'website', label: 'Website', align: 'left' as const, width: 150 },
    { key: 'director_name', label: 'Director', align: 'left' as const, width: 140 },
    { key: 'director_title', label: 'Title', align: 'left' as const, width: 110 },
  ];

  const renderCellValue = (c: Company, key: string) => {
    switch (key) {
      case 'company_name': return <span style={{ fontWeight: 600, color: '#0A2540' }}>{c.company_name}</span>;
      case 'employees': return formatNumber(c.employees);
      case 'revenue': return formatCurrency(c.revenue);
      case 'profit_before_tax': return formatCurrency(c.profit_before_tax);
      case 'total_assets': return formatCurrency(c.total_assets);
      case 'equity': return formatCurrency(c.equity);
      case 'website': return c.website ? (
        <a href={c.website.startsWith('http') ? c.website : `https://${c.website}`} target="_blank" rel="noreferrer"
          style={{ color: '#635BFF', textDecoration: 'none', fontSize: 12 }}
          onClick={(e) => e.stopPropagation()}>
          {c.website.replace(/^https?:\/\/(www\.)?/, '').slice(0, 30)}
        </a>
      ) : '—';
      default: return (c as unknown as Record<string, unknown>)[key] as string || '—';
    }
  };

  const renderCompanies = () => (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px' }}>
      {/* Search & Filters */}
      <div style={{
        background: 'white', border: '1px solid #E3E8EE', borderRadius: 12,
        padding: 16, marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#596880' }} />
            <input className="input-field" style={{ paddingLeft: 36 }}
              placeholder="Search companies..." value={search}
              onChange={(e) => setSearch(e.target.value)} />
          </div>
          <button className="btn-secondary" onClick={() => setShowFilters(!showFilters)}>
            <Filter size={16} /> {showFilters ? 'Hide' : 'Filters'}
          </button>
          {hasFilters && (
            <button onClick={clearFilters} style={{ fontSize: 12, color: '#E25950', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
              <X size={14} /> Clear
            </button>
          )}
        </div>
        {showFilters && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginTop: 12 }}>
            <select className="input-field" value={filterIndustry} onChange={(e) => setFilterIndustry(e.target.value)}>
              <option value="">All Industries</option>
              {industries.map(i => <option key={i} value={i}>{i}</option>)}
            </select>
            <select className="input-field" value={filterGeo} onChange={(e) => setFilterGeo(e.target.value)}>
              <option value="">All Geographies</option>
              {geographies.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
            <input className="input-field" type="number" placeholder="Min Revenue ($)" value={revenueMin} onChange={(e) => setRevenueMin(e.target.value)} />
            <input className="input-field" type="number" placeholder="Max Revenue ($)" value={revenueMax} onChange={(e) => setRevenueMax(e.target.value)} />
            <input className="input-field" type="number" placeholder="Min Employees" value={employeesMin} onChange={(e) => setEmployeesMin(e.target.value)} />
            <input className="input-field" type="number" placeholder="Max Employees" value={employeesMax} onChange={(e) => setEmployeesMax(e.target.value)} />
          </div>
        )}
      </div>

      <p style={{ fontSize: 13, color: '#596880', marginBottom: 10 }}>
        Showing {filtered.length.toLocaleString()} of {total.toLocaleString()} companies
      </p>

      {/* Table */}
      <div style={{
        background: 'white', border: '1px solid #E3E8EE', borderRadius: 12,
        overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1300 }}>
            <thead>
              <tr>
                {companyColumns.map(col => (
                  <th key={col.key} onClick={() => toggleSort(col.key)} style={{
                    width: col.width, padding: '10px 12px', fontSize: 11, fontWeight: 700,
                    color: sortField === col.key ? '#635BFF' : '#596880',
                    textTransform: 'uppercase', letterSpacing: '0.05em',
                    textAlign: col.align, cursor: 'pointer', userSelect: 'none',
                    whiteSpace: 'nowrap', background: '#FAFBFC',
                    borderBottom: sortField === col.key ? '2px solid #635BFF' : '2px solid #E3E8EE',
                  }}>
                    {col.label}
                    {sortField === col.key ? (
                      sortDir === 'asc' ? <ChevronUp size={13} style={{ marginLeft: 4, display: 'inline', verticalAlign: 'middle' }} /> : <ChevronDown size={13} style={{ marginLeft: 4, display: 'inline', verticalAlign: 'middle' }} />
                    ) : <span style={{ marginLeft: 4, color: '#D1D5DB', fontSize: 10 }}>↕</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={companyColumns.length} style={{ padding: 48, textAlign: 'center', color: '#596880' }}>No companies found</td></tr>
              ) : filtered.slice(0, 500).map((c, i) => (
                <tr key={c.id}
                  onClick={() => setSelectedCompany(c)}
                  style={{
                    cursor: 'pointer',
                    background: i % 2 === 0 ? '#FFFFFF' : '#FAFBFC',
                    transition: 'background 0.1s',
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.background = '#F0EEFF')}
                  onMouseOut={(e) => (e.currentTarget.style.background = i % 2 === 0 ? '#FFFFFF' : '#FAFBFC')}
                >
                  {companyColumns.map(col => (
                    <td key={col.key} style={{
                      padding: '10px 12px', fontSize: 13, color: '#425466',
                      textAlign: col.align, overflow: 'hidden', textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap', borderBottom: '1px solid #F0F2F5',
                      maxWidth: col.width,
                    }}>
                      {renderCellValue(c, col.key)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length > 500 && (
          <div style={{ padding: 12, textAlign: 'center', fontSize: 13, color: '#596880', borderTop: '1px solid #E3E8EE' }}>
            Showing first 500 of {filtered.length} results. Use Export to download all data.
          </div>
        )}
      </div>
    </div>
  );

  // --- EXPORT TAB ---
  const renderExport = () => (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 24px' }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: '#0A2540', margin: '0 0 8px' }}>Export Data</h2>
      <p style={{ fontSize: 14, color: '#596880', margin: '0 0 24px' }}>
        Download your company data in multiple formats. {hasFilters ? `Current filters applied (${filtered.length} companies).` : `All ${total} companies.`}
      </p>

      {hasFilters && (
        <div style={{
          background: '#F0EEFF', borderRadius: 10, padding: '12px 16px',
          marginBottom: 24, fontSize: 13, color: '#635BFF', fontWeight: 500,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span>🔍 Filters active — exporting {filtered.length} of {total} companies</span>
          <button onClick={clearFilters} style={{
            fontSize: 12, color: '#635BFF', background: 'white', border: '1px solid #635BFF',
            borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontWeight: 600,
          }}>Clear Filters</button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {[
          { format: 'csv' as const, label: 'CSV', desc: 'Comma-separated values. Opens in Excel, Google Sheets, etc.', icon: FileText, color: '#10B981' },
          { format: 'xlsx' as const, label: 'Excel (XLSX)', desc: 'Native Excel format with formatted columns.', icon: FileSpreadsheet, color: '#635BFF' },
          { format: 'json' as const, label: 'JSON', desc: 'Structured data format for developers and APIs.', icon: FileJson, color: '#F59E0B' },
        ].map(({ format, label, desc, icon: Icon, color }) => (
          <div key={format} style={{
            background: 'white', borderRadius: 12, padding: 24,
            border: '1px solid #E3E8EE', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            textAlign: 'center', gap: 12,
          }}>
            <div style={{
              width: 52, height: 52, borderRadius: 14, background: color + '10',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon size={24} color={color} />
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0A2540', margin: 0 }}>{label}</h3>
            <p style={{ fontSize: 13, color: '#596880', margin: 0, lineHeight: 1.5 }}>{desc}</p>
            <button className="btn-primary" style={{ width: '100%', marginTop: 8 }} onClick={() => exportData(format)}>
              <Download size={16} /> Download {label}
            </button>
          </div>
        ))}
      </div>

      {/* Quick Export */}
      <div style={{
        marginTop: 32, background: 'linear-gradient(135deg, #F0EEFF 0%, #EDE9FF 100%)',
        borderRadius: 14, padding: 24, border: '1px solid #D4D0FF',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0A2540', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
              🔗 Export for Client App
            </h3>
            <p style={{ fontSize: 13, color: '#596880', margin: 0 }}>
              Download a JSON file for import into your client application. Includes all {companies.length.toLocaleString()} shared companies.
            </p>
          </div>
          <button
            onClick={() => {
              const blob = new Blob([JSON.stringify({ companies, exportedAt: new Date().toISOString(), source: 'dealflow', clientName: client?.name }, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `dealflow-export-${companies.length}.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            style={{
              background: '#635BFF', color: 'white', fontWeight: 700, fontSize: 14,
              padding: '12px 28px', borderRadius: 10, border: 'none', cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(99,91,255,0.3)', whiteSpace: 'nowrap',
            }}
          >
            📤 Export for Client App
          </button>
        </div>
      </div>
    </div>
  );

  // --- API TAB ---
  const portalUrl = typeof window !== 'undefined' ? `${window.location.origin}/portal?key=${apiKey}` : '';
  const renderApi = () => (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 24px' }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: '#0A2540', margin: '0 0 8px' }}>API Access</h2>
      <p style={{ fontSize: 14, color: '#596880', margin: '0 0 32px' }}>
        Use your API key to programmatically access your company data.
      </p>

      {/* API Key card */}
      <div style={{
        background: 'white', borderRadius: 12, padding: 24, marginBottom: 24,
        border: '1px solid #E3E8EE', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: '#0A2540', margin: '0 0 14px' }}>Your API Key</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <code style={{
            flex: 1, background: '#F6F9FC', borderRadius: 8, padding: '12px 16px',
            fontSize: 14, fontFamily: 'monospace', color: '#0A2540',
            border: '1px solid #E3E8EE', letterSpacing: showKey ? 0 : '0.1em',
          }}>
            {showKey ? apiKey : maskedKey}
          </code>
          <button className="btn-secondary" onClick={() => setShowKey(!showKey)} style={{ padding: '10px 12px' }}>
            {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
          <button className="btn-primary" onClick={() => copyToClipboard(apiKey)} style={{ padding: '10px 14px' }}>
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      {/* Code examples */}
      <div style={{
        background: 'white', borderRadius: 12, padding: 24, marginBottom: 24,
        border: '1px solid #E3E8EE', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: '#0A2540', margin: '0 0 16px' }}>Code Examples</h3>

        {[
          {
            label: 'cURL',
            code: `curl "${portalUrl}"`,
          },
          {
            label: 'Python',
            code: `import requests\n\nresponse = requests.get(\n    "${portalUrl}"\n)\ncompanies = response.json()`,
          },
          {
            label: 'JavaScript',
            code: `const response = await fetch(\n  "${portalUrl}"\n);\nconst companies = await response.json();`,
          },
        ].map(({ label, code }) => (
          <div key={label} style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#596880', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
              <button onClick={() => copyToClipboard(code)} style={{
                fontSize: 11, color: '#635BFF', background: 'none', border: 'none',
                cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4,
              }}>
                <Copy size={12} /> Copy
              </button>
            </div>
            <pre style={{
              background: '#1A1A2E', color: '#E2E8F0', borderRadius: 8,
              padding: '14px 16px', fontSize: 13, fontFamily: 'monospace',
              overflow: 'auto', lineHeight: 1.6, margin: 0,
            }}>
              {code}
            </pre>
          </div>
        ))}
      </div>

      {/* Rate limits */}
      <div style={{
        background: 'white', borderRadius: 12, padding: 24,
        border: '1px solid #E3E8EE', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: '#0A2540', margin: '0 0 14px' }}>Rate Limits</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 13 }}>
          <div style={{ background: '#F6F9FC', borderRadius: 8, padding: '12px 16px' }}>
            <p style={{ color: '#596880', margin: 0, fontSize: 12 }}>Requests per minute</p>
            <p style={{ color: '#0A2540', fontWeight: 700, fontSize: 18, margin: '4px 0 0' }}>60</p>
          </div>
          <div style={{ background: '#F6F9FC', borderRadius: 8, padding: '12px 16px' }}>
            <p style={{ color: '#596880', margin: 0, fontSize: 12 }}>Requests per day</p>
            <p style={{ color: '#0A2540', fontWeight: 700, fontSize: 18, margin: '4px 0 0' }}>10,000</p>
          </div>
        </div>
      </div>
    </div>
  );

  const handleSendToClient = () => {
    try {
      if (window.opener) {
        window.opener.postMessage({ type: 'dealflow-companies', companies }, '*');
        setExportSent(true);
        setTimeout(() => { try { window.close(); } catch {} }, 1500);
      } else {
        // Fallback: download as JSON file
        const blob = new Blob([JSON.stringify(companies, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `dealflow-export-${companies.length}-companies.json`;
        a.click();
        URL.revokeObjectURL(url);
        setExportSent(true);
      }
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Export failed');
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#F6F9FC', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <PortalNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        clientName={client?.name || ''}
        clientCompany={client?.company || ''}
      />

      {/* Client sync banner */}
      {(exportTarget === 'dealscope' || syncMode) && (
        <div style={{
          background: exportSent ? 'linear-gradient(90deg, #059669, #34d399)' : 'linear-gradient(90deg, #635BFF, #a78bfa)', 
          padding: '14px 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>{exportSent ? '✅' : '🔗'}</span>
            <div>
              <p style={{ color: 'white', fontWeight: 700, fontSize: 14, margin: 0 }}>
                {exportSent 
                  ? `${companies.length.toLocaleString()} companies sent! You can close this window.`
                  : 'A client app is requesting your company data'}
              </p>
              {!exportSent && (
                <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, margin: 0 }}>
                  {companies.length.toLocaleString()} companies shared with this client. Click the button to send.
                </p>
              )}
              {exportError && (
                <p style={{ color: '#FFD700', fontSize: 12, margin: 0 }}>{exportError}</p>
              )}
            </div>
          </div>
          {!exportSent && (
            <button
              onClick={handleSendToClient}
              style={{
                background: 'white', color: '#635BFF', fontWeight: 700, fontSize: 14,
                padding: '10px 24px', borderRadius: 8, border: 'none', cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              }}
            >
              📤 Send {companies.length.toLocaleString()} Companies
            </button>
          )}
        </div>
      )}

      {activeTab === 'dashboard' && renderDashboard()}
      {activeTab === 'companies' && renderCompanies()}
      {activeTab === 'export' && renderExport()}
      {activeTab === 'api' && renderApi()}

      {/* Company detail modal */}
      {selectedCompany && (
        <CompanyModal company={selectedCompany} onClose={() => setSelectedCompany(null)} />
      )}
    </div>
  );
}
