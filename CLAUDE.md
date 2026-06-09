# Second Brain — Claude 운영 지침 (v6.0 벡터 하이브리드)

이 디렉토리는 개인 지식 저장소(Second Brain) 시스템이다.
모든 입력은 아래 절차에 따라 처리한다.

**정체성**: 주제별 정보 아카이브가 아니라 **인지유형별 사고 기록**이다. L1 카테고리는
인지유형 5종(경험·개념·절차·통찰·주장)이고, 주제는 `tags` + 벡터 임베딩이 담당한다.

**아키텍처**: markdown(SSOT) + 로컬 임베딩 벡터DB(파생). 조회 라우팅은 `tools/` CLI(Ollama
bge-m3 + sqlite-vec)가 결정론적으로 수행하고, LLM은 인지유형 분류·edge 의미·답변 합성만 맡는다.

디렉토리:
`_system/`(엔진) · `_rules/`(규칙 — operations/categories/edges/_state) · `memory/`(실메모리) ·
`tools/`(임베딩 인덱싱·조회 CLI) · `.claude/`(운영 인터페이스 — 슬래시 명령·haiku 서브에이전트).
`CLAUDE.md`만 루트에 고정된다(자동 로드 부트스트랩).

---

## 4대 작업 — 슬래시 명령으로 위임

4대 작업(저장·조회·삭제·정리)은 슬래시 명령으로 진입한다. 무거운 규칙(router·operations·스키마
전문)은 메인이 로드하지 않고 각 **haiku 서브에이전트**(`.claude/agents/sb-*.md`)가 보유한다 —
메인은 명령 1개와 결과 요약만 부담한다(토큰 효율).

| 작업 | 명령 | 서브에이전트 | 메인의 최소 전처리 |
|---|---|---|---|
| 저장 | `/sb-ingest <내용>` | sb-ingest | 내용 전달 |
| 조회 | `/sb-query <질의>` | sb-query | 지시대명사 해소·subject 정규화 |
| 삭제 | `/sb-delete <대상>` | sb-delete | 대상 특정(모호 시 사용자 확인) |
| 정비 | `/sb-lint [--apply]` | sb-lint | 없음 |
| 미결 | `/sb-pending` | sb-pending | 없음 |

세션 시작 시 `_rules/_state/_pending.md`를 확인한다. 미결 항목(reindex_pending·reflective_pending·
new_category_proposal)이 있으면 **비차단 안내**한다 — "미결 N건, `/sb-pending` 권장"만 알리고 본
작업은 막지 않는다(처리 시점은 사용자 재량).

규칙 정본은 `_system/router.md`·`_rules/operations/*.md`·스키마(불변)에 그대로 있다. 슬래시 명령은
새 실행 경로일 뿐 정본을 대체하지 않는다. `_system/MEMORY.md`는 참조가 필요할 때만 로드한다.

---

## 핵심 원칙

**Lazy Loading**: 각 단계에서 필요한 파일만 로드한다. 조회는 `tools/query.mjs`가 반환한 후보
파일만 읽는다(벡터가 후보를 좁히므로 캐스케이드 LLM 판단 불필요).

**스키마 바인딩**: operation 규칙은 카테고리/edge 스키마 파일명을 직접 박지 않고
`_rules/categories/_active.md`·`_rules/edges/_active.md`가 가리키는 활성 스키마를 참조한다.

**markdown = SSOT**: 벡터DB(`tools/.index/brain.db`)는 `tools/index.mjs --all`로 언제든 재생성
가능한 파생물이다(gitignore). 원본 정합성은 항상 markdown에 있다.

---

## 메모리 물리 구조

실메모리의 물리 루트는 `memory/`다. 모든 Thought는 `memory/` 직속에 둔다(폴더 없음; 인지유형은
`category_path`로 식별). 각 작업의 상세 절차는 해당 서브에이전트 정의(`.claude/agents/sb-*.md`)와
정본 규칙(`_rules/operations/*.md`)에 있다. 삭제 정합성 보정(역참조·크로스 엣지·고아 벡터 prune·
log)은 결정론 스크립트 `tools/delete.mjs`가 전담한다.

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
| .claude/agents/*, .claude/commands/* | 수동만 (서브에이전트·슬래시 명령 정의) |
| tools/** (코드) | 수동만 (CLI 변경 시; delete.mjs 포함). tools/.index/ 는 CLI가 생성(파생물) |
| memory/index.md | 수동 (인지유형 목록), Lint (통계 섹션 entry_count·examples 자동 갱신) |
| memory/_graph.md | Ingest (크로스 엣지), Delete (역참조·크로스 정리, delete.mjs), Lint |
| memory/log.md | Ingest/Query/Delete/Lint (각 이벤트) |
| _rules/_state/_lint_status.md | Ingest (카운트+1), Lint (갱신) |
| _rules/_state/_pending.md | Ingest (reindex_pending/reflective_pending), Lint (new_category_proposal 등), sb-pending (자동분 제거), 수동 (처리 후 삭제) |
| Thought 파일 | Ingest (생성), Delete (삭제·역참조 정리), Lint (frontmatter 갱신) |

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
- 같은 인지유형 내 관계는 각 파일 `related:`에만 둔다(`_graph.md` 미기록). 다른 인지유형 간(크로스) 관계는 `memory/_graph.md`에 인덱싱한다. reflective의 필수 `synthesized`(→episodic 근거)·thesis의 supports/contradicts처럼 frontmatter `related:`에도 필요한 크로스 엣지는 양쪽에 둔다(`_graph.md`는 크로스 엣지 인덱스이지 배타적 저장소가 아니다). Lint은 두 위치를 모두 읽어 정합성을 본다(고아 오판정 방지·끊긴 크로스 엣지 탐지).
- 신규 related 생성 시 co_occurrence_count=0, link_strength=base_score로 초기화한다.
- 인지유형(L1) 신규 생성은 자동으로 하지 않는다(고정 온톨로지, 사용자 확인 + scan.mjs TYPES 갱신).
- 저장 직후 반드시 `tools/index.mjs --file`로 벡터 색인한다(실패 시 reindex_pending).
- 벡터DB는 파생물이다 — markdown(SSOT)에서 `index --all`로 재생성한다.
- memory/log.md에 OTHER 이외의 모든 작업을 기록한다.

---

## 전체 설계 레퍼런스

`_system/DESIGN.md`(§v6.0)에 벡터 하이브리드 설계 의도·데이터 형식·이식성 재정의가 기술돼 있다.
`tools/README.md`에 부트스트랩(Ollama/npm) 절차와 CLI 레퍼런스가 있다.
