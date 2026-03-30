import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2, Users, Share2, TrendingUp, Upload, UserPlus,
  Link as LinkIcon, ArrowUpRight, Clock, Zap
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { getTotalCompanyCount, getStatusCounts, getRecentActivity } from '../lib/db';
import { useAppStore } from '../store/appStore';
import { formatRelativeTime } from '../lib/format';
import type { ActivityLog } from '../lib/types';
import { STATUS_LABELS } from '../lib/types';

const CHART_COLORS = ['#635BFF', '#818CF8', '#a78bfa', '#06B6D4', '#00D4AA', '#FFB800', '#F472B6'];

export default function Dashboard() {
  const { clients, shares } = useAppStore();
  const [totalCompanies, setTotalCompanies] = useState(0);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [activity, setActivity] = useState<ActivityLog[]>([]);

  useEffect(() => {
    getTotalCompanyCount().then(setTotalCompanies);
    getStatusCounts().then(setStatusCounts);
    getRecentActivity(15).then(setActivity);
  }, []);

  const chartData = Object.entries(statusCounts).map(([key, count]) => ({
    name: STATUS_LABELS[key as keyof typeof STATUS_LABELS] || key,
    count,
  }));

  const sharedThisMonth = shares.filter((s) => {
    const d = new Date(s.created_at);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const pipelineTotal = Object.values(statusCounts).reduce((a, b) => a + b, 0);

  const stats = [
    { label: 'Total Companies', value: totalCompanies.toLocaleString(), icon: Building2, color: '#635BFF', bg: '#F0EEFF' },
    { label: 'Active Clients', value: clients.length.toString(), icon: Users, color: '#00D4AA', bg: '#ECFDF5' },
    { label: 'Shared This Month', value: sharedThisMonth.toString(), icon: Share2, color: '#FFB800', bg: '#FFFBEB' },
    { label: 'In Pipeline', value: pipelineTotal.toLocaleString(), icon: TrendingUp, color: '#635BFF', bg: '#F0EEFF' },
  ];

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Page header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: '#0A2540', letterSpacing: '-0.02em', margin: 0 }}>
          Dashboard
        </h1>
        <p style={{ fontSize: 14, color: '#596880', marginTop: 4 }}>
          Your company intelligence platform at a glance
        </p>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {stats.map((s) => (
          <div
            key={s.label}
            style={{
              background: 'white',
              border: '1px solid #E3E8EE',
              borderRadius: 12,
              padding: '20px 24px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              borderTop: `3px solid ${s.color}`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#596880', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {s.label}
              </span>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: s.bg,
              }}>
                <s.icon size={18} color={s.color} />
              </div>
            </div>
            <p style={{ fontSize: 32, fontWeight: 700, color: '#0A2540', margin: 0, lineHeight: 1 }}>
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* Chart + Activity row */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, marginBottom: 24 }}>
        {/* Pipeline chart */}
        <div style={{
          background: 'white', border: '1px solid #E3E8EE', borderRadius: 12,
          padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0A2540', margin: 0 }}>Pipeline Overview</h2>
              <p style={{ fontSize: 12, color: '#596880', marginTop: 2 }}>Company distribution by status</p>
            </div>
            <Link to="/pipeline" style={{ fontSize: 12, fontWeight: 600, color: '#635BFF', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
              View pipeline <ArrowUpRight size={14} />
            </Link>
          </div>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData} barSize={32}>
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: '#596880' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#596880' }}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 8,
                    border: '1px solid #E3E8EE',
                    fontSize: 13,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                  }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{
              height: 240, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 12,
            }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: '#F0EEFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Building2 size={22} color="#635BFF" />
              </div>
              <p style={{ fontSize: 13, color: '#596880', textAlign: 'center' }}>
                No companies yet<br />
                <span style={{ fontSize: 12 }}>Upload data to see your pipeline</span>
              </p>
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div style={{
          background: 'white', border: '1px solid #E3E8EE', borderRadius: 12,
          padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Clock size={16} color="#596880" />
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0A2540', margin: 0 }}>Recent Activity</h2>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', maxHeight: 260 }}>
            {activity.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {activity.map((a) => (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: 'linear-gradient(135deg, #635BFF, #a78bfa)',
                      marginTop: 6, flexShrink: 0,
                    }} />
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: 13, color: '#0A2540', margin: 0, lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {a.description}
                      </p>
                      <p style={{ fontSize: 11, color: '#596880', margin: '2px 0 0' }}>
                        {formatRelativeTime(a.timestamp)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 8 }}>
                <Zap size={20} color="#596880" />
                <p style={{ fontSize: 13, color: '#596880', textAlign: 'center' }}>No activity yet</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div style={{
        background: 'white', border: '1px solid #E3E8EE', borderRadius: 12,
        padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0A2540', margin: '0 0 16px' }}>Quick Actions</h2>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Link to="/upload" className="btn-primary" style={{ textDecoration: 'none' }}>
            <Upload size={16} /> Upload Companies
          </Link>
          <Link to="/clients" className="btn-secondary" style={{ textDecoration: 'none' }}>
            <UserPlus size={16} /> Add Client
          </Link>
          <Link to="/shares" className="btn-secondary" style={{ textDecoration: 'none' }}>
            <LinkIcon size={16} /> Create Share
          </Link>
          <Link to="/companies" className="btn-secondary" style={{ textDecoration: 'none' }}>
            <Building2 size={16} /> Browse Companies
          </Link>
        </div>
      </div>
    </div>
  );
}
