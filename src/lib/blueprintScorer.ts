/**
 * Blueprint v3 Scoring — ICP fit score for deal sourcing.
 * Combines tech signals (max 65) + non-tech signals (max 35) for a 0-100 score.
 */

import type { Company } from './types';

export interface BlueprintResult {
  techScore: number;
  nonTechScore: number;
  totalScore: number;
  grade: string;
  signals: string[];
}

const SOFTWARE_KEYWORDS = [
  'software', 'saas', 'platform', 'cloud', 'api', 'data',
  'analytics', 'automation', 'digital', 'cyber', 'machine learning',
  'artificial intelligence', 'ai', 'ml', 'devops', 'fintech',
  'healthtech', 'edtech', 'proptech', 'insurtech', 'regtech',
  'blockchain', 'iot', 'robotics', 'deep learning',
];

const TECH_HUBS = [
  'san francisco', 'new york', 'london', 'austin', 'seattle',
  'boston', 'denver', 'miami', 'los angeles', 'chicago',
  'berlin', 'amsterdam', 'tel aviv', 'toronto', 'singapore',
  'bangalore', 'palo alto', 'mountain view', 'san jose',
  'cambridge', 'dublin', 'stockholm', 'paris',
];

const ACCELERATOR_SIGNALS = [
  'y combinator', 'yc', 'techstars', '500 startups', 'plug and play',
  'seedcamp', 'antler', 'entrepreneur first', 'ef', 'accelerator',
  'incubator', 'backed by', 'portfolio company',
];

export function blueprintScore(company: Company, vibeScore?: number): BlueprintResult {
  const signals: string[] = [];
  let techScore = 0;
  let nonTechScore = 0;

  const desc = (company.description || '').toLowerCase();
  const industry = (company.industry || company.nace || '').toLowerCase();
  const website = (company.website || '').toLowerCase();
  const geo = (company.geography || '').toLowerCase();
  const domain = website.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];

  // ── TECH SCORE (max 65) ──────────────────────────────────────────────

  // Software/AI keywords in description or industry (+25)
  const hasSoftwareKeywords = SOFTWARE_KEYWORDS.some(kw =>
    desc.includes(kw) || industry.includes(kw)
  );
  if (hasSoftwareKeywords) {
    techScore += 25;
    signals.push('Software/AI keywords detected (+25 tech)');
  }

  // SIC code 73xx (Computer & Data Services) (+15)
  const sic = (company.nace || '').replace(/\D/g, '');
  if (sic.startsWith('73') || sic.startsWith('72') || sic.startsWith('51')) {
    techScore += 15;
    signals.push(`Tech SIC/NACE code: ${company.nace} (+15 tech)`);
  }

  // Vibe score integration
  if (vibeScore !== undefined) {
    if (vibeScore > 60) {
      techScore += 30;
      signals.push(`High vibe score: ${vibeScore} (+30 tech)`);
    } else if (vibeScore >= 30) {
      techScore += 15;
      signals.push(`Medium vibe score: ${vibeScore} (+15 tech)`);
    }
  }

  // .io/.ai domain (+5)
  if (domain.endsWith('.io') || domain.endsWith('.ai')) {
    techScore += 5;
    signals.push(`Tech TLD: .${domain.split('.').pop()} (+5 tech)`);
  }

  techScore = Math.min(techScore, 65);

  // ── NON-TECH SCORE (max 35) ──────────────────────────────────────────

  // Employee count: 1-20 (+8), 21-50 (+3)
  const emp = company.employees || 0;
  if (emp >= 1 && emp <= 20) {
    nonTechScore += 8;
    signals.push(`Small team: ${emp} employees (+8 non-tech)`);
  } else if (emp >= 21 && emp <= 50) {
    nonTechScore += 3;
    signals.push(`Growing team: ${emp} employees (+3 non-tech)`);
  }

  // Small entity indicator (+3) — revenue under $10M or employees under 50
  const rev = company.revenue || 0;
  if ((rev > 0 && rev < 10_000_000) || (emp > 0 && emp < 50)) {
    nonTechScore += 3;
    signals.push('Small entity indicators (+3 non-tech)');
  }

  // Recent incorporation (+7) — within last 10 years
  const yearInc = parseInt(company.year_incorporated || '0', 10);
  const currentYear = new Date().getFullYear();
  if (yearInc > 0 && (currentYear - yearInc) <= 10) {
    nonTechScore += 7;
    signals.push(`Recent incorporation: ${yearInc} (+7 non-tech)`);
  }

  // Low revenue — under $5M (+4)
  if (rev > 0 && rev < 5_000_000) {
    nonTechScore += 4;
    signals.push(`Low revenue: $${(rev / 1e6).toFixed(1)}M (+4 non-tech)`);
  }

  // Tech hub location (+3)
  if (TECH_HUBS.some(hub => geo.includes(hub))) {
    nonTechScore += 3;
    signals.push('Tech hub location (+3 non-tech)');
  }

  // Accelerator/incubator signals (+5)
  if (ACCELERATOR_SIGNALS.some(sig => desc.includes(sig))) {
    nonTechScore += 5;
    signals.push('Accelerator/incubator signal (+5 non-tech)');
  }

  nonTechScore = Math.min(nonTechScore, 35);

  const totalScore = techScore + nonTechScore;

  let grade: string;
  if (totalScore >= 80) grade = 'A';
  else if (totalScore >= 60) grade = 'B';
  else if (totalScore >= 40) grade = 'C';
  else if (totalScore >= 20) grade = 'D';
  else grade = 'F';

  return { techScore, nonTechScore, totalScore, grade, signals };
}
