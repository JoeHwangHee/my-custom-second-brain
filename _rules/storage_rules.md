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
related: 항목의 대상 파일 ID 접두사를 파싱하여 카테고리 판단
현재 파일 카테고리코드 ≠ 대상 파일 카테고리코드 → 크로스 카테고리
→ 해당 레벨 _graph.md에 엣지 추가:
  | {from_id} | {to_id} | {edge_type} | {link_strength} |
```

---

## 3. _index.md 업데이트 규칙

파일 저장 완료 후 해당 카테고리 _index.md를 업데이트한다.

```
1. entry_count +1
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
