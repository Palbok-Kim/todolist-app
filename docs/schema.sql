-- TodoList 데이터베이스 스키마 (PostgreSQL 17)
-- 근거: docs/7-erd.md v0.6 (단일 출처). 규칙 원문은 ERD와 도메인 정의서·PRD를 따른다.
-- 작성: MinjeYu, 2026-11-04
--
-- 범위
--   - 테이블 4개(users, categories, todos, refresh_tokens), 제약, 인덱스만 정의한다.
--   - 할일 상태, 로그인 실패 카운터, 액세스·CSRF 토큰은 저장하지 않는다(ERD 3.4, ER-07).
--   - 리프레시 토큰은 SHA-256 해시만 refresh_tokens에 저장한다(ER-08, 사용자 결정(2026-11-04), NFR-07).
--   - schema_migrations는 마이그레이션 러너가 만든다(SO-10). 이 파일에는 없다.
--   - updated_at은 트리거 없이 앱이 쓰기 SQL에서 `updated_at = now()`로 갱신한다(EQ-02).
--   - 앱 검증(VR, BR)이 먼저이고, 아래 CHECK는 보강이다(ERD 4장, EQ-03).
--   - gen_random_uuid()는 PostgreSQL 13부터 코어 함수라 확장이 필요 없다.

BEGIN;

-- ER-01 users
CREATE TABLE users (
    id            uuid        NOT NULL DEFAULT gen_random_uuid(),
    email         text        NOT NULL,
    password_hash text        NOT NULL,  -- 알고리즘·파라미터·salt·해시를 한 문자열로 저장(NFR-06, 포맷은 PRD 11장)
    name          text        NOT NULL,
    timezone      text        NOT NULL,  -- IANA 이름 검증은 앱에서만(VR-04, EQ-06), 기본값 없음
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT pk_users PRIMARY KEY (id),
    CONSTRAINT uq_users_email UNIQUE (email),
    CONSTRAINT ck_users_email_lower CHECK (email = lower(email)),            -- 소문자 저장으로 대소문자 무시 중복을 막는다
    CONSTRAINT ck_users_email_length CHECK (char_length(email) BETWEEN 1 AND 254),  -- VR-01
    CONSTRAINT ck_users_name_length CHECK (char_length(name) BETWEEN 1 AND 50),     -- VR-03
    CONSTRAINT ck_users_timezone_not_blank CHECK (timezone <> '')
);

-- ER-02 categories
CREATE TABLE categories (
    id         uuid        NOT NULL DEFAULT gen_random_uuid(),
    user_id    uuid        NOT NULL,
    name       text        NOT NULL,
    is_default boolean     NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT pk_categories PRIMARY KEY (id),
    CONSTRAINT fk_categories_user_id FOREIGN KEY (user_id)
        REFERENCES users (id) ON DELETE RESTRICT,                             -- EQ-05
    CONSTRAINT uq_categories_id_user_id UNIQUE (id, user_id),                 -- todos 복합 FK 대상(EQ-04)
    CONSTRAINT ck_categories_name_length CHECK (char_length(name) BETWEEN 1 AND 30),  -- VR-07
    CONSTRAINT ck_categories_name_trimmed CHECK (name = btrim(name))          -- BR-14 보강
);

-- 같은 사용자 안에서 trim 후 대소문자 무시 고유(BR-14, EQ-03). 위반은 앱이 ERR-04로 번역한다.
CREATE UNIQUE INDEX uq_categories_user_id_lower_name
    ON categories (user_id, lower(name));

-- 사용자당 기본 카테고리는 최대 1개(BR-03, BR-05). 최소 1개는 가입 트랜잭션이 보장한다(ER-04).
CREATE UNIQUE INDEX uq_categories_user_id_default
    ON categories (user_id) WHERE is_default;

-- ER-03 todos
CREATE TABLE todos (
    id           uuid        NOT NULL DEFAULT gen_random_uuid(),
    user_id      uuid        NOT NULL,
    category_id  uuid        NOT NULL,
    title        text        NOT NULL,
    description  text,                    -- 빈 입력은 앱이 NULL로 정규화(EQ-08)
    start_date   date        NOT NULL,
    end_date     date        NOT NULL,
    completed    boolean     NOT NULL DEFAULT false,
    completed_at timestamptz,
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT pk_todos PRIMARY KEY (id),
    CONSTRAINT fk_todos_user_id FOREIGN KEY (user_id)
        REFERENCES users (id) ON DELETE RESTRICT,                             -- EQ-05
    -- 다른 사용자의 카테고리를 가리키지 못하게 하는 복합 FK(BR-02, EQ-04).
    -- RESTRICT: 카테고리 삭제 전에 앱이 같은 트랜잭션에서 할일을 기본 카테고리로 옮긴다(BR-06, AQ-08).
    CONSTRAINT fk_todos_category_id_user_id FOREIGN KEY (category_id, user_id)
        REFERENCES categories (id, user_id) ON DELETE RESTRICT,
    CONSTRAINT ck_todos_title_length CHECK (char_length(title) BETWEEN 1 AND 100),  -- VR-05
    CONSTRAINT ck_todos_title_not_blank CHECK (btrim(title) <> ''),           -- BR-09 보강
    CONSTRAINT ck_todos_description_length CHECK (
        description IS NULL OR char_length(description) BETWEEN 1 AND 1000    -- VR-06, 빈 문자열은 NULL로 저장
    ),
    CONSTRAINT ck_todos_date_order CHECK (start_date <= end_date),            -- BR-07
    CONSTRAINT ck_todos_completed_at CHECK (completed = (completed_at IS NOT NULL))  -- BR-13, EQ-07
);

-- 목록 기본 정렬(BR-11), 상태 필터, 캘린더 기간 겹침(NFR-05). EXPLAIN으로 확인 후 조정한다.
CREATE INDEX idx_todos_user_id_end_date_start_date_created_at
    ON todos (user_id, end_date, start_date, created_at);

-- 카테고리 필터, 카테고리별 할일 수, 삭제 때 이동, 복합 FK 검사(BR-06).
CREATE INDEX idx_todos_user_id_category_id
    ON todos (user_id, category_id);

-- ER-08 refresh_tokens (사용자 결정(2026-11-04): Refresh Token 적용, 세부는 위임 결정(2026-11-04) EQ-10·EQ-11)
CREATE TABLE refresh_tokens (
    id         uuid        NOT NULL DEFAULT gen_random_uuid(),
    user_id    uuid        NOT NULL,
    family_id  uuid        NOT NULL,  -- 로그인 계열. 갱신은 같은 값을 잇고 재사용 감지·로그아웃은 계열 단위로 폐기(EQ-10)
    token_hash text        NOT NULL,  -- 토큰 원문의 SHA-256 해시만 저장한다. 원문은 저장하지 않는다(NFR-07)
    expires_at timestamptz NOT NULL,  -- 발급 + 7일(슬라이딩, OI-18)
    revoked_at timestamptz,           -- NULL이면 유효. 폐기된 행은 만료 전에 지우지 않는다(재사용 감지, EQ-11)
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT pk_refresh_tokens PRIMARY KEY (id),
    CONSTRAINT fk_refresh_tokens_user_id FOREIGN KEY (user_id)
        REFERENCES users (id) ON DELETE RESTRICT,                             -- EQ-05와 같다
    CONSTRAINT uq_refresh_tokens_token_hash UNIQUE (token_hash),
    CONSTRAINT ck_refresh_tokens_token_hash_not_blank CHECK (token_hash <> ''),
    CONSTRAINT ck_refresh_tokens_expires_after_created CHECK (expires_at > created_at),
    CONSTRAINT ck_refresh_tokens_revoked_after_created CHECK (revoked_at IS NULL OR revoked_at >= created_at)
);

-- 비밀번호 변경 때 사용자의 모든 토큰 폐기, 로그인 때 만료 행 정리(PRD 4.4, OI-21).
CREATE INDEX idx_refresh_tokens_user_id
    ON refresh_tokens (user_id);

-- 재사용 감지·로그아웃 때 계열 폐기(BR-16, AC-24).
CREATE INDEX idx_refresh_tokens_family_id
    ON refresh_tokens (family_id);

COMMIT;
