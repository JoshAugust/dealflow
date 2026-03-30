import type { Company, QualificationDetails, QualificationCriteria, QualificationResult } from './types';

// Key loaded from settings store at runtime
function getOpenAIKey(): string {
  try {
    const raw = localStorage.getItem('dealflow-app-store');
    if (raw) {
      const parsed = JSON.parse(raw);
      return parsed?.state?.settings?.aiApiKey || '';
    }
  } catch { /* ignore */ }
  return '';
}

// ─── Legacy config-based engine (kept for backwards compat) ──────────────────

export interface QualificationConfig {
  requireWebsite: boolean;
  requireDescription: boolean;
  requireRevenue: boolean;
  requireEmployees: boolean;
  requireContacts: boolean;
  minScore: number;
  autoQualifyOnUpload: boolean;
}

export const DEFAULT_QUAL_CONFIG: QualificationConfig = {
  requireWebsite: true,
  requireDescription: true,
  requireRevenue: true,
  requireEmployees: true,
  requireContacts: true,
  minScore: 60,
  autoQualifyOnUpload: false,
};

export function qualifyCompany(company: Company, config?: QualificationConfig): QualificationDetails {
  const cfg = config || DEFAULT_QUAL_CONFIG;

  const has_website = Boolean(company.website && company.website.trim().length > 0);
  const has_description = Boolean(company.description && company.description.trim().length > 0);
  const has_revenue = Boolean(company.revenue && company.revenue > 0);
  const has_employees = Boolean(company.employees && company.employees > 0);
  const has_contacts = Boolean(
    (company.director_name && company.director_name.trim().length > 0) ||
    (company.contacts && company.contacts.length > 0),
  );

  const criteria: { met: boolean; enabled: boolean; weight: number }[] = [
    { met: has_website, enabled: cfg.requireWebsite, weight: 20 },
    { met: has_description, enabled: cfg.requireDescription, weight: 20 },
    { met: has_revenue, enabled: cfg.requireRevenue, weight: 20 },
    { met: has_employees, enabled: cfg.requireEmployees, weight: 20 },
    { met: has_contacts, enabled: cfg.requireContacts, weight: 20 },
  ];

  const enabledCriteria = criteria.filter((c) => c.enabled);
  if (enabledCriteria.length === 0) {
    return { has_website, has_description, has_revenue, has_employees, has_contacts, overall_score: 100, checked_at: new Date().toISOString() };
  }

  const totalWeight = enabledCriteria.reduce((sum, c) => sum + c.weight, 0);
  const earnedWeight = enabledCriteria.filter((c) => c.met).reduce((sum, c) => sum + c.weight, 0);
  const overall_score = Math.round((earnedWeight / totalWeight) * 100);

  return { has_website, has_description, has_revenue, has_employees, has_contacts, overall_score, checked_at: new Date().toISOString() };
}

// ─── New per-client criteria engine ──────────────────────────────────────────

async function assessWebsite(
  websiteUrl: string,
  companyName: string,
  preference: 'professional' | 'non-professional' | 'any',
): Promise<{ isProfessional: boolean; assessment: string }> {
  if (!websiteUrl || preference === 'any') {
    return { isProfessional: true, assessment: 'No assessment required.' };
  }
  try {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getOpenAIKey()}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'You are a website quality analyst. Based on a URL and company name, assess whether the website is likely professional (modern, polished, CMS-built) or non-professional (basic, outdated, DIY, template-heavy, or minimal). Respond ONLY in JSON: {"isProfessional": boolean, "assessment": "one sentence reason"}',
          },
          {
            role: 'user',
            content: `Company: ${companyName}\nWebsite: ${websiteUrl}\n\nIs this website professional or non-professional?`,
          },
        ],
        max_tokens: 120,
      }),
    });
    if (resp.ok) {
      const data = await resp.json();
      const text = data.choices?.[0]?.message?.content || '';
      const parsed = JSON.parse(text);
      return {
        isProfessional: Boolean(parsed.isProfessional),
        assessment: parsed.assessment || '',
      };
    }
  } catch {
    // fallback: assume professional
  }
  return { isProfessional: true, assessment: 'Could not assess website.' };
}

export async function qualifyCompanyWithCriteria(
  company: Company,
  criteria: QualificationCriteria,
): Promise<QualificationResult> {
  const breakdown: QualificationResult['breakdown'] = [];
  const weights = criteria.weights;
  const totalWeight = Object.values(weights).reduce((s, w) => s + w, 0) || 1;

  // ── Revenue ──
  if (weights.revenue > 0) {
    const rev = company.revenue || 0;
    const hasMin = criteria.revenue_min != null;
    const hasMax = criteria.revenue_max != null;
    let revScore = 100;
    let revReason = 'No revenue criteria set.';
    if (hasMin || hasMax) {
      const meetsMin = !hasMin || rev >= (criteria.revenue_min ?? 0);
      const meetsMax = !hasMax || rev <= (criteria.revenue_max ?? Infinity);
      if (!rev) {
        revScore = 0;
        revReason = 'No revenue data.';
      } else if (meetsMin && meetsMax) {
        revScore = 100;
        revReason = `Revenue $${(rev / 1e6).toFixed(1)}M is within range.`;
      } else {
        // partial score based on proximity
        if (!meetsMin) {
          const ratio = Math.min(rev / (criteria.revenue_min ?? 1), 1);
          revScore = Math.round(ratio * 100);
          revReason = `Revenue $${(rev / 1e6).toFixed(1)}M is below minimum $${((criteria.revenue_min ?? 0) / 1e6).toFixed(1)}M.`;
        } else {
          revScore = 30;
          revReason = `Revenue $${(rev / 1e6).toFixed(1)}M exceeds maximum $${((criteria.revenue_max ?? 0) / 1e6).toFixed(1)}M.`;
        }
      }
    }
    breakdown.push({ criterion: 'Revenue', score: revScore, weight: weights.revenue, reason: revReason });
  }

  // ── Employees ──
  if (weights.employees > 0) {
    const emp = company.employees || 0;
    const hasMin = criteria.employees_min != null;
    const hasMax = criteria.employees_max != null;
    let empScore = 100;
    let empReason = 'No employee criteria set.';
    if (hasMin || hasMax) {
      const meetsMin = !hasMin || emp >= (criteria.employees_min ?? 0);
      const meetsMax = !hasMax || emp <= (criteria.employees_max ?? Infinity);
      if (!emp) {
        empScore = 0;
        empReason = 'No employee data.';
      } else if (meetsMin && meetsMax) {
        empScore = 100;
        empReason = `${emp.toLocaleString()} employees is within range.`;
      } else if (!meetsMin) {
        const ratio = Math.min(emp / (criteria.employees_min ?? 1), 1);
        empScore = Math.round(ratio * 100);
        empReason = `${emp.toLocaleString()} employees is below minimum ${criteria.employees_min?.toLocaleString()}.`;
      } else {
        empScore = 30;
        empReason = `${emp.toLocaleString()} employees exceeds maximum ${criteria.employees_max?.toLocaleString()}.`;
      }
    }
    breakdown.push({ criterion: 'Employees', score: empScore, weight: weights.employees, reason: empReason });
  }

  // ── Company Age ──
  if (weights.company_age > 0) {
    const currentYear = new Date().getFullYear();
    const yearInc = parseInt(company.year_incorporated || '0', 10);
    const ageYears = yearInc > 1800 ? currentYear - yearInc : null;
    const hasMin = criteria.min_years_incorporated != null;
    const hasMax = criteria.max_years_incorporated != null;
    let ageScore = 100;
    let ageReason = 'No company age criteria set.';
    if (hasMin || hasMax) {
      if (!ageYears) {
        ageScore = 0;
        ageReason = 'No incorporation year data.';
      } else {
        const meetsMin = !hasMin || ageYears >= (criteria.min_years_incorporated ?? 0);
        const meetsMax = !hasMax || ageYears <= (criteria.max_years_incorporated ?? Infinity);
        if (meetsMin && meetsMax) {
          ageScore = 100;
          ageReason = `Company is ${ageYears} years old — within target range.`;
        } else if (!meetsMin) {
          ageScore = Math.round((ageYears / (criteria.min_years_incorporated ?? 1)) * 100);
          ageReason = `Company is only ${ageYears} years old; minimum is ${criteria.min_years_incorporated} years.`;
        } else {
          ageScore = 30;
          ageReason = `Company is ${ageYears} years old; maximum is ${criteria.max_years_incorporated} years.`;
        }
      }
    }
    breakdown.push({ criterion: 'Company Age', score: ageScore, weight: weights.company_age, reason: ageReason });
  }

  // ── Industry ──
  if (weights.industry > 0) {
    const industry = (company.industry || company.nace || '').toLowerCase();
    let indScore = 50;
    let indReason = 'No industry criteria set.';
    const hasTarget = criteria.target_industries && criteria.target_industries.length > 0;
    const hasExclude = criteria.exclude_industries && criteria.exclude_industries.length > 0;
    if (hasExclude && criteria.exclude_industries!.some(ex => industry.includes(ex.toLowerCase()))) {
      indScore = 0;
      indReason = `Industry "${company.industry}" is excluded.`;
    } else if (hasTarget) {
      const matched = criteria.target_industries!.some(t => industry.includes(t.toLowerCase()));
      indScore = matched ? 100 : 20;
      indReason = matched
        ? `Industry "${company.industry}" matches target.`
        : `Industry "${company.industry}" not in target list.`;
    } else if (!industry) {
      indScore = 0;
      indReason = 'No industry data.';
    } else {
      indScore = 50;
      indReason = 'Industry present but no target/exclude criteria configured.';
    }
    breakdown.push({ criterion: 'Industry', score: indScore, weight: weights.industry, reason: indReason });
  }

  // ── LinkedIn ──
  if (weights.linkedin > 0) {
    const hasLinkedIn = Boolean(
      company.contacts?.some((c) => c.linkedin_url) ||
      (company as any).linkedin_url,
    );
    let liScore = 100;
    let liReason = 'LinkedIn not required.';
    if (criteria.require_linkedin) {
      liScore = hasLinkedIn ? 100 : 0;
      liReason = hasLinkedIn ? 'LinkedIn profile found.' : 'No LinkedIn profile found — required.';
    } else {
      liScore = hasLinkedIn ? 100 : 50;
      liReason = hasLinkedIn ? 'LinkedIn profile found.' : 'No LinkedIn profile.';
    }
    breakdown.push({ criterion: 'LinkedIn', score: liScore, weight: weights.linkedin, reason: liReason });
  }

  // ── Website Quality (AI) ──
  let aiWebsiteAssessment: string | undefined;
  if (weights.website > 0) {
    const hasWebsite = Boolean(company.website?.trim());
    let webScore = 50;
    let webReason = 'No website.';
    if (hasWebsite && criteria.website_preference !== 'any') {
      const { isProfessional, assessment } = await assessWebsite(
        company.website!,
        company.company_name,
        criteria.website_preference,
      );
      aiWebsiteAssessment = assessment;
      if (criteria.website_preference === 'non-professional') {
        webScore = isProfessional ? 20 : 100;
        webReason = isProfessional
          ? `Professional site — lower score (prefer non-professional). ${assessment}`
          : `Non-professional site — good match. ${assessment}`;
      } else {
        webScore = isProfessional ? 100 : 20;
        webReason = isProfessional
          ? `Professional site — good match. ${assessment}`
          : `Non-professional site — lower score. ${assessment}`;
      }
    } else if (hasWebsite) {
      webScore = 80;
      webReason = 'Website present.';
    }
    breakdown.push({ criterion: 'Website', score: webScore, weight: weights.website, reason: webReason });
  }

  // ── Geography ──
  if (weights.geography > 0) {
    const geo = (company.geography || '').toLowerCase();
    let geoScore = 50;
    let geoReason = 'No geography criteria set.';
    if (criteria.target_geographies && criteria.target_geographies.length > 0) {
      const matched = criteria.target_geographies.some(g => geo.includes(g.toLowerCase()));
      geoScore = matched ? 100 : 10;
      geoReason = matched
        ? `Geography "${company.geography}" matches target.`
        : `Geography "${company.geography}" not in target list.`;
    } else if (!geo) {
      geoScore = 0;
      geoReason = 'No geography data.';
    } else {
      geoScore = 50;
      geoReason = 'Geography present but no target configured.';
    }
    breakdown.push({ criterion: 'Geography', score: geoScore, weight: weights.geography, reason: geoReason });
  }

  // ── Weighted total ──
  const weightedSum = breakdown.reduce((sum, b) => sum + (b.score * b.weight) / 100, 0);
  const usedWeight = breakdown.reduce((sum, b) => sum + b.weight, 0);
  const score = usedWeight > 0 ? Math.round((weightedSum / usedWeight) * 100) : 0;

  let status: QualificationResult['status'];
  if (score >= criteria.auto_qualify_score) status = 'qualified';
  else if (score <= criteria.auto_reject_score) status = 'unqualified';
  else status = 'review';

  return { score, status, breakdown, ai_website_assessment: aiWebsiteAssessment, checked_at: new Date().toISOString() };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function getScoreLabel(score: number): { label: string; color: string; emoji: string } {
  if (score >= 80) return { label: 'Excellent', color: 'text-green-600 bg-green-50 border-green-200', emoji: '🟢' };
  if (score >= 60) return { label: 'Good', color: 'text-yellow-700 bg-yellow-50 border-yellow-200', emoji: '🟡' };
  if (score >= 40) return { label: 'Fair', color: 'text-orange-600 bg-orange-50 border-orange-200', emoji: '🟠' };
  return { label: 'Poor', color: 'text-red-600 bg-red-50 border-red-200', emoji: '🔴' };
}

export function getStatusBadge(status?: 'qualified' | 'unqualified' | 'review'): { label: string; bg: string; color: string } {
  if (status === 'qualified') return { label: 'Qualified', bg: '#D1FAE5', color: '#065F46' };
  if (status === 'unqualified') return { label: 'Unqualified', bg: '#FEE2E2', color: '#991B1B' };
  if (status === 'review') return { label: 'Review', bg: '#FEF3C7', color: '#92400E' };
  return { label: 'Not Scored', bg: '#F3F4F6', color: '#6B7280' };
}

export async function validateWebsite(url: string): Promise<boolean> {
  if (!url) return false;
  try {
    await fetch(url.startsWith('http') ? url : `https://${url}`, { method: 'HEAD', mode: 'no-cors' });
    return true;
  } catch {
    return false;
  }
}
