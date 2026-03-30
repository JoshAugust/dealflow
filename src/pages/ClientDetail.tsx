import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Copy, RefreshCw, KeyRound, Check, Download, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { getCompaniesByClientId, removeCompanyFromClient } from '../lib/db';
import { formatCurrency, formatNumber, formatDate } from '../lib/format';
import type { Company } from '../lib/types';
import * as XLSX from 'xlsx';

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const { clients, updateClient } = useAppStore();
  const client = clients.find((c) => c.id === id);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [copied, setCopied] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const loadCompanies = useCallback(async () => {
    if (!id) return;
    const result = await getCompaniesByClientId(id, page, 50);
    setCompanies(result.companies);
    setTotal(result.total);
  }, [id, page]);

  useEffect(() => { loadCompanies(); }, [loadCompanies]);

  if (!client) {
    return <div className="text-center py-12 text-[#596880]">Client not found</div>;
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(client.apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRegen = () => {
    if (!confirm('Generate new API key?')) return;
    updateClient(client.id, { apiKey: crypto.randomUUID() });
  };

  const handleRemoveCompany = async (companyId: string) => {
    await removeCompanyFromClient(companyId, client.id);
    loadCompanies();
  };

  const exportData = (format: 'csv' | 'xlsx' | 'json') => {
    if (format === 'json') {
      const blob = new Blob([JSON.stringify(companies, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${client.name}-companies.json`; a.click();
    } else if (format === 'xlsx') {
      const ws = XLSX.utils.json_to_sheet(companies.map(c => ({
        'Company Name': c.company_name, Industry: c.industry, Geography: c.geography,
        Employees: c.employees, Revenue: c.revenue, 'P/L Before Tax': c.profit_before_tax,
        'Total Assets': c.total_assets, Equity: c.equity, Website: c.website,
      })));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Companies');
      XLSX.writeFile(wb, `${client.name}-companies.xlsx`);
    } else {
      const ws = XLSX.utils.json_to_sheet(companies.map(c => ({
        'Company Name': c.company_name, Industry: c.industry, Geography: c.geography,
        Employees: c.employees, Revenue: c.revenue, Website: c.website,
      })));
      const csv = XLSX.utils.sheet_to_csv(ws);
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${client.name}-companies.csv`; a.click();
    }
  };

  const totalPages = Math.ceil(total / 50);

  return (
    <div className="space-y-6">
      <Link to="/clients" className="inline-flex items-center gap-2 text-sm text-[#596880] hover:text-[#635BFF]">
        <ArrowLeft size={16} /> Back to Clients
      </Link>

      {/* Client Info */}
      <div className="card">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#0A2540]">{client.name}</h1>
            <p className="text-sm text-[#596880]">{client.company}</p>
            {client.email && <p className="text-sm text-[#596880] mt-1">{client.email}</p>}
            {client.phone && <p className="text-sm text-[#596880]">{client.phone}</p>}
          </div>
          <span className={`badge ${client.type === 'deal_sourcing' ? 'badge-blue' : 'badge-green'}`}>
            {client.type === 'deal_sourcing' ? 'Deal Sourcing' : 'Lead Generation'}
          </span>
        </div>
      </div>

      {/* API Key */}
      <div className="card">
        <h2 className="text-base font-semibold text-[#0A2540] mb-3">API Key</h2>
        <div className="flex items-center gap-2 mb-4">
          <KeyRound size={16} className="text-[#596880]" />
          <code className="text-sm bg-[#F6F9FC] px-3 py-2 rounded font-mono flex-1">
            {revealed ? client.apiKey : '••••••••-••••-••••-••••-••••••••••••'}
          </code>
          <button onClick={() => setRevealed(!revealed)} className="btn-secondary !py-1.5 !px-3 text-xs">
            {revealed ? 'Hide' : 'Reveal'}
          </button>
          <button onClick={handleCopy} className="btn-secondary !py-1.5 !px-3 text-xs">
            {copied ? <Check size={14} className="text-[#00D4AA]" /> : <Copy size={14} />} Copy
          </button>
          <button onClick={handleRegen} className="btn-secondary !py-1.5 !px-3 text-xs">
            <RefreshCw size={14} /> Regenerate
          </button>
        </div>

        <div className="bg-[#F6F9FC] rounded-lg p-4 text-sm">
          <p className="font-medium text-[#0A2540] mb-2">API Endpoint</p>
          <code className="text-xs text-[#596880]">
            GET https://[app-url]/portal?key={revealed ? client.apiKey : 'CLIENT_API_KEY'}
          </code>
        </div>
      </div>

      {/* Shared Companies */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-[#0A2540]">Shared Companies ({total})</h2>
          <div className="flex gap-2">
            <button className="btn-secondary !py-1.5 !px-3 text-xs" onClick={() => exportData('csv')}><Download size={14} /> CSV</button>
            <button className="btn-secondary !py-1.5 !px-3 text-xs" onClick={() => exportData('xlsx')}><Download size={14} /> XLSX</button>
            <button className="btn-secondary !py-1.5 !px-3 text-xs" onClick={() => exportData('json')}><Download size={14} /> JSON</button>
          </div>
        </div>

        {companies.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E3E8EE] bg-[#F6F9FC]">
                  <th className="p-2 text-left text-[#596880] font-semibold">Company</th>
                  <th className="p-2 text-left text-[#596880] font-semibold">Industry</th>
                  <th className="p-2 text-left text-[#596880] font-semibold">Geography</th>
                  <th className="p-2 text-right text-[#596880] font-semibold">Revenue</th>
                  <th className="p-2 text-right text-[#596880] font-semibold">Employees</th>
                  <th className="p-2 text-center text-[#596880] font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((c) => (
                  <tr key={c.id} className="border-b border-[#E3E8EE]">
                    <td className="p-2 font-medium"><Link to={`/companies/${c.id}`} className="hover:text-[#635BFF]">{c.company_name}</Link></td>
                    <td className="p-2 text-[#596880]">{c.industry || '—'}</td>
                    <td className="p-2 text-[#596880]">{c.geography || '—'}</td>
                    <td className="p-2 text-right text-[#596880]">{formatCurrency(c.revenue)}</td>
                    <td className="p-2 text-right text-[#596880]">{formatNumber(c.employees)}</td>
                    <td className="p-2 text-center">
                      <button onClick={() => handleRemoveCompany(c.id)} className="p-1 text-[#596880] hover:text-red-500"><X size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-[#596880] text-center py-6">No companies shared with this client yet</p>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-3 border-t border-[#E3E8EE] mt-3">
            <span className="text-xs text-[#596880]">Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <button className="btn-secondary !py-1 !px-2 text-xs" disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft size={12} /></button>
              <button className="btn-secondary !py-1 !px-2 text-xs" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}><ChevronRight size={12} /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
