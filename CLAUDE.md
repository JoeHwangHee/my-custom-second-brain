# Second Brain — Claude 운영 지침

이 디렉토리는 개인 지식 저장소(Second Brain) 시스템이다.
모든 입력은 아래 절차에 따라 처리한다.

---

## 대화 시작 시 필수 절차 (순서 고정)

```
1. _pending.md 확인
   → 미결 항목 존재 시 사용자에게 먼저 안내
   → 처리 후 원래 의도로 복귀

2. _router.md 로드
   → 5단계 파이프라인에 따라 입력 의도 분기

3. 의도 확정 후 해당 규칙 파일로 이동
   Ingest → _rules/storage_rules.md
   Query  → _rules/query_rules.md
   Lint   → _lint_status.md 확인 후 _rules/lint_rules.md
```

MEMORY.md는 참조가 필요할 때만 로드한다. 대화 시작마다 자동 로드하지 않는다.

---

## 핵심 원칙

**Lazy Loading**: 각 단계에서 필요한 파일만 순차 로드한다.
탐색 중 파일을 미리 로드하거나 불필요한 파일을 읽지 않는다.

---

## 작업별 파일 로드 순서

### Ingest (저장)

```
_router.md
→ _rules/storage_rules.md
→ _rules/category_schema.md         (Step 1 Keyword Gate)
→ 해당 카테고리 _index.md           (Step 2 Tag Gate)
→ Thought 파일 생성
→ _index.md 업데이트                (entry_count+1, examples 보충)
→ _graph.md 업데이트                (크로스 카테고리 관계 존재 시)
→ _lint_status.md 업데이트          (ingest_since_lint +1)
→ log.md 기록
```

### Query (조회)

```
_router.md
→ _rules/query_rules.md
→ index.md                          (L1 카테고리 목록 확인)
→ 해당 L1/_index.md                 (Step 1 Keyword Routing)
→ 하위 _index.md 순차 탐색          (Step 2 Tag Navigation)
→ 최종 타깃 파일만 로드             (탐색 경로 외 파일 로드 금지)
→ [필요 시] 해당 레벨 _graph.md     (크로스 카테고리 관계 탐색)
→ log.md 기록
```

### Lint (정비)

```
_lint_status.md                     (트리거 조건 확인)
→ 조건 미충족 시: 중단
→ 조건 충족 시: _rules/lint_rules.md 로드 후 9단계 실행
```

Lint 트리거 조건:
- `ingest_since_lint ≥ 50` OR 마지막 Lint로부터 24시간 경과

---

## 파일 수정 권한

| 파일 | 수정 가능 주체 |
|---|---|
| MEMORY.md | 수정 금지 (초기 1회 작성으로 고정) |
| _router.md | 수정 금지 |
| _rules/*.md | 수정 금지 |
| index.md | Lint만 (분할 시) |
| category_schema.md | 수동만 (새 카테고리 추가 시) |
| _index.md | Ingest (entry_count, examples), Lint (헤더 정합성) |
| _graph.md | Ingest (크로스 엣지 추가), Lint (분할 시) |
| log.md | Ingest, Query, Lint (각 이벤트 기록) |
| _lint_status.md | Ingest (카운트 증가), Lint (갱신) |
| _pending.md | Lint (항목 추가), 수동 (처리 후 삭제) |
| Thought 파일 | Ingest (생성), Lint (frontmatter 갱신) |

---

## Thought 파일 형식 (참고)

```yaml
---
id: {카테고리코드}-{세부}-{날짜}-{순번}
title: 제목
memory_type: semantic | procedural | reflective | episodic
origin: first_party | curated | synthesized
confidence: high | medium | low
tags: [태그1, 태그2]
related:
  - id: {대상_파일_id}
    edge_type: extends | supports | contradicts | references
    link_strength: {float}
    co_occurrence_count: {int}
category_path: {L1}/{L2}/...
date: YYYY-MM-DD
content_lang: ko
---
본문
```

reflective 타입은 `related:` 필수, `tags`에 "reflective" 자동 추가.

---

## 불변 규칙 요약

- MEMORY.md, _router.md, _rules/*.md 는 어떤 작업에서도 수정하지 않는다
- 크로스 카테고리 관계만 _graph.md에 저장한다. 동일 카테고리 내 관계는 파일의 `related:` 섹션으로 처리한다
- 신규 관계(related:) 생성 시 co_occurrence_count = 0, link_strength = base_score로 초기화한다
- L1 카테고리 신규 생성은 자동으로 하지 않는다. 사용자 확인 후 생성한다. L2 이하 하위 카테고리는 유사도 임계(기존 하위와 75% 미만) 충족 시 자동 생성하고 부모 _index.md 하위목록을 동시 갱신한 뒤 log.md(CATEGORY)로 사후 통지한다
- log.md에 OTHER 이외의 모든 작업을 기록한다

---

## 전체 설계 레퍼런스

DESIGN.md에 설계 의도, 데이터 형식, 규칙 결정 근거 전체가 기술되어 있다.
규칙 파일만으로 맥락이 부족할 때 참조한다.
