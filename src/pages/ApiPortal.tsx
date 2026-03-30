import { BookOpen, Copy, Check } from 'lucide-react';
import { useState } from 'react';

const CODE_EXAMPLES = {
  curl: `curl -X GET "https://your-app.netlify.app/portal?key=YOUR_API_KEY"`,
  python: `import requests

API_KEY = "YOUR_API_KEY"
BASE_URL = "https://your-app.netlify.app"

# Get all assigned companies
response = requests.get(f"{BASE_URL}/portal?key={API_KEY}")
companies = response.json()

for company in companies:
    print(f"{company['company_name']} - {company['revenue']}")`,
  javascript: `const API_KEY = "YOUR_API_KEY";
const BASE_URL = "https://your-app.netlify.app";

// Get all assigned companies
const response = await fetch(\`\${BASE_URL}/portal?key=\${API_KEY}\`);
const companies = await response.json();

companies.forEach(company => {
  console.log(\`\${company.company_name} - \${company.revenue}\`);
});`,
};

export default function ApiPortal() {
  const [copied, setCopied] = useState<string | null>(null);

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-[#0A2540]">📖 API Documentation</h1>
        <p className="text-sm text-[#596880] mt-1">How clients can access their assigned company data</p>
      </div>

      {/* Authentication */}
      <div className="card">
        <h2 className="text-lg font-semibold text-[#0A2540] mb-3">Authentication</h2>
        <p className="text-sm text-[#596880] mb-3">
          Each client receives a unique API key. Pass it as a query parameter or use the client portal.
        </p>
        <div className="bg-[#F6F9FC] rounded-lg p-4 font-mono text-sm">
          <span className="text-[#635BFF]">GET</span> /portal?key=<span className="text-[#00D4AA]">CLIENT_API_KEY</span>
        </div>
      </div>

      {/* Endpoints */}
      <div className="card">
        <h2 className="text-lg font-semibold text-[#0A2540] mb-4">Endpoints</h2>

        <div className="space-y-4">
          <div className="border border-[#E3E8EE] rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="badge badge-green font-mono text-xs">GET</span>
              <code className="text-sm font-mono text-[#0A2540]">/portal?key=API_KEY</code>
            </div>
            <p className="text-sm text-[#596880]">Access the client portal — view and download assigned companies</p>
          </div>

          <div className="border border-[#E3E8EE] rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="badge badge-green font-mono text-xs">GET</span>
              <code className="text-sm font-mono text-[#0A2540]">/api/clients/[API_KEY].json</code>
            </div>
            <p className="text-sm text-[#596880]">Static JSON export — direct API access to assigned companies</p>
          </div>
        </div>
      </div>

      {/* Query Parameters */}
      <div className="card">
        <h2 className="text-lg font-semibold text-[#0A2540] mb-4">Query Parameters</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E3E8EE]">
                <th className="p-2 text-left text-[#596880] font-semibold">Parameter</th>
                <th className="p-2 text-left text-[#596880] font-semibold">Type</th>
                <th className="p-2 text-left text-[#596880] font-semibold">Description</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['key', 'string', 'Required. Your API key'],
                ['industry', 'string', 'Filter by industry'],
                ['geography', 'string', 'Filter by geography/state'],
                ['revenue_min', 'number', 'Minimum revenue'],
                ['revenue_max', 'number', 'Maximum revenue'],
                ['limit', 'number', 'Number of results (default: 100)'],
                ['offset', 'number', 'Pagination offset'],
              ].map(([param, type, desc]) => (
                <tr key={param} className="border-b border-[#E3E8EE]">
                  <td className="p-2 font-mono text-[#635BFF]">{param}</td>
                  <td className="p-2 text-[#596880]">{type}</td>
                  <td className="p-2 text-[#596880]">{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Response Format */}
      <div className="card">
        <h2 className="text-lg font-semibold text-[#0A2540] mb-4">Response Format</h2>
        <div className="bg-[#0A2540] rounded-lg p-4 overflow-x-auto">
          <pre className="text-sm text-green-400 font-mono">{`[
  {
    "company_name": "Acme Corp",
    "industry": "Software",
    "geography": "CA",
    "employees": 250,
    "revenue": 45000000,
    "profit_before_tax": 8000000,
    "total_assets": 120000000,
    "equity": 60000000,
    "website": "https://acme.com",
    "description": "Enterprise software company",
    "director_name": "John Smith",
    "director_title": "CEO"
  }
]`}</pre>
        </div>
      </div>

      {/* Code Examples */}
      <div className="card">
        <h2 className="text-lg font-semibold text-[#0A2540] mb-4">Code Examples</h2>
        <div className="space-y-4">
          {Object.entries(CODE_EXAMPLES).map(([lang, code]) => (
            <div key={lang}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-[#0A2540] capitalize">{lang}</h3>
                <button onClick={() => copy(code, lang)} className="text-xs text-[#596880] hover:text-[#635BFF] flex items-center gap-1">
                  {copied === lang ? <Check size={12} className="text-[#00D4AA]" /> : <Copy size={12} />}
                  {copied === lang ? 'Copied' : 'Copy'}
                </button>
              </div>
              <div className="bg-[#0A2540] rounded-lg p-4 overflow-x-auto">
                <pre className="text-sm text-green-400 font-mono whitespace-pre-wrap">{code}</pre>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Rate Limits */}
      <div className="card">
        <h2 className="text-lg font-semibold text-[#0A2540] mb-3">Rate Limits</h2>
        <p className="text-sm text-[#596880]">
          The client portal and static JSON exports have no rate limits as they're served as static files.
          For production API usage, we recommend caching responses and polling no more than once per hour.
        </p>
      </div>
    </div>
  );
}
