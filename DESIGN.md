# Second Brain 시스템 설계 v4.0

이 문서는 설계 과정에서 결정된 모든 사항을 포함한 완전한 레퍼런스입니다.
실제 운영 규칙은 각 _rules/ 파일에 기술되어 있으며, 이 문서는 설계 의도와 구조적 맥락을 보존합니다.

---

## 1. 핵심 원칙

| 원칙 | 내용 |
|---|---|
| 토큰 절감 | Lazy Loading 철칙. 각 단계마다 필요한 파일만 순차 로드 |
| 완전한 이식성 | 순수 Markdown + 상대 경로. 외부 DB 의존 없음 |
| 미래 확장성 | Vector DB 전환 대비 임베딩 친화 메타데이터 선제 적용 |
| 외부 아키텍처 통합 | Karpathy LLM Wiki (Ingest/Query/Lint 3층), TEMPR 조회 전략 |

---

## 2. 디렉토리 구조

```
second_brain/
├── MEMORY.md                    ← 정적. 초기 1회 작성 후 수정 금지.
├── DESIGN.md                    ← 이 파일. 설계 레퍼런스.
│
├── [Schema Layer]
│   ├── _router.md               ← 5단계 의도 분기
│   └── _rules/
│       ├── storage_rules.md     ← 저장 규칙 (3단 캐스케이드)
│       ├── query_rules.md       ← 조회 규칙 (3단 캐스케이드 + TEMPR + RRF)
│       ├── lint_rules.md        ← 정비 규칙 (트리거, 점검 항목)
│       └── category_schema.md  ← 카테고리별 포함/제외/경계 기준
│
├── [Navigation Infrastructure]
│   ├── index.md                 ← L1 카테고리 목록만 (경량 유지)
│   ├── log.md                   ← Append-only, 30일 롤오버
│   ├── _lint_status.md          ← Lint 트리거 상태 전용
│   ├── _pending.md              ← 사용자 확인 대기 항목
│   └── _graph.md                ← L1 간 크로스 엣지만
│
└── [Data Layer]
    ├── {L1_category}/
    │   ├── _index.md            ← 헤더 + 하위 목록
    │   ├── _graph.md            ← 해당 L1 내 L2 간 크로스 엣지
    │   └── {L2_category}/
    │       ├── _index.md
    │       └── *.md             ← Thought 파일
    └── ...
```

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
- 카테고리코드는 L1 약어 (정본: `_rules/category_schema.md`의 약어 레지스트리)
- ID 접두사만 파싱하면 파일을 읽지 않고 **L1** 카테고리 판단 가능 (토큰 절감)
- 단, ID 접두사는 **L1만 식별**한다. L2 이상의 cross 판정(같은 L1·다른 L2)은 ID로
  구분 불가하므로 `category_path` 비교로 한다 (storage_rules.md 크로스 카테고리 관계 처리 참조)

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

- QUERY 엔트리의 세 번째 필드: _router.md Stage 3에서 정규화된 subject
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
- _router.md Stage 0에서 대화 시작마다 확인하여 사용자에게 안내

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
| MEMORY.md | 금지 | 금지 | 금지 | 초기 1회만 |
| _router.md | 금지 | 금지 | 금지 | 시스템 변경 시만 |
| _rules/*.md | 금지 | 금지 | 금지 | 시스템 변경 시만 |
| index.md | 금지 | 금지 | 분할 시만 | 금지 |
| _index.md | entry_count+1, examples 보충 | 읽기만 | 헤더 정합성 수정 | 금지 |
| _graph.md | 크로스 엣지 추가 | 읽기만 | 분할 시 수정 | 금지 |
| log.md | INGEST 기록 | QUERY 기록 | 30일 삭제 | 금지 |
| _lint_status.md | ingest_since_lint +1 | 금지 | 갱신 | 금지 |
| _pending.md | 금지 | 금지 | 항목 추가 | 처리 후 삭제 |
| category_schema.md | 금지 | 금지 | 금지 | 카테고리 추가 시만 |
| Thought 파일 | 생성 | 읽기만 | frontmatter 수정 | 금지 |
