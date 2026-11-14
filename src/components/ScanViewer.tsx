import type { OcrWord } from '../lib/types';

interface Props {
  imageUrl: string | null;
  words: OcrWord[];
  width: number;
  height: number;
  showBoxes: boolean;
  highlight?: string;
}

export function ScanViewer({ imageUrl, words, width, height, showBoxes, highlight }: Props) {
  if (!imageUrl) {
    return (
      <div className="scan-empty">
        <div className="scan-empty-mark">FAX</div>
        <p>Drop a scanned fax, or load the sample referral.</p>
        <p className="dim">Images only, up to 8 MB. Nothing is uploaded.</p>
      </div>
    );
  }

  return (
    <div className="scan-frame">
      <img src={imageUrl} alt="Scanned fax" />
      {showBoxes && width > 0 && (
        <svg className="scan-boxes" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
          {words.map((word, index) => {
            const isHit = highlight && highlight.includes(word.text);
            return (
              <rect
                key={`${word.text}-${index}`}
                x={word.bbox.x0}
                y={word.bbox.y0}
                width={Math.max(1, word.bbox.x1 - word.bbox.x0)}
                height={Math.max(1, word.bbox.y1 - word.bbox.y0)}
                className={isHit ? 'box box-hit' : 'box'}
              />
            );
          })}
        </svg>
      )}
    </div>
  );
}
