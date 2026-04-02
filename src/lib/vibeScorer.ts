/**
 * Vibe Scorer — heuristic scoring to detect "vibe-coded" startups.
 * Score 0-100 based on website signals.
 * Ported from batch-vibe-score.mjs for in-browser use.
 */

export interface VibeScoreResult {
  score: number;
  signals: string[];
}

const WEBSITE_BUILDERS = [
  'squarespace', 'wix', 'webflow', 'framer', 'carrd',
  'wordpress.com', 'weebly', 'godaddy', 'duda',
  'bubble.io', 'softr', 'typedream', 'super.so',
];

const VAGUE_HERO_PATTERNS = [
  /we\s+(help|empower|enable|transform|revolutionize|reimagine)/i,
  /the\s+future\s+of/i,
  /next[\s-]gen(eration)?/i,
  /cutting[\s-]edge/i,
  /world[\s-]class/i,
  /ai[\s-]powered/i,
  /unlock\s+(your|the)/i,
  /supercharge/i,
  /scale\s+your/i,
  /all[\s-]in[\s-]one/i,
];

export function vibeScoreFromSignals(opts: {
  domain?: string;
  hasWebsiteBuilder?: boolean;
  hasSitemap?: boolean;
  heroText?: string;
  blogCount?: number;
  hasCareers?: boolean;
  customerLogosCount?: number;
  hasPricing?: boolean;
}): VibeScoreResult {
  let score = 0;
  const signals: string[] = [];

  // Website builder detection (+25)
  if (opts.hasWebsiteBuilder) {
    score += 25;
    signals.push('Website builder detected (+25)');
  }

  // .io/.ai domain (+10)
  if (opts.domain) {
    const d = opts.domain.toLowerCase();
    if (d.endsWith('.io') || d.endsWith('.ai') || d.endsWith('.co') || d.endsWith('.xyz')) {
      score += 10;
      signals.push(`Trendy TLD: ${d.split('.').pop()} (+10)`);
    }
  }

  // No sitemap (+10)
  if (opts.hasSitemap === false) {
    score += 10;
    signals.push('No sitemap found (+10)');
  }

  // Vague hero text (+15)
  if (opts.heroText) {
    const isVague = VAGUE_HERO_PATTERNS.some(p => p.test(opts.heroText!));
    if (isVague) {
      score += 15;
      signals.push('Vague hero text (+15)');
    }
  }

  // Few blogs (+10)
  if (opts.blogCount !== undefined && opts.blogCount < 3) {
    score += 10;
    signals.push(`Few blog posts: ${opts.blogCount} (+10)`);
  }

  // No careers page (+10)
  if (opts.hasCareers === false) {
    score += 10;
    signals.push('No careers page (+10)');
  }

  // Few customer logos (+10)
  if (opts.customerLogosCount !== undefined && opts.customerLogosCount < 3) {
    score += 10;
    signals.push(`Few customer logos: ${opts.customerLogosCount} (+10)`);
  }

  // No pricing page (+10)
  if (opts.hasPricing === false) {
    score += 10;
    signals.push('No pricing page (+10)');
  }

  return { score: Math.min(score, 100), signals };
}

/**
 * Quick vibe score from just domain and basic info (no fetch).
 * Returns a partial score based on available data.
 */
export function quickVibeScore(domain?: string): VibeScoreResult {
  if (!domain) return { score: 0, signals: ['No domain available'] };

  const signals: string[] = [];
  let score = 0;
  const d = domain.toLowerCase();

  // TLD scoring
  if (d.endsWith('.io') || d.endsWith('.ai') || d.endsWith('.co') || d.endsWith('.xyz')) {
    score += 10;
    signals.push(`Trendy TLD (+10)`);
  }

  // Builder domain detection
  if (WEBSITE_BUILDERS.some(b => d.includes(b))) {
    score += 25;
    signals.push('Website builder domain detected (+25)');
  }

  return { score: Math.min(score, 100), signals };
}

/**
 * Full vibe score — fetches website and analyses content.
 * May fail due to CORS; returns partial score on error.
 */
export async function fullVibeScore(website: string): Promise<VibeScoreResult> {
  const domain = website.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
  let hasWebsiteBuilder = false;
  let hasSitemap: boolean | undefined;
  let heroText: string | undefined;
  let hasPricing: boolean | undefined;
  let hasCareers: boolean | undefined;

  try {
    const url = website.startsWith('http') ? website : `https://${website}`;
    const res = await fetch(url, { mode: 'cors', signal: AbortSignal.timeout(8000) });
    if (res.ok) {
      const html = await res.text();
      const lower = html.toLowerCase();

      // Check for website builders
      hasWebsiteBuilder = WEBSITE_BUILDERS.some(b => lower.includes(b));

      // Extract first heading-like text as hero
      const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
      if (h1Match) heroText = h1Match[1].replace(/<[^>]+>/g, '').trim();

      // Check for common page links
      hasPricing = /href=["'][^"']*pric/i.test(html);
      hasCareers = /href=["'][^"']*career|href=["'][^"']*jobs/i.test(html);
    }
  } catch {
    // CORS or network error — return partial score
    return quickVibeScore(domain);
  }

  // Check sitemap
  try {
    const sitemapUrl = `https://${domain}/sitemap.xml`;
    const sRes = await fetch(sitemapUrl, { mode: 'cors', signal: AbortSignal.timeout(5000) });
    hasSitemap = sRes.ok;
  } catch {
    hasSitemap = undefined; // Unknown
  }

  return vibeScoreFromSignals({
    domain,
    hasWebsiteBuilder,
    hasSitemap,
    heroText,
    hasPricing,
    hasCareers,
  });
}
