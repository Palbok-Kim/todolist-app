// SO-10: migrations/NNN_*.sql을 번호 순서로 한 번씩 적용한다(forward-only, 파일마다 트랜잭션)
import { readdir, readFile } from 'node:fs/promises';
import pg from 'pg';
import { config } from '../src/config.js';

const dir = new URL('../migrations/', import.meta.url);
const client = new pg.Client({ connectionString: config.databaseUrl });
await client.connect();

try {
  await client.query(
    'CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())',
  );
  const { rows } = await client.query('SELECT name FROM schema_migrations');
  const applied = new Set(rows.map((r) => r.name));
  const files = (await readdir(dir)).filter((f) => /^\d{3}_.+\.sql$/.test(f)).sort();

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = await readFile(new URL(file, dir), 'utf8');
    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw new Error(`${file} 적용 실패: ${err.message}`, { cause: err });
    }
    process.stdout.write(`applied ${file}\n`);
  }
  process.stdout.write('migrate: done\n');
} finally {
  await client.end();
}
