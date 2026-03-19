/**
 * Stoolap DB wrapper
 *
 * Thin wrapper around the stoolap CLI binary for knowledge DB operations.
 * Each agent workspace has its own knowledge.db file.
 */

import { existsSync } from 'fs';
import { join } from 'path';
import { DIMENSIONS } from './gemini-embed';

const STOOLAP_BIN = '/usr/local/bin/stoolap';

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS knowledge (
    id INTEGER PRIMARY KEY,
    boat_id TEXT NOT NULL,
    session_id TEXT,
    dimension TEXT,
    prompt_id TEXT,
    wave INTEGER,
    content TEXT NOT NULL,
    category TEXT DEFAULT 'scan_extraction',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    embedding VECTOR(${DIMENSIONS})
);
CREATE INDEX IF NOT EXISTS idx_knowledge_boat ON knowledge(boat_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_session ON knowledge(session_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_embedding ON knowledge(embedding) USING HNSW WITH (metric = 'cosine');
`;

/**
 * Escape a string for SQL single-quote literals.
 */
export function escapeSQL(str: string): string {
  return str.replace(/'/g, "''");
}

/**
 * Format a vector as a SQL literal: '[0.1,0.2,...]'
 */
export function vectorToSQL(vec: number[]): string {
  return `'[${vec.join(',')}]'`;
}

/**
 * Resolve the knowledge DB path.
 * Defaults to ./knowledge.db (relative to cwd = agent workspace).
 */
export function resolveDbPath(override?: string): string {
  return override || join(process.cwd(), 'knowledge.db');
}

/**
 * Check if the knowledge DB file exists.
 */
export function dbExists(dbPath: string): boolean {
  return existsSync(dbPath);
}

/**
 * Check if the stoolap binary is installed.
 */
export function stoolapInstalled(): boolean {
  return existsSync(STOOLAP_BIN);
}

/**
 * Execute SQL against a Stoolap DB (DDL/DML, no output expected).
 */
export async function stoolapExec(dbPath: string, sql: string): Promise<void> {
  const proc = Bun.spawn([STOOLAP_BIN, '--db', `file://${dbPath}`, '-e', sql], {
    stdout: 'pipe',
    stderr: 'pipe',
  });

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    throw new Error(`stoolap exec failed (exit ${exitCode}): ${stderr.trim()}`);
  }
}

/**
 * Run a SELECT query and parse the output into rows.
 * Stoolap CLI outputs tab-delimited text with a header row.
 */
export async function stoolapQuery(dbPath: string, sql: string): Promise<Record<string, string>[]> {
  const proc = Bun.spawn([STOOLAP_BIN, '--db', `file://${dbPath}`, '-e', sql], {
    stdout: 'pipe',
    stderr: 'pipe',
  });

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    throw new Error(`stoolap query failed (exit ${exitCode}): ${stderr.trim()}`);
  }

  const stdout = await new Response(proc.stdout).text();
  return parseStoolapOutput(stdout);
}

/**
 * Parse stoolap tabular output into row objects.
 * Expected format: header row with column names, followed by data rows,
 * all delimited by tabs or pipes.
 */
export function parseStoolapOutput(output: string): Record<string, string>[] {
  const lines = output.trim().split('\n').filter(l => l.trim() !== '');
  if (lines.length === 0) return [];

  // Try tab-delimited first, fall back to pipe-delimited
  const delimiter = lines[0].includes('\t') ? '\t' : '|';

  const parseRow = (line: string): string[] =>
    line.split(delimiter).map(cell => cell.trim()).filter(cell => cell !== '');

  const headers = parseRow(lines[0]);
  if (headers.length === 0) return [];

  // Skip separator rows (all dashes/pluses)
  const dataLines = lines.slice(1).filter(l => !/^[-+|]+$/.test(l.trim()));

  return dataLines.map(line => {
    const values = parseRow(line);
    const row: Record<string, string> = {};
    for (let i = 0; i < headers.length; i++) {
      row[headers[i]] = values[i] || '';
    }
    return row;
  });
}

/**
 * Ensure the knowledge DB exists with the correct schema.
 * Idempotent — safe to call multiple times.
 */
export async function ensureSchema(dbPath: string): Promise<void> {
  if (!stoolapInstalled()) {
    throw new Error(`stoolap binary not found at ${STOOLAP_BIN}. Install with: cargo install stoolap --features "cli,semantic"`);
  }
  await stoolapExec(dbPath, SCHEMA_SQL);
}
