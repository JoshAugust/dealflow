import { useEffect, useState, useRef, Component, type ReactNode } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Edit2, Save, ExternalLink, Plus, X, Star, Sparkles, ShieldCheck, Rocket, ChevronDown } from 'lucide-react';
import { getCompanyById, updateCompany, addActivity, getActivityByEntity } from '../lib/db';
import { formatCurrency, formatNumber, formatDate, formatRelativeTime } from '../lib/format';
import { useAppStore } from '../store/appStore';
import type { Company, ActivityLog, CompanyStatus, Contact, Director } from '../lib/types';
import { STATUS_LABELS, STATUS_COLORS } from '../lib/types';
import { enrichCompany } from '../lib/aiService';
import { enrichWithApollo } from '../lib/apolloService';
import { qualifyCompany, getScoreLabel } from '../lib/qualificationService';

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null; errorInfo: string }> {
  state = { error: null as Error | null, errorInfo: '' };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: { componentStack?: string }) {
    this.setState({ errorInfo: info.componentStack || '' });
    console.error('CompanyDetail crash:', error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 40, maxWidth: 700, margin: '0 auto' }}>
          <h2 style={{ color: '#E25950', fontSize: 18, fontWeight: 700 }}>⚠️ Company Detail Crashed</h2>
          <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 10, padding: 16, marginTop: 16 }}>
            <p style={{ fontWeight: 600, fontSize: 14, color: '#991B1B', margin: '0 0 8px' }}>Error:</p>
            <p style={{ fontSize: 14, color: '#7F1D1D', margin: 0, fontFamily: 'monospace' }}>{this.state.error.message}</p>
          </div>
          <div style={{ background: '#F6F9FC', border: '1px solid #E3E8EE', borderRadius: 10, padding: 16, marginTop: 12 }}>
            <p style={{ fontWeight: 600, fontSize: 12, color: '#596880', margin: '0 0 8px' }}>Stack trace (send this to Jarvis):</p>
            <pre style={{ fontSize: 10, color: '#6B7280', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: 200, overflow: 'auto' }}>{this.state.error.stack}</pre>
          </div>
          {this.state.errorInfo && (
            <div style={{ background: '#F6F9FC', border: '1px solid #E3E8EE', borderRadius: 10, padding: 16, marginTop: 12 }}>
              <p style={{ fontWeight: 600, fontSize: 12, color: '#596880', margin: '0 0 8px' }}>Component stack:</p>
              <pre style={{ fontSize: 10, color: '#6B7280', margin: 0, whiteSpace: 'pre-wrap', maxHeight: 200, overflow: 'auto' }}>{this.state.errorInfo}</pre>
            </div>
          )}
          <Link to="/companies" style={{ color: '#635BFF', marginTop: 20, display: 'inline-block', fontWeight: 600 }}>← Back to Companies</Link>
        </div>
      );
    }
    return this.props.children;
  }
}

function CompanyDetailInner() {
  const { id } = useParams<{ id: string }>();
  const store = useAppStore();
  const clients = store.clients || [];
  const settings = store.settings || {} as any;
  const integrations = store.integrations || [];
  const getIntegrationByName = store.getIntegrationByName;
  const updateIntegration = store.updateIntegration;
  const [company, setCompany] = useState<Company | null>(null);
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [activity, setActivity] = useState<ActivityLog[]>([]);
  const [enriching, setEnriching] = useState(false);
  const [enrichError, setEnrichError] = useState('');
  const [apolloLoading, setApolloLoading] = useState(false);
  const [apolloError, setApolloError] = useState('');
  const [qualifying, setQualifying] = useState(false);
  const [enrichDropdownOpen, setEnrichDropdownOpen] = useState(false);
  const enrichDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) return;
    getCompanyById(id).then((c) => {
      if (c) { setCompany(c); setNotes(c.notes || ''); }
    });
    getActivityByEntity(id).then(setActivity);
  }, [id]);

  if (!company) {
    return <div className="flex items-center justify-center h-64 text-[#596880]">Loading...</div>;
  }

  const handleStatusChange = async (status: CompanyStatus) => {
    await updateCompany({ id: company.id, status });
    setCompany({ ...company, status });
    await addActivity({ type: 'status_change', description: `Changed ${company.company_name} to ${STATUS_LABELS[status]}`, entity_id: company.id, entity_type: 'company' });
  };

  const handleSaveNotes = async () => {
    await updateCompany({ id: company.id, notes });
    setCompany({ ...company, notes });
    setEditing(false);
    await addActivity({ type: 'note', description: `Updated notes for ${company.company_name}`, entity_id: company.id, entity_type: 'company' });
  };

  const handleAddTag = async () => {
    const tag = tagInput.trim();
    if (!tag || company.tags?.includes(tag)) return;
    const newTags = [...(company.tags || []), tag];
    await updateCompany({ id: company.id, tags: newTags });
    setCompany({ ...company, tags: newTags });
    setTagInput('');
  };

  const handleRemoveTag = async (tag: string) => {
    const newTags = (company.tags || []).filter((t) => t !== tag);
    await updateCompany({ id: company.id, tags: newTags });
    setCompany({ ...company, tags: newTags });
  };

  const handleScoreChange = async (score: number) => {
    await updateCompany({ id: company.id, score });
    setCompany({ ...company, score });
  };

  const handleEnrich = async () => {
    if (!settings.aiApiKey) { setEnrichError('Configure your AI API key in Settings first.'); return; }
    setEnriching(true);
    setEnrichError('');
    try {
      const updates = await enrichCompany(company, {
        provider: settings.aiProvider as 'openai' | 'anthropic',
        apiKey: settings.aiApiKey,
        model: settings.aiModel,
      });
      if (Object.keys(updates).length > 0) {
        const merged = { ...company, ...updates };
        await updateCompany({ id: company.id, ...updates });
        setCompany(merged);
        await addActivity({ type: 'enrich', description: `AI-enriched ${company.company_name}`, entity_id: company.id, entity_type: 'company' });
      }
    } catch (err: unknown) {
      setEnrichError(err instanceof Error ? err.message : 'Enrichment failed');
    } finally {
      setEnriching(false);
    }
  };

  const handleApolloEnrich = async () => {
    // Try integration store first, then legacy settings
    const apolloIntegration = getIntegrationByName('apollo');
    const apolloKey = apolloIntegration?.apiKey || settings.apolloApiKey;
    if (!apolloKey) { setApolloError('Configure your Apollo.io API key in Integrations first.'); return; }
    setApolloLoading(true);
    setApolloError('');
    setEnrichDropdownOpen(false);
    try {
      const { companyData, contacts } = await enrichWithApollo(company, { apiKey: apolloKey });
      const updates: Partial<Company> & { id: string } = { id: company.id, ...companyData };
      if (contacts.length > 0) {
        updates.contacts = [...(company.contacts || []), ...contacts];
        if (!company.director_name && contacts[0]?.name) {
          updates.director_name = contacts[0].name;
          updates.director_title = contacts[0].title;
        }
      }
      await updateCompany(updates);
      setCompany({ ...company, ...updates });
      if (apolloIntegration) updateIntegration(apolloIntegration.id, { lastUsed: new Date().toISOString() });
      await addActivity({ type: 'enrich', description: `Apollo enriched ${company.company_name} (${contacts.length} contacts found)`, entity_id: company.id, entity_type: 'company' });
    } catch (err: unknown) {
      setApolloError(err instanceof Error ? err.message : 'Apollo enrichment failed');
    } finally {
      setApolloLoading(false);
    }
  };

  const handleHunterEnrich = async () => {
    const hunterIntegration = getIntegrationByName('hunter');
    const hunterKey = hunterIntegration?.apiKey || settings.hunterApiKey;
    if (!hunterKey || !company.website) { setEnrichError('Need Hunter.io key and company website.'); return; }
    setEnriching(true);
    setEnrichError('');
    setEnrichDropdownOpen(false);
    try {
      const domain = company.website.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
      const res = await fetch(`https://api.hunter.io/v2/domain-search?domain=${domain}&api_key=${hunterKey}`);
      if (!res.ok) throw new Error('Hunter API error');
      const data = await res.json();
      const emails = data.data?.emails || [];
      if (emails.length > 0) {
        const newContacts: Contact[] = emails.slice(0, 5).map((e: { first_name?: string; last_name?: string; position?: string; value?: string }) => ({
          name: [e.first_name, e.last_name].filter(Boolean).join(' '),
          title: e.position || '',
          email: e.value,
        }));
        const allContacts = [...(company.contacts || []), ...newContacts];
        await updateCompany({ id: company.id, contacts: allContacts });
        setCompany({ ...company, contacts: allContacts });
        if (hunterIntegration) updateIntegration(hunterIntegration.id, { lastUsed: new Date().toISOString() });
        await addActivity({ type: 'enrich', description: `Hunter.io found ${newContacts.length} emails for ${company.company_name}`, entity_id: company.id, entity_type: 'company' });
      }
    } catch (err: unknown) {
      setEnrichError(err instanceof Error ? err.message : 'Hunter enrichment failed');
    } finally {
      setEnriching(false);
    }
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (enrichDropdownRef.current && !enrichDropdownRef.current.contains(e.target as Node)) {
        setEnrichDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleQualify = async () => {
    setQualifying(true);
    try {
      const details = qualifyCompany(company, settings.qualificationConfig);
      await updateCompany({ id: company.id, qualification_score: details.overall_score, qualification_details: details });
      setCompany({ ...company, qualification_score: details.overall_score, qualification_details: details });
      await addActivity({ type: 'qualify', description: `Qualified ${company.company_name} — score: ${details.overall_score}`, entity_id: company.id, entity_type: 'company' });
    } finally {
      setQualifying(false);
    }
  };

  const sharedClients = clients.filter((c) => (company.client_ids || []).includes(c.id));
  const financials = [
    { label: 'Revenue', value: formatCurrency(company.revenue) },
    { label: 'P/L Before Tax', value: formatCurrency(company.profit_before_tax) },
    { label: 'Total Assets', value: formatCurrency(company.total_assets) },
    { label: 'Equity', value: formatCurrency(company.equity) },
  ];

  const qualDetails = company.qualification_details;
  const qualScore = company.qualification_score;
  const scoreInfo = qualScore != null ? getScoreLabel(qualScore) : null;

  return (
    <div className="space-y-6">
      <Link to="/companies" className="inline-flex items-center gap-2 text-sm text-[#596880] hover:text-[#635BFF]">
        <ArrowLeft size={16} /> Back to Companies
      </Link>

      {/* Header */}
      <div className="card flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-[#0A2540]">{company.company_name}</h1>
            <span className={`badge ${STATUS_COLORS[company.status] || 'badge-gray'}`}>
              {STATUS_LABELS[company.status] || company.status}
            </span>
            {scoreInfo && (
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${scoreInfo.color}`}>
                {scoreInfo.emoji} {qualScore} — {scoreInfo.label}
              </span>
            )}
          </div>
          {company.description && (
            <p className="text-sm text-[#596880] mt-2 max-w-2xl">{company.description}</p>
          )}
          <div className="flex items-center gap-4 mt-3 text-sm text-[#596880]">
            {company.geography && <span>📍 {company.geography}</span>}
            {company.industry && <span>🏭 {company.industry}</span>}
            {company.year_incorporated && <span>📅 Est. {company.year_incorporated}</span>}
            {company.website && (
              <a href={company.website.startsWith('http') ? company.website : `https://${company.website}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[#635BFF] hover:underline">
                <ExternalLink size={13} /> Website
              </a>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {[1,2,3,4,5].map((s) => (
            <button key={s} onClick={() => handleScoreChange(s)} className="p-0.5">
              <Star size={18} className={s <= (company.score || 0) ? 'fill-[#FFB800] text-[#FFB800]' : 'text-[#E3E8EE]'} />
            </button>
          ))}
        </div>
      </div>

      {/* Action Buttons Row */}
      <div className="flex flex-wrap gap-3">
        {/* Enrich Dropdown */}
        <div ref={enrichDropdownRef} style={{ position: 'relative' }}>
          <button
            className="btn-primary"
            onClick={() => setEnrichDropdownOpen(!enrichDropdownOpen)}
            disabled={enriching || apolloLoading}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Sparkles size={16} />
            {enriching || apolloLoading ? 'Enriching...' : 'Enrich'}
            <ChevronDown size={14} />
          </button>
          {enrichDropdownOpen && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, marginTop: 4,
              background: 'white', border: '1px solid #E3E8EE', borderRadius: 10,
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 50,
              minWidth: 220, overflow: 'hidden',
            }}>
              {/* AI Enrichment */}
              {settings.aiApiKey && (
                <button onClick={() => { setEnrichDropdownOpen(false); handleEnrich(); }} style={{
                  display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                  padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 13, color: '#0A2540', textAlign: 'left',
                }}
                onMouseOver={(e) => (e.currentTarget.style.background = '#F6F9FC')}
                onMouseOut={(e) => (e.currentTarget.style.background = 'none')}>
                  <span>🤖</span> Enrich with AI
                </button>
              )}
              {/* Apollo */}
              {(getIntegrationByName('apollo')?.apiKey || settings.apolloApiKey) && (
                <button onClick={handleApolloEnrich} style={{
                  display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                  padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 13, color: '#0A2540', textAlign: 'left',
                }}
                onMouseOver={(e) => (e.currentTarget.style.background = '#F6F9FC')}
                onMouseOut={(e) => (e.currentTarget.style.background = 'none')}>
                  <span>🚀</span> Enrich with Apollo.io
                </button>
              )}
              {/* Hunter */}
              {(getIntegrationByName('hunter')?.apiKey || settings.hunterApiKey) && (
                <button onClick={handleHunterEnrich} style={{
                  display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                  padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 13, color: '#0A2540', textAlign: 'left',
                }}
                onMouseOver={(e) => (e.currentTarget.style.background = '#F6F9FC')}
                onMouseOut={(e) => (e.currentTarget.style.background = 'none')}>
                  <span>📧</span> Enrich with Hunter.io
                </button>
              )}
              {/* Other connected integrations */}
              {integrations.filter(i => {
                const lower = i.name.toLowerCase();
                return i.connected && !lower.includes('apollo') && !lower.includes('hunter');
              }).map(i => (
                <button key={i.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                  padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 13, color: '#9CA3AF', textAlign: 'left',
                }}
                onMouseOver={(e) => (e.currentTarget.style.background = '#F6F9FC')}
                onMouseOut={(e) => (e.currentTarget.style.background = 'none')}>
                  <span>🔌</span> {i.name} <span style={{ fontSize: 11, color: '#D1D5DB' }}>(coming soon)</span>
                </button>
              ))}
              {/* Fallback if nothing configured */}
              {!settings.aiApiKey && !getIntegrationByName('apollo')?.apiKey && !settings.apolloApiKey && (
                <div style={{ padding: '12px 14px', fontSize: 12, color: '#9CA3AF' }}>
                  No integrations configured. Visit <Link to="/integrations" style={{ color: '#635BFF' }}>Integrations</Link> to add one.
                </div>
              )}
            </div>
          )}
        </div>
        <button className="btn-secondary" onClick={handleQualify} disabled={qualifying}>
          <ShieldCheck size={16} /> {qualifying ? 'Qualifying...' : '✅ Qualify'}
        </button>
      </div>
      {enrichError && <p className="text-sm text-red-600">⚠️ {enrichError}</p>}
      {apolloError && <p className="text-sm text-red-600">⚠️ {apolloError}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Financials */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {financials.map((f) => (
              <div key={f.label} className="card !p-4">
                <p className="text-xs text-[#596880]">{f.label}</p>
                <p className="text-xl font-bold text-[#0A2540] mt-1">{f.value}</p>
              </div>
            ))}
          </div>

          {/* Overview */}
          <div className="card">
            <h2 className="text-base font-semibold text-[#0A2540] mb-4">Company Details</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-[#596880]">Employees:</span> <span className="font-medium ml-2">{formatNumber(company.employees)}</span></div>
              <div><span className="text-[#596880]">NACE:</span> <span className="font-medium ml-2">{company.nace || '—'}</span></div>
              <div><span className="text-[#596880]">Address:</span> <span className="font-medium ml-2">{company.address || '—'}</span></div>
              <div><span className="text-[#596880]">Source:</span> <span className="font-medium ml-2">{company.source || '—'}</span></div>
              <div><span className="text-[#596880]">Year Incorporated:</span> <span className="font-medium ml-2">{company.year_incorporated || '—'}</span></div>
              <div><span className="text-[#596880]">Website:</span> <span className="font-medium ml-2">{company.website || '—'}</span></div>
            </div>
          </div>

          {/* Qualification Results */}
          {qualDetails && (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-[#0A2540]">Qualification Results</h2>
                {scoreInfo && (
                  <span className={`text-sm font-medium px-3 py-1 rounded-full border ${scoreInfo.color}`}>
                    {scoreInfo.emoji} {qualScore}/100 — {scoreInfo.label}
                  </span>
                )}
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span>{qualDetails.has_website ? '✅' : '❌'}</span>
                  <span className={qualDetails.has_website ? 'text-[#0A2540]' : 'text-[#596880]'}>Has website</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>{qualDetails.has_description ? '✅' : '❌'}</span>
                  <span className={qualDetails.has_description ? 'text-[#0A2540]' : 'text-[#596880]'}>Has description</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>{qualDetails.has_revenue ? '✅' : '❌'}</span>
                  <span className={qualDetails.has_revenue ? 'text-[#0A2540]' : 'text-[#596880]'}>Has revenue data</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>{qualDetails.has_employees ? '✅' : '❌'}</span>
                  <span className={qualDetails.has_employees ? 'text-[#0A2540]' : 'text-[#596880]'}>Has employee count</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>{qualDetails.has_contacts ? '✅' : '❌'}</span>
                  <span className={qualDetails.has_contacts ? 'text-[#0A2540]' : 'text-[#596880]'}>Has director/contact info</span>
                </div>
                <p className="text-xs text-[#596880] mt-2">Checked: {formatRelativeTime(qualDetails.checked_at)}</p>
              </div>
              {qualScore != null && qualScore < 80 && (
                <button className="btn-secondary mt-4 text-sm" onClick={handleEnrich} disabled={enriching}>
                  <Sparkles size={14} /> Auto-fix with AI
                </button>
              )}
            </div>
          )}

          {/* Directors & Contacts */}
          <div className="card">
            <h2 className="text-base font-semibold text-[#0A2540] mb-4">
              Directors & Contacts
              {company.directors && company.directors.length > 0 && (
                <span className="text-xs font-normal text-[#596880] ml-2">({company.directors.length} total)</span>
              )}
            </h2>

            {/* Main Director (highlighted) */}
            {(company.director_name || company.director_title) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: '#F0EEFF', borderRadius: 10, marginBottom: 12, border: '1px solid rgba(99,91,255,0.15)' }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#635BFF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 16, flexShrink: 0 }}>
                  {company.director_name?.charAt(0) || 'D'}
                </div>
                <div>
                  <p style={{ fontWeight: 600, color: '#0A2540', fontSize: 14, margin: 0 }}>{company.director_name || '—'}</p>
                  <p style={{ fontSize: 13, color: '#635BFF', margin: '2px 0 0' }}>{company.director_title || '—'}</p>
                  <span style={{ fontSize: 11, color: '#596880', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Primary Director</span>
                </div>
              </div>
            )}

            {/* All Other Directors */}
            {company.directors && company.directors.length > 1 && (
              <div style={{ marginTop: 8 }}>
                <h3 style={{ fontSize: 12, fontWeight: 600, color: '#596880', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
                  Other Directors & Officers
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 8 }}>
                  {company.directors.slice(1).map((dir: Director, idx: number) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: '#F6F9FC', borderRadius: 8, border: '1px solid #E3E8EE' }}>
                      <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#E3E8EE', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#596880', fontSize: 13, fontWeight: 600, flexShrink: 0 }}>
                        {dir.name?.charAt(0) || '?'}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 500, color: '#0A2540', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dir.name}</p>
                        <p style={{ fontSize: 12, color: '#596880', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dir.title || '—'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Apollo Contacts */}
            {company.contacts && company.contacts.length > 0 && (
              <div style={{ borderTop: '1px solid #E3E8EE', marginTop: 16, paddingTop: 16 }}>
                <h3 style={{ fontSize: 12, fontWeight: 600, color: '#596880', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
                  Apollo Contacts
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {company.contacts.map((contact: Contact, idx: number) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: '#F6F9FC', borderRadius: 8, border: '1px solid #E3E8EE' }}>
                      <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#065F46', fontSize: 13, fontWeight: 600, flexShrink: 0 }}>
                        {contact.name?.charAt(0) || '?'}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 500, color: '#0A2540', margin: 0 }}>{contact.name}</p>
                        <p style={{ fontSize: 12, color: '#596880', margin: 0 }}>{contact.title}</p>
                        <div style={{ display: 'flex', gap: 12, marginTop: 4, fontSize: 12 }}>
                          {contact.email && <span style={{ color: '#635BFF' }}>{contact.email}</span>}
                          {contact.phone && <span style={{ color: '#596880' }}>{contact.phone}</span>}
                          {contact.linkedin_url && (
                            <a href={contact.linkedin_url} target="_blank" rel="noreferrer" style={{ color: '#635BFF', textDecoration: 'none' }}>LinkedIn ↗</a>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!company.director_name && !company.director_title && (!company.directors || company.directors.length === 0) && (!company.contacts || company.contacts.length === 0) && (
              <p style={{ fontSize: 13, color: '#596880' }}>No contacts found. Try enriching with Apollo or AI.</p>
            )}
          </div>

          {/* Notes */}
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-[#0A2540]">Notes</h2>
              {editing ? (
                <button className="btn-primary !py-1.5 !px-3 text-xs" onClick={handleSaveNotes}><Save size={14} /> Save</button>
              ) : (
                <button className="btn-secondary !py-1.5 !px-3 text-xs" onClick={() => setEditing(true)}><Edit2 size={14} /> Edit</button>
              )}
            </div>
            {editing ? (
              <textarea className="input-field min-h-[120px]" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add notes about this company..." />
            ) : (
              <p className="text-sm text-[#596880] whitespace-pre-wrap">{notes || 'No notes yet'}</p>
            )}
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Status */}
          <div className="card">
            <h2 className="text-base font-semibold text-[#0A2540] mb-3">Pipeline Stage</h2>
            <select className="input-field" value={company.status} onChange={(e) => handleStatusChange(e.target.value as CompanyStatus)}>
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          {/* Tags */}
          <div className="card">
            <h2 className="text-base font-semibold text-[#0A2540] mb-3">Tags</h2>
            <div className="flex flex-wrap gap-2 mb-3">
              {(company.tags || []).map((tag) => (
                <span key={tag} className="badge badge-purple flex items-center gap-1">
                  {tag}
                  <button onClick={() => handleRemoveTag(tag)} className="hover:text-red-500"><X size={12} /></button>
                </span>
              ))}
              {(!company.tags || company.tags.length === 0) && <span className="text-sm text-[#596880]">No tags</span>}
            </div>
            <div className="flex gap-2">
              <input className="input-field flex-1" placeholder="Add tag..." value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddTag()} />
              <button className="btn-secondary !py-1.5 !px-3" onClick={handleAddTag}><Plus size={14} /></button>
            </div>
          </div>

          {/* Shared With */}
          <div className="card">
            <h2 className="text-base font-semibold text-[#0A2540] mb-3">Shared With</h2>
            {sharedClients.length > 0 ? (
              <div className="space-y-2">
                {sharedClients.map((c) => (
                  <div key={c.id} className="flex items-center gap-2 text-sm">
                    <div className="w-7 h-7 rounded-full bg-[#ECFDF5] flex items-center justify-center text-[#065F46] text-xs font-semibold">
                      {c.name.charAt(0)}
                    </div>
                    <Link to={`/clients/${c.id}`} className="text-[#0A2540] hover:text-[#635BFF]">{c.name}</Link>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[#596880]">Not shared with any clients</p>
            )}
          </div>

          {/* Activity */}
          <div className="card">
            <h2 className="text-base font-semibold text-[#0A2540] mb-3">Activity Log</h2>
            <div className="space-y-3 max-h-[300px] overflow-y-auto">
              {activity.length > 0 ? activity.map((a) => (
                <div key={a.id} className="text-sm">
                  <p className="text-[#0A2540]">{a.description}</p>
                  <p className="text-[11px] text-[#596880]">{formatRelativeTime(a.timestamp)}</p>
                </div>
              )) : (
                <p className="text-sm text-[#596880]">No activity yet</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CompanyDetail() {
  return (
    <ErrorBoundary>
      <CompanyDetailInner />
    </ErrorBoundary>
  );
}
