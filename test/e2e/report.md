# 통합 테스트 리포트 (E2E, 2026-11-06)

- 기준 문서: [사용자 시나리오 v0.7](../../docs/3-user-scenario.md) SC-01~SC-16, 추가로 FR-11(캘린더 카테고리 체크 목록)과 헤더 프로필 팝업(WF 3.1)
- 도구: Playwright MCP(Chromium). 화면 조작과 함께, 화면으로 만들 수 없는 경우(타인 데이터·CSRF 위조·토큰 재사용)는 같은 브라우저 세션에서 `fetch`로 API를 직접 호출했다
- 환경: 백엔드 `npm run dev`(:3000), 프런트 Vite 개발 서버(:5173), 로컬 PostgreSQL. 언어 한국어·라이트 테마. 데스크톱 1280×800, 모바일 360×760
- 오늘 = 2026-11-06(금, Asia/Seoul). 시나리오의 예시 날짜(11-03)는 오늘 기준 상대 날짜로 바꿔 만들었다
- 테스트 계정: 실행마다 새로 가입(`e2e_u1_…`, `e2e_u2_…`, `e2e_u3_…@example.com`). 테스트 데이터는 DB에 남아 있다

## 1. 요약

| 구분 | 수 |
|------|----|
| 확인 항목 | 46 |
| 통과 | 44 → 재테스트 뒤 46 |
| 실패 (결함) | 2 → 재테스트 뒤 0 (D-1·D-2 수정, 6장) |

| # | 결함 | 심각도 | 시나리오 |
|---|------|--------|----------|
| D-1 (수정됨) | 편집 화면에서 저장하다 세션이 만료되면(리프레시 실패) 로그인 화면으로 가지만, 만료 안내 '로그인이 만료되었습니다. 다시 로그인해 주세요.'가 저장 실패 알림 '로그인이 필요합니다.'에 덮여 사라진다 | 중간 | SC-03 (B)·1a, SC-16 3a, AC-23 |
| D-2 (수정됨) | 설정 화면 시간대 드롭다운에 `UTC`가 없어 SC-12의 예시(Asia/Seoul → UTC)를 화면에서 수행할 수 없다. API는 `UTC`를 받는다(200) | 낮음 | SC-12 2 |

## 2. 시나리오별 결과

| SC | 확인 내용 | 결과 | 근거 | 화면 |
|----|-----------|------|------|------|
| SC-01 | 가입 → 자동 로그인 → 빈 목록, 기본 카테고리 1개, 쿠키 3종 | 통과 | 카테고리 `기본`, 쿠키 access·refresh·csrf | ![](screenshots/SC-01-signup-empty-list.png) |
| SC-01 2b | email 형식·빈 이름·짧은 비밀번호 → 필드 아래 사유 | 통과 | 오류 필드 3개 | ![](screenshots/SC-01-2b-signup-validation.png) |
| SC-01 3a | 대소문자만 다른 email 가입 | 통과 | 409 | — |
| SC-02 1a | 로그인 email 형식 위반 → 입력란 아래 사유 | 통과 | | ![](screenshots/SC-02-1a-login-format.png) |
| SC-02 2 | 틀린 비밀번호 → ERR-03, 없는 email도 같은 메시지 | 통과 | 둘 다 '이메일 또는 비밀번호가 올바르지 않습니다.' | ![](screenshots/SC-02-wrong-password.png) |
| SC-02 4 | 같은 계정 5회 실패 뒤 올바른 비밀번호도 거부 | 통과 | 실패 401×5, 다음 시도 상단 알림 '로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.' | ![](screenshots/SC-02-rate-limited.png) |
| SC-02 5 | 올바른 비밀번호 로그인 → 목록 | 통과 | | — |
| SC-03 (A) | 미인증 `/todos` 접근 → 로그인 화면, 만료 안내 없음 | 통과 | | ![](screenshots/SC-03-unauth-redirect.png) |
| SC-03 (B) | 편집 중 세션 만료 상태로 저장 → 로그인 화면 + 만료 안내 | **실패 (D-1)** → 재테스트 통과 | 이동은 정상, 안내 문구가 '로그인이 필요합니다.'로 바뀜 | ![](screenshots/SC-03-B-session-expired.png) |
| SC-03 4 | 재로그인 → 할일 목록 | 통과 | | — |
| SC-04 | 프로필 팝업 → 로그아웃, 쿠키 삭제, 뒤로 가기 시 로그인 요구 | 통과 | 남은 쿠키 0, 뒤로 가기 `/login` | ![](screenshots/SC-04-profile-popup.png) |
| SC-04 1a | 토큰 없는 상태 로그아웃 | 통과 | 200 | — |
| SC-05 | 할일 등록 → 기본 카테고리, '진행 중' | 통과 | `A 문서 작성 / 기본 / 2026-11-06 ~ 2026-11-08 / 진행 중` | ![](screenshots/SC-05-created.png) |
| SC-05 4a·4c | 공백 제목 + 시작일 > 종료일 → 저장 안 함 | 통과 | 오류 필드 `todo-title`, `todo-endDate` | ![](screenshots/SC-05-4a-4c-validation.png) |
| SC-05 4a | start = end 허용 | 통과 | 201 | — |
| SC-05 4b | 종료일 비움 → 저장 안 함 | 통과 | 오류 필드 `todo-endDate` | — |
| SC-05 4c | 제목 101자 | 통과 | 400 | — |
| SC-06 | 시작일을 내일로 수정 → '시작 전' 재판정 | 통과 | | ![](screenshots/SC-06-edit-form.png) |
| SC-06 1a | 없는(삭제된) 할일 편집 주소 | 통과 | '할일을 찾을 수 없습니다' | ![](screenshots/SC-06-1a-not-found.png) |
| SC-06 1b | 편집 취소 → 변경 없음 | 통과 | | — |
| SC-07 | 완료 표시 → '완료'(completedAt 기록), 해제 → '기한 초과'(completedAt null), 날짜 불변 | 통과 | | ![](screenshots/SC-07-completed.png) |
| SC-08 | 삭제 확인 취소 → 남음, 확인 → 삭제 | 통과 | 취소 후 GET 200, 확인 후 404 | ![](screenshots/SC-08-delete-confirm.png) |
| SC-09 | 기본 정렬과 필터 AND | 통과 | 전체 `T4,T2,T1,T3` / 진행 중 `T2,T1` / +업무 `T1` / 업무+기한 초과 `T4` / 해제 시 전체 | ![](screenshots/SC-09-list-all.png) ![](screenshots/SC-09-filter-doing-work.png) |
| SC-09 3a | 결과 없음 → 표 머리 + 안내 | 통과 | '조건에 맞는 할일이 없습니다' | ![](screenshots/SC-09-3a-empty-result.png) |
| SC-10 | 월간: 여러 날 할일 칸마다 반복, 달을 넘는 할일, 완료 할일 라벨 | 통과 | A 3칸, B 4칸(11월 그리드의 10/30·10/31·11/1·11/2), C '완료' | ![](screenshots/SC-10-month.png) |
| SC-10 4 | 10월로 이동 → B가 10/30·31에도 표시 | 통과 | | ![](screenshots/SC-10-4-prev-month.png) |
| SC-10 6 | 캘린더 할일 클릭 → 편집 화면 | 통과 | | — |
| SC-10 1a | 360px: 칸에 개수, 가로 스크롤 없음 | 통과 | 개수 표시 칸 12개 | ![](screenshots/SC-10-1a-mobile-month.png) |
| SC-11 | 주간 월~일, 일간 오늘, 다음으로 하루 이동 | 통과 | `11.02 - 11.08`, `2026.11.06` → `2026.11.07` | ![](screenshots/SC-11-week.png) ![](screenshots/SC-11-day.png) |
| SC-12 | 시간대 변경 저장, 할일 날짜 불변 | 통과 | Asia/Seoul → Europe/London(화면), A 시작일 그대로 | ![](screenshots/SC-12-timezone-saved.png) |
| SC-12 2 | 시나리오 예시 `UTC`를 화면에서 고르기 | **실패 (D-2)** → 재테스트 통과 | 드롭다운에 `UTC` 옵션 0개. API `PATCH /users/me {timezone:'UTC'}`는 200 | — |
| SC-12 3a | IANA가 아닌 값(`+09:00`) → 거부, 대체하지 않음 | 통과 | 400, 기존 값 유지 | — |
| SC-13 | '업무'(할일 3개) 삭제 확인에 '3개' → 삭제 뒤 기본으로 이동 | 통과 | 기본 할일 4 → 7 | ![](screenshots/SC-13-delete-confirm.png) ![](screenshots/SC-13-after-delete.png) |
| SC-13 2a·2b | `' 업무 '` 중복, 빈 이름 거부 | 통과 | '이미 있는 카테고리 이름입니다.' | ![](screenshots/SC-13-2a-duplicate.png) |
| SC-13 b | 기본 카테고리 변경·삭제 | 통과 | 화면 버튼 없음, API PATCH·DELETE 400 | — |
| SC-14 name | 빈 이름 거부, 변경 → 헤더 프로필 팝업에 즉시 반영, email 불변 | 통과 | | ![](screenshots/SC-14-name-in-popup.png) |
| SC-14 2a·2b | 틀린 현재 비밀번호(필드 아래 사유), 규칙 위반 새 비밀번호 거부 | 통과 | | ![](screenshots/SC-14-2a-wrong-current.png) |
| SC-14 4 | 변경 뒤 현재 기기 유지, 옛 비밀번호 401·새 비밀번호 200 | 통과 | | ![](screenshots/SC-14-password-changed.png) |
| SC-15 | 타인 할일 조회·수정·삭제 → 없는 ID와 같은 404 | 통과 | 응답 본문도 동일 | ![](screenshots/SC-15-other-user-todo.png) |
| SC-15 1a | 타인 카테고리로 등록·필터·삭제 → 404, 내 목록에 타인 할일 없음 | 통과 | | — |
| SC-15 1b | CSRF 헤더 없음·위조 → 403 | 통과 | | — |
| SC-16 | 액세스 토큰 없이 저장 → 자동 갱신 후 저장, 리프레시 회전 | 통과 | 끊김 없이 목록 복귀 | ![](screenshots/SC-16-auto-refresh-saved.png) |
| SC-16 4b | 폐기 토큰 10초 이내 재제출 → 401, 최신 토큰 유효 | 통과 | 401 / 200 | — |
| SC-16 4b | 폐기 토큰 10초 초과 재제출 → 401, 계열 전체 폐기 | 통과 | 재사용 401, 최신 토큰도 401 | — |
| FR-11 | 캘린더 사이드바에서 '기본' 체크 해제 → 기본 할일만 숨김, 재체크 → 표시 | 통과 | A 0칸, 업무 T1은 표시 | ![](screenshots/FR-11-category-hidden.png) |

## 3. 주요 화면

| 화면 | 캡처 |
|------|------|
| 할일 목록 (데스크톱) | ![](screenshots/MAIN-list-desktop.png) |
| 할일 목록 (360px) | ![](screenshots/MAIN-list-mobile.png) |
| 모바일 펼침 메뉴 | ![](screenshots/MAIN-mobile-menu.png) |
| 할일 등록 | ![](screenshots/MAIN-todo-new.png) |
| 설정 | ![](screenshots/MAIN-settings.png) |

## 4. 결함 상세

### D-1 세션 만료 안내가 저장 실패 알림에 덮임

- 재현: 로그인 → 할일 편집 화면에서 제목 수정 → (리프레시 토큰 만료·폐기 상태로 만듦) → 저장
- 기대(SC-03 3, SC-16 3a, AC-23): 로그인 화면 + '로그인이 만료되었습니다. 다시 로그인해 주세요.'
- 실제: 로그인 화면으로는 가지만 상단 알림이 '로그인이 필요합니다.'(오류)
- 원인(콘솔 로그로 확인): `main.tsx`의 `onUnauthorized`가 만료 안내를 띄우고 `/login`으로 이동한 직후, 저장 mutation의 `onError`(`TodoForm.tsx`의 `showAlert('error', e.message)`)가 같은 401을 받아 알림을 덮어쓴다
- 고칠 방향(제안): 화면별 `onError`에서 `UNAUTHORIZED`는 알림을 띄우지 않거나, `alertStore`가 만료 안내를 덮지 않게 한다

### D-2 시간대 목록에 UTC 없음

- 재현: 설정 → 시간대 드롭다운에서 `UTC` 찾기
- 원인: 목록을 `Intl.supportedValuesOf('timeZone')`로 만드는데 Chromium 결과에 `UTC`가 없다(`Etc/UTC`도 없음)
- 영향: SC-12·AC-13 예시를 화면으로 재현할 수 없다. 서버(VR-04)는 `UTC`를 받는다
- 고칠 방향(제안): 목록에 `UTC`를 추가하거나, 시나리오 예시를 목록에 있는 시간대로 바꾼다

## 5. 그 밖에 관찰한 것 (결함 아님, 참고)

- 설정 화면 섹션 제목에 우선순위 표기 `카테고리 (P1)`이 그대로 보인다 (`MAIN-settings.png`)
- 월간 캘린더 왼쪽 카테고리 목록 제목이 헤더 바로 아래에 붙어 있어 위 여백이 없다 (`SC-10-month.png`)

## 6. 결함 수정과 재테스트 (2026-11-06)

**수정**
- D-1: `store/alertStore.ts`에 고정(sticky) 알림 추가. 고정 알림은 `clearAlert`(닫기·로그인 시도) 전까지 오류 알림에 덮이지 않는다. `main.tsx`의 세션 만료 처리가 만료 안내를 고정으로 띄운다. 화면마다 `onError`를 고치지 않고 알림 한 곳에서 막아, 저장·삭제·조회 어느 경로에서 만료돼도 같은 결과다. Vitest `store/alertStore.test.ts` 1개 추가
  - 처음 시도한 '이동이 끝난 뒤 안내 띄우기'는 폼의 `onError`가 이동 뒤에도 불려 저장 경로에서 3회 모두 실패해 버렸다
- D-2: `features/user/TimezoneForm.tsx`에서 브라우저 목록에 `UTC`가 없으면 맨 앞에 붙인다

**검증**: tsc·ESLint·Prettier 통과, Vitest 105개 통과. Playwright 재테스트:

| 항목 | 결과 |
|------|------|
| D-1 편집 화면 저장 중 만료(3회 반복) | 3회 모두 `/login` + '로그인이 만료되었습니다. 다시 로그인해 주세요.', '로그인이 필요합니다.' 0건 |
| D-1 조회(캘린더 탭 이동) 중 만료 | 만료 안내 표시 |
| D-1 삭제 중 만료 | 만료 안내 표시 |
| 고정 안내 뒤 틀린 비밀번호 로그인 | ERR-03 안내가 정상 표시(고정이 풀림) |
| D-2 시간대 드롭다운 | 첫 항목 `UTC`(1개), 저장 → '시간대를 저장했습니다.', 새로고침 뒤 `UTC` 유지 |
| 회귀 SC-03 (A) 처음 접근 | 만료 안내 없음 |
| 회귀 SC-16 자동 갱신 저장 | 저장됨, 알림 없음 |
| 회귀 SC-04 로그아웃 | 만료 안내 없음 |

| 화면 | 캡처 |
|------|------|
| D-1 수정 뒤 (저장 중 만료) | ![](screenshots/SC-03-B-session-expired.png) |
| D-2 수정 뒤 (UTC 저장) | ![](screenshots/SC-12-timezone-utc.png) |

## 7. 테스트 중 바로잡은 판정 (스크립트 오류, 제품 문제 아님)

- SC-02 4: 처음 판정은 실패였다. 제한 안내는 `main` 밖의 상단 알림에 나오는데 `main` 안에서만 찾았기 때문이다. 캡처로 안내 문구를 확인해 통과로 바꿨다
- SC-10: B의 기대 칸 수를 2로 잡았으나 11월 월간 그리드는 10/26(월)부터 시작해 10/30·10/31도 포함하므로 4칸이 맞다(BR-12)
- SC-03 (B): 첫 시도는 페이지를 새로 열어(`goto`) 확인했는데, 이는 와이어프레임 2장의 '로그인한 적 없는 상태'와 같아 만료 안내가 없는 것이 맞다. 열려 있는 편집 화면에서 저장하는 방식으로 다시 확인해 D-1을 찾았다

## 8. 하지 않은 것

- SC-12의 '오늘' 경계 판정(AC-13: UTC 20:00에 서울은 다음 날)은 서버 시각을 바꿀 수 없어 확인하지 않았다. 시간대 저장과 날짜 불변만 확인했다
- SC-02 4a(IP별 10회 제한)는 개발 서버의 IP 제한에 걸려 이후 테스트를 막을 수 있어 하지 않았다. 계정별 5회 제한만 확인했다
- 실제 15분 액세스 만료·7일 리프레시 만료는 쿠키 삭제·값 교체로 재현했다
- Safari·Firefox, 영어·일본어, 라이트 밖 테마는 이번 범위에서 보지 않았다
- 재테스트 중 한 번, 세션 만료 직후 재로그인에서 `/users/me`가 401로 돌아와 다시 로그인 화면으로 간 적이 있다. 같은 순서로 6회 다시 해 보았으나 재현되지 않았다(테스트가 쿠키를 직접 바꾸는 과정의 타이밍 문제로 추정, 원인 미확인)

## 9. CSRF 제거 후 기능 재테스트 (2026-11-06)

사용자 결정으로 CSRF 토큰(`csrf_token` 쿠키·`X-CSRF-Token` 헤더·`CSRF_SECRET`·`COOKIE_DOMAIN`·`CSRF_FAILED`)을 코드와 문서에서 제거한 뒤, 상태를 바꾸는 요청을 모두 다시 확인했다. 교차 사이트 요청은 이제 SameSite 쿠키와 CORS 허용 목록으로만 막는다(NFR-15).

| 항목 | 결과 | 근거 |
| ---- | ---- | ---- |
| 자동 테스트 | 통과 | 백엔드 `npm test` 239/239(CSRF 전용 테스트 20개 삭제), 프런트엔드 Vitest 105/105, lint·타입 검사 통과 |
| SC-01 가입 → 자동 로그인, 발급 쿠키 | 통과 | 쿠키는 `access_token`·`refresh_token` 2종, `csrf_token` 없음 |
| SC-05·06·07·08 할일 등록·수정·완료·삭제 | 통과 | POST 201, PATCH 200, DELETE 204 ![](screenshots/NOCSRF-01-todo-updated.png) |
| SC-13 카테고리 등록·이름 변경·삭제 (설정 화면) | 통과 | POST 201, PATCH 200, DELETE 204 ![](screenshots/NOCSRF-02-categories.png) |
| FR-11 캘린더 사이드바 카테고리 등록 | 통과 | POST 201, 체크 목록에 추가됨 |
| SC-14·SC-12 이름 변경, 시간대 `UTC`, 비밀번호 변경 | 통과 | PATCH 200 ×2, PUT 200 ![](screenshots/NOCSRF-03-settings.png) |
| AC-22 액세스 쿠키 삭제 뒤 저장 → 자동 갱신 뒤 성공 | 통과 | refresh 200 뒤 POST 201, 쿠키 2종 재발급 |
| SC-04 로그아웃 → SC-02 새 비밀번호로 로그인 | 통과 | 로그아웃 뒤 쿠키 0, 로그인 200 ![](screenshots/NOCSRF-04-relogin.png) |
| 모든 상태 변경 요청에 `X-CSRF-Token` 헤더 없음, 403 응답 없음 | 통과 | 요청 15건 확인 |
| NFR-15 다른 출처(`http://127.0.0.1:3000`)에서 쿠키를 실은 JSON POST | 통과(차단) | 사전 요청에 CORS 허용이 없어 브라우저가 본 요청을 보내지 않음, 카테고리 생성 안 됨 |
| Swagger UI `/api/docs` | 통과 | 0.4.3, 18개 작업, 명세 오류 없음 |
