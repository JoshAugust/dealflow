import { NavLink } from 'react-router-dom';
import { Bot, LayoutDashboard, Building2, Upload, Users, Link, Kanban, BarChart3, BookOpen, Settings, ChevronLeft, ChevronRight, Shield } from 'lucide-react';
import { useAppStore } from '../store/appStore';

const NAV_ITEMS = [
  { to: '/chat', icon: Bot, label: 'Jarvis', emoji: '🤖' },
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', emoji: '📊' },
  { to: '/companies', icon: Building2, label: 'Companies', emoji: '🏢' },
  { to: '/upload', icon: Upload, label: 'Upload', emoji: '📤' },
  { to: '/clients', icon: Users, label: 'Clients', emoji: '👥' },
  { to: '/shares', icon: Link, label: 'Shares', emoji: '🔗' },
  { to: '/pipeline', icon: Kanban, label: 'Pipeline', emoji: '📋' },
  { to: '/qualification', icon: Shield, label: 'Qualification', emoji: '🛡️' },
  { to: '/analytics', icon: BarChart3, label: 'Analytics', emoji: '📈' },
  { to: '/api-docs', icon: BookOpen, label: 'API Docs', emoji: '📖' },
  { to: '/integrations', icon: Link, label: 'Integrations', emoji: '🔌' },
  { to: '/settings', icon: Settings, label: 'Settings', emoji: '⚙️' },
];

export default function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useAppStore();

  return (
    <aside className={`fixed left-0 top-0 h-full bg-white border-r border-[#E3E8EE] z-50 flex flex-col transition-all duration-200 ${sidebarCollapsed ? 'w-[68px]' : 'w-[240px]'}`}>
      <div className="gradient-bar" />
      <div className="p-4 flex items-center justify-between border-b border-[#E3E8EE]">
        {!sidebarCollapsed && (
          <div>
            <h1 className="text-lg font-bold text-[#0A2540]">DealFlow</h1>
            <p className="text-[11px] text-[#596880]">Company Intelligence</p>
          </div>
        )}
        <button
          onClick={toggleSidebar}
          className="p-1.5 rounded-md hover:bg-[#F6F9FC] text-[#596880]"
        >
          {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-[#F0EEFF] text-[#635BFF]'
                  : 'text-[#596880] hover:bg-[#F6F9FC] hover:text-[#0A2540]'
              }`
            }
          >
            <span className="text-base">{item.emoji}</span>
            {!sidebarCollapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>
      {!sidebarCollapsed && (
        <div className="p-4 border-t border-[#E3E8EE] text-[11px] text-[#596880]">
          Built by Taslim
        </div>
      )}
    </aside>
  );
}
