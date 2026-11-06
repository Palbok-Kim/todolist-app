# TodoList App

일정 기반 할일 관리 웹 앱. 실행 명령은 이 파일 한 곳에 모은다(TQ-12). 규칙은 아래 문서에만 있다(PR-01).

| 문서 | 내용 |
|------|------|
| [1 도메인 정의서](docs/1-domain-definition.md) | 엔티티, 상태 판정, BR, UC, AC |
| [2 PRD](docs/2-prd.md) | FR, VR, ERR, NFR, KPI, 개발 환경(6장) |
| [3 사용자 시나리오](docs/3-user-scenario.md) | SC |
| [4 와이어프레임](docs/4-wireframe.md) | WF |
| [5 구조 설계 원칙](docs/5-project-principle.md) | PR, DL, CN, TQ, SO, 디렉토리 구조 |
| [6 아키텍처 다이어그램](docs/6-arch-diagram.md) | AD |
| [7 ERD](docs/7-erd.md) · [schema.sql](docs/schema.sql) | 테이블·제약·인덱스 |
| [8 실행 계획](docs/8-plan.md) | Task·완료 조건 |
| [9 설계서](docs/9-design.md) | 구현 값, API 엔드포인트, 환경 변수(6장) |
| [API 명세](backend/swagger.yaml) | OpenAPI 3.0.3 |

## 1. 준비 (최초 1회)

필요한 것: Node.js 22 이상, 로컬에 설치한 PostgreSQL 17(`localhost:5432`). Docker는 쓰지 않는다(PRD 6장).

1. 환경 변수는 디렉토리별로 둔다. `backend/.env`가 없으면 `backend/.env.example`을, `frontend/.env`가 없으면 `frontend/.env.example`을 복사해 만든다. 루트 `.env`(`.env.example`)는 DB 조회용 MCP 같은 공용 도구 키만 둔다. 키 설명은 9-design.md 6장, 서명 키 생성은 5.3. 비밀 값은 `.env`에만 둔다(SO-02, SO-03)
2. `backend/.env`의 `DATABASE_URL`이 가리키는 데이터베이스를 PostgreSQL에 만들어 둔다
3. 의존성 설치와 마이그레이션:

```sh
cd backend
npm ci
npm run migrate
cd ../frontend
npm ci
```

## 2. 실행

PostgreSQL을 먼저 띄운 뒤 터미널 두 개에서 실행한다(SO-08).

```sh
cd backend && npm run dev     # API  http://localhost:3000
cd frontend && npm run dev    # 화면 http://localhost:5173 (백엔드를 CORS로 직접 호출)
```

CORS 허용 출처는 `backend/.env`의 `CORS_ORIGINS`(기본 `http://localhost:5173`)로 정한다. 화면 포트를 바꾸면 이 값도 바꾼다.

API 문서(Swagger UI)는 개발 환경(`NODE_ENV=development`, `npm run dev` 기본값)에서만 열린다: http://localhost:3000/api/docs. API와 같은 출처라 Try it out을 쓸 수 있다.

## 3. 명령 모음

| 위치 | 명령 | 하는 일 |
|------|------|---------|
| `backend/` | `npm run migrate` | `migrations/`의 SQL을 번호 순서로 한 번씩 적용(SO-10) |
| `backend/` | `npm run seed -- dev` | 데모 사용자 2명(`demo0001@example.test` 등), 할일 10개씩(SO-11) |
| `backend/` | `npm run seed -- load` | 부하 계정 1000개, 사용자당 카테고리 5·할일 200(NFR-04). 약 65초 |
| `backend/` | `npm test` | `node:test` 테스트 |
| `frontend/` | `npm test` | Vitest 테스트 |
| `frontend/` | `npm run build` | 타입 검사 + 빌드 |
| 양쪽 | `npm run lint` | ESLint(레이어 규칙 DL-01·DL-11, `no-console` SO-06) |
| 양쪽 | `npm run format:check` | Prettier(루트 `.prettierrc`, TQ-10) |

- 시드 비밀번호는 `backend/.env`의 `SEED_PASSWORD`다. 시드는 `@example.test` 계정만 지우고 다시 만들며, `dev`와 `load`는 같은 도메인이라 서로를 지운다
