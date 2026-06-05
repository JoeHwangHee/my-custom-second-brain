# Second Brain 시스템 설계 v5.0

이 문서는 설계 과정에서 결정된 모든 사항을 포함한 완전한 레퍼런스입니다.
실제 운영 규칙은 각 _rules/operations/ 파일에 기술되어 있으며, 이 문서는 설계 의도와 구조적 맥락을 보존합니다.

구조 결함 정비(#1–#9, G1–G4)의 end-to-end 검증 결과는 `./VERIFICATION.md` 참조.

---

## 1. 핵심 원칙

| 원칙 | 내용 |
|---|---|
| 토큰 절감 | Lazy Loading 철칙. 각 단계마다 필요한 파일만 순차 로드 |
| 완전한 이식성 | 순수 Markdown + 상대 경로. 외부 DB 의존 없음 |
| 미래 확장성 | Vector DB 전환 대비 임베딩 친화 메타데이터 선제 적용 |
| 외부 아키텍처 통합 | Karpathy LLM Wiki (Ingest/Query/Lint 3층), TEMPR 조회 전략 |

---

## 2. 디렉토리 구조 (v5.0 — 3계층)

```
second_brain/
├── CLAUDE.md                       ← 루트 고정 (Claude Code 자동 로드 부트스트랩)
│
├── _system/                        ← [Layer 1] 엔진 (불변)
│   ├── router.md                   ← 5단계 의도 분기
│   ├── DESIGN.md                   ← 이 파일. 설계 레퍼런스.
│   ├── VERIFICATION.md             ← end-to-end 검증 결과
│   └── MEMORY.md                   ← 정적. 초기 1회 작성 후 수정 금지.
│
├── _rules/                         ← [Layer 2] 규칙
│   ├── operations/                 ←   조작 규칙 (카테고리 무관 · 재사용 가능)
│   │   ├── storage_rules.md        ←   저장 규칙 (3단 캐스케이드)
│   │   ├── query_rules.md          ←   조회 규칙 (3단 캐스케이드 + TEMPR + RRF)
│   │   ├── delete_rules.md         ←   삭제 규칙 (정합성 즉시 보정)
│   │   └── lint_rules.md           ←   정비 규칙 (트리거, 점검 항목)
│   ├── categories/                 ←   카테고리 규칙 (정책/데이터)
│   │   ├── _active.md              ←   활성 스키마 바인딩 시임
│   │   └── category_schema.md      ←   카테고리별 포함/제외/경계 기준 (기본 스키마)
│   └── _state/                     ←   특수사항 (가변 제어 상태)
│       ├── _lint_status.md         ←   Lint 트리거 상태 전용
│       └── _pending.md             ←   사용자 확인 대기 항목
│
└── memory/                         ← [Layer 3] 실메모리
    ├── index.md                    ←   L1 카테고리 목록만 (경량 유지)
    ├── log.md                      ←   Append-only, 30일 롤오버
    ├── _graph.md                   ←   L1 간 크로스 엣지만
    └── {L1_category}/
        ├── _index.md               ←   헤더 + 하위 목록
        ├── _graph.md               ←   해당 L1 내 L2 간 크로스 엣지
        └── {L2_category}/
            ├── _index.md
            └── *.md                ←   Thought 파일
```

> **3계층 모델**: 엔진(`_system/`)은 의도 분기와 설계를, 규칙(`_rules/`)은 조작 규칙·카테고리
> 스키마·가변 상태를, 실메모리(`memory/`)는 데이터를 담는다. operation 규칙(storage/query/
> delete/lint)은 카테고리 스키마를 `_rules/categories/_active.md`의 "활성 스키마"로 추상 참조하므로,
> 스키마를 교체해도 operation 규칙은 그대로 재사용된다(관심사 분리 + 조합).
>
> **물리 경로 규칙**: `memory/` 내부 파일들의 상호 상대참조는 그대로 유효하다. 물리 접두사
> `memory/`가 필요한 곳은 `memory/` 바깥(`_system/`·`_rules/`·루트 `CLAUDE.md`)에서 안을
> 가리키는 참조뿐이다. Thought의 `category_path`와 `_index.md`의 `category:`는 `memory/` 하위
> 논리경로이며 접두사를 붙이지 않는다(스키마/메모리 재배치에 불변).
>
> **향후 확장(이번 범위 제외)**: 스키마별로 분리된 `memory/<schema>/` 서브트리(완전 병행)는
> 만들지 않는다. 현재는 단일 활성 스키마가 `memory/` 트리와 1:1 매핑된다.

---

## 3. 데이터 파일 형식

### 3-1. Thought File

```yaml
---
id: dl-health-20260524-001          # {카테고리코드}-{세부}-{날짜}-{순번}
title: 파일 제목
memory_type: semantic | procedural | reflective | episodic
origin: first_party | curated | synthesized
confidence: high | medium | low     # 정보 자체의 신뢰도
tags: [태그1, 태그2]
related:
  - id: dl-health-20260510-003
    edge_type: extends | supports | contradicts | references
    link_strength: 0.76             # Lint가 자동 재산정
    co_occurrence_count: 6          # 누적 공동 조회 횟수 (영속 보존)
category_path: daily_life/health/exercise
date: 2026-05-24
content_lang: ko
---

본문 (마크다운 태그 최소화로 임베딩 품질 보장)
```

**ID 규칙**: `{카테고리코드}-{세부}-{날짜}-{순번}`
- 카테고리코드는 L1 약어 (정본: `_rules/categories/category_schema.md`의 약어 레지스트리)
- ID 접두사만 파싱하면 파일을 읽지 않고 **L1** 카테고리 판단 가능 (토큰 절감)
- 단, ID 접두사는 **L1만 식별**한다. L2 이상의 cross 판정(같은 L1·다른 L2)은 ID로
  구분 불가하므로 `category_path` 비교로 한다 (_rules/operations/storage_rules.md 크로스 카테고리 관계 처리 참조)

### 3-2. _index.md 헤더

```yaml
---
category: daily_life/health
description: 신체 건강, 운동, 식단, 수면 관련 기록
keywords: [운동, 식단, 수면, 건강검진, 체중]
examples: ["헬스 루틴 변경", "저탄고지 식단 시작", "수면 패턴 분석"]
entry_count: 23
---

# 하위 항목 목록
(이하 파일 목록 또는 하위 카테고리 목록)
```

**필드 역할**:
- `description + keywords + examples`: 3단 캐스케이드 Step 2/3에서 LLM이 카테고리 진입 여부 판단에 사용
- `entry_count`: 해당 카테고리가 **직접 보유한** Thought 파일 수 (하위 누적 아님).
  중간노드(하위 카테고리만 보유)는 0. Lint 분할 트리거 판단 기준 (leaf entry_count 50 초과 시 분할 제안).
  Ingest의 +1은 파일이 저장된 leaf _index.md에만 적용.
- `examples`: 5개 미만 시 Ingest가 자동 보충, Lint가 유효성 검증

### 3-3. log.md 형식

```
{timestamp} | {TYPE} | {details}

QUERY  예시: 2026-05-30T09:15:00 | QUERY  | 운동 루틴 조회 | dl-health-001,dl-health-003
INGEST 예시: 2026-05-30T09:20:00 | INGEST | dl-health-20260530-006
LINT   예시: 2026-05-30T09:25:00 | LINT   | executed
OTHER  예시: 2026-05-30T09:30:00 | OTHER  | -
```

- QUERY 엔트리의 세 번째 필드: _system/router.md Stage 3에서 정규화된 subject
- QUERY 엔트리의 네 번째 필드: 실제 로드된 파일 ID 목록 (상한 10개)
- 30일 초과 항목은 Lint가 삭제. 단, LINT executed 최근 1건은 영구 보존

### 3-4. _lint_status.md 형식

```
last_lint: 2026-05-30T09:25:00
ingest_since_lint: 12
```

- `ingest_since_lint`: Ingest 시마다 +1, Lint 실행 시 0으로 초기화
- Lint 트리거 판단 시 이 파일만 읽으면 됨 (log.md 전체 로드 불필요)

### 3-5. _pending.md 형식

```yaml
- type: split_proposal
  category: daily_life/health
  detected: 2026-05-30T09:25:00
  suggested: [daily_life/health/exercise, daily_life/health/diet]
```

- Lint가 분할 조건 감지 시 여기에 기록 후 블로킹 없이 계속 진행
- _system/router.md Stage 0에서 대화 시작마다 확인하여 사용자에게 안내

### 3-6. _graph.md 형식

```markdown
| from_id | to_id | edge_type | link_strength |
|---|---|---|---|
| dl-health-001 | ln-nutrition-003 | supports | 0.64 |
```

- 카테고리 경계를 넘는 크로스 엣지만 저장
- 동일 카테고리 내 관계는 각 Thought 파일의 related: 섹션으로 처리
- 항목 100개 초과 시 Lint가 하위 레벨 분할 제안 → _pending.md 기록

---

## 4. memory_type 정의

| 타입 | 핵심 질문 | origin 제약 | related 필수 |
|---|---|---|---|
| semantic | 이것은 무엇인가 | 없음 | 선택 |
| procedural | 어떻게 하는가 | 없음 | 선택 |
| episodic | 언제 무슨 일이 있었나 | first_party만 | 선택 |
| reflective | 여러 경험에서 무엇을 알게 됐나 | first_party, synthesized만 | 필수 |

**reflective 특이사항**:
- tags에 "reflective" 자동 추가
- confidence 기본값: medium (주관적 통찰이므로)
- related의 edge_type은 synthesized 사용
- Query 시 "패턴/교훈/변화" 키워드 포함 쿼리면 keyword_score +0.2 보정

---

## 5. link_strength 공식

```
base_score (edge_type별 초기값):
  extends:    0.70
  supports:   0.60
  contradicts: 0.50
  references: 0.40

co_occurrence_score = min(co_occurrence_count / 20, 1.0)

초기값:      link_strength = base_score
Lint 재산정: link_strength = max(base_score, base_score × 0.6 + co_occurrence_score × 0.4)
```

- co_occurrence_count: log.md 롤오버와 무관하게 Thought 파일 frontmatter에 영속 보존
- 14회 이상 공동 조회되면 공식 결과가 base_score를 초과하며 자연 상승
- 신규 관계 생성 시 co_occurrence_count = 0, link_strength = base_score

---

## 6. 파일별 수정 주체

| 파일 | Ingest | Query | Lint | 수동 |
|---|---|---|---|---|
| _system/MEMORY.md | 금지 | 금지 | 금지 | 초기 1회만 |
| _system/router.md | 금지 | 금지 | 금지 | 시스템 변경 시만 |
| _rules/operations/*.md | 금지 | 금지 | 금지 | 시스템 변경 시만 |
| memory/index.md | 금지 | 금지 | 분할 시만 | 금지 |
| _index.md | entry_count+1, examples 보충 | 읽기만 | 헤더 정합성 수정 | 금지 |
| _graph.md | 크로스 엣지 추가 | 읽기만 | 분할 시 수정 | 금지 |
| memory/log.md | INGEST/CATEGORY/DELETE 기록 | QUERY 기록 | 30일 삭제 | 금지 |
| _rules/_state/_lint_status.md | ingest_since_lint +1 | 금지 | 갱신 | 금지 |
| _rules/_state/_pending.md | 금지 | 금지 | 항목 추가 | 처리 후 삭제 |
| _rules/categories/category_schema.md | 금지 | 금지 | 금지 | 카테고리 추가 시만 |
| _rules/categories/_active.md | 금지 | 금지 | 금지 | 활성 스키마 교체 시만 |
| Thought 파일 | 생성 | 읽기만 | frontmatter 수정 | 삭제(delete_rules) |

---

## 7. 검증 결과

구조 결함 정비(#1–#9, G1–G4)를 실제 입력으로 end-to-end 실행해 데이터 정합성을 확인한
검증 요약은 별도 문서에 보관한다.

- 경로: `./VERIFICATION.md`
- 내용: 시나리오별 입력·검증 대상·결과(PASS) 표, 핵심 확인 사항(G1/G2/#1/#9 등)
