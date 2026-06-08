# lint_rules.md — 정비 규칙 (v6.0 벡터 하이브리드)

읽기 정비(sync/통계/정합성리포트/near-miss)는 `tools/lint.mjs`(결정론)가, frontmatter/log/상태
**변경**(co_occurrence 재산정·log 30일 정리·`_lint_status` 리셋)은 LLM이 수기로 담당한다.
LLM은 `lint.mjs` 리포트를 받아 **사용자 확인/판단**을 하되, 자동 병합은 금지한다(§4·§5의 frontmatter/
상태 변경은 lint.mjs가 수행하지 않으므로 LLM이 직접, 신중히 적용). edge/카테고리 수치는 활성 스키마 참조.

---

## 1. 트리거 조건

`_rules/_state/_lint_status.md`를 읽어 판단한다.

```
내부 자동: ingest_since_lint ≥ 50  (유일한 내부 트리거)
주기 정비: 외부 메신저가 일반 Lint 명령("정비해줘") 주입 → 즉시 실행
(시간 기반 24h 조건 없음)
```

---

## 2. 실행 — tools/lint.mjs

```
node tools/lint.mjs            # 동기화 + 정합성/near-miss 리포트 (수정 없음)
node tools/lint.mjs --apply    # + memory/index.md 통계(entry_count·examples centroid) 자동 기록
```

`lint.mjs`가 수행하는 결정론 작업:

```
[sync]   tools/index.mjs --all 효과: 누락 임베딩 색인 + 고아 벡터 prune (md↔DB 동기)
         (reindex_pending 백스톱도 여기서 해소)
[index]  각 인지유형 entry_count·examples(centroid 최근접) 재산정 → memory/index.md 통계 섹션 (--apply)
[check]  깨진 링크(related id 부재), 고아 파일(참조 0), reflective related 누락 리포트
         (frontmatter related: + memory/_graph.md 크로스 엣지 양쪽 점검 → 끊긴 크로스 엣지=graph-broken-edge 탐지,
          크로스로만 연결된 노드는 고아 오판정 제외)
[near-miss] 임베딩 고유사 쌍(기본 ≥0.92) 중 related 없는 쌍을 중복 후보로 제시 (자동병합 금지)
```

---

## 3. LLM이 사용자 확인을 받아 처리하는 항목 (lint.mjs 리포트 기반)

```
- 깨진 링크: 해당 related 항목 제거 또는 사용자 확인
- reflective related 누락: 규칙 위반 → 근거 추가 요청 (또는 재분류)
- near-miss 후보: 사용자에게 "거의 중복" 제시 → near-miss 엣지 추가 / 병합 / 무시 중 택1
- 고아 파일: 목록화하여 사용자에게 확인
- 모순(contradicts) 쌍: 내용 충돌 심각 시 검토 요청
```

---

## 4. link_strength 재산정 (co_occurrence)

> (LLM 수행 — lint.mjs 미구현). 아래는 LLM이 직접 수행하는 frontmatter 변경 절차다.

```
1. memory/log.md에서 마지막 LINT 이후 QUERY 엔트리의 accessed_file_ids 추출
2. 각 쌍에 대해 한쪽 related: 에 상대 id가 있으면 co_occurrence_count += (함께 등장한 엔트리 수)
   (없으면 스킵 — 신규 관계 자동 생성 금지)
3. link_strength = max(base_score, base_score×0.6 + min(co_occurrence_count/20,1.0)×0.4)
   base_score는 활성 edge 스키마(_rules/edges/edge_schema.md) 참조.
4. 변경된 Thought frontmatter 및 (크로스면) memory/_graph.md 동기 갱신.
```

(데이터/QUERY 로그가 쌓이기 전에는 no-op. frontmatter 자동수정이므로 변경분만 신중히 적용.)

---

## 5. log.md 정리 + 상태 갱신

> (LLM 수행 — lint.mjs 미구현). lint.mjs는 log.md/_lint_status.md를 건드리지 않는다.

```
memory/log.md: 30일 초과 항목 삭제 (LINT executed 최근 1건은 영구 보존)
_rules/_state/_lint_status.md: last_lint = 현재 시각, ingest_since_lint = 0
memory/log.md: {timestamp} | LINT | executed
```

---

## 6. 분할 (향후)

flat 인지유형 구조에서는 L2 분할 클러스터링을 두지 않는다(주제는 tags+벡터). 인지유형당 파일이
과도하게 많아지면 사용자 판단으로 정비한다. 임베딩 클러스터 기반 자동 분할은 향후 확장 항목이다.
