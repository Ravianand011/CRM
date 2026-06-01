import { useRef, useState } from 'react';
import { Check, FileSpreadsheet, Loader2, UploadCloud, X } from 'lucide-react';
import { parseLeadsFile, type ParseLeadsFileResult } from '../utils/excelMapper';
import type { ImportResult } from '../services/leadsApi';

interface ExcelImporterProps {
  onImport: (
    rows: ParseLeadsFileResult['rows'],
    meta?: Pick<ImportResult, 'matchedColumns' | 'ignoredColumns'>,
  ) => Promise<ImportResult>;
}

export function ExcelImporter({ onImport }: ExcelImporterProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<ImportResult | null>(null);
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState<ParseLeadsFileResult | null>(null);

  const resetInput = () => {
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleFile = async (file: File) => {
    setError('');
    setSummary(null);
    setPreview(null);
    setFileName(file.name);
    setBusy(true);
    try {
      const result = await parseLeadsFile(file);
      if (result.rows.length === 0) {
        setError(
          result.matchedColumns.length === 0
            ? 'No recognizable columns found. Expected headers like Name, Phone, Email, City, etc.'
            : 'No usable rows found in this file.',
        );
        return;
      }
      setPreview(result);
    } catch (err) {
      console.error(err);
      setError('Could not read this file. Please upload a valid .xlsx / .xls.');
    } finally {
      setBusy(false);
    }
  };

  const confirmImport = async () => {
    if (!preview) return;
    setBusy(true);
    setError('');
    try {
      const result = await onImport(preview.rows, {
        matchedColumns: preview.matchedColumns,
        ignoredColumns: preview.ignoredColumns,
      });
      setSummary(result);
      setPreview(null);
      resetInput();
    } catch (err) {
      console.error(err);
      setError('Import failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl">
      <div
        onClick={() => !preview && inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files?.[0];
          if (file && !preview) void handleFile(file);
        }}
        className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-line-2 bg-surface p-10 text-center ${
          preview ? '' : 'cursor-pointer hover:border-brand-border hover:bg-brand-soft/40'
        }`}
      >
        {busy ? (
          <Loader2 className="animate-spin text-brand" size={34} />
        ) : (
          <UploadCloud className="text-ink-3" size={34} />
        )}
        <p className="mt-3 text-[13px] font-medium text-ink">
          {busy
            ? 'Processing...'
            : preview
              ? 'Review mapping below'
              : 'Click or drop an Excel file to import'}
        </p>
        <p className="mt-1 text-[11px] text-ink-3">
          Matches your columns automatically; extra columns are ignored
        </p>
        {fileName && (
          <p className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-ink-2">
            <FileSpreadsheet size={14} /> {fileName}
          </p>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />
      </div>

      {preview && !summary && (
        <div className="mt-4 rounded-lg border border-line bg-surface p-4 text-left">
          <p className="text-[13px] font-medium text-ink">
            {preview.rows.length} lead{preview.rows.length === 1 ? '' : 's'} ready
            to import
          </p>

          {preview.matchedColumns.length > 0 && (
            <div className="mt-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-ink-3">
                Matched columns
              </p>
              <ul className="mt-1.5 space-y-1">
                {preview.matchedColumns.map((m) => (
                  <li
                    key={m.field}
                    className="flex items-center gap-2 text-[12px] text-ink-2"
                  >
                    <Check size={14} className="shrink-0 text-tone-green-tx" />
                    <span className="font-medium text-ink">{m.fieldLabel}</span>
                    <span className="text-ink-3">←</span>
                    <span className="truncate">{m.sheetHeader}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {preview.ignoredColumns.length > 0 && (
            <div className="mt-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-ink-3">
                Ignored (not saved)
              </p>
              <p className="mt-1 flex flex-wrap gap-1.5">
                {preview.ignoredColumns.map((col) => (
                  <span
                    key={col}
                    className="inline-flex items-center gap-1 rounded-md bg-surface-2 px-2 py-0.5 text-[11px] text-ink-3"
                  >
                    <X size={10} /> {col}
                  </span>
                ))}
              </p>
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void confirmImport()}
              disabled={busy}
              className="rounded-md bg-brand px-4 py-2 text-[13px] font-medium text-brand-soft hover:opacity-95 disabled:opacity-50"
            >
              Import {preview.rows.length} lead
              {preview.rows.length === 1 ? '' : 's'}
            </button>
            <button
              type="button"
              onClick={() => {
                setPreview(null);
                setFileName('');
                resetInput();
              }}
              className="rounded-md border border-line-2 px-4 py-2 text-[13px] text-ink-2 hover:bg-surface-2"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-4 rounded-md bg-tone-red-bg px-3 py-2 text-[13px] text-tone-red-tx">
          {error}
        </p>
      )}

      {summary && (
        <div className="mt-4 space-y-2 rounded-md bg-tone-green-bg px-3 py-2 text-[13px] text-tone-green-tx">
          <p>
            {summary.imported} lead{summary.imported === 1 ? '' : 's'} imported,{' '}
            {summary.duplicates} duplicate
            {summary.duplicates === 1 ? '' : 's'} skipped.
          </p>
          {summary.ignoredColumns && summary.ignoredColumns.length > 0 && (
            <p className="text-[12px] opacity-90">
              Ignored columns: {summary.ignoredColumns.join(', ')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
