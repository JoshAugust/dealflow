import { useState, useEffect } from 'react';
import {
  Shield, Play, Save, Plus, Trash2, ChevronDown, ChevronRight,
  Loader2, Settings2, Users, Pencil, Check, X
} from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { getCompaniesPage, updateCompany } from '../lib/db';
import { qualifyCompanyWithCriteria } from '../lib/qualificationService';
import type { Company, QualificationCriteria } from '../lib/types';

const DEFAULT_WEIGHTS = {
  revenue: 15, employees: 15, company_age: 10, industry: 20,
  linkedin: 10, website: 15, geography: 15,
};

const EMPTY_CRITERIA: QualificationCriteria = {
  id: '',
  clientId: '',
  name: 'New Criteria',
  website_preference: 'any' as const,
  weights: DEFAULT_WEIGHTS,
  auto_qualify_score: 70,
  auto_reject_score: 30,
  created_at: new Date().toISOString(),
};

export default function Qualification() {
  const {
    clients, qualificationCriteria, addQualificationCriteria,
    updateQualificationCriteria, deleteQualificationCriteria,
  } = useAppStore();

  const [selectedClientId, setSelectedClientId] = useState('');
  const [editing, setEditing] = useState<QualificationCriteria | null>(null);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<{ company: Company; score: number; status: string; breakdown: { criterion: string; score: number; weight: number; reason: string }[] }[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [filter, setFilter] = useState<'all' | 'qualified' | 'unqualified' | 'review'>('all');

  const clientCriteria = qualificationCriteria.filter(c => c.clientId === selectedClientId);

  function startEditing(criteria?: QualificationCriteria) {
    if (criteria) {
      setEditing({ ...criteria });
    } else {
      setEditing({ ...EMPTY_CRITERIA, id: crypto.randomUUID(), clientId: selectedClientId });
    }
  }

  function saveCriteria() {
    if (!editing) return;
    const existing = qualificationCriteria.find(c => c.id === editing.id);
    if (existing) {
      updateQualificationCriteria(editing.id, editing);
    } else {
      addQualificationCriteria(editing);
    }
    setEditing(null);
  }

  const [error, setError] = useState<string | null>(null);

  async function runQualification(criteria: QualificationCriteria) {
    setRunning(true);
    setResults([]);
    setError(null);

    try {
      const { companies } = await getCompaniesPage(1, 100000, {
        search: '', industry: '', geography: '', revenueMin: '', revenueMax: '',
        employeesMin: '', employeesMax: '', status: '' as any, tags: [],
      });

      // Filter to client's companies if client selected
      const toQualify = selectedClientId
        ? companies.filter(c => c.client_ids?.includes(selectedClientId))
        : companies;

      if (toQualify.length === 0) {
        setError(selectedClientId
          ? 'No companies found assigned to this client. Upload companies first and assign them to the client.'
          : 'No companies found in the database. Upload companies first via the Upload page.');
        setRunning(false);
        return;
      }

      setProgress({ current: 0, total: toQualify.length });
      const out: typeof results = [];

      for (let i = 0; i < toQualify.length; i++) {
        try {
          const result = await qualifyCompanyWithCriteria(toQualify[i], criteria);
          out.push({
            company: toQualify[i],
            score: result.score,
            status: result.status,
            breakdown: result.breakdown,
          });

          // Save score back
          await updateCompany({
            id: toQualify[i].id,
            qualification_score: result.score,
            qualification_status: result.status as 'qualified' | 'unqualified' | 'review',
            qualification_result: result,
          });
        } catch (err) {
          console.error(`Failed to qualify ${toQualify[i].company_name}:`, err);
          out.push({
            company: toQualify[i],
            score: 0,
            status: 'review',
            breakdown: [{ criterion: 'Error', score: 0, weight: 0, reason: String(err) }],
          });
        }

        if (i % 25 === 0) {
          setProgress({ current: i, total: toQualify.length });
          setResults([...out]);
        }
      }

      setResults(out);
      setProgress({ current: toQualify.length, total: toQualify.length });
    } catch (err) {
      console.error('Qualification error:', err);
      setError(`Qualification failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setRunning(false);
    }
  }

  const filteredResults = filter === 'all' ? results : results.filter(r => r.status === filter);
  const qualified = results.filter(r => r.status === 'qualified').length;
  const unqualified = results.filter(r => r.status === 'unqualified').length;
  const review = results.filter(r => r.status === 'review').length;

  const statusColor = (s: string) =>
    s === 'qualified' ? '#059669' : s === 'unqualified' ? '#E25950' : '#F59E0B';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield size={24} className="text-[#635BFF]" />
          <div>
            <h1 className="text-xl font-bold text-[#0A2540]">Qualification Engine</h1>
            <p className="text-sm text-[#596880]">Score companies against configurable criteria per client</p>
          </div>
        </div>
      </div>

      {/* Client Selector */}
      <div className="card">
        <div className="flex items-center gap-4 mb-4">
          <Users size={16} className="text-[#596880]" />
          <select
            className="input-field flex-1"
            value={selectedClientId}
            onChange={e => setSelectedClientId(e.target.value)}
          >
            <option value="">All Companies (no client filter)</option>
            {clients.map(c => (
              <option key={c.id} value={c.id}>{c.name} — {c.company}</option>
            ))}
          </select>
          <button className="btn-primary text-sm" onClick={() => startEditing()}>
            <Plus size={14} /> New Criteria
          </button>
        </div>

        {/* Saved Criteria for this client */}
        {clientCriteria.length > 0 && (
          <div className="space-y-2 mb-4">
            <p className="text-xs text-[#596880] font-medium uppercase tracking-wider">Saved Criteria</p>
            {clientCriteria.map(c => (
              <div key={c.id} className="flex items-center justify-between p-3 bg-[#F6F9FC] rounded-lg border border-[#E3E8EE]">
                <div>
                  <span className="text-sm font-semibold text-[#0A2540]">{c.name}</span>
                  <span className="text-xs text-[#8898aa] ml-3">
                    Auto-qualify ≥{c.auto_qualify_score} · Reject ≤{c.auto_reject_score}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button className="btn-primary text-xs" onClick={() => runQualification(c)} disabled={running}>
                    <Play size={12} /> Run
                  </button>
                  <button className="btn-secondary text-xs" onClick={() => startEditing(c)}>
                    <Pencil size={12} />
                  </button>
                  <button className="text-xs text-red-500 hover:underline px-2" onClick={() => {
                    if (confirm(`Delete "${c.name}"?`)) deleteQualificationCriteria(c.id);
                  }}>
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {clientCriteria.length === 0 && !editing && (
          <p className="text-sm text-[#8898aa] text-center py-4">
            No qualification criteria yet. Click "New Criteria" to create one.
          </p>
        )}
      </div>

      {/* Criteria Editor */}
      {editing && (
        <div className="card border-[#635BFF]/20">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-[#0A2540] flex items-center gap-2">
              <Settings2 size={16} className="text-[#635BFF]" />
              {editing.id && qualificationCriteria.find(c => c.id === editing.id) ? 'Edit' : 'New'} Criteria
            </h2>
            <div className="flex gap-2">
              <button className="btn-primary text-sm" onClick={saveCriteria}>
                <Save size={14} /> Save
              </button>
              <button className="btn-secondary text-sm" onClick={() => setEditing(null)}>
                <X size={14} /> Cancel
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-[#596880] mb-1">Profile Name</label>
              <input className="input-field" value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-[#596880] mb-1">Website Preference</label>
              <select className="input-field" value={editing.website_preference} onChange={e => setEditing({ ...editing, website_preference: e.target.value as 'professional' | 'non-professional' | 'any' })}>
                <option value="any">Any</option>
                <option value="professional">Professional</option>
                <option value="non-professional">Non-Professional (scores higher)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#596880] mb-1">Min Revenue</label>
              <input className="input-field" type="number" value={editing.revenue_min ?? ''} onChange={e => setEditing({ ...editing, revenue_min: e.target.value ? Number(e.target.value) : undefined })} placeholder="Any" />
            </div>
            <div>
              <label className="block text-xs text-[#596880] mb-1">Max Revenue</label>
              <input className="input-field" type="number" value={editing.revenue_max ?? ''} onChange={e => setEditing({ ...editing, revenue_max: e.target.value ? Number(e.target.value) : undefined })} placeholder="Any" />
            </div>
            <div>
              <label className="block text-xs text-[#596880] mb-1">Min Employees</label>
              <input className="input-field" type="number" value={editing.employees_min ?? ''} onChange={e => setEditing({ ...editing, employees_min: e.target.value ? Number(e.target.value) : undefined })} placeholder="Any" />
            </div>
            <div>
              <label className="block text-xs text-[#596880] mb-1">Max Employees</label>
              <input className="input-field" type="number" value={editing.employees_max ?? ''} onChange={e => setEditing({ ...editing, employees_max: e.target.value ? Number(e.target.value) : undefined })} placeholder="Any" />
            </div>
            <div>
              <label className="block text-xs text-[#596880] mb-1">Min Years Old</label>
              <input className="input-field" type="number" value={editing.min_years_incorporated ?? ''} onChange={e => setEditing({ ...editing, min_years_incorporated: e.target.value ? Number(e.target.value) : undefined })} placeholder="Any" />
            </div>
            <div>
              <label className="block text-xs text-[#596880] mb-1">Max Years Old</label>
              <input className="input-field" type="number" value={editing.max_years_incorporated ?? ''} onChange={e => setEditing({ ...editing, max_years_incorporated: e.target.value ? Number(e.target.value) : undefined })} placeholder="Any" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-[#596880] mb-1">Target Industries (comma-separated)</label>
              <input className="input-field" value={editing.target_industries?.join(', ') || ''} onChange={e => setEditing({ ...editing, target_industries: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} placeholder="e.g. Software, SaaS, Fintech" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-[#596880] mb-1">Target Geographies (comma-separated)</label>
              <input className="input-field" value={editing.target_geographies?.join(', ') || ''} onChange={e => setEditing({ ...editing, target_geographies: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} placeholder="e.g. United Kingdom, London" />
            </div>
            <div>
              <label className="block text-xs text-[#596880] mb-1">Auto-Qualify Score (≥)</label>
              <input className="input-field" type="number" min={0} max={100} value={editing.auto_qualify_score} onChange={e => setEditing({ ...editing, auto_qualify_score: Number(e.target.value) })} />
            </div>
            <div>
              <label className="block text-xs text-[#596880] mb-1">Auto-Reject Score (≤)</label>
              <input className="input-field" type="number" min={0} max={100} value={editing.auto_reject_score} onChange={e => setEditing({ ...editing, auto_reject_score: Number(e.target.value) })} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-[#596880] mb-2">Weights</label>
              <div className="flex gap-3 flex-wrap">
                {Object.entries(editing.weights || DEFAULT_WEIGHTS).map(([k, v]) => (
                  <div key={k} className="text-center">
                    <label className="text-[10px] text-[#8898aa] capitalize block">{k.replace('_', ' ')}</label>
                    <input type="number" min={0} max={100} value={v}
                      className="w-16 text-center input-field text-sm"
                      onChange={e => setEditing({ ...editing, weights: { ...(editing.weights || DEFAULT_WEIGHTS), [k]: Number(e.target.value) } })} />
                  </div>
                ))}
              </div>
            </div>
            <div className="col-span-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={editing.require_linkedin || false} onChange={e => setEditing({ ...editing, require_linkedin: e.target.checked })} />
                <span className="text-[#0A2540]">Require LinkedIn presence</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="card border-[#E25950]/30 bg-[#FEF2F2]">
          <p className="text-sm text-[#E25950] font-medium">{error}</p>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="card">
          <div className="flex gap-4 mb-4">
            {[
              { label: 'Qualified', count: qualified, color: '#059669', value: 'qualified' as const },
              { label: 'Review', count: review, color: '#F59E0B', value: 'review' as const },
              { label: 'Unqualified', count: unqualified, color: '#E25950', value: 'unqualified' as const },
            ].map(s => (
              <button
                key={s.value}
                onClick={() => setFilter(filter === s.value ? 'all' : s.value)}
                className={`flex-1 rounded-lg border p-3 text-center cursor-pointer transition-all ${filter === s.value ? 'ring-2 ring-offset-1' : ''}`}
                style={{
                  background: s.color + '10', borderColor: s.color + '30',
                  ...(filter === s.value ? { ringColor: s.color } : {}),
                }}
              >
                <div className="text-2xl font-bold" style={{ color: s.color }}>{s.count}</div>
                <div className="text-xs text-[#596880]">{s.label}</div>
              </button>
            ))}
          </div>

          {running && (
            <div className="flex items-center gap-3 mb-4 text-sm text-[#596880]">
              <Loader2 size={14} className="animate-spin text-[#635BFF]" />
              {progress.current} / {progress.total} companies processed
            </div>
          )}

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E3E8EE]">
                <th className="text-left p-2 text-[#596880] font-medium">Company</th>
                <th className="text-left p-2 text-[#596880] font-medium">Industry</th>
                <th className="text-center p-2 text-[#596880] font-medium">Score</th>
                <th className="text-center p-2 text-[#596880] font-medium">Status</th>
                <th className="text-center p-2 text-[#596880] font-medium w-8"></th>
              </tr>
            </thead>
            <tbody>
              {filteredResults.slice(0, 200).map(r => (
                <>
                  <tr key={r.company.id} className="border-b border-[#F0F2F5] cursor-pointer hover:bg-[#F6F9FC]"
                    onClick={() => setExpandedId(expandedId === r.company.id ? null : r.company.id)}>
                    <td className="p-2 font-medium text-[#0A2540]">{r.company.company_name}</td>
                    <td className="p-2 text-[#596880]">{r.company.industry || '—'}</td>
                    <td className="p-2 text-center font-bold" style={{ color: statusColor(r.status) }}>{r.score}</td>
                    <td className="p-2 text-center">
                      <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                        style={{ color: statusColor(r.status), background: statusColor(r.status) + '15' }}>
                        {r.status}
                      </span>
                    </td>
                    <td className="p-2 text-center text-[#8898aa]">
                      {expandedId === r.company.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </td>
                  </tr>
                  {expandedId === r.company.id && (
                    <tr key={`${r.company.id}-bd`}>
                      <td colSpan={5} className="p-3 bg-[#F6F9FC]">
                        <div className="grid grid-cols-4 gap-2">
                          {r.breakdown.map(b => (
                            <div key={b.criterion} className="bg-white border border-[#E3E8EE] rounded-lg p-3">
                              <div className="text-[10px] text-[#8898aa] mb-1">{b.criterion}</div>
                              <div className="flex justify-between items-center">
                                <span className="text-lg font-bold" style={{ color: b.score >= 70 ? '#059669' : b.score >= 40 ? '#F59E0B' : '#E25950' }}>{b.score}</span>
                                <span className="text-[10px] text-[#8898aa]">w:{b.weight}</span>
                              </div>
                              <div className="text-[11px] text-[#596880] mt-1 truncate">{b.reason}</div>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
          {filteredResults.length > 200 && (
            <p className="text-xs text-[#8898aa] text-center py-3">Showing first 200 of {filteredResults.length}</p>
          )}
        </div>
      )}
    </div>
  );
}
