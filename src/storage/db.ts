import { openDB, type IDBPDatabase } from 'idb';
import type { AppState } from '../domain/types';
import { createDemoState } from '../domain/seed';

const DB_NAME = 'signal-academic-studio';
const DB_VERSION = 1;
const STORE_NAME = 'workspace';

let dbPromise: Promise<IDBPDatabase> | undefined;

function openSignalDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      },
    });
  }
  return dbPromise;
}

export async function loadAppState(): Promise<AppState> {
  try {
    const db = await openSignalDB();
    const row = await db.get(STORE_NAME, 'main');
    if (row?.state) {
      const state = row.state as AppState;
      if (!Array.isArray(state.attendance)) state.attendance = [];
      if (!Array.isArray(state.holidays)) state.holidays = [];
      if (!state.settings.periodMinutes) state.settings.periodMinutes = 40;
      return state;
    }
    const initial = createDemoState();
    await db.put(STORE_NAME, { id: 'main', state: initial, savedAt: new Date().toISOString() });
    return initial;
  } catch (error) {
    console.error('IndexedDB unavailable:', error);
    return createDemoState();
  }
}

export async function saveAppState(state: AppState): Promise<void> {
  const db = await openSignalDB();
  await db.put(STORE_NAME, { id: 'main', state, savedAt: new Date().toISOString() });
}

export async function clearAppState(): Promise<void> {
  const db = await openSignalDB();
  await db.delete(STORE_NAME, 'main');
}

export async function exportAppState(state: AppState): Promise<void> {
  const payload = {
    formatName: 'SIGNAL-LOCAL-BACKUP',
    schemaVersion: state.schemaVersion,
    appVersion: '1.0.0',
    exportedAt: new Date().toISOString(),
    payload: state,
  };
  const encoded = JSON.stringify(payload);
  const checksum = await sha256(encoded);
  const downloadPayload = JSON.stringify({ ...payload, checksum }, null, 2);
  const blob = new Blob([downloadPayload], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `SIGNAL-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function parseBackupFile(file: File): Promise<AppState> {
  const text = await file.text();
  const parsed = JSON.parse(text) as { formatName?: string; payload?: AppState; checksum?: string; [key: string]: unknown };
  if (parsed.formatName !== 'SIGNAL-LOCAL-BACKUP' || !parsed.payload) {
    throw new Error('Format file tidak dikenali sebagai backup SIGNAL.');
  }
  if (parsed.schemaVersion !== 1) throw new Error('Versi skema backup tidak cocok dengan aplikasi ini.');
  const payload = parsed.payload;
  if (!Array.isArray(payload.classes) || !Array.isArray(payload.teachers) || !Array.isArray(payload.subjects) || !Array.isArray(payload.requirements)) {
    throw new Error('Struktur data backup tidak lengkap.');
  }
  const { checksum: _checksum, ...withoutChecksum } = parsed;
  const expected = await sha256(JSON.stringify(withoutChecksum));
  if (parsed.checksum && parsed.checksum !== expected) {
    throw new Error('Checksum backup tidak cocok. File mungkin berubah atau rusak.');
  }
  return payload;
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((n) => n.toString(16).padStart(2, '0')).join('');
}
