import type { Company } from './types';

export interface AIConfig {
  provider: 'openai' | 'anthropic';
  apiKey: string;
  model: string;
}

export async function enrichCompany(
  company: Company,
  config: AIConfig
): Promise<Partial<Company>> {
  const prompt = `Research this company and provide accurate details.
Company: ${company.company_name}
Location: ${company.geography || 'Unknown'}
Industry: ${company.industry || company.nace || 'Unknown'}
${company.website ? `Website: ${company.website}` : ''}

Return ONLY a valid JSON object with these fields (only include fields you can confidently find):
{
  "description": "Brief company description (2-3 sentences)",
  "website": "company website URL",
  "industry": "Industry/sector",
  "employees": estimated employee count as number,
  "revenue": estimated annual revenue in USD as number,
  "director_name": "CEO or key director name",
  "director_title": "Their title"
}

Important: Return ONLY the JSON, no markdown, no explanation.`;

  if (config.provider === 'openai') {
    return callOpenAI(prompt, config);
  } else {
    return callClaude(prompt, config);
  }
}

async function callOpenAI(
  prompt: string,
  config: AIConfig
): Promise<Partial<Company>> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model || 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are a company research assistant. Return only valid JSON.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API error: ${res.status} — ${err}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || '';
  return parseJSONResponse(content);
}

async function callClaude(
  prompt: string,
  config: AIConfig
): Promise<Partial<Company>> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: config.model || 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API error: ${res.status} — ${err}`);
  }

  const data = await res.json();
  const content = data.content?.[0]?.text || '';
  return parseJSONResponse(content);
}

function parseJSONResponse(content: string): Partial<Company> {
  // Strip markdown code fences if present
  let cleaned = content.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }
  try {
    const parsed = JSON.parse(cleaned);
    // Only return valid fields
    const result: Partial<Company> = {};
    if (parsed.description) result.description = String(parsed.description);
    if (parsed.website) result.website = String(parsed.website);
    if (parsed.industry) result.industry = String(parsed.industry);
    if (parsed.employees) result.employees = Number(parsed.employees) || 0;
    if (parsed.revenue) result.revenue = Number(parsed.revenue) || 0;
    if (parsed.director_name) result.director_name = String(parsed.director_name);
    if (parsed.director_title) result.director_title = String(parsed.director_title);
    return result;
  } catch {
    throw new Error('Failed to parse AI response as JSON');
  }
}
