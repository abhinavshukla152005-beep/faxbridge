#!/usr/bin/env node
/**
 * FaxBridge dev MCP server.
 *
 * A dependency-free stdio server exposing the two checks I kept re-running by
 * hand while building the extractor: "does this date normalise the way I think"
 * and "is this record actually complete". Kiro calls these directly instead of
 * me pasting dates into a scratch file.
 */
import { createInterface } from 'node:readline';

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

const pad = (value) => String(value).padStart(2, '0');

function validParts(year, month, day) {
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function normalizeDate(raw) {
  const text = String(raw ?? '').trim().replace(/[.,]/g, '').replace(/\s+/g, ' ');
  if (!text) return null;

  let match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) {
    const [, y, m, d] = match.map(Number);
    return validParts(y, m, d) ? { iso: `${y}-${pad(m)}-${pad(d)}`, ambiguous: false } : null;
  }

  match = text.match(/^(\d{1,2})[\s-]([A-Za-z]{3,9})[\s,-]+(\d{2,4})$/);
  if (match) {
    const day = Number(match[1]);
    const month = MONTHS.indexOf(match[2].slice(0, 3).toLowerCase()) + 1;
    let year = Number(match[3]);
    if (year < 100) year += year > 40 ? 1900 : 2000;
    return month > 0 && validParts(year, month, day)
      ? { iso: `${year}-${pad(month)}-${pad(day)}`, ambiguous: false }
      : null;
  }

  match = text.match(/^([A-Za-z]{3,9})\s+(\d{1,2})[\s,-]+(\d{2,4})$/);
  if (match) {
    const month = MONTHS.indexOf(match[1].slice(0, 3).toLowerCase()) + 1;
    const day = Number(match[2]);
    let year = Number(match[3]);
    if (year < 100) year += year > 40 ? 1900 : 2000;
    return month > 0 && validParts(year, month, day)
      ? { iso: `${year}-${pad(month)}-${pad(day)}`, ambiguous: false }
      : null;
  }

  match = text.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (match) {
    const first = Number(match[1]);
    const second = Number(match[2]);
    let year = Number(match[3]);
    if (year < 100) year += year > 40 ? 1900 : 2000;
    if (!validParts(year, second, first)) return null;
    return {
      iso: `${year}-${pad(second)}-${pad(first)}`,
      ambiguous: first !== second && first <= 12 && second <= 12,
    };
  }

  return null;
}

const REQUIRED = [
  'patientName',
  'dateOfBirth',
  'patientId',
  'faxDate',
  'fromProvider',
  'toProvider',
  'phone',
  'reason',
];

const TOOLS = [
  {
    name: 'normalize_date',
    description:
      'Normalise a fax-style date to ISO. Returns whether the source was genuinely ambiguous, which is the signal the UI uses to flag a field for review.',
    inputSchema: {
      type: 'object',
      properties: { raw: { type: 'string', description: 'Date exactly as it appears on the fax' } },
      required: ['raw'],
    },
  },
  {
    name: 'validate_record',
    description:
      'Check a record for missing fields and out-of-range confidence scores before it is handed to an EHR.',
    inputSchema: {
      type: 'object',
      properties: {
        fields: {
          type: 'object',
          description: 'Map of field key to value, e.g. {"patientName":"Anita Sharma"}',
          additionalProperties: { type: 'string' },
        },
      },
      required: ['fields'],
    },
  },
];

function callTool(name, args) {
  if (name === 'normalize_date') {
    const result = normalizeDate(args?.raw);
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      isError: result === null,
    };
  }

  if (name === 'validate_record') {
    const fields = args?.fields ?? {};
    const missing = REQUIRED.filter((key) => !String(fields[key] ?? '').trim());
    const result = {
      complete: missing.length === 0,
      missing,
      filled: REQUIRED.length - missing.length,
      total: REQUIRED.length,
    };
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }

  return {
    content: [{ type: 'text', text: `Unknown tool: ${name}` }],
    isError: true,
  };
}

function respond(id, result) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id, result })}\n`);
}

function fail(id, code, message) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } })}\n`);
}

const reader = createInterface({ input: process.stdin });

reader.on('line', (line) => {
  if (!line.trim()) return;
  let message;
  try {
    message = JSON.parse(line);
  } catch {
    fail(null, -32700, 'Parse error');
    return;
  }

  const { id, method, params } = message;

  if (method === 'initialize') {
    respond(id, {
      protocolVersion: params?.protocolVersion ?? '2024-11-05',
      capabilities: { tools: {} },
      serverInfo: { name: 'fax-tools', version: '1.0.0' },
    });
    return;
  }

  if (method === 'tools/list') {
    respond(id, { tools: TOOLS });
    return;
  }

  if (method === 'tools/call') {
    try {
      respond(id, callTool(params?.name, params?.arguments));
    } catch (cause) {
      respond(id, {
        content: [{ type: 'text', text: String(cause) }],
        isError: true,
      });
    }
    return;
  }

  if (method === 'ping') {
    respond(id, {});
    return;
  }

  if (id !== undefined) fail(id, -32601, `Unknown method: ${method}`);
});
