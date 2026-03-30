export interface QualificationDetails {
  has_website: boolean;
  has_description: boolean;
  has_revenue: boolean;
  has_employees: boolean;
  has_contacts: boolean;
  website_valid?: boolean;
  overall_score: number;
  checked_at: string;
}

export interface QualificationCriteria {
  id: string;
  clientId: string;
  name: string;
  // Revenue
  revenue_min?: number;
  revenue_max?: number;
  // Employees
  employees_min?: number;
  employees_max?: number;
  // Company age
  min_years_incorporated?: number;
  max_years_incorporated?: number;
  // Industry
  target_industries?: string[];
  exclude_industries?: string[];
  // LinkedIn
  require_linkedin?: boolean;
  // Website quality
  website_preference: 'professional' | 'non-professional' | 'any';
  // Geography
  target_geographies?: string[];
  // Weights (0–100)
  weights: {
    revenue: number;
    employees: number;
    company_age: number;
    industry: number;
    linkedin: number;
    website: number;
    geography: number;
  };
  // Thresholds
  auto_qualify_score: number;
  auto_reject_score: number;
  created_at: string;
}

export interface QualificationResult {
  score: number;
  status: 'qualified' | 'unqualified' | 'review';
  breakdown: { criterion: string; score: number; weight: number; reason: string }[];
  ai_website_assessment?: string;
  checked_at: string;
}

export interface Contact {
  name: string;
  title: string;
  email?: string;
  phone?: string;
  linkedin_url?: string;
}

export interface Director {
  name: string;
  title: string;
}

export interface CustomColumn {
  id: string;
  key: string;
  label: string;
  type: 'text' | 'number' | 'url' | 'date' | 'boolean' | 'select';
  options?: string[];
  required?: boolean;
  defaultValue?: string;
  created_at: string;
}

export interface Company {
  id: string;
  company_name: string;
  geography: string;
  industry: string;
  nace: string;
  employees: number;
  revenue: number;
  profit_before_tax: number;
  total_assets: number;
  equity: number;
  website: string;
  description: string;
  address: string;
  director_name: string;
  director_title: string;
  year_incorporated: string;
  tags: string[];
  notes: string;
  status: CompanyStatus;
  score: number;
  source: string;
  client_ids: string[];
  created_at: string;
  updated_at: string;
  // New fields
  directors: Director[];
  qualification_score?: number;
  qualification_details?: QualificationDetails;
  qualification_status?: 'qualified' | 'unqualified' | 'review';
  qualification_result?: QualificationResult;
  contacts?: Contact[];
  [key: string]: unknown;
}

export type CompanyStatus = 'new' | 'reviewed' | 'shortlisted' | 'in_discussion' | 'due_diligence' | 'closed_won' | 'passed' | 'contacted' | 'responded' | 'meeting_booked' | 'qualified' | 'won' | 'lost';

export interface Client {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  type: 'deal_sourcing' | 'lead_generation';
  apiKey: string;
  created_at: string;
  last_accessed: string;
  notes: string;
}

export interface ActivityLog {
  id: string;
  type: string;
  description: string;
  entity_id: string;
  entity_type: string;
  timestamp: string;
}

export interface Share {
  id: string;
  name: string;
  client_id: string;
  company_count: number;
  filters: Record<string, unknown>;
  created_at: string;
}

export interface CompanyFilters {
  search: string;
  industry: string;
  geography: string;
  revenueMin: string;
  revenueMax: string;
  employeesMin: string;
  employeesMax: string;
  status: string;
  tags: string[];
  source: string;
  qualificationStatus?: string;
}

export const STATUS_LABELS: Record<CompanyStatus, string> = {
  new: 'New',
  reviewed: 'Reviewed',
  shortlisted: 'Shortlisted',
  in_discussion: 'In Discussion',
  due_diligence: 'Due Diligence',
  closed_won: 'Closed Won',
  passed: 'Passed',
  contacted: 'Contacted',
  responded: 'Responded',
  meeting_booked: 'Meeting Booked',
  qualified: 'Qualified',
  won: 'Won',
  lost: 'Lost',
};

export const STATUS_COLORS: Record<CompanyStatus, string> = {
  new: 'badge-blue',
  reviewed: 'badge-gray',
  shortlisted: 'badge-purple',
  in_discussion: 'badge-yellow',
  due_diligence: 'badge-yellow',
  closed_won: 'badge-green',
  passed: 'badge-red',
  contacted: 'badge-blue',
  responded: 'badge-green',
  meeting_booked: 'badge-yellow',
  qualified: 'badge-purple',
  won: 'badge-green',
  lost: 'badge-red',
};

export const DEAL_SOURCING_STAGES: CompanyStatus[] = ['new', 'reviewed', 'shortlisted', 'in_discussion', 'due_diligence', 'closed_won', 'passed'];
export const LEAD_GEN_STAGES: CompanyStatus[] = ['new', 'contacted', 'responded', 'meeting_booked', 'qualified', 'won', 'lost'];
