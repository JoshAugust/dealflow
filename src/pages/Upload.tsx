import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Upload as UploadIcon, FileSpreadsheet, Check, ArrowRight, ArrowLeft, X, Plus } from 'lucide-react';
import { parseFile, convertRowsToCompanies, getDetectedMappings } from '../lib/parser';
import { bulkInsertCompanies, addActivity } from '../lib/db';
import { useAppStore } from '../store/appStore';
import type { ParseResult } from '../lib/parser';
import type { Company, CustomColumn } from '../lib/types';

const BUILTIN_FIELDS = [
  { value: '', label: '— Skip —' },
  { value: 'company_name', label: 'Company Name' },
  { value: 'geography', label: 'Geography' },
  { value: 'industry', label: 'Industry' },
  { value: 'nace', label: 'NACE' },
  { value: 'employees', label: 'Employees' },
  { value: 'revenue', label: 'Revenue' },
  { value: 'profit_before_tax', label: 'P/L Before Tax' },
  { value: 'total_assets', label: 'Total Assets' },
  { value: 'equity', label: 'Equity' },
  { value: 'website', label: 'Website' },
  { value: 'description', label: 'Description' },
  { value: 'address', label: 'Address' },
  { value: 'director_name', label: 'Director Name' },
  { value: 'director_title', label: 'Director Title' },
  { value: 'year_incorporated', label: 'Year Incorporated' },
];

export default function Upload() {
  const { customColumns, addCustomColumn } = useAppStore();
  const [step, setStep] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [mappings, setMappings] = useState<{ header: string; field: string }[]>([]);
  const [source, setSource] = useState('');
  const [defaultTags, setDefaultTags] = useState('');
  const [progress, setProgress] = useState(0);
  const [totalToImport, setTotalToImport] = useState(0);
  const [imported, setImported] = useState(0);
  const [skipped, setSkipped] = useState(0);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const [newColIdx, setNewColIdx] = useState<number | null>(null);
  const [newColLabel, setNewColLabel] = useState('');
  const [newColType, setNewColType] = useState<CustomColumn['type']>('text');

  // Build dynamic fields list: built-in + custom + "create new"
  const DEALFLOW_FIELDS = [
    ...BUILTIN_FIELDS,
    ...customColumns.map(c => ({ value: c.key, label: `${c.label} (Custom)` })),
    { value: '__new__', label: '+ Create New Column' },
  ];

  function handleFieldChange(idx: number, value: string) {
    if (value === '__new__') {
      setNewColIdx(idx);
      setNewColLabel('');
      setNewColType('text');
      return;
    }
    const updated = [...mappings];
    updated[idx] = { ...updated[idx], field: value };
    setMappings(updated);
  }

  function createAndMapColumn(idx: number) {
    if (!newColLabel.trim()) return;
    const key = 'custom_' + newColLabel.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
    const col: CustomColumn = {
      id: crypto.randomUUID(),
      key,
      label: newColLabel.trim(),
      type: newColType,
      created_at: new Date().toISOString(),
    };
    addCustomColumn(col);
    const updated = [...mappings];
    updated[idx] = { ...updated[idx], field: key };
    setMappings(updated);
    setNewColIdx(null);
  }

  const handleFileSelect = async (f: File) => {
    setFile(f);
    setError('');
    try {
      const result = await parseFile(f, source || f.name);
      setParseResult(result);
      const detected = getDetectedMappings(result.headers);
      setMappings(detected);
      setStep(2);
    } catch (err) {
      setError(String(err));
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handleFileSelect(f);
  };

  const handleMappingChange = (index: number, field: string) => {
    setMappings((prev) => prev.map((m, i) => (i === index ? { ...m, field } : m)));
  };

  const handleImport = async () => {
    if (!parseResult) return;
    setStep(4);
    setDone(false);

    // Build column map from current mappings
    const colMap = new Map<number, keyof Company>();
    mappings.forEach((m, i) => {
      if (m.field) {
        colMap.set(i, m.field as keyof Company);
      }
    });

    const tags = defaultTags.split(',').map((t) => t.trim()).filter(Boolean);
    const companies = convertRowsToCompanies(parseResult.allDataRows, colMap, source || file?.name || 'Upload', tags);
    const total = companies.length;
    setTotalToImport(total);
    setSkipped(parseResult.allDataRows.length - total);

    const count = await bulkInsertCompanies(companies, (done) => {
      setImported(done);
      setProgress(Math.round((done / total) * 100));
    });

    await addActivity({
      type: 'upload',
      description: `Uploaded ${count.toLocaleString()} companies from ${file?.name || 'file'}`,
      entity_id: '',
      entity_type: 'company',
    });

    setImported(count);
    setProgress(100);
    setDone(true);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-[#0A2540]">Upload Companies</h1>
        <p className="text-sm text-[#596880] mt-1">Import company data from XLSX or CSV files</p>
      </div>

      {/* Steps indicator */}
      <div className="flex items-center gap-2 text-sm">
        {[1,2,3,4].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${step >= s ? 'bg-[#635BFF] text-white' : 'bg-[#E3E8EE] text-[#596880]'}`}>
              {step > s ? <Check size={14} /> : s}
            </div>
            <span className={`${step >= s ? 'text-[#0A2540] font-medium' : 'text-[#596880]'}`}>
              {s === 1 ? 'File' : s === 2 ? 'Mapping' : s === 3 ? 'Settings' : 'Import'}
            </span>
            {s < 4 && <div className="w-8 h-px bg-[#E3E8EE]" />}
          </div>
        ))}
      </div>

      {error && (
        <div className="card !bg-red-50 !border-red-200 text-red-700 text-sm flex items-center gap-2">
          <X size={16} /> {error}
        </div>
      )}

      {/* Step 1: File Selection */}
      {step === 1 && (
        <div
          className="card !p-12 border-2 border-dashed border-[#E3E8EE] hover:border-[#635BFF] transition-colors text-center cursor-pointer"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
          />
          <UploadIcon size={40} className="mx-auto mb-4 text-[#635BFF]" />
          <p className="text-lg font-semibold text-[#0A2540]">Drop your file here or click to browse</p>
          <p className="text-sm text-[#596880] mt-2">Supports .xlsx, .xls, and .csv files</p>
          {file && (
            <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-[#F0EEFF] rounded-lg">
              <FileSpreadsheet size={16} className="text-[#635BFF]" />
              <span className="text-sm font-medium text-[#635BFF]">{file.name}</span>
              <span className="text-xs text-[#596880]">({(file.size / 1024 / 1024).toFixed(1)} MB)</span>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Column Mapping */}
      {step === 2 && parseResult && (
        <div className="space-y-4">
          <div className="card">
            <h2 className="text-base font-semibold text-[#0A2540] mb-4">Column Mapping</h2>
            <p className="text-sm text-[#596880] mb-4">Map your file headers to DealFlow fields. {parseResult.totalRows.toLocaleString()} rows detected.</p>
            <div className="space-y-2">
              {mappings.map((m, i) => (
                <div key={i} className="flex items-center gap-4">
                  <span className="text-sm text-[#596880] w-48 truncate">{m.header || `Column ${i + 1}`}</span>
                  <ArrowRight size={14} className="text-[#E3E8EE]" />
                  <select
                    className="input-field !w-64"
                    value={m.field}
                    onChange={(e) => handleFieldChange(i, e.target.value)}
                  >
                    {DEALFLOW_FIELDS.map((f) => (
                      <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                  </select>
                  {m.field && <Check size={16} className="text-[#00D4AA]" />}
                  {newColIdx === i && (
                    <div className="flex items-center gap-2 ml-2">
                      <input
                        className="input-field !w-36 text-xs"
                        placeholder="Column name"
                        value={newColLabel}
                        onChange={e => setNewColLabel(e.target.value)}
                        autoFocus
                      />
                      <select className="input-field !w-24 text-xs" value={newColType} onChange={e => setNewColType(e.target.value as CustomColumn['type'])}>
                        <option value="text">Text</option>
                        <option value="number">Number</option>
                        <option value="url">URL</option>
                        <option value="date">Date</option>
                        <option value="boolean">Yes/No</option>
                        <option value="select">Select</option>
                      </select>
                      <button className="btn-primary text-xs px-2 py-1" onClick={() => createAndMapColumn(i)}>
                        <Plus size={12} /> Add
                      </button>
                      <button className="text-xs text-[#8898aa] hover:text-[#0A2540]" onClick={() => setNewColIdx(null)}>Cancel</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="card">
            <h2 className="text-base font-semibold text-[#0A2540] mb-4">Preview (first 5 rows)</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#E3E8EE]">
                    {parseResult.headers.map((h, i) => (
                      <th key={i} className="p-2 text-left text-[#596880] font-medium">{h || `Col ${i}`}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parseResult.previewRows.map((row, ri) => (
                    <tr key={ri} className="border-b border-[#E3E8EE]">
                      {(row as unknown[]).map((cell, ci) => (
                        <td key={ci} className="p-2 text-[#0A2540] truncate max-w-[150px]">{String(cell || '')}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex gap-3">
            <button className="btn-secondary" onClick={() => setStep(1)}><ArrowLeft size={14} /> Back</button>
            <button className="btn-primary" onClick={() => setStep(3)}>Continue <ArrowRight size={14} /></button>
          </div>
        </div>
      )}

      {/* Step 3: Import Settings */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="card space-y-4">
            <h2 className="text-base font-semibold text-[#0A2540]">Import Settings</h2>
            <div>
              <label className="block text-sm font-medium text-[#596880] mb-1">Source Label</label>
              <input
                className="input-field"
                placeholder="e.g. US Software 2026"
                value={source}
                onChange={(e) => setSource(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#596880] mb-1">Default Tags (comma separated)</label>
              <input
                className="input-field"
                placeholder="e.g. tech, us, 2026"
                value={defaultTags}
                onChange={(e) => setDefaultTags(e.target.value)}
              />
            </div>
            <p className="text-sm text-[#596880]">
              Ready to import <strong>{parseResult?.totalRows.toLocaleString()}</strong> rows. All companies will be set to <strong>New</strong> status.
            </p>
          </div>
          <div className="flex gap-3">
            <button className="btn-secondary" onClick={() => setStep(2)}><ArrowLeft size={14} /> Back</button>
            <button className="btn-primary" onClick={handleImport}><UploadIcon size={14} /> Start Import</button>
          </div>
        </div>
      )}

      {/* Step 4: Processing */}
      {step === 4 && (
        <div className="card text-center space-y-6">
          {done ? (
            <>
              <div className="w-16 h-16 bg-[#ECFDF5] rounded-full flex items-center justify-center mx-auto">
                <Check size={32} className="text-[#00D4AA]" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-[#0A2540]">✅ {imported.toLocaleString()} companies imported</h2>
                {skipped > 0 && <p className="text-sm text-[#596880] mt-1">{skipped} empty/invalid rows skipped</p>}
              </div>
              <Link to="/companies" className="btn-primary inline-flex">View Companies <ArrowRight size={14} /></Link>
            </>
          ) : (
            <>
              <FileSpreadsheet size={40} className="mx-auto text-[#635BFF]" />
              <div>
                <h2 className="text-lg font-semibold text-[#0A2540]">Importing companies...</h2>
                <p className="text-sm text-[#596880] mt-1">{imported.toLocaleString()} of {totalToImport.toLocaleString()} processed</p>
              </div>
              <div className="w-full bg-[#E3E8EE] rounded-full h-3 overflow-hidden">
                <div
                  className="h-full bg-[#635BFF] rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-sm font-medium text-[#635BFF]">{progress}%</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
