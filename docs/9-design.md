# TodoList 설계서 (구현 세부)

## 문서 이력

| 버전 | 일자 | 작성자 | 변경 내용 |
|------|------|--------|-----------|
| 0.1 | 2026-11-04 | MinjeYu | 8-plan.md COM-01 초안. PRD v0.9 11장 항목 결정, API 엔드포인트 표, 인증 토큰·쿠키·서명 키 세부, 잔여 위험. `backend/swagger.yaml` 0.1.0의 '가정 (설계서 COM-01에서 확정)' 값과 SQ-01~09 추천안을 확정 |
| 0.2 | 2026-11-04 | MinjeYu | COM-01 재수행: 사용자 결정(2026-11-04: Docker 미사용) 반영. D-07 기동 확인을 `curl`로, libuv 스레드 풀 주입을 `.env`로, 로컬 클라이언트 IP 신뢰 범위를 `TRUST_PROXY=loopback`으로 변경, 6장에서 `POSTGRES_*` 키 삭제와 로컬 실행 구성 추가. 단일 출처 링크를 PRD v0.10·구조 설계 원칙 v0.7·아키텍처 다이어그램 v0.7로 갱신 |
| 0.3 | 2026-11-04 | MinjeYu | BE-07 반영: 재해시 판단 기준을 `lib/password.js`의 현재 파라미터(`needsRehash`)로 명시, scrypt 해시 시간 측정값 기록 |
| 0.4 | 2026-11-05 | MinjeYu | 사용자 결정(2026-11-05) 반영: k6 부하 테스트 제거. 7장 k6 스크립트 구성 삭제(잔여 위험이 7장), 6장 `SEED_PASSWORD` 사용처에서 k6 제거 |

**단일 출처 원칙**: 규칙 원문은 도메인 정의서 v0.10, PRD v0.10, 구조 설계 원칙 v0.7, 아키텍처 다이어그램 v0.7, ERD v0.5에만 있고 이 문서는 ID로 참조한다(PR-01). 이 문서는 PRD 11장이 넘긴 **구현 값·이름·절차**만 정한다. 요청·응답 필드의 상세 스키마는 [`backend/swagger.yaml`](../backend/swagger.yaml)이 단일 출처이며, 이 문서의 2장은 경로·메서드·상태 코드 목록이다.

**구분**: 이 문서의 결정은 모두 위임 결정(2026-11-04)에 따른 **확정**이다. 측정 후 조정할 수 있는 값은 '조정 가능'으로 표시한다.

## 1. 공통 결정

| # | 항목 | 결정 | 근거 ID |
|---|------|------|---------|
| D-01 | API 접두사·경로 | 모든 경로는 `/api` 아래. `swagger.yaml`의 경로를 확정한다 | PQ-05, SO-14 |
| D-02 | 상태 값 이름 | `NOT_STARTED`, `IN_PROGRESS`, `COMPLETED`, `OVERDUE`를 확정한다 | CN-09, 도메인 4장 |
| D-03 | 오류 `fields` 형태 | `[{ "field": string, "message": string }]`. ERR 표(PRD 4.3)의 code·HTTP 값을 확정으로 쓴다(SQ-09) | PRD 4.3, CN-08 |
| D-04 | 성공 본문 | 로그아웃·갱신·비밀번호 변경은 200 `{ "status": "ok" }`, 삭제는 204(SQ-04) | BE-13, BE-24 |
| D-05 | 할일 수정의 `categoryId` | 생략은 유지, `null`은 ERR-01(SQ-05) | BR-04, PRD 7장 |
| D-06 | 카테고리 목록 정렬 | 기본 카테고리 먼저, 그다음 `createdAt` 오름차순(SQ-06) | WF-03, WF-04, WF-08 |
| D-07 | 헬스 실패 | DB 오류는 500 ERR-07. 기동 확인(`curl http://localhost:3000/api/health`)은 2xx만 성공으로 본다(SQ-07) | SO-14 |
| D-08 | 로그인 제한 응답 | `Retry-After` 헤더를 보내지 않는다(SQ-03) | NFR-10, WF-01 |
| D-09 | pg `DATE` 처리 | `pg.types.setTypeParser(1082, (v) => v)`를 `db/pool.js`에서 한 번 설정해 `YYYY-MM-DD` 문자열 그대로 받는다 | PRD 6장, CN-06 |
| D-10 | 카테고리 이름 중복 | `uq_categories_user_id_lower_name` 위반(pg `23505`)을 service가 ERR-04로 번역한다 | BR-14, EQ-03, SO-07 |
| D-11 | 카테고리별 할일 수 | `GET /api/categories` 항목의 `todoCount`. 조회 시점의 안내 값이다 | BR-06, AQ-08 |

## 2. API 엔드포인트

필드 상세는 `swagger.yaml`. 'CSRF'가 예인 요청은 `X-CSRF-Token` 헤더가 필요하다. 모든 보호 API는 인증 실패 시 401(ERR-02), 서버 오류 시 500(ERR-07)이 가능하다.

| 기능 | 메서드 | 경로 | 인증 | CSRF | 성공 | 오류 상태 코드 |
|------|--------|------|------|------|------|----------------|
| 회원가입 | POST | `/api/auth/signup` | 없음 | 아니오 | 201 + 세션 쿠키 3종 | 400, 409 |
| 로그인 | POST | `/api/auth/login` | 없음 | 아니오 | 200 + 세션 쿠키 3종 | 400, 401(ERR-03), 429 |
| 토큰 갱신 | POST | `/api/auth/refresh` | 리프레시 쿠키 | 아니오 | 200 + 세션 쿠키 3종 | 401(ERR-02) |
| 로그아웃 | POST | `/api/auth/logout` | 없음(리프레시 쿠키 선택) | 아니오 | 200 + 쿠키 삭제 | — |
| 내 정보 조회 | GET | `/api/users/me` | 액세스 | — | 200 | 401 |
| 내 정보 수정(이름·시간대) | PATCH | `/api/users/me` | 액세스 | 예 | 200 | 400, 401, 403 |
| 비밀번호 변경 | PUT | `/api/users/me/password` | 액세스 | 예 | 200 + 세션 쿠키 3종 | 400, 401, 403 |
| 카테고리 목록 | GET | `/api/categories` | 액세스 | — | 200 | 401 |
| 카테고리 등록 | POST | `/api/categories` | 액세스 | 예 | 201 | 400, 401, 403, 409 |
| 카테고리 수정 | PATCH | `/api/categories/{categoryId}` | 액세스 | 예 | 200 | 400, 401, 403, 404, 409 |
| 카테고리 삭제 | DELETE | `/api/categories/{categoryId}` | 액세스 | 예 | 204 | 400, 401, 403, 404 |
| 할일 목록(필터) | GET | `/api/todos?categoryId&status` | 액세스 | — | 200 | 400, 401, 404 |
| 할일 등록 | POST | `/api/todos` | 액세스 | 예 | 201 | 400, 401, 403, 404 |
| 할일 조회 | GET | `/api/todos/{todoId}` | 액세스 | — | 200 | 401, 404 |
| 할일 수정(완료 표시 포함) | PATCH | `/api/todos/{todoId}` | 액세스 | 예 | 200 | 400, 401, 403, 404 |
| 할일 삭제 | DELETE | `/api/todos/{todoId}` | 액세스 | 예 | 204 | 401, 403, 404 |
| 캘린더 기간 조회 | GET | `/api/calendar/todos?from&to` | 액세스 | — | 200 | 400, 401 |
| 헬스 체크 | GET | `/api/health` | 없음 | — | 200 | 500 |

- **현재 사용자 조회**(AQ-03): `GET /api/users/me`가 `User`(`id`, `email`, `name`, `timezone`, `createdAt`, `updatedAt`)를 돌려준다. 회원가입·로그인 성공 본문도 같은 `User`이고 `passwordHash`는 어떤 응답에도 없다.
- **캘린더 계약**(AQ-07): 파라미터는 `from`·`to`(`YYYY-MM-DD`, SQ-01. CN-06의 `*Date` 규칙은 JSON 필드에만 적용). 조회 조건은 BR-12, 응답 항목은 서버가 계산한 `status`를 포함한다. 형식 오류, `from > to`, 양 끝 포함 42일 초과(`to - from > 41일`, SQ-02)는 ERR-01이다.
- **검사 순서**: 토큰 갱신·회원가입·로그인·로그아웃·헬스는 인증 미들웨어 앞의 공개 라우트다. 보호 라우트는 인증(ERR-02) → CSRF(ERR-08) → 검증(ERR-01) → 소유권(ERR-05) 순서다(DL-05, AD-08).

## 3. 비밀번호 해시 (NFR-06, NFR-16, R-04)

| 항목 | 결정 |
|------|------|
| 알고리즘 | `node:crypto` 비동기 `scrypt` |
| 파라미터 | `N = 2^15 (32768)`, `r = 8`, `p = 3`, `keylen = 64`. OWASP 권고 대안 중 메모리 32MiB 조합이다. 조정 가능(QA-06 `login` 결과로 BE-07에서 확인) |
| `maxmem` | `64 * 1024 * 1024` (64MiB, 필요량 `128 * N * r` = 32MiB의 2배) |
| salt | 사용자마다 `crypto.randomBytes(16)` |
| 저장 포맷 | `scrypt$<N>$<r>$<p>$<salt base64url>$<hash base64url>` 한 문자열(`users.password_hash`) |
| 비교 | 저장 문자열의 파라미터로 다시 계산하고 `timingSafeEqual`로 비교 |
| 재해시 | 로그인 성공 시 저장된 파라미터가 `lib/password.js`의 현재 값과 다르면(`needsRehash`) 새 파라미터로 해시해 `password_hash`·`updated_at`을 갱신한다. 실패해도 로그인은 성공으로 둔다(로그만) |
| 측정 (BE-07) | 2026-11-04 로컬 PC(Windows, Node 24): 해시 1회 중앙값 174ms(최소 170, 최대 211, 10회), 동시 8회 423ms(스레드 풀 4). NFR-16 재확인은 QA-06 |
| libuv 스레드 풀 | `UV_THREADPOOL_SIZE=4`(초기 사양 4 vCPU와 같음). `.env` 값으로 두고 `--env-file`로 프로세스 시작 때 주입한다. 조정 가능(NFR-16 측정) |

**없는 email의 응답 시간**(ERR-03): 기동 시 현재 파라미터로 고정 문자열의 더미 해시를 한 번 만들어 두고, 사용자가 없으면 입력 비밀번호를 그 더미 해시와 같은 방식으로 비교한 뒤 ERR-03을 돌려준다. 존재·부재 경로 모두 scrypt 1회가 된다.

## 4. 로그인 실패 제한 (NFR-10, PQ-10, SO-05, SO-16)

| 항목 | 결정 |
|------|------|
| 저장 위치 | 프로세스 메모리 `lib/loginAttempts.js`의 `Map` 두 개(IP별, email별). `// LIMIT:` 주석으로 단일 프로세스 한정임을 남긴다. 프로세스 다중화(R-03) 전에 PostgreSQL 표(또는 공유 저장소)로 옮긴다 |
| 시간 창 | 고정 창: 첫 실패 시각부터 15분. 창이 지나면 항목을 지우고 0부터 센다. 임계값 IP 10회·계정 5회(PRD 수치) |
| 세는 것 | ERR-03 실패만. 제한 중 거부(ERR-06)와 형식 검사 거부(ERR-01, PRD 4.1)는 세지 않는다. 성공은 세지 않고 카운터를 지우지도 않는다 |
| 키 | IP는 `req.ip`, 계정은 소문자 정규화한 email |
| 정리·상한 | 접근할 때 창이 지난 항목을 지우고, `setInterval` 15분 간격(`unref()`)으로 일괄 정리한다. 키 수 상한은 각 10,000개, 넘으면 `Map` 삽입 순서상 가장 오래된 항목부터 지운다. `// LIMIT:` 주석 |
| 클라이언트 IP(로컬) | Vite 프록시(`/api` → `http://localhost:3000`)를 `xfwd: true`로 두어 `X-Forwarded-For`를 전달한다. 프록시가 같은 장비이므로 `TRUST_PROXY=loopback`으로 루프백 주소만 신뢰한다. 기본값은 신뢰 안 함, `true`는 기동 거부(SO-16) |
| 클라이언트 IP(운영) | 배포 문서에서 리버스 프록시 주소로 `TRUST_PROXY`를 정한다(PQ-07) |
| 테스트 IP 예외 | 구현하지 않는다. 테스트는 IP별 시나리오마다 카운터를 초기화하는 `lib/loginAttempts.js`의 테스트용 `reset()` 함수를 쓴다. 나중에 예외가 필요하면 `test` 전용 설정으로 두고 `production`에 그 값이 있으면 `config.js`가 기동을 거부한다(SO-05) |

## 5. 인증 토큰 (NFR-07, NFR-15, SO-12, SO-17)

### 5.1 쿠키

| 쿠키 | 값 | HttpOnly | SameSite | Path | Max-Age |
|------|----|----------|----------|------|---------|
| `access_token` | JWT(HS384) | 예 | Lax | `/api` | 900 (15분) |
| `refresh_token` | 불투명 값 32바이트 base64url | 예 | Strict | `/api/auth` | 604800 (7일) |
| `csrf_token` | 5.4의 서명 토큰 | 아니오(스크립트가 읽음) | Lax | `/` | 900 (15분) |

- `Secure`는 `config.js`의 `cookieSecure`(`NODE_ENV=production`일 때만 `true`)로 세 쿠키에 함께 붙인다(SO-04).
- 리프레시 쿠키 `Path=/api/auth`는 갱신(`/api/auth/refresh`)과 로그아웃(`/api/auth/logout`)을 함께 포함하는 인증 API 공통 접두사다. 쿠키 Path는 하나뿐이라 **같은 접두사 아래의 회원가입·로그인 요청에도 리프레시 쿠키가 전송되지만 서버는 그 요청에서 읽지 않는다**(OI-19).
- 삭제는 같은 이름·Path에 `Max-Age=0`이다(BR-01).

### 5.2 JWT 액세스 토큰

- 클레임: `sub`(userId), `iat`, `exp`(발급 + 900초), `jti`(`crypto.randomUUID()`). 그 밖의 클레임은 넣지 않는다.
- 서명·검증은 `lib/token.js`에서만, `algorithm: 'HS384'` / `algorithms: ['HS384']`.

### 5.3 서명 키 (R-13, SO-03)

| 항목 | 결정 |
|------|------|
| 환경 변수 | `JWT_SECRET`(JWT 서명), `CSRF_SECRET`(CSRF HMAC). **분리한다**: 한쪽 유출이 다른 쪽 위조로 이어지지 않게 한다 |
| 형식·생성 | base64url 문자열. `node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"` |
| 길이 검사 | `config.js`가 `Buffer.from(value, 'base64url').length`(디코딩 후 바이트)가 48 미만이면 모든 환경에서 기동을 거부한다. `CSRF_SECRET`도 같은 검사를 한다 |
| 자리표시자 | `.env.example`의 값은 `change-me`를 8번 이어 쓴 72자다(base64url 문자만 있어 디코딩하면 54바이트라 개발 환경이 길이 검사를 통과한다). `production`에서 값에 `change-me`가 들어 있으면 기동을 거부한다 |
| 정기 교체 | 두 키를 **함께** 바꾸고 재시작한다. 발급된 액세스 토큰은 서명 불일치로 ERR-02가 되고, 프런트가 리프레시 토큰(서명이 아니라 DB 해시로 검증)으로 갱신해 새 액세스·CSRF 토큰을 받으므로 사용자는 로그인 유지된다. `CSRF_SECRET`만 바꾸면 403이 되어 갱신으로 복구되지 않으므로 단독 교체하지 않는다 |
| 유출 시 | 위 교체에 더해 `UPDATE refresh_tokens SET revoked_at = now() WHERE revoked_at IS NULL`로 모든 리프레시 토큰을 폐기해 전원 재로그인시킨다 |

### 5.4 CSRF 토큰 (NFR-15)

- 구조: `<nonce>.<sig>`. `nonce` = `randomBytes(16)` base64url, `sig` = `HMAC-SHA256(CSRF_SECRET, jti + "." + nonce)` base64url.
- 헤더 이름: `X-CSRF-Token`.
- 검증(`lib/csrfToken.js`): 쿠키 값과 헤더 값이 같고, 현재 액세스 토큰의 `jti`로 다시 계산한 `sig`가 `timingSafeEqual`로 같아야 한다. 하나라도 틀리면 ERR-08.
- 발급 시점: 로그인·회원가입·토큰 갱신·비밀번호 변경 성공 때 새 `jti`에 묶어 재발급한다.

### 5.5 리프레시 토큰 저장·갱신 (BR-16, OI-18, OI-20, OI-21, AQ-11, AQ-13)

- 값: `crypto.randomBytes(32)` base64url. DB `token_hash`는 SHA-256 **hex**(64자). 원문은 쿠키 외 어디에도 두지 않는다.
- 유예 시간 설정값: `config.js`의 `refreshReuseGraceMs`(기본 `10000`). 코드에 숫자를 직접 쓰지 않는다.
- `db/refreshToken.queries.js` 함수: `insert`, `findByHashForUpdate`, `revokeById`, `revokeFamily`(`WHERE family_id = $1 AND revoked_at IS NULL`), `revokeAllForUser`(`WHERE user_id = $1 AND revoked_at IS NULL`), `deleteExpiredForUser`.

| 흐름 | 처리 |
|------|------|
| 로그인·회원가입 | 새 `family_id`로 행 INSERT. 로그인은 같은 트랜잭션에서 그 사용자의 `expires_at < now()` 행을 삭제한다(`// LIMIT:` 로그인하지 않는 사용자의 만료 행은 남는다) |
| 갱신 | 트랜잭션: 해시로 `SELECT ... FOR UPDATE` → (1) 없음·만료: ERR-02 (2) `revoked_at` 있음, `now() - revoked_at ≤ 유예`: 아무것도 바꾸지 않고 ERR-02 (3) `revoked_at` 있음, 유예 초과: `revokeFamily` 후 **COMMIT하고** ERR-02 (4) 유효: `revokeById` + 같은 `family_id`로 새 행 INSERT(만료 = now + 7일) 후 COMMIT, 새 쿠키 3종 발급. 무작위 값·해시 계산은 트랜잭션 전에 한다(DL-08) |
| 로그아웃 | 리프레시 쿠키가 있으면 해시로 찾은 행의 계열을 `revokeFamily`. 실패해도 쿠키 3종은 지운다 |
| 비밀번호 변경 | 트랜잭션: `password_hash` 갱신 + `revokeAllForUser` + 새 계열 INSERT, 이후 현재 세션에 새 쿠키 3종 |

(3)의 COMMIT 후 거부: 오류를 던져 롤백하면 계열 폐기가 사라지므로, service는 폐기를 커밋한 뒤 ERR-02를 던진다.

### 5.6 프런트 갱신 처리 (DL-14)

`api/client.ts`가 DL-14를 그대로 구현한다. 갱신 요청은 `POST /api/auth/refresh`(본문 없음, `credentials: 'same-origin'`), 진행 중 Promise 하나로 single-flight. 갱신 성공·실패와 관계없이 원 요청을 한 번만 재전송하고, 그 결과도 ERR-02면 `onUnauthorized`를 호출한다. 갱신 요청과 재전송 요청에는 다시 갱신하지 않는다.

## 6. 환경 변수

`.env.example`이 키 목록의 단일 출처다. 비밀은 루트 `.env`로만 주입하고, 백엔드는 `node --env-file-if-exists=../.env`로 읽는다(SO-02, SO-03). Docker는 쓰지 않는다(사용자 결정(2026-11-04)).

**로컬 실행 구성**: PostgreSQL 17(로컬 설치, `localhost:5432`) → `backend`의 `npm run dev`(포트 3000) → `frontend`의 `npm run dev`(포트 5173). 브라우저는 `http://localhost:5173`만 호출한다. 백엔드는 DB를 기다리지 않으므로 DB를 먼저 띄운다(README).

| 키 | 사용처 | 비고 |
|----|--------|------|
| `DATABASE_URL` | `backend` (`config.js`), `scripts/` | 로컬 설치 PostgreSQL 17 (`localhost:5432`) |
| `JWT_SECRET`, `CSRF_SECRET` | `backend` | 5.3 |
| `NODE_ENV` | `backend` | `development`/`test`/`production`만(SO-04) |
| `PORT` | `backend` | 기본 3000 |
| `TRUST_PROXY` | `backend` | 4장 |
| `UV_THREADPOOL_SIZE` | `backend` | 3장 |
| `SEED_PASSWORD` | `seed.js` | 시드 계정 비밀번호(SO-11) |
| `PG_POOL_MAX` | `backend` | pg 풀 크기, 기본 10. 조정 가능(NFR-05) |

## 7. 잔여 위험

- **R-08**: 액세스 토큰은 서버가 즉시 무효화하지 않는다. 로그아웃·비밀번호 변경 뒤에도 탈취된 액세스 토큰은 만료까지 **최대 15분** 동안 재사용될 수 있다. 리프레시 토큰은 서버에서 즉시 폐기되므로 그 뒤에는 갱신되지 않는다. MVP에서 수용한다.
- **R-14**: 폐기 후 10초 유예 안에 쓰인 탈취 토큰은 계열 폐기 없이 거부만 되므로, 탈취자가 새 토큰을 얻지는 못하지만 감지가 늦어진다.
- **PQ-10**: 로그인 실패 카운터는 프로세스 메모리라 재시작 때 초기화되고 다중 프로세스에서 공유되지 않는다.
- **OI-21**: 로그인하지 않는 사용자의 만료 리프레시 행은 정리되지 않고 남는다.
