import { useCallback, useEffect, useRef, useState } from 'react';
import { FieldList } from './components/FieldList';
import { ScanViewer } from './components/ScanViewer';
import { completion, emptyFields, extractFields } from './lib/extract';
import { medianConfidence, recognize } from './lib/ocr';
import { firstPageToBlob } from './lib/pdf';
import { download, toCsv, toJson } from './lib/export';
import type { FaxRecord, Field, FieldKey, OcrResult } from './lib/types';

const SAMPLE = `${import.meta.env.BASE_URL}sample-referral.png`;

type Status = 'idle' | 'reading' | 'done';

export default function App() {
  const [status, setStatus] = useState<Status>('idle');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<OcrResult | null>(null);
  const [fields, setFields] = useState<Field[]>(emptyFields);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [sourceName, setSourceName] = useState('');
  const [focus, setFocus] = useState<Field | null>(null);
  const [showBoxes, setShowBoxes] = useState(true);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [webhook, setWebhook] = useState('');
  const [routeState, setRouteState] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const run = useCallback(async (blob: Blob, name: string) => {
    setError('');
    setRouteState('');
    setStatus('reading');
    setProgress(0);
    setResult(null);
    setFields(emptyFields());
    setSourceName(name);

    try {
      let target = blob;
      if (blob.type === 'application/pdf') {
        const page = await firstPageToBlob(new File([blob], name, { type: blob.type }));
        target = page.blob;
      }

      const url = URL.createObjectURL(target);
      setImageUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return url;
      });

      const ocr = await recognize(target, setProgress);
      const pageConfidence = medianConfidence(ocr.words);
      setResult(ocr);
      setFields(extractFields(ocr.text, { pageConfidence }));
      setStatus('done');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not read that fax');
      setStatus('idle');
    }
  }, []);

  const replayFixture = useCallback(async () => {
    setError('');
    setStatus('reading');
    setProgress(1);
    try {
      const [fixture, image] = await Promise.all([
        fetch(`${import.meta.env.BASE_URL}demo-ocr.json`).then((value) => value.json() as Promise<OcrResult>),
        fetch(SAMPLE),
      ]);
      setImageUrl(URL.createObjectURL(await image.blob()));
      setSourceName('sample-referral.png');
      setResult(fixture);
      setFields(extractFields(fixture.text, { pageConfidence: medianConfidence(fixture.words) }));
      setStatus('done');
    } catch {
      setError('The offline sample could not be loaded.');
      setStatus('idle');
    }
  }, []);

  const onFiles = useCallback(
    (files: FileList | null) => {
      const file = files?.[0];
      if (!file) return;
      if (file.size > 8 * 1024 * 1024) {
        setError('That file is over 8 MB. Compress the scan and try again.');
        return;
      }
      void run(file, file.name);
    },
    [run],
  );

  const record: FaxRecord | null = result
    ? {
        id: crypto.randomUUID(),
        sourceName,
        receivedAt: new Date().toISOString(),
        ocrMs: result.ms,
        fields,
        text: result.text,
        imageUrl: imageUrl ?? undefined,
      }
    : null;

  const update = (key: FieldKey, value: string) =>
    setFields((current) => current.map((field) => (field.key === key ? { ...field, value } : field)));

  const route = async () => {
    if (!record || !webhook) return;
    setRouteState('sending');
    try {
      const response = await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: toJson(record),
      });
      setRouteState(response.ok ? `delivered ${response.status}` : `rejected ${response.status}`);
    } catch {
      setRouteState('blocked by the destination CORS policy');
    }
  };

  const averageConfidence = result?.words.length ? medianConfidence(result.words) : 0;
  const filled = fields.filter((field) => field.value.trim()).length;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('demo') !== '1') return;
    if (params.get('fixture') === '1') {
      void replayFixture();
    } else {
      void runFromSample(run);
    }
  }, [run]);

  return (
    <div className="app">
      <header className="masthead">
        <div>
          <p className="eyebrow">A Kiroween 2026 build</p>
          <h1>
            Fax<span>Bridge</span>
          </h1>
          <p className="tagline">
            The fax machine still runs clinics, courts and pharmacies. This desk reads it without
            ever sending your paperwork anywhere.
          </p>
        </div>
        <div className="stamp">
          <span>RECEIVED</span>
          <span className="stamp-date">{new Date().toLocaleDateString('en-GB')}</span>
        </div>
      </header>

      <main className="desk">
        <section
          className={dragOver ? 'panel panel-drop drag' : 'panel panel-drop'}
          onDragOver={(event) => {
            event.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragOver(false);
            onFiles(event.dataTransfer.files);
          }}
        >
          <header className="panel-head">
            <h2>Incoming</h2>
            <label className="toggle">
              <input
                type="checkbox"
                checked={showBoxes}
                onChange={(event) => setShowBoxes(event.target.checked)}
              />
              OCR boxes
            </label>
          </header>

          <ScanViewer
            imageUrl={imageUrl}
            words={result?.words ?? []}
            width={result?.width ?? 0}
            height={result?.height ?? 0}
            showBoxes={showBoxes}
            highlight={focus?.evidence}
          />

          <div className="panel-actions">
            <button type="button" className="primary" onClick={() => inputRef.current?.click()}>
              Load a fax
            </button>
            <button type="button" onClick={() => void runFromSample(run)}>
              Use sample
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="image/*,application/pdf"
              hidden
              onChange={(event) => onFiles(event.target.files)}
            />
          </div>

          {status === 'reading' && (
            <div className="progress">
              <div className="progress-bar" style={{ width: `${Math.round(progress * 100)}%` }} />
              <span>Reading the page… {Math.round(progress * 100)}%</span>
            </div>
          )}

          {error && <p className="error">{error}</p>}
        </section>

        <section className="panel panel-extract">
          <header className="panel-head">
            <h2>Record</h2>
            <span className={filled === fields.length ? 'count count-done' : 'count'}>
              {filled}/{fields.length}
            </span>
          </header>

          <FieldList
            fields={fields}
            onChange={update}
            onFocusField={setFocus}
            disabled={status !== 'done'}
          />

          {status === 'done' && record && (
            <>
              <div className="meter">
                <div className="meter-fill" style={{ width: `${completion(fields) * 100}%` }} />
              </div>
              <p className="meta">
                {Math.round(completion(fields) * 100)}% complete · {averageConfidence.toFixed(0)}%
                median · {record.ocrMs} ms · items under 80% are flagged
              </p>

              <div className="panel-actions">
                <button
                  type="button"
                  className="primary"
                  onClick={() => {
                    void navigator.clipboard.writeText(toJson(record));
                    setRouteState('copied');
                  }}
                >
                  Copy JSON
                </button>
                <button type="button" onClick={() => download('fax.json', toJson(record), 'application/json')}>
                  .json
                </button>
                <button type="button" onClick={() => download('fax.csv', toCsv(record), 'text/csv')}>
                  .csv
                </button>
              </div>

              <div className="route">
                <input
                  value={webhook}
                  onChange={(event) => setWebhook(event.target.value)}
                  placeholder="https://your-ehr.example/fax-hook"
                  aria-label="Webhook URL"
                />
                <button type="button" onClick={() => void route()} disabled={!webhook || routeState === 'sending'}>
                  Route
                </button>
              </div>
              {routeState && <p className="meta">{routeState}</p>}
            </>
          )}
        </section>
      </main>

      {result && (
        <details className="raw">
          <summary>Raw OCR text</summary>
          <pre>{result.text}</pre>
        </details>
      )}

      <footer className="foot">
        <span>
          Runs entirely in this tab: OCR, extraction, export. <a href="/blog/">How it was built</a>
        </span>
        <span>{status === 'done' ? `${result?.words.length ?? 0} words read` : 'Waiting for a fax'}</span>
      </footer>
    </div>
  );
}

async function runFromSample(run: (blob: Blob, name: string) => Promise<void>) {
  const response = await fetch(SAMPLE);
  const blob = await response.blob();
  await run(blob, 'sample-referral.png');
}
