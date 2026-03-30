import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Save, Trash2, Download, Upload, ArrowRight, Plus, X, Pencil } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { clearAllCompanies, getAllCompaniesForExport, bulkInsertCompanies, getCompaniesPage, updateCompany } from '../lib/db';
import { qualifyCompanyWithCriteria } from '../lib/qualificationService';
import type { QualificationCriteria, CustomColumn } from '../lib/types';
import * as XLSX from 'xlsx';

export default function Settings() {
  const { settings, updateSettings, customColumns, addCustomColumn, updateCustomColumn, removeCustomColumn } = useAppStore();
  const [saved, setSaved] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleClearAll = async () => {
    if (!confirm('Delete ALL companies from the database? This cannot be undone.')) return;
    if (!confirm('Are you really sure?')) return;
    await clearAllCompanies();
    alert('All companies deleted.');
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const companies = await getAllCompaniesForExport();
      const ws = XLSX.utils.json_to_sheet(companies);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Companies');
      XLSX.writeFile(wb, 'dealflow-full-export.xlsx');
    } finally {
      setExporting(false);
    }
  };

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (Array.isArray(data)) {
          await bulkInsertCompanies(data);
          alert(`Imported ${data.length} companies from backup.`);
        }
      } catch {
        alert('Invalid backup file.');
      }
    };
    reader.readAsText(file);
  };

  const qualConfig = settings.qualificationConfig;

  const updateQualConfig = (updates: Partial<typeof qualConfig>) => {
    updateSettings({ qualificationConfig: { ...qualConfig, ...updates } });
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-[#0A2540]">Settings</h1>
        <p className="text-sm text-[#596880] mt-1">Configure DealFlow</p>
      </div>

      {/* AI Config */}
      <div className="card space-y-4">
        <h2 className="text-base font-semibold text-[#0A2540]">🤖 AI Configuration</h2>
        <div>
          <label className="block text-sm font-medium text-[#596880] mb-1">Provider</label>
          <select className="input-field" value={settings.aiProvider} onChange={(e) => updateSettings({ aiProvider: e.target.value })}>
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic (Claude)</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-[#596880] mb-1">API Key</label>
          <input
            className="input-field"
            type="password"
            placeholder={settings.aiProvider === 'openai' ? 'sk-...' : 'sk-ant-...'}
            value={settings.aiApiKey}
            onChange={(e) => updateSettings({ aiApiKey: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[#596880] mb-1">Model</label>
          <select className="input-field" value={settings.aiModel} onChange={(e) => updateSettings({ aiModel: e.target.value })}>
            {settings.aiProvider === 'openai' ? (
              <>
                <option value="gpt-4o">GPT-4o</option>
                <option value="gpt-4o-mini">GPT-4o Mini</option>
                <option value="gpt-4-turbo">GPT-4 Turbo</option>
              </>
            ) : (
              <>
                <option value="claude-sonnet-4-20250514">Claude Sonnet 4</option>
                <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</option>
                <option value="claude-3-haiku-20240307">Claude 3 Haiku</option>
              </>
            )}
          </select>
        </div>
      </div>

      {/* Integration Keys */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-[#0A2540]">🔌 API Integrations</h2>
          <Link to="/integrations" className="text-sm text-[#635BFF] hover:underline inline-flex items-center gap-1">
            Manage Integrations <ArrowRight size={14} />
          </Link>
        </div>
        <p className="text-sm text-[#596880]">
          API keys for Apollo, Hunter, and other services are now managed from the 
          <Link to="/integrations" className="text-[#635BFF] hover:underline mx-1">Integrations page</Link>. 
          Add, remove, and test any API integration dynamically.
        </p>
        <p className="text-xs text-[#9CA3AF]">
          Legacy keys below still work for backward compatibility.
        </p>
        <div>
          <label className="block text-sm font-medium text-[#596880] mb-1">Apollo.io API Key (legacy)</label>
          <input
            className="input-field"
            type="password"
            placeholder="Apollo API key..."
            value={settings.apolloApiKey}
            onChange={(e) => updateSettings({ apolloApiKey: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[#596880] mb-1">Hunter.io API Key (legacy)</label>
          <input
            className="input-field"
            type="password"
            placeholder="Hunter API key..."
            value={settings.hunterApiKey}
            onChange={(e) => updateSettings({ hunterApiKey: e.target.value })}
          />
        </div>
      </div>

      {/* Qualification Config */}
      <div className="card space-y-4">
        <h2 className="text-base font-semibold text-[#0A2540]">✅ Qualification Criteria</h2>
        <p className="text-sm text-[#596880]">Choose which criteria are required to qualify a company.</p>
        <div className="space-y-3">
          {[
            { key: 'requireWebsite' as const, label: 'Has website' },
            { key: 'requireDescription' as const, label: 'Has description' },
            { key: 'requireRevenue' as const, label: 'Has revenue data' },
            { key: 'requireEmployees' as const, label: 'Has employee count' },
            { key: 'requireContacts' as const, label: 'Has director/contact info' },
          ].map(({ key, label }) => (
            <label key={key} className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                className="rounded"
                checked={qualConfig[key]}
                onChange={(e) => updateQualConfig({ [key]: e.target.checked })}
              />
              <span className="text-[#0A2540]">{label}</span>
            </label>
          ))}
        </div>
        <div>
          <label className="block text-sm font-medium text-[#596880] mb-1">Minimum Score for "Qualified" Status</label>
          <input
            className="input-field w-32"
            type="number"
            min={0}
            max={100}
            value={qualConfig.minScore}
            onChange={(e) => updateQualConfig({ minScore: parseInt(e.target.value) || 0 })}
          />
        </div>
        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            className="rounded"
            checked={qualConfig.autoQualifyOnUpload}
            onChange={(e) => updateQualConfig({ autoQualifyOnUpload: e.target.checked })}
          />
          <span className="text-[#0A2540]">Auto-qualify companies on upload</span>
        </label>
      </div>

      {/* API Settings */}
      <div className="card space-y-4">
        <h2 className="text-base font-semibold text-[#0A2540]">API Settings</h2>
        <div>
          <label className="block text-sm font-medium text-[#596880] mb-1">Base URL</label>
          <input
            className="input-field"
            placeholder="https://your-app.netlify.app"
            value={settings.apiBaseUrl}
            onChange={(e) => updateSettings({ apiBaseUrl: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[#596880] mb-1">Default Response Format</label>
          <select className="input-field" value={settings.defaultFormat} onChange={(e) => updateSettings({ defaultFormat: e.target.value })}>
            <option value="json">JSON</option>
            <option value="csv">CSV</option>
          </select>
        </div>
      </div>

      {/* Data Management */}
      <div className="card space-y-4">
        <h2 className="text-base font-semibold text-[#0A2540]">Data Management</h2>
        <div className="flex flex-wrap gap-3">
          <button className="btn-secondary" onClick={handleExport} disabled={exporting}>
            <Download size={16} /> {exporting ? 'Exporting...' : 'Export Full Database'}
          </button>
          <label className="btn-secondary cursor-pointer">
            <Upload size={16} /> Import Backup
            <input type="file" accept=".json" className="hidden" onChange={handleImportBackup} />
          </label>
          <button className="btn-danger" onClick={handleClearAll}>
            <Trash2 size={16} /> Clear All Companies
          </button>
        </div>
      </div>

      {/* Custom Columns */}
      <CustomColumnsSection
        columns={customColumns}
        onAdd={addCustomColumn}
        onUpdate={updateCustomColumn}
        onRemove={removeCustomColumn}
      />

      <button className="btn-primary" onClick={handleSave}>
        <Save size={16} /> {saved ? 'Saved ✓' : 'Save Settings'}
      </button>
    </div>
  );
}

function CustomColumnsSection({ columns, onAdd, onUpdate, onRemove }: {
  columns: CustomColumn[];
  onAdd: (col: CustomColumn) => void;
  onUpdate: (id: string, u: Partial<CustomColumn>) => void;
  onRemove: (id: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [type, setType] = useState<CustomColumn['type']>('text');
  const [options, setOptions] = useState('');

  function handleAdd() {
    if (!label.trim()) return;
    const key = 'custom_' + label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
    onAdd({
      id: crypto.randomUUID(),
      key,
      label: label.trim(),
      type,
      options: type === 'select' ? options.split(',').map(o => o.trim()).filter(Boolean) : undefined,
      created_at: new Date().toISOString(),
    });
    setLabel(''); setType('text'); setOptions(''); setAdding(false);
  }

  function startEdit(col: CustomColumn) {
    setEditId(col.id);
    setLabel(col.label);
    setType(col.type);
    setOptions(col.options?.join(', ') || '');
  }

  function handleUpdate() {
    if (!editId || !label.trim()) return;
    onUpdate(editId, {
      label: label.trim(),
      type,
      options: type === 'select' ? options.split(',').map(o => o.trim()).filter(Boolean) : undefined,
    });
    setEditId(null); setLabel(''); setType('text'); setOptions('');
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-[#0A2540]">Custom Columns</h2>
        <button className="btn-secondary text-xs" onClick={() => { setAdding(true); setEditId(null); setLabel(''); setType('text'); setOptions(''); }}>
          <Plus size={14} /> Add Column
        </button>
      </div>

      {(adding || editId) && (
        <div className="flex items-end gap-3 mb-4 p-3 bg-[#F6F9FC] rounded-lg border border-[#E3E8EE]">
          <div className="flex-1">
            <label className="text-xs text-[#596880] block mb-1">Label</label>
            <input className="input-field text-sm" value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. LinkedIn URL" />
          </div>
          <div>
            <label className="text-xs text-[#596880] block mb-1">Type</label>
            <select className="input-field text-sm" value={type} onChange={e => setType(e.target.value as CustomColumn['type'])}>
              <option value="text">Text</option>
              <option value="number">Number</option>
              <option value="url">URL</option>
              <option value="date">Date</option>
              <option value="boolean">Yes/No</option>
              <option value="select">Select</option>
            </select>
          </div>
          {type === 'select' && (
            <div className="flex-1">
              <label className="text-xs text-[#596880] block mb-1">Options (comma separated)</label>
              <input className="input-field text-sm" value={options} onChange={e => setOptions(e.target.value)} placeholder="Option 1, Option 2" />
            </div>
          )}
          <button className="btn-primary text-xs" onClick={editId ? handleUpdate : handleAdd}>
            {editId ? 'Update' : 'Add'}
          </button>
          <button className="text-xs text-[#8898aa] hover:text-[#0A2540]" onClick={() => { setAdding(false); setEditId(null); }}>
            Cancel
          </button>
        </div>
      )}

      {columns.length === 0 && !adding ? (
        <p className="text-sm text-[#8898aa]">No custom columns defined. Add columns here or create them during file upload.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#E3E8EE]">
              <th className="text-left p-2 text-[#596880] font-medium">Label</th>
              <th className="text-left p-2 text-[#596880] font-medium">Key</th>
              <th className="text-left p-2 text-[#596880] font-medium">Type</th>
              <th className="text-left p-2 text-[#596880] font-medium">Options</th>
              <th className="text-right p-2 text-[#596880] font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {columns.map(col => (
              <tr key={col.id} className="border-b border-[#E3E8EE]">
                <td className="p-2 text-[#0A2540]">{col.label}</td>
                <td className="p-2 text-[#8898aa] font-mono text-xs">{col.key}</td>
                <td className="p-2 text-[#596880] capitalize">{col.type}</td>
                <td className="p-2 text-[#8898aa] text-xs">{col.options?.join(', ') || '—'}</td>
                <td className="p-2 text-right">
                  <button className="text-[#635BFF] hover:underline text-xs mr-2" onClick={() => startEdit(col)}>
                    <Pencil size={12} />
                  </button>
                  <button className="text-red-500 hover:underline text-xs" onClick={() => { if (confirm(`Delete "${col.label}"?`)) onRemove(col.id); }}>
                    <Trash2 size={12} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
