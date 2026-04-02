import type { Company, Contact } from './types';

export interface ApolloConfig {
  apiKey: string;
}

export interface ApolloOrgResult {
  name?: string;
  website_url?: string;
  short_description?: string;
  estimated_num_employees?: number;
  annual_revenue?: number;
  industry?: string;
  linkedin_url?: string;
  founded_year?: number;
  technologies?: string[];
  total_funding?: number;
}

export interface ApolloPersonResult {
  first_name?: string;
  last_name?: string;
  title?: string;
  email?: string;
  phone_numbers?: { raw_number: string }[];
  linkedin_url?: string;
  organization_name?: string;
}

export async function enrichWithApollo(
  company: Company,
  config: ApolloConfig
): Promise<{ companyData: Partial<Company>; contacts: Contact[] }> {
  const companyData = await enrichOrganization(company, config);
  const contacts = await findContacts(company, config);
  return { companyData, contacts };
}

async function enrichOrganization(
  company: Company,
  config: ApolloConfig
): Promise<Partial<Company>> {
  const domain = extractDomain(company.website);

  const res = await fetch('https://api.apollo.io/api/v1/organizations/enrich', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': config.apiKey,
    },
    body: JSON.stringify({
      domain: domain || undefined,
      name: company.company_name,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Apollo API error: ${res.status} — ${err}`);
  }

  const data = await res.json();
  const org: ApolloOrgResult = data.organization || {};

  const result: Partial<Company> = {};
  if (org.short_description && !company.description) result.description = org.short_description;
  if (org.website_url && !company.website) result.website = org.website_url;
  if (org.estimated_num_employees && !company.employees) result.employees = org.estimated_num_employees;
  if (org.annual_revenue && !company.revenue) result.revenue = org.annual_revenue;
  if (org.industry && !company.industry) result.industry = org.industry;
  if (org.founded_year && !company.year_incorporated) result.year_incorporated = String(org.founded_year);
  return result;
}

async function findContacts(
  company: Company,
  config: ApolloConfig
): Promise<Contact[]> {
  const domain = extractDomain(company.website);
  if (!domain) return [];

  const res = await fetch('https://api.apollo.io/api/v1/mixed_people/api_search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': config.apiKey,
    },
    body: JSON.stringify({
      organization_domains: [domain],
      page: 1,
      per_page: 10,
    }),
  });

  if (!res.ok) return [];

  const data = await res.json();
  const people: ApolloPersonResult[] = data.people || [];

  return people.map((p) => ({
    name: [p.first_name, p.last_name].filter(Boolean).join(' '),
    title: p.title || '',
    email: p.email || undefined,
    phone: p.phone_numbers?.[0]?.raw_number || undefined,
    linkedin_url: p.linkedin_url || undefined,
  }));
}

export async function enrichPerson(
  name: string,
  companyName: string,
  config: ApolloConfig
): Promise<Contact | null> {
  const nameParts = name.trim().split(/\s+/);
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';

  const res = await fetch('https://api.apollo.io/api/v1/people/match', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': config.apiKey,
    },
    body: JSON.stringify({
      first_name: firstName,
      last_name: lastName,
      organization_name: companyName,
    }),
  });

  if (!res.ok) return null;

  const data = await res.json();
  const person: ApolloPersonResult = data.person || {};
  if (!person.first_name && !person.last_name) return null;

  return {
    name: [person.first_name, person.last_name].filter(Boolean).join(' '),
    title: person.title || '',
    email: person.email || undefined,
    phone: person.phone_numbers?.[0]?.raw_number || undefined,
    linkedin_url: person.linkedin_url || undefined,
  };
}

function extractDomain(url: string): string {
  if (!url) return '';
  try {
    const u = url.startsWith('http') ? url : `https://${url}`;
    return new URL(u).hostname.replace('www.', '');
  } catch {
    return url.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
  }
}

export async function testApolloConnection(config: ApolloConfig): Promise<boolean> {
  try {
    const res = await fetch('https://api.apollo.io/api/v1/auth/health', {
      method: 'GET',
      headers: { 'X-Api-Key': config.apiKey },
    });
    return res.ok;
  } catch {
    return false;
  }
}
