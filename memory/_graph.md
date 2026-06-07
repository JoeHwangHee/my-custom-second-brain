# _graph.md — L1(인지유형) 간 크로스 엣지 인덱스

인지유형을 넘나드는 크로스 엣지를 인덱싱한다(동일 인지유형 내 관계는 각 Thought 파일의 related: 에서 처리).
reflective의 필수 synthesized·thesis의 supports/contradicts처럼 frontmatter related: 에도 있는 크로스
엣지는 여기에도 함께 둔다 — 이 표는 크로스 엣지의 인덱스이지 배타적 저장소가 아니다.

flat 구조라 인지유형 폴더가 없으므로 크로스 엣지는 항상 이 루트 파일 한 곳에 모인다(per-type _graph.md 없음).
Lint(tools/lint.mjs)이 frontmatter related: 와 이 표를 함께 읽어 정합성을 점검한다(고아 오판정 방지·끊긴
크로스 엣지=graph-broken-edge 탐지). 인지유형당 항목 과다 시 분할은 사용자 판단 + 향후 확장 항목이다.

---

| from_id | to_id | edge_type | link_strength |
|---|---|---|---|
