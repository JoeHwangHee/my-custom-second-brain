# Second Brain — Claude 운영 지침 (v6.0 벡터 하이브리드)

이 디렉토리는 개인 지식 저장소(Second Brain) 시스템이다.
모든 입력은 아래 절차에 따라 처리한다.

**정체성**: 주제별 정보 아카이브가 아니라 **인지유형별 사고 기록**이다. L1 카테고리는
인지유형 5종(경험·개념·절차·통찰·주장)이고, 주제는 `tags` + 벡터 임베딩이 담당한다.

**아키텍처**: markdown(SSOT) + 로컬 임베딩 벡터DB(파생). 조회 라우팅은 `tools/` CLI(Ollama
bge-m3 + sqlite-vec)가 결정론적으로 수행하고, LLM은 인지유형 분류·edge 의미·답변 합성만 맡는다.

디렉토리:
`_system/`(엔진) · `_rules/`(규칙 — operations/categories/edges/_state) · `memory/`(실메모리) ·
`tools/`(임베딩 인덱싱·조회 CLI). `CLAUDE.md`만 루트에 고정된다(자동 로드 부트스트랩).

---

## 대화 시작 시 필수 절차 (순서 고정)

```
1. _rules/_state/_pending.md 확인
   → 미결 항목(split/reflective/reindex 등) 존재 시 사용자에게 먼저 안내 → 처리 후 복귀

2. _system/router.md 로드 → 5단계 파이프라인으로 입력 의도 분기

3. 의도 확정 후 해당 규칙 파일로 이동
   Ingest → _rules/operations/storage_rules.md
   Query  → _rules/operations/query_rules.md  (→ node tools/query.mjs 호출)
   Delete → _rules/operations/delete_rules.md
   Lint   → _rules/_state/_lint_status.md 확인 후 _rules/operations/lint_rules.md
```

_system/MEMORY.md는 참조가 필요할 때만 로드한다.

---

## 핵심 원칙

**Lazy Loading**: 각 단계에서 필요한 파일만 로드한다. 조회는 `tools/query.mjs`가 반환한 후보
파일만 읽는다(벡터가 후보를 좁히므로 캐스케이드 LLM 판단 불필요).

**스키마 바인딩**: operation 규칙은 카테고리/edge 스키마 파일명을 직접 박지 않고
`_rules/categories/_active.md`·`_rules/edges/_active.md`가 가리키는 활성 스키마를 참조한다.

**markdown = SSOT**: 벡터DB(`tools/.index/brain.db`)는 `tools/index.mjs --all`로 언제든 재생성
가능한 파생물이다(gitignore). 원본 정합성은 항상 markdown에 있다.

---

## 작업별 파일 로드 순서

실메모리의 물리 루트는 `memory/`다. 폴더는 인지유형당 flat(L2 토픽 폴더 없음).

### Ingest (저장)
```
_system/router.md → _rules/operations/storage_rules.md
→ 활성 스키마(_rules/categories/_active.md)로 인지유형(L1) 화행 판단 (다중신호면 분해)
→ Thought 파일 생성 (id={약어}-{YYYYMMDD}-{순번}, category_path=인지유형, memory_type 없음)
→ 활성 edge 스키마(_rules/edges/_active.md)로 related link_strength 초기화
→ node tools/index.mjs --file <경로>   (실패 시 _pending reindex_pending)
→ node tools/query.mjs --related <경로> → 관계후보 검토 → edge_type 선택 연결
→ 해당 인지유형 _index.md entry_count+1 / (다른 인지유형 간) memory/_graph.md 엣지
→ _rules/_state/_lint_status.md ingest_since_lint+1 → memory/log.md INGEST
```

### Query (조회)
```
_system/router.md → _rules/operations/query_rules.md
→ node tools/query.mjs "<subject>" [--type <인지유형>] [--tag <주제>] --json
→ 반환 후보(path)만 로드  (탐색 경로 밖 로드 금지)
→ [필요 시] edge graph_score 재순위 / memory/_graph.md
→ memory/log.md QUERY (accessed_file_ids)
```

### Delete (삭제)
```
_system/router.md → _rules/operations/delete_rules.md
→ 대상 frontmatter(category_path, related) → _index.md entry_count−1 / 역참조 / _graph.md 정리
→ 파일 삭제 → node tools/index.mjs --prune → memory/log.md DELETE
```

### Lint (정비)
```
_rules/_state/_lint_status.md (트리거: ingest_since_lint≥50 또는 명시 명령)
→ _rules/operations/lint_rules.md → node tools/lint.mjs [--apply]
→ 리포트(깨진링크/near-miss/reflective누락) 사용자 확인 → 상태 갱신·log
```

---

## 파일 수정 권한

| 파일 | 수정 가능 주체 |
|---|---|
| _system/MEMORY.md | 수정 금지 (단 v6.0 진입점 1줄은 시스템 변경 1회 예외로 갱신됨) |
| _system/router.md | 수정 금지 |
| _system/DESIGN.md / VERIFICATION.md | 수동만 (설계/검증 변경 시) |
| _rules/operations/*.md | 수정 금지 |
| _rules/categories/category_schema.md, _active.md | 수동만 |
| _rules/edges/edge_schema.md, _active.md | 수동만 (edge 온톨로지 변경 시) |
| tools/** (코드) | 수동만 (CLI 변경 시). tools/.index/ 는 CLI가 생성(파생물) |
| memory/index.md | 수동만 (인지유형 추가 시) |
| memory/{type}/_index.md | Ingest (entry_count, 목록), Lint (entry_count·examples centroid) |
| memory/_graph.md | Ingest (크로스 엣지), Lint |
| memory/log.md | Ingest/Query/Delete/Lint (각 이벤트) |
| _rules/_state/_lint_status.md | Ingest (카운트+1), Lint (갱신) |
| _rules/_state/_pending.md | Ingest (reindex_pending), Lint (split 등), 수동 (처리 후 삭제) |
| Thought 파일 | Ingest (생성), Delete (삭제), Lint (frontmatter 갱신) |

---

## Thought 파일 형식 (참고)

```yaml
---
id: ep-20260607-001                  # {인지유형약어}-{YYYYMMDD}-{순번}
title: 제목
origin: first_party | curated | synthesized
confidence: high | medium | low
tags: [주제1, 주제2]
related:
  - id: {대상_id}
    edge_type: extends | refines | instantiates | requires | supports | synthesized | triggered-by | contradicts | references | near-miss
    link_strength: {base_score}
    co_occurrence_count: 0
category_path: episodic              # 인지유형 한 토막 (flat)
date: YYYY-MM-DD
content_lang: ko
---
본문
```

- `memory_type` 필드는 없다(L1=category_path의 인지유형이 대신한다).
- reflective는 `related:` 필수(edge_type=synthesized 기본), tags에 "reflective" 자동 추가.
- 약어: episodic→ep, semantic→se, procedural→pr, reflective→rf, thesis→th (정본: category_schema.md).

---

## 불변 규칙 요약

- _system/MEMORY.md, _system/router.md, _rules/operations/*.md 는 작업 중 수정하지 않는다.
- edge/카테고리 수치는 `_rules/edges/edge_schema.md`·`category_schema.md`(활성 스키마)에만 둔다(operation 하드코딩 금지).
- 같은 인지유형 내 관계는 파일 `related:`로, **다른 인지유형 간만** `memory/_graph.md`에 저장한다.
- 신규 related 생성 시 co_occurrence_count=0, link_strength=base_score로 초기화한다.
- 인지유형(L1) 신규 생성은 자동으로 하지 않는다(고정 온톨로지, 사용자 확인 + scan.mjs TYPES 갱신).
- 저장 직후 반드시 `tools/index.mjs --file`로 벡터 색인한다(실패 시 reindex_pending).
- 벡터DB는 파생물이다 — markdown(SSOT)에서 `index --all`로 재생성한다.
- memory/log.md에 OTHER 이외의 모든 작업을 기록한다.

---

## 전체 설계 레퍼런스

`_system/DESIGN.md`(§v6.0)에 벡터 하이브리드 설계 의도·데이터 형식·이식성 재정의가 기술돼 있다.
`tools/README.md`에 부트스트랩(Ollama/npm) 절차와 CLI 레퍼런스가 있다.
