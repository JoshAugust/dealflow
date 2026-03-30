import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useAppStore } from '../store/appStore';

export default function Layout() {
  const { sidebarCollapsed } = useAppStore();

  return (
    <div style={{ minHeight: '100vh', background: '#F6F9FC' }}>
      <Sidebar />
      <main
        style={{
          marginLeft: sidebarCollapsed ? 68 : 240,
          transition: 'margin-left 0.2s ease',
          minHeight: '100vh',
        }}
      >
        <div style={{ padding: '32px 40px', maxWidth: 1400 }}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
