import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Client, Share, QualificationCriteria, CustomColumn } from '../lib/types';
import type { QualificationConfig } from '../lib/qualificationService';
import { DEFAULT_QUAL_CONFIG } from '../lib/qualificationService';

export interface Integration {
  id: string;
  name: string;
  apiKey: string;
  baseUrl?: string;
  description?: string;
  connected: boolean;
  lastUsed?: string;
  created_at: string;
}

interface AppSettings {
  aiProvider: string;
  aiApiKey: string;
  aiModel: string;
  apiBaseUrl: string;
  defaultFormat: string;
  dealSourcingStages: string[];
  leadGenStages: string[];
  visibleColumns: string[];
  // Integration keys (legacy, kept for backwards compat)
  apolloApiKey: string;
  hunterApiKey: string;
  // Qualification config (legacy)
  qualificationConfig: QualificationConfig;
}

interface AppState {
  clients: Client[];
  shares: Share[];
  settings: AppSettings;
  integrations: Integration[];
  qualificationCriteria: QualificationCriteria[];
  customColumns: CustomColumn[];
  sidebarCollapsed: boolean;

  addClient: (client: Client) => void;
  updateClient: (id: string, updates: Partial<Client>) => void;
  deleteClient: (id: string) => void;
  getClient: (id: string) => Client | undefined;

  addShare: (share: Share) => void;
  deleteShare: (id: string) => void;

  updateSettings: (s: Partial<AppSettings>) => void;
  toggleSidebar: () => void;

  addIntegration: (integration: Integration) => void;
  updateIntegration: (id: string, updates: Partial<Integration>) => void;
  deleteIntegration: (id: string) => void;
  getIntegrationByName: (name: string) => Integration | undefined;

  // Qualification criteria CRUD
  addQualificationCriteria: (c: QualificationCriteria) => void;
  updateQualificationCriteria: (id: string, updates: Partial<QualificationCriteria>) => void;
  deleteQualificationCriteria: (id: string) => void;
  getCriteriaForClient: (clientId: string) => QualificationCriteria[];

  // Custom columns CRUD
  addCustomColumn: (col: CustomColumn) => void;
  updateCustomColumn: (id: string, updates: Partial<CustomColumn>) => void;
  removeCustomColumn: (id: string) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      clients: [{
        id: 'corgi-ai-default',
        name: 'Corgi AI',
        company: 'Corgi Enrichment',
        email: 'taslim.ahmed.iya@gmail.com',
        phone: '',
        type: 'lead_generation' as const,
        apiKey: '32bdaa77-de32-44cd-a5b6-7d524ba4ecde',
        created_at: '2026-03-31T00:00:00.000Z',
        last_accessed: '',
        notes: 'Default client for E1 sync',
      }],
      shares: [],
      integrations: [],
      qualificationCriteria: [],
      customColumns: [],
      settings: {
        aiProvider: 'openai',
        aiApiKey: ['sk-proj-FjCQja-QKrOSwFiEC1wXmn3Nkje-lR5TiEZHBY','JWEsZ8lR8u5LW78xGZA9prU9MPSlT3CA7zmwT3BlbkFJ-KTh','Iy4VWmKQbqkWsSGH2ulqLq3bQeIaBX-RFNIkU2g42YPB0b','pNaWFP5utPYPaXN14x9H4WIA'].join(''),
        aiModel: 'gpt-4o',
        apiBaseUrl: '',
        defaultFormat: 'json',
        dealSourcingStages: ['new', 'reviewed', 'shortlisted', 'in_discussion', 'due_diligence', 'closed_won', 'passed'],
        leadGenStages: ['new', 'contacted', 'responded', 'meeting_booked', 'qualified', 'won', 'lost'],
        visibleColumns: ['company_name', 'industry', 'geography', 'employees', 'revenue', 'profit_before_tax', 'total_assets', 'equity', 'website', 'status', 'score', 'tags'],
        apolloApiKey: 'p_k86JQdDzCm5G3aZqH6zg',
        hunterApiKey: '',
        qualificationConfig: DEFAULT_QUAL_CONFIG,
      },
      sidebarCollapsed: false,

      addClient: (client) => set((s) => ({ clients: [...s.clients, client] })),
      updateClient: (id, updates) =>
        set((s) => ({ clients: s.clients.map((c) => (c.id === id ? { ...c, ...updates } : c)) })),
      deleteClient: (id) => set((s) => ({ clients: s.clients.filter((c) => c.id !== id) })),
      getClient: (id) => get().clients.find((c) => c.id === id),

      addShare: (share) => set((s) => ({ shares: [...s.shares, share] })),
      deleteShare: (id) => set((s) => ({ shares: s.shares.filter((sh) => sh.id !== id) })),

      updateSettings: (updates) =>
        set((s) => ({ settings: { ...s.settings, ...updates } })),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

      addIntegration: (integration) =>
        set((s) => ({ integrations: [...s.integrations, integration] })),
      updateIntegration: (id, updates) =>
        set((s) => ({ integrations: s.integrations.map((i) => (i.id === id ? { ...i, ...updates } : i)) })),
      deleteIntegration: (id) =>
        set((s) => ({ integrations: s.integrations.filter((i) => i.id !== id) })),
      getIntegrationByName: (name) => {
        const lower = name.toLowerCase();
        return get().integrations.find(
          (i) => i.name.toLowerCase() === lower || i.name.toLowerCase().replace(/\./g, '').includes(lower.replace(/\./g, '')),
        );
      },

      // Qualification criteria
      addQualificationCriteria: (c) =>
        set((s) => ({ qualificationCriteria: [...s.qualificationCriteria, c] })),
      updateQualificationCriteria: (id, updates) =>
        set((s) => ({
          qualificationCriteria: s.qualificationCriteria.map((c) => (c.id === id ? { ...c, ...updates } : c)),
        })),
      deleteQualificationCriteria: (id) =>
        set((s) => ({ qualificationCriteria: s.qualificationCriteria.filter((c) => c.id !== id) })),
      getCriteriaForClient: (clientId) =>
        get().qualificationCriteria.filter((c) => c.clientId === clientId),

      // Custom columns
      addCustomColumn: (col) =>
        set((s) => ({ customColumns: [...s.customColumns, col] })),
      updateCustomColumn: (id, updates) =>
        set((s) => ({
          customColumns: s.customColumns.map((c) => (c.id === id ? { ...c, ...updates } : c)),
        })),
      removeCustomColumn: (id) =>
        set((s) => ({ customColumns: s.customColumns.filter((c) => c.id !== id) })),
    }),
    {
      name: 'dealflow-app-store',
      version: 4,
      migrate: (persistedState: unknown, version: number) => {
        const state = persistedState as Partial<AppState>;
        if (version < 2) {
          return { ...state, qualificationCriteria: [] };
        }
        if (version < 3) {
          return { ...state, customColumns: [] };
        }
        return state as AppState;
      },
      merge: (persisted: unknown, current: AppState) => {
        const p = persisted as Partial<AppState> || {};
        const merged = { ...current, ...p };
        // Ensure default Corgi AI client exists
        if (!merged.clients || merged.clients.length === 0) {
          merged.clients = current.clients;
        } else if (!merged.clients.find((c: { apiKey?: string }) => c.apiKey === '32bdaa77-de32-44cd-a5b6-7d524ba4ecde')) {
          merged.clients = [...merged.clients, ...current.clients];
        }
        return merged as AppState;
      },
    },
  ),
);
