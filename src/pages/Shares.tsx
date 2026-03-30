import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Trash2, Eye, Search } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { getCompaniesPage, assignCompaniesToClient, addActivity } from '../lib/db';
import { formatDate } from '../lib/format';
import type { CompanyFilters } from '../lib/types';
import Modal from '../components/Modal';

export default function Shares() {
  const { clients, shares, addShare, deleteShare } = useAppStore();
  const [showCreate, setShowCreate] = useState(false);
  const [clientId, setClientId] = useState('');
  const [shareName, setShareName] = useState('');
  const [search, setSearch] = useState('');
  const [industry, setIndustry] = useState('');
  const [geography, setGeography] = useState('');
  const [revenueMin, setRevenueMin] = useState('');
  const [matchCount, setMatchCount] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);

  const handlePreview = async () => {
    const filters: CompanyFilters = {
      search, industry, geography, revenueMin, revenueMax: '',
      employeesMin: '', employeesMax: '', status: '', tags: [], source: '',
    };
    const result = await getCompaniesPage(1, 1, filters);
    setMatchCount(result.total);
  };

  const handleCreate = async () => {
    if (!clientId || !shareName) return;
    setCreating(true);

    const filters: CompanyFilters = {
      search, industry, geography, revenueMin, revenueMax: '',
      employeesMin: '', employeesMax: '', status: '', tags: [], source: '',
    };

    // Get all matching company IDs (iterate pages)
    const allIds: string[] = [];
    let page = 1;
    const pageSize = 5000;
    while (true) {
      const result = await getCompaniesPage(page, pageSize, filters);
      allIds.push(...result.companies.map((c) => c.id));
      if (allIds.length >= result.total) break;
      page++;
    }

    const count = await assignCompaniesToClient(allIds, clientId);
    const client = clients.find((c) => c.id === clientId);

    addShare({
      id: crypto.randomUUID(),
      name: shareName,
      client_id: clientId,
      company_count: count,
      filters: { search, industry, geography, revenueMin },
      created_at: new Date().toISOString(),
    });

    await addActivity({
      type: 'share',
      description: `Created share "${shareName}" — ${count} companies shared with ${client?.name || 'client'}`,
      entity_id: clientId,
      entity_type: 'share',
    });

    setShowCreate(false);
    setCreating(false);
    setClientId('');
    setShareName('');
    setSearch('');
    setIndustry('');
    setGeography('');
    setRevenueMin('');
    setMatchCount(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Revoke this share?')) return;
    deleteShare(id);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0A2540]">Shares</h1>
          <p className="text-sm text-[#596880]">{shares.length} active share{shares.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="btn-primary" onClick={() => setShowCreate(true)}><Plus size={16} /> Create Share</button>
      </div>

      {shares.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-[#596880]">No shares yet. Create a share to give clients access to company data.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {shares.map((s) => {
            const client = clients.find((c) => c.id === s.client_id);
            return (
              <div key={s.id} className="card flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-[#0A2540]">{s.name}</h3>
                  <div className="flex items-center gap-3 mt-1 text-sm text-[#596880]">
                    <span>Client: {client?.name || 'Unknown'}</span>
                    <span>•</span>
                    <span>{s.company_count} companies</span>
                    <span>•</span>
                    <span>{formatDate(s.created_at)}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  {client && (
                    <Link to={`/clients/${client.id}`} className="btn-secondary !py-1.5 !px-3 text-xs"><Eye size={14} /> View</Link>
                  )}
                  <button className="btn-danger !py-1.5 !px-3 text-xs" onClick={() => handleDelete(s.id)}><Trash2 size={14} /> Revoke</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Share" wide>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#596880] mb-1">Share Name *</label>
            <input className="input-field" placeholder="e.g. US Software Companies $10M+ Revenue" value={shareName} onChange={(e) => setShareName(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#596880] mb-1">Client *</label>
            <select className="input-field" value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">Select client...</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.company})</option>)}
            </select>
          </div>

          <div className="border-t border-[#E3E8EE] pt-4">
            <h3 className="text-sm font-semibold text-[#0A2540] mb-3">Filter Companies</h3>
            <div className="grid grid-cols-2 gap-3">
              <input className="input-field" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} />
              <input className="input-field" placeholder="Industry" value={industry} onChange={(e) => setIndustry(e.target.value)} />
              <input className="input-field" placeholder="Geography" value={geography} onChange={(e) => setGeography(e.target.value)} />
              <input className="input-field" placeholder="Min Revenue" value={revenueMin} onChange={(e) => setRevenueMin(e.target.value)} />
            </div>
            <button className="btn-secondary !py-1.5 !px-3 text-xs mt-3" onClick={handlePreview}>
              <Search size={14} /> Preview Results
            </button>
            {matchCount !== null && (
              <p className="text-sm text-[#635BFF] font-medium mt-2">{matchCount.toLocaleString()} companies match your criteria</p>
            )}
          </div>

          <button
            className="btn-primary w-full"
            onClick={handleCreate}
            disabled={!clientId || !shareName || creating}
          >
            {creating ? 'Creating...' : 'Create Share'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
