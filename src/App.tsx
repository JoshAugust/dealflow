import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Companies from './pages/Companies';
import CompanyDetail from './pages/CompanyDetail';
import Upload from './pages/Upload';
import Clients from './pages/Clients';
import ClientDetail from './pages/ClientDetail';
import Shares from './pages/Shares';
import Pipeline from './pages/Pipeline';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import Chat from './pages/Chat';
import ApiPortal from './pages/ApiPortal';
import Portal from './pages/Portal';
import Integrations from './pages/Integrations';
import Qualification from './pages/Qualification';
import CallSheet from './pages/CallSheet';
import EnrichmentLab from './pages/EnrichmentLab';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/portal" element={<Portal />} />
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/companies" element={<Companies />} />
          <Route path="/companies/:id" element={<CompanyDetail />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/clients" element={<Clients />} />
          <Route path="/clients/:id" element={<ClientDetail />} />
          <Route path="/shares" element={<Shares />} />
          <Route path="/pipeline" element={<Pipeline />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/api-docs" element={<ApiPortal />} />
          <Route path="/integrations" element={<Integrations />} />
          <Route path="/qualification" element={<Qualification />} />
          <Route path="/call-sheet" element={<CallSheet />} />
          <Route path="/enrichment" element={<EnrichmentLab />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
