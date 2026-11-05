// SO-11: npm run seed -- dev | load
// 시드 계정은 @example.test 도메인이고, 재실행하면 그 도메인 계정만 지우고 다시 만든다
import { pool, withTransaction } from '../src/db/pool.js';
import { config } from '../src/config.js';
import { hashPassword } from '../src/lib/password.js';
import * as userQueries from '../src/db/user.queries.js';
import * as categoryQueries from '../src/db/category.queries.js';
import * as todoQueries from '../src/db/todo.queries.js';
import * as refreshTokenQueries from '../src/db/refreshToken.queries.js';

const DOMAIN = 'example.test';
// NFR-04: load는 계정 1000개, 사용자당 카테고리 5개(기본 포함)·할일 200개
const MODES = {
  dev: { users: 2, todos: 10, prefix: 'demo' },
  load: { users: 1000, todos: 200, prefix: 'load' },
};
const EXTRA_CATEGORIES = ['업무', '개인', '공부', '운동'];
const HASH_CONCURRENCY = 4; // libuv 스레드 풀 크기와 같게 (9-design.md 3장)

function fail(message) {
  process.stderr.write(`seed: ${message}\n`);
  process.exit(1);
}

const mode = MODES[process.argv[2]];
if (config.nodeEnv === 'production') fail('production에서는 실행하지 않는다');
if (!mode) fail('사용법: npm run seed -- dev | load');
const password = process.env.SEED_PASSWORD;
if (!password || password.length < 15 || password.length > 128)
  fail('SEED_PASSWORD는 15~128자여야 한다(VR-02)');

// 네 상태가 섞이도록 오늘 기준 -30~+29일 시작, 0~6일 기간, 5건 중 1건 완료 (BR-07: start <= end)
function buildTodos(count, categoryIds) {
  return Array.from({ length: count }, (_, i) => {
    const startOffset = (i % 60) - 30;
    return {
      categoryId: categoryIds[i % categoryIds.length],
      title: `할일 ${i + 1}`,
      startOffset,
      endOffset: startOffset + (i % 7),
      completed: i % 5 === 0,
    };
  });
}

async function removeSeedUsers() {
  return withTransaction(async (db) => {
    const ids = await userQueries.listIdsByEmailDomain(db, DOMAIN);
    for (const id of ids) {
      await refreshTokenQueries.deleteAllForUser(db, id); // FK RESTRICT 때문에 사용자보다 먼저
      await todoQueries.removeAllForUser(db, id);
      await categoryQueries.removeAllForUser(db, id);
      await userQueries.remove(db, id);
    }
    return ids.length;
  });
}

async function createUser(n, passwordHash) {
  const no = String(n).padStart(4, '0');
  await withTransaction(async (db) => {
    const user = await userQueries.insert(db, {
      email: `${mode.prefix}${no}@${DOMAIN}`,
      passwordHash,
      name: `${mode.prefix} 사용자 ${no}`,
      timezone: 'Asia/Seoul',
    });
    // BR-03: 기본 카테고리는 사용자와 같은 트랜잭션에서 만든다
    const def = await categoryQueries.insert(db, {
      userId: user.id,
      name: '기본',
      isDefault: true,
    });
    const extras = [];
    for (const name of EXTRA_CATEGORIES) {
      extras.push(await categoryQueries.insert(db, { userId: user.id, name }));
    }
    const categoryIds = [def.id, ...extras.map((c) => c.id)];
    await todoQueries.insertManyRelative(db, user.id, buildTodos(mode.todos, categoryIds));
  });
}

const started = Date.now();
try {
  const removed = await removeSeedUsers();
  for (let n = 1; n <= mode.users; n += HASH_CONCURRENCY) {
    const batch = Array.from(
      { length: Math.min(HASH_CONCURRENCY, mode.users - n + 1) },
      (_, i) => n + i,
    );
    // NFR-06: 사용자마다 따로 해시한다. 해시는 트랜잭션 밖에서 계산한다(DL-08)
    const hashes = await Promise.all(batch.map(() => hashPassword(password)));
    for (const [i, no] of batch.entries()) await createUser(no, hashes[i]);
  }
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  process.stdout.write(
    `seed ${process.argv[2]}: 삭제 ${removed}명, 생성 ${mode.users}명, ${seconds}초\n`,
  );
} finally {
  await pool.end();
}
