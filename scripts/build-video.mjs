// Turns the captured frame sequence into a 16:9 mp4 with captions over the
// live-app section.
//
// Timing is built as an explicit 12 fps image sequence (hard links), because the
// concat demuxer's handling of per-image durations is not repeatable: its final
// entry silently inherits the previous entry's duration.
import { spawn } from 'node:child_process';
import { existsSync, linkSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const FPS = 12;
const END_HOLD = 14;
const MAX_HOLD = 20;

const OUT = path.resolve('video/out');
const SEQ = path.join(OUT, 'seq');
const { frames, beats = [] } = JSON.parse(readFileSync(path.join(OUT, 'frames.json'), 'utf8'));
if (!frames.length) throw new Error('no frames captured');

rmSync(SEQ, { recursive: true, force: true });
mkdirSync(SEQ, { recursive: true });

let index = 0;
frames.forEach((frame, position) => {
  const isLast = position === frames.length - 1;
  const next = frames[position + 1]?.t ?? frame.t;
  const hold = isLast ? END_HOLD : Math.min(Math.max(next - frame.t, 0.08), MAX_HOLD);
  const copies = Math.max(1, Math.round(hold * FPS));
  for (let copy = 0; copy < copies; copy += 1) {
    linkSync(path.join(OUT, frame.file), path.join(SEQ, `${String(index).padStart(5, '0')}.jpg`));
    index += 1;
  }
});

const at = (name) => beats.find((beat) => beat.name === name)?.t;
const CAPTIONS = [
  ['app', 'result', 'Sample fax runs itself. OCR in a worker. Nothing uploaded.'],
  ['result', 'hover-name', 'Eight fields from one page. Each carries a confidence score.'],
  ['hover-name', 'hover-dob', 'Hover a field and the scan lights up with the words behind it.'],
  ['hover-dob', 'edit', '05/06/1980 is ambiguous. Resolved day first and flagged for review.'],
  ['edit', 'raw', 'Correct by hand. Then export JSON or CSV or post to a webhook.'],
  ['raw', 'kiro', 'The raw OCR text stays open for checking. Nothing is persisted.'],
];

const filters = ['scale=-2:1080', 'pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0xf4efe4'];
const font = 'video/fonts/consola.ttf';
let captions = 0;
if (existsSync(font)) {
  for (const [from, to, text] of CAPTIONS) {
    const start = at(from);
    const end = at(to);
    if (start === undefined || end === undefined) continue;
    captions += 1;
    filters.push(
      [
        `drawtext=fontfile='${font}'`,
        `text='${text}'`,
        'fontcolor=0xf4efe4',
        'fontsize=27',
        'x=(w-text_w)/2',
        'y=h-118',
        'box=1',
        'boxcolor=0x17150f@0.93',
        'boxborderw=20',
        `enable='between(t,${start.toFixed(2)},${(end - 0.2).toFixed(2)})'`,
      ].join(':'),
    );
  }
}
filters.push('format=yuv420p');

const target = path.resolve('video/faxbridge-demo.mp4');
const seconds = index / FPS;
console.log(`${frames.length} frames -> ${index} sequence frames, ${seconds.toFixed(1)}s, ${captions} captions`);

const ffmpeg = spawn(
  'ffmpeg',
  [
    '-y',
    '-loglevel', 'error',
    '-framerate', String(FPS),
    '-i', path.join(SEQ, '%05d.jpg'),
    '-vf', filters.join(','),
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', '23',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    target,
  ],
  { stdio: 'inherit' },
);

ffmpeg.on('exit', (code) => {
  console.log(code === 0 ? 'encoded ok' : `ffmpeg exited ${code}`);
  process.exit(code ?? 1);
});

writeFileSync(path.join(OUT, 'sequence.json'), JSON.stringify({ fps: FPS, frames: index }, null, 1));
