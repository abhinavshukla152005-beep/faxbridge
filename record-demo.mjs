// Drives the deployed app in headless Edge over CDP and records the tab as a
// frame sequence. No screen capture of the desktop, so nothing else on the
// machine can end up in the video.
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const PORT = 9333;
const EDGE =
  process.env.EDGE ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const OUT = path.resolve('video/out');
const PROFILE = path.resolve('video/.profile');
const APP = 'https://faxbridge-demo.web.app/';
const SMOKE = process.argv.includes('--smoke');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const slide = (name) => pathToFileURL(path.resolve('video/slides', `${name}.html`)).href;

rmSync(OUT, { recursive: true, force: true });
rmSync(PROFILE, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const browser = spawn(
  EDGE,
  [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--mute-audio',
    '--no-first-run',
    '--no-default-browser-check',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${PROFILE}`,
    '--window-size=1440,1250',
    'about:blank',
  ],
  { stdio: 'ignore' },
);

async function findPage() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const targets = await fetch(`http://127.0.0.1:${PORT}/json/list`).then((r) => r.json());
      const page = targets.find((target) => target.type === 'page');
      if (page?.webSocketDebuggerUrl) return page;
    } catch {
      // devtools endpoint is not up yet
    }
    await sleep(200);
  }
  throw new Error('devtools endpoint never appeared');
}

const page = await findPage();
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});

let nextId = 0;
const pending = new Map();
socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (!message.id) return;
  const entry = pending.get(message.id);
  if (!entry) return;
  pending.delete(message.id);
  if (message.error) entry.reject(new Error(`${message.error.message} (${message.error.code})`));
  else entry.resolve(message.result ?? {});
});

function send(method, params = {}, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
    setTimeout(() => {
      if (!pending.has(id)) return;
      pending.delete(id);
      reject(new Error(`${method} timed out`));
    }, timeoutMs);
  });
}

const evaluate = async (expression) => {
  const { result } = await send(
    'Runtime.evaluate',
    { expression, returnByValue: true, awaitPromise: true },
    15000,
  );
  return result?.value;
};

const frames = [];
const beats = [];
let lastHash = '';
let started = 0;
let stop = false;
let captureErrors = 0;

const mark = (name) => beats.push({ name, t: (Date.now() - started) / 1000 });

async function captureLoop() {
  started = Date.now();
  while (!stop) {
    try {
      const { data } = await send(
        'Page.captureScreenshot',
        { format: 'jpeg', quality: 82 },
        8000,
      );
      const buffer = Buffer.from(data, 'base64');
      const hash = createHash('md5').update(buffer).digest('hex');
      if (hash !== lastHash) {
        lastHash = hash;
        const file = `frame-${String(frames.length).padStart(5, '0')}.jpg`;
        writeFileSync(path.join(OUT, file), buffer);
        frames.push({ file, t: (Date.now() - started) / 1000 });
      }
    } catch (error) {
      captureErrors += 1;
      if (captureErrors < 5) console.log('capture error:', error.message);
    }
    await sleep(80);
  }
}

async function waitFor(expression, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await evaluate(expression)) return true;
    await sleep(300);
  }
  throw new Error(`timed out waiting for ${label}`);
}

async function go(url) {
  await send('Page.navigate', { url });
  await sleep(900);
}

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', {
  width: 1440,
  height: 1250,
  deviceScaleFactor: 1,
  mobile: false,
});
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });

let recording;
try {
  await go(slide('01-intro'));
  recording = captureLoop();
  await sleep(700);
  mark('intro');
  await sleep(SMOKE ? 800 : 6800);

  if (!SMOKE) {
    await go(slide('02-problem'));
    await sleep(700);
    mark('problem');
    await sleep(10300);

    await go(slide('03-pipeline'));
    await sleep(700);
    mark('pipeline');
    await sleep(11300);
  }

  await go(`${APP}?demo=1`);
  mark('app');
  console.log('app loaded, waiting for OCR');
  await waitFor("document.body.innerText.includes('complete')", 150000, 'OCR to finish');
  console.log('OCR finished');
  mark('result');
  await sleep(SMOKE ? 600 : 5200);

  // Hover the extracted name so its evidence words light up on the scan.
  await evaluate(
    "document.querySelectorAll('.field')[0].dispatchEvent(new MouseEvent('mouseover',{bubbles:true}))",
  );
  mark('hover-name');
  await sleep(SMOKE ? 800 : 5200);

  // The flagged date of birth: the one value the tool refuses to decide alone.
  await evaluate(
    "document.querySelectorAll('.field')[1].dispatchEvent(new MouseEvent('mouseover',{bubbles:true}))",
  );
  mark('hover-dob');
  await sleep(SMOKE ? 800 : 6200);

  // Correct the reason field by hand, like the clerk would.
  await evaluate(
    "(() => { const el = document.querySelectorAll('.field input')[7]; el.focus(); el.setSelectionRange(el.value.length, el.value.length); return 1 })()",
  );
  await sleep(700);
  await send('Input.insertText', { text: ' - confirmed by phone' });
  mark('edit');
  await sleep(SMOKE ? 800 : 4200);

  // Show the raw text behind the fields.
  await evaluate(
    "(() => { const d = document.querySelector('details'); d.open = true; d.scrollIntoView({block: 'end'}); return 1 })()",
  );
  mark('raw');
  await sleep(SMOKE ? 900 : 5600);

  if (!SMOKE) {
    await go(slide('04-kiro'));
    mark('kiro');
    await sleep(20000);

    await go(slide('05-confidence'));
    mark('confidence');
    await sleep(17000);

    await go(slide('06-limits'));
    mark('limits');
    await sleep(14000);
  } else {
    await go(slide('06-limits'));
    mark('limits');
    await sleep(1500);
  }
} finally {
  stop = true;
  if (recording) await recording;
  socket.close();
  browser.kill();
  writeFileSync(
    path.join(OUT, 'frames.json'),
    JSON.stringify({ app: APP, recordedAt: new Date().toISOString(), frames, beats }, null, 1),
  );
  const seconds = frames.length ? frames.at(-1).t : 0;
  console.log(`captured ${frames.length} frames over ${seconds.toFixed(1)}s`);
}
