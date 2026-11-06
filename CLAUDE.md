# TodoList App

## 반드시 지켜야할 지침

- 모든 응답은 한국어로 할 것
- 오버엔지니어링 금지
- SOLID 원칙 반드시 준수
- Clean Architecture 반드시 적용

## 프로젝트의 디렉토리 구조

- 백엔드 : backend/
- 프론트엔드 : frontend/
- 문서 : docs/

## 문서 목록

작업 전에 관련 문서를 먼저 읽는다. 규칙 원문은 각 문서(단일 출처)에만 있고, 다른 문서는 ID로 참조한다.

| 문서                                                       | 버전            | 내용                                                               |
| ---------------------------------------------------------- | --------------- | ------------------------------------------------------------------ |
| [docs/1-domain-definition.md](docs/1-domain-definition.md) | v0.13           | 도메인 정의서: 엔티티, 상태 판정, BR, UC, AC                       |
| [docs/2-prd.md](docs/2-prd.md)                             | v0.18           | PRD: FR 우선순위, VR, ERR, NFR, KPI, 리스크, 11장 후속 설계 항목   |
| [docs/3-user-scenario.md](docs/3-user-scenario.md)         | v0.8            | 사용자 시나리오: SC                                                |
| [docs/4-wireframe.md](docs/4-wireframe.md)                 | v0.15           | 와이어프레임: WF, 화면 흐름                                        |
| [docs/5-project-principle.md](docs/5-project-principle.md) | v0.25           | 프로젝트 구조 설계 원칙: PR, DL, CN, TQ, SO, 디렉토리 구조         |
| [docs/6-arch-diagram.md](docs/6-arch-diagram.md)           | v0.16           | 기술 아키텍처 다이어그램(mermaid): AD, 시퀀스 다이어그램           |
| [docs/7-erd.md](docs/7-erd.md)                             | v0.9            | ERD: 테이블·컬럼·제약·인덱스 (물리 이름·타입의 단일 출처)          |
| [docs/8-plan.md](docs/8-plan.md)                           | v0.63           | 실행 계획(WBS): COM, DB, BE, FE, QA Task와 일정                    |
| [docs/9-design.md](docs/9-design.md)                       | v0.16           | 설계서: PRD 11장 구현 값, API 엔드포인트 표, 토큰·쿠키·키 관리     |
| [docs/style-guide.md](docs/style-guide.md)                 | v0.7            | 스타일 가이드: 색·글꼴·간격 토큰, 컴포넌트·캘린더·반응형 시각 규칙 |
| [docs/schema.sql](docs/schema.sql)                         | 7-erd v0.9 기준 | PostgreSQL 17 DDL                                                  |
| [backend/swagger.yaml](backend/swagger.yaml)               | 0.4.4           | API 명세(OpenAPI 3.0.3)                                            |

문서를 수정하면 그 문서의 버전과 이력을 올리고, 위 표의 버전도 함께 갱신한다.
