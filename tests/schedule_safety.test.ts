import { describe, expect, it } from 'vitest';
import { createDemoState } from '../src/domain/seed';
import { buildTimeSlots, isSlotBlocked, teachingPeriodsForDay } from '../src/domain/time';
import { validateSchedule } from '../src/domain/validator';
import type { AppState, Day, PeriodDefinition, ScheduleEntry } from '../src/domain/types';

describe('P0 Schedule Safety & Non-KBM Slot Locking', () => {
  it('Upacara sebagai aktivitas pertama (order 1) tidak merusak JP KBM pertama (jpNo 1)', () => {
    const customPeriods: PeriodDefinition[] = [
      { order: 1, start: '07:00', end: '07:45', activityType: 'UPACARA', activityName: 'Upacara Bendera', applicableDays: ['Senin'] },
      { order: 2, start: '07:45', end: '08:25', activityType: 'KBM' },
      { order: 3, start: '08:25', end: '09:05', activityType: 'KBM' },
      { order: 4, start: '09:05', end: '09:45', activityType: 'KBM' },
      { order: 5, start: '09:45', end: '10:15', activityType: 'ISTIRAHAT', activityName: 'Istirahat Pertama' },
      { order: 6, start: '10:15', end: '10:55', activityType: 'KBM' },
      { order: 7, start: '10:55', end: '11:35', activityType: 'KBM' },
    ];

    const state = createDemoState();
    state.settings.periodDefinitions = customPeriods;
    state.slots = buildTimeSlots(state.settings);

    // Pada hari Senin:
    const mondaySlots = state.slots.filter((s) => s.day === 'Senin');
    
    // Slot 1 adalah Upacara (order 1, kind BREAK, jpNo undefined)
    const mondayOrder1 = mondaySlots.find((s) => s.order === 1);
    expect(mondayOrder1).toBeDefined();
    expect(mondayOrder1?.activityType).toBe('UPACARA');
    expect(mondayOrder1?.kind).toBe('BREAK');
    expect(mondayOrder1?.jpNo).toBeUndefined();
    expect(isSlotBlocked(mondayOrder1)).toBe(true);

    // Slot 2 adalah KBM pertama (order 2, kind TEACHING, jpNo 1)
    const mondayKbm1 = mondaySlots.find((s) => s.kind === 'TEACHING' && s.jpNo === 1);
    expect(mondayKbm1).toBeDefined();
    expect(mondayKbm1?.order).toBe(2);
    expect(mondayKbm1?.activityType).toBe('KBM');
    expect(mondayKbm1?.start).toBe('07:45');
    expect(mondayKbm1?.end).toBe('08:25');
    expect(isSlotBlocked(mondayKbm1)).toBe(false);

    // Memastikan resolusi target drag-and-drop berdasarkan jpNo 1 BUKAN mencocokkan Upacara (order 1)
    // Kesalahan lama: s.order === target.jpNo (mencocokkan Upacara karena order=1, target.jpNo=1)
    const oldErroneousMatch = mondaySlots.find((s) => s.order === 1);
    expect(isSlotBlocked(oldErroneousMatch)).toBe(true); // Ini yang dulu menyebabkan bug

    // Resolusi yang benar:
    const correctTargetMatch = mondaySlots.find((s) => s.kind === 'TEACHING' && s.active && s.jpNo === 1);
    expect(correctTargetMatch).toBeDefined();
    expect(isSlotBlocked(correctTargetMatch)).toBe(false);
    expect(correctTargetMatch?.order).toBe(2);
  });

  it('Istirahat pada slot aktivitas kelima (order 5) terkunci dan memisahkan KBM 3 dan KBM 4', () => {
    const customPeriods: PeriodDefinition[] = [
      { order: 1, start: '07:00', end: '07:40', activityType: 'KBM' },
      { order: 2, start: '07:40', end: '08:20', activityType: 'KBM' },
      { order: 3, start: '08:20', end: '09:00', activityType: 'KBM' },
      { order: 4, start: '09:00', end: '09:40', activityType: 'KBM' },
      { order: 5, start: '09:40', end: '10:00', activityType: 'ISTIRAHAT', activityName: 'Istirahat' },
      { order: 6, start: '10:00', end: '10:40', activityType: 'KBM' }, // jpNo 5
    ];

    const state = createDemoState();
    state.settings.periodDefinitions = customPeriods;
    state.slots = buildTimeSlots(state.settings);

    const tuesdaySlots = state.slots.filter((s) => s.day === 'Selasa');
    
    // Slot order 5 adalah Istirahat
    const breakSlot = tuesdaySlots.find((s) => s.order === 5);
    expect(breakSlot?.kind).toBe('BREAK');
    expect(breakSlot?.activityType).toBe('ISTIRAHAT');
    expect(isSlotBlocked(breakSlot)).toBe(true);

    // KBM 5 ada pada slot order 6
    const kbm5 = tuesdaySlots.find((s) => s.kind === 'TEACHING' && s.jpNo === 5);
    expect(kbm5).toBeDefined();
    expect(kbm5?.order).toBe(6);
    expect(kbm5?.start).toBe('10:00');
    expect(isSlotBlocked(kbm5)).toBe(false);

    // KBM periods yang tersedia untuk hari tersebut tidak memasukkan istirahat
    const validJpNumbers = teachingPeriodsForDay(state.slots, 'Selasa');
    expect(validJpNumbers).toEqual([1, 2, 3, 4, 5]);
  });

  it('Validator menolak entri jadwal yang ditempatkan pada slot non-KBM atau JP di luar struktur aktif', () => {
    const state = createDemoState();
    const cls = state.classes[0]!;
    const teacher = state.teachers[0]!;
    const subject = state.subjects.find((s) => teacher.subjectIds.includes(s.id))!;

    // Entri pada JP 99 (tidak ada di struktur)
    const invalidEntry: ScheduleEntry = {
      id: 'TEST-INVALID-99',
      classId: cls.id,
      day: 'Senin',
      jpNo: 99,
      teacherId: teacher.id,
      subjectId: subject.id,
    };

    const report = validateSchedule(state, [invalidEntry], { strictCoverage: false });
    expect(report.valid).toBe(false);
    expect(report.hardErrorCount).toBeGreaterThan(0);
    expect(report.issues.some((issue) => issue.code === 'HC-INVALID-SLOT')).toBe(true);
  });

  it('Publikasi draft diblokir jika terdapat hard constraint error', () => {
    const state = createDemoState();
    const cls = state.classes[0]!;
    const teacher = state.teachers[0]!;
    const subject = state.subjects[0]!;

    // Dua pelajaran pada kelas & waktu yang sama (bentrok kelas)
    const collision1: ScheduleEntry = {
      id: 'COL-1',
      classId: cls.id,
      day: 'Senin',
      jpNo: 1,
      teacherId: teacher.id,
      subjectId: subject.id,
    };
    const collision2: ScheduleEntry = {
      id: 'COL-2',
      classId: cls.id,
      day: 'Senin',
      jpNo: 1,
      teacherId: state.teachers[1]!.id,
      subjectId: state.subjects[1]!.id,
    };

    const report = validateSchedule(state, [collision1, collision2]);
    expect(report.valid).toBe(false);
    expect(report.issues.some((issue) => issue.code === 'HC-CLASS-COLLISION')).toBe(true);
  });
});
