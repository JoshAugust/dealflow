# DealFlow — New Tabs Gameplan

## What We're Adding

### Tab 1: 📞 Call Sheet
A calling/outreach tab for working through enriched leads. Modeled on our jordan.ai `CallSheetPage.tsx` and `OutreachPage.tsx`.

**Features:**
- **Call queue** — filtered view of companies with phone numbers, sorted by Blueprint score
- **Call status tracking** — Not Called → Called (No Answer / Left VM / Spoke to Gatekeeper / Spoke to DM) → Callback Scheduled / Interested / Not Interested
- **Click-to-call** — `tel:` links for phone numbers
- **Contact cards** — show DM name, title, email, phone, LinkedIn per company
- **Call notes** — per-call notes with timestamp
- **Outreach sequences** — multi-step email/call/LinkedIn cadences (from jordan.ai OutreachPage)
- **Daily call list** — "Today's calls" view with callbacks + fresh leads
- **Stats bar** — calls made today, connect rate, meetings booked

**Data source:** Uses the existing Company + Contact types from dealflow's `types.ts` and IndexedDB. Phone/email fields already exist on the Contact interface.

### Tab 2: 🔬 Enrichment Lab
A one-stop enrichment powerhouse pulling together everything we've built across jordan.ai and the pipeline scripts.

**Features:**
- **Multi-source enrichment panel** (from jordan.ai `enrichment/sources/`):
  - Company Website scraper (tech stack, about page, team)
  - Web Search (DuckDuckGo, no API key)
  - Google Business (phone, address, ratings)
  - Email Discovery (pattern detection)
  - LinkedIn lookup (company + people profiles)
  - Funding research (rounds, amounts, investors)
  - News Monitor (recent press, partnerships, exec changes)
  - Job Postings (hiring signals)
  - Social Signals (Twitter/X, GitHub)
  - SEC EDGAR (public filings)
  - Wappalyzer (tech stack detection)
  - Phone Validation (Abstract API)
  - Apollo.io (org enrichment + people search)
- **Website Vibe Scorer** (from pipeline `batch-vibe-score.mjs`) — heuristic scoring to detect "vibe-coded" startups
- **Blueprint Scoring** (from pipeline `qualify_pipeline.py`) — 0-100 ICP fit score with tech/non-tech breakdown
- **Batch operations** — select multiple companies, run enrichment on all
- **Enrichment log** — track what sources ran, what fields updated, timestamps
- **Progress indicators** — real-time progress bars during batch runs
- **Source health** — green/yellow/red status per source (API key configured? Rate limited? Working?)

**Architecture note:** The jordan.ai enrichment sources use server-side code (cheerio, Drizzle/Postgres). For DealFlow (client-side Vite app with IndexedDB), we have two paths:

1. **AI-powered enrichment** (already in dealflow) — Uses Anthropic Claude API directly from browser to analyze companies. This works today via `enrichmentSources.ts`.
2. **Direct API enrichment** (Apollo, Hunter) — Already partially built in dealflow's `apolloService.ts`. Extend with more direct-API sources.
3. **Proxy-free web scraping** — Some sources (DDG search, website fetch) need a CORS proxy or backend. We can either:
   - Add a lightweight Express proxy (like jordan.ai's server)
   - Use a Cloudflare Worker as CORS proxy
   - Keep it AI-only (Claude analyzes based on company name/website)

**Recommendation:** Start with approach (1) + (2) — AI enrichment + direct APIs. These work in-browser today. Add CORS proxy later if needed for web scraping sources.

---

## Implementation Plan

### Phase 1: Call Sheet Tab (~500 lines)
1. Create `src/pages/CallSheet.tsx`
   - Port call status tracking, contact cards, click-to-call from jordan.ai
   - Call queue with filters (Blueprint score, status, has phone)
   - Call notes + timestamps stored in IndexedDB
2. Add to `App.tsx` routes + `Sidebar.tsx` nav
3. Add `call_status`, `call_notes`, `last_called_at` fields to Company type
4. DB migration (bump IDB version)

### Phase 2: Enrichment Lab Tab (~800 lines)
1. Create `src/pages/EnrichmentLab.tsx`
   - Source cards grid (13 sources, each with status indicator)
   - Single-company enrichment panel
   - Batch enrichment with progress
   - Enrichment history log
2. Create `src/lib/enrichmentEngine.ts`
   - Unified enrichment runner (handles both AI and direct API sources)
   - Source health checks
   - Rate limiting
3. Port Apollo enrichment improvements (already in `apolloService.ts` — just needs the `api_search` endpoint fix)
4. Add Vibe Score display + Blueprint Score to company cards
5. Enrichment results stored per-company in IndexedDB

### Phase 3: Polish (~200 lines)
1. Dashboard stats integration (calls made, enrichment coverage)
2. Enrichment status badges on Companies list
3. Call sheet <> Enrichment cross-linking (enrich a lead before calling)

---

## Files to Create/Modify

### New Files
- `src/pages/CallSheet.tsx` — Call sheet page
- `src/pages/EnrichmentLab.tsx` — Enrichment lab page
- `src/lib/enrichmentEngine.ts` — Unified enrichment runner
- `src/lib/vibeScorer.ts` — Client-side vibe scoring logic
- `src/lib/blueprintScorer.ts` — Blueprint v3 scoring logic
- `src/components/CallCard.tsx` — Individual call/contact card
- `src/components/EnrichmentSourceCard.tsx` — Source status card
- `src/components/EnrichmentProgress.tsx` — Batch progress UI

### Modified Files
- `src/App.tsx` — Add routes for /call-sheet and /enrichment
- `src/components/Sidebar.tsx` — Add nav items
- `src/lib/types.ts` — Add call tracking fields, enrichment log type
- `src/lib/db.ts` — DB version bump + new indexes
- `src/lib/apolloService.ts` — Fix deprecated endpoint

---

## What We're NOT Doing (Yet)
- Server-side enrichment proxy (can add later)
- Outbound email sending (needs SMTP backend)
- Phone dialing integration (Twilio needs backend)
- Product Hunt API integration (API key + rate limits)
- Orange Slice SDK integration (needs Node.js backend)

---

## Estimated Effort
- Phase 1: ~2 hours (sub-agent)
- Phase 2: ~3 hours (sub-agent)  
- Phase 3: ~1 hour (sub-agent)
- Total: ~6 hours automated, 0 hours manual

Ready to execute on your approval, my Tribal Chief.
