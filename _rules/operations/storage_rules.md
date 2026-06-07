# storage_rules.md — 저장 규칙 (v6.0 벡터 하이브리드)

`_system/router.md`에서 Ingest로 확정된 입력을 처리한다.

카테고리 스키마는 `_rules/categories/_active.md`가 가리키는 활성 스키마를, edge 정의는
`_rules/edges/_active.md`가 가리키는 활성 edge 스키마를 참조한다(파일명 직접 박지 않음).

> v5의 3단 캐스케이드(Keyword/Tag/Semantic)와 memory_type 필드는 폐지됐다. L1은 **인지유형**이고,
> 분류는 LLM이 화행으로 1회 판단한다(어차피 글을 읽으므로 추가 토큰 없음). 조회 라우팅은 벡터가 한다.

---

## 1. 인지유형(L1) 결정 — LLM 화행 판단

입력 내용을 읽고 활성 스키마의 인지유형 5종 중 하나로 분류한다.

```
episodic  : 시간/장소가 있는 1인칭 경험 ("~했다")        · origin: first_party만
semantic  : 사실·개념·정의 ("~이다", "~란")
procedural: 절차·방법 ("~하는 법", "먼저~그다음")
reflective: 복수 경험서 도출한 메타 통찰 ("되돌아보니~")  · related 필수, tags에 "reflective"
thesis    : 명시적 주장·입장·평가 ("~해야 한다", "~라고 본다")
```

### 다중 화행 신호 → 분해 저장
한 입력에 여러 인지유형이 섞이면(예: "운동했더니 꾸준함이 중요하다 싶다"):
- 경험은 episodic, 통찰은 reflective로 **분해**해 각각 Thought를 만든다.
- reflective는 `related:` 필수 → 분해된 episodic을 근거로 `synthesized` 엣지로 자동 연결한다
  (다른 인지유형 간이므로 `memory/_graph.md`에도 기록).
- 애매하면 지배적 신호로 단일 분류한다.

주제(운동·식단 등)는 L1이 아니라 `tags`로 기록한다. 모든 Thought는 `memory/` 직속에 저장하며
(폴더 없음), 인지유형은 `category_path`로 식별한다.

---

## 2. Thought 파일 생성

### 형식 (memory_type 없음)
```yaml
---
id: {약어}-{YYYYMMDD}-{순번}          # 예 ep-20260607-001
title: 제목
origin: first_party | curated | synthesized
confidence: high | medium | low
tags: [주제1, 주제2]
related:
  - id: {대상_id}
    edge_type: {활성 edge 스키마의 edge_type}
    link_strength: {base_score}       # edge 스키마의 base_score로 초기화
    co_occurrence_count: 0
category_path: {인지유형}              # 예 episodic (한 토막, flat)
date: YYYY-MM-DD
content_lang: ko
---
본문 (마크다운 태그 최소화 — 임베딩 품질)
```

### ID 생성 (세부 토막 없음)
```
형식: {인지유형약어}-{YYYYMMDD}-{순번}
약어: 활성 스키마 약어 레지스트리 (episodic→ep, semantic→se, procedural→pr, reflective→rf, thesis→th)
순번 산정: memory/ 직속에서 글롭 `{약어}-{날짜}-*.md`의 순번 최댓값 + 1, 3자리 zero-pad.
  (약어가 인지유형을 식별하므로 flat에서도 폴더 없이 충돌 없음)
  생성 직전 동일 ID 부재 재확인. 존재 시 +1 재시도. (덮어쓰기 금지)
ID 접두사 파싱만으로 L1=인지유형 식별(토큰 절감).
```

### 특수 규칙 (L1별)
```
reflective: related 필수(edge_type=synthesized 기본), tags에 "reflective" 자동, confidence 기본 medium.
  related 근거를 특정 못 하면 reflective로 저장하지 않는다 — episodic/semantic으로 재분류하거나
  _rules/_state/_pending.md에 reflective_pending으로 보류한다.
thesis: 근거를 related의 supports/contradicts로 연결(권장).
episodic: origin: first_party만 허용.
```

### link_strength 초기값 / 크로스 카테고리
```
신규 related: 생성 시 link_strength = 활성 edge 스키마의 base_score, co_occurrence_count = 0.

크로스 엣지(다른 인지유형 간만):
  - 같은 인지유형 내 관계 → 각 파일 related: 로만 처리(graph 미기록).
  - 다른 인지유형 간 → memory/_graph.md 에 행 추가: | from_id | to_id | edge_type | link_strength |
  (flat 구조라 같은 인지유형 내 L2 cross는 존재하지 않는다. per-type _graph.md 없음.)
```

### 관계 자동 발견 (벡터)
```
파일 작성 후 `node tools/query.mjs --related <새파일경로> --json` 호출 →
top-k 유사 후보를 받아 related 후보로 검토한다. LLM은 후보별 edge_type(의미)만 선택해 연결한다
(연결을 떠올릴 부담 제거, 회수율↑). 무관하면 연결하지 않는다.
```

---

## 3. 통계 (Lint 전담)
```
flat 구조에서 entry_count/examples는 순수 파생 통계다. Ingest는 통계를 건드리지 않는다.
Lint(tools/lint.mjs --apply)가 memory/index.md 통계 섹션을 centroid로 재산정한다.
```

---

## 4. 벡터 인덱싱 (필수)
```
저장 직후: node tools/index.mjs --file <새파일경로>
  성공: 벡터DB upsert 완료.
  실패(Ollama 미기동 등): md는 보존하되 경고 출력 + _rules/_state/_pending.md에 기록
    - type: reindex_pending
      file: <경로>
      detected: {시각}
  → 백스톱: 다음 Lint의 node tools/index.mjs --all 이 누락분을 재색인한다.
```

---

## 5. 상태/로그
```
_rules/_state/_lint_status.md: ingest_since_lint +1
memory/log.md: {timestamp} | INGEST | {file_id}   (분해 저장 시 각 id, 자동 생성 시 CATEGORY도)
```

---

## 6. Ingest self-check (원자성)
```
[ ] Thought 파일 생성 (ID 중복 없음 재확인)
[ ] (다중신호) 분해 저장 + reflective→episodic synthesized 연결(+_graph.md)
[ ] (다른 인지유형 간) memory/_graph.md 엣지 추가
[ ] node tools/index.mjs --file 호출 (실패 시 reindex_pending 기록)
[ ] node tools/query.mjs --related 로 관계후보 검토 → edge_type 선택 연결
[ ] _lint_status.md ingest_since_lint +1
[ ] memory/log.md INGEST 기록

내부 Lint 트리거: 보정 후 ingest_since_lint ≥ 50 이면 사용자에게 Lint 실행 안내.
```

---

## 7. 삭제 → _rules/operations/delete_rules.md
