import { X, ExternalLink } from 'lucide-react';
import { formatCurrency, formatNumber } from '../lib/format';
import type { Company, Director, Contact } from '../lib/types';
import { STATUS_LABELS, STATUS_COLORS } from '../lib/types';

interface Props {
  company: Company | null;
  onClose: () => void;
}

export default function CompanyModal({ company, onClose }: Props) {
  if (!company) return null;

  const financials = [
    { label: 'Revenue', value: formatCurrency(company.revenue) },
    { label: 'P/L Before Tax', value: formatCurrency(company.profit_before_tax) },
    { label: 'Total Assets', value: formatCurrency(company.total_assets) },
    { label: 'Equity', value: formatCurrency(company.equity) },
  ];

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'white', borderRadius: 16, width: 720,
          maxHeight: '90vh', overflowY: 'auto',
          border: '1px solid #E3E8EE', boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid #E3E8EE',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0A2540', margin: 0 }}>
                {company.company_name}
              </h2>
              <span className={`badge ${STATUS_COLORS[company.status] || 'badge-gray'}`}>
                {STATUS_LABELS[company.status] || company.status}
              </span>
            </div>
            {company.description && (
              <p style={{ fontSize: 13, color: '#596880', marginTop: 8, maxWidth: 550, lineHeight: 1.5 }}>
                {company.description}
              </p>
            )}
            <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 13, color: '#596880' }}>
              {company.geography && <span>📍 {company.geography}</span>}
              {company.industry && <span>🏭 {company.industry}</span>}
              {company.year_incorporated && <span>📅 Est. {company.year_incorporated}</span>}
              {company.website && (
                <a
                  href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: '#635BFF', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  <ExternalLink size={13} /> Website
                </a>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: 6, borderRadius: 8, color: '#596880',
            }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: 24 }}>
          {/* Financials */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
            {financials.map((f) => (
              <div key={f.label} style={{
                background: '#F6F9FC', borderRadius: 10, padding: '14px 16px',
                border: '1px solid #E3E8EE',
              }}>
                <p style={{ fontSize: 11, color: '#596880', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{f.label}</p>
                <p style={{ fontSize: 20, fontWeight: 700, color: '#0A2540', margin: '6px 0 0' }}>{f.value}</p>
              </div>
            ))}
          </div>

          {/* Company Details */}
          <div style={{
            background: '#F6F9FC', borderRadius: 10, padding: 20,
            border: '1px solid #E3E8EE', marginBottom: 24,
          }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: '#0A2540', margin: '0 0 14px' }}>Company Details</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 24px', fontSize: 13 }}>
              <div><span style={{ color: '#596880' }}>Employees:</span> <strong style={{ marginLeft: 8 }}>{formatNumber(company.employees)}</strong></div>
              <div><span style={{ color: '#596880' }}>NACE:</span> <strong style={{ marginLeft: 8 }}>{company.nace || '—'}</strong></div>
              <div><span style={{ color: '#596880' }}>Address:</span> <strong style={{ marginLeft: 8 }}>{company.address || '—'}</strong></div>
              <div><span style={{ color: '#596880' }}>Source:</span> <strong style={{ marginLeft: 8 }}>{company.source || '—'}</strong></div>
              <div><span style={{ color: '#596880' }}>Year Inc.:</span> <strong style={{ marginLeft: 8 }}>{company.year_incorporated || '—'}</strong></div>
              <div><span style={{ color: '#596880' }}>Website:</span> <strong style={{ marginLeft: 8 }}>{company.website || '—'}</strong></div>
            </div>
          </div>

          {/* Directors */}
          {(company.director_name || (company.directors && company.directors.length > 0)) && (
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: '#0A2540', margin: '0 0 12px' }}>Directors & Officers</h3>

              {company.director_name && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 16px', background: '#F0EEFF', borderRadius: 10,
                  marginBottom: 8, border: '1px solid rgba(99,91,255,0.15)',
                }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: '50%', background: '#635BFF',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'white', fontWeight: 700, fontSize: 15, flexShrink: 0,
                  }}>
                    {company.director_name.charAt(0)}
                  </div>
                  <div>
                    <p style={{ fontWeight: 600, color: '#0A2540', fontSize: 14, margin: 0 }}>{company.director_name}</p>
                    <p style={{ fontSize: 12, color: '#635BFF', margin: '2px 0 0' }}>{company.director_title || '—'}</p>
                  </div>
                </div>
              )}

              {company.directors && company.directors.length > 1 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginTop: 8 }}>
                  {company.directors.slice(1).map((dir: Director, idx: number) => (
                    <div key={idx} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 12px', background: '#F6F9FC', borderRadius: 8,
                      border: '1px solid #E3E8EE',
                    }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: '50%', background: '#E3E8EE',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#596880', fontSize: 12, fontWeight: 600, flexShrink: 0,
                      }}>
                        {dir.name?.charAt(0) || '?'}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 500, color: '#0A2540', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dir.name}</p>
                        <p style={{ fontSize: 12, color: '#596880', margin: 0 }}>{dir.title || '—'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Contacts */}
          {company.contacts && company.contacts.length > 0 && (
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: '#0A2540', margin: '0 0 12px' }}>Contacts</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {company.contacts.map((contact: Contact, idx: number) => (
                  <div key={idx} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 12px', background: '#F6F9FC', borderRadius: 8,
                    border: '1px solid #E3E8EE',
                  }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%', background: '#ECFDF5',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#065F46', fontSize: 12, fontWeight: 600, flexShrink: 0,
                    }}>
                      {contact.name?.charAt(0) || '?'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 13, fontWeight: 500, color: '#0A2540', margin: 0 }}>{contact.name}</p>
                      <p style={{ fontSize: 12, color: '#596880', margin: 0 }}>{contact.title}</p>
                      <div style={{ display: 'flex', gap: 12, marginTop: 4, fontSize: 12 }}>
                        {contact.email && <span style={{ color: '#635BFF' }}>{contact.email}</span>}
                        {contact.phone && <span style={{ color: '#596880' }}>{contact.phone}</span>}
                        {contact.linkedin_url && (
                          <a href={contact.linkedin_url} target="_blank" rel="noreferrer" style={{ color: '#635BFF', textDecoration: 'none' }}>LinkedIn ↗</a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
