import { pool } from '../db/pool.js';

// SO-14, XQ-04: DB 연결 확인. 실패하면 던지고 errorHandler가 5xx로 바꾼다
export async function checkHealth() {
  await pool.query('select 1');
}
