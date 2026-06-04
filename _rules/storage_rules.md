# storage_rules.md — 저장 규칙

_router.md에서 Ingest로 확정된 입력을 처리한다.

---

## 1. 카테고리 결정 — 3단 캐스케이드

### Step 1 — Keyword Gate (결정론적)

```
입력 콘텐츠에서 키워드 추출
→ category_schema.md의 각 카테고리 keywords 목록과 대조
→ 매칭 카테고리 존재 시: 즉시 해당 경로로 저장. Step 2, 3 스킵.
```

### Step 2 — Tag Gate (준결정론적)

```
Step 1 실패 시 진입
→ 입력 콘텐츠의 tags 필드와 각 _index.md 헤더의 keywords 대조
→ 매칭 카테고리 존재 시: 해당 경로로 저장. Step 3 스킵.
```

### Step 3 — Semantic Fallback (LLM 판단)

```
Step 1, 2 모두 실패 시 진입
→ LLM이 후보 _index.md 헤더(description + keywords + examples) 읽고 판단
→ 유사도 75% 이상: 해당 경로 저장
→ 유사도 75% 미만: 사용자에게 새 카테고리 생성 제안

제안 형식:
  "입력하신 내용은 기존 카테고리와 다른 주제로 판단됩니다.
   제안 카테고리: [경로/제안명]
   이유: [한 줄 근거]
   → 생성하시겠습니까? (Y / N / 직접 경로 입력)"

  Y:          제안 경로로 카테고리 생성 후 저장
  N:          가장 유사한 기존 카테고리에 저장
  직접 입력:  사용자 지정 경로로 생성 후 저장

주의: Step 3의 "새 카테고리 생성 제안(사용자 확인)"은 신규 L1이 필요한 경우에만 적용한다.
기존 L1 하위의 leaf가 없거나 적합 leaf가 없을 때는 사용자 확인 없이 Step 4에서 자동 생성한다.
```

### Step 4 — leaf 도달 및 L2 이하 자동 생성

```
캐스케이드로 L1을 확정한 뒤, 실제 저장 위치인 leaf까지 내려간다.

1. 해당 L1 아래로 캐스케이드(Step 1~3)를 반복해 적합 leaf 탐색.
   → 적합 leaf 존재: 그 leaf에 저장. (이하 절차 종료)

2. leaf 미존재(L1이 중간노드뿐이거나 하위가 비어 있음) 또는 적합 leaf 없음:
   → L2 이하 하위 카테고리를 자동 생성한다(사용자 확인 불필요).
     단, 기존 하위와 유사도 75% 미만일 때만 신설한다(Step 3 임계 재사용).
     75% 이상이면 가장 유사한 기존 leaf에 저장한다.

   자동 생성 절차:
     a. 콘텐츠 주제로 하위 카테고리명(L2/L3...) 결정
     b. 폴더 생성 + leaf _index.md 생성
        (헤더: category / description / keywords / examples: [] / entry_count: 0)
        필요 시 해당 레벨 _graph.md 초기화
     c. ★ 부모(중간노드) _index.md의 "## 하위 카테고리" 표에 신규 leaf 행 추가.
        표/섹션이 없으면(예: 비어 있던 learning/_index.md) 섹션을 신설하고 첫 행 기재.
        부모 중간노드의 entry_count는 0으로 유지(불변).
     d. 생성된 leaf에 Thought 파일 저장
     e. log.md에 CATEGORY 이벤트 기록: {timestamp} | CATEGORY | {created_path}

원칙: L1 신규 생성만 사용자 확인. L2 이하는 임계 충족 시 자동 생성 후 log로 사후 통지.
```

---

## 2. Thought 파일 생성 규칙

### ID 생성

```
형식: {카테고리코드}-{세부}-{날짜}-{순번}
예시: dl-health-20260524-001

카테고리코드: L1 약어 (daily_life → dl, learning → ln 등)
날짜: YYYYMMDD
순번: 해당 카테고리+날짜 조합 기준 오늘의 누적 순번 (001부터 시작)

ID 접두사 파싱만으로 카테고리 판단 가능하도록 설계.
파일을 읽지 않고 크로스 카테고리 여부 판단에 활용.
```

### 순번 산정 절차 (필수)

```
순번은 log.md로 세지 않는다. log.md는 30일 롤오버되므로 과거 순번이 사라져
카운트가 리셋되고, 같은 날 2건째 저장 시 -001이 재발급되어 기존 파일을 덮어쓴다.

대신 디렉토리를 직접 스캔한다:
  1. 저장 대상 L2 폴더에서 {카테고리코드}-{세부}-{날짜}-*.md 글롭
  2. 기존 파일들의 순번 중 최댓값 확인 (없으면 0)
  3. 신규 순번 = 최댓값 + 1, 3자리 zero-pad (001, 002, ...)
  4. 생성 직전 동일 ID 파일 부재를 재확인. 존재 시 순번 +1 후 재시도.

원칙: 동일 (카테고리·날짜) 내에서 ID는 절대 재사용/덮어쓰기 하지 않는다.
```

### memory_type 결정 기준

```
semantic:    세계에 대한 사실, 개념 서술
procedural:  절차, 방법, 수행 방식
episodic:    시간/장소가 있는 개인 경험 (origin: first_party만 허용)
reflective:  복수 경험/지식에서 도출한 메타 수준 통찰

reflective 분류 신호:
  - "되돌아보면", "생각해보니", "패턴을 발견했다"
  - "예전과 달리", "알게 됐다" (메타적 맥락)
  - 복수의 과거 경험을 종합하는 서술

혼동 방지:
  단일 경험 + 감상    → episodic
  외부 지식 + 의견    → semantic
  복수 경험 + 메타통찰 → reflective
```

### reflective 파일 특수 규칙

```
- related: 섹션 필수 (참조 근거 없으면 reflective 불가)
- related의 edge_type: synthesized 사용
- confidence 기본값: medium
- tags에 "reflective" 자동 추가
```

#### related 누락 시 Ingest 시점 강제 (Lint까지 미루지 않음)

```
reflective로 분류됐으나 참조할 related 대상을 특정할 수 없으면:
  1. 사용자에게 근거 파일을 요청한다:
     "이 통찰의 근거가 된 기존 기록을 알려주시겠습니까? (id 또는 주제)"
  2. 사용자가 제시 → 해당 id로 related 구성 후 저장
  3. 근거 없음/불명 → reflective로 저장하지 않는다. 둘 중 하나로 처리:
     - memory_type을 episodic/semantic으로 재분류하여 저장, 또는
     - _pending.md에 보류 항목으로 기록하고 저장 보류
       (type: reflective_pending, detected, content 요약)
원칙: related 없는 reflective 파일을 생성하지 않는다.
```

### link_strength 초기값

```
신규 related: 항목 생성 시:
  co_occurrence_count: 0
  link_strength: base_score (edge_type에 따라 결정)

  base_score:
    extends:     0.70
    supports:    0.60
    contradicts: 0.50
    references:  0.40
```

### 크로스 카테고리 관계 처리

```
1차 필터 (저렴): related: 대상 파일 ID 접두사(L1 약어)를 파싱해 현재 파일 L1 약어와 비교.
  L1 약어 매핑은 category_schema.md의 "L1 카테고리 약어 레지스트리"를 참조한다.

정밀 판정: 양 파일의 category_path를 비교해 기록 레벨을 결정한다.
  ※ ID 접두사는 L1만 식별하므로 같은 L1·다른 L2 크로스(예: dl-health vs dl-diet)는
    ID만으로 판단 불가하다. 반드시 category_path로 L2 이하 경계를 비교한다.

  - L1이 다르면        → root /_graph.md 에 기록
  - 같은 L1·다른 L2면  → 해당 L1의 _graph.md 에 기록
  - 같은 L2(동일 leaf) → 크로스 아님. 각 파일 related: 섹션으로만 처리(graph 미기록).

→ 결정된 레벨의 _graph.md에 엣지 추가:
  | {from_id} | {to_id} | {edge_type} | {link_strength} |
```

---

## 3. _index.md 업데이트 규칙

파일 저장 완료 후 해당 카테고리 _index.md를 업데이트한다.

```
entry_count 정의: 해당 카테고리가 직접 보유한 Thought 파일 수.
  하위 카테고리의 파일은 합산하지 않는다(누적 아님).
  중간노드(하위 카테고리만 보유)의 entry_count는 0으로 유지된다.

업데이트 대상: Thought 파일이 실제 저장된 leaf _index.md 한 곳만.
  상위(중간노드) _index.md의 entry_count는 건드리지 않는다.

1. (저장된 leaf의) entry_count +1
2. examples 항목 수 확인:
   5개 미만 → 새 파일의 title을 examples에 추가
   5개 이상 → 업데이트 없음
3. 하위 목록에 새 파일 항목 추가
```

---

## 4. _lint_status.md 업데이트

```
저장 완료 후: ingest_since_lint +1
```

---

## 5. log.md 기록

```
형식: {timestamp} | INGEST | {file_id}
예시: 2026-05-30T09:20:00 | INGEST | dl-health-20260530-006
```

---

## 6. Ingest 완료 self-check (원자성 보장)

Ingest 1회는 여러 파일을 갱신하므로 부분 실패가 영구화되지 않도록, 저장 종료 전
아래 항목을 명시적으로 점검하고 누락분을 즉시 보정한 뒤 완료를 선언한다.

```
[ ] Thought 파일 생성 (ID 중복 없음 재확인)
[ ] leaf _index.md: entry_count +1 / examples 보충(5개 미만 시) / 하위 목록에 항목 추가
[ ] (L2 자동 생성 시) 부모 중간노드 _index.md 하위 카테고리 목록 반영
[ ] (크로스 카테고리 시) 결정된 레벨 _graph.md에 엣지 추가
[ ] _lint_status.md: ingest_since_lint +1
[ ] log.md: INGEST 기록 (자동 생성 시 CATEGORY 기록도)

위 6개를 모두 확인한 뒤에만 Ingest 완료로 간주한다.
하나라도 누락 시 해당 파일을 보정하고 재점검한다.

내부 Lint 트리거 진입점:
  보정 완료 후 _lint_status.md의 ingest_since_lint ≥ 50이면 사용자에게 Lint 실행을
  안내한다(내부 자동 트리거는 이 조건이 유일하다).
```
