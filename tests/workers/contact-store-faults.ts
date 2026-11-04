// Test-only D1 boundaries. The underlying operation runs in real workerd/D1.
export function contactStoreFault(database: D1Database, fault: unknown): D1Database {
  if (fault !== 'before' && fault !== 'after') return database;
  const crash = (): never => {
    throw Object.assign(new Error('Simulated contact write boundary failure'), {
      code: 'SIMULATED_CONTACT_WRITE_FAILURE',
    });
  };
  return {
    withSession(constraint: D1SessionBookmark | D1SessionConstraint) {
      const session = database.withSession(constraint);
      return {
        prepare(sql: string) {
          const statement = session.prepare(sql);
          if (!sql.startsWith('UPDATE contact_preparations SET')) return statement;
          return {
            bind(...values: unknown[]) {
              const bound = statement.bind(...values);
              return {
                async run() {
                  if (fault === 'before') return crash();
                  await bound.run();
                  return crash();
                },
              };
            },
          };
        },
      };
    },
  } as D1Database;
}
