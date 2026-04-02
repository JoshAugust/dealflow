import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Phone, Mail, ExternalLink, Search, ChevronUp, ChevronDown,
  PhoneCall, Globe, User, Calendar, MessageSquare, Filter, X,
} from 'lucide-react';
import { getCompaniesPage, updateCompany, type SortField, type SortDir } from '../lib/db';
import type { Company, CompanyFilters, CallStatus, CallNote } from '../lib/types';
import { CALL_STATUSES, CALL_STATUS_COLORS } from '../lib/types';

// ─── Design tokens ────────────────────────────────────────────────────────────

const S = {
  bg: '#F6F9FC',
  card: '#FFFFFF',
  border: '#E3E8EE',
  primary: '#635BFF',
  success: '#059669',
  danger: '#E25950',
  warning: '#F59E0B',
  purple: '#7C3AED',
  textPrimary: '#0A2540',
  textSecondary: '#425466',
  textMuted: '#8898aa',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getContactInfo(c: Company) {
  const contact = c.contacts?.[0];
  return {
    name: contact?.name || c.director_name || '',
    title: contact?.title || c.director_title || '',
    phone: contact?.phone || '',
    email: contact?.email || '',
    linkedin: contact?.linkedin_url || '',
  };
}

function formatRevenue(v?: number): string {
  if (!v) return '—';
  const abs = Math.abs(v);
  if (abs >= 1e9) return `$${(abs / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `$${(abs / 1e3).toFixed(0)}K`;
  return `$${abs.toLocaleString()}`;
}

// ─── Call Sheet Row ───────────────────────────────────────────────────────────

interface RowProps {
  company: Company;
  onUpdate: (id: string, updates: Partial<Company>) => void;
}

function CallSheetRow({ company, onUpdate }: RowProps) {
  const [editingNote, setEditingNote] = useState(false);
  const [noteText, setNoteText] = useState('');
  const contact = getContactInfo(company);
  const status = company.call_status || 'Not Called';
  const statusStyle = CALL_STATUS_COLORS[status];
  const notes = company.call_notes || [];
  const latestNote = notes.length > 0 ? notes[notes.length - 1] : null;

  const handleStatusChange = (newStatus: CallStatus) => {
    const now = new Date().toISOString();
    const isCall = newStatus !== 'Not Called' && newStatus !== status;
    onUpdate(company.id, {
      call_status: newStatus,
      last_called_at: isCall ? now : company.last_called_at,
    });
  };

  const handleNoteSave = () => {
    if (!noteText.trim()) { setEditingNote(false); return; }
    const newNote: CallNote = { note: noteText.trim(), timestamp: new Date().toISOString() };
    const existing = company.call_notes || [];
    onUpdate(company.id, { call_notes: [...existing, newNote] });
    setNoteText('');
    setEditingNote(false);
  };

  return (
    <div style={{
      background: S.card,
      border: `1px solid ${S.border}`,
      borderRadius: 10,
      padding: '14px 18px',
      marginBottom: 8,
    }}>
      {/* Top: company + status */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: S.textPrimary }}>
              {company.company_name}
            </span>
            {company.qualification_score != null && (
              <span style={{
                background: '#EEF2FF', color: S.primary,
                fontSize: 11, fontWeight: 600, padding: '1px 7px', borderRadius: 10,
              }}>
                Score: {company.qualification_score}
              </span>
            )}
            {company.blueprint_grade && (
              <span style={{
                background: '#F0FDF4', color: S.success,
                fontSize: 11, fontWeight: 600, padding: '1px 7px', borderRadius: 10,
              }}>
                Grade: {company.blueprint_grade}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 4 }}>
            {company.industry && <span style={{ fontSize: 12, color: S.textMuted }}>{company.industry}</span>}
            {company.geography && <span style={{ fontSize: 12, color: S.textMuted }}>{company.geography}</span>}
            {company.revenue > 0 && <span style={{ fontSize: 12, color: S.textMuted }}>{formatRevenue(company.revenue)}</span>}
            {company.employees > 0 && <span style={{ fontSize: 12, color: S.textMuted }}>{company.employees.toLocaleString()} emp</span>}
          </div>
        </div>

        <select
          value={status}
          onChange={e => handleStatusChange(e.target.value as CallStatus)}
          style={{
            padding: '5px 10px', borderRadius: 8,
            border: `1px solid ${statusStyle.text}`,
            background: statusStyle.bg, color: statusStyle.text,
            fontSize: 12, fontWeight: 600, cursor: 'pointer', outline: 'none',
            minWidth: 170,
          }}
        >
          {CALL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Contact row */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 10, alignItems: 'center' }}>
        {contact.name && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <User size={12} color={S.textMuted} />
            <span style={{ fontSize: 13, color: S.textSecondary, fontWeight: 500 }}>{contact.name}</span>
            {contact.title && <span style={{ fontSize: 12, color: S.textMuted }}>· {contact.title}</span>}
          </div>
        )}
        {contact.phone && (
          <a href={`tel:${contact.phone}`}
            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: S.primary, textDecoration: 'none' }}>
            <Phone size={12} /> {contact.phone}
          </a>
        )}
        {contact.email && (
          <a href={`mailto:${contact.email}`}
            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: S.primary, textDecoration: 'none' }}>
            <Mail size={12} /> {contact.email}
          </a>
        )}
        {contact.linkedin && (
          <a href={contact.linkedin} target="_blank" rel="noopener noreferrer"
            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: '#0A66C2', textDecoration: 'none' }}>
            <ExternalLink size={12} /> LinkedIn
          </a>
        )}
        {company.website && (
          <a href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
            target="_blank" rel="noopener noreferrer"
            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: S.textSecondary, textDecoration: 'none' }}>
            <Globe size={12} /> {company.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
          </a>
        )}
      </div>

      {/* Notes + last called */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ flex: 2, minWidth: 200 }}>
          {editingNote ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <textarea
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                autoFocus
                placeholder="Add call note…"
                rows={2}
                style={{
                  flex: 1, padding: '6px 10px',
                  border: `1px solid ${S.primary}`, borderRadius: 6,
                  fontSize: 13, color: S.textPrimary, background: '#fff',
                  outline: 'none', resize: 'vertical', fontFamily: 'inherit',
                }}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleNoteSave(); } }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <button onClick={handleNoteSave}
                  style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: S.primary, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  Save
                </button>
                <button onClick={() => { setEditingNote(false); setNoteText(''); }}
                  style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid ${S.border}`, background: '#fff', color: S.textSecondary, fontSize: 12, cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div
              onClick={() => setEditingNote(true)}
              style={{
                padding: '6px 10px',
                background: latestNote ? '#F8FAFC' : 'transparent',
                border: `1px solid ${latestNote ? S.border : 'transparent'}`,
                borderRadius: 6, fontSize: 13,
                color: latestNote ? S.textSecondary : S.textMuted,
                cursor: 'text', minHeight: 32, display: 'flex', alignItems: 'center', gap: 6,
                fontStyle: latestNote ? 'normal' : 'italic',
              }}
            >
              <MessageSquare size={12} />
              {latestNote
                ? `${latestNote.note} — ${new Date(latestNote.timestamp).toLocaleDateString()}`
                : 'Add call notes…'}
              {notes.length > 1 && (
                <span style={{ fontSize: 11, color: S.textMuted, marginLeft: 4 }}>
                  (+{notes.length - 1} more)
                </span>
              )}
            </div>
          )}
        </div>

        {company.last_called_at && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            <PhoneCall size={12} color={S.textMuted} />
            <span style={{ fontSize: 12, color: S.textMuted }}>
              Last: {new Date(company.last_called_at).toLocaleDateString()}{' '}
              {new Date(company.last_called_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;

export default function CallSheet() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [sortField, setSortField] = useState<SortField>('qualification_score');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const loadCompanies = useCallback(async () => {
    setLoading(true);
    try {
      const filters: CompanyFilters = {
        search, industry: '', geography: '', revenueMin: '', revenueMax: '',
        employeesMin: '', employeesMax: '', status: '', tags: [], source: '',
      };
      const result = await getCompaniesPage(1, 5000, filters, sortField, sortDir);
      // Client-side filter by call status
      let filtered = result.companies;
      if (filterStatus !== 'All') {
        filtered = filtered.filter(c => (c.call_status || 'Not Called') === filterStatus);
      }
      // Only include companies with contacts or directors
      filtered = filtered.filter(c => {
        const contact = c.contacts?.[0];
        return contact?.phone || contact?.email || c.director_name;
      });
      setTotal(filtered.length);
      setCompanies(filtered.slice(0, page * PAGE_SIZE));
    } finally {
      setLoading(false);
    }
  }, [search, filterStatus, sortField, sortDir, page]);

  useEffect(() => { loadCompanies(); }, [loadCompanies]);

  const handleUpdate = async (id: string, updates: Partial<Company>) => {
    await updateCompany({ id, ...updates });
    setCompanies(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  // Compute stats
  const stats = useMemo(() => {
    const today = new Date().toDateString();
    const calledToday = companies.filter(c =>
      c.last_called_at && new Date(c.last_called_at).toDateString() === today
    ).length;
    const totalCalled = companies.filter(c => c.call_status && c.call_status !== 'Not Called').length;
    const spokeToDM = companies.filter(c => c.call_status === 'Called - Spoke to DM').length;
    const connectRate = totalCalled > 0 ? Math.round((spokeToDM / totalCalled) * 100) : 0;
    const callbacks = companies.filter(c => c.call_status === 'Callback Scheduled').length;
    const interested = companies.filter(c => c.call_status === 'Interested').length;

    return { calledToday, totalCalled, connectRate, callbacks, interested, total: companies.length };
  }, [companies]);

  const hasMore = companies.length < total;

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
    setPage(1);
  };

  const SortBtn = ({ k, label }: { k: SortField; label: string }) => (
    <button
      onClick={() => toggleSort(k)}
      style={{
        display: 'flex', alignItems: 'center', gap: 3,
        background: sortField === k ? '#EEF2FF' : 'transparent',
        border: `1px solid ${sortField === k ? S.primary : S.border}`,
        color: sortField === k ? S.primary : S.textSecondary,
        padding: '4px 10px', borderRadius: 6, fontSize: 12,
        fontWeight: 500, cursor: 'pointer',
      }}
    >
      {label}
      {sortField === k ? (
        sortDir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />
      ) : null}
    </button>
  );

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: S.textPrimary, letterSpacing: '-0.02em', margin: 0 }}>
            Call Sheet
          </h1>
          <p style={{ fontSize: 13, color: S.textMuted, marginTop: 2 }}>
            {total} companies with contacts
          </p>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total Queue', value: stats.total, color: S.textPrimary, bg: S.card },
          { label: 'Called Today', value: stats.calledToday, color: S.success, bg: '#F0FDF4' },
          { label: 'Total Called', value: stats.totalCalled, color: '#2563EB', bg: '#EFF6FF' },
          { label: 'Connect Rate', value: `${stats.connectRate}%`, color: S.purple, bg: '#F5F3FF' },
          { label: 'Callbacks Due', value: stats.callbacks, color: S.warning, bg: '#FFFBEB' },
          { label: 'Interested', value: stats.interested, color: S.primary, bg: '#EEF2FF' },
        ].map(stat => (
          <div key={stat.label} style={{
            background: stat.bg, border: `1px solid ${S.border}`,
            borderRadius: 10, padding: '14px 16px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: stat.color }}>{stat.value}</div>
            <div style={{ fontSize: 11, color: S.textMuted, marginTop: 2 }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={14} color={S.textMuted} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search companies, contacts, notes…"
            className="input-field"
            style={{ paddingLeft: 32 }}
          />
        </div>
        <select
          value={filterStatus}
          onChange={e => { setFilterStatus(e.target.value); setPage(1); }}
          className="input-field"
          style={{ width: 'auto', minWidth: 180 }}
        >
          <option value="All">All Statuses</option>
          {CALL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <div style={{ display: 'flex', gap: 6 }}>
          <SortBtn k="qualification_score" label="Score" />
          <SortBtn k="company_name" label="Name" />
          <SortBtn k="revenue" label="Revenue" />
        </div>
      </div>

      {/* Results */}
      <div style={{ fontSize: 13, color: S.textMuted, marginBottom: 12 }}>
        Showing {companies.length} of {total} companies
        {filterStatus !== 'All' && ` · filtered by "${filterStatus}"`}
      </div>

      {loading && companies.length === 0 ? (
        <div style={{
          background: S.card, border: `1px solid ${S.border}`,
          borderRadius: 12, padding: '48px', textAlign: 'center',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 24, height: 24, border: '3px solid #E3E8EE', borderTopColor: '#635BFF', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            Loading call sheet...
          </div>
        </div>
      ) : companies.length === 0 ? (
        <div style={{
          background: S.card, border: `1px solid ${S.border}`,
          borderRadius: 12, padding: '60px 40px', textAlign: 'center',
        }}>
          <PhoneCall size={40} color={S.border} style={{ margin: '0 auto 16px' }} />
          <div style={{ fontSize: 16, fontWeight: 600, color: S.textPrimary, marginBottom: 8 }}>
            No companies in call queue
          </div>
          <div style={{ fontSize: 14, color: S.textMuted }}>
            Enrich companies with contacts (Apollo or AI) to populate the call sheet.
          </div>
        </div>
      ) : (
        <>
          {companies.map(c => (
            <CallSheetRow key={c.id} company={c} onUpdate={handleUpdate} />
          ))}
          {hasMore && (
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <button
                onClick={() => setPage(p => p + 1)}
                className="btn-secondary"
                style={{ padding: '10px 28px' }}
              >
                Load More ({total - companies.length} remaining)
              </button>
            </div>
          )}
        </>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
