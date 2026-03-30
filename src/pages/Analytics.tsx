import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, FunnelChart, Funnel, LabelList } from 'recharts';
import { getTotalCompanyCount, getStatusCounts, getIndustryDistribution, getGeographyDistribution, getRevenueDistribution } from '../lib/db';
import { useAppStore } from '../store/appStore';
import { STATUS_LABELS } from '../lib/types';

const COLORS = ['#635BFF', '#00D4AA', '#FFB800', '#FF4D4F', '#818CF8', '#06B6D4', '#F472B6', '#34D399', '#FBBF24', '#EF4444'];

export default function Analytics() {
  const { clients, shares } = useAppStore();
  const [totalCompanies, setTotalCompanies] = useState(0);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [industryData, setIndustryData] = useState<{ name: string; count: number }[]>([]);
  const [geoData, setGeoData] = useState<{ name: string; count: number }[]>([]);
  const [revenueData, setRevenueData] = useState<{ range: string; count: number }[]>([]);

  useEffect(() => {
    getTotalCompanyCount().then(setTotalCompanies);
    getStatusCounts().then(setStatusCounts);
    getIndustryDistribution().then(setIndustryData);
    getGeographyDistribution().then(setGeoData);
    getRevenueDistribution().then(setRevenueData);
  }, []);

  const funnelData = Object.entries(statusCounts)
    .map(([key, value]) => ({ name: STATUS_LABELS[key as keyof typeof STATUS_LABELS] || key, value, fill: COLORS[Object.keys(statusCounts).indexOf(key) % COLORS.length] }))
    .sort((a, b) => b.value - a.value);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0A2540]">Analytics</h1>
        <p className="text-sm text-[#596880]">Insights across {totalCompanies.toLocaleString()} companies, {clients.length} clients, {shares.length} shares</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Industry Chart */}
        <div className="card">
          <h2 className="text-base font-semibold text-[#0A2540] mb-4">Companies by Industry</h2>
          {industryData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={industryData.slice(0, 10)} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 11, fill: '#596880' }} axisLine={false} tickLine={false} />
                <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11, fill: '#596880' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E3E8EE', fontSize: 13 }} />
                <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                  {industryData.slice(0, 10).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-sm text-[#596880]">No data yet</div>
          )}
        </div>

        {/* Geography Chart */}
        <div className="card">
          <h2 className="text-base font-semibold text-[#0A2540] mb-4">Companies by Geography</h2>
          {geoData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={geoData.slice(0, 10)} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 11, fill: '#596880' }} axisLine={false} tickLine={false} />
                <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 11, fill: '#596880' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E3E8EE', fontSize: 13 }} />
                <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                  {geoData.slice(0, 10).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-sm text-[#596880]">No data yet</div>
          )}
        </div>

        {/* Revenue Distribution */}
        <div className="card">
          <h2 className="text-base font-semibold text-[#0A2540] mb-4">Revenue Distribution</h2>
          {revenueData.some((d) => d.count > 0) ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={revenueData}>
                <XAxis dataKey="range" tick={{ fontSize: 11, fill: '#596880' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#596880' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E3E8EE', fontSize: 13 }} />
                <Bar dataKey="count" fill="#635BFF" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-sm text-[#596880]">No data yet</div>
          )}
        </div>

        {/* Pipeline Funnel */}
        <div className="card">
          <h2 className="text-base font-semibold text-[#0A2540] mb-4">Pipeline Funnel</h2>
          {funnelData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <FunnelChart>
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E3E8EE', fontSize: 13 }} />
                <Funnel dataKey="value" data={funnelData} isAnimationActive>
                  <LabelList position="right" fill="#0A2540" stroke="none" fontSize={12} dataKey="name" />
                </Funnel>
              </FunnelChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-sm text-[#596880]">No data yet</div>
          )}
        </div>

        {/* Client Activity */}
        <div className="card">
          <h2 className="text-base font-semibold text-[#0A2540] mb-4">Client Activity</h2>
          {clients.length > 0 ? (
            <div className="space-y-3">
              {clients.map((c) => {
                const shareCount = shares.filter((s) => s.client_id === c.id).reduce((acc, s) => acc + s.company_count, 0);
                return (
                  <div key={c.id} className="flex items-center justify-between py-2 border-b border-[#E3E8EE] last:border-0">
                    <div>
                      <p className="text-sm font-medium text-[#0A2540]">{c.name}</p>
                      <p className="text-xs text-[#596880]">{c.company}</p>
                    </div>
                    <span className="text-sm font-medium text-[#635BFF]">{shareCount} companies</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-sm text-[#596880]">No clients yet</div>
          )}
        </div>

        {/* Upload Stats */}
        <div className="card">
          <h2 className="text-base font-semibold text-[#0A2540] mb-4">Summary</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 bg-[#F6F9FC] rounded-lg">
              <p className="text-2xl font-bold text-[#635BFF]">{totalCompanies.toLocaleString()}</p>
              <p className="text-xs text-[#596880] mt-1">Total Companies</p>
            </div>
            <div className="text-center p-4 bg-[#F6F9FC] rounded-lg">
              <p className="text-2xl font-bold text-[#00D4AA]">{clients.length}</p>
              <p className="text-xs text-[#596880] mt-1">Active Clients</p>
            </div>
            <div className="text-center p-4 bg-[#F6F9FC] rounded-lg">
              <p className="text-2xl font-bold text-[#FFB800]">{shares.length}</p>
              <p className="text-xs text-[#596880] mt-1">Active Shares</p>
            </div>
            <div className="text-center p-4 bg-[#F6F9FC] rounded-lg">
              <p className="text-2xl font-bold text-[#FF4D4F]">{Object.keys(statusCounts).length}</p>
              <p className="text-xs text-[#596880] mt-1">Pipeline Stages</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
