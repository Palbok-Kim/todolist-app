# TodoList 프로젝트 구조 설계 원칙

## 문서 이력

| 버전 | 일자 | 작성자 | 변경 내용 |
|------|------|--------|-----------|
| 0.1 | 2026-11-04 | MinjeYu | 도메인 정의서 v0.7·PRD v0.5·사용자 시나리오 v0.3·와이어프레임 v0.2 기반 초안 |
| 0.2 | 2026-11-04 | MinjeYu | 위임 결정(2026-11-04) 반영: PQ-01~11 확정, PQ-12 신설(`cookie-parser` 도입, 쿠키 파싱 직접 작성 폐기). PQ-05에 따라 SO-14 확정. PRD v0.6과 일치화(6장 상태 계산 위치) |
| 0.3 | 2026-11-04 | MinjeYu | 아키텍처 다이어그램 AQ-01~10·ERD EQ-01 위임 결정(2026-11-04) 반영: DL-01·DL-02에 routes의 `lib/cookies.js` import 예외(AQ-01), DL-12에 시간대 변경 뒤 무효화(AQ-03), DL-14에 `onUnauthorized` 콜백 연결(AQ-02), DL-08에 카테고리 삭제 행 잠금(AQ-08), SO-07에 FK 위반·uuid 형식 오류의 ERR-05 번역(AQ-08, EQ-01), SO-10 중복 검사 방법을 ERD로 참조, SO-14를 `/api/health`로 통일(AQ-06), SO-16 신설(`trust proxy`, AQ-05), PQ-10에 만료 항목 정리·키 상한(AQ-10), 6장 디렉토리·7장 추적 표 갱신 |
| 0.4 | 2026-11-04 | MinjeYu | 사용자 결정(2026-11-04: JWT HS384 + Refresh Token 적용) 반영, 도메인 정의서 v0.9·PRD v0.8·사용자 시나리오 v0.5·와이어프레임 v0.4와 일치화: DL-05(공개 라우트에 토큰 갱신 추가)·DL-06(액세스 15분)·DL-08(갱신 트랜잭션)·DL-14(single-flight 갱신) 수정, DL-02·SO-03(키 48바이트 이상)·SO-12(쿠키 3종) 수정, SO-17 신설(HS384 고정·리프레시 토큰 저장 규칙), 6장 디렉토리에 `lib/token.js` 확장·`db/refreshToken.queries.js`·`refresh.test.js` 추가, TQ-05에 AC-22~24 자동화, 7장 추적 표, PQ-13·PQ-14 추가. 초기 허용 의존성 변화 없음 확인 |
| 0.5 | 2026-11-04 | MinjeYu | 위임 결정(2026-11-04) 반영(PQ-13·PQ-14 확정), 도메인 정의서 v0.10·PRD v0.9·사용자 시나리오 v0.6·와이어프레임 v0.5와 일치화: DL-05·DL-08·DL-14·SO-03·SO-12·SO-17의 리프레시 세부 가정을 확정으로 전환. SO-06에 로그 `time`을 `Date.now()` 숫자로 명시(8-plan.md XQ-10). 동시 갱신 오판 방지: DL-08(유예 안의 재제출은 거부만), DL-14(갱신 실패 시 원 요청 1회 재전송), SO-17(유예 10초는 `config.js` 설정값, `revoked_at`만으로 판단), TQ-05(유예 안·밖 자동 테스트), PQ-14를 유예 방식으로 변경. SO-12 리프레시 쿠키 `Path`를 인증 API 공통 접두사 하나로 명시, SO-17에 만료 행 정리를 로그인 때로 명시(OI-21) |
| 0.6 | 2026-11-04 | MinjeYu | 문서 간 일치화: 6.2장 services 트리에 `health.service.js` 추가(8-plan.md XQ-04 확정 결정 반영), 6.1장 `docs/` 설명을 현재 문서 구성(문서 1~8, schema.sql)에 맞춤, PQ-02 반영 위치의 버전 표기 제거(PRD 6장) |
| 0.7 | 2026-11-04 | MinjeYu | 사용자 결정(2026-11-04: Docker 미사용) 반영: 개발 환경을 로컬 PostgreSQL 17 + 백엔드 `npm run dev` + Vite 개발 서버 3개 프로세스로 변경. SO-08(로컬 실행 구성)·SO-09(Dockerfile·이미지·bind mount 삭제, `npm ci` 유지)·SO-14(healthcheck 문구 삭제, 기동 확인용)·SO-16(신뢰 범위 `loopback`)·SO-03(`compose.yaml` 문구 삭제)·TQ-08(로컬 서버의 `todolist_test`)·PQ-05·PQ-07 문구 수정, 6.1~6.3장 트리에서 `compose.yaml`·`Dockerfile` 삭제. 2.3장 허용 의존성에 프런트 개발 의존성 `@types/react`·`@types/react-dom` 추가(DL-16). 링크 버전 갱신: PRD v0.10, 아키텍처 다이어그램 v0.7, 8-plan v0.6 |
| 0.8 | 2026-11-04 | MinjeYu | COM-03 진행: 2.3장 허용 의존성에 백엔드·프런트 개발 의존성 `@eslint/js` 추가(DL-16, TQ-10 권장 규칙) |
| 0.9 | 2026-11-04 | MinjeYu | BE-04 진행: SO-01의 `process.env` 허용 위치에 테스트 DB 전환용 `backend/test/helpers/env.js` 추가(TQ-08) |
| 0.10 | 2026-11-05 | MinjeYu | 사용자 결정(2026-11-05) 반영: k6 부하 테스트 제거. TQ-09 삭제(ID 유지), TQ-12·SO-11·디렉토리 구조(`loadtest/` 삭제, `docs/test/` 결과 기록 추가)·추적 표·PQ-11에서 k6 제거 |
| 0.11 | 2026-11-05 | MinjeYu | 사용자 요청(2026-11-05) 반영: SO-14 헬스 응답에 DB 연결 상태(`db: up/down`) 추가, DB 실패는 500 ERR-07 대신 503 |
| 0.12 | 2026-11-05 | MinjeYu | 사용자 결정(2026-11-05) 반영: 프록시 → CORS. SO-08(Vite 프록시 삭제·`strictPort`, `cors.js`, `CORS_ORIGINS`, `VITE_API_BASE_URL`, `credentials: 'include'`)·SO-12(CSRF 쿠키 `Domain`=`COOKIE_DOMAIN`)·SO-16(개발 `TRUST_PROXY` 비움)·SO-02·PQ-07(같은 출처 기본안 폐기, 서브도메인 + CORS) 수정, 2.3장 `cors` 항목을 직접 작성 미들웨어로, `vite` 용도 문구, 6장 트리 `middleware/cors.js`·`vite.config.ts`, 7장 추적 표 |

**표기 범례** (도메인 정의서·PRD·사용자 시나리오·와이어프레임과 같음)
- **확정**: 요구사항 원문 또는 사용자 의사결정(2026-11-04)에 근거한 결정
  - 사용자가 위임한 결정 포함: 사용자가 추천 방향으로 정하도록 맡긴 항목은 출처를 '위임 결정(2026-11-04)'으로 밝힌다
- **가정**: 원문에 없는 잠정 결정. 일단 이대로 구현하고 이해관계자가 확인하면 확정한다
- **미결정**: 결정하기 전에는 구현을 보류한다
- 이 문서에서 원문에 없는 결정은 모두 **가정**이다. 큰 가정과 문서 사이의 공백·모순은 8장(`PQ-xx`)에 모은다

**단일 출처 원칙**: 엔티티 속성·상태 판정·BR·UC·AC는 [도메인 정의서 v0.10](./1-domain-definition.md), FR 우선순위·VR·ERR·NFR·KPI·R은 [PRD v0.10](./2-prd.md), SC는 [사용자 시나리오 v0.6](./3-user-scenario.md), WF는 [와이어프레임 v0.5](./4-wireframe.md)에만 둔다. 이 문서는 규칙 원문을 복사하지 않고 ID로 참조한다. 이 문서에서 새로 만든 ID는 원칙 `PR-xx`(공통), `DL-xx`(의존성·레이어), `CN-xx`(코드·네이밍), `TQ-xx`(테스트·품질), `SO-xx`(설정·보안·운영)와 확인 필요 `PQ-xx`뿐이다.

**범위**: 프로젝트 구조와 코딩 원칙만 정한다. API 명세, DDL, PRD 11장의 구현 세부(scrypt 값, CSRF 토큰 구조, 쿠키 이름·경로, 리프레시 토큰 세부, 로그인 카운터 저장 위치 등)는 설계서에서 정하며 이 문서는 "11장 참조"로만 가리킨다. 원칙은 코드 리뷰나 grep, 린트로 확인할 수 있게 쓴다.

**원칙 표 읽는 법**: 원칙 한 문장, 이유 한 줄, 근거 ID, 구분 순서다. 근거가 없으면 '—'다.

## 1. 모든 스택 공통 최상위 원칙

| ID | 원칙 | 이유 | 근거 | 구분 |
|----|------|------|------|------|
| PR-01 | 규칙의 원문은 문서 1~4에만 두고, 코드·주석·테스트·README는 규칙 문장을 복사하지 않고 FR/BR/NFR/ERR/VR/OI/AC ID로만 가리킨다 | 규칙이 바뀔 때 고칠 곳을 한 곳으로 한다 | 문서 1~4의 단일 출처 원칙 | 가정 (코드 적용) |
| PR-02 | 규칙을 구현한 함수·SQL 조각·검증 상수 바로 위에 `// BR-06` 형식의 ID 한 줄을 남기고, 테스트 이름은 `AC-xx:`·`NFR-xx:`·`BR-xx:`로 시작한다. P0 BR·NFR은 각각 코드 또는 테스트에서 grep으로 1회 이상 찾혀야 한다 | 문서에서 코드로, 코드에서 문서로 양쪽 추적을 가능하게 한다 | KPI-01, KPI-04 | 가정 |
| PR-03 | P0를 먼저 만들고 일정이 밀리면 PRD 8장 컷 라인 순서로 기능 단위로 뺀다. DI 컨테이너, 리포지토리 인터페이스 추상화, 이벤트 버스, 모노레포 툴링, 마이크로서비스, 쓰이지 않는 옵션·feature flag·'나중을 위한' 코드는 넣지 않는다 (package.json과 디렉토리 리뷰로 확인) | 2일·1인 MVP다 | G2, R-01, PRD 8장 | 확정 |
| PR-04 | 인증·보안(NFR-06~10, NFR-15)·데이터 무결성(BR-02, BR-04, BR-07, 입력 검증)·P0 AC 검증은 일정이 밀려도 줄이지 않는다. 줄일 때는 기능을 통째로 빼고 검증이나 방어 코드만 빼지 않는다 | 컷하지 않는 것으로 확정돼 있다 | PRD 8장 컷하지 않는 것 | 확정 |
| PR-05 | 서버가 모든 입력 규칙(BR, VR)의 최종 판정자다. 프런트 검증은 같은 규칙을 사용성 목적으로 반영한 보조이며, 서버 ERR-01의 `fields`를 같은 입력란 아래에 표시하는 경로를 반드시 갖는다. 프런트에만 있는 규칙은 두지 않는다 | 클라이언트 검증은 우회할 수 있다 | PRD 4.1, 4.3, 7장, BR-15 | 확정 |
| PR-06 | 할일 상태는 저장하지 않는다. '오늘' 계산(`getToday`)과 상태 판정 SQL 조각은 각각 서버 한 곳에만 두고, 프런트는 서버가 내려 준 `status`를 표시만 한다 (프런트에 상태 판정 함수가 없어야 한다) | 규칙이 두 곳에 있으면 어긋난다 | 도메인 4장, PRD 6장, R-05 | 확정 (서버 한 곳) / 가정 (프런트 미계산) |
| PR-07 | `startDate`·`endDate`는 DB부터 화면까지 어느 계층에서도 `YYYY-MM-DD` 문자열로만 다루고 `Date` 객체로 바꾸지 않는다. 시각(`*At`)은 UTC `TIMESTAMPTZ`로 저장하고 ISO 8601 문자열로 전달한다 | 시간대 변환으로 캘린더 날짜가 바뀌면 안 된다 | PRD 4.2, 6장, OI-05 | 확정 |
| PR-08 | 모든 오류 응답은 PRD 4.3의 공통 형식이고, 클라이언트는 `error.code`로만 분기한다 (message 문자열 비교 금지) | message 문구는 바뀔 수 있다 | PRD 4.3 | 확정 (형식) / 가정 (code로만 분기) |
| PR-09 | PRD 11장 항목은 설계서의 결정을 근거로 구현하고, 설계서 없이 임의로 정하지 않는다. 확정 전 임시값을 코드에 넣으면 `// 11장 임시` 주석을 단다 | 보안 세부를 즉흥으로 정하지 않기 위함이다 | PRD 11장 | 가정 |

## 2. 의존성·레이어 원칙

### 2.1 백엔드

호출 방향은 `routes → services → db(queries)` 한 방향이다. 미들웨어는 요청 앞뒤에 끼는 별도 줄기이며 service·db를 호출하지 않는다.

| 모듈 | import 허용 | import 금지 |
|------|-------------|-------------|
| `routes/` | `services/`, `errors.js`, `lib/cookies.js`(쿠키 설정·삭제 전용, DL-02) | `db/`, `validation/`, `lib/cookies.js` 외의 `lib/` |
| `services/` | `validation/`, `db/*.queries.js`, `db/pool.js`(`withTransaction`), `lib/`, `errors.js`, `config.js` | `express`, `routes/`, `middleware/`, 다른 `*.service.js` |
| `validation/` | `lib/` (순수 도구만) | `db/`, `express`, `services/` |
| `db/` | `pg`, `config.js`(pool 설정만) | `services/`, `routes/`, `middleware/`, `express`, `errors.js` |
| `middleware/` | `lib/`, `errors.js`, `config.js` | `db/`, `services/` |
| `lib/` | `node:*`, `config.js` | `routes/`, `services/`, `db/`, `middleware/` |
| `scripts/` | `db/*.queries.js`, `db/pool.js`, `lib/`, `config.js` | `routes/`, `services/`, `middleware/` |

| ID | 원칙 | 이유 | 근거 | 구분 |
|----|------|------|------|------|
| DL-01 | 위 의존 표를 지킨다. 특히 `routes/`는 `db/`를 import하지 않고, `db/`는 `services/`를 import하지 않는다. `routes/`가 import할 수 있는 `lib/` 파일은 `cookies.js` 하나뿐이다(DL-02). `backend/eslint.config.js`의 `no-restricted-imports`(디렉토리별 override)로 기계 검증한다 | 레이어가 3개뿐이어도 방향이 섞이면 SQL과 규칙이 흩어진다 | NFR-08, R-06 | 가정 / 확정 (`lib/cookies.js` 예외, 위임 결정(2026-11-04), AQ-01) |
| DL-02 | `routes/`는 HTTP 입출력(요청 값 추출, 상태 코드, 응답 JSON)만 한다. 핸들러는 service 함수를 호출하고 결과를 돌려주며, 규칙 판단·검증·SQL·오류 본문 조립이 없다. 인증(액세스·리프레시)·CSRF 쿠키의 발급·삭제는 service가 돌려준 토큰 문자열로 routes가 `lib/cookies.js`(SO-12)를 호출해 `res`에 설정한다. service는 `res`를 모른다(DL-03) | 규칙을 service 한 곳에서만 찾게 하고, 쿠키 설정 주체를 정한다 | PR-05, PR-08, SO-12 | 가정 / 확정 (쿠키 설정 주체, 위임 결정(2026-11-04), AQ-01) |
| DL-03 | `services/`가 BR 규칙, 검증 호출, 트랜잭션 경계, `AppError` 던지기를 맡는다. `req`/`res`를 모르고 `express`를 import하지 않는다. service는 다른 도메인의 `*.queries.js`는 호출해도 되지만 다른 `*.service.js`는 호출하지 않는다 | HTTP 없이 호출·테스트할 수 있고, 트랜잭션 경계가 한 service 함수 안에 모인다 | BR-02~06 | 가정 |
| DL-04 | SQL은 `src/db/`와 `migrations/`에만 있다 (`SELECT`·`INSERT`·`UPDATE`·`DELETE` 문자열이 그 밖의 `src/`에 없는지 grep). `*.queries.js` 함수의 첫 인자는 `db`(pool 또는 트랜잭션 client)이고, 비즈니스 판단과 `AppError`는 없이 행이나 `null`·빈 배열만 돌려준다. 404 판단은 service가 한다 | SQL 위치를 고정하고, 같은 쿼리를 트랜잭션 안팎에서 재사용한다 | NFR-08, ERR-05 | 가정 |
| DL-05 | 미들웨어는 `src/middleware/`에 두고 `app.js`에서 순서를 고정한다: 요청 로거 → 쿠키·JSON 파서 → 공개 라우트(회원가입·로그인·토큰 갱신·로그아웃·헬스) → `authenticate` → `csrf` → 보호 라우트 → not found → `errorHandler`. 인증을 CSRF보다 먼저 검사한다. 토큰 갱신은 액세스 토큰 없이 리프레시 쿠키로 호출하므로 `authenticate` 앞의 공개 라우트 그룹에 두고 `csrf`도 거치지 않는다 | 인증이 CSRF 식별자의 전제다. 갱신은 만료된 액세스 토큰을 가진 사용자가 부르는 경로라 인증 뒤에 둘 수 없다 | PRD 11장(검사 순서, 위임 결정), BR-01, BR-16, NFR-07, NFR-15 | 확정 (순서, 갱신 위치: 사용자 결정(2026-11-04)의 후속, 위임 결정(2026-11-04)) / 가정 (나머지) |
| DL-06 | `authenticate`는 JWT 서명·만료 검증만 하고 `req.user = { id }`만 채운다. 검증은 `lib/token.js`를 거치며 허용 알고리즘은 HS384 하나다(SO-17). DB는 조회하지 않는다. 시간대 같은 사용자 속성은 토큰에 넣지 않고 필요한 service가 DB에서 읽는다 | 시간대를 바꾸면 바로 반영돼야 한다 (액세스 토큰은 15분 유효하고 갱신 때마다 새로 발급되므로 값이 낡는다) | NFR-07, AC-13 | 가정 |
| DL-07 | `userId`는 `req.user.id`에서만 얻는다. body·params·query의 `userId`는 읽지 않는다 (`req.body.userId`, `req.query.userId` grep 0건). 할일·카테고리 `*.queries.js` 함수는 `userId`를 필수 인자로 받고 모든 `SELECT`·`UPDATE`·`DELETE` 문에 `user_id = $n` 조건을 넣는다. 조회 결과가 없으면 service가 ERR-05를 던진다. 예외는 email로 사용자를 찾는 로그인 조회뿐이다 | 소유권을 DB 조회 단계에서 보장한다 | BR-02, NFR-09, KPI-04, R-06 | 확정 (userId 조건) / 가정 (함수 규약) |
| DL-08 | 트랜잭션은 service에서만 `withTransaction(fn)`으로 연다. 쓰기가 2개 이상이고 한 규칙을 이룰 때 필수다: 회원가입(User + 기본 카테고리 + 리프레시 토큰 행, BR-03), 카테고리 삭제(할일을 기본 카테고리로 이동 + 카테고리 삭제, BR-06), 리프레시 토큰 갱신(해시로 행 `FOR UPDATE` 잠금 → 이전 토큰 폐기 → 새 행 INSERT, BR-16). `*.queries.js`는 `BEGIN`/`COMMIT`을 하지 않는다. scrypt 해시 계산과 새 리프레시 토큰의 무작위 값·SHA-256 해시 계산은 트랜잭션을 열기 전에 끝낸다. 같은 리프레시 토큰으로 동시에 오는 갱신 요청은 행 잠금이 직렬화해 하나만 성공하고, 나머지는 폐기 직후(유예 10초 이내)의 재제출이라 계열을 폐기하지 않고 ERR-02로 거부만 한다. 폐기 후 유예를 넘긴 토큰의 재제출만 재사용 감지(계열 폐기, ERR-02)로 처리한다(판단은 `revoked_at`만 쓴다, SO-17). 카테고리 삭제 트랜잭션은 시작하자마자 대상 카테고리 행을 `FOR UPDATE`로 잠가, 삭제 중인 카테고리로 들어오는 할일 등록·수정이 삭제가 끝난 뒤 FK 위반(SO-07의 ERR-05)이 되게 한다. 삭제 확인 대화상자의 할일 개수는 조회 시점의 안내 값이며 실제 이동 건수와 다를 수 있다(PRD 11장) | 규칙이 중간에 끊겨 할일을 잃는 일을 막고, 커넥션 점유를 줄인다 | BR-03, BR-06, BR-16, AC-01, AC-04, AC-24, NFR-06, NFR-07 | 확정 (BR-03, BR-06 원자성은 가정, 행 잠금은 위임 결정(2026-11-04), AQ-08) / 확정 (갱신 트랜잭션: 사용자 결정(2026-11-04)의 후속, 위임 결정(2026-11-04)) |
| DL-09 | `getToday(timezone, now = new Date())`(`lib/today.js`)와 상태 판정 SQL 조각(`db/todoStatus.js`)을 각각 한 곳에 두고, 목록의 `status` 컬럼과 상태 필터가 같은 조각을 쓴다. service가 `today`를 계산해 쿼리에 바인딩 값으로 넘기고 `*.queries.js`는 시계를 읽지 않는다 | '오늘'과 상태 규칙을 한 곳에 두고 시계 없이도 테스트하게 한다 | 도메인 4장, PRD 6장, R-05, OI-02 | 확정 (한 곳) / 가정 (세부) |
| DL-10 | 목록 정렬은 BR-11의 고정 정렬만 쓴다. 정렬 컬럼·방향처럼 바인딩할 수 없는 SQL 조각은 코드 상수 허용 목록에서만 고르고, `src/db/`의 템플릿 리터럴(`${}`)은 그런 상수 조각을 합칠 때만 쓴다. 요청 값이 들어가면 안 된다 (`${` grep 결과를 리뷰) | SQL 인젝션 방지 | BR-11, NFR-08 | 확정 (바인딩·허용 목록) / 가정 (확인 방법) |

### 2.2 프런트엔드

의존 방향은 `pages → features → (api, components, lib)`이고 `store`는 UI 상태 전용으로 어느 레이어에서나 읽는다.

| 모듈 | import 허용 | import 금지 |
|------|-------------|-------------|
| `pages/` | `features/*`, `components/`, `store/`, `lib/` | `api/`(직접 호출) |
| `features/<domain>/` | `api/`, `components/`, `store/`, `lib/`, 다른 feature의 `queries.ts`(훅) | 다른 feature의 컴포넌트·`api.ts`, `pages/` |
| `components/` | `lib/`, `store/` | `features/`, `api/`, `pages/` |
| `api/` | `lib/` | `features/`, `components/`, `store/`, `pages/` |
| `store/` | `lib/` | `features/`, `api/`, `components/` |
| `lib/` | (외부 import 없음, 순수 함수) | `react`, 위 모든 디렉토리 |

| ID | 원칙 | 이유 | 근거 | 구분 |
|----|------|------|------|------|
| DL-11 | 위 의존 표를 지킨다. `frontend/eslint.config.js`의 `no-restricted-imports`로 기계 검증하고 순환 import를 만들지 않는다 | 화면이 적어도(WF 8개) 방향이 섞이면 데이터 흐름을 추적하기 어렵다 | PR-03 | 가정 |
| DL-12 | 서버에서 온 데이터(User, Category, Todo)는 TanStack Query에만 두고 Zustand에 복사하지 않는다 (`store/`에 `Todo`·`Category`·`User` 타입이 없어야 한다). 쿼리 키와 훅은 `features/<domain>/queries.ts` 한 곳에 두고, 변경(mutation) 성공 뒤에는 관련 쿼리를 `invalidateQueries`로 갱신하며 캐시를 손으로 고치지 않는다. 카테고리 삭제 뒤에는 카테고리와 할일 쿼리를 함께 무효화하고, 시간대 변경 성공 뒤에는 사용자 쿼리와 할일(목록·캘린더) 쿼리를 함께 무효화한다 | 서버 상태의 복사본이 둘이면 어긋난다. 캐시된 `status`는 시간대가 바뀌면 낡는다 | PRD 6장, BR-06, AC-13 | 확정 (역할 분리, 시간대 변경 뒤 무효화는 위임 결정(2026-11-04), AQ-03) / 가정 (갱신 방식) |
| DL-13 | Zustand는 서버에 없는 UI 상태만 담는다: 상단 알림(WF-00), 모바일 메뉴 열림, 목록 필터(카테고리·상태, WF-03), 캘린더 보기 모드·기준일·모바일 선택일(WF-05·06). 폼 입력값은 컴포넌트 로컬 `useState`에 두고 Zustand에 넣지 않는다 | 필터와 캘린더 위치를 store에 두면 편집 화면에서 돌아와도 유지된다 | WF-03, WF-04, WF-05 | 가정 |
| DL-14 | `fetch`는 `api/client.ts` 한 곳에서만 호출한다 (`fetch(` grep이 그 파일에서만 나온다). 여기서 쿠키 전송, 상태 변경 요청의 CSRF 헤더, 응답 파싱, `ApiError` 변환, ERR-02 처리(토큰 갱신 시도, 실패 시 로그인 화면 이동과 만료 안내)를 맡되, `api/`는 `store/`·router를 import하지 못하므로(2.2장 표) `onUnauthorized` 콜백 등록 함수만 노출한다. 보호 API가 ERR-02(액세스 토큰 만료)를 받으면 토큰 갱신을 한 번만 시도하고, 그 사이 ERR-02를 받은 다른 요청은 진행 중인 갱신 하나를 공유한다(single-flight, 모듈 안의 진행 중 Promise 하나). 갱신이 성공하면 원 요청을 한 번만 다시 보낸다. 갱신이 ERR-02로 실패해도 원 요청을 한 번만 다시 보낸다(쿠키는 브라우저 탭 간에 공유되어 다른 탭이 받은 새 쿠키가 이미 있을 수 있다). 갱신 요청 자체와 다시 보낸 요청은 ERR-02여도 재시도하거나 다시 갱신하지 않고 `onUnauthorized` 콜백을 호출한다. `main.tsx`가 콜백에 `alertStore`(만료 안내)와 router(로그인 화면 이동)를 연결한다. `main.tsx`·`App.tsx`는 앱 조립 파일이라 2.2장 표의 대상이 아니다. 엔드포인트별 함수는 `features/<domain>/api.ts`에 두고 컴포넌트는 `queries.ts`의 훅만 쓴다 | 인증·CSRF 처리를 한 곳에 모으고 `api/`의 의존 방향을 지킨다. 동시 요청이 각자 갱신하면 폐기된 토큰의 재제출이 생기므로 갱신을 한 곳에서 하나로 모은다. 여러 탭의 경합은 서버의 유예 시간(SO-17)과 이 재전송이 함께 막는다 | NFR-07, NFR-15, ERR-02, SC-03, SC-16, WF-01, R-14 | 가정 (구조) / 확정 (콜백 연결, 위임 결정(2026-11-04), AQ-02) / 확정 (single-flight 갱신과 갱신 실패 시 원 요청 1회 재전송: 사용자 결정(2026-11-04)의 후속, 위임 결정(2026-11-04)) |
| DL-15 | `pages/`는 WF 1개당 파일 1개이고 훅 호출과 feature 컴포넌트 배치만 한다. 규칙·검증·변환 로직을 두지 않는다 | 화면과 와이어프레임을 1:1로 찾게 한다 | 와이어프레임 1장 | 가정 |

### 2.3 외부 의존성 추가 기준

| ID | 원칙 | 이유 | 근거 | 구분 |
|----|------|------|------|------|
| DL-16 | 의존성은 표준 라이브러리·브라우저 기본 기능으로 안 될 때만 추가한다. 추가할 때 이름과 이유 한 줄을 이 문서 아래 표에 적는다. 표에 없는 패키지가 `package.json`에 있으면 리뷰에서 막는다 | 의존성은 보안·유지 비용이다 | PR-03, NFR-06, NFR-08 | 가정 |

**초기 허용 의존성** (이 목록 밖은 DL-16에 따라 추가한다)

| 영역 | 패키지 | 이유 (한 줄) |
|------|--------|--------------|
| 백엔드 | `express` | 확정 스택 (PRD 6장) |
| 백엔드 | `pg` | 확정 스택, 파라미터 바인딩 (NFR-08) |
| 백엔드 | `cookie-parser` | 인증 쿠키 파싱을 직접 쓰면 파싱 실수가 곧 보안 결함이 된다 (NFR-07, PQ-12) |
| 백엔드 | `jsonwebtoken` | JWT 서명·검증을 직접 구현하면 검증 실수 위험이 크다. HS384는 이 패키지의 `algorithm`·`algorithms` 옵션으로 쓴다 (NFR-07) |
| 백엔드 개발 | `eslint`, `prettier` | 레이어 규칙 기계 검증과 포맷 (TQ-10) |
| 백엔드·프런트 개발 | `@eslint/js` | TQ-10의 ESLint 권장 규칙(`js.configs.recommended`)이 ESLint 9부터 별도 패키지다 (TQ-10) |
| 프런트 | `react`, `react-dom`, `typescript`, `zustand`, `@tanstack/react-query` | 확정 스택 (PRD 6장) |
| 프런트 | `react-router` | 화면 8개, 인증 가드, 뒤로 가기를 직접 구현하지 않기 위함 |
| 프런트 개발 | `@types/react`, `@types/react-dom` | React 19는 타입 정의를 포함하지 않아 TypeScript 컴파일(`tsc --noEmit`)에 필요하다 (PRD 6장 TypeScript) |
| 프런트 개발 | `vite`, `@vitejs/plugin-react` | 개발 서버 제공 (PRD 6장), 설정이 적다 |
| 프런트 개발 | `vitest` | Vite 설정을 공유해 TS 순수 함수를 바로 테스트 (TQ-06) |
| 프런트 개발 | `eslint`, `typescript-eslint`, `eslint-plugin-react-hooks`, `prettier` | 훅 규칙 위반·레이어 규칙 검증 (TQ-10) |

사용자 결정(2026-11-04)(HS384, Refresh Token)으로 추가하는 패키지는 없다. 리프레시 토큰의 무작위 값과 SHA-256 해시는 `node:crypto`(`randomBytes`, `createHash`)로 만들고, HS384 서명은 이미 허용된 `jsonwebtoken`이 지원하므로 의존성 목록은 바뀌지 않는다 (DL-16).

**도입하지 않는 것과 대체 수단**: `bcrypt`(NFR-06이 금지, `node:crypto`의 scrypt), `dotenv`(`node --env-file`), `nodemon`(`node --watch`), `supertest`·`jest`(`node:test`와 내장 `fetch`), `cors`(`middleware/cors.js` 직접 작성, 허용 출처 목록 하나와 사전 요청 응답이면 충분하다. SO-08), `axios`(`fetch`), `zod`·`react-hook-form`(폼 4개라 `features/*/validation.ts` 직접 작성), `date-fns`·`dayjs`(문자열과 `Intl`로 충분, 캘린더 라이브러리는 R-02에 따라 Day 2 오전에 판단하고 도입하면 이 표에 이유를 적는다), UI 킷·CSS-in-JS(Vite 기본 CSS Modules), 분석·로깅 SaaS(PRD 3장 범위 외).

## 3. 코드·네이밍 원칙

| ID | 원칙 | 이유 | 근거 | 구분 |
|----|------|------|------|------|
| CN-01 | 백엔드 파일은 `<domain>.<layer>.js`(`todo.routes.js`, `todo.service.js`, `todo.queries.js`, `todo.validation.js`)로 짓고, 그 밖의 모듈은 `camelCase.js`로 짓는다. 프런트는 컴포넌트 `PascalCase.tsx`, 훅 `useXxx.ts`, 나머지 `camelCase.ts`로 짓는다. 도메인 디렉토리 이름은 단수 소문자 `user`·`category`·`todo`이고 도메인 정의서 엔티티 이름과 같다 | 파일 이름만으로 도메인과 레이어를 안다 | 도메인 3장 | 가정 |
| CN-02 | 함수·변수는 `camelCase`, 상수는 `UPPER_SNAKE_CASE`, 컴포넌트·타입은 `PascalCase`로 쓴다. 함수 이름은 동사로 시작한다. query 함수 이름은 `findById`, `listByUser`, `insert`, `update`, `remove`처럼 짓고 `import * as todoQueries from ...` 형태로 가져와 호출 지점에서 도메인이 보이게 한다 | 호출 지점만 봐도 어느 계층인지 안다 | — | 가정 |
| CN-03 | DB 테이블은 복수 `snake_case`(`users`, `categories`, `todos`), 컬럼은 `snake_case`다. 날짜 컬럼은 `*_date`(`DATE`), 시각 컬럼은 `*_at`(`TIMESTAMPTZ`), 불리언은 `is_*` 또는 `completed`로 쓴다. 인덱스는 `idx_<table>_<cols>`, 유니크는 `uq_<table>_<cols>`, 체크는 `ck_<table>_<rule>`로 짓는다 | 이름만으로 날짜와 시각을 구분한다 | PRD 6장 날짜 처리, PR-07 | 가정 |
| CN-04 | snake_case↔camelCase 변환은 `*.queries.js`의 SQL 별칭(`start_date AS "startDate"`)에서만 한다. 엔티티별 컬럼 목록 상수(예: `TODO_COLUMNS`)로 재사용한다. 반대 방향은 파라미터 바인딩 자리에서 명시적으로 쓴다. `services/` 이상과 API JSON, 프런트 코드에는 snake_case 식별자가 없다 (`src/`에서 `db/` 밖 snake_case grep) | 변환 지점을 한 곳으로 한다 | PRD 4.3, 6장 | 가정 |
| CN-05 | ERR 코드는 `backend/src/errors.js`에 `ERR.VALIDATION_ERROR`처럼 상수로 정의한다. 값은 PRD 4.3의 `code` 문자열과 HTTP 상태이고 각 상수 위에 `// ERR-01` 주석을 단다. 서비스는 `throw new AppError(ERR.NOT_FOUND, message)` 형태로 던지고, `errors.js` 밖에 code 문자열 리터럴을 쓰지 않는다 (`'VALIDATION_ERROR'` 등 grep 0건). 프런트는 `api/errorCodes.ts`에 같은 문자열 상수를 두고 `error.code`와 비교한다 | 문서와 코드의 코드 값을 한 곳에서 맞춘다 | PRD 4.3, PR-08 | 가정 (상수 위치) |
| CN-06 | 필드 이름으로 타입을 구분한다: `*Date`는 `YYYY-MM-DD` 문자열(`startDate`, `endDate`, 캘린더 범위), `*At`은 ISO 8601 UTC 문자열(`createdAt`, `updatedAt`, `completedAt`). 프런트 타입은 `api/types.ts`의 `DateString`·`IsoTimestamp` 별칭을 쓴다. `new Date(` 호출은 `lib/date.ts`(프런트)와 `lib/today.js`(백엔드)에만 있다. 날짜 값끼리 비교는 형식을 검증한 뒤 문자열 비교로 하고, 날짜 계산(월 그리드, 주 시작)은 `lib/date.ts`에서 UTC 기준으로만 한다 | 날짜가 시간대로 밀리는 오류를 막는다 | PRD 4.2, 6장, OI-05 | 확정 (구분) / 가정 (구현 규칙) |
| CN-07 | 시각 값을 표시할 때는 `lib/date.ts`의 한 함수가 사용자의 `timezone`으로 변환한다 (`Intl.DateTimeFormat`). 화면에 시각을 표시하는 곳은 WF-04의 '마지막 수정' 하나뿐이다 | 시각 표시 규칙을 한 곳에 둔다 | PRD 4.2, WF-04 | 확정 (표시 위치) / 가정 (구현) |
| CN-08 | 검증 오류의 `fields` 키는 API 필드 이름(camelCase, 예: `currentPassword`)을 그대로 쓰고 프런트 폼 필드 이름과 같게 한다. 서버 `message`와 `fields[].message`는 한국어이며 프런트는 그대로 표시한다 | 필드 매핑 코드를 없앤다 | PRD 4.3, 4.4, 7장 | 가정 |
| CN-09 | 할일 상태 값은 `backend/src/db/todoStatus.js`의 상수(`NOT_STARTED`, `IN_PROGRESS`, `COMPLETED`, `OVERDUE`)로 정의하고, 한국어 표시는 프런트 `features/todo/statusLabel.ts` 한 곳에서 매핑한다. 값 이름은 API 설계서에서 확정한다 | 상태 이름과 표시 문구를 분리한다 | 도메인 4장, WF-03 | 가정 |
| CN-10 | 주석은 한국어로, 코드가 말해 주지 않는 이유만 한 줄 쓴다. 규칙을 구현한 곳은 PR-02의 ID 한 줄이면 충분하며 규칙 문장을 복사하지 않는다. 알려진 한계는 `// LIMIT: <한계>, <언제 바꾸는지>` 한 줄로 남긴다 (`LIMIT:` grep으로 목록화) | 주석이 규칙의 두 번째 출처가 되지 않게 한다 | PR-01 | 가정 |
| CN-11 | 모듈은 named export만 쓴다 (설정 파일 제외). 백엔드는 ESM(`"type": "module"`)이고 상대 경로에 `.js` 확장자를 붙인다. 순환 import는 만들지 않는다 | import 이름을 일관되게 하고 순환을 막는다 | — | 가정 |

## 4. 테스트·품질 원칙

| ID | 원칙 | 이유 | 근거 | 구분 |
|----|------|------|------|------|
| TQ-01 | 백엔드 테스트 러너는 Node 내장 `node:test`와 `node:assert`이고 HTTP 호출은 내장 `fetch`로 한다. `app.js`가 Express 앱을 export하고 테스트가 `listen(0)`으로 띄운다. `jest`·`supertest`는 쓰지 않는다 | 추가 의존성이 없고 ESM과 바로 맞는다 | PR-03, DL-16 | 가정 |
| TQ-02 | 서버 규칙(BR, VR), 상태 판정, 소유권, 인증·CSRF는 실제 PostgreSQL 17 테스트 DB에 붙는 API 통합 테스트로 검증한다. DB와 service는 mock하지 않는다. 순수 함수(`validation/`, `getToday`, `password` 포맷)만 단위 테스트로 둔다 | 핵심 위험이 SQL과 소유권 조건이므로 실제 쿼리를 돌려야 한다 | R-06, NFR-08, NFR-09 | 가정 |
| TQ-03 | 시계를 mock하지 않는다. 상태 경계 테스트는 `today`를 `getToday`로 구해 상대 날짜(`today-1`, `today`, `today+1`)로 데이터를 만든다. 시간대 변경(AC-13)은 항상 날짜가 하루 이상 어긋나는 두 시간대(`Pacific/Kiritimati`, `Pacific/Pago_Pago`)로 검증한다. `getToday`는 `now`를 인자로 받으므로 고정 시각 단위 테스트도 따로 둔다 | 실행 시각과 상관없이 같은 결과가 나온다 | AC-07, AC-08, AC-13, R-05 | 가정 |
| TQ-04 | 소유권은 사용자 2명 교차 테스트로 검증한다. 할일·카테고리의 모든 ID 기반 엔드포인트와 목록·캘린더 조회, categoryId 지정(등록·수정·필터)이 대상이며, 다른 사용자 ID는 없는 ID와 같은 ERR-05여야 한다. 엔드포인트를 추가하면 같은 파일(`ownership.test.js`)에 케이스를 추가한다 | 데이터 노출 0건이 KPI다 | BR-02, KPI-04, AC-09, SC-15 | 확정 (교차 테스트) / 가정 (파일 규약) |
| TQ-05 | 2일 안에 반드시 자동화하는 범위(통합 테스트): AC-01, 02, 05, 06, 07, 08, 09, 10, 13, 14, 15, 16, 17, 22, 23, 24, AC-12의 API 부분(기간 조회에 시작~종료 모든 날짜 포함), NFR-06(73자 이상 끝 글자 구분, 공백 비제거), NFR-07(만료·위조 토큰은 ERR-02, HS384가 아닌 알고리즘·`none` 토큰 거부, 48바이트 미만 키로 기동 거부, 같은 리프레시 토큰의 동시 갱신 2건 중 1건만 성공하고 패자 뒤에도 승자의 새 토큰으로 갱신 성공, 폐기 후 10초 이내의 재사용은 계열 유지·10초 초과(테스트가 `revoked_at`을 직접 과거로 갱신)의 재사용은 계열 폐기, DB에 리프레시 원문 없음), NFR-08(인젝션 문자열), NFR-10(IP·계정 제한, 성공은 미집계, 운영 설정에서 IP 예외 거부), NFR-15(헤더 없음·서명 변조·다른 JWT는 ERR-08, 로그아웃은 CSRF 없이 성공, 갱신 뒤 새 CSRF 토큰으로 성공). P1을 구현하면 해당 AC-03, 04, 18~21도 자동화한다. 자동화하지 않고 수동 체크리스트로만 확인하는 범위: UI 동작(AC-11 확인 취소, 프런트 single-flight 갱신(AC-22의 화면 부분), 월간·주간 화면 표시, 필터 UI), NFR-12(360 / 768 / 1280px), NFR-13 스모크, PRD 4.2의 서버·브라우저 시간대 변경 검증 | 2일 안에 위험이 큰 서버 규칙을 먼저 자동화하고 화면은 사람이 본다 | KPI-01, PRD 8장 | 가정 (범위 분할) |
| TQ-06 | 프런트 자동 테스트는 Vitest로 순수 함수만 둔다(`lib/date.ts`, `features/*/validation.ts`, `features/calendar`의 그리드 계산). 컴포넌트 테스트와 E2E는 자동화하지 않고 수동 체크리스트로 대신한다. 프런트와 백엔드 검증 단위 테스트는 같은 경계값(VR의 최소·최대 길이)을 쓴다 | 프런트 규칙 중복(PR-05)의 불일치를 경계값 테스트로 막는다 | PRD 4.1, NFR-12 | 가정 |
| TQ-07 | 테스트 이름은 `AC-xx: …` 형식이고 하나의 케이스가 여러 ID를 다루면 `AC-07, BR-11: …`처럼 쉼표로 이어 쓴다. 수동 체크리스트(`docs/test/manual-checklist.md`)는 P0 AC 전부를 한 줄씩 담고, 자동 테스트가 있는 AC는 테스트 파일 위치를 적어 KPI-01을 한 곳에서 측정한다 | KPI-01을 AC 단위로 판정한다 | KPI-01, PR-02 | 확정 (AC별 체크리스트) / 가정 (파일 위치) |
| TQ-08 | 통합 테스트는 로컬 PostgreSQL 서버(SO-08)의 별도 database(`todolist_test`)에 붙는다. 테스트 시작 시 `migrations/`를 적용하고 각 테스트 파일 전에 `TRUNCATE`한다. 연결 대상 database 이름이 `_test`로 끝나지 않으면 `TRUNCATE` 전에 중단한다 | 개발 데이터를 지우는 사고를 막는다 | NFR-04 | 가정 |
| TQ-09 | 삭제: 사용자 결정(2026-11-05)으로 k6 부하 테스트를 제거했다. ID는 재사용하지 않는다 | — | NFR-01~03, NFR-16, KPI-02 | 삭제 |
| TQ-10 | ESLint(권장 규칙 + 프런트는 `typescript-eslint`·`react-hooks`)와 Prettier를 쓰고 Prettier 설정은 루트 `.prettierrc` 하나다. ESLint에 `no-restricted-imports`(DL-01, DL-11)와 `no-console`(`lib/logger.js` 제외, SO-06)을 넣는다. 린트 오류 0건과 `prettier --check` 통과를 커밋 전 조건으로 한다. git hook·CI는 도입하지 않는다 | 레이어 규칙을 사람이 아닌 도구가 확인한다 | PR-03 | 가정 |
| TQ-11 | 커버리지는 수치 목표를 두지 않고 TQ-05 범위를 기준으로 한다. `node --test --experimental-test-coverage`로 측정만 한다 | 2일 안에 숫자 맞추기보다 위험 범위를 먼저 덮는다 | PRD에 수치 없음 | 가정 |
| TQ-12 | 코드 리뷰 체크리스트(R-06)는 이 문서의 검증 문장으로 구성한다: DL-01(import 방향), DL-04(`src/db/` 밖 SQL grep), DL-07(`user_id` 조건 누락, `req.body.userId`), DL-10(`${` 사용), CN-04(snake_case), CN-05(code 리터럴), SO-06(로그 금지 값). 실행 명령(`npm test`, `npm run lint`, `npm run format:check`, 마이그레이션, 시드)은 `README.md`에 한 곳으로 모은다 | 보안 실수를 사람 기억에 맡기지 않는다 | R-06, NFR-08, NFR-09 | 가정 |

## 5. 설정·보안·운영 원칙

| ID | 원칙 | 이유 | 근거 | 구분 |
|----|------|------|------|------|
| SO-01 | 환경 변수는 `backend/src/config.js`에서만 읽는다 (`process.env` grep이 그 파일과 `scripts/`, 테스트 DB로 전환하는 `backend/test/helpers/env.js`(TQ-08)에서만 나온다). 시작할 때 필수 값·형식을 검증하고 실패하면 프로세스를 종료한다. pg 풀 크기 등 조정 값도 여기서 설정값으로 노출한다 | 설정 누락을 기동 때 발견한다 | NFR-05 | 가정 |
| SO-02 | `.env`는 `.gitignore`에 넣고, 키 이름과 안전한 예시 값만 담은 `.env.example`을 루트에 커밋한다. 비밀 값은 커밋하지 않는다 (`git ls-files`에 `.env.example` 외 `.env*` 없음). 프런트 `VITE_*` 변수는 번들에 노출되므로 비밀을 넣지 않는다 (API 기준 주소 `VITE_API_BASE_URL`은 공개 값이다. SO-08) | 비밀 유출 방지 | NFR-07, NFR-15 | 가정 |
| SO-03 | JWT·CSRF 서명 키 같은 비밀은 코드에 값을 직접 쓰지 않고 `.env`로만 주입한다. `.env.example`의 값은 `change-me`를 반복해 48자 이상으로 만든 자리표시자이고, `production`에서 자리표시자이면 기동을 거부한다. JWT 서명 키(HS384)는 어느 환경에서든 48바이트(384비트) 미만이면 기동을 거부한다. 키 관리 세부는 11장을 따른다 | 기본 키로 운영되는 사고와 짧은 키로 HS384 서명을 쓰는 사고를 막는다 (자리표시자를 48자 이상으로 하는 이유는 개발·테스트 환경이 길이 검사에 막히지 않게 하기 위함) | NFR-07, NFR-15, R-13, PRD 11장 | 확정 (HS384: 사용자 결정(2026-11-04), 키 길이: 위임 결정(2026-11-04)) / 가정 (검사 위치) |
| SO-04 | `NODE_ENV`는 `development` / `test` / `production`만 허용하고 그 밖은 기동을 거부한다. 환경별 차이는 `config.js`의 플래그(예: 쿠키 `Secure`)로만 두고 다른 파일에서 `NODE_ENV`를 분기하지 않는다 (grep). `production`에서는 HTTPS 쿠키 `Secure`를 켠다 | 환경 분기가 코드 곳곳에 퍼지는 것을 막는다 | NFR-07, NFR-09 | 확정 (Secure 요구) / 가정 (구조) |
| SO-05 | NFR-10의 테스트 IP 예외는 기본적으로 구현하지 않는다. 격리 테스트 환경에 꼭 필요해지면 `test`에서만 읽는 설정으로 두고 `production`에서 그 설정 값이 있으면 `config.js`가 기동을 거부한다. 구현 방식은 11장을 따르며 이 가드는 TQ-05의 테스트로 확인한다 | 운영에서 켤 수 없어야 한다 | NFR-10, PRD 11장 | 확정 (원칙적 예외 금지, 운영 불가) / 가정 (가드 방식) |
| SO-06 | 로그는 한 줄 JSON을 stdout으로 내보내는 `lib/logger.js` 하나로만 쓴다 (`console.*`는 그 파일 밖에서 린트 오류). 요청 로그는 `time`(`Date.now()`의 epoch 밀리초 숫자, `new Date(` 없이 CN-06을 지킨다. 8-plan.md XQ-10), `level`, `method`, `path`, `status`, `userId`, `durationMs`만 담고, 서버 오류는 요청 정보와 함께 `err.message`·`err.stack`을 남긴다. 평문 비밀번호, 토큰, 쿠키, `Authorization` 헤더, 요청 body 통째는 어떤 로그에도 넣지 않는다. 프런트도 비밀번호·토큰을 `console`로 출력하지 않는다 | 로그를 통한 비밀 유출 방지 | NFR-06, NFR-11 | 확정 (남길 것, 금지 값, `time` 값: 위임 결정(2026-11-04)) / 가정 (형식) |
| SO-07 | 응답에 내부 정보를 넣지 않는다. 오류 응답은 `errorHandler` 한 곳에서만 만들고, 알 수 없는 예외는 ERR-07의 고정 문구로 바꾼다. 스택, SQL 문, pg 오류 메시지, 파일 경로는 응답에 들어가지 않는다. pg 오류 코드는 service가 번역한다(유니크 위반은 ERR-04, 카테고리 FK 위반은 ERR-05). uuid 형식이 아닌 경로·본문의 ID는 DB에 보내기 전에 ERR-05로 응답해 pg 형식 오류가 ERR-07로 새지 않게 한다(7-erd.md EQ-01). 로그인 실패는 email 존재 여부와 상관없이 ERR-03의 같은 문구다 (응답 시간 처리는 11장) | 내부 정보 노출을 막는다 | NFR-11, ERR-03, ERR-07, AC-14, BR-02 | 확정 (FK 위반·uuid 형식 오류의 ERR-05 번역은 위임 결정(2026-11-04), AQ-08, EQ-01) |
| SO-08 | 로컬 실행 구성은 프로세스 3개다: 로컬에 직접 설치한 PostgreSQL 17(`localhost:5432`, 외부에 노출하지 않고 localhost만 연다), 백엔드 node(`backend/`에서 `npm run dev` = `node --watch --env-file-if-exists=../.env src/server.js`, 포트 3000, 루트 `.env`를 읽는다), Vite 개발 서버(`frontend/`에서 `npm run dev`, 포트 5173, `strictPort: true`로 출처 고정). 화면↔API는 CORS다(사용자 결정(2026-11-05)): 브라우저가 `http://localhost:5173`에서 `http://localhost:3000/api`를 직접 호출하고 Vite `/api` 프록시는 없다. 백엔드 `middleware/cors.js`(직접 작성, 요청 로거 다음·파서·인증·CSRF 앞)가 `CORS_ORIGINS`(쉼표 구분 정확한 출처, `*`·경로·끝 슬래시는 기동 거부, 개발 기본 `http://localhost:5173`, production 필수)에 있는 출처에만 `Access-Control-Allow-Origin`(그 출처)·`Allow-Credentials: true`를 붙이고 항상 `Vary: Origin`을 둔다. 사전 요청은 인증·CSRF 전에 204로 끝낸다. 쿠키 인증이라 `*`는 쓰지 않는다. 프런트는 `VITE_API_BASE_URL`(개발 기본 `http://localhost:3000/api`)로 호출하고 `fetch`에 `credentials: 'include'`를 쓴다. localhost 쿠키는 포트와 무관하게 공유되고 같은 사이트라 SameSite가 그대로 동작한다. 허용 헤더·메서드·`Max-Age`는 설계서를 따른다. 기동 순서(DB 먼저)는 따로 보장하는 장치를 만들지 않고 README의 실행 순서로만 안내한다 | 같은 출처로 CORS·쿠키 설정을 단순하게 하고 로컬 설정을 줄인다 | PRD 6장 개발 환경, NFR-07 | 확정 (사용자 결정(2026-11-04): Docker 미사용) / 가정 (세부) |
| SO-09 | 의존성은 `backend/`와 `frontend/` 각각 `package-lock.json`을 커밋하고 `npm ci`로 설치한다. 운영 배포 구성·HTTPS 종단은 이 문서의 범위 밖이다 (PQ-07) | 재현 가능한 설치 | OI-12 | 확정 (Docker 관련 내용 삭제: 사용자 결정(2026-11-04): Docker 미사용) / 가정 (`npm ci`) |
| SO-10 | DDL은 `backend/migrations/NNN_<설명>.sql`에만 쓰고 앱 코드에 `CREATE`·`ALTER`를 두지 않는다. 파일은 번호 순서로 한 방향(forward-only)으로 적용하고 적용된 파일은 고치지 않고 새 파일로 바꾼다. 러너 `backend/scripts/migrate.js`가 `schema_migrations` 표에 적용 기록을 남기고 파일마다 트랜잭션으로 실행한다. DB가 보장할 수 있는 불변식은 제약으로도 둔다: 날짜 순서(BR-07), 카테고리 이름 중복(BR-14, 방법은 7-erd.md EQ-03), 사용자당 기본 카테고리 1개. 할일·카테고리 표에는 `user_id`로 시작하는 인덱스를 만든다 | 스키마 변경을 재현하고 검증을 DB에서도 한 번 더 막는다 | NFR-05, BR-07, BR-14, PRD 11장 | 가정 (러너·제약 방침) / 확정 (인덱스 요구) |
| SO-11 | 시드는 `backend/scripts/seed.js` 하나에 `dev`(데모 사용자 2명과 소량 데이터)와 `load`(계정 1000개, 사용자당 할일 200개·카테고리 5개) 두 모드를 둔다. `NODE_ENV=production`이면 실행을 거부한다. 비밀번호는 `lib/password.js`로 사용자마다 따로 해시하고 기본 카테고리를 만들어(BR-03) 규칙을 우회하지 않는다. 시드 email은 `@example.test` 도메인이고 재실행하면 그 도메인 계정만 지우고 다시 만든다. 시드 계정 비밀번호는 환경 변수로 받는다 | 부하 데이터를 재현 가능하게 만든다 | NFR-04, NFR-06, BR-03 | 확정 (데이터 규모) / 가정 (스크립트 방식) |
| SO-12 | 쿠키 속성(`HttpOnly`, `SameSite`, `Secure` 조건, `Path`, `Max-Age`)은 `lib/cookies.js` 한 곳에서 정한다. 액세스 쿠키는 `SameSite=Lax`, 리프레시 쿠키는 `SameSite=Strict`에 `Path`를 갱신·로그아웃 경로를 모두 포함하는 인증 API 공통 접두사 하나로 한정하고(그 접두사 아래의 다른 요청에도 전송되지만 쓰지 않는다, 구체 경로는 설계서), CSRF 쿠키는 `HttpOnly`가 아니고, 화면(다른 서브도메인) JS가 읽어야 하므로 `COOKIE_DOMAIN`(상위 도메인, 개발은 비움, production 필수)을 `Domain`으로 붙인다. 액세스·리프레시 쿠키는 `Domain` 없이 API 호스트 전용이다. JWT와 리프레시 토큰(무작위 값, SHA-256 해시)은 `lib/token.js`, CSRF 토큰은 `lib/csrfToken.js`에서만 만든다. 이름과 구조는 11장을 따른다. 서명 비교는 `node:crypto`의 `timingSafeEqual`을 쓴다 | 보안 코드를 한 곳에 모아 리뷰한다 | NFR-07, NFR-15, PRD 11장 | 확정 (속성, 리프레시 쿠키 속성: 사용자 결정(2026-11-04)의 후속, 위임 결정(2026-11-04)) / 가정 (위치) |
| SO-13 | 모든 SQL은 `$1, $2` 바인딩과 values 배열로 실행한다. 사용자 입력을 SQL 문자열에 이어 붙이지 않는다 (DL-10) | SQL 인젝션 방지 | NFR-08 | 확정 |
| SO-14 | `GET /api/health`는 인증 없이 `select 1`을 실행해 DB 연결 상태를 돌려준다. 정상은 200 `{ "status": "ok", "db": "up" }`, DB 실패는 503 `{ "status": "error", "db": "down" }`이고 실패 원인은 서버 로그에만 남긴다. 내부 정보는 응답에 넣지 않는다. API 경로는 헬스 포함 `/api` 접두사로 통일한다 (PQ-05, DL-05의 공개 라우트) | 기동 확인용(수동·스크립트 `curl`) 최소 엔드포인트다 | SO-07 | 확정 (위임 결정(2026-11-04)) / 확정 (용도 변경: 사용자 결정(2026-11-04): Docker 미사용) |
| SO-15 | `npm audit`를 Day 2 보안 점검에서 1회 실행해 결과를 기록한다 | 의존성 취약점을 한 번은 확인한다 | PRD 8장 Day 2 오후 | 가정 |
| SO-16 | Express `trust proxy`는 `config.js`의 설정값으로만 정하고 기본값은 프록시를 신뢰하지 않음이다. 클라이언트 IP(`req.ip`)는 신뢰하는 프록시가 보낸 전달 헤더에서만 얻는다. 로컬 개발에서는 브라우저가 백엔드를 직접 호출해 앞단 프록시가 없으므로 `TRUST_PROXY`를 비운다(불신, 사용자 결정(2026-11-05)). 값 `true`(모든 프록시 신뢰)는 쓰지 않으며 `config.js`가 기동을 거부한다. 운영은 리버스 프록시 주소만 신뢰 범위로 정한다(배포 문서, PQ-07, PRD 11장) | 모든 요청이 프록시 IP로 보이면 IP별 제한(NFR-10)이 전역 잠금이 되고, 신뢰 범위가 넓으면 헤더 위조로 제한을 피한다 | NFR-10, PRD 11장, SO-01, SO-08, PQ-07 | 확정 (위임 결정(2026-11-04), AQ-05) / 확정 (신뢰 범위 `loopback`: 사용자 결정(2026-11-04): Docker 미사용) / 가정 (세부) |
| SO-17 | 인증 토큰 규칙: (1) JWT 서명·검증(`jwt.sign`·`jwt.verify`)은 `lib/token.js`에서만 호출하고 알고리즘은 HS384 하나로 고정한다. 검증은 `algorithms: ['HS384']`를 명시하며 `lib/token.js` 밖의 `jsonwebtoken` import와 다른 알고리즘 문자열이 `src/`에 0건이다(grep). (2) 리프레시 토큰은 JWT가 아니라 `crypto.randomBytes(32)` 이상의 무작위 값이고 DB에는 SHA-256 해시만 저장한다. 원문은 쿠키 외의 어디에도 저장·로그하지 않고(SO-06) 조회는 해시로만 한다. (3) 갱신은 회전(이전 토큰 폐기 + 새 토큰 발급)이고 폐기된 토큰의 재제출은 폐기 후 유예 시간(10초) 이내이면 계열을 폐기하지 않고 ERR-02로 거부만 하며, 유예를 넘기면 그 계열 전체를 폐기하고 ERR-02다. 판단은 `revoked_at` 컬럼만 쓰고(스키마 변경 없음) 로그아웃·비밀번호 변경으로 이미 폐기된 계열은 어차피 거부되므로 구분하지 않는다. 유예 시간은 `config.js` 설정값이고 코드에 숫자를 직접 쓰지 않는다. 로그아웃은 리프레시 쿠키가 있으면 그 계열을 폐기하고 실패해도 쿠키는 지운다. 비밀번호 변경은 그 사용자의 모든 계열을 폐기하고 현재 세션에 새 토큰을 발급한다. (4) 세션 토큰 묶음(액세스 JWT + `jti`, 리프레시 값·해시·만료, CSRF 토큰) 발급은 DB를 모르는 순수 함수(`lib/token.js`)로 만들고, service가 `db/refreshToken.queries.js`로 행을 저장한다(DL-03, PQ-13). (5) 만료 행 정리는 로그인 때 그 사용자의 만료 행을 삭제하는 것으로 하고 `// LIMIT:` 주석(CN-10)을 단다(OI-21). 세부 값은 11장 | 토큰 코드를 한 곳에 모아 알고리즘 혼동·평문 저장·재사용 허용을 막는다 | NFR-07, NFR-15, BR-01, BR-16, R-13, R-14, PRD 4.4, 11장 | 확정 (HS384, 리프레시 토큰 적용: 사용자 결정(2026-11-04). 세부 규칙: 위임 결정(2026-11-04)) / 가정 (위치) |

## 6. 디렉토리 구조

**주의**: 이 문서는 구조 원칙만 정한다. 아래 트리는 구현 시 만들 대표 구조이며 이 단계에서 디렉토리·파일을 만들지 않는다. 파일은 대표 예시만 적는다.

### 6.1 저장소 루트

```text
todolist-app/
├─ .env.example            # 환경 변수 키와 자리표시자 값 (SO-02)
├─ .gitignore              # .env, node_modules
├─ .prettierrc             # 포맷 설정 하나 (TQ-10)
├─ README.md               # 실행·테스트·린트·마이그레이션·시드 명령 (TQ-12)
├─ docs/                   # 문서 1~8, schema.sql, 설계서
│  └─ test/
│     ├─ manual-checklist.md   # P0 AC 수동 체크리스트 (TQ-07, KPI-01)
│     └─ *.md                  # 점검·EXPLAIN 결과 기록 (QA-08, DB-09)
├─ backend/                # 6.2
└─ frontend/               # 6.3
```

루트에는 `package.json`을 두지 않는다. `backend/`와 `frontend/`가 각자 패키지이고 모노레포 도구는 쓰지 않는다 (PR-03).

### 6.2 백엔드 (`backend/`)

```text
backend/
├─ package.json            # scripts: dev, test, lint, format:check, migrate, seed
├─ eslint.config.js        # 레이어 import 제한, no-console (DL-01, TQ-10)
├─ migrations/             # DDL SQL 파일, 번호 순서 forward-only (SO-10)
│  └─ 001_init.sql
├─ scripts/                # 실행용 스크립트, HTTP 계층을 쓰지 않음
│  ├─ migrate.js           # 마이그레이션 러너
│  └─ seed.js              # dev / load 시드 (SO-11)
├─ src/
│  ├─ server.js            # listen만 한다
│  ├─ app.js               # 미들웨어 순서와 라우트 마운트 (DL-05), 테스트가 import
│  ├─ config.js            # process.env를 읽는 유일한 곳 (SO-01)
│  ├─ errors.js            # AppError, ERR 상수 (CN-05)
│  ├─ middleware/          # 요청 앞뒤 처리, service·db를 호출하지 않음
│  │  ├─ requestLogger.js
│  │  ├─ cors.js           # 허용 출처 CORS 헤더·사전 요청 204, 인증·CSRF 앞 (SO-08)
│  │  ├─ authenticate.js   # JWT 검증, req.user 설정 (DL-06)
│  │  ├─ csrf.js           # Signed Double-Submit 검증
│  │  └─ errorHandler.js   # 오류 응답을 만드는 유일한 곳 (SO-07)
│  ├─ routes/              # HTTP 입출력만 (DL-02)
│  │  ├─ auth.routes.js    # 회원가입·로그인·토큰 갱신·로그아웃, 인증·리프레시·CSRF 쿠키 설정·삭제는 lib/cookies.js (DL-02)
│  │  ├─ user.routes.js    # 내 정보, 시간대 변경
│  │  ├─ category.routes.js
│  │  ├─ todo.routes.js    # 목록·필터·등록·수정·삭제·캘린더 기간 조회
│  │  └─ health.routes.js  # GET /api/health (SO-14)
│  ├─ services/            # BR 규칙·검증 호출·트랜잭션 (DL-03, DL-08)
│  │  ├─ auth.service.js   # 회원가입·로그인·토큰 갱신(회전·재사용 감지)·로그아웃 폐기 (DL-08, SO-17)
│  │  ├─ user.service.js
│  │  ├─ category.service.js
│  │  ├─ health.service.js # GET /api/health의 `select 1` (SO-14, 8-plan.md XQ-04)
│  │  └─ todo.service.js
│  ├─ validation/          # VR·BR 검증, 순수 함수 (PR-05)
│  │  ├─ common.js         # 공백 제거, 길이, YYYY-MM-DD 형식
│  │  └─ todo.validation.js  # user, category도 같은 형태
│  ├─ db/                  # SQL이 있는 유일한 곳 (DL-04)
│  │  ├─ pool.js           # pg Pool, DATE(OID 1082) 문자열 type parser, withTransaction
│  │  ├─ todoStatus.js     # 상태 상수와 판정 SQL 조각 (DL-09)
│  │  ├─ refreshToken.queries.js  # refresh_tokens: 해시 조회·잠금, 폐기(행·계열·사용자), 만료 행 정리 (SO-17)
│  │  ├─ todo.queries.js   # category, user도 같은 형태
│  │  └─ category.queries.js
│  └─ lib/                 # 순수 도구
│     ├─ password.js       # scrypt 해시·비교 (NFR-06)
│     ├─ token.js          # JWT(HS384) 발급·검증, 리프레시 토큰 생성·SHA-256 해시, 세션 토큰 묶음 발급(순수, DB 없음) (SO-17)
│     ├─ csrfToken.js      # CSRF 토큰 서명·검증
│     ├─ cookies.js        # 쿠키 속성 설정(액세스·리프레시·CSRF), routes만 import 가능, 파싱은 cookie-parser (DL-01, SO-12, PQ-12)
│     ├─ today.js          # getToday(timezone, now) (DL-09)
│     ├─ loginAttempts.js  # 로그인 실패 카운터 (저장 방식은 11장)
│     └─ logger.js         # JSON 로그 (SO-06)
└─ test/
   ├─ helpers/             # 테스트 앱 기동, DB 초기화, 로그인 헬퍼 (TQ-08)
   ├─ unit/                # 순수 함수 단위 테스트 (today, validation, password)
   ├─ auth.test.js         # AC-01, 02, 14, 15, 16
   ├─ refresh.test.js      # AC-22, 23, 24 (회전·재사용 감지·동시 갱신, TQ-05)
   ├─ todo.test.js         # AC-05~10, 12, 13, 17
   ├─ category.test.js
   ├─ ownership.test.js    # 사용자 2명 교차 (TQ-04)
   └─ security.test.js     # NFR-06~10(HS384 외 알고리즘 거부·키 길이 포함), NFR-15
```

### 6.3 프런트엔드 (`frontend/`)

```text
frontend/
├─ package.json            # scripts: dev, build, test, lint, format:check
├─ vite.config.ts          # 개발 서버(포트 5173 `strictPort`, 프록시 없음) (SO-08)
├─ tsconfig.json
├─ eslint.config.js        # 레이어 import 제한, react-hooks (DL-11)
├─ index.html
└─ src/
   ├─ main.tsx             # QueryClientProvider, Router, onUnauthorized 콜백 연결 (DL-14)
   ├─ App.tsx              # 라우트 표(WF ↔ 경로), 인증 가드
   ├─ pages/               # WF 1개 = 파일 1개, 조립만 (DL-15)
   │  ├─ LoginPage.tsx           # WF-01
   │  ├─ SignupPage.tsx          # WF-02
   │  ├─ TodoListPage.tsx        # WF-03
   │  ├─ TodoFormPage.tsx        # WF-04 (등록·편집 공용)
   │  ├─ CalendarPage.tsx        # WF-05, WF-06 (월/주/일 전환)
   │  ├─ SettingsPage.tsx        # WF-07
   │  └─ CategoryManagePage.tsx  # WF-08
   ├─ features/            # 도메인별 화면 조각과 데이터 훅
   │  ├─ auth/             # api.ts, queries.ts, validation.ts, LoginForm.tsx, SignupForm.tsx, RequireAuth.tsx
   │  ├─ user/             # 내 정보·시간대: TimezoneForm.tsx, ProfileForm.tsx, PasswordForm.tsx
   │  ├─ category/         # CategorySelect.tsx, CategoryManager.tsx, api.ts, queries.ts, validation.ts
   │  ├─ todo/             # TodoTable.tsx, TodoFilterBar.tsx, TodoForm.tsx, statusLabel.ts, api.ts, queries.ts, validation.ts
   │  └─ calendar/         # MonthGrid.tsx, WeekView.tsx, DayView.tsx, DayTodoList.tsx, buildMonthGrid.ts
   ├─ components/          # 도메인을 모르는 공용 UI (WF-00)
   │  ├─ Layout.tsx, Header.tsx   # 헤더·모바일 메뉴
   │  ├─ TopAlert.tsx             # 상단 알림
   │  ├─ ConfirmDialog.tsx        # 삭제 확인 모달 (BR-06, BR-10)
   │  └─ FieldError.tsx           # 입력란 아래 사유
   ├─ api/                 # 서버 통신 공통
   │  ├─ client.ts         # fetch 유일한 곳: 쿠키·CSRF 헤더·ApiError·ERR-02 처리(single-flight 토큰 갱신 후 1회 재시도) (DL-14)
   │  ├─ errorCodes.ts     # ERR 코드 문자열 상수 (CN-05)
   │  └─ types.ts          # API 응답 타입, DateString, IsoTimestamp (CN-06)
   ├─ store/               # Zustand, UI 상태만 (DL-13)
   │  ├─ alertStore.ts, menuStore.ts
   │  ├─ todoFilterStore.ts
   │  └─ calendarStore.ts
   ├─ lib/                 # 순수 함수
   │  ├─ date.ts           # 날짜 문자열 계산, 시각 표시 변환 (CN-06, CN-07)
   │  └─ validation.ts     # 공백 제거·길이 같은 공통 검증 도구
   └─ styles/              # 전역 스타일, 화면별은 CSS Modules
```

시간대 드롭다운(WF-07)의 목록은 브라우저 기본 `Intl.supportedValuesOf('timeZone')`를 쓰고, 날짜 입력은 `input type="date"`를 쓴다(FR-04). 둘 다 별도 라이브러리 없이 쓴다.

### 6.4 화면·도메인 매핑

| WF | 프런트 (`pages/` · `features/`) | 백엔드 (`routes` · `services` · `db`) | DB 표 |
|----|--------------------------------|---------------------------------------|-------|
| WF-00 공통 레이아웃 | `components/`, `features/auth`(로그아웃) | `auth.*`(로그아웃, 리프레시 계열 폐기) | `refresh_tokens` |
| WF-01 로그인 | `LoginPage`, `features/auth` | `auth.*`, `user.queries`, `refreshToken.queries`, `lib/loginAttempts` | `users`, `refresh_tokens` |
| WF-02 회원가입 | `SignupPage`, `features/auth` | `auth.service`(User + 기본 카테고리 트랜잭션, 리프레시 토큰 발급) | `users`, `categories`, `refresh_tokens` |
| WF-03 목록·필터 | `TodoListPage`, `features/todo`, `features/category`(필터 드롭다운) | `todo.*`, `category.*` | `todos`, `categories` |
| WF-04 등록·편집 | `TodoFormPage`, `features/todo`, `features/category`(CategorySelect) | `todo.*` | `todos` |
| WF-05·06 캘린더 | `CalendarPage`, `features/calendar` | `todo.*`(기간 조회, 별도 캘린더 도메인 없음) | `todos` |
| WF-07 설정 | `SettingsPage`, `features/user` | `user.*`(비밀번호 변경 시 `refreshToken.queries`로 폐기) | `users`, `refresh_tokens` |
| WF-08 카테고리 관리 | `CategoryManagePage`, `features/category` | `category.*`(삭제 시 `todo.queries` 호출) | `categories`, `todos` |
| (화면 없음) 토큰 갱신 | `api/client.ts`(single-flight, DL-14), `main.tsx`(`onUnauthorized`) | `auth.routes`(공개), `auth.service`(회전·재사용 감지), `refreshToken.queries` | `refresh_tokens` |

## 7. 추적 표

| 요구 (ID) | 구현 원칙 | 위치 | 검증 |
|-----------|-----------|------|------|
| NFR-04 | SO-11 | `backend/scripts/seed.js` | 시드 실행 후 건수 확인 |
| NFR-05 | SO-10 | `backend/migrations/`, `db/*.queries.js` | `EXPLAIN` |
| NFR-06 | DL-08, SO-12 | `lib/password.js`, `auth.service.js` | TQ-05 보안 테스트, 코드 리뷰 |
| NFR-07, BR-16 | DL-05, DL-06, DL-08, SO-03, SO-04, SO-12, SO-17 | `middleware/authenticate.js`, `lib/token.js`, `lib/cookies.js`, `auth.service.js`, `db/refreshToken.queries.js` | TQ-05 (만료·위조 토큰, HS384 외 거부, 키 길이, 갱신·회전·재사용 감지, `refresh.test.js`) |
| NFR-08 | DL-04, DL-10, SO-13 | `backend/src/db/` | grep `${`, 인젝션 문자열 테스트 |
| NFR-09, BR-02, KPI-04 | DL-07, TQ-04 | `db/todo.queries.js`, `db/category.queries.js` | `ownership.test.js` |
| NFR-10 | SO-05, SO-16, PQ-10 | `lib/loginAttempts.js`, `auth.service.js`, `config.js` | TQ-05 (AC-15, 운영 가드) |
| NFR-11 | SO-06, SO-07 | `lib/logger.js`, `middleware/errorHandler.js` | 수동 확인, grep `console.` |
| NFR-12 | TQ-05 (수동) | `features/calendar`, `components/Layout.tsx` | 360 / 768 / 1280px |
| NFR-15 | DL-05, DL-14, SO-08, SO-12 | `middleware/csrf.js`, `middleware/cors.js`, `lib/csrfToken.js`, `api/client.ts` | TQ-05 (ERR-08 케이스, 갱신 뒤 새 CSRF 토큰) |
| AC-22, AC-23, AC-24 | DL-14, SO-17 | `api/client.ts`(single-flight, 수동), `auth.service.js` | `refresh.test.js` (자동), 수동 체크리스트(15분 경과 저장) |
| BR-03 | DL-08 | `auth.service.js` (트랜잭션) | AC-01 통합 테스트 |
| BR-04, BR-13 | DL-03 | `todo.service.js` | AC-05, AC-10 |
| BR-05, BR-14, BR-15, VR | PR-05, SO-10 | `backend/src/validation/`, `frontend/src/features/*/validation.ts`, DB 제약 | TQ-06 (경계값), AC-03·06 |
| BR-06 | DL-08, DL-12 | `category.service.js`, `ConfirmDialog.tsx` | AC-04 (자동), 확인 대화상자 (수동) |
| BR-07, BR-08, BR-09 | PR-05, SO-10 | 위 validation, `ck_todos_*` 제약 | AC-06 |
| BR-10 | DL-15 | `TodoFormPage`, `ConfirmDialog.tsx` | AC-11 (수동) |
| BR-11, FR-05 | DL-09, DL-10 | `todo.queries.js`, `db/todoStatus.js` | AC-07, 08, 09 |
| BR-12, FR-08 | DL-13 | `todo.queries.js`(기간 조회), `features/calendar` | AC-12 (API 자동, 화면 수동) |
| 도메인 4장 상태, R-05, OI-02 | PR-06, DL-09, TQ-03 | `lib/today.js`, `db/todoStatus.js` | AC-07, 08, 13 |
| PRD 4.2·6장 날짜·시각 | PR-07, CN-06, CN-07 | `db/pool.js`(type parser), `lib/date.ts` | 시간대 변경 수동 검증, AC-13 |
| PRD 4.3 ERR-01~08 | PR-08, CN-05, SO-07 | `errors.js`, `api/errorCodes.ts` | `code` 리터럴 grep |
| KPI-01 | TQ-07 | `docs/test/manual-checklist.md` | AC별 체크 |

## 8. 확인 필요 사항

| # | 구분 | 내용 | 결정 |
|---|------|------|-----------|
| PQ-01 | 확정 (위임 결정(2026-11-04)) | 설계서(API 명세, DDL, PRD 11장 항목)가 아직 없다. Day 1 오전의 인증·CSRF·로그인 제한·scrypt 구현이 11장 항목에 의존한다 (PR-09) | 확정 (위임 결정(2026-11-04)): Day 1 시작 전에 후속 설계서를 먼저 쓰고 그 전에는 구현하지 않는다. 최소 범위: scrypt 값과 저장 포맷, CSRF 토큰 구조와 쿠키·헤더 이름, 로그인 카운터 저장 위치, API 경로·응답 형태 |
| PQ-02 | 확정 (위임 결정(2026-11-04)) | 프런트는 상태를 계산하지 않고 서버의 `status`만 표시한다. PRD 6장은 '클라이언트는 표시용으로만 같은 규칙을 쓴다'고 허용만 하므로 모순은 아니다. 다만 캘린더 '오늘' 강조와 초기 달에는 프런트가 `lib/date.ts`로 시간대 기준 오늘을 계산해야 해서 R-05의 '오늘은 한 곳'과 어긋나 보일 수 있다 | 확정 (위임 결정(2026-11-04)): 프런트의 오늘 계산은 표시 전용(캘린더 강조·초기 달)으로만 허용하고 상태 판정·필터에 쓰지 않는다. PRD 6장에 반영 |
| PQ-03 | 확정 (위임 결정(2026-11-04)) | 검증 규칙(VR)이 프런트 TS와 백엔드 JS에 이중으로 구현된다. 공유 패키지는 모노레포 도구를 피하려고 두지 않는다 | 확정 (위임 결정(2026-11-04)): 공유 패키지 없이 VR ID 주석과 양쪽 같은 경계값 단위 테스트(TQ-06)로 유지한다. 서버 검증이 최종 판정이다(PR-05). 불일치가 나오면 그때 공유 방식을 검토 |
| PQ-04 | 확정 (위임 결정(2026-11-04)) | 목록 필터와 캘린더 위치를 URL이 아닌 Zustand에 두므로 새로고침하면 초기화되고 링크로 공유할 수 없다 (DL-13) | 확정 (위임 결정(2026-11-04)): MVP에서는 Zustand에 둔다. 편집 화면에서 돌아올 때 유지되는 이점이 더 크다 |
| PQ-05 | 확정 (위임 결정(2026-11-04)) | Node LTS(22)와 Express 5(비동기 핸들러 오류가 자동으로 `errorHandler`로 전달), ESM, API 접두사 `/api`를 가정했다. PRD는 버전과 경로를 정하지 않았다 | 확정 (위임 결정(2026-11-04)): Node 22 LTS, Express 5, ESM, `/api` 접두사로 정한다. `package.json`의 `engines`에 고정하고 설계서의 API 경로도 이를 따른다 |
| PQ-06 | 확정 (위임 결정(2026-11-04)) | VR-04는 'IANA 이름만 허용'인데 `Intl.DateTimeFormat`은 오프셋 형식(`+09:00`)이나 대소문자 다른 이름을 받아들일 수 있고, 브라우저 목록 `Intl.supportedValuesOf`에 `UTC`가 없을 수 있다. 가입 시 자동 감지값이 목록과 다른 별칭일 수도 있다 | 확정 (위임 결정(2026-11-04)): 서버는 `resolvedOptions().timeZone`의 정규형으로 저장하고, 오프셋 형식(`+09:00`) 거부와 `UTC` 허용을 경계값 테스트(TQ-06)로 확인한다. 설정 드롭다운에는 현재 값이 목록에 없으면 추가한다. `Intl` 동작은 실행 환경(Node 22)에서 테스트로 검증하기 전까지 믿지 않는다 |
| PQ-07 | 확정 (위임 결정(2026-11-04)) | 운영 배포(PRD 6장의 단일 서버)에서 화면과 API를 어떻게 노출하는지, 프런트 빌드 결과 서빙, HTTPS 종단, 클라이언트 IP(PRD 11장)가 비어 있다. 이 문서는 로컬 실행 구성(SO-08)까지만 다룬다 (SO-09) | 확정 (위임 결정(2026-11-04)): 이 문서는 로컬 실행 구성까지만 다루고, 운영 배포는 로컬 검증 후 별도 배포 문서로 정한다. 리버스 프록시 한 개가 정적 파일과 `/api`를 같은 출처로 내보내고 HTTPS를 종단하는 구성을 기본안으로 한다. 클라이언트 IP 신뢰 범위는 그 문서와 PRD 11장에서 정한다. **변경 (사용자 결정(2026-11-05))**: 같은 출처 기본안은 폐기하고 같은 사이트의 다른 서브도메인(예: 화면 `https://app.example.com`, API `https://api.example.com`) + CORS(SO-08)로 한다. 운영은 `CORS_ORIGINS`·`COOKIE_DOMAIN`이 필수다(SO-12) |
| PQ-08 | 확정 (위임 결정(2026-11-04)) | 시스템 지침의 80% 커버리지와 달리 PRD에는 커버리지 수치가 없고 2일 일정이라 수치 목표를 두지 않았다 (TQ-11) | 확정 (위임 결정(2026-11-04)): 커버리지 수치 목표는 두지 않는다. TQ-05 범위를 합격 기준으로 하고 측정값은 참고용으로만 기록 |
| PQ-09 | 확정 (위임 결정(2026-11-04)) | API 응답 타입(`api/types.ts`)을 프런트가 손으로 관리한다 (백엔드가 JS라 타입 공유가 없다) | 확정 (위임 결정(2026-11-04)): 설계서의 API 명세를 단일 출처로 하고 `api/types.ts`는 손으로 관리한다. Day 1 오후에 타입을 쓸 때 명세와 대조 |
| PQ-10 | 확정 (위임 결정(2026-11-04)) | 로그인 실패 카운터를 메모리에 두면 서버 재시작 때 초기화되고 프로세스 다중화(R-03) 때 공유되지 않는다 (`lib/loginAttempts.js`, 저장 위치는 11장) | 확정 (위임 결정(2026-11-04)): MVP 단일 프로세스에서는 메모리로 시작하고 `// LIMIT:` 주석(CN-10)을 단다. 프로세스 다중화(R-03) 전에 공유 저장소로 바꾼다. 최종 저장 위치는 PRD 11장 설계서에서 정한다. 임의의 email·IP 키로 메모리가 계속 늘지 않도록 시간 창이 지난 항목은 접근할 때 지우고 시간 창 길이 간격으로 주기 정리한다. 보관 키 수 상한은 IP별·계정별 각각 10,000개(가정)이고, 상한을 넘으면 가장 오래된 항목부터 지운다(IP별 한도가 있어 한 IP가 키를 대량으로 만들 수 없다). 상한과 정리 방식은 `// LIMIT:` 주석(CN-10)으로 남긴다 (AQ-10) |
| PQ-11 | 확정 (위임 결정(2026-11-04)) | 수동 체크리스트 파일 위치(`docs/test/manual-checklist.md`)는 문서에 없는 새 결정이다 (TQ-07) | 확정 (위임 결정(2026-11-04)): `docs/test/manual-checklist.md` 위치를 그대로 쓴다. k6 결과 형식(TQ-09)은 부하 테스트 제거로 해당 없음(사용자 결정(2026-11-05)) |
| PQ-12 | 확정 (위임 결정(2026-11-04)) | 초안은 `cookie-parser` 없이 `lib/cookies.js`에서 쿠키를 직접 파싱하기로 했다. 인증·CSRF 쿠키를 다루는 코드라 파싱 실수(인코딩, 중복 이름, 따옴표 처리)가 곧 보안 결함이 된다 | `cookie-parser`를 초기 허용 의존성에 넣고 파싱은 맡긴다. `lib/cookies.js`는 쿠키 속성 설정(SO-12)만 맡는다 |
| PQ-13 | 확정 (위임 결정(2026-11-04)) | 세션 토큰(액세스·리프레시·CSRF) 발급이 회원가입·로그인·갱신(`auth.service`)과 비밀번호 변경(`user.service`) 네 곳에서 필요한데, DL-03은 service가 다른 service를 호출하지 못하게 한다 | 확정 (위임 결정(2026-11-04)): `lib/token.js`에 DB를 모르는 순수 함수(세션 토큰 묶음 발급)를 두고, 각 service가 그 결과의 리프레시 행을 `db/refreshToken.queries.js`로 저장한다. 별도 session service는 만들지 않는다(SO-17) |
| PQ-14 | 확정 (위임 결정(2026-11-04)) | single-flight(DL-14)는 한 탭 안의 동시 요청만 하나로 합친다. 여러 탭이 같은 쿠키로 동시에 갱신하면 재사용 감지(BR-16)가 정상 사용자를 로그아웃시킬 수 있다 | 확정 (위임 결정(2026-11-04)): 서버가 폐기 후 10초 유예(설정값, `revoked_at`만으로 판단)로 계열 폐기 없이 거부만 하고, 프런트는 갱신이 실패하면 원 요청을 한 번 재전송한다(SO-17, DL-14, PRD NFR-07·OI-20·R-14). 탭 사이 잠금(`navigator.locks` 등)은 구현하지 않는다 |
