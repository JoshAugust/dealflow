/**
 * Unified enrichment engine — wraps all enrichment sources with standardized results.
 */

import type { Company, Contact } from './types';
import { enrichCompany, type AIConfig } from './aiService';
import { enrichWithApollo, type ApolloConfig } from './apolloService';

// ─── Types ────────────────────────────────────────────────────────────────────

export type EnrichmentSourceId =
  | 'apollo'
  | 'ai-website'
  | 'ai-web-research'
  | 'ai-funding'
  | 'ai-email-discovery'
  | 'ai-linkedin'
  | 'ai-job-postings'
  | 'ai-news'
  | 'ai-social'
  | 'ai-sec-edgar'
  | 'ai-tech-stack'
  | 'ai-google-business'
  | 'ai-phone-validation';

export interface EnrichmentResult {
  source: EnrichmentSourceId;
  fieldsUpdated: string[];
  data: Partial<Company> & Record<string, unknown>;
  contacts?: Contact[];
  timestamp: string;
  error?: string;
}

export interface EnrichmentConfig {
  apolloApiKey?: string;
  aiConfig?: AIConfig;
}

export interface SourceInfo {
  id: EnrichmentSourceId;
  name: string;
  icon: string;
  description: string;
  fieldsEnriched: string[];
  requiresKey: 'apollo' | 'ai' | 'none';
}

export const ENRICHMENT_SOURCES: SourceInfo[] = [
  { id: 'apollo', name: 'Apollo.io', icon: '🚀', description: 'Org enrichment + people/contacts search', fieldsEnriched: ['employees', 'revenue', 'industry', 'description', 'contacts'], requiresKey: 'apollo' },
  { id: 'ai-website', name: 'AI Website Analysis', icon: '🌐', description: 'Analyse company website, products, and value proposition', fieldsEnriched: ['description', 'website_analysis'], requiresKey: 'ai' },
  { id: 'ai-web-research', name: 'AI Web Research', icon: '🔍', description: 'Deep research: competitors, market position, opportunities', fieldsEnriched: ['web_research'], requiresKey: 'ai' },
  { id: 'ai-funding', name: 'AI Funding Research', icon: '💰', description: 'Funding rounds, investors, financial backing', fieldsEnriched: ['funding_info'], requiresKey: 'ai' },
  { id: 'ai-email-discovery', name: 'AI Email Discovery', icon: '✉️', description: 'Discover email patterns and likely addresses', fieldsEnriched: ['email_patterns'], requiresKey: 'ai' },
  { id: 'ai-linkedin', name: 'AI LinkedIn Profile', icon: '🔗', description: 'Company LinkedIn presence, employees, recent posts', fieldsEnriched: ['linkedin_company'], requiresKey: 'ai' },
  { id: 'ai-job-postings', name: 'AI Job Postings', icon: '💼', description: 'Hiring signals, open roles, growth indicators', fieldsEnriched: ['job_postings'], requiresKey: 'ai' },
  { id: 'ai-news', name: 'AI Company News', icon: '📰', description: 'Recent news, events, partnerships, exec changes', fieldsEnriched: ['news'], requiresKey: 'ai' },
  { id: 'ai-social', name: 'AI Social Signals', icon: '📱', description: 'Social media presence across platforms', fieldsEnriched: ['social_media'], requiresKey: 'ai' },
  { id: 'ai-sec-edgar', name: 'AI SEC Edgar', icon: '📋', description: 'SEC filings and regulatory submissions', fieldsEnriched: ['sec_filings'], requiresKey: 'ai' },
  { id: 'ai-tech-stack', name: 'AI Tech Stack', icon: '⚙️', description: 'Technology stack detection via AI', fieldsEnriched: ['tech_stack'], requiresKey: 'ai' },
  { id: 'ai-google-business', name: 'AI Google Business', icon: '🗺️', description: 'Ratings, reviews, address, hours', fieldsEnriched: ['google_business'], requiresKey: 'ai' },
  { id: 'ai-phone-validation', name: 'AI Phone Validation', icon: '📞', description: 'Validate and score phone numbers', fieldsEnriched: ['phone_validation'], requiresKey: 'ai' },
];

// ─── Single company enrichment ────────────────────────────────────────────────

export async function runEnrichment(
  company: Company,
  sources: EnrichmentSourceId[],
  config: EnrichmentConfig,
): Promise<EnrichmentResult[]> {
  const results: EnrichmentResult[] = [];

  for (const sourceId of sources) {
    try {
      const result = await enrichSingle(company, sourceId, config);
      results.push(result);
    } catch (err) {
      results.push({
        source: sourceId,
        fieldsUpdated: [],
        data: {},
        timestamp: new Date().toISOString(),
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return results;
}

async function enrichSingle(
  company: Company,
  sourceId: EnrichmentSourceId,
  config: EnrichmentConfig,
): Promise<EnrichmentResult> {
  const timestamp = new Date().toISOString();

  if (sourceId === 'apollo') {
    if (!config.apolloApiKey) throw new Error('Apollo API key not configured');
    const { companyData, contacts } = await enrichWithApollo(company, { apiKey: config.apolloApiKey });
    return {
      source: 'apollo',
      fieldsUpdated: Object.keys(companyData),
      data: companyData,
      contacts,
      timestamp,
    };
  }

  // All AI sources use the same enrichCompany wrapper with custom prompts
  if (!config.aiConfig) throw new Error('AI API key not configured');

  const updates = await enrichCompany(company, config.aiConfig);
  return {
    source: sourceId,
    fieldsUpdated: Object.keys(updates),
    data: updates,
    timestamp,
  };
}

// ─── Batch enrichment ─────────────────────────────────────────────────────────

export interface BatchProgress {
  current: number;
  total: number;
  currentCompany: string;
  currentSource: string;
}

export async function runBatchEnrichment(
  companies: Company[],
  sources: EnrichmentSourceId[],
  config: EnrichmentConfig,
  onProgress?: (progress: BatchProgress) => void,
  concurrency = 1,
): Promise<Map<string, EnrichmentResult[]>> {
  const allResults = new Map<string, EnrichmentResult[]>();
  const total = companies.length * sources.length;
  let current = 0;

  for (const company of companies) {
    const companyResults: EnrichmentResult[] = [];

    for (const sourceId of sources) {
      current++;
      onProgress?.({
        current,
        total,
        currentCompany: company.company_name,
        currentSource: ENRICHMENT_SOURCES.find(s => s.id === sourceId)?.name || sourceId,
      });

      try {
        const result = await enrichSingle(company, sourceId, config);
        companyResults.push(result);
      } catch (err) {
        companyResults.push({
          source: sourceId,
          fieldsUpdated: [],
          data: {},
          timestamp: new Date().toISOString(),
          error: err instanceof Error ? err.message : String(err),
        });
      }

      // Rate limiting between API calls
      await new Promise(r => setTimeout(r, 1500));
    }

    allResults.set(company.id, companyResults);
  }

  return allResults;
}
