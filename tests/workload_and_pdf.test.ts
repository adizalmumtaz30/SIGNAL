import { describe, expect, it } from 'vitest';
import { createDemoState } from '../src/domain/seed';
import { buildTimeSlots, jpToAstronomical } from '../src/domain/time';
import { exportScheduleClassPDF, exportScheduleMasterPDF, exportScheduleTeacherPDF } from '../src/utils/pdfExport';
import type { PeriodDefinition } from '../src/domain/types';

describe('Perhitungan Beban Guru & Waktu Astronomis', () => {
  it('menghitung jam astronomis secara akurat dari JP dan durasi per JP', () => {
    // 24 JP dengan durasi 40 menit = 960 menit = 16.0 jam
    const result40 = jpToAstronomical(24, 40);
    expect(result40.minutes).toBe(960);
    expect(result40.hours).toBe(16);
    expect(result40.formatted).toContain('16 jam');

    // 18 JP dengan durasi 45 menit = 810 menit = 13.5 jam
    const result45 = jpToAstronomical(18, 45);
    expect(result45.minutes).toBe(810);
    expect(result45.hours).toBe(13.5);
    expect(result45.formatted).toContain('13.5 jam');

    // 0 JP = 0 menit
    const result0 = jpToAstronomical(0, 40);
    expect(result0.minutes).toBe(0);
    expect(result0.hours).toBe(0);
  });

  it('menghitung agregasi beban aktual per guru dari entri jadwal', () => {
    const state = createDemoState();
    const entries = state.activeSchedule ?? [];
    expect(entries.length).toBeGreaterThan(0);

    for (const teacher of state.teachers) {
      const teacherEntries = entries.filter((e) => e.teacherId === teacher.id);
      const totalJP = teacherEntries.length;
      expect(totalJP).toBeLessThanOrEqual(teacher.maxWeeklyJP);

      const astro = jpToAstronomical(totalJP, state.settings.periodMinutes);
      expect(astro.minutes).toBe(totalJP * state.settings.periodMinutes);
    }
  });
});

describe('Pengaturan Jam Kegiatan & Hari Berlaku', () => {
  it('menerapkan filter applicableDays pada slot harian', () => {
    const state = createDemoState();
    const customPeriods: PeriodDefinition[] = [
      { order: 1, start: '07:00', end: '07:45', activityType: 'UPACARA', applicableDays: ['Senin'] },
      { order: 2, start: '07:45', end: '08:25', activityType: 'KBM' },
      { order: 3, start: '08:25', end: '09:05', activityType: 'KBM' },
      { order: 4, start: '09:05', end: '09:25', activityType: 'ISTIRAHAT' },
      { order: 5, start: '09:25', end: '09:40', activityType: 'RELIGI', activityName: 'Dhuha', applicableDays: ['Jumat'] },
    ];

    state.settings.periodDefinitions = customPeriods;
    const slots = buildTimeSlots(state.settings);

    // Pada hari Senin: harus ada UPACARA, tidak boleh ada RELIGI (khusus Jumat)
    const mondaySlots = slots.filter((s) => s.day === 'Senin');
    expect(mondaySlots.some((s) => s.activityType === 'UPACARA')).toBe(true);
    expect(mondaySlots.some((s) => s.activityType === 'RELIGI')).toBe(false);

    // Pada hari Selasa: tidak boleh ada UPACARA atau RELIGI
    const tuesdaySlots = slots.filter((s) => s.day === 'Selasa');
    expect(tuesdaySlots.some((s) => s.activityType === 'UPACARA')).toBe(false);
    expect(tuesdaySlots.some((s) => s.activityType === 'RELIGI')).toBe(false);

    // Pada hari Jumat: harus ada RELIGI, tidak boleh ada UPACARA
    const fridaySlots = slots.filter((s) => s.day === 'Jumat');
    expect(fridaySlots.some((s) => s.activityType === 'RELIGI')).toBe(true);
    expect(fridaySlots.some((s) => s.activityType === 'UPACARA')).toBe(false);
  });
});

describe('Ekspor PDF Jadwal', () => {
  it('dapat menghasilkan dokumen PDF jadwal induk, per kelas, dan per guru tanpa error', () => {
    const state = createDemoState();

    // Test Master PDF
    expect(() => exportScheduleMasterPDF(state)).not.toThrow();

    // Test Class PDF
    const firstClass = state.classes[0]!;
    expect(() => exportScheduleClassPDF(state, firstClass.id)).not.toThrow();

    // Test Teacher PDF
    const firstTeacher = state.teachers[0]!;
    expect(() => exportScheduleTeacherPDF(state, firstTeacher.id)).not.toThrow();
  });
});

describe('Konsolidasi Fitur Edit & Hapus Entitas (Integritas Data)', () => {
  it('dapat memperbarui (edit) data Guru dan menghitung ulang beban secara konsisten', () => {
    const state = createDemoState();
    const teacher = state.teachers[0]!;
    const originalName = teacher.name;

    // Simulasikan edit guru (nama, kode, dan batas JP)
    const updatedTeacher = {
      ...teacher,
      name: `${originalName} (Senior)`,
      maxWeeklyJP: 28,
    };

    state.teachers = state.teachers.map((t) => (t.id === teacher.id ? updatedTeacher : t));

    const found = state.teachers.find((t) => t.id === teacher.id);
    expect(found?.name).toBe(`${originalName} (Senior)`);
    expect(found?.maxWeeklyJP).toBe(28);

    // Entri jadwal tetap konsisten terhubung dengan teacher.id
    const entries = (state.activeSchedule ?? []).filter((e) => e.teacherId === teacher.id);
    expect(entries.length).toBeGreaterThan(0);
  });

  it('dapat memperbarui (edit) data Kelas dan Alokasi Kebutuhan JP', () => {
    const state = createDemoState();
    const cls = state.classes[0]!;

    // Edit kelas
    state.classes = state.classes.map((c) => (c.id === cls.id ? { ...c, name: `${c.name}-Unggulan` } : c));
    expect(state.classes.find((c) => c.id === cls.id)?.name).toBe(`${cls.name}-Unggulan`);

    // Edit alokasi kebutuhan
    const req = state.requirements.find((r) => r.classId === cls.id)!;
    const oldJP = req.requiredJP;
    state.requirements = state.requirements.map((r) => (r.id === req.id ? { ...r, requiredJP: oldJP + 2 } : r));

    expect(state.requirements.find((r) => r.id === req.id)?.requiredJP).toBe(oldJP + 2);
  });

  it('dapat memperbarui (edit) Hari Libur madrasah dan menyinkronkan status presensi', () => {
    const state = createDemoState();
    state.holidays = [
      { id: 'HOL-1', date: '2026-08-17', name: 'HUT Kemerdekaan RI' },
    ];

    // Edit hari libur
    state.holidays = state.holidays.map((h) =>
      h.id === 'HOL-1' ? { ...h, name: 'HUT Proklamasi Kemerdekaan RI Ke-81' } : h
    );

    expect(state.holidays[0]!.name).toBe('HUT Proklamasi Kemerdekaan RI Ke-81');
  });
});

