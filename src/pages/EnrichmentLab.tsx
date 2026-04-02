import { useState, useEffect, useMemo } from 'react';
import {
  Zap, Search, Play, CheckCircle, AlertCircle, XCircle,
  Clock, ChevronDown, ChevronUp, Settings, ExternalLink,
} from 'lucide-react';
import { getCompaniesPage, updateCompany, getAllCompaniesForExport } from '../lib/db';
import { useAppStore } from '../store/appStore';
import type { Company, CompanyFilters, EnrichmentHistoryEntry } from '../lib/types';
import {
  ENRICHMENT_SOURCES,
  runEnrichment,
  runBatchEnrichment,
  type EnrichmentSourceId,
  type EnrichmentConfig,
  type EnrichmentResult,
  type BatchProgress,
} from '../lib/enrichmentEngine';
import { enrichWithApollo } from '../lib/apolloService';
import { enrichCompany } from '../lib/aiService';
import { blueprintScore } from '../lib/blueprintScorer';
import { quickVibeScore } from '../lib/vibeScorer';
import { Link } from 'react-router-dom';

// ─── Design tokens ────────────────────────────────────────────────────────────

const S = {
  bg: '#F6F9FC',
  card: '#FFFFFF',
  border: '#E3E8EE',
  primary: '#635BFF',
  success: '#059669',
  danger: '#E25950',
  warning: '#d97706',
  textPrimary: '#0A2540',
  textSecondary: '#425466',
  textMuted: '#8898aa',
};

// ─── Source card ───────────────────────────────────────────────────────────────

interface SourceCardProps {
  id: EnrichmentSourceId;
  name: string;
  icon: string;
  description: string;
  fieldsEnriched: string[];
  requiresKey: 'apollo' | 'ai' | 'none';
  isConfigured: boolean;
  isSelected: boolean;
  onToggle: () => void;
}

function SourceCard({ name, icon, description, fieldsEnriched, requiresKey, isConfigured, isSelected, onToggle }: SourceCardProps) {
  const statusColor = isConfigured ? S.success : S.warning;
  const statusLabel = isConfigured ? 'Configured' : 'Needs API Key';
  const statusBg = isConfigured ? '#F0FDF4' : '#FFFBEB';

  return (
    <div
      onClick={onToggle}
      style={{
        padding: '16px', borderRadius: 12, cursor: 'pointer',
        border: `2px solid ${isSelected ? S.primary : S.border}`,
        background: isSelected ? '#F8F7FF' : S.card,
        transition: 'all 0.15s',
        boxShadow: isSelected ? '0 2px 8px rgba(99,91,255,0.15)' : '0 1px 3px rgba(0,0,0,0.04)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <input type="checkbox" checked={isSelected} readOnly style={{ cursor: 'pointer', accentColor: S.primary }} />
        <span style={{ fontSize: 20 }}>{icon}</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: S.textPrimary, flex: 1 }}>{name}</span>
        <span style={{
          fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 10,
          background: statusBg, color: statusColor,
        }}>
          {statusLabel}
        </span>
      </div>
      <p style={{ fontSize: 12, color: S.textMuted, margin: '0 0 8px 32px', lineHeight: 1.5 }}>
        {description}
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginLeft: 32 }}>
        {fieldsEnriched.map(f => (
          <span key={f} style={{
            fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 4,
            background: S.bg, color: S.textMuted,
          }}>
            {f}
          </span>
        ))}
      </div>
      {!isConfigured && requiresKey !== 'none' && (
        <div style={{ marginTop: 8, marginLeft: 32 }}>
          <Link to="/integrations" style={{ fontSize: 11, color: S.primary, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Settings size={10} /> Configure {requiresKey === 'apollo' ? 'Apollo' : 'AI'} API Key
          </Link>
        </div>
      )}
    </div>
  );
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────

function ProgressBar({ value, total, label }: { value: number; total: number; label?: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: S.textMuted }}>{label || `${value} / ${total}`}</span>
        <span style={{ fontSize: 12, color: S.primary, fontWeight: 600 }}>{pct}%</span>
      </div>
      <div style={{ height: 6, background: S.border, borderRadius: 3, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${pct}%`,
          background: S.primary, borderRadius: 3, transition: 'width 0.3s ease',
        }} />
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function EnrichmentLab() {
  const { settings, getIntegrationByName } = useAppStore();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [totalCompanies, setTotalCompanies] = useState(0);
  const [selectedSources, setSelectedSources] = useState<Set<EnrichmentSourceId>>(new Set());

  // Single enrichment
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [singleResults, setSingleResults] = useState<EnrichmentResult[]>([]);
  const [singleRunning, setSingleRunning] = useState(false);

  // Batch enrichment
  const [batchCompanies, setBatchCompanies] = useState<Company[]>([]);
  const [batchSelected, setBatchSelected] = useState<Set<string>>(new Set());
  const [batchProgress, setBatchProgress] = useState<BatchProgress | null>(null);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchResults, setBatchResults] = useState<Map<string, EnrichmentResult[]> | null>(null);

  // Enrichment history
  const [history, setHistory] = useState<{ company: string; source: string; fields: string; timestamp: string }[]>([]);

  // Tab
  const [activeTab, setActiveTab] = useState<'single' | 'batch'>('single');

  // Blueprint/Vibe scoring
  const [scoringRunning, setScoringRunning] = useState(false);
  const [scoringResult, setScoringResult] = useState<string | null>(null);

  const apolloKey = getIntegrationByName('apollo')?.apiKey || settings.apolloApiKey;
  const aiKey = settings.aiApiKey;

  const config: EnrichmentConfig = useMemo(() => ({
    apolloApiKey: apolloKey,
    aiConfig: aiKey ? {
      provider: settings.aiProvider as 'openai' | 'anthropic',
      apiKey: aiKey,
      model: settings.aiModel,
    } : undefined,
  }), [apolloKey, aiKey, settings.aiProvider, settings.aiModel]);

  useEffect(() => {
    getAllCompaniesForExport().then(all => {
      setTotalCompanies(all.length);
      setBatchCompanies(all.slice(0, 200));
      // Build enrichment history from all companies
      const h: typeof history = [];
      all.forEach(c => {
        (c.enrichment_history || []).forEach(e => {
          h.push({
            company: c.company_name,
            source: e.source,
            fields: e.fieldsUpdated.join(', '),
            timestamp: e.timestamp,
          });
        });
      });
      h.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      setHistory(h.slice(0, 50));
    });
  }, []);

  // Source configuration check
  const isSourceConfigured = (requiresKey: 'apollo' | 'ai' | 'none') => {
    if (requiresKey === 'none') return true;
    if (requiresKey === 'apollo') return !!apolloKey;
    return !!aiKey;
  };

  const toggleSource = (id: EnrichmentSourceId) => {
    const next = new Set(selectedSources);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedSources(next);
  };

  // Company search
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    const timer = setTimeout(async () => {
      const filters: CompanyFilters = {
        search: searchQuery, industry: '', geography: '', revenueMin: '', revenueMax: '',
        employeesMin: '', employeesMax: '', status: '', tags: [], source: '',
      };
      const result = await getCompaniesPage(1, 10, filters);
      setSearchResults(result.companies);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Single enrichment
  const handleSingleEnrich = async () => {
    if (!selectedCompany || selectedSources.size === 0) return;
    setSingleRunning(true);
    setSingleResults([]);
    try {
      const results = await runEnrichment(
        selectedCompany,
        Array.from(selectedSources),
        config,
      );
      setSingleResults(results);

      // Save results to DB
      const merged: Partial<Company> & { id: string } = { id: selectedCompany.id };
      const historyEntries: EnrichmentHistoryEntry[] = [...(selectedCompany.enrichment_history || [])];
      for (const r of results) {
        if (!r.error && Object.keys(r.data).length > 0) {
          Object.assign(merged, r.data);
          if (r.contacts && r.contacts.length > 0) {
            merged.contacts = [...(selectedCompany.contacts || []), ...r.contacts];
          }
          historyEntries.push({ source: r.source, fieldsUpdated: r.fieldsUpdated, timestamp: r.timestamp });
        }
      }
      merged.enrichment_history = historyEntries;
      await updateCompany(merged);
    } finally {
      setSingleRunning(false);
    }
  };

  // Batch enrichment
  const handleBatchEnrich = async () => {
    if (batchSelected.size === 0 || selectedSources.size === 0) return;
    setBatchRunning(true);
    setBatchProgress(null);
    setBatchResults(null);
    try {
      const toEnrich = batchCompanies.filter(c => batchSelected.has(c.id));
      const results = await runBatchEnrichment(
        toEnrich,
        Array.from(selectedSources),
        config,
        setBatchProgress,
      );
      setBatchResults(results);

      // Save all results
      for (const [companyId, companyResults] of results) {
        const company = toEnrich.find(c => c.id === companyId);
        if (!company) continue;
        const merged: Partial<Company> & { id: string } = { id: companyId };
        const historyEntries: EnrichmentHistoryEntry[] = [...(company.enrichment_history || [])];
        for (const r of companyResults) {
          if (!r.error && Object.keys(r.data).length > 0) {
            Object.assign(merged, r.data);
            if (r.contacts && r.contacts.length > 0) {
              merged.contacts = [...(company.contacts || []), ...r.contacts];
            }
            historyEntries.push({ source: r.source, fieldsUpdated: r.fieldsUpdated, timestamp: r.timestamp });
          }
        }
        merged.enrichment_history = historyEntries;
        await updateCompany(merged);
      }
    } finally {
      setBatchRunning(false);
    }
  };

  // Blueprint + Vibe scoring
  const handleRunScoring = async () => {
    setScoringRunning(true);
    setScoringResult(null);
    try {
      const all = await getAllCompaniesForExport();
      let scored = 0;
      for (const company of all) {
        const domain = (company.website || '').replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
        const vibe = quickVibeScore(domain);
        const bp = blueprintScore(company, vibe.score);
        await updateCompany({
          id: company.id,
          vibe_score: vibe.score,
          blueprint_score: bp.totalScore,
          blueprint_grade: bp.grade,
        });
        scored++;
      }
      setScoringResult(`Scored ${scored} companies with Blueprint v3 + Vibe Score`);
    } finally {
      setScoringRunning(false);
    }
  };

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: S.textPrimary, letterSpacing: '-0.02em', margin: 0 }}>
            Enrichment Lab
          </h1>
          <p style={{ fontSize: 13, color: S.textMuted, marginTop: 2 }}>
            {totalCompanies.toLocaleString()} companies in database
          </p>
        </div>
        {(singleRunning || batchRunning) && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 13, color: S.primary, fontWeight: 500,
          }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%', background: S.primary,
              animation: 'pulse 1s ease-in-out infinite', display: 'inline-block',
            }} />
            Enrichment running…
          </div>
        )}
      </div>

      {/* Blueprint/Vibe Scoring */}
      <div style={{
        background: S.card, border: `1px solid ${S.border}`,
        borderRadius: 12, padding: 20, marginBottom: 20,
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: S.textPrimary }}>
              🎯 Blueprint v3 + Vibe Scoring
            </div>
            <p style={{ fontSize: 13, color: S.textMuted, margin: '4px 0 0' }}>
              Score all companies with ICP fit (0-100) and vibe detection. Instant, no API needed.
            </p>
          </div>
          <button
            onClick={handleRunScoring}
            disabled={scoringRunning}
            className="btn-primary"
            style={{ padding: '8px 20px', fontSize: 13 }}
          >
            {scoringRunning ? 'Scoring…' : 'Run Scoring'}
          </button>
        </div>
        {scoringResult && (
          <div style={{
            marginTop: 12, padding: '8px 14px', borderRadius: 8,
            background: '#F0FDF4', border: '1px solid #BBF7D0',
            fontSize: 13, color: '#065F46', fontWeight: 500,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <CheckCircle size={14} /> {scoringResult}
          </div>
        )}
      </div>

      {/* Source cards grid */}
      <div style={{
        background: S.card, border: `1px solid ${S.border}`,
        borderRadius: 12, padding: 20, marginBottom: 20,
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: S.textPrimary }}>Enrichment Sources</div>
            <p style={{ fontSize: 13, color: S.textMuted, margin: '4px 0 0' }}>
              Select sources to run · {selectedSources.size} selected
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => {
                if (selectedSources.size === ENRICHMENT_SOURCES.length) setSelectedSources(new Set());
                else setSelectedSources(new Set(ENRICHMENT_SOURCES.map(s => s.id)));
              }}
              className="btn-secondary"
              style={{ padding: '6px 12px', fontSize: 12 }}
            >
              {selectedSources.size === ENRICHMENT_SOURCES.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 10 }}>
          {ENRICHMENT_SOURCES.map(source => (
            <SourceCard
              key={source.id}
              {...source}
              isConfigured={isSourceConfigured(source.requiresKey)}
              isSelected={selectedSources.has(source.id)}
              onToggle={() => toggleSource(source.id)}
            />
          ))}
        </div>
      </div>

      {/* Enrichment mode tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20 }}>
        {(['single', 'batch'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '10px 24px', fontSize: 14, fontWeight: 600,
              border: `1px solid ${S.border}`,
              borderBottom: activeTab === tab ? '2px solid ' + S.primary : `1px solid ${S.border}`,
              background: activeTab === tab ? S.card : S.bg,
              color: activeTab === tab ? S.primary : S.textSecondary,
              cursor: 'pointer',
              borderRadius: tab === 'single' ? '8px 0 0 0' : '0 8px 0 0',
            }}
          >
            {tab === 'single' ? '🔍 Single Company' : '📦 Batch Enrichment'}
          </button>
        ))}
      </div>

      {/* Single company enrichment */}
      {activeTab === 'single' && (
        <div style={{
          background: S.card, border: `1px solid ${S.border}`,
          borderRadius: 12, padding: 20, marginBottom: 20,
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: S.textPrimary, marginBottom: 12 }}>
            Enrich Single Company
          </div>

          {/* Search */}
          <div style={{ position: 'relative', marginBottom: 12 }}>
            <Search size={14} color={S.textMuted} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search for a company…"
              className="input-field"
              style={{ paddingLeft: 32 }}
            />
            {searchResults.length > 0 && !selectedCompany && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
                background: S.card, border: `1px solid ${S.border}`,
                borderRadius: 8, marginTop: 4, maxHeight: 200, overflowY: 'auto',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              }}>
                {searchResults.map(c => (
                  <div
                    key={c.id}
                    onClick={() => { setSelectedCompany(c); setSearchQuery(c.company_name); setSearchResults([]); }}
                    style={{
                      padding: '10px 14px', cursor: 'pointer',
                      borderBottom: `1px solid ${S.border}`,
                      fontSize: 13, color: S.textPrimary,
                    }}
                    onMouseOver={e => (e.currentTarget.style.background = S.bg)}
                    onMouseOut={e => (e.currentTarget.style.background = S.card)}
                  >
                    <strong>{c.company_name}</strong>
                    {c.industry && <span style={{ color: S.textMuted, marginLeft: 8 }}>{c.industry}</span>}
                    {c.geography && <span style={{ color: S.textMuted, marginLeft: 8 }}>{c.geography}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {selectedCompany && (
            <div style={{ marginBottom: 12, padding: '10px 14px', background: '#F0EEFF', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <span style={{ fontWeight: 700, color: S.textPrimary }}>{selectedCompany.company_name}</span>
                {selectedCompany.industry && <span style={{ color: S.textMuted, marginLeft: 8, fontSize: 13 }}>{selectedCompany.industry}</span>}
              </div>
              <button
                onClick={() => { setSelectedCompany(null); setSearchQuery(''); setSingleResults([]); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: S.textMuted }}
              >
                <XCircle size={16} />
              </button>
            </div>
          )}

          <button
            onClick={handleSingleEnrich}
            disabled={!selectedCompany || selectedSources.size === 0 || singleRunning}
            className="btn-primary"
            style={{ width: '100%', justifyContent: 'center', opacity: (!selectedCompany || selectedSources.size === 0) ? 0.5 : 1 }}
          >
            <Zap size={16} />
            {singleRunning ? 'Enriching…' : `Enrich with ${selectedSources.size} source${selectedSources.size !== 1 ? 's' : ''}`}
          </button>

          {/* Results */}
          {singleResults.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: S.textPrimary, marginBottom: 8 }}>Results</div>
              {singleResults.map((r, i) => (
                <div key={i} style={{
                  padding: '10px 14px', borderRadius: 8, marginBottom: 6,
                  background: r.error ? '#FEF2F2' : '#F0FDF4',
                  border: `1px solid ${r.error ? '#FECACA' : '#BBF7D0'}`,
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  {r.error ? <AlertCircle size={14} color={S.danger} /> : <CheckCircle size={14} color={S.success} />}
                  <span style={{ fontSize: 13, color: r.error ? '#991B1B' : '#065F46', fontWeight: 500 }}>
                    {ENRICHMENT_SOURCES.find(s => s.id === r.source)?.name || r.source}
                  </span>
                  {r.error ? (
                    <span style={{ fontSize: 12, color: '#DC2626' }}>— {r.error}</span>
                  ) : (
                    <span style={{ fontSize: 12, color: S.textMuted }}>— Updated: {r.fieldsUpdated.join(', ') || 'none'}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Batch enrichment */}
      {activeTab === 'batch' && (
        <div style={{
          background: S.card, border: `1px solid ${S.border}`,
          borderRadius: 12, padding: 20, marginBottom: 20,
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: S.textPrimary }}>Batch Enrichment</div>
              <p style={{ fontSize: 13, color: S.textMuted, margin: '4px 0 0' }}>
                Select companies and enrich them all with selected sources
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => {
                  if (batchSelected.size === batchCompanies.length) setBatchSelected(new Set());
                  else setBatchSelected(new Set(batchCompanies.map(c => c.id)));
                }}
                className="btn-secondary"
                style={{ padding: '6px 12px', fontSize: 12 }}
              >
                {batchSelected.size === batchCompanies.length ? 'Deselect All' : `Select All (${batchCompanies.length})`}
              </button>
              <button
                onClick={handleBatchEnrich}
                disabled={batchSelected.size === 0 || selectedSources.size === 0 || batchRunning}
                className="btn-primary"
                style={{ padding: '6px 16px', fontSize: 12 }}
              >
                {batchRunning ? 'Running…' : `Enrich ${batchSelected.size} Companies`}
              </button>
            </div>
          </div>

          {batchProgress && (
            <div style={{ marginBottom: 12 }}>
              <ProgressBar
                value={batchProgress.current}
                total={batchProgress.total}
                label={`${batchProgress.currentCompany} — ${batchProgress.currentSource}`}
              />
            </div>
          )}

          {/* Company list */}
          <div style={{ maxHeight: 300, overflowY: 'auto', border: `1px solid ${S.border}`, borderRadius: 8 }}>
            {batchCompanies.slice(0, 100).map((c, i) => (
              <div
                key={c.id}
                onClick={() => {
                  const next = new Set(batchSelected);
                  next.has(c.id) ? next.delete(c.id) : next.add(c.id);
                  setBatchSelected(next);
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 14px', cursor: 'pointer',
                  background: batchSelected.has(c.id) ? '#F0EEFF' : i % 2 === 0 ? S.card : S.bg,
                  borderBottom: `1px solid ${S.border}`,
                }}
              >
                <input type="checkbox" checked={batchSelected.has(c.id)} readOnly style={{ accentColor: S.primary }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: S.textPrimary, flex: 1 }}>{c.company_name}</span>
                <span style={{ fontSize: 12, color: S.textMuted }}>{c.industry || '—'}</span>
                <span style={{ fontSize: 12, color: S.textMuted }}>{c.geography || '—'}</span>
                {c.blueprint_grade && (
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4,
                    background: c.blueprint_grade === 'A' ? '#F0FDF4' : c.blueprint_grade === 'B' ? '#EEF2FF' : '#F3F4F6',
                    color: c.blueprint_grade === 'A' ? S.success : c.blueprint_grade === 'B' ? S.primary : S.textMuted,
                  }}>
                    {c.blueprint_grade}
                  </span>
                )}
              </div>
            ))}
          </div>
          {batchCompanies.length > 100 && (
            <div style={{ fontSize: 12, color: S.textMuted, marginTop: 8, textAlign: 'center' }}>
              Showing first 100 of {batchCompanies.length} companies
            </div>
          )}
        </div>
      )}

      {/* Enrichment History */}
      <div style={{
        background: S.card, border: `1px solid ${S.border}`,
        borderRadius: 12, overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${S.border}` }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: S.textPrimary }}>Enrichment History</div>
        </div>
        {history.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <Clock size={32} color={S.border} style={{ margin: '0 auto 12px' }} />
            <div style={{ fontSize: 14, color: S.textMuted }}>No enrichment history yet</div>
          </div>
        ) : (
          <div style={{ maxHeight: 300, overflowY: 'auto' }}>
            {history.map((h, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', padding: '10px 20px',
                borderBottom: i < history.length - 1 ? `1px solid ${S.border}` : 'none',
              }}>
                <div style={{ width: 8, height: 8, borderRadius: 4, background: S.success, marginRight: 12, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: S.textPrimary }}>{h.company}</span>
                  <span style={{ fontSize: 13, color: S.textMuted, marginLeft: 8 }}>— {h.source}</span>
                  {h.fields && (
                    <span style={{ fontSize: 12, color: S.primary, marginLeft: 6 }}>[{h.fields}]</span>
                  )}
                </div>
                <span style={{ fontSize: 12, color: S.textMuted }}>
                  {new Date(h.timestamp).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  );
}
