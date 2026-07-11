import { useEffect, useState } from 'react';
import type { SubjectId, WeightMode } from '../domain/model';
import { convertWeightsMode, validateWeights } from '../domain/weights';
import { useApp } from '../state/AppContext';

const FIELDS = [
  { key: 'ka' as const, label: 'Klassenarbeiten' },
  { key: 'tests' as const, label: 'Tests' },
  { key: 'muendlich' as const, label: 'Mündlich' },
];

/**
 * Bearbeitet die Gewichte eines Fachs. Änderungen werden erst übernommen,
 * wenn sie gültig sind (percent: Summe 100, factor: ganze Zahlen 1–5);
 * ungültige Zwischenstände bleiben lokal und zeigen eine Meldung.
 */
export function SubjectWeightsEditor({ subjectId }: { subjectId: SubjectId }) {
  const { data, dispatch } = useApp();
  const weights = data.subjects[subjectId].weights;
  const [draft, setDraft] = useState(weights);

  useEffect(() => setDraft(weights), [weights]);

  const error = validateWeights(draft);

  const update = (next: typeof draft) => {
    setDraft(next);
    if (validateWeights(next) === null) {
      dispatch({ type: 'subject/setWeights', id: subjectId, weights: next });
    }
  };

  const switchMode = (mode: WeightMode) => {
    const converted = convertWeightsMode(weights, mode);
    setDraft(converted);
    dispatch({ type: 'subject/setWeights', id: subjectId, weights: converted });
  };

  return (
    <div className="weights-editor">
      <div className="mode-toggle" role="radiogroup" aria-label="Gewichtungsmodus">
        <button
          className={`mode-option${draft.mode === 'percent' ? ' is-active' : ''}`}
          onClick={() => switchMode('percent')}
        >
          Prozent
        </button>
        <button
          className={`mode-option${draft.mode === 'factor' ? ' is-active' : ''}`}
          onClick={() => switchMode('factor')}
        >
          Faktor
        </button>
      </div>

      <div className="weights-fields">
        {FIELDS.map(({ key, label }) => (
          <label key={key} className="field weights-field">
            <span className="field-label">{label}</span>
            <span className="weights-input">
              <input
                type="number"
                className="input"
                min={draft.mode === 'percent' ? 0 : 1}
                max={draft.mode === 'percent' ? 100 : 5}
                step={1}
                value={Number.isNaN(draft[key]) ? '' : draft[key]}
                onChange={(e) => update({ ...draft, [key]: e.target.valueAsNumber })}
              />
              {draft.mode === 'percent' && <span className="weights-unit">%</span>}
            </span>
          </label>
        ))}
      </div>

      {error && <p className="weights-error">{error}</p>}
    </div>
  );
}
