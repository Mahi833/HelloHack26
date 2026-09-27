import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import type { DrinkEvent, DrinkSource } from '@/store/types';

export const DATABASE_NAME = 'icup-hydration.db';

type DrinkEventRow = {
  id: string;
  at: number;
  ml: number;
  source: string;
};

type SettingRow = {
  value: string;
};

const DRINK_SOURCES: DrinkSource[] = ['cup', 'manual', 'health'];

const toDrinkSource = (value: string): DrinkSource =>
  DRINK_SOURCES.find((source) => source === value) ?? 'manual';

const toDrinkEvent = (row: DrinkEventRow): DrinkEvent => ({
  id: row.id,
  at: Math.trunc(row.at),
  ml: Math.trunc(row.ml),
  source: toDrinkSource(row.source),
});

export const migrateDatabaseAsync = async (db: SQLiteDatabase): Promise<void> => {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS drink_events (
      id TEXT PRIMARY KEY NOT NULL,
      at INTEGER NOT NULL,
      ml INTEGER NOT NULL,
      source TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS drink_events_at ON drink_events (at);
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
  `);
};

let databasePromise: Promise<SQLiteDatabase> | null = null;

export const openHydrationDatabaseAsync = (): Promise<SQLiteDatabase> => {
  if (!databasePromise) {
    databasePromise = openDatabaseAsync(DATABASE_NAME)
      .then(async (db) => {
        await migrateDatabaseAsync(db);
        return db;
      })
      .catch((error: unknown) => {
        databasePromise = null;
        throw error;
      });
  }
  return databasePromise;
};

export const readDrinkEventsAsync = async (): Promise<DrinkEvent[]> => {
  const db = await openHydrationDatabaseAsync();
  const rows = await db.getAllAsync<DrinkEventRow>(
    'SELECT id, at, ml, source FROM drink_events ORDER BY at DESC',
    [],
  );
  return rows.map(toDrinkEvent);
};

export const insertDrinkEventAsync = async (event: DrinkEvent): Promise<void> => {
  const db = await openHydrationDatabaseAsync();
  await db.runAsync(
    'INSERT OR REPLACE INTO drink_events (id, at, ml, source) VALUES (?, ?, ?, ?)',
    [event.id, event.at, event.ml, event.source],
  );
};

export const deleteDrinkEventAsync = async (id: string): Promise<void> => {
  const db = await openHydrationDatabaseAsync();
  await db.runAsync('DELETE FROM drink_events WHERE id = ?', [id]);
};

export const readSettingAsync = async (key: string): Promise<string | null> => {
  const db = await openHydrationDatabaseAsync();
  const row = await db.getFirstAsync<SettingRow>('SELECT value FROM settings WHERE key = ?', [key]);
  return row ? row.value : null;
};

export const writeSettingAsync = async (key: string, value: string): Promise<void> => {
  const db = await openHydrationDatabaseAsync();
  await db.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
};
