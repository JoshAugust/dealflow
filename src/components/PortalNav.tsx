import { LayoutDashboard, Building2, Download, Code2 } from 'lucide-react';

type PortalTab = 'dashboard' | 'companies' | 'export' | 'api';

interface Props {
  activeTab: PortalTab;
  onTabChange: (tab: PortalTab) => void;
  clientName: string;
  clientCompany: string;
}

const tabs: { key: PortalTab; label: string; icon: typeof LayoutDashboard }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'companies', label: 'Companies', icon: Building2 },
  { key: 'export', label: 'Export', icon: Download },
  { key: 'api', label: 'API', icon: Code2 },
];

export default function PortalNav({ activeTab, onTabChange, clientName, clientCompany }: Props) {
  return (
    <header>
      {/* Gradient bar */}
      <div style={{
        height: 4,
        background: 'linear-gradient(90deg, #635BFF 0%, #A259FF 50%, #635BFF 100%)',
      }} />

      <div style={{
        background: 'white',
        borderBottom: '1px solid #E3E8EE',
        padding: '0 24px',
      }}>
        {/* Top row: logo + client info */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 64,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'linear-gradient(135deg, #635BFF, #A259FF)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontWeight: 800, fontSize: 16,
            }}>
              D
            </div>
            <div>
              <span style={{ fontWeight: 700, fontSize: 16, color: '#0A2540', letterSpacing: '-0.01em' }}>
                DealFlow
              </span>
              <span style={{
                fontSize: 11, fontWeight: 600, color: '#635BFF',
                background: '#F0EEFF', padding: '2px 8px', borderRadius: 6,
                marginLeft: 10, verticalAlign: 'middle',
              }}>
                Client Portal
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#0A2540', margin: 0 }}>{clientName}</p>
              <p style={{ fontSize: 12, color: '#596880', margin: 0 }}>{clientCompany}</p>
            </div>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'linear-gradient(135deg, #635BFF, #A259FF)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontWeight: 700, fontSize: 14,
            }}>
              {clientName.charAt(0)}
            </div>
          </div>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 0, marginTop: -1 }}>
          {tabs.map((tab) => {
            const active = activeTab === tab.key;
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => onTabChange(tab.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '10px 18px',
                  fontSize: 13, fontWeight: active ? 600 : 500,
                  color: active ? '#635BFF' : '#596880',
                  background: 'none', border: 'none',
                  borderBottom: active ? '2px solid #635BFF' : '2px solid transparent',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
}
