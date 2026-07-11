import type { ClassId, SubjectId } from '../domain/model';

export type View =
  | { name: 'dashboard' }
  | { name: 'subject'; subjectId: SubjectId }
  | { name: 'grades'; subjectId: SubjectId; classId: ClassId }
  | { name: 'classes' }
  | { name: 'students' }
  | { name: 'archive' }
  | { name: 'settings' };
