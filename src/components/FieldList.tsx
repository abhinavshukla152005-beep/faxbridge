import type { Field, FieldKey } from '../lib/types';

interface Props {
  fields: Field[];
  onChange: (key: FieldKey, value: string) => void;
  onFocusField: (field: Field | null) => void;
  disabled: boolean;
}

function badge(confidence: number): string {
  if (confidence >= 0.8) return 'high';
  if (confidence > 0) return 'check';
  return 'missing';
}

export function FieldList({ fields, onChange, onFocusField, disabled }: Props) {
  return (
    <section className="fields">
      <div className="field-list">
        {fields.map((field) => (
          <label
            key={field.key}
            className={`field field-${badge(field.confidence)}`}
            onMouseEnter={() => onFocusField(field)}
            onMouseLeave={() => onFocusField(null)}
          >
            <span className="field-label">
              {field.label}
              {field.confidence > 0 && (
                <span className={`chip chip-${badge(field.confidence)}`}>
                  {Math.round(field.confidence * 100)}%
                </span>
              )}
              {field.needsReview && <span className="chip chip-review">review</span>}
            </span>
            <input
              value={field.value}
              disabled={disabled}
              placeholder="not found"
              onChange={(event) => onChange(field.key, event.target.value)}
              onFocus={() => onFocusField(field)}
              onBlur={() => onFocusField(null)}
            />
          </label>
        ))}
      </div>
    </section>
  );
}
