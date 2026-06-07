# query_rules.md — 조회 규칙 (v6.0 벡터 하이브리드)

`_system/router.md`에서 Query로 확정된 입력을 처리한다. Stage 3의 subject를 쿼리로 사용한다.

> v5의 3단 캐스케이드·TEMPR·RRF·Multi-path·계층탐색은 **벡터 검색으로 대체**됐다. 라우팅은
> `tools/query.mjs`(임베딩 KNN + 메타필터)가 결정론적으로 수행하고, LLM은 반환된 후보만 로드해
> 답변을 합성한다(Lazy Loading 유지).

---

## 1. 벡터 검색 호출

```
node tools/query.mjs "<subject>" [--type <인지유형>] [--tag <주제>] [--topk 8] --json

--type: 쿼리에 인지유형 의도가 명시되면 필터(ep/se/pr/rf/th 또는 풀네임).
        예) "운동에 대한 내 주장" → --type th, "그때 운동한 거" → --type ep.
        명시 없으면 생략(전 인지유형 검색).
--tag : 쿼리가 특정 주제로 좁혀지면 필터. (인지유형 --type 과 독립 — 직교 차원 동시 적용)
```

핵심: `--type`(인지유형)과 `--tag`/쿼리의미(주제)는 **독립 필터**다. 같은 주제가 여러 인지유형에
흩어져 있어도 fan-out/RRF 없이 한 번의 벡터 검색 + 메타필터로 해소된다.

반환(JSON): `[{id, path, title, type, score, snippet}]` (score = 1 − cosine_distance).

---

## 2. 후보 로드 (Lazy Loading)

```
query.mjs가 돌려준 path의 Thought 파일만 로드한다(상위 topk).
탐색 경로 밖 파일은 로드하지 않는다. 후보가 비면 사용자에게 재질의/구체화 요청.
```

---

## 3. graph_score 선택적 재순위 (edge 보정)

벡터 score가 1차다. 필요 시 edge 연결로 보정한다(활성 edge 스키마의 edge_weight 사용).

```
graph_score = 거리계수 × edge_weight   (직접 related 1.0 / _graph.md 0.7 / 2홉 0.4)
  복수 연결: 최댓값. 2홉: 두 홉 edge_weight의 min.
  near-miss(edge_weight 0)로만 연결된 후보 → graph 가산 0 → 자동 끌어오기 제외.
final ≈ score(벡터) + 0.2 × graph_score   (보정 계수는 경험적; 벡터 우위 유지)
```

edge_weight/방향 규칙은 `_rules/edges/edge_schema.md` 참조. 양방향 매칭(from/to).
이 보정은 이미 로드한 후보 frontmatter의 `related:` / 해당 `_graph.md`만으로 수행(추가 로드 없음).

---

## 4. reflective 보정

```
쿼리에 "패턴/교훈/되돌아보면/변화" 포함 시:
→ --type rf 를 우선 적용하거나, 결과 중 type=reflective 후보의 순위를 소폭 가산(+0.2).
```

---

## 5. 관계 탐색 (필요 시)

```
1순위: 후보 파일의 related: (이미 로드, 무료)
2순위: 다른 인지유형 관계 필요 시 memory/_graph.md 로드
원칙: 필요한 만큼만. 벡터 검색이 1차 후보를 이미 제공하므로 그래프는 보조다.
```

---

## 6. log 기록

```
{timestamp} | QUERY | {subject} | {accessed_file_ids}
accessed_file_ids: 실제 전체 로드된 파일 ID (상한 10개) — lint co_occurrence 입력.
```
