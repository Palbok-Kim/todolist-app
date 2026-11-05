// --import로 config.js보다 먼저 실행되어 DATABASE_URL을 테스트 DB로 바꾼다 (test/에서 process.env를 만지는 유일한 파일)
// 자식 테스트 프로세스는 이미 바뀐 DATABASE_URL을 상속하므로 원래 값을 따로 물려준다
process.env.ORIGINAL_DATABASE_URL ??= process.env.DATABASE_URL;
export const devDatabaseUrl = process.env.ORIGINAL_DATABASE_URL;
export let testDatabaseUrl = devDatabaseUrl;

if (devDatabaseUrl) {
  const url = new URL(devDatabaseUrl);
  url.pathname = '/todolist_test';
  testDatabaseUrl = url.toString();
  process.env.DATABASE_URL = testDatabaseUrl;
}
process.env.NODE_ENV = 'test';
