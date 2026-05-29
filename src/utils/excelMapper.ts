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

/** Field -> list of possible spreadsheet header names (exact, lowercased). */
const COLUMN_ALIASES: Record<keyof ParsedLeadRow, string[]> = {
  name: ['full name', 'name', 'full_name', 'fullname', 'lead name'],
  phone: [
    'phone number',
    'phone',
    'phone_number',
    'mobile',
    'mobile number',
    'contact number',
    'contact',
  ],
  email: ['email', 'email address', 'email_address', 'e-mail', 'mail'],
  city: ['city', 'location', 'town', 'city/location'],
  qualification: [
    'what is your qualification?',
    'qualification',
    'education',
    'qualifications',
  ],
  whenPlanningToJoin: [
    'when are you planning to join?',
    'when planning to join',
    'planning to join',
    'join',
    'joining',
  ],
  createdAt: ['created_time', 'created time', 'createdat', 'created', 'date'],
};

const norm = (s: string) => s.toLowerCase().trim();

/**
 * Resolve which spreadsheet header maps to each lead field.
 * Tries exact alias match first, then fuzzy `includes` matching.
 */
function resolveHeaderMap(headers: string[]): Partial<
  Record<keyof ParsedLeadRow, string>
> {
  const map: Partial<Record<keyof ParsedLeadRow, string>> = {};
  const normalized = headers.map((h) => ({ raw: h, norm: norm(h) }));

  (Object.keys(COLUMN_ALIASES) as (keyof ParsedLeadRow)[]).forEach((field) => {
    const aliases = COLUMN_ALIASES[field];

    // 1. exact alias match
    let found = normalized.find((h) => aliases.includes(h.norm));

    // 2. fuzzy: header includes alias or alias includes header
    if (!found) {
      found = normalized.find((h) =>
        aliases.some(
          (alias) => h.norm.includes(alias) || alias.includes(h.norm),
        ),
      );
    }

    if (found) map[field] = found.raw;
  });

  return map;
}

function asString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  return String(value).trim();
}

/**
 * Parse an uploaded spreadsheet file into normalized lead rows.
 * Reads the first sheet and maps Facebook Lead Ads style columns.
 */
export async function parseLeadsFile(file: File): Promise<ParsedLeadRow[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
  });
  if (rows.length === 0) return [];

  const headers = Object.keys(rows[0]);
  const headerMap = resolveHeaderMap(headers);

  const parsed: ParsedLeadRow[] = [];
  for (const row of rows) {
    const get = (field: keyof ParsedLeadRow): string => {
      const header = headerMap[field];
      return header ? asString(row[header]) : '';
    };

    const name = get('name');
    const phone = get('phone').replace(/[^\d+]/g, '');

    // Skip rows that have neither a name nor a phone.
    if (!name && !phone) continue;

    parsed.push({
      name: name || 'Unknown',
      phone,
      email: get('email') || undefined,
      city: get('city'),
      qualification: get('qualification'),
      whenPlanningToJoin: get('whenPlanningToJoin') || undefined,
      createdAt: get('createdAt') || undefined,
    });
  }

  return parsed;
}
