import * as XLSX from 'xlsx';

/** A normalized lead record parsed from a spreadsheet row. */
export interface ParsedLeadRow {
  name: string;
  phone: string;
  email?: string;
  city: string;
  qualification: string;
  whenPlanningToJoin?: string;
  createdAt?: string;
}

export const CRM_FIELD_LABELS: Record<keyof ParsedLeadRow, string> = {
  name: 'Name',
  phone: 'Phone',
  email: 'Email',
  city: 'City',
  qualification: 'Qualification',
  whenPlanningToJoin: 'When planning to join',
  createdAt: 'Created date',
};

/** Field -> possible spreadsheet header names (normalized for matching). */
const COLUMN_ALIASES: Record<keyof ParsedLeadRow, string[]> = {
  name: [
    'full name',
    'name',
    'full_name',
    'fullname',
    'lead name',
    'customer name',
    'contact name',
    'first name',
  ],
  phone: [
    'phone number',
    'phone',
    'phone_number',
    'mobile',
    'mobile number',
    'contact number',
    'contact',
    'whatsapp',
    'whatsapp number',
    'tel',
    'telephone',
  ],
  email: [
    'email',
    'email address',
    'email_address',
    'e-mail',
    'mail',
    'e mail',
  ],
  city: [
    'city',
    'location',
    'town',
    'city location',
    'city/location',
    'address',
    'place',
  ],
  qualification: [
    'what is your qualification',
    'what is your qualification?',
    'qualification',
    'education',
    'qualifications',
    'degree',
    'course',
    'qualification?',
  ],
  whenPlanningToJoin: [
    'when are you planning to join',
    'when are you planning to join?',
    'when planning to join',
    'planning to join',
    'join',
    'joining',
    'when will you join',
    'join date',
  ],
  createdAt: [
    'created_time',
    'created time',
    'createdat',
    'created at',
    'created',
    'date',
    'date created',
    'lead date',
    'submitted',
    'submission date',
    'timestamp',
    'time',
  ],
};

export interface ColumnMapping {
  field: keyof ParsedLeadRow;
  fieldLabel: string;
  sheetHeader: string;
}

export interface ParseLeadsFileResult {
  rows: ParsedLeadRow[];
  matchedColumns: ColumnMapping[];
  ignoredColumns: string[];
}

/** Normalize header text for alias matching. */
export function normalizeHeader(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[_\-]+/g, ' ')
    .replace(/[^\w\s?]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function scoreHeaderForField(
  headerNorm: string,
  field: keyof ParsedLeadRow,
): number {
  const aliases = COLUMN_ALIASES[field].map(normalizeHeader);
  if (aliases.includes(headerNorm)) return 100;
  let best = 0;
  for (const alias of aliases) {
    if (headerNorm === alias) best = Math.max(best, 100);
    else if (headerNorm.includes(alias) || alias.includes(headerNorm)) {
      const len = Math.min(headerNorm.length, alias.length);
      const maxLen = Math.max(headerNorm.length, alias.length);
      best = Math.max(best, 50 + Math.floor((len / maxLen) * 40));
    }
  }
  return best;
}

/**
 * Map sheet headers to CRM fields. Each header is used at most once.
 * Unmapped headers are returned as ignored.
 */
export function resolveHeaderMap(headers: string[]): {
  map: Partial<Record<keyof ParsedLeadRow, string>>;
  matchedColumns: ColumnMapping[];
  ignoredColumns: string[];
} {
  const fields = Object.keys(COLUMN_ALIASES) as (keyof ParsedLeadRow)[];
  const available = headers.filter((h) => h && normalizeHeader(h));

  const assignments: {
    field: keyof ParsedLeadRow;
    header: string;
    score: number;
  }[] = [];

  for (const header of available) {
    const headerNorm = normalizeHeader(header);
    for (const field of fields) {
      const score = scoreHeaderForField(headerNorm, field);
      if (score >= 50) {
        assignments.push({ field, header, score });
      }
    }
  }

  assignments.sort((a, b) => b.score - a.score);

  const map: Partial<Record<keyof ParsedLeadRow, string>> = {};
  const usedFields = new Set<keyof ParsedLeadRow>();
  const usedHeaders = new Set<string>();

  for (const { field, header, score } of assignments) {
    if (score < 50 || usedFields.has(field) || usedHeaders.has(header)) continue;
    map[field] = header;
    usedFields.add(field);
    usedHeaders.add(header);
  }

  const matchedColumns: ColumnMapping[] = fields
    .filter((f) => map[f])
    .map((f) => ({
      field: f,
      fieldLabel: CRM_FIELD_LABELS[f],
      sheetHeader: map[f]!,
    }));

  const ignoredColumns = available.filter((h) => !usedHeaders.has(h));

  return { map, matchedColumns, ignoredColumns };
}

function asString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  return String(value).trim();
}

/** Parse Excel serial or text into ISO date string. */
export function parseCreatedAt(value: unknown): string | undefined {
  if (value === null || value === undefined || value === '') return undefined;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }

  if (typeof value === 'number' && value > 0) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      return new Date(
        Date.UTC(
          parsed.y,
          parsed.m - 1,
          parsed.d,
          parsed.H ?? 0,
          parsed.M ?? 0,
          parsed.S ?? 0,
        ),
      ).toISOString();
    }
  }

  const s = asString(value);
  if (!s) return undefined;
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString();
  return undefined;
}

/**
 * Parse an uploaded spreadsheet into lead rows.
 * Only mapped columns are imported; extra columns are ignored.
 */
export async function parseLeadsFile(file: File): Promise<ParseLeadsFileResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { rows: [], matchedColumns: [], ignoredColumns: [] };
  }

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
  });
  if (rows.length === 0) {
    return { rows: [], matchedColumns: [], ignoredColumns: [] };
  }

  const headers = Object.keys(rows[0]);
  const { map, matchedColumns, ignoredColumns } = resolveHeaderMap(headers);

  const parsed: ParsedLeadRow[] = [];
  for (const row of rows) {
    const get = (field: keyof ParsedLeadRow): string => {
      const header = map[field];
      if (!header) return '';
      if (field === 'createdAt') return '';
      return asString(row[header]);
    };

    const name = get('name');
    const phoneRaw = get('phone');
    const phone = phoneRaw.replace(/[^\d+]/g, '');

    if (!name && !phone) continue;

    const createdHeader = map.createdAt;
    const createdAt = createdHeader
      ? parseCreatedAt(row[createdHeader])
      : undefined;

    parsed.push({
      name: name || 'Unknown',
      phone,
      email: get('email') || undefined,
      city: get('city'),
      qualification: get('qualification'),
      whenPlanningToJoin: get('whenPlanningToJoin') || undefined,
      createdAt,
    });
  }

  return { rows: parsed, matchedColumns, ignoredColumns };
}
