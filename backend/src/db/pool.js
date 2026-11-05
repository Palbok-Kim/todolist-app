import pg from 'pg';
import { config } from '../config.js';

// PR-07: DATE(OID 1082)를 JS Date로 바꾸지 않고 'YYYY-MM-DD' 문자열 그대로 받는다
pg.types.setTypeParser(1082, (value) => value);

export const pool = new pg.Pool({ connectionString: config.databaseUrl, max: config.pgPoolMax });
// 유휴 연결이 끊겨도(PostgreSQL 정지) 프로세스가 죽지 않게 한다. 다음 쿼리 실패는 errorHandler가 로그로 남긴다
pool.on('error', () => {});

// DL-08: fn(client)가 던지면 롤백하고 그 오류를 다시 던진다
export async function withTransaction(fn) {
  const client = await pool.connect();
  let broken = false;
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      broken = true; // 롤백도 실패한 연결은 풀에 돌려보내지 않는다
    }
    throw err;
  } finally {
    client.release(broken);
  }
}
