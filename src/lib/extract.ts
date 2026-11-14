import type { Field, FieldKey } from './types';

export const LABELS: Record<FieldKey, string> = {
  patientName: 'Patient name',
  dateOfBirth: 'Date of birth',
  patientId: 'Patient ID',
  faxDate: 'Fax date',
  fromProvider: 'From',
  toProvider: 'To',
  phone: 'Phone / fax',
  reason: 'Reason',
};

export function normalizeText(input: string): string {
  return input
    .replace(/\r\n?/g, '\n')
    .replace(/[\u2010-\u2015]/g, '-')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');
}

export function linesOf(text: string): string[] {
  return normalizeText(text).split('\n');
}

const MONTHS = [
  'jan', 'feb', 'mar', 'apr', 'may', 'jun',
  'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
];

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function validParts(y: number, m: number, d: number): boolean {
  if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/**
 * Normalizes the date formats that survive a fax scan.
 * Genuinely ambiguous slash dates (05/06/1980) are resolved as D/M/Y, which is
 * the Indian and European convention this tool is built around, and are marked
 * low-confidence by the caller rather than silently trusted.
 */
export function normalizeDate(raw: string): { iso: string; ambiguous: boolean } | null {
  const s = raw.trim().replace(/[.,]/g, '').replace(/\s+/g, ' ');
  if (!s) return null;

  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    const [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
    return validParts(y, m, d) ? { iso: `${y}-${pad(m)}-${pad(d)}`, ambiguous: false } : null;
  }

  const monthName = s.match(/^(\d{1,2})[\s-]([A-Za-z]{3,9})[\s,-]+(\d{2,4})$/);
  if (monthName) {
    const d = Number(monthName[1]);
    const m = MONTHS.indexOf(monthName[2].slice(0, 3).toLowerCase()) + 1;
    let y = Number(monthName[3]);
    if (y < 100) y += y > 40 ? 1900 : 2000;
    return m > 0 && validParts(y, m, d) ? { iso: `${y}-${pad(m)}-${pad(d)}`, ambiguous: false } : null;
  }

  const namedMonth = s.match(/^([A-Za-z]{3,9})\s+(\d{1,2})[\s,-]+(\d{2,4})$/);
  if (namedMonth) {
    const m = MONTHS.indexOf(namedMonth[1].slice(0, 3).toLowerCase()) + 1;
    const d = Number(namedMonth[2]);
    let y = Number(namedMonth[3]);
    if (y < 100) y += y > 40 ? 1900 : 2000;
    return m > 0 && validParts(y, m, d) ? { iso: `${y}-${pad(m)}-${pad(d)}`, ambiguous: false } : null;
  }

  const slash = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (slash) {
    const a = Number(slash[1]);
    const b = Number(slash[2]);
    let y = Number(slash[3]);
    if (y < 100) y += y > 40 ? 1900 : 2000;
    const ambiguous = a !== b && a <= 12 && b <= 12;
    const [d, m] = [a, b];
    if (!validParts(y, m, d)) return null;
    return { iso: `${y}-${pad(m)}-${pad(d)}`, ambiguous };
  }

  return null;
}

export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) return null;
  if (digits.length === 10) return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  if (digits.length === 11 && digits.startsWith('0')) {
    return `+91 ${digits.slice(1, 6)} ${digits.slice(6)}`;
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  return `+${digits}`;
}

const LABEL_PATTERNS: Record<FieldKey, RegExp> = {
  patientName: /^(?:patient(?:'s)?\s*name|patient|name of patient|pt\.? name)\s*[:\-]\s*(.+)$/i,
  dateOfBirth: /^(?:d\.?o\.?b\.?|date of birth|birth date)\s*[:\-]\s*(.+)$/i,
  patientId: /^(?:mrn|m\.r\.n\.?|medical record(?: number| no\.?)?|patient id|uhid|record\s*(?:#|no\.?))\s*[:\-]?\s*([A-Za-z0-9][A-Za-z0-9\-/]{2,})$/i,
  faxDate: /^(?:fax date|date|sent(?: on)?|received(?: on)?)\s*[:\-]\s*(.+)$/i,
  fromProvider: /^(?:from|referring (?:physician|provider|doctor)|sender|sent by)\s*[:\-]\s*(.+)$/i,
  toProvider: /^(?:to|referred to|recipient|attn\.?)\s*[:\-]\s*(.+)$/i,
  phone: /^(?:phone|tel\.?|telephone|fax|contact)\s*[:\-]\s*(.+)$/i,
  reason: /^(?:reason for (?:referral|visit)|chief complaint|re|re:|subject)\s*[:\-]\s*(.+)$/i,
};

const DATE_ANYWHERE = /\b(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}|\d{4}-\d{2}-\d{2}|[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{2,4})\b/;
const PHONE_ANYWHERE = /(?:\+?\d[\d\s\-().]{7,}\d)/;

function ocrFactor(confidence: number | undefined): number {
  if (confidence === undefined || Number.isNaN(confidence)) return 1;
  return Math.min(1, Math.max(0.55, confidence / 90));
}

function clean(value: string): string {
  return value.replace(/\s{2,}/g, ' ').replace(/[|_]+$/g, '').trim();
}

export interface ExtractOptions {
  /** 0..1 median OCR confidence for the page; scales every field score. */
  pageConfidence?: number;
}

export function extractFields(text: string, options: ExtractOptions = {}): Field[] {
  const lines = linesOf(text);
  const found = new Map<FieldKey, { value: string; evidence: string; confidence: number }>();

  for (const line of lines) {
    for (const [key, pattern] of Object.entries(LABEL_PATTERNS) as [FieldKey, RegExp][]) {
      if (found.has(key)) continue;
      const match = line.match(pattern);
      if (!match) continue;
      let value = clean(match[1]);
      let confidence = 0.92;

      if (key === 'dateOfBirth' || key === 'faxDate') {
        const parsed = normalizeDate(value);
        if (!parsed) continue;
        value = parsed.iso;
        if (parsed.ambiguous) confidence -= 0.22;
      }
      if (key === 'phone') {
        const parsed = normalizePhone(value);
        if (!parsed) continue;
        value = parsed;
      }
      if (value.length < 2 || value.length > 90) continue;
      found.set(key, { value, evidence: line, confidence });
    }
  }

  if (!found.has('dateOfBirth')) {
    const match = normalizeText(text).match(DATE_ANYWHERE);
    if (match) {
      const parsed = normalizeDate(match[1]);
      if (parsed) {
        found.set('dateOfBirth', {
          value: parsed.iso,
          evidence: match[0],
          confidence: parsed.ambiguous ? 0.4 : 0.55,
        });
      }
    }
  }

  if (!found.has('phone')) {
    const match = normalizeText(text).match(PHONE_ANYWHERE);
    if (match) {
      const parsed = normalizePhone(match[0]);
      if (parsed) found.set('phone', { value: parsed, evidence: match[0], confidence: 0.5 });
    }
  }

  const scale = ocrFactor(options.pageConfidence);
  const order = Object.keys(LABELS) as FieldKey[];

  return order.map((key) => {
    const hit = found.get(key);
    const confidence = hit ? Math.min(0.99, Math.round(hit.confidence * scale * 100) / 100) : 0;
    return {
      key,
      label: LABELS[key],
      value: hit?.value ?? '',
      confidence,
      evidence: hit?.evidence,
      needsReview: confidence > 0 && confidence < 0.8,
    };
  });
}

export function emptyFields(): Field[] {
  return (Object.keys(LABELS) as FieldKey[]).map((key) => ({
    key,
    label: LABELS[key],
    value: '',
    confidence: 0,
    needsReview: false,
  }));
}

export function completion(fields: Field[]): number {
  const filled = fields.filter((field) => field.value.trim().length > 0).length;
  return filled / fields.length;
}
