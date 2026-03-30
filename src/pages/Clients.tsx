import { useState } from 'react';
import { Link } from 'react-router-dom';
import { UserPlus, Eye, Copy, RefreshCw, Trash2, KeyRound, Check } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { addActivity } from '../lib/db';
import { formatDate } from '../lib/format';
import type { Client } from '../lib/types';
import Modal from '../components/Modal';

export default function Clients() {
  const { clients, addClient, deleteClient, updateClient } = useAppStore();
  const [showAdd, setShowAdd] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [form, setForm] = useState({
    name: '', company: '', email: '', phone: '', type: 'deal_sourcing' as Client['type'], notes: '',
  });

  const handleAdd = async () => {
    const client: Client = {
      id: crypto.randomUUID(),
      ...form,
      apiKey: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      last_accessed: '',
      notes: form.notes,
    };
    addClient(client);
    await addActivity({ type: 'client_add', description: `Added client ${client.name}`, entity_id: client.id, entity_type: 'client' });
    setShowAdd(false);
    setForm({ name: '', company: '', email: '', phone: '', type: 'deal_sourcing', notes: '' });
  };

  const handleCopy = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleRegenKey = (id: string) => {
    if (!confirm('Generate new API key? The old key will stop working.')) return;
    updateClient(id, { apiKey: crypto.randomUUID() });
  };

  const handleDelete = async (client: Client) => {
    if (!confirm(`Delete client ${client.name}?`)) return;
    deleteClient(client.id);
    await addActivity({ type: 'client_delete', description: `Deleted client ${client.name}`, entity_id: client.id, entity_type: 'client' });
  };

  const toggleReveal = (id: string) => {
    const next = new Set(revealed);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setRevealed(next);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0A2540]">Clients</h1>
          <p className="text-sm text-[#596880]">{clients.length} client{clients.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="btn-primary" onClick={() => setShowAdd(true)}><UserPlus size={16} /> Add Client</button>
      </div>

      {clients.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-[#596880]">No clients yet. Add your first client to start sharing data.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {clients.map((c) => (
            <div key={c.id} className="card space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-[#0A2540]">{c.name}</h3>
                  <p className="text-sm text-[#596880]">{c.company}</p>
                </div>
                <span className={`badge ${c.type === 'deal_sourcing' ? 'badge-blue' : 'badge-green'}`}>
                  {c.type === 'deal_sourcing' ? 'Deal Sourcing' : 'Lead Generation'}
                </span>
              </div>

              {c.email && <p className="text-sm text-[#596880]">{c.email}</p>}

              <div className="flex items-center gap-2">
                <KeyRound size={14} className="text-[#596880]" />
                <code className="text-xs bg-[#F6F9FC] px-2 py-1 rounded font-mono flex-1 truncate">
                  {revealed.has(c.id) ? c.apiKey : '••••••••-••••-••••-••••-••••••••••••'}
                </code>
                <button onClick={() => toggleReveal(c.id)} className="text-xs text-[#635BFF] hover:underline">
                  {revealed.has(c.id) ? 'Hide' : 'Show'}
                </button>
                <button onClick={() => handleCopy(c.apiKey)} className="p-1 text-[#596880] hover:text-[#635BFF]">
                  {copied === c.apiKey ? <Check size={14} className="text-[#00D4AA]" /> : <Copy size={14} />}
                </button>
              </div>

              <div className="flex items-center gap-2 text-xs text-[#596880]">
                <span>Created {formatDate(c.created_at)}</span>
                {c.last_accessed && <span>• Last access {formatDate(c.last_accessed)}</span>}
              </div>

              <div className="flex gap-2 pt-2 border-t border-[#E3E8EE]">
                <Link to={`/clients/${c.id}`} className="btn-secondary !py-1.5 !px-3 text-xs"><Eye size={14} /> View</Link>
                <button className="btn-secondary !py-1.5 !px-3 text-xs" onClick={() => handleRegenKey(c.id)}><RefreshCw size={14} /> New Key</button>
                <button className="btn-danger !py-1.5 !px-3 text-xs" onClick={() => handleDelete(c)}><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Client">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#596880] mb-1">Name *</label>
            <input className="input-field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#596880] mb-1">Company *</label>
            <input className="input-field" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#596880] mb-1">Email</label>
            <input className="input-field" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#596880] mb-1">Phone</label>
            <input className="input-field" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#596880] mb-1">Type</label>
            <select className="input-field" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as Client['type'] })}>
              <option value="deal_sourcing">Deal Sourcing</option>
              <option value="lead_generation">Lead Generation</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#596880] mb-1">Notes</label>
            <textarea className="input-field min-h-[80px]" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <button className="btn-primary w-full" onClick={handleAdd} disabled={!form.name || !form.company}>Add Client</button>
        </div>
      </Modal>
    </div>
  );
}
