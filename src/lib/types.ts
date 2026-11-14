export type FieldKey =
  | 'patientName'
  | 'dateOfBirth'
  | 'patientId'
  | 'faxDate'
  | 'fromProvider'
  | 'toProvider'
  | 'phone'
  | 'reason';

export interface Bbox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface OcrWord {
  text: string;
  confidence: number;
  bbox: Bbox;
}

export interface OcrResult {
  text: string;
  words: OcrWord[];
  width: number;
  height: number;
  ms: number;
}

export interface Field {
  key: FieldKey;
  label: string;
  value: string;
  confidence: number;
  evidence?: string;
  needsReview: boolean;
}

export interface FaxRecord {
  id: string;
  sourceName: string;
  receivedAt: string;
  ocrMs: number;
  fields: Field[];
  text: string;
  imageUrl?: string;
}
