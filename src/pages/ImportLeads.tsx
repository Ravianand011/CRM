import { ExcelImporter } from '../components/ExcelImporter';
import type { ImportResult } from '../services/leadsApi';
import type { ParsedLeadRow } from '../utils/excelMapper';

interface ImportLeadsProps {
  onImport: (
    rows: ParsedLeadRow[],
    meta?: Pick<ImportResult, 'matchedColumns' | 'ignoredColumns'>,
  ) => Promise<ImportResult>;
}

export function ImportLeads({ onImport }: ImportLeadsProps) {
  return (
    <div>
      <h2 className="mb-1 text-[14px] font-medium text-ink">Import Excel</h2>
      <p className="mb-5 text-[12px] text-ink-2">
        Upload a lead sheet (.xlsx, .xls, or .csv). Matching columns are saved
        automatically; anything that does not match Name, Phone, Email, City,
        Qualification, Planning to join, or Created date is ignored.
      </p>
      <ExcelImporter onImport={onImport} />
    </div>
  );
}
