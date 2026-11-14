import type { FaxRecord } from './types';

export function toJson(record: FaxRecord): string {
  return JSON.stringify(
    {
      source: record.sourceName,
      receivedAt: record.receivedAt,
      ocrMs: record.ocrMs,
      fields: Object.fromEntries(record.fields.map((field) => [field.key, field.value])),
    },
    null,
    2,
  );
}

export function toCsv(record: FaxRecord): string {
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const header = record.fields.map((field) => escape(field.label)).join(',');
  const row = record.fields.map((field) => escape(field.value)).join(',');
  return `${header}\n${row}\n`;
}

export function download(filename: string, content: string, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
