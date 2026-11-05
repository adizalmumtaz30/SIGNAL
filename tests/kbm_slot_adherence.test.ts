import { describe, it, expect } from 'vitest';
import { createDemoState } from '../src/domain/seed';
import { buildTimeSlots, teachingPeriodsForDay, isSlotBlocked } from '../src/domain/time';
import { validateSchedule } from '../src/domain/validator';
import type { PeriodDefinition, ScheduleEntry } from '../src/domain/types';

describe('Aturan Pengisian Mapel Mengikuti Jam KBM (KBM Slot Adherence)', () => {
  it('hanya slot KBM aktif yang dapat menerima penempatan mapel', () => {
    const state = createDemoState();
    const activeDays = state.settings.activeDays;

    for (const day of activeDays) {
      const validJpList = teachingPeriodsForDay(state.slots, day);
      expect(validJpList.length).toBeGreaterThan(0);

      // Pastikan setiap JP yang valid adalah kind === TEACHING dan active
      for (const jp of validJpList) {
        const slot = state.slots.find(
          (s) => s.day === day && s.kind === 'TEACHING' && s.jpNo === jp && s.active
        );
        expect(slot).toBeDefined();
        expect(isSlotBlocked(slot)).toBe(false);
      }
    }
  });

  it('menolak penempatan pelajaran pada slot yang bukan jam KBM atau di luar jam belajar hari terkait', () => {
    const state = createDemoState();
    const classId = state.classes[0].id;
    const subjectId = state.subjects[0].id;
    const teacherId = state.teachers[0].id;

    // Ambil hari pertama (Senin)
    const day = 'Senin';
    const validJpList = teachingPeriodsForDay(state.slots, day);
    const maxValidJp = Math.max(...validJpList);

    // Coba tempatkan mapel di luar jam KBM (misal JP ke maxValidJp + 1 atau JP 99)
    const invalidEntry: ScheduleEntry = {
      id: 'TEST-INVALID-KBM',
      classId,
      day,
      jpNo: maxValidJp + 1, // Di luar jam KBM
      subjectId,
      teacherId,
    };

    const scheduleWithInvalid = [...(state.activeSchedule || []), invalidEntry];
    const report = validateSchedule(state, scheduleWithInvalid);

    // Harus terdeteksi error validasi slot
    const slotErrors = report.issues.filter(
      (i) => i.code === 'HC-INVALID-SLOT' || i.message.toLowerCase().includes('slot')
    );
    expect(slotErrors.length).toBeGreaterThan(0);
    expect(report.valid).toBe(false);
  });

  it('memastikan slot KBM memiliki jam mulai dan selesai yang sesuai dengan durasi periode KBM', () => {
    const state = createDemoState();
    const periodMinutes = state.settings.periodMinutes || 40;

    const teachingSlots = state.slots.filter((s) => s.kind === 'TEACHING' && s.active);
    expect(teachingSlots.length).toBeGreaterThan(0);

    for (const slot of teachingSlots) {
      expect(slot.start).toMatch(/^\d{2}:\d{2}$/);
      expect(slot.end).toMatch(/^\d{2}:\d{2}$/);

      // Hitung selisih menit antara start dan end
      const [startH, startM] = slot.start.split(':').map(Number);
      const [endH, endM] = slot.end.split(':').map(Number);
      const diffMinutes = endH * 60 + endM - (startH * 60 + startM);

      expect(diffMinutes).toBe(periodMinutes);
    }
  });

  it('mendukung jam KBM variatif per hari (misal Jumat lebih sedikit JP)', () => {
    // Definisi periode dengan variasi: Senin-Kamis 8 JP, Jumat hanya 5 JP
    const dur = 40;
    const defs: PeriodDefinition[] = [];
    let cursor = 7 * 60; // 07:00

    // KBM 1 - 5 berlaku tiap hari
    for (let i = 1; i <= 5; i++) {
      defs.push({
        order: defs.length + 1,
        start: `${String(Math.floor(cursor / 60)).padStart(2, '0')}:${String(cursor % 60).padStart(2, '0')}`,
        end: `${String(Math.floor((cursor + dur) / 60)).padStart(2, '0')}:${String((cursor + dur) % 60).padStart(2, '0')}`,
        activityType: 'KBM',
      });
      cursor += dur;
    }

    // KBM 6 - 8 HANYA berlaku Senin-Kamis (applicableDays)
    for (let i = 6; i <= 8; i++) {
      defs.push({
        order: defs.length + 1,
        start: `${String(Math.floor(cursor / 60)).padStart(2, '0')}:${String(cursor % 60).padStart(2, '0')}`,
        end: `${String(Math.floor((cursor + dur) / 60)).padStart(2, '0')}:${String((cursor + dur) % 60).padStart(2, '0')}`,
        activityType: 'KBM',
        applicableDays: ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Sabtu'],
      });
      cursor += dur;
    }

    const slots = buildTimeSlots({
      activeDays: ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'],
      breakAfterJP: [2, 5],
      maxDailyJP: 10,
      teachingPeriodsPerDay: 8,
      periodDefinitions: defs,
      periodMinutes: dur,
    });

    const jumatJPs = teachingPeriodsForDay(slots, 'Jumat');
    const seninJPs = teachingPeriodsForDay(slots, 'Senin');

    expect(jumatJPs.length).toBe(5);
    expect(seninJPs.length).toBe(8);
  });
});
