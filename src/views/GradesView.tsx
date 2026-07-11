import type { ClassId, SubjectId } from '../domain/model';
import { useApp } from '../state/AppContext';

export function GradesView({ subjectId, classId }: { subjectId: SubjectId; classId: ClassId }) {
  const { data } = useApp();
  const subject = data.subjects[subjectId];
  const schoolClass = data.classes[classId];
  if (!subject || !schoolClass) return null;
  return (
    <section className="view">
      <h1 className="view-title">
        {subject.name} · Klasse {schoolClass.name}
      </h1>
      <p className="view-placeholder">Die Noteneingabe entsteht im nächsten Schritt.</p>
    </section>
  );
}
