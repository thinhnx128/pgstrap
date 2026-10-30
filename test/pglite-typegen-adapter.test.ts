// File: test/pglite-typegen-adapter.test.ts
import { describe, it, expect, vi } from 'vitest';
import { createTypegenIntrospectionClient } from '../src/pglite-typegen-adapter';

describe('createTypegenIntrospectionClient (seveibar/pgstrap#2)', () => {
  it('uses ephemeral in-memory PGlite when generating types without a running Postgres server', async () => {
    const executedSql: string[] = [];
    const mockExecutor = {
      query: vi.fn(async (sql: string) => {
        executedSql.push(sql);
        return { rows: [{ table_name: 'users', column_name: 'id', data_type: 'uuid' }] };
      }),
      close: vi.fn(async () => {}),
    };

    const { executor, mode } = await createTypegenIntrospectionClient({
      migrationsSql: ['CREATE TABLE users (id uuid PRIMARY KEY, email text NOT NULL);'],
      createPGliteInstance: async () => mockExecutor,
    });

    expect(mode).toBe('pglite-memory');
    expect(executedSql).toHaveLength(1);
    const cols = await executor.query('SELECT table_name, column_name, data_type FROM information_schema.columns');
    expect(cols.rows[0].table_name).toBe('users');
    await executor.close();
  });
});
