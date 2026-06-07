# edge_schema.md — edge 온톨로지 (SSOT)

Thought 간 관계(`related:`의 `edge_type`)와 크로스 엣지(`memory/_graph.md`)에 쓰이는 edge의
**단일 출처**다. base_score/edge_weight 수치는 **여기에만** 둔다(operation 규칙에 하드코딩 금지).

`_rules/edges/_active.md`가 이 파일을 활성 edge 스키마로 가리킨다. edge 교체/추가는 이 파일과
바인딩만 수정한다.

edge는 **강도가 아니라 관계의 종류**가 다르다(의미 분기 1차, 수치 2차). 임베딩이 못 잡는
방향성 관계(supports/contradicts/near-miss 등)를 명시해 벡터 검색의 사각을 보완한다.

---

## edge 정의 표

| edge_type | 의미 (`from → to`) | 대칭 | base_score | edge_weight |
|---|---|---|---|---|
| extends | from이 to를 확장한다 | 비대칭 | 0.70 | 1.0 |
| refines | from이 to를 개선·정제한 버전이다 | 비대칭 | 0.70 | 1.0 |
| instantiates | from은 to(추상)의 구체 사례다 | 비대칭 | 0.65 | 0.9 |
| requires | from은 to를 선행조건으로 요구한다 | 비대칭 | 0.65 | 0.9 |
| supports | from이 to를 근거로 지지한다 | 비대칭 | 0.60 | 0.85 |
| synthesized | from(통찰)이 to를 종합한 근거다 | 비대칭 | 0.60 | 0.85 |
| triggered-by | from이 to에 의해 촉발됐다 | 비대칭 | 0.55 | 0.8 |
| contradicts | from이 to와 모순된다 | 비대칭 | 0.50 | 0.75 |
| references | from이 to를 약하게 참조한다 | 비대칭 | 0.40 | 0.6 |
| near-miss | 유사하나 구별되는 별개다 | 대칭 | 0.30 | 0.0 |

- **base_score**: 신규 `related:` 생성 시 `link_strength` 초기값. (이후 Lint가 co_occurrence로 재산정)
- **edge_weight**: query graph_score 재순위 계수.
- **near-miss edge_weight 0 = 로드 제외 신호**: near-miss로만 연결된 후보는 graph 가산이 0이라
  자동 끌어오기에서 제외된다(중복/혼동 방지). 검색 자체는 차단하지 않는다.

---

## link_strength 공식 (storage 초기화 / lint 재산정)

```
초기값:      link_strength = base_score,  co_occurrence_count = 0
Lint 재산정: link_strength = max(base_score, base_score × 0.6 + co_occurrence_score × 0.4)
             co_occurrence_score = min(co_occurrence_count / 20, 1.0)
```

## graph_score 재순위 (query — 벡터 score 보정용, 선택적)

벡터 검색이 1차 후보를 정한 뒤, edge 연결로 **선택적 재순위**한다(라우팅 주체가 아니라 보정).

```
graph_score = 거리계수 × edge_weight
  거리계수: 직접 related 1.0 / 크로스 _graph.md 0.7 / 2홉 0.4 / 없음 0.0
  복수 연결: 연결별 (거리계수 × edge_weight)의 최댓값
  2홉(A→M→B): edge_weight = 두 홉의 min  (near-miss 한 홉이면 0 → 차단 전파)
```

방향성: `related:`/`_graph.md`는 단방향 기록이므로 query는 from/to 양방향으로 매칭한다.

---

## 사용 규약

- **edge_type 선택 주체는 LLM**이다(두 사고의 관계 의미로 판단; 알고리즘 아님).
  near-miss는 "거의 중복이나 별개"일 때만 부여한다.
- **reflective**(L1) Thought의 `related:` edge_type은 `synthesized`를 기본 사용한다(통찰의 근거 묶음).
- **thesis**(L1) Thought는 근거로 `supports`/`contradicts`를 사용한다.
- 같은 인지유형 내 관계는 파일 `related:`로, **다른 인지유형 간 관계만** `memory/_graph.md`에 기록한다.
