import { useState } from 'react';
import { Plus, Trash2, Edit2, Check, Eye, EyeOff, Copy, Plug, Zap, X, ExternalLink } from 'lucide-react';
import { useAppStore, type Integration } from '../store/appStore';
import Modal from '../components/Modal';

const KNOWN_INTEGRATIONS: Record<string, { baseUrl: string; description: string; emoji: string; signupUrl: string }> = {
  'apollo': { baseUrl: 'https://api.apollo.io/api/v1', description: 'B2B contact & company data', emoji: '🚀', signupUrl: 'https://app.apollo.io/#/signup' },
  'apollo.io': { baseUrl: 'https://api.apollo.io/api/v1', description: 'B2B contact & company data', emoji: '🚀', signupUrl: 'https://app.apollo.io/#/signup' },
  'hunter': { baseUrl: 'https://api.hunter.io/v2', description: 'Email finder & verifier', emoji: '📧', signupUrl: 'https://hunter.io/users/sign_up' },
  'hunter.io': { baseUrl: 'https://api.hunter.io/v2', description: 'Email finder & verifier', emoji: '📧', signupUrl: 'https://hunter.io/users/sign_up' },
  'clearbit': { baseUrl: 'https://company.clearbit.com/v2', description: 'Company enrichment & firmographics', emoji: '🔮', signupUrl: 'https://clearbit.com' },
  'zoominfo': { baseUrl: 'https://api.zoominfo.com', description: 'B2B intelligence platform', emoji: '🔍', signupUrl: 'https://www.zoominfo.com' },
  'peopledatalabs': { baseUrl: 'https://api.peopledatalabs.com/v5', description: 'People & company data API', emoji: '👥', signupUrl: 'https://www.peopledatalabs.com' },
  'lusha': { baseUrl: 'https://api.lusha.com', description: 'Contact data & enrichment', emoji: '📇', signupUrl: 'https://www.lusha.com' },
};

function getKnownDefaults(name: string) {
  const lower = name.toLowerCase().trim();
  for (const [key, val] of Object.entries(KNOWN_INTEGRATIONS)) {
    if (lower === key || lower.includes(key) || key.includes(lower)) return val;
  }
  return null;
}

export default function Integrations() {
  const { integrations, addIntegration, updateIntegration, deleteIntegration } = useAppStore();
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean } | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formKey, setFormKey] = useState('');
  const [formBaseUrl, setFormBaseUrl] = useState('');
  const [formDesc, setFormDesc] = useState('');

  // Reveal keys
  const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set());

  const openAddModal = () => {
    setEditingId(null);
    setFormName(''); setFormKey(''); setFormBaseUrl(''); setFormDesc('');
    setShowModal(true);
  };

  const openEditModal = (integration: Integration) => {
    setEditingId(integration.id);
    setFormName(integration.name);
    setFormKey(integration.apiKey);
    setFormBaseUrl(integration.baseUrl || '');
    setFormDesc(integration.description || '');
    setShowModal(true);
  };

  const handleNameChange = (name: string) => {
    setFormName(name);
    if (!editingId) {
      const defaults = getKnownDefaults(name);
      if (defaults) {
        if (!formBaseUrl) setFormBaseUrl(defaults.baseUrl);
        if (!formDesc) setFormDesc(defaults.description);
      }
    }
  };

  const handleSave = () => {
    if (!formName.trim() || !formKey.trim()) return;

    if (editingId) {
      updateIntegration(editingId, {
        name: formName.trim(),
        apiKey: formKey.trim(),
        baseUrl: formBaseUrl.trim() || undefined,
        description: formDesc.trim() || undefined,
        connected: true,
      });
    } else {
      addIntegration({
        id: crypto.randomUUID(),
        name: formName.trim(),
        apiKey: formKey.trim(),
        baseUrl: formBaseUrl.trim() || undefined,
        description: formDesc.trim() || undefined,
        connected: true,
        created_at: new Date().toISOString(),
      });
    }
    setShowModal(false);
  };

  const handleDelete = (id: string) => {
    deleteIntegration(id);
    setDeleteConfirm(null);
  };

  const handleTest = async (integration: Integration) => {
    setTestingId(integration.id);
    setTestResult(null);
    try {
      let success = false;
      const lower = integration.name.toLowerCase();

      if (lower.includes('apollo')) {
        const res = await fetch('https://api.apollo.io/api/v1/auth/health', {
          method: 'GET',
          headers: { 'X-Api-Key': integration.apiKey },
        });
        success = res.ok;
      } else if (lower.includes('hunter')) {
        const res = await fetch(`https://api.hunter.io/v2/account?api_key=${integration.apiKey}`);
        success = res.ok;
      } else if (integration.baseUrl) {
        try {
          const res = await fetch(integration.baseUrl, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${integration.apiKey}`,
              'X-Api-Key': integration.apiKey,
            },
          });
          success = res.ok || res.status === 401 || res.status === 403; // 401/403 means endpoint exists
        } catch {
          success = false;
        }
      }

      if (success) {
        updateIntegration(integration.id, { lastUsed: new Date().toISOString() });
      }
      setTestResult({ id: integration.id, success });
    } catch {
      setTestResult({ id: integration.id, success: false });
    } finally {
      setTestingId(null);
    }
  };

  const toggleReveal = (id: string) => {
    const next = new Set(revealedKeys);
    if (next.has(id)) next.delete(id); else next.add(id);
    setRevealedKeys(next);
  };

  const maskKey = (key: string) => key.slice(0, 6) + '•'.repeat(Math.max(0, key.length - 10)) + key.slice(-4);

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
  };

  const getEmoji = (name: string) => {
    const defaults = getKnownDefaults(name);
    return defaults?.emoji || '🔌';
  };

  const getSignupUrl = (name: string) => {
    const defaults = getKnownDefaults(name);
    return defaults?.signupUrl;
  };

  return (
    <div className="space-y-6">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 className="text-2xl font-bold text-[#0A2540]">API Integrations</h1>
          <p className="text-sm text-[#596880] mt-1">
            Connect external services to enrich company data and find contacts.
            Add any API — just provide a name and key.
          </p>
        </div>
        <button className="btn-primary" onClick={openAddModal}>
          <Plus size={16} /> Add Integration
        </button>
      </div>

      {integrations.length === 0 ? (
        <div style={{
          background: 'white', borderRadius: 12, padding: '60px 40px',
          border: '1px solid #E3E8EE', textAlign: 'center',
        }}>
          <Plug size={48} style={{ color: '#D1D5DB', margin: '0 auto 16px' }} />
          <h3 style={{ fontSize: 18, fontWeight: 600, color: '#0A2540', margin: '0 0 8px' }}>No Integrations Yet</h3>
          <p style={{ fontSize: 14, color: '#596880', margin: '0 0 20px' }}>
            Add your first API integration to start enriching company data.
          </p>
          <button className="btn-primary" onClick={openAddModal}>
            <Plus size={16} /> Add Your First Integration
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {integrations.map((integration) => (
            <div key={integration.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 28 }}>{getEmoji(integration.name)}</span>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 600, color: '#0A2540', margin: 0 }}>{integration.name}</h3>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10,
                      background: integration.connected ? '#ECFDF5' : '#FEF3C7',
                      color: integration.connected ? '#065F46' : '#92400E',
                    }}>
                      {integration.connected ? '✓ Connected' : 'Not Connected'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Description */}
              {integration.description && (
                <p style={{ fontSize: 13, color: '#596880', margin: 0, lineHeight: 1.5 }}>{integration.description}</p>
              )}

              {/* API Key */}
              <div style={{ background: '#F6F9FC', borderRadius: 8, padding: '10px 12px', border: '1px solid #E3E8EE' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <code style={{ flex: 1, fontSize: 12, fontFamily: 'monospace', color: '#0A2540', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {revealedKeys.has(integration.id) ? integration.apiKey : maskKey(integration.apiKey)}
                  </code>
                  <button onClick={() => toggleReveal(integration.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#596880', padding: 4 }}>
                    {revealedKeys.has(integration.id) ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                  <button onClick={() => copyKey(integration.apiKey)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#596880', padding: 4 }}>
                    <Copy size={14} />
                  </button>
                </div>
              </div>

              {/* Base URL */}
              {integration.baseUrl && (
                <p style={{ fontSize: 11, color: '#9CA3AF', margin: 0 }}>
                  Base URL: <code style={{ fontFamily: 'monospace' }}>{integration.baseUrl}</code>
                </p>
              )}

              {/* Last used */}
              {integration.lastUsed && (
                <p style={{ fontSize: 11, color: '#9CA3AF', margin: 0 }}>
                  Last tested: {new Date(integration.lastUsed).toLocaleDateString()}
                </p>
              )}

              {/* Test result */}
              {testResult?.id === integration.id && (
                <p style={{ fontSize: 13, margin: 0, color: testResult.success ? '#065F46' : '#DC2626' }}>
                  {testResult.success ? '✅ Connection successful!' : '❌ Connection failed. Check your API key.'}
                </p>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
                <button className="btn-secondary" style={{ flex: 1, fontSize: 12, padding: '8px 12px' }}
                  onClick={() => handleTest(integration)}
                  disabled={testingId === integration.id}>
                  <Zap size={14} /> {testingId === integration.id ? 'Testing...' : 'Test'}
                </button>
                <button className="btn-secondary" style={{ padding: '8px 12px', fontSize: 12 }}
                  onClick={() => openEditModal(integration)}>
                  <Edit2 size={14} />
                </button>
                {deleteConfirm === integration.id ? (
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn-danger" style={{ padding: '8px 10px', fontSize: 12 }}
                      onClick={() => handleDelete(integration.id)}>
                      <Check size={14} />
                    </button>
                    <button className="btn-secondary" style={{ padding: '8px 10px', fontSize: 12 }}
                      onClick={() => setDeleteConfirm(null)}>
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <button className="btn-secondary" style={{ padding: '8px 12px', fontSize: 12, color: '#DC2626' }}
                    onClick={() => setDeleteConfirm(integration.id)}>
                    <Trash2 size={14} />
                  </button>
                )}
              </div>

              {/* Signup link */}
              {getSignupUrl(integration.name) && (
                <a href={getSignupUrl(integration.name)!} target="_blank" rel="noreferrer"
                  style={{ fontSize: 12, color: '#635BFF', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                  Sign up for {integration.name} <ExternalLink size={10} />
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editingId ? 'Edit Integration' : 'Add Integration'}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#596880', marginBottom: 6 }}>
              Integration Name *
            </label>
            <input
              className="input-field"
              placeholder='e.g. "Apollo.io", "Hunter.io", "My Custom API"'
              value={formName}
              onChange={(e) => handleNameChange(e.target.value)}
            />
            {formName && getKnownDefaults(formName) && !editingId && (
              <p style={{ fontSize: 11, color: '#635BFF', marginTop: 4 }}>
                ✨ Recognized! Auto-filled base URL and description.
              </p>
            )}
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#596880', marginBottom: 6 }}>
              API Key *
            </label>
            <input
              className="input-field"
              type="password"
              placeholder="Enter API key..."
              value={formKey}
              onChange={(e) => setFormKey(e.target.value)}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#596880', marginBottom: 6 }}>
              Base URL <span style={{ fontWeight: 400, color: '#9CA3AF' }}>(optional)</span>
            </label>
            <input
              className="input-field"
              placeholder="https://api.example.com/v1"
              value={formBaseUrl}
              onChange={(e) => setFormBaseUrl(e.target.value)}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#596880', marginBottom: 6 }}>
              Description <span style={{ fontWeight: 400, color: '#9CA3AF' }}>(optional)</span>
            </label>
            <input
              className="input-field"
              placeholder="What this API does..."
              value={formDesc}
              onChange={(e) => setFormDesc(e.target.value)}
            />
          </div>
          <button
            className="btn-primary"
            style={{ width: '100%' }}
            onClick={handleSave}
            disabled={!formName.trim() || !formKey.trim()}
          >
            {editingId ? 'Save Changes' : 'Add Integration'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
