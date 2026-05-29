import { ExcelImporter } from '../components/ExcelImporter';
import type { ImportResult } from '../services/leadsApi';
import type { ParsedLeadRow } from '../utils/excelMapper';

interface ImportLeadsProps {
  onImport: (rows: ParsedLeadRow[]) => Promise<ImportResult>;
}

export function ImportLeads({ onImport }: ImportLeadsProps) {
  return (
    <div>
      <h2 className="mb-1 text-[14px] font-medium text-ink">Import Excel</h2>
      <p className="mb-5 text-[12px] text-ink-2">
        Upload a Facebook Lead Ads Excel export. Columns are mapped
        automatically and duplicate phone numbers are skipped.
      </p>
      <ExcelImporter onImport={onImport} />
    </div>
  );
}
