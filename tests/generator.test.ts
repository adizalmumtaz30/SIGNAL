import { describe, expect, it } from 'vitest';
import { createDemoState } from '../src/domain/seed';
import { generateSchedule } from '../src/domain/generator';
import { buildTimeSlots } from '../src/domain/time';
import type { AppState } from '../src/domain/types';

function smallValidState(): AppState {
  const state = createDemoState();
  state.settings.activeDays = ['Senin'];
  state.settings.maxDailyJP = 8;
  state.settings.teachingPeriodsPerDay = 8;
  state.settings.breakAfterJP = [2, 5];
  state.slots = buildTimeSlots(state.settings);
  state.classes = state.classes.slice(0, 1);
  state.teachers = state.teachers.slice(0, 1);
  state.subjects = state.subjects.filter((subject) => subject.id === 'SUB-MAT');
  state.requirements = [{ id: 'R-MIN', classId: state.classes[0]!.id, subjectId: 'SUB-MAT', teacherId: 'TCH-001', requiredJP: 2 }];
  state.draft = null;
  state.activeSchedule = null;
  state.candidates = [];
  state.history = [];
  return state;
}

describe('generator SIGNAL', () => {
  it('membuat kandidat yang lolos validasi untuk masalah kecil yang feasible', () => {
    const result = generateSchedule(smallValidState(), 42, 5000);
    expect(result.status).toBe('SUCCESS');
    expect(result.candidate?.entries).toHaveLength(2);
    expect(result.candidate?.report.valid).toBe(true);
  });

  it('melaporkan input tidak valid saat kelas tidak memiliki kebutuhan JP', () => {
    const state = smallValidState();
    state.requirements = [];
    const result = generateSchedule(state, 42, 5000);
    expect(result.status).toBe('INVALID_INPUT');
  });
});
