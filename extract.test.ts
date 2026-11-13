import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { extractFields, normalizeDate, normalizePhone, normalizeText } from './extract';

const SAMPLE = `CENTRAL CLINIC
FAX TRANSMISSION
Fax date: 12/11/2026
From: Dr. R. Mehta, Cardiology
To: Dr. S. Iyer, Nephrology
Patient: Anita Sharma
DOB: 05/06/1980
MRN: A-4471902
Phone: 09876543210
Reason for referral: uncontrolled hypertension`;

describe('normalizeDate', () => {
  it('parses slash, dashed and named dates', () => {
    expect(normalizeDate('05/06/1980')?.iso).toBe('1980-06-05');
    expect(normalizeDate('1980-06-05')?.iso).toBe('1980-06-05');
    expect(normalizeDate('5 Jun 1980')?.iso).toBe('1980-06-05');
    expect(normalizeDate('June 5, 1980')?.iso).toBe('1980-06-05');
  });

  it('flags ambiguous dates and rejects impossible ones', () => {
    expect(normalizeDate('05/06/1980')?.ambiguous).toBe(true);
    expect(normalizeDate('31/02/2020')).toBeNull();
    expect(normalizeDate('not a date')).toBeNull();
  });

  it('round-trips every valid calendar day', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1970, max: 2025 }),
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: 1, max: 28 }),
        (y, m, d) => {
          const raw = `${d}/${m}/${y}`;
          const parsed = normalizeDate(raw);
          expect(parsed?.iso).toBe(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
        },
      ),
    );
  });
});

describe('normalizePhone', () => {
  it('normalizes Indian numbers', () => {
    expect(normalizePhone('09876543210')).toBe('+91 98765 43210');
    expect(normalizePhone('+91 98765 43210')).toBe('+91 98765 43210');
    expect(normalizePhone('9876543210')).toBe('+91 98765 43210');
  });

  it('never returns a value for too-short input', () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[0-9\s\-().]{0,6}$/), (raw) => {
        expect(normalizePhone(raw)).toBeNull();
      }),
    );
  });
});

describe('extractFields', () => {
  it('pulls the labelled fields off a referral fax', () => {
    const fields = extractFields(SAMPLE, { pageConfidence: 88 });
    const byKey = Object.fromEntries(fields.map((field) => [field.key, field]));
    expect(byKey.patientName.value).toBe('Anita Sharma');
    expect(byKey.dateOfBirth.value).toBe('1980-06-05');
    expect(byKey.patientId.value).toBe('A-4471902');
    expect(byKey.faxDate.value).toBe('2026-11-12');
    expect(byKey.fromProvider.value).toContain('Mehta');
    expect(byKey.phone.value).toBe('+91 98765 43210');
    expect(byKey.reason.value).toContain('hypertension');
  });

  it('marks ambiguous dates for review instead of trusting them', () => {
    const fields = extractFields(SAMPLE);
    const dob = fields.find((field) => field.key === 'dateOfBirth');
    expect(dob?.needsReview).toBe(true);
  });

  it('collapses whitespace and preserves line order', () => {
    expect(normalizeText('  A   B \n\n C ')).toBe('A B\nC');
  });
});
