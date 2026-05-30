# query_rules.md — 조회 규칙

_router.md에서 Query로 확정된 입력을 처리한다.
_router.md Stage 3의 subject 필드를 쿼리 입력으로 사용한다.

---

## 1. 카테고리 탐색 — 3단 캐스케이드

### Step 1 — Keyword Routing (결정론적)

```
쿼리 subject에서 키워드 추출
→ root/index.md의 L1 카테고리 keywords 대조

단일 매칭:      즉시 해당 경로로 탐색 진입. Step 2, 3 스킵.
복수 매칭(≤2): Multi-path 탐색 (4항 참고)
복수 매칭(≥3): 쿼리 분리 요청
               "쿼리가 여러 분야에 걸쳐 있습니다. 구체화해 주시겠습니까?"
```

### Step 2 — Tag Navigation (준결정론적)

```
Step 1로 L1 결정 후 하위 레벨 탐색 시 적용
→ 쿼리 tags/키워드 ↔ 하위 _index.md keywords 대조
→ 매칭 시 해당 하위 경로로 진입. Step 3 스킵.
```

### Step 3 — Semantic Judgment (LLM 판단)

```
Step 1, 2로 경로 미결정 시에만 진입
→ LLM이 후보 _index.md 헤더(description + keywords + examples) 읽고 진입 여부 판단
→ 판단 불가 시 해당 레벨 _graph.md 크로스 엣지 참조하여 관련 카테고리 후보 확인
```

---

## 2. 계층 탐색 알고리즘

Semantic 45% 가중치의 실체. 탐색 과정 자체가 의미론적 매칭이다.

```
1. root/index.md 로드 → L1 카테고리 목록 + 각 description 확인
2. 3단 캐스케이드로 진입 L1 결정
3. 해당 L1/_index.md 로드 → 하위 카테고리 목록 + 각 description 확인
4. 3단 캐스케이드로 진입 L2 결정
5. 최종 타깃 파일 도달 시 중단 (나머지 파일 미로드)

원칙: 필요한 레벨까지만 탐색. 타깃 외 파일 로드 금지.
```

---

## 3. TEMPR 점수 산정 (파일별)

탐색으로 찾은 파일들을 순위 매길 때 사용한다.

```
[keyword_score — 25%]
= 쿼리 키워드 중 (title + tags) 매칭 수 / 쿼리 키워드 총수
범위: 0.0 ~ 1.0

[semantic_score — 45%]
= 해당 경로를 결정한 캐스케이드 Stage 신뢰도
  Step 1 (Keyword Routing): 1.0
  Step 2 (Tag Navigation):  0.8
  Step 3 (LLM Judgment):    0.6
동일 경로 내 파일은 동일 semantic_score 공유

[graph_score — 20%]
  직접 related: 링크 존재:      1.0
  _graph.md 크로스 엣지 연결:   0.7
  2홉 연결 (related의 related): 0.4
  연결 없음:                    0.0

[time_score — 10%]
  ≤ 30일:       1.0
  31 ~ 90일:    0.7
  91 ~ 180일:   0.4
  181 ~ 365일:  0.2
  365일 초과:   0.0

TEMPR_score = keyword × 0.25
            + semantic × 0.45
            + graph    × 0.20
            + time     × 0.10
```

---

## 4. Multi-path 탐색 및 RRF 병합

### 단일 경로

```
TEMPR_score 내림차순 정렬 → 결과 반환
```

### 복수 경로 (최대 2경로)

```
각 경로 내에서 TEMPR_score로 순위 산정 후 RRF 병합

RRF_score(file) = Σ_paths (semantic_score_of_path × 1 / (60 + rank_in_path))

semantic_score_of_path:
  해당 경로를 결정한 Step 신뢰도 (1.0 / 0.8 / 0.6)
  → 더 신뢰도 높은 경로의 결과가 상단 점유

k = 60 (표준값. 상위 랭크 파일의 점수 독점 방지)

최종 RRF_score 내림차순 정렬 후 반환
```

### 동점 처리 우선순위

```
1. keyword_score 높은 순
2. date 최신순
3. confidence 필드: high > medium > low
```

### 경계 쿼리 보조 (_graph.md 활용)

```
탐색 시작 전 root/_graph.md 확인
→ 쿼리 관련 카테고리에 크로스 엣지가 존재하면
  해당 타깃 카테고리를 Multi-path 후보에 추가
```

---

## 5. Graph 탐색 규칙

```
관계 탐색 우선순위:
  1. 대상 파일의 related: 섹션 (토큰 최소)
  2. 카테고리 경계 넘는 관계 필요 시 해당 레벨 _graph.md 로드
  3. L1 간 관계 필요 시에만 root/_graph.md 로드

원칙: 필요한 레벨까지만 올라가는 지연 탐색
```

---

## 6. reflective 파일 보정

```
쿼리 subject에 "패턴", "교훈", "되돌아보면", "변화" 포함 시:
→ tags에 "reflective" 포함 파일의 keyword_score에 +0.2 보정 적용
```

---

## 7. log.md 기록

```
형식: {timestamp} | QUERY | {subject} | {accessed_file_ids}

accessed_file_ids: 실제 전체 내용이 로드된 파일 ID 목록 (상한 10개)
                   _index.md 탐색 중 스캔만 된 파일은 미포함

예시: 2026-05-30T09:15:00 | QUERY | 운동 루틴 조회 | dl-health-001,dl-health-003
```
