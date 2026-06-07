# _active.md — 활성 edge 스키마 바인딩

operation 규칙(storage / query / delete / lint)은 edge 정의(의미·base_score·edge_weight)를 직접
박지 않고, `active_edge_schema`가 가리키는 **"활성 edge 스키마"**를 참조한다. edge 온톨로지를
교체하려면 이 한 곳만 바꾼다. 경로는 `_rules/edges/` 기준 상대다.

`_rules/categories/_active.md`(활성 카테고리 스키마)와 동일한 바인딩 시임 패턴이다.

```
active_edge_schema: edge_schema.md
available: [edge_schema.md]
```
