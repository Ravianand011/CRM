import { useRef, useState } from 'react';
import { FileSpreadsheet, Loader2, UploadCloud } from 'lucide-react';
import { parseLeadsFile } from '../utils/excelMapper';
import type { ImportResult } from '../services/leadsApi';
import type { ParsedLeadRow } from '../utils/excelMapper';

interface ExcelImporterProps {
  onImport: (rows: ParsedLeadRow[]) => Promise<ImportResult>;
}

export function ExcelImporter({ onImport }: ExcelImporterProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<ImportResult | null>(null);
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('');

  const handleFile = async (file: File) => {
    setError('');
    setSummary(null);
    setFileName(file.name);
    setBusy(true);
    try {
      const rows = await parseLeadsFile(file);
      if (rows.length === 0) {
        setError('No usable rows found in this file.');
        return;
      }
      const result = await onImport(rows);
      setSummary(result);
    } catch (err) {
      console.error(err);
      setError('Could not read this file. Please upload a valid .xlsx / .xls.');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="mx-auto max-w-xl">
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files?.[0];
          if (file) void handleFile(file);
        }}
        className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-line-2 bg-surface p-10 text-center hover:border-brand-border hover:bg-brand-soft/40"
      >
        {busy ? (
          <Loader2 className="animate-spin text-brand" size={34} />
        ) : (
          <UploadCloud className="text-ink-3" size={34} />
        )}
        <p className="mt-3 text-[13px] font-medium text-ink">
          {busy ? 'Importing...' : 'Click or drop an Excel file to import'}
        </p>
        <p className="mt-1 text-[11px] text-ink-3">
          Facebook Lead Ads export (.xlsx / .xls)
        </p>
        {fileName && !busy && (
          <p className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-ink-2">
            <FileSpreadsheet size={14} /> {fileName}
          </p>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />
      </div>

      {error && (
        <p className="mt-4 rounded-md bg-tone-red-bg px-3 py-2 text-[13px] text-tone-red-tx">
          {error}
        </p>
      )}

      {summary && (
        <p className="mt-4 rounded-md bg-tone-green-bg px-3 py-2 text-[13px] text-tone-green-tx">
          {summary.imported} lead{summary.imported === 1 ? '' : 's'} imported,{' '}
          {summary.duplicates} duplicate
          {summary.duplicates === 1 ? '' : 's'} skipped.
        </p>
      )}
    </div>
  );
}
