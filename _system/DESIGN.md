# Second Brain 시스템 설계 (v6.0 벡터 하이브리드)

이 문서는 설계 결정의 완전한 레퍼런스입니다. 운영 규칙은 `_rules/operations/`에 있습니다.
검증 결과는 `./VERIFICATION.md` 참조.

---

## §v6.0 — 벡터 하이브리드 (현행)

**정체성 전환**: "주제별 정보 아카이브"(v5 daily_life/learning) → **"인지유형별 사고 기록"**.
L1 = 인지유형 5종(episodic·semantic·procedural·reflective·thesis, 약어 ep/se/pr/rf/th).
주제는 L1이 아니라 `tags` + 벡터가 담당한다. Thought는 `memory/` 직속에 저장되고(폴더 없음)
인지유형은 `category_path`로 식별한다(v6.1 flat).

**근본 동기**: 인지유형과 주제는 직교 차원이라 폴더로 둘 다 가지치기할 수 없고(주제가 5개
인지유형에 흩어져 조회 fan-out 폭발), 화행 신호 라우팅은 캐스케이드 토큰 절약을 무력화한다.
→ **벡터 검색이 라우팅을 대신**하면 인지유형 L1 정체성을 토큰 비용 0으로 얻고 캐스케이드·화행
게이트·TEMPR·RRF·fan-out이 전부 소멸한다.

**스택**: Ollama `bge-m3`(1024-dim, cosine) + sqlite-vec, 로컬 Node CLI(`tools/`). Claude가 Bash로
`tools/query.mjs`를 호출해 후보 ID/경로만 받아 해당 markdown만 로드(Lazy Loading 유지).

**이식성 재정의**: markdown = **SSOT**, 벡터DB(`tools/.index/brain.db`) = `index --all`로 재생성
가능한 **파생 인덱스**(gitignore). "순수 markdown" 원칙은 SSOT+파생 모델로 보존된다.

**LLM ↔ 결정론 분업**: 조회 랭킹·Lint 정합성(entry_count·examples centroid·near-miss·broken)·관계
후보 발견(`query --related`)은 CLI/벡터로 이관. 인지유형 화행 판단·edge_type 의미·답변 합성만 LLM.

**데이터 형식 변경**:
- `memory_type` 필드 **제거** — L1(category_path 인지유형 한 토막)이 대신한다.
- ID = `{인지유형약어}-{YYYYMMDD}-{순번}`(예 `ep-20260607-001`, 세부 토막 없음). 접두사=L1 식별.
- edge 온톨로지를 `_rules/edges/`로 **분리**(`edge_schema.md` SSOT + `_active.md` 바인딩).
  9 실엣지 + near-miss. base_score=link_strength 초기값, edge_weight=graph_score 재순위 계수.
  near-miss(weight 0)=로드 제외 신호. 2홉 graph_score=두 홉 edge_weight의 min.
- 크로스 엣지: 같은 인지유형 내는 `related:`, **다른 인지유형 간만** 루트 `memory/_graph.md`
  (flat이라 per-type _graph.md 없음).

> 현행 정본은 위 §v6.0 + `_rules/edges/edge_schema.md`·`_rules/categories/category_schema.md`다.
> 아래 §1은 핵심 원칙(현행 반영), §2는 v5.0 구조의 **이력 요약**(폐기됨)이다.

---

## 1. 핵심 원칙

| 원칙 | 내용 |
|---|---|
| 토큰 절감 | Lazy Loading 철칙. 각 단계마다 필요한 파일만 순차 로드 |
| 이식성 | markdown = SSOT + sqlite-vec 파생 인덱스(언제든 `index --all`로 재생성) |
| 외부 아키텍처 통합 | Karpathy LLM Wiki 3층(Ingest/Query/Lint). (TEMPR/RRF 조회 전략은 v6 벡터로 대체) |

---

## 2. (이력) v5.0 구조 요약 — 전부 폐기됨

v5.0은 아래 구조를 가졌고 **v6.0/v6.1에서 모두 폐기**됐다(현행은 §v6.0):

- **L2 주제 폴더 트리**: `memory/{daily_life,learning}/…/{L2}/*.md` 다층 디렉토리.
  → flat로 폐기(모든 Thought는 `memory/` 직속, 인지유형은 `category_path`).
- **`memory_type` 4종 필드**(semantic/procedural/episodic/reflective). → L1(category_path 인지유형)으로 대체.
- **ID `{카테고리코드}-{세부}-{날짜}-{순번}`**(예 `dl-health-20260524-001`). → `{인지유형약어}-{YYYYMMDD}-{순번}`.
- **per-folder `_index.md`**(헤더+하위목록, entry_count·examples). → `memory/index.md` 단일 통계 섹션(lint 갱신).
- **3단 캐스케이드(Keyword/Tag/Semantic)·TEMPR·RRF·Multi-path 조회**. → 단일 벡터 검색 + 메타필터.
- **분할 트리거**(leaf `_index.md` 50건 / `_graph.md` 100건). → flat에 L2 자동분할 없음(사용자 판단; `lint_rules.md §6`).
- **link_strength/edge 수치 표**(DESIGN 내장). → 정본을 `_rules/edges/edge_schema.md`로 이관.

상세 v5.0 검증 이력은 `./VERIFICATION.md`의 "(이력) … v5.0" 절에 펜스 보존돼 있다.

---

## 3. 검증 결과

end-to-end 검증 요약은 별도 문서에 보관한다.

- 경로: `./VERIFICATION.md`
- 내용: v5.0 이력 검증(#1–#9, G1–G4) + **§v6.0 벡터 하이브리드 검증**(직교 조회·관계 발견·Lint
  결정론·이식성 등) 시나리오별 입력·검증 대상·결과(PASS) 표.
