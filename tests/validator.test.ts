import { describe, expect, it } from 'vitest';
import { createDemoState } from '../src/domain/seed';
import { validateSchedule } from '../src/domain/validator';
import type { ScheduleEntry } from '../src/domain/types';

const entry = (id: string, classId: string, jpNo: number): ScheduleEntry => ({
  id, classId, subjectId: 'SUB-MAT', teacherId: 'TCH-001', day: 'Senin', jpNo,
});

describe('validator deterministik SIGNAL', () => {
  it('menolak guru yang ditempatkan di dua kelas pada slot yang sama', () => {
    const state = createDemoState();
    const report = validateSchedule(state, [
      entry('one', 'CLS-7A', 1),
      entry('two', 'CLS-7B', 1),
    ], { strictCoverage: false, includeSoftWarnings: false });

    expect(report.valid).toBe(false);
    expect(report.issues.some((issue) => issue.code === 'HC-TEACHER-COLLISION')).toBe(true);
  });

  it('menghasilkan issue id yang sama untuk input dan aturan yang sama', () => {
    const state = createDemoState();
    const schedule = [entry('one', 'CLS-7A', 1), entry('two', 'CLS-7B', 1)];
    const first = validateSchedule(state, schedule, { strictCoverage: false, includeSoftWarnings: false });
    const second = validateSchedule(state, schedule, { strictCoverage: false, includeSoftWarnings: false });
    expect(first.issues.map((issue) => issue.id)).toEqual(second.issues.map((issue) => issue.id));
  });


  it('menolak rangkaian guru multimapel yang melewati batas setelah istirahat', () => {
    const state = createDemoState();
    const entries: ScheduleEntry[] = [1, 2, 3, 4, 5].map((jpNo) => ({
      id: `multi-${jpNo}`,
      classId: 'CLS-7A',
      subjectId: jpNo % 2 === 1 ? 'SUB-PAI' : 'SUB-QUR',
      teacherId: 'TCH-007',
      day: 'Senin',
      jpNo,
    }));
    const report = validateSchedule(state, entries, { strictCoverage: false, includeSoftWarnings: false });
    expect(report.valid).toBe(false);
    expect(report.issues.some((issue) => issue.code === 'HC-MULTISUBJECT-POST-BREAK')).toBe(true);
  });

  it('menolak blok mapel empat JP berturut-turut', () => {
    const state = createDemoState();
    const report = validateSchedule(state, [1, 2, 3, 4].map((jp) => entry(`e-${jp}`, 'CLS-7A', jp)), {
      strictCoverage: false,
      includeSoftWarnings: false,
    });
    expect(report.valid).toBe(false);
    expect(report.issues.some((issue) => issue.code === 'HC-SUBJECT-BLOCK-OVERFLOW')).toBe(true);
  });
});
