// TQ-08: 연결 대상이 _test DB가 아니면 TRUNCATE 전에 중단한다
export async function resetDb(db) {
  const { rows: current } = await db.query('SELECT current_database() AS name');
  if (!current[0].name.endsWith('_test'))
    throw new Error(`_test로 끝나지 않는 DB라 초기화를 중단한다: ${current[0].name}`);

  const { rows } = await db.query(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'schema_migrations'",
  );
  if (!rows.length) return;
  // FK RESTRICT라 한 문장에 모두 나열해야 비워진다
  const list = rows.map((r) => `"${r.tablename}"`).join(', ');
  await db.query(`TRUNCATE TABLE ${list}`);
}
