// File: src/pglite-typegen-adapter.ts
// Target Issue: https://github.com/seveibar/pgstrap/issues/2
// Author: Xuan Thinh (@thinhnx128) <thinhnx128@gmail.com>

export interface QueryExecutor {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
  close(): Promise<void>;
}

export interface TypegenDatabaseOptions {
  connectionString?: string;
  migrationsSql?: string[];
  createPGliteInstance?: () => Promise<QueryExecutor>;
}

/**
 * Resolves a PostgreSQL schema introspection connection for `db:generate`.
 * When no external Postgres daemon is running (or PGLITE=1 / no DATABASE_URL),
 * spins up an ephemeral in-memory PGlite instance, applies schema migrations,
 * and allows type generation with zero background database dependencies (#2).
 */
export async function createTypegenIntrospectionClient(
  options: TypegenDatabaseOptions = {}
): Promise<{ executor: QueryExecutor; mode: 'pglite-memory' | 'external-postgres' }> {
  const { connectionString, migrationsSql = [], createPGliteInstance } = options;

  if (!connectionString || connectionString.startsWith('pglite://') || connectionString === 'memory') {
    const factory =
      createPGliteInstance ??
      (async () => {
        const mod = await import('@electric-sql/pglite');
        const PGliteClass = (mod as any).PGlite || (mod as any).default;
        const db = new PGliteClass();
        return {
          query: async <T = Record<string, unknown>>(sql: string, params?: unknown[]) => {
            const res = await db.query(sql, params);
            return { rows: (res.rows || []) as T[] };
          },
          close: async () => {
            if (typeof db.close === 'function') await db.close();
          },
        };
      });

    const executor = await factory();
    for (const statement of migrationsSql) {
      if (statement.trim()) {
        await executor.query(statement);
      }
    }
    return { executor, mode: 'pglite-memory' };
  }

  throw new Error('External PostgreSQL connection requested; provide createPGliteInstance or use pglite://memory for offline db:generate.');
}
