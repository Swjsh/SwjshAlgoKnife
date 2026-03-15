/**
 * dataPaths.ts — Centralized persistent path resolver
 *
 * In development: everything stays in the project root (same as before).
 * In production (Docker / Fly.io): DATA_DIR env var points to the
 * mounted persistent volume (/app/data) so SQLite + JSON state survive redeploys.
 */
import path from 'path';

const DATA_DIR = process.env.DATA_DIR ?? process.cwd();

/** SQLite database file */
export const DATABASE_PATH =
    process.env.DATABASE_PATH ?? path.join(DATA_DIR, 'journal.db');

/** Mutable agent state (status, performance, pending orders) */
export const AGENTS_DB_PATH =
    process.env.AGENTS_DB_PATH ??
    path.join(DATA_DIR, 'agents_db.json');

/** Python bot status / log files live under DATA_DIR/  */
export const dataFile = (filename: string) => path.join(DATA_DIR, filename);
