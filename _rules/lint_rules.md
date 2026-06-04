# lint_rules.md — 정비 규칙

---

## 1. 트리거 조건

_lint_status.md를 읽어 아래 내부 조건 충족 시 실행한다.

```
내부 자동 조건: ingest_since_lint ≥ 50  (유일한 내부 트리거)

시간 기반(24h) 조건은 두지 않는다. LLM은 "24h 경과"를 스스로 주기 감지할 수 없으므로,
주기적 정비는 외부 메신저가 일반 Lint 명령("정비해줘")을 주입해 Stage 1 경로로 실행한다.
```

---

## 2. 실행 항목 (순서대로)

### Step 1 — _pending.md 미결 항목 안내

```
_pending.md에 항목이 존재하면 사용자에게 먼저 안내한다.
Lint 본체는 블로킹 없이 계속 진행한다.
```

### Step 2 — _index.md 헤더 정합성 점검

모든 카테고리의 _index.md 헤더를 순차 점검한다.

```
entry_count 검증:
  해당 카테고리가 직접 보유한 Thought 파일 수만 재산정 (하위 카테고리 파일 제외)
  중간노드는 직접 보유 파일이 없으므로 entry_count = 0이 정상
  _index.md의 entry_count와 불일치 시 자동 수정

examples 검증:
  examples에 기재된 파일 title이 실제로 해당 카테고리에 존재하는지 확인
  존재하지 않는 항목 제거 (파일 이동/삭제로 인한 고아 examples)
  examples 항목이 5개 미만이면 현재 카테고리 파일 중 최신 항목으로 자동 보충
  분할 후 편향된 샘플만 남은 경우 LLM이 카테고리 대표 항목으로 재선정

keywords 검증:
  카테고리 내 파일들의 tags 빈도 집계 (leaf용)
  상위 빈도 태그가 _index.md keywords에 없으면 추가 제안

  L1 keywords/description 정본 대조 (SSOT 사후 수렴):
    정본은 category_schema.md다. index.md 및 각 L1 _index.md의 L1
    keywords/description을 정본과 대조해 불일치 시 정본 기준으로 자동 수정한다.
    (완전 SSOT가 아니라 Lint 시점 사후 수렴 — Query는 파생본을 읽으므로)
```

### Step 3 — 분할 조건 점검

블로킹 없이 조건 감지 시 _pending.md에 기록 후 계속 진행한다.

```
_index.md 분할 조건:
  entry_count(직접 보유 파일 수, leaf 기준) > 50 감지 시:
  → _pending.md에 기록:
    - type: split_proposal
      category: {해당 카테고리 경로}
      detected: {현재 시각}
      suggested: [{제안 하위 카테고리 목록}]

_graph.md 분할 조건:
  항목 수 > 100 감지 시:
  → _pending.md에 기록:
    - type: graph_split_proposal
      level: {해당 _graph.md 경로}
      detected: {현재 시각}
```

### Step 4 — 분할 승인 후 처리

사용자가 _pending.md 항목을 승인한 경우에만 실행한다.

```
_index.md 분할 처리:
  1. 항목들을 의미 기반으로 클러스터링
  2. 하위 폴더 및 각 _index.md 생성
  3. 항목들을 각 하위 _index.md로 이관
  4. 상위 _index.md는 하위 카테고리 목록 + 한 줄 설명만 유지
  5. 이관된 Thought 파일들의 category_path 필드 새 경로로 일괄 업데이트
  6. 해당 레벨 _graph.md의 경로 참조 수정
  7. log.md에 split_reconciled 이벤트 기록

_graph.md 분할 처리:
  1. 엣지를 출발 노드의 카테고리 기준으로 클러스터링
  2. 하위 레벨 _graph.md 생성 후 이관
  3. 현재 레벨 _graph.md는 상위 크로스 엣지만 유지
```

### Step 5 — link_strength 재산정

```
1. log.md에서 마지막 LINT executed 이후 QUERY 엔트리만 추출
2. 각 QUERY 엔트리의 accessed_file_ids에서 모든 쌍(pair) 생성
   예: [A, B, C] → (A,B), (A,C), (B,C)
3. 각 쌍에 대해:
   → 둘 중 한 파일의 related: 섹션에 상대방 ID 존재 여부 확인
   → 존재하면 co_occurrence_count +N (해당 쌍이 함께 등장한 세션 수)
   → 존재하지 않으면 스킵 (신규 관계 자동 생성 금지)
4. co_occurrence_count 업데이트 후 link_strength 재산정:
   link_strength = max(base_score, base_score × 0.6 + co_occurrence_score × 0.4)
   co_occurrence_score = min(co_occurrence_count / 20, 1.0)
5. 변경된 Thought 파일 frontmatter 저장
6. 해당 쌍이 크로스 카테고리면 _graph.md도 동기 갱신:
   → 크로스 여부 및 기록 레벨은 storage_rules.md "크로스 카테고리 관계 처리"의
     category_path 비교 규칙을 따른다(L1 다름→root, 같은 L1·다른 L2→해당 L1).
   → 결정된 레벨 _graph.md에서 (from_id, to_id) 행을 찾아 link_strength를
     4번에서 재산정한 값과 동일하게 갱신한다.
   ※ link_strength가 Thought related:와 _graph.md 두 곳에 이중 저장되므로,
     이 동기 누락 시 graph 값이 base_score에 고착된다(정합성 결함 방지).
```

### Step 6 — 정합성 점검

```
모순 점검:
  contradicts 관계를 가진 파일 쌍에서 내용 충돌 수준 확인
  심각한 모순 발견 시 사용자에게 검토 요청

고아 페이지 점검:
  related: 섹션이 없는 reflective 파일 → 규칙 위반. 사용자에게 related 추가 요청
  어떤 파일에서도 참조되지 않는 파일 → 목록화하여 사용자에게 확인

깨진 링크 점검:
  related: 섹션의 id가 실제 파일로 존재하는지 확인
  존재하지 않는 id → 해당 related 항목 제거 또는 사용자 확인
  _graph.md 고아 엣지 점검: from_id/to_id 중 실제 파일로 존재하지 않는 id를
    참조하는 행 제거 (수동 삭제 시 즉시 보정 누락분의 백스톱)
```

### Step 7 — log.md 정리

```
30일 초과 항목 삭제
단, LINT executed 항목 중 가장 최근 1건은 날짜와 무관하게 보존
```

### Step 8 — _lint_status.md 갱신

```
last_lint: {현재 시각}
ingest_since_lint: 0
```

### Step 9 — log.md 기록

```
형식: {timestamp} | LINT | executed
예시: 2026-05-30T09:25:00 | LINT | executed
```
