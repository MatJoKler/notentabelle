import type { SubjectId } from '../domain/model';
import { useApp } from '../state/AppContext';
import type { View } from '../state/navigation';

export function SubjectView({ subjectId }: { subjectId: SubjectId; setView: (v: View) => void }) {
  const { data } = useApp();
  const subject = data.subjects[subjectId];
  if (!subject) return null;
  return (
    <section className="view">
      <h1 className="view-title">{subject.name}</h1>
      <p className="view-placeholder">Die Fachübersicht entsteht im nächsten Schritt.</p>
    </section>
  );
}
