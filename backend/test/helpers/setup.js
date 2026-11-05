import { execFileSync } from 'node:child_process';
import pg from 'pg';
import { testDatabaseUrl } from './env.js';

const backendDir = new URL('../../', import.meta.url);

// XQ-09: todolist_test가 없으면 만들고 마이그레이션을 적용한다
export async function globalSetup() {
  const name = new URL(testDatabaseUrl).pathname.slice(1);
  // 이름 검증을 통과한 경우에만 아래 상수 식별자로 DB를 만든다
  if (!name.endsWith('_test')) throw new Error(`테스트 DB 이름이 _test로 끝나야 한다: ${name}`);

  const admin = new URL(testDatabaseUrl);
  admin.pathname = '/postgres';
  const client = new pg.Client({ connectionString: admin.toString() });
  await client.connect();
  try {
    const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [name]);
    if (!rowCount) await client.query('CREATE DATABASE "todolist_test"');
  } finally {
    await client.end();
  }

  // 기존 러너를 재사용한다. 자식 프로세스는 env.js가 바꾼 DATABASE_URL을 상속한다
  execFileSync(process.execPath, ['scripts/migrate.js'], {
    cwd: backendDir,
    stdio: 'inherit',
  });
}
