import { pool } from '../db/pool.js';
import { logger } from '../lib/logger.js';

// SO-14, XQ-04: DB 연결 상태를 돌려준다. 실패 원인은 로그에만 남긴다(SO-07)
export async function checkHealth() {
  try {
    await pool.query('select 1');
    return { status: 'ok', db: 'up' };
  } catch (err) {
    logger.error({ message: '헬스 체크 DB 연결 실패', error: err.message });
    return { status: 'error', db: 'down' };
  }
}
