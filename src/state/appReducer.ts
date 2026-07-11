import {
  DEFAULT_WEIGHTS,
  gradeKey,
  type AppData,
  type Category,
  type ClassId,
  type ColumnId,
  type Security,
  type Semester,
  type StudentId,
  type StudentNote,
  type SubjectId,
  type Weights,
} from '../domain/model';
import { archiveAndAdvance } from '../domain/schoolYear';

export type Action =
  | { type: 'load'; data: AppData }
  | { type: 'class/add'; id: ClassId; name: string }
  | { type: 'class/rename'; id: ClassId; name: string }
  | { type: 'class/delete'; id: ClassId }
  | { type: 'student/add'; id: StudentId; classId: ClassId; name: string }
  | { type: 'student/rename'; id: StudentId; name: string }
  | { type: 'student/delete'; id: StudentId }
  | { type: 'student/move'; id: StudentId; toClassId: ClassId; noteId: string; timestamp: string }
  | { type: 'subject/add'; id: SubjectId; name: string }
  | { type: 'subject/rename'; id: SubjectId; name: string }
  | { type: 'subject/delete'; id: SubjectId }
  | { type: 'subject/setAssignedClasses'; id: SubjectId; classIds: ClassId[] }
  | { type: 'subject/setWeights'; id: SubjectId; weights: Weights }
  | {
      type: 'column/add';
      id: ColumnId;
      subjectId: SubjectId;
      classId: ClassId;
      semester: Semester;
      category: Category;
      title: string;
      date: string | null;
    }
  | { type: 'column/update'; id: ColumnId; title?: string; date?: string | null }
  | { type: 'column/delete'; id: ColumnId }
  | { type: 'grade/set'; studentId: StudentId; columnId: ColumnId; value: number }
  | { type: 'grade/clear'; studentId: StudentId; columnId: ColumnId }
  | { type: 'note/add'; studentId: StudentId; note: StudentNote }
  | { type: 'note/delete'; studentId: StudentId; noteId: string }
  | { type: 'year/archive'; archivedDate: string }
  | { type: 'security/set'; security: Security };

function omit<T>(record: Record<string, T>, keys: Iterable<string>): Record<string, T> {
  const drop = new Set(keys);
  return Object.fromEntries(Object.entries(record).filter(([key]) => !drop.has(key)));
}

/** Noten-Einträge entfernen, deren Schlüssel (studentId oder columnId) betroffen ist. */
function dropGrades(
  grades: Record<string, number>,
  match: (studentId: string, columnId: string) => boolean,
): Record<string, number> {
  return Object.fromEntries(
    Object.entries(grades).filter(([key]) => {
      const [studentId, columnId] = key.split(':');
      return !match(studentId, columnId);
    }),
  );
}

/** Spalten (und deren Noten) einer Klasse innerhalb eines Fachs entfernen. */
function dropColumns(data: AppData, matchColumn: (id: ColumnId) => boolean): Pick<AppData, 'columns' | 'grades'> {
  const removed = new Set(Object.keys(data.columns).filter(matchColumn));
  return {
    columns: omit(data.columns, removed),
    grades: dropGrades(data.grades, (_s, columnId) => removed.has(columnId)),
  };
}

function deleteStudents(data: AppData, studentIds: StudentId[]): AppData {
  const drop = new Set(studentIds);
  return {
    ...data,
    classes: Object.fromEntries(
      Object.entries(data.classes).map(([id, cls]) => [
        id,
        { ...cls, studentIds: cls.studentIds.filter((sid) => !drop.has(sid)) },
      ]),
    ),
    students: omit(data.students, drop),
    grades: dropGrades(data.grades, (studentId) => drop.has(studentId)),
    notes: omit(data.notes, drop),
  };
}

export function appReducer(data: AppData, action: Action): AppData {
  switch (action.type) {
    case 'load':
      return action.data;

    case 'class/add':
      return {
        ...data,
        classes: { ...data.classes, [action.id]: { name: action.name, studentIds: [] } },
      };

    case 'class/rename':
      return {
        ...data,
        classes: {
          ...data.classes,
          [action.id]: { ...data.classes[action.id], name: action.name },
        },
      };

    case 'class/delete': {
      const withoutStudents = deleteStudents(data, data.classes[action.id]?.studentIds ?? []);
      const { columns, grades } = dropColumns(withoutStudents, (id) => withoutStudents.columns[id].classId === action.id);
      return {
        ...withoutStudents,
        classes: omit(withoutStudents.classes, [action.id]),
        subjects: Object.fromEntries(
          Object.entries(withoutStudents.subjects).map(([id, subject]) => [
            id,
            { ...subject, assignedClassIds: subject.assignedClassIds.filter((cid) => cid !== action.id) },
          ]),
        ),
        columns,
        grades,
      };
    }

    case 'student/add':
      return {
        ...data,
        students: { ...data.students, [action.id]: { name: action.name, classId: action.classId } },
        classes: {
          ...data.classes,
          [action.classId]: {
            ...data.classes[action.classId],
            studentIds: [...data.classes[action.classId].studentIds, action.id],
          },
        },
      };

    case 'student/rename':
      return {
        ...data,
        students: {
          ...data.students,
          [action.id]: { ...data.students[action.id], name: action.name },
        },
      };

    case 'student/delete':
      return deleteStudents(data, [action.id]);

    case 'student/move': {
      const student = data.students[action.id];
      const fromClass = data.classes[student.classId];
      const toClass = data.classes[action.toClassId];
      const autoNote: StudentNote = {
        id: action.noteId,
        type: 'general',
        text: `Klassenwechsel von ${fromClass.name} nach ${toClass.name}`,
        timestamp: action.timestamp,
      };
      return {
        ...data,
        students: { ...data.students, [action.id]: { ...student, classId: action.toClassId } },
        classes: {
          ...data.classes,
          [student.classId]: {
            ...fromClass,
            studentIds: fromClass.studentIds.filter((sid) => sid !== action.id),
          },
          [action.toClassId]: { ...toClass, studentIds: [...toClass.studentIds, action.id] },
        },
        notes: { ...data.notes, [action.id]: [autoNote, ...(data.notes[action.id] ?? [])] },
      };
    }

    case 'subject/add':
      return {
        ...data,
        subjects: {
          ...data.subjects,
          [action.id]: { name: action.name, assignedClassIds: [], weights: DEFAULT_WEIGHTS },
        },
      };

    case 'subject/rename':
      return {
        ...data,
        subjects: {
          ...data.subjects,
          [action.id]: { ...data.subjects[action.id], name: action.name },
        },
      };

    case 'subject/delete': {
      const { columns, grades } = dropColumns(data, (id) => data.columns[id].subjectId === action.id);
      return { ...data, subjects: omit(data.subjects, [action.id]), columns, grades };
    }

    case 'subject/setAssignedClasses': {
      const keep = new Set(action.classIds);
      const { columns, grades } = dropColumns(
        data,
        (id) => data.columns[id].subjectId === action.id && !keep.has(data.columns[id].classId),
      );
      return {
        ...data,
        subjects: {
          ...data.subjects,
          [action.id]: { ...data.subjects[action.id], assignedClassIds: action.classIds },
        },
        columns,
        grades,
      };
    }

    case 'subject/setWeights':
      return {
        ...data,
        subjects: {
          ...data.subjects,
          [action.id]: { ...data.subjects[action.id], weights: action.weights },
        },
      };

    case 'column/add': {
      const maxOrder = Object.values(data.columns)
        .filter(
          (c) =>
            c.subjectId === action.subjectId &&
            c.classId === action.classId &&
            c.semester === action.semester &&
            c.category === action.category,
        )
        .reduce((max, c) => Math.max(max, c.order), -1);
      return {
        ...data,
        columns: {
          ...data.columns,
          [action.id]: {
            subjectId: action.subjectId,
            classId: action.classId,
            semester: action.semester,
            category: action.category,
            title: action.title,
            date: action.date,
            order: maxOrder + 1,
          },
        },
      };
    }

    case 'column/update':
      return {
        ...data,
        columns: {
          ...data.columns,
          [action.id]: {
            ...data.columns[action.id],
            ...(action.title !== undefined ? { title: action.title } : {}),
            ...(action.date !== undefined ? { date: action.date } : {}),
          },
        },
      };

    case 'column/delete': {
      const { columns, grades } = dropColumns(data, (id) => id === action.id);
      return { ...data, columns, grades };
    }

    case 'grade/set':
      return {
        ...data,
        grades: { ...data.grades, [gradeKey(action.studentId, action.columnId)]: action.value },
      };

    case 'grade/clear':
      return {
        ...data,
        grades: omit(data.grades, [gradeKey(action.studentId, action.columnId)]),
      };

    case 'note/add':
      return {
        ...data,
        notes: {
          ...data.notes,
          [action.studentId]: [action.note, ...(data.notes[action.studentId] ?? [])],
        },
      };

    case 'note/delete':
      return {
        ...data,
        notes: {
          ...data.notes,
          [action.studentId]: (data.notes[action.studentId] ?? []).filter((n) => n.id !== action.noteId),
        },
      };

    case 'year/archive':
      return archiveAndAdvance(data, { archivedDate: action.archivedDate });

    case 'security/set':
      return { ...data, security: action.security };
  }
}
