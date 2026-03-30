import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getCompaniesPage, updateCompany, addActivity } from '../lib/db';
import { formatCurrency } from '../lib/format';
import type { Company, CompanyStatus } from '../lib/types';
import { STATUS_LABELS, DEAL_SOURCING_STAGES, LEAD_GEN_STAGES } from '../lib/types';

type Mode = 'deal_sourcing' | 'lead_generation';

const STAGE_COLORS: Record<string, string> = {
  new: '#635BFF', reviewed: '#818CF8', shortlisted: '#06B6D4', in_discussion: '#FFB800',
  due_diligence: '#F59E0B', closed_won: '#00D4AA', passed: '#FF4D4F',
  contacted: '#818CF8', responded: '#06B6D4', meeting_booked: '#FFB800',
  qualified: '#8B5CF6', won: '#00D4AA', lost: '#FF4D4F',
};

export default function Pipeline() {
  const [mode, setMode] = useState<Mode>('deal_sourcing');
  const [stageData, setStageData] = useState<Record<string, Company[]>>({});
  const [loading, setLoading] = useState(false);

  const stages = mode === 'deal_sourcing' ? DEAL_SOURCING_STAGES : LEAD_GEN_STAGES;

  useEffect(() => {
    loadPipeline();
  }, [mode]);

  const loadPipeline = async () => {
    setLoading(true);
    const data: Record<string, Company[]> = {};
    for (const stage of (mode === 'deal_sourcing' ? DEAL_SOURCING_STAGES : LEAD_GEN_STAGES)) {
      const result = await getCompaniesPage(1, 50, {
        search: '', industry: '', geography: '', revenueMin: '', revenueMax: '',
        employeesMin: '', employeesMax: '', status: stage, tags: [], source: '',
      });
      data[stage] = result.companies;
    }
    setStageData(data);
    setLoading(false);
  };

  const handleMoveCompany = async (company: Company, newStatus: CompanyStatus) => {
    await updateCompany({ id: company.id, status: newStatus });
    await addActivity({
      type: 'pipeline_move',
      description: `Moved ${company.company_name} to ${STATUS_LABELS[newStatus]}`,
      entity_id: company.id,
      entity_type: 'company',
    });
    loadPipeline();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0A2540]">Pipeline</h1>
          <p className="text-sm text-[#596880]">Track companies through your workflow</p>
        </div>
        <div className="flex gap-2">
          <button
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${mode === 'deal_sourcing' ? 'bg-[#635BFF] text-white' : 'bg-white text-[#596880] border border-[#E3E8EE]'}`}
            onClick={() => setMode('deal_sourcing')}
          >
            Deal Sourcing
          </button>
          <button
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${mode === 'lead_generation' ? 'bg-[#635BFF] text-white' : 'bg-white text-[#596880] border border-[#E3E8EE]'}`}
            onClick={() => setMode('lead_generation')}
          >
            Lead Generation
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-[#596880]">Loading pipeline...</div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {stages.map((stage) => {
            const companies = stageData[stage] || [];
            const color = STAGE_COLORS[stage] || '#635BFF';
            return (
              <div key={stage} className="min-w-[260px] max-w-[280px] flex-shrink-0">
                <div className="flex items-center gap-2 mb-3 px-1">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                  <h3 className="text-sm font-semibold text-[#0A2540]">{STATUS_LABELS[stage]}</h3>
                  <span className="text-xs text-[#596880] bg-[#F6F9FC] px-1.5 rounded">{companies.length}</span>
                </div>
                <div className="space-y-2 min-h-[200px]">
                  {companies.map((c) => (
                    <div key={c.id} className="card !p-3 space-y-2 hover:shadow-md transition-shadow">
                      <Link to={`/companies/${c.id}`} className="font-medium text-sm text-[#0A2540] hover:text-[#635BFF] block truncate">
                        {c.company_name}
                      </Link>
                      <div className="flex items-center gap-2 text-xs text-[#596880]">
                        {c.industry && <span className="truncate">{c.industry}</span>}
                        {c.revenue > 0 && <span>{formatCurrency(c.revenue)}</span>}
                      </div>
                      <select
                        className="w-full text-xs rounded border border-[#E3E8EE] px-2 py-1 text-[#596880]"
                        value={c.status}
                        onChange={(e) => handleMoveCompany(c, e.target.value as CompanyStatus)}
                      >
                        {stages.map((s) => (
                          <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                  {companies.length === 0 && (
                    <div className="text-center text-xs text-[#596880] py-8 border-2 border-dashed border-[#E3E8EE] rounded-lg">
                      No companies
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
