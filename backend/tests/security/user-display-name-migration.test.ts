import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
vi.mock('../../src/utils/prisma.js', () => ({ default: {} }));
import { collectBackupTables, formatBackupRow, restoreBackupTables } from '../../src/services/admin/backup-tables.js';
const migration = new URL('../../prisma/schema/migrations/20261101130000_add_user_display_name/migration.sql', import.meta.url);
describe('staff display name migration and backups', () => {
  it('preserves current and old backup fields', () => {
    expect(formatBackupRow('User', { id: 'u', displayName: 'José Cruz' }).data).toEqual({ id: 'u', displayName: 'José Cruz' });
    expect(formatBackupRow('User', { id: 'u' }).data).toEqual({ id: 'u' });
  });
  it('does not overwrite names when restoring an older backup', async () => {
    const execute = vi.fn();
    const tx = { $queryRaw: vi.fn().mockResolvedValue([{ column: 'id', type: 'text' }, { column: 'displayName', type: 'text' }]), $executeRaw: execute };
    await restoreBackupTables({ $transaction: async (fn: any) => fn(tx) } as any, { users: [{ id: 'u' }] });
    expect(execute.mock.calls[0][0].text).not.toContain('displayName');
  });
  it('backfills staff and preserves rows on disposable Postgres', async () => {
    const url = process.env.MEGS_DISPOSABLE_TEST_DATABASE_URL;
    if (!url) throw new Error('Set MEGS_DISPOSABLE_TEST_DATABASE_URL to an isolated local test database');
    if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(new URL(url).hostname)) throw new Error('Disposable database must be local');
    const { Client } = await import('pg');
    const client = new Client({ connectionString: url });
    await client.connect();
    try {
      await client.query('BEGIN');
      await client.query('CREATE TEMP TABLE "User" (id text PRIMARY KEY, role text NOT NULL, email text NOT NULL); CREATE TEMP TABLE "ApplicantProfile" ("userId" text, "firstName" text, "lastName" text)');
      await client.query(`INSERT INTO "User" VALUES ('a','ADMINISTRATOR','a@x'),('t','TALENT_ACQUISITION','t@x'),('n','TALENT_ACQUISITION','n@x'),('p','APPLICANT','p@x'),('b','ADMINISTRATOR','b@x'); INSERT INTO "ApplicantProfile" VALUES ('a','  José ',' Cruz  '),('t','  Mei ',''),('p','Applicant','Person'),('b',' ',' ')`);
      await client.query(readFileSync(migration, 'utf8'));
      const users = await client.query('SELECT id, role, email, "displayName" FROM "User" ORDER BY id');
      expect(users.rows.map((r: any) => [r.id, r.displayName])).toEqual([['a','José Cruz'],['b',null],['n',null],['p',null],['t','Mei']]);
      expect(users.rows).toHaveLength(5);
      expect((await client.query('SELECT count(*)::int AS n FROM "ApplicantProfile"')).rows[0].n).toBe(4);

      // Run the real backup SQL on the same temporary tables inside the rollback transaction.
      const tx = {
        $queryRaw: async (sql: any) => (await client.query(sql.text, sql.values)).rows,
        $executeRaw: async (sql: any) => (await client.query(sql.text, sql.values)).rowCount,
      };
      const db = new Proxy({ $transaction: async (fn: any) => fn(tx) }, {
        get(target, key) {
          if (key === '$transaction') return target.$transaction;
          if (key === 'user') return { findMany: async () => (await client.query('SELECT * FROM "User" ORDER BY id')).rows };
          return { findMany: async () => [] };
        },
      });
      const snapshot = await collectBackupTables(db as any);
      expect(snapshot.users.find((row) => row.id === 'a')).toMatchObject({ email: 'a@x', role: 'ADMINISTRATOR', displayName: 'José Cruz' });
      await client.query(`UPDATE "User" SET "displayName" = 'Changed', email = 'changed@x' WHERE id = 'a'`);
      await restoreBackupTables(db as any, { users: snapshot.users });
      expect((await client.query(`SELECT email, role, "displayName" FROM "User" WHERE id = 'a'`)).rows[0])
        .toEqual({ email: 'a@x', role: 'ADMINISTRATOR', displayName: 'José Cruz' });

      await client.query(`UPDATE "User" SET "displayName" = 'Saved name', email = 'changed@x' WHERE id = 'a'`);
      await restoreBackupTables(db as any, { users: [{ id: 'a', email: 'old@x', role: 'ADMINISTRATOR' }] });
      expect((await client.query(`SELECT email, role, "displayName" FROM "User" WHERE id = 'a'`)).rows[0])
        .toEqual({ email: 'old@x', role: 'ADMINISTRATOR', displayName: 'Saved name' });
      expect((await client.query('SELECT count(*)::int AS n FROM "User"')).rows[0].n).toBe(5);
      expect((await client.query('SELECT count(*)::int AS n FROM "ApplicantProfile"')).rows[0].n).toBe(4);
    } finally { await client.query('ROLLBACK'); await client.end(); }
  });
});
